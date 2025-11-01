FROM node:20-bullseye-slim

ENV NODE_ENV=production

WORKDIR /app

COPY . ./

RUN if [ -f node_modules.tgz ]; then \
      tar -xzf node_modules.tgz && rm node_modules.tgz; \
    fi

# Debug: List files to verify .next exists
RUN echo "=== Listing /app directory ===" && \
    ls -la && \
    echo "=== Checking .next directory ===" && \
    ls -la .next/ || echo ".next directory not found!"

EXPOSE 3000

CMD ["node", "node_modules/next/dist/bin/next", "start", "-p", "3000"]
