import { IsString, MaxLength } from 'class-validator';

export class CreateNeedExpectationDto {
  @IsString()
  interestedPartyId!: string;

  @IsString()
  @MaxLength(4000)
  description!: string;
}
