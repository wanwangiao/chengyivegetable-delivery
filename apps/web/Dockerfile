# Build stage
FROM node:20-bullseye-slim AS builder

WORKDIR /monorepo

# Copy workspace files
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY packages ./packages
COPY apps/web ./apps/web

# Install pnpm
RUN corepack enable && corepack prepare pnpm@9.9.0 --activate

# Install all dependencies
RUN pnpm install --frozen-lockfile

# Build shared packages
RUN pnpm --filter @chengyi/config build && \
    pnpm --filter @chengyi/domain build && \
    pnpm --filter @chengyi/lib build

# Build Web
RUN pnpm --filter web build

# Production stage
FROM node:20-bullseye-slim

ENV NODE_ENV=production

WORKDIR /app

# Install pnpm
RUN corepack enable && corepack prepare pnpm@9.9.0 --activate

# Copy built files from builder
COPY --from=builder /monorepo/apps/web/.next ./.next
COPY --from=builder /monorepo/apps/web/public ./public
COPY --from=builder /monorepo/apps/web/package.json ./package.json
COPY --from=builder /monorepo/node_modules ./node_modules
COPY --from=builder /monorepo/packages ./node_modules/@chengyi

EXPOSE 3000

CMD ["node_modules/.bin/next", "start", "-p", "3000"]
