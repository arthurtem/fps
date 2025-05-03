FROM node:18-slim

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .

# Build the client app
RUN npm run build

# Expose the port your server listens on
EXPOSE 3000

CMD ["node", "server/index.js"]