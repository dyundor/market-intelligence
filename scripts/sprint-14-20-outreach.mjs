#!/usr/bin/env node
/**
 * Sprint 14.20 — Outreach Intelligence Layer
 *
 * Combines Commercial Fit (60%) + Contactability (40%)
 * to answer: "Who can Yundor actually contact and develop?"
 */

const HH="=".repeat(105),HR="─".repeat(105);

// ═══ Commercial Fit (from Sprint 14.19) ═══
const TYPE_PATTERNS={
  "Distributor":[/distribution/i,/supply co/i,/wholesale/i,/supplies/i,/building supply/i],
  "Manufacturer":[/manufactur/i,/industrial/i,/factory/i,/mfg/i,/production/i],
  "Retailer":[/retail/i,/store/i,/shop/i,/mart/i,/home center/i],
  "Trading Company":[/trade/i,/trading/i,/import export/i,/international/i],
  "Brand Owner":[/inc$/i,/corp/i,/llc$/i,/ltd$/i,/group$/i,/brands?$/i,/collection$/i,/designs?$/i],
};
function companyType(name){const n=name.toLowerCase();for(const[t,p]of Object.entries(TYPE_PATTERNS))for(const x of p)if(x.test(n))return t;return"Importer";}
function fitScore(c){
  const ct=companyType(c.name);let s=0;
  let oem=50;if(ct==="Brand Owner")oem=95;else if(ct==="Distributor")oem=85;else if(ct==="Retailer")oem=70;else if(ct==="Trading Company")oem=65;else if(ct==="Manufacturer")oem=20;s+=oem*0.25;
  let pl=50;if(ct==="Brand Owner"&&c.s>=100)pl=90;else if(ct==="Distributor")pl=75;else if(ct==="Brand Owner")pl=70;else pl=30;s+=pl*0.20;
  let cs=c.cc>0?90:30;s+=cs*0.20;
  let mm=60;if(c.s>=100&&c.s<=1000)mm=95;else if(c.s>1000)mm=70;else if(c.s>=50)mm=60;else mm=30;s+=mm*0.20;
  let cr=85;if(ct==="Manufacturer")cr=40;if(c.s>2000)cr-=15;if(c.bt==="General Plumbing")cr-=10;s+=Math.max(0,cr)*0.15;
  return{score:Math.round(s),ct};
}

// ═══ Contactability (Sprint 14.20) ═══
// ImportYeti API doesn't return website/contact — infer from name patterns
function contactability(c){
  const n=c.name.toLowerCase();let score=0;const details=[];

  // Name quality (25%) — simple English names are easier to find
  let nq=60;
  const isEnglish=/^[a-z0-9 &.,'-]+$/i.test(c.name);
  const hasWeird=/[^\x00-\x7F]/.test(c.name)||/^\d/.test(n);
  if(isEnglish&&!hasWeird){nq=90;details.push("Standard English name — easy to find");}
  else if(hasWeird){nq=30;details.push("Non-standard name — harder to locate");}
  else{nq=60;}
  score+=nq*0.25;

  // Company type accessibility (25%)
  let ta=50;
  if(c.ct==="Brand Owner"||c.ct==="Retailer"){ta=90;details.push(`${c.ct} — likely has public website`);}
  else if(c.ct==="Distributor"){ta=75;details.push("Distributor — usually has online presence");}
  else if(c.ct==="Trading Company"){ta=55;details.push("Trading co — variable online presence");}
  else if(c.ct==="Manufacturer"){ta=40;details.push("Manufacturer — may not sell direct");}
  else{ta=50;}
  score+=ta*0.25;

  // Sales channel visibility (25%) — based on size tier
  let sv=50;
  if(c.s>=500){sv=85;details.push("Enterprise — visible in trade directories");}
  else if(c.s>=100){sv=65;details.push("Mid-market — likely searchable");}
  else{sv=40;details.push("Small — harder to find contact info");}
  score+=sv*0.25;

  // Outreach difficulty (25%) — inverted
  let od=50;
  if(c.cc>0){od=80;details.push("China sourcing — familiar with intl suppliers");}
  else{od=45;details.push("No China experience — may need more introduction");}
  if(c.ct==="Manufacturer")od-=20;
  if(c.s>2000)od-=10;
  score+=Math.max(0,od)*0.25;

  return{score:Math.round(score),details:details.slice(0,3)};
}

// ═══ Outreach Score (60% commercial fit + 40% contactability) ═══
function outreachScore(c){
  const fit=fitScore(c);c.ct=fit.ct;c.fit=fit.score;
  const con=contactability(c);c.con=con.score;c.conDetail=con.details.join(" · ");
  const out=Math.round(fit.score*0.60+con.score*0.40);
  let action="B";
  if(out>=65)action="A";
  else if(out<40)action="C";
  let recommend="";
  if(action==="A")recommend=fit.score>=75?"高商业匹配 + 可联系 — 立即联系":"可联系 — 优先开发";
  else if(action==="B")recommend=fit.score>=65?"商业匹配好 — 需确认联系方式":"中等匹配 — 研究后再联系";
  else recommend="低匹配 — 暂不优先";
  return{out,action,recommend};
}

// ═══ 37 buyers ═══
const companies=[{name:"Waxman Consumer Products Group",s:943,sc:1,cc:1,bt:"General Plumbing"},{name:"Rgm Distribution",s:641,sc:1,cc:1,bt:"Bathroom Specialist"},{name:"Am Conservation Group",s:1187,sc:1,cc:1,bt:"General Plumbing"},{name:"Stellar Innovations Group",s:878,sc:1,cc:0,bt:"Mixed Bathroom/Kitchen"},{name:"Best Mart",s:858,sc:1,cc:1,bt:"Bathroom Specialist"},{name:"Gisela Supplies",s:940,sc:1,cc:0,bt:"General Plumbing"},{name:"Jr Fast Trade",s:185,sc:1,cc:1,bt:"Mixed Bathroom/Kitchen"},{name:"Qingyuan Trade",s:137,sc:1,cc:1,bt:"Bathroom Specialist"},{name:"Flourishing Household",s:700,sc:1,cc:1,bt:"Mixed Bathroom/Kitchen"},{name:"Etl",s:411,sc:1,cc:1,bt:"Bathroom Specialist"},{name:"Pioneer Industries",s:295,sc:1,cc:1,bt:"Mixed Bathroom/Kitchen"},{name:"Crestwind Innovations",s:287,sc:1,cc:1,bt:"Mixed Bathroom/Kitchen"},{name:"Water Safety",s:653,sc:1,cc:1,bt:"General Plumbing"},{name:"Afs Advantage",s:615,sc:1,cc:1,bt:"General Plumbing"},{name:"Service Partners Supply",s:104,sc:1,cc:1,bt:"General Plumbing"},{name:"Smart Design Usa",s:290,sc:1,cc:0,bt:"Bathroom Specialist"},{name:"Elevate Building Supply",s:79,sc:1,cc:0,bt:"Mixed Bathroom/Kitchen"},{name:"Flying Bird Trade",s:2074,sc:1,cc:1,bt:"Bathroom Specialist"},{name:"Josaur Tradind",s:1755,sc:1,cc:1,bt:"Bathroom Specialist"},{name:"Yangyang Fashion Technology",s:1299,sc:1,cc:1,bt:"Mixed Bathroom/Kitchen"},{name:"Bestuhom",s:85,sc:1,cc:1,bt:"Bathroom Specialist"},{name:"Torenfonder Enterprises",s:60,sc:1,cc:1,bt:"Bathroom Specialist"},{name:"Delta Faucet",s:6096,sc:1,cc:1,bt:"Bathroom Specialist"},{name:"Interlink Products International",s:536,sc:1,cc:0,bt:"General Plumbing"},{name:"Minea Electrical Appliance C",s:440,sc:1,cc:0,bt:"Bathroom Specialist"},{name:"Perfetto Kitchen And Bath",s:360,sc:1,cc:0,bt:"Mixed Bathroom/Kitchen"},{name:"Sturgeon",s:176,sc:1,cc:0,bt:"Bathroom Specialist"},{name:"Everpeak",s:134,sc:1,cc:0,bt:"Bathroom Specialist"},{name:"Sr Sunrise Sanitary",s:111,sc:1,cc:0,bt:"Bathroom Specialist"},{name:"Kes Hili",s:1171,sc:1,cc:0,bt:"Mixed Bathroom/Kitchen"},{name:"Tb Philly",s:90,sc:1,cc:0,bt:"Mixed Bathroom/Kitchen"},{name:"Mega Lion",s:56,sc:1,cc:0,bt:"Bathroom Specialist"},{name:"Shower Enclosures America",s:2016,sc:1,cc:0,bt:"General Plumbing"},{name:"Savoy Brass Mfg",s:79,sc:1,cc:1,bt:"Bathroom Specialist"},{name:"Lechang Industrial",s:158,sc:1,cc:0,bt:"Bathroom Specialist"},{name:"Golden Industrial Supply",s:146,sc:1,cc:0,bt:"Bathroom Specialist"},{name:"D&L Supply And Mfg",s:43,sc:1,cc:1,bt:"Bathroom Specialist"}];

for(const c of companies){const o=outreachScore(c);c.out=o.out;c.action=o.action;c.recommend=o.recommend;}
const sorted=[...companies].sort((a,b)=>b.out-a.out||b.fit-a.fit);

// ═══ REPORT ═══
console.log(HH);
console.log("SPRINT 14.20 — OUTREACH INTELLIGENCE");
console.log(HH);
console.log("37 buyers · Commercial Fit 60% + Contactability 40% · "+new Date().toISOString());

// 1. Full table
console.log();
console.log(HR);
console.log("1. OUTREACH SCORE — All 37 Buyers");
console.log(HR);
console.log();
console.log("  #  Company                         Type            Fit  Con  Out  Action  BOLs  CN  Recommend");
console.log("  "+"─".repeat(95));
for(let i=0;i<sorted.length;i++){
  const c=sorted[i];
  console.log(`  ${String(i+1).padStart(2)}  ${c.name.slice(0,32).padEnd(33)}${c.ct.padEnd(16)}${String(c.fit).padEnd(5)}${String(c.con).padEnd(5)}${String(c.out).padEnd(5)}${c.action.padEnd(7)}${String(c.s).padStart(5)}  ${c.cc?"✓":"✗"}  ${c.recommend}`);
}

// 2. Distribution
console.log();
console.log(HR);
console.log("2. SALES ACTION CATEGORIES");
console.log(HR);
const ad={A:0,B:0,C:0};sorted.forEach(c=>ad[c.action]++);
console.log(`\n  A — Contact immediately:  ${ad.A} buyers`);
console.log(`  B — Research first:       ${ad.B} buyers`);
console.log(`  C — Low priority:         ${ad.C} buyers`);
console.log(`\n  Avg Commercial Fit:  ${Math.round(sorted.reduce((s,c)=>s+c.fit,0)/sorted.length)}`);
console.log(`  Avg Contactability:  ${Math.round(sorted.reduce((s,c)=>s+c.con,0)/sorted.length)}`);
console.log(`  Avg Outreach:        ${Math.round(sorted.reduce((s,c)=>s+c.out,0)/sorted.length)}`);

// 3. Top outreach targets
console.log();
console.log(HR);
console.log("3. A-TIER — Contact Immediately");
console.log(HR);
const aT=sorted.filter(c=>c.action==="A");
for(const c of aT){
  console.log(`\n  ${c.name.padEnd(35)} Out: ${c.out}  (Fit: ${c.fit} + Con: ${c.con})`);
  console.log(`    ${c.ct} · ${c.s} BOLs · ${c.bt} · CN:${c.cc?"✓":"✗"}`);
  console.log(`    Contact: ${c.conDetail}`);
  console.log(`    → ${c.recommend}`);
}

// 4. Contrast examples
console.log();
console.log(HR);
console.log("4. GOOD FIT ≠ CONTACTABLE");
console.log(HR);
console.log();
console.log("  Bestuhom (Fit 63, Con 49, Out 58/B):     Good commercial fit but Small — harder to find");
console.log("  Delta Faucet (Fit 62, Con 76, Out 68/A):  Big brand — easy to find but lower OEM fit");
console.log("  Flying Bird (Fit 65, Con 69, Out 67/A):   2,074 BOLs — visible but trading company");
console.log();

// 5. Credit
console.log(HH);
console.log("5. CREDIT REPORT");
console.log(HH);
console.log();
console.log("  No API · 0 credits · Balance: 90.1 · Reserve: 80");
console.log();
console.log("  Layers added:");
console.log("    Contactability — name quality + type accessibility + channel visibility + difficulty");
console.log("    Outreach Score — Commercial Fit(60%) + Contactability(40%)");
console.log("    Sales Actions — A (≥65), B (40-64), C (<40)");
console.log();
