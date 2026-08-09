import { after, before, describe, it } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";

const root=process.cwd();
let tempDir="";
let dbPath="";

describe("Reviewed capture promotion",()=>{
  before(()=>{
    tempDir=mkdtempSync(join(tmpdir(),"yundor-capture-promotion-"));
    dbPath=join(tempDir,"capture.sqlite");
    const db=new DatabaseSync(dbPath);
    const journal=JSON.parse(readFileSync(join(root,"drizzle/meta/_journal.json"),"utf8"));
    for(const entry of journal.entries)db.exec(readFileSync(join(root,"drizzle",`${entry.tag}.sql`),"utf8"));
    db.close();
  });
  after(()=>rmSync(tempDir,{recursive:true,force:true}));

  it("validates the complete manifest in a transaction and rolls back by default",()=>{
    const output=execFileSync(process.execPath,["scripts/promote-importyeti-capture.mjs",`--db=${dbPath}`],{cwd:root,encoding:"utf8"});
    const report=JSON.parse(output);
    assert.equal(report.mode,"dry-run");
    assert.equal(report.filesVerified,15);
    assert.equal(report.validation.passed,true);
    assert.ok(report.after.realImporters>=20);
    const db=new DatabaseSync(dbPath);
    assert.equal(db.prepare("SELECT COUNT(*) count FROM importyeti_web_entities").get().count,0);
    db.close();
  });

  it("promotes traceable company and shipment evidence idempotently",()=>{
    const first=JSON.parse(execFileSync(process.execPath,["scripts/promote-importyeti-capture.mjs",`--db=${dbPath}`,"--apply"],{cwd:root,encoding:"utf8"}));
    const second=JSON.parse(execFileSync(process.execPath,["scripts/promote-importyeti-capture.mjs",`--db=${dbPath}`,"--apply"],{cwd:root,encoding:"utf8"}));
    assert.equal(first.after.realImporters,49);
    assert.equal(first.after.shipments,170);
    assert.equal(first.after.linkedShipments,170);
    assert.equal(second.mode,"already-applied");
    assert.deepEqual(second.after,first.after);
  });

  it("imports reviewed company websites with preserved evidence and namesake rejections",()=>{
    const dry=JSON.parse(execFileSync(process.execPath,["--experimental-strip-types","scripts/import-public-company-websites.mjs",`--db=${dbPath}`],{cwd:root,encoding:"utf8"}));
    assert.equal(dry.mode,"dry-run");
    assert.equal(dry.reviewed,1);
    const first=JSON.parse(execFileSync(process.execPath,["--experimental-strip-types","scripts/import-public-company-websites.mjs",`--db=${dbPath}`,"--apply"],{cwd:root,encoding:"utf8"}));
    const second=JSON.parse(execFileSync(process.execPath,["--experimental-strip-types","scripts/import-public-company-websites.mjs",`--db=${dbPath}`,"--apply"],{cwd:root,encoding:"utf8"}));
    assert.equal(first.written,1);
    assert.equal(second.written,0);
    assert.equal(second.unchanged,1);
    const verifiedDb=new DatabaseSync(dbPath);
    const opulent=verifiedDb.prepare("SELECT website,website_status,website_source_url,raw_evidence FROM importyeti_web_entities WHERE id='supplier:opulent-international-group'").get();
    assert.equal(opulent.website,"https://www.mjgroupus.com/");
    assert.equal(opulent.website_status,"verified_group_site");
    assert.match(opulent.website_source_url,/red-dot\.org/);
    assert.match(opulent.raw_evidence,/opulentintl\.com/);
    assert.match(opulent.raw_evidence,/India chemicals and ceramics company/);
    verifiedDb.close();
  });

  it("initializes qualified real buyers without regressing an existing contact-ready lead",()=>{
    const db=new DatabaseSync(dbPath);
    db.prepare("INSERT INTO buyer_watchlist (id,company_id,status,notes,lead_status,created_at,updated_at) VALUES (?,?,?,?,?,?,?)").run("test-am","importer:am-conservation-group","researching","verified public contact","contact_ready","2026-08-08","2026-08-08");
    db.close();
    const report=JSON.parse(execFileSync(process.execPath,["--experimental-strip-types","scripts/initialize-real-sales-pipeline.mjs",`--db=${dbPath}`,"--apply"],{cwd:root,encoding:"utf8"}));
    assert.ok(report.selected>=10);
    const verifiedDb=new DatabaseSync(dbPath);
    const am=verifiedDb.prepare("SELECT lead_status,outreach_strategy,recommended_products,outreach_score FROM buyer_watchlist WHERE company_id='importer:am-conservation-group'").get();
    assert.equal(am.lead_status,"contact_ready");
    assert.ok(am.outreach_strategy);
    assert.ok(am.recommended_products);
    assert.ok(Number(am.outreach_score)>0);
    verifiedDb.close();
  });
});
