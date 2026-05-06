import { OrderStatus } from '@prisma/client';

/**
 * Order State Machine
 *
 * Definisce le transizioni valide tra stati `OrderStatus`. Ogni route che
 * cambia lo stato di un ordine deve passare per `assertTransition()` o
 * `canTransition()` per evitare salti illegali (es. PENDING -> SHIPPED
 * senza CONFIRMED + PROCESSING) che producono dati inconsistenti.
 *
 * Diagramma:
 *
 *   PENDING --> CONFIRMED --> PROCESSING --> READY --> SHIPPED --> DELIVERED
 *      |             |             |          |           |
 *      v             v             v          v           v
 *   CANCELLED   CANCELLED      CANCELLED  CANCELLED   REFUNDED
 *                                                       ^
 *                                                       |
 *                                                  DELIVERED
 *
 * Stati terminali: DELIVERED (puo' andare in REFUNDED), CANCELLED, REFUNDED.
 */

const TRANSITIONS: Record<OrderStatus, readonly OrderStatus[]> = {
  PENDING: ['CONFIRMED', 'CANCELLED'],
  CONFIRMED: ['PROCESSING', 'CANCELLED'],
  PROCESSING: ['READY', 'CANCELLED'],
  READY: ['SHIPPED', 'CANCELLED'],
  SHIPPED: ['DELIVERED', 'REFUNDED'],
  DELIVERED: ['REFUNDED'],
  CANCELLED: [],
  REFUNDED: [],
};

const TERMINAL_STATES: ReadonlySet<OrderStatus> = new Set(['CANCELLED', 'REFUNDED']);

/**
 * Verifica se la transizione `from -> to` e' ammessa.
 */
export function canTransition(from: OrderStatus, to: OrderStatus): boolean {
  if (from === to) return true; // No-op
  return TRANSITIONS[from]?.includes(to) ?? false;
}

/**
 * Verifica e lancia errore se la transizione non e' ammessa.
 */
export function assertTransition(from: OrderStatus, to: OrderStatus): void {
  if (!canTransition(from, to)) {
    const allowed = TRANSITIONS[from]?.join(', ') || '(nessuno)';
    throw new Error(
      `Transizione ordine non valida: ${from} -> ${to}. Stati ammessi da ${from}: ${allowed}`
    );
  }
}

/**
 * Stati raggiungibili da `from` in un solo step.
 */
export function nextStates(from: OrderStatus): readonly OrderStatus[] {
  return TRANSITIONS[from] ?? [];
}

/**
 * Verifica se lo stato e' terminale (CANCELLED, REFUNDED).
 * DELIVERED non e' terminale perche' puo' diventare REFUNDED.
 */
export function isTerminal(state: OrderStatus): boolean {
  return TERMINAL_STATES.has(state);
}

/**
 * Stati che richiedono allocazione di stock (riserva o decremento effettivo).
 * Usato dal flusso di allocation/picking.
 */
export function requiresStockAllocation(state: OrderStatus): boolean {
  return state === 'CONFIRMED' || state === 'PROCESSING' || state === 'READY';
}

/**
 * Stati in cui il customer si aspetta una notifica (sendOrderStatusUpdate).
 */
export function isCustomerNotifiable(state: OrderStatus): boolean {
  return ['CONFIRMED', 'PROCESSING', 'SHIPPED', 'DELIVERED', 'CANCELLED', 'REFUNDED'].includes(state);
}
