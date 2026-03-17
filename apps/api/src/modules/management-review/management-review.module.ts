import { Module } from '@nestjs/common';
import { ManagementReviewController } from './management-review.controller';
import { ManagementReviewService } from './management-review.service';

@Module({
  controllers: [ManagementReviewController],
  providers: [ManagementReviewService]
})
export class ManagementReviewModule {}
