import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';

const CHANGE_REQUEST_TYPES = ['PROCESS', 'PRODUCT', 'EQUIPMENT', 'MATERIAL', 'ORGANIZATIONAL', 'DOCUMENTATION', 'FACILITY', 'OTHER'] as const;
const CHANGE_REQUEST_STATUSES = ['PROPOSED', 'REVIEWING', 'APPROVED', 'IMPLEMENTING', 'VERIFIED', 'CLOSED', 'REJECTED'] as const;

export type ChangeRequestTypeValue = (typeof CHANGE_REQUEST_TYPES)[number];
export type ChangeRequestStatusValue = (typeof CHANGE_REQUEST_STATUSES)[number];

export class CreateChangeRequestDto {
  @IsOptional()
  @IsString()
  @MaxLength(40)
  referenceNo?: string;

  @IsString()
  @MaxLength(180)
  title!: string;

  @IsIn(CHANGE_REQUEST_TYPES)
  changeType!: ChangeRequestTypeValue;

  @IsString()
  @MaxLength(2000)
  reason!: string;

  @IsString()
  @MaxLength(180)
  affectedArea!: string;

  @IsString()
  @MaxLength(2000)
  proposedChange!: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  impactSummary?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  controlSummary?: string;

  @IsOptional()
  @IsString()
  ownerUserId?: string;

  @IsOptional()
  @IsString()
  targetImplementationDate?: string;

  @IsOptional()
  @IsString()
  reviewDate?: string;

  @ApiPropertyOptional({ enum: CHANGE_REQUEST_STATUSES, default: 'PROPOSED' })
  @IsOptional()
  @IsIn(CHANGE_REQUEST_STATUSES)
  status?: ChangeRequestStatusValue;
}
