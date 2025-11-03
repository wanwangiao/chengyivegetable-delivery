FROM node:20-bullseye-slim

ENV NODE_ENV=production

WORKDIR /app

# Copy all files
COPY . ./

# Extract packed directories
RUN tar -xzf next.tgz && rm -f next.tgz && \
    tar -xzf node_modules.tgz && rm -f node_modules.tgz

EXPOSE 3000

CMD ["node", "node_modules/next/dist/bin/next", "start", "-p", "3000"]
