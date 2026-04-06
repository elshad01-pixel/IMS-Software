import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import {
  getIncidentDelegate,
  getHazardIdentificationDelegate,
  getHazardIdentificationLinkDelegate
} from '../../common/prisma/prisma-delegate-compat';
import { PrismaService } from '../../common/prisma/prisma.service';
import { AuditLogsService } from '../audit-logs/audit-logs.service';
import { CreateHazardDto, HazardExposureStageValue, HazardSeverityValue, HazardStatusValue } from './dto/create-hazard.dto';
import { CreateHazardLinkDto, HazardLinkTypeValue } from './dto/create-hazard-link.dto';
import { UpdateHazardDto } from './dto/update-hazard.dto';

type HazardRecord = {
  id: string;
  tenantId: string;
  referenceNo: string | null;
  activity: string;
  hazard: string;
  potentialHarm: string;
  exposureStage: HazardExposureStageValue;
  existingControls: string | null;
  severity: HazardSeverityValue;
  ownerUserId: string | null;
  reviewDate: Date | null;
  status: HazardStatusValue;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
  deletedById: string | null;
};

type HazardLinkRecord = {
  id: string;
  tenantId: string;
  hazardId: string;
  linkType: HazardLinkTypeValue;
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

type HazardLinkSummary = {
  id: string;
  linkType: HazardLinkTypeValue;
  linkedId: string;
  note: string | null;
  createdAt: Date;
  path: string | null;
  title: string;
  subtitle: string | null;
  status: string | null;
  missing: boolean;
};

const HAZARD_STATUS = {
  ACTIVE: 'ACTIVE' as HazardStatusValue,
  MONITORING: 'MONITORING' as HazardStatusValue,
  OBSOLETE: 'OBSOLETE' as HazardStatusValue
};

const HAZARD_LINK_TYPE = {
  PROCESS: 'PROCESS' as HazardLinkTypeValue,
  RISK: 'RISK' as HazardLinkTypeValue,
  ACTION: 'ACTION' as HazardLinkTypeValue,
  INCIDENT: 'INCIDENT' as HazardLinkTypeValue
};

@Injectable()
export class HazardsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLogsService: AuditLogsService
  ) {}

  async list(
    tenantId: string,
    filters: { search?: string; status?: HazardStatusValue; ownerUserId?: string } = {}
  ) {
    const items = (await getHazardIdentificationDelegate(this.prisma).findMany({
      where: {
        tenantId,
        deletedAt: null,
        status: filters.status,
        ownerUserId: filters.ownerUserId,
        OR: filters.search
          ? [
              { referenceNo: { contains: filters.search, mode: 'insensitive' } },
              { activity: { contains: filters.search, mode: 'insensitive' } },
              { hazard: { contains: filters.search, mode: 'insensitive' } },
              { potentialHarm: { contains: filters.search, mode: 'insensitive' } }
            ]
          : undefined
      },
      include: { _count: { select: { links: true } } },
      orderBy: [{ severity: 'desc' }, { reviewDate: 'asc' }, { updatedAt: 'desc' }]
    })) as Array<HazardRecord & { _count: { links: number } }>;

    const ownerMap = await this.loadOwners(tenantId, items);

    return items.map((item) => ({
      ...item,
      owner: item.ownerUserId ? ownerMap.get(item.ownerUserId) ?? null : null,
      linkCount: item._count.links
    }));
  }

  async get(tenantId: string, id: string) {
    const item = (await getHazardIdentificationDelegate(this.prisma).findFirst({
      where: { tenantId, id, deletedAt: null },
      include: { _count: { select: { links: true } } }
    })) as (HazardRecord & { _count: { links: number } }) | null;

    if (!item) {
      throw new NotFoundException('Hazard not found');
    }

    const ownerMap = await this.loadOwners(tenantId, [item]);

    return {
      ...item,
      owner: item.ownerUserId ? ownerMap.get(item.ownerUserId) ?? null : null,
      linkCount: item._count.links,
      links: await this.listLinks(tenantId, id)
    };
  }

  async create(tenantId: string, actorId: string, dto: CreateHazardDto) {
    await this.ensureOwnerBelongsToTenant(tenantId, dto.ownerUserId);
    await this.assertReferenceAvailable(tenantId, dto.referenceNo);

    const created = (await getHazardIdentificationDelegate(this.prisma).create({
      data: {
        tenantId,
        referenceNo: this.normalizeText(dto.referenceNo),
        activity: dto.activity.trim(),
        hazard: dto.hazard.trim(),
        potentialHarm: dto.potentialHarm.trim(),
        exposureStage: dto.exposureStage,
        existingControls: this.normalizeText(dto.existingControls),
        severity: dto.severity,
        ownerUserId: dto.ownerUserId || null,
        reviewDate: this.parseDate(dto.reviewDate),
        status: dto.status ?? HAZARD_STATUS.ACTIVE
      }
    })) as HazardRecord;

    await this.auditLogsService.create({
      tenantId,
      actorId,
      action: 'hazard.created',
      entityType: 'hazard',
      entityId: created.id,
      metadata: dto
    });

    return this.get(tenantId, created.id);
  }

  async update(tenantId: string, actorId: string, id: string, dto: UpdateHazardDto) {
    const existing = (await getHazardIdentificationDelegate(this.prisma).findFirst({
      where: { tenantId, id, deletedAt: null }
    })) as HazardRecord | null;

    if (!existing) {
      throw new NotFoundException('Hazard not found');
    }

    await this.ensureOwnerBelongsToTenant(tenantId, dto.ownerUserId);
    if (dto.referenceNo !== undefined && this.normalizeText(dto.referenceNo) !== existing.referenceNo) {
      await this.assertReferenceAvailable(tenantId, dto.referenceNo, id);
    }

    await getHazardIdentificationDelegate(this.prisma).update({
      where: { id },
      data: {
        referenceNo: dto.referenceNo !== undefined ? this.normalizeText(dto.referenceNo) : undefined,
        activity: dto.activity !== undefined ? dto.activity.trim() : undefined,
        hazard: dto.hazard !== undefined ? dto.hazard.trim() : undefined,
        potentialHarm: dto.potentialHarm !== undefined ? dto.potentialHarm.trim() : undefined,
        exposureStage: dto.exposureStage,
        existingControls: dto.existingControls !== undefined ? this.normalizeText(dto.existingControls) : undefined,
        severity: dto.severity,
        ownerUserId: dto.ownerUserId !== undefined ? dto.ownerUserId || null : undefined,
        reviewDate: dto.reviewDate !== undefined ? this.parseDate(dto.reviewDate) : undefined,
        status: dto.status
      }
    });

    await this.auditLogsService.create({
      tenantId,
      actorId,
      action: 'hazard.updated',
      entityType: 'hazard',
      entityId: id,
      metadata: dto
    });

    return this.get(tenantId, id);
  }

  async remove(tenantId: string, actorId: string, id: string) {
    const existing = (await getHazardIdentificationDelegate(this.prisma).findFirst({
      where: { tenantId, id, deletedAt: null }
    })) as HazardRecord | null;

    if (!existing) {
      throw new NotFoundException('Hazard not found');
    }

    await getHazardIdentificationDelegate(this.prisma).update({
      where: { id },
      data: {
        deletedAt: new Date(),
        deletedById: actorId,
        status: HAZARD_STATUS.OBSOLETE
      }
    });

    await this.auditLogsService.create({
      tenantId,
      actorId,
      action: 'hazard.deleted',
      entityType: 'hazard',
      entityId: id,
      metadata: { referenceNo: existing.referenceNo, status: existing.status }
    });

    return { success: true };
  }

  async listLinks(tenantId: string, hazardId: string) {
    await this.ensureHazardExists(tenantId, hazardId);

    const links = (await getHazardIdentificationLinkDelegate(this.prisma).findMany({
      where: { tenantId, hazardId },
      orderBy: [{ linkType: 'asc' }, { createdAt: 'desc' }]
    })) as HazardLinkRecord[];

    return this.decorateLinks(tenantId, links);
  }

  async addLink(tenantId: string, actorId: string, hazardId: string, dto: CreateHazardLinkDto) {
    await this.ensureHazardExists(tenantId, hazardId);
    await this.ensureLinkTargetExists(tenantId, dto.linkType, dto.linkedId);

    try {
      const link = (await getHazardIdentificationLinkDelegate(this.prisma).create({
        data: {
          tenantId,
          hazardId,
          linkType: dto.linkType,
          linkedId: dto.linkedId,
          note: this.normalizeText(dto.note),
          createdById: actorId
        }
      })) as HazardLinkRecord;

      await this.auditLogsService.create({
        tenantId,
        actorId,
        action: 'hazard.linked',
        entityType: 'hazard',
        entityId: hazardId,
        metadata: dto
      });

      const [summary] = await this.decorateLinks(tenantId, [link]);
      return summary;
    } catch {
      throw new ConflictException('This record is already linked to the selected hazard.');
    }
  }

  async removeLink(tenantId: string, actorId: string, hazardId: string, linkId: string) {
    const link = (await getHazardIdentificationLinkDelegate(this.prisma).findFirst({
      where: { tenantId, hazardId, id: linkId }
    })) as HazardLinkRecord | null;

    if (!link) {
      throw new NotFoundException('Hazard link not found');
    }

    await getHazardIdentificationLinkDelegate(this.prisma).delete({
      where: { id: link.id }
    });

    await this.auditLogsService.create({
      tenantId,
      actorId,
      action: 'hazard.unlinked',
      entityType: 'hazard',
      entityId: hazardId,
      metadata: { linkType: link.linkType, linkedId: link.linkedId }
    });

    return { success: true };
  }

  private async decorateLinks(tenantId: string, links: HazardLinkRecord[]): Promise<HazardLinkSummary[]> {
    const byType = new Map<HazardLinkTypeValue, string[]>();
    for (const link of links) {
      const values = byType.get(link.linkType) ?? [];
      values.push(link.linkedId);
      byType.set(link.linkType, values);
    }

    const processes = byType.has(HAZARD_LINK_TYPE.PROCESS)
      ? await this.prisma.processRegister.findMany({
          where: { tenantId, id: { in: byType.get(HAZARD_LINK_TYPE.PROCESS)! }, deletedAt: null },
          select: { id: true, referenceNo: true, name: true, status: true }
        })
      : [];
    const risks = byType.has(HAZARD_LINK_TYPE.RISK)
      ? await this.prisma.risk.findMany({
          where: { tenantId, id: { in: byType.get(HAZARD_LINK_TYPE.RISK)! }, deletedAt: null },
          select: { id: true, title: true, status: true, score: true }
        })
      : [];
    const actions = byType.has(HAZARD_LINK_TYPE.ACTION)
      ? await this.prisma.actionItem.findMany({
          where: { tenantId, id: { in: byType.get(HAZARD_LINK_TYPE.ACTION)! }, deletedAt: null },
          select: { id: true, title: true, status: true, dueDate: true }
        })
      : [];
    const incidents = byType.has(HAZARD_LINK_TYPE.INCIDENT)
      ? await getIncidentDelegate(this.prisma).findMany({
          where: { tenantId, id: { in: byType.get(HAZARD_LINK_TYPE.INCIDENT)! }, deletedAt: null },
          select: { id: true, referenceNo: true, title: true, type: true, status: true }
        })
      : [];

    const processMap = new Map(processes.map((item) => [item.id, item]));
    const riskMap = new Map(risks.map((item) => [item.id, item]));
    const actionMap = new Map(actions.map((item) => [item.id, item]));
    const incidentMap = new Map(incidents.map((item: any) => [item.id, item]));

    return links.map((link) => {
      if (link.linkType === HAZARD_LINK_TYPE.PROCESS) {
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
      if (link.linkType === HAZARD_LINK_TYPE.RISK) {
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
      if (link.linkType === HAZARD_LINK_TYPE.ACTION) {
        const target = actionMap.get(link.linkedId);
        return this.makeLinkSummary(
          link,
          target ? target.title : 'Linked action unavailable',
          target?.dueDate ? `Due ${target.dueDate.toISOString().slice(0, 10)}` : null,
          target?.status ?? null,
          target ? '/actions' : null,
          !target
        );
      }

      const target = incidentMap.get(link.linkedId);
      return this.makeLinkSummary(
        link,
        target ? `${target.referenceNo || 'Uncoded'} - ${target.title}` : 'Linked incident unavailable',
        target ? target.type.toLowerCase().replace(/_/g, ' ') : null,
        target?.status ?? null,
        target ? `/incidents/${target.id}` : null,
        !target
      );
    });
  }

  private makeLinkSummary(
    link: HazardLinkRecord,
    title: string,
    subtitle: string | null,
    status: string | null,
    path: string | null,
    missing: boolean
  ): HazardLinkSummary {
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

  private async ensureHazardExists(tenantId: string, id: string) {
    const item = (await getHazardIdentificationDelegate(this.prisma).findFirst({
      where: { tenantId, id, deletedAt: null },
      select: { id: true }
    })) as { id: string } | null;

    if (!item) {
      throw new NotFoundException('Hazard not found');
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
      throw new BadRequestException('Selected hazard owner is not active in this tenant');
    }
  }

  private async assertReferenceAvailable(tenantId: string, referenceNo?: string, excludeId?: string) {
    const normalized = this.normalizeText(referenceNo);
    if (!normalized) {
      return;
    }

    const existing = (await getHazardIdentificationDelegate(this.prisma).findFirst({
      where: {
        tenantId,
        referenceNo: normalized,
        deletedAt: null,
        id: excludeId ? { not: excludeId } : undefined
      },
      select: { id: true }
    })) as { id: string } | null;

    if (existing) {
      throw new ConflictException('A hazard with this reference number already exists.');
    }
  }

  private async loadOwners(tenantId: string, items: HazardRecord[]) {
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

  private async ensureLinkTargetExists(tenantId: string, linkType: HazardLinkTypeValue, linkedId: string) {
    if (linkType === HAZARD_LINK_TYPE.PROCESS) {
      const target = await this.prisma.processRegister.findFirst({
        where: { tenantId, id: linkedId, deletedAt: null },
        select: { id: true }
      });
      if (!target) throw new BadRequestException('Selected process could not be found in this tenant');
      return;
    }
    if (linkType === HAZARD_LINK_TYPE.RISK) {
      const target = await this.prisma.risk.findFirst({
        where: { tenantId, id: linkedId, deletedAt: null },
        select: { id: true }
      });
      if (!target) throw new BadRequestException('Selected risk could not be found in this tenant');
      return;
    }
    if (linkType === HAZARD_LINK_TYPE.ACTION) {
      const target = await this.prisma.actionItem.findFirst({
        where: { tenantId, id: linkedId, deletedAt: null },
        select: { id: true }
      });
      if (!target) throw new BadRequestException('Selected action could not be found in this tenant');
      return;
    }

    const target = await getIncidentDelegate(this.prisma).findFirst({
      where: { tenantId, id: linkedId, deletedAt: null },
      select: { id: true }
    });
    if (!target) throw new BadRequestException('Selected incident could not be found in this tenant');
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
