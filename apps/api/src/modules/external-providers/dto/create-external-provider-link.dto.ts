import { IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';

export const EXTERNAL_PROVIDER_LINK_TYPES = ['PROCESS', 'RISK', 'AUDIT', 'ACTION', 'OBLIGATION'] as const;
export type ExternalProviderLinkTypeValue = (typeof EXTERNAL_PROVIDER_LINK_TYPES)[number];

export class CreateExternalProviderLinkDto {
  @IsEnum(EXTERNAL_PROVIDER_LINK_TYPES)
  linkType!: ExternalProviderLinkTypeValue;

  @IsString()
  linkedId!: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;
}
