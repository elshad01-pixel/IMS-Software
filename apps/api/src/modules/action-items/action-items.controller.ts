import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../common/auth/current-user.decorator';
import { JwtAuthGuard } from '../../common/auth/jwt-auth.guard';
import { Permissions } from '../../common/auth/permissions.decorator';
import { PermissionsGuard } from '../../common/auth/permissions.guard';
import { CurrentTenant } from '../../common/tenancy/current-tenant.decorator';
import { CreateActionItemDto } from './dto/create-action-item.dto';
import { ActionItemsService } from './action-items.service';

@ApiTags('action-items')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('action-items')
export class ActionItemsController {
  constructor(private readonly actionItemsService: ActionItemsService) {}

  @Get()
  @Permissions('dashboard.read')
  list(
    @CurrentTenant() tenantId: string,
    @Query('sourceType') sourceType?: string,
    @Query('sourceId') sourceId?: string
  ) {
    return this.actionItemsService.list(tenantId, sourceType, sourceId);
  }

  @Post()
  @Permissions('action-items.write')
  create(
    @CurrentTenant() tenantId: string,
    @CurrentUser() user: { sub: string },
    @Body() dto: CreateActionItemDto
  ) {
    return this.actionItemsService.create(tenantId, user.sub, dto);
  }

  @Patch(':id/complete')
  @Permissions('action-items.write')
  complete(
    @CurrentTenant() tenantId: string,
    @CurrentUser() user: { sub: string },
    @Param('id') id: string
  ) {
    return this.actionItemsService.complete(tenantId, user.sub, id);
  }
}
