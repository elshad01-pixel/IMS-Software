import { IsString } from 'class-validator';

export class CreateContextIssueProcessLinkDto {
  @IsString()
  processId!: string;
}
