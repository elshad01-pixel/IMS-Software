import { DocumentStatus } from '@prisma/client';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';

export class CreateDocumentDto {
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
  @MaxLength(1000)
  summary?: string;

  @IsOptional()
  @IsString()
  ownerId?: string;

  @IsOptional()
  @IsDateString()
  effectiveDate?: string;

  @IsOptional()
  @IsDateString()
  reviewDueDate?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  changeSummary?: string;

  @ApiPropertyOptional({ enum: DocumentStatus, default: DocumentStatus.DRAFT })
  @IsOptional()
  @IsEnum(DocumentStatus)
  status?: DocumentStatus;
}
