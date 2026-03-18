import { Module } from '@nestjs/common';
import { AuditLogsModule } from '../audit-logs/audit-logs.module';
import { KpisController } from './kpis.controller';
import { KpisService } from './kpis.service';

@Module({
  imports: [AuditLogsModule],
  controllers: [KpisController],
  providers: [KpisService]
})
export class KpisModule {}
