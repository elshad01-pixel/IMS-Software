import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import {
  getEnvironmentalAspectDelegate,
  getEnvironmentalAspectLinkDelegate
} from '../../common/prisma/prisma-delegate-compat';
import { PrismaService } from '../../common/prisma/prisma.service';
import { AuditLogsService } from '../audit-logs/audit-logs.service';
import {
  CreateEnvironmentalAspectDto,
  EnvironmentalAspectSignificanceValue,
  EnvironmentalAspectStageValue,
  EnvironmentalAspectStatusValue
} from './dto/create-environmental-aspect.dto';
import {
  CreateEnvironmentalAspectLinkDto,
  EnvironmentalAspectLinkTypeValue
} from './dto/create-environmental-aspect-link.dto';
import { UpdateEnvironmentalAspectDto } from './dto/update-environmental-aspect.dto';

type AspectRecord = {
  id: string;
  tenantId: string;
  referenceNo: string | null;
  activity: string;
  aspect: string;
  impact: string;
  lifecycleStage: EnvironmentalAspectStageValue;
  controlSummary: string | null;
  significance: EnvironmentalAspectSignificanceValue;
  ownerUserId: string | null;
  reviewDate: Date | null;
  status: EnvironmentalAspectStatusValue;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
  deletedById: string | null;
};

type AspectLinkRecord = {
  id: string;
  tenantId: string;
  aspectId: string;
  linkType: EnvironmentalAspectLinkTypeValue;
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

type AspectLinkSummary = {
  id: string;
  linkType: EnvironmentalAspectLinkTypeValue;
  linkedId: string;
  note: string | null;
  createdAt: Date;
  path: string | null;
  title: string;
  subtitle: string | null;
  status: string | null;
  missing: boolean;
};

const ASPECT_STATUS = {
  ACTIVE: 'ACTIVE' as EnvironmentalAspectStatusValue,
  MONITORING: 'MONITORING' as EnvironmentalAspectStatusValue,
  OBSOLETE: 'OBSOLETE' as EnvironmentalAspectStatusValue
};

const ASPECT_LINK_TYPE = {
  PROCESS: 'PROCESS' as EnvironmentalAspectLinkTypeValue,
  RISK: 'RISK' as EnvironmentalAspectLinkTypeValue,
  ACTION: 'ACTION' as EnvironmentalAspectLinkTypeValue
};

@Injectable()
export class EnvironmentalAspectsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLogsService: AuditLogsService
  ) {}

  async list(
    tenantId: string,
    filters: { search?: string; status?: EnvironmentalAspectStatusValue; ownerUserId?: string } = {}
  ) {
    const items = (await getEnvironmentalAspectDelegate(this.prisma).findMany({
      where: {
        tenantId,
        deletedAt: null,
        status: filters.status,
        ownerUserId: filters.ownerUserId,
        OR: filters.search
          ? [
              { referenceNo: { contains: filters.search, mode: 'insensitive' } },
              { activity: { contains: filters.search, mode: 'insensitive' } },
              { aspect: { contains: filters.search, mode: 'insensitive' } },
              { impact: { contains: filters.search, mode: 'insensitive' } }
            ]
          : undefined
      },
      include: { _count: { select: { links: true } } },
      orderBy: [{ significance: 'desc' }, { reviewDate: 'asc' }, { updatedAt: 'desc' }]
    })) as Array<AspectRecord & { _count: { links: number } }>;

    const ownerMap = await this.loadOwners(tenantId, items);

    return items.map((item) => ({
      ...item,
      owner: item.ownerUserId ? ownerMap.get(item.ownerUserId) ?? null : null,
      linkCount: item._count.links
    }));
  }

  async get(tenantId: string, id: string) {
    const item = (await getEnvironmentalAspectDelegate(this.prisma).findFirst({
      where: { tenantId, id, deletedAt: null },
      include: { _count: { select: { links: true } } }
    })) as (AspectRecord & { _count: { links: number } }) | null;

    if (!item) {
      throw new NotFoundException('Environmental aspect not found');
    }

    const ownerMap = await this.loadOwners(tenantId, [item]);

    return {
      ...item,
      owner: item.ownerUserId ? ownerMap.get(item.ownerUserId) ?? null : null,
      linkCount: item._count.links,
      links: await this.listLinks(tenantId, id)
    };
  }

  async create(tenantId: string, actorId: string, dto: CreateEnvironmentalAspectDto) {
    await this.ensureOwnerBelongsToTenant(tenantId, dto.ownerUserId);
    await this.assertReferenceAvailable(tenantId, dto.referenceNo);

    const created = (await getEnvironmentalAspectDelegate(this.prisma).create({
      data: {
        tenantId,
        referenceNo: this.normalizeText(dto.referenceNo),
        activity: dto.activity.trim(),
        aspect: dto.aspect.trim(),
        impact: dto.impact.trim(),
        lifecycleStage: dto.lifecycleStage,
        controlSummary: this.normalizeText(dto.controlSummary),
        significance: dto.significance,
        ownerUserId: dto.ownerUserId || null,
        reviewDate: this.parseDate(dto.reviewDate),
        status: dto.status ?? ASPECT_STATUS.ACTIVE
      }
    })) as AspectRecord;

    await this.auditLogsService.create({
      tenantId,
      actorId,
      action: 'environmental-aspect.created',
      entityType: 'environmental-aspect',
      entityId: created.id,
      metadata: dto
    });

    return this.get(tenantId, created.id);
  }

  async update(tenantId: string, actorId: string, id: string, dto: UpdateEnvironmentalAspectDto) {
    const existing = (await getEnvironmentalAspectDelegate(this.prisma).findFirst({
      where: { tenantId, id, deletedAt: null }
    })) as AspectRecord | null;

    if (!existing) {
      throw new NotFoundException('Environmental aspect not found');
    }

    await this.ensureOwnerBelongsToTenant(tenantId, dto.ownerUserId);
    if (dto.referenceNo !== undefined && this.normalizeText(dto.referenceNo) !== existing.referenceNo) {
      await this.assertReferenceAvailable(tenantId, dto.referenceNo, id);
    }

    await getEnvironmentalAspectDelegate(this.prisma).update({
      where: { id },
      data: {
        referenceNo: dto.referenceNo !== undefined ? this.normalizeText(dto.referenceNo) : undefined,
        activity: dto.activity !== undefined ? dto.activity.trim() : undefined,
        aspect: dto.aspect !== undefined ? dto.aspect.trim() : undefined,
        impact: dto.impact !== undefined ? dto.impact.trim() : undefined,
        lifecycleStage: dto.lifecycleStage,
        controlSummary: dto.controlSummary !== undefined ? this.normalizeText(dto.controlSummary) : undefined,
        significance: dto.significance,
        ownerUserId: dto.ownerUserId !== undefined ? dto.ownerUserId || null : undefined,
        reviewDate: dto.reviewDate !== undefined ? this.parseDate(dto.reviewDate) : undefined,
        status: dto.status
      }
    });

    await this.auditLogsService.create({
      tenantId,
      actorId,
      action: 'environmental-aspect.updated',
      entityType: 'environmental-aspect',
      entityId: id,
      metadata: dto
    });

    return this.get(tenantId, id);
  }

  async remove(tenantId: string, actorId: string, id: string) {
    const existing = (await getEnvironmentalAspectDelegate(this.prisma).findFirst({
      where: { tenantId, id, deletedAt: null }
    })) as AspectRecord | null;

    if (!existing) {
      throw new NotFoundException('Environmental aspect not found');
    }

    await getEnvironmentalAspectDelegate(this.prisma).update({
      where: { id },
      data: {
        deletedAt: new Date(),
        deletedById: actorId,
        status: ASPECT_STATUS.OBSOLETE
      }
    });

    await this.auditLogsService.create({
      tenantId,
      actorId,
      action: 'environmental-aspect.deleted',
      entityType: 'environmental-aspect',
      entityId: id,
      metadata: { referenceNo: existing.referenceNo, status: existing.status }
    });

    return { success: true };
  }

  async listLinks(tenantId: string, aspectId: string) {
    await this.ensureAspectExists(tenantId, aspectId);

    const links = (await getEnvironmentalAspectLinkDelegate(this.prisma).findMany({
      where: { tenantId, aspectId },
      orderBy: [{ linkType: 'asc' }, { createdAt: 'desc' }]
    })) as AspectLinkRecord[];

    return this.decorateLinks(tenantId, links);
  }

  async addLink(tenantId: string, actorId: string, aspectId: string, dto: CreateEnvironmentalAspectLinkDto) {
    await this.ensureAspectExists(tenantId, aspectId);
    await this.ensureLinkTargetExists(tenantId, dto.linkType, dto.linkedId);

    try {
      const link = (await getEnvironmentalAspectLinkDelegate(this.prisma).create({
        data: {
          tenantId,
          aspectId,
          linkType: dto.linkType,
          linkedId: dto.linkedId,
          note: this.normalizeText(dto.note),
          createdById: actorId
        }
      })) as AspectLinkRecord;

      await this.auditLogsService.create({
        tenantId,
        actorId,
        action: 'environmental-aspect.linked',
        entityType: 'environmental-aspect',
        entityId: aspectId,
        metadata: dto
      });

      const [summary] = await this.decorateLinks(tenantId, [link]);
      return summary;
    } catch {
      throw new ConflictException('This record is already linked to the selected environmental aspect.');
    }
  }

  async removeLink(tenantId: string, actorId: string, aspectId: string, linkId: string) {
    const link = (await getEnvironmentalAspectLinkDelegate(this.prisma).findFirst({
      where: { tenantId, aspectId, id: linkId }
    })) as AspectLinkRecord | null;

    if (!link) {
      throw new NotFoundException('Environmental aspect link not found');
    }

    await getEnvironmentalAspectLinkDelegate(this.prisma).delete({
      where: { id: link.id }
    });

    await this.auditLogsService.create({
      tenantId,
      actorId,
      action: 'environmental-aspect.unlinked',
      entityType: 'environmental-aspect',
      entityId: aspectId,
      metadata: { linkType: link.linkType, linkedId: link.linkedId }
    });

    return { success: true };
  }

  private async decorateLinks(tenantId: string, links: AspectLinkRecord[]): Promise<AspectLinkSummary[]> {
    const byType = new Map<EnvironmentalAspectLinkTypeValue, string[]>();
    for (const link of links) {
      const values = byType.get(link.linkType) ?? [];
      values.push(link.linkedId);
      byType.set(link.linkType, values);
    }

    const processes = byType.has(ASPECT_LINK_TYPE.PROCESS)
      ? await this.prisma.processRegister.findMany({
          where: { tenantId, id: { in: byType.get(ASPECT_LINK_TYPE.PROCESS)! }, deletedAt: null },
          select: { id: true, referenceNo: true, name: true, status: true }
        })
      : [];
    const risks = byType.has(ASPECT_LINK_TYPE.RISK)
      ? await this.prisma.risk.findMany({
          where: { tenantId, id: { in: byType.get(ASPECT_LINK_TYPE.RISK)! }, deletedAt: null },
          select: { id: true, title: true, status: true, score: true }
        })
      : [];
    const actions = byType.has(ASPECT_LINK_TYPE.ACTION)
      ? await this.prisma.actionItem.findMany({
          where: { tenantId, id: { in: byType.get(ASPECT_LINK_TYPE.ACTION)! }, deletedAt: null },
          select: { id: true, title: true, status: true, dueDate: true }
        })
      : [];

    const processMap = new Map(processes.map((item) => [item.id, item]));
    const riskMap = new Map(risks.map((item) => [item.id, item]));
    const actionMap = new Map(actions.map((item) => [item.id, item]));

    return links.map((link) => {
      if (link.linkType === ASPECT_LINK_TYPE.PROCESS) {
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
      if (link.linkType === ASPECT_LINK_TYPE.RISK) {
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
    link: AspectLinkRecord,
    title: string,
    subtitle: string | null,
    status: string | null,
    path: string | null,
    missing: boolean
  ): AspectLinkSummary {
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

  private async ensureAspectExists(tenantId: string, id: string) {
    const item = (await getEnvironmentalAspectDelegate(this.prisma).findFirst({
      where: { tenantId, id, deletedAt: null },
      select: { id: true }
    })) as { id: string } | null;

    if (!item) {
      throw new NotFoundException('Environmental aspect not found');
    }
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
      throw new BadRequestException('Selected environmental aspect owner is not active in this tenant');
    }
  }

  private async assertReferenceAvailable(tenantId: string, referenceNo?: string, excludeId?: string) {
    const normalized = this.normalizeText(referenceNo);
    if (!normalized) {
      return;
    }

    const existing = (await getEnvironmentalAspectDelegate(this.prisma).findFirst({
      where: {
        tenantId,
        referenceNo: normalized,
        deletedAt: null,
        id: excludeId ? { not: excludeId } : undefined
      },
      select: { id: true }
    })) as { id: string } | null;

    if (existing) {
      throw new ConflictException('An environmental aspect with this reference number already exists.');
    }
  }

  private async loadOwners(tenantId: string, items: AspectRecord[]) {
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
    linkType: EnvironmentalAspectLinkTypeValue,
    linkedId: string
  ) {
    if (linkType === ASPECT_LINK_TYPE.PROCESS) {
      const target = await this.prisma.processRegister.findFirst({
        where: { tenantId, id: linkedId, deletedAt: null },
        select: { id: true }
      });
      if (!target) throw new BadRequestException('Selected process could not be found in this tenant');
      return;
    }
    if (linkType === ASPECT_LINK_TYPE.RISK) {
      const target = await this.prisma.risk.findFirst({
        where: { tenantId, id: linkedId, deletedAt: null },
        select: { id: true }
      });
      if (!target) throw new BadRequestException('Selected risk could not be found in this tenant');
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
      throw new BadRequestException('Review date is invalid');
    }
    return parsed;
  }

  private normalizeText(value?: string | null) {
    const trimmed = value?.trim();
    return trimmed ? trimmed : null;
  }
}
