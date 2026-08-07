import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync, readdirSync } from "node:fs";
import { resolveCompanyIdentity, mergeCompany, type CompanyIdentityRecord } from "../lib/entities/company-resolver.ts";
import { companyIdentityKey } from "../lib/entities/company.ts";

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
