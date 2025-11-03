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
    echo "=== Verifying dist/index.js ===" && \
    ls -lah dist/ && \
    test -f dist/index.js && \
    echo "✓ dist/index.js exists" && \
    rm -f dist.tgz node_modules.tgz

EXPOSE 3000

CMD ["node", "dist/index.js"]
