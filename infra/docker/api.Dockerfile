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
    echo "✓ Checking dist/index.js:" && \
    ls -la dist/index.js && \
    if [ -f node_modules.tgz ]; then \
      tar -xzf node_modules.tgz && rm node_modules.tgz; \
    fi

EXPOSE 3000

CMD ["node", "dist/index.js"]
