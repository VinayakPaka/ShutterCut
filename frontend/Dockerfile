FROM node:20-alpine

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy application code
COPY . .

# Expose Expo default port
EXPOSE 8081

# Start Expo
CMD ["npx", "expo", "start", "--tunnel"]
