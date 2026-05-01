import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../common/auth/current-user.decorator';
import { JwtAuthGuard } from '../../common/auth/jwt-auth.guard';
import { PackageModule } from '../../common/auth/package-module.decorator';
import { Permissions } from '../../common/auth/permissions.decorator';
import { PermissionsGuard } from '../../common/auth/permissions.guard';
import { CurrentTenant } from '../../common/tenancy/current-tenant.decorator';
import { CreateEnvironmentalAspectDto, EnvironmentalAspectStatusValue } from './dto/create-environmental-aspect.dto';
import { CreateEnvironmentalAspectLinkDto } from './dto/create-environmental-aspect-link.dto';
import { UpdateEnvironmentalAspectDto } from './dto/update-environmental-aspect.dto';
import { EnvironmentalAspectsService } from './environmental-aspects.service';

@ApiTags('environmental-aspects')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@PackageModule('environmental-aspects')
@Controller('environmental-aspects')
export class EnvironmentalAspectsController {
  constructor(private readonly environmentalAspectsService: EnvironmentalAspectsService) {}

  @Get()
  @Permissions('aspects.read')
  list(
    @CurrentTenant() tenantId: string,
    @Query('search') search?: string,
    @Query('status') status?: EnvironmentalAspectStatusValue,
    @Query('ownerUserId') ownerUserId?: string
  ) {
    return this.environmentalAspectsService.list(tenantId, { search, status, ownerUserId });
  }

  @Get(':id')
  @Permissions('aspects.read')
  get(@CurrentTenant() tenantId: string, @Param('id') id: string) {
    return this.environmentalAspectsService.get(tenantId, id);
  }

  @Post()
  @Permissions('aspects.write')
  create(
    @CurrentTenant() tenantId: string,
    @CurrentUser() user: { sub: string },
    @Body() dto: CreateEnvironmentalAspectDto
  ) {
    return this.environmentalAspectsService.create(tenantId, user.sub, dto);
  }

  @Patch(':id')
  @Permissions('aspects.write')
  update(
    @CurrentTenant() tenantId: string,
    @CurrentUser() user: { sub: string },
    @Param('id') id: string,
    @Body() dto: UpdateEnvironmentalAspectDto
  ) {
    return this.environmentalAspectsService.update(tenantId, user.sub, id, dto);
  }

  @Delete(':id')
  @Permissions('admin.delete')
  remove(
    @CurrentTenant() tenantId: string,
    @CurrentUser() user: { sub: string },
    @Param('id') id: string
  ) {
    return this.environmentalAspectsService.remove(tenantId, user.sub, id);
  }

  @Get(':id/links')
  @Permissions('aspects.read')
  listLinks(@CurrentTenant() tenantId: string, @Param('id') id: string) {
    return this.environmentalAspectsService.listLinks(tenantId, id);
  }

  @Post(':id/links')
  @Permissions('aspects.write')
  addLink(
    @CurrentTenant() tenantId: string,
    @CurrentUser() user: { sub: string },
    @Param('id') id: string,
    @Body() dto: CreateEnvironmentalAspectLinkDto
  ) {
    return this.environmentalAspectsService.addLink(tenantId, user.sub, id, dto);
  }

  @Delete(':id/links/:linkId')
  @Permissions('aspects.write')
  removeLink(
    @CurrentTenant() tenantId: string,
    @CurrentUser() user: { sub: string },
    @Param('id') id: string,
    @Param('linkId') linkId: string
  ) {
    return this.environmentalAspectsService.removeLink(tenantId, user.sub, id, linkId);
  }
}
