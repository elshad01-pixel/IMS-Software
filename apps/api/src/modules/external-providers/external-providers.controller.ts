import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../common/auth/current-user.decorator';
import { JwtAuthGuard } from '../../common/auth/jwt-auth.guard';
import { Permissions } from '../../common/auth/permissions.decorator';
import { PermissionsGuard } from '../../common/auth/permissions.guard';
import { CurrentTenant } from '../../common/tenancy/current-tenant.decorator';
import {
  CreateExternalProviderDto,
  ExternalProviderStatusValue
} from './dto/create-external-provider.dto';
import { CreateExternalProviderLinkDto } from './dto/create-external-provider-link.dto';
import { UpdateExternalProviderDto } from './dto/update-external-provider.dto';
import { ExternalProvidersService } from './external-providers.service';

@ApiTags('external-providers')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('external-providers')
export class ExternalProvidersController {
  constructor(private readonly externalProvidersService: ExternalProvidersService) {}

  @Get()
  @Permissions('providers.read')
  list(
    @CurrentTenant() tenantId: string,
    @Query('search') search?: string,
    @Query('status') status?: ExternalProviderStatusValue,
    @Query('ownerUserId') ownerUserId?: string
  ) {
    return this.externalProvidersService.list(tenantId, { search, status, ownerUserId });
  }

  @Get(':id')
  @Permissions('providers.read')
  get(@CurrentTenant() tenantId: string, @Param('id') id: string) {
    return this.externalProvidersService.get(tenantId, id);
  }

  @Post()
  @Permissions('providers.write')
  create(@CurrentTenant() tenantId: string, @CurrentUser() user: { sub: string }, @Body() dto: CreateExternalProviderDto) {
    return this.externalProvidersService.create(tenantId, user.sub, dto);
  }

  @Patch(':id')
  @Permissions('providers.write')
  update(
    @CurrentTenant() tenantId: string,
    @CurrentUser() user: { sub: string },
    @Param('id') id: string,
    @Body() dto: UpdateExternalProviderDto
  ) {
    return this.externalProvidersService.update(tenantId, user.sub, id, dto);
  }

  @Delete(':id')
  @Permissions('admin.delete')
  remove(@CurrentTenant() tenantId: string, @CurrentUser() user: { sub: string }, @Param('id') id: string) {
    return this.externalProvidersService.remove(tenantId, user.sub, id);
  }

  @Get(':id/links')
  @Permissions('providers.read')
  listLinks(@CurrentTenant() tenantId: string, @Param('id') id: string) {
    return this.externalProvidersService.listLinks(tenantId, id);
  }

  @Post(':id/links')
  @Permissions('providers.write')
  addLink(
    @CurrentTenant() tenantId: string,
    @CurrentUser() user: { sub: string },
    @Param('id') id: string,
    @Body() dto: CreateExternalProviderLinkDto
  ) {
    return this.externalProvidersService.addLink(tenantId, user.sub, id, dto);
  }

  @Delete(':id/links/:linkId')
  @Permissions('providers.write')
  removeLink(
    @CurrentTenant() tenantId: string,
    @CurrentUser() user: { sub: string },
    @Param('id') id: string,
    @Param('linkId') linkId: string
  ) {
    return this.externalProvidersService.removeLink(tenantId, user.sub, id, linkId);
  }
}
