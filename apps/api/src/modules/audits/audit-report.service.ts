import { Injectable, NotFoundException } from '@nestjs/common';
import PDFDocument from 'pdfkit';
import { AuditFindingSeverity, AuditFindingStatus } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';
import { buildAuditReportHtml, type AuditReportTemplateData } from './audit-report.template';

type PdfDocument = InstanceType<typeof PDFDocument>;

type ReportResult = {
  fileName: string;
  buffer: Buffer;
  html: string;
};

type DetailedFindingRow = AuditReportTemplateData['detailedFindings'][number];
type SummaryFindingRow = AuditReportTemplateData['findingsSummary'][number];

@Injectable()
export class AuditReportService {
  constructor(private readonly prisma: PrismaService) {}

  async generateAuditReport(tenantId: string, auditId: string): Promise<ReportResult> {
    const audit = await this.prisma.audit.findFirst({
      where: {
        tenantId,
        id: auditId,
        deletedAt: null
      },
      include: {
        checklistItems: {
          orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }]
        },
        findings: {
          orderBy: [{ createdAt: 'asc' }]
        }
      }
    });

    if (!audit) {
      throw new NotFoundException('Audit not found');
    }

    const [tenant, settings, users, actionItems, ncrs, capas] = await Promise.all([
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
      this.prisma.user.findMany({
        where: { tenantId },
        select: { id: true, firstName: true, lastName: true, email: true }
      }),
      this.prisma.actionItem.findMany({
        where: {
          tenantId,
          sourceType: 'audit',
          sourceId: audit.id,
          deletedAt: null
        },
        orderBy: [{ createdAt: 'asc' }]
      }),
      this.prisma.ncr.findMany({
        where: {
          tenantId,
          source: 'AUDIT',
          deletedAt: null
        },
        select: {
          id: true,
          referenceNo: true,
          title: true,
          description: true
        }
      }),
      this.prisma.capa.findMany({
        where: {
          tenantId,
          deletedAt: null,
          source: { contains: 'Finding' }
        },
        select: {
          id: true,
          title: true,
          problemStatement: true
        }
      })
    ]);

    const settingMap = new Map(settings.map((item) => [item.key, item.value]));
    const companyName =
      settingMap.get('organization.companyName') || tenant?.name || 'Integrated Management System';
    const usersById = new Map(
      users.map((user) => [user.id, `${user.firstName} ${user.lastName}`.trim() || user.email])
    );
    const checklistById = new Map(audit.checklistItems.map((item) => [item.id, item]));

    const findingsSummary: SummaryFindingRow[] = audit.findings.map((finding, index) => ({
      id: this.findingReference(index),
      clause: finding.clause || 'General',
      type: this.formatFindingSeverity(finding.severity),
      description: this.truncate(finding.description, 110),
      status: this.formatFindingStatus(finding.status)
    }));

    const detailedFindings: DetailedFindingRow[] = audit.findings.map((finding, index) => {
      const checklistItem = finding.checklistItemId ? checklistById.get(finding.checklistItemId) : null;
      return {
        id: this.findingReference(index),
        clause: finding.clause || 'General',
        requirement: checklistItem?.title || 'Requirement reference was not captured during the audit.',
        finding: finding.description,
        evidence:
          checklistItem?.notes?.trim() ||
          'Objective evidence was not separately recorded in the checklist notes.',
        action: this.resolveLinkedResolution(finding, actionItems, ncrs, capas)
      };
    });

    const reportData: AuditReportTemplateData = {
      reportTitle: 'Internal Audit Report',
      systemName: 'Integrated Management System',
      companyName,
      auditCode: audit.code,
      auditTitle: audit.title,
      standard: audit.standard || audit.type,
      auditDate: this.formatDate(audit.completedAt ?? audit.scheduledAt ?? audit.createdAt),
      auditor:
        usersById.get(audit.completedByAuditorId || audit.leadAuditorId || '') || 'Assigned auditor not recorded',
      objective:
        audit.summary ||
        'To determine whether the audited arrangements are suitable, implemented, and effective against the defined audit criteria.',
      scope: audit.scope || 'Scope not specified in the audit record.',
      criteria: this.buildCriteria(audit.standard, audit.type),
      executiveSummary: this.buildExecutiveSummary(audit.findings.length, findingsSummary),
      findingsSummary,
      detailedFindings,
      auditConclusion: audit.conclusion || 'Audit conclusion not yet recorded in the close-out section.'
    };

    const html = buildAuditReportHtml(reportData);
    const buffer = await this.renderPdf(reportData);
    const safeTitle = audit.code.replace(/[^a-z0-9_-]+/gi, '-').toLowerCase();

    return {
      fileName: `${safeTitle || 'audit-report'}.pdf`,
      buffer,
      html
    };
  }

  private renderPdf(data: AuditReportTemplateData) {
    return new Promise<Buffer>((resolve) => {
      const doc = new PDFDocument({
        size: 'A4',
        margin: 52,
        bufferPages: true,
        info: {
          Title: data.reportTitle,
          Author: data.auditor,
          Subject: `${data.standard} internal audit report`
        }
      });

      const chunks: Buffer[] = [];
      doc.on('data', (chunk) => chunks.push(chunk as Buffer));
      doc.on('end', () => resolve(Buffer.concat(chunks)));

      this.drawCoverPage(doc, data);
      doc.addPage();

      this.drawHeader(doc, data);
      this.drawSectionHeading(doc, 'Audit Summary');
      this.drawSummaryCard(doc, 'Objective', data.objective);
      this.drawSummaryCard(doc, 'Scope', data.scope);
      this.drawSummaryCard(doc, 'Criteria', data.criteria);

      this.drawSectionHeading(doc, 'Executive Summary');
      this.drawParagraph(doc, data.executiveSummary);

      this.drawSectionHeading(doc, 'Findings Summary');
      this.drawFindingsSummaryTable(doc, data.findingsSummary);

      this.drawSectionHeading(doc, 'Detailed Findings');
      if (!data.detailedFindings.length) {
        this.drawParagraph(doc, 'No findings were recorded during this audit.');
      } else {
        data.detailedFindings.forEach((finding) => this.drawDetailedFinding(doc, finding));
      }

      this.drawSectionHeading(doc, 'Audit Conclusion');
      this.drawParagraph(doc, data.auditConclusion);

      this.drawHeaderAndFooter(doc, data);
      doc.end();
    });
  }

  private drawCoverPage(doc: PdfDocument, data: AuditReportTemplateData) {
    doc
      .roundedRect(44, 44, 507, 744, 18)
      .lineWidth(1)
      .strokeColor('#D7DFDA')
      .stroke();

    doc
      .font('Helvetica')
      .fontSize(11)
      .fillColor('#5B6C62')
      .text(data.companyName, 76, 98, { characterSpacing: 1.8 });

    doc
      .font('Helvetica-Bold')
      .fontSize(30)
      .fillColor('#173225')
      .text(data.reportTitle, 76, 150, { width: 390, lineGap: 4 });

    doc
      .font('Helvetica')
      .fontSize(18)
      .fillColor('#355145')
      .text(data.systemName, 76, 228);

    doc
      .font('Helvetica-Bold')
      .fontSize(13)
      .fillColor('#5B6C62')
      .text(`Standard: ${data.standard}`, 76, 270);

    doc
      .roundedRect(76, 315, 412, 82, 14)
      .lineWidth(1)
      .fillAndStroke('#FBFCFB', '#D7DFDA');

    doc
      .font('Helvetica-Bold')
      .fontSize(10)
      .fillColor('#5B6C62')
      .text('AUDIT TITLE', 96, 334, { characterSpacing: 1 });

    doc
      .font('Helvetica-Bold')
      .fontSize(18)
      .fillColor('#173225')
      .text(data.auditTitle, 96, 352, { width: 372, lineGap: 3 });

    this.drawCoverMeta(doc, 'Audit reference', data.auditCode, 76, 596);
    this.drawCoverMeta(doc, 'Company name', data.companyName, 300, 596);
    this.drawCoverMeta(doc, 'Audit date', data.auditDate, 76, 662);
    this.drawCoverMeta(doc, 'Auditor', data.auditor, 300, 662);
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

  private drawHeaderAndFooter(doc: PdfDocument, data: AuditReportTemplateData) {
    const range = doc.bufferedPageRange();

    for (let index = 0; index < range.count; index += 1) {
      doc.switchToPage(range.start + index);

      if (index > 0) {
        this.drawHeader(doc, data);
      }

      const pageNumber = index + 1;
      const pageLabel = `Page ${pageNumber} of ${range.count}`;
      doc
        .font('Helvetica')
        .fontSize(9)
        .fillColor('#6A7A71')
        .text(`${data.auditCode} | ${pageLabel}`, 52, 806, {
          width: 491,
          align: 'right'
        });
    }
  }

  private drawHeader(doc: PdfDocument, data: AuditReportTemplateData) {
    doc
      .font('Helvetica-Bold')
      .fontSize(12)
      .fillColor('#173225')
      .text(data.reportTitle, 52, 28, { width: 300 });
    doc
      .font('Helvetica')
      .fontSize(10)
      .fillColor('#5B6C62')
      .text(`${data.companyName} | ${data.auditCode}`, 300, 30, { width: 243, align: 'right' });
    doc
      .moveTo(52, 52)
      .lineTo(543, 52)
      .lineWidth(1)
      .strokeColor('#D7DFDA')
      .stroke();
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
    doc
      .roundedRect(52, y, 491, cardHeight, 12)
      .lineWidth(1)
      .fillAndStroke('#FBFCFB', '#D7DFDA');
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
    doc
      .font('Helvetica')
      .fontSize(11)
      .fillColor('#24362D')
      .text(value, 52, doc.y, { width: 491, lineGap: 3 });
    doc.moveDown(0.75);
    doc.x = 52;
  }

  private drawFindingsSummaryTable(doc: PdfDocument, rows: SummaryFindingRow[]) {
    const headers = ['ID', 'Clause', 'Type', 'Description', 'Status'];
    const widths = [52, 60, 112, 207, 60];
    this.drawTable(
      doc,
      headers,
      rows.map((finding) => [
        finding.id,
        finding.clause,
        finding.type,
        finding.description,
        finding.status
      ]),
      widths
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
        doc
          .rect(x, y, width, height)
          .fillAndStroke(isHeader ? '#F3F6F4' : '#FFFFFF', '#D7DFDA');
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
    if (!rows.length) {
      drawRow(['-', '-', '-', 'No findings recorded during this audit.', '-']);
      doc.moveDown(0.6);
      return;
    }

    rows.forEach((row) => drawRow(row));
    doc.moveDown(0.6);
    doc.x = 52;
  }

  private drawDetailedFinding(doc: PdfDocument, finding: DetailedFindingRow) {
    const rows: Array<[string, string]> = [
      ['Requirement', finding.requirement],
      ['Finding', finding.finding],
      ['Evidence', finding.evidence],
      ['Action', finding.action]
    ];
    this.ensurePageSpace(doc, 54);
    const top = doc.y;

    doc
      .roundedRect(52, top, 491, 32, 12)
      .lineWidth(1)
      .fillAndStroke('#F7FAF8', '#D7DFDA');

    doc
      .font('Helvetica-Bold')
      .fontSize(11)
      .fillColor('#173225')
      .text(`${finding.id} | Clause ${finding.clause}`, 70, top + 10, { width: 455 });

    doc.y = top + 44;

    rows.forEach(([label, value]) => this.drawDetailedFindingField(doc, label, value));

    this.ensurePageSpace(doc, 14);
    doc
      .moveTo(52, doc.y)
      .lineTo(543, doc.y)
      .lineWidth(1)
      .strokeColor('#E5EBE7')
      .stroke();
    doc.moveDown(0.85);
    doc.x = 52;
  }

  private drawDetailedFindingField(doc: PdfDocument, label: string, value: string) {
    const valueHeight = this.heightForText(doc, value, 491, 10, 'Helvetica');
    this.ensurePageSpace(doc, valueHeight + 26);

    doc
      .font('Helvetica-Bold')
      .fontSize(9.5)
      .fillColor('#5B6C62')
      .text(label.toUpperCase(), 52, doc.y, { width: 491, characterSpacing: 0.8 });

    doc.moveDown(0.15);

    doc
      .font('Helvetica')
      .fontSize(10)
      .fillColor('#24362D')
      .text(value, 52, doc.y, { width: 491, lineGap: 2 });

    doc.moveDown(0.55);
    doc.x = 52;
  }

  private ensurePageSpace(doc: PdfDocument, requiredHeight: number) {
    if (doc.y + requiredHeight > 770) {
      doc.addPage();
    }
  }

  private buildCriteria(standard?: string | null, type?: string | null) {
    if (standard) {
      return `${standard}, the tenant internal audit checklist, and applicable documented Integrated Management System controls.`;
    }

    return `${type || 'Audit'} requirements, agreed checklist criteria, and applicable operational controls.`;
  }

  private buildExecutiveSummary(findingCount: number, findings: SummaryFindingRow[]) {
    if (!findingCount) {
      return 'The audit was completed without recorded findings. The audited arrangements appeared to be implemented and generally effective against the defined audit criteria.';
    }

    const majorCount = findings.filter((finding) => finding.type === 'Major Nonconformity').length;
    const minorCount = findings.filter((finding) => finding.type === 'Minor Nonconformity').length;
    const observationCount = findings.filter((finding) => finding.type === 'Observation').length;

    return `The audit identified ${findingCount} finding(s), comprising ${majorCount} major nonconformit${majorCount === 1 ? 'y' : 'ies'}, ${minorCount} minor nonconformit${minorCount === 1 ? 'y' : 'ies'}, and ${observationCount} observation${observationCount === 1 ? '' : 's'}. Findings remain linked to the audit record for follow-up through corrective action or NCR workflow where applicable.`;
  }

  private resolveLinkedResolution(
    finding: {
      title: string;
      description: string;
      linkedCapaId?: string | null;
    },
    actionItems: Array<{ title: string; description: string | null }>,
    ncrs: Array<{ referenceNo: string; title: string; description: string }>,
    capas: Array<{ id: string; title: string }>
  ) {
    if (finding.linkedCapaId) {
      const capa = capas.find((item) => item.id === finding.linkedCapaId);
      return capa ? `Corrective action raised through CAPA: ${capa.title}` : 'Corrective action raised through linked CAPA';
    }

    const matchingAction = actionItems.find((item) => item.title.includes(finding.title));
    if (matchingAction) {
      return `Corrective action tracked in action register: ${matchingAction.title}`;
    }

    const matchingNcr = ncrs.find(
      (item) => item.description.includes(finding.title) || item.title.includes(finding.title)
    );
    if (matchingNcr) {
      return `NCR raised: ${matchingNcr.referenceNo}`;
    }

    return 'No linked corrective action or NCR recorded at the time of report generation.';
  }

  private formatDate(value: Date) {
    return value.toISOString().slice(0, 10);
  }

  private formatFindingStatus(status: AuditFindingStatus) {
    if (status === AuditFindingStatus.CAPA_CREATED) {
      return 'Action Raised';
    }

    return status === AuditFindingStatus.CLOSED ? 'Closed' : 'Open';
  }

  private formatFindingSeverity(severity: AuditFindingSeverity) {
    if (severity === AuditFindingSeverity.MAJOR) {
      return 'Major Nonconformity';
    }

    if (severity === AuditFindingSeverity.MINOR) {
      return 'Minor Nonconformity';
    }

    return 'Observation';
  }

  private findingReference(index: number) {
    return `F-${String(index + 1).padStart(2, '0')}`;
  }

  private truncate(value: string, maxLength: number) {
    if (value.length <= maxLength) {
      return value;
    }

    return `${value.slice(0, maxLength - 3).trimEnd()}...`;
  }

  private heightForText(
    doc: PdfDocument,
    text: string,
    width: number,
    fontSize: number,
    fontName: string
  ) {
    return doc
      .font(fontName)
      .fontSize(fontSize)
      .heightOfString(text || '-', { width, lineGap: 2 });
  }
}
