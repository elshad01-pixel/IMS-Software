import { IsDateString, IsOptional, IsString, MaxLength } from 'class-validator';

export class CreateTrainingDto {
  @IsString()
  @MaxLength(160)
  title!: string;

  @IsOptional()
  @IsString()
  @MaxLength(160)
  audience?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string;

  @IsOptional()
  @IsString()
  ownerId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  deliveryMethod?: string;

  @IsOptional()
  @IsDateString()
  dueDate?: string;
}
