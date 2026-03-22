import { IsString, MaxLength } from 'class-validator';

export class CreateNcrCommentDto {
  @IsString()
  @MaxLength(2000)
  message!: string;
}
