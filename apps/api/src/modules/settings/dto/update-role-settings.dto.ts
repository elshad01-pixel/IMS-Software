import { IsBoolean } from 'class-validator';

export class UpdateRoleSettingsDto {
  @IsBoolean()
  createRecords!: boolean;

  @IsBoolean()
  approveDocuments!: boolean;

  @IsBoolean()
  closeCapa!: boolean;
}
