import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';

@Injectable()
export class ManagementReviewService {
  constructor(private readonly prisma: PrismaService) {}

  list(tenantId: string) {
    return this.prisma.managementReview.findMany({
      where: { tenantId },
      orderBy: { updatedAt: 'desc' }
    });
  }
}
