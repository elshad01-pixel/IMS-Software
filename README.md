# ISO SaaS Platform

Multi-tenant ISO management SaaS platform built with Angular standalone, NestJS, PostgreSQL, Prisma, Docker, Nginx, and MinIO.

## Structure

- `apps/api`: NestJS API, Prisma schema, migrations, seed script
- `apps/web`: Angular frontend
- `infra/nginx`: reverse proxy configuration

## Current module status

Production-ready workflows are implemented for:

- Dashboard
- Documents
- Risks
- CAPA
- Internal Audits
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

## Browser smoke test

Use these exact browser steps against the running stack after `docker compose up -d --build`:

1. Open `http://localhost:8080/login`
2. Sign in with:
   - Tenant slug: `demo-tenant`
   - Email: `admin@demo.local`
   - Password: `ChangeMe123!`
3. Confirm the app redirects to `Dashboard`
4. Open `Documents`, `Risks`, and `CAPA` from the left navigation
5. Create one new record in each module and confirm the green success message appears
6. Confirm each new record appears in the register immediately after save
7. Re-open each record from the register, edit it, save again, and confirm the changes persist

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
3. Leave the editor in create mode or click `Start new document`.
4. Enter `Code`, `Title`, `Type`, `Owner`, and `Effective Date`.
5. Click `Create document`.
6. Confirm the green `Document saved successfully.` message appears.
7. Verify the document appears immediately in the register.
8. Re-open the record from the register, update it, and click `Save changes`.
9. Open the record again and submit it for review.
10. Approve the record and confirm the status and revision update.
11. Upload an attachment and add an action item.

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
2. Leave the editor in create mode or click `Start new risk`.
3. Enter `Title`, `Description`, `Owner`, `Likelihood`, `Severity`, and `Target Date`.
4. Click `Create risk`.
5. Confirm the green `Risk saved successfully.` message appears.
6. Verify the calculated score and immediate register update.
7. Re-open the record, update it to `IN_TREATMENT`, and save again.
8. Add a treatment action item with owner and due date.
9. Confirm the risk appears in dashboard high-risk and action summaries.

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
2. Leave the editor in create mode or click `Start new CAPA`.
3. Enter `Title`, `Source`, `Problem Statement`, `Owner`, and `Due Date`.
4. Click `Create CAPA`.
5. Confirm the green `CAPA saved successfully.` message appears.
6. Verify the record appears immediately in the CAPA register.
7. Re-open the record, move it through `INVESTIGATING`, `ACTION_PLANNED`, and `IN_PROGRESS`, and save at each step.
8. Add a linked action item and complete it.
9. Set the CAPA to `VERIFIED`, then `CLOSED`.
10. Confirm closure is persisted and visible on the dashboard.

### Dashboard

Implemented:

- Real metric cards for documents, approved documents, risks, high-risk count, CAPAs, open CAPAs, audits, management reviews, training assignments, KPI breaches, open actions, and overdue actions
- Risk summary
- CAPA summary
- Audit summary
- KPI watch and breach summary
- Training overdue summary
- Recent documents
- Recent CAPAs
- Recent audits
- KPI summary
- Training summary
- Open action list with owners and due dates

Manual test:

1. Complete the Documents, Risks, and CAPA tests above.
2. Open `Dashboard`.
3. Verify the metrics, recent lists, and action list reflect the latest records immediately.

## PHASE 2 workflows

### Internal Audits

Implemented:

- Create audit plans with code, type, lead auditor, auditee area, schedule, and status
- List audits with checklist completion and open finding counts
- View audit details
- Add checklist items and mark them complete
- Record audit findings with severity, owner, and due date
- Create linked CAPA directly from findings
- Close audits after findings are resolved or escalated to CAPA
- Linked audit action items through the shared action-item engine

Manual test:

1. Open `Audits`.
2. Create an audit plan with code, title, auditor, and schedule.
3. Move it to `IN_PROGRESS`.
4. Add at least one checklist item and mark it complete.
5. Add a finding.
6. Create a CAPA from that finding.
7. Move the audit to `COMPLETED`, then `CLOSED`.

### Management Review

Implemented:

- Create management review meetings
- Select review inputs from risks, CAPAs, audits, and KPIs
- Record agenda, minutes, decisions, and summary
- Track review status
- Create linked management review action items
- List and view review meetings

Manual test:

1. Open `Management Review`.
2. Create a review meeting with date and chairperson.
3. Select at least one input from each relevant module you want to include.
4. Record minutes and decisions.
5. Save the meeting in `HELD` status.
6. Add a linked action item and verify it appears on the dashboard.

### KPIs

Implemented:

- Create KPI definitions with owner, direction, target, threshold, unit, and period
- Add KPI readings over time
- Automatically update the current KPI value from the latest reading
- Compute KPI status as `ON_TARGET`, `WATCH`, or `BREACH`
- Show trend based on recent reading history
- Highlight breaches in the KPI register and dashboard

Manual test:

1. Open `KPIs`.
2. Create a KPI definition with target and warning threshold.
3. Add at least two readings on different dates.
4. Verify the current value, trend, and status update immediately.
5. Confirm KPI watch or breach counts update on the dashboard when applicable.

### Training

Implemented:

- Create training courses with audience, owner, method, and due date
- Assign training to users
- Track assignment status as `ASSIGNED`, `IN_PROGRESS`, or `COMPLETED`
- Store assignment notes and evidence summary
- Calculate course completion percentage from assignment completion
- Show training status by user within each course detail

Manual test:

1. Open `Training`.
2. Create a course.
3. Assign it to one or more users with due dates.
4. Save notes or evidence summary on the assignment.
5. Mark one assignment complete.
6. Verify course completion updates immediately.

### Settings

Implemented:

- Configure tenant organization details including company name, industry, and location
- Upload an organization logo through the shared attachment workflow
- Manage simple role capabilities for `Admin`, `Manager`, and `User`
- Configure document types, numbering prefix, and version format
- Configure risk likelihood and severity scales
- Configure KPI threshold defaults
- Enable or disable tenant notifications
- Apply settings to downstream behavior where relevant:
  - document create uses configured type options and numbering prefix
  - risk create/edit uses configured likelihood and severity scales
  - KPI create uses configured threshold defaults
  - document approval and CAPA closure permissions respect role capability settings

Manual test:

1. Open `Settings`.
2. Update `Organization` and save.
3. Open `Document Settings`, change the prefix or types, save, then open `Documents > New` and confirm the new defaults appear.
4. Open `Risk Settings`, switch the scale to `1-10`, save, then open `Risks > New` and confirm the assessment fields support the updated range.
5. Open `KPI Settings`, change thresholds, save, then open `KPIs > New` and confirm the create form uses the updated defaults.
6. Open `Users & Roles`, change a role capability, save, and confirm the change persists after refresh.
7. Refresh `Settings` and verify all saved values persist.

## Verification completed

The following were executed successfully on March 19, 2026:

- `npm run prisma:generate --workspace apps/api`
- `npm run build`
- `docker compose up -d --build api web nginx`

Verified against the running stack:

- Demo login works through `http://localhost:8080/api/auth/login`
- Document create, update, review, approve, detail fetch, list fetch, and attachment upload
- Risk create, update, list, detail fetch, and linked treatment action creation
- CAPA create, status progression, linked action completion, and closure
- Audit create, checklist update, finding creation, CAPA creation from finding, status progression, detail fetch, and closure
- Management review create, linked input persistence, detail fetch, and action creation
- KPI create, reading history persistence, trend calculation, and status calculation
- Training create, assignment create, completion update, and detail fetch
- Settings config read, section save, role capability update, and persistence after refresh
- Settings-driven document type/prefix, risk scale, and KPI threshold behavior
- Dashboard summary reflects PHASE 1 and PHASE 2 records and open actions
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
