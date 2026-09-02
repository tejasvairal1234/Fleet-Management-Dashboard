FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev
COPY src/ ./src/
# Copy the data directory for robots.json
COPY ../data/ ./data/
CMD ["node", "src/index.js"]
