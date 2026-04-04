import { InterestedPartyType } from './context.models';

export type ContentSuggestion = {
  title: string;
  description: string;
  category: string;
};

export type ContentCategoryGroup = {
  key: string;
  label: string;
  suggestions: ContentSuggestion[];
};

export type InterestedPartyTypeGuide = {
  value: InterestedPartyType;
  label: string;
  examples: string[];
};

export type ProcessTemplate = {
  id: string;
  name: string;
  referenceNo: string;
  purpose: string;
  department: string;
  scope: string;
  inputsText: string;
  outputsText: string;
};

export type ContentLibraryResponse = {
  context: {
    internalIssueCategories: ContentCategoryGroup[];
    externalIssueCategories: ContentCategoryGroup[];
    interestedPartyTypes: InterestedPartyTypeGuide[];
    needsExpectationExamples: Record<InterestedPartyType, string[]>;
  };
  risks: {
    riskCategories: string[];
    opportunityCategories: string[];
  };
  processRegister: {
    templates: ProcessTemplate[];
  };
};
