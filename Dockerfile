# UddoktaHut API — production image (Node 22)
FROM node:22-bookworm-slim AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

FROM deps AS build
COPY . .
RUN npm run build

FROM node:22-bookworm-slim AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force
COPY --from=build /app/dist ./dist
COPY drizzle ./drizzle
RUN chown -R node:node /app
USER node
EXPOSE 4000
# Deploy: node dist/migrate.js && node dist/main.js
CMD ["node", "dist/main.js"]
