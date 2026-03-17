FROM node:24-alpine AS builder
WORKDIR /app

COPY package.json ./
COPY package-lock.json ./
COPY apps/web/package.json apps/web/package.json
RUN npm install

COPY apps/web ./apps/web
WORKDIR /app/apps/web
RUN npm run build

FROM nginx:1.27-alpine AS runner
COPY apps/web/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=builder /app/apps/web/dist/web/browser/ /usr/share/nginx/html/
EXPOSE 80
