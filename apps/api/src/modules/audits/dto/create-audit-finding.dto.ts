import { AuditFindingSeverity, AuditFindingStatus } from '@prisma/client';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';

export class CreateAuditFindingDto {
  @IsString()
  @MaxLength(160)
  title!: string;

  @IsString()
  @MaxLength(2000)
  description!: string;

  @IsEnum(AuditFindingSeverity)
  severity!: AuditFindingSeverity;

  @IsOptional()
  @IsString()
  ownerId?: string;

  @IsOptional()
  @IsDateString()
  dueDate?: string;

  @ApiPropertyOptional({ enum: AuditFindingStatus, default: AuditFindingStatus.OPEN })
  @IsOptional()
  @IsEnum(AuditFindingStatus)
  status?: AuditFindingStatus;
}
