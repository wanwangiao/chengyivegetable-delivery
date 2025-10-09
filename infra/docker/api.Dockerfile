FROM node:20-bullseye-slim

ENV NODE_ENV=production

WORKDIR /app

COPY . ./

EXPOSE 3000

CMD ["node", "dist/index.js"]
