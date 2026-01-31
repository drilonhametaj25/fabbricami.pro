# 🚀 Guida Installazione e Avvio - ecommerceerp ERP

## 📋 Prerequisiti

- **Node.js** >= 20.0.0
- **Docker** e **Docker Compose**
- **Git**

## 🔧 Installazione

### 1. Clona il repository

```powershell
git clone https://github.com/ecommerceerp/ecommerceerp-erp.git
cd ecommerceerp-erp
```

### 2. Configura environment

```powershell
cp .env.example .env
```

Modifica il file `.env` con le tue configurazioni (database, JWT secrets, etc.)

### 3. Installa dipendenze

```powershell
npm install
```

### 4. Genera Prisma Client

```powershell
npm run prisma:generate
```

## 🐳 Avvio con Docker (CONSIGLIATO)

### Development

```powershell
# Avvia tutti i servizi
npm run docker:up

# Attendi che tutti i container siano pronti, poi esegui migrations
npm run prisma:migrate

# Popola database con dati di esempio
npm run prisma:seed
```

L'applicazione sarà disponibile su:
- **Frontend**: http://localhost:80
- **Backend API**: http://localhost:3000
- **Grafana**: http://localhost:3002 (admin/admin)
- **Kibana**: http://localhost:5601

### Production

```powershell
docker-compose -f docker-compose.prod.yml up -d
```

## 💻 Avvio Locale (senza Docker)

### 1. Avvia PostgreSQL e Redis

Assicurati di avere PostgreSQL e Redis in esecuzione localmente o usa Docker solo per questi:

```powershell
docker run -d -p 5432:5432 -e POSTGRES_PASSWORD=postgres postgres:16-alpine
docker run -d -p 6379:6379 redis:7-alpine
```

### 2. Configura DATABASE_URL nel file .env

```env
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/ecommerceerp_erp?schema=public
REDIS_HOST=localhost
```

### 3. Esegui migrations

```powershell
npm run prisma:migrate
npm run prisma:seed
```

### 4. Avvia in modalità sviluppo

```powershell
npm run dev
```

Backend sarà su http://localhost:3000
Frontend sarà su http://localhost:5173

## 🧪 Testing

```powershell
# Run all tests
npm test

# Watch mode
npm run test:watch

# Coverage
npm run test:coverage

# E2E tests
npm run test:e2e
```

## 📦 Build per Produzione

```powershell
npm run build
```

I file compilati saranno in `dist/`

## 🔑 Credenziali Default

Dopo aver eseguito il seed:

- **Email**: admin@ecommerceerp.com
- **Password**: admin123

⚠️ **IMPORTANTE**: Cambia subito queste credenziali in produzione!

## 🛠️ Comandi Utili

```powershell
# Visualizza logs Docker
npm run docker:logs

# Ferma tutti i container
npm run docker:down

# Rebuild containers
npm run docker:build

# Prisma Studio (database UI)
npm run prisma:studio

# Lint
npm run lint

# Format code
npm run format
```

## 📊 Monitoraggio

### Grafana
- URL: http://localhost:3002
- User: admin
- Password: admin

### Kibana (Logs)
- URL: http://localhost:5601

### Prometheus
- URL: http://localhost:9090

## 🔄 WordPress Integration

### Setup WordPress

1. Installa plugin **WooCommerce REST API**
2. Genera API Key: WooCommerce > Settings > Advanced > REST API
3. Configura Webhook: WooCommerce > Settings > Webhooks
   - URL: `http://your-erp-domain.com/api/v1/wordpress/webhook/order`
   - Secret: inserisci WORDPRESS_WEBHOOK_SECRET dal .env

### Configurazione .env

```env
WORDPRESS_URL=https://your-wordpress-site.com
WORDPRESS_API_KEY=your-api-key
WORDPRESS_WEBHOOK_SECRET=your-webhook-secret
```

## 🐛 Troubleshooting

### Database connection error

Verifica che PostgreSQL sia in esecuzione:
```powershell
docker ps | findstr postgres
```

### Redis connection error

Verifica che Redis sia in esecuzione:
```powershell
docker ps | findstr redis
```

### Port already in use

Cambia le porte nel docker-compose.yml o ferma i servizi in conflitto.

### Prisma migration failed

Reset database (⚠️ cancella tutti i dati):
```powershell
npm run prisma:migrate reset
```

## 📝 Note Importanti

1. **Performance**: Il sistema è ottimizzato per gestire 10.000+ prodotti e 1.000+ ordini/mese
2. **Scalabilità**: Redis caching abilitato per default
3. **Security**: Cambia tutti i secrets in produzione
4. **Backup**: Backup automatico database configurato (vedi BACKUP_SCHEDULE in .env)
5. **SSL**: In produzione, configura certificati SSL in docker/nginx/ssl/

## 🆘 Supporto

Per problemi o domande:
- Apri un issue su GitHub
- Email: support@ecommerceerp.com

## 📚 Documentazione API

Una volta avviato il server, la documentazione Swagger sarà disponibile su:
http://localhost:3000/documentation

---

**Sviluppato con ❤️ per ecommerceerp**
