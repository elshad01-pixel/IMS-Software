import { ManagementReviewStatus } from '@prisma/client';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsDateString,
  IsEnum,
  IsOptional,
  IsString,
  MaxLength,
  ValidateNested
} from 'class-validator';

export class ManagementReviewInputDto {
  @IsString()
  sourceType!: string;

  @IsString()
  sourceId!: string;
}

export class CreateManagementReviewDto {
  @IsString()
  @MaxLength(160)
  title!: string;

  @IsOptional()
  @IsDateString()
  reviewDate?: string;

  @IsOptional()
  @IsString()
  chairpersonId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  agenda?: string;

  @IsOptional()
  @IsString()
  @MaxLength(6000)
  minutes?: string;

  @IsOptional()
  @IsString()
  @MaxLength(4000)
  decisions?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  summary?: string;

  @ApiPropertyOptional({ enum: ManagementReviewStatus, default: ManagementReviewStatus.PLANNED })
  @IsOptional()
  @IsEnum(ManagementReviewStatus)
  status?: ManagementReviewStatus;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ManagementReviewInputDto)
  inputs?: ManagementReviewInputDto[];
}
