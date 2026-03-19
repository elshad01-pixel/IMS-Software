import { Controller, Get, Param, Query, Res, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Response } from 'express';
import { CurrentUser } from '../../common/auth/current-user.decorator';
import { JwtAuthGuard } from '../../common/auth/jwt-auth.guard';
import { Permissions } from '../../common/auth/permissions.decorator';
import { PermissionsGuard } from '../../common/auth/permissions.guard';
import { CurrentTenant } from '../../common/tenancy/current-tenant.decorator';
import { AuditLogsService } from '../audit-logs/audit-logs.service';
import { ExportReportQueryDto } from './dto/export-report-query.dto';
import { ReportsService } from './reports.service';

@ApiTags('reports')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('reports')
export class ReportsController {
  constructor(
    private readonly reportsService: ReportsService,
    private readonly auditLogsService: AuditLogsService
  ) {}

  @Get()
  @Permissions('reports.read')
  list() {
    return this.reportsService.list();
  }

  @Get('export/:type')
  @Permissions('reports.read')
  async export(
    @CurrentTenant() tenantId: string,
    @CurrentUser() user: { sub: string },
    @Param('type') type: string,
    @Query() query: ExportReportQueryDto,
    @Res() response: Response
  ) {
    const csv = await this.reportsService.export(tenantId, type, query);
    const filename = `${type}-${new Date().toISOString().slice(0, 10)}.csv`;

    await this.auditLogsService.create({
      tenantId,
      actorId: user.sub,
      action: 'report.exported',
      entityType: 'report',
      entityId: type,
      metadata: query
    });

    response.setHeader('Content-Type', 'text/csv; charset=utf-8');
    response.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    response.send(csv);
  }
}
