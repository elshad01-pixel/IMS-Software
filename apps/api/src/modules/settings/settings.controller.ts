import { Body, Controller, Get, Param, Put, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/auth/jwt-auth.guard';
import { Permissions } from '../../common/auth/permissions.decorator';
import { PermissionsGuard } from '../../common/auth/permissions.guard';
import { CurrentTenant } from '../../common/tenancy/current-tenant.decorator';
import { UpdateSettingDto } from './dto/update-setting.dto';
import { UpdateRoleSettingsDto } from './dto/update-role-settings.dto';
import { UpdateSettingsSectionDto } from './dto/update-settings-section.dto';
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

  @Get('config')
  @Permissions('settings.read')
  config(@CurrentTenant() tenantId: string) {
    return this.settingsService.getConfig(tenantId);
  }

  @Get('implementation')
  @Permissions('dashboard.read')
  implementation(@CurrentTenant() tenantId: string) {
    return this.settingsService.getImplementationConfig(tenantId);
  }

  @Get('roles')
  @Permissions('settings.read')
  roles(@CurrentTenant() tenantId: string) {
    return this.settingsService.listRoles(tenantId);
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

  @Put('section/:section')
  @Permissions('settings.write')
  updateSection(
    @CurrentTenant() tenantId: string,
    @Param('section') section: string,
    @Body() dto: UpdateSettingsSectionDto
  ) {
    return this.settingsService.updateSection(tenantId, section, dto.values);
  }

  @Put('roles/:roleId')
  @Permissions('settings.write')
  updateRole(
    @CurrentTenant() tenantId: string,
    @Param('roleId') roleId: string,
    @Body() dto: UpdateRoleSettingsDto
  ) {
    return this.settingsService.updateRole(tenantId, roleId, dto);
  }
}
