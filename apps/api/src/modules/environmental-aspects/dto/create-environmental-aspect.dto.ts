import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';

const ENVIRONMENTAL_ASPECT_STAGES = ['NORMAL_OPERATION', 'ABNORMAL_OPERATION', 'EMERGENCY'] as const;
const ENVIRONMENTAL_ASPECT_SIGNIFICANCE = ['LOW', 'MEDIUM', 'HIGH'] as const;
const ENVIRONMENTAL_ASPECT_STATUSES = ['ACTIVE', 'MONITORING', 'OBSOLETE'] as const;

export type EnvironmentalAspectStageValue = (typeof ENVIRONMENTAL_ASPECT_STAGES)[number];
export type EnvironmentalAspectSignificanceValue = (typeof ENVIRONMENTAL_ASPECT_SIGNIFICANCE)[number];
export type EnvironmentalAspectStatusValue = (typeof ENVIRONMENTAL_ASPECT_STATUSES)[number];

export class CreateEnvironmentalAspectDto {
  @IsOptional()
  @IsString()
  @MaxLength(40)
  referenceNo?: string;

  @IsString()
  @MaxLength(180)
  activity!: string;

  @IsString()
  @MaxLength(180)
  aspect!: string;

  @IsString()
  @MaxLength(2000)
  impact!: string;

  @IsIn(ENVIRONMENTAL_ASPECT_STAGES)
  lifecycleStage!: EnvironmentalAspectStageValue;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  controlSummary?: string;

  @IsIn(ENVIRONMENTAL_ASPECT_SIGNIFICANCE)
  significance!: EnvironmentalAspectSignificanceValue;

  @IsOptional()
  @IsString()
  ownerUserId?: string;

  @IsOptional()
  @IsString()
  reviewDate?: string;

  @ApiPropertyOptional({ enum: ENVIRONMENTAL_ASPECT_STATUSES, default: 'ACTIVE' })
  @IsOptional()
  @IsIn(ENVIRONMENTAL_ASPECT_STATUSES)
  status?: EnvironmentalAspectStatusValue;
}
