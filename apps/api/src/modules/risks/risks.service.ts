import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Risk, RiskStatus } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';
import { AuditLogsService } from '../audit-logs/audit-logs.service';
import { CreateRiskDto } from './dto/create-risk.dto';
import { UpdateRiskDto } from './dto/update-risk.dto';

const RISK_STATUS_FLOW: Record<RiskStatus, RiskStatus[]> = {
  [RiskStatus.OPEN]: [RiskStatus.IN_TREATMENT, RiskStatus.ACCEPTED, RiskStatus.CLOSED],
  [RiskStatus.IN_TREATMENT]: [RiskStatus.MITIGATED, RiskStatus.ACCEPTED, RiskStatus.CLOSED],
  [RiskStatus.MITIGATED]: [RiskStatus.CLOSED, RiskStatus.IN_TREATMENT],
  [RiskStatus.ACCEPTED]: [RiskStatus.CLOSED, RiskStatus.IN_TREATMENT],
  [RiskStatus.CLOSED]: []
};

@Injectable()
export class RisksService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLogsService: AuditLogsService
  ) {}

  list(tenantId: string) {
    return this.prisma.risk.findMany({
      where: { tenantId },
      orderBy: [{ score: 'desc' }, { updatedAt: 'desc' }]
    });
  }

  get(tenantId: string, id: string) {
    return this.prisma.risk.findFirstOrThrow({
      where: { tenantId, id }
    });
  }

  async create(tenantId: string, actorId: string, dto: CreateRiskDto) {
    await this.ensureOwnerBelongsToTenant(tenantId, dto.ownerId);
    await this.assertScaleBounds(tenantId, dto.likelihood, dto.severity);

    const risk = await this.prisma.risk.create({
      data: {
        tenantId,
        title: dto.title.trim(),
        description: this.normalizeText(dto.description),
        category: this.normalizeText(dto.category),
        likelihood: dto.likelihood,
        severity: dto.severity,
        score: dto.likelihood * dto.severity,
        treatmentPlan: this.normalizeText(dto.treatmentPlan),
        treatmentSummary: this.normalizeText(dto.treatmentSummary),
        ownerId: dto.ownerId || null,
        targetDate: dto.targetDate ? new Date(dto.targetDate) : null,
        status: dto.status ?? RiskStatus.OPEN
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
    const existing = await this.prisma.risk.findFirst({
      where: { id, tenantId }
    });

    if (!existing) {
      throw new NotFoundException('Risk not found');
    }

    await this.ensureOwnerBelongsToTenant(tenantId, dto.ownerId);

    const nextStatus = dto.status ?? existing.status;
    this.assertValidStatusTransition(existing.status, nextStatus);
    await this.assertScaleBounds(tenantId, dto.likelihood ?? existing.likelihood, dto.severity ?? existing.severity);

    const risk = await this.prisma.risk.update({
      where: { id },
      data: this.toUpdateRiskData(dto, existing)
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

  private toUpdateRiskData(dto: UpdateRiskDto, existing: Risk) {
    const likelihood = dto.likelihood ?? existing?.likelihood;
    const severity = dto.severity ?? existing?.severity;

    if (!likelihood || !severity) {
      throw new BadRequestException('Likelihood and severity are required');
    }

    return {
      title: dto.title?.trim(),
      description: dto.description !== undefined ? this.normalizeText(dto.description) : undefined,
      category: dto.category !== undefined ? this.normalizeText(dto.category) : undefined,
      likelihood,
      severity,
      score: likelihood * severity,
      treatmentPlan:
        dto.treatmentPlan !== undefined ? this.normalizeText(dto.treatmentPlan) : undefined,
      treatmentSummary:
        dto.treatmentSummary !== undefined ? this.normalizeText(dto.treatmentSummary) : undefined,
      ownerId: dto.ownerId !== undefined ? dto.ownerId || null : undefined,
      targetDate:
        dto.targetDate !== undefined ? (dto.targetDate ? new Date(dto.targetDate) : null) : undefined,
      status: dto.status ?? existing?.status ?? RiskStatus.OPEN
    };
  }

  private async ensureOwnerBelongsToTenant(tenantId: string, ownerId?: string) {
    if (!ownerId) {
      return;
    }

    const owner = await this.prisma.user.findFirst({
      where: { id: ownerId, tenantId, isActive: true },
      select: { id: true }
    });

    if (!owner) {
      throw new BadRequestException('Selected owner is not active in this tenant');
    }
  }

  private assertValidStatusTransition(current: RiskStatus, next: RiskStatus) {
    if (current === next) {
      return;
    }

    if (!RISK_STATUS_FLOW[current].includes(next)) {
      throw new BadRequestException(`Invalid risk status transition: ${current} -> ${next}`);
    }
  }

  private async assertScaleBounds(tenantId: string, likelihood: number, severity: number) {
    const settings = await this.prisma.tenantSetting.findMany({
      where: {
        tenantId,
        key: { in: ['risk.likelihoodScale', 'risk.severityScale'] }
      }
    });
    const map = new Map(settings.map((item) => [item.key, item.value]));
    const likelihoodMax = Number(map.get('risk.likelihoodScale') ?? 5);
    const severityMax = Number(map.get('risk.severityScale') ?? 5);

    if (likelihood < 1 || likelihood > likelihoodMax || severity < 1 || severity > severityMax) {
      throw new BadRequestException(
        `Likelihood must be between 1 and ${likelihoodMax}, and severity must be between 1 and ${severityMax}`
      );
    }
  }

  private normalizeText(value?: string) {
    const trimmed = value?.trim();
    return trimmed ? trimmed : null;
  }
}
