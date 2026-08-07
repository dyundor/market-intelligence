import type { Provider } from "../types.ts";
import { importYetiCapability, productDescription, rankCount } from "./capabilities.ts";

const MOCK_NAMES = ["AquaPro Trading", "Summit Import Group", "Harbor Supply Co.", "Globe Pacific Imports", "Metro Plumbing Distributors"];

export const importYetiProvider: Provider = {
  capability: importYetiCapability,
  async fetch(query) {
    const count = rankCount(query);
    const description = productDescription(query.subject);
    return {
      provider: "importyeti_mock",
      query,
      companies: MOCK_NAMES.slice(0, count).map((name, index) => ({
        id: `mock-importyeti-${index}`,
        name,
        country: "US",
        website: index % 2 === 0 ? `https://${name.toLowerCase().replace(/[^a-z]/g, "")}.com` : null,
        shipments: 240 - index * 12,
        productDescription: description,
      })),
    };
  },
};
