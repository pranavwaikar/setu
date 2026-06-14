FROM node:20-alpine

# openssl        — required by Prisma v5 at runtime on Alpine
# postgresql-client — provides pg_isready for reliable DB readiness checking
# curl           — used by Docker healthcheck (curl -f /health)
RUN apk add --no-cache openssl postgresql-client curl

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
