import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../common/auth/current-user.decorator';
import { JwtAuthGuard } from '../../common/auth/jwt-auth.guard';
import { PackageModule } from '../../common/auth/package-module.decorator';
import { Permissions } from '../../common/auth/permissions.decorator';
import { PermissionsGuard } from '../../common/auth/permissions.guard';
import { CurrentTenant } from '../../common/tenancy/current-tenant.decorator';
import { CreateProcessLinkDto } from './dto/create-process-link.dto';
import { CreateProcessRegisterDto } from './dto/create-process-register.dto';
import { UpdateProcessRegisterDto } from './dto/update-process-register.dto';
import { ProcessRegisterService } from './process-register.service';

@ApiTags('process-register')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@PackageModule('process-register')
@Controller('process-register')
export class ProcessRegisterController {
  constructor(private readonly processRegisterService: ProcessRegisterService) {}

  @Get()
  @Permissions('processes.read')
  list(
    @CurrentTenant() tenantId: string,
    @Query('search') search?: string,
    @Query('status') status?: 'ACTIVE' | 'ARCHIVED',
    @Query('ownerUserId') ownerUserId?: string
  ) {
    return this.processRegisterService.list(tenantId, {
      search,
      status,
      ownerUserId
    });
  }

  @Get(':id')
  @Permissions('processes.read')
  get(@CurrentTenant() tenantId: string, @Param('id') id: string) {
    return this.processRegisterService.get(tenantId, id);
  }

  @Post()
  @Permissions('processes.write')
  create(
    @CurrentTenant() tenantId: string,
    @CurrentUser() user: { sub: string },
    @Body() dto: CreateProcessRegisterDto
  ) {
    return this.processRegisterService.create(tenantId, user.sub, dto);
  }

  @Patch(':id')
  @Permissions('processes.write')
  update(
    @CurrentTenant() tenantId: string,
    @CurrentUser() user: { sub: string },
    @Param('id') id: string,
    @Body() dto: UpdateProcessRegisterDto
  ) {
    return this.processRegisterService.update(tenantId, user.sub, id, dto);
  }

  @Delete(':id')
  @Permissions('admin.delete')
  remove(
    @CurrentTenant() tenantId: string,
    @CurrentUser() user: { sub: string },
    @Param('id') id: string
  ) {
    return this.processRegisterService.remove(tenantId, user.sub, id);
  }

  @Get(':id/links')
  @Permissions('processes.read')
  listLinks(@CurrentTenant() tenantId: string, @Param('id') id: string) {
    return this.processRegisterService.listLinks(tenantId, id);
  }

  @Post(':id/links')
  @Permissions('processes.write')
  addLink(
    @CurrentTenant() tenantId: string,
    @CurrentUser() user: { sub: string },
    @Param('id') id: string,
    @Body() dto: CreateProcessLinkDto
  ) {
    return this.processRegisterService.addLink(tenantId, user.sub, id, dto);
  }

  @Delete(':id/links/:linkId')
  @Permissions('processes.write')
  removeLink(
    @CurrentTenant() tenantId: string,
    @CurrentUser() user: { sub: string },
    @Param('id') id: string,
    @Param('linkId') linkId: string
  ) {
    return this.processRegisterService.removeLink(tenantId, user.sub, id, linkId);
  }
}
