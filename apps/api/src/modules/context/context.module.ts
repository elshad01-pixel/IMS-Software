import { Module } from '@nestjs/common';
import { AuditLogsModule } from '../audit-logs/audit-logs.module';
import { ContextController } from './context.controller';
import { ContextService } from './context.service';

@Module({
  imports: [AuditLogsModule],
  controllers: [ContextController],
  providers: [ContextService]
})
export class ContextModule {}
