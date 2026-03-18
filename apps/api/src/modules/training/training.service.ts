import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException
} from '@nestjs/common';
import { Prisma, TrainingAssignmentStatus, type Training } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';
import { AuditLogsService } from '../audit-logs/audit-logs.service';
import { CreateTrainingAssignmentDto } from './dto/create-training-assignment.dto';
import { CreateTrainingDto } from './dto/create-training.dto';
import { UpdateTrainingAssignmentDto } from './dto/update-training-assignment.dto';
import { UpdateTrainingDto } from './dto/update-training.dto';

@Injectable()
export class TrainingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLogsService: AuditLogsService
  ) {}

  async list(tenantId: string) {
    const trainings = await this.prisma.training.findMany({
      where: { tenantId },
      include: {
        assignments: {
          orderBy: [{ dueDate: 'asc' }, { createdAt: 'desc' }]
        }
      },
      orderBy: { updatedAt: 'desc' }
    });

    const users = await this.getUserMap(tenantId);
    return trainings.map((training) => this.mapTraining(training, users));
  }

  async get(tenantId: string, id: string) {
    const training = await this.prisma.training.findFirst({
      where: { tenantId, id },
      include: {
        assignments: {
          orderBy: [{ dueDate: 'asc' }, { createdAt: 'desc' }]
        }
      }
    });

    if (!training) {
      throw new NotFoundException('Training course not found');
    }

    const users = await this.getUserMap(tenantId);
    return this.mapTraining(training, users);
  }

  async create(tenantId: string, actorId: string, dto: CreateTrainingDto) {
    await this.ensureUserBelongsToTenant(tenantId, dto.ownerId);

    const training = await this.prisma.training.create({
      data: {
        tenantId,
        title: dto.title.trim(),
        audience: this.normalizeText(dto.audience),
        description: this.normalizeText(dto.description),
        ownerId: dto.ownerId || null,
        deliveryMethod: this.normalizeText(dto.deliveryMethod),
        dueDate: dto.dueDate ? new Date(dto.dueDate) : null
      },
      include: { assignments: true }
    });

    await this.auditLogsService.create({
      tenantId,
      actorId,
      action: 'training.created',
      entityType: 'training',
      entityId: training.id,
      metadata: dto
    });

    const users = await this.getUserMap(tenantId);
    return this.mapTraining(training, users);
  }

  async update(tenantId: string, actorId: string, id: string, dto: UpdateTrainingDto) {
    const existing = await this.prisma.training.findFirst({
      where: { tenantId, id }
    });

    if (!existing) {
      throw new NotFoundException('Training course not found');
    }

    await this.ensureUserBelongsToTenant(tenantId, dto.ownerId);

    const training = await this.prisma.training.update({
      where: { id },
      data: {
        title: dto.title?.trim(),
        audience: dto.audience !== undefined ? this.normalizeText(dto.audience) : undefined,
        description:
          dto.description !== undefined ? this.normalizeText(dto.description) : undefined,
        ownerId: dto.ownerId !== undefined ? dto.ownerId || null : undefined,
        deliveryMethod:
          dto.deliveryMethod !== undefined ? this.normalizeText(dto.deliveryMethod) : undefined,
        dueDate: dto.dueDate !== undefined ? (dto.dueDate ? new Date(dto.dueDate) : null) : undefined
      },
      include: { assignments: true }
    });

    await this.auditLogsService.create({
      tenantId,
      actorId,
      action: 'training.updated',
      entityType: 'training',
      entityId: training.id,
      metadata: dto
    });

    const users = await this.getUserMap(tenantId);
    return this.mapTraining(training, users);
  }

  async addAssignment(
    tenantId: string,
    actorId: string,
    trainingId: string,
    dto: CreateTrainingAssignmentDto
  ) {
    await this.requireTraining(tenantId, trainingId);
    await this.ensureUserBelongsToTenant(tenantId, dto.userId);

    try {
      const assignment = await this.prisma.trainingAssignment.create({
        data: {
          tenantId,
          trainingId,
          userId: dto.userId,
          dueDate: dto.dueDate ? new Date(dto.dueDate) : null,
          status: dto.status ?? TrainingAssignmentStatus.ASSIGNED,
          notes: this.normalizeText(dto.notes),
          evidenceSummary: this.normalizeText(dto.evidenceSummary),
          completedAt:
            (dto.status ?? TrainingAssignmentStatus.ASSIGNED) === TrainingAssignmentStatus.COMPLETED
              ? new Date()
              : null
        }
      });

      await this.refreshCompletion(trainingId);

      await this.auditLogsService.create({
        tenantId,
        actorId,
        action: 'training.assignment.created',
        entityType: 'training',
        entityId: trainingId,
        metadata: dto
      });

      return assignment;
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new ConflictException('This user is already assigned to the selected course');
      }

      throw error;
    }
  }

  async updateAssignment(
    tenantId: string,
    actorId: string,
    assignmentId: string,
    dto: UpdateTrainingAssignmentDto
  ) {
    const assignment = await this.prisma.trainingAssignment.findFirst({
      where: { tenantId, id: assignmentId }
    });

    if (!assignment) {
      throw new NotFoundException('Training assignment not found');
    }

    await this.ensureUserBelongsToTenant(tenantId, dto.userId);
    const nextStatus = dto.status ?? assignment.status;

    if (nextStatus === TrainingAssignmentStatus.COMPLETED && !(dto.evidenceSummary ?? assignment.evidenceSummary)) {
      throw new BadRequestException('Evidence summary is required before marking training complete');
    }

    const updated = await this.prisma.trainingAssignment.update({
      where: { id: assignmentId },
      data: {
        userId: dto.userId ?? undefined,
        dueDate: dto.dueDate !== undefined ? (dto.dueDate ? new Date(dto.dueDate) : null) : undefined,
        status: dto.status,
        notes: dto.notes !== undefined ? this.normalizeText(dto.notes) : undefined,
        evidenceSummary:
          dto.evidenceSummary !== undefined ? this.normalizeText(dto.evidenceSummary) : undefined,
        completedAt:
          nextStatus === TrainingAssignmentStatus.COMPLETED
            ? assignment.completedAt ?? new Date()
            : dto.status && dto.status !== TrainingAssignmentStatus.COMPLETED
              ? null
              : undefined
      }
    });

    await this.refreshCompletion(assignment.trainingId);

    await this.auditLogsService.create({
      tenantId,
      actorId,
      action: 'training.assignment.updated',
      entityType: 'training',
      entityId: assignment.trainingId,
      metadata: dto
    });

    return updated;
  }

  private async refreshCompletion(trainingId: string) {
    const assignments = await this.prisma.trainingAssignment.findMany({
      where: { trainingId }
    });

    const completion =
      assignments.length === 0
        ? 0
        : (assignments.filter((item) => item.status === TrainingAssignmentStatus.COMPLETED).length /
            assignments.length) *
          100;

    await this.prisma.training.update({
      where: { id: trainingId },
      data: { completion }
    });
  }

  private async requireTraining(tenantId: string, trainingId: string) {
    const training = await this.prisma.training.findFirst({
      where: { tenantId, id: trainingId }
    });

    if (!training) {
      throw new NotFoundException('Training course not found');
    }

    return training;
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
      throw new BadRequestException('Selected user is not active in this tenant');
    }
  }

  private async getUserMap(tenantId: string) {
    const users = await this.prisma.user.findMany({
      where: { tenantId },
      select: { id: true, firstName: true, lastName: true, email: true }
    });

    return new Map(users.map((user) => [user.id, user]));
  }

  private mapTraining<
    T extends Training & {
      assignments: Array<{
        id: string;
        userId: string;
        dueDate: Date | null;
        completedAt: Date | null;
        status: TrainingAssignmentStatus;
        notes: string | null;
        evidenceSummary: string | null;
      }>;
    }
  >(training: T, users: Map<string, { id: string; firstName: string; lastName: string; email: string }>) {
    const assignments = training.assignments.map((assignment) => {
      const user = users.get(assignment.userId);
      const isOverdue =
        assignment.status !== TrainingAssignmentStatus.COMPLETED &&
        !!assignment.dueDate &&
        assignment.dueDate.getTime() < Date.now();

      return {
        ...assignment,
        dueDate: assignment.dueDate?.toISOString() ?? null,
        completedAt: assignment.completedAt?.toISOString() ?? null,
        user,
        displayStatus: isOverdue ? 'OVERDUE' : assignment.status
      };
    });

    return {
      ...training,
      dueDate: training.dueDate?.toISOString() ?? null,
      assignments
    };
  }

  private normalizeText(value?: string | null) {
    const trimmed = value?.trim();
    return trimmed ? trimmed : null;
  }
}
