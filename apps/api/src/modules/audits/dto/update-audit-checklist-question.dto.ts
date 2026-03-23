import { PartialType } from '@nestjs/swagger';
import { CreateAuditChecklistQuestionDto } from './create-audit-checklist-question.dto';

export class UpdateAuditChecklistQuestionDto extends PartialType(CreateAuditChecklistQuestionDto) {}
