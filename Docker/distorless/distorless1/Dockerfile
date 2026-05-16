
# FROM node:24-alpine
FROM gcr.io/distroless/nodejs24

WORKDIR /app

COPY package*.json .

RUN npm ci

COPY . .

ENV PORT=3000

CMD ["node", "src/server.js"]
