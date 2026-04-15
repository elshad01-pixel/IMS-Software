import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';

export class DraftAuditFindingDto {
  @IsString()
  @MaxLength(80)
  clause!: string;

  @IsString()
  @MaxLength(400)
  question!: string;

  @IsString()
  @MaxLength(4000)
  evidenceNote!: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  auditType?: string;

  @IsOptional()
  @IsString()
  @IsIn(['ISO 9001', 'ISO 14001', 'ISO 45001'])
  standard?: string;
}
