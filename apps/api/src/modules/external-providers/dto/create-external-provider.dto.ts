import { IsDateString, IsEnum, IsInt, IsOptional, IsString, MaxLength, Max, Min } from 'class-validator';

export const EXTERNAL_PROVIDER_TYPES = ['SUPPLIER', 'OUTSOURCED_SERVICE', 'CONTRACTOR', 'CALIBRATION', 'LOGISTICS', 'OTHER'] as const;
export const EXTERNAL_PROVIDER_CRITICALITIES = ['LOW', 'MEDIUM', 'HIGH'] as const;
export const EXTERNAL_PROVIDER_STATUSES = ['APPROVED', 'CONDITIONAL', 'UNDER_REVIEW', 'INACTIVE'] as const;
export const EXTERNAL_PROVIDER_EVALUATION_OUTCOMES = ['APPROVED', 'APPROVED_WITH_CONDITIONS', 'ESCALATED', 'DISQUALIFIED'] as const;

export type ExternalProviderTypeValue = (typeof EXTERNAL_PROVIDER_TYPES)[number];
export type ExternalProviderCriticalityValue = (typeof EXTERNAL_PROVIDER_CRITICALITIES)[number];
export type ExternalProviderStatusValue = (typeof EXTERNAL_PROVIDER_STATUSES)[number];
export type ExternalProviderEvaluationOutcomeValue = (typeof EXTERNAL_PROVIDER_EVALUATION_OUTCOMES)[number];

export class CreateExternalProviderDto {
  @IsOptional()
  @IsString()
  @MaxLength(40)
  referenceNo?: string;

  @IsString()
  @MaxLength(180)
  providerName!: string;

  @IsEnum(EXTERNAL_PROVIDER_TYPES)
  providerType!: ExternalProviderTypeValue;

  @IsString()
  @MaxLength(2000)
  suppliedScope!: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  approvalBasis?: string;

  @IsEnum(EXTERNAL_PROVIDER_CRITICALITIES)
  criticality!: ExternalProviderCriticalityValue;

  @IsOptional()
  @IsString()
  ownerUserId?: string;

  @IsOptional()
  @IsDateString()
  evaluationDate?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(5)
  qualityScore?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(5)
  deliveryScore?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(5)
  responsivenessScore?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(5)
  complianceScore?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(5)
  traceabilityScore?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(5)
  changeControlScore?: number;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  evaluationSummary?: string;

  @IsOptional()
  @IsDateString()
  nextReviewDate?: string;

  @IsOptional()
  @IsEnum(EXTERNAL_PROVIDER_STATUSES)
  status?: ExternalProviderStatusValue;
}
