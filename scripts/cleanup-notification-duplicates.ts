/**
 * Cleanup notifiche duplicate (alert scorte).
 *
 * Contesto: un job orario creava una notifica "Scorta Minima Raggiunta" /
 * "Prodotto Esaurito" per ogni prodotto/materiale sotto scorta, per ogni
 * utente, ad ogni esecuzione e senza deduplica → migliaia di copie identiche
 * (il caso "5424 notifiche non lette"). Il codice è stato corretto (dedup +
 * notifica di riepilogo giornaliera), ma l'ARRETRATO va ripulito una volta.
 *
 * Questo script è IDEMPOTENTE: tiene solo la notifica più recente per ogni
 * combinazione (utente, tipo, titolo, link) tra gli alert di scorta, ed
 * elimina le copie. Dopo la prima esecuzione elimina 0 righe, quindi è
 * sicuro lasciarlo nella pipeline come rete di sicurezza.
 *
 * Uso manuale (dentro il container backend):
 *   npx tsx scripts/cleanup-notification-duplicates.ts
 *
 * Usa raw SQL (bypassa il middleware tenant): la deduplica è comunque
 * per-utente grazie al PARTITION BY user_id, quindi resta corretta anche
 * in multi-tenant.
 */
import { prisma } from '../src/server/config/database';

async function main() {
  const before = await prisma.$queryRawUnsafe<Array<{ count: bigint }>>(
    `SELECT count(*)::bigint AS count FROM notifications`
  );

  const deleted = await prisma.$executeRawUnsafe(`
    DELETE FROM notifications n
    USING (
      SELECT id, ROW_NUMBER() OVER (
        PARTITION BY user_id, type, title, link
        ORDER BY created_at DESC
      ) AS rn
      FROM notifications
      WHERE type IN ('LOW_STOCK', 'MATERIAL_SHORTAGE')
    ) d
    WHERE n.id = d.id AND d.rn > 1;
  `);

  const after = await prisma.$queryRawUnsafe<Array<{ count: bigint }>>(
    `SELECT count(*)::bigint AS count FROM notifications`
  );

  console.log(
    `[cleanup-notifications] Notifiche: ${before[0].count} → ${after[0].count} ` +
      `(rimosse ${deleted} duplicate)`
  );
}

main()
  .catch((err) => {
    console.error('[cleanup-notifications] Errore:', err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
