import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../common/auth/current-user.decorator';
import { JwtAuthGuard } from '../../common/auth/jwt-auth.guard';
import { Permissions } from '../../common/auth/permissions.decorator';
import { PermissionsGuard } from '../../common/auth/permissions.guard';
import { CurrentTenant } from '../../common/tenancy/current-tenant.decorator';
import { ChangeManagementService } from './change-management.service';
import { CreateChangeRequestDto, ChangeRequestStatusValue } from './dto/create-change-request.dto';
import { CreateChangeRequestLinkDto } from './dto/create-change-request-link.dto';
import { UpdateChangeRequestDto } from './dto/update-change-request.dto';

@ApiTags('change-management')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('change-management')
export class ChangeManagementController {
  constructor(private readonly changeManagementService: ChangeManagementService) {}

  @Get()
  @Permissions('change.read')
  list(
    @CurrentTenant() tenantId: string,
    @Query('search') search?: string,
    @Query('status') status?: ChangeRequestStatusValue,
    @Query('ownerUserId') ownerUserId?: string
  ) {
    return this.changeManagementService.list(tenantId, { search, status, ownerUserId });
  }

  @Get(':id')
  @Permissions('change.read')
  get(@CurrentTenant() tenantId: string, @Param('id') id: string) {
    return this.changeManagementService.get(tenantId, id);
  }

  @Post()
  @Permissions('change.write')
  create(@CurrentTenant() tenantId: string, @CurrentUser() user: { sub: string }, @Body() dto: CreateChangeRequestDto) {
    return this.changeManagementService.create(tenantId, user.sub, dto);
  }

  @Patch(':id')
  @Permissions('change.write')
  update(
    @CurrentTenant() tenantId: string,
    @CurrentUser() user: { sub: string },
    @Param('id') id: string,
    @Body() dto: UpdateChangeRequestDto
  ) {
    return this.changeManagementService.update(tenantId, user.sub, id, dto);
  }

  @Delete(':id')
  @Permissions('admin.delete')
  remove(@CurrentTenant() tenantId: string, @CurrentUser() user: { sub: string }, @Param('id') id: string) {
    return this.changeManagementService.remove(tenantId, user.sub, id);
  }

  @Get(':id/links')
  @Permissions('change.read')
  listLinks(@CurrentTenant() tenantId: string, @Param('id') id: string) {
    return this.changeManagementService.listLinks(tenantId, id);
  }

  @Post(':id/links')
  @Permissions('change.write')
  addLink(
    @CurrentTenant() tenantId: string,
    @CurrentUser() user: { sub: string },
    @Param('id') id: string,
    @Body() dto: CreateChangeRequestLinkDto
  ) {
    return this.changeManagementService.addLink(tenantId, user.sub, id, dto);
  }

  @Delete(':id/links/:linkId')
  @Permissions('change.write')
  removeLink(
    @CurrentTenant() tenantId: string,
    @CurrentUser() user: { sub: string },
    @Param('id') id: string,
    @Param('linkId') linkId: string
  ) {
    return this.changeManagementService.removeLink(tenantId, user.sub, id, linkId);
  }
}
