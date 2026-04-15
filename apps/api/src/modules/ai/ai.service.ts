import { BadRequestException, Injectable, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SettingsService } from '../settings/settings.service';
import { DraftAuditFindingDto } from './dto/draft-audit-finding.dto';

type AiFeatureFlags = {
  auditFindingAssistant: boolean;
  documentDraftAssistant: boolean;
  managementReviewAssistant: boolean;
  riskSuggestionAssistant: boolean;
};

type AiTenantConfig = {
  enabled: boolean;
  provider: string;
  model: string;
  status: 'ready' | 'not_configured' | 'disabled';
  features: AiFeatureFlags;
};

type AuditFindingDraftResult = {
  provider: string;
  model: string;
  mode: 'provider' | 'template';
  title: string;
  description: string;
  suggestedSeverity: 'OBSERVATION' | 'OPPORTUNITY' | 'MINOR' | 'MAJOR';
  rationale: string;
  followUpNote: string;
  warning?: string;
};

type ProviderDraftInput = DraftAuditFindingDto & {
  tenantName?: string;
};

interface AiProviderAdapter {
  readonly id: string;
  readonly defaultModel: string;
  isConfigured(): boolean;
  draftAuditFinding(input: ProviderDraftInput): Promise<AuditFindingDraftResult>;
}

class OpenAiProviderAdapter implements AiProviderAdapter {
  readonly id = 'openai';
  readonly defaultModel: string;

  constructor(
    private readonly apiKey: string | undefined,
    model: string | undefined
  ) {
    this.defaultModel = model?.trim() || 'gpt-5-mini';
  }

  isConfigured() {
    return !!this.apiKey;
  }

  async draftAuditFinding(input: ProviderDraftInput): Promise<AuditFindingDraftResult> {
    if (!this.apiKey) {
      throw new ServiceUnavailableException('OpenAI API key is not configured.');
    }

    const systemPrompt =
      'You are assisting an ISO management system application. Return strict JSON only. Rewrite the auditor note into concise audit-ready wording. Keep the tone factual, specific, and human. Do not use generic phrases like "The audit identified a gap" unless the note itself supports that wording. Respect partial compliance or mixed implementation if the note suggests it. Never invent evidence. Severity must be one of OBSERVATION, OPPORTUNITY, MINOR, MAJOR.';

    const userPrompt = JSON.stringify({
      task: 'rewrite_audit_finding_note',
      tenantName: input.tenantName || 'Tenant',
      clause: input.clause,
      question: input.question,
      evidenceNote: input.evidenceNote,
      auditType: input.auditType || 'Internal Audit',
      standard: input.standard || 'ISO 9001',
      outputSchema: {
        title: 'string',
        description: 'string',
        suggestedSeverity: 'OBSERVATION | OPPORTUNITY | MINOR | MAJOR',
        rationale: 'string',
        followUpNote: 'string'
      }
    });

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.apiKey}`
      },
      body: JSON.stringify({
        model: this.defaultModel,
        temperature: 0.2,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ]
      })
    });

    if (!response.ok) {
      const detail = await response.text();
      throw new ServiceUnavailableException(`AI provider request failed: ${detail}`);
    }

    const payload = await response.json() as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    const content = payload.choices?.[0]?.message?.content;
    if (!content) {
      throw new ServiceUnavailableException('AI provider did not return draft content.');
    }

    const parsed = JSON.parse(content) as Omit<AuditFindingDraftResult, 'provider' | 'model' | 'mode'>;
    return {
      provider: this.id,
      model: this.defaultModel,
      mode: 'provider',
      title: parsed.title,
      description: parsed.description,
      suggestedSeverity: parsed.suggestedSeverity,
      rationale: parsed.rationale,
      followUpNote: parsed.followUpNote
    };
  }
}

@Injectable()
export class AiService {
  private readonly provider: AiProviderAdapter;

  constructor(
    private readonly configService: ConfigService,
    private readonly settingsService: SettingsService
  ) {
    this.provider = new OpenAiProviderAdapter(
      this.configService.get<string>('OPENAI_API_KEY'),
      this.configService.get<string>('AI_MODEL')
    );
  }

  async getConfig(tenantId: string): Promise<AiTenantConfig> {
    const featureConfig = await this.getTenantAiConfig(tenantId);
    const enabled = featureConfig.enabled;
    const providerConfigured = this.provider.isConfigured();

    return {
      enabled,
      provider: this.provider.id,
      model: this.provider.defaultModel,
      status: !enabled ? 'disabled' : providerConfigured ? 'ready' : 'not_configured',
      features: featureConfig.features
    };
  }

  async draftAuditFinding(tenantId: string, dto: DraftAuditFindingDto): Promise<AuditFindingDraftResult> {
    const config = await this.getConfig(tenantId);
    if (!config.enabled) {
      throw new BadRequestException('AI assistance is disabled for this tenant.');
    }
    if (!config.features.auditFindingAssistant) {
      throw new BadRequestException('Audit finding assistant is disabled for this tenant.');
    }

    const tenantConfig = await this.settingsService.getConfig(tenantId);
    if (this.provider.isConfigured()) {
      return this.provider.draftAuditFinding({
        ...dto,
        tenantName: tenantConfig.organization.companyName
      });
    }

    return this.buildTemplateFindingDraft(dto);
  }

  private async getTenantAiConfig(tenantId: string) {
    const config = await this.settingsService.getConfig(tenantId);
    return config.ai;
  }

  private buildTemplateFindingDraft(dto: DraftAuditFindingDto): AuditFindingDraftResult {
    const normalizedEvidence = dto.evidenceNote.trim();
    const severity = this.estimateSeverity(normalizedEvidence);
    const title = `${dto.clause} gap`;
    const description = this.normalizeDescription(normalizedEvidence);

    return {
      provider: 'template',
      model: 'local-guidance',
      mode: 'template',
      title,
      description,
      suggestedSeverity: severity,
      rationale: this.templateRationale(severity, normalizedEvidence),
      followUpNote:
        severity === 'MAJOR'
          ? 'Major findings should normally move into CAPA before closure.'
          : severity === 'MINOR'
            ? 'Minor findings usually need either corrective follow-up or strong evidence before closure.'
            : severity === 'OPPORTUNITY'
              ? 'Opportunities for improvement can usually be tracked with a lighter audit action when follow-up is wanted.'
            : 'Observation can stay visible without formal CAPA when the issue is low impact and already controlled.',
      warning: "AI provider is not configured yet, so this draft uses the app's built-in fallback guidance."
    };
  }

  private estimateSeverity(evidence: string): 'OBSERVATION' | 'OPPORTUNITY' | 'MINOR' | 'MAJOR' {
    const lower = evidence.toLowerCase();
    if (
      lower.includes('opportunity') ||
      lower.includes('improve') ||
      lower.includes('improvement') ||
      lower.includes('could be strengthened') ||
      lower.includes('would benefit')
    ) {
      return 'OPPORTUNITY';
    }
    if (
      lower.includes('systemic') ||
      lower.includes('critical') ||
      lower.includes('legal') ||
      lower.includes('regulatory') ||
      lower.includes('multiple') ||
      lower.includes('not implemented')
    ) {
      return 'MAJOR';
    }
    if (
      lower.includes('missing') ||
      lower.includes('not available') ||
      lower.includes('incomplete') ||
      lower.includes('overdue') ||
      lower.includes('not followed')
    ) {
      return 'MINOR';
    }
    return 'OBSERVATION';
  }

  private templateRationale(
    severity: 'OBSERVATION' | 'OPPORTUNITY' | 'MINOR' | 'MAJOR',
    evidence: string
  ) {
    if (severity === 'MAJOR') {
      return `The note suggests a wider or more critical control weakness: "${evidence}". Review whether formal CAPA and deeper corrective action are required.`;
    }
    if (severity === 'MINOR') {
      return `The note suggests a clear gap that still appears limited in scope: "${evidence}". A lighter corrective route may be enough if evidence supports it.`;
    }
    if (severity === 'OPPORTUNITY') {
      return `The note reads more like an improvement opportunity than a nonconformity: "${evidence}". Consider a lighter action if the improvement should be tracked.`;
    }
    return `The note reads more like a visible weakness or improvement point than a fully developed nonconformity: "${evidence}".`;
  }

  private normalizeDescription(note: string) {
    const trimmed = note.trim();
    if (!trimmed) {
      return '';
    }

    return /[.!?]$/.test(trimmed) ? trimmed : `${trimmed}.`;
  }
}
