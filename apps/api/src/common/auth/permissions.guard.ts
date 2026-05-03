import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { DEFAULT_PACKAGE_TIER, DEFAULT_SCOPE, isModuleIncluded, PackageModuleKey, TenantPackageTier, TenantScope } from './package-entitlements';
import { PACKAGE_MODULE_KEY } from './package-module.decorator';
import { DEFAULT_TENANT_ADD_ONS, normalizeTenantAddOns, TenantAddOnKey } from './tenant-addons';
import { TENANT_ADD_ON_KEY } from './tenant-addon.decorator';
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
    const requiredPackageModule = this.reflector.getAllAndOverride<PackageModuleKey | undefined>(PACKAGE_MODULE_KEY, [
      context.getHandler(),
      context.getClass()
    ]);
    const requiredAddOn = this.reflector.getAllAndOverride<TenantAddOnKey | undefined>(TENANT_ADD_ON_KEY, [
      context.getHandler(),
      context.getClass()
    ]);

    if ((!required || required.length === 0) && !requiredPackageModule && !requiredAddOn) {
      return true;
    }

    const request = context.switchToHttp().getRequest<TenantRequest>();
    const userId = request.user?.sub;
    const tenantId = request.user?.tenantId;

    if (!userId || !tenantId) {
      return false;
    }

    const [dbUser, tenantPackage, tenantScope, tenantAddOns] = await Promise.all([
      this.prisma.user.findFirst({
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
      }),
      requiredPackageModule
        ? this.prisma.tenantSetting.findUnique({
            where: {
              tenantId_key: {
                tenantId,
                key: 'subscription.packageTier'
              }
            },
            select: { value: true }
          })
        : Promise.resolve(null),
      requiredPackageModule
        ? this.prisma.tenantSetting.findUnique({
            where: {
              tenantId_key: {
                tenantId,
                key: 'subscription.scope'
              }
            },
            select: { value: true }
          })
        : Promise.resolve(null),
      requiredAddOn
        ? this.prisma.tenantSetting.findUnique({
            where: {
              tenantId_key: {
                tenantId,
                key: 'subscription.addOns'
              }
            },
            select: { value: true }
          })
        : Promise.resolve(null)
    ]);

    const permissions =
      dbUser?.role?.permissions.map((entry) => entry.permission.key) ?? request.user?.permissions ?? [];

    const hasPermissions = !required || required.every((permission) => permissions.includes(permission));
    if (!hasPermissions) {
      return false;
    }

    if (requiredPackageModule) {
      const packageTier = this.readPackageTier(tenantPackage?.value);
      const scope = this.readScope(tenantScope?.value);
      if (!isModuleIncluded(packageTier, scope, requiredPackageModule)) {
        return false;
      }
    }

    if (!requiredAddOn) {
      return true;
    }

    return this.readAddOns(tenantAddOns?.value)[requiredAddOn];
  }

  private readPackageTier(value?: string | null): TenantPackageTier {
    return value === 'ASSURANCE' || value === 'CORE_IMS' || value === 'QHSE_PRO' ? value : DEFAULT_PACKAGE_TIER;
  }

  private readScope(value?: string | null): TenantScope {
    return value === 'QMS' || value === 'EMS' || value === 'OHSMS' || value === 'IMS' || value === 'FSMS' ? value : DEFAULT_SCOPE;
  }

  private readAddOns(value?: string | null) {
    if (!value) {
      return { ...DEFAULT_TENANT_ADD_ONS };
    }

    try {
      return normalizeTenantAddOns(JSON.parse(value));
    } catch {
      return { ...DEFAULT_TENANT_ADD_ONS };
    }
  }
}
