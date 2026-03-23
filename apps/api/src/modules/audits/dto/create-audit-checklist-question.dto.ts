import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsIn, IsInt, IsOptional, IsString, MaxLength, Min } from 'class-validator';

export class CreateAuditChecklistQuestionDto {
  @IsString()
  @MaxLength(40)
  standard!: string;

  @ApiPropertyOptional({ enum: ['4', '5', '6', '7', '8', '9', '10'] })
  @IsString()
  @IsIn(['4', '5', '6', '7', '8', '9', '10'])
  clause!: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  subclause?: string;

  @IsString()
  @MaxLength(300)
  title!: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  sortOrder?: number;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsBoolean()
  isTemplateDefault?: boolean;
}
