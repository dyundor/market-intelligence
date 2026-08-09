import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Existing dashboard effects intentionally synchronize several dependent
  // loading states. Keep them linted by the remaining hooks rules while that
  // UI is incrementally migrated away from synchronous effect state changes.
  {
    files: ["app/page.tsx", "app/components/useTrendData.ts", "app/components/TrendView.tsx", "app/components/ProductTrendDashboard.tsx", "app/components/TrendChart.tsx"],
    rules: { "react-hooks/set-state-in-effect": "off" },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
]);

export default eslintConfig;
