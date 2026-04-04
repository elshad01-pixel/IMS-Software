import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';

const PROCESS_REGISTER_STATUSES = ['ACTIVE', 'ARCHIVED'] as const;
export type ProcessRegisterStatusValue = (typeof PROCESS_REGISTER_STATUSES)[number];

export class CreateProcessRegisterDto {
  @IsOptional()
  @IsString()
  @MaxLength(40)
  referenceNo?: string;

  @IsString()
  @MaxLength(160)
  name!: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  purpose?: string;

  @IsOptional()
  @IsString()
  ownerUserId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  department?: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  scope?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  inputsText?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  outputsText?: string;

  @ApiPropertyOptional({ enum: PROCESS_REGISTER_STATUSES, default: 'ACTIVE' })
  @IsOptional()
  @IsIn(PROCESS_REGISTER_STATUSES)
  status?: ProcessRegisterStatusValue;
}
