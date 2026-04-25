import { Injectable, NotFoundException } from '@nestjs/common';
import PDFDocument from 'pdfkit';
import { PrismaService } from '../../common/prisma/prisma.service';

type PdfDocument = InstanceType<typeof PDFDocument>;

type ReportResult = {
  fileName: string;
  buffer: Buffer;
};

type ReportSection = {
  label: string;
  value: string;
};

type ReportActionRow = {
  title: string;
  owner: string;
  dueDate: string;
  status: string;
};

@Injectable()
export class ManagementReviewReportService {
  constructor(private readonly prisma: PrismaService) {}

  async generateManagementReviewReport(
    tenantId: string,
    reviewId: string
  ): Promise<ReportResult> {
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
      { label: 'Agenda', value: review.agenda || 'No agenda recorded.' },
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
        label: 'Incidents and response performance',
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

    const linkedInputs = review.inputs.map((item) => ({
      source: this.formatSourceType(item.sourceType),
      title: item.title,
      summary: item.summary || 'No linked summary'
    }));

    const linkedActions: ReportActionRow[] = actions.map((item) => ({
      title: item.title,
      owner: item.owner
        ? `${item.owner.firstName} ${item.owner.lastName}`.trim() || item.owner.email
        : 'Unassigned',
      dueDate: this.formatDate(item.dueDate),
      status: this.formatActionStatus(item.status)
    }));

    const buffer = await this.renderPdf({
      companyName,
      reviewTitle: review.title,
      reviewDate: this.formatDate(review.reviewDate),
      status: this.formatStatus(review.status),
      chairperson: chairpersonName,
      summary:
        review.summary ||
        'Formal management review protocol covering review inputs, outputs, and linked follow-up actions.',
      inputSections,
      outputSections,
      linkedInputs,
      linkedActions
    });

    const safeTitle = review.title.replace(/[^a-z0-9_-]+/gi, '-').replace(/^-+|-+$/g, '').toLowerCase();

    return {
      fileName: `${safeTitle || 'management-review'}-protocol.pdf`,
      buffer
    };
  }

  private renderPdf(data: {
    companyName: string;
    reviewTitle: string;
    reviewDate: string;
    status: string;
    chairperson: string;
    summary: string;
    inputSections: ReportSection[];
    outputSections: ReportSection[];
    linkedInputs: Array<{ source: string; title: string; summary: string }>;
    linkedActions: ReportActionRow[];
  }) {
    return new Promise<Buffer>((resolve) => {
      const doc = new PDFDocument({
        size: 'A4',
        margin: 52,
        bufferPages: true,
        info: {
          Title: 'Management Review Protocol',
          Author: data.chairperson,
          Subject: 'Management review protocol'
        }
      });

      const chunks: Buffer[] = [];
      doc.on('data', (chunk) => chunks.push(chunk as Buffer));
      doc.on('end', () => resolve(Buffer.concat(chunks)));

      this.drawCoverPage(doc, data);
      doc.addPage();

      this.drawHeader(doc, data);
      this.drawSectionHeading(doc, 'Meeting Overview');
      this.drawSummaryCard(doc, 'Review date', data.reviewDate);
      this.drawSummaryCard(doc, 'Chairperson', data.chairperson);
      this.drawSummaryCard(doc, 'Status', data.status);

      this.drawSectionHeading(doc, 'Executive Summary');
      this.drawParagraph(doc, data.summary);

      this.drawSectionHeading(doc, 'Linked Evidence Inputs');
      this.drawInputTable(doc, data.linkedInputs);

      this.drawSectionHeading(doc, 'Management Review Inputs');
      data.inputSections.forEach((section) => this.drawTextSection(doc, section));

      this.drawSectionHeading(doc, 'Management Review Outputs');
      data.outputSections.forEach((section) => this.drawTextSection(doc, section));

      this.drawSectionHeading(doc, 'Linked Follow-up Actions');
      this.drawActionTable(doc, data.linkedActions);

      this.drawHeaderAndFooter(doc, data);
      doc.end();
    });
  }

  private drawCoverPage(
    doc: PdfDocument,
    data: {
      companyName: string;
      reviewTitle: string;
      reviewDate: string;
      status: string;
      chairperson: string;
    }
  ) {
    doc.roundedRect(44, 44, 507, 744, 18).lineWidth(1).strokeColor('#D7DFDA').stroke();

    doc
      .font('Helvetica')
      .fontSize(11)
      .fillColor('#5B6C62')
      .text(data.companyName, 76, 98, { characterSpacing: 1.8 });

    doc
      .font('Helvetica-Bold')
      .fontSize(30)
      .fillColor('#173225')
      .text('Management Review Protocol', 76, 150, { width: 390, lineGap: 4 });

    doc
      .font('Helvetica')
      .fontSize(18)
      .fillColor('#355145')
      .text('Integrated Management System', 76, 228);

    doc.roundedRect(76, 315, 412, 82, 14).lineWidth(1).fillAndStroke('#FBFCFB', '#D7DFDA');

    doc
      .font('Helvetica-Bold')
      .fontSize(10)
      .fillColor('#5B6C62')
      .text('MEETING TITLE', 96, 334, { characterSpacing: 1 });

    doc
      .font('Helvetica-Bold')
      .fontSize(18)
      .fillColor('#173225')
      .text(data.reviewTitle, 96, 352, { width: 372, lineGap: 3 });

    this.drawCoverMeta(doc, 'Review date', data.reviewDate, 76, 596);
    this.drawCoverMeta(doc, 'Chairperson', data.chairperson, 300, 596);
    this.drawCoverMeta(doc, 'Status', data.status, 76, 662);
    this.drawCoverMeta(doc, 'Company name', data.companyName, 300, 662);
  }

  private drawCoverMeta(doc: PdfDocument, label: string, value: string, x: number, y: number) {
    doc
      .font('Helvetica-Bold')
      .fontSize(9)
      .fillColor('#5B6C62')
      .text(label.toUpperCase(), x, y, { characterSpacing: 1.1 });

    doc
      .font('Helvetica')
      .fontSize(12)
      .fillColor('#173225')
      .text(value, x, y + 18, { width: 180 });
  }

  private drawHeaderAndFooter(
    doc: PdfDocument,
    data: { companyName: string; reviewTitle: string }
  ) {
    const range = doc.bufferedPageRange();

    for (let index = 0; index < range.count; index += 1) {
      doc.switchToPage(range.start + index);

      if (index > 0) {
        this.drawHeader(doc, data);
      }

      const pageLabel = `Page ${index + 1} of ${range.count}`;
      doc
        .font('Helvetica')
        .fontSize(9)
        .fillColor('#6A7A71')
        .text(`${data.reviewTitle} | ${pageLabel}`, 52, 806, {
          width: 491,
          align: 'right'
        });
    }
  }

  private drawHeader(
    doc: PdfDocument,
    data: { companyName: string; reviewTitle: string }
  ) {
    doc
      .font('Helvetica-Bold')
      .fontSize(12)
      .fillColor('#173225')
      .text('Management Review Protocol', 52, 28, { width: 300 });

    doc
      .font('Helvetica')
      .fontSize(10)
      .fillColor('#5B6C62')
      .text(`${data.companyName} | ${data.reviewTitle}`, 300, 30, {
        width: 243,
        align: 'right'
      });

    doc.moveTo(52, 52).lineTo(543, 52).lineWidth(1).strokeColor('#D7DFDA').stroke();
    doc.y = Math.max(doc.y, 74);
  }

  private drawSectionHeading(doc: PdfDocument, heading: string) {
    this.ensurePageSpace(doc, 42);
    doc.moveDown(0.7);
    doc.x = 52;
    doc
      .font('Helvetica-Bold')
      .fontSize(18)
      .fillColor('#173225')
      .text(heading, 52, doc.y, { width: 491 });
    doc.moveDown(0.25);
    doc.x = 52;
  }

  private drawSummaryCard(doc: PdfDocument, label: string, value: string) {
    const contentHeight = Math.max(24, this.heightForText(doc, value, 455, 11, 'Helvetica'));
    const cardHeight = 38 + contentHeight;
    this.ensurePageSpace(doc, cardHeight + 12);
    const y = doc.y;

    doc.roundedRect(52, y, 491, cardHeight, 12).lineWidth(1).fillAndStroke('#FBFCFB', '#D7DFDA');

    doc
      .font('Helvetica-Bold')
      .fontSize(10)
      .fillColor('#5B6C62')
      .text(label.toUpperCase(), 68, y + 11, { characterSpacing: 1 });

    doc
      .font('Helvetica')
      .fontSize(11)
      .fillColor('#24362D')
      .text(value, 68, y + 26, { width: 455, lineGap: 2 });

    doc.y = y + cardHeight + 10;
  }

  private drawParagraph(doc: PdfDocument, value: string) {
    const paragraphHeight = this.heightForText(doc, value, 491, 11, 'Helvetica');
    this.ensurePageSpace(doc, paragraphHeight + 18);
    doc.x = 52;
    doc.font('Helvetica').fontSize(11).fillColor('#24362D').text(value, 52, doc.y, {
      width: 491,
      lineGap: 3
    });
    doc.moveDown(0.75);
    doc.x = 52;
  }

  private drawTextSection(doc: PdfDocument, section: ReportSection) {
    const valueHeight = this.heightForText(doc, section.value, 455, 10.5, 'Helvetica');
    const cardHeight = 42 + valueHeight;
    this.ensurePageSpace(doc, cardHeight + 10);
    const y = doc.y;

    doc.roundedRect(52, y, 491, cardHeight, 12).lineWidth(1).fillAndStroke('#FFFFFF', '#D7DFDA');

    doc
      .font('Helvetica-Bold')
      .fontSize(10)
      .fillColor('#5B6C62')
      .text(section.label.toUpperCase(), 68, y + 12, { width: 455, characterSpacing: 0.8 });

    doc
      .font('Helvetica')
      .fontSize(10.5)
      .fillColor('#24362D')
      .text(section.value, 68, y + 28, { width: 455, lineGap: 2 });

    doc.y = y + cardHeight + 10;
  }

  private drawInputTable(
    doc: PdfDocument,
    rows: Array<{ source: string; title: string; summary: string }>
  ) {
    this.drawTable(
      doc,
      ['Source', 'Title', 'Summary'],
      rows.length
        ? rows.map((item) => [item.source, item.title, item.summary])
        : [['-', 'No linked records', 'This meeting was prepared from manually recorded content.']],
      [96, 175, 220]
    );
  }

  private drawActionTable(doc: PdfDocument, rows: ReportActionRow[]) {
    this.drawTable(
      doc,
      ['Action', 'Owner', 'Due date', 'Status'],
      rows.length
        ? rows.map((item) => [item.title, item.owner, item.dueDate, item.status])
        : [['No linked actions', '-', '-', 'No follow-up action has been linked to this review yet.']],
      rows.length ? [220, 110, 75, 86] : [220, 90, 80, 101]
    );
  }

  private drawTable(doc: PdfDocument, headers: string[], rows: string[][], widths: number[]) {
    const startX = 52;
    const headerHeight = 28;

    const drawRow = (cells: string[], isHeader = false) => {
      const height = isHeader
        ? headerHeight
        : Math.max(
            34,
            ...cells.map((cell, index) =>
              this.heightForText(doc, cell, widths[index] - 14, 9.5, 'Helvetica') + 14
            )
          );

      this.ensurePageSpace(doc, height + 10);
      const y = doc.y;
      let x = startX;

      cells.forEach((cell, index) => {
        const width = widths[index];
        doc.rect(x, y, width, height).fillAndStroke(isHeader ? '#F3F6F4' : '#FFFFFF', '#D7DFDA');
        doc
          .font(isHeader ? 'Helvetica-Bold' : 'Helvetica')
          .fontSize(isHeader ? 10 : 9.5)
          .fillColor(isHeader ? '#4A5D53' : '#24362D')
          .text(cell, x + 7, y + (isHeader ? 9 : 7), { width: width - 14, lineGap: 1 });
        x += width;
      });

      doc.y = y + height;
    };

    drawRow(headers, true);
    rows.forEach((row) => drawRow(row));
    doc.moveDown(0.6);
    doc.x = 52;
  }

  private ensurePageSpace(doc: PdfDocument, requiredHeight: number) {
    if (doc.y + requiredHeight > 770) {
      doc.addPage();
    }
  }

  private heightForText(
    doc: PdfDocument,
    text: string,
    width: number,
    fontSize: number,
    fontName: string
  ) {
    return doc.font(fontName).fontSize(fontSize).heightOfString(text || '-', {
      width,
      lineGap: 2
    });
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

  private formatActionStatus(value: string) {
    return value.replace(/_/g, ' ');
  }

  private formatDate(value?: Date | null) {
    return value ? value.toISOString().slice(0, 10) : 'Not set';
  }
}
