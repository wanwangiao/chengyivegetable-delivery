FROM node:20-bullseye-slim

ENV NODE_ENV=production

WORKDIR /app

COPY . ./

EXPOSE 3000

CMD ["node", "node_modules/next/dist/bin/next", "start", "-p", "3000"]
