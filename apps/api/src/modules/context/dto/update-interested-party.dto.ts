import { PartialType } from '@nestjs/swagger';
import { CreateInterestedPartyDto } from './create-interested-party.dto';

export class UpdateInterestedPartyDto extends PartialType(CreateInterestedPartyDto) {}
