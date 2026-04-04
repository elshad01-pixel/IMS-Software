import { Module } from '@nestjs/common';
import { AuditLogsModule } from '../audit-logs/audit-logs.module';
import { ProcessRegisterController } from './process-register.controller';
import { ProcessRegisterService } from './process-register.service';

@Module({
  imports: [AuditLogsModule],
  controllers: [ProcessRegisterController],
  providers: [ProcessRegisterService]
})
export class ProcessRegisterModule {}
