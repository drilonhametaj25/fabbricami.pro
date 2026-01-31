# 🎯 EcommerceERP - Sistema Gestionale Completo

**Versione:** 2.0.0
**Stato:** Backend 95% Completato | Frontend 60% Completato
**Ultimo Aggiornamento:** 24 Ottobre 2025

Sistema gestionale enterprise completo per e-commerce con integrazione WordPress, notifiche real-time, code asincrone e WebSocket.

## 🚀 Funzionalità Principali

### 📦 Gestione Magazzino
- Tracking real-time giacenze multi-canale (Web, B2B, Eventi)
- Scanner barcode per carico/scarico rapido
- Alert automatici scorte minime
- Calcolo MRP per riordino materiali
- Gestione lotti e tracciabilità

### 🛠️ Gestione Prodotti
- BOM multi-livello con esplosione componenti
- Cicli di lavorazione con tempi e costi
- Calcolo costo prodotto (materiali + lavorazioni + overhead)
- Varianti prodotto
- Analisi marginalità

### 🌐 Integrazione WordPress
- Sincronizzazione prodotti/giacenze
- Webhook per ricezione ordini real-time
- Sync bidirezionale clienti
- Gestione stato ordini

### 💰 Contabilità
- Scadenzario attivo/passivo con reminder
- Ripartizione costi generali
- Break-even analysis per prodotto
- Dashboard KPI real-time
- Report esportabili (PDF/Excel)

### 👥 Gestione Dipendenti
- Timbrature e calcolo ore
- Costo orario per mansione
- Produttività per task
- Gestione ferie/permessi

### 📋 Task Management
- Workflow configurabili
- Assegnazione automatica
- Tracking tempi per fase
- Notifiche real-time

### 📊 Analytics
- Analisi prodotti (margini, break-even)
- Analisi clienti B2C/B2B
- Dashboard KPI
- Report personalizzati

## 🛠️ Stack Tecnologico

### Backend
- **Fastify** (Node.js) con TypeScript
- **PostgreSQL** con Prisma ORM
- **Redis** per cache e code
- **BullMQ** per job queue
- **WebSocket** per real-time updates

### Frontend
- **Vue 3** con TypeScript e Composition API
- **PrimeVue** UI Framework
- **Pinia** per state management
- **Vite** build tool
- **Chart.js** per grafici

### Infrastruttura
- **Docker** con docker-compose
- **Nginx** reverse proxy
- **Prometheus + Grafana** per monitoring
- **Winston + Elasticsearch** per logging

## 📋 Prerequisiti

- Node.js >= 20.0.0
- Docker e Docker Compose
- Git

## 🚀 Quick Start

### 1. Clona il repository
```bash
git clone https://github.com/ecommerceerp/ecommerceerp-erp.git
cd ecommerceerp-erp
```

### 2. Configura environment
```bash
cp .env.example .env
# Modifica .env con le tue configurazioni
```

### 3. Avvia con Docker
```bash
npm run docker:up
```

### 4. Setup database
```bash
npm run prisma:migrate
npm run prisma:seed
```

### 5. Accedi all'applicazione
- Frontend: http://localhost:80
- API: http://localhost:3000
- Grafana: http://localhost:3002
- Prisma Studio: http://localhost:5555

## 🔧 Sviluppo Locale

### Installa dipendenze
```bash
npm install
```

### Genera Prisma Client
```bash
npm run prisma:generate
```

### Avvia in modalità sviluppo
```bash
npm run dev
```

### Build per produzione
```bash
npm run build
```

### Test
```bash
npm test                # Unit tests
npm run test:coverage   # Con coverage
npm run test:e2e        # E2E tests
```

## 📁 Struttura Progetto

```
ecommerceerp-erp/
├── src/
│   ├── server/          # Backend Fastify
│   │   ├── config/      # Configurazioni
│   │   ├── controllers/ # Controllers
│   │   ├── services/    # Business logic
│   │   ├── repositories/# Data access layer
│   │   ├── routes/      # API routes
│   │   ├── middleware/  # Middleware (auth, validation)
│   │   ├── jobs/        # BullMQ jobs
│   │   ├── websocket/   # WebSocket handlers
│   │   └── utils/       # Utilities
│   ├── client/          # Frontend Vue 3
│   │   ├── components/  # Componenti Vue
│   │   ├── composables/ # Composable functions
│   │   ├── layouts/     # Layouts
│   │   ├── pages/       # Pagine
│   │   ├── stores/      # Pinia stores
│   │   ├── router/      # Vue Router
│   │   └── services/    # API services
│   └── shared/          # Codice condiviso (types, constants)
├── prisma/              # Schema e migrations
├── docker/              # Dockerfile e configs
├── tests/               # Tests
└── docs/                # Documentazione
```

## 🔐 Ruoli Utente

1. **Admin** - Accesso completo
2. **Manager** - Tutto tranne configurazioni sistema
3. **Contabile** - Contabilità, reportistica, clienti
4. **Magazziniere** - Magazzino, movimentazioni
5. **Operatore** - Task assegnati, timbrature
6. **Commerciale** - Clienti, ordini, analisi vendite
7. **Viewer** - Solo lettura report

## 📚 API Documentation

La documentazione completa delle API è disponibile su:
- Swagger UI: http://localhost:3000/documentation
- Redoc: http://localhost:3000/redoc

## 🔄 Integrazione WordPress

### Configurazione WordPress
1. Installa plugin WooCommerce REST API
2. Genera API Key da WooCommerce > Settings > Advanced > REST API
3. Configura webhook per ordini in WooCommerce > Settings > Webhooks
4. Inserisci credenziali in `.env`

### Endpoints WordPress Sync
- `POST /api/v1/wordpress/sync-products` - Sincronizza prodotti
- `POST /api/v1/wordpress/sync-inventory` - Aggiorna giacenze
- `POST /api/v1/wordpress/webhook/order` - Ricevi ordine

## 📊 Monitoring

### Grafana Dashboards
- System Metrics
- API Performance
- Database Performance
- Queue Metrics
- Business KPIs

### Logs
```bash
npm run docker:logs           # Tutti i servizi
docker-compose logs backend   # Solo backend
docker-compose logs frontend  # Solo frontend
```

## 🧪 Testing

```bash
npm test                    # Run all tests
npm run test:watch          # Watch mode
npm run test:coverage       # Coverage report
npm run test:e2e            # E2E tests
```

Target coverage: >= 80%

## 🚢 Deployment

### Hetzner Cloud

1. **Provisioning Server**
```bash
# Crea server su Hetzner Cloud
# Installa Docker e Docker Compose
```

2. **Deploy**
```bash
# Clone repository
git clone https://github.com/ecommerceerp/ecommerceerp-erp.git
cd ecommerceerp-erp

# Configura environment
cp .env.example .env
nano .env

# Build e avvia
docker-compose -f docker-compose.prod.yml up -d
```

3. **Setup SSL con Let's Encrypt**
```bash
# Certbot automatico via Nginx
```

## 🔒 Security

- JWT con refresh token
- RBAC granulare
- Input sanitization
- Rate limiting
- SQL injection prevention (Prisma)
- XSS protection headers
- CORS configurato
- Audit log per operazioni critiche

## 🤝 Contributi

1. Fork il progetto
2. Crea feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit changes (`git commit -m 'Add AmazingFeature'`)
4. Push to branch (`git push origin feature/AmazingFeature`)
5. Open Pull Request

## 📝 License

MIT License - vedi file [LICENSE](LICENSE)

## 📧 Supporto

- Email: support@ecommerceerp.com
- Issues: https://github.com/ecommerceerp/ecommerceerp-erp/issues

## 🙏 Credits

Sviluppato con ❤️ per EcommerceERP
