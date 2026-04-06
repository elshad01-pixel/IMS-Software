import { Module } from '@nestjs/common';
import { AuditLogsModule } from '../audit-logs/audit-logs.module';
import { ExternalProvidersController } from './external-providers.controller';
import { ExternalProvidersService } from './external-providers.service';

@Module({
  imports: [AuditLogsModule],
  controllers: [ExternalProvidersController],
  providers: [ExternalProvidersService]
})
export class ExternalProvidersModule {}
