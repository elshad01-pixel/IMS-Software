import { CapaStatus } from '@prisma/client';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';

export class CreateCapaDto {
  @IsString()
  @MaxLength(160)
  title!: string;

  @IsString()
  @MaxLength(80)
  source!: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  category?: string;

  @IsString()
  @MaxLength(2000)
  problemStatement!: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  containmentAction?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  rootCause?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  correction?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  correctiveAction?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  preventiveAction?: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  verificationMethod?: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  closureSummary?: string;

  @IsOptional()
  @IsString()
  ownerId?: string;

  @IsOptional()
  @IsDateString()
  dueDate?: string;

  @ApiPropertyOptional({ enum: CapaStatus, default: CapaStatus.OPEN })
  @IsOptional()
  @IsEnum(CapaStatus)
  status?: CapaStatus;
}
