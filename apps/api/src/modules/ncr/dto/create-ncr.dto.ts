import {
  NcrCategory,
  NcrPriority,
  NcrRcaMethod,
  NcrSeverity,
  NcrSource,
  NcrStatus,
  NcrVerificationStatus
} from '@prisma/client';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';

export class CreateNcrDto {
  @IsString()
  @MaxLength(40)
  referenceNo!: string;

  @IsString()
  @MaxLength(180)
  title!: string;

  @IsEnum(NcrCategory)
  category!: NcrCategory;

  @IsEnum(NcrSource)
  source!: NcrSource;

  @IsString()
  @MaxLength(4000)
  description!: string;

  @ApiPropertyOptional({ enum: NcrStatus, default: NcrStatus.OPEN })
  @IsOptional()
  @IsEnum(NcrStatus)
  status?: NcrStatus;

  @IsEnum(NcrSeverity)
  severity!: NcrSeverity;

  @IsEnum(NcrPriority)
  priority!: NcrPriority;

  @IsDateString()
  dateReported!: string;

  @IsOptional()
  @IsString()
  reportedByUserId?: string;

  @IsOptional()
  @IsString()
  ownerUserId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  department?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  location?: string;

  @IsOptional()
  @IsDateString()
  dueDate?: string;

  @IsOptional()
  @IsString()
  @MaxLength(4000)
  containmentAction?: string;

  @IsOptional()
  @IsString()
  @MaxLength(4000)
  investigationSummary?: string;

  @IsOptional()
  @IsString()
  @MaxLength(4000)
  rootCause?: string;

  @IsOptional()
  @IsEnum(NcrRcaMethod)
  rcaMethod?: NcrRcaMethod;

  @IsOptional()
  @IsString()
  @MaxLength(4000)
  correctiveActionSummary?: string;

  @ApiPropertyOptional({ enum: NcrVerificationStatus, default: NcrVerificationStatus.PENDING })
  @IsOptional()
  @IsEnum(NcrVerificationStatus)
  verificationStatus?: NcrVerificationStatus;

  @IsOptional()
  @IsString()
  verifiedByUserId?: string;

  @IsOptional()
  @IsDateString()
  verificationDate?: string;
}
