FROM node:20-alpine AS base

WORKDIR /app

COPY package.json pnpm-workspace.yaml tsconfig.base.json ./
COPY apps/api/package.json apps/api/
COPY packages/config/package.json packages/config/
COPY packages/domain/package.json packages/domain/
COPY packages/lib/package.json packages/lib/

RUN corepack enable && pnpm install --frozen-lockfile

COPY . ./

RUN pnpm --filter config build && pnpm --filter domain build && pnpm --filter lib build
RUN pnpm --filter api build

CMD ["pnpm", "--filter", "api", "start"]
