export interface DataConfidence {
  score: number;
  sampleSize: number;
  dataSource: string;
  lastUpdated: string;
  explanation: string;
  identifiedRatio: number;
  mixedLoadRatio: number;
  unclassifiedRatio: number;
}

export interface ConfidenceInput {
  shipmentRecords: number;
  matchedRecords: number;
  mixedRecords: number;
  categories: number;
  lastUpdated: string;
  dataSource?: string;
}

function buildExplanation(input: ConfidenceInput, score: number, identifiedRatio: number, mixedLoadRatio: number, unclassifiedRatio: number): string {
  const parts: string[] = [];
  const n = input.shipmentRecords;
  if (n >= 1000) {
    parts.push(`${n.toLocaleString()} shipment records — large sample, high confidence`);
  } else if (n >= 100) {
    parts.push(`${n.toLocaleString()} shipment records — moderate sample`);
  } else if (n > 0) {
    parts.push(`${n.toLocaleString()} shipment records — small sample, lower confidence`);
  } else {
    parts.push(`No shipment records`);
  }
  parts.push(`${Math.round(identifiedRatio * 100)}% classified`);
  if (mixedLoadRatio > 0) {
    parts.push(`${Math.round(mixedLoadRatio * 100)}% from mixed-product shipments`);
  }
  if (unclassifiedRatio > 0) {
    parts.push(`${Math.round(unclassifiedRatio * 100)}% unclassified`);
  }
  return parts.join(" · ");
}

export function computeConfidence(input: ConfidenceInput): DataConfidence {
  const { shipmentRecords, matchedRecords, mixedRecords, categories, lastUpdated, dataSource = "stored_us_ocean_import_shipments" } = input;
  const logSample = shipmentRecords >= 1000 ? 3 : Math.log10(Math.max(shipmentRecords, 1));
  const logMax = Math.log10(1000);
  const score = Math.round((logSample / logMax) * 100);
  const identifiedRatio = shipmentRecords > 0 ? matchedRecords / shipmentRecords : 0;
  const mixedLoadRatio = matchedRecords > 0 ? mixedRecords / matchedRecords : 0;
  const unclassifiedRatio = shipmentRecords > 0 ? (shipmentRecords - matchedRecords) / shipmentRecords : 0;
  const explanation = buildExplanation(input, score, identifiedRatio, mixedLoadRatio, unclassifiedRatio);
  return { score, sampleSize: shipmentRecords, dataSource, lastUpdated, explanation, identifiedRatio, mixedLoadRatio, unclassifiedRatio };
}
