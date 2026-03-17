# ISO SaaS Platform

Multi-tenant ISO management SaaS platform built with Angular, NestJS, PostgreSQL, Prisma, Docker, Nginx, and MinIO.

## Structure

- `apps/api`: NestJS API, Prisma schema, domain modules
- `apps/web`: Angular standalone frontend
- `infra/nginx`: reverse proxy configuration

## Modules

- Dashboard
- Documents
- Risks
- CAPA
- Audits
- Management Review
- KPIs
- Training
- Reports
- Users
- Settings

## Core capabilities

- Multi-tenant data model with `tenantId`
- JWT auth
- RBAC with roles and permissions
- Audit logging
- Attachment storage via MinIO
- Shared action-item engine

## Docker startup

1. Copy `.env.example` to `.env`
2. Run `docker compose up -d --build`
3. Open the app at `http://localhost:8080`

The API container runs Prisma migration deployment with a `db push` fallback, then seeds the demo tenant automatically on startup.

## URLs

- App: `http://localhost:8080`
- API: `http://localhost:3000/api`
- Swagger: `http://localhost:3000/api/docs`
- Swagger through Nginx: `http://localhost:8080/api/docs`
- MinIO API: `http://localhost:9000`
- MinIO Console: `http://localhost:9001`

## Demo credentials

- Tenant slug: `demo-tenant`
- Email: `admin@demo.local`
- Password: `ChangeMe123!`

## Local development

1. Copy `.env.example` to `.env`
2. Run `npm install`
3. Start PostgreSQL and MinIO with `docker compose up -d postgres minio`
4. Generate the Prisma client with `npm run prisma:generate`
5. Apply migrations with `npm run db:deploy`
6. Seed demo data with `npm run seed`
7. Run the API with `npm run dev:api`
8. Run the frontend with `npm run dev:web`

## Resetting the stack

- Stop containers: `docker compose down`
- Stop and delete volumes: `docker compose down -v`
