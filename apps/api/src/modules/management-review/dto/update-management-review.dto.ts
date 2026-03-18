import { PartialType } from '@nestjs/swagger';
import { CreateManagementReviewDto } from './create-management-review.dto';

export class UpdateManagementReviewDto extends PartialType(CreateManagementReviewDto) {}
