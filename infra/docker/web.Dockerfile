FROM node:20-bullseye-slim

ENV NODE_ENV=production

WORKDIR /app

COPY . ./

RUN if [ -f node_modules.tgz ]; then \
      tar -xzf node_modules.tgz && rm node_modules.tgz; \
    fi

# Debug: List files to verify .next exists (will show in build logs)
RUN echo "=== BUILD: Listing /app directory ===" && \
    ls -la && \
    echo "=== BUILD: Checking .next directory ===" && \
    (ls -la .next/ && echo "BUILD: .next exists!") || echo "BUILD ERROR: .next directory not found!"

EXPOSE 3000

# Create startup script that checks for .next before running
RUN echo '#!/bin/sh\n\
echo "=== RUNTIME: Checking /app directory ==="\n\
ls -la /app\n\
echo "=== RUNTIME: Checking .next directory ==="\n\
if [ -d /app/.next ]; then\n\
  echo "RUNTIME: .next exists!"\n\
  ls -la /app/.next\n\
  exec node node_modules/next/dist/bin/next start -p 3000\n\
else\n\
  echo "RUNTIME ERROR: .next directory not found!"\n\
  echo "Files in /app:"\n\
  find /app -type d -maxdepth 2\n\
  exit 1\n\
fi' > /app/start.sh && chmod +x /app/start.sh

CMD ["/app/start.sh"]
