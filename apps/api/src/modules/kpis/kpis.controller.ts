import { Body, Controller, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../common/auth/current-user.decorator';
import { JwtAuthGuard } from '../../common/auth/jwt-auth.guard';
import { PackageModule } from '../../common/auth/package-module.decorator';
import { Permissions } from '../../common/auth/permissions.decorator';
import { PermissionsGuard } from '../../common/auth/permissions.guard';
import { CurrentTenant } from '../../common/tenancy/current-tenant.decorator';
import { CreateKpiDto } from './dto/create-kpi.dto';
import { CreateKpiReadingDto } from './dto/create-kpi-reading.dto';
import { UpdateKpiDto } from './dto/update-kpi.dto';
import { UpdateKpiReadingDto } from './dto/update-kpi-reading.dto';
import { KpisService } from './kpis.service';

@ApiTags('kpis')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@PackageModule('kpis')
@Controller('kpis')
export class KpisController {
  constructor(private readonly kpisService: KpisService) {}

  @Get()
  @Permissions('kpis.read')
  list(@CurrentTenant() tenantId: string) {
    return this.kpisService.list(tenantId);
  }

  @Get(':id')
  @Permissions('kpis.read')
  get(@CurrentTenant() tenantId: string, @Param('id') id: string) {
    return this.kpisService.get(tenantId, id);
  }

  @Post()
  @Permissions('kpis.write')
  create(
    @CurrentTenant() tenantId: string,
    @CurrentUser() user: { sub: string },
    @Body() dto: CreateKpiDto
  ) {
    return this.kpisService.create(tenantId, user.sub, dto);
  }

  @Patch(':id')
  @Permissions('kpis.write')
  update(
    @CurrentTenant() tenantId: string,
    @CurrentUser() user: { sub: string },
    @Param('id') id: string,
    @Body() dto: UpdateKpiDto
  ) {
    return this.kpisService.update(tenantId, user.sub, id, dto);
  }

  @Post(':id/readings')
  @Permissions('kpis.write')
  addReading(
    @CurrentTenant() tenantId: string,
    @CurrentUser() user: { sub: string },
    @Param('id') id: string,
    @Body() dto: CreateKpiReadingDto
  ) {
    return this.kpisService.addReading(tenantId, user.sub, id, dto);
  }

  @Patch('readings/:readingId')
  @Permissions('kpis.write')
  updateReading(
    @CurrentTenant() tenantId: string,
    @CurrentUser() user: { sub: string },
    @Param('readingId') readingId: string,
    @Body() dto: UpdateKpiReadingDto
  ) {
    return this.kpisService.updateReading(tenantId, user.sub, readingId, dto);
  }
}
