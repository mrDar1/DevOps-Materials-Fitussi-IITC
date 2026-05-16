# Use the official Node.js 24 image as the base image for building the application
FROM node:24-alpine AS build

WORKDIR /app
COPY package*.json .
RUN npm ci


FROM gcr.io/distroless/nodejs24

WORKDIR /app

# Copy the node_modules from the build stage to the distroless image
COPY --from=build /app/node_modules ./node_modules

COPY src src

ENV PORT=3000

# because node is the default entrypoint for distroless/nodejs, we can just specify the script to run
CMD ["src/server.js"]
