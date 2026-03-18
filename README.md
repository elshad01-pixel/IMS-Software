# ISO SaaS Platform

Multi-tenant ISO management SaaS platform built with Angular standalone, NestJS, PostgreSQL, Prisma, Docker, Nginx, and MinIO.

## Structure

- `apps/api`: NestJS API, Prisma schema, migrations, seed script
- `apps/web`: Angular frontend
- `infra/nginx`: reverse proxy configuration

## Current module status

Production-ready PHASE 1 workflows are implemented for:

- Dashboard
- Documents
- Risks
- CAPA

The remaining modules still exist in the repo, but they are not yet completed to the same standard.

## Core capabilities

- Multi-tenant data model with `tenantId`
- JWT auth
- RBAC with roles and permissions
- Audit logging
- Attachment storage via MinIO
- Shared action-item engine
- Dockerized reverse proxy setup with Angular at `/` and the API at `/api`

## Docker startup

1. Copy `.env.example` to `.env`
2. Start the stack:

```bash
docker compose up -d --build
```

3. Open the application:

- App: `http://localhost:8080`
- API docs through Nginx: `http://localhost:8080/api/docs`

The API container runs Prisma migration deployment on startup and then seeds the demo tenant.

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
2. Install dependencies:

```bash
npm install
```

3. Start infrastructure:

```bash
docker compose up -d postgres minio
```

4. Generate Prisma client:

```bash
npm run prisma:generate
```

5. Apply migrations:

```bash
npm run db:deploy
```

6. Seed demo data:

```bash
npm run seed
```

7. Start the API:

```bash
npm run dev:api
```

8. Start the frontend:

```bash
npm run dev:web
```

## PHASE 1 workflows

### Documents

Implemented:

- Create, edit, list, and view document records
- Controlled status flow: `DRAFT -> REVIEW -> APPROVED -> OBSOLETE`
- Revision tracking with automatic revision increment on changes
- Owner assignment, effective date, review due date, and change summary
- Evidence attachments and linked action items
- Dashboard visibility for recent and approved documents

Manual test:

1. Sign in with the demo credentials.
2. Open `Documents`.
3. Create a document with code, title, type, and dates.
4. Verify it appears immediately in the register.
5. Open the record and submit it for review.
6. Approve the record and confirm the status and revision update.
7. Upload an attachment and add an action item.

### Risks

Implemented:

- Create, edit, list, and view risk records
- Likelihood, severity, and automatic score calculation
- Risk register sorted by highest score
- Treatment plan, treatment summary, owner, and target date
- Linked action items for treatment work
- Dashboard high-risk and action visibility

Manual test:

1. Open `Risks`.
2. Create a risk with likelihood and severity.
3. Verify the calculated score and immediate register update.
4. Update the risk to `IN_TREATMENT`.
5. Add a treatment action item with owner and due date.
6. Confirm the risk appears in dashboard high-risk and action summaries.

### CAPA

Implemented:

- Raise a nonconformity / CAPA
- Source, category, problem statement, containment, root cause, correction
- Corrective action, preventive action, verification method, closure summary
- Owner assignment and due date
- Controlled status flow through investigation, planning, execution, verification, closure
- Closure gate that blocks closure while linked CAPA actions remain open
- Dashboard visibility for open and recent CAPAs

Manual test:

1. Open `CAPA`.
2. Create a CAPA with source, problem statement, and owner.
3. Move it through `INVESTIGATING`, `ACTION_PLANNED`, and `IN_PROGRESS`.
4. Add a linked action item and complete it.
5. Set the CAPA to `VERIFIED`, then `CLOSED`.
6. Confirm closure is persisted and visible on the dashboard.

### Dashboard

Implemented:

- Real metric cards for documents, approved documents, risks, high-risk count, CAPAs, open CAPAs, open actions, and overdue actions
- Risk summary
- CAPA summary
- Recent documents
- Recent CAPAs
- Open action list with owners and due dates

Manual test:

1. Complete the Documents, Risks, and CAPA tests above.
2. Open `Dashboard`.
3. Verify the metrics, recent lists, and action list reflect the latest records immediately.

## Verification completed

The following were executed successfully on March 18, 2026:

- `npm run prisma:generate --workspace apps/api`
- `npm run build`
- `docker compose up -d --build api web nginx`

Verified against the running stack:

- Demo login works through `http://localhost:8080/api/auth/login`
- Document create, update, review, approve, detail fetch, list fetch, and attachment upload
- Risk create, update, list, detail fetch, and linked treatment action creation
- CAPA create, status progression, linked action completion, and closure
- Dashboard summary reflects PHASE 1 records and open actions
- `http://localhost:8080` serves the Angular app
- `http://localhost:8080/api/docs` still serves Swagger

## Resetting the stack

- Stop containers:

```bash
docker compose down
```

- Stop containers and remove volumes:

```bash
docker compose down -v
```
