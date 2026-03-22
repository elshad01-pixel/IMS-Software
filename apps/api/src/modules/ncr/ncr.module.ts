import { Module } from '@nestjs/common';
import { AuditLogsModule } from '../audit-logs/audit-logs.module';
import { NcrController } from './ncr.controller';
import { NcrService } from './ncr.service';

@Module({
  imports: [AuditLogsModule],
  controllers: [NcrController],
  providers: [NcrService]
})
export class NcrModule {}
