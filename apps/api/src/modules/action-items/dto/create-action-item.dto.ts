import { IsDateString, IsOptional, IsString } from 'class-validator';

export class CreateActionItemDto {
  @IsString()
  sourceType!: string;

  @IsString()
  sourceId!: string;

  @IsString()
  title!: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  ownerId?: string;

  @IsOptional()
  @IsDateString()
  dueDate?: string;
}
