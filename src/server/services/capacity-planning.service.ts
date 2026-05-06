import { prisma } from '../config/database';
import { logger } from '../config/logger';

/**
 * Capacity Planning Service
 *
 * Calcola il carico di lavoro per fase/operationType su un orizzonte
 * temporale (default: 30 giorni). Aggrega le `ProductionPhase` non ancora
 * completate stimando il tempo necessario (`standardTime` * unita) e lo
 * confronta con la capacita disponibile per fase.
 *
 * Semplificazioni intenzionali (configurabili in futuro tramite tenant
 * settings):
 * - Capacita giornaliera per operation type = `dailyCapacityMinutes` (480
 *   minuti = 8h) di default. Override possibile via parametro.
 * - Distribuzione carico: spalmato proporzionalmente sui giorni tra
 *   `plannedStartDate` e `plannedEndDate` del production order. Se le date
 *   non sono valorizzate, il carico va sul "today bucket".
 * - Setup time conteggiato una volta per fase indipendentemente da quantita.
 */

export interface CapacityWindow {
  start: Date;
  end: Date;
}

export interface DailyLoad {
  date: string; // ISO YYYY-MM-DD
  loadMinutes: number;
  capacityMinutes: number;
  utilizationPct: number;
  overloaded: boolean;
}

export interface OperationTypeCapacity {
  operationTypeId: string;
  operationTypeCode: string;
  operationTypeName: string;
  isExternal: boolean;
  totalLoadMinutes: number;
  totalCapacityMinutes: number;
  avgUtilizationPct: number;
  peakUtilizationPct: number;
  daysOverloaded: number;
  daily: DailyLoad[];
}

export interface CapacityPlanningResult {
  window: CapacityWindow;
  operationTypes: OperationTypeCapacity[];
  globalSummary: {
    totalLoadMinutes: number;
    totalCapacityMinutes: number;
    avgUtilizationPct: number;
    bottlenecks: Array<{
      operationTypeCode: string;
      operationTypeName: string;
      peakUtilizationPct: number;
    }>;
  };
}

const DEFAULT_DAILY_CAPACITY_MINUTES = 480; // 8 ore lavorative

class CapacityPlanningService {
  /**
   * Calcola il workload per ogni operation type nei prossimi N giorni.
   *
   * @param horizonDays orizzonte in giorni (default 30)
   * @param dailyCapacityMinutes capacita giornaliera per operationType (default 480)
   */
  async getCapacityPlan(
    horizonDays: number = 30,
    dailyCapacityMinutes: number = DEFAULT_DAILY_CAPACITY_MINUTES
  ): Promise<CapacityPlanningResult> {
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    const end = new Date(start.getTime() + horizonDays * 24 * 60 * 60 * 1000);

    // 1. Carica tutte le ProductionPhase non completate dei production order
    //    in stato attivo (non DRAFT/CANCELLED/COMPLETED).
    const phases = await prisma.productionPhase.findMany({
      where: {
        status: { in: ['PENDING', 'IN_PROGRESS'] },
        productionOrder: {
          status: { in: ['PLANNED', 'IN_PROGRESS'] },
        },
      },
      include: {
        productionOrder: {
          select: {
            id: true,
            quantity: true,
            plannedStartDate: true,
            plannedEndDate: true,
            priority: true,
          },
        },
        manufacturingPhase: {
          select: {
            standardTime: true,
            setupTime: true,
            operationType: {
              select: {
                id: true,
                code: true,
                name: true,
                isExternal: true,
              },
            },
          },
        },
      },
    });

    // 2. Aggrega minuti richiesti per operationType x giorno.
    // Map<operationTypeId, Map<dateISO, minutes>>
    const loadByOpAndDay = new Map<string, Map<string, number>>();
    const opTypeMeta = new Map<
      string,
      { code: string; name: string; isExternal: boolean }
    >();

    for (const phase of phases) {
      const op = phase.manufacturingPhase.operationType;
      if (!op) continue;

      opTypeMeta.set(op.id, {
        code: op.code,
        name: op.name,
        isExternal: op.isExternal,
      });

      const order = phase.productionOrder;
      if (!order) continue;

      const standardTime = phase.manufacturingPhase.standardTime || 0;
      const setupTime = phase.manufacturingPhase.setupTime || 0;
      const phaseTotalMinutes = standardTime * order.quantity + setupTime;

      // Distribuzione: se plannedStart/End presenti spalma proporzionale
      const phaseStart =
        order.plannedStartDate && order.plannedStartDate > start
          ? order.plannedStartDate
          : start;
      const phaseEnd =
        order.plannedEndDate && order.plannedEndDate <= end
          ? order.plannedEndDate
          : end;

      if (phaseEnd < phaseStart) {
        // Range invalido: salta
        continue;
      }

      const days = this.daysBetween(phaseStart, phaseEnd);
      const minutesPerDay = phaseTotalMinutes / Math.max(days.length, 1);

      let opMap = loadByOpAndDay.get(op.id);
      if (!opMap) {
        opMap = new Map<string, number>();
        loadByOpAndDay.set(op.id, opMap);
      }

      for (const day of days) {
        const key = day.toISOString().slice(0, 10);
        opMap.set(key, (opMap.get(key) || 0) + minutesPerDay);
      }
    }

    // 3. Costruisci risultato per operation type
    const allDays = this.daysBetween(start, end);
    const operationTypes: OperationTypeCapacity[] = [];

    for (const [opId, opMap] of loadByOpAndDay.entries()) {
      const meta = opTypeMeta.get(opId);
      if (!meta) continue;

      const daily: DailyLoad[] = allDays.map((d) => {
        const key = d.toISOString().slice(0, 10);
        const loadMinutes = Math.round(opMap.get(key) || 0);
        // Per operationType esterni (terzisti), capacita =
        // pseudo-illimitata (modellata come grande costante per evitare bias).
        const capacityMinutes = meta.isExternal ? dailyCapacityMinutes * 10 : dailyCapacityMinutes;
        const utilizationPct =
          capacityMinutes > 0 ? Math.round((loadMinutes / capacityMinutes) * 1000) / 10 : 0;
        return {
          date: key,
          loadMinutes,
          capacityMinutes,
          utilizationPct,
          overloaded: loadMinutes > capacityMinutes,
        };
      });

      const totalLoad = daily.reduce((s, d) => s + d.loadMinutes, 0);
      const totalCap = daily.reduce((s, d) => s + d.capacityMinutes, 0);
      const peak = daily.reduce((max, d) => Math.max(max, d.utilizationPct), 0);
      const daysOver = daily.filter((d) => d.overloaded).length;

      operationTypes.push({
        operationTypeId: opId,
        operationTypeCode: meta.code,
        operationTypeName: meta.name,
        isExternal: meta.isExternal,
        totalLoadMinutes: Math.round(totalLoad),
        totalCapacityMinutes: totalCap,
        avgUtilizationPct: totalCap > 0 ? Math.round((totalLoad / totalCap) * 1000) / 10 : 0,
        peakUtilizationPct: peak,
        daysOverloaded: daysOver,
        daily,
      });
    }

    // 4. Identifica bottleneck (utilizationPct picco > 100% o > 85% sostenuto)
    const bottlenecks = operationTypes
      .filter((op) => op.peakUtilizationPct > 85 && !op.isExternal)
      .sort((a, b) => b.peakUtilizationPct - a.peakUtilizationPct)
      .slice(0, 5)
      .map((op) => ({
        operationTypeCode: op.operationTypeCode,
        operationTypeName: op.operationTypeName,
        peakUtilizationPct: op.peakUtilizationPct,
      }));

    const globalLoad = operationTypes.reduce((s, op) => s + op.totalLoadMinutes, 0);
    const globalCap = operationTypes.reduce((s, op) => s + op.totalCapacityMinutes, 0);

    return {
      window: { start, end },
      operationTypes: operationTypes.sort((a, b) => b.peakUtilizationPct - a.peakUtilizationPct),
      globalSummary: {
        totalLoadMinutes: globalLoad,
        totalCapacityMinutes: globalCap,
        avgUtilizationPct: globalCap > 0 ? Math.round((globalLoad / globalCap) * 1000) / 10 : 0,
        bottlenecks,
      },
    };
  }

  /**
   * Verifica se un nuovo production order e' schedulabile nelle date richieste
   * senza saturare la capacita. Ritorna `feasible=false` se almeno una fase
   * supera la capacita giornaliera in qualche giorno della finestra.
   *
   * Best-effort: presume distribuzione lineare del carico nuovo.
   */
  async checkFeasibility(params: {
    productId: string;
    quantity: number;
    plannedStartDate: Date;
    plannedEndDate: Date;
    dailyCapacityMinutes?: number;
  }): Promise<{
    feasible: boolean;
    conflicts: Array<{
      operationTypeCode: string;
      date: string;
      requiredMinutes: number;
      availableMinutes: number;
    }>;
  }> {
    const dailyCap = params.dailyCapacityMinutes ?? DEFAULT_DAILY_CAPACITY_MINUTES;

    // Carica fasi del prodotto
    const phases = await prisma.manufacturingPhase.findMany({
      where: { productId: params.productId, isActive: true },
      include: {
        operationType: { select: { id: true, code: true, isExternal: true } },
      },
    });

    if (phases.length === 0) {
      return { feasible: true, conflicts: [] };
    }

    // Plan corrente dei prossimi N giorni
    const horizonDays = Math.max(
      1,
      this.daysBetween(params.plannedStartDate, params.plannedEndDate).length
    );
    const currentPlan = await this.getCapacityPlan(horizonDays + 7, dailyCap);

    const conflicts: Array<{
      operationTypeCode: string;
      date: string;
      requiredMinutes: number;
      availableMinutes: number;
    }> = [];

    const days = this.daysBetween(params.plannedStartDate, params.plannedEndDate);

    for (const phase of phases) {
      if (phase.operationType.isExternal) continue; // capacita pseudo-illimitata

      const phaseTotalMinutes =
        (phase.standardTime || 0) * params.quantity + (phase.setupTime || 0);
      const minutesPerDay = phaseTotalMinutes / Math.max(days.length, 1);

      // Trova carico esistente per questo operationType
      const existing = currentPlan.operationTypes.find(
        (op) => op.operationTypeId === phase.operationType.id
      );

      for (const day of days) {
        const key = day.toISOString().slice(0, 10);
        const existingLoad = existing?.daily.find((d) => d.date === key)?.loadMinutes || 0;
        const newTotalLoad = existingLoad + minutesPerDay;
        if (newTotalLoad > dailyCap) {
          conflicts.push({
            operationTypeCode: phase.operationType.code,
            date: key,
            requiredMinutes: Math.round(newTotalLoad),
            availableMinutes: dailyCap,
          });
        }
      }
    }

    return {
      feasible: conflicts.length === 0,
      conflicts,
    };
  }

  /**
   * Lista giorni (date a mezzanotte) tra `from` (incluso) e `to` (incluso).
   */
  private daysBetween(from: Date, to: Date): Date[] {
    const days: Date[] = [];
    const current = new Date(from);
    current.setHours(0, 0, 0, 0);
    const endNorm = new Date(to);
    endNorm.setHours(0, 0, 0, 0);
    while (current <= endNorm) {
      days.push(new Date(current));
      current.setDate(current.getDate() + 1);
    }
    return days;
  }
}

export const capacityPlanningService = new CapacityPlanningService();
export default capacityPlanningService;

// Re-export logger reference for completeness
export { logger };
