FROM node:20-bullseye-slim

ENV NODE_ENV=production

WORKDIR /app

# Copy all files
COPY . ./

# Debug and extract packed directories
RUN echo "=== Files in /app ===" && \
    ls -lah && \
    echo "=== Extracting next.tgz ===" && \
    tar -xzf next.tgz && \
    echo "=== Extracting node_modules.tgz ===" && \
    tar -xzf node_modules.tgz && \
    echo "=== Verifying .next directory ===" && \
    ls -lah .next/ && \
    test -d .next && \
    echo "✓ .next directory exists" && \
    rm -f next.tgz node_modules.tgz

EXPOSE 3000

CMD ["node", "node_modules/next/dist/bin/next", "start", "-p", "3000"]
