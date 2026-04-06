import { ApiProperty } from '@nestjs/swagger';
import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';

const CHANGE_REQUEST_LINK_TYPES = ['PROCESS', 'RISK', 'ACTION', 'DOCUMENT', 'OBLIGATION', 'PROVIDER'] as const;
export type ChangeRequestLinkTypeValue = (typeof CHANGE_REQUEST_LINK_TYPES)[number];

export class CreateChangeRequestLinkDto {
  @ApiProperty({ enum: CHANGE_REQUEST_LINK_TYPES })
  @IsIn(CHANGE_REQUEST_LINK_TYPES)
  linkType!: ChangeRequestLinkTypeValue;

  @IsString()
  linkedId!: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;
}
