export type TenantAddOnKey = 'aiAssistant' | 'customerFeedback';

export type TenantAddOns = Record<TenantAddOnKey, boolean>;

export const DEFAULT_TENANT_ADD_ONS: TenantAddOns = {
  aiAssistant: true,
  customerFeedback: true
};

export function normalizeTenantAddOns(value: unknown): TenantAddOns {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return { ...DEFAULT_TENANT_ADD_ONS };
  }

  const source = value as Partial<Record<TenantAddOnKey, unknown>>;
  return {
    aiAssistant:
      typeof source.aiAssistant === 'boolean' ? source.aiAssistant : DEFAULT_TENANT_ADD_ONS.aiAssistant,
    customerFeedback:
      typeof source.customerFeedback === 'boolean'
        ? source.customerFeedback
        : DEFAULT_TENANT_ADD_ONS.customerFeedback
  };
}

