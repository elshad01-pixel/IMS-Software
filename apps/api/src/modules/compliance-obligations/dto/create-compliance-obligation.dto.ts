import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';

const COMPLIANCE_OBLIGATION_STATUSES = ['ACTIVE', 'UNDER_REVIEW', 'OBSOLETE'] as const;
export type ComplianceObligationStatusValue = (typeof COMPLIANCE_OBLIGATION_STATUSES)[number];

export class CreateComplianceObligationDto {
  @IsOptional()
  @IsString()
  @MaxLength(40)
  referenceNo?: string;

  @IsString()
  @MaxLength(180)
  title!: string;

  @IsString()
  @MaxLength(180)
  sourceName!: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  obligationType?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  jurisdiction?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string;

  @IsOptional()
  @IsString()
  ownerUserId?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(36)
  reviewFrequencyMonths?: number;

  @IsOptional()
  @IsString()
  nextReviewDate?: string;

  @ApiPropertyOptional({ enum: COMPLIANCE_OBLIGATION_STATUSES, default: 'ACTIVE' })
  @IsOptional()
  @IsIn(COMPLIANCE_OBLIGATION_STATUSES)
  status?: ComplianceObligationStatusValue;
}
