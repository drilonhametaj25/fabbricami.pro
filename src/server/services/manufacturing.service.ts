import { prisma } from '../config/database';
import materialService from './material.service';
import notificationService from './notification.service';
import operationTypeRepository from '../repositories/operation-type.repository';
import logger from '../config/logger';

// Interfaces for BOM explosion with traceability
interface ExplodedMaterial {
  materialId: string;
  materialName: string;
  materialCode: string;
  quantity: number;
  unit: string;
  costPerUnit: number;
  totalCost: number;
  origin: string;
  originProductId: string | null;
  originProductName: string | null;
  phaseId: string | null;
  phaseName: string | null;
}

interface ExplodedBomProduct {
  productId: string;
  productName: string;
  productSku: string;
  quantity: number;
  costPerUnit: number;
  totalCost: number;
  materials: ExplodedMaterial[];
  subProducts: ExplodedBomProduct[];
}

interface ProductCostBreakdown {
  productId: string;
  productName: string;
  laborCost: number;
  materialCost: number;
  externalCost: number;
  bomCost: number;
  totalCost: number;
  breakdown: {
    phases: Array<{
      phaseId: string;
      phaseName: string;
      sequence: number;
      operationTypeName: string;
      timeMinutes: number;
      hourlyRate: number;
      hourlyRateSource: 'employees' | 'default' | 'none';
      employeeCount: number;
      materialCost: number;
      laborCost: number;
      externalCost: number;
      materials: Array<{
        materialId: string;
        materialName: string;
        quantity: number;
        unit: string;
        scrapPercentage: number;
        costPerUnit: number;
        totalCost: number;
      }>;
    }>;
    explodedMaterials: ExplodedMaterial[];
    bomProducts: ExplodedBomProduct[];
  };
  warnings: string[];
}

interface PhaseMaterialInput {
  materialId: string;
  quantity: number;
  unit: string;
  scrapPercentage?: number;
  isConsumable?: boolean;
  notes?: string;
}

interface PhaseEmployeeInput {
  employeeId: string;
  isPrimary?: boolean;
}

interface CreatePhaseInput {
  operationTypeId: string;
  sequence: number;
  name: string;
  description?: string;
  standardTime: number;
  setupTime?: number;
  externalCostPerUnit?: number;
  supplierId?: string;
  materials?: PhaseMaterialInput[];
  employees?: PhaseEmployeeInput[];
}

interface UpdatePhaseInput {
  operationTypeId?: string;
  sequence?: number;
  name?: string;
  description?: string;
  standardTime?: number;
  setupTime?: number;
  externalCostPerUnit?: number;
  supplierId?: string;
  materials?: PhaseMaterialInput[];
  employees?: PhaseEmployeeInput[];
}

interface CreateProductionOrderInput {
  productId: string;
  quantity: number;
  salesOrderId?: string;
  plannedStartDate?: Date;
  plannedEndDate?: Date;
  priority?: number;
  notes?: string;
  createdById: string;
}

/**
 * Manufacturing Service
 * Business logic per gestione pipeline produzione, calcolo costi, ordini produzione
 */
class ManufacturingService {
  // ==========================================
  // PIPELINE PRODOTTO
  // ==========================================

  /**
   * Ottieni pipeline completa di un prodotto
   */
  async getProductPipeline(productId: string) {
    const phases = await prisma.manufacturingPhase.findMany({
      where: { productId, isActive: true },
      orderBy: { sequence: 'asc' },
      include: {
        operationType: true,
        externalSupplier: true,
        materials: {
          include: { material: true },
        },
        qualifiedEmployees: {
          include: {
            employee: {
              include: { user: { select: { firstName: true, lastName: true } } },
            },
          },
        },
      },
    });

    logger.debug(`Retrieved pipeline for product ${productId}: ${phases.length} phases`);

    return phases;
  }

  /**
   * Aggiungi fase alla pipeline prodotto
   */
  async addPhaseToProduct(productId: string, data: CreatePhaseInput) {
    // Verifica che il prodotto esista
    const product = await prisma.product.findUnique({ where: { id: productId } });
    if (!product) {
      throw new Error('Prodotto non trovato');
    }

    // Verifica che il tipo operazione esista
    const operationType = await prisma.operationType.findUnique({
      where: { id: data.operationTypeId },
    });
    if (!operationType) {
      throw new Error('Tipo operazione non trovato');
    }

    return prisma.$transaction(async (tx) => {
      // Crea la fase
      const phase = await tx.manufacturingPhase.create({
        data: {
          productId,
          operationTypeId: data.operationTypeId,
          sequence: data.sequence,
          name: data.name,
          description: data.description,
          standardTime: data.standardTime,
          setupTime: data.setupTime || 0,
          externalCostPerUnit: data.externalCostPerUnit,
          supplierId: data.supplierId,
        },
      });

      // Aggiungi materiali
      if (data.materials && data.materials.length > 0) {
        await tx.phaseMaterial.createMany({
          data: data.materials.map((m) => ({
            phaseId: phase.id,
            materialId: m.materialId,
            quantity: m.quantity,
            unit: m.unit,
            scrapPercentage: m.scrapPercentage || 0,
            isConsumable: m.isConsumable || false,
            notes: m.notes,
          })),
        });
      }

      // Aggiungi dipendenti qualificati
      if (data.employees && data.employees.length > 0) {
        await tx.phaseEmployee.createMany({
          data: data.employees.map((e) => ({
            phaseId: phase.id,
            employeeId: e.employeeId,
            isPrimary: e.isPrimary || false,
          })),
        });
      }

      logger.info(`Added phase "${data.name}" to product ${productId}`);

      // Ritorna fase con relazioni
      return tx.manufacturingPhase.findUnique({
        where: { id: phase.id },
        include: {
          operationType: true,
          materials: { include: { material: true } },
          qualifiedEmployees: { include: { employee: true } },
        },
      });
    });
  }

  /**
   * Aggiorna fase
   */
  async updatePhase(phaseId: string, data: UpdatePhaseInput) {
    const existing = await prisma.manufacturingPhase.findUnique({
      where: { id: phaseId },
    });
    if (!existing) {
      throw new Error('Fase non trovata');
    }

    return prisma.$transaction(async (tx) => {
      // Aggiorna dati base fase
      await tx.manufacturingPhase.update({
        where: { id: phaseId },
        data: {
          operationTypeId: data.operationTypeId,
          sequence: data.sequence,
          name: data.name,
          description: data.description,
          standardTime: data.standardTime,
          setupTime: data.setupTime,
          externalCostPerUnit: data.externalCostPerUnit,
          supplierId: data.supplierId,
        },
      });

      // Aggiorna materiali se forniti
      if (data.materials !== undefined) {
        await tx.phaseMaterial.deleteMany({ where: { phaseId } });
        if (data.materials.length > 0) {
          await tx.phaseMaterial.createMany({
            data: data.materials.map((m) => ({
              phaseId,
              materialId: m.materialId,
              quantity: m.quantity,
              unit: m.unit,
              scrapPercentage: m.scrapPercentage || 0,
              isConsumable: m.isConsumable || false,
              notes: m.notes,
            })),
          });
        }
      }

      // Aggiorna dipendenti se forniti
      if (data.employees !== undefined) {
        await tx.phaseEmployee.deleteMany({ where: { phaseId } });
        if (data.employees.length > 0) {
          await tx.phaseEmployee.createMany({
            data: data.employees.map((e) => ({
              phaseId,
              employeeId: e.employeeId,
              isPrimary: e.isPrimary || false,
            })),
          });
        }
      }

      logger.info(`Updated phase ${phaseId}`);

      return tx.manufacturingPhase.findUnique({
        where: { id: phaseId },
        include: {
          operationType: true,
          materials: { include: { material: true } },
          qualifiedEmployees: { include: { employee: true } },
        },
      });
    });
  }

  /**
   * Elimina fase (soft delete)
   */
  async deletePhase(phaseId: string) {
    await prisma.manufacturingPhase.update({
      where: { id: phaseId },
      data: { isActive: false },
    });

    logger.info(`Deleted phase ${phaseId}`);

    return { success: true };
  }

  /**
   * Riordina fasi pipeline
   */
  async reorderPhases(productId: string, phaseIds: string[]) {
    await prisma.$transaction(
      phaseIds.map((id, index) =>
        prisma.manufacturingPhase.update({
          where: { id },
          data: { sequence: index + 1 },
        })
      )
    );

    logger.info(`Reordered phases for product ${productId}`);

    return { success: true };
  }

  // ==========================================
  // CALCOLO COSTO PRODOTTO
  // ==========================================

  /**
   * Calcola costo totale di produzione per un prodotto (versione semplice)
   */
  async calculateProductCost(productId: string) {
    const detailed = await this.calculateProductCostDetailed(productId);

    return {
      productId,
      materialCost: detailed.materialCost,
      laborCost: detailed.laborCost,
      externalCost: detailed.externalCost,
      bomCost: detailed.bomCost,
      totalCost: detailed.totalCost,
      breakdown: detailed.breakdown.phases.map(p => ({
        phaseId: p.phaseId,
        phaseName: p.phaseName,
        sequence: p.sequence,
        materialCost: p.materialCost,
        laborCost: p.laborCost,
        externalCost: p.externalCost,
      })),
    };
  }

  /**
   * Calcola costo completo con esplosione BOM e tracciabilità
   */
  async calculateProductCostDetailed(productId: string, quantity: number = 1): Promise<ProductCostBreakdown> {
    const product = await prisma.product.findUnique({
      where: { id: productId },
    });

    if (!product) {
      throw new Error('Prodotto non trovato');
    }

    const phases = await this.getProductPipeline(productId);
    const warnings: string[] = [];

    let materialCost = 0;
    let laborCost = 0;
    let externalCost = 0;
    let bomCost = 0;

    const phaseBreakdown: ProductCostBreakdown['breakdown']['phases'] = [];
    const explodedMaterials: ExplodedMaterial[] = [];

    // Calcola costo fasi
    for (const phase of phases) {
      let phaseMaterialCost = 0;
      let phaseLaborCost = 0;
      let phaseExternalCost = 0;
      const phaseMaterials: ProductCostBreakdown['breakdown']['phases'][0]['materials'] = [];

      // Costo materiali della fase
      for (const pm of phase.materials) {
        const adjustedQty = Number(pm.quantity) * quantity * (1 + Number(pm.scrapPercentage) / 100);
        const costPerUnit = Number(pm.material.cost);
        const totalMaterialCost = costPerUnit * adjustedQty;

        phaseMaterialCost += totalMaterialCost;

        phaseMaterials.push({
          materialId: pm.materialId,
          materialName: pm.material.name,
          quantity: adjustedQty,
          unit: pm.unit,
          scrapPercentage: Number(pm.scrapPercentage),
          costPerUnit,
          totalCost: totalMaterialCost,
        });

        // Aggiungi a materiali esplosi con tracciabilità
        explodedMaterials.push({
          materialId: pm.materialId,
          materialName: pm.material.name,
          materialCode: pm.material.sku,
          quantity: adjustedQty,
          unit: pm.unit,
          costPerUnit,
          totalCost: totalMaterialCost,
          origin: product.name,
          originProductId: productId,
          originProductName: product.name,
          phaseId: phase.id,
          phaseName: phase.name,
        });
      }

      // Calcola costo orario usando la media degli operatori qualificati del OperationType
      const timeMinutes = phase.standardTime + (phase.setupTime || 0);
      const standardHours = timeMinutes / 60;

      let hourlyRate = 0;
      let hourlyRateSource: 'employees' | 'default' | 'none' = 'none';
      let employeeCount = 0;

      if (phase.operationType.isExternal && phase.externalCostPerUnit) {
        // Fase esterna: usa costo terzista
        phaseExternalCost = Number(phase.externalCostPerUnit) * quantity;
      } else {
        // Fase interna: calcola costo lavoro usando operatori del OperationType
        const avgRate = await operationTypeRepository.calculateAverageHourlyRate(phase.operationTypeId);

        if (avgRate !== null) {
          hourlyRate = avgRate;
          // Determina la sorgente
          const qualifiedEmployees = await operationTypeRepository.getQualifiedEmployees(phase.operationTypeId);
          if (qualifiedEmployees.length > 0) {
            hourlyRateSource = 'employees';
            employeeCount = qualifiedEmployees.length;
          } else {
            hourlyRateSource = 'default';
          }
        } else {
          // Fallback: usa defaultHourlyRate del tipo operazione
          hourlyRate = Number(phase.operationType.defaultHourlyRate) || 25;
          hourlyRateSource = 'default';
          warnings.push(`Fase "${phase.name}": nessun operatore qualificato, usata tariffa default`);
        }

        phaseLaborCost = standardHours * hourlyRate * quantity;
      }

      materialCost += phaseMaterialCost;
      laborCost += phaseLaborCost;
      externalCost += phaseExternalCost;

      phaseBreakdown.push({
        phaseId: phase.id,
        phaseName: phase.name,
        sequence: phase.sequence,
        operationTypeName: phase.operationType.name,
        timeMinutes,
        hourlyRate,
        hourlyRateSource,
        employeeCount,
        materialCost: phaseMaterialCost,
        laborCost: phaseLaborCost,
        externalCost: phaseExternalCost,
        materials: phaseMaterials,
      });
    }

    // Esplosione BOM (sotto-prodotti)
    const bomProducts: ExplodedBomProduct[] = [];
    const bomItems = await prisma.bomItem.findMany({
      where: { parentProductId: productId },
      include: {
        componentProduct: true,
      },
    });

    for (const bomItem of bomItems) {
      const componentQty = Number(bomItem.quantity) * quantity;

      // Calcola ricorsivamente il costo del sotto-prodotto
      const componentCost = await this.calculateProductCostDetailed(bomItem.componentProductId, componentQty);

      bomCost += componentCost.totalCost;

      // Aggiungi materiali del sotto-prodotto con tracciabilità
      for (const expMat of componentCost.breakdown.explodedMaterials) {
        // Controlla se esiste già un materiale con lo stesso ID dal prodotto finale
        const existingFromParent = explodedMaterials.find(
          m => m.materialId === expMat.materialId && m.originProductId === productId
        );

        if (existingFromParent) {
          warnings.push(
            `Attenzione: "${expMat.materialName}" presente sia nel prodotto finale che in "${bomItem.componentProduct.name}". Verifica che non sia duplicato.`
          );
        }

        explodedMaterials.push({
          ...expMat,
          origin: `${expMat.origin} (da: ${bomItem.componentProduct.name})`,
        });
      }

      bomProducts.push({
        productId: bomItem.componentProductId,
        productName: bomItem.componentProduct.name,
        productSku: bomItem.componentProduct.sku,
        quantity: componentQty,
        costPerUnit: componentCost.totalCost / componentQty,
        totalCost: componentCost.totalCost,
        materials: componentCost.breakdown.explodedMaterials,
        subProducts: componentCost.breakdown.bomProducts,
      });
    }

    const totalCost = materialCost + laborCost + externalCost + bomCost;

    logger.debug(`Calculated detailed cost for product ${productId}: ${totalCost} (labor: ${laborCost}, materials: ${materialCost}, external: ${externalCost}, bom: ${bomCost})`);

    return {
      productId,
      productName: product.name,
      laborCost,
      materialCost,
      externalCost,
      bomCost,
      totalCost,
      breakdown: {
        phases: phaseBreakdown,
        explodedMaterials,
        bomProducts,
      },
      warnings,
    };
  }

  /**
   * Ottieni solo il riepilogo costi (senza dettaglio completo)
   */
  async getProductCostSummary(productId: string) {
    const detailed = await this.calculateProductCostDetailed(productId);

    return {
      productId,
      productName: detailed.productName,
      laborCost: detailed.laborCost,
      materialCost: detailed.materialCost,
      externalCost: detailed.externalCost,
      bomCost: detailed.bomCost,
      totalCost: detailed.totalCost,
      phasesCount: detailed.breakdown.phases.length,
      materialsCount: detailed.breakdown.explodedMaterials.length,
      bomProductsCount: detailed.breakdown.bomProducts.length,
      warnings: detailed.warnings,
    };
  }

  // ==========================================
  // CLONAZIONE PRODOTTO
  // ==========================================

  /**
   * Clona un prodotto con tutta la sua pipeline
   */
  async cloneProduct(sourceProductId: string, newSku: string, newName: string) {
    // Verifica che il nuovo SKU non esista
    const skuExists = await prisma.product.findUnique({ where: { sku: newSku } });
    if (skuExists) {
      throw new Error(`Prodotto con SKU "${newSku}" esiste già`);
    }

    return prisma.$transaction(async (tx) => {
      // Ottieni prodotto originale con pipeline
      const source = await tx.product.findUnique({
        where: { id: sourceProductId },
        include: {
          manufacturingPhases: {
            where: { isActive: true },
            include: {
              materials: true,
              qualifiedEmployees: true,
            },
          },
        },
      });

      if (!source) {
        throw new Error('Prodotto non trovato');
      }

      // Crea nuovo prodotto
      const newProduct = await tx.product.create({
        data: {
          sku: newSku,
          name: newName,
          description: source.description,
          type: source.type,
          category: source.category,
          unit: source.unit,
          cost: source.cost,
          price: source.price,
          weight: source.weight,
          dimensions: source.dimensions as any,
          minStockLevel: source.minStockLevel,
          minStock: source.minStock,
          maxStock: source.maxStock,
          reorderPoint: source.reorderPoint,
          reorderQuantity: source.reorderQuantity,
          leadTimeDays: source.leadTimeDays,
          isActive: true,
          isSellable: source.isSellable,
          supplierId: source.supplierId,
        },
      });

      // Clona pipeline
      for (const phase of source.manufacturingPhases) {
        const newPhase = await tx.manufacturingPhase.create({
          data: {
            productId: newProduct.id,
            operationTypeId: phase.operationTypeId,
            sequence: phase.sequence,
            name: phase.name,
            description: phase.description,
            standardTime: phase.standardTime,
            setupTime: phase.setupTime,
            externalCostPerUnit: phase.externalCostPerUnit,
            supplierId: phase.supplierId,
          },
        });

        // Clona materiali fase
        if (phase.materials.length > 0) {
          await tx.phaseMaterial.createMany({
            data: phase.materials.map((m) => ({
              phaseId: newPhase.id,
              materialId: m.materialId,
              quantity: m.quantity,
              unit: m.unit,
              scrapPercentage: m.scrapPercentage,
              isConsumable: m.isConsumable,
              notes: m.notes,
            })),
          });
        }

        // Clona dipendenti qualificati
        if (phase.qualifiedEmployees.length > 0) {
          await tx.phaseEmployee.createMany({
            data: phase.qualifiedEmployees.map((e) => ({
              phaseId: newPhase.id,
              employeeId: e.employeeId,
              isPrimary: e.isPrimary,
            })),
          });
        }
      }

      logger.info(`Cloned product ${source.sku} to ${newSku}`);

      return newProduct;
    });
  }

  // ==========================================
  // ORDINI DI PRODUZIONE
  // ==========================================

  /**
   * Crea ordine di produzione
   */
  async createProductionOrder(data: CreateProductionOrderInput) {
    // Verifica prodotto
    const product = await prisma.product.findUnique({
      where: { id: data.productId },
    });
    if (!product) {
      throw new Error('Prodotto non trovato');
    }

    // Ottieni pipeline (se esiste)
    const pipeline = await this.getProductPipeline(data.productId);
    // Non più obbligatorio: se non ci sono fasi, l'ordine viene creato comunque

    return prisma.$transaction(async (tx) => {
      // Genera numero ordine
      const year = new Date().getFullYear();
      const lastOrder = await tx.productionOrder.findFirst({
        where: { orderNumber: { startsWith: `MO-${year}-` } },
        orderBy: { orderNumber: 'desc' },
      });

      let nextNum = 1;
      if (lastOrder) {
        const match = lastOrder.orderNumber.match(/(\d+)$/);
        if (match) nextNum = parseInt(match[1]) + 1;
      }

      const orderNumber = `MO-${year}-${nextNum.toString().padStart(6, '0')}`;

      // Crea ordine
      const order = await tx.productionOrder.create({
        data: {
          orderNumber,
          productId: data.productId,
          quantity: data.quantity,
          status: 'DRAFT',
          salesOrderId: data.salesOrderId,
          plannedStartDate: data.plannedStartDate,
          plannedEndDate: data.plannedEndDate,
          priority: data.priority || 0,
          notes: data.notes,
          createdById: data.createdById,
        },
      });

      // Crea fasi di produzione basate sulla pipeline
      for (const phase of pipeline) {
        await tx.productionPhase.create({
          data: {
            productionOrderId: order.id,
            manufacturingPhaseId: phase.id,
            sequence: phase.sequence,
            status: 'PENDING',
          },
        });
      }

      logger.info(`Created production order ${orderNumber} for product ${product.sku}`);

      return tx.productionOrder.findUnique({
        where: { id: order.id },
        include: {
          product: true,
          phases: {
            orderBy: { sequence: 'asc' },
            include: { manufacturingPhase: true },
          },
        },
      });
    });
  }

  /**
   * Ottieni ordine di produzione
   */
  async getProductionOrder(orderId: string) {
    return prisma.productionOrder.findUnique({
      where: { id: orderId },
      include: {
        product: true,
        salesOrder: true,
        createdBy: { select: { firstName: true, lastName: true } },
        phases: {
          orderBy: { sequence: 'asc' },
          include: {
            manufacturingPhase: {
              include: {
                operationType: true,
                materials: { include: { material: true } },
              },
            },
            assignedEmployee: {
              include: { user: { select: { firstName: true, lastName: true } } },
            },
            materialConsumptions: { include: { material: true } },
          },
        },
      },
    });
  }

  /**
   * Lista ordini di produzione
   */
  async listProductionOrders(params: {
    page?: number;
    limit?: number;
    status?: string;
    productId?: string;
  }) {
    const page = params.page || 1;
    const limit = params.limit || 20;
    const skip = (page - 1) * limit;

    const where: any = {};
    if (params.status) {
      where.status = params.status;
    }
    if (params.productId) {
      where.productId = params.productId;
    }

    const [items, total] = await Promise.all([
      prisma.productionOrder.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          product: true,
          phases: { orderBy: { sequence: 'asc' } },
        },
      }),
      prisma.productionOrder.count({ where }),
    ]);

    return {
      items,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  /**
   * Avvia fase di produzione
   */
  async startProductionPhase(phaseId: string, employeeId?: string) {
    const phase = await prisma.productionPhase.findUnique({
      where: { id: phaseId },
      include: { productionOrder: true },
    });

    if (!phase) {
      throw new Error('Fase non trovata');
    }

    if (phase.status !== 'PENDING') {
      throw new Error('La fase non è in stato PENDING');
    }

    // Aggiorna fase
    const updated = await prisma.productionPhase.update({
      where: { id: phaseId },
      data: {
        status: 'IN_PROGRESS',
        startedAt: new Date(),
        assignedEmployeeId: employeeId,
      },
    });

    // Aggiorna status ordine se necessario
    if (phase.productionOrder.status === 'DRAFT' || phase.productionOrder.status === 'PLANNED') {
      await prisma.productionOrder.update({
        where: { id: phase.productionOrderId },
        data: {
          status: 'IN_PROGRESS',
          actualStartDate: new Date(),
        },
      });
    }

    logger.info(`Started production phase ${phaseId}`);

    return updated;
  }

  /**
   * Completa fase di produzione
   */
  async completeProductionPhase(phaseId: string, actualTime?: number) {
    const phase = await prisma.productionPhase.findUnique({
      where: { id: phaseId },
      include: {
        productionOrder: true,
        manufacturingPhase: {
          include: {
            materials: { include: { material: true } },
            operationType: true,
          },
        },
        assignedEmployee: true,
      },
    });

    if (!phase) {
      throw new Error('Fase non trovata');
    }

    if (phase.status !== 'IN_PROGRESS') {
      throw new Error('La fase non è in stato IN_PROGRESS');
    }

    return prisma.$transaction(async (tx) => {
      // Calcola costi
      let laborCost = 0;
      let materialCost = 0;
      let externalCost = 0;

      const time = actualTime || phase.manufacturingPhase.standardTime;
      const hours = time / 60;

      if (phase.manufacturingPhase.operationType.isExternal) {
        externalCost = Number(phase.manufacturingPhase.externalCostPerUnit || 0) * phase.productionOrder.quantity;
      } else {
        const hourlyRate = phase.assignedEmployee
          ? Number(phase.assignedEmployee.hourlyRate)
          : Number(phase.manufacturingPhase.operationType.defaultHourlyRate) || 25;
        laborCost = hours * hourlyRate;
      }

      // Consuma materiali
      const primaryWarehouse = await tx.warehouse.findFirst({ where: { isPrimary: true } });

      for (const pm of phase.manufacturingPhase.materials) {
        const qtyToConsume = Number(pm.quantity) * phase.productionOrder.quantity * (1 + Number(pm.scrapPercentage) / 100);
        const roundedQty = Math.ceil(qtyToConsume);

        // Registra consumo
        await tx.materialConsumption.create({
          data: {
            productionPhaseId: phaseId,
            materialId: pm.materialId,
            plannedQuantity: Number(pm.quantity) * phase.productionOrder.quantity,
            actualQuantity: roundedQty,
            unit: pm.unit,
            warehouseId: primaryWarehouse?.id || '',
            location: 'WEB',
          },
        });

        // Scala stock materiale
        await tx.material.update({
          where: { id: pm.materialId },
          data: {
            currentStock: { decrement: roundedQty },
          },
        });

        // Crea movimento materiale
        await tx.materialMovement.create({
          data: {
            materialId: pm.materialId,
            type: 'PRODUCTION',
            quantity: roundedQty,
            fromLocation: 'WEB',
            reference: phase.productionOrder.orderNumber,
            notes: `Produzione ${phase.productionOrder.orderNumber} - Fase ${phase.sequence}`,
          },
        });

        materialCost += Number(pm.material.cost) * roundedQty;
      }

      // Aggiorna fase
      const updated = await tx.productionPhase.update({
        where: { id: phaseId },
        data: {
          status: 'COMPLETED',
          completedAt: new Date(),
          actualTime: time,
          laborCost,
          materialCost,
          externalCost,
        },
      });

      // Notifica completamento fase
      await notificationService.notifyRoles(['ADMIN', 'MANAGER'], {
        type: 'PRODUCTION_PHASE_COMPLETED',
        title: 'Fase Produzione Completata',
        message: `Fase ${phase.sequence} dell'ordine ${phase.productionOrder.orderNumber} completata`,
        link: `/production/${phase.productionOrderId}`,
      });

      logger.info(`Completed production phase ${phaseId}`);

      return updated;
    });
  }

  /**
   * Completa ordine di produzione
   */
  async completeProductionOrder(orderId: string) {
    const order = await prisma.productionOrder.findUnique({
      where: { id: orderId },
      include: {
        product: true,
        phases: true,
      },
    });

    if (!order) {
      throw new Error('Ordine di produzione non trovato');
    }

    // Verifica che tutte le fasi siano completate
    const incompletPhases = order.phases.filter(
      (p) => p.status !== 'COMPLETED' && p.status !== 'SKIPPED'
    );

    if (incompletPhases.length > 0) {
      throw new Error(`Impossibile completare: ${incompletPhases.length} fasi non completate`);
    }

    return prisma.$transaction(async (tx) => {
      // Aggiorna status ordine
      const completedOrder = await tx.productionOrder.update({
        where: { id: orderId },
        data: {
          status: 'COMPLETED',
          actualEndDate: new Date(),
        },
      });

      // Incrementa stock prodotto finito
      const primaryWarehouse = await tx.warehouse.findFirst({ where: { isPrimary: true } });

      if (primaryWarehouse) {
        const existingInventory = await tx.inventoryItem.findFirst({
          where: {
            productId: order.productId,
            warehouseId: primaryWarehouse.id,
            location: 'WEB',
          },
        });

        if (existingInventory) {
          await tx.inventoryItem.update({
            where: { id: existingInventory.id },
            data: { quantity: { increment: order.quantity } },
          });
        } else {
          await tx.inventoryItem.create({
            data: {
              productId: order.productId,
              warehouseId: primaryWarehouse.id,
              location: 'WEB',
              quantity: order.quantity,
            },
          });
        }

        // Crea movimento prodotto finito
        await tx.inventoryMovement.create({
          data: {
            productId: order.productId,
            type: 'PRODUCTION',
            quantity: order.quantity,
            toLocation: 'WEB',
            reference: order.orderNumber,
            notes: `Completamento produzione ${order.orderNumber}`,
          },
        });
      }

      // Notifica completamento ordine
      await notificationService.notifyRoles(['ADMIN', 'MANAGER', 'MAGAZZINIERE'], {
        type: 'PRODUCTION_ORDER_COMPLETED',
        title: 'Ordine Produzione Completato',
        message: `L'ordine ${order.orderNumber} è stato completato. ${order.quantity} unità di ${order.product.name} prodotte.`,
        link: `/production/${orderId}`,
      });

      // Check scorte basse materiali
      await materialService.checkLowStock();

      logger.info(`Completed production order ${order.orderNumber}`);

      // Se collegato a un ordine di vendita, verifica se tutti gli ordini di produzione sono completati
      if (order.salesOrderId) {
        const pendingProductionOrders = await tx.productionOrder.count({
          where: {
            salesOrderId: order.salesOrderId,
            status: { notIn: ['COMPLETED', 'CANCELLED'] },
          },
        });

        if (pendingProductionOrders === 0) {
          // Tutti gli ordini di produzione sono completati, aggiorna lo stato dell'ordine a READY
          const salesOrder = await tx.order.findUnique({
            where: { id: order.salesOrderId },
          });

          if (salesOrder && salesOrder.status === 'PROCESSING') {
            await tx.order.update({
              where: { id: order.salesOrderId },
              data: { status: 'READY' },
            });

            await notificationService.notifyRoles(['ADMIN', 'MANAGER', 'COMMERCIALE'], {
              type: 'ORDER_RECEIVED',
              title: 'Ordine Pronto per Spedizione',
              message: `L'ordine ${salesOrder.orderNumber} è pronto per la spedizione. Tutta la produzione è stata completata.`,
              link: `/orders/${order.salesOrderId}`,
            });

            logger.info(`Sales order ${salesOrder.orderNumber} marked as READY - all production complete`);
          }
        }
      }

      return completedOrder;
    });
  }

  /**
   * Annulla ordine di produzione
   */
  async cancelProductionOrder(orderId: string, reason?: string) {
    const order = await prisma.productionOrder.findUnique({
      where: { id: orderId },
    });

    if (!order) {
      throw new Error('Ordine di produzione non trovato');
    }

    if (order.status === 'COMPLETED') {
      throw new Error('Impossibile annullare un ordine completato');
    }

    const updated = await prisma.productionOrder.update({
      where: { id: orderId },
      data: {
        status: 'CANCELLED',
        notes: reason ? `${order.notes || ''}\nAnnullato: ${reason}` : order.notes,
      },
    });

    logger.info(`Cancelled production order ${order.orderNumber}: ${reason || 'No reason'}`);

    return updated;
  }

  // ==========================================
  // STATISTICHE
  // ==========================================

  /**
   * Ottieni statistiche produzione
   */
  async getProductionStats() {
    const [total, draft, inProgress, completed, cancelled] = await Promise.all([
      prisma.productionOrder.count(),
      prisma.productionOrder.count({ where: { status: 'DRAFT' } }),
      prisma.productionOrder.count({ where: { status: 'IN_PROGRESS' } }),
      prisma.productionOrder.count({ where: { status: 'COMPLETED' } }),
      prisma.productionOrder.count({ where: { status: 'CANCELLED' } }),
    ]);

    return {
      total,
      draft,
      inProgress,
      completed,
      cancelled,
    };
  }
}

export default new ManufacturingService();
