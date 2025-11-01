FROM node:20-bullseye-slim AS builder

WORKDIR /app

# Install pnpm
RUN npm install -g pnpm@9.9.0

# Copy package files
COPY package.json ./
COPY tsconfig*.json ./
COPY vite.config.ts ./

# Extract node_modules if exists, otherwise install
RUN if [ -f node_modules.tgz ]; then \
      tar -xzf node_modules.tgz && rm node_modules.tgz; \
    fi

# Install all dependencies (including dev dependencies for building)
RUN pnpm install

# Copy source code
COPY src ./src
COPY public ./public
COPY index.html ./

# Build Vite application
RUN pnpm exec vite build

# Production stage
FROM node:20-bullseye-slim

ENV NODE_ENV=production

WORKDIR /app

# Copy built files and serve dependency
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./package.json

EXPOSE 8081

CMD ["npx", "serve", "-s", "dist", "-l", "8081"]
