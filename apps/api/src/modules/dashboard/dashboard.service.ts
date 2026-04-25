import {
  ActionItemStatus,
  AuditStatus,
  CapaStatus,
  DocumentStatus,
  KpiDirection,
  RiskStatus,
  TrainingAssignmentStatus
} from '@prisma/client';
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';

@Injectable()
export class DashboardService {
  constructor(private readonly prisma: PrismaService) {}

  async summary(tenantId: string) {
    const today = new Date();

    const [
      documents,
      approvedDocuments,
      risks,
      highRiskCount,
      capas,
      openCapas,
      audits,
      openAudits,
      managementReviews,
      trainings,
      openActions,
      overdueActions,
      trainingAssignments,
      overdueTrainingAssignments,
      customerSurveyRequests
    ] = await Promise.all([
      this.prisma.document.count({ where: { tenantId, deletedAt: null } }),
      this.prisma.document.count({ where: { tenantId, deletedAt: null, status: DocumentStatus.APPROVED } }),
      this.prisma.risk.count({ where: { tenantId, deletedAt: null } }),
      this.prisma.risk.count({ where: { tenantId, deletedAt: null, score: { gte: 15 }, status: { not: RiskStatus.CLOSED } } }),
      this.prisma.capa.count({ where: { tenantId, deletedAt: null } }),
      this.prisma.capa.count({ where: { tenantId, deletedAt: null, status: { not: CapaStatus.CLOSED } } }),
      this.prisma.audit.count({ where: { tenantId, deletedAt: null } }),
      this.prisma.audit.count({ where: { tenantId, deletedAt: null, status: { not: AuditStatus.CLOSED } } }),
      this.prisma.managementReview.count({ where: { tenantId, deletedAt: null } }),
      this.prisma.training.count({ where: { tenantId } }),
      this.prisma.actionItem.count({
        where: { tenantId, deletedAt: null, status: { in: [ActionItemStatus.OPEN, ActionItemStatus.IN_PROGRESS] } }
      }),
      this.prisma.actionItem.count({
        where: {
          tenantId,
          deletedAt: null,
          dueDate: { lt: today },
          status: { in: [ActionItemStatus.OPEN, ActionItemStatus.IN_PROGRESS] }
        }
      }),
      this.prisma.trainingAssignment.count({ where: { tenantId } }),
      this.prisma.trainingAssignment.count({
        where: {
          tenantId,
          dueDate: { lt: today },
          status: { not: TrainingAssignmentStatus.COMPLETED }
        }
      }),
      this.prisma.customerSurveyRequest.findMany({
        where: { tenantId },
        select: {
          status: true,
          averageScore: true
        }
      })
    ]);

    const kpis = await this.prisma.kpi.findMany({
      where: { tenantId },
      orderBy: { updatedAt: 'desc' }
    });

    const kpiBreaches = kpis.filter((kpi) => this.getKpiStatus(kpi.actual, kpi.target, kpi.warningThreshold, kpi.direction) === 'BREACH').length;
    const kpiWatch = kpis.filter((kpi) => this.getKpiStatus(kpi.actual, kpi.target, kpi.warningThreshold, kpi.direction) === 'WATCH').length;
    const completedSurveyResponses = customerSurveyRequests.filter((item) => item.status === 'COMPLETED' && item.averageScore != null);
    const feedbackAverage = completedSurveyResponses.length
      ? Number(
          (
            completedSurveyResponses.reduce((sum, item) => sum + (item.averageScore ?? 0), 0) /
            completedSurveyResponses.length
          ).toFixed(2)
        )
      : null;
    const lowFeedbackCount = completedSurveyResponses.filter((item) => (item.averageScore ?? 0) <= 6).length;
    const mediumFeedbackCount = completedSurveyResponses.filter((item) => {
      const score = item.averageScore ?? 0;
      return score >= 7 && score <= 8;
    }).length;
    const highFeedbackCount = completedSurveyResponses.filter((item) => (item.averageScore ?? 0) >= 9).length;

    const [highRisks, recentDocuments, recentCapas, actionItems, recentAudits, kpiSummary, trainingSummary] =
      await Promise.all([
        this.prisma.risk.findMany({
          where: { tenantId, deletedAt: null, status: { not: RiskStatus.CLOSED } },
          take: 6,
          orderBy: [{ score: 'desc' }, { updatedAt: 'desc' }]
        }),
        this.prisma.document.findMany({
          where: { tenantId, deletedAt: null },
          orderBy: { updatedAt: 'desc' },
          take: 6
        }),
        this.prisma.capa.findMany({
          where: { tenantId, deletedAt: null },
          orderBy: { updatedAt: 'desc' },
          take: 6
        }),
        this.prisma.actionItem.findMany({
          where: { tenantId, deletedAt: null, status: { in: [ActionItemStatus.OPEN, ActionItemStatus.IN_PROGRESS] } },
          include: {
            owner: {
              select: { firstName: true, lastName: true }
            }
          },
          orderBy: [{ dueDate: 'asc' }, { createdAt: 'desc' }],
          take: 8
        }),
        this.prisma.audit.findMany({
          where: { tenantId, deletedAt: null },
          orderBy: [{ scheduledAt: 'asc' }, { updatedAt: 'desc' }],
          take: 5
        }),
        Promise.resolve(
          kpis.slice(0, 5).map((kpi) => ({
            id: kpi.id,
            name: kpi.name,
            actual: kpi.actual,
            target: kpi.target,
            unit: kpi.unit,
            status: this.getKpiStatus(kpi.actual, kpi.target, kpi.warningThreshold, kpi.direction)
          }))
        ),
        this.prisma.training.findMany({
          where: { tenantId },
          orderBy: { updatedAt: 'desc' },
          take: 5
        })
      ]);

    const riskDistribution = {
      low: await this.prisma.risk.count({
        where: {
          tenantId,
          deletedAt: null,
          status: { not: RiskStatus.CLOSED },
          score: { lt: 8 }
        }
      }),
      medium: await this.prisma.risk.count({
        where: {
          tenantId,
          deletedAt: null,
          status: { not: RiskStatus.CLOSED },
          score: { gte: 8, lt: 15 }
        }
      }),
      high: await this.prisma.risk.count({
        where: {
          tenantId,
          deletedAt: null,
          status: { not: RiskStatus.CLOSED },
          score: { gte: 15 }
        }
      })
    };

    return {
      metrics: {
        documents,
        approvedDocuments,
        risks,
        highRiskCount,
        capas,
        openCapas,
        audits,
        openAudits,
        managementReviews,
        trainings,
        kpiBreaches,
        openActions,
        overdueActions,
        trainingAssignments,
        overdueTrainingAssignments,
        customerSurveyResponses: completedSurveyResponses.length,
        customerSurveyOpen: customerSurveyRequests.filter((item) => item.status === 'OPEN').length
      },
      riskSummary: {
        open: await this.prisma.risk.count({ where: { tenantId, deletedAt: null, status: RiskStatus.OPEN } }),
        inTreatment: await this.prisma.risk.count({ where: { tenantId, deletedAt: null, status: RiskStatus.IN_TREATMENT } }),
        mitigated: await this.prisma.risk.count({ where: { tenantId, deletedAt: null, status: RiskStatus.MITIGATED } })
      },
      riskDistribution,
      capaSummary: {
        investigating: await this.prisma.capa.count({ where: { tenantId, deletedAt: null, status: CapaStatus.INVESTIGATING } }),
        inProgress: await this.prisma.capa.count({ where: { tenantId, deletedAt: null, status: CapaStatus.IN_PROGRESS } }),
        verified: await this.prisma.capa.count({ where: { tenantId, deletedAt: null, status: CapaStatus.VERIFIED } })
      },
      auditSummary: {
        planned: await this.prisma.audit.count({ where: { tenantId, deletedAt: null, status: AuditStatus.PLANNED } }),
        inProgress: await this.prisma.audit.count({ where: { tenantId, deletedAt: null, status: AuditStatus.IN_PROGRESS } }),
        completed: await this.prisma.audit.count({ where: { tenantId, deletedAt: null, status: AuditStatus.COMPLETED } })
      },
      kpiSummaryCounts: {
        watch: kpiWatch,
        breach: kpiBreaches
      },
      trainingSummaryCounts: {
        assigned: await this.prisma.trainingAssignment.count({
          where: { tenantId, status: TrainingAssignmentStatus.ASSIGNED }
        }),
        inProgress: await this.prisma.trainingAssignment.count({
          where: { tenantId, status: TrainingAssignmentStatus.IN_PROGRESS }
        }),
        completed: await this.prisma.trainingAssignment.count({
          where: { tenantId, status: TrainingAssignmentStatus.COMPLETED }
        })
      },
      feedbackSummary: {
        responseCount: completedSurveyResponses.length,
        openRequestCount: customerSurveyRequests.filter((item) => item.status === 'OPEN').length,
        averageScore: feedbackAverage,
        lowScoreCount: lowFeedbackCount,
        mediumScoreCount: mediumFeedbackCount,
        highScoreCount: highFeedbackCount,
        health:
          feedbackAverage == null
            ? 'NO_DATA'
            : lowFeedbackCount > 0 || feedbackAverage < 7
              ? 'ATTENTION'
              : feedbackAverage < 9
                ? 'WATCH'
                : 'STRONG'
      },
      highRisks,
      recentDocuments,
      recentCapas,
      recentAudits,
      kpiSummary,
      trainingSummary,
      actionItems
    };
  }

  private getKpiStatus(
    actual: number,
    target: number,
    warningThreshold: number | null,
    direction: KpiDirection
  ) {
    if (direction === KpiDirection.AT_LEAST) {
      if (actual >= target) return 'ON_TARGET';
      if (warningThreshold !== null && actual >= warningThreshold) return 'WATCH';
      return 'BREACH';
    }

    if (actual <= target) return 'ON_TARGET';
    if (warningThreshold !== null && actual <= warningThreshold) return 'WATCH';
    return 'BREACH';
  }
}
