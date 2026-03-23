import { ApiProperty } from '@nestjs/swagger';
import { ArrayMinSize, IsArray, IsIn, IsString } from 'class-validator';

export class ReorderAuditChecklistQuestionsDto {
  @ApiProperty({ enum: ['4', '5', '6', '7', '8', '9', '10'] })
  @IsString()
  @IsIn(['4', '5', '6', '7', '8', '9', '10'])
  clause!: string;

  @IsString()
  standard!: string;

  @IsArray()
  @ArrayMinSize(1)
  @IsString({ each: true })
  questionIds!: string[];
}
