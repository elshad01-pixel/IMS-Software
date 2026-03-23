import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { RiskStatus } from '@prisma/client';
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
      where: { tenantId, deletedAt: null },
      orderBy: [{ score: 'desc' }, { updatedAt: 'desc' }]
    });
  }

  get(tenantId: string, id: string) {
    return this.prisma.risk.findFirstOrThrow({
      where: { tenantId, id, deletedAt: null }
    });
  }

  async create(tenantId: string, actorId: string, dto: CreateRiskDto) {
    await this.ensureOwnerBelongsToTenant(tenantId, dto.ownerId);
    await this.assertScaleBounds(tenantId, dto.likelihood, dto.severity);
    await this.assertResidualScaleBounds(tenantId, dto.residualLikelihood, dto.residualImpact);

    const risk = await this.prisma.risk.create({
      data: {
        tenantId,
        title: dto.title.trim(),
        description: this.normalizeText(dto.description),
        category: this.normalizeText(dto.category),
        likelihood: dto.likelihood,
        severity: dto.severity,
        score: dto.likelihood * dto.severity,
        existingControls: this.normalizeText(dto.existingControls) ?? this.normalizeText(dto.treatmentSummary),
        plannedMitigationActions: this.normalizeText(dto.plannedMitigationActions) ?? this.normalizeText(dto.treatmentPlan),
        residualLikelihood: dto.residualLikelihood ?? null,
        residualImpact: dto.residualImpact ?? null,
        residualScore: this.calculateResidualScore(dto.residualLikelihood, dto.residualImpact),
        issueContextType: dto.issueContextType ?? null,
        issueContext: this.normalizeText(dto.issueContext),
        treatmentPlan: this.normalizeText(dto.treatmentPlan) ?? this.normalizeText(dto.plannedMitigationActions),
        treatmentSummary: this.normalizeText(dto.treatmentSummary) ?? this.normalizeText(dto.existingControls),
        ownerId: dto.ownerId || null,
        targetDate: dto.targetDate ? new Date(dto.targetDate) : null,
        status: dto.status ?? RiskStatus.OPEN
      } as any
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
      where: { id, tenantId, deletedAt: null }
    });

    if (!existing) {
      throw new NotFoundException('Risk not found');
    }

    await this.ensureOwnerBelongsToTenant(tenantId, dto.ownerId);

    const nextStatus = dto.status ?? existing.status;
    this.assertValidStatusTransition(existing.status, nextStatus);
    await this.assertScaleBounds(tenantId, dto.likelihood ?? existing.likelihood, dto.severity ?? existing.severity);
    await this.assertResidualScaleBounds(
      tenantId,
      dto.residualLikelihood ?? (existing as any).residualLikelihood ?? undefined,
      dto.residualImpact ?? (existing as any).residualImpact ?? undefined
    );

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

  async remove(tenantId: string, actorId: string, id: string) {
    const existing = await this.prisma.risk.findFirst({
      where: { id, tenantId, deletedAt: null }
    });

    if (!existing) {
      throw new NotFoundException('Risk not found');
    }

    await this.prisma.risk.update({
      where: { id },
      data: {
        deletedAt: new Date(),
        deletedById: actorId
      }
    });

    await this.auditLogsService.create({
      tenantId,
      actorId,
      action: 'risk.deleted',
      entityType: 'risk',
      entityId: id,
      metadata: { status: existing.status, score: existing.score }
    });

    return { success: true };
  }

  private toUpdateRiskData(dto: UpdateRiskDto, existing: any) {
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
      existingControls:
        dto.existingControls !== undefined
          ? this.normalizeText(dto.existingControls)
          : undefined,
      plannedMitigationActions:
        dto.plannedMitigationActions !== undefined
          ? this.normalizeText(dto.plannedMitigationActions)
          : undefined,
      residualLikelihood:
        dto.residualLikelihood !== undefined ? dto.residualLikelihood ?? null : undefined,
      residualImpact:
        dto.residualImpact !== undefined ? dto.residualImpact ?? null : undefined,
      residualScore:
        dto.residualLikelihood !== undefined || dto.residualImpact !== undefined
          ? this.calculateResidualScore(
              dto.residualLikelihood ?? existing.residualLikelihood ?? undefined,
              dto.residualImpact ?? existing.residualImpact ?? undefined
            )
          : undefined,
      issueContextType:
        dto.issueContextType !== undefined ? dto.issueContextType ?? null : undefined,
      issueContext:
        dto.issueContext !== undefined ? this.normalizeText(dto.issueContext) : undefined,
      treatmentPlan:
        dto.treatmentPlan !== undefined
          ? this.normalizeText(dto.treatmentPlan)
          : dto.plannedMitigationActions !== undefined
            ? this.normalizeText(dto.plannedMitigationActions)
            : undefined,
      treatmentSummary:
        dto.treatmentSummary !== undefined
          ? this.normalizeText(dto.treatmentSummary)
          : dto.existingControls !== undefined
            ? this.normalizeText(dto.existingControls)
            : undefined,
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

  private async assertResidualScaleBounds(
    tenantId: string,
    residualLikelihood?: number,
    residualImpact?: number
  ) {
    if (residualLikelihood === undefined && residualImpact === undefined) {
      return;
    }

    if (!residualLikelihood || !residualImpact) {
      throw new BadRequestException('Residual likelihood and residual impact must both be provided');
    }

    await this.assertScaleBounds(tenantId, residualLikelihood, residualImpact);
  }

  private calculateResidualScore(residualLikelihood?: number | null, residualImpact?: number | null) {
    if (!residualLikelihood || !residualImpact) {
      return null;
    }

    return residualLikelihood * residualImpact;
  }

  private normalizeText(value?: string) {
    const trimmed = value?.trim();
    return trimmed ? trimmed : null;
  }
}
