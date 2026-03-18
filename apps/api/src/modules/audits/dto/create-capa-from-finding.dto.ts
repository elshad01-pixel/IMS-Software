import { IsDateString, IsOptional, IsString, MaxLength } from 'class-validator';

export class CreateCapaFromFindingDto {
  @IsOptional()
  @IsString()
  @MaxLength(160)
  title?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  problemStatement?: string;

  @IsOptional()
  @IsString()
  ownerId?: string;

  @IsOptional()
  @IsDateString()
  dueDate?: string;
}
