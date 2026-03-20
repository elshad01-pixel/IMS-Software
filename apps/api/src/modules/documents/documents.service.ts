import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException
} from '@nestjs/common';
import { DocumentStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';
import { AuditLogsService } from '../audit-logs/audit-logs.service';
import { CreateDocumentDto } from './dto/create-document.dto';
import { UpdateDocumentDto } from './dto/update-document.dto';

const DOCUMENT_STATUS_FLOW: Record<DocumentStatus, DocumentStatus[]> = {
  [DocumentStatus.DRAFT]: [DocumentStatus.REVIEW],
  [DocumentStatus.REVIEW]: [DocumentStatus.APPROVED, DocumentStatus.DRAFT],
  [DocumentStatus.APPROVED]: [DocumentStatus.OBSOLETE],
  [DocumentStatus.OBSOLETE]: []
};

@Injectable()
export class DocumentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLogsService: AuditLogsService
  ) {}

  list(tenantId: string) {
    return this.prisma.document.findMany({
      where: { tenantId, deletedAt: null },
      orderBy: [{ updatedAt: 'desc' }, { title: 'asc' }]
    });
  }

  get(tenantId: string, id: string) {
    return this.prisma.document.findFirstOrThrow({
      where: { tenantId, id, deletedAt: null }
    });
  }

  async create(tenantId: string, actorId: string, dto: CreateDocumentDto) {
    await this.ensureOwnerBelongsToTenant(tenantId, dto.ownerId);

    try {
      const document = await this.prisma.document.create({
        data: {
          tenantId,
          code: dto.code.trim().toUpperCase(),
          title: dto.title.trim(),
          type: dto.type.trim(),
          summary: this.normalizeText(dto.summary),
          ownerId: dto.ownerId || null,
          status: dto.status ?? DocumentStatus.DRAFT,
          effectiveDate: dto.effectiveDate ? new Date(dto.effectiveDate) : null,
          reviewDueDate: dto.reviewDueDate ? new Date(dto.reviewDueDate) : null,
          changeSummary: this.normalizeText(dto.changeSummary)
        }
      });

      await this.auditLogsService.create({
        tenantId,
        actorId,
        action: 'document.created',
        entityType: 'document',
        entityId: document.id,
        metadata: dto
      });

      return document;
    } catch (error) {
      this.handleDocumentWriteError(error);
    }
  }

  async update(tenantId: string, actorId: string, actorPermissions: string[], id: string, dto: UpdateDocumentDto) {
    const existing = await this.prisma.document.findFirst({
      where: { id, tenantId, deletedAt: null }
    });

    if (!existing) {
      throw new NotFoundException('Document not found');
    }

    await this.ensureOwnerBelongsToTenant(tenantId, dto.ownerId);

    const nextStatus = dto.status ?? existing.status;
    this.assertValidStatusTransition(existing.status, nextStatus);
    this.assertApprovalPermission(actorPermissions, existing.status, nextStatus);

    const substantiveChange = this.hasSubstantiveChange(existing, dto);

    try {
      const document = await this.prisma.document.update({
        where: { id },
        data: {
          code: dto.code ? dto.code.trim().toUpperCase() : undefined,
          title: dto.title ? dto.title.trim() : undefined,
          type: dto.type ? dto.type.trim() : undefined,
          summary: dto.summary !== undefined ? this.normalizeText(dto.summary) : undefined,
          ownerId: dto.ownerId !== undefined ? dto.ownerId || null : undefined,
          status: nextStatus,
          effectiveDate:
            dto.effectiveDate !== undefined
              ? dto.effectiveDate
                ? new Date(dto.effectiveDate)
                : null
              : undefined,
          reviewDueDate:
            dto.reviewDueDate !== undefined
              ? dto.reviewDueDate
                ? new Date(dto.reviewDueDate)
                : null
              : undefined,
          approvedAt: this.resolveApprovedAt(existing.status, nextStatus, existing.approvedAt),
          approvedById:
            nextStatus === DocumentStatus.APPROVED
              ? actorId
              : nextStatus === DocumentStatus.DRAFT
                ? null
                : undefined,
          obsoletedAt:
            nextStatus === DocumentStatus.OBSOLETE
              ? existing.obsoletedAt ?? new Date()
              : nextStatus !== existing.status
                ? null
                : undefined,
          changeSummary:
            dto.changeSummary !== undefined ? this.normalizeText(dto.changeSummary) : undefined,
          revision: substantiveChange ? existing.revision + 1 : undefined
        }
      });

      await this.auditLogsService.create({
        tenantId,
        actorId,
        action: 'document.updated',
        entityType: 'document',
        entityId: document.id,
        metadata: {
          ...dto,
          revisionChanged: substantiveChange
        }
      });

      return document;
    } catch (error) {
      this.handleDocumentWriteError(error);
    }
  }

  async remove(tenantId: string, actorId: string, id: string) {
    const existing = await this.prisma.document.findFirst({
      where: { id, tenantId, deletedAt: null }
    });

    if (!existing) {
      throw new NotFoundException('Document not found');
    }

    if (existing.status !== DocumentStatus.DRAFT) {
      throw new BadRequestException('Only draft documents can be deleted. Approved documents must be obsoleted instead.');
    }

    await this.prisma.document.update({
      where: { id },
      data: {
        deletedAt: new Date(),
        deletedById: actorId
      }
    });

    await this.auditLogsService.create({
      tenantId,
      actorId,
      action: 'document.deleted',
      entityType: 'document',
      entityId: id,
      metadata: { status: existing.status }
    });

    return { success: true };
  }

  private async ensureOwnerBelongsToTenant(tenantId: string, ownerId?: string) {
    if (!ownerId) {
      return;
    }

    const owner = await this.prisma.user.findFirst({
      where: { id: ownerId, tenantId, isActive: true },
      select: { id: true }
    });

    if (!owner) {
      throw new BadRequestException('Selected owner is not active in this tenant');
    }
  }

  private assertValidStatusTransition(current: DocumentStatus, next: DocumentStatus) {
    if (current === next) {
      return;
    }

    if (!DOCUMENT_STATUS_FLOW[current].includes(next)) {
      throw new BadRequestException(`Invalid document status transition: ${current} -> ${next}`);
    }
  }

  private assertApprovalPermission(actorPermissions: string[], current: DocumentStatus, next: DocumentStatus) {
    if (current !== DocumentStatus.APPROVED && next === DocumentStatus.APPROVED && !actorPermissions.includes('documents.approve')) {
      throw new BadRequestException('Your role does not allow document approval');
    }
  }

  private hasSubstantiveChange(existing: Prisma.DocumentUncheckedCreateInput, dto: UpdateDocumentDto) {
    return Boolean(
      (dto.code && dto.code.trim().toUpperCase() !== existing.code) ||
        (dto.title && dto.title.trim() !== existing.title) ||
        (dto.type && dto.type.trim() !== existing.type) ||
        (dto.summary !== undefined && this.normalizeText(dto.summary) !== existing.summary) ||
        (dto.ownerId !== undefined && (dto.ownerId || null) !== existing.ownerId) ||
        (dto.effectiveDate !== undefined &&
          this.toIsoDate(dto.effectiveDate) !== this.toIsoDate(existing.effectiveDate)) ||
        (dto.reviewDueDate !== undefined &&
          this.toIsoDate(dto.reviewDueDate) !== this.toIsoDate(existing.reviewDueDate)) ||
        (dto.changeSummary !== undefined &&
          this.normalizeText(dto.changeSummary) !== existing.changeSummary) ||
        (dto.status !== undefined && dto.status !== existing.status)
    );
  }

  private resolveApprovedAt(
    current: DocumentStatus,
    next: DocumentStatus,
    existingApprovedAt: Date | null
  ) {
    if (current !== DocumentStatus.APPROVED && next === DocumentStatus.APPROVED) {
      return new Date();
    }

    if (next === DocumentStatus.DRAFT) {
      return null;
    }

    return existingApprovedAt ?? undefined;
  }

  private normalizeText(value?: string) {
    const trimmed = value?.trim();
    return trimmed ? trimmed : null;
  }

  private toIsoDate(value?: string | Date | null) {
    if (!value) {
      return null;
    }

    const date = typeof value === 'string' ? new Date(value) : value;
    return Number.isNaN(date.getTime()) ? null : date.toISOString().slice(0, 10);
  }

  private handleDocumentWriteError(error: unknown): never {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002'
    ) {
      throw new ConflictException('Document code already exists in this tenant');
    }

    throw error;
  }
}
