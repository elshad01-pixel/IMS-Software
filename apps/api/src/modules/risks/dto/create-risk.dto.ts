import { RiskStatus } from '@prisma/client';
import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsDateString,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
  Min
} from 'class-validator';

export class CreateRiskDto {
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
