import { Injectable, NotFoundException } from '@nestjs/common';
import PptxGenJS from 'pptxgenjs';
import { PrismaService } from '../../common/prisma/prisma.service';

type ReportSection = {
  label: string;
  value: string;
};

type LinkedInputRow = {
  source: string;
  title: string;
  summary: string;
};

type LinkedActionRow = {
  title: string;
  owner: string;
  dueDate: string;
  status: string;
};

type DeckData = {
  companyName: string;
  reviewTitle: string;
  reviewDate: string;
  status: string;
  chairperson: string;
  summary: string;
  inputSections: ReportSection[];
  outputSections: ReportSection[];
  linkedInputs: LinkedInputRow[];
  linkedActions: LinkedActionRow[];
  inputCompleted: number;
  inputMissing: number;
  outputCompleted: number;
  outputMissing: number;
  actionStatusLabels: string[];
  actionStatusValues: number[];
  sourceLabels: string[];
  sourceValues: number[];
};

@Injectable()
export class ManagementReviewPresentationService {
  constructor(private readonly prisma: PrismaService) {}

  async generateManagementReviewPresentation(tenantId: string, reviewId: string) {
    const review = await this.prisma.managementReview.findFirst({
      where: {
        tenantId,
        id: reviewId,
        deletedAt: null
      },
      include: {
        inputs: {
          orderBy: [{ createdAt: 'asc' }]
        }
      }
    });

    if (!review) {
      throw new NotFoundException('Management review not found');
    }

    const [tenant, settings, chairperson, actions] = await Promise.all([
      this.prisma.tenant.findUnique({
        where: { id: tenantId },
        select: { name: true }
      }),
      this.prisma.tenantSetting.findMany({
        where: {
          tenantId,
          key: { in: ['organization.companyName'] }
        }
      }),
      review.chairpersonId
        ? this.prisma.user.findFirst({
            where: { tenantId, id: review.chairpersonId },
            select: { firstName: true, lastName: true, email: true }
          })
        : Promise.resolve(null),
      this.prisma.actionItem.findMany({
        where: {
          tenantId,
          sourceType: 'management-review',
          sourceId: review.id,
          deletedAt: null
        },
        include: {
          owner: {
            select: { firstName: true, lastName: true, email: true }
          }
        },
        orderBy: [{ dueDate: 'asc' }, { createdAt: 'asc' }]
      })
    ]);

    const settingMap = new Map(settings.map((item) => [item.key, item.value]));
    const companyName =
      settingMap.get('organization.companyName') || tenant?.name || 'Integrated Management System';
    const chairpersonName = chairperson
      ? `${chairperson.firstName} ${chairperson.lastName}`.trim() || chairperson.email
      : 'Unassigned';

    const inputSections: ReportSection[] = [
      { label: 'Audit results', value: review.auditResults || 'No content recorded.' },
      { label: 'CAPA status', value: review.capaStatus || 'No content recorded.' },
      { label: 'KPI performance', value: review.kpiPerformance || 'No content recorded.' },
      {
        label: 'Customer and interested-party feedback',
        value: review.customerInterestedPartiesFeedback || 'No content recorded.'
      },
      { label: 'Provider performance', value: review.providerPerformance || 'No content recorded.' },
      {
        label: 'Compliance obligations',
        value: review.complianceObligations || 'No content recorded.'
      },
      {
        label: 'Incidents and emergency performance',
        value: review.incidentEmergencyPerformance || 'No content recorded.'
      },
      {
        label: 'Consultation and communication',
        value: review.consultationCommunication || 'No content recorded.'
      },
      { label: 'Risks and opportunities', value: review.risksOpportunities || 'No content recorded.' },
      {
        label: 'Changes affecting the system',
        value: review.changesAffectingSystem || 'No content recorded.'
      },
      { label: 'Previous actions', value: review.previousActions || 'No content recorded.' }
    ];

    const outputSections: ReportSection[] = [
      { label: 'Minutes', value: review.minutes || 'No content recorded.' },
      { label: 'Decisions', value: review.decisions || 'No content recorded.' },
      { label: 'Improvement actions', value: review.improvementActions || 'No content recorded.' },
      {
        label: 'System changes needed',
        value: review.systemChangesNeeded || 'No content recorded.'
      },
      {
        label: 'Objective and target changes',
        value: review.objectiveTargetChanges || 'No content recorded.'
      },
      { label: 'Resource needs', value: review.resourceNeeds || 'No content recorded.' },
      {
        label: 'Effectiveness conclusion',
        value: review.effectivenessConclusion || 'No content recorded.'
      },
      { label: 'Summary', value: review.summary || 'No content recorded.' }
    ];

    const linkedInputs: LinkedInputRow[] = review.inputs.map((item) => ({
      source: this.formatSourceType(item.sourceType),
      title: item.title,
      summary: item.summary || 'No linked summary'
    }));

    const linkedActions: LinkedActionRow[] = actions.map((item) => ({
      title: item.title,
      owner: item.owner
        ? `${item.owner.firstName} ${item.owner.lastName}`.trim() || item.owner.email
        : 'Unassigned',
      dueDate: this.formatDate(item.dueDate),
      status: this.formatStatus(item.status)
    }));

    const actionStatusCounts = new Map<string, number>();
    for (const action of linkedActions) {
      actionStatusCounts.set(action.status, (actionStatusCounts.get(action.status) || 0) + 1);
    }

    const sourceCounts = new Map<string, number>();
    for (const item of linkedInputs) {
      sourceCounts.set(item.source, (sourceCounts.get(item.source) || 0) + 1);
    }

    const deckData: DeckData = {
      companyName,
      reviewTitle: review.title,
      reviewDate: this.formatDate(review.reviewDate),
      status: this.formatStatus(review.status),
      chairperson: chairpersonName,
      summary:
        review.summary ||
        'Management review presentation summarising current inputs, outputs, linked evidence, and follow-up actions.',
      inputSections,
      outputSections,
      linkedInputs,
      linkedActions,
      inputCompleted: this.countCompletedSections(inputSections),
      inputMissing: inputSections.length - this.countCompletedSections(inputSections),
      outputCompleted: this.countCompletedSections(outputSections),
      outputMissing: outputSections.length - this.countCompletedSections(outputSections),
      actionStatusLabels: [...actionStatusCounts.keys()],
      actionStatusValues: [...actionStatusCounts.values()],
      sourceLabels: [...sourceCounts.keys()],
      sourceValues: [...sourceCounts.values()]
    };

    const buffer = await this.buildPresentation(deckData);
    const safeTitle = review.title.replace(/[^a-z0-9_-]+/gi, '-').replace(/^-+|-+$/g, '').toLowerCase();

    return {
      fileName: `${safeTitle || 'management-review'}-dashboard.pptx`,
      buffer
    };
  }

  private async buildPresentation(data: DeckData) {
    const pptx = new PptxGenJS();
    pptx.layout = 'LAYOUT_WIDE';
    pptx.author = data.chairperson;
    pptx.company = data.companyName;
    pptx.subject = 'Management review presentation';
    pptx.title = `${data.reviewTitle} dashboard`;

    this.addCoverSlide(pptx, data);
    this.addDashboardSlide(pptx, data);
    this.addSectionSlides(
      pptx,
      'Key Review Inputs',
      'Presentation view of the recorded management review inputs, trimmed for discussion use.',
      data.inputSections
    );
    this.addSectionSlides(
      pptx,
      'Decisions and Outputs',
      'Presentation view of the formal outputs, decisions, and follow-up direction.',
      data.outputSections
    );
    this.addEvidenceSlide(pptx, data);
    this.addActionsSlide(pptx, data);

    return (await pptx.write({
      outputType: 'nodebuffer',
      compression: true
    })) as Buffer;
  }

  private addCoverSlide(pptx: PptxGenJS, data: DeckData) {
    const slide = pptx.addSlide();
    slide.background = { color: 'F6F8F3' };
    slide.addShape(pptx.ShapeType.rect, {
      x: 0,
      y: 0,
      w: 13.33,
      h: 1.05,
      fill: { color: 'E7EEE7' },
      line: { color: 'E7EEE7' }
    });
    slide.addText('Management Review Dashboard', {
      x: 0.7,
      y: 1.0,
      w: 8.4,
      h: 0.5,
      fontFace: 'Aptos Display',
      fontSize: 26,
      bold: true,
      color: '173225'
    });
    slide.addText(data.reviewTitle, {
      x: 0.7,
      y: 1.7,
      w: 8.6,
      h: 0.7,
      fontFace: 'Aptos',
      fontSize: 22,
      bold: true,
      color: '203427'
    });
    slide.addText(data.summary, {
      x: 0.7,
      y: 2.55,
      w: 7.8,
      h: 1.0,
      fontFace: 'Aptos',
      fontSize: 13,
      color: '47584D',
      valign: 'middle'
    });

    this.addMetricCard(slide, 'Company', data.companyName, 9.35, 1.1, 3.1, 0.95);
    this.addMetricCard(slide, 'Review date', data.reviewDate, 9.35, 2.2, 1.48, 0.95);
    this.addMetricCard(slide, 'Status', data.status, 10.95, 2.2, 1.5, 0.95);
    this.addMetricCard(slide, 'Chairperson', data.chairperson, 9.35, 3.3, 3.1, 0.95);
  }

  private addDashboardSlide(pptx: PptxGenJS, data: DeckData) {
    const slide = this.addStandardSlide(pptx, 'Review Dashboard', 'Coverage and follow-up position for this completed management review.');

    this.addMetricCard(slide, 'Inputs completed', `${data.inputCompleted}/${data.inputSections.length}`, 0.7, 1.15, 1.9, 0.9);
    this.addMetricCard(slide, 'Outputs completed', `${data.outputCompleted}/${data.outputSections.length}`, 2.8, 1.15, 1.9, 0.9);
    this.addMetricCard(slide, 'Linked evidence', String(data.linkedInputs.length), 4.9, 1.15, 1.9, 0.9);
    this.addMetricCard(slide, 'Linked actions', String(data.linkedActions.length), 7.0, 1.15, 1.9, 0.9);

    slide.addChart(
      pptx.ChartType.doughnut,
      [
        {
          name: 'Input coverage',
          labels: ['Completed', 'Missing'],
          values: [data.inputCompleted, Math.max(data.inputMissing, 0)]
        }
      ],
      {
        x: 0.7,
        y: 2.35,
        w: 3.8,
        h: 2.7,
        holeSize: 58,
        showLegend: true,
        legendPos: 'b',
        showTitle: true,
        title: 'Input coverage',
        chartColors: ['335E4C', 'D9E2DB'],
        showValue: true,
        showPercent: true
      }
    );

    slide.addChart(
      pptx.ChartType.doughnut,
      [
        {
          name: 'Output coverage',
          labels: ['Completed', 'Missing'],
          values: [data.outputCompleted, Math.max(data.outputMissing, 0)]
        }
      ],
      {
        x: 4.8,
        y: 2.35,
        w: 3.8,
        h: 2.7,
        holeSize: 58,
        showLegend: true,
        legendPos: 'b',
        showTitle: true,
        title: 'Output coverage',
        chartColors: ['658C6A', 'D9E2DB'],
        showValue: true,
        showPercent: true
      }
    );

    slide.addChart(
      pptx.ChartType.bar,
      [
        {
          name: 'Actions',
          labels: data.actionStatusLabels.length ? data.actionStatusLabels : ['No actions'],
          values: data.actionStatusValues.length ? data.actionStatusValues : [0]
        }
      ],
      {
        x: 8.9,
        y: 2.35,
        w: 3.7,
        h: 2.7,
        catAxisLabelFontSize: 10,
        valAxisLabelFontSize: 10,
        showLegend: false,
        showTitle: true,
        title: 'Follow-up action status',
        chartColors: ['B37A3B'],
        showValue: true
      }
    );
  }

  private addSectionSlides(
    pptx: PptxGenJS,
    title: string,
    subtitle: string,
    sections: ReportSection[]
  ) {
    const chunks = this.chunk(sections, 4);

    chunks.forEach((chunk, index) => {
      const slide = this.addStandardSlide(
        pptx,
        chunks.length > 1 ? `${title} (${index + 1}/${chunks.length})` : title,
        subtitle
      );

      chunk.forEach((section, itemIndex) => {
        const column = itemIndex % 2;
        const row = Math.floor(itemIndex / 2);
        const x = column === 0 ? 0.7 : 6.65;
        const y = 1.45 + row * 2.15;
        this.addSectionGridCard(slide, section, x, y, 5.95, 1.78);
      });
    });
  }

  private addEvidenceSlide(pptx: PptxGenJS, data: DeckData) {
    const slide = this.addStandardSlide(
      pptx,
      'Evidence Mix',
      'Live linked records that informed the management review inputs.'
    );

    slide.addChart(
      pptx.ChartType.bar,
      [
        {
          name: 'Linked evidence',
          labels: data.sourceLabels.length ? data.sourceLabels : ['No linked evidence'],
          values: data.sourceValues.length ? data.sourceValues : [0]
        }
      ],
      {
        x: 0.7,
        y: 1.45,
        w: 5.2,
        h: 3.3,
        showLegend: false,
        showTitle: true,
        title: 'Evidence sources',
        chartColors: ['335E4C'],
        showValue: true,
        catAxisLabelFontSize: 10,
        valAxisLabelFontSize: 10
      }
    );

    const evidenceRows = data.linkedInputs.length
      ? data.linkedInputs.slice(0, 6).map((item) => [
          item.source,
          this.truncate(item.title, 48),
          this.truncate(item.summary, 62)
        ])
      : [['-', 'No linked record', 'This review was recorded without explicitly linked evidence rows.']];

    slide.addTable(this.asTableRows([['Source', 'Title', 'Summary'], ...evidenceRows]), {
      x: 6.15,
      y: 1.55,
      w: 6.15,
      rowH: 0.42,
      fontFace: 'Aptos',
      fontSize: 10,
      color: '24362D',
      fill: { color: 'FFFFFF' },
      border: { type: 'solid', color: 'D7DFDA', pt: 1 },
      bold: false,
      valign: 'middle',
      colW: [1.15, 2.15, 2.85]
    });
  }

  private addActionsSlide(pptx: PptxGenJS, data: DeckData) {
    const slide = this.addStandardSlide(
      pptx,
      'Follow-up Actions',
      'Management review actions that need ownership and closure after the meeting.'
    );

    const actionRows = data.linkedActions.length
      ? data.linkedActions.slice(0, 10).map((item) => [
          this.truncate(item.title, 46),
          this.truncate(item.owner, 18),
          item.dueDate,
          item.status
        ])
      : [['No linked action', '-', '-', 'No action has been raised from this review yet.']];

    slide.addTable(this.asTableRows([['Action', 'Owner', 'Due date', 'Status'], ...actionRows]), {
      x: 0.7,
      y: 1.55,
      w: 12.0,
      rowH: 0.4,
      fontFace: 'Aptos',
      fontSize: 10,
      color: '24362D',
      fill: { color: 'FFFFFF' },
      border: { type: 'solid', color: 'D7DFDA', pt: 1 },
      bold: false,
      valign: 'middle',
      colW: [5.8, 2.2, 1.8, 2.2]
    });
  }

  private addStandardSlide(pptx: PptxGenJS, title: string, subtitle: string) {
    const slide = pptx.addSlide();
    slide.background = { color: 'F9FBF8' };
    slide.addText(title, {
      x: 0.7,
      y: 0.45,
      w: 7.2,
      h: 0.45,
      fontFace: 'Aptos Display',
      fontSize: 22,
      bold: true,
      color: '173225'
    });
    slide.addText(subtitle, {
      x: 0.7,
      y: 0.92,
      w: 8.8,
      h: 0.35,
      fontFace: 'Aptos',
      fontSize: 11,
      color: '5B6C62'
    });
    return slide;
  }

  private addMetricCard(
    slide: PptxGenJS.Slide,
    label: string,
    value: string,
    x: number,
    y: number,
    w: number,
    h: number
  ) {
    slide.addShape('roundRect', {
      x,
      y,
      w,
      h,
      rectRadius: 0.1,
      fill: { color: 'FFFFFF' },
      line: { color: 'D7DFDA', pt: 1 }
    });
    slide.addText(label, {
      x: x + 0.12,
      y: y + 0.12,
      w: w - 0.24,
      h: 0.18,
      fontFace: 'Aptos',
      fontSize: 10,
      color: '6A7A71',
      bold: true
    });
    slide.addText(this.truncate(value, 42), {
      x: x + 0.12,
      y: y + 0.36,
      w: w - 0.24,
      h: h - 0.42,
      fontFace: 'Aptos',
      fontSize: 16,
      color: '173225',
      bold: true,
      fit: 'shrink'
    });
  }

  private addSectionGridCard(
    slide: PptxGenJS.Slide,
    section: ReportSection,
    x: number,
    y: number,
    width: number,
    height: number
  ) {
    slide.addShape('roundRect', {
      x,
      y,
      w: width,
      h: height,
      rectRadius: 0.08,
      fill: { color: 'FFFFFF' },
      line: { color: 'D7DFDA', pt: 1 }
    });
    slide.addText(section.label, {
      x: x + 0.16,
      y: y + 0.12,
      w: width - 0.32,
      h: 0.2,
      fontFace: 'Aptos',
      fontSize: 10,
      color: '5B6C62',
      bold: true
    });
    slide.addText(this.summarizeForSlide(section.value, 280), {
      x: x + 0.16,
      y: y + 0.4,
      w: width - 0.32,
      h: height - 0.5,
      fontFace: 'Aptos',
      fontSize: 10,
      color: '24362D',
      valign: 'top',
      breakLine: false,
      fit: 'shrink'
    });
  }

  private asTableRows(rows: string[][]) {
    return rows.map((row) => row.map((cell) => ({ text: cell })));
  }

  private countCompletedSections(sections: ReportSection[]) {
    return sections.filter((section) => !section.value.startsWith('No content recorded')).length;
  }

  private cleanSectionValue(value: string) {
    return value.replace(/\s+/g, ' ').trim();
  }

  private summarizeForSlide(value: string, maxLength: number) {
    const clean = this.cleanSectionValue(value);
    if (!clean || clean === 'No content recorded.') {
      return 'No content recorded yet for this section.';
    }

    const sentences = clean
      .split(/(?<=[.!?])\s+/)
      .map((sentence) => sentence.trim())
      .filter(Boolean);

    const selected: string[] = [];
    for (const sentence of sentences) {
      const next = [...selected, sentence].join(' ');
      if (next.length > maxLength) {
        break;
      }
      selected.push(sentence);
      if (selected.length === 2) {
        break;
      }
    }

    const summary = selected.join(' ') || clean;
    return this.truncate(summary, maxLength);
  }

  private chunk<T>(items: T[], size: number) {
    const chunks: T[][] = [];
    for (let index = 0; index < items.length; index += size) {
      chunks.push(items.slice(index, index + size));
    }
    return chunks;
  }

  private truncate(value: string, maxLength: number) {
    if (value.length <= maxLength) {
      return value;
    }
    return `${value.slice(0, maxLength - 3).trimEnd()}...`;
  }

  private formatSourceType(value: string) {
    const normalized = value.trim().toLowerCase();
    if (normalized === 'capa') return 'CAPA';
    if (normalized === 'kpi') return 'KPI';
    if (normalized === 'audit') return 'Audit';
    if (normalized === 'risk') return 'Risk';
    return normalized.charAt(0).toUpperCase() + normalized.slice(1);
  }

  private formatStatus(value: string) {
    return value.replace(/_/g, ' ');
  }

  private formatDate(value?: Date | null) {
    return value ? value.toISOString().slice(0, 10) : 'Not set';
  }
}
