# EcommerceERP - Copilot Instructions

## Contesto del Progetto
Stai sviluppando EcommerceERP, un sistema gestionale completo per e-commerce. Il sistema deve essere altamente performante, scalabile e integrato con WordPress.

## Stack Tecnologico Obbligatorio

### Backend
- **Framework**: Fastify (Node.js) con TypeScript
- **Database**: PostgreSQL con Prisma ORM
- **Cache**: Redis per caching e code jobs
- **Queue**: BullMQ per gestione code asincrone
- **API**: RESTful + WebSocket per real-time updates
- **Autenticazione**: JWT con refresh token

### Frontend
- **Framework**: Vue 3 con TypeScript e Composition API
- **UI Framework**: PrimeVue o Quasar
- **State Management**: Pinia
- **Build Tool**: Vite
- **Charts**: Chart.js o Apache ECharts

### Infrastruttura
- **Containerizzazione**: Docker con docker-compose
- **Reverse Proxy**: Nginx
- **Monitoring**: Prometheus + Grafana
- **Logging**: Winston + Elasticsearch

## Architettura del Sistema

### Struttura Database
Il database deve gestire:
- **Prodotti**: con varianti, BOM (Bill of Materials), lavorazioni
- **Magazzino**: multi-location (web, B2B, eventi), movimentazioni
- **Ordini**: da web (WordPress), B2B, fornitori
- **Contabilità**: fatture, scadenzario, costi generali
- **Dipendenti**: ore lavorate, costi, produttività
- **Clienti**: B2C (da WordPress) e B2B
- **Task**: workflow configurabili per gestione ordini

### Funzionalità Critiche

#### 1. Gestione Magazzino
- **Tracking real-time** delle giacenze multi-canale
- **Scanner barcode** via WebSocket per carico/scarico rapido
- **Alert automatici** per scorte minime (configurabili per prodotto)
- **Calcolo automatico MRP** per riordino materiali
- **Gestione lotti** e tracciabilità

#### 2. Gestione Prodotti
- **BOM multi-livello** con esplosione componenti
- **Cicli di lavorazione** con tempi e costi
- **Calcolo costo prodotto** (materiali + lavorazioni + overhead)
- **Varianti prodotto** (colore, taglia, etc.)
- **Analisi marginalità** per prodotto

#### 3. Integrazione WordPress
- **API REST** per sincronizzazione prodotti/giacenze
- **Webhook** per ricezione ordini real-time
- **Sync bidirezionale** clienti
- **Gestione stato ordini** con notifiche cliente

#### 4. Contabilità e Analisi
- **Scadenzario** attivo/passivo con reminder
- **Ripartizione costi generali** (per ore lavorate o volumi)
- **Break-even analysis** per prodotto
- **Dashboard KPI** real-time
- **Report esportabili** (PDF/Excel)

#### 5. Gestione Dipendenti
- **Timbrature** con calcolo ore
- **Costo orario** differenziato per mansione
- **Produttività** per task/lavorazione
- **Gestione ferie/permessi**

#### 6. Task Management
- **Workflow configurabili** per tipo ordine
- **Assegnazione automatica** basata su competenze
- **Tracking tempi** per fase
- **Notifiche real-time** cambio stato

#### 7. Sistema Notifiche
- **Alert scorte minime**
- **Scadenze pagamenti/incassi**
- **Task assegnati/scaduti**
- **Eventi calendario**
- **Anomalie produzione**

## Pattern e Best Practices

### Codice
- **Clean Architecture** con separazione layers
- **Repository Pattern** per accesso dati
- **Service Layer** per business logic
- **DTO Pattern** per trasferimento dati
- **Error Handling** centralizzato
- **Validation** con Zod o Joi
- **Testing**: min 80% coverage (Jest + Vitest)

### Performance
- **Pagination** obbligatoria per liste
- **Lazy loading** componenti Vue
- **Database indexing** su campi di ricerca
- **Query optimization** con explain analyze
- **Caching strategy** multi-livello (Redis + HTTP)
- **Rate limiting** su API pubbliche

### Security
- **RBAC** (Role-Based Access Control) granulare
- **Input sanitization** su tutti gli endpoint
- **SQL injection prevention** via Prisma
- **XSS protection** headers
- **CORS** configurato per WordPress
- **Audit log** per operazioni critiche

## Ruoli Utente
1. **Admin**: accesso completo
2. **Manager**: tutto tranne configurazioni sistema
3. **Contabile**: contabilità, reportistica, clienti
4. **Magazziniere**: magazzino, movimentazioni
5. **Operatore**: task assegnati, timbrature
6. **Commerciale**: clienti, ordini, analisi vendite
7. **Viewer**: solo lettura report

## Convenzioni Codice

### Naming
- **Database**: snake_case
- **API endpoints**: kebab-case
- **TypeScript**: camelCase (variabili), PascalCase (types/interfaces)
- **File**: kebab-case.ts

### Struttura File
```typescript
// Ogni file deve avere questa struttura
// 1. Imports
// 2. Types/Interfaces
// 3. Constants
// 4. Main logic
// 5. Exports
```

### Commenti
- Usa JSDoc per funzioni pubbliche
- Commenti in italiano per business logic
- TODO/FIXME con autore e data

## API Design

### Endpoints Standard
```
GET    /api/v1/{resource}       - Lista con pagination/filters
GET    /api/v1/{resource}/{id}  - Dettaglio
POST   /api/v1/{resource}       - Creazione
PATCH  /api/v1/{resource}/{id}  - Modifica parziale
DELETE /api/v1/{resource}/{id}  - Eliminazione (soft delete)
```

### Response Format
```json
{
  "success": boolean,
  "data": any,
  "error": string | null,
  "metadata": {
    "timestamp": "ISO 8601",
    "version": "1.0.0"
  }
}
```

## Database Migrations
- Usa Prisma migrations
- Mai modificare migration esistenti
- Sempre backup prima di migration in produzione

## Testing Requirements
- Unit test per services
- Integration test per API
- E2E test per workflow critici
- Performance test per operazioni massive

## Monitoring e Logging
- Log level: ERROR in prod, DEBUG in dev
- Metriche: response time, error rate, throughput
- Alert: downtime, errori critici, performance degradation

## Deployment
- Environment: development, staging, production
- CI/CD con GitHub Actions
- Rollback strategy sempre pronta
- Database backup automatico giornaliero

## Note Importanti
1. **Scalabilità**: Il sistema deve supportare 10.000+ prodotti, 1.000+ ordini/mese
2. **Performance**: Response time < 200ms per operazioni standard
3. **Reliability**: Uptime target 99.9%
4. **WordPress Sync**: Gestire fallback in caso di WordPress down
5. **Barcode**: Supporto EAN-13 e QR code
6. **Multi-lingua**: Predisporre i18n (IT/EN inizialmente)
7. **Multi-valuta**: EUR principale, supporto altre valute

## Priorità Sviluppo
1. Core: Prodotti, Magazzino, Movimentazioni
2. Ordini e integrazione WordPress base
3. Contabilità e Scadenzario
4. Dipendenti e Task Management
5. Analytics e Report avanzati
6. Ottimizzazioni e features aggiuntive

Quando scrivi codice, assicurati sempre di:
- Gestire errori in modo appropriato
- Validare tutti gli input
- Implementare logging significativo
- Scrivere codice testabile e manutenibile
- Documentare decisioni architetturali importanti
- Ottimizzare per performance dove necessario
