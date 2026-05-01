import { Body, Controller, Get, Param, Patch, Post, Res, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Response } from 'express';
import { CurrentUser } from '../../common/auth/current-user.decorator';
import { JwtAuthGuard } from '../../common/auth/jwt-auth.guard';
import { PackageModule } from '../../common/auth/package-module.decorator';
import { Permissions } from '../../common/auth/permissions.decorator';
import { PermissionsGuard } from '../../common/auth/permissions.guard';
import { buildAttachmentContentDisposition } from '../../common/http/download-header.util';
import { CurrentTenant } from '../../common/tenancy/current-tenant.decorator';
import { CreateManagementReviewDto } from './dto/create-management-review.dto';
import { ManagementReviewPresentationService } from './management-review-presentation.service';
import { ManagementReviewReportService } from './management-review-report.service';
import { UpdateManagementReviewDto } from './dto/update-management-review.dto';
import { ManagementReviewService } from './management-review.service';

@ApiTags('management-review')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@PackageModule('management-review')
@Controller('management-review')
export class ManagementReviewController {
  constructor(
    private readonly managementReviewService: ManagementReviewService,
    private readonly managementReviewReportService: ManagementReviewReportService,
    private readonly managementReviewPresentationService: ManagementReviewPresentationService
  ) {}

  @Get()
  @Permissions('management-review.read')
  list(@CurrentTenant() tenantId: string) {
    return this.managementReviewService.list(tenantId);
  }

  @Get(':id/report')
  @Permissions('management-review.read')
  async report(
    @CurrentTenant() tenantId: string,
    @Param('id') id: string,
    @Res() res: Response
  ) {
    const report = await this.managementReviewReportService.generateManagementReviewReport(
      tenantId,
      id
    );
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', buildAttachmentContentDisposition(report.fileName));
    res.setHeader('Content-Length', String(report.buffer.length));
    res.send(report.buffer);
  }

  @Get(':id/presentation')
  @Permissions('management-review.read')
  async presentation(
    @CurrentTenant() tenantId: string,
    @Param('id') id: string,
    @Res() res: Response
  ) {
    const deck = await this.managementReviewPresentationService.generateManagementReviewPresentation(
      tenantId,
      id
    );
    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.presentationml.presentation'
    );
    res.setHeader('Content-Disposition', buildAttachmentContentDisposition(deck.fileName));
    res.setHeader('Content-Length', String(deck.buffer.length));
    res.send(deck.buffer);
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

  @Patch(':id/archive')
  @Permissions('admin.delete')
  archive(
    @CurrentTenant() tenantId: string,
    @CurrentUser() user: { sub: string },
    @Param('id') id: string
  ) {
    return this.managementReviewService.archive(tenantId, user.sub, id);
  }
}
