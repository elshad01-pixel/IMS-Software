import { TrainingAssignmentStatus } from '@prisma/client';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';

export class CreateTrainingAssignmentDto {
  @IsString()
  userId!: string;

  @IsOptional()
  @IsDateString()
  dueDate?: string;

  @ApiPropertyOptional({ enum: TrainingAssignmentStatus, default: TrainingAssignmentStatus.ASSIGNED })
  @IsOptional()
  @IsEnum(TrainingAssignmentStatus)
  status?: TrainingAssignmentStatus;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  notes?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  evidenceSummary?: string;
}
