import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';

const CONTEXT_ISSUE_TYPES = ['INTERNAL', 'EXTERNAL'] as const;
const CONTEXT_ISSUE_STATUSES = ['OPEN', 'MONITORING', 'RESOLVED', 'ARCHIVED'] as const;

export type ContextIssueTypeValue = (typeof CONTEXT_ISSUE_TYPES)[number];
export type ContextIssueStatusValue = (typeof CONTEXT_ISSUE_STATUSES)[number];

export class CreateContextIssueDto {
  @IsIn(CONTEXT_ISSUE_TYPES)
  type!: ContextIssueTypeValue;

  @IsString()
  @MaxLength(180)
  title!: string;

  @IsString()
  @MaxLength(4000)
  description!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  impactOnBusiness?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  category?: string;

  @ApiPropertyOptional({ enum: CONTEXT_ISSUE_STATUSES, default: 'OPEN' })
  @IsOptional()
  @IsIn(CONTEXT_ISSUE_STATUSES)
  status?: ContextIssueStatusValue;
}
