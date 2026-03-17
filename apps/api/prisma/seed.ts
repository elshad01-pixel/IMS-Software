import { PrismaClient } from '@prisma/client';
import { hash } from 'bcryptjs';

const prisma = new PrismaClient();

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
  'attachments.write',
  'action-items.write'
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

  const adminRole = await prisma.role.upsert({
    where: {
      tenantId_name: {
        tenantId: tenant.id,
        name: 'Administrator'
      }
    },
    update: {},
    create: {
      tenantId: tenant.id,
      name: 'Administrator',
      description: 'System administrator',
      isSystem: true
    }
  });

  const permissions = await prisma.permission.findMany();

  for (const permission of permissions) {
    await prisma.rolePermission.upsert({
      where: {
        roleId_permissionId: {
          roleId: adminRole.id,
          permissionId: permission.id
        }
      },
      update: {},
      create: {
        roleId: adminRole.id,
        permissionId: permission.id
      }
    });
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
      roleId: adminRole.id,
      passwordHash
    },
    create: {
      tenantId: tenant.id,
      email: 'admin@demo.local',
      firstName: 'Demo',
      lastName: 'Admin',
      passwordHash,
      roleId: adminRole.id
    }
  });

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
