import { RiskStatus } from '@prisma/client';
import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsDateString,
  IsEnum,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
  Min
} from 'class-validator';

export class CreateRiskDto {
  @ApiPropertyOptional({ enum: ['RISK', 'OPPORTUNITY'], default: 'RISK' })
  @IsOptional()
  @IsIn(['RISK', 'OPPORTUNITY'])
  assessmentType?: 'RISK' | 'OPPORTUNITY';

  @IsString()
  @MaxLength(160)
  title!: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  description?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  category?: string;

  @IsInt()
  @Min(1)
  likelihood!: number;

  @IsInt()
  @Min(1)
  severity!: number;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  existingControls?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  plannedMitigationActions?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  residualLikelihood?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  residualImpact?: number;

  @IsOptional()
  @IsIn(['INTERNAL', 'EXTERNAL'])
  issueContextType?: 'INTERNAL' | 'EXTERNAL';

  @IsOptional()
  @IsString()
  @MaxLength(160)
  issueContext?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  treatmentPlan?: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  treatmentSummary?: string;

  @IsOptional()
  @IsString()
  ownerId?: string;

  @IsOptional()
  @IsDateString()
  targetDate?: string;

  @ApiPropertyOptional({ enum: RiskStatus, default: RiskStatus.OPEN })
  @IsOptional()
  @IsEnum(RiskStatus)
  status?: RiskStatus;
}
