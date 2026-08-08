export interface SalesExportRow {
  companyName: string;
  country: string;
  website: string;
  leadStatus: string;
  contactType: string;
  contactValue: string;
  contactLabel: string;
  contactSourceUrl: string;
  outreachStrategy: string;
  recommendedProducts: string;
  commercialFitScore: number | null;
  outreachScore: number | null;
  opportunityValueUsd: number | null;
  opportunityProbability: number | null;
  expectedCloseDate: string;
  weightedValueUsd: number | null;
  draftChannel: string;
  draftStatus: string;
  draftSubject: string;
  draftBody: string;
  evidenceSummary: string;
  personalizationNotes: string;
  lastOutcome: string;
  lastOutcomeNotes: string;
  qualificationFeedback: string;
  feedbackReason: string;
  nextAction: string;
  nextActionDue: string;
}

const HEADERS: Array<[keyof SalesExportRow, string]> = [
  ["companyName","Company"],["country","Country"],["website","Website"],["leadStatus","Lead Status"],
  ["contactType","Contact Type"],["contactValue","Verified Contact"],["contactLabel","Contact Label"],
  ["contactSourceUrl","Contact Evidence"],["outreachStrategy","Outreach Strategy"],
  ["recommendedProducts","Recommended Products"],["commercialFitScore","Commercial Fit Score"],
  ["outreachScore","Outreach Score"],["opportunityValueUsd","Opportunity Value USD"],
  ["opportunityProbability","Probability Percent"],["expectedCloseDate","Expected Close Date"],
  ["weightedValueUsd","Weighted Value USD"],["draftChannel","Draft Channel"],["draftStatus","Draft Status"],
  ["draftSubject","Draft Subject"],["draftBody","Draft Body"],["evidenceSummary","Trade Evidence Summary"],
  ["personalizationNotes","Manual Review Notes"],["lastOutcome","Latest Outcome"],["lastOutcomeNotes","Outcome Notes"],
  ["qualificationFeedback","Qualification Feedback"],["feedbackReason","Feedback Reason"],
  ["nextAction","Next Action"],["nextActionDue","Next Action Due"],
];

export function csvCell(value: unknown): string {
  let text = value == null ? "" : String(value);
  if (/^[=+\-@]/.test(text)) text = `'${text}`;
  return `"${text.replaceAll('"','""')}"`;
}

export function buildSalesExportCsv(rows: SalesExportRow[]): string {
  const lines = [HEADERS.map(([,label])=>csvCell(label)).join(",")];
  for (const row of rows) lines.push(HEADERS.map(([key])=>csvCell(row[key])).join(","));
  return `\ufeff${lines.join("\r\n")}\r\n`;
}
