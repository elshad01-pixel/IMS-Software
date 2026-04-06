import { ApiProperty } from '@nestjs/swagger';
import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';

const EMERGENCY_PREPAREDNESS_LINK_TYPES = ['PROCESS', 'RISK', 'ACTION', 'INCIDENT'] as const;
export type EmergencyPreparednessLinkTypeValue = (typeof EMERGENCY_PREPAREDNESS_LINK_TYPES)[number];

export class CreateEmergencyPreparednessLinkDto {
  @ApiProperty({ enum: EMERGENCY_PREPAREDNESS_LINK_TYPES })
  @IsIn(EMERGENCY_PREPAREDNESS_LINK_TYPES)
  linkType!: EmergencyPreparednessLinkTypeValue;

  @IsString()
  linkedId!: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;
}
