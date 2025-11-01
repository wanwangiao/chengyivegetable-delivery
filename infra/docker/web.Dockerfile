FROM node:20-bullseye-slim AS builder

WORKDIR /app

# Install pnpm
RUN npm install -g pnpm@9.9.0

# Copy package files
COPY package.json ./
COPY next.config.mjs ./
COPY tsconfig*.json ./

# Extract node_modules if exists, otherwise install
RUN if [ -f node_modules.tgz ]; then \
      tar -xzf node_modules.tgz && rm node_modules.tgz; \
    fi

# Install all dependencies (including dev dependencies for building)
RUN pnpm install

# Copy source code
COPY src ./src
COPY public ./public

# Build Next.js application
RUN pnpm exec next build

# Production stage
FROM node:20-bullseye-slim

ENV NODE_ENV=production

WORKDIR /app

# Copy built files and dependencies from builder
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/public ./public
COPY --from=builder /app/next.config.mjs ./next.config.mjs

EXPOSE 3000

CMD ["node", "node_modules/next/dist/bin/next", "start", "-p", "3000"]
