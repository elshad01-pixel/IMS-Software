import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { KpiDirection, type Kpi } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';
import { AuditLogsService } from '../audit-logs/audit-logs.service';
import { CreateKpiDto } from './dto/create-kpi.dto';
import { CreateKpiReadingDto } from './dto/create-kpi-reading.dto';
import { UpdateKpiDto } from './dto/update-kpi.dto';
import { UpdateKpiReadingDto } from './dto/update-kpi-reading.dto';

@Injectable()
export class KpisService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLogsService: AuditLogsService
  ) {}

  async list(tenantId: string) {
    const kpis = await this.prisma.kpi.findMany({
      where: { tenantId },
      include: {
        readings: {
          orderBy: { readingDate: 'desc' },
          take: 5
        }
      },
      orderBy: { updatedAt: 'desc' }
    });

    return kpis.map((kpi) => this.mapKpi(kpi));
  }

  async get(tenantId: string, id: string) {
    const kpi = await this.prisma.kpi.findFirst({
      where: { tenantId, id },
      include: {
        readings: {
          orderBy: { readingDate: 'desc' }
        }
      }
    });

    if (!kpi) {
      throw new NotFoundException('KPI not found');
    }

    return this.mapKpi(kpi);
  }

  async create(tenantId: string, actorId: string, dto: CreateKpiDto) {
    await this.ensureUserBelongsToTenant(tenantId, dto.ownerId);
    this.assertThresholds(dto.target, dto.warningThreshold, dto.direction ?? KpiDirection.AT_LEAST);

    const kpi = await this.prisma.kpi.create({
      data: {
        tenantId,
        name: dto.name.trim(),
        description: this.normalizeText(dto.description),
        ownerId: dto.ownerId || null,
        target: dto.target,
        warningThreshold: dto.warningThreshold ?? null,
        actual: 0,
        unit: dto.unit.trim(),
        periodLabel: dto.periodLabel.trim(),
        direction: dto.direction ?? KpiDirection.AT_LEAST
      },
      include: { readings: true }
    });

    await this.auditLogsService.create({
      tenantId,
      actorId,
      action: 'kpi.created',
      entityType: 'kpi',
      entityId: kpi.id,
      metadata: dto
    });

    return this.mapKpi(kpi);
  }

  async update(tenantId: string, actorId: string, id: string, dto: UpdateKpiDto) {
    const existing = await this.prisma.kpi.findFirst({
      where: { tenantId, id }
    });

    if (!existing) {
      throw new NotFoundException('KPI not found');
    }

    await this.ensureUserBelongsToTenant(tenantId, dto.ownerId);
    this.assertThresholds(
      dto.target ?? existing.target,
      dto.warningThreshold ?? existing.warningThreshold ?? undefined,
      dto.direction ?? existing.direction
    );

    const kpi = await this.prisma.kpi.update({
      where: { id },
      data: {
        name: dto.name?.trim(),
        description: dto.description !== undefined ? this.normalizeText(dto.description) : undefined,
        ownerId: dto.ownerId !== undefined ? dto.ownerId || null : undefined,
        target: dto.target,
        warningThreshold: dto.warningThreshold !== undefined ? dto.warningThreshold ?? null : undefined,
        unit: dto.unit?.trim(),
        periodLabel: dto.periodLabel?.trim(),
        direction: dto.direction
      },
      include: {
        readings: {
          orderBy: { readingDate: 'desc' },
          take: 10
        }
      }
    });

    await this.auditLogsService.create({
      tenantId,
      actorId,
      action: 'kpi.updated',
      entityType: 'kpi',
      entityId: kpi.id,
      metadata: dto
    });

    return this.mapKpi(kpi);
  }

  async addReading(tenantId: string, actorId: string, kpiId: string, dto: CreateKpiReadingDto) {
    const kpi = await this.prisma.kpi.findFirst({
      where: { tenantId, id: kpiId }
    });

    if (!kpi) {
      throw new NotFoundException('KPI not found');
    }

    const reading = await this.prisma.kpiReading.create({
      data: {
        tenantId,
        kpiId,
        value: dto.value,
        readingDate: new Date(dto.readingDate),
        notes: this.normalizeText(dto.notes)
      }
    });

    await this.updateKpiActual(kpiId);

    await this.auditLogsService.create({
      tenantId,
      actorId,
      action: 'kpi.reading.created',
      entityType: 'kpi',
      entityId: kpiId,
      metadata: dto
    });

    return reading;
  }

  async updateReading(
    tenantId: string,
    actorId: string,
    readingId: string,
    dto: UpdateKpiReadingDto
  ) {
    const reading = await this.prisma.kpiReading.findFirst({
      where: { tenantId, id: readingId }
    });

    if (!reading) {
      throw new NotFoundException('KPI reading not found');
    }

    const updated = await this.prisma.kpiReading.update({
      where: { id: readingId },
      data: {
        value: dto.value,
        readingDate: dto.readingDate ? new Date(dto.readingDate) : undefined,
        notes: dto.notes !== undefined ? this.normalizeText(dto.notes) : undefined
      }
    });

    await this.updateKpiActual(reading.kpiId);

    await this.auditLogsService.create({
      tenantId,
      actorId,
      action: 'kpi.reading.updated',
      entityType: 'kpi',
      entityId: reading.kpiId,
      metadata: dto
    });

    return updated;
  }

  private async updateKpiActual(kpiId: string) {
    const latest = await this.prisma.kpiReading.findFirst({
      where: { kpiId },
      orderBy: [{ readingDate: 'desc' }, { createdAt: 'desc' }]
    });

    if (!latest) {
      return;
    }

    await this.prisma.kpi.update({
      where: { id: kpiId },
      data: { actual: latest.value }
    });
  }

  private mapKpi<T extends Kpi & { readings: Array<{ value: number; readingDate: Date; notes: string | null }> }>(
    kpi: T
  ) {
    const status = this.getKpiStatus(kpi.actual, kpi.target, kpi.warningThreshold, kpi.direction);
    const history = [...kpi.readings]
      .sort((a, b) => a.readingDate.getTime() - b.readingDate.getTime())
      .map((reading) => ({
        ...reading,
        readingDate: reading.readingDate.toISOString()
      }));

    return {
      ...kpi,
      status,
      readings: history,
      trend:
        history.length >= 2
          ? history[history.length - 1].value - history[history.length - 2].value
          : 0
    };
  }

  private getKpiStatus(
    actual: number,
    target: number,
    warningThreshold: number | null,
    direction: KpiDirection
  ) {
    if (direction === KpiDirection.AT_LEAST) {
      if (actual >= target) {
        return 'ON_TARGET';
      }

      if (warningThreshold !== null && actual >= warningThreshold) {
        return 'WATCH';
      }

      return 'BREACH';
    }

    if (actual <= target) {
      return 'ON_TARGET';
    }

    if (warningThreshold !== null && actual <= warningThreshold) {
      return 'WATCH';
    }

    return 'BREACH';
  }

  private async ensureUserBelongsToTenant(tenantId: string, userId?: string | null) {
    if (!userId) {
      return;
    }

    const user = await this.prisma.user.findFirst({
      where: { tenantId, id: userId, isActive: true },
      select: { id: true }
    });

    if (!user) {
      throw new BadRequestException('Selected KPI owner is not active in this tenant');
    }
  }

  private assertThresholds(target: number, warningThreshold: number | undefined, direction: KpiDirection) {
    if (warningThreshold === undefined || warningThreshold === null) {
      return;
    }

    if (direction === KpiDirection.AT_LEAST && warningThreshold > target) {
      throw new BadRequestException('Warning threshold cannot be above the target for AT_LEAST KPIs');
    }

    if (direction === KpiDirection.AT_MOST && warningThreshold < target) {
      throw new BadRequestException('Warning threshold cannot be below the target for AT_MOST KPIs');
    }
  }

  private normalizeText(value?: string | null) {
    const trimmed = value?.trim();
    return trimmed ? trimmed : null;
  }
}
