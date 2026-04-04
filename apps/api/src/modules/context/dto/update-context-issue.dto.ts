import { PartialType } from '@nestjs/swagger';
import { CreateContextIssueDto } from './create-context-issue.dto';

export class UpdateContextIssueDto extends PartialType(CreateContextIssueDto) {}
