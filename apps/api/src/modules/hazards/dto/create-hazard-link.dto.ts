import { ApiProperty } from '@nestjs/swagger';
import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';

const HAZARD_LINK_TYPES = ['PROCESS', 'RISK', 'ACTION', 'INCIDENT'] as const;
export type HazardLinkTypeValue = (typeof HAZARD_LINK_TYPES)[number];

export class CreateHazardLinkDto {
  @ApiProperty({ enum: HAZARD_LINK_TYPES })
  @IsIn(HAZARD_LINK_TYPES)
  linkType!: HazardLinkTypeValue;

  @IsString()
  linkedId!: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;
}
