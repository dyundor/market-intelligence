#!/usr/bin/env node
import { readFileSync } from "fs"; import { join, dirname } from "path"; import { fileURLToPath } from "url";
const root = dirname(dirname(fileURLToPath(import.meta.url)));
const env = readFileSync(join(root, ".env"), "utf8").split("\n").reduce((e, l) => { const t = l.trim(); if (!t || t[0] === "#") return e; const eq = t.indexOf("="); if (eq > 0) e[t.slice(0, eq)] = t.slice(eq + 1); return e; }, {});
const KEY = env.IMPORTYETI_API_KEY, URL = env.IMPORTYETI_API_URL || "https://data.importyeti.com";
const RESERVE = 80;

const QUERIES = ["bathroom faucet","basin faucet","lavatory faucet","shower system","rain shower","hand shower","bath fixtures"];

function clamp(v,min,max){return Math.min(max,Math.max(min,v));}
function ratioScale(v,b){if(b<=0)return 0;return clamp(Math.round(100*Math.min(v,b)/b),0,100);}
function tierShip(s){if(s>=500)return{val:100,t:"Enterprise"};if(s>=100)return{val:70,t:"Mid-market"};if(s>=20)return{val:40,t:"Small"};return{val:15,t:"Small"};}
function classPM(pd){const t=pd.join(" ").toLowerCase();if(!t)return"M";const b=["bathroom","lavatory","basin","vanity","shower","bath","faucet","tap","mixer","vessel","widespread"].filter(k=>t.includes(k)).length;return b>=2?"H":b>=1?"M":"L";}
function classBT(pd,n){const t=[...pd,n].join(" ").toLowerCase();const b=["bathroom","lavatory","basin","vanity","shower","bath","faucet","tap","mixer"].filter(k=>t.includes(k)).length;const k=["kitchen"].filter(k=>t.includes(k)).length;if(b>=2&&k===0)return"Bathroom Specialist";if(b>=1&&k>=1)return"Mixed Bathroom/Kitchen";return"General Plumbing";}
const CH=[/china/i,/chinese/i,/shenzhen/i,/guangzhou/i,/shanghai/i,/ningbo/i,/yiwu/i,/foshan/i,/dongguan/i,/xiamen/i,/tianjin/i,/crescent/i,/regent/i,/rin shing/i];
function scoreBuyer(c){
  const s=c.s||0,sup=c.sc||0,cc=c.cc||0,ts=tierShip(s);
  const rec=s>0?80:0,conc=clamp((c.r||50)*0.7-(c.bt.includes("Mixed")?15:0)-(/kitchen/i.test((c.pd||[]).join(" "))?15:0),10,100);
  const pr=c.pm==="H"?70:c.pm==="M"?50:30;
  const factors=[ts.val*35,rec*20,ratioScale(sup,5)*5,sup>0?ratioScale(cc,Math.min(sup,3))*5:0,0,0,pr*10,conc*12,ratioScale(c.id||80,100)*3,s>0?100*5:50*5];
  let base=clamp(Math.round(factors.reduce((s,f)=>s+f,0)/100),0,100);
  if(/kitchen/i.test((c.pd||[]).join(" "))&&s>0)base-=5;
  if(s<20&&s>0)base-=3;
  return{score:clamp(base,0,100),tier:ts.t};
}
function priority(s){return s>=65?'A':s>=35?'B':'C';}

const HH="=".repeat(82);
console.log(HH);
console.log("SPRINT 14.18 — CONTROLLED EXPANSION");
console.log(HH);
console.log(`Queries: ${QUERIES.length}  |  capture_only  |  Max: 8 credits  |  Reserve: ${RESERVE}`);
console.log();

let totalCost=0; const all=[]; const prev=25;

for(let qi=0;qi<QUERIES.length;qi++){
  const q=QUERIES[qi],enc=encodeURIComponent(q),url=`${URL}/v1.0/product/${enc}/companies?limit=50`;
  console.log(`Q${qi+1}: ${q}  —  balance: ${(94.8-totalCost).toFixed(1)} · est: 0.3cr · to reserve: ${(94.8-totalCost-0.3-RESERVE).toFixed(1)}`);
  const t0=Date.now();
  let r;try{r=await fetch(url,{headers:{Authorization:`Bearer ${KEY}`,Accept:"application/json","User-Agent":"TradeScope/1.0"},signal:AbortSignal.timeout(30000)});}catch(e){console.log(`  FAILED`);continue;}
  if(!r.ok){console.log(`  ${r.status}`);continue;}
  const raw=await r.json();
  const data=raw.data||[],cost=raw.requestCost||0.3;totalCost+=cost;
  console.log(`  ${r.status} ${Date.now()-t0}ms — ${data.length} companies, ${cost}cr${data.length?":":""}`);
  const mapped=data.map(c=>({
    query:q,name:c.company_name||"?",s:c.company_total_shipments||0,ms:c.matching_shipments||0,
    suppNames:c.company_suppliers||[],pd:c.product_description||[],r:c.relevance_score||0,
    sc:c.total_suppliers||c.company_suppliers?.length||1,id:80
  }));
  for(const c of mapped){
    c.cc=c.suppNames.filter(s=>CH.some(p=>p.test(s))).length;c.sc=c.suppNames.length||1;
    c.pm=classPM(c.pd);c.bt=classBT(c.pd,c.name);
    const sc=scoreBuyer(c);c.score=sc.score;c.tier=sc.tier;c.p=priority(c.score);
  }
  all.push(...mapped);
}

// ═══ 1. GROWTH ═══
const uni=new Map();all.forEach(c=>{const k=c.name.toLowerCase().trim();if(!uni.has(k)||uni.get(k).s<c.s)uni.set(k,c);});
const unique=[...uni.values()].sort((a,b)=>b.score-a.score);
console.log();
console.log(HH);
console.log("1. DATASET GROWTH");
console.log(HH);
console.log(`  Raw: ${all.length} · Unique: ${unique.length} · Dup: ${all.length-unique.length} (${Math.round((all.length-unique.length)/Math.max(1,all.length)*100)}%)`);
console.log(`  Previous: ${prev} unique → Now: ${unique.length} (+${unique.length-prev})`);
const dist={Enterprise:0,"Mid-market":0,Small:0};unique.forEach(c=>dist[c.tier]++);
console.log(`  Enterprise: ${dist.Enterprise} · Mid-market: ${dist["Mid-market"]} · Small: ${dist.Small}`);

// ═══ 2. TOP BUYERS ═══
console.log();
console.log(HH);
console.log("2. BUYER INTELLIGENCE");
console.log(HH);
console.log();
console.log("  #  Company                         Score P  Tier        BOLs   CN  Match  Type");
console.log("  "+"─".repeat(78));
for(let i=0;i<Math.min(unique.length,40);i++){
  const c=unique[i];
  console.log(`  ${String(i+1).padStart(2)}  ${c.name.slice(0,32).padEnd(33)}${String(c.score).padEnd(5)}${c.p} ${c.tier.padEnd(11)}${String(c.s).padStart(5)}  ${c.cc?"✓":"✗"}  ${c.pm.padEnd(6)} ${c.bt.slice(0,22)}`);
}

// ═══ 3. VALIDATION ═══
console.log();
console.log(HH);
console.log("3. MODEL VALIDATION");
console.log(HH);
const aTier=unique.filter(c=>c.p==="A"),bTier=unique.filter(c=>c.p==="B");
console.log(`\n  A-tier (${aTier.length}): avg score ${Math.round(aTier.reduce((s,c)=>s+c.score,0)/Math.max(1,aTier.length))}, avg BOLs ${Math.round(aTier.reduce((s,c)=>s+c.s,0)/Math.max(1,aTier.length))}`);
console.log(`  B-tier (${bTier.length}): avg score ${Math.round(bTier.reduce((s,c)=>s+c.score,0)/Math.max(1,bTier.length))}, avg BOLs ${Math.round(bTier.reduce((s,c)=>s+c.s,0)/Math.max(1,bTier.length))}`);
const fp=aTier.filter(c=>c.bt.includes("Mixed")||c.pm==="M"||c.s<50);
console.log(`\n  Potential A-tier concerns:`);
if(fp.length){fp.forEach(c=>console.log(`    ⚠ ${c.name} (${c.score}A): ${c.bt} · ${c.pm} · ${c.s}BOLs · ${c.query}`));}
else console.log("    ✓ None");

// ═══ 4. CREDIT ═══
console.log();
console.log(HH);
console.log("4. CREDIT REPORT");
console.log(HH);
console.log();
console.log(`  ╔══════════════════════════════════════╗`);
console.log(`  ║  本次消耗:        ${totalCost.toFixed(1).padStart(4)} credits               ║`);
console.log(`  ║  累计消耗:        ${(4.6+totalCost).toFixed(1).padStart(4)} credits               ║`);
console.log(`  ║  当前余额:        ${(94.8-totalCost).toFixed(1).padStart(4)} credits               ║`);
console.log(`  ║  距${RESERVE}预留:    ${(94.8-totalCost-RESERVE).toFixed(1).padStart(4)} credits               ║`);
console.log(`  ╚══════════════════════════════════════╝`);
console.log();
console.log(`  Unique buyers: ${unique.length}  |  capture_only ✓  |  production: no`);
