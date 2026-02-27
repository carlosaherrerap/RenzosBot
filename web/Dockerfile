FROM node:20-alpine
WORKDIR /app
COPY package.json ./
RUN npm install
COPY next.config.js ./
COPY tsconfig.json ./
COPY pages ./pages
RUN npm run build
EXPOSE 3000
CMD ["npm", "start"]
