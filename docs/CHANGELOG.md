# Changelog

Tutte le modifiche significative al progetto sono documentate in questo file.

Il formato è basato su [Keep a Changelog](https://keepachangelog.com/it/1.0.0/),
e questo progetto aderisce al [Semantic Versioning](https://semver.org/lang/it/).

---

## [Unreleased]

### In Progress - Trasformazione SaaS

Trasformazione del sistema ERP monolitico in SaaS multi-tenant con abbonamenti Stripe.

#### Fase 1: Documentazione
- [ ] ARCHITECTURE.md - Architettura sistema
- [ ] DATA_MODEL.md - Schema ER 151 modelli
- [ ] MODULE_DEPENDENCIES.md - Dipendenze tra moduli
- [ ] API_CONTRACTS.md - Documentazione API REST
- [ ] CONVENTIONS.md - Convenzioni di codice
- [ ] CHANGELOG.md - Log modifiche

#### Fase 2: Multi-Tenancy Backend
- [ ] Aggiungere modello Tenant
- [ ] Aggiungere modello TenantMember
- [ ] Aggiungere modello TenantInvite
- [ ] Aggiungere modello SubscriptionPlan
- [ ] Aggiungere modello Subscription
- [ ] Aggiungere modello BillingHistory
- [ ] Aggiungere tenantId a tutti i 151+ modelli esistenti
- [ ] Creare tenant.middleware.ts
- [ ] Creare subscription.middleware.ts
- [ ] Modificare database.ts per Prisma tenant middleware
- [ ] Aggiornare auth.middleware.ts con tenantId nel JWT
- [ ] Migrare tutti i repositories per tenant filtering
- [ ] Migrare tutti i services per tenant context

#### Fase 3: Stripe Integration
- [ ] Estendere stripe.service.ts per subscriptions
- [ ] Creare subscription.service.ts
- [ ] Creare billing.service.ts
- [ ] Creare subscription.routes.ts
- [ ] Creare billing.routes.ts
- [ ] Implementare webhook handlers
- [ ] Configurare piani STARTER, PRO, BUSINESS

#### Fase 4: Auth & Onboarding
- [ ] Creare tenant.service.ts
- [ ] Creare tenant-invite.service.ts
- [ ] Creare tenant.routes.ts
- [ ] Creare onboarding.routes.ts
- [ ] Implementare flusso registrazione tenant
- [ ] Implementare invito utenti
- [ ] Implementare setup wizard

#### Fase 5: Frontend Updates
- [ ] Creare tenant.store.ts
- [ ] Creare subscription.store.ts
- [ ] Creare pagina Billing.vue
- [ ] Creare pagina TeamMembers.vue
- [ ] Creare wizard Onboarding
- [ ] Creare PlanLimitBanner.vue
- [ ] Creare UpgradePrompt.vue
- [ ] Aggiornare auth.store.ts con tenant context
- [ ] Aggiornare api.service.ts con X-Tenant-Id header

#### Fase 6: Landing Site (Next.js)
- [ ] Setup progetto Next.js in src/landing/
- [ ] Creare Homepage
- [ ] Creare pagina Pricing
- [ ] Creare pagina Features
- [ ] Creare Blog con MDX
- [ ] Creare pagina Contact
- [ ] Creare pagine Legal (privacy, terms)
- [ ] Implementare SEO optimization

#### Fase 7: Cleanup
- [ ] Rimuovere src/ecommerce-next/
- [ ] Rimuovere shop routes/services
- [ ] Aggiornare package.json
- [ ] Test multi-tenancy
- [ ] Test subscription lifecycle
- [ ] Test onboarding flow

---

## [0.9.0] - 2024-XX-XX

### Added - Sistema ERP Completo (Single Tenant)

#### Inventory Module
- Gestione prodotti con varianti
- Gestione materiali grezzi
- Movimenti di magazzino (IN, OUT, TRANSFER, ADJUSTMENT)
- Multi-location (WEB, B2B, EVENTI, TRANSITO)
- Alert scorte automatici
- Previsioni di stockout

#### Orders Module
- Gestione ordini B2B e B2C
- Integrazione WordPress/WooCommerce
- Workflow ordini (PENDING → DELIVERED)
- DDT (Documenti di Trasporto)
- RMA (Resi)

#### Customers Module
- Gestione clienti B2B con P.IVA, SDI
- Gestione clienti B2C
- Listini prezzi personalizzati
- Sconti categoria e volume

#### Suppliers Module
- Gestione fornitori
- Catalogo fornitore
- Sconti volume
- Scorecard performance

#### Purchasing Module
- Ordini d'acquisto
- Entrata merce (Goods Receipt)
- Three-way matching (PO-GR-Invoice)

#### Manufacturing Module
- Bill of Materials (BOM) ricorsivo
- Fasi di produzione
- Ordini di produzione
- Calcolo costi (materiali, lavoro, overhead)
- Assegnazione operatori

#### Accounting Module
- Fatturazione vendita
- Fatturazione acquisto
- Scadenzario pagamenti
- Integrazione SDI (FatturaPA)
- Report finanziari

#### HR Module
- Gestione dipendenti
- Timesheets
- Task management
- Calendario

#### Dashboard
- KPI giornalieri
- "Cosa fare oggi"
- Suggerimenti intelligenti
- Motore di suggerimenti (10+ algoritmi)

#### Integrations
- WordPress/WooCommerce sync bidirezionale
- SDI (Sistema di Interscambio) per fatturazione elettronica
- Email transazionali

---

## [0.8.0] - 2024-XX-XX

### Added
- Motore di suggerimenti con 10 algoritmi
- Dashboard "Cosa fare oggi"
- Previsioni di stockout basate su storico vendite
- Alert margine basso
- Rilevamento trend (up/down)
- Suggerimenti batch production
- Raggruppamento ordini per spedizione

### Changed
- Migliorata UI dashboard
- Ottimizzate query per performance

---

## [0.7.0] - 2024-XX-XX

### Added
- SDI integration (Sistema di Interscambio)
- Generazione XML FatturaPA
- Integrazione provider Aruba
- Notifiche SDI
- Storage XML e PDF fatture

### Changed
- Aggiornato modello Invoice per SDI
- Aggiunto workflow fatturazione elettronica

---

## [0.6.0] - 2024-XX-XX

### Added
- Manufacturing module completo
- Bill of Materials ricorsivo
- Fasi di produzione configurabili
- Ordini di produzione
- Calcolo costi produzione
- Consumo materiali tracciato

### Changed
- Separato Material da Product
- Aggiunto supporto materiali in PurchaseOrder

---

## [0.5.0] - 2024-XX-XX

### Added
- Three-way matching (PO-GR-Invoice)
- Goods Receipt con ispezione qualita
- Supplier scorecard
- Report purchasing

### Changed
- Migliorato flusso acquisti
- Aggiunto tracking delivery status

---

## [0.4.0] - 2024-XX-XX

### Added
- Purchasing module
- Purchase Orders
- Supplier catalog
- Volume discounts

### Changed
- Aggiornata UI fornitori
- Migliorata gestione pagamenti

---

## [0.3.0] - 2024-XX-XX

### Added
- Accounting module
- Invoicing (vendita e acquisto)
- Scadenzario pagamenti
- Payment plans

### Changed
- Collegamento ordini a fatture
- Tracking pagamenti

---

## [0.2.0] - 2024-XX-XX

### Added
- Orders module
- Customer management (B2B/B2C)
- Price lists
- WordPress sync

### Changed
- Migliorata gestione prodotti
- Aggiunto supporto varianti

---

## [0.1.0] - 2024-XX-XX

### Added
- Initial project setup
- Fastify backend
- Vue 3 frontend
- Prisma ORM
- Basic authentication
- Product management
- Inventory tracking
- Warehouse management

---

## Legend

- `Added` - Nuove funzionalita
- `Changed` - Modifiche a funzionalita esistenti
- `Deprecated` - Funzionalita deprecate
- `Removed` - Funzionalita rimosse
- `Fixed` - Bug fix
- `Security` - Fix di sicurezza
