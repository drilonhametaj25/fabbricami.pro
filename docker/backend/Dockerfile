# Multi-stage build for Backend
FROM node:20-alpine AS base
WORKDIR /app

# Installa OpenSSL 3.x e dipendenze necessarie per Prisma
RUN apk add --no-cache openssl libc6-compat

COPY package*.json ./
COPY tsconfig*.json ./

# Development stage
FROM base AS development
RUN npm install
COPY . .
RUN npx prisma generate
EXPOSE 3000 3001
CMD ["npm", "run", "dev:server"]

# Build stage
FROM base AS build
RUN npm ci
COPY . .
RUN npx prisma generate
RUN npm run build:server

# Production stage
FROM node:20-alpine AS production
WORKDIR /app
ENV NODE_ENV=production

# Installa OpenSSL 3.x per Prisma
RUN apk add --no-cache openssl libc6-compat

COPY package*.json ./
COPY tsconfig*.json ./
RUN npm ci --only=production
# Installa ts-node per poter eseguire il seed
RUN npm install -g ts-node typescript

COPY --from=build /app/dist ./dist
COPY --from=build /app/prisma ./prisma
COPY --from=build /app/node_modules/.prisma ./node_modules/.prisma
# Copia src per il seed (usa import da src/server/utils)
COPY --from=build /app/src ./src

RUN npx prisma generate

EXPOSE 3000 3001

CMD ["node", "dist/server/server/index.js"]
