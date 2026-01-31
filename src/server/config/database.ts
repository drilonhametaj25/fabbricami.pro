import { PrismaClient } from '@prisma/client';
import { config } from './environment';

// Configurazione Prisma con logging
const prisma = new PrismaClient({
  log: config.isDevelopment
    ? ['query', 'info', 'warn', 'error']
    : ['error'],
  errorFormat: 'pretty',
});

// Gestione connessione
prisma.$connect()
  .then(() => console.log('✅ Database connected'))
  .catch((error) => {
    console.error('❌ Database connection failed:', error);
    process.exit(1);
  });

// Graceful shutdown
process.on('beforeExit', async () => {
  await prisma.$disconnect();
  console.log('👋 Database disconnected');
});

export { prisma };
export default prisma;
