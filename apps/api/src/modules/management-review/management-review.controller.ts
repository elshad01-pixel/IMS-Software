import { Body, Controller, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../common/auth/current-user.decorator';
import { JwtAuthGuard } from '../../common/auth/jwt-auth.guard';
import { Permissions } from '../../common/auth/permissions.decorator';
import { PermissionsGuard } from '../../common/auth/permissions.guard';
import { CurrentTenant } from '../../common/tenancy/current-tenant.decorator';
import { CreateManagementReviewDto } from './dto/create-management-review.dto';
import { UpdateManagementReviewDto } from './dto/update-management-review.dto';
import { ManagementReviewService } from './management-review.service';

@ApiTags('management-review')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('management-review')
export class ManagementReviewController {
  constructor(private readonly managementReviewService: ManagementReviewService) {}

  @Get()
  @Permissions('management-review.read')
  list(@CurrentTenant() tenantId: string) {
    return this.managementReviewService.list(tenantId);
  }

  @Get(':id')
  @Permissions('management-review.read')
  get(@CurrentTenant() tenantId: string, @Param('id') id: string) {
    return this.managementReviewService.get(tenantId, id);
  }

  @Post()
  @Permissions('management-review.write')
  create(
    @CurrentTenant() tenantId: string,
    @CurrentUser() user: { sub: string },
    @Body() dto: CreateManagementReviewDto
  ) {
    return this.managementReviewService.create(tenantId, user.sub, dto);
  }

  @Patch(':id')
  @Permissions('management-review.write')
  update(
    @CurrentTenant() tenantId: string,
    @CurrentUser() user: { sub: string },
    @Param('id') id: string,
    @Body() dto: UpdateManagementReviewDto
  ) {
    return this.managementReviewService.update(tenantId, user.sub, id, dto);
  }
}
