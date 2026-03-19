import { IsIn, IsOptional, IsString } from 'class-validator';

export class ExportReportQueryDto {
  @IsOptional()
  @IsIn(['csv'])
  format?: 'csv';

  @IsOptional()
  @IsString()
  startDate?: string;

  @IsOptional()
  @IsString()
  endDate?: string;

  @IsOptional()
  @IsString()
  status?: string;

  @IsOptional()
  @IsString()
  ownerId?: string;
}
