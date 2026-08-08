#!/usr/bin/env node
/**
 * Sprint 14.22 — Buyer Deep Research Cards
 *
 * Top 10 prospects with supply opportunity analysis and
 * first contact message angles for Yundor sales team.
 */

const HH="=".repeat(86),HR="─".repeat(86);

const cards=[
  {
    name:"Waxman Consumer Products Group",type:"Brand Owner",tier:"Enterprise",
    s:943,bt:"General Plumbing",cc:true,ct:"Brand Owner",
    products:["Bathroom Faucets","Basin Faucets","Shower Systems","Bath Accessories"],
    fit:90,con:86,out:88,strat:"OEM/ODM Pitch",prodRec:"Full Bathroom Collection",
    opportunity:"Brand owner importing 943 BOLs/year with existing China supplier — ideal OEM replacement or expansion target. They already trust Chinese manufacturing; Yundor can offer better pricing, quality control, or category expansion.",
    entry:"品控升级 + 品类扩展：展示 Yundor 的全浴室产品线和品控流程，强调比现有供应商更优的交期和服务。",
    risk:"无明显风险 — 纯进口品牌方，已有中国采购经验",
    contact:"Hi, I noticed Waxman imports bathroom products from China. Yundor manufactures full bathroom collections (faucets, showers, basins) with ISO-certified quality control. Would you be open to discussing OEM opportunities?",
  },
  {
    name:"Rgm Distribution",type:"Distributor",tier:"Enterprise",
    s:641,bt:"Bathroom Specialist",cc:true,ct:"Distributor",
    products:["Bathroom Faucets","Basin Faucets"],
    fit:86,con:83,out:85,strat:"OEM/ODM Pitch",prodRec:"Full Bathroom Collection",
    opportunity:"Bathroom-specialist distributor with 641 BOLs and active China sourcing. Already focused on bathroom — Yundor can become their primary OEM supplier, replacing multiple vendors with one-stop sourcing.",
    entry:"一站式浴室供应：你目前从中国采购浴室龙头和面盆龙头，Yundor 可以提供全系列浴室产品（龙头+花洒+配件），简化你的供应链。",
    risk:"无明显风险 — 专注浴室品类，已有中国采购",
    contact:"Hi, I see Rgm Distribution specializes in bathroom imports from China. Yundor is a one-stop bathroom manufacturer — faucets, showers, basins, accessories. We could simplify your supply chain. Interested in a product catalog?",
  },
  {
    name:"Am Conservation Group",type:"Brand Owner",tier:"Enterprise",
    s:1187,bt:"General Plumbing",cc:true,ct:"Brand Owner",
    products:["Bathroom Faucets","Shower Systems","Plumbing Fixtures"],
    fit:85,con:86,out:85,strat:"OEM/ODM Pitch",prodRec:"Full Bathroom Collection",
    opportunity:"Large brand owner with 1,187 BOLs and existing China supplier. They have volume and China experience — Yundor can offer private label/OEM for their bathroom product line expansion or supplier diversification.",
    entry:"供应商多元化：作为 1000+ BOLs 的大进口商，供应商风险分散很重要。Yundor 可以成为你的第二供应商，提供全浴室产品线的 OEM 服务。",
    risk:"无明显风险",
    contact:"Hi, Am Conservation Group's import volume is impressive. We're a Chinese bathroom manufacturer serving US brands with OEM/private label. Would a second-source option for your bathroom line interest you?",
  },
  {
    name:"Stellar Innovations Group",type:"Brand Owner",tier:"Enterprise",
    s:878,bt:"Mixed Bathroom/Kitchen",cc:false,ct:"Brand Owner",
    products:["Bathroom Faucets","Kitchen Faucets","Shower Systems"],
    fit:80,con:78,out:79,strat:"OEM/ODM Pitch",prodRec:"Full Bathroom Collection",
    opportunity:"Brand owner with 878 BOLs but NO known China supplier — this is a greenfield opportunity. They may be sourcing through intermediaries. Yundor can offer direct factory pricing, cutting out middlemen.",
    entry:"跳过中间商：我们注意到 Stellar 目前可能通过中间商采购。Yundor 是直接工厂，可以提供更好的价格、品质和交期。浴室全系列 OEM 服务。",
    risk:"混合品类（浴室+厨房），需确认浴室需求占比；无已知中国采购经验 — 需要教育和建立信任",
    contact:"Hi, I see Stellar Innovations imports bathroom and kitchen products. Yundor is a direct bathroom factory in China — we can offer better pricing than intermediaries. Have you considered direct sourcing?",
  },
  {
    name:"Best Mart",type:"Retailer",tier:"Enterprise",
    s:858,bt:"Bathroom Specialist",cc:true,ct:"Retailer",
    products:["Basin Faucets","Bathroom Faucets","Shower Systems"],
    fit:73,con:86,out:78,strat:"Private Label Pitch",prodRec:"Basin Faucets + Shower Systems",
    opportunity:"Retailer with 858 BOLs and active China sourcing. Perfect for private label/house brand — Yundor can develop exclusive SKUs for Best Mart's own brand, providing competitive advantage in retail.",
    entry:"自有品牌机会：Best Mart 已经有 858 BOLs 的中国采购量。Yundor 可以为你开发专属 SKU 和自有品牌包装，帮助你在零售终端建立差异化。",
    risk:"无明显风险",
    contact:"Hi, Best Mart — have you considered launching your own brand of bathroom faucets? Yundor does private label OEM for US retailers — exclusive designs, your packaging, direct factory pricing. Would you like samples?",
  },
  {
    name:"Gisela Supplies",type:"Distributor",tier:"Enterprise",
    s:940,bt:"General Plumbing",cc:false,ct:"Distributor",
    products:["Bathroom Faucets","Plumbing Supplies"],
    fit:73,con:74,out:73,strat:"OEM/ODM Pitch",prodRec:"Full Bathroom Collection",
    opportunity:"Distributor with 940 BOLs but no known China supplier — likely using domestic wholesalers. Yundor can offer direct factory OEM, potentially saving 30-40% on sourcing costs.",
    entry:"降低采购成本：Gisela 目前可能通过美国批发商采购。直接从中国工厂采购可以节省 30-40% 成本。Yundor 提供全浴室产品的 OEM 服务。",
    risk:"无已知中国采购经验 — 需要教育采购流程",
    contact:"Hi Gisela, I noticed you distribute bathroom products. Direct sourcing from China could reduce your costs 30-40%. Yundor is a bathroom manufacturer — would a cost comparison interest you?",
  },
  {
    name:"Jr Fast Trade",type:"Trading Company",tier:"Mid-market",
    s:185,bt:"Mixed Bathroom/Kitchen",cc:true,ct:"Trading Company",
    products:["Bathroom Faucets","Kitchen Fixtures"],
    fit:72,con:73,out:72,strat:"Private Label Pitch",prodRec:"Basin Faucets + Shower Systems",
    opportunity:"Trading company with active China sourcing and 185 BOLs. Agile partner — can test new products quickly. Yundor can offer exclusive regional distribution rights for bathroom products.",
    entry:"独家代理：Jr Fast 已有中国采购经验。Yundor 可以提供浴室品类的独家区域代理权 + OEM 贴牌服务，帮你快速扩大产品线。",
    risk:"混合品类（浴室+厨房），需确认浴室是核心业务",
    contact:"Hi Jr Fast Trade, we're looking for a US distribution partner for our bathroom product line. With your existing China sourcing experience, this could be a natural fit. Interested in exclusive regional rights?",
  },
  {
    name:"Qingyuan Trade",type:"Trading Company",tier:"Mid-market",
    s:137,bt:"Bathroom Specialist",cc:true,ct:"Trading Company",
    products:["Bathroom Faucets","Shower Systems"],
    fit:72,con:73,out:72,strat:"Private Label Pitch",prodRec:"Basin Faucets + Shower Systems",
    opportunity:"Bathroom-specialist trading company with 137 BOLs. Already focused on bathroom and importing from China — Yundor can become their primary bathroom supplier with OEM/private label support.",
    entry:"品类集中优势：Qingyuan 专注浴室品类，与 Yundor 的产品线完美匹配。我们可以成为你的主要浴室产品供应商，提供 OEM 贴牌支持。",
    risk:"无明显风险",
    contact:"Hi Qingyuan Trade, your focus on bathroom products aligns perfectly with Yundor. As a bathroom manufacturer, we can be your primary supplier — faucets, showers, basins. Shall we discuss OEM terms?",
  },
  {
    name:"Water Safety",type:"Importer",tier:"Enterprise",
    s:653,bt:"General Plumbing",cc:true,ct:"Importer",
    products:["Plumbing Fixtures","Bathroom Products"],
    fit:67,con:76,out:71,strat:"Distribution Partnership",prodRec:"Full Bathroom Collection",
    opportunity:"Large general plumbing importer with 653 BOLs. While not bathroom-specialist, the volume and China experience make them a strong distribution partner for Yundor's bathroom line.",
    entry:"品类扩展：Water Safety 已有大量管道产品进口。Yundor 可以帮助你扩展浴室品类，提供全系列浴室产品的分销合作。",
    risk:"通用管道品类 — 浴室占比不确定",
    contact:"Hi Water Safety, would adding a bathroom product line complement your current plumbing imports? Yundor manufactures full bathroom collections — OEM and distribution partnership available.",
  },
  {
    name:"Etl",type:"Importer",tier:"Mid-market",
    s:411,bt:"Bathroom Specialist",cc:true,ct:"Importer",
    products:["Rain Showers","Shower Systems","Bathroom Faucets"],
    fit:68,con:71,out:69,strat:"Private Label Pitch",prodRec:"Basin Faucets + Shower Systems",
    opportunity:"Bathroom importer with 411 BOLs and China experience. Already importing rain showers and faucets — Yundor can offer better pricing on the same categories plus expand to basins and accessories.",
    entry:"价格优化+品类扩展：Etl 已经进口花洒和龙头。Yundor 可以提供更有竞争力的价格，同时帮你扩展面盆龙头和配件品类。",
    risk:"无明显风险",
    contact:"Hi ETL, we manufacture the same products you're importing — rain showers and faucets. Yundor could offer you better pricing plus expand into basin faucets and bathroom accessories. Interested in a quote comparison?",
  },
];

// ═══ REPORT ═══
console.log(HH);
console.log("SPRINT 14.22 — BUYER DEEP RESEARCH CARDS");
console.log(HH);
console.log("Top 10 Yundor Prospects · Sales-Ready Intelligence · "+new Date().toISOString());
console.log();

// Summary table
console.log(HR);
console.log("TOP 10 PROSPECT SUMMARY");
console.log(HR);
console.log();
console.log("  #  Company                          Score  Strategy            CN  BOLs   Type          Key Opportunity");
console.log("  "+"─".repeat(82));
for(let i=0;i<cards.length;i++){
  const c=cards[i];
  console.log(`  ${i+1}  ${c.name.slice(0,34).padEnd(35)}${String(c.out).padEnd(6)}${c.strat.padEnd(20)}${c.cc?"✓":"✗"}  ${String(c.s).padStart(5)}  ${c.type.padEnd(14)}${c.opportunity.slice(0,40)}...`);
}

// Full cards
for(let i=0;i<cards.length;i++){
  const c=cards[i];
  console.log();
  console.log(HR);
  console.log(`PROSPECT #${i+1}: ${c.name}`);
  console.log(HR);
  console.log();
  console.log(`  ┌─ 公司信息`);
  console.log(`  │  类型:       ${c.type}`);
  console.log(`  │  规模:       ${c.tier} (${c.s} BOLs)`);
  console.log(`  │  买方类型:   ${c.bt}`);
  console.log(`  │  中国采购:   ${c.cc?"是 ✓":"否 ✗"}`);
  console.log(`  │  产品:       ${c.products.join(" · ")}`);
  console.log(`  └`);
  console.log();
  console.log(`  ┌─ 商业评估`);
  console.log(`  │  商业匹配:   ${c.fit}/100`);
  console.log(`  │  可联系性:   ${c.con}/100`);
  console.log(`  │  综合评分:   ${c.out}/100`);
  console.log(`  │  销售策略:   ${c.strat}`);
  console.log(`  │  推荐产品:   ${c.prodRec}`);
  console.log(`  └`);
  console.log();
  console.log(`  ┌─ 供应机会分析`);
  console.log(`  │  ${c.opportunity}`);
  console.log(`  └`);
  console.log();
  console.log(`  ┌─ Yundor 切入点`);
  console.log(`  │  ${c.entry}`);
  console.log(`  └`);
  console.log();
  console.log(`  ┌─ 风险`);
  console.log(`  │  ${c.risk}`);
  console.log(`  └`);
  console.log();
  console.log(`  ┌─ 首次联系话术 (First Contact Message)`);
  console.log(`  │  "${c.contact}"`);
  console.log(`  └`);
}

// Credit
console.log();
console.log(HH);
console.log("CREDIT REPORT");
console.log(HH);
console.log();
console.log("  No API · 0 credits · Balance: 90.1 · Reserve: 80");
console.log();
console.log("  Ready for:  生产模式 — 将 TOP 10 买家入库");
console.log("  Next:       发送首次联系的邮件/消息");
console.log();
