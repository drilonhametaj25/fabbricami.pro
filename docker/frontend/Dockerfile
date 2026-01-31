# Multi-stage build for Frontend
FROM node:20-alpine AS base
WORKDIR /app
COPY package*.json ./

# Development stage
FROM base AS development
RUN npm install
COPY . .
EXPOSE 5173
CMD ["npm", "run", "dev:client"]

# Build stage
FROM base AS build
RUN npm ci
COPY . .

# Build args per variabili Vite (devono essere presenti al build time)
ARG VITE_API_URL=http://localhost:3000
ENV VITE_API_URL=${VITE_API_URL}

RUN npm run build:client

# Production stage (serve with nginx)
FROM nginx:alpine AS production
COPY --from=build /app/dist/client /usr/share/nginx/html
COPY docker/nginx/frontend.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
