/**
 * Reconcile Pending Orders
 *
 * Questo script verifica gli ordini PENDING e corregge inconsistenze di stock.
 * Da eseguire PRIMA di applicare il fix BUG-001 (stock dopo pagamento).
 *
 * Cosa fa:
 * 1. Trova ordini PENDING con stock già decrementato
 * 2. Verifica stato pagamento reale (PaymentTransaction)
 * 3. Se pagamento CAPTURED -> aggiorna ordine a CONFIRMED
 * 4. Se pagamento PENDING/FAILED -> ripristina stock
 * 5. Genera report delle correzioni
 *
 * Uso: npx tsx scripts/reconcile-pending-orders.ts [--dry-run]
 *
 * --dry-run: Mostra cosa farebbe senza applicare modifiche
 */

import { PrismaClient, OrderStatus, PaymentStatus } from '@prisma/client';

const prisma = new PrismaClient();

interface ReconciliationResult {
  orderId: string;
  orderNumber: string;
  action: 'CONFIRMED' | 'STOCK_RESTORED' | 'NO_ACTION';
  reason: string;
  itemsRestored?: { productId: string; variantId?: string; quantity: number }[];
}

async function reconcilePendingOrders(dryRun: boolean): Promise<void> {
  console.log('====================================');
  console.log('  RECONCILE PENDING ORDERS SCRIPT');
  console.log('====================================');
  console.log(`Mode: ${dryRun ? 'DRY RUN (no changes)' : 'LIVE (applying changes)'}`);
  console.log('');

  // Trova tutti gli ordini PENDING
  const pendingOrders = await prisma.order.findMany({
    where: {
      status: OrderStatus.PENDING,
    },
    include: {
      items: true,
      customer: {
        select: { email: true },
      },
    },
    orderBy: { createdAt: 'asc' },
  });

  console.log(`Found ${pendingOrders.length} PENDING orders to analyze\n`);

  const results: ReconciliationResult[] = [];
  let confirmed = 0;
  let stockRestored = 0;
  let noAction = 0;

  for (const order of pendingOrders) {
    console.log(`\n--- Order ${order.orderNumber} (${order.id}) ---`);
    console.log(`   Created: ${order.createdAt.toISOString()}`);
    console.log(`   Customer: ${order.customer?.email || 'N/A'}`);
    console.log(`   Total: €${Number(order.total).toFixed(2)}`);

    // Trova la transazione di pagamento più recente
    const latestTransaction = await prisma.paymentTransaction.findFirst({
      where: { orderId: order.id },
      orderBy: { createdAt: 'desc' },
    });

    if (!latestTransaction) {
      console.log(`   Payment: NO TRANSACTION FOUND`);
      // Nessuna transazione - l'ordine potrebbe non essere mai stato inviato al gateway
      // Ripristiniamo lo stock se l'ordine è vecchio (> 24 ore)
      const age = Date.now() - order.createdAt.getTime();
      const ageHours = age / (1000 * 60 * 60);

      if (ageHours > 24) {
        console.log(`   Age: ${ageHours.toFixed(1)} hours (> 24h, restoring stock)`);
        const itemsRestored = await restoreOrderStock(order.id, order.items, dryRun);
        results.push({
          orderId: order.id,
          orderNumber: order.orderNumber,
          action: 'STOCK_RESTORED',
          reason: `No payment transaction, order older than 24 hours`,
          itemsRestored,
        });
        stockRestored++;
      } else {
        console.log(`   Age: ${ageHours.toFixed(1)} hours (< 24h, waiting)`);
        results.push({
          orderId: order.id,
          orderNumber: order.orderNumber,
          action: 'NO_ACTION',
          reason: `No payment transaction, but order is recent (${ageHours.toFixed(1)}h)`,
        });
        noAction++;
      }
      continue;
    }

    console.log(`   Payment: ${latestTransaction.provider} - ${latestTransaction.status}`);
    console.log(`   Transaction: ${latestTransaction.transactionId || 'N/A'}`);

    if (latestTransaction.status === PaymentStatus.CAPTURED) {
      // Pagamento confermato ma ordine ancora PENDING
      console.log(`   Action: CONFIRM ORDER (payment was successful)`);

      if (!dryRun) {
        await prisma.order.update({
          where: { id: order.id },
          data: {
            status: OrderStatus.CONFIRMED,
            paidAt: latestTransaction.createdAt,
          },
        });
      }

      results.push({
        orderId: order.id,
        orderNumber: order.orderNumber,
        action: 'CONFIRMED',
        reason: `Payment ${latestTransaction.status}, updated to CONFIRMED`,
      });
      confirmed++;

    } else if (
      latestTransaction.status === PaymentStatus.FAILED ||
      latestTransaction.status === PaymentStatus.CANCELLED
    ) {
      // Pagamento fallito - ripristina stock
      console.log(`   Action: RESTORE STOCK (payment ${latestTransaction.status})`);

      const itemsRestored = await restoreOrderStock(order.id, order.items, dryRun);

      if (!dryRun) {
        await prisma.order.update({
          where: { id: order.id },
          data: {
            status: OrderStatus.CANCELLED,
            cancelReason: `Payment ${latestTransaction.status}`,
          } as any,
        });
      }

      results.push({
        orderId: order.id,
        orderNumber: order.orderNumber,
        action: 'STOCK_RESTORED',
        reason: `Payment ${latestTransaction.status}, stock restored and order cancelled`,
        itemsRestored,
      });
      stockRestored++;

    } else if (latestTransaction.status === PaymentStatus.PENDING) {
      // Pagamento ancora in attesa - controlla l'età
      const age = Date.now() - latestTransaction.createdAt.getTime();
      const ageHours = age / (1000 * 60 * 60);

      if (ageHours > 2) {
        // Session scaduta (Stripe sessions scadono dopo 30 min di default)
        console.log(`   Action: RESTORE STOCK (pending > 2 hours, likely expired)`);

        const itemsRestored = await restoreOrderStock(order.id, order.items, dryRun);

        if (!dryRun) {
          await prisma.paymentTransaction.update({
            where: { id: latestTransaction.id },
            data: { status: PaymentStatus.FAILED },
          });

          await prisma.order.update({
            where: { id: order.id },
            data: {
              status: OrderStatus.CANCELLED,
              cancelReason: 'Payment session expired',
            } as any,
          });
        }

        results.push({
          orderId: order.id,
          orderNumber: order.orderNumber,
          action: 'STOCK_RESTORED',
          reason: `Payment pending for ${ageHours.toFixed(1)} hours (expired), stock restored`,
          itemsRestored,
        });
        stockRestored++;
      } else {
        console.log(`   Action: NO ACTION (payment still pending, ${ageHours.toFixed(1)}h)`);
        results.push({
          orderId: order.id,
          orderNumber: order.orderNumber,
          action: 'NO_ACTION',
          reason: `Payment still pending (${ageHours.toFixed(1)} hours), waiting`,
        });
        noAction++;
      }
    } else {
      console.log(`   Action: NO ACTION (status ${latestTransaction.status})`);
      results.push({
        orderId: order.id,
        orderNumber: order.orderNumber,
        action: 'NO_ACTION',
        reason: `Unknown payment status: ${latestTransaction.status}`,
      });
      noAction++;
    }
  }

  // Report finale
  console.log('\n====================================');
  console.log('           FINAL REPORT');
  console.log('====================================');
  console.log(`Total orders analyzed: ${pendingOrders.length}`);
  console.log(`Orders confirmed:      ${confirmed}`);
  console.log(`Stock restored:        ${stockRestored}`);
  console.log(`No action needed:      ${noAction}`);
  console.log('');

  if (dryRun) {
    console.log('DRY RUN COMPLETE - No changes were made.');
    console.log('Run without --dry-run to apply changes.');
  } else {
    console.log('RECONCILIATION COMPLETE - Changes have been applied.');
  }

  // Scrivi report JSON
  const reportPath = `./reconciliation-report-${new Date().toISOString().split('T')[0]}.json`;
  const fs = await import('fs');
  fs.writeFileSync(reportPath, JSON.stringify({
    timestamp: new Date().toISOString(),
    dryRun,
    summary: {
      total: pendingOrders.length,
      confirmed,
      stockRestored,
      noAction,
    },
    results,
  }, null, 2));
  console.log(`\nReport saved to: ${reportPath}`);
}

async function restoreOrderStock(
  orderId: string,
  items: { productId: string; variantId: string | null; quantity: number }[],
  dryRun: boolean
): Promise<{ productId: string; variantId?: string; quantity: number }[]> {
  const restored: { productId: string; variantId?: string; quantity: number }[] = [];

  for (const item of items) {
    console.log(`      Restoring stock: +${item.quantity} for ${item.variantId || item.productId}`);

    if (!dryRun) {
      if (item.variantId) {
        await prisma.productVariant.update({
          where: { id: item.variantId },
          data: {
            wcStockQuantity: { increment: item.quantity },
          } as any,
        });
      } else {
        await prisma.product.update({
          where: { id: item.productId },
          data: {
            wcStockQuantity: { increment: item.quantity },
          } as any,
        });
      }
    }

    restored.push({
      productId: item.productId,
      variantId: item.variantId || undefined,
      quantity: item.quantity,
    });
  }

  return restored;
}

// Esecuzione
const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');

reconcilePendingOrders(dryRun)
  .then(() => {
    console.log('\nScript completed successfully.');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\nScript failed:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
