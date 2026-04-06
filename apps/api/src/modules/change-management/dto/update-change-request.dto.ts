import { PartialType } from '@nestjs/swagger';
import { CreateChangeRequestDto } from './create-change-request.dto';

export class UpdateChangeRequestDto extends PartialType(CreateChangeRequestDto) {}
