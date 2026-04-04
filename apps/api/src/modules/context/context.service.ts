import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import {
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
import { CreateInterestedPartyDto, InterestedPartyTypeValue } from './dto/create-interested-party.dto';
import { CreateNeedExpectationDto } from './dto/create-need-expectation.dto';
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
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
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
    const [internalIssues, externalIssues, interestedParties, needs, recentIssues] = await Promise.all([
      getContextIssueDelegate(this.prisma).count({ where: { tenantId, type: 'INTERNAL', deletedAt: null } }),
      getContextIssueDelegate(this.prisma).count({ where: { tenantId, type: 'EXTERNAL', deletedAt: null } }),
      getInterestedPartyDelegate(this.prisma).count({ where: { tenantId, deletedAt: null } }),
      getNeedExpectationDelegate(this.prisma).count({ where: { tenantId, deletedAt: null } }),
      getContextIssueDelegate(this.prisma).findMany({
        where: { tenantId, deletedAt: null },
        orderBy: [{ updatedAt: 'desc' }],
        take: 6
      })
    ]);

    return {
      summary: {
        internalIssues,
        externalIssues,
        interestedParties,
        needsExpectations: needs
      },
      recentIssues
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

    const needCounts = await Promise.all(
      items.map((item) =>
        getNeedExpectationDelegate(this.prisma).count({
          where: { tenantId, interestedPartyId: item.id, deletedAt: null }
        })
      )
    );

    return items.map((item, index) => ({
      ...item,
      needCount: needCounts[index]
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
      needs: await this.listNeeds(tenantId, { interestedPartyId: id })
    };
  }

  async createInterestedParty(tenantId: string, actorId: string, dto: CreateInterestedPartyDto) {
    const party = (await getInterestedPartyDelegate(this.prisma).create({
      data: {
        tenantId,
        name: dto.name.trim(),
        type: dto.type,
        description: this.normalizeText(dto.description)
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

    await getInterestedPartyDelegate(this.prisma).update({
      where: { id },
      data: {
        name: dto.name !== undefined ? dto.name.trim() : undefined,
        type: dto.type,
        description: dto.description !== undefined ? this.normalizeText(dto.description) : undefined
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

  private normalizeText(value?: string | null) {
    const trimmed = value?.trim();
    return trimmed ? trimmed : null;
  }
}
