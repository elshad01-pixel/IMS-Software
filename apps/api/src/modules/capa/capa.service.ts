import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Capa, CapaStatus } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';
import { AuditLogsService } from '../audit-logs/audit-logs.service';
import { CreateCapaDto } from './dto/create-capa.dto';
import { UpdateCapaDto } from './dto/update-capa.dto';

const CAPA_STATUS_FLOW: Record<CapaStatus, CapaStatus[]> = {
  [CapaStatus.OPEN]: [CapaStatus.INVESTIGATING, CapaStatus.ACTION_PLANNED, CapaStatus.CLOSED],
  [CapaStatus.INVESTIGATING]: [CapaStatus.ACTION_PLANNED, CapaStatus.CLOSED],
  [CapaStatus.ACTION_PLANNED]: [CapaStatus.IN_PROGRESS, CapaStatus.CLOSED],
  [CapaStatus.IN_PROGRESS]: [CapaStatus.VERIFIED, CapaStatus.CLOSED],
  [CapaStatus.VERIFIED]: [CapaStatus.CLOSED, CapaStatus.IN_PROGRESS],
  [CapaStatus.CLOSED]: []
};

@Injectable()
export class CapaService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLogsService: AuditLogsService
  ) {}

  list(tenantId: string) {
    return this.prisma.capa.findMany({
      where: { tenantId },
      orderBy: [{ updatedAt: 'desc' }, { dueDate: 'asc' }]
    });
  }

  get(tenantId: string, id: string) {
    return this.prisma.capa.findFirstOrThrow({
      where: { tenantId, id }
    });
  }

  async create(tenantId: string, actorId: string, dto: CreateCapaDto) {
    await this.ensureOwnerBelongsToTenant(tenantId, dto.ownerId);
    await this.assertClosureRules(tenantId, undefined, dto);

    const capa = await this.prisma.capa.create({
      data: {
        tenantId,
        title: dto.title.trim(),
        source: dto.source.trim(),
        category: this.normalizeText(dto.category),
        problemStatement: dto.problemStatement.trim(),
        containmentAction: this.normalizeText(dto.containmentAction),
        rootCause: this.normalizeText(dto.rootCause),
        correction: this.normalizeText(dto.correction),
        correctiveAction: this.normalizeText(dto.correctiveAction),
        preventiveAction: this.normalizeText(dto.preventiveAction),
        verificationMethod: this.normalizeText(dto.verificationMethod),
        closureSummary: this.normalizeText(dto.closureSummary),
        ownerId: dto.ownerId || null,
        dueDate: dto.dueDate ? new Date(dto.dueDate) : null,
        status: dto.status ?? CapaStatus.OPEN
      }
    });

    await this.auditLogsService.create({
      tenantId,
      actorId,
      action: 'capa.created',
      entityType: 'capa',
      entityId: capa.id,
      metadata: dto
    });

    return capa;
  }

  async update(tenantId: string, actorId: string, id: string, dto: UpdateCapaDto) {
    const existing = await this.prisma.capa.findFirst({
      where: { id, tenantId }
    });

    if (!existing) {
      throw new NotFoundException('CAPA not found');
    }

    await this.ensureOwnerBelongsToTenant(tenantId, dto.ownerId);

    const nextStatus = dto.status ?? existing.status;
    this.assertValidStatusTransition(existing.status, nextStatus);
    await this.assertClosureRules(tenantId, id, dto, existing);

    const capa = await this.prisma.capa.update({
      where: { id },
      data: this.toUpdateCapaData(dto, existing)
    });

    await this.auditLogsService.create({
      tenantId,
      actorId,
      action: 'capa.updated',
      entityType: 'capa',
      entityId: capa.id,
      metadata: dto
    });

    return capa;
  }

  private toUpdateCapaData(dto: UpdateCapaDto, existing?: Capa) {
    const nextStatus = dto.status ?? existing?.status ?? CapaStatus.OPEN;

    return {
      title: dto.title?.trim(),
      source: dto.source?.trim(),
      category: dto.category !== undefined ? this.normalizeText(dto.category) : undefined,
      problemStatement: dto.problemStatement?.trim(),
      containmentAction:
        dto.containmentAction !== undefined ? this.normalizeText(dto.containmentAction) : undefined,
      rootCause: dto.rootCause !== undefined ? this.normalizeText(dto.rootCause) : undefined,
      correction: dto.correction !== undefined ? this.normalizeText(dto.correction) : undefined,
      correctiveAction:
        dto.correctiveAction !== undefined ? this.normalizeText(dto.correctiveAction) : undefined,
      preventiveAction:
        dto.preventiveAction !== undefined ? this.normalizeText(dto.preventiveAction) : undefined,
      verificationMethod:
        dto.verificationMethod !== undefined
          ? this.normalizeText(dto.verificationMethod)
          : undefined,
      closureSummary:
        dto.closureSummary !== undefined ? this.normalizeText(dto.closureSummary) : undefined,
      ownerId: dto.ownerId !== undefined ? dto.ownerId || null : undefined,
      dueDate: dto.dueDate !== undefined ? (dto.dueDate ? new Date(dto.dueDate) : null) : undefined,
      status: nextStatus,
      closedAt:
        nextStatus === CapaStatus.CLOSED
          ? existing?.closedAt ?? new Date()
          : nextStatus !== existing?.status
            ? null
            : undefined
    };
  }

  private async assertClosureRules(
    tenantId: string,
    capaId?: string,
    dto?: CreateCapaDto | UpdateCapaDto,
    existing?: Capa
  ) {
    const nextStatus = dto?.status ?? existing?.status;
    if (nextStatus !== CapaStatus.CLOSED) {
      return;
    }

    const rootCause = dto?.rootCause ?? existing?.rootCause;
    const correctiveAction = dto?.correctiveAction ?? existing?.correctiveAction;
    const verificationMethod = dto?.verificationMethod ?? existing?.verificationMethod;
    const closureSummary = dto?.closureSummary ?? existing?.closureSummary;

    if (!rootCause || !correctiveAction || !verificationMethod || !closureSummary) {
      throw new BadRequestException(
        'Root cause, corrective action, verification method, and closure summary are required before closure'
      );
    }

    if (!capaId) {
      return;
    }

    const openActions = await this.prisma.actionItem.count({
      where: {
        tenantId,
        sourceType: 'capa',
        sourceId: capaId,
        status: { not: 'DONE' }
      }
    });

    if (openActions > 0) {
      throw new BadRequestException('Complete all linked CAPA actions before closure');
    }
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

  private assertValidStatusTransition(current: CapaStatus, next: CapaStatus) {
    if (current === next) {
      return;
    }

    if (!CAPA_STATUS_FLOW[current].includes(next)) {
      throw new BadRequestException(`Invalid CAPA status transition: ${current} -> ${next}`);
    }
  }

  private normalizeText(value?: string) {
    const trimmed = value?.trim();
    return trimmed ? trimmed : null;
  }
}
