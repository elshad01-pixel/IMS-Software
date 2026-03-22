import { PartialType } from '@nestjs/swagger';
import { CreateNcrDto } from './create-ncr.dto';

export class UpdateNcrDto extends PartialType(CreateNcrDto) {}
