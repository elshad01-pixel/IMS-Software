import { Injectable } from '@nestjs/common';
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
      include: { role: true },
      orderBy: { createdAt: 'desc' }
    });
  }

  async create(tenantId: string, actorId: string, dto: CreateUserDto) {
    const passwordHash = await hash(dto.password, 10);
    const user = await this.prisma.user.create({
      data: {
        tenantId,
        email: dto.email,
        firstName: dto.firstName,
        lastName: dto.lastName,
        roleId: dto.roleId,
        passwordHash
      }
    });

    await this.auditLogsService.create({
      tenantId,
      actorId,
      action: 'user.created',
      entityType: 'user',
      entityId: user.id,
      metadata: { email: user.email }
    });

    return user;
  }

  async update(tenantId: string, actorId: string, id: string, dto: UpdateUserDto) {
    await this.prisma.user.findFirstOrThrow({
      where: { id, tenantId }
    });

    const data: Record<string, unknown> = { ...dto };
    delete data.password;
    if (dto.password) {
      data.passwordHash = await hash(dto.password, 10);
    }

    const user = await this.prisma.user.update({
      where: { id },
      data
    });

    await this.auditLogsService.create({
      tenantId,
      actorId,
      action: 'user.updated',
      entityType: 'user',
      entityId: user.id,
      metadata: dto
    });

    return user;
  }
}
