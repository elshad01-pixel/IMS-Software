import { PartialType } from '@nestjs/swagger';
import { CreateComplianceObligationDto } from './create-compliance-obligation.dto';

export class UpdateComplianceObligationDto extends PartialType(CreateComplianceObligationDto) {}
