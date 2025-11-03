FROM node:20-bullseye-slim

ENV NODE_ENV=production

WORKDIR /app

# Copy all files
COPY . ./

# Debug and extract packed directories
RUN echo "=== Files in /app ===" && \
    ls -lah && \
    echo "=== Extracting dist.tgz ===" && \
    tar -xzf dist.tgz && \
    echo "=== Extracting node_modules.tgz ===" && \
    tar -xzf node_modules.tgz && \
    echo "=== Verifying dist directory ===" && \
    ls -lah dist/ && \
    test -d dist && \
    echo "✓ dist directory exists" && \
    rm -f dist.tgz node_modules.tgz

EXPOSE 8081

CMD ["npx", "serve", "-s", "dist", "-l", "8081"]
