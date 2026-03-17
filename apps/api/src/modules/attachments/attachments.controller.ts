import { Controller, Get, Param, Post, UploadedFile, UseGuards, UseInterceptors } from '@nestjs/common';
import { ApiBearerAuth, ApiConsumes, ApiTags } from '@nestjs/swagger';
import { FileInterceptor } from '@nestjs/platform-express';
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

  @Get(':sourceType/:sourceId')
  @Permissions('dashboard.read')
  list(
    @CurrentTenant() tenantId: string,
    @Param('sourceType') sourceType: string,
    @Param('sourceId') sourceId: string
  ) {
    return this.attachmentsService.list(tenantId, sourceType, sourceId);
  }

  @Post(':sourceType/:sourceId')
  @Permissions('attachments.write')
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
}
