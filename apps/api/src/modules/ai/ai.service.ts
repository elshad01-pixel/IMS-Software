import { BadRequestException, Injectable, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { KpiDirection } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';
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

type ProcedureChecklistQuestion = {
  clause: string;
  subclause?: string;
  title: string;
};

type ProcedureChecklistDraftInput = {
  tenantName?: string;
  standard?: string;
  process: {
    id: string;
    name: string;
    purpose?: string | null;
    department?: string | null;
    scope?: string | null;
    inputsText?: string | null;
    outputsText?: string | null;
  };
  procedure: {
    id: string;
    code: string;
    title: string;
    type: string;
    summary?: string | null;
    changeSummary?: string | null;
    status: string;
    version: number;
    revision: number;
  };
  procedureContent?: string;
};

type ProcedureChecklistDraftResult = {
  provider: string;
  model: string;
  mode: 'provider' | 'template';
  checklistTitle: string;
  rationale: string;
  questions: ProcedureChecklistQuestion[];
  warning?: string;
};

type ManagementReviewInputSections = {
  auditResults: string;
  capaStatus: string;
  kpiPerformance: string;
  customerInterestedPartiesFeedback: string;
  providerPerformance: string;
  complianceObligations: string;
  incidentEmergencyPerformance: string;
  consultationCommunication: string;
  risksOpportunities: string;
  changesAffectingSystem: string;
  previousActions: string;
};

type ManagementReviewInputDraftResult = {
  provider: string;
  model: string;
  mode: 'provider' | 'template';
  sections: ManagementReviewInputSections;
  warning?: string;
};

type ManagementReviewSourceSnapshot = {
  audit: {
    total: number;
    inProgress: number;
    checklistCompleted: number;
    completed: number;
    openFindings: number;
    capaLinkedFindings: number;
    recentAudits: string[];
    recentFindings: string[];
  };
  capa: {
    total: number;
    open: number;
    overdue: number;
    recent: string[];
  };
  kpi: {
    total: number;
    onTarget: number;
    watch: number;
    breach: number;
    recent: string[];
  };
  feedback: {
    customerNcrs: number;
    complaintNcrs: number;
    surveyResponses: number;
    surveyAverage: number | null;
    lowScoreCount: number;
    mediumScoreCount: number;
    highScoreCount: number;
    interestedParties: number;
    needs: number;
    recent: string[];
    recentComments: string[];
  };
  provider: {
    total: number;
    underReview: number;
    conditional: number;
    escalated: number;
    recent: string[];
  };
  compliance: {
    total: number;
    underReview: number;
    overdue: number;
    recent: string[];
  };
  incidentPerformance: {
    openIncidents: number;
    criticalIncidents: number;
    recent: string[];
  };
  consultation: {
    interestedParties: number;
    needs: number;
    openContextIssues: number;
    recent: string[];
  };
  riskOpportunity: {
    totalRisks: number;
    totalOpportunities: number;
    openHighRisks: number;
    activeHighHazards: number;
    significantAspects: number;
    recent: string[];
  };
  changes: {
    active: number;
    overdueReviews: number;
    recent: string[];
  };
  previousActions: {
    previousReviews: number;
    openManagementActions: number;
    recentReviews: string[];
    recentActions: string[];
  };
};

type ProviderDraftInput = DraftAuditFindingDto & {
  tenantName?: string;
};

type ManagementReviewDraftInput = {
  tenantName?: string;
  sourceSnapshot: ManagementReviewSourceSnapshot;
};

interface AiProviderAdapter {
  readonly id: string;
  readonly defaultModel: string;
  isConfigured(): boolean;
  draftAuditFinding(input: ProviderDraftInput): Promise<AuditFindingDraftResult>;
  draftManagementReviewInputs(input: ManagementReviewDraftInput): Promise<ManagementReviewInputDraftResult>;
  draftProcedureChecklist(
    input: ProcedureChecklistDraftInput
  ): Promise<ProcedureChecklistDraftResult>;
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

    const systemPrompt = [
      'You are assisting an ISO management system application.',
      'Return strict JSON only.',
      'Rewrite the auditor note into concise audit-ready wording that still sounds like a human auditor, not a generic AI summary.',
      'Use only the evidence provided by the user. Never invent missing facts, missing documents, missing interviews, or wider systemic impact unless the note says so.',
      'If the note suggests partial compliance, mixed practice, informal control, or inconsistent implementation, keep that nuance. Do not rewrite it as full noncompliance.',
      'Avoid stock phrases such as "The audit identified", "It was observed that", "Requirement reviewed", or "Objective evidence noted" unless the user wording clearly supports them.',
      'Prefer plain operational wording such as "Role descriptions partly define authority..." or "Supplier review records were overdue...".',
      'Write a short title in natural language, ideally under 10 words.',
      'Write the description as 1 or 2 short sentences only.',
      'Keep the rationale to 1 sentence explaining why the suggested severity fits the evidence.',
      'Keep the follow-up note practical and brief, focused on the next sensible action.',
      'Severity must be one of OBSERVATION, OPPORTUNITY, MINOR, MAJOR.'
    ].join(' ');

    const userPrompt = JSON.stringify({
      task: 'rewrite_audit_finding_note',
      tenantName: input.tenantName || 'Tenant',
      clause: input.clause,
      question: input.question,
      evidenceNote: input.evidenceNote,
      auditType: input.auditType || 'Internal Audit',
      standard: input.standard || 'ISO 9001',
      styleGuide: {
        audience: 'internal auditor preparing a finding draft for review before saving',
        title: 'plain language, short, no quotation marks, no clause prefix unless useful',
        description: '1-2 short sentences, factual, preserve the user note meaning, no generic audit boilerplate',
        rationale: '1 sentence, explain why the selected severity matches the evidence',
        followUpNote: '1-2 short sentences, practical next step, no long action plan'
      },
      outputSchema: {
        title: 'string',
        description: 'string',
        suggestedSeverity: 'OBSERVATION | OPPORTUNITY | MINOR | MAJOR',
        rationale: 'string',
        followUpNote: 'string'
      }
    });

    const payload = await this.callJsonModel({
      model: this.defaultModel,
      systemPrompt,
      userPrompt
    });

    const parsed = payload as Omit<AuditFindingDraftResult, 'provider' | 'model' | 'mode'>;
    const suggestedSeverity = this.normalizeSeverity(parsed.suggestedSeverity);
    return {
      provider: this.id,
      model: this.defaultModel,
      mode: 'provider',
      title: this.normalizeTitle(parsed.title, input),
      description: this.normalizeDescription(parsed.description || input.evidenceNote),
      suggestedSeverity,
      rationale: this.normalizeSentence(
        parsed.rationale,
        this.fallbackRationale(suggestedSeverity, input.evidenceNote)
      ),
      followUpNote: this.normalizeSentence(
        parsed.followUpNote,
        this.fallbackFollowUpNote(suggestedSeverity)
      )
    };
  }

  async draftManagementReviewInputs(
    input: ManagementReviewDraftInput
  ): Promise<ManagementReviewInputDraftResult> {
    if (!this.apiKey) {
      throw new ServiceUnavailableException('OpenAI API key is not configured.');
    }

    const systemPrompt = [
      'You are assisting an ISO management system application.',
      'Return strict JSON only.',
      'Draft management review input sections from the supplied live record snapshot.',
      'Use only the supplied data. Never invent audits, complaints, legal issues, improvement results, or performance trends that are not present in the snapshot.',
      'Write for management review, not for marketing and not for AI demonstration.',
      'Each section should be concise, practical, and editable by a manager before saving.',
      'Use 1 to 3 short sentences per section.',
      'Keep nuance. If performance is mixed, say it is mixed. If records are thin, say records are limited or no structured record is available.',
      'Avoid filler such as "The organization demonstrates" or "Based on the information provided" unless absolutely necessary.',
      'Do not use bullet lists. Return a plain string for each section.'
    ].join(' ');

    const userPrompt = JSON.stringify({
      task: 'draft_management_review_inputs',
      tenantName: input.tenantName || 'Tenant',
      sourceSnapshot: input.sourceSnapshot,
      styleGuide: {
        audience: 'management review meeting owner preparing the input sections',
        tone: 'factual, operational, concise',
        sectionLength: '1-3 short sentences per section',
        missingDataRule: 'say when structured evidence is limited instead of inventing it'
      },
      outputSchema: {
        sections: {
          auditResults: 'string',
          capaStatus: 'string',
          kpiPerformance: 'string',
          customerInterestedPartiesFeedback: 'string',
          providerPerformance: 'string',
          complianceObligations: 'string',
          incidentEmergencyPerformance: 'string',
          consultationCommunication: 'string',
          risksOpportunities: 'string',
          changesAffectingSystem: 'string',
          previousActions: 'string'
        }
      }
    });

    const payload = await this.callJsonModel({
      model: this.defaultModel,
      systemPrompt,
      userPrompt
    });

    const parsed = payload as { sections?: Partial<ManagementReviewInputSections> } & Partial<ManagementReviewInputSections>;
    const sections = this.normalizeManagementReviewSections(parsed.sections ?? parsed, input.sourceSnapshot);

    return {
      provider: this.id,
      model: this.defaultModel,
      mode: 'provider',
      sections
    };
  }

  async draftProcedureChecklist(
    input: ProcedureChecklistDraftInput
  ): Promise<ProcedureChecklistDraftResult> {
    if (!this.apiKey) {
      throw new ServiceUnavailableException('OpenAI API key is not configured.');
    }

    const systemPrompt = [
      'You are assisting an ISO management system application.',
      'Return strict JSON only.',
      'Draft a procedure-specific internal audit checklist using the supplied process metadata, document metadata, and extracted procedure content when available.',
      'Do not invent procedure steps, records, approval paths, or control points that are not reasonably supported by the provided material.',
      'When procedure content is limited, write focused audit questions around responsibilities, inputs, outputs, records, interfaces, approvals, execution control, monitoring, and evidence.',
      'Keep each question short, practical, and suitable for an internal auditor.',
      'Return between 10 and 14 questions.',
      'Use only these clause groups: Procedure Setup, Operational Control, Records and Evidence, Monitoring and Follow-up.',
      'For subclause, use short labels such as Ownership, Inputs, Outputs, Approval, Execution, Records, Monitoring, Exceptions, Training, Interfaces.',
      'Do not use bullets inside the question text.'
    ].join(' ');

    const userPrompt = JSON.stringify({
      task: 'draft_procedure_audit_checklist',
      tenantName: input.tenantName || 'Tenant',
      standard: input.standard || 'Procedure-focused internal audit',
      process: input.process,
      procedure: input.procedure,
      procedureContentExcerpt: input.procedureContent || 'No extracted procedure file content was available.',
      outputSchema: {
        checklistTitle: 'string',
        rationale: 'string',
        questions: [
          {
            clause:
              'Procedure Setup | Operational Control | Records and Evidence | Monitoring and Follow-up',
            subclause: 'string',
            title: 'string'
          }
        ]
      }
    });

    const payload = await this.callJsonModel({
      model: this.defaultModel,
      systemPrompt,
      userPrompt
    });

    const parsed = payload as Omit<ProcedureChecklistDraftResult, 'provider' | 'model' | 'mode'>;
    return {
      provider: this.id,
      model: this.defaultModel,
      mode: 'provider',
      checklistTitle: this.cleanText(parsed.checklistTitle) || `${input.procedure.title} audit checklist`,
      rationale: this.ensureSentence(
        this.cleanText(parsed.rationale) ||
          `Checklist drafted from the selected process and controlled procedure metadata for ${input.procedure.title}.`
      ),
      questions: this.normalizeProcedureQuestions(parsed.questions, input)
    };
  }

  private async callJsonModel(input: { model: string; systemPrompt: string; userPrompt: string }) {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.apiKey}`
      },
      body: JSON.stringify({
        model: input.model,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: input.systemPrompt },
          { role: 'user', content: input.userPrompt }
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

    return JSON.parse(content) as Record<string, unknown>;
  }

  private normalizeSeverity(value: string | undefined): AuditFindingDraftResult['suggestedSeverity'] {
    if (value === 'OBSERVATION' || value === 'OPPORTUNITY' || value === 'MINOR' || value === 'MAJOR') {
      return value;
    }

    return 'OBSERVATION';
  }

  private normalizeTitle(value: string | undefined, input: ProviderDraftInput) {
    const cleaned = this.cleanText(value)
      .replace(/^finding:\s*/i, '')
      .replace(/^clause\s+[0-9a-z.\-]+\s*[-:]\s*/i, '')
      .trim();

    if (cleaned) {
      return cleaned.length > 120 ? `${cleaned.slice(0, 117).trim()}...` : cleaned;
    }

    return `${input.clause} gap`;
  }

  private normalizeSentence(value: string | undefined, fallback: string) {
    const cleaned = this.cleanText(value);
    return this.ensureSentence(cleaned || fallback);
  }

  private normalizeDescription(value: string | undefined) {
    const cleaned = this.cleanText(value);
    if (!cleaned) {
      return '';
    }

    const normalized = this.ensureSentence(cleaned);
    return normalized.length > 420 ? `${normalized.slice(0, 417).trim()}...` : normalized;
  }

  private normalizeManagementReviewSections(
    sections: Partial<ManagementReviewInputSections>,
    snapshot: ManagementReviewSourceSnapshot
  ): ManagementReviewInputSections {
    return {
      auditResults: this.normalizeManagementSection(
        sections.auditResults,
        `There are ${snapshot.audit.total} audit records, with ${snapshot.audit.openFindings} open findings still visible in the audit trail. ${snapshot.audit.recentAudits[0] ? `Recent audit position: ${snapshot.audit.recentAudits[0]}` : 'Recent audit detail is limited in the current snapshot.'}`
      ),
      capaStatus: this.normalizeManagementSection(
        sections.capaStatus,
        `There are ${snapshot.capa.open} CAPA records still open, including ${snapshot.capa.overdue} overdue items. ${snapshot.capa.recent[0] ? `Recent CAPA position: ${snapshot.capa.recent[0]}` : 'Detailed CAPA narrative should be confirmed in the register.'}`
      ),
      kpiPerformance: this.normalizeManagementSection(
        sections.kpiPerformance,
        `The KPI register currently shows ${snapshot.kpi.breach} KPI breaches and ${snapshot.kpi.watch} KPI items on watch out of ${snapshot.kpi.total} tracked KPIs. ${snapshot.kpi.recent[0] ? `Current KPI signal: ${snapshot.kpi.recent[0]}` : 'Detailed KPI commentary should be added from the live register.'}`
      ),
      customerInterestedPartiesFeedback: this.normalizeManagementSection(
        sections.customerInterestedPartiesFeedback,
        `Customer feedback currently includes ${snapshot.feedback.surveyResponses} completed survey response${snapshot.feedback.surveyResponses === 1 ? '' : 's'} with an average score of ${snapshot.feedback.surveyAverage != null ? `${snapshot.feedback.surveyAverage}/10` : 'no recorded average'} on the 0-10 scale, alongside ${snapshot.feedback.customerNcrs} customer-sourced NCR records and ${snapshot.feedback.complaintNcrs} complaint records. ${snapshot.feedback.recentComments[0] ? `Recent comment theme: ${snapshot.feedback.recentComments[0]}` : snapshot.feedback.recent[0] ? `Recent feedback signal: ${snapshot.feedback.recent[0]}` : 'No strong recent structured feedback theme was found in the current snapshot.'}`
      ),
      providerPerformance: this.normalizeManagementSection(
        sections.providerPerformance,
        `The provider register shows ${snapshot.provider.underReview} providers under review, ${snapshot.provider.conditional} conditional providers, and ${snapshot.provider.escalated} escalated evaluations. ${snapshot.provider.recent[0] ? `Current provider signal: ${snapshot.provider.recent[0]}` : 'No current provider escalation summary was found in the snapshot.'}`
      ),
      complianceObligations: this.normalizeManagementSection(
        sections.complianceObligations,
        `The compliance obligation register shows ${snapshot.compliance.underReview} items under review and ${snapshot.compliance.overdue} overdue review dates. ${snapshot.compliance.recent[0] ? `Current compliance signal: ${snapshot.compliance.recent[0]}` : 'Detailed compliance commentary should be added from the live obligation register.'}`
      ),
      incidentEmergencyPerformance: this.normalizeManagementSection(
        sections.incidentEmergencyPerformance,
        `There are ${snapshot.incidentPerformance.openIncidents} open incidents in the current record set, including ${snapshot.incidentPerformance.criticalIncidents} critical incidents. ${snapshot.incidentPerformance.recent[0] ? `A recent incident signal is ${snapshot.incidentPerformance.recent[0]}` : 'Recent incident themes should be confirmed from the live incident register.'}`
      ),
      consultationCommunication: this.normalizeManagementSection(
        sections.consultationCommunication,
        `Structured consultation and communication evidence is currently represented by ${snapshot.consultation.interestedParties} interested parties, ${snapshot.consultation.needs} recorded needs or expectations, and ${snapshot.consultation.openContextIssues} open context issues. ${snapshot.consultation.recent[0] ? `Current communication signal: ${snapshot.consultation.recent[0]}` : 'If additional worker consultation evidence exists outside the app, it should be added manually.'}`
      ),
      risksOpportunities: this.normalizeManagementSection(
        sections.risksOpportunities,
        `The current registers show ${snapshot.riskOpportunity.openHighRisks} high-priority open risks, ${snapshot.riskOpportunity.totalOpportunities} opportunity records, ${snapshot.riskOpportunity.activeHighHazards} active high hazards, and ${snapshot.riskOpportunity.significantAspects} significant environmental aspects. ${snapshot.riskOpportunity.recent[0] ? `Recent risk or opportunity signal: ${snapshot.riskOpportunity.recent[0]}` : 'Detailed risk commentary should be confirmed in the live registers.'}`
      ),
      changesAffectingSystem: this.normalizeManagementSection(
        sections.changesAffectingSystem,
        `There are ${snapshot.changes.active} active change requests affecting the management system, with ${snapshot.changes.overdueReviews} review dates now past. ${snapshot.changes.recent[0] ? `Current change signal: ${snapshot.changes.recent[0]}` : 'No recent change summary was found in the current snapshot.'}`
      ),
      previousActions: this.normalizeManagementSection(
        sections.previousActions,
        `There are ${snapshot.previousActions.openManagementActions} open follow-up actions linked to management review records. ${snapshot.previousActions.recentReviews[0] ? `Most recent review context: ${snapshot.previousActions.recentReviews[0]}` : 'No earlier management review record was found for comparison.'}`
      )
    };
  }

  private normalizeManagementSection(value: string | undefined, fallback: string) {
    const cleaned = this.cleanText(value || fallback);
    if (!cleaned) {
      return '';
    }

    return this.ensureSentence(cleaned.length > 900 ? `${cleaned.slice(0, 897).trim()}...` : cleaned);
  }

  private cleanText(value: string | undefined) {
    return (value || '')
      .trim()
      .replace(/^["'`]+|["'`]+$/g, '')
      .replace(/\s+/g, ' ');
  }

  private ensureSentence(value: string) {
    const trimmed = value.trim();
    if (!trimmed) {
      return '';
    }

    return /[.!?]$/.test(trimmed) ? trimmed : `${trimmed}.`;
  }

  private fallbackRationale(
    severity: AuditFindingDraftResult['suggestedSeverity'],
    evidenceNote: string
  ) {
    if (severity === 'MAJOR') {
      return `Suggested as major because the note indicates a wider or more critical control weakness: ${this.cleanText(evidenceNote)}`;
    }
    if (severity === 'MINOR') {
      return `Suggested as minor because the note indicates a clear gap that still appears limited in scope: ${this.cleanText(evidenceNote)}`;
    }
    if (severity === 'OPPORTUNITY') {
      return `Suggested as an opportunity because the note reads more like an improvement point than a direct nonconformity: ${this.cleanText(evidenceNote)}`;
    }

    return `Suggested as an observation because the note shows a concern that should stay visible without overstating the severity: ${this.cleanText(evidenceNote)}`;
  }

  private fallbackFollowUpNote(severity: AuditFindingDraftResult['suggestedSeverity']) {
    if (severity === 'MAJOR' || severity === 'MINOR') {
      return 'Clarify the control gap, assign corrective action, and verify completion before closure.';
    }
    if (severity === 'OPPORTUNITY') {
      return 'Consider a targeted improvement action if the team wants to track the change formally.';
    }

    return 'Keep the point visible and decide whether light follow-up is needed.';
  }

  private normalizeProcedureQuestions(
    value: unknown,
    input: ProcedureChecklistDraftInput
  ): ProcedureChecklistQuestion[] {
    const fallback: ProcedureChecklistQuestion[] = [
      {
        clause: 'Procedure Setup',
        subclause: 'Ownership',
        title: `Are ownership, responsibilities, and authority clear for ${input.process.name} and the ${input.procedure.title}?`
      },
      {
        clause: 'Operational Control',
        subclause: 'Execution',
        title: `Is the procedure being followed in practice for normal ${input.process.name.toLowerCase()} activities?`
      },
      {
        clause: 'Records and Evidence',
        subclause: 'Records',
        title: `Are the records required by ${input.procedure.title} complete, current, and retrievable?`
      },
      {
        clause: 'Monitoring and Follow-up',
        subclause: 'Monitoring',
        title: `Are performance and deviations monitored well enough to show whether ${input.procedure.title} is effective?`
      }
    ];

    if (!Array.isArray(value)) {
      return fallback;
    }

    const normalized = value
      .map((item) => {
        const row = item as Record<string, unknown>;
        const title = this.cleanText(String(row['title'] || ''));
        if (!title) {
          return null;
        }

        const question: ProcedureChecklistQuestion = {
          clause: this.normalizeProcedureClause(String(row['clause'] || '')),
          title: title.slice(0, 200)
        };
        const subclause = this.cleanText(String(row['subclause'] || ''));
        if (subclause) {
          question.subclause = subclause;
        }
        return question;
      })
      .filter((item): item is ProcedureChecklistQuestion => item !== null);

    return normalized.length >= 8 ? normalized.slice(0, 14) : fallback;
  }

  private normalizeProcedureClause(value: string) {
    const normalized = this.cleanText(value).toLowerCase();
    if (normalized.includes('operat')) return 'Operational Control';
    if (normalized.includes('record') || normalized.includes('evidence')) return 'Records and Evidence';
    if (normalized.includes('monitor') || normalized.includes('follow')) return 'Monitoring and Follow-up';
    return 'Procedure Setup';
  }
}

@Injectable()
export class AiService {
  private readonly provider: AiProviderAdapter;

  constructor(
    private readonly configService: ConfigService,
    private readonly settingsService: SettingsService,
    private readonly prisma: PrismaService
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

  async draftManagementReviewInputs(tenantId: string): Promise<ManagementReviewInputDraftResult> {
    const config = await this.getConfig(tenantId);
    if (!config.enabled) {
      throw new BadRequestException('AI assistance is disabled for this tenant.');
    }
    if (!config.features.managementReviewAssistant) {
      throw new BadRequestException('Management review assistant is disabled for this tenant.');
    }

    const tenantConfig = await this.settingsService.getConfig(tenantId);
    const sourceSnapshot = await this.buildManagementReviewSourceSnapshot(tenantId);

    if (this.provider.isConfigured()) {
      return this.provider.draftManagementReviewInputs({
        tenantName: tenantConfig.organization.companyName,
        sourceSnapshot
      });
    }

    return this.buildTemplateManagementReviewDraft(sourceSnapshot);
  }

  async draftProcedureChecklist(
    tenantId: string,
    input: ProcedureChecklistDraftInput
  ): Promise<ProcedureChecklistDraftResult> {
    const config = await this.getConfig(tenantId);
    if (!config.enabled) {
      throw new BadRequestException('AI assistance is disabled for this tenant.');
    }
    if (!config.features.auditFindingAssistant) {
      throw new BadRequestException('Audit AI assistance is disabled for this tenant.');
    }

    const tenantConfig = await this.settingsService.getConfig(tenantId);
    if (this.provider.isConfigured()) {
      return this.provider.draftProcedureChecklist({
        ...input,
        tenantName: tenantConfig.organization.companyName
      });
    }

    return this.buildTemplateProcedureChecklist(input);
  }

  private async getTenantAiConfig(tenantId: string) {
    const config = await this.settingsService.getConfig(tenantId);
    return config.ai;
  }

  private async buildManagementReviewSourceSnapshot(tenantId: string): Promise<ManagementReviewSourceSnapshot> {
    const now = new Date();

    const [
      audits,
      auditFindings,
      capas,
      kpis,
      ncrs,
      customerSurveyRequests,
      interestedParties,
      needs,
      providers,
      obligations,
      incidents,
      risks,
      hazards,
      aspects,
      changes,
      previousReviews,
      managementActions,
      contextIssues
    ] = await Promise.all([
      this.prisma.audit.findMany({
        where: { tenantId, deletedAt: null },
        orderBy: { updatedAt: 'desc' },
        select: {
          title: true,
          status: true,
          standard: true,
          summary: true
        }
      }),
      this.prisma.auditFinding.findMany({
        where: { tenantId },
        orderBy: { updatedAt: 'desc' },
        select: {
          title: true,
          severity: true,
          status: true
        }
      }),
      this.prisma.capa.findMany({
        where: { tenantId, deletedAt: null },
        orderBy: [{ dueDate: 'asc' }, { updatedAt: 'desc' }],
        select: {
          title: true,
          status: true,
          dueDate: true
        }
      }),
      this.prisma.kpi.findMany({
        where: { tenantId },
        orderBy: { updatedAt: 'desc' },
        select: {
          name: true,
          actual: true,
          target: true,
          warningThreshold: true,
          direction: true,
          unit: true
        }
      }),
      this.prisma.ncr.findMany({
        where: { tenantId, deletedAt: null },
        orderBy: { updatedAt: 'desc' },
        select: {
          title: true,
          source: true,
          category: true,
          status: true,
          severity: true
        }
      }),
      this.prisma.customerSurveyRequest.findMany({
        where: { tenantId },
        orderBy: [{ completedAt: 'desc' }, { updatedAt: 'desc' }],
        select: {
          title: true,
          status: true,
          averageScore: true,
          comments: true,
          whatWorkedWell: true,
          improvementPriority: true
        }
      }),
      this.prisma.interestedParty.findMany({
        where: { tenantId, deletedAt: null },
        orderBy: { updatedAt: 'desc' },
        select: { name: true, type: true }
      }),
      this.prisma.needExpectation.findMany({
        where: { tenantId, deletedAt: null },
        orderBy: { updatedAt: 'desc' },
        select: { description: true }
      }),
      this.prisma.externalProviderControl.findMany({
        where: { tenantId, deletedAt: null },
        orderBy: [{ nextReviewDate: 'asc' }, { updatedAt: 'desc' }],
        select: {
          providerName: true,
          status: true,
          evaluationOutcome: true
        }
      }),
      this.prisma.complianceObligation.findMany({
        where: { tenantId, deletedAt: null },
        orderBy: [{ nextReviewDate: 'asc' }, { updatedAt: 'desc' }],
        select: {
          title: true,
          status: true,
          nextReviewDate: true
        }
      }),
      this.prisma.incident.findMany({
        where: { tenantId, deletedAt: null },
        orderBy: { updatedAt: 'desc' },
        select: {
          title: true,
          type: true,
          severity: true,
          status: true
        }
      }),
      this.prisma.risk.findMany({
        where: { tenantId, deletedAt: null },
        orderBy: [{ score: 'desc' }, { updatedAt: 'desc' }],
        select: {
          title: true,
          assessmentType: true,
          score: true,
          residualScore: true,
          status: true
        }
      }),
      this.prisma.hazardIdentification.findMany({
        where: { tenantId, deletedAt: null },
        orderBy: { updatedAt: 'desc' },
        select: {
          activity: true,
          hazard: true,
          severity: true,
          status: true
        }
      }),
      this.prisma.environmentalAspect.findMany({
        where: { tenantId, deletedAt: null },
        orderBy: { updatedAt: 'desc' },
        select: {
          activity: true,
          aspect: true,
          significance: true,
          status: true
        }
      }),
      this.prisma.changeRequest.findMany({
        where: { tenantId, deletedAt: null },
        orderBy: [{ reviewDate: 'asc' }, { updatedAt: 'desc' }],
        select: {
          title: true,
          status: true,
          reviewDate: true,
          changeType: true
        }
      }),
      this.prisma.managementReview.findMany({
        where: { tenantId, deletedAt: null },
        orderBy: [{ reviewDate: 'desc' }, { updatedAt: 'desc' }],
        take: 3,
        select: {
          title: true,
          reviewDate: true,
          status: true,
          summary: true
        }
      }),
      this.prisma.actionItem.findMany({
        where: { tenantId, sourceType: 'management-review' },
        orderBy: [{ dueDate: 'asc' }, { updatedAt: 'desc' }],
        select: {
          title: true,
          status: true,
          dueDate: true
        }
      }),
      this.prisma.contextIssue.findMany({
        where: { tenantId, deletedAt: null },
        orderBy: { updatedAt: 'desc' },
        select: {
          title: true,
          status: true,
          type: true
        }
      })
    ]);

    const kpiWithStatus = kpis.map((item) => ({
      ...item,
      status: this.getKpiStatus(item.actual, item.target, item.warningThreshold, item.direction)
    }));
    const completedSurveyResponses = customerSurveyRequests.filter(
      (item) => item.status === 'COMPLETED' && item.averageScore !== null
    );
    const surveyAverage = completedSurveyResponses.length
      ? Number(
          (
            completedSurveyResponses.reduce((sum, item) => sum + (item.averageScore ?? 0), 0) /
            completedSurveyResponses.length
          ).toFixed(2)
        )
      : null;

    return {
      audit: {
        total: audits.length,
        inProgress: audits.filter((item) => item.status === 'IN_PROGRESS').length,
        checklistCompleted: audits.filter((item) => item.status === 'CHECKLIST_COMPLETED').length,
        completed: audits.filter((item) => item.status === 'COMPLETED' || item.status === 'CLOSED').length,
        openFindings: auditFindings.filter((item) => item.status === 'OPEN').length,
        capaLinkedFindings: auditFindings.filter((item) => item.status === 'CAPA_CREATED').length,
        recentAudits: audits.slice(0, 4).map((item) =>
          `${item.title} (${item.status}${item.standard ? `, ${item.standard}` : ''}${item.summary ? `, ${item.summary}` : ''})`
        ),
        recentFindings: auditFindings.slice(0, 4).map((item) =>
          `${item.title} (${item.severity}, ${item.status})`
        )
      },
      capa: {
        total: capas.length,
        open: capas.filter((item) => item.status !== 'CLOSED').length,
        overdue: capas.filter((item) => item.status !== 'CLOSED' && !!item.dueDate && item.dueDate < now).length,
        recent: capas.slice(0, 4).map((item) =>
          `${item.title} (${item.status}${item.dueDate ? `, due ${this.formatDate(item.dueDate)}` : ''})`
        )
      },
      kpi: {
        total: kpiWithStatus.length,
        onTarget: kpiWithStatus.filter((item) => item.status === 'ON_TARGET').length,
        watch: kpiWithStatus.filter((item) => item.status === 'WATCH').length,
        breach: kpiWithStatus.filter((item) => item.status === 'BREACH').length,
        recent: kpiWithStatus.slice(0, 5).map((item) =>
          `${item.name} (${item.actual}${item.unit} vs ${item.target}${item.unit}, ${item.status})`
        )
      },
      feedback: {
        customerNcrs: ncrs.filter((item) => item.source === 'CUSTOMER').length,
        complaintNcrs: ncrs.filter((item) => item.category === 'COMPLAINT').length,
        surveyResponses: completedSurveyResponses.length,
        surveyAverage,
        lowScoreCount: completedSurveyResponses.filter((item) => (item.averageScore ?? 0) <= 6).length,
        mediumScoreCount: completedSurveyResponses.filter((item) => {
          const score = item.averageScore ?? 0;
          return score >= 7 && score <= 8;
        }).length,
        highScoreCount: completedSurveyResponses.filter((item) => (item.averageScore ?? 0) >= 9).length,
        interestedParties: interestedParties.length,
        needs: needs.length,
        recent: ncrs
          .filter((item) => item.source === 'CUSTOMER' || item.category === 'COMPLAINT')
          .slice(0, 4)
          .map((item) => `${item.title} (${item.status}, ${item.severity})`),
        recentComments: completedSurveyResponses
          .flatMap((item) => [item.improvementPriority, item.whatWorkedWell, item.comments])
          .filter((value): value is string => Boolean(value?.trim()))
          .slice(0, 4)
      },
      provider: {
        total: providers.length,
        underReview: providers.filter((item) => item.status === 'UNDER_REVIEW').length,
        conditional: providers.filter((item) => item.status === 'CONDITIONAL').length,
        escalated: providers.filter((item) => item.evaluationOutcome === 'ESCALATED' || item.evaluationOutcome === 'DISQUALIFIED').length,
        recent: providers.slice(0, 4).map((item) =>
          `${item.providerName} (${item.status}${item.evaluationOutcome ? `, ${item.evaluationOutcome}` : ''})`
        )
      },
      compliance: {
        total: obligations.length,
        underReview: obligations.filter((item) => item.status === 'UNDER_REVIEW').length,
        overdue: obligations.filter((item) => !!item.nextReviewDate && item.nextReviewDate < now).length,
        recent: obligations.slice(0, 4).map((item) =>
          `${item.title} (${item.status}${item.nextReviewDate ? `, review ${this.formatDate(item.nextReviewDate)}` : ''})`
        )
      },
      incidentPerformance: {
        openIncidents: incidents.filter((item) => item.status !== 'CLOSED' && item.status !== 'ARCHIVED').length,
        criticalIncidents: incidents.filter((item) => item.status !== 'CLOSED' && item.status !== 'ARCHIVED' && item.severity === 'CRITICAL').length,
        recent: incidents.slice(0, 4).map((item) =>
          `${item.title} (${item.type}, ${item.severity}, ${item.status})`
        )
      },
      consultation: {
        interestedParties: interestedParties.length,
        needs: needs.length,
        openContextIssues: contextIssues.filter((item) => item.status === 'OPEN' || item.status === 'MONITORING').length,
        recent: contextIssues.slice(0, 4).map((item) =>
          `${item.title} (${item.type}, ${item.status})`
        )
      },
      riskOpportunity: {
        totalRisks: risks.filter((item) => item.assessmentType === 'RISK').length,
        totalOpportunities: risks.filter((item) => item.assessmentType === 'OPPORTUNITY').length,
        openHighRisks: risks.filter((item) => item.assessmentType === 'RISK' && item.status !== 'CLOSED' && item.score >= 15).length,
        activeHighHazards: hazards.filter((item) => item.status !== 'OBSOLETE' && item.severity === 'HIGH').length,
        significantAspects: aspects.filter((item) => item.status !== 'OBSOLETE' && item.significance === 'HIGH').length,
        recent: risks.slice(0, 4).map((item) =>
          `${item.title} (${item.assessmentType}, score ${item.score}${item.residualScore !== null ? `, residual ${item.residualScore}` : ''}, ${item.status})`
        )
      },
      changes: {
        active: changes.filter((item) => !['CLOSED', 'REJECTED'].includes(item.status)).length,
        overdueReviews: changes.filter((item) => !!item.reviewDate && item.reviewDate < now && !['CLOSED', 'REJECTED'].includes(item.status)).length,
        recent: changes.slice(0, 4).map((item) =>
          `${item.title} (${item.changeType}, ${item.status}${item.reviewDate ? `, review ${this.formatDate(item.reviewDate)}` : ''})`
        )
      },
      previousActions: {
        previousReviews: previousReviews.length,
        openManagementActions: managementActions.filter((item) => item.status !== 'DONE' && item.status !== 'CANCELLED').length,
        recentReviews: previousReviews.map((item) =>
          `${item.title} (${item.status}${item.reviewDate ? `, ${this.formatDate(item.reviewDate)}` : ''}${item.summary ? `, ${item.summary}` : ''})`
        ),
        recentActions: managementActions.slice(0, 4).map((item) =>
          `${item.title} (${item.status}${item.dueDate ? `, due ${this.formatDate(item.dueDate)}` : ''})`
        )
      }
    };
  }

  private buildTemplateFindingDraft(dto: DraftAuditFindingDto): AuditFindingDraftResult {
    const normalizedEvidence = dto.evidenceNote.trim();
    const severity = this.estimateSeverity(normalizedEvidence);
    const title = `${dto.clause} gap`;
    const description = this.normalizeFindingDescription(normalizedEvidence);

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

  private buildTemplateManagementReviewDraft(
    snapshot: ManagementReviewSourceSnapshot
  ): ManagementReviewInputDraftResult {
    return {
      provider: 'template',
      model: 'local-guidance',
      mode: 'template',
      sections: {
        auditResults: this.ensureSentence(
          `There are ${snapshot.audit.total} audit records in scope, with ${snapshot.audit.openFindings} open findings and ${snapshot.audit.capaLinkedFindings} findings already moved into CAPA. ${snapshot.audit.recentAudits[0] ? `Recent audit activity includes ${snapshot.audit.recentAudits[0]}` : 'Recent audit narrative should be confirmed from the live audit register'}`
        ),
        capaStatus: this.ensureSentence(
          `There are ${snapshot.capa.open} CAPA records still open, including ${snapshot.capa.overdue} overdue items. ${snapshot.capa.recent[0] ? `Current CAPA focus includes ${snapshot.capa.recent[0]}` : 'Detailed CAPA follow-up should be confirmed from the live register'}`
        ),
        kpiPerformance: this.ensureSentence(
          `The KPI register currently shows ${snapshot.kpi.breach} breaches and ${snapshot.kpi.watch} KPI items on watch across ${snapshot.kpi.total} KPIs. ${snapshot.kpi.recent[0] ? `A current example is ${snapshot.kpi.recent[0]}` : 'Detailed KPI commentary should be added from the live KPI register'}`
        ),
        customerInterestedPartiesFeedback: this.ensureSentence(
          `Structured customer feedback currently includes ${snapshot.feedback.surveyResponses} completed survey response${snapshot.feedback.surveyResponses === 1 ? '' : 's'} with an average score of ${snapshot.feedback.surveyAverage != null ? `${snapshot.feedback.surveyAverage}/10` : 'no recorded average'} on the 0-10 scale, alongside ${snapshot.feedback.customerNcrs} customer-sourced NCR records and ${snapshot.feedback.complaintNcrs} complaint records. ${snapshot.feedback.recentComments[0] ? `A recent comment theme is ${snapshot.feedback.recentComments[0]}` : snapshot.feedback.recent[0] ? `A recent signal is ${snapshot.feedback.recent[0]}` : 'No strong recent structured feedback theme was found in the current records'}`
        ),
        providerPerformance: this.ensureSentence(
          `The provider register shows ${snapshot.provider.underReview} providers under review and ${snapshot.provider.escalated} escalated or disqualified evaluations. ${snapshot.provider.recent[0] ? `Current provider focus includes ${snapshot.provider.recent[0]}` : 'Detailed provider performance commentary should be confirmed in the live register'}`
        ),
        complianceObligations: this.ensureSentence(
          `The obligation register shows ${snapshot.compliance.underReview} items under review and ${snapshot.compliance.overdue} overdue review dates. ${snapshot.compliance.recent[0] ? `A current compliance signal is ${snapshot.compliance.recent[0]}` : 'Detailed compliance commentary should be added from the obligation register'}`
        ),
        incidentEmergencyPerformance: this.ensureSentence(
          `There are ${snapshot.incidentPerformance.openIncidents} open incidents in the current records, including ${snapshot.incidentPerformance.criticalIncidents} critical incidents. ${snapshot.incidentPerformance.recent[0] ? `A current incident signal is ${snapshot.incidentPerformance.recent[0]}` : 'Recent incident themes should be confirmed from the live incident register.'}`
        ),
        consultationCommunication: this.ensureSentence(
          `Structured consultation and communication evidence is currently represented by ${snapshot.consultation.interestedParties} interested parties, ${snapshot.consultation.needs} recorded needs or expectations, and ${snapshot.consultation.openContextIssues} open context issues. If additional worker consultation evidence exists outside the app, it should be added manually.`
        ),
        risksOpportunities: this.ensureSentence(
          `The live registers show ${snapshot.riskOpportunity.openHighRisks} high-priority open risks, ${snapshot.riskOpportunity.totalOpportunities} opportunity records, ${snapshot.riskOpportunity.activeHighHazards} active high hazards, and ${snapshot.riskOpportunity.significantAspects} significant environmental aspects. ${snapshot.riskOpportunity.recent[0] ? `Current risk context includes ${snapshot.riskOpportunity.recent[0]}` : 'Detailed risk commentary should be confirmed in the live registers'}`
        ),
        changesAffectingSystem: this.ensureSentence(
          `There are ${snapshot.changes.active} active change requests affecting the system, with ${snapshot.changes.overdueReviews} review dates now past. ${snapshot.changes.recent[0] ? `A current change signal is ${snapshot.changes.recent[0]}` : 'No recent change summary was found in the current records'}`
        ),
        previousActions: this.ensureSentence(
          `There are ${snapshot.previousActions.openManagementActions} open follow-up actions linked to management review records. ${snapshot.previousActions.recentReviews[0] ? `The latest review context is ${snapshot.previousActions.recentReviews[0]}` : 'No earlier management review record was found for comparison'}`
        )
      },
      warning: "AI provider is not configured yet, so this draft uses the app's built-in fallback guidance."
    };
  }

  private buildTemplateProcedureChecklist(
    input: ProcedureChecklistDraftInput
  ): ProcedureChecklistDraftResult {
    return {
      provider: 'template',
      model: 'local-guidance',
      mode: 'template',
      checklistTitle: `${input.procedure.title} audit checklist`,
      rationale: this.ensureSentence(
        `Checklist drafted from the selected process and procedure metadata because no live AI provider is configured.`
      ),
      questions: this.buildProcedureChecklistFallbackQuestions(input),
      warning:
        "AI provider is not configured yet, so this checklist uses the app's built-in fallback guidance."
    };
  }

  private getKpiStatus(
    actual: number,
    target: number,
    warningThreshold: number | null,
    direction: KpiDirection
  ) {
    if (direction === KpiDirection.AT_LEAST) {
      if (actual >= target) {
        return 'ON_TARGET';
      }

      if (warningThreshold !== null && actual >= warningThreshold) {
        return 'WATCH';
      }

      return 'BREACH';
    }

    if (actual <= target) {
      return 'ON_TARGET';
    }

    if (warningThreshold !== null && actual <= warningThreshold) {
      return 'WATCH';
    }

    return 'BREACH';
  }

  private formatDate(value: Date) {
    return value.toISOString().slice(0, 10);
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

  private normalizeProcedureQuestions(
    value: unknown,
    input: ProcedureChecklistDraftInput
  ): ProcedureChecklistQuestion[] {
    const fallback = this.buildProcedureChecklistFallbackQuestions(input);
    if (!Array.isArray(value)) {
      return fallback;
    }

    const normalized = value
      .map((item) => {
        const row = item as Record<string, unknown>;
        const title = this.cleanText(String(row['title'] || ''));
        if (!title) {
          return null;
        }
        const clause = this.normalizeProcedureClause(String(row['clause'] || ''));
        const subclause = this.cleanText(String(row['subclause'] || ''));
        const question: ProcedureChecklistQuestion = {
          clause,
          title: title.slice(0, 200)
        };
        if (subclause) {
          question.subclause = subclause;
        }
        return question;
      })
      .filter((item): item is ProcedureChecklistQuestion => item !== null);

    return normalized.length >= 8 ? normalized.slice(0, 14) : fallback;
  }

  private buildProcedureChecklistFallbackQuestions(
    input: ProcedureChecklistDraftInput
  ): ProcedureChecklistQuestion[] {
    const procedureLabel = `${input.procedure.code} - ${input.procedure.title}`;
    const processName = input.process.name;
    const metadataNotes = [
      input.process.purpose,
      input.process.scope,
      input.process.inputsText,
      input.process.outputsText,
      input.procedure.summary,
      input.procedure.changeSummary,
      input.procedureContent
    ]
      .filter((value) => !!value?.trim())
      .join(' ');
    const hints = metadataNotes.toLowerCase();

    const questions: ProcedureChecklistQuestion[] = [
      {
        clause: 'Procedure Setup',
        subclause: 'Ownership',
        title: `Are ownership, responsibilities, and authority clear for ${processName} and the ${input.procedure.title}?`
      },
      {
        clause: 'Procedure Setup',
        subclause: 'Approval',
        title: `Is the current approved version of ${procedureLabel} available at the point of use?`
      },
      {
        clause: 'Procedure Setup',
        subclause: 'Interfaces',
        title: `Are the interfaces between ${processName} and related functions defined well enough to follow the procedure consistently?`
      },
      {
        clause: 'Operational Control',
        subclause: 'Execution',
        title: `Is the procedure being followed in practice for normal ${processName.toLowerCase()} activities?`
      },
      {
        clause: 'Operational Control',
        subclause: 'Inputs',
        title: `Are the required inputs, approvals, and trigger points identified before work starts under this procedure?`
      },
      {
        clause: 'Operational Control',
        subclause: 'Outputs',
        title: `Do the resulting outputs from this procedure match what the process is expected to deliver?`
      },
      {
        clause: 'Records and Evidence',
        subclause: 'Records',
        title: `Are the records required by ${input.procedure.title} complete, current, and retrievable?`
      },
      {
        clause: 'Records and Evidence',
        subclause: 'Traceability',
        title: `Is there enough retained evidence to confirm that the procedure steps were completed in the right order?`
      },
      {
        clause: 'Monitoring and Follow-up',
        subclause: 'Monitoring',
        title: `Are process performance, errors, delays, or deviations monitored well enough to show whether ${input.procedure.title} is effective?`
      },
      {
        clause: 'Monitoring and Follow-up',
        subclause: 'Exceptions',
        title: `When exceptions, missed steps, or nonconforming results occur, are they escalated and followed up in a controlled way?`
      }
    ];

    if (hints.includes('supplier') || hints.includes('procurement') || hints.includes('purchas')) {
      questions.splice(
        5,
        0,
        {
          clause: 'Operational Control',
          subclause: 'Selection',
          title: 'Are supplier selection, approval, and purchasing controls applied as defined in the procedure?'
        },
        {
          clause: 'Records and Evidence',
          subclause: 'Evaluation',
          title: 'Do supplier evaluation and purchasing records support the decisions made under the procedure?'
        }
      );
    }

    if (hints.includes('training') || hints.includes('competence')) {
      questions.splice(4, 0, {
        clause: 'Procedure Setup',
        subclause: 'Training',
        title: `Are the people using ${input.procedure.title} competent and aware of the required steps and controls?`
      });
    }

    return questions;
  }

  private normalizeProcedureClause(value: string) {
    const normalized = this.cleanText(value).toLowerCase();
    if (normalized.includes('operat')) return 'Operational Control';
    if (normalized.includes('record') || normalized.includes('evidence')) return 'Records and Evidence';
    if (normalized.includes('monitor') || normalized.includes('follow')) return 'Monitoring and Follow-up';
    return 'Procedure Setup';
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

  private normalizeFindingDescription(note: string) {
    const trimmed = note.trim();
    if (!trimmed) {
      return '';
    }

    return /[.!?]$/.test(trimmed) ? trimmed : `${trimmed}.`;
  }

  private cleanText(value: string | undefined) {
    return (value || '')
      .trim()
      .replace(/^["'`]+|["'`]+$/g, '')
      .replace(/\s+/g, ' ');
  }

  private ensureSentence(value: string) {
    const trimmed = value.trim();
    if (!trimmed) {
      return '';
    }

    return /[.!?]$/.test(trimmed) ? trimmed : `${trimmed}.`;
  }
}
