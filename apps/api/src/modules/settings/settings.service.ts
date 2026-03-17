import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';

@Injectable()
export class SettingsService {
  constructor(private readonly prisma: PrismaService) {}

  list(tenantId: string) {
    return this.prisma.tenantSetting.findMany({
      where: { tenantId },
      orderBy: { key: 'asc' }
    });
  }

  update(tenantId: string, key: string, value: string) {
    return this.prisma.tenantSetting.upsert({
      where: {
        tenantId_key: {
          tenantId,
          key
        }
      },
      update: { value },
      create: { tenantId, key, value }
    });
  }
}
