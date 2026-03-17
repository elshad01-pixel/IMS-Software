import { Module } from '@nestjs/common';
import { AuditLogsModule } from '../audit-logs/audit-logs.module';
import { CapaController } from './capa.controller';
import { CapaService } from './capa.service';

@Module({
  imports: [AuditLogsModule],
  controllers: [CapaController],
  providers: [CapaService]
})
export class CapaModule {}
