import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';

@Injectable()
export class AuditLogsService {
  constructor(private readonly prisma: PrismaService) {}

  create(entry: {
    tenantId: string;
    actorId?: string;
    action: string;
    entityType: string;
    entityId: string;
    metadata?: unknown;
  }) {
    return this.prisma.auditLog.create({
      data: {
        tenantId: entry.tenantId,
        actorId: entry.actorId,
        action: entry.action,
        entityType: entry.entityType,
        entityId: entry.entityId,
        metadata: entry.metadata as object | undefined
      }
    });
  }

  list(tenantId: string, filters?: { entityType?: string; entityId?: string }) {
    return this.prisma.auditLog.findMany({
      where: {
        tenantId,
        entityType: filters?.entityType,
        entityId: filters?.entityId
      },
      include: {
        actor: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true
          }
        }
      },
      orderBy: { createdAt: 'desc' },
      take: 100
    });
  }
}
