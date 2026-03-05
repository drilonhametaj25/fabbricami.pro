# Multi-stage build for MegaAdmin Frontend
FROM node:20-alpine AS base
WORKDIR /app
COPY package*.json ./

# Development stage
FROM base AS development
RUN npm install
COPY . .
EXPOSE 5174
CMD ["npm", "run", "admin:dev"]

# Build stage
FROM base AS build
RUN npm install
COPY . .

# Build args per variabili Vite (devono essere presenti al build time)
ARG VITE_API_URL=http://localhost:3000/api/v1
ENV VITE_API_URL=${VITE_API_URL}

RUN npm run admin:build

# Production stage (serve with nginx)
FROM nginx:alpine AS production
COPY --from=build /app/dist/admin /usr/share/nginx/html
COPY docker/admin/nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
