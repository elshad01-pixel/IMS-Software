import { ConflictException, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { compare, hash } from 'bcryptjs';
import { DEFAULT_PACKAGE_TIER, getEnabledModules, TenantPackageTier } from '../../common/auth/package-entitlements';
import { DEFAULT_TENANT_ADD_ONS, normalizeTenantAddOns, TenantAddOns } from '../../common/auth/tenant-addons';
import { getAuditChecklistQuestionDelegate } from '../../common/prisma/prisma-delegate-compat';
import { PrismaService } from '../../common/prisma/prisma.service';
import { createStarterQuestionSeedData } from '../audits/audit-question-bank';
import { LoginDto } from './dto/login.dto';
import { RegisterTenantDto } from './dto/register-tenant.dto';

const defaultPermissions = [
  'dashboard.read',
  'documents.read',
  'documents.write',
  'risks.read',
  'risks.write',
  'capa.read',
  'capa.write',
  'audits.read',
  'audits.write',
  'management-review.read',
  'management-review.write',
  'kpis.read',
  'kpis.write',
  'training.read',
  'training.write',
  'context.read',
  'context.write',
  'incidents.read',
  'incidents.write',
  'aspects.read',
  'aspects.write',
  'hazards.read',
  'hazards.write',
  'providers.read',
  'providers.write',
  'change.read',
  'change.write',
  'obligations.read',
  'obligations.write',
  'processes.read',
  'processes.write',
  'ncr.read',
  'ncr.write',
  'reports.read',
  'users.read',
  'users.write',
  'settings.read',
  'settings.write',
  'documents.approve',
  'capa.close',
  'attachments.write',
  'action-items.read',
  'action-items.write',
  'admin.delete'
];

const systemRoleDefinitions = [
  {
    name: 'Admin',
    description: 'Full tenant administration and configuration access',
    permissions: defaultPermissions
  },
  {
    name: 'Manager',
    description: 'Operational management access without full system control',
    permissions: defaultPermissions.filter((permission) => !['users.write', 'settings.write', 'admin.delete'].includes(permission))
  },
  {
    name: 'User',
    description: 'Basic operational access with read-focused permissions',
    permissions: [
      'dashboard.read',
      'documents.read',
      'risks.read',
      'capa.read',
      'audits.read',
      'management-review.read',
      'kpis.read',
      'training.read',
      'context.read',
      'incidents.read',
      'aspects.read',
      'hazards.read',
      'providers.read',
      'change.read',
      'obligations.read',
      'processes.read',
      'ncr.read',
      'reports.read',
      'action-items.read',
      'action-items.write'
    ]
  }
];

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService
  ) {}

  async registerTenant(input: RegisterTenantDto) {
    const existingTenant = await this.prisma.tenant.findUnique({
      where: { slug: input.tenantSlug }
    });
    if (existingTenant) {
      throw new ConflictException('Tenant slug is already in use');
    }

    const permissions = await Promise.all(
      defaultPermissions.map((key) =>
        this.prisma.permission.upsert({
          where: { key },
          update: {},
          create: { key, description: key }
        })
      )
    );

    const passwordHash = await hash(input.password, 10);

    const tenant = await this.prisma.tenant.create({
      data: {
        name: input.companyName,
        slug: input.tenantSlug
      }
    });

    const roles = await Promise.all(
      systemRoleDefinitions.map((roleDefinition) =>
        this.prisma.role.create({
          data: {
            tenantId: tenant.id,
            name: roleDefinition.name,
            description: roleDefinition.description,
            isSystem: true,
            permissions: {
              create: permissions
                .filter((permission) => roleDefinition.permissions.includes(permission.key))
                .map((permission) => ({
                  permissionId: permission.id
                }))
            }
          }
        })
      )
    );

    const role = roles.find((entry) => entry.name === 'Admin');
    const user = await this.prisma.user.create({
      data: {
        tenantId: tenant.id,
        email: input.email,
        firstName: input.firstName,
        lastName: input.lastName,
        passwordHash,
        roleId: role?.id
      }
    });

    await this.prisma.tenantSetting.createMany({
      data: [
        { tenantId: tenant.id, key: 'companyName', value: input.companyName },
        { tenantId: tenant.id, key: 'timezone', value: 'UTC' }
      ]
    });

    await getAuditChecklistQuestionDelegate(this.prisma).createMany({
      data: createStarterQuestionSeedData(tenant.id)
    });

    return this.issueToken(user.id, tenant.id, user.email, role?.id);
  }

  async login(input: LoginDto) {
    const tenant = await this.prisma.tenant.findUnique({
      where: { slug: input.tenantSlug }
    });
    if (!tenant) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const user = await this.prisma.user.findUnique({
      where: {
        tenantId_email: {
          tenantId: tenant.id,
          email: input.email
        }
      },
      include: {
        role: {
          include: {
            permissions: { include: { permission: true } }
          }
        }
      }
    });

    if (!user || !user.isActive) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const passwordMatches = await compare(input.password, user.passwordHash);
    if (!passwordMatches) {
      throw new UnauthorizedException('Invalid credentials');
    }

    return this.issueToken(user.id, tenant.id, user.email, user.roleId || undefined);
  }

  async me(userId: string, tenantId: string) {
    const [user, packageTier, enabledAddOns] = await Promise.all([
      this.prisma.user.findFirst({
      where: { id: userId, tenantId },
      select: {
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
            permissions: {
              select: {
                permission: true
              }
            }
          }
        }
      }
      }),
      this.readTenantPackageTier(tenantId),
      this.readTenantAddOns(tenantId)
    ]);

    return user
      ? {
          ...user,
          packageTier,
          enabledModules: getEnabledModules(packageTier),
          enabledAddOns
        }
      : null;
  }

  private async issueToken(userId: string, tenantId: string, email: string, roleId?: string) {
    const [permissions, packageTier, enabledAddOns] = await Promise.all([
      roleId
        ? this.prisma.rolePermission.findMany({
            where: { roleId },
            include: { permission: true }
          })
        : Promise.resolve([]),
      this.readTenantPackageTier(tenantId),
      this.readTenantAddOns(tenantId)
    ]);

    const payload = {
      sub: userId,
      tenantId,
      email,
      roleId,
      permissions: permissions.map((entry) => entry.permission.key),
      packageTier,
      enabledModules: getEnabledModules(packageTier),
      enabledAddOns
    };

    const accessToken = await this.jwtService.signAsync(payload);
    return {
      accessToken,
      user: payload
    };
  }

  private async readTenantPackageTier(tenantId: string): Promise<TenantPackageTier> {
    const setting = await this.prisma.tenantSetting.findUnique({
      where: {
        tenantId_key: {
          tenantId,
          key: 'subscription.packageTier'
        }
      },
      select: { value: true }
    });

    const value = setting?.value as TenantPackageTier | undefined;
    return value === 'ASSURANCE' || value === 'CORE_IMS' || value === 'QHSE_PRO' ? value : DEFAULT_PACKAGE_TIER;
  }

  private async readTenantAddOns(tenantId: string): Promise<TenantAddOns> {
    const setting = await this.prisma.tenantSetting.findUnique({
      where: {
        tenantId_key: {
          tenantId,
          key: 'subscription.addOns'
        }
      },
      select: { value: true }
    });

    if (!setting?.value) {
      return { ...DEFAULT_TENANT_ADD_ONS };
    }

    try {
      return normalizeTenantAddOns(JSON.parse(setting.value));
    } catch {
      return { ...DEFAULT_TENANT_ADD_ONS };
    }
  }
}
