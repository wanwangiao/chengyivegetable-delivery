FROM node:20-bullseye-slim

ENV NODE_ENV=production

WORKDIR /app

# Copy all files
COPY . ./

# Extract packed directories (MUST exist or build fails)
RUN if [ ! -f dist.tgz ]; then \
      echo "ERROR: dist.tgz not found! Railway CLI may have filtered it."; \
      ls -la; \
      exit 1; \
    fi && \
    echo "✓ Found dist.tgz, extracting..." && \
    tar -xzf dist.tgz && rm dist.tgz && \
    echo "✓ Extracted dist.tgz" && \
    ls -la && \
    echo "✓ Checking dist directory:" && \
    ls -la dist/ | head -20 && \
    if [ -f node_modules.tgz ]; then \
      tar -xzf node_modules.tgz && rm node_modules.tgz; \
    fi

EXPOSE 8081

CMD ["npx", "serve", "-s", "dist", "-l", "8081"]
