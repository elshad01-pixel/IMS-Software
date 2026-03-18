import { PartialType } from '@nestjs/swagger';
import { CreateAuditChecklistItemDto } from './create-audit-checklist-item.dto';

export class UpdateAuditChecklistItemDto extends PartialType(CreateAuditChecklistItemDto) {}
