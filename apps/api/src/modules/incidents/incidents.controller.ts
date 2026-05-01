import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../common/auth/current-user.decorator';
import { JwtAuthGuard } from '../../common/auth/jwt-auth.guard';
import { PackageModule } from '../../common/auth/package-module.decorator';
import { Permissions } from '../../common/auth/permissions.decorator';
import { PermissionsGuard } from '../../common/auth/permissions.guard';
import { CurrentTenant } from '../../common/tenancy/current-tenant.decorator';
import { CreateIncidentDto } from './dto/create-incident.dto';
import { CreateIncidentLinkDto } from './dto/create-incident-link.dto';
import { UpdateIncidentDto } from './dto/update-incident.dto';
import { IncidentsService } from './incidents.service';

@ApiTags('incidents')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@PackageModule('incidents')
@Controller('incidents')
export class IncidentsController {
  constructor(private readonly incidentsService: IncidentsService) {}

  @Get()
  @Permissions('incidents.read')
  list(
    @CurrentTenant() tenantId: string,
    @Query('search') search?: string,
    @Query('status') status?: 'REPORTED' | 'INVESTIGATION' | 'ACTION_IN_PROGRESS' | 'CLOSED' | 'ARCHIVED',
    @Query('type') type?: 'INCIDENT' | 'NEAR_MISS',
    @Query('ownerUserId') ownerUserId?: string
  ) {
    return this.incidentsService.list(tenantId, { search, status, type, ownerUserId });
  }

  @Get(':id')
  @Permissions('incidents.read')
  get(@CurrentTenant() tenantId: string, @Param('id') id: string) {
    return this.incidentsService.get(tenantId, id);
  }

  @Post()
  @Permissions('incidents.write')
  create(
    @CurrentTenant() tenantId: string,
    @CurrentUser() user: { sub: string },
    @Body() dto: CreateIncidentDto
  ) {
    return this.incidentsService.create(tenantId, user.sub, dto);
  }

  @Patch(':id')
  @Permissions('incidents.write')
  update(
    @CurrentTenant() tenantId: string,
    @CurrentUser() user: { sub: string },
    @Param('id') id: string,
    @Body() dto: UpdateIncidentDto
  ) {
    return this.incidentsService.update(tenantId, user.sub, id, dto);
  }

  @Delete(':id')
  @Permissions('admin.delete')
  remove(
    @CurrentTenant() tenantId: string,
    @CurrentUser() user: { sub: string },
    @Param('id') id: string
  ) {
    return this.incidentsService.remove(tenantId, user.sub, id);
  }

  @Get(':id/links')
  @Permissions('incidents.read')
  listLinks(@CurrentTenant() tenantId: string, @Param('id') id: string) {
    return this.incidentsService.listLinks(tenantId, id);
  }

  @Post(':id/links')
  @Permissions('incidents.write')
  addLink(
    @CurrentTenant() tenantId: string,
    @CurrentUser() user: { sub: string },
    @Param('id') id: string,
    @Body() dto: CreateIncidentLinkDto
  ) {
    return this.incidentsService.addLink(tenantId, user.sub, id, dto);
  }

  @Delete(':id/links/:linkId')
  @Permissions('incidents.write')
  removeLink(
    @CurrentTenant() tenantId: string,
    @CurrentUser() user: { sub: string },
    @Param('id') id: string,
    @Param('linkId') linkId: string
  ) {
    return this.incidentsService.removeLink(tenantId, user.sub, id, linkId);
  }
}
