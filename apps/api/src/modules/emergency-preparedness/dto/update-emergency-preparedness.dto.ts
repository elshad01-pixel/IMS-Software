import { PartialType } from '@nestjs/swagger';
import { CreateEmergencyPreparednessDto } from './create-emergency-preparedness.dto';

export class UpdateEmergencyPreparednessDto extends PartialType(CreateEmergencyPreparednessDto) {}
