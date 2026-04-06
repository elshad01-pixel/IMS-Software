import { Module } from '@nestjs/common';
import { AuditLogsModule } from '../audit-logs/audit-logs.module';
import { ComplianceObligationsController } from './compliance-obligations.controller';
import { ComplianceObligationsService } from './compliance-obligations.service';

@Module({
  imports: [AuditLogsModule],
  controllers: [ComplianceObligationsController],
  providers: [ComplianceObligationsService]
})
export class ComplianceObligationsModule {}
