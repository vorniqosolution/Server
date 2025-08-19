FROM node:22-alpine AS deps
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev

FROM node:20-alpine
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=8080
COPY --from=deps /app/node_modules ./node_modules
COPY . .
HEALTHCHECK --interval=30s --timeout=3s --retries=3 \
  CMD wget -qO- http://127.0.0.1:8080/health || exit 1
EXPOSE 8080
CMD ["node","index.js"]
