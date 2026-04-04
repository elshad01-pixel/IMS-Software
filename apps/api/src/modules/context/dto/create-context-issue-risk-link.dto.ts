import { IsString } from 'class-validator';

export class CreateContextIssueRiskLinkDto {
  @IsString()
  riskId!: string;
}
