import { IsDateString, IsNumber, IsOptional, IsString, MaxLength } from 'class-validator';

export class CreateKpiReadingDto {
  @IsNumber()
  value!: number;

  @IsDateString()
  readingDate!: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  notes?: string;
}
