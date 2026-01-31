import operationTypeRepository from '../repositories/operation-type.repository';
import logger from '../config/logger';

interface CreateOperationTypeInput {
  code: string;
  name: string;
  description?: string;
  isExternal?: boolean;
  defaultHourlyRate?: number;
  requiresLiquidProduct?: boolean;
  sortOrder?: number;
}

interface UpdateOperationTypeInput {
  code?: string;
  name?: string;
  description?: string;
  isExternal?: boolean;
  defaultHourlyRate?: number;
  requiresLiquidProduct?: boolean;
  sortOrder?: number;
}

/**
 * OperationType Service
 * Business logic per gestione tipi di operazione/mansione
 */
class OperationTypeService {
  /**
   * Lista tutti i tipi operazione
   */
  async getAll(includeInactive = false) {
    const types = await operationTypeRepository.findAll(includeInactive);
    logger.debug(`Retrieved ${types.length} operation types`);
    return types;
  }

  /**
   * Ottieni tipo operazione per ID
   */
  async getById(id: string) {
    const type = await operationTypeRepository.findById(id);
    if (!type) {
      throw new Error('Tipo operazione non trovato');
    }
    return type;
  }

  /**
   * Ottieni tipo operazione per codice
   */
  async getByCode(code: string) {
    return operationTypeRepository.findByCode(code);
  }

  /**
   * Crea nuovo tipo operazione
   */
  async create(data: CreateOperationTypeInput) {
    // Verifica codice univoco
    const existing = await operationTypeRepository.findByCode(data.code);
    if (existing) {
      throw new Error(`Tipo operazione con codice "${data.code}" esiste già`);
    }

    // Ottieni prossimo sortOrder se non specificato
    const sortOrder = data.sortOrder ?? await operationTypeRepository.getNextSortOrder();

    const operationType = await operationTypeRepository.create({
      code: data.code.toUpperCase(),
      name: data.name,
      description: data.description,
      isExternal: data.isExternal || false,
      defaultHourlyRate: data.defaultHourlyRate,
      requiresLiquidProduct: data.requiresLiquidProduct || false,
      sortOrder,
    });

    logger.info(`Created operation type: ${operationType.code} - ${operationType.name}`);

    return operationType;
  }

  /**
   * Aggiorna tipo operazione
   */
  async update(id: string, data: UpdateOperationTypeInput) {
    const existing = await operationTypeRepository.findById(id);
    if (!existing) {
      throw new Error('Tipo operazione non trovato');
    }

    // Se cambia codice, verifica unicità
    if (data.code && data.code !== existing.code) {
      const codeExists = await operationTypeRepository.findByCode(data.code);
      if (codeExists) {
        throw new Error(`Tipo operazione con codice "${data.code}" esiste già`);
      }
    }

    const updateData: any = { ...data };
    if (updateData.code) {
      updateData.code = updateData.code.toUpperCase();
    }

    const operationType = await operationTypeRepository.update(id, updateData);

    logger.info(`Updated operation type: ${operationType.code}`);

    return operationType;
  }

  /**
   * Elimina tipo operazione (soft delete)
   */
  async delete(id: string) {
    // Verifica che non sia usato in fasi
    const isUsed = await operationTypeRepository.isUsedInPhases(id);
    if (isUsed) {
      throw new Error('Impossibile eliminare: tipo operazione utilizzato in fasi di produzione');
    }

    await operationTypeRepository.delete(id);

    logger.info(`Deleted operation type: ${id}`);

    return { success: true };
  }

  /**
   * Riordina tipi operazione
   */
  async reorder(orderedIds: string[]) {
    await operationTypeRepository.reorder(orderedIds);
    logger.info('Reordered operation types');
    return { success: true };
  }

  /**
   * Ottieni tipi operazione esterni (terzisti)
   */
  async getExternalTypes() {
    const all = await operationTypeRepository.findAll();
    return all.filter(t => t.isExternal);
  }

  /**
   * Ottieni tipi operazione interni
   */
  async getInternalTypes() {
    const all = await operationTypeRepository.findAll();
    return all.filter(t => !t.isExternal);
  }

  /**
   * Seed tipi operazione di default
   */
  async seedDefaults() {
    const defaults = [
      { code: 'PROD_INTERNA', name: 'Produzione Interna', isExternal: false, defaultHourlyRate: 25 },
      { code: 'PROD_ESTERNA', name: 'Produzione Esterna', isExternal: true, defaultHourlyRate: 30 },
      { code: 'SCATOLAMENTO', name: 'Scatolamento', isExternal: false, defaultHourlyRate: 20 },
      { code: 'IMBOCCETTAMENTO', name: 'Imboccettamento', isExternal: false, defaultHourlyRate: 22, requiresLiquidProduct: true },
      { code: 'PULIZIA', name: 'Pulizia/Smerigliatura', isExternal: false, defaultHourlyRate: 18 },
      { code: 'ASSEMBLAGGIO', name: 'Assemblaggio', isExternal: false, defaultHourlyRate: 25 },
      { code: 'CONTROLLO_QUALITA', name: 'Controllo Qualità', isExternal: false, defaultHourlyRate: 28 },
      { code: 'ETICHETTATURA', name: 'Etichettatura', isExternal: false, defaultHourlyRate: 18 },
      { code: 'CONFEZIONAMENTO', name: 'Confezionamento', isExternal: false, defaultHourlyRate: 20 },
    ];

    const created = [];
    for (let i = 0; i < defaults.length; i++) {
      const def = defaults[i];
      const existing = await operationTypeRepository.findByCode(def.code);
      if (!existing) {
        const operationType = await operationTypeRepository.create({
          ...def,
          sortOrder: i + 1,
        });
        created.push(operationType);
      }
    }

    logger.info(`Seeded ${created.length} default operation types`);

    return created;
  }

  // ============================================
  // QUALIFIED EMPLOYEES MANAGEMENT
  // ============================================

  /**
   * Get qualified employees for operation type
   */
  async getQualifiedEmployees(operationTypeId: string) {
    // Verify operation type exists
    await this.getById(operationTypeId);

    const qualifiedEmployees = await operationTypeRepository.getQualifiedEmployees(operationTypeId);

    logger.debug(`Retrieved ${qualifiedEmployees.length} qualified employees for operation type ${operationTypeId}`);

    return qualifiedEmployees;
  }

  /**
   * Add qualified employee to operation type
   */
  async addQualifiedEmployee(operationTypeId: string, employeeId: string, isPrimary: boolean = false) {
    // Verify operation type exists
    await this.getById(operationTypeId);

    // Check if already qualified
    const isAlreadyQualified = await operationTypeRepository.isEmployeeQualified(operationTypeId, employeeId);
    if (isAlreadyQualified) {
      throw new Error('Dipendente già qualificato per questa fase');
    }

    const result = await operationTypeRepository.addQualifiedEmployee(operationTypeId, employeeId, isPrimary);

    // Update the defaultHourlyRate with the new average
    await this.updateHourlyRateFromEmployees(operationTypeId);

    logger.info(`Added employee ${employeeId} as qualified for operation type ${operationTypeId}`);

    return result;
  }

  /**
   * Remove qualified employee from operation type
   */
  async removeQualifiedEmployee(operationTypeId: string, employeeId: string) {
    // Verify operation type exists
    await this.getById(operationTypeId);

    // Check if qualified
    const isQualified = await operationTypeRepository.isEmployeeQualified(operationTypeId, employeeId);
    if (!isQualified) {
      throw new Error('Dipendente non qualificato per questa fase');
    }

    await operationTypeRepository.removeQualifiedEmployee(operationTypeId, employeeId);

    // Update the defaultHourlyRate with the new average
    await this.updateHourlyRateFromEmployees(operationTypeId);

    logger.info(`Removed employee ${employeeId} from qualified for operation type ${operationTypeId}`);

    return { success: true };
  }

  /**
   * Update qualified employee (e.g., set as primary)
   */
  async updateQualifiedEmployee(operationTypeId: string, employeeId: string, data: { isPrimary?: boolean }) {
    // Verify operation type exists
    await this.getById(operationTypeId);

    // Check if qualified
    const isQualified = await operationTypeRepository.isEmployeeQualified(operationTypeId, employeeId);
    if (!isQualified) {
      throw new Error('Dipendente non qualificato per questa fase');
    }

    const result = await operationTypeRepository.updateQualifiedEmployee(operationTypeId, employeeId, data);

    logger.info(`Updated qualified employee ${employeeId} for operation type ${operationTypeId}`);

    return result;
  }

  /**
   * Calculate average hourly rate from qualified employees
   * Returns null if no employees and no defaultHourlyRate
   */
  async calculateAverageHourlyRate(operationTypeId: string): Promise<{
    averageHourlyRate: number | null;
    employeeCount: number;
    source: 'employees' | 'default' | 'none';
  }> {
    // Verify operation type exists
    const operationType = await this.getById(operationTypeId);

    const qualifiedEmployees = await operationTypeRepository.getQualifiedEmployees(operationTypeId);

    if (qualifiedEmployees.length === 0) {
      // No employees, use default
      const defaultRate = operationType.defaultHourlyRate ? Number(operationType.defaultHourlyRate) : null;
      return {
        averageHourlyRate: defaultRate,
        employeeCount: 0,
        source: defaultRate ? 'default' : 'none',
      };
    }

    // Calculate average from employees
    const rates = qualifiedEmployees
      .map((qe: any) => Number(qe.employee.hourlyRate))
      .filter((rate: number) => rate > 0);

    if (rates.length === 0) {
      // Employees exist but no valid rates, use default
      const defaultRate = operationType.defaultHourlyRate ? Number(operationType.defaultHourlyRate) : null;
      return {
        averageHourlyRate: defaultRate,
        employeeCount: qualifiedEmployees.length,
        source: defaultRate ? 'default' : 'none',
      };
    }

    const average = rates.reduce((sum: number, rate: number) => sum + rate, 0) / rates.length;

    logger.debug(`Calculated average hourly rate for operation type ${operationTypeId}: €${average.toFixed(2)} from ${rates.length} employees`);

    return {
      averageHourlyRate: average,
      employeeCount: rates.length,
      source: 'employees',
    };
  }

  /**
   * Get operation type with calculated hourly rate
   */
  async getByIdWithHourlyRate(operationTypeId: string) {
    const operationType = await this.getById(operationTypeId);
    const hourlyRateInfo = await this.calculateAverageHourlyRate(operationTypeId);

    return {
      ...operationType,
      calculatedHourlyRate: hourlyRateInfo.averageHourlyRate,
      hourlyRateSource: hourlyRateInfo.source,
      qualifiedEmployeeCount: hourlyRateInfo.employeeCount,
    };
  }

  /**
   * Update the defaultHourlyRate based on qualified employees' average
   * Called automatically when employees are added/removed
   */
  private async updateHourlyRateFromEmployees(operationTypeId: string) {
    const qualifiedEmployees = await operationTypeRepository.getQualifiedEmployees(operationTypeId);

    if (qualifiedEmployees.length === 0) {
      // No employees, keep current defaultHourlyRate
      return;
    }

    // Calculate average from employees with valid rates
    const rates = qualifiedEmployees
      .map((qe: any) => Number(qe.employee.hourlyRate))
      .filter((rate: number) => rate > 0);

    if (rates.length === 0) {
      // No valid rates, keep current defaultHourlyRate
      return;
    }

    const averageRate = rates.reduce((sum: number, rate: number) => sum + rate, 0) / rates.length;

    // Update the operation type's defaultHourlyRate
    await operationTypeRepository.update(operationTypeId, {
      defaultHourlyRate: averageRate,
    });

    logger.info(`Updated defaultHourlyRate for operation type ${operationTypeId} to €${averageRate.toFixed(2)} (avg of ${rates.length} employees)`);
  }
}

export default new OperationTypeService();
