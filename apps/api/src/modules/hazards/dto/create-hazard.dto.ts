import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';

const HAZARD_EXPOSURE_STAGES = ['ROUTINE', 'NON_ROUTINE', 'EMERGENCY'] as const;
const HAZARD_SEVERITIES = ['LOW', 'MEDIUM', 'HIGH'] as const;
const HAZARD_STATUSES = ['ACTIVE', 'MONITORING', 'OBSOLETE'] as const;

export type HazardExposureStageValue = (typeof HAZARD_EXPOSURE_STAGES)[number];
export type HazardSeverityValue = (typeof HAZARD_SEVERITIES)[number];
export type HazardStatusValue = (typeof HAZARD_STATUSES)[number];

export class CreateHazardDto {
  @IsOptional()
  @IsString()
  @MaxLength(40)
  referenceNo?: string;

  @IsString()
  @MaxLength(180)
  activity!: string;

  @IsString()
  @MaxLength(180)
  hazard!: string;

  @IsString()
  @MaxLength(2000)
  potentialHarm!: string;

  @IsIn(HAZARD_EXPOSURE_STAGES)
  exposureStage!: HazardExposureStageValue;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  existingControls?: string;

  @IsIn(HAZARD_SEVERITIES)
  severity!: HazardSeverityValue;

  @IsOptional()
  @IsString()
  ownerUserId?: string;

  @IsOptional()
  @IsString()
  reviewDate?: string;

  @ApiPropertyOptional({ enum: HAZARD_STATUSES, default: 'ACTIVE' })
  @IsOptional()
  @IsIn(HAZARD_STATUSES)
  status?: HazardStatusValue;
}
