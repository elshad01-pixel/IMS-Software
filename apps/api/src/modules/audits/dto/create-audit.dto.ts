import { AuditStatus } from '@prisma/client';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';

export class CreateAuditDto {
  @IsString()
  @MaxLength(40)
  code!: string;

  @IsString()
  @MaxLength(160)
  title!: string;

  @IsString()
  @MaxLength(80)
  type!: string;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  standard?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  programme?: string;

  @IsOptional()
  @IsString()
  @MaxLength(60)
  scopeType?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  scope?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  objectives?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  criteria?: string;

  @IsOptional()
  @IsString()
  @MaxLength(4000)
  agenda?: string;

  @IsOptional()
  @IsString()
  @MaxLength(4000)
  openingMeetingNotes?: string;

  @IsOptional()
  @IsString()
  @MaxLength(4000)
  closingMeetingNotes?: string;

  @IsOptional()
  @IsString()
  leadAuditorId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  auditeeArea?: string;

  @IsOptional()
  @IsDateString()
  scheduledAt?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  summary?: string;

  @IsOptional()
  @IsString()
  @MaxLength(4000)
  conclusion?: string;

  @IsOptional()
  @IsString()
  @MaxLength(4000)
  recommendations?: string;

  @IsOptional()
  @IsDateString()
  completionDate?: string;

  @IsOptional()
  @IsString()
  completedByAuditorId?: string;

  @IsOptional()
  @IsString()
  procedureProcessId?: string;

  @IsOptional()
  @IsString()
  procedureDocumentId?: string;

  @ApiPropertyOptional({ enum: AuditStatus, default: AuditStatus.PLANNED })
  @IsOptional()
  @IsEnum(AuditStatus)
  status?: AuditStatus;
}
