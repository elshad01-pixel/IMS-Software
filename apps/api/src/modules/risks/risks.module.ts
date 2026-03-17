import { Module } from '@nestjs/common';
import { AuditLogsModule } from '../audit-logs/audit-logs.module';
import { RisksController } from './risks.controller';
import { RisksService } from './risks.service';

@Module({
  imports: [AuditLogsModule],
  controllers: [RisksController],
  providers: [RisksService]
})
export class RisksModule {}
