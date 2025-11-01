FROM node:20-bullseye-slim AS builder

WORKDIR /app

# Install pnpm
RUN npm install -g pnpm@9.9.0

# Copy package files
COPY package.json ./
COPY tsconfig*.json ./

# Extract node_modules if exists, otherwise install
RUN if [ -f node_modules.tgz ]; then \
      tar -xzf node_modules.tgz && rm node_modules.tgz; \
    fi

# Install all dependencies (including dev dependencies for building)
RUN pnpm install

# Copy source code
COPY src ./src
COPY prisma ./prisma

# Build the application
RUN pnpm exec tsc -p tsconfig.build.json

# Production stage
FROM node:20-bullseye-slim

ENV NODE_ENV=production

WORKDIR /app

# Copy built files and dependencies from builder
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/prisma ./prisma

# Verify dist exists
RUN ls -la dist/ && echo "✅ dist directory exists"

EXPOSE 3000

CMD ["node", "dist/index.js"]
