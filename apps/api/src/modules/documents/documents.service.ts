import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { AuditLogsService } from '../audit-logs/audit-logs.service';
import { CreateDocumentDto } from './dto/create-document.dto';
import { UpdateDocumentDto } from './dto/update-document.dto';

@Injectable()
export class DocumentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLogsService: AuditLogsService
  ) {}

  list(tenantId: string) {
    return this.prisma.document.findMany({
      where: { tenantId },
      orderBy: { updatedAt: 'desc' }
    });
  }

  async create(tenantId: string, actorId: string, dto: CreateDocumentDto) {
    const document = await this.prisma.document.create({
      data: { tenantId, ...dto }
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
  }

  async update(tenantId: string, actorId: string, id: string, dto: UpdateDocumentDto) {
    await this.prisma.document.findFirstOrThrow({
      where: { id, tenantId }
    });

    const document = await this.prisma.document.update({
      where: { id },
      data: dto
    });

    await this.auditLogsService.create({
      tenantId,
      actorId,
      action: 'document.updated',
      entityType: 'document',
      entityId: document.id,
      metadata: dto
    });

    return document;
  }
}
