import { Injectable } from '@nestjs/common';
import { ActionItemStatus, CapaStatus, DocumentStatus, RiskStatus } from '@prisma/client';
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
      overdueActions,
      openActions
    ] = await Promise.all([
      this.prisma.document.count({ where: { tenantId } }),
      this.prisma.document.count({ where: { tenantId, status: DocumentStatus.APPROVED } }),
      this.prisma.risk.count({ where: { tenantId } }),
      this.prisma.risk.count({ where: { tenantId, score: { gte: 15 }, status: { not: RiskStatus.CLOSED } } }),
      this.prisma.capa.count({ where: { tenantId } }),
      this.prisma.capa.count({ where: { tenantId, status: { not: CapaStatus.CLOSED } } }),
      this.prisma.actionItem.count({
        where: {
          tenantId,
          dueDate: { lt: today },
          status: { in: [ActionItemStatus.OPEN, ActionItemStatus.IN_PROGRESS] }
        }
      }),
      this.prisma.actionItem.count({
        where: { tenantId, status: { in: [ActionItemStatus.OPEN, ActionItemStatus.IN_PROGRESS] } }
      })
    ]);

    const [highRisks, recentDocuments, recentCapas, actionItems] = await Promise.all([
      this.prisma.risk.findMany({
        where: { tenantId, status: { not: RiskStatus.CLOSED } },
        take: 6,
        orderBy: [{ score: 'desc' }, { updatedAt: 'desc' }]
      }),
      this.prisma.document.findMany({
        where: { tenantId },
        orderBy: { updatedAt: 'desc' },
        take: 6
      }),
      this.prisma.capa.findMany({
        where: { tenantId },
        orderBy: { updatedAt: 'desc' },
        take: 6
      }),
      this.prisma.actionItem.findMany({
        where: { tenantId, status: { in: [ActionItemStatus.OPEN, ActionItemStatus.IN_PROGRESS] } },
        include: {
          owner: {
            select: {
              firstName: true,
              lastName: true
            }
          }
        },
        orderBy: [{ dueDate: 'asc' }, { createdAt: 'desc' }],
        take: 8
      })
    ]);

    return {
      metrics: {
        documents,
        approvedDocuments,
        risks,
        highRiskCount,
        capas,
        openCapas,
        openActions,
        overdueActions
      },
      riskSummary: {
        open: await this.prisma.risk.count({ where: { tenantId, status: RiskStatus.OPEN } }),
        inTreatment: await this.prisma.risk.count({
          where: { tenantId, status: RiskStatus.IN_TREATMENT }
        }),
        mitigated: await this.prisma.risk.count({ where: { tenantId, status: RiskStatus.MITIGATED } })
      },
      capaSummary: {
        investigating: await this.prisma.capa.count({
          where: { tenantId, status: CapaStatus.INVESTIGATING }
        }),
        inProgress: await this.prisma.capa.count({
          where: { tenantId, status: CapaStatus.IN_PROGRESS }
        }),
        verified: await this.prisma.capa.count({ where: { tenantId, status: CapaStatus.VERIFIED } })
      },
      highRisks,
      recentDocuments,
      recentCapas,
      actionItems
    };
  }
}
