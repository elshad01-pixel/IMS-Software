import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';

const PROCESS_REGISTER_LINK_TYPES = ['DOCUMENT', 'RISK', 'AUDIT', 'KPI', 'ACTION', 'NCR', 'CONTEXT_ISSUE'] as const;
export type ProcessRegisterLinkTypeValue = (typeof PROCESS_REGISTER_LINK_TYPES)[number];

export class CreateProcessLinkDto {
  @IsIn(PROCESS_REGISTER_LINK_TYPES)
  linkType!: ProcessRegisterLinkTypeValue;

  @IsString()
  linkedId!: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;
}
