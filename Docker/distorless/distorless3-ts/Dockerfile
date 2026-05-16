# --- Build stage ---
FROM node:20-slim AS build
WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY tsconfig.json ./
COPY src ./src
RUN npm run build

# Prune to production deps only
RUN npm ci --omit=dev

# --- Runtime stage (distroless) ---
FROM gcr.io/distroless/nodejs20-debian12 AS runtime
WORKDIR /app
ENV NODE_ENV=production

COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY --from=build /app/package.json ./package.json

EXPOSE 3000
USER nonroot
CMD ["dist/src/server.js"]
