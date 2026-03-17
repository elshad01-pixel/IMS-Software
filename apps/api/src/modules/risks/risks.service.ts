import { Injectable } from '@nestjs/common';
import { RiskStatus } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';
import { AuditLogsService } from '../audit-logs/audit-logs.service';
import { CreateRiskDto } from './dto/create-risk.dto';
import { UpdateRiskDto } from './dto/update-risk.dto';

@Injectable()
export class RisksService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLogsService: AuditLogsService
  ) {}

  list(tenantId: string) {
    return this.prisma.risk.findMany({
      where: { tenantId },
      orderBy: { updatedAt: 'desc' }
    });
  }

  async create(tenantId: string, actorId: string, dto: CreateRiskDto) {
    const risk = await this.prisma.risk.create({
      data: {
        tenantId,
        title: dto.title,
        description: dto.description,
        likelihood: dto.likelihood,
        impact: dto.impact,
        score: dto.likelihood * dto.impact,
        mitigationPlan: dto.mitigationPlan,
        ownerId: dto.ownerId,
        status: (dto.status as RiskStatus | undefined) || RiskStatus.OPEN
      }
    });

    await this.auditLogsService.create({
      tenantId,
      actorId,
      action: 'risk.created',
      entityType: 'risk',
      entityId: risk.id,
      metadata: dto
    });

    return risk;
  }

  async update(tenantId: string, actorId: string, id: string, dto: UpdateRiskDto) {
    const existing = await this.prisma.risk.findFirstOrThrow({
      where: { id, tenantId }
    });

    const risk = await this.prisma.risk.update({
      where: { id },
      data: {
        ...dto,
        score:
          dto.likelihood || dto.impact
            ? (dto.likelihood ?? existing.likelihood) * (dto.impact ?? existing.impact)
            : undefined,
        status: dto.status as RiskStatus | undefined
      }
    });

    await this.auditLogsService.create({
      tenantId,
      actorId,
      action: 'risk.updated',
      entityType: 'risk',
      entityId: risk.id,
      metadata: dto
    });

    return risk;
  }
}
