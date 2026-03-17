import { Module } from '@nestjs/common';
import { AuditLogsModule } from '../audit-logs/audit-logs.module';
import { ActionItemsController } from './action-items.controller';
import { ActionItemsService } from './action-items.service';

@Module({
  imports: [AuditLogsModule],
  controllers: [ActionItemsController],
  providers: [ActionItemsService],
  exports: [ActionItemsService]
})
export class ActionItemsModule {}
