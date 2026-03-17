import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';

@Injectable()
export class AuditsService {
  constructor(private readonly prisma: PrismaService) {}

  list(tenantId: string) {
    return this.prisma.audit.findMany({
      where: { tenantId },
      orderBy: { updatedAt: 'desc' }
    });
  }
}
