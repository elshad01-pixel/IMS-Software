import { PartialType } from '@nestjs/swagger';
import { CreateNeedExpectationDto } from './create-need-expectation.dto';

export class UpdateNeedExpectationDto extends PartialType(CreateNeedExpectationDto) {}
