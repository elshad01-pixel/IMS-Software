import { Body, Controller, Get, Param, Put, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/auth/jwt-auth.guard';
import { Permissions } from '../../common/auth/permissions.decorator';
import { PermissionsGuard } from '../../common/auth/permissions.guard';
import { CurrentTenant } from '../../common/tenancy/current-tenant.decorator';
import { UpdateSettingDto } from './dto/update-setting.dto';
import { SettingsService } from './settings.service';

@ApiTags('settings')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('settings')
export class SettingsController {
  constructor(private readonly settingsService: SettingsService) {}

  @Get()
  @Permissions('settings.read')
  list(@CurrentTenant() tenantId: string) {
    return this.settingsService.list(tenantId);
  }

  @Put(':key')
  @Permissions('settings.write')
  update(
    @CurrentTenant() tenantId: string,
    @Param('key') key: string,
    @Body() dto: UpdateSettingDto
  ) {
    return this.settingsService.update(tenantId, key, dto.value);
  }
}
