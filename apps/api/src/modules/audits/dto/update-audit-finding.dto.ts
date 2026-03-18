import { PartialType } from '@nestjs/swagger';
import { CreateAuditFindingDto } from './create-audit-finding.dto';

export class UpdateAuditFindingDto extends PartialType(CreateAuditFindingDto) {}
