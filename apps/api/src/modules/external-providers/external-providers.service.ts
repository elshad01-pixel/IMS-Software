import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import {
  getExternalProviderControlDelegate,
  getExternalProviderLinkDelegate
} from '../../common/prisma/prisma-delegate-compat';
import { PrismaService } from '../../common/prisma/prisma.service';
import { AuditLogsService } from '../audit-logs/audit-logs.service';
import {
  CreateExternalProviderDto,
  ExternalProviderCriticalityValue,
  ExternalProviderEvaluationOutcomeValue,
  ExternalProviderStatusValue,
  ExternalProviderTypeValue
} from './dto/create-external-provider.dto';
import {
  CreateExternalProviderLinkDto,
  ExternalProviderLinkTypeValue
} from './dto/create-external-provider-link.dto';
import { UpdateExternalProviderDto } from './dto/update-external-provider.dto';

type ProviderRecord = {
  id: string;
  tenantId: string;
  referenceNo: string | null;
  providerName: string;
  providerType: ExternalProviderTypeValue;
  suppliedScope: string;
  approvalBasis: string | null;
  criticality: ExternalProviderCriticalityValue;
  ownerUserId: string | null;
  evaluationDate: Date | null;
  qualityScore: number | null;
  deliveryScore: number | null;
  responsivenessScore: number | null;
  complianceScore: number | null;
  traceabilityScore: number | null;
  changeControlScore: number | null;
  evaluationScore: number | null;
  evaluationOutcome: ExternalProviderEvaluationOutcomeValue | null;
  evaluationSummary: string | null;
  nextReviewDate: Date | null;
  status: ExternalProviderStatusValue;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
  deletedById: string | null;
};

type ProviderLinkRecord = {
  id: string;
  tenantId: string;
  providerId: string;
  linkType: ExternalProviderLinkTypeValue;
  linkedId: string;
  note: string | null;
  createdAt: Date;
  createdById: string | null;
};

type UserSummary = { id: string; firstName: string; lastName: string; email: string };

type ProviderLinkSummary = {
  id: string;
  linkType: ExternalProviderLinkTypeValue;
  linkedId: string;
  note: string | null;
  createdAt: Date;
  path: string | null;
  title: string;
  subtitle: string | null;
  status: string | null;
  missing: boolean;
};

type ProviderEvaluationScores = {
  qualityScore: number | null;
  deliveryScore: number | null;
  responsivenessScore: number | null;
  complianceScore: number | null;
  traceabilityScore: number | null;
  changeControlScore: number | null;
};

type ProviderAuditCoverage = {
  supplierAuditRequired: boolean;
  supplierAuditLinked: boolean;
};

const PROVIDER_STATUS = {
  APPROVED: 'APPROVED' as ExternalProviderStatusValue,
  CONDITIONAL: 'CONDITIONAL' as ExternalProviderStatusValue,
  UNDER_REVIEW: 'UNDER_REVIEW' as ExternalProviderStatusValue,
  INACTIVE: 'INACTIVE' as ExternalProviderStatusValue
};

const PROVIDER_LINK_TYPE = {
  PROCESS: 'PROCESS' as ExternalProviderLinkTypeValue,
  RISK: 'RISK' as ExternalProviderLinkTypeValue,
  AUDIT: 'AUDIT' as ExternalProviderLinkTypeValue,
  ACTION: 'ACTION' as ExternalProviderLinkTypeValue,
  OBLIGATION: 'OBLIGATION' as ExternalProviderLinkTypeValue
};

@Injectable()
export class ExternalProvidersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLogsService: AuditLogsService
  ) {}

  async list(
    tenantId: string,
    filters: { search?: string; status?: ExternalProviderStatusValue; ownerUserId?: string } = {}
  ) {
    const items = (await getExternalProviderControlDelegate(this.prisma).findMany({
      where: {
        tenantId,
        deletedAt: null,
        status: filters.status,
        ownerUserId: filters.ownerUserId,
        OR: filters.search
          ? [
              { referenceNo: { contains: filters.search, mode: 'insensitive' } },
              { providerName: { contains: filters.search, mode: 'insensitive' } },
              { suppliedScope: { contains: filters.search, mode: 'insensitive' } },
              { approvalBasis: { contains: filters.search, mode: 'insensitive' } }
            ]
          : undefined
      },
      include: { _count: { select: { links: true } } },
      orderBy: [{ criticality: 'desc' }, { nextReviewDate: 'asc' }, { updatedAt: 'desc' }]
    })) as Array<ProviderRecord & { _count: { links: number } }>;

    const ownerMap = await this.loadOwners(tenantId, items);
    const auditCoverageMap = await this.loadAuditCoverage(tenantId, items);

    return items.map((item) => ({
      ...item,
      owner: item.ownerUserId ? ownerMap.get(item.ownerUserId) ?? null : null,
      linkCount: item._count.links,
      ...(auditCoverageMap.get(item.id) ?? this.defaultAuditCoverage(item))
    }));
  }

  async get(tenantId: string, id: string) {
    const item = (await getExternalProviderControlDelegate(this.prisma).findFirst({
      where: { tenantId, id, deletedAt: null },
      include: { _count: { select: { links: true } } }
    })) as (ProviderRecord & { _count: { links: number } }) | null;

    if (!item) {
      throw new NotFoundException('External provider not found');
    }

    const ownerMap = await this.loadOwners(tenantId, [item]);
    const links = await this.listLinks(tenantId, id);
    const auditCoverageMap = await this.loadAuditCoverage(tenantId, [item], links);

    return {
      ...item,
      owner: item.ownerUserId ? ownerMap.get(item.ownerUserId) ?? null : null,
      linkCount: item._count.links,
      ...(auditCoverageMap.get(item.id) ?? this.defaultAuditCoverage(item)),
      links
    };
  }

  async create(tenantId: string, actorId: string, dto: CreateExternalProviderDto) {
    await this.ensureOwnerBelongsToTenant(tenantId, dto.ownerUserId);
    await this.assertReferenceAvailable(tenantId, dto.referenceNo);
    const evaluation = this.normalizeEvaluation(dto);

    const created = (await getExternalProviderControlDelegate(this.prisma).create({
      data: {
        tenantId,
        referenceNo: this.normalizeText(dto.referenceNo),
        providerName: dto.providerName.trim(),
        providerType: dto.providerType,
        suppliedScope: dto.suppliedScope.trim(),
        approvalBasis: this.normalizeText(dto.approvalBasis),
        criticality: dto.criticality,
        ownerUserId: dto.ownerUserId || null,
        evaluationDate: evaluation.evaluationDate,
        qualityScore: evaluation.qualityScore,
        deliveryScore: evaluation.deliveryScore,
        responsivenessScore: evaluation.responsivenessScore,
        complianceScore: evaluation.complianceScore,
        traceabilityScore: evaluation.traceabilityScore,
        changeControlScore: evaluation.changeControlScore,
        evaluationScore: evaluation.evaluationScore,
        evaluationOutcome: evaluation.evaluationOutcome,
        evaluationSummary: evaluation.evaluationSummary,
        nextReviewDate: this.parseDate(dto.nextReviewDate),
        status: dto.status ?? PROVIDER_STATUS.APPROVED
      }
    })) as ProviderRecord;

    await this.auditLogsService.create({
      tenantId,
      actorId,
      action: 'external-provider.created',
      entityType: 'external-provider',
      entityId: created.id,
      metadata: dto
    });

    return this.get(tenantId, created.id);
  }

  async update(tenantId: string, actorId: string, id: string, dto: UpdateExternalProviderDto) {
    const existing = (await getExternalProviderControlDelegate(this.prisma).findFirst({
      where: { tenantId, id, deletedAt: null }
    })) as ProviderRecord | null;

    if (!existing) {
      throw new NotFoundException('External provider not found');
    }

    await this.ensureOwnerBelongsToTenant(tenantId, dto.ownerUserId);
    if (dto.referenceNo !== undefined && this.normalizeText(dto.referenceNo) !== existing.referenceNo) {
      await this.assertReferenceAvailable(tenantId, dto.referenceNo, id);
    }
    const evaluation = this.normalizeEvaluation({
      evaluationDate: dto.evaluationDate !== undefined ? dto.evaluationDate : this.toDateInput(existing.evaluationDate),
      qualityScore: dto.qualityScore !== undefined ? dto.qualityScore : existing.qualityScore ?? undefined,
      deliveryScore: dto.deliveryScore !== undefined ? dto.deliveryScore : existing.deliveryScore ?? undefined,
      responsivenessScore:
        dto.responsivenessScore !== undefined ? dto.responsivenessScore : existing.responsivenessScore ?? undefined,
      complianceScore: dto.complianceScore !== undefined ? dto.complianceScore : existing.complianceScore ?? undefined,
      traceabilityScore:
        dto.traceabilityScore !== undefined ? dto.traceabilityScore : existing.traceabilityScore ?? undefined,
      changeControlScore:
        dto.changeControlScore !== undefined ? dto.changeControlScore : existing.changeControlScore ?? undefined,
      evaluationSummary:
        dto.evaluationSummary !== undefined ? dto.evaluationSummary : existing.evaluationSummary ?? undefined
    });

    await getExternalProviderControlDelegate(this.prisma).update({
      where: { id },
      data: {
        referenceNo: dto.referenceNo !== undefined ? this.normalizeText(dto.referenceNo) : undefined,
        providerName: dto.providerName !== undefined ? dto.providerName.trim() : undefined,
        providerType: dto.providerType,
        suppliedScope: dto.suppliedScope !== undefined ? dto.suppliedScope.trim() : undefined,
        approvalBasis: dto.approvalBasis !== undefined ? this.normalizeText(dto.approvalBasis) : undefined,
        criticality: dto.criticality,
        ownerUserId: dto.ownerUserId !== undefined ? dto.ownerUserId || null : undefined,
        evaluationDate: evaluation.evaluationDate,
        qualityScore: evaluation.qualityScore,
        deliveryScore: evaluation.deliveryScore,
        responsivenessScore: evaluation.responsivenessScore,
        complianceScore: evaluation.complianceScore,
        traceabilityScore: evaluation.traceabilityScore,
        changeControlScore: evaluation.changeControlScore,
        evaluationScore: evaluation.evaluationScore,
        evaluationOutcome: evaluation.evaluationOutcome,
        evaluationSummary: evaluation.evaluationSummary,
        nextReviewDate: dto.nextReviewDate !== undefined ? this.parseDate(dto.nextReviewDate) : undefined,
        status: dto.status
      }
    });

    await this.auditLogsService.create({
      tenantId,
      actorId,
      action: 'external-provider.updated',
      entityType: 'external-provider',
      entityId: id,
      metadata: dto
    });

    return this.get(tenantId, id);
  }

  async remove(tenantId: string, actorId: string, id: string) {
    const existing = (await getExternalProviderControlDelegate(this.prisma).findFirst({
      where: { tenantId, id, deletedAt: null }
    })) as ProviderRecord | null;

    if (!existing) {
      throw new NotFoundException('External provider not found');
    }

    await getExternalProviderControlDelegate(this.prisma).update({
      where: { id },
      data: {
        deletedAt: new Date(),
        deletedById: actorId,
        status: PROVIDER_STATUS.INACTIVE
      }
    });

    await this.auditLogsService.create({
      tenantId,
      actorId,
      action: 'external-provider.deleted',
      entityType: 'external-provider',
      entityId: id,
      metadata: { referenceNo: existing.referenceNo, status: existing.status }
    });

    return { success: true };
  }

  async listLinks(tenantId: string, providerId: string) {
    await this.ensureProviderExists(tenantId, providerId);

    const links = (await getExternalProviderLinkDelegate(this.prisma).findMany({
      where: { tenantId, providerId },
      orderBy: [{ linkType: 'asc' }, { createdAt: 'desc' }]
    })) as ProviderLinkRecord[];

    return this.decorateLinks(tenantId, links);
  }

  async addLink(tenantId: string, actorId: string, providerId: string, dto: CreateExternalProviderLinkDto) {
    await this.ensureProviderExists(tenantId, providerId);
    await this.ensureLinkTargetExists(tenantId, dto.linkType, dto.linkedId);

    try {
      const link = (await getExternalProviderLinkDelegate(this.prisma).create({
        data: {
          tenantId,
          providerId,
          linkType: dto.linkType,
          linkedId: dto.linkedId,
          note: this.normalizeText(dto.note),
          createdById: actorId
        }
      })) as ProviderLinkRecord;

      await this.auditLogsService.create({
        tenantId,
        actorId,
        action: 'external-provider.linked',
        entityType: 'external-provider',
        entityId: providerId,
        metadata: dto
      });

      const [summary] = await this.decorateLinks(tenantId, [link]);
      return summary;
    } catch {
      throw new ConflictException('This record is already linked to the selected external provider.');
    }
  }

  async removeLink(tenantId: string, actorId: string, providerId: string, linkId: string) {
    const link = (await getExternalProviderLinkDelegate(this.prisma).findFirst({
      where: { tenantId, providerId, id: linkId }
    })) as ProviderLinkRecord | null;

    if (!link) {
      throw new NotFoundException('External provider link not found');
    }

    await getExternalProviderLinkDelegate(this.prisma).delete({ where: { id: link.id } });

    await this.auditLogsService.create({
      tenantId,
      actorId,
      action: 'external-provider.unlinked',
      entityType: 'external-provider',
      entityId: providerId,
      metadata: { linkType: link.linkType, linkedId: link.linkedId }
    });

    return { success: true };
  }

  private async decorateLinks(tenantId: string, links: ProviderLinkRecord[]): Promise<ProviderLinkSummary[]> {
    const byType = new Map<ExternalProviderLinkTypeValue, string[]>();
    for (const link of links) {
      const values = byType.get(link.linkType) ?? [];
      values.push(link.linkedId);
      byType.set(link.linkType, values);
    }

    const processes = byType.has(PROVIDER_LINK_TYPE.PROCESS)
      ? await this.prisma.processRegister.findMany({
          where: { tenantId, id: { in: byType.get(PROVIDER_LINK_TYPE.PROCESS)! }, deletedAt: null },
          select: { id: true, referenceNo: true, name: true, status: true }
        })
      : [];
    const risks = byType.has(PROVIDER_LINK_TYPE.RISK)
      ? await this.prisma.risk.findMany({
          where: { tenantId, id: { in: byType.get(PROVIDER_LINK_TYPE.RISK)! }, deletedAt: null },
          select: { id: true, title: true, score: true, status: true }
        })
      : [];
    const audits = byType.has(PROVIDER_LINK_TYPE.AUDIT)
      ? await this.prisma.audit.findMany({
          where: { tenantId, id: { in: byType.get(PROVIDER_LINK_TYPE.AUDIT)! }, deletedAt: null },
          select: { id: true, code: true, title: true, type: true, status: true }
        })
      : [];
    const actions = byType.has(PROVIDER_LINK_TYPE.ACTION)
      ? await this.prisma.actionItem.findMany({
          where: { tenantId, id: { in: byType.get(PROVIDER_LINK_TYPE.ACTION)! }, deletedAt: null },
          select: { id: true, title: true, status: true, dueDate: true }
        })
      : [];
    const obligations = byType.has(PROVIDER_LINK_TYPE.OBLIGATION)
      ? await this.prisma.complianceObligation.findMany({
          where: { tenantId, id: { in: byType.get(PROVIDER_LINK_TYPE.OBLIGATION)! }, deletedAt: null },
          select: { id: true, referenceNo: true, title: true, status: true }
        })
      : [];

    const processMap = new Map(processes.map((item) => [item.id, item]));
    const riskMap = new Map(risks.map((item) => [item.id, item]));
    const auditMap = new Map(audits.map((item) => [item.id, item]));
    const actionMap = new Map(actions.map((item) => [item.id, item]));
    const obligationMap = new Map(obligations.map((item) => [item.id, item]));

    return links.map((link) => {
      if (link.linkType === PROVIDER_LINK_TYPE.PROCESS) {
        const target = processMap.get(link.linkedId);
        return this.makeLinkSummary(link, target ? `${target.referenceNo || 'Uncoded'} - ${target.name}` : 'Linked process unavailable', target ? 'Owning process' : null, target?.status ?? null, target ? `/process-register/${target.id}` : null, !target);
      }
      if (link.linkType === PROVIDER_LINK_TYPE.RISK) {
        const target = riskMap.get(link.linkedId);
        return this.makeLinkSummary(link, target ? target.title : 'Linked risk unavailable', target ? `Risk score ${target.score}` : null, target?.status ?? null, target ? `/risks/${target.id}` : null, !target);
      }
      if (link.linkType === PROVIDER_LINK_TYPE.AUDIT) {
        const target = auditMap.get(link.linkedId);
        return this.makeLinkSummary(
          link,
          target ? `${target.code} - ${target.title}` : 'Linked audit unavailable',
          target ? (this.isSupplierAudit(target.type, target.title) ? 'Supplier audit evidence' : 'Audit evidence') : null,
          target?.status ?? null,
          target ? `/audits/${target.id}` : null,
          !target
        );
      }
      if (link.linkType === PROVIDER_LINK_TYPE.OBLIGATION) {
        const target = obligationMap.get(link.linkedId);
        return this.makeLinkSummary(link, target ? `${target.referenceNo || 'Uncoded'} - ${target.title}` : 'Linked obligation unavailable', target ? 'Compliance obligation' : null, target?.status ?? null, target ? `/compliance-obligations/${target.id}` : null, !target);
      }

      const target = actionMap.get(link.linkedId);
      return this.makeLinkSummary(link, target ? target.title : 'Linked action unavailable', target?.dueDate ? `Due ${target.dueDate.toISOString().slice(0, 10)}` : null, target?.status ?? null, target ? '/actions' : null, !target);
    });
  }

  private makeLinkSummary(
    link: ProviderLinkRecord,
    title: string,
    subtitle: string | null,
    status: string | null,
    path: string | null,
    missing: boolean
  ): ProviderLinkSummary {
    return {
      id: link.id,
      linkType: link.linkType,
      linkedId: link.linkedId,
      note: link.note,
      createdAt: link.createdAt,
      path,
      title,
      subtitle,
      status,
      missing
    };
  }

  private async ensureProviderExists(tenantId: string, id: string) {
    const item = (await getExternalProviderControlDelegate(this.prisma).findFirst({
      where: { tenantId, id, deletedAt: null },
      select: { id: true }
    })) as { id: string } | null;

    if (!item) {
      throw new NotFoundException('External provider not found');
    }
  }

  private async ensureOwnerBelongsToTenant(tenantId: string, ownerUserId?: string) {
    if (!ownerUserId) return;
    const owner = await this.prisma.user.findFirst({
      where: { tenantId, id: ownerUserId, isActive: true },
      select: { id: true }
    });
    if (!owner) {
      throw new BadRequestException('Selected external provider owner is not active in this tenant');
    }
  }

  private async assertReferenceAvailable(tenantId: string, referenceNo?: string, excludeId?: string) {
    const normalized = this.normalizeText(referenceNo);
    if (!normalized) return;

    const existing = (await getExternalProviderControlDelegate(this.prisma).findFirst({
      where: {
        tenantId,
        referenceNo: normalized,
        deletedAt: null,
        id: excludeId ? { not: excludeId } : undefined
      },
      select: { id: true }
    })) as { id: string } | null;

    if (existing) {
      throw new ConflictException('An external provider with this reference number already exists.');
    }
  }

  private async loadOwners(tenantId: string, items: ProviderRecord[]) {
    const ownerIds = Array.from(new Set(items.map((item) => item.ownerUserId).filter(Boolean))) as string[];
    if (!ownerIds.length) {
      return new Map<string, UserSummary>();
    }

    const users = await this.prisma.user.findMany({
      where: { tenantId, id: { in: ownerIds } },
      select: { id: true, firstName: true, lastName: true, email: true }
    });

    return new Map(users.map((user) => [user.id, user]));
  }

  private async loadAuditCoverage(
    tenantId: string,
    items: ProviderRecord[],
    detailLinks?: ProviderLinkSummary[]
  ) {
    const providerIds = items.map((item) => item.id);
    const coverage = new Map<string, ProviderAuditCoverage>();

    for (const item of items) {
      coverage.set(item.id, this.defaultAuditCoverage(item));
    }

    const requiresSupplierAudit = items.filter((item) => this.defaultAuditCoverage(item).supplierAuditRequired);
    if (!requiresSupplierAudit.length) {
      return coverage;
    }

    let auditLinks: Array<{ providerId: string; linkedId: string }> = [];
    if (detailLinks && items.length === 1) {
      auditLinks = detailLinks
        .filter((link) => link.linkType === PROVIDER_LINK_TYPE.AUDIT && !link.missing)
        .map((link) => ({ providerId: items[0].id, linkedId: link.linkedId }));
    } else {
      auditLinks = (await getExternalProviderLinkDelegate(this.prisma).findMany({
        where: {
          tenantId,
          providerId: { in: requiresSupplierAudit.map((item) => item.id) },
          linkType: PROVIDER_LINK_TYPE.AUDIT
        },
        select: { providerId: true, linkedId: true }
      })) as Array<{ providerId: string; linkedId: string }>;
    }

    if (!auditLinks.length) {
      return coverage;
    }

    const audits = await this.prisma.audit.findMany({
      where: {
        tenantId,
        id: { in: auditLinks.map((link) => link.linkedId) },
        deletedAt: null
      },
      select: { id: true, type: true, title: true }
    });

    const auditMap = new Map(audits.map((audit) => [audit.id, audit]));

    for (const item of requiresSupplierAudit) {
      const hasSupplierAudit = auditLinks
        .filter((link) => link.providerId === item.id)
        .some((link) => {
          const audit = auditMap.get(link.linkedId);
          return audit ? this.isSupplierAudit(audit.type, audit.title) : false;
        });

      coverage.set(item.id, {
        supplierAuditRequired: true,
        supplierAuditLinked: hasSupplierAudit
      });
    }

    return coverage;
  }

  private async ensureLinkTargetExists(tenantId: string, linkType: ExternalProviderLinkTypeValue, linkedId: string) {
    if (linkType === PROVIDER_LINK_TYPE.PROCESS) {
      const target = await this.prisma.processRegister.findFirst({ where: { tenantId, id: linkedId, deletedAt: null }, select: { id: true } });
      if (!target) throw new BadRequestException('Selected process could not be found in this tenant');
      return;
    }
    if (linkType === PROVIDER_LINK_TYPE.RISK) {
      const target = await this.prisma.risk.findFirst({ where: { tenantId, id: linkedId, deletedAt: null }, select: { id: true } });
      if (!target) throw new BadRequestException('Selected risk could not be found in this tenant');
      return;
    }
    if (linkType === PROVIDER_LINK_TYPE.AUDIT) {
      const target = await this.prisma.audit.findFirst({ where: { tenantId, id: linkedId, deletedAt: null }, select: { id: true } });
      if (!target) throw new BadRequestException('Selected audit could not be found in this tenant');
      return;
    }
    if (linkType === PROVIDER_LINK_TYPE.OBLIGATION) {
      const target = await this.prisma.complianceObligation.findFirst({ where: { tenantId, id: linkedId, deletedAt: null }, select: { id: true } });
      if (!target) throw new BadRequestException('Selected obligation could not be found in this tenant');
      return;
    }

    const target = await this.prisma.actionItem.findFirst({ where: { tenantId, id: linkedId, deletedAt: null }, select: { id: true } });
    if (!target) throw new BadRequestException('Selected action could not be found in this tenant');
  }

  private parseDate(value?: string | null) {
    if (!value) return null;
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) {
      throw new BadRequestException('Next review date is invalid');
    }
    return parsed;
  }

  private normalizeEvaluation(dto: Partial<CreateExternalProviderDto>) {
    const scores: ProviderEvaluationScores = {
      qualityScore: dto.qualityScore ?? null,
      deliveryScore: dto.deliveryScore ?? null,
      responsivenessScore: dto.responsivenessScore ?? null,
      complianceScore: dto.complianceScore ?? null,
      traceabilityScore: dto.traceabilityScore ?? null,
      changeControlScore: dto.changeControlScore ?? null
    };
    const values = Object.values(scores);
    const hasAnyScore = values.some((value) => value !== null);
    const hasAllScores = values.every((value) => value !== null);

    if (hasAnyScore && !hasAllScores) {
      throw new BadRequestException('Complete all supplier evaluation questions before saving the annual evaluation.');
    }

    const evaluationDate = this.parseDate(dto.evaluationDate);
    if (hasAllScores && !evaluationDate) {
      throw new BadRequestException('Annual evaluation date is required when supplier evaluation scores are recorded.');
    }

    const evaluationScore = hasAllScores
      ? Math.round((values.reduce((sum, value) => sum + (value || 0), 0) / 30) * 100)
      : null;

    return {
      ...scores,
      evaluationDate,
      evaluationScore,
      evaluationOutcome: this.evaluationOutcome(evaluationScore),
      evaluationSummary: this.normalizeText(dto.evaluationSummary)
    };
  }

  private evaluationOutcome(score: number | null): ExternalProviderEvaluationOutcomeValue | null {
    if (score === null) return null;
    if (score >= 85) return 'APPROVED';
    if (score >= 70) return 'APPROVED_WITH_CONDITIONS';
    if (score >= 55) return 'ESCALATED';
    return 'DISQUALIFIED';
  }

  private defaultAuditCoverage(item: Pick<ProviderRecord, 'providerType' | 'criticality'>): ProviderAuditCoverage {
    return {
      supplierAuditRequired: item.providerType === 'SUPPLIER' && item.criticality === 'HIGH',
      supplierAuditLinked: false
    };
  }

  private isSupplierAudit(type?: string | null, title?: string | null) {
    return `${type || ''} ${title || ''}`.toUpperCase().includes('SUPPLIER');
  }

  private toDateInput(value?: Date | null) {
    return value ? value.toISOString().slice(0, 10) : undefined;
  }

  private normalizeText(value?: string | null) {
    const trimmed = value?.trim();
    return trimmed ? trimmed : null;
  }
}
