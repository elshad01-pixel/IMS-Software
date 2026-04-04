import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PrismaService } from '../prisma/prisma.service';
import { TenantRequest } from '../tenancy/tenant-request.interface';
import { PERMISSIONS_KEY } from './permissions.decorator';

@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly prisma: PrismaService
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const required = this.reflector.getAllAndOverride<string[]>(PERMISSIONS_KEY, [
      context.getHandler(),
      context.getClass()
    ]);

    if (!required || required.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest<TenantRequest>();
    const userId = request.user?.sub;
    const tenantId = request.user?.tenantId;

    if (!userId || !tenantId) {
      return false;
    }

    const dbUser = await this.prisma.user.findFirst({
      where: { id: userId, tenantId, isActive: true },
      select: {
        role: {
          select: {
            permissions: {
              select: {
                permission: {
                  select: {
                    key: true
                  }
                }
              }
            }
          }
        }
      }
    });

    const permissions =
      dbUser?.role?.permissions.map((entry) => entry.permission.key) ?? request.user?.permissions ?? [];

    return required.every((permission) => permissions.includes(permission));
  }
}
