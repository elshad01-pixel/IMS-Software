import { Body, Controller, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../common/auth/current-user.decorator';
import { JwtAuthGuard } from '../../common/auth/jwt-auth.guard';
import { Permissions } from '../../common/auth/permissions.decorator';
import { PermissionsGuard } from '../../common/auth/permissions.guard';
import { CurrentTenant } from '../../common/tenancy/current-tenant.decorator';
import { CreateDocumentDto } from './dto/create-document.dto';
import { UpdateDocumentDto } from './dto/update-document.dto';
import { DocumentsService } from './documents.service';

@ApiTags('documents')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('documents')
export class DocumentsController {
  constructor(private readonly documentsService: DocumentsService) {}

  @Get()
  @Permissions('documents.read')
  list(@CurrentTenant() tenantId: string) {
    return this.documentsService.list(tenantId);
  }

  @Get(':id')
  @Permissions('documents.read')
  get(@CurrentTenant() tenantId: string, @Param('id') id: string) {
    return this.documentsService.get(tenantId, id);
  }

  @Post()
  @Permissions('documents.write')
  create(
    @CurrentTenant() tenantId: string,
    @CurrentUser() user: { sub: string },
    @Body() dto: CreateDocumentDto
  ) {
    return this.documentsService.create(tenantId, user.sub, dto);
  }

  @Patch(':id')
  @Permissions('documents.write')
  update(
    @CurrentTenant() tenantId: string,
    @CurrentUser() user: { sub: string },
    @Param('id') id: string,
    @Body() dto: UpdateDocumentDto
  ) {
    return this.documentsService.update(tenantId, user.sub, id, dto);
  }
}
