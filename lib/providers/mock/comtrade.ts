import type { Provider } from "../types.ts";
import { comtradeCapability } from "./capabilities.ts";

const MOCK_PARTNERS = [
  { code: "CN", name: "China" },
  { code: "DE", name: "Germany" },
  { code: "MX", name: "Mexico" },
  { code: "IT", name: "Italy" },
  { code: "VN", name: "Viet Nam" },
];

export const comtradeProvider: Provider = {
  capability: comtradeCapability,
  async fetch() {
    return {
      reporter: "US",
      records: MOCK_PARTNERS.map((partner, index) => ({
        ...partner,
        tradeValue: 120_000_000 - index * 18_000_000,
        netWeightKg: 2_400_000 - index * 300_000,
        isEstimated: false,
      })),
    };
  },
};
