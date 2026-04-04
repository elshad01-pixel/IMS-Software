export const CONTENT_LIBRARY = {
  context: {
    internalIssueCategories: [
      {
        key: 'LEADERSHIP_AND_GOVERNANCE',
        label: 'Leadership and governance',
        suggestions: [
          {
            title: 'Unclear management priorities',
            description: 'Teams receive conflicting direction on quality, safety, or environmental priorities.',
            category: 'Leadership and governance'
          },
          {
            title: 'Limited cross-functional communication',
            description: 'Important IMS updates are not consistently shared between departments.',
            category: 'Leadership and governance'
          }
        ]
      },
      {
        key: 'PEOPLE_AND_COMPETENCE',
        label: 'People and competence',
        suggestions: [
          {
            title: 'Skills gap in critical roles',
            description: 'Key process owners or operators need additional competence to maintain control.',
            category: 'People and competence'
          },
          {
            title: 'High workload on a small team',
            description: 'A limited team is carrying essential IMS activities, creating continuity risk.',
            category: 'People and competence'
          }
        ]
      },
      {
        key: 'PROCESS_AND_CAPABILITY',
        label: 'Process and capability',
        suggestions: [
          {
            title: 'Inconsistent process execution',
            description: 'Core activities are performed differently across functions or locations.',
            category: 'Process and capability'
          },
          {
            title: 'Weak document discipline',
            description: 'Approved methods are not always followed or kept current in operations.',
            category: 'Process and capability'
          }
        ]
      },
      {
        key: 'INFRASTRUCTURE_AND_TECHNOLOGY',
        label: 'Infrastructure and technology',
        suggestions: [
          {
            title: 'Legacy system dependency',
            description: 'A critical process relies on aging tools or unsupported infrastructure.',
            category: 'Infrastructure and technology'
          },
          {
            title: 'Insufficient backup capacity',
            description: 'There is limited resilience if an essential system or site becomes unavailable.',
            category: 'Infrastructure and technology'
          }
        ]
      }
    ],
    externalIssueCategories: [
      {
        key: 'REGULATORY_AND_COMPLIANCE',
        label: 'Regulatory and compliance',
        suggestions: [
          {
            title: 'Changing regulatory requirements',
            description: 'New or revised legal obligations could affect the IMS and operating controls.',
            category: 'Regulatory and compliance'
          },
          {
            title: 'Increased customer compliance expectations',
            description: 'Customers are requesting stronger evidence of control, traceability, or certification.',
            category: 'Regulatory and compliance'
          }
        ]
      },
      {
        key: 'MARKET_AND_CUSTOMER',
        label: 'Market and customer',
        suggestions: [
          {
            title: 'Demand volatility',
            description: 'Fluctuating customer demand is affecting planning and service consistency.',
            category: 'Market and customer'
          },
          {
            title: 'Rising customer delivery expectations',
            description: 'Customers expect faster response, shorter lead times, or tighter service performance.',
            category: 'Market and customer'
          }
        ]
      },
      {
        key: 'SUPPLIER_AND_SUPPLY_CHAIN',
        label: 'Supplier and supply chain',
        suggestions: [
          {
            title: 'Single-source supplier dependency',
            description: 'Key materials or services rely heavily on one supplier or subcontractor.',
            category: 'Supplier and supply chain'
          },
          {
            title: 'Supplier performance instability',
            description: 'External provider quality, lead time, or responsiveness is inconsistent.',
            category: 'Supplier and supply chain'
          }
        ]
      },
      {
        key: 'ENVIRONMENTAL_AND_SOCIAL',
        label: 'Environmental and social',
        suggestions: [
          {
            title: 'Extreme weather disruption',
            description: 'Severe weather or climate events could interrupt operations or logistics.',
            category: 'Environmental and social'
          },
          {
            title: 'Community sensitivity to operations',
            description: 'Local stakeholders may expect stronger control of safety, noise, or environmental impacts.',
            category: 'Environmental and social'
          }
        ]
      }
    ],
    interestedPartyTypes: [
      { value: 'CUSTOMER', label: 'Customer', examples: ['Key account customers', 'Contract clients', 'End users'] },
      { value: 'REGULATOR', label: 'Regulator', examples: ['Certification body', 'Labor authority', 'Environmental regulator'] },
      { value: 'EMPLOYEE', label: 'Employee', examples: ['Operational staff', 'Supervisors', 'Process owners'] },
      { value: 'SUPPLIER', label: 'Supplier', examples: ['Critical raw material supplier', 'Calibration provider', 'Outsourced service partner'] },
      { value: 'OTHER', label: 'Other', examples: ['Shareholders', 'Community representatives', 'Insurance provider'] }
    ],
    needsExpectationExamples: {
      CUSTOMER: ['Consistent product or service quality', 'On-time delivery and communication', 'Clear response to complaints and issues'],
      REGULATOR: ['Compliance with applicable legal requirements', 'Timely reporting and cooperation', 'Maintained documented evidence'],
      EMPLOYEE: ['Safe working conditions', 'Clear responsibilities and training', 'Access to current procedures and tools'],
      SUPPLIER: ['Clear specifications and forecasting', 'Timely approvals and feedback', 'Stable communication and payment arrangements'],
      OTHER: ['Transparent governance', 'Responsible environmental behavior', 'Reliable business continuity planning']
    }
  },
  risks: {
    riskCategories: [
      'Strategic',
      'Operational',
      'Quality',
      'Health and Safety',
      'Environmental',
      'Compliance',
      'Supply Chain',
      'Information Security'
    ],
    opportunityCategories: [
      'Process Improvement',
      'Customer Experience',
      'Digital Enablement',
      'People Development',
      'Supplier Collaboration',
      'Waste Reduction',
      'Energy Efficiency',
      'Growth and Market Position'
    ]
  },
  processRegister: {
    templates: [
      {
        id: 'sales-customer-management',
        name: 'Sales and Customer Management',
        referenceNo: 'PR-SALES',
        purpose: 'Manage customer inquiries, quotations, commitments, and relationship follow-up in a controlled way.',
        department: 'Commercial',
        scope: 'From customer request through quotation, order clarification, and ongoing relationship management.',
        inputsText: 'Customer requirements, product or service capability, pricing inputs, contract requirements',
        outputsText: 'Approved quotations, confirmed commitments, customer communication records'
      },
      {
        id: 'procurement-supplier-control',
        name: 'Procurement and Supplier Control',
        referenceNo: 'PR-PROC',
        purpose: 'Control the sourcing of products and services from approved external providers.',
        department: 'Supply Chain',
        scope: 'From supplier approval and purchasing through receipt and ongoing supplier monitoring.',
        inputsText: 'Approved supplier list, purchasing requirements, specifications, demand plan',
        outputsText: 'Purchase orders, supplier evaluations, received goods or services'
      },
      {
        id: 'operations-service-delivery',
        name: 'Operations and Service Delivery',
        referenceNo: 'PR-OPS',
        purpose: 'Deliver products or services consistently in line with defined requirements and controls.',
        department: 'Operations',
        scope: 'From planning and execution through release, handover, or service completion.',
        inputsText: 'Production or service plans, approved methods, competent personnel, equipment',
        outputsText: 'Delivered products or completed services, operational records, handover evidence'
      },
      {
        id: 'human-resources-competence',
        name: 'Human Resources and Competence',
        referenceNo: 'PR-HR',
        purpose: 'Ensure people are recruited, developed, and supported to perform their roles effectively.',
        department: 'Human Resources',
        scope: 'From role definition and onboarding through training, competence, and personnel support.',
        inputsText: 'Role requirements, recruitment needs, training plans, competence requirements',
        outputsText: 'Filled roles, training records, competence evaluations'
      },
      {
        id: 'document-control',
        name: 'Document Control',
        referenceNo: 'PR-DOC',
        purpose: 'Maintain controlled documents and records so that only current, approved information is used.',
        department: 'Quality',
        scope: 'From drafting and review through approval, issue, revision, and retention.',
        inputsText: 'Document requests, change requests, approved templates, standards',
        outputsText: 'Controlled documents, revision history, obsolete document traceability'
      },
      {
        id: 'internal-audit',
        name: 'Internal Audit',
        referenceNo: 'PR-AUD',
        purpose: 'Plan and perform internal audits to evaluate whether the IMS is working effectively.',
        department: 'Quality',
        scope: 'From audit program planning through checklist execution, findings, and close-out.',
        inputsText: 'Audit programme, prior findings, process risks, requirements and procedures',
        outputsText: 'Audit plans, findings, audit conclusions, follow-up actions'
      },
      {
        id: 'management-review',
        name: 'Management Review',
        referenceNo: 'PR-MR',
        purpose: 'Review IMS performance and make decisions on improvement, resources, and direction.',
        department: 'Leadership',
        scope: 'From review preparation through meeting execution and action follow-up.',
        inputsText: 'Audit results, KPI performance, CAPA status, risks and opportunities, previous actions',
        outputsText: 'Management review minutes, decisions, assigned actions, resource commitments'
      }
    ]
  }
} as const;

export type ContentLibrary = typeof CONTENT_LIBRARY;
