# syntax=docker/dockerfile:1.7

FROM node:20-slim AS build
WORKDIR /app
RUN corepack enable && corepack prepare pnpm@9.0.0 --activate
COPY package.json pnpm-lock.yaml* pnpm-workspace.yaml tsconfig.base.json ./
COPY services/bff ./services/bff
RUN pnpm install --frozen-lockfile=false
RUN pnpm -F @hydrax/bff build

FROM node:20-slim
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build /app/services/bff/dist ./dist
COPY --from=build /app/services/bff/package.json ./package.json
EXPOSE 7103
USER node
CMD ["node", "dist/server.js"]
