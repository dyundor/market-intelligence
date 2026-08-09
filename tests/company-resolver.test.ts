import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync, readdirSync } from "node:fs";
import { resolveCompanyIdentity, mergeCompany, type CompanyIdentityRecord } from "../lib/entities/company-resolver.ts";
import { companyIdentityKey } from "../lib/entities/company.ts";
import { buildWebsiteSearchQueries, validateNoActiveWebsiteResearch, validateWebsiteResearch } from "../lib/company/website-evidence.ts";

const RECORDS: CompanyIdentityRecord[] = [
  { id: "e-kohler", name: "KOHLER", identityKey: companyIdentityKey("KOHLER"), aliases: ["Kohler Co.", "Kohler Co., Inc.", "科勒"] },
  { id: "e-delta", name: "Delta Faucet Company", identityKey: companyIdentityKey("Delta Faucet Company"), aliases: ["Delta", "Delta Faucet"] },
];

test("company resolver matches identity by normalized key", () => {
  assert.equal(resolveCompanyIdentity(RECORDS, "Kohler Co.")?.id, "e-kohler");
  assert.equal(resolveCompanyIdentity(RECORDS, "KOHLER")?.id, "e-kohler");
  assert.equal(resolveCompanyIdentity(RECORDS, "Kohler")?.id, "e-kohler");
  assert.equal(resolveCompanyIdentity(RECORDS, "kohler  co., inc.")?.id, "e-kohler");
});

test("company resolver matches aliases including Chinese names", () => {
  assert.equal(resolveCompanyIdentity(RECORDS, "科勒")?.id, "e-kohler");
  assert.equal(resolveCompanyIdentity(RECORDS, "Delta")?.id, "e-delta");
  assert.equal(resolveCompanyIdentity(RECORDS, "delta faucet")?.id, "e-delta");
});

test("company resolver returns null for unknown companies", () => {
  assert.equal(resolveCompanyIdentity(RECORDS, "Moen Inc."), null);
  assert.equal(resolveCompanyIdentity(RECORDS, ""), null);
  assert.equal(resolveCompanyIdentity(RECORDS, "  "), null);
});

test("mergeCompany reuses the existing company record", () => {
  const candidate = { id: "e-new", name: "Kohler Co.", identityKey: companyIdentityKey("Kohler Co."), aliases: [] };
  const merged = mergeCompany(RECORDS, candidate);
  assert.equal(merged.matched, true);
  assert.equal(merged.record.id, "e-kohler");
  const fresh = mergeCompany(RECORDS, { id: "e-moen", name: "Moen Inc.", identityKey: companyIdentityKey("Moen Inc."), aliases: [] });
  assert.equal(fresh.matched, false);
  assert.equal(fresh.record.id, "e-moen");
});

test("website research expands exact-name searches with identity context", () => {
  assert.deepEqual(buildWebsiteSearchQueries({name:"Opulent International Group",address:"No. 126 Danuan Rd",country:"Taiwan",products:"PVC flooring"}),[
    '"Opulent International Group" official website',
    '"Opulent International Group" "No. 126 Danuan Rd"',
    '"Opulent International Group" Taiwan contact',
    '"Opulent International Group" PVC flooring manufacturer',
  ]);
});

test("website research accepts cross-validated group sites and rejects weak or directory candidates", () => {
  const valid={companyId:"supplier:opulent",companyName:"Opulent International Group",website:"https://www.mjgroupus.com/",websiteStatus:"verified_group_site" as const,websiteSourceUrl:"https://www.red-dot.org/project/example",identitySignals:["exact_name","address","country","product","corporate_relationship","authoritative_cross_reference"] as const,evidenceUrls:["https://www.red-dot.org/project/example","https://www.mjig.com/investor.pdf"]};
  assert.deepEqual(validateWebsiteResearch(valid),[]);
  assert.ok(validateWebsiteResearch({...valid,website:"https://www.volza.com/company-profile/opulent"}).some(error=>error.includes("independent HTTPS")));
  assert.ok(validateWebsiteResearch({...valid,identitySignals:["exact_name","country"]}).some(error=>error.includes("three independent")));
  assert.ok(validateWebsiteResearch({...valid,identitySignals:["exact_name","address","country"]}).some(error=>error.includes("group sites require")));
});

test("website research requires independent evidence domains and a traceable source", () => {
  const record={companyId:"supplier:a",companyName:"A",website:"https://a.example",websiteStatus:"verified_company_site" as const,websiteSourceUrl:"https://a.example/about",identitySignals:["exact_name","country","product"] as const,evidenceUrls:["https://a.example/about","https://a.example/contact"]};
  assert.ok(validateWebsiteResearch(record).some(error=>error.includes("two independent domains")));
  assert.ok(validateWebsiteResearch({...record,websiteSourceUrl:"https://missing.example/a",evidenceUrls:[...record.evidenceUrls,"https://registry.example/a"]}).some(error=>error.includes("source must be included")));
});

test("no-active-site research preserves a reviewed negative result", () => {
  const valid={companyId:"importer:a",companyName:"A",outcome:"no_active_company_site" as const,reviewSourceUrl:"https://registry.example/a",identitySignals:["exact_name","address","country"] as const,evidenceUrls:["https://registry.example/a","https://archive.example/a"],rejectedCandidates:[{url:"https://a.example/",reason:"Historical domain is inactive"}]};
  assert.deepEqual(validateNoActiveWebsiteResearch(valid),[]);
  assert.ok(validateNoActiveWebsiteResearch({...valid,rejectedCandidates:[]}).some(error=>error.includes("rejected candidate")));
});

test("ranking layer is independent from the query layer", () => {
  for (const directory of ["../lib/ranking/", "../lib/entities/"]) {
    for (const file of readdirSync(new URL(directory, import.meta.url))) {
      if (!file.endsWith(".ts")) continue;
      const source = readFileSync(new URL(`${directory}${file}`, import.meta.url), "utf8");
      const violation = /from ["']\.\.+\/(query|providers)\//.exec(source);
      assert.equal(violation, null, `${directory}${file} must not import from ${violation ? violation[1] : "query/providers"}`);
    }
  }
});
