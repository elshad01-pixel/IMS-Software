import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';

@Injectable()
export class ReportsService {
  constructor(private readonly prisma: PrismaService) {}

  list(tenantId: string) {
    return this.prisma.reportDefinition.findMany({
      where: { tenantId },
      orderBy: { updatedAt: 'desc' }
    });
  }
}
