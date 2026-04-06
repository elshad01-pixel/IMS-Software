import { Module } from '@nestjs/common';
import { ChangeManagementController } from './change-management.controller';
import { ChangeManagementService } from './change-management.service';
import { AuditLogsModule } from '../audit-logs/audit-logs.module';

@Module({
  imports: [AuditLogsModule],
  controllers: [ChangeManagementController],
  providers: [ChangeManagementService]
})
export class ChangeManagementModule {}
