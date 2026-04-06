import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { getChangeRequestDelegate, getChangeRequestLinkDelegate } from '../../common/prisma/prisma-delegate-compat';
import { PrismaService } from '../../common/prisma/prisma.service';
import { AuditLogsService } from '../audit-logs/audit-logs.service';
import { CreateChangeRequestDto, ChangeRequestStatusValue, ChangeRequestTypeValue } from './dto/create-change-request.dto';
import { CreateChangeRequestLinkDto, ChangeRequestLinkTypeValue } from './dto/create-change-request-link.dto';
import { UpdateChangeRequestDto } from './dto/update-change-request.dto';

type ChangeRecord = {
  id: string;
  tenantId: string;
  referenceNo: string | null;
  title: string;
  changeType: ChangeRequestTypeValue;
  reason: string;
  affectedArea: string;
  proposedChange: string;
  impactSummary: string | null;
  controlSummary: string | null;
  ownerUserId: string | null;
  targetImplementationDate: Date | null;
  reviewDate: Date | null;
  status: ChangeRequestStatusValue;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
  deletedById: string | null;
};

type ChangeLinkRecord = {
  id: string;
  tenantId: string;
  changeId: string;
  linkType: ChangeRequestLinkTypeValue;
  linkedId: string;
  note: string | null;
  createdAt: Date;
  createdById: string | null;
};

type UserSummary = { id: string; firstName: string; lastName: string; email: string };

type ChangeLinkSummary = {
  id: string;
  linkType: ChangeRequestLinkTypeValue;
  linkedId: string;
  note: string | null;
  createdAt: Date;
  path: string | null;
  title: string;
  subtitle: string | null;
  status: string | null;
  missing: boolean;
};

const CHANGE_STATUS = {
  PROPOSED: 'PROPOSED' as ChangeRequestStatusValue,
  REVIEWING: 'REVIEWING' as ChangeRequestStatusValue,
  APPROVED: 'APPROVED' as ChangeRequestStatusValue,
  IMPLEMENTING: 'IMPLEMENTING' as ChangeRequestStatusValue,
  VERIFIED: 'VERIFIED' as ChangeRequestStatusValue,
  CLOSED: 'CLOSED' as ChangeRequestStatusValue,
  REJECTED: 'REJECTED' as ChangeRequestStatusValue
};

const CHANGE_LINK_TYPE = {
  PROCESS: 'PROCESS' as ChangeRequestLinkTypeValue,
  RISK: 'RISK' as ChangeRequestLinkTypeValue,
  ACTION: 'ACTION' as ChangeRequestLinkTypeValue,
  DOCUMENT: 'DOCUMENT' as ChangeRequestLinkTypeValue,
  OBLIGATION: 'OBLIGATION' as ChangeRequestLinkTypeValue,
  PROVIDER: 'PROVIDER' as ChangeRequestLinkTypeValue
};

@Injectable()
export class ChangeManagementService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLogsService: AuditLogsService
  ) {}

  async list(
    tenantId: string,
    filters: { search?: string; status?: ChangeRequestStatusValue; ownerUserId?: string } = {}
  ) {
    const items = (await getChangeRequestDelegate(this.prisma).findMany({
      where: {
        tenantId,
        deletedAt: null,
        status: filters.status,
        ownerUserId: filters.ownerUserId,
        OR: filters.search
          ? [
              { referenceNo: { contains: filters.search, mode: 'insensitive' } },
              { title: { contains: filters.search, mode: 'insensitive' } },
              { affectedArea: { contains: filters.search, mode: 'insensitive' } },
              { proposedChange: { contains: filters.search, mode: 'insensitive' } }
            ]
          : undefined
      },
      include: { _count: { select: { links: true } } },
      orderBy: [{ targetImplementationDate: 'asc' }, { updatedAt: 'desc' }]
    })) as Array<ChangeRecord & { _count: { links: number } }>;

    const ownerMap = await this.loadOwners(tenantId, items);

    return items.map((item) => ({
      ...item,
      owner: item.ownerUserId ? ownerMap.get(item.ownerUserId) ?? null : null,
      linkCount: item._count.links
    }));
  }

  async get(tenantId: string, id: string) {
    const item = (await getChangeRequestDelegate(this.prisma).findFirst({
      where: { tenantId, id, deletedAt: null },
      include: { _count: { select: { links: true } } }
    })) as (ChangeRecord & { _count: { links: number } }) | null;

    if (!item) {
      throw new NotFoundException('Change request not found');
    }

    const ownerMap = await this.loadOwners(tenantId, [item]);

    return {
      ...item,
      owner: item.ownerUserId ? ownerMap.get(item.ownerUserId) ?? null : null,
      linkCount: item._count.links,
      links: await this.listLinks(tenantId, id)
    };
  }

  async create(tenantId: string, actorId: string, dto: CreateChangeRequestDto) {
    await this.ensureOwnerBelongsToTenant(tenantId, dto.ownerUserId);
    await this.assertReferenceAvailable(tenantId, dto.referenceNo);

    const created = (await getChangeRequestDelegate(this.prisma).create({
      data: {
        tenantId,
        referenceNo: this.normalizeText(dto.referenceNo),
        title: dto.title.trim(),
        changeType: dto.changeType,
        reason: dto.reason.trim(),
        affectedArea: dto.affectedArea.trim(),
        proposedChange: dto.proposedChange.trim(),
        impactSummary: this.normalizeText(dto.impactSummary),
        controlSummary: this.normalizeText(dto.controlSummary),
        ownerUserId: dto.ownerUserId || null,
        targetImplementationDate: this.parseDate(dto.targetImplementationDate, 'Target implementation date is invalid'),
        reviewDate: this.parseDate(dto.reviewDate, 'Review date is invalid'),
        status: dto.status ?? CHANGE_STATUS.PROPOSED
      }
    })) as ChangeRecord;

    await this.auditLogsService.create({
      tenantId,
      actorId,
      action: 'change-request.created',
      entityType: 'change-request',
      entityId: created.id,
      metadata: dto
    });

    return this.get(tenantId, created.id);
  }

  async update(tenantId: string, actorId: string, id: string, dto: UpdateChangeRequestDto) {
    const existing = (await getChangeRequestDelegate(this.prisma).findFirst({
      where: { tenantId, id, deletedAt: null }
    })) as ChangeRecord | null;

    if (!existing) {
      throw new NotFoundException('Change request not found');
    }

    await this.ensureOwnerBelongsToTenant(tenantId, dto.ownerUserId);
    if (dto.referenceNo !== undefined && this.normalizeText(dto.referenceNo) !== existing.referenceNo) {
      await this.assertReferenceAvailable(tenantId, dto.referenceNo, id);
    }

    await getChangeRequestDelegate(this.prisma).update({
      where: { id },
      data: {
        referenceNo: dto.referenceNo !== undefined ? this.normalizeText(dto.referenceNo) : undefined,
        title: dto.title !== undefined ? dto.title.trim() : undefined,
        changeType: dto.changeType,
        reason: dto.reason !== undefined ? dto.reason.trim() : undefined,
        affectedArea: dto.affectedArea !== undefined ? dto.affectedArea.trim() : undefined,
        proposedChange: dto.proposedChange !== undefined ? dto.proposedChange.trim() : undefined,
        impactSummary: dto.impactSummary !== undefined ? this.normalizeText(dto.impactSummary) : undefined,
        controlSummary: dto.controlSummary !== undefined ? this.normalizeText(dto.controlSummary) : undefined,
        ownerUserId: dto.ownerUserId !== undefined ? dto.ownerUserId || null : undefined,
        targetImplementationDate:
          dto.targetImplementationDate !== undefined
            ? this.parseDate(dto.targetImplementationDate, 'Target implementation date is invalid')
            : undefined,
        reviewDate: dto.reviewDate !== undefined ? this.parseDate(dto.reviewDate, 'Review date is invalid') : undefined,
        status: dto.status
      }
    });

    await this.auditLogsService.create({
      tenantId,
      actorId,
      action: 'change-request.updated',
      entityType: 'change-request',
      entityId: id,
      metadata: dto
    });

    return this.get(tenantId, id);
  }

  async remove(tenantId: string, actorId: string, id: string) {
    const existing = (await getChangeRequestDelegate(this.prisma).findFirst({
      where: { tenantId, id, deletedAt: null }
    })) as ChangeRecord | null;

    if (!existing) {
      throw new NotFoundException('Change request not found');
    }

    await getChangeRequestDelegate(this.prisma).update({
      where: { id },
      data: {
        deletedAt: new Date(),
        deletedById: actorId,
        status: CHANGE_STATUS.REJECTED
      }
    });

    await this.auditLogsService.create({
      tenantId,
      actorId,
      action: 'change-request.deleted',
      entityType: 'change-request',
      entityId: id,
      metadata: { referenceNo: existing.referenceNo, status: existing.status }
    });

    return { success: true };
  }

  async listLinks(tenantId: string, changeId: string) {
    await this.ensureChangeExists(tenantId, changeId);

    const links = (await getChangeRequestLinkDelegate(this.prisma).findMany({
      where: { tenantId, changeId },
      orderBy: [{ linkType: 'asc' }, { createdAt: 'desc' }]
    })) as ChangeLinkRecord[];

    return this.decorateLinks(tenantId, links);
  }

  async addLink(tenantId: string, actorId: string, changeId: string, dto: CreateChangeRequestLinkDto) {
    await this.ensureChangeExists(tenantId, changeId);
    await this.ensureLinkTargetExists(tenantId, dto.linkType, dto.linkedId);

    try {
      const link = (await getChangeRequestLinkDelegate(this.prisma).create({
        data: {
          tenantId,
          changeId,
          linkType: dto.linkType,
          linkedId: dto.linkedId,
          note: this.normalizeText(dto.note),
          createdById: actorId
        }
      })) as ChangeLinkRecord;

      await this.auditLogsService.create({
        tenantId,
        actorId,
        action: 'change-request.linked',
        entityType: 'change-request',
        entityId: changeId,
        metadata: dto
      });

      const [summary] = await this.decorateLinks(tenantId, [link]);
      return summary;
    } catch {
      throw new ConflictException('This record is already linked to the selected change request.');
    }
  }

  async removeLink(tenantId: string, actorId: string, changeId: string, linkId: string) {
    const link = (await getChangeRequestLinkDelegate(this.prisma).findFirst({
      where: { tenantId, changeId, id: linkId }
    })) as ChangeLinkRecord | null;

    if (!link) {
      throw new NotFoundException('Change request link not found');
    }

    await getChangeRequestLinkDelegate(this.prisma).delete({ where: { id: link.id } });

    await this.auditLogsService.create({
      tenantId,
      actorId,
      action: 'change-request.unlinked',
      entityType: 'change-request',
      entityId: changeId,
      metadata: { linkType: link.linkType, linkedId: link.linkedId }
    });

    return { success: true };
  }

  private async decorateLinks(tenantId: string, links: ChangeLinkRecord[]): Promise<ChangeLinkSummary[]> {
    const byType = new Map<ChangeRequestLinkTypeValue, string[]>();
    for (const link of links) {
      const values = byType.get(link.linkType) ?? [];
      values.push(link.linkedId);
      byType.set(link.linkType, values);
    }

    const processes = byType.has(CHANGE_LINK_TYPE.PROCESS)
      ? await this.prisma.processRegister.findMany({
          where: { tenantId, id: { in: byType.get(CHANGE_LINK_TYPE.PROCESS)! }, deletedAt: null },
          select: { id: true, referenceNo: true, name: true, status: true }
        })
      : [];
    const risks = byType.has(CHANGE_LINK_TYPE.RISK)
      ? await this.prisma.risk.findMany({
          where: { tenantId, id: { in: byType.get(CHANGE_LINK_TYPE.RISK)! }, deletedAt: null },
          select: { id: true, title: true, score: true, status: true }
        })
      : [];
    const actions = byType.has(CHANGE_LINK_TYPE.ACTION)
      ? await this.prisma.actionItem.findMany({
          where: { tenantId, id: { in: byType.get(CHANGE_LINK_TYPE.ACTION)! }, deletedAt: null },
          select: { id: true, title: true, status: true, dueDate: true }
        })
      : [];
    const documents = byType.has(CHANGE_LINK_TYPE.DOCUMENT)
      ? await this.prisma.document.findMany({
          where: { tenantId, id: { in: byType.get(CHANGE_LINK_TYPE.DOCUMENT)! }, deletedAt: null },
          select: { id: true, code: true, title: true, status: true }
        })
      : [];
    const obligations = byType.has(CHANGE_LINK_TYPE.OBLIGATION)
      ? await this.prisma.complianceObligation.findMany({
          where: { tenantId, id: { in: byType.get(CHANGE_LINK_TYPE.OBLIGATION)! }, deletedAt: null },
          select: { id: true, referenceNo: true, title: true, status: true }
        })
      : [];
    const providers = byType.has(CHANGE_LINK_TYPE.PROVIDER)
      ? await this.prisma.externalProviderControl.findMany({
          where: { tenantId, id: { in: byType.get(CHANGE_LINK_TYPE.PROVIDER)! }, deletedAt: null },
          select: { id: true, referenceNo: true, providerName: true, status: true }
        })
      : [];

    const processMap = new Map(processes.map((item) => [item.id, item]));
    const riskMap = new Map(risks.map((item) => [item.id, item]));
    const actionMap = new Map(actions.map((item) => [item.id, item]));
    const documentMap = new Map(documents.map((item) => [item.id, item]));
    const obligationMap = new Map(obligations.map((item) => [item.id, item]));
    const providerMap = new Map(providers.map((item) => [item.id, item]));

    return links.map((link) => {
      if (link.linkType === CHANGE_LINK_TYPE.PROCESS) {
        const target = processMap.get(link.linkedId);
        return this.makeLinkSummary(link, target ? `${target.referenceNo || 'Uncoded'} - ${target.name}` : 'Linked process unavailable', target ? 'Owning process' : null, target?.status ?? null, target ? `/process-register/${target.id}` : null, !target);
      }
      if (link.linkType === CHANGE_LINK_TYPE.RISK) {
        const target = riskMap.get(link.linkedId);
        return this.makeLinkSummary(link, target ? target.title : 'Linked risk unavailable', target ? `Risk score ${target.score}` : null, target?.status ?? null, target ? `/risks/${target.id}` : null, !target);
      }
      if (link.linkType === CHANGE_LINK_TYPE.ACTION) {
        const target = actionMap.get(link.linkedId);
        return this.makeLinkSummary(link, target ? target.title : 'Linked action unavailable', target?.dueDate ? `Due ${target.dueDate.toISOString().slice(0, 10)}` : null, target?.status ?? null, target ? '/actions' : null, !target);
      }
      if (link.linkType === CHANGE_LINK_TYPE.DOCUMENT) {
        const target = documentMap.get(link.linkedId);
        return this.makeLinkSummary(link, target ? `${target.code} - ${target.title}` : 'Linked document unavailable', target ? 'Controlled document' : null, target?.status ?? null, target ? `/documents/${target.id}` : null, !target);
      }
      if (link.linkType === CHANGE_LINK_TYPE.OBLIGATION) {
        const target = obligationMap.get(link.linkedId);
        return this.makeLinkSummary(link, target ? `${target.referenceNo || 'Uncoded'} - ${target.title}` : 'Linked obligation unavailable', target ? 'Compliance obligation' : null, target?.status ?? null, target ? `/compliance-obligations/${target.id}` : null, !target);
      }

      const target = providerMap.get(link.linkedId);
      return this.makeLinkSummary(link, target ? `${target.referenceNo || 'Uncoded'} - ${target.providerName}` : 'Linked provider unavailable', target ? 'External provider' : null, target?.status ?? null, target ? `/external-providers/${target.id}` : null, !target);
    });
  }

  private makeLinkSummary(
    link: ChangeLinkRecord,
    title: string,
    subtitle: string | null,
    status: string | null,
    path: string | null,
    missing: boolean
  ): ChangeLinkSummary {
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

  private async ensureChangeExists(tenantId: string, id: string) {
    const item = (await getChangeRequestDelegate(this.prisma).findFirst({
      where: { tenantId, id, deletedAt: null },
      select: { id: true }
    })) as { id: string } | null;

    if (!item) {
      throw new NotFoundException('Change request not found');
    }
  }

  private async ensureOwnerBelongsToTenant(tenantId: string, ownerUserId?: string) {
    if (!ownerUserId) return;
    const owner = await this.prisma.user.findFirst({
      where: { tenantId, id: ownerUserId, isActive: true },
      select: { id: true }
    });
    if (!owner) {
      throw new BadRequestException('Selected change owner is not active in this tenant');
    }
  }

  private async assertReferenceAvailable(tenantId: string, referenceNo?: string, excludeId?: string) {
    const normalized = this.normalizeText(referenceNo);
    if (!normalized) return;

    const existing = (await getChangeRequestDelegate(this.prisma).findFirst({
      where: {
        tenantId,
        referenceNo: normalized,
        deletedAt: null,
        id: excludeId ? { not: excludeId } : undefined
      },
      select: { id: true }
    })) as { id: string } | null;

    if (existing) {
      throw new ConflictException('A change request with this reference number already exists.');
    }
  }

  private async loadOwners(tenantId: string, items: ChangeRecord[]) {
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

  private async ensureLinkTargetExists(tenantId: string, linkType: ChangeRequestLinkTypeValue, linkedId: string) {
    if (linkType === CHANGE_LINK_TYPE.PROCESS) {
      const target = await this.prisma.processRegister.findFirst({ where: { tenantId, id: linkedId, deletedAt: null }, select: { id: true } });
      if (!target) throw new BadRequestException('Selected process could not be found in this tenant');
      return;
    }
    if (linkType === CHANGE_LINK_TYPE.RISK) {
      const target = await this.prisma.risk.findFirst({ where: { tenantId, id: linkedId, deletedAt: null }, select: { id: true } });
      if (!target) throw new BadRequestException('Selected risk could not be found in this tenant');
      return;
    }
    if (linkType === CHANGE_LINK_TYPE.ACTION) {
      const target = await this.prisma.actionItem.findFirst({ where: { tenantId, id: linkedId, deletedAt: null }, select: { id: true } });
      if (!target) throw new BadRequestException('Selected action could not be found in this tenant');
      return;
    }
    if (linkType === CHANGE_LINK_TYPE.DOCUMENT) {
      const target = await this.prisma.document.findFirst({ where: { tenantId, id: linkedId, deletedAt: null }, select: { id: true } });
      if (!target) throw new BadRequestException('Selected document could not be found in this tenant');
      return;
    }
    if (linkType === CHANGE_LINK_TYPE.OBLIGATION) {
      const target = await this.prisma.complianceObligation.findFirst({ where: { tenantId, id: linkedId, deletedAt: null }, select: { id: true } });
      if (!target) throw new BadRequestException('Selected obligation could not be found in this tenant');
      return;
    }

    const target = await this.prisma.externalProviderControl.findFirst({ where: { tenantId, id: linkedId, deletedAt: null }, select: { id: true } });
    if (!target) throw new BadRequestException('Selected provider could not be found in this tenant');
  }

  private parseDate(value?: string | null, message = 'Date is invalid') {
    if (!value) return null;
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) {
      throw new BadRequestException(message);
    }
    return parsed;
  }

  private normalizeText(value?: string | null) {
    const trimmed = value?.trim();
    return trimmed ? trimmed : null;
  }
}
