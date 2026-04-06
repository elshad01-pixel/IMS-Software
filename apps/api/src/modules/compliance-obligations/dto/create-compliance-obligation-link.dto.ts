import { ApiProperty } from '@nestjs/swagger';
import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';

const COMPLIANCE_OBLIGATION_LINK_TYPES = ['PROCESS', 'RISK', 'AUDIT', 'ACTION'] as const;
export type ComplianceObligationLinkTypeValue = (typeof COMPLIANCE_OBLIGATION_LINK_TYPES)[number];

export class CreateComplianceObligationLinkDto {
  @ApiProperty({ enum: COMPLIANCE_OBLIGATION_LINK_TYPES })
  @IsIn(COMPLIANCE_OBLIGATION_LINK_TYPES)
  linkType!: ComplianceObligationLinkTypeValue;

  @IsString()
  linkedId!: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;
}
