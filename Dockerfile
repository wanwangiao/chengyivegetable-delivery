FROM node:20-slim

WORKDIR /app

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.base.json ./
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/
COPY apps/driver/package.json apps/driver/
COPY packages/config/package.json packages/config/
COPY packages/domain/package.json packages/domain/
COPY packages/lib/package.json packages/lib/

RUN apt-get update -y && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*

RUN corepack enable && pnpm install --frozen-lockfile

COPY . .

CMD ["pnpm", "run", "start"]
