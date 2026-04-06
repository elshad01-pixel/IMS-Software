import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';

const INCIDENT_TYPES = ['INCIDENT', 'NEAR_MISS'] as const;
const INCIDENT_CATEGORIES = ['SAFETY', 'ENVIRONMENT', 'QUALITY', 'SECURITY', 'OTHER'] as const;
const INCIDENT_STATUSES = ['REPORTED', 'INVESTIGATION', 'ACTION_IN_PROGRESS', 'CLOSED', 'ARCHIVED'] as const;
const INCIDENT_SEVERITIES = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'] as const;
const INCIDENT_RCA_METHODS = ['FIVE_WHY', 'FISHBONE', 'IS_IS_NOT', 'OTHER'] as const;

export type IncidentTypeValue = (typeof INCIDENT_TYPES)[number];
export type IncidentCategoryValue = (typeof INCIDENT_CATEGORIES)[number];
export type IncidentStatusValue = (typeof INCIDENT_STATUSES)[number];
export type IncidentSeverityValue = (typeof INCIDENT_SEVERITIES)[number];
export type IncidentRcaMethodValue = (typeof INCIDENT_RCA_METHODS)[number];

export class CreateIncidentDto {
  @IsOptional()
  @IsString()
  @MaxLength(40)
  referenceNo?: string;

  @IsString()
  @MaxLength(180)
  title!: string;

  @IsIn(INCIDENT_TYPES)
  type!: IncidentTypeValue;

  @IsIn(INCIDENT_CATEGORIES)
  category!: IncidentCategoryValue;

  @IsString()
  @MaxLength(2000)
  description!: string;

  @IsString()
  eventDate!: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  location?: string;

  @IsOptional()
  @IsString()
  ownerUserId?: string;

  @IsIn(INCIDENT_SEVERITIES)
  severity!: IncidentSeverityValue;

  @IsOptional()
  @IsString()
  @MaxLength(1500)
  immediateAction?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  investigationSummary?: string;

  @IsOptional()
  @IsString()
  @MaxLength(4000)
  rootCause?: string;

  @IsOptional()
  @IsIn(INCIDENT_RCA_METHODS)
  rcaMethod?: IncidentRcaMethodValue;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  correctiveActionSummary?: string;

  @ApiPropertyOptional({ enum: INCIDENT_STATUSES, default: 'REPORTED' })
  @IsOptional()
  @IsIn(INCIDENT_STATUSES)
  status?: IncidentStatusValue;
}
