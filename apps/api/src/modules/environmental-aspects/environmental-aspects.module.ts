import { Module } from '@nestjs/common';
import { AuditLogsModule } from '../audit-logs/audit-logs.module';
import { EnvironmentalAspectsController } from './environmental-aspects.controller';
import { EnvironmentalAspectsService } from './environmental-aspects.service';

@Module({
  imports: [AuditLogsModule],
  controllers: [EnvironmentalAspectsController],
  providers: [EnvironmentalAspectsService]
})
export class EnvironmentalAspectsModule {}
