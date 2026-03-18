import { KpiDirection } from '@prisma/client';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsNumber, IsOptional, IsString, MaxLength } from 'class-validator';

export class CreateKpiDto {
  @IsString()
  @MaxLength(160)
  name!: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string;

  @IsOptional()
  @IsString()
  ownerId?: string;

  @IsNumber()
  target!: number;

  @IsOptional()
  @IsNumber()
  warningThreshold?: number;

  @IsString()
  @MaxLength(20)
  unit!: string;

  @IsString()
  @MaxLength(60)
  periodLabel!: string;

  @ApiPropertyOptional({ enum: KpiDirection, default: KpiDirection.AT_LEAST })
  @IsOptional()
  @IsEnum(KpiDirection)
  direction?: KpiDirection;
}
