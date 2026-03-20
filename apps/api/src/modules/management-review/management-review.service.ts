import {
  BadRequestException,
  Injectable,
  NotFoundException
} from '@nestjs/common';
import { ManagementReviewStatus } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';
import { AuditLogsService } from '../audit-logs/audit-logs.service';
import {
  CreateManagementReviewDto,
  ManagementReviewInputDto
} from './dto/create-management-review.dto';
import { UpdateManagementReviewDto } from './dto/update-management-review.dto';

const REVIEW_STATUS_FLOW: Record<ManagementReviewStatus, ManagementReviewStatus[]> = {
  [ManagementReviewStatus.PLANNED]: [ManagementReviewStatus.HELD, ManagementReviewStatus.CLOSED],
  [ManagementReviewStatus.HELD]: [ManagementReviewStatus.CLOSED],
  [ManagementReviewStatus.CLOSED]: []
};

@Injectable()
export class ManagementReviewService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLogsService: AuditLogsService
  ) {}

  async list(tenantId: string) {
    const reviews = await this.prisma.managementReview.findMany({
      where: { tenantId, deletedAt: null },
      include: {
        inputs: true
      },
      orderBy: [{ reviewDate: 'desc' }, { updatedAt: 'desc' }]
    });

    return reviews.map((review) => ({
      ...review,
      inputCount: review.inputs.length
    }));
  }

  get(tenantId: string, id: string) {
    return this.prisma.managementReview.findFirstOrThrow({
      where: { tenantId, id, deletedAt: null },
      include: {
        inputs: {
          orderBy: { createdAt: 'asc' }
        }
      }
    });
  }

  async create(tenantId: string, actorId: string, dto: CreateManagementReviewDto) {
    await this.ensureUserBelongsToTenant(tenantId, dto.chairpersonId);
    await this.assertReviewReadyForStatus(dto.status, dto);
    const resolvedInputs = await this.resolveInputs(tenantId, dto.inputs ?? []);

    const review = await this.prisma.managementReview.create({
      data: {
        tenantId,
        title: dto.title.trim(),
        reviewDate: dto.reviewDate ? new Date(dto.reviewDate) : null,
        chairpersonId: dto.chairpersonId || null,
        agenda: this.normalizeText(dto.agenda),
        auditResults: this.normalizeText(dto.auditResults),
        capaStatus: this.normalizeText(dto.capaStatus),
        kpiPerformance: this.normalizeText(dto.kpiPerformance),
        risksOpportunities: this.normalizeText(dto.risksOpportunities),
        changesAffectingSystem: this.normalizeText(dto.changesAffectingSystem),
        previousActions: this.normalizeText(dto.previousActions),
        minutes: this.normalizeText(dto.minutes),
        decisions: this.normalizeText(dto.decisions),
        improvementActions: this.normalizeText(dto.improvementActions),
        resourceNeeds: this.normalizeText(dto.resourceNeeds),
        summary: this.normalizeText(dto.summary),
        status: dto.status ?? ManagementReviewStatus.PLANNED,
        inputs: {
          create: resolvedInputs.map((input) => ({
            tenantId,
            sourceType: input.sourceType,
            sourceId: input.sourceId,
            title: input.title,
            summary: input.summary
          }))
        }
      } as never,
      include: { inputs: true }
    });

    await this.auditLogsService.create({
      tenantId,
      actorId,
      action: 'management-review.created',
      entityType: 'management-review',
      entityId: review.id,
      metadata: dto
    });

    return review;
  }

  async update(tenantId: string, actorId: string, id: string, dto: UpdateManagementReviewDto) {
    const existing = await this.prisma.managementReview.findFirst({
      where: { tenantId, id, deletedAt: null },
      include: { inputs: true }
    });

    if (!existing) {
      throw new NotFoundException('Management review not found');
    }

    await this.ensureUserBelongsToTenant(tenantId, dto.chairpersonId);
    this.assertValidStatusTransition(existing.status, dto.status ?? existing.status);
    await this.assertReviewReadyForStatus(dto.status ?? existing.status, {
      ...existing,
      ...dto
    });

    const resolvedInputs =
      dto.inputs !== undefined ? await this.resolveInputs(tenantId, dto.inputs) : undefined;

    const review = await this.prisma.managementReview.update({
      where: { id },
      data: {
        title: dto.title?.trim(),
        reviewDate:
          dto.reviewDate !== undefined ? (dto.reviewDate ? new Date(dto.reviewDate) : null) : undefined,
        chairpersonId: dto.chairpersonId !== undefined ? dto.chairpersonId || null : undefined,
        agenda: dto.agenda !== undefined ? this.normalizeText(dto.agenda) : undefined,
        auditResults: dto.auditResults !== undefined ? this.normalizeText(dto.auditResults) : undefined,
        capaStatus: dto.capaStatus !== undefined ? this.normalizeText(dto.capaStatus) : undefined,
        kpiPerformance: dto.kpiPerformance !== undefined ? this.normalizeText(dto.kpiPerformance) : undefined,
        risksOpportunities:
          dto.risksOpportunities !== undefined ? this.normalizeText(dto.risksOpportunities) : undefined,
        changesAffectingSystem:
          dto.changesAffectingSystem !== undefined ? this.normalizeText(dto.changesAffectingSystem) : undefined,
        previousActions:
          dto.previousActions !== undefined ? this.normalizeText(dto.previousActions) : undefined,
        minutes: dto.minutes !== undefined ? this.normalizeText(dto.minutes) : undefined,
        decisions: dto.decisions !== undefined ? this.normalizeText(dto.decisions) : undefined,
        improvementActions:
          dto.improvementActions !== undefined ? this.normalizeText(dto.improvementActions) : undefined,
        resourceNeeds:
          dto.resourceNeeds !== undefined ? this.normalizeText(dto.resourceNeeds) : undefined,
        summary: dto.summary !== undefined ? this.normalizeText(dto.summary) : undefined,
        status: dto.status,
        inputs:
          resolvedInputs !== undefined
            ? {
                deleteMany: {},
                create: resolvedInputs.map((input) => ({
                  tenantId,
                  sourceType: input.sourceType,
                  sourceId: input.sourceId,
                  title: input.title,
                  summary: input.summary
                  }))
              }
            : undefined
      } as never,
      include: { inputs: true }
    });

    await this.auditLogsService.create({
      tenantId,
      actorId,
      action: 'management-review.updated',
      entityType: 'management-review',
      entityId: review.id,
      metadata: dto
    });

    return review;
  }

  async archive(tenantId: string, actorId: string, id: string) {
    const existing = await this.prisma.managementReview.findFirst({
      where: { tenantId, id, deletedAt: null }
    });

    if (!existing) {
      throw new NotFoundException('Management review not found');
    }

    await this.prisma.managementReview.update({
      where: { id },
      data: {
        deletedAt: new Date(),
        deletedById: actorId
      }
    });

    await this.auditLogsService.create({
      tenantId,
      actorId,
      action: 'management-review.archived',
      entityType: 'management-review',
      entityId: id,
      metadata: { status: existing.status }
    });

    return { success: true };
  }

  private async resolveInputs(tenantId: string, inputs: ManagementReviewInputDto[]) {
    const resolved = await Promise.all(inputs.map((input) => this.resolveInput(tenantId, input)));
    return resolved;
  }

  private async resolveInput(tenantId: string, input: ManagementReviewInputDto) {
    const sourceType = input.sourceType.trim().toLowerCase();

    if (sourceType === 'risk') {
      const risk = await this.prisma.risk.findFirst({
        where: { tenantId, id: input.sourceId, deletedAt: null }
      });
      if (!risk) throw new NotFoundException('Referenced risk not found');
      return {
        sourceType,
        sourceId: risk.id,
        title: risk.title,
        summary: `Score ${risk.score} | ${risk.status}`
      };
    }

    if (sourceType === 'capa') {
      const capa = await this.prisma.capa.findFirst({
        where: { tenantId, id: input.sourceId, deletedAt: null }
      });
      if (!capa) throw new NotFoundException('Referenced CAPA not found');
      return {
        sourceType,
        sourceId: capa.id,
        title: capa.title,
        summary: capa.status
      };
    }

    if (sourceType === 'audit') {
      const audit = await this.prisma.audit.findFirst({
        where: { tenantId, id: input.sourceId, deletedAt: null }
      });
      if (!audit) throw new NotFoundException('Referenced audit not found');
      return {
        sourceType,
        sourceId: audit.id,
        title: audit.title,
        summary: audit.status
      };
    }

    if (sourceType === 'kpi') {
      const kpi = await this.prisma.kpi.findFirst({
        where: { tenantId, id: input.sourceId }
      });
      if (!kpi) throw new NotFoundException('Referenced KPI not found');
      return {
        sourceType,
        sourceId: kpi.id,
        title: kpi.name,
        summary: `${kpi.actual}${kpi.unit} vs target ${kpi.target}${kpi.unit}`
      };
    }

    throw new BadRequestException(`Unsupported management review input source: ${input.sourceType}`);
  }

  private async ensureUserBelongsToTenant(tenantId: string, userId?: string | null) {
    if (!userId) {
      return;
    }

    const user = await this.prisma.user.findFirst({
      where: { tenantId, id: userId, isActive: true },
      select: { id: true }
    });

    if (!user) {
      throw new BadRequestException('Selected chairperson is not active in this tenant');
    }
  }

  private assertValidStatusTransition(
    current: ManagementReviewStatus,
    next: ManagementReviewStatus
  ) {
    if (current === next) {
      return;
    }

    if (!REVIEW_STATUS_FLOW[current].includes(next)) {
      throw new BadRequestException(
        `Invalid management review status transition: ${current} -> ${next}`
      );
    }
  }

  private async assertReviewReadyForStatus(
    status: ManagementReviewStatus | undefined,
    data: {
      minutes?: string | null;
      decisions?: string | null;
      auditResults?: string | null;
      capaStatus?: string | null;
      kpiPerformance?: string | null;
      risksOpportunities?: string | null;
      changesAffectingSystem?: string | null;
      previousActions?: string | null;
      improvementActions?: string | null;
      resourceNeeds?: string | null;
      inputs?: ManagementReviewInputDto[] | unknown[];
    }
  ) {
    if (!status || status === ManagementReviewStatus.PLANNED) {
      return;
    }

    if (!data.minutes || !data.decisions) {
      throw new BadRequestException('Minutes and decisions are required once the meeting is held');
    }

    if (!data.inputs || data.inputs.length === 0) {
      throw new BadRequestException('At least one input is required for a management review');
    }

    if (!data.auditResults || !data.capaStatus || !data.kpiPerformance || !data.risksOpportunities) {
      throw new BadRequestException('Core management review input sections must be completed before holding the meeting');
    }
  }

  private normalizeText(value?: string | null) {
    const trimmed = value?.trim();
    return trimmed ? trimmed : null;
  }
}
