import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';

@Injectable()
export class TrainingService {
  constructor(private readonly prisma: PrismaService) {}

  list(tenantId: string) {
    return this.prisma.training.findMany({
      where: { tenantId },
      orderBy: { updatedAt: 'desc' }
    });
  }
}
