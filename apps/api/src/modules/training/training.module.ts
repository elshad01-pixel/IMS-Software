import { Module } from '@nestjs/common';
import { AuditLogsModule } from '../audit-logs/audit-logs.module';
import { TrainingController } from './training.controller';
import { TrainingService } from './training.service';

@Module({
  imports: [AuditLogsModule],
  controllers: [TrainingController],
  providers: [TrainingService]
})
export class TrainingModule {}
