import { BadRequestException, Injectable } from '@nestjs/common';
import { ActionItemStatus } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';
import { AuditLogsService } from '../audit-logs/audit-logs.service';
import { CreateActionItemDto } from './dto/create-action-item.dto';

@Injectable()
export class ActionItemsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLogsService: AuditLogsService
  ) {}

  list(tenantId: string, sourceType?: string, sourceId?: string) {
    return this.prisma.actionItem.findMany({
      where: { tenantId, sourceType, sourceId },
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
      orderBy: { createdAt: 'desc' }
    });
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
    await this.prisma.actionItem.findFirstOrThrow({
      where: { id, tenantId }
    });

    const actionItem = await this.prisma.actionItem.update({
      where: { id },
      data: { status: ActionItemStatus.DONE }
    });

    await this.auditLogsService.create({
      tenantId,
      actorId,
      action: 'action-item.completed',
      entityType: 'action-item',
      entityId: actionItem.id
    });

    return actionItem;
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
}
