import { IsBoolean } from 'class-validator';

export class UpdateRoleSettingsDto {
  @IsBoolean()
  manageUsersAndSettings!: boolean;

  @IsBoolean()
  createOperationalRecords!: boolean;

  @IsBoolean()
  manageActions!: boolean;

  @IsBoolean()
  manageAssuranceWorkflows!: boolean;

  @IsBoolean()
  leadManagementReview!: boolean;

  @IsBoolean()
  approveDocuments!: boolean;

  @IsBoolean()
  closeCapa!: boolean;

  @IsBoolean()
  exportReports!: boolean;
}
