import { PartialType } from '@nestjs/swagger';
import { CreateProcessRegisterDto } from './create-process-register.dto';

export class UpdateProcessRegisterDto extends PartialType(CreateProcessRegisterDto) {}
