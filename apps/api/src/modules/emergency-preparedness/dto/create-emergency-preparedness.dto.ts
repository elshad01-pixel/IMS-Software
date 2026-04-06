import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional, IsString, MaxLength, Min } from 'class-validator';

const EMERGENCY_PREPAREDNESS_TYPES = ['FIRE', 'CHEMICAL_SPILL', 'MEDICAL', 'EVACUATION', 'POWER_LOSS', 'OTHER'] as const;
const EMERGENCY_PREPAREDNESS_STATUSES = ['ACTIVE', 'MONITORING', 'OBSOLETE'] as const;

export type EmergencyPreparednessTypeValue = (typeof EMERGENCY_PREPAREDNESS_TYPES)[number];
export type EmergencyPreparednessStatusValue = (typeof EMERGENCY_PREPAREDNESS_STATUSES)[number];

export class CreateEmergencyPreparednessDto {
  @IsOptional()
  @IsString()
  @MaxLength(40)
  referenceNo?: string;

  @IsString()
  @MaxLength(180)
  scenario!: string;

  @IsIn(EMERGENCY_PREPAREDNESS_TYPES)
  emergencyType!: EmergencyPreparednessTypeValue;

  @IsString()
  @MaxLength(2000)
  potentialImpact!: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  responseSummary?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  resourceSummary?: string;

  @IsOptional()
  @IsString()
  ownerUserId?: string;

  @IsOptional()
  @Min(1)
  drillFrequencyMonths?: number;

  @IsOptional()
  @IsString()
  nextDrillDate?: string;

  @ApiPropertyOptional({ enum: EMERGENCY_PREPAREDNESS_STATUSES, default: 'ACTIVE' })
  @IsOptional()
  @IsIn(EMERGENCY_PREPAREDNESS_STATUSES)
  status?: EmergencyPreparednessStatusValue;
}
