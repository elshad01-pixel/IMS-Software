import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Client } from 'minio';
import { randomUUID } from 'node:crypto';
import { PrismaService } from '../../common/prisma/prisma.service';
import { AuditLogsService } from '../audit-logs/audit-logs.service';

@Injectable()
export class AttachmentsService {
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

  list(tenantId: string, sourceType: string, sourceId: string) {
    return this.prisma.attachment.findMany({
      where: { tenantId, sourceType, sourceId },
      orderBy: { createdAt: 'desc' }
    });
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
    const objectKey = `${tenantId}/${sourceType}/${sourceId}/${randomUUID()}-${file.originalname}`;
    await this.minioClient.putObject(this.bucket, objectKey, file.buffer, file.size, {
      'Content-Type': file.mimetype
    });

    const attachment = await this.prisma.attachment.create({
      data: {
        tenantId,
        uploadedById: actorId,
        fileName: file.originalname,
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
      metadata: { attachmentId: attachment.id, fileName: file.originalname }
    });

    return attachment;
  }

  private async ensureBucket() {
    const exists = await this.minioClient.bucketExists(this.bucket).catch(() => false);
    if (!exists) {
      await this.minioClient.makeBucket(this.bucket);
    }
  }
}
