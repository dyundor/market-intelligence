#!/usr/bin/env node
/**
 * Local D1 helper for development.
 *
 * Writes directly to the local D1 SQLite file that the Cloudflare Vite plugin
 * (miniflare) uses in development (binding DB -> site-creator-d1), matching
 * the placeholder database id from vite.config.ts.
 *
 * Usage:
 *   node scripts/db-local.mjs migrate        # apply drizzle journal migrations
 *   node scripts/db-local.mjs seed [file]    # apply a SQL file (default scripts/seed-dev.sql)
 *   node scripts/db-local.mjs query "<sql>"  # run arbitrary SQL
 *   node scripts/db-local.mjs tables         # list local tables
 */
import { DatabaseSync } from "node:sqlite";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const stateDir = join(root, ".wrangler", "state", "v3", "d1", "miniflare-D1DatabaseObject");

function openDatabase() {
  if (!existsSync(stateDir)) {
    console.error(`Local D1 state not found at ${stateDir}`);
    console.error("Start `npm run dev` once so the Cloudflare plugin creates the DB binding.");
    process.exit(1);
  }
  const files = readdirSync(stateDir).filter(file => file.endsWith(".sqlite") && file !== "metadata.sqlite");
  if (!files.length) {
    console.error(`No local D1 database file found in ${stateDir}`);
    process.exit(1);
  }
  return new DatabaseSync(join(stateDir, files[0]));
}

function runSql(db, sql) {
  if (sql.includes(";")) {
    db.exec(sql);
  } else {
    db.prepare(sql).run();
  }
}

const [command, ...rest] = process.argv.slice(2);
const db = openDatabase();

switch (command) {
  case "migrate": {
    const journalPath = join(root, "drizzle/meta/_journal.json");
    if (!existsSync(journalPath)) {
      console.error(`Journal not found: ${journalPath}`);
      process.exit(1);
    }
    const objects = db
      .prepare(
        "SELECT name FROM sqlite_master WHERE name NOT LIKE 'sqlite_%' AND name NOT LIKE '_cf_%' AND (type='table' OR type='index')",
      )
      .all();
    for (const { name } of objects) {
      db.exec(`DROP TABLE IF EXISTS ${name}`);
      db.exec(`DROP INDEX IF EXISTS ${name}`);
    }
    if (objects.length) console.log(`Dropped ${objects.length} existing local object(s) before migrating.`);
    const journal = JSON.parse(readFileSync(journalPath, "utf8"));
    const applied = [];
    for (const entry of journal.entries) {
      const file = join(root, "drizzle", `${entry.tag}.sql`);
      if (!existsSync(file)) {
        console.error(`Missing migration file: ${file}`);
        process.exit(1);
      }
      db.exec(readFileSync(file, "utf8"));
      applied.push(entry.tag);
    }
    console.log(`Applied ${applied.length} migration(s): ${applied.join(", ")}`);
    break;
  }
  case "seed": {
    const file = rest[0] || "scripts/seed-dev.sql";
    const path = join(root, file);
    if (!existsSync(path)) {
      console.error(`Seed file not found: ${path}`);
      process.exit(1);
    }
    db.exec(readFileSync(path, "utf8"));
    console.log(`Seeded ${file}`);
    break;
  }
  case "query": {
    const rows = db.prepare(rest.join(" ")).all();
    console.log(JSON.stringify(rows, null, 2));
    break;
  }
  case "tables": {
    const rows = db
      .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name")
      .all();
    console.log(rows.map(row => row.name).join("\n"));
    break;
  }
  default: {
    console.log("Usage: node scripts/db-local.mjs <migrate|seed|query|tables>");
    process.exit(1);
  }
}
