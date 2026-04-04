import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';

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
}
