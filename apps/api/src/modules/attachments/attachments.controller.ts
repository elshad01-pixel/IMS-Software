import { Controller, Delete, Get, Param, Post, Res, StreamableFile, UploadedFile, UseGuards, UseInterceptors } from '@nestjs/common';
import { ApiBearerAuth, ApiConsumes, ApiTags } from '@nestjs/swagger';
import { FileInterceptor } from '@nestjs/platform-express';
import { Response } from 'express';
import { CurrentUser } from '../../common/auth/current-user.decorator';
import { JwtAuthGuard } from '../../common/auth/jwt-auth.guard';
import { Permissions } from '../../common/auth/permissions.decorator';
import { PermissionsGuard } from '../../common/auth/permissions.guard';
import { CurrentTenant } from '../../common/tenancy/current-tenant.decorator';
import { AttachmentsService } from './attachments.service';

@ApiTags('attachments')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('attachments')
export class AttachmentsController {
  constructor(private readonly attachmentsService: AttachmentsService) {}

  @Get(':attachmentId/download')
  async download(
    @CurrentTenant() tenantId: string,
    @CurrentUser() user: { sub: string },
    @Param('attachmentId') attachmentId: string,
    @Res({ passthrough: true }) response: Response
  ) {
    const { attachment, stream } = await this.attachmentsService.download(tenantId, user.sub, attachmentId);
    response.setHeader('Content-Type', attachment.mimeType);
    response.setHeader('Content-Length', attachment.size.toString());
    response.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(attachment.fileName)}"`);
    return new StreamableFile(stream);
  }

  @Get(':sourceType/:sourceId')
  list(
    @CurrentTenant() tenantId: string,
    @CurrentUser() user: { sub: string },
    @Param('sourceType') sourceType: string,
    @Param('sourceId') sourceId: string
  ) {
    return this.attachmentsService.list(tenantId, user.sub, sourceType, sourceId);
  }

  @Post(':sourceType/:sourceId')
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FileInterceptor('file'))
  upload(
    @CurrentTenant() tenantId: string,
    @CurrentUser() user: { sub: string },
    @Param('sourceType') sourceType: string,
    @Param('sourceId') sourceId: string,
    @UploadedFile()
    file: {
      originalname: string;
      buffer: Buffer;
      size: number;
      mimetype: string;
    }
  ) {
    return this.attachmentsService.upload(tenantId, user.sub, sourceType, sourceId, file);
  }

  @Delete(':attachmentId')
  @Permissions('admin.delete')
  remove(
    @CurrentTenant() tenantId: string,
    @CurrentUser() user: { sub: string },
    @Param('attachmentId') attachmentId: string
  ) {
    return this.attachmentsService.remove(tenantId, user.sub, attachmentId);
  }
}
