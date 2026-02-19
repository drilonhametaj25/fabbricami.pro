# Marketing Site (Next.js) - Production Dockerfile
# Multi-stage build for optimized image size

# ===========================================
# STAGE 1: Dependencies
# ===========================================
FROM node:20-alpine AS deps
WORKDIR /app

# Copy package files from ecommerce-next directory
COPY src/ecommerce-next/package*.json ./

# Install dependencies
RUN npm ci --only=production

# ===========================================
# STAGE 2: Builder
# ===========================================
FROM node:20-alpine AS builder
WORKDIR /app

# Copy deps from previous stage
COPY --from=deps /app/node_modules ./node_modules

# Copy source
COPY src/ecommerce-next/ ./

# Build arguments
ARG NEXT_PUBLIC_API_URL=http://localhost:3000
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL

# Build the application
RUN npm run build

# ===========================================
# STAGE 3: Runner
# ===========================================
FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# Create non-root user
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

# Copy built application (standalone output)
COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs

EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

CMD ["node", "server.js"]
