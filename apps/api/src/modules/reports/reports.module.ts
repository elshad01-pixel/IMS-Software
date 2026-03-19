import { Module } from '@nestjs/common';
import { AuditLogsModule } from '../audit-logs/audit-logs.module';
import { ReportsController } from './reports.controller';
import { ReportsService } from './reports.service';

@Module({
  imports: [AuditLogsModule],
  controllers: [ReportsController],
  providers: [ReportsService]
})
export class ReportsModule {}
