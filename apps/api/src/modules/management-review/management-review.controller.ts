import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/auth/jwt-auth.guard';
import { Permissions } from '../../common/auth/permissions.decorator';
import { PermissionsGuard } from '../../common/auth/permissions.guard';
import { CurrentTenant } from '../../common/tenancy/current-tenant.decorator';
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
}
