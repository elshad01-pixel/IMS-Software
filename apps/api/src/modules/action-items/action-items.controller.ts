import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ActionItemStatus } from '@prisma/client';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../common/auth/current-user.decorator';
import { JwtAuthGuard } from '../../common/auth/jwt-auth.guard';
import { Permissions } from '../../common/auth/permissions.decorator';
import { PermissionsGuard } from '../../common/auth/permissions.guard';
import { CurrentTenant } from '../../common/tenancy/current-tenant.decorator';
import { CreateActionItemDto } from './dto/create-action-item.dto';
import { UpdateActionItemDto } from './dto/update-action-item.dto';
import { ActionItemsService } from './action-items.service';

@ApiTags('action-items')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('action-items')
export class ActionItemsController {
  constructor(private readonly actionItemsService: ActionItemsService) {}

  @Get()
  @Permissions('action-items.read')
  list(
    @CurrentTenant() tenantId: string,
    @Query('sourceType') sourceType?: string,
    @Query('sourceId') sourceId?: string,
    @Query('status') status?: ActionItemStatus,
    @Query('ownerId') ownerId?: string,
    @Query('dueState') dueState?: 'overdue' | 'upcoming'
  ) {
    return this.actionItemsService.list(tenantId, { sourceType, sourceId, status, ownerId, dueState });
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

  @Patch(':id')
  @Permissions('action-items.write')
  update(
    @CurrentTenant() tenantId: string,
    @CurrentUser() user: { sub: string },
    @Param('id') id: string,
    @Body() dto: UpdateActionItemDto
  ) {
    return this.actionItemsService.update(tenantId, user.sub, id, dto);
  }

  @Delete(':id')
  @Permissions('admin.delete')
  remove(
    @CurrentTenant() tenantId: string,
    @CurrentUser() user: { sub: string },
    @Param('id') id: string
  ) {
    return this.actionItemsService.remove(tenantId, user.sub, id);
  }
}
