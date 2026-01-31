# ===========================================
# EcommerceERP E-commerce - Next.js 14 Dockerfile
# Multi-stage build per produzione ottimizzata
# ===========================================

# ---- Base ----
FROM node:20-alpine AS base
WORKDIR /app

# Installa dipendenze di sistema necessarie
RUN apk add --no-cache libc6-compat

# ---- Dependencies ----
FROM base AS deps

# Copia solo i file necessari per installare dipendenze
COPY package.json package-lock.json* ./

# Installa dipendenze
RUN npm ci --only=production && npm cache clean --force

# Copia anche le dipendenze dev per il build
RUN npm ci && npm cache clean --force

# ---- Builder ----
FROM base AS builder

# Copia dipendenze
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Variabili di ambiente per il build
ARG API_BASE_URL
ENV API_BASE_URL=${API_BASE_URL}
ENV NEXT_TELEMETRY_DISABLED=1

# Build dell'applicazione
RUN npm run build

# ---- Production ----
FROM base AS production

# Imposta ambiente produzione
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# Crea utente non-root per sicurezza
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

# Copia i file necessari dal builder
COPY --from=builder /app/public ./public

# Crea directory per la cache di Next.js
RUN mkdir .next
RUN chown nextjs:nodejs .next

# Copia l'output standalone (se configurato) o la build completa
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

# Usa utente non-root
USER nextjs

# Esponi porta
EXPOSE 3001

# Variabili runtime
ENV PORT=3001
ENV HOSTNAME="0.0.0.0"

# Avvia l'applicazione
CMD ["node", "server.js"]
