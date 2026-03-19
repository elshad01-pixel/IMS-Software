import { ConflictException, Injectable } from '@nestjs/common';
import { hash } from 'bcryptjs';
import { PrismaService } from '../../common/prisma/prisma.service';
import { AuditLogsService } from '../audit-logs/audit-logs.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';

@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLogsService: AuditLogsService
  ) {}

  list(tenantId: string) {
    return this.prisma.user.findMany({
      where: { tenantId },
      select: this.userSelect(),
      orderBy: { createdAt: 'desc' }
    });
  }

  roles(tenantId: string) {
    return this.prisma.role.findMany({
      where: { tenantId },
      select: {
        id: true,
        name: true,
        description: true,
        isSystem: true
      },
      orderBy: [{ isSystem: 'desc' }, { name: 'asc' }]
    });
  }

  detail(tenantId: string, id: string) {
    return this.prisma.user.findFirstOrThrow({
      where: { id, tenantId },
      select: this.userSelect()
    });
  }

  async create(tenantId: string, actorId: string, dto: CreateUserDto) {
    await this.ensureEmailAvailable(tenantId, dto.email);
    await this.ensureRoleBelongsToTenant(tenantId, dto.roleId);

    const passwordHash = await hash(dto.password, 10);
    const user = await this.prisma.user.create({
      data: {
        tenantId,
        email: dto.email.trim().toLowerCase(),
        firstName: dto.firstName.trim(),
        lastName: dto.lastName.trim(),
        roleId: dto.roleId,
        isActive: dto.isActive ?? true,
        passwordHash
      },
      select: this.userSelect()
    });

    await this.auditLogsService.create({
      tenantId,
      actorId,
      action: 'user.created',
      entityType: 'user',
      entityId: user.id,
      metadata: { email: user.email, roleId: user.role?.id, isActive: user.isActive }
    });

    return user;
  }

  async update(tenantId: string, actorId: string, id: string, dto: UpdateUserDto) {
    const existing = await this.prisma.user.findFirstOrThrow({
      where: { id, tenantId },
      select: {
        id: true,
        email: true
      }
    });

    if (dto.email && dto.email.trim().toLowerCase() !== existing.email.toLowerCase()) {
      await this.ensureEmailAvailable(tenantId, dto.email, id);
    }

    await this.ensureRoleBelongsToTenant(tenantId, dto.roleId);

    const data: Record<string, unknown> = {};
    if (dto.email !== undefined) data['email'] = dto.email.trim().toLowerCase();
    if (dto.firstName !== undefined) data['firstName'] = dto.firstName.trim();
    if (dto.lastName !== undefined) data['lastName'] = dto.lastName.trim();
    if (dto.roleId !== undefined) data['roleId'] = dto.roleId || null;
    if (dto.isActive !== undefined) data['isActive'] = dto.isActive;
    if (dto.password) {
      data['passwordHash'] = await hash(dto.password, 10);
    }

    const user = await this.prisma.user.update({
      where: { id },
      data,
      select: this.userSelect()
    });

    await this.auditLogsService.create({
      tenantId,
      actorId,
      action: 'user.updated',
      entityType: 'user',
      entityId: user.id,
      metadata: {
        email: user.email,
        roleId: user.role?.id,
        isActive: user.isActive,
        passwordChanged: !!dto.password
      }
    });

    return user;
  }

  private async ensureEmailAvailable(tenantId: string, email: string, excludeUserId?: string) {
    const existing = await this.prisma.user.findFirst({
      where: {
        tenantId,
        email: email.trim().toLowerCase(),
        id: excludeUserId ? { not: excludeUserId } : undefined
      },
      select: { id: true }
    });

    if (existing) {
      throw new ConflictException('A user with this email already exists.');
    }
  }

  private async ensureRoleBelongsToTenant(tenantId: string, roleId?: string | null) {
    if (!roleId) {
      return;
    }

    await this.prisma.role.findFirstOrThrow({
      where: { id: roleId, tenantId },
      select: { id: true }
    });
  }

  private userSelect() {
    return {
      id: true,
      tenantId: true,
      email: true,
      firstName: true,
      lastName: true,
      isActive: true,
      createdAt: true,
      updatedAt: true,
      role: {
        select: {
          id: true,
          name: true,
          description: true,
          isSystem: true
        }
      }
    } as const;
  }
}
