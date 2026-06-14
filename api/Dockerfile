FROM node:20-alpine

# Install curl (for healthchecks) and netcat (for DB readiness check in entrypoint)
RUN apk add --no-cache curl netcat-openbsd

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .
RUN npx prisma generate
RUN npm run build

# Copy and set permissions on entrypoint
COPY docker/entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

EXPOSE 4000

ENTRYPOINT ["/entrypoint.sh"]
