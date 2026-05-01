import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import {
  NcrCategory,
  NcrPriority,
  NcrSeverity,
  NcrSource,
  NcrStatus
} from '@prisma/client';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../common/auth/current-user.decorator';
import { JwtAuthGuard } from '../../common/auth/jwt-auth.guard';
import { PackageModule } from '../../common/auth/package-module.decorator';
import { Permissions } from '../../common/auth/permissions.decorator';
import { PermissionsGuard } from '../../common/auth/permissions.guard';
import { CurrentTenant } from '../../common/tenancy/current-tenant.decorator';
import { CreateNcrCommentDto } from './dto/create-ncr-comment.dto';
import { CreateNcrDto } from './dto/create-ncr.dto';
import { UpdateNcrDto } from './dto/update-ncr.dto';
import { NcrService } from './ncr.service';

@ApiTags('ncr')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@PackageModule('ncr')
@Controller('ncr')
export class NcrController {
  constructor(private readonly ncrService: NcrService) {}

  @Get()
  @Permissions('ncr.read')
  list(
    @CurrentTenant() tenantId: string,
    @Query('search') search?: string,
    @Query('status') status?: NcrStatus,
    @Query('category') category?: NcrCategory,
    @Query('source') source?: NcrSource,
    @Query('severity') severity?: NcrSeverity,
    @Query('priority') priority?: NcrPriority,
    @Query('ownerUserId') ownerUserId?: string
  ) {
    return this.ncrService.list(tenantId, {
      search,
      status,
      category,
      source,
      severity,
      priority,
      ownerUserId
    });
  }

  @Get(':id/comments')
  @Permissions('ncr.read')
  listComments(@CurrentTenant() tenantId: string, @Param('id') id: string) {
    return this.ncrService.listComments(tenantId, id);
  }

  @Get(':id/activity')
  @Permissions('ncr.read')
  activity(@CurrentTenant() tenantId: string, @Param('id') id: string) {
    return this.ncrService.activity(tenantId, id);
  }

  @Post(':id/comments')
  @Permissions('ncr.write')
  addComment(
    @CurrentTenant() tenantId: string,
    @CurrentUser() user: { sub: string },
    @Param('id') id: string,
    @Body() dto: CreateNcrCommentDto
  ) {
    return this.ncrService.addComment(tenantId, user.sub, id, dto);
  }

  @Get(':id')
  @Permissions('ncr.read')
  get(@CurrentTenant() tenantId: string, @Param('id') id: string) {
    return this.ncrService.get(tenantId, id);
  }

  @Post()
  @Permissions('ncr.write')
  create(
    @CurrentTenant() tenantId: string,
    @CurrentUser() user: { sub: string },
    @Body() dto: CreateNcrDto
  ) {
    return this.ncrService.create(tenantId, user.sub, dto);
  }

  @Patch(':id')
  @Permissions('ncr.write')
  update(
    @CurrentTenant() tenantId: string,
    @CurrentUser() user: { sub: string },
    @Param('id') id: string,
    @Body() dto: UpdateNcrDto
  ) {
    return this.ncrService.update(tenantId, user.sub, id, dto);
  }

  @Delete(':id')
  @Permissions('admin.delete')
  remove(
    @CurrentTenant() tenantId: string,
    @CurrentUser() user: { sub: string },
    @Param('id') id: string
  ) {
    return this.ncrService.remove(tenantId, user.sub, id);
  }
}
