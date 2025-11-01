FROM node:20-bullseye-slim

ENV NODE_ENV=production

WORKDIR /app

COPY . ./

RUN if [ -f node_modules.tgz ]; then \
      tar -xzf node_modules.tgz && rm node_modules.tgz; \
    fi

# Debug: List files to verify dist exists (will show in build logs)
RUN echo "=== BUILD: Listing /app directory ===" && \
    ls -la && \
    echo "=== BUILD: Checking dist directory ===" && \
    (ls -la dist/ && echo "BUILD: dist exists!") || echo "BUILD ERROR: dist directory not found!"

EXPOSE 3000

# Create startup script that checks for dist before running
RUN echo '#!/bin/sh\n\
echo "=== RUNTIME: Checking /app directory ==="\n\
ls -la /app\n\
echo "=== RUNTIME: Checking dist directory ==="\n\
if [ -d /app/dist ]; then\n\
  echo "RUNTIME: dist exists!"\n\
  ls -la /app/dist\n\
  exec node dist/index.js\n\
else\n\
  echo "RUNTIME ERROR: dist directory not found!"\n\
  echo "Files in /app:"\n\
  find /app -type f -name "*.js" | head -20\n\
  exit 1\n\
fi' > /app/start.sh && chmod +x /app/start.sh

CMD ["/app/start.sh"]
