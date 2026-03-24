import {
  ActionItemStatus,
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
import { getAuditChecklistQuestionDelegate } from '../../common/prisma/prisma-delegate-compat';
import { PrismaService } from '../../common/prisma/prisma.service';
import {
  CLAUSE_SORT_ORDER,
  createStarterQuestionSeedData,
  getStarterQuestionsForStandard
} from './audit-question-bank';
import { AuditLogsService } from '../audit-logs/audit-logs.service';
import { CreateAuditChecklistItemDto } from './dto/create-audit-checklist-item.dto';
import { CreateAuditChecklistQuestionDto } from './dto/create-audit-checklist-question.dto';
import { CreateAuditDto } from './dto/create-audit.dto';
import { CreateAuditFindingDto } from './dto/create-audit-finding.dto';
import { CreateCapaFromFindingDto } from './dto/create-capa-from-finding.dto';
import { ReorderAuditChecklistQuestionsDto } from './dto/reorder-audit-checklist-questions.dto';
import { UpdateAuditChecklistItemDto } from './dto/update-audit-checklist-item.dto';
import { UpdateAuditChecklistQuestionDto } from './dto/update-audit-checklist-question.dto';
import { UpdateAuditDto } from './dto/update-audit.dto';
import { UpdateAuditFindingDto } from './dto/update-audit-finding.dto';

const AUDIT_STATUS_FLOW: Record<AuditStatus, AuditStatus[]> = {
  [AuditStatus.PLANNED]: [AuditStatus.IN_PROGRESS, AuditStatus.CHECKLIST_COMPLETED, AuditStatus.COMPLETED, AuditStatus.CLOSED],
  [AuditStatus.IN_PROGRESS]: [AuditStatus.CHECKLIST_COMPLETED, AuditStatus.COMPLETED, AuditStatus.CLOSED],
  [AuditStatus.CHECKLIST_COMPLETED]: [AuditStatus.IN_PROGRESS, AuditStatus.COMPLETED, AuditStatus.CLOSED],
  [AuditStatus.COMPLETED]: [AuditStatus.IN_PROGRESS, AuditStatus.CHECKLIST_COMPLETED, AuditStatus.CLOSED],
  [AuditStatus.CLOSED]: [AuditStatus.COMPLETED]
};

type ChecklistResponse = 'YES' | 'NO' | 'PARTIAL';
type ExistingAudit = {
  status: AuditStatus;
  type: string;
  standard?: string | null;
  startedAt?: Date | null;
  checklistCompletedAt?: Date | null;
  completedAt?: Date | null;
  conclusion?: string | null;
  recommendations?: string | null;
  completedByAuditorId?: string | null;
  checklistItems: Array<{ id: string; response?: ChecklistResponse | null; isComplete?: boolean }>;
};

@Injectable()
export class AuditsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLogsService: AuditLogsService
  ) {}

  async list(tenantId: string) {
    const audits = await this.prisma.audit.findMany({
      where: { tenantId, deletedAt: null },
      include: {
        checklistItems: true,
        findings: true
      },
      orderBy: [{ scheduledAt: 'desc' }, { updatedAt: 'desc' }]
    });

    return audits.map((audit) => this.mapAuditSummary(audit));
  }

  async listChecklistQuestions(
    tenantId: string,
    standard?: string,
    clause?: string,
    includeInactive = false
  ) {
    const questions = await this.auditChecklistQuestionModel().findMany({
      where: {
        tenantId,
        standard: standard ? standard.trim() : undefined,
        clause: clause ? clause.trim() : undefined,
        isActive: includeInactive ? undefined : true
      },
      orderBy: [{ standard: 'asc' }, { sortOrder: 'asc' }, { createdAt: 'asc' }]
    });

    return this.sortQuestionBank(questions);
  }

  async get(tenantId: string, id: string) {
    const audit = await this.prisma.audit.findFirst({
      where: { tenantId, id, deletedAt: null },
      include: {
        checklistItems: {
          include: {
            findings: {
              orderBy: [{ createdAt: 'desc' }]
            }
          },
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

    const [actionItemCount, openActionItemCount] = await this.prisma.$transaction([
      this.prisma.actionItem.count({
        where: {
          tenantId,
          sourceType: 'audit',
          sourceId: id,
          deletedAt: null
        }
      }),
      this.prisma.actionItem.count({
        where: {
          tenantId,
          sourceType: 'audit',
          sourceId: id,
          deletedAt: null,
          status: {
            notIn: [ActionItemStatus.DONE, ActionItemStatus.CANCELLED]
          }
        }
      })
    ]);

    return this.mapAuditSummary(audit, { actionItemCount, openActionItemCount });
  }

  async createChecklistQuestion(
    tenantId: string,
    actorId: string,
    dto: CreateAuditChecklistQuestionDto
  ) {
    const sortOrder =
      dto.sortOrder ?? (await this.nextQuestionSortOrder(tenantId, dto.standard, dto.clause));

    await this.bumpQuestionOrdersForInsert(tenantId, dto.standard, dto.clause, sortOrder);

    const question = await this.auditChecklistQuestionModel().create({
      data: {
        tenantId,
        standard: dto.standard.trim(),
        clause: dto.clause.trim(),
        subclause: this.normalizeText(dto.subclause),
        title: dto.title.trim(),
        sortOrder,
        isActive: dto.isActive ?? true,
        isTemplateDefault: dto.isTemplateDefault ?? false
      }
    });

    await this.auditLogsService.create({
      tenantId,
      actorId,
      action: 'audit.checklist-question.created',
      entityType: 'audit-checklist-question',
      entityId: question.id,
      metadata: dto
    });

    return question;
  }

  async updateChecklistQuestion(
    tenantId: string,
    actorId: string,
    questionId: string,
    dto: UpdateAuditChecklistQuestionDto
  ) {
    const question = await this.requireChecklistQuestion(tenantId, questionId);
    const targetStandard = dto.standard?.trim() ?? question.standard;
    const targetClause = dto.clause?.trim() ?? question.clause;
    const requestedSortOrder = dto.sortOrder ?? question.sortOrder;

    if (
      targetStandard !== question.standard ||
      targetClause !== question.clause ||
      requestedSortOrder !== question.sortOrder
    ) {
      await this.resequenceQuestionGroup(tenantId, question.standard, question.clause, question.id);
      await this.bumpQuestionOrdersForInsert(tenantId, targetStandard, targetClause, requestedSortOrder);
    }

    const updated = await this.auditChecklistQuestionModel().update({
      where: { id: questionId },
      data: {
        standard: dto.standard !== undefined ? targetStandard : undefined,
        clause: dto.clause !== undefined ? targetClause : undefined,
        subclause: dto.subclause !== undefined ? this.normalizeText(dto.subclause) : undefined,
        title: dto.title !== undefined ? dto.title.trim() : undefined,
        sortOrder: requestedSortOrder,
        isActive: dto.isActive,
        isTemplateDefault: dto.isTemplateDefault
      }
    });

    await this.resequenceQuestionGroup(tenantId, targetStandard, targetClause);

    await this.auditLogsService.create({
      tenantId,
      actorId,
      action: 'audit.checklist-question.updated',
      entityType: 'audit-checklist-question',
      entityId: questionId,
      metadata: dto
    });

    return updated;
  }

  async archiveChecklistQuestion(tenantId: string, actorId: string, questionId: string) {
    const question = await this.requireChecklistQuestion(tenantId, questionId);

    const updated = await this.auditChecklistQuestionModel().update({
      where: { id: questionId },
      data: {
        isActive: false
      }
    });

    await this.auditLogsService.create({
      tenantId,
      actorId,
      action: 'audit.checklist-question.archived',
      entityType: 'audit-checklist-question',
      entityId: questionId,
      metadata: {
        standard: question.standard,
        clause: question.clause
      }
    });

    return updated;
  }

  async removeChecklistQuestion(tenantId: string, actorId: string, questionId: string) {
    const question = await this.requireChecklistQuestion(tenantId, questionId);

    await this.auditChecklistQuestionModel().delete({
      where: { id: questionId }
    });

    await this.resequenceQuestionGroup(tenantId, question.standard, question.clause);

    await this.auditLogsService.create({
      tenantId,
      actorId,
      action: 'audit.checklist-question.deleted',
      entityType: 'audit-checklist-question',
      entityId: questionId,
      metadata: {
        standard: question.standard,
        clause: question.clause
      }
    });

    return { success: true };
  }

  async reorderChecklistQuestions(
    tenantId: string,
    actorId: string,
    dto: ReorderAuditChecklistQuestionsDto
  ) {
    const questions = await this.auditChecklistQuestionModel().findMany({
      where: {
        tenantId,
        standard: dto.standard.trim(),
        clause: dto.clause.trim()
      },
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }]
    });

    const byId = new Map(questions.map((question: { id: string }) => [question.id, question]));
    if (dto.questionIds.length !== questions.length || dto.questionIds.some((id) => !byId.has(id))) {
      throw new BadRequestException('Question reorder payload does not match the current clause question set');
    }

    await this.prisma.$transaction(async (tx) => {
      const questionModel = getAuditChecklistQuestionDelegate(tx);
      for (const [index, questionId] of dto.questionIds.entries()) {
        await questionModel.update({
          where: { id: questionId },
          data: { sortOrder: index + 1 }
        });
      }
    });

    await this.auditLogsService.create({
      tenantId,
      actorId,
      action: 'audit.checklist-question.reordered',
      entityType: 'audit-checklist-question',
      entityId: `${dto.standard.trim()}:${dto.clause.trim()}`,
      metadata: dto
    });

    return this.listChecklistQuestions(tenantId, dto.standard, dto.clause, true);
  }

  async create(tenantId: string, actorId: string, dto: CreateAuditDto) {
    await this.ensureUserBelongsToTenant(tenantId, dto.leadAuditorId);
    await this.ensureUserBelongsToTenant(tenantId, dto.completedByAuditorId);
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
          startedAt:
            dto.status && dto.status !== AuditStatus.PLANNED ? new Date() : null,
          summary: this.normalizeText(dto.summary),
          conclusion: this.normalizeText(dto.conclusion),
          recommendations: this.normalizeText(dto.recommendations),
          completedByAuditorId: dto.completedByAuditorId || null,
          checklistCompletedAt:
            dto.status === AuditStatus.CHECKLIST_COMPLETED || dto.status === AuditStatus.COMPLETED
              ? new Date()
              : null,
          completedAt: dto.status === AuditStatus.COMPLETED
            ? (dto.completionDate ? new Date(dto.completionDate) : new Date())
            : null,
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
      where: { tenantId, id, deletedAt: null },
      select: {
        status: true,
        type: true,
        standard: true,
        startedAt: true,
        checklistCompletedAt: true,
        completedAt: true,
        conclusion: true,
        recommendations: true,
        completedByAuditorId: true,
        checklistItems: {
          select: {
            id: true,
            response: true,
            isComplete: true
          }
        }
      }
    }) as ExistingAudit | null;

    if (!existing) {
      throw new NotFoundException('Audit not found');
    }

    await this.ensureUserBelongsToTenant(tenantId, dto.leadAuditorId);
    await this.ensureUserBelongsToTenant(tenantId, dto.completedByAuditorId);
    this.assertValidAuditTransition(existing.status, dto.status ?? existing.status);
    this.assertAuditType(dto.type ?? existing.type, dto.standard ?? existing.standard ?? undefined);

    if ((dto.status ?? existing.status) === AuditStatus.CHECKLIST_COMPLETED) {
      this.assertChecklistComplete(existing);
    }

    if ((dto.status ?? existing.status) === AuditStatus.COMPLETED) {
      this.assertAuditReadyForCompletion(existing, dto);
    }

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
          checklistCompletedAt: this.resolveChecklistCompletedAt(
            existing.status,
            dto.status,
            existing.checklistCompletedAt
          ),
          completedAt: this.resolveCompletedAt(existing, dto),
          summary: dto.summary !== undefined ? this.normalizeText(dto.summary) : undefined,
          conclusion: dto.conclusion !== undefined ? this.normalizeText(dto.conclusion) : undefined,
          recommendations:
            dto.recommendations !== undefined ? this.normalizeText(dto.recommendations) : undefined,
          completedByAuditorId:
            dto.completedByAuditorId !== undefined ? dto.completedByAuditorId || null : undefined,
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
    this.assertChecklistEditable(audit.status);
    const nextSortOrder = await this.nextChecklistSortOrder(tenantId, auditId);

    const checklistItem = await this.prisma.auditChecklistItem.create({
      data: {
        tenantId,
        auditId,
        clause: this.normalizeText(dto.clause),
        subclause: this.normalizeText((dto as { subclause?: string }).subclause),
        standard: this.normalizeText(dto.standard) ?? audit.standard,
        title: dto.title.trim(),
        notes: this.normalizeText(dto.notes),
        response: dto.response as ChecklistResponse | undefined,
        isComplete: dto.isComplete ?? Boolean(dto.response),
        sortOrder: nextSortOrder
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

    const audit = await this.requireAudit(tenantId, item.auditId);
    this.assertChecklistEditable(audit.status);

    const resolvedResponse = (dto.response !== undefined ? dto.response : item.response) as ChecklistResponse | null | undefined;
    const checklistItem = await this.prisma.auditChecklistItem.update({
      where: { id: itemId },
      data: {
        clause: dto.clause !== undefined ? this.normalizeText(dto.clause) : undefined,
        subclause:
          (dto as { subclause?: string }).subclause !== undefined
            ? this.normalizeText((dto as { subclause?: string }).subclause)
            : undefined,
        title: dto.title?.trim(),
        standard: dto.standard !== undefined ? this.normalizeText(dto.standard) : undefined,
        notes: dto.notes !== undefined ? this.normalizeText(dto.notes) : undefined,
        response: resolvedResponse,
        isComplete: dto.isComplete ?? Boolean(resolvedResponse)
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

    await this.refreshChecklistProgressStatus(tenantId, actorId, item.auditId);

    return checklistItem;
  }

  async removeChecklistItem(tenantId: string, actorId: string, itemId: string) {
    const item = await this.prisma.auditChecklistItem.findFirst({
      where: { tenantId, id: itemId }
    });

    if (!item) {
      throw new NotFoundException('Checklist item not found');
    }

    const audit = await this.requireAudit(tenantId, item.auditId);
    this.assertChecklistEditable(audit.status);

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

    await this.refreshChecklistProgressStatus(tenantId, actorId, item.auditId);

    return { success: true };
  }

  async remove(tenantId: string, actorId: string, id: string) {
    const existing = await this.prisma.audit.findFirst({
      where: { tenantId, id, deletedAt: null }
    });

    if (!existing) {
      throw new NotFoundException('Audit not found');
    }

    if (existing.status !== AuditStatus.PLANNED) {
      throw new BadRequestException('Only planning-stage audits can be deleted. Completed audits must be archived instead.');
    }

    await this.prisma.audit.update({
      where: { id },
      data: {
        deletedAt: new Date(),
        deletedById: actorId
      }
    });

    await this.auditLogsService.create({
      tenantId,
      actorId,
      action: 'audit.deleted',
      entityType: 'audit',
      entityId: id,
      metadata: { status: existing.status }
    });

    return { success: true };
  }

  async archive(tenantId: string, actorId: string, id: string) {
    const existing = await this.prisma.audit.findFirst({
      where: { tenantId, id, deletedAt: null }
    });

    if (!existing) {
      throw new NotFoundException('Audit not found');
    }

    await this.prisma.audit.update({
      where: { id },
      data: {
        deletedAt: new Date(),
        deletedById: actorId
      }
    });

    await this.auditLogsService.create({
      tenantId,
      actorId,
      action: 'audit.archived',
      entityType: 'audit',
      entityId: id,
      metadata: { status: existing.status }
    });

    return { success: true };
  }

  async addFinding(tenantId: string, actorId: string, auditId: string, dto: CreateAuditFindingDto) {
    await this.requireAudit(tenantId, auditId);
    await this.ensureUserBelongsToTenant(tenantId, dto.ownerId);
    const checklistItem = dto.checklistItemId
      ? await this.requireChecklistItem(tenantId, auditId, dto.checklistItemId)
      : null;

    const finding = await this.prisma.auditFinding.create({
      data: {
        tenantId,
        auditId,
        checklistItemId: checklistItem?.id ?? null,
        clause: this.normalizeText(dto.clause) ?? checklistItem?.clause ?? null,
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
    const checklistItem = dto.checklistItemId
      ? await this.requireChecklistItem(tenantId, finding.auditId, dto.checklistItemId)
      : null;
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
        checklistItemId: dto.checklistItemId !== undefined ? checklistItem?.id ?? null : undefined,
        clause:
          dto.checklistItemId !== undefined || dto.clause !== undefined
            ? this.normalizeText(dto.clause) ?? checklistItem?.clause ?? null
            : undefined,
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
      checklistItems: Array<{
        id: string;
        clause?: string | null;
        subclause?: string | null;
        response?: ChecklistResponse | null;
        isComplete: boolean;
        findings?: Array<{
          id: string;
          title: string;
          status: AuditFindingStatus;
          severity: AuditFindingSeverity;
          dueDate?: Date | null;
          ownerId?: string | null;
          checklistItemId?: string | null;
          clause?: string | null;
          createdAt: Date;
        }>;
      }>;
      findings: Array<{ status: AuditFindingStatus }>;
      [key: string]: unknown;
    },
    extras?: {
      actionItemCount?: number;
      openActionItemCount?: number;
    }
  ) {
    const yesCount = audit.checklistItems.filter((item) => item.response === 'YES').length;
    const noCount = audit.checklistItems.filter((item) => item.response === 'NO').length;
    const naCount = audit.checklistItems.filter((item) => item.response === 'PARTIAL').length;

    return {
      ...audit,
      checklistItems: audit.checklistItems.map((item) => ({
        ...item,
        questionNumber: item.subclause ?? item.clause,
        linkedFindingCount: item.findings?.length ?? 0,
        linkedFindings:
          item.findings?.map((finding) => ({
            id: finding.id,
            title: finding.title,
            status: finding.status,
            severity: finding.severity,
            dueDate: finding.dueDate,
            ownerId: finding.ownerId,
            checklistItemId: finding.checklistItemId,
            clause: finding.clause,
            createdAt: finding.createdAt
          })) ?? []
      })),
      checklistCount: audit.checklistItems.length,
      completedChecklistCount: audit.checklistItems.filter((item) => item.isComplete).length,
      checklistAnsweredCount: audit.checklistItems.filter((item) => !!item.response).length,
      checklistYesCount: yesCount,
      checklistNoCount: noCount,
      checklistNaCount: naCount,
      isChecklistCompleted:
        audit.checklistItems.length > 0 &&
        audit.checklistItems.every((item) => item.isComplete && !!item.response),
      findingCount: audit.findings.length,
      openFindingCount: audit.findings.filter((finding) => finding.status === AuditFindingStatus.OPEN).length,
      actionItemCount: extras?.actionItemCount ?? 0,
      openActionItemCount: extras?.openActionItemCount ?? 0
    };
  }

  private async seedChecklistTemplate(tenantId: string, auditId: string, standard: string) {
    let template = await this.auditChecklistQuestionModel().findMany({
      where: {
        tenantId,
        standard,
        isActive: true
      },
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }]
    });

    if (!template.length) {
      await this.seedChecklistQuestionBankForTenant(tenantId);
      template = await this.auditChecklistQuestionModel().findMany({
        where: {
          tenantId,
          standard,
          isActive: true
        },
        orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }]
      });
    }

    if (!template.length) {
      return;
    }

    template = this.sortQuestionBank(template);

    await this.prisma.auditChecklistItem.createMany({
      data: template.map((item: { id: string; clause: string; subclause: string | null; title: string }, index: number) => ({
        tenantId,
        auditId,
        sourceQuestionId: item.id,
        clause: item.clause,
        subclause: item.subclause,
        standard,
        title: item.title,
        sortOrder: index + 1
      }))
    });
  }

  private async nextChecklistSortOrder(tenantId: string, auditId: string) {
    const lastItem = await this.prisma.auditChecklistItem.findFirst({
      where: { tenantId, auditId },
      orderBy: [{ sortOrder: 'desc' }, { createdAt: 'desc' }],
      select: { sortOrder: true }
    });

    return (lastItem?.sortOrder ?? 0) + 1;
  }

  private auditChecklistQuestionModel() {
    return getAuditChecklistQuestionDelegate(this.prisma);
  }

  async seedChecklistQuestionBankForTenant(tenantId: string) {
    const existingCount = await this.auditChecklistQuestionModel().count({
      where: { tenantId }
    });

    if (existingCount > 0) {
      return;
    }

    await this.auditChecklistQuestionModel().createMany({
      data: createStarterQuestionSeedData(tenantId)
    });
  }

  private async nextQuestionSortOrder(tenantId: string, standard: string, clause: string) {
    const lastQuestion = await this.auditChecklistQuestionModel().findFirst({
      where: {
        tenantId,
        standard: standard.trim(),
        clause: clause.trim()
      },
      orderBy: [{ sortOrder: 'desc' }, { createdAt: 'desc' }],
      select: { sortOrder: true }
    });

    return (lastQuestion?.sortOrder ?? 0) + 1;
  }

  private async requireChecklistQuestion(tenantId: string, questionId: string) {
    const question = await this.auditChecklistQuestionModel().findFirst({
      where: { tenantId, id: questionId }
    });

    if (!question) {
      throw new NotFoundException('Checklist question not found');
    }

    return question;
  }

  private async bumpQuestionOrdersForInsert(
    tenantId: string,
    standard: string,
    clause: string,
    sortOrder: number
  ) {
    await this.auditChecklistQuestionModel().updateMany({
      where: {
        tenantId,
        standard: standard.trim(),
        clause: clause.trim(),
        sortOrder: { gte: sortOrder }
      },
      data: {
        sortOrder: { increment: 1 }
      }
    });
  }

  private async resequenceQuestionGroup(
    tenantId: string,
    standard: string,
    clause: string,
    excludeId?: string
  ) {
    const questions = await this.auditChecklistQuestionModel().findMany({
      where: {
        tenantId,
        standard,
        clause,
        id: excludeId ? { not: excludeId } : undefined
      },
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }]
    });

    await this.prisma.$transaction(async (tx) => {
      const questionModel = getAuditChecklistQuestionDelegate(tx);
      for (const [index, question] of questions.entries()) {
        await questionModel.update({
          where: { id: question.id },
          data: { sortOrder: index + 1 }
        });
      }
    });
  }

  private sortQuestionBank<
    T extends { standard?: string | null; clause: string; sortOrder: number; subclause?: string | null }
  >(
    questions: T[]
  ) {
    return [...questions].sort((left, right) => {
      if ((left.standard ?? '') !== (right.standard ?? '')) {
        return (left.standard ?? '').localeCompare(right.standard ?? '', undefined, {
          numeric: true,
          sensitivity: 'base'
        });
      }

      const leftClauseIndex = CLAUSE_SORT_ORDER.indexOf(left.clause as (typeof CLAUSE_SORT_ORDER)[number]);
      const rightClauseIndex = CLAUSE_SORT_ORDER.indexOf(right.clause as (typeof CLAUSE_SORT_ORDER)[number]);
      const normalizedLeft = leftClauseIndex === -1 ? Number.MAX_SAFE_INTEGER : leftClauseIndex;
      const normalizedRight = rightClauseIndex === -1 ? Number.MAX_SAFE_INTEGER : rightClauseIndex;

      if (normalizedLeft !== normalizedRight) {
        return normalizedLeft - normalizedRight;
      }

      if ((left.subclause ?? '') !== (right.subclause ?? '')) {
        return (left.subclause ?? '').localeCompare(right.subclause ?? '', undefined, {
          numeric: true,
          sensitivity: 'base'
        });
      }

      return left.sortOrder - right.sortOrder;
    });
  }

  private async requireAudit(tenantId: string, auditId: string) {
    const audit = await this.prisma.audit.findFirst({
      where: { tenantId, id: auditId, deletedAt: null }
    });

    if (!audit) {
      throw new NotFoundException('Audit not found');
    }

    return audit;
  }

  private async requireChecklistItem(tenantId: string, auditId: string, checklistItemId: string) {
    const checklistItem = await this.prisma.auditChecklistItem.findFirst({
      where: { tenantId, auditId, id: checklistItemId }
    });

    if (!checklistItem) {
      throw new NotFoundException('Checklist item not found');
    }

    return checklistItem;
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

  private assertChecklistEditable(status: AuditStatus) {
    if (status === AuditStatus.COMPLETED || status === AuditStatus.CLOSED) {
      throw new BadRequestException('Completed audits are read-only. Reopen the audit before editing the checklist.');
    }
  }

  private assertChecklistComplete(audit: ExistingAudit) {
    const unanswered = audit.checklistItems.filter((item) => !item.response || !item.isComplete).length;
    if (unanswered > 0) {
      throw new BadRequestException('Answer all checklist questions before moving to checklist completion.');
    }
  }

  private assertAuditReadyForCompletion(audit: ExistingAudit, dto: UpdateAuditDto) {
    this.assertChecklistComplete(audit);

    const conclusion = dto.conclusion !== undefined ? this.normalizeText(dto.conclusion) : audit.conclusion;
    const recommendations =
      dto.recommendations !== undefined ? this.normalizeText(dto.recommendations) : audit.recommendations;
    const completedByAuditorId =
      dto.completedByAuditorId !== undefined ? dto.completedByAuditorId || null : audit.completedByAuditorId;
    const completionDate = dto.completionDate ?? audit.completedAt?.toISOString();

    if (!conclusion) {
      throw new BadRequestException('Add an audit conclusion before completing the audit.');
    }

    if (!recommendations) {
      throw new BadRequestException('Add audit recommendations before completing the audit.');
    }

    if (!completedByAuditorId) {
      throw new BadRequestException('Select the auditor completing the audit before completion.');
    }

    if (!completionDate) {
      throw new BadRequestException('Set a completion date before completing the audit.');
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

  private resolveChecklistCompletedAt(
    current: AuditStatus,
    next?: AuditStatus,
    existingChecklistCompletedAt?: Date | null
  ) {
    if (
      (next === AuditStatus.CHECKLIST_COMPLETED || next === AuditStatus.COMPLETED) &&
      current !== AuditStatus.CHECKLIST_COMPLETED &&
      current !== AuditStatus.COMPLETED
    ) {
      return new Date();
    }

    if (next === AuditStatus.IN_PROGRESS) {
      return null;
    }

    return existingChecklistCompletedAt ?? undefined;
  }

  private resolveCompletedAt(existing: ExistingAudit, dto: UpdateAuditDto) {
    if (dto.status === AuditStatus.COMPLETED) {
      return dto.completionDate ? new Date(dto.completionDate) : existing.completedAt ?? new Date();
    }

    if (dto.completionDate !== undefined) {
      return dto.completionDate ? new Date(dto.completionDate) : null;
    }

    if (dto.status === AuditStatus.IN_PROGRESS || dto.status === AuditStatus.CHECKLIST_COMPLETED) {
      return null;
    }

    return existing.completedAt ?? undefined;
  }

  private async refreshChecklistProgressStatus(tenantId: string, actorId: string, auditId: string) {
    const audit = await this.prisma.audit.findFirst({
      where: { tenantId, id: auditId, deletedAt: null },
      include: {
        checklistItems: {
          select: {
            id: true,
            response: true,
            isComplete: true
          }
        }
      }
    }) as ExistingAudit & { id?: string } | null;

    if (!audit || audit.status === AuditStatus.COMPLETED || audit.status === AuditStatus.CLOSED) {
      return;
    }

    const hasChecklistItems = audit.checklistItems.length > 0;
    const answeredCount = audit.checklistItems.filter((item) => !!item.response && item.isComplete).length;
    const isChecklistComplete = hasChecklistItems && answeredCount === audit.checklistItems.length;

    let nextStatus = audit.status;
    let startedAt: Date | null | undefined;
    let checklistCompletedAt: Date | null | undefined;

    if (isChecklistComplete) {
      nextStatus = AuditStatus.CHECKLIST_COMPLETED;
      checklistCompletedAt = audit.checklistCompletedAt ?? new Date();
      startedAt = audit.startedAt ?? new Date();
    } else if (answeredCount > 0) {
      nextStatus = AuditStatus.IN_PROGRESS;
      checklistCompletedAt = null;
      startedAt = audit.startedAt ?? new Date();
    } else if (audit.status === AuditStatus.CHECKLIST_COMPLETED) {
      nextStatus = AuditStatus.IN_PROGRESS;
      checklistCompletedAt = null;
    }

    if (
      nextStatus !== audit.status ||
      (startedAt && !audit.startedAt) ||
      (checklistCompletedAt === null && audit.checklistCompletedAt) ||
      (checklistCompletedAt instanceof Date && !audit.checklistCompletedAt)
    ) {
      await this.prisma.audit.update({
        where: { id: auditId },
        data: {
          status: nextStatus,
          startedAt,
          checklistCompletedAt
        }
      });

      await this.auditLogsService.create({
        tenantId,
        actorId,
        action:
          nextStatus === AuditStatus.CHECKLIST_COMPLETED
            ? 'audit.checklist.completed'
            : 'audit.checklist.progress-updated',
        entityType: 'audit',
        entityId: auditId,
        metadata: {
          answeredCount,
          totalChecklistCount: audit.checklistItems.length,
          status: nextStatus
        }
      });
    }
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
