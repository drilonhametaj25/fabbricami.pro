-- Aggiunge il campo weighted_avg_cost (costo medio ponderato) ai prodotti.
-- Usato per valorizzazione magazzino, calcolo margini reali e COGS.
-- Inizializzato a 0; sara' aggiornato dal servizio inventory su ogni IN movement con costo.

ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "weighted_avg_cost" DECIMAL(10, 4) NOT NULL DEFAULT 0;
