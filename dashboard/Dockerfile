FROM node:20-alpine
RUN apk add --no-cache curl
WORKDIR /app
COPY package*.json ./
RUN npm install --include=dev
COPY . .

# Accept build-time domain configuration.
# These are exposed to the Next.js client bundle as NEXT_PUBLIC_* vars.
# Must be declared BEFORE `npm run build` so Next.js bakes them in.
ARG NEXT_PUBLIC_TUNNEL_DOMAIN=setu.helios-logic.com
ARG NEXT_PUBLIC_PUBLIC_DOMAIN=https://setu.helios-logic.com
ENV NEXT_PUBLIC_TUNNEL_DOMAIN=$NEXT_PUBLIC_TUNNEL_DOMAIN
ENV NEXT_PUBLIC_PUBLIC_DOMAIN=$NEXT_PUBLIC_PUBLIC_DOMAIN

RUN npm run build
EXPOSE 3000
CMD ["npm", "run", "start"]
