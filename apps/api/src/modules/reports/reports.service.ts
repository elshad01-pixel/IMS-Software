import {
  AuditStatus,
  CapaStatus,
  DocumentStatus,
  ManagementReviewStatus,
  RiskStatus,
  TrainingAssignmentStatus
} from '@prisma/client';
import { BadRequestException, Injectable } from '@nestjs/common';
import {
  getChangeRequestDelegate,
  getComplianceObligationDelegate,
  getEnvironmentalAspectDelegate,
  getExternalProviderControlDelegate,
  getHazardIdentificationDelegate,
  getIncidentDelegate
} from '../../common/prisma/prisma-delegate-compat';
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
    title: 'Management review export',
    description: 'Review meetings with recorded inputs, outputs, conclusions, and follow-up content.',
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
  },
  {
    type: 'incidents-register',
    module: 'Incidents',
    title: 'Incidents register export',
    description: 'Incidents and near misses with category, severity, ownership, and investigation status.',
    supportsDateRange: true,
    supportsStatus: true,
    supportsOwner: true,
    statusOptions: ['REPORTED', 'INVESTIGATION', 'ACTION_IN_PROGRESS', 'CLOSED', 'ARCHIVED']
  },
  {
    type: 'hazards-register',
    module: 'Hazards',
    title: 'Hazards register export',
    description: 'Hazards, potential harm, severity, review dates, and current control status.',
    supportsDateRange: true,
    supportsStatus: true,
    supportsOwner: true,
    statusOptions: ['ACTIVE', 'MONITORING', 'OBSOLETE']
  },
  {
    type: 'environmental-aspects-register',
    module: 'Environmental Aspects',
    title: 'Environmental aspects export',
    description: 'Environmental aspects, impacts, significance, review dates, and control status.',
    supportsDateRange: true,
    supportsStatus: true,
    supportsOwner: true,
    statusOptions: ['ACTIVE', 'MONITORING', 'OBSOLETE']
  },
  {
    type: 'obligations-register',
    module: 'Obligations',
    title: 'Compliance obligations export',
    description: 'Owned obligations with source, review timing, status, and linked control visibility.',
    supportsDateRange: true,
    supportsStatus: true,
    supportsOwner: true,
    statusOptions: ['ACTIVE', 'UNDER_REVIEW', 'OBSOLETE']
  },
  {
    type: 'providers-register',
    module: 'External Providers',
    title: 'External providers export',
    description: 'Provider control status, annual evaluation outcome, criticality, and review dates.',
    supportsDateRange: true,
    supportsStatus: true,
    supportsOwner: true,
    statusOptions: ['APPROVED', 'CONDITIONAL', 'UNDER_REVIEW', 'INACTIVE']
  },
  {
    type: 'change-register',
    module: 'Change Management',
    title: 'Change management export',
    description: 'Planned changes with owner, implementation target, review date, and current stage.',
    supportsDateRange: true,
    supportsStatus: true,
    supportsOwner: true,
    statusOptions: ['PROPOSED', 'REVIEWING', 'APPROVED', 'IMPLEMENTING', 'VERIFIED', 'CLOSED', 'REJECTED']
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
      case 'incidents-register':
        return this.exportIncidents(tenantId, query);
      case 'hazards-register':
        return this.exportHazards(tenantId, query);
      case 'environmental-aspects-register':
        return this.exportEnvironmentalAspects(tenantId, query);
      case 'obligations-register':
        return this.exportObligations(tenantId, query);
      case 'providers-register':
        return this.exportProviders(tenantId, query);
      case 'change-register':
        return this.exportChanges(tenantId, query);
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

    return this.toCsv(
      [
        'Title',
        'Status',
        'Review Date',
        'Inputs Recorded',
        'Outputs Recorded',
        'Audit Results',
        'CAPA Status',
        'KPI Performance',
        'Customer and Interested-Party Feedback',
        'Provider Performance',
        'Compliance Obligations',
        'Incidents and Emergency Performance',
        'Consultation and Communication',
        'Risks and Opportunities',
        'Changes Affecting the System',
        'Previous Actions',
        'Minutes',
        'Decisions',
        'Improvement Actions',
        'System Changes Needed',
        'Objective and Target Changes',
        'Resource Needs',
        'Effectiveness Conclusion',
        'Summary',
        'Updated At'
      ],
      rows.map((item) => [
        item.title,
        item.status,
        this.formatDate(item.reviewDate),
        this.countFilledValues([
          item.auditResults,
          item.capaStatus,
          item.kpiPerformance,
          item.customerInterestedPartiesFeedback,
          item.providerPerformance,
          item.complianceObligations,
          item.incidentEmergencyPerformance,
          item.consultationCommunication,
          item.risksOpportunities,
          item.changesAffectingSystem,
          item.previousActions
        ]),
        this.countFilledValues([
          item.minutes,
          item.decisions,
          item.improvementActions,
          item.systemChangesNeeded,
          item.objectiveTargetChanges,
          item.resourceNeeds,
          item.effectivenessConclusion,
          item.summary
        ]),
        item.auditResults ?? '',
        item.capaStatus ?? '',
        item.kpiPerformance ?? '',
        item.customerInterestedPartiesFeedback ?? '',
        item.providerPerformance ?? '',
        item.complianceObligations ?? '',
        item.incidentEmergencyPerformance ?? '',
        item.consultationCommunication ?? '',
        item.risksOpportunities ?? '',
        item.changesAffectingSystem ?? '',
        item.previousActions ?? '',
        item.minutes ?? '',
        item.decisions ?? '',
        item.improvementActions ?? '',
        item.systemChangesNeeded ?? '',
        item.objectiveTargetChanges ?? '',
        item.resourceNeeds ?? '',
        item.effectivenessConclusion ?? '',
        item.summary ?? '',
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

  private async exportIncidents(tenantId: string, query: ExportReportQueryDto) {
    const rows = await getIncidentDelegate(this.prisma).findMany({
      where: {
        tenantId,
        deletedAt: null,
        status: query.status || undefined,
        ownerUserId: query.ownerId || undefined,
        createdAt: this.buildDateRange(query)
      },
      orderBy: { updatedAt: 'desc' }
    });
    const userMap = await this.loadUserMap(tenantId, rows.map((item) => item.ownerUserId));

    return this.toCsv(
      ['Reference', 'Title', 'Type', 'Category', 'Severity', 'Status', 'Owner', 'Root Cause', 'Updated At'],
      rows.map((item) => [
        item.referenceNo ?? '',
        item.title,
        item.type,
        item.category,
        item.severity,
        item.status,
        userMap.get(item.ownerUserId ?? '') ?? '',
        item.rootCause ?? '',
        this.formatDateTime(item.updatedAt)
      ])
    );
  }

  private async exportHazards(tenantId: string, query: ExportReportQueryDto) {
    const rows = await getHazardIdentificationDelegate(this.prisma).findMany({
      where: {
        tenantId,
        deletedAt: null,
        status: query.status || undefined,
        ownerUserId: query.ownerId || undefined,
        reviewDate: this.buildDateRange(query)
      },
      orderBy: [{ severity: 'desc' }, { reviewDate: 'asc' }, { updatedAt: 'desc' }]
    });
    const userMap = await this.loadUserMap(tenantId, rows.map((item) => item.ownerUserId));

    return this.toCsv(
      ['Reference', 'Activity', 'Hazard', 'Potential Harm', 'Exposure Stage', 'Severity', 'Status', 'Review Date', 'Owner', 'Updated At'],
      rows.map((item) => [
        item.referenceNo ?? '',
        item.activity,
        item.hazard,
        item.potentialHarm,
        item.exposureStage,
        item.severity,
        item.status,
        this.formatDate(item.reviewDate),
        userMap.get(item.ownerUserId ?? '') ?? '',
        this.formatDateTime(item.updatedAt)
      ])
    );
  }

  private async exportEnvironmentalAspects(tenantId: string, query: ExportReportQueryDto) {
    const rows = await getEnvironmentalAspectDelegate(this.prisma).findMany({
      where: {
        tenantId,
        deletedAt: null,
        status: query.status || undefined,
        ownerUserId: query.ownerId || undefined,
        reviewDate: this.buildDateRange(query)
      },
      orderBy: [{ significance: 'desc' }, { reviewDate: 'asc' }, { updatedAt: 'desc' }]
    });
    const userMap = await this.loadUserMap(tenantId, rows.map((item) => item.ownerUserId));

    return this.toCsv(
      ['Reference', 'Activity', 'Aspect', 'Impact', 'Lifecycle Stage', 'Significance', 'Status', 'Review Date', 'Owner', 'Updated At'],
      rows.map((item) => [
        item.referenceNo ?? '',
        item.activity,
        item.aspect,
        item.impact,
        item.lifecycleStage,
        item.significance,
        item.status,
        this.formatDate(item.reviewDate),
        userMap.get(item.ownerUserId ?? '') ?? '',
        this.formatDateTime(item.updatedAt)
      ])
    );
  }

  private async exportObligations(tenantId: string, query: ExportReportQueryDto) {
    const rows = await getComplianceObligationDelegate(this.prisma).findMany({
      where: {
        tenantId,
        deletedAt: null,
        status: query.status || undefined,
        ownerUserId: query.ownerId || undefined,
        nextReviewDate: this.buildDateRange(query)
      },
      orderBy: [{ nextReviewDate: 'asc' }, { updatedAt: 'desc' }]
    });
    const userMap = await this.loadUserMap(tenantId, rows.map((item) => item.ownerUserId));

    return this.toCsv(
      ['Reference', 'Title', 'Source', 'Type', 'Jurisdiction', 'Status', 'Review Frequency Months', 'Next Review Date', 'Owner', 'Updated At'],
      rows.map((item) => [
        item.referenceNo ?? '',
        item.title,
        item.sourceName,
        item.obligationType ?? '',
        item.jurisdiction ?? '',
        item.status,
        item.reviewFrequencyMonths ?? '',
        this.formatDate(item.nextReviewDate),
        userMap.get(item.ownerUserId ?? '') ?? '',
        this.formatDateTime(item.updatedAt)
      ])
    );
  }

  private async exportProviders(tenantId: string, query: ExportReportQueryDto) {
    const rows = await getExternalProviderControlDelegate(this.prisma).findMany({
      where: {
        tenantId,
        deletedAt: null,
        status: query.status || undefined,
        ownerUserId: query.ownerId || undefined,
        nextReviewDate: this.buildDateRange(query)
      },
      orderBy: [{ criticality: 'desc' }, { nextReviewDate: 'asc' }, { updatedAt: 'desc' }]
    });
    const userMap = await this.loadUserMap(tenantId, rows.map((item) => item.ownerUserId));

    return this.toCsv(
      ['Reference', 'Provider Name', 'Type', 'Criticality', 'Status', 'Evaluation Score', 'Evaluation Outcome', 'Supplier Audit Required', 'Next Review Date', 'Owner', 'Updated At'],
      rows.map((item) => [
        item.referenceNo ?? '',
        item.providerName,
        item.providerType,
        item.criticality,
        item.status,
        item.evaluationScore ?? '',
        item.evaluationOutcome ?? '',
        item.providerType === 'SUPPLIER' && item.criticality === 'HIGH' ? 'Yes' : 'No',
        this.formatDate(item.nextReviewDate),
        userMap.get(item.ownerUserId ?? '') ?? '',
        this.formatDateTime(item.updatedAt)
      ])
    );
  }

  private async exportChanges(tenantId: string, query: ExportReportQueryDto) {
    const rows = await getChangeRequestDelegate(this.prisma).findMany({
      where: {
        tenantId,
        deletedAt: null,
        status: query.status || undefined,
        ownerUserId: query.ownerId || undefined,
        targetImplementationDate: this.buildDateRange(query)
      },
      orderBy: [{ targetImplementationDate: 'asc' }, { updatedAt: 'desc' }]
    });
    const userMap = await this.loadUserMap(tenantId, rows.map((item) => item.ownerUserId));

    return this.toCsv(
      ['Reference', 'Title', 'Type', 'Affected Area', 'Status', 'Target Implementation Date', 'Review Date', 'Owner', 'Updated At'],
      rows.map((item) => [
        item.referenceNo ?? '',
        item.title,
        item.changeType,
        item.affectedArea,
        item.status,
        this.formatDate(item.targetImplementationDate),
        this.formatDate(item.reviewDate),
        userMap.get(item.ownerUserId ?? '') ?? '',
        this.formatDateTime(item.updatedAt)
      ])
    );
  }

  private async loadUserMap(tenantId: string, ownerIds: Array<string | null | undefined>) {
    const ids = [...new Set(ownerIds.filter(Boolean))] as string[];
    if (!ids.length) {
      return new Map<string, string>();
    }
    const users = await this.prisma.user.findMany({
      where: { tenantId, id: { in: ids } },
      select: { id: true, firstName: true, lastName: true }
    });
    return new Map(users.map((user) => [user.id, `${user.firstName} ${user.lastName}`.trim()]));
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

  private countFilledValues(values: Array<string | null | undefined>) {
    return values.filter((value) => !!String(value ?? '').trim()).length;
  }
}
