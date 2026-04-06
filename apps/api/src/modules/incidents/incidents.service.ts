import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { getIncidentDelegate, getIncidentLinkDelegate } from '../../common/prisma/prisma-delegate-compat';
import { PrismaService } from '../../common/prisma/prisma.service';
import { AuditLogsService } from '../audit-logs/audit-logs.service';
import { CreateIncidentDto, IncidentRcaMethodValue, IncidentStatusValue, IncidentTypeValue } from './dto/create-incident.dto';
import { CreateIncidentLinkDto, IncidentLinkTypeValue } from './dto/create-incident-link.dto';
import { UpdateIncidentDto } from './dto/update-incident.dto';

type IncidentRecord = {
  id: string;
  tenantId: string;
  referenceNo: string | null;
  title: string;
  type: IncidentTypeValue;
  category: string;
  description: string;
  eventDate: Date;
  location: string | null;
  ownerUserId: string | null;
  severity: string;
  immediateAction: string | null;
  investigationSummary: string | null;
  rootCause: string | null;
  rcaMethod: IncidentRcaMethodValue | null;
  correctiveActionSummary: string | null;
  status: IncidentStatusValue;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
  deletedById: string | null;
};

type IncidentLinkRecord = {
  id: string;
  tenantId: string;
  incidentId: string;
  linkType: IncidentLinkTypeValue;
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

type IncidentLinkSummary = {
  id: string;
  linkType: IncidentLinkTypeValue;
  linkedId: string;
  note: string | null;
  createdAt: Date;
  path: string | null;
  title: string;
  subtitle: string | null;
  status: string | null;
  missing: boolean;
};

const INCIDENT_STATUS = {
  REPORTED: 'REPORTED' as IncidentStatusValue,
  ARCHIVED: 'ARCHIVED' as IncidentStatusValue
};

const INCIDENT_LINK_TYPE = {
  PROCESS: 'PROCESS' as IncidentLinkTypeValue,
  RISK: 'RISK' as IncidentLinkTypeValue,
  ACTION: 'ACTION' as IncidentLinkTypeValue
};

@Injectable()
export class IncidentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLogsService: AuditLogsService
  ) {}

  async list(
    tenantId: string,
    filters: { search?: string; status?: IncidentStatusValue; type?: IncidentTypeValue; ownerUserId?: string } = {}
  ) {
    const items = (await getIncidentDelegate(this.prisma).findMany({
      where: {
        tenantId,
        deletedAt: null,
        status: filters.status,
        type: filters.type,
        ownerUserId: filters.ownerUserId,
        OR: filters.search
          ? [
              { referenceNo: { contains: filters.search, mode: 'insensitive' } },
              { title: { contains: filters.search, mode: 'insensitive' } },
              { description: { contains: filters.search, mode: 'insensitive' } },
              { location: { contains: filters.search, mode: 'insensitive' } }
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
      orderBy: [{ eventDate: 'desc' }, { updatedAt: 'desc' }, { createdAt: 'desc' }]
    })) as Array<IncidentRecord & { _count: { links: number } }>;

    const ownerMap = await this.loadOwners(tenantId, items);

    return items.map((item) => ({
      ...item,
      owner: item.ownerUserId ? ownerMap.get(item.ownerUserId) ?? null : null,
      linkCount: item._count.links
    }));
  }

  async get(tenantId: string, id: string) {
    const item = (await getIncidentDelegate(this.prisma).findFirst({
      where: { tenantId, id, deletedAt: null },
      include: {
        _count: {
          select: {
            links: true
          }
        }
      }
    })) as (IncidentRecord & { _count: { links: number } }) | null;

    if (!item) {
      throw new NotFoundException('Incident not found');
    }

    const ownerMap = await this.loadOwners(tenantId, [item]);

    return {
      ...item,
      owner: item.ownerUserId ? ownerMap.get(item.ownerUserId) ?? null : null,
      linkCount: item._count.links,
      links: await this.listLinks(tenantId, id)
    };
  }

  async create(tenantId: string, actorId: string, dto: CreateIncidentDto) {
    await this.ensureOwnerBelongsToTenant(tenantId, dto.ownerUserId);
    await this.assertReferenceAvailable(tenantId, dto.referenceNo);

    const created = (await getIncidentDelegate(this.prisma).create({
      data: {
        tenantId,
        referenceNo: this.normalizeText(dto.referenceNo),
        title: dto.title.trim(),
        type: dto.type,
        category: dto.category,
        description: dto.description.trim(),
        eventDate: this.parseDate(dto.eventDate, 'Event date is invalid'),
        location: this.normalizeText(dto.location),
        ownerUserId: dto.ownerUserId || null,
        severity: dto.severity,
        immediateAction: this.normalizeText(dto.immediateAction),
        investigationSummary: this.normalizeText(dto.investigationSummary),
        rootCause: this.normalizeText(dto.rootCause),
        rcaMethod: dto.rcaMethod ?? null,
        correctiveActionSummary: this.normalizeText(dto.correctiveActionSummary),
        status: dto.status ?? INCIDENT_STATUS.REPORTED
      }
    })) as IncidentRecord;

    await this.auditLogsService.create({
      tenantId,
      actorId,
      action: 'incident.created',
      entityType: 'incident',
      entityId: created.id,
      metadata: dto
    });

    return this.get(tenantId, created.id);
  }

  async update(tenantId: string, actorId: string, id: string, dto: UpdateIncidentDto) {
    const existing = (await getIncidentDelegate(this.prisma).findFirst({
      where: { tenantId, id, deletedAt: null }
    })) as IncidentRecord | null;

    if (!existing) {
      throw new NotFoundException('Incident not found');
    }

    await this.ensureOwnerBelongsToTenant(tenantId, dto.ownerUserId);
    if (dto.referenceNo !== undefined && this.normalizeText(dto.referenceNo) !== existing.referenceNo) {
      await this.assertReferenceAvailable(tenantId, dto.referenceNo, id);
    }

    await getIncidentDelegate(this.prisma).update({
      where: { id },
      data: {
        referenceNo: dto.referenceNo !== undefined ? this.normalizeText(dto.referenceNo) : undefined,
        title: dto.title !== undefined ? dto.title.trim() : undefined,
        type: dto.type,
        category: dto.category,
        description: dto.description !== undefined ? dto.description.trim() : undefined,
        eventDate: dto.eventDate !== undefined ? this.parseDate(dto.eventDate, 'Event date is invalid') : undefined,
        location: dto.location !== undefined ? this.normalizeText(dto.location) : undefined,
        ownerUserId: dto.ownerUserId !== undefined ? dto.ownerUserId || null : undefined,
        severity: dto.severity,
        immediateAction: dto.immediateAction !== undefined ? this.normalizeText(dto.immediateAction) : undefined,
        investigationSummary: dto.investigationSummary !== undefined ? this.normalizeText(dto.investigationSummary) : undefined,
        rootCause: dto.rootCause !== undefined ? this.normalizeText(dto.rootCause) : undefined,
        rcaMethod: dto.rcaMethod !== undefined ? dto.rcaMethod || null : undefined,
        correctiveActionSummary: dto.correctiveActionSummary !== undefined ? this.normalizeText(dto.correctiveActionSummary) : undefined,
        status: dto.status
      }
    });

    await this.auditLogsService.create({
      tenantId,
      actorId,
      action: 'incident.updated',
      entityType: 'incident',
      entityId: id,
      metadata: dto
    });

    return this.get(tenantId, id);
  }

  async remove(tenantId: string, actorId: string, id: string) {
    const existing = (await getIncidentDelegate(this.prisma).findFirst({
      where: { tenantId, id, deletedAt: null }
    })) as IncidentRecord | null;

    if (!existing) {
      throw new NotFoundException('Incident not found');
    }

    await getIncidentDelegate(this.prisma).update({
      where: { id },
      data: {
        deletedAt: new Date(),
        deletedById: actorId,
        status: INCIDENT_STATUS.ARCHIVED
      }
    });

    await this.auditLogsService.create({
      tenantId,
      actorId,
      action: 'incident.deleted',
      entityType: 'incident',
      entityId: id,
      metadata: { referenceNo: existing.referenceNo, status: existing.status }
    });

    return { success: true };
  }

  async listLinks(tenantId: string, incidentId: string) {
    await this.ensureIncidentExists(tenantId, incidentId);

    const links = (await getIncidentLinkDelegate(this.prisma).findMany({
      where: { tenantId, incidentId },
      orderBy: [{ linkType: 'asc' }, { createdAt: 'desc' }]
    })) as IncidentLinkRecord[];

    return this.decorateLinks(tenantId, links);
  }

  async addLink(tenantId: string, actorId: string, incidentId: string, dto: CreateIncidentLinkDto) {
    await this.ensureIncidentExists(tenantId, incidentId);
    await this.ensureLinkTargetExists(tenantId, dto.linkType, dto.linkedId);

    try {
      const link = (await getIncidentLinkDelegate(this.prisma).create({
        data: {
          tenantId,
          incidentId,
          linkType: dto.linkType,
          linkedId: dto.linkedId,
          note: this.normalizeText(dto.note),
          createdById: actorId
        }
      })) as IncidentLinkRecord;

      await this.auditLogsService.create({
        tenantId,
        actorId,
        action: 'incident.linked',
        entityType: 'incident',
        entityId: incidentId,
        metadata: dto
      });

      const [summary] = await this.decorateLinks(tenantId, [link]);
      return summary;
    } catch {
      throw new ConflictException('This record is already linked to the selected incident.');
    }
  }

  async removeLink(tenantId: string, actorId: string, incidentId: string, linkId: string) {
    const link = (await getIncidentLinkDelegate(this.prisma).findFirst({
      where: { tenantId, incidentId, id: linkId }
    })) as IncidentLinkRecord | null;

    if (!link) {
      throw new NotFoundException('Incident link not found');
    }

    await getIncidentLinkDelegate(this.prisma).delete({
      where: { id: link.id }
    });

    await this.auditLogsService.create({
      tenantId,
      actorId,
      action: 'incident.unlinked',
      entityType: 'incident',
      entityId: incidentId,
      metadata: { linkType: link.linkType, linkedId: link.linkedId }
    });

    return { success: true };
  }

  private async decorateLinks(tenantId: string, links: IncidentLinkRecord[]): Promise<IncidentLinkSummary[]> {
    const byType = new Map<IncidentLinkTypeValue, string[]>();
    for (const link of links) {
      const values = byType.get(link.linkType) ?? [];
      values.push(link.linkedId);
      byType.set(link.linkType, values);
    }

    const processes = byType.has(INCIDENT_LINK_TYPE.PROCESS)
      ? await this.prisma.processRegister.findMany({
          where: { tenantId, id: { in: byType.get(INCIDENT_LINK_TYPE.PROCESS)! }, deletedAt: null },
          select: { id: true, referenceNo: true, name: true, status: true }
        })
      : [];
    const risks = byType.has(INCIDENT_LINK_TYPE.RISK)
      ? await this.prisma.risk.findMany({
          where: { tenantId, id: { in: byType.get(INCIDENT_LINK_TYPE.RISK)! }, deletedAt: null },
          select: { id: true, title: true, status: true, score: true }
        })
      : [];
    const actions = byType.has(INCIDENT_LINK_TYPE.ACTION)
      ? await this.prisma.actionItem.findMany({
          where: { tenantId, id: { in: byType.get(INCIDENT_LINK_TYPE.ACTION)! }, deletedAt: null },
          select: { id: true, title: true, status: true, dueDate: true }
        })
      : [];

    const processMap = new Map(processes.map((item) => [item.id, item]));
    const riskMap = new Map(risks.map((item) => [item.id, item]));
    const actionMap = new Map(actions.map((item) => [item.id, item]));

    return links.map((link) => {
      if (link.linkType === INCIDENT_LINK_TYPE.PROCESS) {
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
      if (link.linkType === INCIDENT_LINK_TYPE.RISK) {
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
    link: IncidentLinkRecord,
    title: string,
    subtitle: string | null,
    status: string | null,
    path: string | null,
    missing: boolean
  ): IncidentLinkSummary {
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

  private async ensureIncidentExists(tenantId: string, id: string) {
    const item = (await getIncidentDelegate(this.prisma).findFirst({
      where: { tenantId, id, deletedAt: null },
      select: { id: true }
    })) as { id: string } | null;

    if (!item) {
      throw new NotFoundException('Incident not found');
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
      throw new BadRequestException('Selected incident owner is not active in this tenant');
    }
  }

  private async assertReferenceAvailable(tenantId: string, referenceNo?: string, excludeId?: string) {
    const normalized = this.normalizeText(referenceNo);
    if (!normalized) {
      return;
    }

    const existing = (await getIncidentDelegate(this.prisma).findFirst({
      where: {
        tenantId,
        referenceNo: normalized,
        deletedAt: null,
        id: excludeId ? { not: excludeId } : undefined
      },
      select: { id: true }
    })) as { id: string } | null;

    if (existing) {
      throw new ConflictException('An incident with this reference number already exists.');
    }
  }

  private async loadOwners(tenantId: string, items: IncidentRecord[]) {
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

  private async ensureLinkTargetExists(tenantId: string, linkType: IncidentLinkTypeValue, linkedId: string) {
    if (linkType === INCIDENT_LINK_TYPE.PROCESS) {
      const target = await this.prisma.processRegister.findFirst({
        where: { tenantId, id: linkedId, deletedAt: null },
        select: { id: true }
      });
      if (!target) throw new BadRequestException('Selected process could not be found in this tenant');
      return;
    }
    if (linkType === INCIDENT_LINK_TYPE.RISK) {
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

  private parseDate(value: string, errorMessage: string) {
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) {
      throw new BadRequestException(errorMessage);
    }
    return parsed;
  }

  private normalizeText(value?: string | null) {
    const trimmed = value?.trim();
    return trimmed ? trimmed : null;
  }
}
