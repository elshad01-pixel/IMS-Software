type FindingRow = {
  id: string;
  clause: string;
  type: string;
  description: string;
  status: string;
};

type DetailedFinding = {
  id: string;
  clause: string;
  requirement: string;
  finding: string;
  evidence: string;
  action: string;
};

export type AuditReportTemplateData = {
  reportTitle: string;
  systemName: string;
  companyName: string;
  standard: string;
  auditDate: string;
  auditor: string;
  objective: string;
  scope: string;
  criteria: string;
  executiveSummary: string;
  findingsSummary: FindingRow[];
  detailedFindings: DetailedFinding[];
  auditConclusion: string;
};

function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function buildAuditReportHtml(data: AuditReportTemplateData) {
  const findingsSummaryRows =
    data.findingsSummary.length > 0
      ? data.findingsSummary
          .map(
            (finding) => `
              <tr>
                <td>${escapeHtml(finding.id)}</td>
                <td>${escapeHtml(finding.clause)}</td>
                <td>${escapeHtml(finding.type)}</td>
                <td>${escapeHtml(finding.description)}</td>
                <td>${escapeHtml(finding.status)}</td>
              </tr>
            `
          )
          .join('')
      : `<tr><td colspan="5">No findings were recorded during this audit.</td></tr>`;

  const detailedFindings =
    data.detailedFindings.length > 0
      ? data.detailedFindings
          .map(
            (finding) => `
              <article class="finding-card">
                <div class="finding-card__head">
                  <span>${escapeHtml(finding.id)}</span>
                  <strong>${escapeHtml(finding.clause)}</strong>
                </div>
                <dl>
                  <dt>Requirement</dt>
                  <dd>${escapeHtml(finding.requirement)}</dd>
                  <dt>Finding</dt>
                  <dd>${escapeHtml(finding.finding)}</dd>
                  <dt>Evidence</dt>
                  <dd>${escapeHtml(finding.evidence)}</dd>
                  <dt>Action</dt>
                  <dd>${escapeHtml(finding.action)}</dd>
                </dl>
              </article>
            `
          )
          .join('')
      : `<p class="empty-note">No detailed findings were recorded for this audit.</p>`;

  return `
    <!doctype html>
    <html lang="en">
      <head>
        <meta charset="utf-8" />
        <title>${escapeHtml(data.reportTitle)}</title>
        <style>
          body {
            font-family: "Helvetica Neue", Helvetica, Arial, sans-serif;
            color: #173225;
            margin: 0;
            padding: 0;
            line-height: 1.5;
            background: #fff;
          }
          .page {
            padding: 46px 52px;
          }
          .cover {
            min-height: 100vh;
            display: flex;
            flex-direction: column;
            justify-content: space-between;
            background: linear-gradient(180deg, #f7faf8 0%, #ffffff 100%);
          }
          .cover-frame {
            border: 1px solid #d7dfda;
            border-radius: 18px;
            padding: 54px 56px;
            min-height: calc(100vh - 92px);
            box-sizing: border-box;
          }
          .eyebrow {
            font-size: 11px;
            letter-spacing: 0.18em;
            text-transform: uppercase;
            color: #5b6c62;
            margin-bottom: 22px;
          }
          h1 {
            font-size: 34px;
            margin: 0 0 12px;
            line-height: 1.12;
            font-weight: 700;
          }
          .system-line {
            font-size: 18px;
            color: #35483e;
            margin: 0 0 10px;
          }
          .standard-line {
            font-size: 15px;
            color: #5b6c62;
            margin: 0;
          }
          .cover-meta {
            display: grid;
            grid-template-columns: repeat(2, minmax(0, 1fr));
            gap: 18px 28px;
            margin-top: 80px;
          }
          .meta-label {
            font-size: 10px;
            letter-spacing: 0.14em;
            text-transform: uppercase;
            color: #5b6c62;
            margin-bottom: 6px;
          }
          .meta-value {
            font-size: 14px;
            color: #173225;
          }
          .header {
            display: flex;
            justify-content: space-between;
            align-items: flex-end;
            padding-bottom: 16px;
            margin-bottom: 26px;
            border-bottom: 1px solid #d7dfda;
          }
          .header-title {
            font-size: 18px;
            font-weight: 700;
            margin: 0;
          }
          .header-subtitle {
            margin: 4px 0 0;
            color: #5b6c62;
            font-size: 12px;
          }
          h2 {
            margin: 0 0 14px;
            font-size: 20px;
            font-weight: 700;
          }
          .summary-grid {
            display: grid;
            gap: 14px;
          }
          .summary-card {
            padding: 14px 16px;
            border: 1px solid #d7dfda;
            border-radius: 14px;
            background: #fbfcfb;
          }
          .summary-card strong {
            display: block;
            margin-bottom: 6px;
            font-size: 12px;
            letter-spacing: 0.08em;
            text-transform: uppercase;
            color: #5b6c62;
          }
          table {
            width: 100%;
            border-collapse: collapse;
            font-size: 12.5px;
          }
          th, td {
            border: 1px solid #d7dfda;
            padding: 10px 12px;
            vertical-align: top;
            text-align: left;
          }
          th {
            background: #f3f6f4;
            font-size: 11px;
            letter-spacing: 0.08em;
            text-transform: uppercase;
            color: #4a5d53;
          }
          .finding-card {
            border: 1px solid #d7dfda;
            border-radius: 14px;
            padding: 16px 18px;
            margin-top: 16px;
            background: #ffffff;
          }
          .finding-card__head {
            display: flex;
            gap: 12px;
            align-items: center;
            margin-bottom: 14px;
          }
          .finding-card__head span {
            display: inline-flex;
            align-items: center;
            justify-content: center;
            min-width: 54px;
            padding: 6px 10px;
            border-radius: 999px;
            background: #eef3f0;
            font-size: 11px;
            font-weight: 700;
            color: #355145;
          }
          dl {
            margin: 0;
            display: grid;
            grid-template-columns: 130px 1fr;
            gap: 10px 14px;
          }
          dt {
            font-weight: 700;
            color: #5b6c62;
          }
          dd {
            margin: 0;
          }
          .empty-note {
            color: #5b6c62;
            font-style: italic;
          }
        </style>
      </head>
      <body>
        <section class="cover page">
          <div class="cover-frame">
            <div class="eyebrow">${escapeHtml(data.companyName)}</div>
            <h1>${escapeHtml(data.reportTitle)}</h1>
            <p class="system-line">${escapeHtml(data.systemName)}</p>
            <p class="standard-line">${escapeHtml(data.standard)}</p>

            <div class="cover-meta">
              <div>
                <div class="meta-label">Company</div>
                <div class="meta-value">${escapeHtml(data.companyName)}</div>
              </div>
              <div>
                <div class="meta-label">Audit date</div>
                <div class="meta-value">${escapeHtml(data.auditDate)}</div>
              </div>
              <div>
                <div class="meta-label">Auditor</div>
                <div class="meta-value">${escapeHtml(data.auditor)}</div>
              </div>
              <div>
                <div class="meta-label">Standard</div>
                <div class="meta-value">${escapeHtml(data.standard)}</div>
              </div>
            </div>
          </div>
        </section>

        <section class="page">
          <div class="header">
            <div>
              <p class="header-title">${escapeHtml(data.reportTitle)}</p>
              <p class="header-subtitle">${escapeHtml(data.companyName)}</p>
            </div>
            <div class="header-subtitle">${escapeHtml(data.auditDate)}</div>
          </div>

          <h2>Audit Summary</h2>
          <div class="summary-grid">
            <div class="summary-card"><strong>Objective</strong>${escapeHtml(data.objective)}</div>
            <div class="summary-card"><strong>Scope</strong>${escapeHtml(data.scope)}</div>
            <div class="summary-card"><strong>Criteria</strong>${escapeHtml(data.criteria)}</div>
          </div>

          <h2 style="margin-top: 30px;">Executive Summary</h2>
          <p>${escapeHtml(data.executiveSummary)}</p>

          <h2 style="margin-top: 30px;">Findings Summary</h2>
          <table>
            <thead>
              <tr>
                <th>ID</th>
                <th>Clause</th>
                <th>Type</th>
                <th>Description</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>${findingsSummaryRows}</tbody>
          </table>

          <h2 style="margin-top: 30px;">Detailed Findings</h2>
          ${detailedFindings}

          <h2 style="margin-top: 30px;">Audit Conclusion</h2>
          <p>${escapeHtml(data.auditConclusion)}</p>
        </section>
      </body>
    </html>
  `;
}
