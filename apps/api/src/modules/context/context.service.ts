import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { randomBytes } from 'crypto';
import {
  getCustomerSurveyRequestDelegate,
  getContextIssueDelegate,
  getContextIssueRiskLinkDelegate,
  getInterestedPartyDelegate,
  getNeedExpectationDelegate,
  getProcessRegisterDelegate,
  getProcessRegisterLinkDelegate
} from '../../common/prisma/prisma-delegate-compat';
import { PrismaService } from '../../common/prisma/prisma.service';
import { AuditLogsService } from '../audit-logs/audit-logs.service';
import { CreateContextIssueRiskLinkDto } from './dto/create-context-issue-risk-link.dto';
import { CreateContextIssueProcessLinkDto } from './dto/create-context-issue-process-link.dto';
import { CreateContextIssueDto, ContextIssueStatusValue, ContextIssueTypeValue } from './dto/create-context-issue.dto';
import { CreateCustomerSurveyRequestDto } from './dto/create-customer-survey-request.dto';
import { CreateInterestedPartyDto, InterestedPartyTypeValue } from './dto/create-interested-party.dto';
import { CreateNeedExpectationDto } from './dto/create-need-expectation.dto';
import { SubmitCustomerSurveyDto } from './dto/submit-customer-survey.dto';
import { UpdateContextIssueDto } from './dto/update-context-issue.dto';
import { UpdateInterestedPartyDto } from './dto/update-interested-party.dto';
import { UpdateNeedExpectationDto } from './dto/update-need-expectation.dto';

type ContextIssueRecord = {
  id: string;
  tenantId: string;
  type: ContextIssueTypeValue;
  title: string;
  description: string;
  impactOnBusiness: string | null;
  category: string | null;
  status: ContextIssueStatusValue;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
};

type InterestedPartyRecord = {
  id: string;
  tenantId: string;
  name: string;
  type: InterestedPartyTypeValue;
  description: string | null;
  surveyEnabled: boolean;
  surveyTitle: string | null;
  surveyIntro: string | null;
  surveyScaleMax: number | null;
  surveyCategoryLabels: string[] | null;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
};

type CustomerSurveyRequestStatusValue = 'OPEN' | 'COMPLETED' | 'EXPIRED' | 'CANCELLED';

type CustomerSurveyRequestRecord = {
  id: string;
  tenantId: string;
  interestedPartyId: string;
  token: string;
  title: string;
  intro: string | null;
  scaleMax: number;
  categoryLabels: string[];
  recipientName: string | null;
  recipientEmail: string | null;
  status: CustomerSurveyRequestStatusValue;
  sentAt: Date | null;
  expiresAt: Date | null;
  completedAt: Date | null;
  respondentName: string | null;
  respondentEmail: string | null;
  respondentCompany: string | null;
  respondentReference: string | null;
  ratings: Record<string, number> | null;
  whatWorkedWell: string | null;
  improvementPriority: string | null;
  comments: string | null;
  averageScore: number | null;
  createdAt: Date;
  updatedAt: Date;
};

type SurveyCategoryAverageSummary = {
  key: string;
  label: string;
  averageScore: number | null;
  responseCount: number;
};

type SurveySummary = {
  responseCount: number;
  openRequestCount: number;
  expiredRequestCount: number;
  averageScore: number | null;
  lowScoreCount: number;
  mediumScoreCount: number;
  highScoreCount: number;
  health: 'NO_DATA' | 'ATTENTION' | 'WATCH' | 'STRONG';
  categoryAverages: SurveyCategoryAverageSummary[];
  recentComments: string[];
};

type NeedExpectationRecord = {
  id: string;
  tenantId: string;
  interestedPartyId: string;
  description: string;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
};

type ContextIssueRiskLinkRecord = {
  id: string;
  tenantId: string;
  issueId: string;
  riskId: string;
  createdAt: Date;
  createdById: string | null;
};

type ContextIssueProcessLinkRecord = {
  id: string;
  tenantId: string;
  processId: string;
  linkType: 'CONTEXT_ISSUE';
  linkedId: string;
  note: string | null;
  createdAt: Date;
  createdById: string | null;
};

@Injectable()
export class ContextService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLogsService: AuditLogsService
  ) {}

  async dashboard(tenantId: string) {
    const [internalIssues, externalIssues, interestedParties, needs, recentIssues, customerFeedback] = await Promise.all([
      getContextIssueDelegate(this.prisma).count({ where: { tenantId, type: 'INTERNAL', deletedAt: null } }),
      getContextIssueDelegate(this.prisma).count({ where: { tenantId, type: 'EXTERNAL', deletedAt: null } }),
      getInterestedPartyDelegate(this.prisma).count({ where: { tenantId, deletedAt: null } }),
      getNeedExpectationDelegate(this.prisma).count({ where: { tenantId, deletedAt: null } }),
      getContextIssueDelegate(this.prisma).findMany({
        where: { tenantId, deletedAt: null },
        orderBy: [{ updatedAt: 'desc' }],
        take: 6
      }),
      this.buildCustomerFeedbackSummary(tenantId)
    ]);

    return {
      summary: {
        internalIssues,
        externalIssues,
        interestedParties,
        needsExpectations: needs,
        customerSurveyResponses: customerFeedback.responseCount,
        customerSurveyAverage: customerFeedback.averageScore,
        customerFeedbackAttention: customerFeedback.lowScoreCount
      },
      recentIssues,
      customerFeedback
    };
  }

  async listIssues(tenantId: string, filters: { type?: ContextIssueTypeValue; status?: ContextIssueStatusValue; search?: string } = {}) {
    const items = (await getContextIssueDelegate(this.prisma).findMany({
      where: {
        tenantId,
        deletedAt: null,
        type: filters.type,
        status: filters.status,
        OR: filters.search
          ? [
              { title: { contains: filters.search, mode: 'insensitive' } },
              { description: { contains: filters.search, mode: 'insensitive' } },
              { category: { contains: filters.search, mode: 'insensitive' } }
            ]
          : undefined
      },
      orderBy: [{ updatedAt: 'desc' }, { createdAt: 'desc' }]
    })) as ContextIssueRecord[];

    const linkCounts = await Promise.all(
      items.map((item) =>
        getContextIssueRiskLinkDelegate(this.prisma).count({
          where: { tenantId, issueId: item.id }
        })
      )
    );

    return items.map((item, index) => ({
      ...item,
      linkedRiskCount: linkCounts[index]
    }));
  }

  async getIssue(tenantId: string, id: string) {
    const issue = (await getContextIssueDelegate(this.prisma).findFirst({
      where: { tenantId, id, deletedAt: null }
    })) as ContextIssueRecord | null;

    if (!issue) {
      throw new NotFoundException('Context issue not found');
    }

    return {
      ...issue,
      linkedRisks: await this.listIssueRiskLinks(tenantId, id),
      linkedProcesses: await this.listIssueProcessLinks(tenantId, id)
    };
  }

  async createIssue(tenantId: string, actorId: string, dto: CreateContextIssueDto) {
    const issue = (await getContextIssueDelegate(this.prisma).create({
      data: {
        tenantId,
        type: dto.type,
        title: dto.title.trim(),
        description: dto.description.trim(),
        impactOnBusiness: this.normalizeText(dto.impactOnBusiness),
        category: this.normalizeText(dto.category),
        status: dto.status ?? 'OPEN'
      }
    })) as ContextIssueRecord;

    await this.auditLogsService.create({
      tenantId,
      actorId,
      action: 'context.issue.created',
      entityType: 'context-issue',
      entityId: issue.id,
      metadata: dto
    });

    return this.getIssue(tenantId, issue.id);
  }

  async updateIssue(tenantId: string, actorId: string, id: string, dto: UpdateContextIssueDto) {
    await this.ensureIssueExists(tenantId, id);

    await getContextIssueDelegate(this.prisma).update({
      where: { id },
      data: {
        type: dto.type,
        title: dto.title !== undefined ? dto.title.trim() : undefined,
        description: dto.description !== undefined ? dto.description.trim() : undefined,
        impactOnBusiness: dto.impactOnBusiness !== undefined ? this.normalizeText(dto.impactOnBusiness) : undefined,
        category: dto.category !== undefined ? this.normalizeText(dto.category) : undefined,
        status: dto.status
      }
    });

    await this.auditLogsService.create({
      tenantId,
      actorId,
      action: 'context.issue.updated',
      entityType: 'context-issue',
      entityId: id,
      metadata: dto
    });

    return this.getIssue(tenantId, id);
  }

  async removeIssue(tenantId: string, actorId: string, id: string) {
    await this.ensureIssueExists(tenantId, id);

    await getContextIssueDelegate(this.prisma).update({
      where: { id },
      data: {
        deletedAt: new Date(),
        status: 'ARCHIVED'
      }
    });

    await this.auditLogsService.create({
      tenantId,
      actorId,
      action: 'context.issue.deleted',
      entityType: 'context-issue',
      entityId: id
    });

    return { success: true };
  }

  async listIssueRiskLinks(tenantId: string, issueId: string) {
    await this.ensureIssueExists(tenantId, issueId);

    const links = (await getContextIssueRiskLinkDelegate(this.prisma).findMany({
      where: { tenantId, issueId },
      orderBy: [{ createdAt: 'desc' }]
    })) as ContextIssueRiskLinkRecord[];

    if (!links.length) {
      return [];
    }

    const risks = await this.prisma.risk.findMany({
      where: { tenantId, id: { in: links.map((link) => link.riskId) }, deletedAt: null },
      select: { id: true, title: true, status: true, score: true }
    });
    const riskMap = new Map(risks.map((risk) => [risk.id, risk]));

    return links.map((link) => {
      const risk = riskMap.get(link.riskId);
      return {
        id: link.id,
        riskId: link.riskId,
        title: risk?.title || 'Linked risk unavailable',
        status: risk?.status || null,
        score: risk?.score ?? null,
        path: risk ? `/risks/${risk.id}` : null,
        missing: !risk,
        createdAt: link.createdAt
      };
    });
  }

  async addIssueRiskLink(tenantId: string, actorId: string, issueId: string, dto: CreateContextIssueRiskLinkDto) {
    await this.ensureIssueExists(tenantId, issueId);
    await this.ensureRiskExists(tenantId, dto.riskId);

    try {
      const link = (await getContextIssueRiskLinkDelegate(this.prisma).create({
        data: {
          tenantId,
          issueId,
          riskId: dto.riskId,
          createdById: actorId
        }
      })) as ContextIssueRiskLinkRecord;

      await this.auditLogsService.create({
        tenantId,
        actorId,
        action: 'context.issue.risk-linked',
        entityType: 'context-issue',
        entityId: issueId,
        metadata: dto
      });

      const [summary] = await this.listIssueRiskLinks(tenantId, issueId);
      return summary ?? link;
    } catch {
      throw new ConflictException('This risk is already linked to the selected issue.');
    }
  }

  async removeIssueRiskLink(tenantId: string, actorId: string, issueId: string, linkId: string) {
    const link = (await getContextIssueRiskLinkDelegate(this.prisma).findFirst({
      where: { tenantId, issueId, id: linkId }
    })) as ContextIssueRiskLinkRecord | null;

    if (!link) {
      throw new NotFoundException('Issue-to-risk link not found');
    }

    await getContextIssueRiskLinkDelegate(this.prisma).delete({
      where: { id: linkId }
    });

    await this.auditLogsService.create({
      tenantId,
      actorId,
      action: 'context.issue.risk-unlinked',
      entityType: 'context-issue',
      entityId: issueId,
      metadata: { riskId: link.riskId }
    });

    return { success: true };
  }

  async listIssueProcessLinks(tenantId: string, issueId: string) {
    await this.ensureIssueExists(tenantId, issueId);

    const links = (await getProcessRegisterLinkDelegate(this.prisma).findMany({
      where: {
        tenantId,
        linkType: 'CONTEXT_ISSUE',
        linkedId: issueId
      },
      orderBy: [{ createdAt: 'desc' }]
    })) as ContextIssueProcessLinkRecord[];

    if (!links.length) {
      return [];
    }

    const processes = (await getProcessRegisterDelegate(this.prisma).findMany({
      where: {
        tenantId,
        id: { in: links.map((link) => link.processId) },
        deletedAt: null
      }
    })) as Array<{
      id: string;
      referenceNo: string | null;
      name: string;
      department: string | null;
      status: string;
    }>;
    const processMap = new Map(processes.map((process) => [process.id, process]));

    return links.map((link) => {
      const process = processMap.get(link.processId);
      return {
        id: link.id,
        processId: link.processId,
        title: process ? `${process.referenceNo || 'Uncoded'} - ${process.name}` : 'Linked process unavailable',
        status: process?.status || null,
        subtitle: process?.department || null,
        path: process ? `/process-register/${process.id}` : null,
        missing: !process,
        createdAt: link.createdAt
      };
    });
  }

  async addIssueProcessLink(tenantId: string, actorId: string, issueId: string, dto: CreateContextIssueProcessLinkDto) {
    await this.ensureIssueExists(tenantId, issueId);
    await this.ensureProcessExists(tenantId, dto.processId);

    try {
      await getProcessRegisterLinkDelegate(this.prisma).create({
        data: {
          tenantId,
          processId: dto.processId,
          linkType: 'CONTEXT_ISSUE',
          linkedId: issueId,
          createdById: actorId
        }
      });

      await this.auditLogsService.create({
        tenantId,
        actorId,
        action: 'context.issue.process-linked',
        entityType: 'context-issue',
        entityId: issueId,
        metadata: dto
      });

      const links = await this.listIssueProcessLinks(tenantId, issueId);
      return links.find((link) => link.processId === dto.processId) ?? links[0];
    } catch {
      throw new ConflictException('This process is already linked to the selected issue.');
    }
  }

  async removeIssueProcessLink(tenantId: string, actorId: string, issueId: string, linkId: string) {
    const link = (await getProcessRegisterLinkDelegate(this.prisma).findFirst({
      where: {
        tenantId,
        linkedId: issueId,
        linkType: 'CONTEXT_ISSUE',
        id: linkId
      }
    })) as ContextIssueProcessLinkRecord | null;

    if (!link) {
      throw new NotFoundException('Issue-to-process link not found');
    }

    await getProcessRegisterLinkDelegate(this.prisma).delete({
      where: { id: linkId }
    });

    await this.auditLogsService.create({
      tenantId,
      actorId,
      action: 'context.issue.process-unlinked',
      entityType: 'context-issue',
      entityId: issueId,
      metadata: { processId: link.processId }
    });

    return { success: true };
  }

  async listInterestedParties(tenantId: string, filters: { type?: InterestedPartyTypeValue; search?: string } = {}) {
    const items = (await getInterestedPartyDelegate(this.prisma).findMany({
      where: {
        tenantId,
        deletedAt: null,
        type: filters.type,
        OR: filters.search
          ? [
              { name: { contains: filters.search, mode: 'insensitive' } },
              { description: { contains: filters.search, mode: 'insensitive' } }
            ]
          : undefined
      },
      orderBy: [{ updatedAt: 'desc' }, { createdAt: 'desc' }]
    })) as InterestedPartyRecord[];

    const [needCounts, surveySummaries] = await Promise.all([
      Promise.all(
        items.map((item) =>
          getNeedExpectationDelegate(this.prisma).count({
            where: { tenantId, interestedPartyId: item.id, deletedAt: null }
          })
        )
      ),
      Promise.all(items.map((item) => this.buildSurveySummary(tenantId, item.id)))
    ]);

    return items.map((item, index) => ({
      ...item,
      surveyCategoryLabels: this.normalizeCategoryLabels(item.surveyCategoryLabels),
      needCount: needCounts[index],
      surveySummary: surveySummaries[index]
    }));
  }

  async getInterestedParty(tenantId: string, id: string) {
    const party = (await getInterestedPartyDelegate(this.prisma).findFirst({
      where: { tenantId, id, deletedAt: null }
    })) as InterestedPartyRecord | null;

    if (!party) {
      throw new NotFoundException('Interested party not found');
    }

    return {
      ...party,
      surveyCategoryLabels: this.normalizeCategoryLabels(party.surveyCategoryLabels),
      needs: await this.listNeeds(tenantId, { interestedPartyId: id }),
      surveySummary: await this.buildSurveySummary(tenantId, id),
      surveyRequests: await this.listCustomerSurveyRequests(tenantId, id)
    };
  }

  async createInterestedParty(tenantId: string, actorId: string, dto: CreateInterestedPartyDto) {
    const party = (await getInterestedPartyDelegate(this.prisma).create({
      data: {
        tenantId,
        name: dto.name.trim(),
        type: dto.type,
        description: this.normalizeText(dto.description),
        surveyEnabled: dto.type === 'CUSTOMER' ? Boolean(dto.surveyEnabled) : false,
        surveyTitle: dto.type === 'CUSTOMER' ? this.normalizeText(dto.surveyTitle) : null,
        surveyIntro: dto.type === 'CUSTOMER' ? this.normalizeText(dto.surveyIntro) : null,
        surveyScaleMax:
          dto.type === 'CUSTOMER'
            ? dto.surveyScaleMax ?? 10
            : null,
        surveyCategoryLabels:
          dto.type === 'CUSTOMER'
            ? this.normalizeCategoryLabels(dto.surveyCategoryLabels)
            : null
      }
    })) as InterestedPartyRecord;

    await this.auditLogsService.create({
      tenantId,
      actorId,
      action: 'context.party.created',
      entityType: 'interested-party',
      entityId: party.id,
      metadata: dto
    });

    return this.getInterestedParty(tenantId, party.id);
  }

  async updateInterestedParty(tenantId: string, actorId: string, id: string, dto: UpdateInterestedPartyDto) {
    await this.ensureInterestedPartyExists(tenantId, id);
    const existing = await this.getInterestedPartyCore(tenantId, id);
    const effectiveType = dto.type ?? existing.type;
    const isCustomer = effectiveType === 'CUSTOMER';

    await getInterestedPartyDelegate(this.prisma).update({
      where: { id },
      data: {
        name: dto.name !== undefined ? dto.name.trim() : undefined,
        type: dto.type,
        description: dto.description !== undefined ? this.normalizeText(dto.description) : undefined,
        surveyEnabled: isCustomer ? dto.surveyEnabled ?? undefined : false,
        surveyTitle: isCustomer
          ? dto.surveyTitle !== undefined ? this.normalizeText(dto.surveyTitle) : undefined
          : null,
        surveyIntro: isCustomer
          ? dto.surveyIntro !== undefined ? this.normalizeText(dto.surveyIntro) : undefined
          : null,
        surveyScaleMax: isCustomer ? dto.surveyScaleMax ?? undefined : null,
        surveyCategoryLabels: isCustomer
          ? dto.surveyCategoryLabels !== undefined ? this.normalizeCategoryLabels(dto.surveyCategoryLabels) : undefined
          : null
      }
    });

    await this.auditLogsService.create({
      tenantId,
      actorId,
      action: 'context.party.updated',
      entityType: 'interested-party',
      entityId: id,
      metadata: dto
    });

    return this.getInterestedParty(tenantId, id);
  }

  async removeInterestedParty(tenantId: string, actorId: string, id: string) {
    await this.ensureInterestedPartyExists(tenantId, id);

    await getInterestedPartyDelegate(this.prisma).update({
      where: { id },
      data: { deletedAt: new Date() }
    });

    await this.auditLogsService.create({
      tenantId,
      actorId,
      action: 'context.party.deleted',
      entityType: 'interested-party',
      entityId: id
    });

    return { success: true };
  }

  async createCustomerSurveyRequest(
    tenantId: string,
    actorId: string,
    interestedPartyId: string,
    dto: CreateCustomerSurveyRequestDto
  ) {
    const party = await this.getInterestedPartyCore(tenantId, interestedPartyId);
    if (party.type !== 'CUSTOMER') {
      throw new BadRequestException('Customer surveys can only be issued for interested parties of type CUSTOMER.');
    }

    const request = (await getCustomerSurveyRequestDelegate(this.prisma).create({
      data: {
        tenantId,
        interestedPartyId,
        token: randomBytes(24).toString('hex'),
        title: this.surveyRequestTitle(party),
        intro: party.surveyIntro,
        scaleMax: party.surveyScaleMax ?? 10,
        categoryLabels: this.normalizeCategoryLabels(party.surveyCategoryLabels),
        recipientName: this.normalizeText(dto.recipientName),
        recipientEmail: this.normalizeText(dto.recipientEmail),
        status: 'OPEN',
        sentAt: new Date(),
        expiresAt: dto.expiresAt ? new Date(dto.expiresAt) : this.defaultSurveyExpiry()
      }
    })) as CustomerSurveyRequestRecord;

    await this.auditLogsService.create({
      tenantId,
      actorId,
      action: 'context.customer-survey.issued',
      entityType: 'customer-survey-request',
      entityId: request.id,
      metadata: {
        interestedPartyId,
        recipientName: dto.recipientName,
        recipientEmail: dto.recipientEmail,
        expiresAt: dto.expiresAt
      }
    });

    return this.mapCustomerSurveyRequest(request, party.name);
  }

  async getPublicCustomerSurvey(token: string) {
    const request = await this.findSurveyRequestByToken(token);
    const current = await this.refreshSurveyRequestStatusIfNeeded(request);

    return {
      id: current.id,
      token: current.token,
      title: current.title,
      intro: current.intro,
      scaleMax: current.scaleMax,
      categoryLabels: this.normalizeCategoryLabels(current.categoryLabels),
      status: current.status,
      expiresAt: current.expiresAt,
      completedAt: current.completedAt,
      partyName: current.interestedParty.name
    };
  }

  async submitPublicCustomerSurvey(token: string, dto: SubmitCustomerSurveyDto) {
    const request = await this.findSurveyRequestByToken(token);
    const current = await this.refreshSurveyRequestStatusIfNeeded(request);

    if (current.status === 'COMPLETED') {
      throw new ConflictException('This survey link has already been completed.');
    }

    if (current.status === 'CANCELLED' || current.status === 'EXPIRED') {
      throw new BadRequestException('This survey link is no longer active.');
    }

    const scaleMax = current.scaleMax;
    const labels = this.normalizeCategoryLabels(current.categoryLabels);
    const ratings = this.validateSurveyRatings(dto.ratings, labels, scaleMax);
    const ratingValues = Object.values(ratings);
    const averageScore = Number(
      (ratingValues.reduce((sum, value) => sum + value, 0) / ratingValues.length).toFixed(2)
    );

    const updated = (await getCustomerSurveyRequestDelegate(this.prisma).update({
      where: { id: current.id },
      data: {
        status: 'COMPLETED',
        completedAt: new Date(),
        respondentName: this.normalizeText(dto.respondentName),
        respondentEmail: this.normalizeText(dto.respondentEmail),
        respondentCompany: this.normalizeText(dto.respondentCompany),
        respondentReference: this.normalizeText(dto.respondentReference),
        ratings,
        whatWorkedWell: this.normalizeText(dto.whatWorkedWell),
        improvementPriority: this.normalizeText(dto.improvementPriority),
        comments: this.normalizeText(dto.comments),
        averageScore
      }
    })) as CustomerSurveyRequestRecord;

    await this.auditLogsService.create({
      tenantId: updated.tenantId,
      action: 'context.customer-survey.completed',
      entityType: 'customer-survey-request',
      entityId: updated.id,
      metadata: {
        interestedPartyId: updated.interestedPartyId,
        respondentName: dto.respondentName,
        respondentEmail: dto.respondentEmail,
        averageScore
      }
    });

    return {
      success: true,
      averageScore,
      status: updated.status
    };
  }

  async listNeeds(tenantId: string, filters: { interestedPartyId?: string } = {}) {
    const items = (await getNeedExpectationDelegate(this.prisma).findMany({
      where: {
        tenantId,
        deletedAt: null,
        interestedPartyId: filters.interestedPartyId
      },
      orderBy: [{ updatedAt: 'desc' }, { createdAt: 'desc' }]
    })) as NeedExpectationRecord[];

    const partyIds = Array.from(new Set(items.map((item) => item.interestedPartyId)));
    const parties = partyIds.length
      ? await getInterestedPartyDelegate(this.prisma).findMany({
          where: { tenantId, id: { in: partyIds }, deletedAt: null }
        })
      : [];
    const partyMap = new Map((parties as InterestedPartyRecord[]).map((party) => [party.id, party]));

    return items.map((item) => ({
      ...item,
      interestedParty: partyMap.get(item.interestedPartyId) ?? null
    }));
  }

  async getNeed(tenantId: string, id: string) {
    const need = (await getNeedExpectationDelegate(this.prisma).findFirst({
      where: { tenantId, id, deletedAt: null }
    })) as NeedExpectationRecord | null;

    if (!need) {
      throw new NotFoundException('Need or expectation not found');
    }

    const party = await getInterestedPartyDelegate(this.prisma).findFirst({
      where: { tenantId, id: need.interestedPartyId, deletedAt: null }
    });

    return {
      ...need,
      interestedParty: party
    };
  }

  async createNeed(tenantId: string, actorId: string, dto: CreateNeedExpectationDto) {
    await this.ensureInterestedPartyExists(tenantId, dto.interestedPartyId);

    const need = (await getNeedExpectationDelegate(this.prisma).create({
      data: {
        tenantId,
        interestedPartyId: dto.interestedPartyId,
        description: dto.description.trim()
      }
    })) as NeedExpectationRecord;

    await this.auditLogsService.create({
      tenantId,
      actorId,
      action: 'context.need.created',
      entityType: 'need-expectation',
      entityId: need.id,
      metadata: dto
    });

    return this.getNeed(tenantId, need.id);
  }

  async updateNeed(tenantId: string, actorId: string, id: string, dto: UpdateNeedExpectationDto) {
    const existing = (await getNeedExpectationDelegate(this.prisma).findFirst({
      where: { tenantId, id, deletedAt: null }
    })) as NeedExpectationRecord | null;

    if (!existing) {
      throw new NotFoundException('Need or expectation not found');
    }

    if (dto.interestedPartyId) {
      await this.ensureInterestedPartyExists(tenantId, dto.interestedPartyId);
    }

    await getNeedExpectationDelegate(this.prisma).update({
      where: { id },
      data: {
        interestedPartyId: dto.interestedPartyId,
        description: dto.description !== undefined ? dto.description.trim() : undefined
      }
    });

    await this.auditLogsService.create({
      tenantId,
      actorId,
      action: 'context.need.updated',
      entityType: 'need-expectation',
      entityId: id,
      metadata: dto
    });

    return this.getNeed(tenantId, id);
  }

  async removeNeed(tenantId: string, actorId: string, id: string) {
    const existing = (await getNeedExpectationDelegate(this.prisma).findFirst({
      where: { tenantId, id, deletedAt: null }
    })) as NeedExpectationRecord | null;

    if (!existing) {
      throw new NotFoundException('Need or expectation not found');
    }

    await getNeedExpectationDelegate(this.prisma).update({
      where: { id },
      data: { deletedAt: new Date() }
    });

    await this.auditLogsService.create({
      tenantId,
      actorId,
      action: 'context.need.deleted',
      entityType: 'need-expectation',
      entityId: id
    });

    return { success: true };
  }

  private async ensureIssueExists(tenantId: string, id: string) {
    const issue = (await getContextIssueDelegate(this.prisma).findFirst({
      where: { tenantId, id, deletedAt: null },
      select: { id: true }
    })) as { id: string } | null;

    if (!issue) {
      throw new NotFoundException('Context issue not found');
    }
  }

  private async ensureInterestedPartyExists(tenantId: string, id: string) {
    const party = (await getInterestedPartyDelegate(this.prisma).findFirst({
      where: { tenantId, id, deletedAt: null },
      select: { id: true }
    })) as { id: string } | null;

    if (!party) {
      throw new BadRequestException('Interested party could not be found in this tenant');
    }
  }

  private async ensureProcessExists(tenantId: string, processId: string) {
    const process = await getProcessRegisterDelegate(this.prisma).findFirst({
      where: { tenantId, id: processId, deletedAt: null },
      select: { id: true }
    }) as { id: string } | null;

    if (!process) {
      throw new BadRequestException('Selected process could not be found in this tenant');
    }
  }

  private async ensureRiskExists(tenantId: string, id: string) {
    const risk = await this.prisma.risk.findFirst({
      where: { tenantId, id, deletedAt: null },
      select: { id: true }
    });

    if (!risk) {
      throw new BadRequestException('Selected risk could not be found in this tenant');
    }
  }

  private async getInterestedPartyCore(tenantId: string, id: string) {
    const party = (await getInterestedPartyDelegate(this.prisma).findFirst({
      where: { tenantId, id, deletedAt: null }
    })) as InterestedPartyRecord | null;

    if (!party) {
      throw new NotFoundException('Interested party not found');
    }

    return {
      ...party,
      surveyCategoryLabels: this.normalizeCategoryLabels(party.surveyCategoryLabels)
    };
  }

  private async listCustomerSurveyRequests(tenantId: string, interestedPartyId: string) {
    const requests = (await getCustomerSurveyRequestDelegate(this.prisma).findMany({
      where: { tenantId, interestedPartyId },
      orderBy: [{ createdAt: 'desc' }]
    })) as CustomerSurveyRequestRecord[];

    return Promise.all(
      requests.map(async (request) => this.mapCustomerSurveyRequest(await this.refreshSurveyRequestStatusIfNeeded(request)))
    );
  }

  private async buildSurveySummary(tenantId: string, interestedPartyId: string) {
    const requests = (await getCustomerSurveyRequestDelegate(this.prisma).findMany({
      where: { tenantId, interestedPartyId }
    })) as CustomerSurveyRequestRecord[];

    const active = await Promise.all(requests.map((request) => this.refreshSurveyRequestStatusIfNeeded(request)));
    const completed = active.filter((item) => item.status === 'COMPLETED' && item.averageScore != null);
    const open = active.filter((item) => item.status === 'OPEN').length;
    const expired = active.filter((item) => item.status === 'EXPIRED').length;

    if (!completed.length) {
      return {
        responseCount: 0,
        openRequestCount: open,
        expiredRequestCount: expired,
        averageScore: null,
        lowScoreCount: 0,
        mediumScoreCount: 0,
        highScoreCount: 0,
        health: 'NO_DATA',
        categoryAverages: [],
        recentComments: []
      };
    }

    const averageScore = Number(
      (
        completed.reduce((sum, item) => sum + (item.averageScore ?? 0), 0) /
        completed.length
      ).toFixed(2)
    );
    const lowScoreCount = completed.filter((item) => (item.averageScore ?? 0) <= 6).length;
    const mediumScoreCount = completed.filter((item) => {
      const score = item.averageScore ?? 0;
      return score >= 7 && score <= 8;
    }).length;
    const highScoreCount = completed.filter((item) => (item.averageScore ?? 0) >= 9).length;
    const categoryBuckets = new Map<string, { label: string; total: number; count: number }>();

    completed.forEach((item) => {
      const labels = this.normalizeCategoryLabels(item.categoryLabels);
      labels.forEach((label, index) => {
        const key = this.surveyLabelKey(label, index);
        const value = this.readSurveyRating(item.ratings, label, index);
        if (value == null) {
          return;
        }
        const bucket = categoryBuckets.get(key) ?? { label, total: 0, count: 0 };
        bucket.total += value;
        bucket.count += 1;
        categoryBuckets.set(key, bucket);
      });
    });

    return {
      responseCount: completed.length,
      openRequestCount: open,
      expiredRequestCount: expired,
      averageScore,
      lowScoreCount,
      mediumScoreCount,
      highScoreCount,
      health: this.surveyHealthFromSummary(averageScore, lowScoreCount),
      categoryAverages: Array.from(categoryBuckets.entries()).map(([key, bucket]) => ({
        key,
        label: bucket.label,
        averageScore: Number((bucket.total / bucket.count).toFixed(2)),
        responseCount: bucket.count
      })),
      recentComments: completed
        .flatMap((item) => [item.improvementPriority, item.whatWorkedWell, item.comments])
        .filter((value): value is string => Boolean(value?.trim()))
        .slice(0, 4)
    };
  }

  private async buildCustomerFeedbackSummary(tenantId: string): Promise<SurveySummary> {
    const parties = (await getInterestedPartyDelegate(this.prisma).findMany({
      where: { tenantId, deletedAt: null, type: 'CUSTOMER' },
      select: { id: true }
    })) as Array<{ id: string }>;

    const summaries = await Promise.all(parties.map((party) => this.buildSurveySummary(tenantId, party.id)));
    const populated = summaries.filter((item) => item.responseCount || item.openRequestCount || item.expiredRequestCount);

    if (!populated.length) {
      return {
        responseCount: 0,
        openRequestCount: 0,
        expiredRequestCount: 0,
        averageScore: null,
        lowScoreCount: 0,
        mediumScoreCount: 0,
        highScoreCount: 0,
        health: 'NO_DATA',
        categoryAverages: [],
        recentComments: []
      };
    }

    const responseCount = populated.reduce((sum, item) => sum + item.responseCount, 0);
    const openRequestCount = populated.reduce((sum, item) => sum + item.openRequestCount, 0);
    const expiredRequestCount = populated.reduce((sum, item) => sum + item.expiredRequestCount, 0);
    const lowScoreCount = populated.reduce((sum, item) => sum + item.lowScoreCount, 0);
    const mediumScoreCount = populated.reduce((sum, item) => sum + item.mediumScoreCount, 0);
    const highScoreCount = populated.reduce((sum, item) => sum + item.highScoreCount, 0);
    const weightedAverage = responseCount
      ? Number(
          (
            populated.reduce((sum, item) => sum + ((item.averageScore ?? 0) * item.responseCount), 0) /
            responseCount
          ).toFixed(2)
        )
      : null;

    const categoryBuckets = new Map<string, { label: string; total: number; count: number }>();
    populated.forEach((summary) => {
      summary.categoryAverages.forEach((item) => {
        if (item.averageScore == null || !item.responseCount) {
          return;
        }
        const bucket = categoryBuckets.get(item.key) ?? { label: item.label, total: 0, count: 0 };
        bucket.total += item.averageScore * item.responseCount;
        bucket.count += item.responseCount;
        categoryBuckets.set(item.key, bucket);
      });
    });

    return {
      responseCount,
      openRequestCount,
      expiredRequestCount,
      averageScore: weightedAverage,
      lowScoreCount,
      mediumScoreCount,
      highScoreCount,
      health: this.surveyHealthFromSummary(weightedAverage, lowScoreCount),
      categoryAverages: Array.from(categoryBuckets.entries()).map(([key, bucket]) => ({
        key,
        label: bucket.label,
        averageScore: Number((bucket.total / bucket.count).toFixed(2)),
        responseCount: bucket.count
      })),
      recentComments: populated.flatMap((item) => item.recentComments).slice(0, 6)
    };
  }

  private async findSurveyRequestByToken(token: string) {
    const request = (await getCustomerSurveyRequestDelegate(this.prisma).findFirst({
      where: { token },
      include: {
        interestedParty: {
          select: {
            id: true,
            name: true,
            type: true
          }
        }
      }
    })) as (CustomerSurveyRequestRecord & {
      interestedParty: { id: string; name: string; type: InterestedPartyTypeValue };
    }) | null;

    if (!request) {
      throw new NotFoundException('Survey link was not found.');
    }

    return request;
  }

  private async refreshSurveyRequestStatusIfNeeded<T extends CustomerSurveyRequestRecord>(request: T) {
    if (request.status !== 'OPEN' || !request.expiresAt || request.expiresAt >= new Date()) {
      return request;
    }

    await getCustomerSurveyRequestDelegate(this.prisma).update({
      where: { id: request.id },
      data: { status: 'EXPIRED' }
    });

    return {
      ...request,
      status: 'EXPIRED'
    } as T;
  }

  private mapCustomerSurveyRequest(
    request: CustomerSurveyRequestRecord,
    interestedPartyName?: string
  ) {
    return {
      ...request,
      categoryLabels: this.normalizeCategoryLabels(request.categoryLabels),
      surveyUrl: `/survey/${request.token}`,
      interestedPartyName
    };
  }

  private surveyRequestTitle(party: InterestedPartyRecord) {
    return party.surveyTitle?.trim() || `${party.name} feedback survey`;
  }

  private defaultSurveyExpiry() {
    const date = new Date();
    date.setDate(date.getDate() + 30);
    return date;
  }

  private normalizeCategoryLabels(labels?: string[] | null) {
    const defaults = ['Quality', 'Delivery', 'Communication', 'Responsiveness', 'Issue resolution', 'Overall experience'];
    const normalized = (labels || [])
      .map((item) => item?.trim())
      .filter((item): item is string => Boolean(item))
      .slice(0, 6);

    while (normalized.length < defaults.length) {
      normalized.push(defaults[normalized.length]);
    }

    return normalized;
  }

  private validateSurveyScore(value: number, scaleMax: number, label: string) {
    if (value < 0 || value > scaleMax) {
      throw new BadRequestException(`${label} score must be between 0 and ${scaleMax}.`);
    }

    return value;
  }

  private validateSurveyRatings(
    ratings: Record<string, number> | null | undefined,
    labels: string[],
    scaleMax: number
  ) {
    if (!ratings || typeof ratings !== 'object') {
      throw new BadRequestException('Survey ratings are required.');
    }

    return labels.reduce<Record<string, number>>((result, label, index) => {
      const key = this.surveyLabelKey(label, index);
      const raw = ratings[key] ?? ratings[this.legacySurveyKey(index)];
      if (raw === undefined || raw === null || Number.isNaN(Number(raw))) {
        throw new BadRequestException(`Rating is missing for ${label}.`);
      }
      result[key] = this.validateSurveyScore(Number(raw), scaleMax, label);
      return result;
    }, {});
  }

  private readSurveyRating(
    ratings: Record<string, number> | null | undefined,
    label: string,
    index: number
  ) {
    if (!ratings) {
      return null;
    }
    const direct = ratings[this.surveyLabelKey(label, index)];
    if (direct != null) {
      return Number(direct);
    }
    const legacy = ratings[this.legacySurveyKey(index)];
    return legacy != null ? Number(legacy) : null;
  }

  private surveyHealthFromSummary(averageScore: number | null, lowScoreCount: number) {
    if (averageScore == null) {
      return 'NO_DATA' as const;
    }
    if (lowScoreCount > 0 || averageScore < 7) {
      return 'ATTENTION' as const;
    }
    if (averageScore < 9) {
      return 'WATCH' as const;
    }
    return 'STRONG' as const;
  }

  private surveyLabelKey(label: string, index: number) {
    const slug = label
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
    return slug || `question-${index + 1}`;
  }

  private legacySurveyKey(index: number) {
    return ['quality', 'delivery', 'communication', 'support'][index] || `legacy-${index + 1}`;
  }

  private normalizeText(value?: string | null) {
    const trimmed = value?.trim();
    return trimmed ? trimmed : null;
  }
}
