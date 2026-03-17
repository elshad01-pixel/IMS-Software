FROM node:24-alpine AS builder
WORKDIR /app

COPY package.json ./
COPY package-lock.json ./
COPY apps/api/package.json apps/api/package.json
RUN npm install

COPY apps/api ./apps/api
WORKDIR /app/apps/api
RUN npm run prisma:generate
RUN npm run build

FROM node:24-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production

COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/apps/api/package.json ./package.json
COPY --from=builder /app/apps/api/dist ./dist
COPY --from=builder /app/apps/api/prisma ./prisma
COPY --from=builder /app/apps/api/prisma.config.ts ./prisma.config.ts

EXPOSE 3000
CMD ["sh", "-ec", "npx prisma migrate deploy || npx prisma db push; node dist/prisma/seed.js; node dist/src/main.js"]
