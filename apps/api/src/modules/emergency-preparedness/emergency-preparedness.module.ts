import { Module } from '@nestjs/common';
import { AuditLogsModule } from '../audit-logs/audit-logs.module';
import { EmergencyPreparednessController } from './emergency-preparedness.controller';
import { EmergencyPreparednessService } from './emergency-preparedness.service';

@Module({
  imports: [AuditLogsModule],
  controllers: [EmergencyPreparednessController],
  providers: [EmergencyPreparednessService]
})
export class EmergencyPreparednessModule {}
