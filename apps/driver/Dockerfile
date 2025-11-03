# Build stage
FROM node:20-bullseye-slim AS builder

WORKDIR /monorepo

# Copy workspace files
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY packages ./packages
COPY apps/driver ./apps/driver

# Install pnpm
RUN corepack enable && corepack prepare pnpm@9.9.0 --activate

# Install all dependencies
RUN pnpm install --frozen-lockfile

# Build shared packages
RUN pnpm --filter @chengyi/config build && \
    pnpm --filter @chengyi/domain build && \
    pnpm --filter @chengyi/lib build

# Build Driver
RUN pnpm --filter driver build

# Production stage
FROM node:20-bullseye-slim

ENV NODE_ENV=production

WORKDIR /app

# Install serve
RUN npm install -g serve

# Copy built files from builder
COPY --from=builder /monorepo/apps/driver/dist ./dist

EXPOSE 8081

CMD ["serve", "-s", "dist", "-l", "8081"]
