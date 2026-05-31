FROM node:22-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci --omit=dev

COPY . .

ARG COMMIT_SHA=local
ENV COMMIT_SHA=$COMMIT_SHA

EXPOSE 3000

USER node

CMD ["node", "app.js"]
