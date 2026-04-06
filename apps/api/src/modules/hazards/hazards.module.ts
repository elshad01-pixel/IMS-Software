import { Module } from '@nestjs/common';
import { AuditLogsModule } from '../audit-logs/audit-logs.module';
import { HazardsController } from './hazards.controller';
import { HazardsService } from './hazards.service';

@Module({
  imports: [AuditLogsModule],
  controllers: [HazardsController],
  providers: [HazardsService]
})
export class HazardsModule {}
