import { Module } from '@nestjs/common';
import { AiModule } from '../ai/ai.module';
import { AttachmentsModule } from '../attachments/attachments.module';
import { AuditLogsModule } from '../audit-logs/audit-logs.module';
import { AuditReportService } from './audit-report.service';
import { AuditsController } from './audits.controller';
import { AuditsService } from './audits.service';

@Module({
  imports: [AuditLogsModule, AiModule, AttachmentsModule],
  controllers: [AuditsController],
  providers: [AuditsService, AuditReportService]
})
export class AuditsModule {}
