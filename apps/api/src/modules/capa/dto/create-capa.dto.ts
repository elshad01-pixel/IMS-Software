import { IsDateString, IsOptional, IsString } from 'class-validator';

export class CreateCapaDto {
  @IsString()
  title!: string;

  @IsString()
  problemStatement!: string;

  @IsOptional()
  @IsString()
  rootCause?: string;

  @IsOptional()
  @IsString()
  correction?: string;

  @IsOptional()
  @IsString()
  correctiveAction?: string;

  @IsOptional()
  @IsString()
  preventiveAction?: string;

  @IsOptional()
  @IsString()
  ownerId?: string;

  @IsOptional()
  @IsDateString()
  dueDate?: string;

  @IsOptional()
  @IsString()
  status?: string;
}
