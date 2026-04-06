import { ApiProperty } from '@nestjs/swagger';
import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';

const INCIDENT_LINK_TYPES = ['PROCESS', 'RISK', 'ACTION'] as const;
export type IncidentLinkTypeValue = (typeof INCIDENT_LINK_TYPES)[number];

export class CreateIncidentLinkDto {
  @ApiProperty({ enum: INCIDENT_LINK_TYPES })
  @IsIn(INCIDENT_LINK_TYPES)
  linkType!: IncidentLinkTypeValue;

  @IsString()
  linkedId!: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;
}
