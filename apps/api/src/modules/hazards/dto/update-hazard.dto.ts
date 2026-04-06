import { PartialType } from '@nestjs/swagger';
import { CreateHazardDto } from './create-hazard.dto';

export class UpdateHazardDto extends PartialType(CreateHazardDto) {}
