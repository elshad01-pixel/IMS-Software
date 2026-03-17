import { Injectable } from '@nestjs/common';
import { CapaStatus } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';
import { AuditLogsService } from '../audit-logs/audit-logs.service';
import { CreateCapaDto } from './dto/create-capa.dto';
import { UpdateCapaDto } from './dto/update-capa.dto';

@Injectable()
export class CapaService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLogsService: AuditLogsService
  ) {}

  list(tenantId: string) {
    return this.prisma.capa.findMany({
      where: { tenantId },
      orderBy: { updatedAt: 'desc' }
    });
  }

  async create(tenantId: string, actorId: string, dto: CreateCapaDto) {
    const capa = await this.prisma.capa.create({
      data: {
        tenantId,
        title: dto.title,
        problemStatement: dto.problemStatement,
        rootCause: dto.rootCause,
        correction: dto.correction,
        correctiveAction: dto.correctiveAction,
        preventiveAction: dto.preventiveAction,
        ownerId: dto.ownerId,
        dueDate: dto.dueDate ? new Date(dto.dueDate) : undefined,
        status: (dto.status as CapaStatus | undefined) || CapaStatus.OPEN
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
    await this.prisma.capa.findFirstOrThrow({
      where: { id, tenantId }
    });

    const capa = await this.prisma.capa.update({
      where: { id },
      data: {
        ...dto,
        dueDate: dto.dueDate ? new Date(dto.dueDate) : undefined,
        status: dto.status as CapaStatus | undefined
      }
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
}
