export type AuditQuestionSeed = {
  standard: 'ISO 9001' | 'ISO 14001' | 'ISO 45001' | 'IMS';
  clause: '4' | '5' | '6' | '7' | '8' | '9' | '10';
  subclause?: string;
  title: string;
};

export const CLAUSE_SORT_ORDER = ['4', '5', '6', '7', '8', '9', '10'] as const;

export const AUDIT_STARTER_QUESTION_BANK: AuditQuestionSeed[] = [
  { standard: 'ISO 9001', clause: '4', subclause: '4.1', title: 'Are key business issues and external factors reviewed when planning the management system?' },
  { standard: 'ISO 9001', clause: '4', subclause: '4.2', title: 'Are relevant customer, regulatory, and stakeholder needs identified and kept current?' },
  { standard: 'ISO 9001', clause: '5', subclause: '5.1', title: 'Do leaders actively support the management system and review quality performance?' },
  { standard: 'ISO 9001', clause: '5', subclause: '5.3', title: 'Are process owners clear on their responsibilities and decision authority?' },
  { standard: 'ISO 9001', clause: '6', subclause: '6.1', title: 'Are quality risks and opportunities assessed and turned into practical actions?' },
  { standard: 'ISO 9001', clause: '6', subclause: '6.2', title: 'Are quality objectives defined, measured, and followed up with owners and deadlines?' },
  { standard: 'ISO 9001', clause: '7', subclause: '7.2', title: 'Is competence evaluated for roles that affect product or service quality?' },
  { standard: 'ISO 9001', clause: '7', subclause: '7.5', title: 'Is documented information reviewed, approved, and available where it is needed?' },
  { standard: 'ISO 9001', clause: '8', subclause: '8.1', title: 'Are operational controls and acceptance criteria defined before work is performed?' },
  { standard: 'ISO 9001', clause: '8', subclause: '8.4', title: 'Are suppliers and outsourced services monitored against defined requirements?' },
  { standard: 'ISO 9001', clause: '9', subclause: '9.1', title: 'Are performance measures reviewed and used to drive decisions and improvement?' },
  { standard: 'ISO 9001', clause: '9', subclause: '9.3', title: 'Does management review consider audit results, customer feedback, risks, and performance trends?' },
  { standard: 'ISO 9001', clause: '10', subclause: '10.2', title: 'When issues occur, are corrections and root-cause actions tracked to completion?' },
  { standard: 'ISO 9001', clause: '10', subclause: '10.3', title: 'Is improvement demonstrated through measurable changes in processes or outcomes?' },

  { standard: 'ISO 14001', clause: '4', subclause: '4.1', title: 'Are environmental conditions, obligations, and business factors considered in EMS planning?' },
  { standard: 'ISO 14001', clause: '4', subclause: '4.2', title: 'Are interested parties and environmental commitments identified and reviewed?' },
  { standard: 'ISO 14001', clause: '5', subclause: '5.1', title: 'Do leaders visibly support environmental objectives and compliance commitments?' },
  { standard: 'ISO 14001', clause: '5', subclause: '5.3', title: 'Are environmental roles and responsibilities clearly assigned?' },
  { standard: 'ISO 14001', clause: '6', subclause: '6.1', title: 'Are significant environmental aspects, impacts, risks, and obligations evaluated consistently?' },
  { standard: 'ISO 14001', clause: '6', subclause: '6.2', title: 'Are environmental objectives supported by actionable plans, owners, and timing?' },
  { standard: 'ISO 14001', clause: '7', subclause: '7.2', title: 'Do personnel and contractors have the awareness and competence needed for environmental controls?' },
  { standard: 'ISO 14001', clause: '7', subclause: '7.5', title: 'Are environmental procedures and records controlled and easy to retrieve?' },
  { standard: 'ISO 14001', clause: '8', subclause: '8.1', title: 'Are operational controls implemented for significant environmental aspects and lifecycle impacts?' },
  { standard: 'ISO 14001', clause: '8', subclause: '8.2', title: 'Are environmental emergency arrangements defined, tested, and improved?' },
  { standard: 'ISO 14001', clause: '9', subclause: '9.1', title: 'Are monitoring results, legal compliance checks, and trends reviewed in a timely way?' },
  { standard: 'ISO 14001', clause: '9', subclause: '9.3', title: 'Does management review consider environmental performance, compliance, and changes in context?' },
  { standard: 'ISO 14001', clause: '10', subclause: '10.2', title: 'Are environmental incidents and nonconformities investigated and corrected effectively?' },
  { standard: 'ISO 14001', clause: '10', subclause: '10.3', title: 'Can the organization show evidence of ongoing environmental improvement?' },

  { standard: 'ISO 45001', clause: '4', subclause: '4.1', title: 'Are workplace conditions, worker needs, and external factors considered in OH&S planning?' },
  { standard: 'ISO 45001', clause: '4', subclause: '4.2', title: 'Are workers and other interested parties consulted on relevant OH&S requirements?' },
  { standard: 'ISO 45001', clause: '5', subclause: '5.1', title: 'Does leadership actively support OH&S objectives, participation, and safe behaviors?' },
  { standard: 'ISO 45001', clause: '5', subclause: '5.4', title: 'Are workers involved in hazard identification, investigations, and improvements?' },
  { standard: 'ISO 45001', clause: '6', subclause: '6.1', title: 'Are hazards identified proactively and assessed before work changes are introduced?' },
  { standard: 'ISO 45001', clause: '6', subclause: '6.2', title: 'Are OH&S objectives backed by practical plans, owners, and timelines?' },
  { standard: 'ISO 45001', clause: '7', subclause: '7.2', title: 'Are competence, awareness, and communication arrangements effective for OH&S risks?' },
  { standard: 'ISO 45001', clause: '7', subclause: '7.5', title: 'Is OH&S documented information controlled and available to people who need it?' },
  { standard: 'ISO 45001', clause: '8', subclause: '8.1', title: 'Are controls in place for routine work, contractors, and high-risk activities?' },
  { standard: 'ISO 45001', clause: '8', subclause: '8.2', title: 'Are emergency response arrangements practiced and reviewed after drills or events?' },
  { standard: 'ISO 45001', clause: '9', subclause: '9.1', title: 'Are OH&S performance, compliance checks, and incident trends monitored and reviewed?' },
  { standard: 'ISO 45001', clause: '9', subclause: '9.3', title: 'Does management review address worker participation, incidents, risks, and opportunities?' },
  { standard: 'ISO 45001', clause: '10', subclause: '10.2', title: 'Are incidents and nonconformities investigated deeply enough to prevent recurrence?' },
  { standard: 'ISO 45001', clause: '10', subclause: '10.3', title: 'Can the organization show ongoing improvement in OH&S controls and outcomes?' },

  { standard: 'IMS', clause: '4', subclause: '4.1', title: 'Are shared business issues, stakeholder expectations, and compliance needs reflected across the IMS?' },
  { standard: 'IMS', clause: '4', subclause: '4.4', title: 'Are process interactions, boundaries, and interfaces clearly defined in the IMS?' },
  { standard: 'IMS', clause: '5', subclause: '5.1', title: 'Do leaders set direction and provide visible support across quality, environment, and safety?' },
  { standard: 'IMS', clause: '5', subclause: '5.3', title: 'Are responsibilities coordinated across functions for integrated system performance?' },
  { standard: 'IMS', clause: '6', subclause: '6.1', title: 'Are shared risks, opportunities, and compliance obligations assessed in an integrated way?' },
  { standard: 'IMS', clause: '6', subclause: '6.2', title: 'Are integrated objectives tracked with owners, measures, and follow-up?' },
  { standard: 'IMS', clause: '7', subclause: '7.2', title: 'Are competence and awareness needs managed consistently across the integrated system?' },
  { standard: 'IMS', clause: '7', subclause: '7.5', title: 'Is controlled information managed in one coherent document framework?' },
  { standard: 'IMS', clause: '8', subclause: '8.1', title: 'Are operational controls aligned so quality, environmental, and safety needs are addressed together?' },
  { standard: 'IMS', clause: '8', subclause: '8.2', title: 'Are change management and emergency arrangements coordinated across the IMS?' },
  { standard: 'IMS', clause: '9', subclause: '9.1', title: 'Are performance, audit, and compliance results reviewed together for management decisions?' },
  { standard: 'IMS', clause: '9', subclause: '9.3', title: 'Does management review address the full IMS rather than isolated disciplines?' },
  { standard: 'IMS', clause: '10', subclause: '10.2', title: 'Are nonconformities and incidents managed through a common corrective-action process?' },
  { standard: 'IMS', clause: '10', subclause: '10.3', title: 'Is improvement coordinated across the integrated management system?' }
];

export function getStarterQuestionsForStandard(standard: string) {
  return AUDIT_STARTER_QUESTION_BANK.filter((item) => item.standard === standard);
}

export function createStarterQuestionSeedData(tenantId: string) {
  const counters = new Map<string, number>();

  return AUDIT_STARTER_QUESTION_BANK.map((item) => {
    const key = `${item.standard}:${item.clause}`;
    const nextSortOrder = (counters.get(key) ?? 0) + 1;
    counters.set(key, nextSortOrder);

    return {
      tenantId,
      standard: item.standard,
      clause: item.clause,
      subclause: item.subclause ?? null,
      title: item.title,
      sortOrder: nextSortOrder,
      isActive: true,
      isTemplateDefault: true
    };
  });
}
