import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { ActionItemStatus } from '@prisma/client';
import {
  getChangeRequestDelegate,
  getComplianceObligationDelegate,
  getEnvironmentalAspectDelegate,
  getExternalProviderControlDelegate,
  getHazardIdentificationDelegate,
  getIncidentDelegate
} from '../../common/prisma/prisma-delegate-compat';
import { PrismaService } from '../../common/prisma/prisma.service';
import { AuditLogsService } from '../audit-logs/audit-logs.service';
import { CreateActionItemDto } from './dto/create-action-item.dto';
import { UpdateActionItemDto } from './dto/update-action-item.dto';

@Injectable()
export class ActionItemsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLogsService: AuditLogsService
  ) {}

  async list(
    tenantId: string,
    filters: {
      sourceType?: string;
      sourceId?: string;
      status?: ActionItemStatus;
      ownerId?: string;
      dueState?: 'overdue' | 'upcoming';
    } = {}
  ) {
    const items = await this.prisma.actionItem.findMany({
      where: {
        tenantId,
        deletedAt: null,
        sourceType: filters.sourceType,
        sourceId: filters.sourceId,
        status: filters.status,
        ownerId: filters.ownerId,
        dueDate:
          filters.dueState === 'overdue'
            ? { lt: new Date() }
            : filters.dueState === 'upcoming'
              ? { gte: new Date() }
              : undefined
      },
      include: {
        owner: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true
          }
        }
      },
      orderBy: [{ dueDate: 'asc' }, { createdAt: 'desc' }]
    });

    return Promise.all(items.map((item) => this.mapActionItem(tenantId, item)));
  }

  async create(tenantId: string, actorId: string, dto: CreateActionItemDto) {
    await this.ensureOwnerBelongsToTenant(tenantId, dto.ownerId);

    const actionItem = await this.prisma.actionItem.create({
      data: {
        tenantId,
        sourceType: dto.sourceType,
        sourceId: dto.sourceId,
        title: dto.title,
        description: dto.description,
        ownerId: dto.ownerId,
        dueDate: dto.dueDate ? new Date(dto.dueDate) : undefined
      }
    });

    await this.auditLogsService.create({
      tenantId,
      actorId,
      action: 'action-item.created',
      entityType: 'action-item',
      entityId: actionItem.id,
      metadata: dto
    });

    return actionItem;
  }

  async complete(tenantId: string, actorId: string, id: string) {
    const actionItem = await this.update(tenantId, actorId, id, {
      status: ActionItemStatus.DONE
    });

    await this.auditLogsService.create({
      tenantId,
      actorId,
      action: 'action-item.completed',
      entityType: 'action-item',
      entityId: id
    });

    return actionItem;
  }

  async update(tenantId: string, actorId: string, id: string, dto: UpdateActionItemDto) {
    const existing = await this.prisma.actionItem.findFirst({
      where: { id, tenantId, deletedAt: null }
    });

    if (!existing) {
      throw new NotFoundException('Action item not found');
    }

    await this.ensureOwnerBelongsToTenant(tenantId, dto.ownerId);

    const actionItem = await this.prisma.actionItem.update({
      where: { id },
      data: {
        title: dto.title?.trim(),
        description: dto.description !== undefined ? dto.description.trim() || null : undefined,
        ownerId: dto.ownerId !== undefined ? dto.ownerId || null : undefined,
        dueDate: dto.dueDate !== undefined ? (dto.dueDate ? new Date(dto.dueDate) : null) : undefined,
        status: dto.status
      },
      include: {
        owner: {
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
      action: 'action-item.updated',
      entityType: 'action-item',
      entityId: id,
      metadata: dto
    });

    return this.mapActionItem(tenantId, actionItem);
  }

  async remove(tenantId: string, actorId: string, id: string) {
    const existing = await this.prisma.actionItem.findFirst({
      where: { id, tenantId, deletedAt: null }
    });

    if (!existing) {
      throw new NotFoundException('Action item not found');
    }

    if (existing.status === ActionItemStatus.DONE) {
      throw new BadRequestException('Completed actions cannot be deleted.');
    }

    await this.prisma.actionItem.update({
      where: { id },
      data: {
        deletedAt: new Date(),
        deletedById: actorId
      }
    });

    await this.auditLogsService.create({
      tenantId,
      actorId,
      action: 'action-item.deleted',
      entityType: 'action-item',
      entityId: id,
      metadata: { status: existing.status, sourceType: existing.sourceType, sourceId: existing.sourceId }
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
      throw new BadRequestException('Selected action owner is not active in this tenant');
    }
  }

  private async mapActionItem(
    tenantId: string,
    item: {
      id: string;
      sourceType: string;
      sourceId: string;
      title: string;
      description: string | null;
      dueDate: Date | null;
      status: ActionItemStatus;
      createdAt: Date;
      updatedAt: Date;
      ownerId: string | null;
      owner?: { id: string; firstName: string; lastName: string; email: string } | null;
    }
  ) {
    return {
      ...item,
      dueDate: item.dueDate?.toISOString() ?? null,
      sourceLabel: this.formatSourceLabel(item.sourceType),
      sourceTitle: await this.resolveSourceTitle(tenantId, item.sourceType, item.sourceId)
    };
  }

  private formatSourceLabel(sourceType: string) {
    const normalized = sourceType.toLowerCase();
    if (normalized === 'capa') return 'CAPA';
    if (normalized === 'ncr') return 'NCR';
    if (normalized === 'management-review') return 'Management Review';
    if (normalized === 'incident') return 'Incident';
    if (normalized === 'provider') return 'External Provider';
    if (normalized === 'change-management') return 'Change Management';
    if (normalized === 'hazard') return 'Hazard';
    if (normalized === 'aspect') return 'Environmental Aspect';
    if (normalized === 'obligation') return 'Compliance Obligation';
    return normalized.charAt(0).toUpperCase() + normalized.slice(1);
  }

  private async resolveSourceTitle(tenantId: string, sourceType: string, sourceId: string) {
    const normalized = sourceType.toLowerCase();

    if (normalized === 'risk') {
      return (await this.prisma.risk.findFirst({
        where: { tenantId, id: sourceId, deletedAt: null },
        select: { title: true }
      }))?.title ?? sourceId;
    }

    if (normalized === 'capa') {
      return (await this.prisma.capa.findFirst({
        where: { tenantId, id: sourceId, deletedAt: null },
        select: { title: true }
      }))?.title ?? sourceId;
    }

    if (normalized === 'audit') {
      return (await this.prisma.audit.findFirst({
        where: { tenantId, id: sourceId, deletedAt: null },
        select: { title: true }
      }))?.title ?? sourceId;
    }

    if (normalized === 'management-review') {
      return (await this.prisma.managementReview.findFirst({
        where: { tenantId, id: sourceId, deletedAt: null },
        select: { title: true }
      }))?.title ?? sourceId;
    }

    if (normalized === 'ncr') {
      return (await this.prisma.ncr.findFirst({
        where: { tenantId, id: sourceId, deletedAt: null },
        select: { referenceNo: true, title: true }
      }))?.title ?? sourceId;
    }

    if (normalized === 'incident') {
      return (await getIncidentDelegate(this.prisma).findFirst({
        where: { tenantId, id: sourceId, deletedAt: null },
        select: { referenceNo: true, title: true }
      }))?.title ?? sourceId;
    }

    if (normalized === 'provider') {
      return (await getExternalProviderControlDelegate(this.prisma).findFirst({
        where: { tenantId, id: sourceId, deletedAt: null },
        select: { referenceNo: true, providerName: true }
      }))?.providerName ?? sourceId;
    }

    if (normalized === 'change-management') {
      return (await getChangeRequestDelegate(this.prisma).findFirst({
        where: { tenantId, id: sourceId, deletedAt: null },
        select: { referenceNo: true, title: true }
      }))?.title ?? sourceId;
    }

    if (normalized === 'hazard') {
      return (await getHazardIdentificationDelegate(this.prisma).findFirst({
        where: { tenantId, id: sourceId, deletedAt: null },
        select: { referenceNo: true, hazard: true }
      }))?.hazard ?? sourceId;
    }

    if (normalized === 'aspect') {
      return (await getEnvironmentalAspectDelegate(this.prisma).findFirst({
        where: { tenantId, id: sourceId, deletedAt: null },
        select: { referenceNo: true, aspect: true }
      }))?.aspect ?? sourceId;
    }

    if (normalized === 'obligation') {
      return (await getComplianceObligationDelegate(this.prisma).findFirst({
        where: { tenantId, id: sourceId, deletedAt: null },
        select: { referenceNo: true, title: true }
      }))?.title ?? sourceId;
    }

    return sourceId;
  }
}
