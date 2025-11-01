FROM node:20-bullseye-slim

ENV NODE_ENV=production

WORKDIR /app

COPY . ./

RUN if [ -f node_modules.tgz ]; then \
      tar -xzf node_modules.tgz && rm node_modules.tgz; \
    fi

# Debug: List files to verify dist exists
RUN echo "=== Listing /app directory ===" && \
    ls -la && \
    echo "=== Checking dist directory ===" && \
    ls -la dist/ || echo "dist directory not found!"

EXPOSE 3000

CMD ["node", "dist/index.js"]
