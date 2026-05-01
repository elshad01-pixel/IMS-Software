import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/auth/jwt-auth.guard';
import { Permissions } from '../../common/auth/permissions.decorator';
import { PermissionsGuard } from '../../common/auth/permissions.guard';
import { TenantAddOn } from '../../common/auth/tenant-addon.decorator';
import { CurrentTenant } from '../../common/tenancy/current-tenant.decorator';
import { DraftAuditFindingDto } from './dto/draft-audit-finding.dto';
import { AiService } from './ai.service';

@ApiTags('ai')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('ai')
export class AiController {
  constructor(private readonly aiService: AiService) {}

  @Get('config')
  @Permissions('settings.read')
  config(@CurrentTenant() tenantId: string) {
    return this.aiService.getConfig(tenantId);
  }

  @Post('audit-finding-draft')
  @Permissions('audits.write')
  @TenantAddOn('aiAssistant')
  draftAuditFinding(
    @CurrentTenant() tenantId: string,
    @Body() dto: DraftAuditFindingDto
  ) {
    return this.aiService.draftAuditFinding(tenantId, dto);
  }

  @Post('management-review-input-draft')
  @Permissions('management-review.write')
  @TenantAddOn('aiAssistant')
  draftManagementReviewInputs(@CurrentTenant() tenantId: string) {
    return this.aiService.draftManagementReviewInputs(tenantId);
  }
}
