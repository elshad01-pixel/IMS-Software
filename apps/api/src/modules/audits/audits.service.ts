import {
  AuditFindingSeverity,
  AuditFindingStatus,
  AuditStatus,
  CapaStatus,
  Prisma
} from '@prisma/client';
import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException
} from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { AuditLogsService } from '../audit-logs/audit-logs.service';
import { CreateAuditChecklistItemDto } from './dto/create-audit-checklist-item.dto';
import { CreateAuditDto } from './dto/create-audit.dto';
import { CreateAuditFindingDto } from './dto/create-audit-finding.dto';
import { CreateCapaFromFindingDto } from './dto/create-capa-from-finding.dto';
import { UpdateAuditChecklistItemDto } from './dto/update-audit-checklist-item.dto';
import { UpdateAuditDto } from './dto/update-audit.dto';
import { UpdateAuditFindingDto } from './dto/update-audit-finding.dto';

const AUDIT_STATUS_FLOW: Record<AuditStatus, AuditStatus[]> = {
  [AuditStatus.PLANNED]: [AuditStatus.IN_PROGRESS, AuditStatus.CLOSED],
  [AuditStatus.IN_PROGRESS]: [AuditStatus.COMPLETED, AuditStatus.CLOSED],
  [AuditStatus.COMPLETED]: [AuditStatus.CLOSED, AuditStatus.IN_PROGRESS],
  [AuditStatus.CLOSED]: []
};

const ISO_AUDIT_TEMPLATES: Record<string, Array<{ clause: string; title: string }>> = {
  'ISO 9001': [
    { clause: '4', title: 'Context of the organization is defined and monitored.' },
    { clause: '5', title: 'Leadership commitment and quality policy are communicated.' },
    { clause: '6', title: 'Risks, opportunities, and quality objectives are planned.' },
    { clause: '7', title: 'Competence, awareness, and documented information are controlled.' },
    { clause: '8', title: 'Operational planning and service or production controls are effective.' },
    { clause: '9', title: 'Performance evaluation, internal audits, and management review are effective.' },
    { clause: '10', title: 'Nonconformity, corrective action, and improvement are managed.' }
  ],
  'ISO 45001': [
    { clause: '4', title: 'OH&S context, workers, and interested parties are understood.' },
    { clause: '5', title: 'Consultation, participation, and OH&S leadership are demonstrated.' },
    { clause: '6', title: 'Hazard identification and OH&S planning are current.' },
    { clause: '7', title: 'Resources, competence, awareness, and communication support OH&S.' },
    { clause: '8', title: 'Operational controls and emergency preparedness are implemented.' },
    { clause: '9', title: 'Monitoring, evaluation, and internal OH&S audit activities are effective.' },
    { clause: '10', title: 'Incident handling, corrective action, and continual improvement are managed.' }
  ],
  'ISO 14001': [
    { clause: '4', title: 'Environmental context and compliance obligations are identified.' },
    { clause: '5', title: 'Leadership commitment and environmental policy are maintained.' },
    { clause: '6', title: 'Environmental aspects, risks, opportunities, and objectives are planned.' },
    { clause: '7', title: 'Resources, competence, communication, and documented information are adequate.' },
    { clause: '8', title: 'Operational controls and emergency preparedness are implemented.' },
    { clause: '9', title: 'Monitoring, measurement, compliance evaluation, and internal audit are effective.' },
    { clause: '10', title: 'Nonconformity, corrective action, and continual improvement are managed.' }
  ]
};

type ChecklistResponse = 'YES' | 'NO' | 'PARTIAL';
type ExistingAudit = {
  status: AuditStatus;
  type: string;
  standard?: string | null;
  startedAt?: Date | null;
  completedAt?: Date | null;
  checklistItems: Array<{ id: string }>;
};

@Injectable()
export class AuditsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLogsService: AuditLogsService
  ) {}

  async list(tenantId: string) {
    const audits = await this.prisma.audit.findMany({
      where: { tenantId },
      include: {
        checklistItems: true,
        findings: true
      },
      orderBy: [{ scheduledAt: 'desc' }, { updatedAt: 'desc' }]
    });

    return audits.map((audit) => this.mapAuditSummary(audit));
  }

  async get(tenantId: string, id: string) {
    const audit = await this.prisma.audit.findFirst({
      where: { tenantId, id },
      include: {
        checklistItems: {
          orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }]
        },
        findings: {
          orderBy: [{ createdAt: 'desc' }]
        }
      }
    });

    if (!audit) {
      throw new NotFoundException('Audit not found');
    }

    return this.mapAuditSummary(audit);
  }

  async create(tenantId: string, actorId: string, dto: CreateAuditDto) {
    await this.ensureUserBelongsToTenant(tenantId, dto.leadAuditorId);
    this.assertAuditType(dto.type, dto.standard);

    try {
      const audit = await this.prisma.audit.create({
        data: {
          tenantId,
          code: dto.code.trim().toUpperCase(),
          title: dto.title.trim(),
          type: dto.type.trim(),
          standard: this.normalizeText(dto.standard),
          scope: this.normalizeText(dto.scope),
          leadAuditorId: dto.leadAuditorId || null,
          auditeeArea: this.normalizeText(dto.auditeeArea),
          scheduledAt: dto.scheduledAt ? new Date(dto.scheduledAt) : null,
          summary: this.normalizeText(dto.summary),
          status: dto.status ?? AuditStatus.PLANNED
        } as Prisma.AuditUncheckedCreateInput
      });

      if (this.isInternalAudit(dto.type) && dto.standard) {
        await this.seedChecklistTemplate(tenantId, audit.id, dto.standard);
      }

      await this.auditLogsService.create({
        tenantId,
        actorId,
        action: 'audit.created',
        entityType: 'audit',
        entityId: audit.id,
        metadata: dto
      });

      return this.get(tenantId, audit.id);
    } catch (error) {
      this.handleUniqueError(error, 'Audit code already exists in this tenant');
    }
  }

  async update(tenantId: string, actorId: string, id: string, dto: UpdateAuditDto) {
    const existing = await this.prisma.audit.findFirst({
      where: { tenantId, id },
      include: { checklistItems: true }
    }) as ExistingAudit | null;

    if (!existing) {
      throw new NotFoundException('Audit not found');
    }

    await this.ensureUserBelongsToTenant(tenantId, dto.leadAuditorId);
    this.assertValidAuditTransition(existing.status, dto.status ?? existing.status);
    this.assertAuditType(dto.type ?? existing.type, dto.standard ?? existing.standard ?? undefined);

    if ((dto.status ?? existing.status) === AuditStatus.CLOSED) {
      await this.assertAuditReadyForClosure(tenantId, id);
    }

    try {
      const audit = await this.prisma.audit.update({
        where: { id },
        data: {
          code: dto.code ? dto.code.trim().toUpperCase() : undefined,
          title: dto.title?.trim(),
          type: dto.type?.trim(),
          standard: dto.standard !== undefined ? this.normalizeText(dto.standard) : undefined,
          scope: dto.scope !== undefined ? this.normalizeText(dto.scope) : undefined,
          leadAuditorId: dto.leadAuditorId !== undefined ? dto.leadAuditorId || null : undefined,
          auditeeArea:
            dto.auditeeArea !== undefined ? this.normalizeText(dto.auditeeArea) : undefined,
          scheduledAt:
            dto.scheduledAt !== undefined ? (dto.scheduledAt ? new Date(dto.scheduledAt) : null) : undefined,
          startedAt: this.resolveStartedAt(existing.status, dto.status, existing.startedAt),
          completedAt: this.resolveCompletedAt(existing.status, dto.status, existing.completedAt),
          summary: dto.summary !== undefined ? this.normalizeText(dto.summary) : undefined,
          status: dto.status ?? undefined
        } as Prisma.AuditUncheckedUpdateInput
      });

      if (
        this.isInternalAudit(dto.type ?? existing.type) &&
        (dto.standard ?? existing.standard) &&
        existing.checklistItems.length === 0
      ) {
        await this.seedChecklistTemplate(tenantId, audit.id, dto.standard ?? existing.standard!);
      }

      await this.auditLogsService.create({
        tenantId,
        actorId,
        action: 'audit.updated',
        entityType: 'audit',
        entityId: audit.id,
        metadata: dto
      });

      return this.get(tenantId, audit.id);
    } catch (error) {
      this.handleUniqueError(error, 'Audit code already exists in this tenant');
    }
  }

  async addChecklistItem(
    tenantId: string,
    actorId: string,
    auditId: string,
    dto: CreateAuditChecklistItemDto
  ) {
    const audit = await this.requireAudit(tenantId, auditId);

    const checklistItem = await this.prisma.auditChecklistItem.create({
      data: {
        tenantId,
        auditId,
        clause: this.normalizeText(dto.clause),
        standard: this.normalizeText(dto.standard) ?? audit.standard,
        title: dto.title.trim(),
        notes: this.normalizeText(dto.notes),
        response: dto.response as ChecklistResponse | undefined,
        isComplete: dto.isComplete ?? Boolean(dto.response),
        sortOrder: dto.sortOrder ?? 0
      } as Prisma.AuditChecklistItemUncheckedCreateInput
    });

    await this.auditLogsService.create({
      tenantId,
      actorId,
      action: 'audit.checklist-item.created',
      entityType: 'audit',
      entityId: auditId,
      metadata: dto
    });

    return checklistItem;
  }

  async updateChecklistItem(
    tenantId: string,
    actorId: string,
    itemId: string,
    dto: UpdateAuditChecklistItemDto
  ) {
    const item = await this.prisma.auditChecklistItem.findFirst({
      where: { tenantId, id: itemId }
    });

    if (!item) {
      throw new NotFoundException('Checklist item not found');
    }

    const resolvedResponse = (dto.response !== undefined ? dto.response : item.response) as ChecklistResponse | null | undefined;
    const checklistItem = await this.prisma.auditChecklistItem.update({
      where: { id: itemId },
      data: {
        clause: dto.clause !== undefined ? this.normalizeText(dto.clause) : undefined,
        title: dto.title?.trim(),
        standard: dto.standard !== undefined ? this.normalizeText(dto.standard) : undefined,
        notes: dto.notes !== undefined ? this.normalizeText(dto.notes) : undefined,
        response: resolvedResponse,
        isComplete: dto.isComplete ?? Boolean(resolvedResponse),
        sortOrder: dto.sortOrder
      } as Prisma.AuditChecklistItemUncheckedUpdateInput
    });

    await this.auditLogsService.create({
      tenantId,
      actorId,
      action: 'audit.checklist-item.updated',
      entityType: 'audit',
      entityId: item.auditId,
      metadata: dto
    });

    return checklistItem;
  }

  async removeChecklistItem(tenantId: string, actorId: string, itemId: string) {
    const item = await this.prisma.auditChecklistItem.findFirst({
      where: { tenantId, id: itemId }
    });

    if (!item) {
      throw new NotFoundException('Checklist item not found');
    }

    await this.prisma.auditChecklistItem.delete({
      where: { id: itemId }
    });

    await this.auditLogsService.create({
      tenantId,
      actorId,
      action: 'audit.checklist-item.deleted',
      entityType: 'audit',
      entityId: item.auditId,
      metadata: { itemId }
    });

    return { success: true };
  }

  async addFinding(tenantId: string, actorId: string, auditId: string, dto: CreateAuditFindingDto) {
    await this.requireAudit(tenantId, auditId);
    await this.ensureUserBelongsToTenant(tenantId, dto.ownerId);

    const finding = await this.prisma.auditFinding.create({
      data: {
        tenantId,
        auditId,
        title: dto.title.trim(),
        description: dto.description.trim(),
        severity: dto.severity,
        ownerId: dto.ownerId || null,
        dueDate: dto.dueDate ? new Date(dto.dueDate) : null,
        status: dto.status ?? AuditFindingStatus.OPEN
      }
    });

    await this.auditLogsService.create({
      tenantId,
      actorId,
      action: 'audit.finding.created',
      entityType: 'audit',
      entityId: auditId,
      metadata: dto
    });

    return finding;
  }

  async updateFinding(
    tenantId: string,
    actorId: string,
    findingId: string,
    dto: UpdateAuditFindingDto
  ) {
    const finding = await this.prisma.auditFinding.findFirst({
      where: { tenantId, id: findingId }
    });

    if (!finding) {
      throw new NotFoundException('Finding not found');
    }

    await this.ensureUserBelongsToTenant(tenantId, dto.ownerId);
    if (
      dto.status === AuditFindingStatus.CLOSED &&
      finding.severity === AuditFindingSeverity.MAJOR &&
      !finding.linkedCapaId
    ) {
      throw new BadRequestException('Major findings require a linked CAPA before closure');
    }

    const updated = await this.prisma.auditFinding.update({
      where: { id: findingId },
      data: {
        title: dto.title?.trim(),
        description: dto.description?.trim(),
        severity: dto.severity,
        ownerId: dto.ownerId !== undefined ? dto.ownerId || null : undefined,
        dueDate: dto.dueDate !== undefined ? (dto.dueDate ? new Date(dto.dueDate) : null) : undefined,
        status: dto.status
      }
    });

    await this.auditLogsService.create({
      tenantId,
      actorId,
      action: 'audit.finding.updated',
      entityType: 'audit',
      entityId: finding.auditId,
      metadata: dto
    });

    return updated;
  }

  async createCapaFromFinding(
    tenantId: string,
    actorId: string,
    findingId: string,
    dto: CreateCapaFromFindingDto
  ) {
    const finding = await this.prisma.auditFinding.findFirst({
      where: { tenantId, id: findingId },
      include: { audit: true }
    });

    if (!finding) {
      throw new NotFoundException('Finding not found');
    }

    if (finding.linkedCapaId) {
      throw new ConflictException('A CAPA is already linked to this finding');
    }

    await this.ensureUserBelongsToTenant(tenantId, dto.ownerId ?? finding.ownerId ?? undefined);

    const capa = await this.prisma.capa.create({
      data: {
        tenantId,
        title: (dto.title || `Audit finding: ${finding.title}`).trim(),
        source: `${finding.audit.type} Finding`,
        category: 'Audit Finding',
        problemStatement: (dto.problemStatement || finding.description).trim(),
        ownerId: dto.ownerId ?? finding.ownerId ?? null,
        dueDate: dto.dueDate ? new Date(dto.dueDate) : finding.dueDate,
        status: CapaStatus.OPEN
      }
    });

    await this.prisma.auditFinding.update({
      where: { id: findingId },
      data: {
        linkedCapaId: capa.id,
        status: AuditFindingStatus.CAPA_CREATED
      }
    });

    await this.auditLogsService.create({
      tenantId,
      actorId,
      action: 'audit.finding.capa-created',
      entityType: 'audit',
      entityId: finding.auditId,
      metadata: { findingId, capaId: capa.id }
    });

    return capa;
  }

  private mapAuditSummary(
    audit: {
      checklistItems: Array<{ isComplete: boolean }>;
      findings: Array<{ status: AuditFindingStatus }>;
      [key: string]: unknown;
    }
  ) {
    return {
      ...audit,
      checklistCount: audit.checklistItems.length,
      completedChecklistCount: audit.checklistItems.filter((item) => item.isComplete).length,
      findingCount: audit.findings.length,
      openFindingCount: audit.findings.filter((finding) => finding.status === AuditFindingStatus.OPEN).length
    };
  }

  private async seedChecklistTemplate(tenantId: string, auditId: string, standard: string) {
    const template = ISO_AUDIT_TEMPLATES[standard];
    if (!template?.length) {
      return;
    }

    await this.prisma.auditChecklistItem.createMany({
      data: template.map((item, index) => ({
        tenantId,
        auditId,
        clause: item.clause,
        standard,
        title: item.title,
        sortOrder: index + 1
      }))
    });
  }

  private async requireAudit(tenantId: string, auditId: string) {
    const audit = await this.prisma.audit.findFirst({
      where: { tenantId, id: auditId }
    });

    if (!audit) {
      throw new NotFoundException('Audit not found');
    }

    return audit;
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
      throw new BadRequestException('Selected user is not active in this tenant');
    }
  }

  private assertAuditType(type: string, standard?: string) {
    if (this.isInternalAudit(type) && !standard) {
      throw new BadRequestException('Internal audits require an ISO standard');
    }

    if (!this.isInternalAudit(type) && standard) {
      throw new BadRequestException('Only internal audits can use ISO checklist templates');
    }
  }

  private isInternalAudit(type: string) {
    return type.trim().toLowerCase() === 'internal audit';
  }

  private assertValidAuditTransition(current: AuditStatus, next: AuditStatus) {
    if (current === next) {
      return;
    }

    if (!AUDIT_STATUS_FLOW[current].includes(next)) {
      throw new BadRequestException(`Invalid audit status transition: ${current} -> ${next}`);
    }
  }

  private async assertAuditReadyForClosure(tenantId: string, auditId: string) {
    const openFindings = await this.prisma.auditFinding.count({
      where: {
        tenantId,
        auditId,
        status: AuditFindingStatus.OPEN
      }
    });

    if (openFindings > 0) {
      throw new BadRequestException('Resolve open findings or convert them to CAPA before closing the audit');
    }
  }

  private resolveStartedAt(current: AuditStatus, next?: AuditStatus, existingStartedAt?: Date | null) {
    if (current !== AuditStatus.IN_PROGRESS && next === AuditStatus.IN_PROGRESS) {
      return new Date();
    }

    return existingStartedAt ?? undefined;
  }

  private resolveCompletedAt(current: AuditStatus, next?: AuditStatus, existingCompletedAt?: Date | null) {
    if (current !== AuditStatus.COMPLETED && next === AuditStatus.COMPLETED) {
      return new Date();
    }

    if (next === AuditStatus.IN_PROGRESS) {
      return null;
    }

    return existingCompletedAt ?? undefined;
  }

  private normalizeText(value?: string | null) {
    const trimmed = value?.trim();
    return trimmed ? trimmed : null;
  }

  private handleUniqueError(error: unknown, message: string): never {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      throw new ConflictException(message);
    }

    throw error;
  }
}
