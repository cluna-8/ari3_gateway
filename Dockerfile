FROM node:18

WORKDIR /app

# Copy package files and install dependencies
COPY package*.json ./
RUN npm install

# Copy application code
COPY . .

# Make sure the triage standalone script is executable
RUN chmod +x triage-standalone.js

# Create required directories
RUN mkdir -p logs
RUN mkdir -p agents

# Expose ports
EXPOSE 3000
EXPOSE 5000-5010

# Start the application
CMD ["node", "index.js"]
