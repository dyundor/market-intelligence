#!/usr/bin/env node
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const envContent = readFileSync(join(root, ".env"), "utf8");
const env = {};
for (const line of envContent.split("\n")) {
  const t = line.trim(); if (!t || t.startsWith("#")) continue;
  const eq = t.indexOf("="); if (eq === -1) continue;
  env[t.slice(0, eq)] = t.slice(eq + 1);
}

const API_KEY = env.IMPORTYETI_API_KEY;
const API_URL = env.IMPORTYETI_API_URL || "https://data.importyeti.com";
const QUERY = "lavatory faucet";
const encoded = encodeURIComponent(QUERY);
const url = `${API_URL}/v1.0/product/${encoded}/companies?limit=50`;

const res = await fetch(url, {
  headers: { Authorization: `Bearer ${API_KEY}`, Accept: "application/json", "User-Agent": "TradeScope/1.0" },
  signal: AbortSignal.timeout(30000),
});

const raw = await res.text();
console.log("Status:", res.status);
console.log("Headers:", JSON.stringify(Object.fromEntries(res.headers.entries()), null, 2));
console.log();
console.log("Raw body:");
console.log(raw);
console.log();

let data;
try { data = JSON.parse(raw); } catch { console.log("Not valid JSON"); process.exit(1); }

console.log("Parsed keys:", Object.keys(data));
console.log();

// Show the first company full structure
const companies = data.companies || data.results || data.data || [];
if (companies.length > 0) {
  console.log("First company keys:", Object.keys(companies[0]));
  console.log("First company (full):", JSON.stringify(companies[0], null, 2));
}
console.log("Total companies:", companies.length);
