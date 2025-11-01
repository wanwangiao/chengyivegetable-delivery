FROM node:20-bullseye-slim

ENV NODE_ENV=production

WORKDIR /app

# Copy all files
COPY . ./

# Extract packed directories
RUN if [ -f dist.tgz ]; then \
      tar -xzf dist.tgz && rm dist.tgz; \
    fi && \
    if [ -f node_modules.tgz ]; then \
      tar -xzf node_modules.tgz && rm node_modules.tgz; \
    fi

EXPOSE 3000

CMD ["node", "dist/index.js"]
