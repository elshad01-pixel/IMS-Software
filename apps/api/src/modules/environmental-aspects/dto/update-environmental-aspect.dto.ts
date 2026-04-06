import { PartialType } from '@nestjs/swagger';
import { CreateEnvironmentalAspectDto } from './create-environmental-aspect.dto';

export class UpdateEnvironmentalAspectDto extends PartialType(CreateEnvironmentalAspectDto) {}
