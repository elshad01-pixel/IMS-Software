import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsIn, IsOptional, IsString, MaxLength } from 'class-validator';

export class CreateAuditChecklistItemDto {
  @IsOptional()
  @IsString()
  @MaxLength(40)
  clause?: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  subclause?: string;

  @IsString()
  @MaxLength(200)
  title!: string;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  standard?: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  notes?: string;

  @ApiPropertyOptional({ enum: ['YES', 'NO', 'PARTIAL'] })
  @IsOptional()
  @IsIn(['YES', 'NO', 'PARTIAL'])
  response?: 'YES' | 'NO' | 'PARTIAL';

  @IsOptional()
  @IsBoolean()
  isComplete?: boolean;
}
