import { Module } from '@nestjs/common';
import { AuditLogsModule } from '../audit-logs/audit-logs.module';
import { ManagementReviewController } from './management-review.controller';
import { ManagementReviewPresentationService } from './management-review-presentation.service';
import { ManagementReviewReportService } from './management-review-report.service';
import { ManagementReviewService } from './management-review.service';

@Module({
  imports: [AuditLogsModule],
  controllers: [ManagementReviewController],
  providers: [
    ManagementReviewService,
    ManagementReviewReportService,
    ManagementReviewPresentationService
  ]
})
export class ManagementReviewModule {}
