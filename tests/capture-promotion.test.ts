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
});
