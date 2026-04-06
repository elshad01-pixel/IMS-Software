import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../common/auth/current-user.decorator';
import { JwtAuthGuard } from '../../common/auth/jwt-auth.guard';
import { Permissions } from '../../common/auth/permissions.decorator';
import { PermissionsGuard } from '../../common/auth/permissions.guard';
import { CurrentTenant } from '../../common/tenancy/current-tenant.decorator';
import { ComplianceObligationsService } from './compliance-obligations.service';
import { CreateComplianceObligationLinkDto } from './dto/create-compliance-obligation-link.dto';
import { CreateComplianceObligationDto } from './dto/create-compliance-obligation.dto';
import { UpdateComplianceObligationDto } from './dto/update-compliance-obligation.dto';

@ApiTags('compliance-obligations')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('compliance-obligations')
export class ComplianceObligationsController {
  constructor(private readonly complianceObligationsService: ComplianceObligationsService) {}

  @Get()
  @Permissions('obligations.read')
  list(
    @CurrentTenant() tenantId: string,
    @Query('search') search?: string,
    @Query('status') status?: 'ACTIVE' | 'UNDER_REVIEW' | 'OBSOLETE',
    @Query('ownerUserId') ownerUserId?: string
  ) {
    return this.complianceObligationsService.list(tenantId, { search, status, ownerUserId });
  }

  @Get(':id')
  @Permissions('obligations.read')
  get(@CurrentTenant() tenantId: string, @Param('id') id: string) {
    return this.complianceObligationsService.get(tenantId, id);
  }

  @Post()
  @Permissions('obligations.write')
  create(
    @CurrentTenant() tenantId: string,
    @CurrentUser() user: { sub: string },
    @Body() dto: CreateComplianceObligationDto
  ) {
    return this.complianceObligationsService.create(tenantId, user.sub, dto);
  }

  @Patch(':id')
  @Permissions('obligations.write')
  update(
    @CurrentTenant() tenantId: string,
    @CurrentUser() user: { sub: string },
    @Param('id') id: string,
    @Body() dto: UpdateComplianceObligationDto
  ) {
    return this.complianceObligationsService.update(tenantId, user.sub, id, dto);
  }

  @Delete(':id')
  @Permissions('admin.delete')
  remove(
    @CurrentTenant() tenantId: string,
    @CurrentUser() user: { sub: string },
    @Param('id') id: string
  ) {
    return this.complianceObligationsService.remove(tenantId, user.sub, id);
  }

  @Get(':id/links')
  @Permissions('obligations.read')
  listLinks(@CurrentTenant() tenantId: string, @Param('id') id: string) {
    return this.complianceObligationsService.listLinks(tenantId, id);
  }

  @Post(':id/links')
  @Permissions('obligations.write')
  addLink(
    @CurrentTenant() tenantId: string,
    @CurrentUser() user: { sub: string },
    @Param('id') id: string,
    @Body() dto: CreateComplianceObligationLinkDto
  ) {
    return this.complianceObligationsService.addLink(tenantId, user.sub, id, dto);
  }

  @Delete(':id/links/:linkId')
  @Permissions('obligations.write')
  removeLink(
    @CurrentTenant() tenantId: string,
    @CurrentUser() user: { sub: string },
    @Param('id') id: string,
    @Param('linkId') linkId: string
  ) {
    return this.complianceObligationsService.removeLink(tenantId, user.sub, id, linkId);
  }
}
