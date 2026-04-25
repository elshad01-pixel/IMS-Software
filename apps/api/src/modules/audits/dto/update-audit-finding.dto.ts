import { ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';
import { CreateAuditFindingDto } from './create-audit-finding.dto';

export class UpdateAuditFindingDto extends PartialType(CreateAuditFindingDto) {
  @ApiPropertyOptional({ description: 'Linked lighter audit action for this finding' })
  @IsOptional()
  @IsString()
  linkedActionItemId?: string;
}
