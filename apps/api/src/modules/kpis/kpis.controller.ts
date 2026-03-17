import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/auth/jwt-auth.guard';
import { Permissions } from '../../common/auth/permissions.decorator';
import { PermissionsGuard } from '../../common/auth/permissions.guard';
import { CurrentTenant } from '../../common/tenancy/current-tenant.decorator';
import { KpisService } from './kpis.service';

@ApiTags('kpis')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('kpis')
export class KpisController {
  constructor(private readonly kpisService: KpisService) {}

  @Get()
  @Permissions('kpis.read')
  list(@CurrentTenant() tenantId: string) {
    return this.kpisService.list(tenantId);
  }
}
