import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../common/auth/current-user.decorator';
import { JwtAuthGuard } from '../../common/auth/jwt-auth.guard';
import { Permissions } from '../../common/auth/permissions.decorator';
import { PermissionsGuard } from '../../common/auth/permissions.guard';
import { CurrentTenant } from '../../common/tenancy/current-tenant.decorator';
import { CreateHazardDto, HazardStatusValue } from './dto/create-hazard.dto';
import { CreateHazardLinkDto } from './dto/create-hazard-link.dto';
import { UpdateHazardDto } from './dto/update-hazard.dto';
import { HazardsService } from './hazards.service';

@ApiTags('hazards')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('hazards')
export class HazardsController {
  constructor(private readonly hazardsService: HazardsService) {}

  @Get()
  @Permissions('hazards.read')
  list(
    @CurrentTenant() tenantId: string,
    @Query('search') search?: string,
    @Query('status') status?: HazardStatusValue,
    @Query('ownerUserId') ownerUserId?: string
  ) {
    return this.hazardsService.list(tenantId, { search, status, ownerUserId });
  }

  @Get(':id')
  @Permissions('hazards.read')
  get(@CurrentTenant() tenantId: string, @Param('id') id: string) {
    return this.hazardsService.get(tenantId, id);
  }

  @Post()
  @Permissions('hazards.write')
  create(
    @CurrentTenant() tenantId: string,
    @CurrentUser() user: { sub: string },
    @Body() dto: CreateHazardDto
  ) {
    return this.hazardsService.create(tenantId, user.sub, dto);
  }

  @Patch(':id')
  @Permissions('hazards.write')
  update(
    @CurrentTenant() tenantId: string,
    @CurrentUser() user: { sub: string },
    @Param('id') id: string,
    @Body() dto: UpdateHazardDto
  ) {
    return this.hazardsService.update(tenantId, user.sub, id, dto);
  }

  @Delete(':id')
  @Permissions('admin.delete')
  remove(
    @CurrentTenant() tenantId: string,
    @CurrentUser() user: { sub: string },
    @Param('id') id: string
  ) {
    return this.hazardsService.remove(tenantId, user.sub, id);
  }

  @Get(':id/links')
  @Permissions('hazards.read')
  listLinks(@CurrentTenant() tenantId: string, @Param('id') id: string) {
    return this.hazardsService.listLinks(tenantId, id);
  }

  @Post(':id/links')
  @Permissions('hazards.write')
  addLink(
    @CurrentTenant() tenantId: string,
    @CurrentUser() user: { sub: string },
    @Param('id') id: string,
    @Body() dto: CreateHazardLinkDto
  ) {
    return this.hazardsService.addLink(tenantId, user.sub, id, dto);
  }

  @Delete(':id/links/:linkId')
  @Permissions('hazards.write')
  removeLink(
    @CurrentTenant() tenantId: string,
    @CurrentUser() user: { sub: string },
    @Param('id') id: string,
    @Param('linkId') linkId: string
  ) {
    return this.hazardsService.removeLink(tenantId, user.sub, id, linkId);
  }
}
