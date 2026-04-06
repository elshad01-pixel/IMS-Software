import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import {
  getEmergencyPreparednessDelegate,
  getEmergencyPreparednessLinkDelegate,
  getIncidentDelegate
} from '../../common/prisma/prisma-delegate-compat';
import { PrismaService } from '../../common/prisma/prisma.service';
import { AuditLogsService } from '../audit-logs/audit-logs.service';
import {
  CreateEmergencyPreparednessDto,
  EmergencyPreparednessStatusValue,
  EmergencyPreparednessTypeValue
} from './dto/create-emergency-preparedness.dto';
import {
  CreateEmergencyPreparednessLinkDto,
  EmergencyPreparednessLinkTypeValue
} from './dto/create-emergency-preparedness-link.dto';
import { UpdateEmergencyPreparednessDto } from './dto/update-emergency-preparedness.dto';

type EmergencyRecord = {
  id: string;
  tenantId: string;
  referenceNo: string | null;
  scenario: string;
  emergencyType: EmergencyPreparednessTypeValue;
  potentialImpact: string;
  responseSummary: string | null;
  resourceSummary: string | null;
  ownerUserId: string | null;
  drillFrequencyMonths: number | null;
  nextDrillDate: Date | null;
  status: EmergencyPreparednessStatusValue;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
  deletedById: string | null;
};

type EmergencyLinkRecord = {
  id: string;
  tenantId: string;
  emergencyId: string;
  linkType: EmergencyPreparednessLinkTypeValue;
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

type EmergencyLinkSummary = {
  id: string;
  linkType: EmergencyPreparednessLinkTypeValue;
  linkedId: string;
  note: string | null;
  createdAt: Date;
  path: string | null;
  title: string;
  subtitle: string | null;
  status: string | null;
  missing: boolean;
};

const EMERGENCY_STATUS = {
  ACTIVE: 'ACTIVE' as EmergencyPreparednessStatusValue,
  MONITORING: 'MONITORING' as EmergencyPreparednessStatusValue,
  OBSOLETE: 'OBSOLETE' as EmergencyPreparednessStatusValue
};

const EMERGENCY_LINK_TYPE = {
  PROCESS: 'PROCESS' as EmergencyPreparednessLinkTypeValue,
  RISK: 'RISK' as EmergencyPreparednessLinkTypeValue,
  ACTION: 'ACTION' as EmergencyPreparednessLinkTypeValue,
  INCIDENT: 'INCIDENT' as EmergencyPreparednessLinkTypeValue
};

@Injectable()
export class EmergencyPreparednessService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLogsService: AuditLogsService
  ) {}

  async list(
    tenantId: string,
    filters: { search?: string; status?: EmergencyPreparednessStatusValue; ownerUserId?: string } = {}
  ) {
    const items = (await getEmergencyPreparednessDelegate(this.prisma).findMany({
      where: {
        tenantId,
        deletedAt: null,
        status: filters.status,
        ownerUserId: filters.ownerUserId,
        OR: filters.search
          ? [
              { referenceNo: { contains: filters.search, mode: 'insensitive' } },
              { scenario: { contains: filters.search, mode: 'insensitive' } },
              { potentialImpact: { contains: filters.search, mode: 'insensitive' } }
            ]
          : undefined
      },
      include: { _count: { select: { links: true } } },
      orderBy: [{ nextDrillDate: 'asc' }, { updatedAt: 'desc' }]
    })) as Array<EmergencyRecord & { _count: { links: number } }>;

    const ownerMap = await this.loadOwners(tenantId, items);

    return items.map((item) => ({
      ...item,
      owner: item.ownerUserId ? ownerMap.get(item.ownerUserId) ?? null : null,
      linkCount: item._count.links
    }));
  }

  async get(tenantId: string, id: string) {
    const item = (await getEmergencyPreparednessDelegate(this.prisma).findFirst({
      where: { tenantId, id, deletedAt: null },
      include: { _count: { select: { links: true } } }
    })) as (EmergencyRecord & { _count: { links: number } }) | null;

    if (!item) {
      throw new NotFoundException('Emergency preparedness record not found');
    }

    const ownerMap = await this.loadOwners(tenantId, [item]);

    return {
      ...item,
      owner: item.ownerUserId ? ownerMap.get(item.ownerUserId) ?? null : null,
      linkCount: item._count.links,
      links: await this.listLinks(tenantId, id)
    };
  }

  async create(tenantId: string, actorId: string, dto: CreateEmergencyPreparednessDto) {
    await this.ensureOwnerBelongsToTenant(tenantId, dto.ownerUserId);
    await this.assertReferenceAvailable(tenantId, dto.referenceNo);

    const created = (await getEmergencyPreparednessDelegate(this.prisma).create({
      data: {
        tenantId,
        referenceNo: this.normalizeText(dto.referenceNo),
        scenario: dto.scenario.trim(),
        emergencyType: dto.emergencyType,
        potentialImpact: dto.potentialImpact.trim(),
        responseSummary: this.normalizeText(dto.responseSummary),
        resourceSummary: this.normalizeText(dto.resourceSummary),
        ownerUserId: dto.ownerUserId || null,
        drillFrequencyMonths: dto.drillFrequencyMonths ?? null,
        nextDrillDate: this.parseDate(dto.nextDrillDate),
        status: dto.status ?? EMERGENCY_STATUS.ACTIVE
      }
    })) as EmergencyRecord;

    await this.auditLogsService.create({
      tenantId,
      actorId,
      action: 'emergency-preparedness.created',
      entityType: 'emergency-preparedness',
      entityId: created.id,
      metadata: dto
    });

    return this.get(tenantId, created.id);
  }

  async update(tenantId: string, actorId: string, id: string, dto: UpdateEmergencyPreparednessDto) {
    const existing = (await getEmergencyPreparednessDelegate(this.prisma).findFirst({
      where: { tenantId, id, deletedAt: null }
    })) as EmergencyRecord | null;

    if (!existing) {
      throw new NotFoundException('Emergency preparedness record not found');
    }

    await this.ensureOwnerBelongsToTenant(tenantId, dto.ownerUserId);
    if (dto.referenceNo !== undefined && this.normalizeText(dto.referenceNo) !== existing.referenceNo) {
      await this.assertReferenceAvailable(tenantId, dto.referenceNo, id);
    }

    await getEmergencyPreparednessDelegate(this.prisma).update({
      where: { id },
      data: {
        referenceNo: dto.referenceNo !== undefined ? this.normalizeText(dto.referenceNo) : undefined,
        scenario: dto.scenario !== undefined ? dto.scenario.trim() : undefined,
        emergencyType: dto.emergencyType,
        potentialImpact: dto.potentialImpact !== undefined ? dto.potentialImpact.trim() : undefined,
        responseSummary: dto.responseSummary !== undefined ? this.normalizeText(dto.responseSummary) : undefined,
        resourceSummary: dto.resourceSummary !== undefined ? this.normalizeText(dto.resourceSummary) : undefined,
        ownerUserId: dto.ownerUserId !== undefined ? dto.ownerUserId || null : undefined,
        drillFrequencyMonths: dto.drillFrequencyMonths !== undefined ? dto.drillFrequencyMonths ?? null : undefined,
        nextDrillDate: dto.nextDrillDate !== undefined ? this.parseDate(dto.nextDrillDate) : undefined,
        status: dto.status
      }
    });

    await this.auditLogsService.create({
      tenantId,
      actorId,
      action: 'emergency-preparedness.updated',
      entityType: 'emergency-preparedness',
      entityId: id,
      metadata: dto
    });

    return this.get(tenantId, id);
  }

  async remove(tenantId: string, actorId: string, id: string) {
    const existing = (await getEmergencyPreparednessDelegate(this.prisma).findFirst({
      where: { tenantId, id, deletedAt: null }
    })) as EmergencyRecord | null;

    if (!existing) {
      throw new NotFoundException('Emergency preparedness record not found');
    }

    await getEmergencyPreparednessDelegate(this.prisma).update({
      where: { id },
      data: {
        deletedAt: new Date(),
        deletedById: actorId,
        status: EMERGENCY_STATUS.OBSOLETE
      }
    });

    await this.auditLogsService.create({
      tenantId,
      actorId,
      action: 'emergency-preparedness.deleted',
      entityType: 'emergency-preparedness',
      entityId: id,
      metadata: { referenceNo: existing.referenceNo, status: existing.status }
    });

    return { success: true };
  }

  async listLinks(tenantId: string, emergencyId: string) {
    await this.ensureRecordExists(tenantId, emergencyId);

    const links = (await getEmergencyPreparednessLinkDelegate(this.prisma).findMany({
      where: { tenantId, emergencyId },
      orderBy: [{ linkType: 'asc' }, { createdAt: 'desc' }]
    })) as EmergencyLinkRecord[];

    return this.decorateLinks(tenantId, links);
  }

  async addLink(tenantId: string, actorId: string, emergencyId: string, dto: CreateEmergencyPreparednessLinkDto) {
    await this.ensureRecordExists(tenantId, emergencyId);
    await this.ensureLinkTargetExists(tenantId, dto.linkType, dto.linkedId);

    try {
      const link = (await getEmergencyPreparednessLinkDelegate(this.prisma).create({
        data: {
          tenantId,
          emergencyId,
          linkType: dto.linkType,
          linkedId: dto.linkedId,
          note: this.normalizeText(dto.note),
          createdById: actorId
        }
      })) as EmergencyLinkRecord;

      await this.auditLogsService.create({
        tenantId,
        actorId,
        action: 'emergency-preparedness.linked',
        entityType: 'emergency-preparedness',
        entityId: emergencyId,
        metadata: dto
      });

      const [summary] = await this.decorateLinks(tenantId, [link]);
      return summary;
    } catch {
      throw new ConflictException('This record is already linked to the selected emergency preparedness scenario.');
    }
  }

  async removeLink(tenantId: string, actorId: string, emergencyId: string, linkId: string) {
    const link = (await getEmergencyPreparednessLinkDelegate(this.prisma).findFirst({
      where: { tenantId, emergencyId, id: linkId }
    })) as EmergencyLinkRecord | null;

    if (!link) {
      throw new NotFoundException('Emergency preparedness link not found');
    }

    await getEmergencyPreparednessLinkDelegate(this.prisma).delete({
      where: { id: link.id }
    });

    await this.auditLogsService.create({
      tenantId,
      actorId,
      action: 'emergency-preparedness.unlinked',
      entityType: 'emergency-preparedness',
      entityId: emergencyId,
      metadata: { linkType: link.linkType, linkedId: link.linkedId }
    });

    return { success: true };
  }

  private async decorateLinks(tenantId: string, links: EmergencyLinkRecord[]): Promise<EmergencyLinkSummary[]> {
    const byType = new Map<EmergencyPreparednessLinkTypeValue, string[]>();
    for (const link of links) {
      const values = byType.get(link.linkType) ?? [];
      values.push(link.linkedId);
      byType.set(link.linkType, values);
    }

    const processes = byType.has(EMERGENCY_LINK_TYPE.PROCESS)
      ? await this.prisma.processRegister.findMany({
          where: { tenantId, id: { in: byType.get(EMERGENCY_LINK_TYPE.PROCESS)! }, deletedAt: null },
          select: { id: true, referenceNo: true, name: true, status: true }
        })
      : [];
    const risks = byType.has(EMERGENCY_LINK_TYPE.RISK)
      ? await this.prisma.risk.findMany({
          where: { tenantId, id: { in: byType.get(EMERGENCY_LINK_TYPE.RISK)! }, deletedAt: null },
          select: { id: true, title: true, status: true, score: true }
        })
      : [];
    const actions = byType.has(EMERGENCY_LINK_TYPE.ACTION)
      ? await this.prisma.actionItem.findMany({
          where: { tenantId, id: { in: byType.get(EMERGENCY_LINK_TYPE.ACTION)! }, deletedAt: null },
          select: { id: true, title: true, status: true, dueDate: true }
        })
      : [];
    const incidents = byType.has(EMERGENCY_LINK_TYPE.INCIDENT)
      ? await getIncidentDelegate(this.prisma).findMany({
          where: { tenantId, id: { in: byType.get(EMERGENCY_LINK_TYPE.INCIDENT)! }, deletedAt: null },
          select: { id: true, referenceNo: true, title: true, type: true, status: true }
        })
      : [];

    const processMap = new Map(processes.map((item) => [item.id, item]));
    const riskMap = new Map(risks.map((item) => [item.id, item]));
    const actionMap = new Map(actions.map((item) => [item.id, item]));
    const incidentMap = new Map(incidents.map((item: any) => [item.id, item]));

    return links.map((link) => {
      if (link.linkType === EMERGENCY_LINK_TYPE.PROCESS) {
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
      if (link.linkType === EMERGENCY_LINK_TYPE.RISK) {
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
      if (link.linkType === EMERGENCY_LINK_TYPE.ACTION) {
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
    link: EmergencyLinkRecord,
    title: string,
    subtitle: string | null,
    status: string | null,
    path: string | null,
    missing: boolean
  ): EmergencyLinkSummary {
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

  private async ensureRecordExists(tenantId: string, id: string) {
    const item = (await getEmergencyPreparednessDelegate(this.prisma).findFirst({
      where: { tenantId, id, deletedAt: null },
      select: { id: true }
    })) as { id: string } | null;

    if (!item) {
      throw new NotFoundException('Emergency preparedness record not found');
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
      throw new BadRequestException('Selected emergency preparedness owner is not active in this tenant');
    }
  }

  private async assertReferenceAvailable(tenantId: string, referenceNo?: string, excludeId?: string) {
    const normalized = this.normalizeText(referenceNo);
    if (!normalized) {
      return;
    }

    const existing = (await getEmergencyPreparednessDelegate(this.prisma).findFirst({
      where: {
        tenantId,
        referenceNo: normalized,
        deletedAt: null,
        id: excludeId ? { not: excludeId } : undefined
      },
      select: { id: true }
    })) as { id: string } | null;

    if (existing) {
      throw new ConflictException('An emergency preparedness record with this reference number already exists.');
    }
  }

  private async loadOwners(tenantId: string, items: EmergencyRecord[]) {
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

  private async ensureLinkTargetExists(tenantId: string, linkType: EmergencyPreparednessLinkTypeValue, linkedId: string) {
    if (linkType === EMERGENCY_LINK_TYPE.PROCESS) {
      const target = await this.prisma.processRegister.findFirst({
        where: { tenantId, id: linkedId, deletedAt: null },
        select: { id: true }
      });
      if (!target) throw new BadRequestException('Selected process could not be found in this tenant');
      return;
    }
    if (linkType === EMERGENCY_LINK_TYPE.RISK) {
      const target = await this.prisma.risk.findFirst({
        where: { tenantId, id: linkedId, deletedAt: null },
        select: { id: true }
      });
      if (!target) throw new BadRequestException('Selected risk could not be found in this tenant');
      return;
    }
    if (linkType === EMERGENCY_LINK_TYPE.ACTION) {
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
    if (!value) return null;
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) {
      throw new BadRequestException('Next drill date is invalid');
    }
    return parsed;
  }

  private normalizeText(value?: string | null) {
    const trimmed = value?.trim();
    return trimmed ? trimmed : null;
  }
}
