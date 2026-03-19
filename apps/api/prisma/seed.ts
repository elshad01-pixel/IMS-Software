import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { hash } from 'bcryptjs';

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error('DATABASE_URL is required');
}

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString })
});

const permissionKeys = [
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
  'reports.read',
  'users.read',
  'users.write',
  'settings.read',
  'settings.write',
  'documents.approve',
  'capa.close',
  'attachments.write',
  'action-items.write'
];

const systemRoleDefinitions = [
  {
    name: 'Admin',
    description: 'Full tenant administration and configuration access',
    permissions: permissionKeys
  },
  {
    name: 'Manager',
    description: 'Operational management access without full system control',
    permissions: permissionKeys.filter((permission) => !['users.write', 'settings.write'].includes(permission))
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
      'reports.read',
      'attachments.write',
      'action-items.write'
    ]
  }
];

async function main() {
  for (const key of permissionKeys) {
    await prisma.permission.upsert({
      where: { key },
      update: {},
      create: { key, description: key }
    });
  }

  const tenant = await prisma.tenant.upsert({
    where: { slug: 'demo-tenant' },
    update: {},
    create: {
      slug: 'demo-tenant',
      name: 'Demo Tenant'
    }
  });

  const legacyAdminRole = await prisma.role.findFirst({
    where: {
      tenantId: tenant.id,
      name: 'Administrator'
    }
  });

  if (legacyAdminRole) {
    await prisma.role.update({
      where: { id: legacyAdminRole.id },
      data: {
        name: 'Admin',
        description: 'Full tenant administration and configuration access',
        isSystem: true
      }
    });
  }

  const permissions = await prisma.permission.findMany();
  const roleIds = new Map<string, string>();

  for (const roleDefinition of systemRoleDefinitions) {
    const role = await prisma.role.upsert({
      where: {
        tenantId_name: {
          tenantId: tenant.id,
          name: roleDefinition.name
        }
      },
      update: {
        description: roleDefinition.description,
        isSystem: true
      },
      create: {
        tenantId: tenant.id,
        name: roleDefinition.name,
        description: roleDefinition.description,
        isSystem: true
      }
    });

    roleIds.set(roleDefinition.name, role.id);

    for (const permission of permissions.filter((entry) => roleDefinition.permissions.includes(entry.key))) {
      await prisma.rolePermission.upsert({
        where: {
          roleId_permissionId: {
            roleId: role.id,
            permissionId: permission.id
          }
        },
        update: {},
        create: {
          roleId: role.id,
          permissionId: permission.id
        }
      });
    }
  }

  const passwordHash = await hash('ChangeMe123!', 10);

  await prisma.user.upsert({
    where: {
      tenantId_email: {
        tenantId: tenant.id,
        email: 'admin@demo.local'
      }
    },
    update: {
      roleId: roleIds.get('Admin'),
      passwordHash
    },
    create: {
      tenantId: tenant.id,
      email: 'admin@demo.local',
      firstName: 'Demo',
      lastName: 'Admin',
      passwordHash,
      roleId: roleIds.get('Admin')
    }
  });

  const additionalUsers = [
    { email: 'quality.manager@demo.local', firstName: 'Quality', lastName: 'Manager', roleName: 'Manager' },
    { email: 'internal.auditor@demo.local', firstName: 'Internal', lastName: 'Auditor', roleName: 'User' },
    { email: 'ops.supervisor@demo.local', firstName: 'Operations', lastName: 'Supervisor', roleName: 'Manager' }
  ];

  for (const user of additionalUsers) {
    await prisma.user.upsert({
      where: {
        tenantId_email: {
          tenantId: tenant.id,
          email: user.email
        }
      },
      update: {
        roleId: roleIds.get(user.roleName),
        passwordHash
      },
      create: {
        tenantId: tenant.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        passwordHash,
        roleId: roleIds.get(user.roleName)
      }
    });
  }

  await prisma.tenantSetting.upsert({
    where: {
      tenantId_key: {
        tenantId: tenant.id,
        key: 'companyName'
      }
    },
    update: {},
    create: {
      tenantId: tenant.id,
      key: 'companyName',
      value: 'Demo Tenant'
    }
  });
}

main()
  .catch(async (error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
