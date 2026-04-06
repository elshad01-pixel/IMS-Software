import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import {
  getComplianceObligationDelegate,
  getComplianceObligationLinkDelegate
} from '../../common/prisma/prisma-delegate-compat';
import { PrismaService } from '../../common/prisma/prisma.service';
import { AuditLogsService } from '../audit-logs/audit-logs.service';
import {
  ComplianceObligationLinkTypeValue,
  CreateComplianceObligationLinkDto
} from './dto/create-compliance-obligation-link.dto';
import {
  ComplianceObligationStatusValue,
  CreateComplianceObligationDto
} from './dto/create-compliance-obligation.dto';
import { UpdateComplianceObligationDto } from './dto/update-compliance-obligation.dto';

type ObligationRecord = {
  id: string;
  tenantId: string;
  referenceNo: string | null;
  title: string;
  sourceName: string;
  obligationType: string | null;
  jurisdiction: string | null;
  description: string | null;
  ownerUserId: string | null;
  reviewFrequencyMonths: number | null;
  nextReviewDate: Date | null;
  status: ComplianceObligationStatusValue;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
  deletedById: string | null;
};

type ObligationLinkRecord = {
  id: string;
  tenantId: string;
  obligationId: string;
  linkType: ComplianceObligationLinkTypeValue;
  linkedId: string;
  note: string | null;
  createdAt: Date;
  createdById: string | null;
};

type UserSummary = {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
};

type ObligationLinkSummary = {
  id: string;
  linkType: ComplianceObligationLinkTypeValue;
  linkedId: string;
  note: string | null;
  createdAt: Date;
  path: string | null;
  title: string;
  subtitle: string | null;
  status: string | null;
  missing: boolean;
};

const OBLIGATION_STATUS = {
  ACTIVE: 'ACTIVE' as ComplianceObligationStatusValue,
  UNDER_REVIEW: 'UNDER_REVIEW' as ComplianceObligationStatusValue,
  OBSOLETE: 'OBSOLETE' as ComplianceObligationStatusValue
};

const OBLIGATION_LINK_TYPE = {
  PROCESS: 'PROCESS' as ComplianceObligationLinkTypeValue,
  RISK: 'RISK' as ComplianceObligationLinkTypeValue,
  AUDIT: 'AUDIT' as ComplianceObligationLinkTypeValue,
  ACTION: 'ACTION' as ComplianceObligationLinkTypeValue
};

@Injectable()
export class ComplianceObligationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLogsService: AuditLogsService
  ) {}

  async list(
    tenantId: string,
    filters: { search?: string; status?: ComplianceObligationStatusValue; ownerUserId?: string } = {}
  ) {
    const items = (await getComplianceObligationDelegate(this.prisma).findMany({
      where: {
        tenantId,
        deletedAt: null,
        status: filters.status,
        ownerUserId: filters.ownerUserId,
        OR: filters.search
          ? [
              { referenceNo: { contains: filters.search, mode: 'insensitive' } },
              { title: { contains: filters.search, mode: 'insensitive' } },
              { sourceName: { contains: filters.search, mode: 'insensitive' } },
              { obligationType: { contains: filters.search, mode: 'insensitive' } },
              { jurisdiction: { contains: filters.search, mode: 'insensitive' } }
            ]
          : undefined
      },
      include: {
        _count: {
          select: {
            links: true
          }
        }
      },
      orderBy: [{ nextReviewDate: 'asc' }, { updatedAt: 'desc' }, { createdAt: 'desc' }]
    })) as Array<ObligationRecord & { _count: { links: number } }>;

    const ownerMap = await this.loadOwners(tenantId, items);

    return items.map((item) => ({
      ...item,
      owner: item.ownerUserId ? ownerMap.get(item.ownerUserId) ?? null : null,
      linkCount: item._count.links
    }));
  }

  async get(tenantId: string, id: string) {
    const item = (await getComplianceObligationDelegate(this.prisma).findFirst({
      where: { tenantId, id, deletedAt: null },
      include: {
        _count: {
          select: {
            links: true
          }
        }
      }
    })) as (ObligationRecord & { _count: { links: number } }) | null;

    if (!item) {
      throw new NotFoundException('Compliance obligation not found');
    }

    const ownerMap = await this.loadOwners(tenantId, [item]);

    return {
      ...item,
      owner: item.ownerUserId ? ownerMap.get(item.ownerUserId) ?? null : null,
      linkCount: item._count.links,
      links: await this.listLinks(tenantId, id)
    };
  }

  async create(tenantId: string, actorId: string, dto: CreateComplianceObligationDto) {
    await this.ensureOwnerBelongsToTenant(tenantId, dto.ownerUserId);
    await this.assertReferenceAvailable(tenantId, dto.referenceNo);

    const created = (await getComplianceObligationDelegate(this.prisma).create({
      data: {
        tenantId,
        referenceNo: this.normalizeText(dto.referenceNo),
        title: dto.title.trim(),
        sourceName: dto.sourceName.trim(),
        obligationType: this.normalizeText(dto.obligationType),
        jurisdiction: this.normalizeText(dto.jurisdiction),
        description: this.normalizeText(dto.description),
        ownerUserId: dto.ownerUserId || null,
        reviewFrequencyMonths: dto.reviewFrequencyMonths ?? null,
        nextReviewDate: this.parseDate(dto.nextReviewDate),
        status: dto.status ?? OBLIGATION_STATUS.ACTIVE
      }
    })) as ObligationRecord;

    await this.auditLogsService.create({
      tenantId,
      actorId,
      action: 'compliance-obligation.created',
      entityType: 'compliance-obligation',
      entityId: created.id,
      metadata: dto
    });

    return this.get(tenantId, created.id);
  }

  async update(tenantId: string, actorId: string, id: string, dto: UpdateComplianceObligationDto) {
    const existing = (await getComplianceObligationDelegate(this.prisma).findFirst({
      where: { tenantId, id, deletedAt: null }
    })) as ObligationRecord | null;

    if (!existing) {
      throw new NotFoundException('Compliance obligation not found');
    }

    await this.ensureOwnerBelongsToTenant(tenantId, dto.ownerUserId);
    if (dto.referenceNo !== undefined && this.normalizeText(dto.referenceNo) !== existing.referenceNo) {
      await this.assertReferenceAvailable(tenantId, dto.referenceNo, id);
    }

    await getComplianceObligationDelegate(this.prisma).update({
      where: { id },
      data: {
        referenceNo: dto.referenceNo !== undefined ? this.normalizeText(dto.referenceNo) : undefined,
        title: dto.title !== undefined ? dto.title.trim() : undefined,
        sourceName: dto.sourceName !== undefined ? dto.sourceName.trim() : undefined,
        obligationType: dto.obligationType !== undefined ? this.normalizeText(dto.obligationType) : undefined,
        jurisdiction: dto.jurisdiction !== undefined ? this.normalizeText(dto.jurisdiction) : undefined,
        description: dto.description !== undefined ? this.normalizeText(dto.description) : undefined,
        ownerUserId: dto.ownerUserId !== undefined ? dto.ownerUserId || null : undefined,
        reviewFrequencyMonths: dto.reviewFrequencyMonths !== undefined ? dto.reviewFrequencyMonths ?? null : undefined,
        nextReviewDate: dto.nextReviewDate !== undefined ? this.parseDate(dto.nextReviewDate) : undefined,
        status: dto.status
      }
    });

    await this.auditLogsService.create({
      tenantId,
      actorId,
      action: 'compliance-obligation.updated',
      entityType: 'compliance-obligation',
      entityId: id,
      metadata: dto
    });

    return this.get(tenantId, id);
  }

  async remove(tenantId: string, actorId: string, id: string) {
    const existing = (await getComplianceObligationDelegate(this.prisma).findFirst({
      where: { tenantId, id, deletedAt: null }
    })) as ObligationRecord | null;

    if (!existing) {
      throw new NotFoundException('Compliance obligation not found');
    }

    await getComplianceObligationDelegate(this.prisma).update({
      where: { id },
      data: {
        deletedAt: new Date(),
        deletedById: actorId,
        status: OBLIGATION_STATUS.OBSOLETE
      }
    });

    await this.auditLogsService.create({
      tenantId,
      actorId,
      action: 'compliance-obligation.deleted',
      entityType: 'compliance-obligation',
      entityId: id,
      metadata: { referenceNo: existing.referenceNo, status: existing.status }
    });

    return { success: true };
  }

  async listLinks(tenantId: string, obligationId: string) {
    await this.ensureObligationExists(tenantId, obligationId);

    const links = (await getComplianceObligationLinkDelegate(this.prisma).findMany({
      where: { tenantId, obligationId },
      orderBy: [{ linkType: 'asc' }, { createdAt: 'desc' }]
    })) as ObligationLinkRecord[];

    return this.decorateLinks(tenantId, links);
  }

  async addLink(tenantId: string, actorId: string, obligationId: string, dto: CreateComplianceObligationLinkDto) {
    await this.ensureObligationExists(tenantId, obligationId);
    await this.ensureLinkTargetExists(tenantId, dto.linkType, dto.linkedId);

    try {
      const link = (await getComplianceObligationLinkDelegate(this.prisma).create({
        data: {
          tenantId,
          obligationId,
          linkType: dto.linkType,
          linkedId: dto.linkedId,
          note: this.normalizeText(dto.note),
          createdById: actorId
        }
      })) as ObligationLinkRecord;

      await this.auditLogsService.create({
        tenantId,
        actorId,
        action: 'compliance-obligation.linked',
        entityType: 'compliance-obligation',
        entityId: obligationId,
        metadata: dto
      });

      const [summary] = await this.decorateLinks(tenantId, [link]);
      return summary;
    } catch {
      throw new ConflictException('This record is already linked to the selected obligation.');
    }
  }

  async removeLink(tenantId: string, actorId: string, obligationId: string, linkId: string) {
    const link = (await getComplianceObligationLinkDelegate(this.prisma).findFirst({
      where: { tenantId, obligationId, id: linkId }
    })) as ObligationLinkRecord | null;

    if (!link) {
      throw new NotFoundException('Compliance obligation link not found');
    }

    await getComplianceObligationLinkDelegate(this.prisma).delete({
      where: { id: link.id }
    });

    await this.auditLogsService.create({
      tenantId,
      actorId,
      action: 'compliance-obligation.unlinked',
      entityType: 'compliance-obligation',
      entityId: obligationId,
      metadata: { linkType: link.linkType, linkedId: link.linkedId }
    });

    return { success: true };
  }

  private async decorateLinks(tenantId: string, links: ObligationLinkRecord[]): Promise<ObligationLinkSummary[]> {
    const byType = new Map<ComplianceObligationLinkTypeValue, string[]>();
    for (const link of links) {
      const values = byType.get(link.linkType) ?? [];
      values.push(link.linkedId);
      byType.set(link.linkType, values);
    }

    const processes = byType.has(OBLIGATION_LINK_TYPE.PROCESS)
      ? await this.prisma.processRegister.findMany({
          where: { tenantId, id: { in: byType.get(OBLIGATION_LINK_TYPE.PROCESS)! }, deletedAt: null },
          select: { id: true, referenceNo: true, name: true, status: true }
        })
      : [];
    const risks = byType.has(OBLIGATION_LINK_TYPE.RISK)
      ? await this.prisma.risk.findMany({
          where: { tenantId, id: { in: byType.get(OBLIGATION_LINK_TYPE.RISK)! }, deletedAt: null },
          select: { id: true, title: true, status: true, score: true }
        })
      : [];
    const audits = byType.has(OBLIGATION_LINK_TYPE.AUDIT)
      ? await this.prisma.audit.findMany({
          where: { tenantId, id: { in: byType.get(OBLIGATION_LINK_TYPE.AUDIT)! }, deletedAt: null },
          select: { id: true, code: true, title: true, status: true }
        })
      : [];
    const actions = byType.has(OBLIGATION_LINK_TYPE.ACTION)
      ? await this.prisma.actionItem.findMany({
          where: { tenantId, id: { in: byType.get(OBLIGATION_LINK_TYPE.ACTION)! }, deletedAt: null },
          select: { id: true, title: true, status: true, dueDate: true }
        })
      : [];

    const processMap = new Map(processes.map((item) => [item.id, item]));
    const riskMap = new Map(risks.map((item) => [item.id, item]));
    const auditMap = new Map(audits.map((item) => [item.id, item]));
    const actionMap = new Map(actions.map((item) => [item.id, item]));

    return links.map((link) => {
      if (link.linkType === OBLIGATION_LINK_TYPE.PROCESS) {
        const target = processMap.get(link.linkedId);
        return this.makeLinkSummary(
          link,
          target ? `${target.referenceNo || 'Uncoded'} - ${target.name}` : 'Linked process unavailable',
          target ? 'Process register' : null,
          target?.status ?? null,
          target ? `/process-register/${target.id}` : null,
          !target
        );
      }
      if (link.linkType === OBLIGATION_LINK_TYPE.RISK) {
        const target = riskMap.get(link.linkedId);
        return this.makeLinkSummary(
          link,
          target ? target.title : 'Linked risk unavailable',
          target ? `Risk score ${target.score}` : null,
          target?.status ?? null,
          target ? `/risks/${target.id}` : null,
          !target
        );
      }
      if (link.linkType === OBLIGATION_LINK_TYPE.AUDIT) {
        const target = auditMap.get(link.linkedId);
        return this.makeLinkSummary(
          link,
          target ? `${target.code} - ${target.title}` : 'Linked audit unavailable',
          target ? 'Audit review' : null,
          target?.status ?? null,
          target ? `/audits/${target.id}` : null,
          !target
        );
      }
      const target = actionMap.get(link.linkedId);
      return this.makeLinkSummary(
        link,
        target ? target.title : 'Linked action unavailable',
        target?.dueDate ? `Due ${target.dueDate.toISOString().slice(0, 10)}` : null,
        target?.status ?? null,
        target ? '/actions' : null,
        !target
      );
    });
  }

  private makeLinkSummary(
    link: ObligationLinkRecord,
    title: string,
    subtitle: string | null,
    status: string | null,
    path: string | null,
    missing: boolean
  ): ObligationLinkSummary {
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

  private async ensureOwnerBelongsToTenant(tenantId: string, ownerUserId?: string) {
    if (!ownerUserId) {
      return;
    }

    const owner = await this.prisma.user.findFirst({
      where: { tenantId, id: ownerUserId, isActive: true },
      select: { id: true }
    });

    if (!owner) {
      throw new BadRequestException('Selected obligation owner is not active in this tenant');
    }
  }

  private async ensureObligationExists(tenantId: string, id: string) {
    const item = (await getComplianceObligationDelegate(this.prisma).findFirst({
      where: { tenantId, id, deletedAt: null },
      select: { id: true }
    })) as { id: string } | null;

    if (!item) {
      throw new NotFoundException('Compliance obligation not found');
    }
  }

  private async assertReferenceAvailable(tenantId: string, referenceNo?: string, excludeId?: string) {
    const normalized = this.normalizeText(referenceNo);
    if (!normalized) {
      return;
    }

    const existing = (await getComplianceObligationDelegate(this.prisma).findFirst({
      where: {
        tenantId,
        referenceNo: normalized,
        deletedAt: null,
        id: excludeId ? { not: excludeId } : undefined
      },
      select: { id: true }
    })) as { id: string } | null;

    if (existing) {
      throw new ConflictException('A compliance obligation with this reference number already exists.');
    }
  }

  private async loadOwners(tenantId: string, items: ObligationRecord[]) {
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

  private async ensureLinkTargetExists(
    tenantId: string,
    linkType: ComplianceObligationLinkTypeValue,
    linkedId: string
  ) {
    if (linkType === OBLIGATION_LINK_TYPE.PROCESS) {
      const target = await this.prisma.processRegister.findFirst({
        where: { tenantId, id: linkedId, deletedAt: null },
        select: { id: true }
      });
      if (!target) throw new BadRequestException('Selected process could not be found in this tenant');
      return;
    }
    if (linkType === OBLIGATION_LINK_TYPE.RISK) {
      const target = await this.prisma.risk.findFirst({
        where: { tenantId, id: linkedId, deletedAt: null },
        select: { id: true }
      });
      if (!target) throw new BadRequestException('Selected risk could not be found in this tenant');
      return;
    }
    if (linkType === OBLIGATION_LINK_TYPE.AUDIT) {
      const target = await this.prisma.audit.findFirst({
        where: { tenantId, id: linkedId, deletedAt: null },
        select: { id: true }
      });
      if (!target) throw new BadRequestException('Selected audit could not be found in this tenant');
      return;
    }

    const target = await this.prisma.actionItem.findFirst({
      where: { tenantId, id: linkedId, deletedAt: null },
      select: { id: true }
    });
    if (!target) throw new BadRequestException('Selected action could not be found in this tenant');
  }

  private parseDate(value?: string | null) {
    if (!value) {
      return null;
    }
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) {
      throw new BadRequestException('Next review date is invalid');
    }
    return parsed;
  }

  private normalizeText(value?: string | null) {
    const trimmed = value?.trim();
    return trimmed ? trimmed : null;
  }
}
