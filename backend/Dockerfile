FROM node:20-alpine
WORKDIR /app
COPY package.json ./
RUN apk add --no-cache git
RUN npm install
COPY tsconfig.json ./
COPY src ./src
COPY prisma ./prisma
RUN npm run prisma:generate
RUN npm run build
ENV PORT=3001
EXPOSE 3001
CMD ["node", "dist/index.js"]
