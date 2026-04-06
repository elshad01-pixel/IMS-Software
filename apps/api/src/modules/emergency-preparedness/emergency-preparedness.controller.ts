import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../common/auth/current-user.decorator';
import { JwtAuthGuard } from '../../common/auth/jwt-auth.guard';
import { Permissions } from '../../common/auth/permissions.decorator';
import { PermissionsGuard } from '../../common/auth/permissions.guard';
import { CurrentTenant } from '../../common/tenancy/current-tenant.decorator';
import {
  CreateEmergencyPreparednessDto,
  EmergencyPreparednessStatusValue
} from './dto/create-emergency-preparedness.dto';
import { CreateEmergencyPreparednessLinkDto } from './dto/create-emergency-preparedness-link.dto';
import { UpdateEmergencyPreparednessDto } from './dto/update-emergency-preparedness.dto';
import { EmergencyPreparednessService } from './emergency-preparedness.service';

@ApiTags('emergency-preparedness')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('emergency-preparedness')
export class EmergencyPreparednessController {
  constructor(private readonly emergencyPreparednessService: EmergencyPreparednessService) {}

  @Get()
  @Permissions('emergency.read')
  list(
    @CurrentTenant() tenantId: string,
    @Query('search') search?: string,
    @Query('status') status?: EmergencyPreparednessStatusValue,
    @Query('ownerUserId') ownerUserId?: string
  ) {
    return this.emergencyPreparednessService.list(tenantId, { search, status, ownerUserId });
  }

  @Get(':id')
  @Permissions('emergency.read')
  get(@CurrentTenant() tenantId: string, @Param('id') id: string) {
    return this.emergencyPreparednessService.get(tenantId, id);
  }

  @Post()
  @Permissions('emergency.write')
  create(
    @CurrentTenant() tenantId: string,
    @CurrentUser() user: { sub: string },
    @Body() dto: CreateEmergencyPreparednessDto
  ) {
    return this.emergencyPreparednessService.create(tenantId, user.sub, dto);
  }

  @Patch(':id')
  @Permissions('emergency.write')
  update(
    @CurrentTenant() tenantId: string,
    @CurrentUser() user: { sub: string },
    @Param('id') id: string,
    @Body() dto: UpdateEmergencyPreparednessDto
  ) {
    return this.emergencyPreparednessService.update(tenantId, user.sub, id, dto);
  }

  @Delete(':id')
  @Permissions('admin.delete')
  remove(
    @CurrentTenant() tenantId: string,
    @CurrentUser() user: { sub: string },
    @Param('id') id: string
  ) {
    return this.emergencyPreparednessService.remove(tenantId, user.sub, id);
  }

  @Get(':id/links')
  @Permissions('emergency.read')
  listLinks(@CurrentTenant() tenantId: string, @Param('id') id: string) {
    return this.emergencyPreparednessService.listLinks(tenantId, id);
  }

  @Post(':id/links')
  @Permissions('emergency.write')
  addLink(
    @CurrentTenant() tenantId: string,
    @CurrentUser() user: { sub: string },
    @Param('id') id: string,
    @Body() dto: CreateEmergencyPreparednessLinkDto
  ) {
    return this.emergencyPreparednessService.addLink(tenantId, user.sub, id, dto);
  }

  @Delete(':id/links/:linkId')
  @Permissions('emergency.write')
  removeLink(
    @CurrentTenant() tenantId: string,
    @CurrentUser() user: { sub: string },
    @Param('id') id: string,
    @Param('linkId') linkId: string
  ) {
    return this.emergencyPreparednessService.removeLink(tenantId, user.sub, id, linkId);
  }
}
