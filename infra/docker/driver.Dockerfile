FROM node:20-bullseye-slim

ENV NODE_ENV=production

WORKDIR /app

COPY . ./

RUN if [ -f node_modules.tgz ]; then       tar -xzf node_modules.tgz && rm node_modules.tgz;     fi

EXPOSE 8081

CMD ["npx", "serve", "-s", "dist", "-l", "8081"]
