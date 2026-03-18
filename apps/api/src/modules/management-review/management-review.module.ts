import { Module } from '@nestjs/common';
import { AuditLogsModule } from '../audit-logs/audit-logs.module';
import { ManagementReviewController } from './management-review.controller';
import { ManagementReviewService } from './management-review.service';

@Module({
  imports: [AuditLogsModule],
  controllers: [ManagementReviewController],
  providers: [ManagementReviewService]
})
export class ManagementReviewModule {}
