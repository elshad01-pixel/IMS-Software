import { MiddlewareConsumer, Module, NestModule, RequestMethod } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from './common/prisma/prisma.module';
import { TenancyMiddleware } from './common/tenancy/tenancy.middleware';
import { AuthModule } from './modules/auth/auth.module';
import { UsersModule } from './modules/users/users.module';
import { DocumentsModule } from './modules/documents/documents.module';
import { RisksModule } from './modules/risks/risks.module';
import { CapaModule } from './modules/capa/capa.module';
import { DashboardModule } from './modules/dashboard/dashboard.module';
import { AuditLogsModule } from './modules/audit-logs/audit-logs.module';
import { AttachmentsModule } from './modules/attachments/attachments.module';
import { ActionItemsModule } from './modules/action-items/action-items.module';
import { AuditsModule } from './modules/audits/audits.module';
import { ManagementReviewModule } from './modules/management-review/management-review.module';
import { KpisModule } from './modules/kpis/kpis.module';
import { TrainingModule } from './modules/training/training.module';
import { ReportsModule } from './modules/reports/reports.module';
import { SettingsModule } from './modules/settings/settings.module';
import { NcrModule } from './modules/ncr/ncr.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    AuthModule,
    UsersModule,
    DocumentsModule,
    RisksModule,
    CapaModule,
    DashboardModule,
    AuditLogsModule,
    AttachmentsModule,
    ActionItemsModule,
    AuditsModule,
    ManagementReviewModule,
    KpisModule,
    TrainingModule,
    ReportsModule,
    SettingsModule,
    NcrModule
  ]
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(TenancyMiddleware).forRoutes({ path: '*path', method: RequestMethod.ALL });
  }
}
