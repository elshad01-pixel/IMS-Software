import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../common/auth/current-user.decorator';
import { JwtAuthGuard } from '../../common/auth/jwt-auth.guard';
import { PackageModule } from '../../common/auth/package-module.decorator';
import { Permissions } from '../../common/auth/permissions.decorator';
import { PermissionsGuard } from '../../common/auth/permissions.guard';
import { CurrentTenant } from '../../common/tenancy/current-tenant.decorator';
import { CreateCapaDto } from './dto/create-capa.dto';
import { UpdateCapaDto } from './dto/update-capa.dto';
import { CapaService } from './capa.service';

@ApiTags('capa')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@PackageModule('capa')
@Controller('capa')
export class CapaController {
  constructor(private readonly capaService: CapaService) {}

  @Get()
  @Permissions('capa.read')
  list(@CurrentTenant() tenantId: string) {
    return this.capaService.list(tenantId);
  }

  @Get(':id')
  @Permissions('capa.read')
  get(@CurrentTenant() tenantId: string, @Param('id') id: string) {
    return this.capaService.get(tenantId, id);
  }

  @Post()
  @Permissions('capa.write')
  create(
    @CurrentTenant() tenantId: string,
    @CurrentUser() user: { sub: string },
    @Body() dto: CreateCapaDto
  ) {
    return this.capaService.create(tenantId, user.sub, dto);
  }

  @Patch(':id')
  @Permissions('capa.write')
  update(
    @CurrentTenant() tenantId: string,
    @CurrentUser() user: { sub: string; permissions?: string[] },
    @Param('id') id: string,
    @Body() dto: UpdateCapaDto
  ) {
    return this.capaService.update(tenantId, user.sub, user.permissions || [], id, dto);
  }

  @Delete(':id')
  @Permissions('admin.delete')
  remove(
    @CurrentTenant() tenantId: string,
    @CurrentUser() user: { sub: string },
    @Param('id') id: string
  ) {
    return this.capaService.remove(tenantId, user.sub, id);
  }
}
