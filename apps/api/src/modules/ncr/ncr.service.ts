import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import {
  Ncr,
  NcrCategory,
  NcrPriority,
  NcrSeverity,
  NcrSource,
  NcrStatus,
  NcrVerificationStatus
} from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';
import { AuditLogsService } from '../audit-logs/audit-logs.service';
import { CreateNcrCommentDto } from './dto/create-ncr-comment.dto';
import { CreateNcrDto } from './dto/create-ncr.dto';
import { UpdateNcrDto } from './dto/update-ncr.dto';

const NCR_STATUS_FLOW: Record<NcrStatus, NcrStatus[]> = {
  [NcrStatus.OPEN]: [NcrStatus.UNDER_REVIEW, NcrStatus.INVESTIGATION, NcrStatus.ARCHIVED],
  [NcrStatus.UNDER_REVIEW]: [NcrStatus.INVESTIGATION, NcrStatus.ACTION_IN_PROGRESS, NcrStatus.ARCHIVED],
  [NcrStatus.INVESTIGATION]: [NcrStatus.ACTION_IN_PROGRESS, NcrStatus.PENDING_VERIFICATION, NcrStatus.ARCHIVED],
  [NcrStatus.ACTION_IN_PROGRESS]: [NcrStatus.PENDING_VERIFICATION, NcrStatus.ARCHIVED],
  [NcrStatus.PENDING_VERIFICATION]: [NcrStatus.ACTION_IN_PROGRESS, NcrStatus.CLOSED, NcrStatus.ARCHIVED],
  [NcrStatus.CLOSED]: [NcrStatus.ARCHIVED],
  [NcrStatus.ARCHIVED]: []
};

type UserSummary = {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
};

@Injectable()
export class NcrService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLogsService: AuditLogsService
  ) {}

  async list(
    tenantId: string,
    filters: {
      search?: string;
      status?: NcrStatus;
      category?: NcrCategory;
      source?: NcrSource;
      severity?: NcrSeverity;
      priority?: NcrPriority;
      ownerUserId?: string;
    } = {}
  ) {
    const items = await this.prisma.ncr.findMany({
      where: {
        tenantId,
        deletedAt: null,
        status: filters.status,
        category: filters.category,
        source: filters.source,
        severity: filters.severity,
        priority: filters.priority,
        ownerUserId: filters.ownerUserId,
        OR: filters.search
          ? [
              { referenceNo: { contains: filters.search, mode: 'insensitive' } },
              { title: { contains: filters.search, mode: 'insensitive' } },
              { description: { contains: filters.search, mode: 'insensitive' } },
              { department: { contains: filters.search, mode: 'insensitive' } },
              { location: { contains: filters.search, mode: 'insensitive' } }
            ]
          : undefined
      },
      include: {
        _count: {
          select: {
            comments: true
          }
        }
      },
      orderBy: [{ dateReported: 'desc' }, { updatedAt: 'desc' }]
    });

    return this.decorateNcrList(tenantId, items);
  }

  async get(tenantId: string, id: string) {
    const item = await this.prisma.ncr.findFirst({
      where: { tenantId, id, deletedAt: null },
      include: {
        _count: {
          select: {
            comments: true
          }
        }
      }
    });

    if (!item) {
      throw new NotFoundException('NCR not found');
    }

    return this.decorateNcr(tenantId, item);
  }

  async create(tenantId: string, actorId: string, dto: CreateNcrDto) {
    await this.assertReferenceAvailable(tenantId, dto.referenceNo);
    await this.ensureTenantUsers(tenantId, [dto.reportedByUserId, dto.ownerUserId, dto.verifiedByUserId]);
    this.assertVerificationRules(undefined, dto);

    const ncr = await this.prisma.ncr.create({
      data: this.toCreateData(tenantId, dto)
    });

    await this.auditLogsService.create({
      tenantId,
      actorId,
      action: 'ncr.created',
      entityType: 'ncr',
      entityId: ncr.id,
      metadata: dto
    });

    return this.get(tenantId, ncr.id);
  }

  async update(tenantId: string, actorId: string, id: string, dto: UpdateNcrDto) {
    const existing = await this.prisma.ncr.findFirst({
      where: { tenantId, id, deletedAt: null }
    });

    if (!existing) {
      throw new NotFoundException('NCR not found');
    }

    if (dto.referenceNo && dto.referenceNo.trim() !== existing.referenceNo) {
      await this.assertReferenceAvailable(tenantId, dto.referenceNo, id);
    }

    await this.ensureTenantUsers(tenantId, [dto.reportedByUserId, dto.ownerUserId, dto.verifiedByUserId]);

    const nextStatus = dto.status ?? existing.status;
    this.assertValidStatusTransition(existing.status, nextStatus);
    this.assertVerificationRules(existing, dto);

    await this.prisma.ncr.update({
      where: { id },
      data: this.toUpdateData(dto, existing)
    });

    await this.auditLogsService.create({
      tenantId,
      actorId,
      action: 'ncr.updated',
      entityType: 'ncr',
      entityId: id,
      metadata: dto
    });

    return this.get(tenantId, id);
  }

  async remove(tenantId: string, actorId: string, id: string) {
    const existing = await this.prisma.ncr.findFirst({
      where: { tenantId, id, deletedAt: null }
    });

    if (!existing) {
      throw new NotFoundException('NCR not found');
    }

    if (existing.status === NcrStatus.CLOSED) {
      throw new BadRequestException('Closed NCR records cannot be deleted. Archive them instead.');
    }

    await this.prisma.ncr.update({
      where: { id },
      data: {
        deletedAt: new Date(),
        deletedById: actorId
      }
    });

    await this.auditLogsService.create({
      tenantId,
      actorId,
      action: 'ncr.deleted',
      entityType: 'ncr',
      entityId: id,
      metadata: { status: existing.status, referenceNo: existing.referenceNo }
    });

    return { success: true };
  }

  async listComments(tenantId: string, ncrId: string) {
    await this.ensureNcrExists(tenantId, ncrId);

    return this.prisma.ncrComment.findMany({
      where: { tenantId, ncrId },
      include: {
        author: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true
          }
        }
      },
      orderBy: { createdAt: 'asc' }
    });
  }

  async addComment(tenantId: string, actorId: string, ncrId: string, dto: CreateNcrCommentDto) {
    await this.ensureNcrExists(tenantId, ncrId);
    await this.ensureTenantUsers(tenantId, [actorId]);

    const comment = await this.prisma.ncrComment.create({
      data: {
        tenantId,
        ncrId,
        authorId: actorId,
        message: dto.message.trim()
      },
      include: {
        author: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true
          }
        }
      }
    });

    await this.auditLogsService.create({
      tenantId,
      actorId,
      action: 'ncr.comment.created',
      entityType: 'ncr',
      entityId: ncrId,
      metadata: { commentId: comment.id }
    });

    return comment;
  }

  async activity(tenantId: string, ncrId: string) {
    await this.ensureNcrExists(tenantId, ncrId);
    return this.auditLogsService.list(tenantId, { entityType: 'ncr', entityId: ncrId });
  }

  private toCreateData(tenantId: string, dto: CreateNcrDto) {
    return {
      tenantId,
      referenceNo: dto.referenceNo.trim(),
      title: dto.title.trim(),
      category: dto.category,
      source: dto.source,
      description: dto.description.trim(),
      status: dto.status ?? NcrStatus.OPEN,
      severity: dto.severity,
      priority: dto.priority,
      dateReported: new Date(dto.dateReported),
      reportedByUserId: dto.reportedByUserId || null,
      ownerUserId: dto.ownerUserId || null,
      department: this.normalizeText(dto.department),
      location: this.normalizeText(dto.location),
      dueDate: dto.dueDate ? new Date(dto.dueDate) : null,
      containmentAction: this.normalizeText(dto.containmentAction),
      investigationSummary: this.normalizeText(dto.investigationSummary),
      rootCause: this.normalizeText(dto.rootCause),
      rcaMethod: dto.rcaMethod ?? null,
      correctiveActionSummary: this.normalizeText(dto.correctiveActionSummary),
      verificationStatus: dto.verificationStatus ?? NcrVerificationStatus.PENDING,
      verifiedByUserId: dto.verifiedByUserId || null,
      verificationDate: dto.verificationDate ? new Date(dto.verificationDate) : null
    };
  }

  private toUpdateData(dto: UpdateNcrDto, existing: Ncr) {
    const nextStatus = dto.status ?? existing.status;
    return {
      referenceNo: dto.referenceNo?.trim(),
      title: dto.title?.trim(),
      category: dto.category,
      source: dto.source,
      description: dto.description?.trim(),
      status: nextStatus,
      severity: dto.severity,
      priority: dto.priority,
      dateReported: dto.dateReported ? new Date(dto.dateReported) : undefined,
      reportedByUserId: dto.reportedByUserId !== undefined ? dto.reportedByUserId || null : undefined,
      ownerUserId: dto.ownerUserId !== undefined ? dto.ownerUserId || null : undefined,
      department: dto.department !== undefined ? this.normalizeText(dto.department) : undefined,
      location: dto.location !== undefined ? this.normalizeText(dto.location) : undefined,
      dueDate: dto.dueDate !== undefined ? (dto.dueDate ? new Date(dto.dueDate) : null) : undefined,
      containmentAction:
        dto.containmentAction !== undefined ? this.normalizeText(dto.containmentAction) : undefined,
      investigationSummary:
        dto.investigationSummary !== undefined ? this.normalizeText(dto.investigationSummary) : undefined,
      rootCause: dto.rootCause !== undefined ? this.normalizeText(dto.rootCause) : undefined,
      rcaMethod: dto.rcaMethod !== undefined ? dto.rcaMethod || null : undefined,
      correctiveActionSummary:
        dto.correctiveActionSummary !== undefined
          ? this.normalizeText(dto.correctiveActionSummary)
          : undefined,
      verificationStatus: dto.verificationStatus,
      verifiedByUserId: dto.verifiedByUserId !== undefined ? dto.verifiedByUserId || null : undefined,
      verificationDate:
        dto.verificationDate !== undefined
          ? dto.verificationDate
            ? new Date(dto.verificationDate)
            : null
          : undefined
    };
  }

  private async decorateNcrList(
    tenantId: string,
    items: Array<Ncr & { _count: { comments: number } }>
  ) {
    const users = await this.loadUsers(tenantId, items);
    return items.map((item) => this.serializeNcr(item, users));
  }

  private async decorateNcr(tenantId: string, item: Ncr & { _count: { comments: number } }) {
    const users = await this.loadUsers(tenantId, [item]);
    return this.serializeNcr(item, users);
  }

  private serializeNcr(item: Ncr & { _count: { comments: number } }, users: Map<string, UserSummary>) {
    return {
      ...item,
      reportedBy: item.reportedByUserId ? users.get(item.reportedByUserId) ?? null : null,
      owner: item.ownerUserId ? users.get(item.ownerUserId) ?? null : null,
      verifiedBy: item.verifiedByUserId ? users.get(item.verifiedByUserId) ?? null : null,
      commentCount: item._count.comments
    };
  }

  private async loadUsers(tenantId: string, items: Ncr[]) {
    const userIds = Array.from(
      new Set(
        items.flatMap((item) => [item.reportedByUserId, item.ownerUserId, item.verifiedByUserId]).filter(Boolean)
      )
    ) as string[];

    if (!userIds.length) {
      return new Map<string, UserSummary>();
    }

    const users = await this.prisma.user.findMany({
      where: {
        tenantId,
        id: { in: userIds }
      },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true
      }
    });

    return new Map(users.map((user) => [user.id, user]));
  }

  private async ensureTenantUsers(tenantId: string, userIds: Array<string | undefined>) {
    const filtered = Array.from(new Set(userIds.filter(Boolean))) as string[];
    if (!filtered.length) {
      return;
    }

    const users = await this.prisma.user.findMany({
      where: {
        tenantId,
        id: { in: filtered },
        isActive: true
      },
      select: { id: true }
    });

    if (users.length !== filtered.length) {
      throw new BadRequestException('One or more selected users are not active in this tenant');
    }
  }

  private async assertReferenceAvailable(tenantId: string, referenceNo: string, excludeId?: string) {
    const existing = await this.prisma.ncr.findFirst({
      where: {
        tenantId,
        referenceNo: referenceNo.trim(),
        deletedAt: null,
        id: excludeId ? { not: excludeId } : undefined
      },
      select: { id: true }
    });

    if (existing) {
      throw new ConflictException('An NCR with this reference number already exists.');
    }
  }

  private assertValidStatusTransition(current: NcrStatus, next: NcrStatus) {
    if (current === next) {
      return;
    }

    if (!NCR_STATUS_FLOW[current].includes(next)) {
      throw new BadRequestException(`Invalid NCR status transition: ${current} -> ${next}`);
    }
  }

  private assertVerificationRules(existing: Ncr | undefined, dto: CreateNcrDto | UpdateNcrDto) {
    const nextStatus = dto.status ?? existing?.status ?? NcrStatus.OPEN;
    const nextVerificationStatus =
      dto.verificationStatus ?? existing?.verificationStatus ?? NcrVerificationStatus.PENDING;
    const verifiedByUserId = dto.verifiedByUserId ?? existing?.verifiedByUserId;
    const verificationDate = dto.verificationDate ?? existing?.verificationDate?.toISOString();
    const rootCause = dto.rootCause ?? existing?.rootCause;
    const correctiveActionSummary = dto.correctiveActionSummary ?? existing?.correctiveActionSummary;

    if (nextStatus !== NcrStatus.CLOSED) {
      return;
    }

    if (
      nextVerificationStatus !== NcrVerificationStatus.VERIFIED ||
      !verifiedByUserId ||
      !verificationDate ||
      !rootCause ||
      !correctiveActionSummary
    ) {
      throw new BadRequestException(
        'Closed NCR records require verified status, verifier, verification date, root cause, and corrective action summary.'
      );
    }
  }

  private async ensureNcrExists(tenantId: string, id: string) {
    const existing = await this.prisma.ncr.findFirst({
      where: { tenantId, id, deletedAt: null },
      select: { id: true }
    });

    if (!existing) {
      throw new NotFoundException('NCR not found');
    }
  }

  private normalizeText(value?: string) {
    const trimmed = value?.trim();
    return trimmed ? trimmed : null;
  }
}
