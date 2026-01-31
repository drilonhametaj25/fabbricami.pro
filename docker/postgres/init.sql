-- Inizializzazione database
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm"; -- Per ricerca full-text

-- Indici per performance
-- Verranno creati da Prisma migrations
