import { Injectable } from '@nestjs/common';
import { ActionItemStatus } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';

@Injectable()
export class DashboardService {
  constructor(private readonly prisma: PrismaService) {}

  async summary(tenantId: string) {
    const [documents, risks, capas, audits, trainings, openActions] = await Promise.all([
      this.prisma.document.count({ where: { tenantId } }),
      this.prisma.risk.count({ where: { tenantId } }),
      this.prisma.capa.count({ where: { tenantId } }),
      this.prisma.audit.count({ where: { tenantId } }),
      this.prisma.training.count({ where: { tenantId } }),
      this.prisma.actionItem.count({ where: { tenantId, status: ActionItemStatus.OPEN } })
    ]);

    const highRisks = await this.prisma.risk.findMany({
      where: { tenantId, score: { gte: 15 } },
      take: 5,
      orderBy: { score: 'desc' }
    });

    const [recentDocuments, recentCapas, actionItems] = await Promise.all([
      this.prisma.document.findMany({
        where: { tenantId },
        orderBy: { updatedAt: 'desc' },
        take: 5
      }),
      this.prisma.capa.findMany({
        where: { tenantId },
        orderBy: { updatedAt: 'desc' },
        take: 5
      }),
      this.prisma.actionItem.findMany({
        where: { tenantId, status: { in: ['OPEN', 'IN_PROGRESS'] } },
        orderBy: [{ dueDate: 'asc' }, { createdAt: 'desc' }],
        take: 8
      })
    ]);

    return {
      metrics: { documents, risks, capas, audits, trainings, openActions },
      highRisks,
      recentDocuments,
      recentCapas,
      actionItems
    };
  }
}
