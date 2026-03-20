import {
  AuditStatus,
  CapaStatus,
  DocumentStatus,
  ManagementReviewStatus,
  RiskStatus,
  TrainingAssignmentStatus
} from '@prisma/client';
import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { ExportReportQueryDto } from './dto/export-report-query.dto';

type ReportDefinition = {
  type: string;
  module: string;
  title: string;
  description: string;
  supportsDateRange?: boolean;
  supportsStatus?: boolean;
  supportsOwner?: boolean;
  statusOptions?: string[];
};

const reportDefinitions: ReportDefinition[] = [
  {
    type: 'documents-register',
    module: 'Documents',
    title: 'Documents register export',
    description: 'Controlled documents with code, revision, status, and review dates.',
    supportsDateRange: true,
    supportsStatus: true,
    supportsOwner: true,
    statusOptions: ['DRAFT', 'REVIEW', 'APPROVED', 'OBSOLETE']
  },
  {
    type: 'risks-register',
    module: 'Risks',
    title: 'Risks register export',
    description: 'Risk assessment, current score, treatment status, and target dates.',
    supportsDateRange: true,
    supportsStatus: true,
    supportsOwner: true,
    statusOptions: ['OPEN', 'IN_TREATMENT', 'MITIGATED', 'ACCEPTED', 'CLOSED']
  },
  {
    type: 'capa-register',
    module: 'CAPA',
    title: 'CAPA register export',
    description: 'Nonconformities, ownership, due dates, and closure status.',
    supportsDateRange: true,
    supportsStatus: true,
    supportsOwner: true,
    statusOptions: ['OPEN', 'INVESTIGATING', 'ACTION_PLANNED', 'IN_PROGRESS', 'VERIFIED', 'CLOSED']
  },
  {
    type: 'audit-summary',
    module: 'Audits',
    title: 'Audit summary export',
    description: 'Audit plans, status, schedule dates, and finding counts.',
    supportsDateRange: true,
    supportsStatus: true,
    statusOptions: ['PLANNED', 'IN_PROGRESS', 'COMPLETED', 'CLOSED']
  },
  {
    type: 'management-review-summary',
    module: 'Management Review',
    title: 'Management review summary export',
    description: 'Review meetings, chairperson, date, and decisions summary.',
    supportsDateRange: true,
    supportsStatus: true,
    statusOptions: ['PLANNED', 'HELD', 'CLOSED']
  },
  {
    type: 'kpi-summary',
    module: 'KPIs',
    title: 'KPI summary export',
    description: 'Targets, actuals, thresholds, and current performance state.',
    supportsDateRange: true,
    supportsOwner: true
  },
  {
    type: 'training-assignments',
    module: 'Training',
    title: 'Training assignments export',
    description: 'Training assignments, completion status, due dates, and evidence summary.',
    supportsDateRange: true,
    supportsStatus: true,
    statusOptions: ['ASSIGNED', 'IN_PROGRESS', 'COMPLETED']
  }
];

@Injectable()
export class ReportsService {
  constructor(private readonly prisma: PrismaService) {}

  list() {
    return reportDefinitions;
  }

  async export(tenantId: string, reportType: string, query: ExportReportQueryDto) {
    const definition = reportDefinitions.find((item) => item.type === reportType);
    if (!definition) {
      throw new BadRequestException('Unsupported report type');
    }

    switch (reportType) {
      case 'documents-register':
        return this.exportDocuments(tenantId, query);
      case 'risks-register':
        return this.exportRisks(tenantId, query);
      case 'capa-register':
        return this.exportCapas(tenantId, query);
      case 'audit-summary':
        return this.exportAudits(tenantId, query);
      case 'management-review-summary':
        return this.exportManagementReviews(tenantId, query);
      case 'kpi-summary':
        return this.exportKpis(tenantId, query);
      case 'training-assignments':
        return this.exportTrainingAssignments(tenantId, query);
    }
  }

  private async exportDocuments(tenantId: string, query: ExportReportQueryDto) {
    const rows = await this.prisma.document.findMany({
      where: {
        tenantId,
        deletedAt: null,
        status: (query.status as DocumentStatus | undefined) || undefined,
        ownerId: query.ownerId || undefined,
        createdAt: this.buildDateRange(query)
      },
      orderBy: { updatedAt: 'desc' }
    });

    return this.toCsv(
      ['Code', 'Title', 'Type', 'Status', 'Version', 'Revision', 'Effective Date', 'Review Due', 'Updated At'],
      rows.map((item) => [
        item.code,
        item.title,
        item.type,
        item.status,
        item.version,
        item.revision,
        this.formatDate(item.effectiveDate),
        this.formatDate(item.reviewDueDate),
        this.formatDateTime(item.updatedAt)
      ])
    );
  }

  private async exportRisks(tenantId: string, query: ExportReportQueryDto) {
    const rows = await this.prisma.risk.findMany({
      where: {
        tenantId,
        deletedAt: null,
        status: (query.status as RiskStatus | undefined) || undefined,
        ownerId: query.ownerId || undefined,
        createdAt: this.buildDateRange(query)
      },
      orderBy: [{ score: 'desc' }, { updatedAt: 'desc' }]
    });

    return this.toCsv(
      ['Title', 'Category', 'Likelihood', 'Severity', 'Score', 'Status', 'Target Date', 'Treatment Plan', 'Updated At'],
      rows.map((item) => [
        item.title,
        item.category ?? '',
        item.likelihood,
        item.severity,
        item.score,
        item.status,
        this.formatDate(item.targetDate),
        item.treatmentPlan ?? '',
        this.formatDateTime(item.updatedAt)
      ])
    );
  }

  private async exportCapas(tenantId: string, query: ExportReportQueryDto) {
    const rows = await this.prisma.capa.findMany({
      where: {
        tenantId,
        deletedAt: null,
        status: (query.status as CapaStatus | undefined) || undefined,
        ownerId: query.ownerId || undefined,
        createdAt: this.buildDateRange(query)
      },
      orderBy: { updatedAt: 'desc' }
    });

    return this.toCsv(
      ['Title', 'Source', 'Category', 'Status', 'Owner Due Date', 'Closed At', 'Problem Statement', 'Updated At'],
      rows.map((item) => [
        item.title,
        item.source,
        item.category ?? '',
        item.status,
        this.formatDate(item.dueDate),
        this.formatDateTime(item.closedAt),
        item.problemStatement,
        this.formatDateTime(item.updatedAt)
      ])
    );
  }

  private async exportAudits(tenantId: string, query: ExportReportQueryDto) {
    const rows = await this.prisma.audit.findMany({
      where: {
        tenantId,
        deletedAt: null,
        status: (query.status as AuditStatus | undefined) || undefined,
        scheduledAt: this.buildDateRange(query)
      },
      orderBy: [{ scheduledAt: 'desc' }, { updatedAt: 'desc' }]
    });

    const auditIds = rows.map((item) => item.id);
    const findings = await this.prisma.auditFinding.findMany({
      where: { tenantId, auditId: { in: auditIds } },
      select: { auditId: true }
    });
    const checklistItems = await this.prisma.auditChecklistItem.findMany({
      where: { tenantId, auditId: { in: auditIds } },
      select: { auditId: true, isComplete: true }
    });

    const findingCounts = findings.reduce<Record<string, number>>((accumulator, item) => {
      accumulator[item.auditId] = (accumulator[item.auditId] ?? 0) + 1;
      return accumulator;
    }, {});
    const checklistCounts = checklistItems.reduce<Record<string, { total: number; complete: number }>>((accumulator, item) => {
      const current = accumulator[item.auditId] ?? { total: 0, complete: 0 };
      current.total += 1;
      current.complete += item.isComplete ? 1 : 0;
      accumulator[item.auditId] = current;
      return accumulator;
    }, {});

    return this.toCsv(
      ['Code', 'Title', 'Type', 'Status', 'Scheduled At', 'Auditee Area', 'Findings', 'Checklist Complete', 'Updated At'],
      rows.map((item) => [
        item.code,
        item.title,
        item.type,
        item.status,
        this.formatDate(item.scheduledAt),
        item.auditeeArea ?? '',
        findingCounts[item.id] ?? 0,
        `${checklistCounts[item.id]?.complete ?? 0}/${checklistCounts[item.id]?.total ?? 0}`,
        this.formatDateTime(item.updatedAt)
      ])
    );
  }

  private async exportManagementReviews(tenantId: string, query: ExportReportQueryDto) {
    const rows = await this.prisma.managementReview.findMany({
      where: {
        tenantId,
        deletedAt: null,
        status: (query.status as ManagementReviewStatus | undefined) || undefined,
        reviewDate: this.buildDateRange(query)
      },
      orderBy: [{ reviewDate: 'desc' }, { updatedAt: 'desc' }]
    });

    const reviewIds = rows.map((item) => item.id);
    const inputs = await this.prisma.managementReviewInput.findMany({
      where: { tenantId, reviewId: { in: reviewIds } },
      select: { reviewId: true }
    });
    const inputCounts = inputs.reduce<Record<string, number>>((accumulator, item) => {
      accumulator[item.reviewId] = (accumulator[item.reviewId] ?? 0) + 1;
      return accumulator;
    }, {});

    return this.toCsv(
      ['Title', 'Status', 'Review Date', 'Inputs', 'Summary', 'Decisions', 'Updated At'],
      rows.map((item) => [
        item.title,
        item.status,
        this.formatDate(item.reviewDate),
        inputCounts[item.id] ?? 0,
        item.summary ?? '',
        item.decisions ?? '',
        this.formatDateTime(item.updatedAt)
      ])
    );
  }

  private async exportKpis(tenantId: string, query: ExportReportQueryDto) {
    const rows = await this.prisma.kpi.findMany({
      where: {
        tenantId,
        ownerId: query.ownerId || undefined,
        updatedAt: this.buildDateRange(query)
      },
      include: {
        readings: {
          orderBy: { readingDate: 'desc' },
          take: 1
        }
      },
      orderBy: { updatedAt: 'desc' }
    });

    return this.toCsv(
      ['Name', 'Period', 'Direction', 'Target', 'Warning Threshold', 'Actual', 'Unit', 'Latest Reading Date', 'Updated At'],
      rows.map((item) => [
        item.name,
        item.periodLabel,
        item.direction,
        item.target,
        item.warningThreshold ?? '',
        item.actual,
        item.unit,
        this.formatDate(item.readings[0]?.readingDate ?? null),
        this.formatDateTime(item.updatedAt)
      ])
    );
  }

  private async exportTrainingAssignments(tenantId: string, query: ExportReportQueryDto) {
    const rows = await this.prisma.trainingAssignment.findMany({
      where: {
        tenantId,
        status: (query.status as TrainingAssignmentStatus | undefined) || undefined,
        userId: query.ownerId || undefined,
        createdAt: this.buildDateRange(query)
      },
      orderBy: { updatedAt: 'desc' }
    });

    const userIds = [...new Set(rows.map((item) => item.userId))];
    const trainingIds = [...new Set(rows.map((item) => item.trainingId))];
    const users = await this.prisma.user.findMany({
      where: { tenantId, id: { in: userIds } },
      select: { id: true, firstName: true, lastName: true, email: true }
    });
    const trainings = await this.prisma.training.findMany({
      where: { tenantId, id: { in: trainingIds } },
      select: { id: true, title: true, deliveryMethod: true }
    });
    const userMap = new Map(users.map((user) => [user.id, user]));
    const trainingMap = new Map(trainings.map((training) => [training.id, training]));

    return this.toCsv(
      ['Course', 'Assignee', 'Email', 'Delivery Method', 'Status', 'Due Date', 'Completed At', 'Evidence Summary', 'Updated At'],
      rows.map((item) => [
        trainingMap.get(item.trainingId)?.title ?? '',
        `${userMap.get(item.userId)?.firstName ?? ''} ${userMap.get(item.userId)?.lastName ?? ''}`.trim(),
        userMap.get(item.userId)?.email ?? '',
        trainingMap.get(item.trainingId)?.deliveryMethod ?? '',
        item.status,
        this.formatDate(item.dueDate),
        this.formatDateTime(item.completedAt),
        item.evidenceSummary ?? item.notes ?? '',
        this.formatDateTime(item.updatedAt)
      ])
    );
  }

  private buildDateRange(query: ExportReportQueryDto) {
    const range: { gte?: Date; lte?: Date } = {};
    if (query.startDate) {
      range.gte = new Date(query.startDate);
    }
    if (query.endDate) {
      const end = new Date(query.endDate);
      end.setHours(23, 59, 59, 999);
      range.lte = end;
    }
    return Object.keys(range).length ? range : undefined;
  }

  private toCsv(headers: Array<string>, rows: Array<Array<string | number | null | undefined>>) {
    const escape = (value: string | number | null | undefined) =>
      `"${String(value ?? '').replace(/"/g, '""')}"`;
    return [headers.map(escape).join(','), ...rows.map((row) => row.map(escape).join(','))].join('\n');
  }

  private formatDate(value: Date | string | null | undefined) {
    if (!value) return '';
    return new Date(value).toISOString().slice(0, 10);
  }

  private formatDateTime(value: Date | string | null | undefined) {
    if (!value) return '';
    return new Date(value).toISOString();
  }
}
