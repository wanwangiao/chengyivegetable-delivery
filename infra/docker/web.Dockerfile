FROM node:20-bullseye-slim

ENV NODE_ENV=production

WORKDIR /app

# Copy all files
COPY . ./

# Extract packed directories (MUST exist or build fails)
RUN if [ ! -f next.tgz ]; then \
      echo "ERROR: next.tgz not found! Railway CLI may have filtered it."; \
      ls -la; \
      exit 1; \
    fi && \
    tar -xzf next.tgz && rm next.tgz && \
    if [ -f node_modules.tgz ]; then \
      tar -xzf node_modules.tgz && rm node_modules.tgz; \
    fi

EXPOSE 3000

CMD ["node", "node_modules/next/dist/bin/next", "start", "-p", "3000"]
