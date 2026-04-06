import { ApiProperty } from '@nestjs/swagger';
import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';

const ENVIRONMENTAL_ASPECT_LINK_TYPES = ['PROCESS', 'RISK', 'ACTION'] as const;
export type EnvironmentalAspectLinkTypeValue = (typeof ENVIRONMENTAL_ASPECT_LINK_TYPES)[number];

export class CreateEnvironmentalAspectLinkDto {
  @ApiProperty({ enum: ENVIRONMENTAL_ASPECT_LINK_TYPES })
  @IsIn(ENVIRONMENTAL_ASPECT_LINK_TYPES)
  linkType!: EnvironmentalAspectLinkTypeValue;

  @IsString()
  linkedId!: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;
}
