import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import {
  getProcessRegisterDelegate,
  getProcessRegisterLinkDelegate
} from '../../common/prisma/prisma-delegate-compat';
import { PrismaService } from '../../common/prisma/prisma.service';
import { AuditLogsService } from '../audit-logs/audit-logs.service';
import { CreateProcessLinkDto, ProcessRegisterLinkTypeValue } from './dto/create-process-link.dto';
import { CreateProcessRegisterDto, ProcessRegisterStatusValue } from './dto/create-process-register.dto';
import { UpdateProcessRegisterDto } from './dto/update-process-register.dto';

type ProcessOwnerSummary = {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
};

type ProcessRecord = {
  id: string;
  tenantId: string;
  referenceNo: string | null;
  name: string;
  purpose: string | null;
  ownerUserId: string | null;
  department: string | null;
  scope: string | null;
  inputsText: string | null;
  outputsText: string | null;
  status: ProcessRegisterStatusValue;
  deletedAt: Date | null;
  deletedById: string | null;
  createdAt: Date;
  updatedAt: Date;
};

type LinkRecord = {
  id: string;
  tenantId: string;
  processId: string;
  linkType: ProcessRegisterLinkTypeValue;
  linkedId: string;
  note: string | null;
  createdAt: Date;
  createdById: string | null;
};

type ProcessLinkSummary = {
  id: string;
  linkType: ProcessRegisterLinkTypeValue;
  linkedId: string;
  note: string | null;
  createdAt: Date;
  path: string | null;
  title: string;
  subtitle: string | null;
  status: string | null;
  missing: boolean;
};

const PROCESS_REGISTER_STATUS = {
  ACTIVE: 'ACTIVE' as ProcessRegisterStatusValue,
  ARCHIVED: 'ARCHIVED' as ProcessRegisterStatusValue
};

const PROCESS_REGISTER_LINK_TYPE = {
  DOCUMENT: 'DOCUMENT' as ProcessRegisterLinkTypeValue,
  RISK: 'RISK' as ProcessRegisterLinkTypeValue,
  AUDIT: 'AUDIT' as ProcessRegisterLinkTypeValue,
  KPI: 'KPI' as ProcessRegisterLinkTypeValue,
  ACTION: 'ACTION' as ProcessRegisterLinkTypeValue,
  NCR: 'NCR' as ProcessRegisterLinkTypeValue,
  CONTEXT_ISSUE: 'CONTEXT_ISSUE' as ProcessRegisterLinkTypeValue
};

@Injectable()
export class ProcessRegisterService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLogsService: AuditLogsService
  ) {}

  async list(
    tenantId: string,
    filters: { search?: string; status?: ProcessRegisterStatusValue; ownerUserId?: string } = {}
  ) {
    const items = (await getProcessRegisterDelegate(this.prisma).findMany({
      where: {
        tenantId,
        deletedAt: null,
        status: filters.status,
        ownerUserId: filters.ownerUserId,
        OR: filters.search
          ? [
              { referenceNo: { contains: filters.search, mode: 'insensitive' } },
              { name: { contains: filters.search, mode: 'insensitive' } },
              { purpose: { contains: filters.search, mode: 'insensitive' } },
              { department: { contains: filters.search, mode: 'insensitive' } }
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
      orderBy: [{ updatedAt: 'desc' }, { createdAt: 'desc' }]
    })) as Array<ProcessRecord & { _count: { links: number } }>;

    const ownerMap = await this.loadOwners(tenantId, items);

    return items.map((item) => ({
      ...item,
      owner: item.ownerUserId ? ownerMap.get(item.ownerUserId) ?? null : null,
      linkCount: item._count.links
    }));
  }

  async get(tenantId: string, id: string) {
    const item = (await getProcessRegisterDelegate(this.prisma).findFirst({
      where: { tenantId, id, deletedAt: null },
      include: {
        _count: {
          select: {
            links: true
          }
        }
      }
    })) as (ProcessRecord & { _count: { links: number } }) | null;

    if (!item) {
      throw new NotFoundException('Process not found');
    }

    const ownerMap = await this.loadOwners(tenantId, [item]);

    return {
      ...item,
      owner: item.ownerUserId ? ownerMap.get(item.ownerUserId) ?? null : null,
      linkCount: item._count.links,
      links: await this.listLinks(tenantId, id)
    };
  }

  async create(tenantId: string, actorId: string, dto: CreateProcessRegisterDto) {
    await this.ensureOwnerBelongsToTenant(tenantId, dto.ownerUserId);
    await this.assertReferenceAvailable(tenantId, dto.referenceNo);

    const process = (await getProcessRegisterDelegate(this.prisma).create({
      data: {
        tenantId,
        referenceNo: this.normalizeText(dto.referenceNo),
        name: dto.name.trim(),
        purpose: this.normalizeText(dto.purpose),
        ownerUserId: dto.ownerUserId || null,
        department: this.normalizeText(dto.department),
        scope: this.normalizeText(dto.scope),
        inputsText: this.normalizeText(dto.inputsText),
        outputsText: this.normalizeText(dto.outputsText),
        status: dto.status ?? PROCESS_REGISTER_STATUS.ACTIVE
      }
    })) as ProcessRecord;

    await this.auditLogsService.create({
      tenantId,
      actorId,
      action: 'process.created',
      entityType: 'process-register',
      entityId: process.id,
      metadata: dto
    });

    return this.get(tenantId, process.id);
  }

  async update(tenantId: string, actorId: string, id: string, dto: UpdateProcessRegisterDto) {
    const existing = (await getProcessRegisterDelegate(this.prisma).findFirst({
      where: { tenantId, id, deletedAt: null }
    })) as ProcessRecord | null;

    if (!existing) {
      throw new NotFoundException('Process not found');
    }

    await this.ensureOwnerBelongsToTenant(tenantId, dto.ownerUserId);
    if (dto.referenceNo !== undefined && this.normalizeText(dto.referenceNo) !== existing.referenceNo) {
      await this.assertReferenceAvailable(tenantId, dto.referenceNo, id);
    }

    await getProcessRegisterDelegate(this.prisma).update({
      where: { id },
      data: {
        referenceNo: dto.referenceNo !== undefined ? this.normalizeText(dto.referenceNo) : undefined,
        name: dto.name !== undefined ? dto.name.trim() : undefined,
        purpose: dto.purpose !== undefined ? this.normalizeText(dto.purpose) : undefined,
        ownerUserId: dto.ownerUserId !== undefined ? dto.ownerUserId || null : undefined,
        department: dto.department !== undefined ? this.normalizeText(dto.department) : undefined,
        scope: dto.scope !== undefined ? this.normalizeText(dto.scope) : undefined,
        inputsText: dto.inputsText !== undefined ? this.normalizeText(dto.inputsText) : undefined,
        outputsText: dto.outputsText !== undefined ? this.normalizeText(dto.outputsText) : undefined,
        status: dto.status
      }
    });

    await this.auditLogsService.create({
      tenantId,
      actorId,
      action: 'process.updated',
      entityType: 'process-register',
      entityId: id,
      metadata: dto
    });

    return this.get(tenantId, id);
  }

  async remove(tenantId: string, actorId: string, id: string) {
    const existing = (await getProcessRegisterDelegate(this.prisma).findFirst({
      where: { tenantId, id, deletedAt: null }
    })) as ProcessRecord | null;

    if (!existing) {
      throw new NotFoundException('Process not found');
    }

    await getProcessRegisterDelegate(this.prisma).update({
      where: { id },
      data: {
        deletedAt: new Date(),
        deletedById: actorId,
        status: PROCESS_REGISTER_STATUS.ARCHIVED
      }
    });

    await this.auditLogsService.create({
      tenantId,
      actorId,
      action: 'process.deleted',
      entityType: 'process-register',
      entityId: id,
      metadata: { referenceNo: existing.referenceNo, status: existing.status }
    });

    return { success: true };
  }

  async listLinks(tenantId: string, processId: string) {
    await this.ensureProcessExists(tenantId, processId);

    const links = (await getProcessRegisterLinkDelegate(this.prisma).findMany({
      where: { tenantId, processId },
      orderBy: [{ linkType: 'asc' }, { createdAt: 'desc' }]
    })) as LinkRecord[];

    return this.decorateLinks(tenantId, links);
  }

  async addLink(tenantId: string, actorId: string, processId: string, dto: CreateProcessLinkDto) {
    await this.ensureProcessExists(tenantId, processId);
    await this.ensureLinkTargetExists(tenantId, dto.linkType, dto.linkedId);

    try {
      const link = (await getProcessRegisterLinkDelegate(this.prisma).create({
        data: {
          tenantId,
          processId,
          linkType: dto.linkType,
          linkedId: dto.linkedId,
          note: this.normalizeText(dto.note),
          createdById: actorId
        }
      })) as LinkRecord;

      await this.auditLogsService.create({
        tenantId,
        actorId,
        action: 'process.linked',
        entityType: 'process-register',
        entityId: processId,
        metadata: dto
      });

      const [summary] = await this.decorateLinks(tenantId, [link]);
      return summary;
    } catch {
      throw new ConflictException('This record is already linked to the selected process.');
    }
  }

  async removeLink(tenantId: string, actorId: string, processId: string, linkId: string) {
    const link = (await getProcessRegisterLinkDelegate(this.prisma).findFirst({
      where: { tenantId, processId, id: linkId }
    })) as LinkRecord | null;

    if (!link) {
      throw new NotFoundException('Process link not found');
    }

    await getProcessRegisterLinkDelegate(this.prisma).delete({
      where: { id: link.id }
    });

    await this.auditLogsService.create({
      tenantId,
      actorId,
      action: 'process.unlinked',
      entityType: 'process-register',
      entityId: processId,
      metadata: { linkType: link.linkType, linkedId: link.linkedId }
    });

    return { success: true };
  }

  private async decorateLinks(tenantId: string, links: LinkRecord[]): Promise<ProcessLinkSummary[]> {
    const byType = new Map<ProcessRegisterLinkTypeValue, string[]>();
    for (const link of links) {
      const items = byType.get(link.linkType) ?? [];
      items.push(link.linkedId);
      byType.set(link.linkType, items);
    }

    const documents = byType.has(PROCESS_REGISTER_LINK_TYPE.DOCUMENT)
      ? await this.prisma.document.findMany({
          where: { tenantId, id: { in: byType.get(PROCESS_REGISTER_LINK_TYPE.DOCUMENT)! }, deletedAt: null },
          select: { id: true, code: true, title: true, status: true }
        })
      : [];
    const risks = byType.has(PROCESS_REGISTER_LINK_TYPE.RISK)
      ? await this.prisma.risk.findMany({
          where: { tenantId, id: { in: byType.get(PROCESS_REGISTER_LINK_TYPE.RISK)! }, deletedAt: null },
          select: { id: true, title: true, status: true, score: true }
        })
      : [];
    const audits = byType.has(PROCESS_REGISTER_LINK_TYPE.AUDIT)
      ? await this.prisma.audit.findMany({
          where: { tenantId, id: { in: byType.get(PROCESS_REGISTER_LINK_TYPE.AUDIT)! }, deletedAt: null },
          select: { id: true, code: true, title: true, status: true }
        })
      : [];
    const kpis = byType.has(PROCESS_REGISTER_LINK_TYPE.KPI)
      ? await this.prisma.kpi.findMany({
          where: { tenantId, id: { in: byType.get(PROCESS_REGISTER_LINK_TYPE.KPI)! } },
          select: { id: true, name: true, actual: true, target: true, unit: true }
        })
      : [];
    const actions = byType.has(PROCESS_REGISTER_LINK_TYPE.ACTION)
      ? await this.prisma.actionItem.findMany({
          where: { tenantId, id: { in: byType.get(PROCESS_REGISTER_LINK_TYPE.ACTION)! }, deletedAt: null },
          select: { id: true, title: true, status: true, dueDate: true }
        })
      : [];
    const ncrs = byType.has(PROCESS_REGISTER_LINK_TYPE.NCR)
      ? await this.prisma.ncr.findMany({
          where: { tenantId, id: { in: byType.get(PROCESS_REGISTER_LINK_TYPE.NCR)! }, deletedAt: null },
          select: { id: true, referenceNo: true, title: true, status: true }
        })
      : [];
    const contextIssues = byType.has(PROCESS_REGISTER_LINK_TYPE.CONTEXT_ISSUE)
      ? await this.prisma.contextIssue.findMany({
          where: { tenantId, id: { in: byType.get(PROCESS_REGISTER_LINK_TYPE.CONTEXT_ISSUE)! }, deletedAt: null },
          select: { id: true, type: true, title: true, status: true, category: true }
        })
      : [];

    const documentMap = new Map(documents.map((item) => [item.id, item]));
    const riskMap = new Map(risks.map((item) => [item.id, item]));
    const auditMap = new Map(audits.map((item) => [item.id, item]));
    const kpiMap = new Map(kpis.map((item) => [item.id, item]));
    const actionMap = new Map(actions.map((item) => [item.id, item]));
    const ncrMap = new Map(ncrs.map((item) => [item.id, item]));
    const contextIssueMap = new Map(contextIssues.map((item) => [item.id, item]));

    return links.map((link) => {
      if (link.linkType === PROCESS_REGISTER_LINK_TYPE.DOCUMENT) {
        const target = documentMap.get(link.linkedId);
        return this.makeLinkSummary(link, target ? `${target.code} - ${target.title}` : 'Linked document unavailable', target ? 'Controlled document' : null, target?.status ?? null, target ? `/documents/${target.id}` : null, !target);
      }
      if (link.linkType === PROCESS_REGISTER_LINK_TYPE.RISK) {
        const target = riskMap.get(link.linkedId);
        return this.makeLinkSummary(link, target ? target.title : 'Linked risk unavailable', target ? `Risk score ${target.score}` : null, target?.status ?? null, target ? `/risks/${target.id}` : null, !target);
      }
      if (link.linkType === PROCESS_REGISTER_LINK_TYPE.AUDIT) {
        const target = auditMap.get(link.linkedId);
        return this.makeLinkSummary(link, target ? `${target.code} - ${target.title}` : 'Linked audit unavailable', target ? 'Audit record' : null, target?.status ?? null, target ? `/audits/${target.id}` : null, !target);
      }
      if (link.linkType === PROCESS_REGISTER_LINK_TYPE.KPI) {
        const target = kpiMap.get(link.linkedId);
        return this.makeLinkSummary(link, target ? target.name : 'Linked KPI unavailable', target ? `Actual ${target.actual} ${target.unit} / Target ${target.target} ${target.unit}` : null, null, target ? `/kpis/${target.id}` : null, !target);
      }
      if (link.linkType === PROCESS_REGISTER_LINK_TYPE.ACTION) {
        const target = actionMap.get(link.linkedId);
        return this.makeLinkSummary(link, target ? target.title : 'Linked action unavailable', target?.dueDate ? `Due ${target.dueDate.toISOString().slice(0, 10)}` : null, target?.status ?? null, target ? '/actions' : null, !target);
      }
      if (link.linkType === PROCESS_REGISTER_LINK_TYPE.CONTEXT_ISSUE) {
        const target = contextIssueMap.get(link.linkedId);
        return this.makeLinkSummary(
          link,
          target ? target.title : 'Linked context issue unavailable',
          target ? `${target.type === 'INTERNAL' ? 'Internal issue' : 'External issue'}${target.category ? ` | ${target.category}` : ''}` : null,
          target?.status ?? null,
          target ? (target.type === 'INTERNAL' ? `/context/internal-issues/${target.id}/edit` : `/context/external-issues/${target.id}/edit`) : null,
          !target
        );
      }
      const target = ncrMap.get(link.linkedId);
      return this.makeLinkSummary(link, target ? `${target.referenceNo} - ${target.title}` : 'Linked NCR unavailable', target ? 'Nonconformance' : null, target?.status ?? null, target ? `/ncr/${target.id}` : null, !target);
    });
  }

  private makeLinkSummary(
    link: LinkRecord,
    title: string,
    subtitle: string | null,
    status: string | null,
    path: string | null,
    missing: boolean
  ): ProcessLinkSummary {
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

  private async ensureProcessExists(tenantId: string, id: string) {
    const process = (await getProcessRegisterDelegate(this.prisma).findFirst({
      where: { tenantId, id, deletedAt: null },
      select: { id: true }
    })) as { id: string } | null;

    if (!process) {
      throw new NotFoundException('Process not found');
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
      throw new BadRequestException('Selected process owner is not active in this tenant');
    }
  }

  private async assertReferenceAvailable(tenantId: string, referenceNo?: string, excludeId?: string) {
    const normalized = this.normalizeText(referenceNo);
    if (!normalized) {
      return;
    }

    const existing = (await getProcessRegisterDelegate(this.prisma).findFirst({
      where: {
        tenantId,
        referenceNo: normalized,
        deletedAt: null,
        id: excludeId ? { not: excludeId } : undefined
      },
      select: { id: true }
    })) as { id: string } | null;

    if (existing) {
      throw new ConflictException('A process with this reference number already exists.');
    }
  }

  private async loadOwners(tenantId: string, items: ProcessRecord[]) {
    const ownerIds = Array.from(new Set(items.map((item) => item.ownerUserId).filter(Boolean))) as string[];
    if (!ownerIds.length) {
      return new Map<string, ProcessOwnerSummary>();
    }

    const users = await this.prisma.user.findMany({
      where: { tenantId, id: { in: ownerIds } },
      select: { id: true, firstName: true, lastName: true, email: true }
    });

    return new Map(users.map((user) => [user.id, user]));
  }

  private async ensureLinkTargetExists(
    tenantId: string,
    linkType: ProcessRegisterLinkTypeValue,
    linkedId: string
  ) {
    if (linkType === PROCESS_REGISTER_LINK_TYPE.DOCUMENT) {
      const target = await this.prisma.document.findFirst({ where: { tenantId, id: linkedId, deletedAt: null }, select: { id: true } });
      if (!target) throw new BadRequestException('Selected document could not be found in this tenant');
      return;
    }
    if (linkType === PROCESS_REGISTER_LINK_TYPE.RISK) {
      const target = await this.prisma.risk.findFirst({ where: { tenantId, id: linkedId, deletedAt: null }, select: { id: true } });
      if (!target) throw new BadRequestException('Selected risk could not be found in this tenant');
      return;
    }
    if (linkType === PROCESS_REGISTER_LINK_TYPE.AUDIT) {
      const target = await this.prisma.audit.findFirst({ where: { tenantId, id: linkedId, deletedAt: null }, select: { id: true } });
      if (!target) throw new BadRequestException('Selected audit could not be found in this tenant');
      return;
    }
    if (linkType === PROCESS_REGISTER_LINK_TYPE.KPI) {
      const target = await this.prisma.kpi.findFirst({ where: { tenantId, id: linkedId }, select: { id: true } });
      if (!target) throw new BadRequestException('Selected KPI could not be found in this tenant');
      return;
    }
    if (linkType === PROCESS_REGISTER_LINK_TYPE.ACTION) {
      const target = await this.prisma.actionItem.findFirst({ where: { tenantId, id: linkedId, deletedAt: null }, select: { id: true } });
      if (!target) throw new BadRequestException('Selected action could not be found in this tenant');
      return;
    }
    if (linkType === PROCESS_REGISTER_LINK_TYPE.CONTEXT_ISSUE) {
      const target = await this.prisma.contextIssue.findFirst({ where: { tenantId, id: linkedId, deletedAt: null }, select: { id: true } });
      if (!target) throw new BadRequestException('Selected context issue could not be found in this tenant');
      return;
    }

    const target = await this.prisma.ncr.findFirst({ where: { tenantId, id: linkedId, deletedAt: null }, select: { id: true } });
    if (!target) throw new BadRequestException('Selected NCR could not be found in this tenant');
  }

  private normalizeText(value?: string | null) {
    const trimmed = value?.trim();
    return trimmed ? trimmed : null;
  }
}
