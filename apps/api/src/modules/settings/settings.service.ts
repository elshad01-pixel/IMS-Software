import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';

const settingsDefaults = {
  organization: {
    companyName: 'Demo Tenant',
    industry: '',
    location: ''
  },
  document: {
    types: ['Procedure', 'Policy', 'Work Instruction', 'Form'],
    numberingPrefix: 'QMS-PRO',
    versionFormat: 'V1.0'
  },
  risk: {
    likelihoodScale: 5,
    severityScale: 5
  },
  kpi: {
    greenThreshold: 100,
    warningThreshold: 90,
    breachThreshold: 80
  },
  notifications: {
    enabled: true
  },
  ai: {
    enabled: false,
    provider: 'openai',
    features: {
      auditFindingAssistant: true,
      documentDraftAssistant: false,
      managementReviewAssistant: false,
      riskSuggestionAssistant: false
    }
  },
  implementation: {
    enabled: true,
    startingPoint: 'DIGITISING_EXISTING',
    targetStandards: ['ISO 9001', 'ISO 14001', 'ISO 45001'],
    rolloutOwner: 'Quality Manager',
    certificationGoal: '',
    checklist: [
      { id: 'scope-context', label: 'Define scope, context, and interested parties', done: false },
      { id: 'policy-documents', label: 'Approve policies and controlled document structure', done: false },
      { id: 'objectives-kpis', label: 'Set objectives, targets, and KPI review ownership', done: false },
      { id: 'process-risk', label: 'Map processes and assess key risks, hazards, and aspects', done: false },
      { id: 'operations-training', label: 'Deploy operational controls, training, and provider controls', done: false },
      { id: 'audit-review', label: 'Run internal audit and hold management review', done: false }
    ],
    objectivePlan: {
      focus: '',
      objective: '',
      target: '',
      owner: '',
      reviewFrequency: 'Monthly',
      linkedModule: 'KPIs'
    }
  }
} as const;

const roleCapabilityPermissions = {
  createRecords: [
    'documents.write',
    'risks.write',
    'capa.write',
    'audits.write',
    'management-review.write',
    'kpis.write',
    'training.write'
  ],
  approveDocuments: ['documents.approve'],
  closeCapa: ['capa.close']
} as const;

@Injectable()
export class SettingsService {
  constructor(private readonly prisma: PrismaService) {}

  list(tenantId: string) {
    return this.prisma.tenantSetting.findMany({
      where: { tenantId },
      orderBy: { key: 'asc' }
    });
  }

  async getConfig(tenantId: string) {
    const [settings, tenant, roles] = await Promise.all([
      this.prisma.tenantSetting.findMany({
        where: { tenantId }
      }),
      this.prisma.tenant.findUnique({
        where: { id: tenantId },
        select: { name: true, slug: true }
      }),
      this.listRoles(tenantId)
    ]);

    const map = new Map(settings.map((item) => [item.key, item.value]));

    return {
      organization: {
        companyName: this.readSetting(map, 'organization.companyName', tenant?.name ?? settingsDefaults.organization.companyName),
        industry: this.readSetting(map, 'organization.industry', settingsDefaults.organization.industry),
        location: this.readSetting(map, 'organization.location', settingsDefaults.organization.location),
        tenantSlug: tenant?.slug ?? ''
      },
      usersRoles: roles,
      document: {
        types: this.readJsonSetting<string[]>(map, 'document.types', [...settingsDefaults.document.types]),
        numberingPrefix: this.readSetting(map, 'document.numberingPrefix', settingsDefaults.document.numberingPrefix),
        versionFormat: this.readSetting(map, 'document.versionFormat', settingsDefaults.document.versionFormat)
      },
      risk: {
        likelihoodScale: this.readNumberSetting(map, 'risk.likelihoodScale', settingsDefaults.risk.likelihoodScale),
        severityScale: this.readNumberSetting(map, 'risk.severityScale', settingsDefaults.risk.severityScale)
      },
      kpi: {
        greenThreshold: this.readNumberSetting(map, 'kpi.greenThreshold', settingsDefaults.kpi.greenThreshold),
        warningThreshold: this.readNumberSetting(map, 'kpi.warningThreshold', settingsDefaults.kpi.warningThreshold),
        breachThreshold: this.readNumberSetting(map, 'kpi.breachThreshold', settingsDefaults.kpi.breachThreshold)
      },
      notifications: {
        enabled: this.readBooleanSetting(map, 'notifications.enabled', settingsDefaults.notifications.enabled)
      },
      ai: {
        enabled: this.readBooleanSetting(map, 'ai.enabled', settingsDefaults.ai.enabled),
        provider: this.readSetting(map, 'ai.provider', settingsDefaults.ai.provider),
        features: this.readJsonSetting<typeof settingsDefaults.ai.features>(
          map,
          'ai.features',
          { ...settingsDefaults.ai.features }
        )
      },
      implementation: {
        enabled: this.readBooleanSetting(map, 'implementation.enabled', settingsDefaults.implementation.enabled),
        startingPoint: this.readSetting(map, 'implementation.startingPoint', settingsDefaults.implementation.startingPoint),
        targetStandards: this.readJsonSetting<string[]>(map, 'implementation.targetStandards', [...settingsDefaults.implementation.targetStandards]),
        rolloutOwner: this.readSetting(map, 'implementation.rolloutOwner', settingsDefaults.implementation.rolloutOwner),
        certificationGoal: this.readSetting(map, 'implementation.certificationGoal', settingsDefaults.implementation.certificationGoal),
        checklist: this.readJsonSetting<typeof settingsDefaults.implementation.checklist>(
          map,
          'implementation.checklist',
          [...settingsDefaults.implementation.checklist]
        ),
        objectivePlan: this.readJsonSetting<typeof settingsDefaults.implementation.objectivePlan>(
          map,
          'implementation.objectivePlan',
          { ...settingsDefaults.implementation.objectivePlan }
        )
      }
    };
  }

  async getImplementationConfig(tenantId: string) {
    const config = await this.getConfig(tenantId);
    return config.implementation;
  }

  update(tenantId: string, key: string, value: string) {
    return this.prisma.tenantSetting.upsert({
      where: {
        tenantId_key: {
          tenantId,
          key
        }
      },
      update: { value },
      create: { tenantId, key, value }
    });
  }

  async updateSection(tenantId: string, section: string, values: Record<string, unknown>) {
    const validSections = ['organization', 'document', 'risk', 'kpi', 'notifications', 'ai', 'implementation'];
    if (!validSections.includes(section)) {
      throw new BadRequestException('Unsupported settings section');
    }

    if (section === 'organization') {
      const companyName = String(values['companyName'] ?? '').trim();
      if (!companyName) {
        throw new BadRequestException('Company name is required');
      }

      await this.prisma.tenant.update({
        where: { id: tenantId },
        data: { name: companyName }
      });
    }

    const entries = Object.entries(values).map(([key, value]) => ({
      tenantId,
      key: `${section}.${key}`,
      value: this.serialize(value)
    }));

    await Promise.all(entries.map((entry) => this.update(tenantId, entry.key, entry.value)));
    return this.getConfig(tenantId);
  }

  async listRoles(tenantId: string) {
    const roles = await this.prisma.role.findMany({
      where: { tenantId },
      include: {
        permissions: {
          include: {
            permission: true
          }
        }
      },
      orderBy: [{ isSystem: 'desc' }, { name: 'asc' }]
    });

    return roles.map((role) => {
      const permissionKeys = role.permissions.map((entry) => entry.permission.key);
      return {
        id: role.id,
        name: role.name,
        description: role.description,
        isSystem: role.isSystem,
        capabilities: {
          createRecords: roleCapabilityPermissions.createRecords.every((key) => permissionKeys.includes(key)),
          approveDocuments: permissionKeys.includes('documents.approve'),
          closeCapa: permissionKeys.includes('capa.close')
        }
      };
    });
  }

  async updateRole(tenantId: string, roleId: string, values: { createRecords: boolean; approveDocuments: boolean; closeCapa: boolean }) {
    const role = await this.prisma.role.findFirstOrThrow({
      where: { id: roleId, tenantId },
      include: {
        permissions: {
          include: { permission: true }
        }
      }
    });

    const existingPermissionKeys = role.permissions.map((entry) => entry.permission.key);
    const targetPermissionKeys = new Set(existingPermissionKeys.filter((key) => !this.isManagedCapabilityPermission(key)));

    for (const [capability, permissionKeys] of Object.entries(roleCapabilityPermissions)) {
      if (values[capability as keyof typeof values]) {
        for (const permissionKey of permissionKeys) {
          targetPermissionKeys.add(permissionKey);
        }
      }
    }

    const permissions = await this.prisma.permission.findMany({
      where: { key: { in: [...targetPermissionKeys] } }
    });

    await this.prisma.rolePermission.deleteMany({
      where: { roleId }
    });

    await this.prisma.rolePermission.createMany({
      data: permissions.map((permission) => ({
        roleId,
        permissionId: permission.id
      }))
    });

    return this.listRoles(tenantId);
  }

  private readSetting(map: Map<string, string>, key: string, fallback: string) {
    return map.get(key) ?? fallback;
  }

  private readNumberSetting(map: Map<string, string>, key: string, fallback: number) {
    const value = map.get(key);
    return value !== undefined ? Number(value) : fallback;
  }

  private readBooleanSetting(map: Map<string, string>, key: string, fallback: boolean) {
    const value = map.get(key);
    return value !== undefined ? value === 'true' : fallback;
  }

  private readJsonSetting<T>(map: Map<string, string>, key: string, fallback: T) {
    const value = map.get(key);
    if (!value) {
      return fallback;
    }

    try {
      return JSON.parse(value) as T;
    } catch {
      return fallback;
    }
  }

  private serialize(value: unknown) {
    if (Array.isArray(value) || typeof value === 'object') {
      return JSON.stringify(value);
    }

    return String(value ?? '');
  }

  private isManagedCapabilityPermission(permissionKey: string) {
    return Object.values(roleCapabilityPermissions).some((permissionKeys) =>
      (permissionKeys as readonly string[]).includes(permissionKey)
    );
  }
}
