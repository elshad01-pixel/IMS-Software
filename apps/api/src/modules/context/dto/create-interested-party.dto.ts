import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsArray, IsBoolean, IsIn, IsInt, IsOptional, IsString, MaxLength, Min } from 'class-validator';

const INTERESTED_PARTY_TYPES = ['CUSTOMER', 'REGULATOR', 'EMPLOYEE', 'SUPPLIER', 'OTHER'] as const;
export type InterestedPartyTypeValue = (typeof INTERESTED_PARTY_TYPES)[number];

export class CreateInterestedPartyDto {
  @IsString()
  @MaxLength(160)
  name!: string;

  @ApiPropertyOptional({ enum: INTERESTED_PARTY_TYPES, default: 'CUSTOMER' })
  @IsIn(INTERESTED_PARTY_TYPES)
  type!: InterestedPartyTypeValue;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  surveyEnabled?: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(160)
  surveyTitle?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  surveyIntro?: string;

  @ApiPropertyOptional({ default: 5 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(3)
  surveyScaleMax?: number;

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @MaxLength(80, { each: true })
  surveyCategoryLabels?: string[];
}
