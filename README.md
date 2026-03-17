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

## Local run

1. Copy `.env.example` to `.env`
2. Install dependencies with `npm install`
3. Generate Prisma client with `npm run prisma:generate --workspace apps/api`
4. Start infrastructure with `docker compose up -d postgres minio`
5. Push schema with `npx prisma db push --schema apps/api/prisma/schema.prisma --config apps/api/prisma.config.ts`
6. Seed demo data with `npm run seed --workspace apps/api`
7. Run apps with `npm run dev:api` and `npm run dev:web`

Default seeded login:

- Tenant slug: `demo-tenant`
- Email: `admin@demo.local`
- Password: `ChangeMe123!`
