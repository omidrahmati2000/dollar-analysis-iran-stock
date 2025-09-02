# Frontend Dockerfile for React application
FROM node:18-alpine

# Set working directory
WORKDIR /app

# Copy package files
COPY frontend/package*.json ./

# Install dependencies
RUN npm install

# Copy source code
COPY frontend/ ./

# Expose port
EXPOSE 3000

# Start development server with hot reload
CMD ["npm", "start"]