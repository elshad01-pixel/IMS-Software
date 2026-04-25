import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Client } from 'minio';
import { randomUUID } from 'node:crypto';
import { extname } from 'node:path';
import { Readable } from 'node:stream';
import { normalizeStoredFileName } from '../../common/http/download-header.util';
import { PrismaService } from '../../common/prisma/prisma.service';
import { AuditLogsService } from '../audit-logs/audit-logs.service';

@Injectable()
export class AttachmentsService {
  private readonly maxUploadBytes = 15 * 1024 * 1024;
  private readonly blockedExtensions = new Set([
    '.exe',
    '.bat',
    '.cmd',
    '.com',
    '.msi',
    '.scr',
    '.ps1',
    '.sh',
    '.jar'
  ]);

  private readonly blockedMimeTypes = new Set([
    'application/x-msdownload',
    'application/x-msdos-program',
    'application/x-sh',
    'application/x-bat',
    'application/x-csh',
    'application/java-archive'
  ]);

  private readonly attachmentPermissionMap: Record<string, { read: string; write: string }> = {
    document: { read: 'documents.read', write: 'documents.write' },
    risk: { read: 'risks.read', write: 'risks.write' },
    capa: { read: 'capa.read', write: 'capa.write' },
    audit: { read: 'audits.read', write: 'audits.write' },
    'audit-checklist-item': { read: 'audits.read', write: 'audits.write' },
    'management-review': { read: 'management-review.read', write: 'management-review.write' },
    ncr: { read: 'ncr.read', write: 'ncr.write' },
    incident: { read: 'incidents.read', write: 'incidents.write' },
    settings: { read: 'settings.read', write: 'settings.write' }
  };

  private readonly minioClient: Client;
  private readonly bucket: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
    private readonly auditLogsService: AuditLogsService
  ) {
    this.bucket = this.configService.get('MINIO_BUCKET', 'attachments');
    this.minioClient = new Client({
      endPoint: this.configService.get('MINIO_ENDPOINT', 'localhost'),
      port: Number(this.configService.get('MINIO_PORT', 9000)),
      useSSL: this.configService.get('MINIO_USE_SSL', 'false') === 'true',
      accessKey: this.configService.get('MINIO_ROOT_USER', 'minioadmin'),
      secretKey: this.configService.get('MINIO_ROOT_PASSWORD', 'minioadmin')
    });
    void this.ensureBucket();
  }

  async list(tenantId: string, actorId: string, sourceType: string, sourceId: string) {
    await this.ensureSourcePermission(tenantId, actorId, sourceType, 'read');
    await this.ensureSourceRecordExists(tenantId, sourceType, sourceId);
    return this.prisma.attachment.findMany({
      where: { tenantId, sourceType, sourceId, deletedAt: null },
      orderBy: { createdAt: 'desc' }
    });
  }

  async download(tenantId: string, actorId: string, attachmentId: string) {
    const attachment = await this.prisma.attachment.findFirst({
      where: { id: attachmentId, tenantId, deletedAt: null }
    });

    if (!attachment) {
      throw new NotFoundException('Attachment not found.');
    }

    await this.ensureSourcePermission(tenantId, actorId, attachment.sourceType, 'read');

    const objectStream = await this.minioClient.getObject(this.bucket, attachment.objectKey);

    await this.auditLogsService.create({
      tenantId,
      actorId,
      action: 'attachment.downloaded',
      entityType: attachment.sourceType,
      entityId: attachment.sourceId,
      metadata: { attachmentId: attachment.id, fileName: attachment.fileName }
    });

    return {
      attachment,
      stream: objectStream as Readable
    };
  }

  async readLatestSourceAttachmentBuffer(
    tenantId: string,
    sourceType: string,
    sourceId: string
  ) {
    const attachment = await this.prisma.attachment.findFirst({
      where: {
        tenantId,
        sourceType,
        sourceId,
        deletedAt: null
      },
      orderBy: [{ createdAt: 'desc' }]
    });

    if (!attachment) {
      return null;
    }

    const objectStream = (await this.minioClient.getObject(
      this.bucket,
      attachment.objectKey
    )) as Readable;

    const chunks: Buffer[] = [];
    for await (const chunk of objectStream) {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    }

    return {
      attachment,
      buffer: Buffer.concat(chunks)
    };
  }

  async upload(
    tenantId: string,
    actorId: string,
    sourceType: string,
    sourceId: string,
    file: {
      originalname: string;
      buffer: Buffer;
      size: number;
      mimetype: string;
    }
  ) {
    await this.ensureSourcePermission(tenantId, actorId, sourceType, 'write');
    await this.ensureSourceRecordExists(tenantId, sourceType, sourceId);
    const safeFileName = this.validateUploadFile(file);

    const objectKey = `${tenantId}/${sourceType}/${sourceId}/${randomUUID()}-${safeFileName}`;
    await this.minioClient.putObject(this.bucket, objectKey, file.buffer, file.size, {
      'Content-Type': file.mimetype
    });

    const attachment = await this.prisma.attachment.create({
      data: {
        tenantId,
        uploadedById: actorId,
        fileName: safeFileName,
        objectKey,
        mimeType: file.mimetype,
        size: file.size,
        sourceType,
        sourceId
      }
    });

    await this.auditLogsService.create({
      tenantId,
      actorId,
      action: 'attachment.uploaded',
      entityType: sourceType,
      entityId: sourceId,
      metadata: { attachmentId: attachment.id, fileName: safeFileName }
    });

    return attachment;
  }

  async remove(tenantId: string, actorId: string, attachmentId: string) {
    const attachment = await this.prisma.attachment.findFirst({
      where: { id: attachmentId, tenantId, deletedAt: null }
    });

    if (!attachment) {
      throw new NotFoundException('Attachment not found.');
    }

    await this.minioClient.removeObject(this.bucket, attachment.objectKey).catch(() => undefined);

    await this.prisma.attachment.update({
      where: { id: attachmentId },
      data: {
        deletedAt: new Date(),
        deletedById: actorId
      }
    });

    await this.auditLogsService.create({
      tenantId,
      actorId,
      action: 'attachment.deleted',
      entityType: attachment.sourceType,
      entityId: attachment.sourceId,
      metadata: { attachmentId: attachment.id, fileName: attachment.fileName }
    });

    return { success: true };
  }

  private validateUploadFile(file: {
    originalname: string;
    buffer: Buffer;
    size: number;
    mimetype: string;
  }) {
    if (!file?.buffer?.length || !file.originalname?.trim()) {
      throw new BadRequestException('Choose a file before uploading evidence.');
    }

    if (file.size <= 0) {
      throw new BadRequestException('The selected file is empty.');
    }

    if (file.size > this.maxUploadBytes) {
      throw new BadRequestException('Evidence files must be 15 MB or smaller.');
    }

    const safeFileName = normalizeStoredFileName(file.originalname, 'attachment');
    const extension = extname(safeFileName).toLowerCase();

    if (this.blockedExtensions.has(extension) || this.blockedMimeTypes.has(file.mimetype)) {
      throw new BadRequestException('Executable or script files are not allowed as evidence uploads.');
    }

    return safeFileName;
  }

  private async ensureBucket() {
    const exists = await this.minioClient.bucketExists(this.bucket).catch(() => false);
    if (!exists) {
      await this.minioClient.makeBucket(this.bucket);
    }
  }

  private async ensureSourcePermission(
    tenantId: string,
    actorId: string,
    sourceType: string,
    mode: 'read' | 'write'
  ) {
    const permissions = this.attachmentPermissionMap[sourceType];
    if (!permissions) {
      throw new BadRequestException(`Attachments are not supported for source type "${sourceType}".`);
    }

    const user = await this.prisma.user.findFirst({
      where: { id: actorId, tenantId, isActive: true },
      select: {
        role: {
          select: {
            permissions: {
              select: {
                permission: {
                  select: {
                    key: true
                  }
                }
              }
            }
          }
        }
      }
    });

    const permissionKey = permissions[mode];
    const permissionKeys = user?.role?.permissions.map((entry) => entry.permission.key) ?? [];

    if (!permissionKeys.includes(permissionKey)) {
      throw new ForbiddenException(`Your role does not include ${permissionKey}.`);
    }
  }

  private async ensureSourceRecordExists(tenantId: string, sourceType: string, sourceId: string) {
    let exists = false;

    switch (sourceType) {
      case 'document':
        exists = !!(await this.prisma.document.findFirst({ where: { tenantId, id: sourceId, deletedAt: null }, select: { id: true } }));
        break;
      case 'risk':
        exists = !!(await this.prisma.risk.findFirst({ where: { tenantId, id: sourceId, deletedAt: null }, select: { id: true } }));
        break;
      case 'capa':
        exists = !!(await this.prisma.capa.findFirst({ where: { tenantId, id: sourceId, deletedAt: null }, select: { id: true } }));
        break;
      case 'audit':
        exists = !!(await this.prisma.audit.findFirst({ where: { tenantId, id: sourceId, deletedAt: null }, select: { id: true } }));
        break;
      case 'audit-checklist-item':
        exists = !!(await this.prisma.auditChecklistItem.findFirst({ where: { tenantId, id: sourceId }, select: { id: true } }));
        break;
      case 'management-review':
        exists = !!(await this.prisma.managementReview.findFirst({ where: { tenantId, id: sourceId, deletedAt: null }, select: { id: true } }));
        break;
      case 'ncr':
        exists = !!(await this.prisma.ncr.findFirst({ where: { tenantId, id: sourceId, deletedAt: null }, select: { id: true } }));
        break;
      case 'incident':
        exists = !!(await this.prisma.incident.findFirst({ where: { tenantId, id: sourceId, deletedAt: null }, select: { id: true } }));
        break;
      case 'settings':
        exists = sourceId === 'organization-logo';
        break;
      default:
        exists = false;
    }

    if (!exists) {
      throw new NotFoundException('Attachment source record was not found.');
    }
  }
}
