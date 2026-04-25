# syntax=docker/dockerfile:1.7

FROM node:20-slim AS build
WORKDIR /app
RUN corepack enable && corepack prepare pnpm@9.0.0 --activate
COPY package.json pnpm-lock.yaml* pnpm-workspace.yaml tsconfig.base.json ./
COPY services/notify-svc ./services/notify-svc
RUN pnpm install --frozen-lockfile=false
RUN pnpm -F @hydrax/notify-svc build

FROM node:20-slim
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build /app/services/notify-svc/dist ./dist
COPY --from=build /app/services/notify-svc/package.json ./package.json
EXPOSE 7101
USER node
CMD ["node", "dist/server.js"]
