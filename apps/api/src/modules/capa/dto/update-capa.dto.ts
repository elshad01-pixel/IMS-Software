import { PartialType } from '@nestjs/swagger';
import { CreateCapaDto } from './create-capa.dto';

export class UpdateCapaDto extends PartialType(CreateCapaDto) {}
