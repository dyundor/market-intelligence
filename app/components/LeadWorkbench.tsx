"use client";

import { FormEvent, useEffect, useState } from "react";
import { sortSalesLeads } from "../../lib/leads/pipeline-selection.ts";
import { contactHref, emailDraftHref } from "../../lib/leads/contact-link.ts";

export type LeadStatus = "new" | "researching" | "contact_ready" | "contacted" | "follow_up" | "qualified" | "opportunity" | "disqualified";

export type WatchlistItem = {
  id:string; companyId:string; status:string; notes:string; leadStatus:LeadStatus|null;
  outreachStrategy:string|null; recommendedProducts:string|null; confidence:string|null;
  commercialFitScore:number|null; outreachScore:number|null; createdAt:string; updatedAt:string;
  opportunityValueUsd:number|null; opportunityProbability:number|null; expectedCloseDate:string|null;
  company:{id:string;name:string;country:string;countryCode:string|null;entityType:string;totalShipments:number|null;latestShipmentDate:string|null;website:string|null;location:string}|null;
};

type Contact = {id:string;contactType:string;contactValue:string;label:string|null;sourceUrl:string;verificationStatus:string;notes:string};
type Action = {id:string;actionType:string;channel:string|null;summary:string;outcome:string|null;outcomeCode:string|null;qualificationFeedback:string|null;feedbackReason:string|null;nextAction:string|null;nextActionDue:string|null;createdAt:string;leadStatus?:LeadStatus|null};
type Draft = {id:string;channel:string;subject:string;body:string;status:"draft"|"approved"|"sent"|"archived";evidenceSummary:string;personalizationNotes:string;updatedAt:string};
type Dashboard = {metrics:{totalLeads:number;overdue:number;dueToday:number;contacted:number;positive:number;positiveRate:number;opportunityCount:number;pipelineValueUsd:number;weightedPipelineValueUsd:number};tasks:Array<{companyId:string;companyName:string;nextAction:string|null;nextActionDue:string|null;timing:"overdue"|"today"|"unscheduled"|"upcoming";opportunityValueUsd:number|null;weightedValueUsd:number;expectedCloseDate:string|null}>;today:string};
type ContactResearch = {id:string;companyName:string;companyId:string|null;status:"verified"|"needs_identity_match"|"unresolved"|"disqualified";reason:string;nextAction:string;researchedAt:string};
type ContactResearchData = {items:ContactResearch[];summary:{total:number;verified:number;needsIdentityMatch:number;unresolved:number;disqualified:number;coveragePercent:number}};
type OutreachReadiness = {ready:boolean;blockers:Array<"identity_unverified"|"verified_contact_missing"|"contact_research_unresolved"|"lead_disqualified">;identityVerified:boolean;verifiedContactCount:number;contactResearchStatus:string|null};

const STATUS_OPTIONS:LeadStatus[]=["new","researching","contact_ready","contacted","follow_up","qualified","opportunity","disqualified"];
const STATUS_ZH:Record<LeadStatus,string>={new:"新线索",researching:"调研中",contact_ready:"可联系",contacted:"已联系",follow_up:"待跟进",qualified:"已确认",opportunity:"商机",disqualified:"已排除"};

export function LeadWorkbench({items,loading,locale,onUpdate,onRemove,onOpenCompany}:{items:WatchlistItem[];loading:boolean;locale:string;onUpdate:(id:string,changes:Record<string,string|number>)=>Promise<void>;onRemove:(id:string)=>Promise<void>;onOpenCompany:(id:string)=>void}){
  const zh=locale==="zh-CN";
  const [selectedId,setSelectedId]=useState<string|null>(null);
  const orderedItems=sortSalesLeads(items);
  const selected=orderedItems.find(item=>item.id===selectedId)??orderedItems[0]??null;
  const selectedCompanyId=selected?.companyId??null;
  const [contacts,setContacts]=useState<Contact[]>([]);
  const [actions,setActions]=useState<Action[]>([]);
  const [drafts,setDrafts]=useState<Draft[]>([]);
  const [dashboard,setDashboard]=useState<Dashboard|null>(null);
  const [contactResearch,setContactResearch]=useState<ContactResearchData|null>(null);
  const [readiness,setReadiness]=useState<OutreachReadiness|null>(null);
  const [dashboardVersion,setDashboardVersion]=useState(0);
  const [loadedCompanyId,setLoadedCompanyId]=useState<string|null>(null);
  const [message,setMessage]=useState("");
  const detailLoading=selectedCompanyId!==null&&loadedCompanyId!==selectedCompanyId;
  const currentDraft=drafts.find(draft=>draft.status!=="archived")??null;
  const selectedResearch=contactResearch?.items.find(item=>item.companyId===selectedCompanyId)??null;

  useEffect(()=>{
    if(!selectedCompanyId)return;
    const controller=new AbortController();
    Promise.all([
      fetch(`/api/lead-contacts?companyId=${encodeURIComponent(selectedCompanyId)}`,{signal:controller.signal}).then(r=>r.ok?r.json():Promise.reject()),
      fetch(`/api/lead-actions?companyId=${encodeURIComponent(selectedCompanyId)}`,{signal:controller.signal}).then(r=>r.ok?r.json():Promise.reject()),
      fetch(`/api/lead-drafts?companyId=${encodeURIComponent(selectedCompanyId)}`,{signal:controller.signal}).then(r=>r.ok?r.json():Promise.reject()),
      fetch(`/api/lead-readiness?companyId=${encodeURIComponent(selectedCompanyId)}`,{signal:controller.signal}).then(r=>r.ok?r.json():Promise.reject()),
    ]).then(([contactData,actionData,draftData,readinessData])=>{setContacts(contactData.items||[]);setActions(actionData.items||[]);setDrafts(draftData.items||[]);setReadiness(readinessData);setLoadedCompanyId(selectedCompanyId);setMessage("");}).catch(()=>{if(!controller.signal.aborted){setLoadedCompanyId(selectedCompanyId);setMessage(zh?"无法读取销售记录":"Unable to load sales records");}});
    return()=>controller.abort();
  },[selectedCompanyId,zh]);

  useEffect(()=>{
    const controller=new AbortController();
    fetch("/api/lead-dashboard",{signal:controller.signal}).then(response=>response.ok?response.json():Promise.reject()).then(data=>setDashboard(data)).catch(()=>{});
    return()=>controller.abort();
  },[items.length,dashboardVersion]);

  useEffect(()=>{
    const controller=new AbortController();
    fetch("/api/contact-research",{signal:controller.signal}).then(response=>response.ok?response.json():Promise.reject()).then(data=>setContactResearch(data)).catch(()=>{});
    return()=>controller.abort();
  },[]);

  async function addContact(event:FormEvent<HTMLFormElement>){
    event.preventDefault();
    if(!selected)return;
    const formElement=event.currentTarget;
    const form=new FormData(formElement);
    const response=await fetch("/api/lead-contacts",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({companyId:selected.companyId,contactType:form.get("contactType"),contactValue:form.get("contactValue"),sourceUrl:form.get("sourceUrl"),label:form.get("label"),verificationStatus:form.get("verificationStatus")})});
    if(!response.ok){setMessage(zh?"联系方式保存失败，请检查必填项":"Contact could not be saved");return;}
    const contact=await response.json() as Contact;
    setContacts(previous=>[contact,...previous.filter(item=>item.id!==contact.id)]);
    if(contact.verificationStatus==="verified"){await onUpdate(selected.id,{leadStatus:"contact_ready"});setReadiness(previous=>previous?{...previous,verifiedContactCount:previous.verifiedContactCount+1,ready:previous.identityVerified&&previous.contactResearchStatus!=="needs_identity_match"&&previous.contactResearchStatus!=="unresolved",blockers:previous.blockers.filter(blocker=>blocker!=="verified_contact_missing")}:previous);}
    formElement.reset();setMessage(zh?"联系方式已保存":"Contact saved");
  }

  async function addAction(event:FormEvent<HTMLFormElement>){
    event.preventDefault();
    if(!selected)return;
    const formElement=event.currentTarget;
    const form=new FormData(formElement);
    const response=await fetch("/api/lead-actions",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({companyId:selected.companyId,actionType:form.get("actionType"),channel:form.get("channel"),summary:form.get("summary"),outcome:form.get("outcome"),outcomeCode:form.get("outcomeCode")||null,qualificationFeedback:form.get("qualificationFeedback")||null,feedbackReason:form.get("feedbackReason"),nextAction:form.get("nextAction"),nextActionDue:form.get("nextActionDue")})});
    if(!response.ok){setMessage(zh?"跟进记录保存失败":"Activity could not be saved");return;}
    const action=await response.json() as Action;
    setActions(previous=>[action,...previous]);
    if(action.leadStatus)await onUpdate(selected.id,{leadStatus:action.leadStatus});
    setDashboardVersion(value=>value+1);formElement.reset();setMessage(zh?"反馈已保存，销售阶段已同步":"Feedback saved and lead stage synchronized");
  }

  async function generateDraft(){
    if(!selected)return;
    const verifiedContact=contacts.find(contact=>contact.verificationStatus==="verified"&&contact.label)?.label;
    const response=await fetch("/api/lead-drafts",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({companyId:selected.companyId,contactName:verifiedContact})});
    if(!response.ok){setMessage(zh?"外联草稿生成失败":"Draft could not be generated");return;}
    const draft=await response.json() as Draft;setDrafts(previous=>[draft,...previous]);setMessage(zh?"外联草稿已生成，请审核后再使用":"Draft generated — review before use");
  }

  async function updateDraft(id:string,updates:Partial<Pick<Draft,"subject"|"body"|"status">>){
    const response=await fetch("/api/lead-drafts",{method:"PATCH",headers:{"Content-Type":"application/json"},body:JSON.stringify({id,...updates})});
    if(!response.ok){setMessage(zh?"草稿保存失败":"Draft could not be saved");return;}
    const draft=await response.json() as Draft;setDrafts(previous=>previous.map(item=>item.id===id?draft:item));setMessage(zh?"草稿已保存":"Draft saved");
  }

  async function copyDraftBody(body:string){
    try{
      await navigator.clipboard.writeText(body);
      setMessage(zh?"开发信正文已复制，请人工审核后发送":"Draft body copied — review before sending");
    }catch{
      setMessage(zh?"无法自动复制，请手工选择正文":"Could not copy automatically — select the body manually");
    }
  }

  async function updateOpportunity(changes:Record<string,string|number>){
    if(!selected)return;
    await onUpdate(selected.id,changes);
    setDashboardVersion(value=>value+1);
  }

  if(!items.length)return <div className="supplier-empty"><strong>{zh?"清单为空":"Watchlist is empty"}</strong><span>{zh?"从进口商排名或企业详情页保存潜在客户。":"Save prospects from importer rankings or company details."}</span></div>;

  return <div className="lead-workbench" aria-busy={loading||detailLoading}>
    {dashboard?<><div className="lead-dashboard"><span><b>{dashboard.metrics.totalLeads}</b>{zh?"全部 Lead":"Total leads"}</span><span className={dashboard.metrics.overdue?"alert":""}><b>{dashboard.metrics.overdue}</b>{zh?"逾期跟进":"Overdue"}</span><span><b>{dashboard.metrics.dueToday}</b>{zh?"今日待办":"Due today"}</span><span><b>{dashboard.metrics.contacted}</b>{zh?"已触达":"Contacted"}</span><span><b>{dashboard.metrics.positiveRate}%</b>{zh?"积极反馈率":"Positive rate"}</span><span><b>{new Intl.NumberFormat(locale,{style:"currency",currency:"USD",maximumFractionDigits:0}).format(dashboard.metrics.pipelineValueUsd)}</b>{zh?`管道总额（${dashboard.metrics.opportunityCount}）`:`Pipeline (${dashboard.metrics.opportunityCount})`}</span><span><b>{new Intl.NumberFormat(locale,{style:"currency",currency:"USD",maximumFractionDigits:0}).format(dashboard.metrics.weightedPipelineValueUsd)}</b>{zh?"加权管道":"Weighted pipeline"}</span><a href="/api/leads/export" download>{zh?"导出销售执行包":"Export sales execution pack"}</a></div>{dashboard.tasks.length?<div className="lead-tasks"><strong>{zh?`跟进待办（${dashboard.tasks.length}）`:`Follow-up queue (${dashboard.tasks.length})`}</strong>{dashboard.tasks.map(task=><button key={`${task.companyId}-${task.nextActionDue||"unscheduled"}`} className={task.timing} onClick={()=>setSelectedId(items.find(item=>item.companyId===task.companyId)?.id||null)}><span>{task.companyName}{task.opportunityValueUsd?<small>{new Intl.NumberFormat(locale,{style:"currency",currency:"USD",maximumFractionDigits:0}).format(task.opportunityValueUsd)} · {zh?"加权":"weighted"} {new Intl.NumberFormat(locale,{style:"currency",currency:"USD",maximumFractionDigits:0}).format(task.weightedValueUsd)}</small>:null}</span><b>{task.timing==="unscheduled"?(zh?"商机缺少下一步":"Opportunity has no next action"):(task.nextAction|| (zh?"待跟进":"Follow up"))}</b><em>{task.nextActionDue||(task.expectedCloseDate?`${zh?"预计成交":"Close"} ${task.expectedCloseDate}`:(zh?"请安排日期":"Schedule date"))}</em></button>)}</div>:null}</>:null}
    <div className="lead-pipeline">{STATUS_OPTIONS.map(status=><span key={status}><b>{items.filter(item=>(item.leadStatus||"new")===status).length}</b>{zh?STATUS_ZH[status]:status.replaceAll("_"," ")}</span>)}</div>
    {contactResearch?<section className="contact-research-queue"><header><div><strong>{zh?"联系人研究覆盖":"Contact research coverage"}</strong><small>{zh?`Top Prospect 中 ${contactResearch.summary.verified} 家可开发、${contactResearch.summary.disqualified} 家已排除`:`${contactResearch.summary.verified} actionable, ${contactResearch.summary.disqualified} disqualified`}</small></div><b>{contactResearch.summary.coveragePercent}%</b></header><div className="contact-research-bar"><i style={{width:`${contactResearch.summary.coveragePercent}%`}} /></div>{contactResearch.items.some(item=>item.status==="needs_identity_match"||item.status==="unresolved")?<details><summary>{zh?`${contactResearch.summary.needsIdentityMatch+contactResearch.summary.unresolved} 家待解析公司`:`${contactResearch.summary.needsIdentityMatch+contactResearch.summary.unresolved} companies need resolution`}</summary><div>{contactResearch.items.filter(item=>item.status==="needs_identity_match"||item.status==="unresolved").map(item=><article key={item.id}><span className={item.status}>{item.status==="needs_identity_match"?(zh?"需核对身份":"Identity match"):(zh?"未解析":"Unresolved")}</span><strong>{item.companyName}</strong><p>{item.reason}</p><small>{zh?"下一步":"Next"}: {item.nextAction}</small>{item.companyId?<button onClick={()=>setSelectedId(items.find(lead=>lead.companyId===item.companyId)?.id||null)}>{zh?"打开 Lead":"Open lead"}</button>:null}</article>)}</div></details>:null}</section>:null}
    <div className="lead-layout">
      <div className="lead-list">{orderedItems.map((item,index)=><button key={item.id} className={selected?.id===item.id?"active":""} onClick={()=>setSelectedId(item.id)}><i>{String(index+1).padStart(2,"0")}</i><span><strong>{item.company?.name||item.companyId}</strong><small>{item.outreachStrategy|| (zh?"待制定开发策略":"Strategy pending")}</small></span><em>{item.outreachScore??"—"}</em></button>)}</div>
      {selected?<section className="lead-detail">
        <header><div><small>{selected.company?.country||"—"} · {selected.company?.totalShipments??0} BOLs</small><button onClick={()=>onOpenCompany(selected.companyId)}>{selected.company?.name||selected.companyId}</button><p>{selected.recommendedProducts|| (zh?"推荐产品待确认":"Products pending")}</p></div><div><b>{selected.commercialFitScore??"—"}<small>/100 FIT</small></b><b>{selected.outreachScore??"—"}<small>/100 OUTREACH</small></b></div></header>
        <div className="lead-controls"><label>{zh?"销售阶段":"Lead stage"}<select value={selected.leadStatus||"new"} onChange={event=>onUpdate(selected.id,{leadStatus:event.target.value})}>{STATUS_OPTIONS.map(status=><option value={status} key={status}>{zh?STATUS_ZH[status]:status.replaceAll("_"," ")}</option>)}</select></label><label>{zh?"开发策略":"Outreach strategy"}<input key={`strategy-${selected.id}-${selected.outreachStrategy||""}`} defaultValue={selected.outreachStrategy||""} onBlur={event=>{if(event.target.value!==selected.outreachStrategy)onUpdate(selected.id,{outreachStrategy:event.target.value})}}/></label><label>{zh?"预计金额（USD）":"Value (USD)"}<input key={`value-${selected.id}-${selected.opportunityValueUsd??""}`} type="number" min="0" step="1" defaultValue={selected.opportunityValueUsd??""} onBlur={event=>{const value=event.target.valueAsNumber;if(Number.isSafeInteger(value)&&value>=0&&value!==selected.opportunityValueUsd)updateOpportunity({opportunityValueUsd:value})}}/></label><label>{zh?"成交概率（%）":"Probability (%)"}<input key={`probability-${selected.id}-${selected.opportunityProbability??""}`} type="number" min="0" max="100" step="1" defaultValue={selected.opportunityProbability??""} onBlur={event=>{const value=event.target.valueAsNumber;if(Number.isInteger(value)&&value>=0&&value<=100&&value!==selected.opportunityProbability)updateOpportunity({opportunityProbability:value})}}/></label><label>{zh?"预计成交日":"Expected close"}<input key={`close-${selected.id}-${selected.expectedCloseDate??""}`} type="date" defaultValue={selected.expectedCloseDate??""} onBlur={event=>{if(event.target.value&&event.target.value!==selected.expectedCloseDate)updateOpportunity({expectedCloseDate:event.target.value})}}/></label><label>{zh?"销售备注":"Sales notes"}<input key={`notes-${selected.id}-${selected.notes}`} defaultValue={selected.notes} onBlur={event=>{if(event.target.value!==selected.notes)onUpdate(selected.id,{notes:event.target.value})}}/></label><button className="lead-remove" onClick={()=>onRemove(selected.id)}>{zh?"移出清单":"Remove"}</button></div>
        {message?<p className="lead-message">{message}</p>:null}
        {readiness?<div className={`outreach-readiness ${readiness.ready?"ready":"blocked"}`}><strong>{readiness.ready?(zh?"可安全审批外联":"Ready for outreach approval"):(zh?"外联审批已阻止":"Outreach approval blocked")}</strong><span>{readiness.ready?(zh?"公司身份与联系方式已核验":"Identity and contact are verified"):readiness.blockers.map(blocker=>blocker==="identity_unverified"?(zh?"公司身份未核验":"Identity unverified"):blocker==="verified_contact_missing"?(zh?"缺少已验证联系方式":"Verified contact missing"):blocker==="lead_disqualified"?(zh?"已确认为非目标客户":"Lead disqualified"):(zh?"公司研究尚未解析":"Contact research unresolved")).join(" · ")}</span></div>:null}
        {selectedResearch?<div className="lead-research-brief"><strong>{zh?"买家资格与风险依据":"Buyer qualification & risk rationale"}</strong><p>{selectedResearch.reason}</p><span><b>{zh?"建议动作":"Recommended action"}:</b> {selectedResearch.nextAction}</span></div>:null}
        <div className="lead-panels">
          <article><h3>{zh?"联系方式与证据":"Contacts & evidence"}</h3>{contacts.length?<div className="lead-records">{contacts.map(contact=>{const href=contact.contactType==="email"&&currentDraft?emailDraftHref(contact.contactValue,currentDraft.subject,currentDraft.body):contactHref(contact.contactType,contact.contactValue);return <div key={contact.id}><b>{contact.label||contact.contactType}</b>{href?<a href={href} target={href.startsWith("https:")?"_blank":undefined} rel={href.startsWith("https:")?"noreferrer":undefined}>{contact.contactValue}</a>:<span>{contact.contactValue}</span>}<a href={contact.sourceUrl} target="_blank" rel="noreferrer">{contact.verificationStatus} ↗</a></div>})}</div>:<p>{zh?"尚无已保存联系方式。":"No contacts saved yet."}</p>}<form onSubmit={addContact} className="lead-form"><select name="contactType" aria-label={zh?"联系方式类型":"Contact type"}><option value="email">Email</option><option value="phone">Phone</option><option value="linkedin">LinkedIn</option><option value="website_contact_page">Contact page</option></select><input name="label" placeholder={zh?"联系人或部门":"Person or department"}/><input name="contactValue" required placeholder={zh?"邮箱、电话或链接":"Email, phone, or URL"}/><input name="sourceUrl" type="url" required placeholder={zh?"来源网址（必填）":"Source URL (required)"}/><select name="verificationStatus" aria-label={zh?"验证状态":"Verification status"}><option value="unverified">{zh?"未验证":"Unverified"}</option><option value="verified">{zh?"已验证":"Verified"}</option></select><button>{zh?"保存联系方式":"Save contact"}</button></form></article>
          <article><h3>{zh?"联系、反馈与下一步":"Outreach, feedback & next step"}</h3>{actions.length?<div className="lead-records">{actions.map(action=><div key={action.id}><b>{action.outcomeCode||action.actionType} · {action.channel||"—"}</b><span>{action.summary}</span><small>{action.nextActionDue?`${zh?"下次":"Next"}: ${action.nextActionDue}`:action.createdAt.slice(0,10)}</small></div>)}</div>:<p>{zh?"尚无销售活动。":"No sales activity yet."}</p>}<form onSubmit={addAction} className="lead-form"><select name="actionType" aria-label={zh?"动作类型":"Action type"}><option value="research">{zh?"调研":"Research"}</option><option value="outreach">{zh?"首次联系":"Outreach"}</option><option value="follow_up">{zh?"跟进":"Follow-up"}</option><option value="call">{zh?"电话":"Call"}</option></select><select name="channel" aria-label={zh?"渠道":"Channel"}><option value="email">Email</option><option value="linkedin">LinkedIn</option><option value="phone">Phone</option><option value="website">Website</option></select><input name="summary" required placeholder={zh?"本次动作摘要":"Activity summary"}/><select name="outcomeCode" aria-label={zh?"标准结果":"Structured outcome"}><option value="">{zh?"尚无结果":"No outcome yet"}</option><option value="no_response">{zh?"未回复":"No response"}</option><option value="replied">{zh?"已回复":"Replied"}</option><option value="interested">{zh?"有兴趣":"Interested"}</option><option value="meeting_booked">{zh?"已约会议":"Meeting booked"}</option><option value="quote_requested">{zh?"要求报价":"Quote requested"}</option><option value="not_fit">{zh?"不匹配":"Not a fit"}</option><option value="bounced">{zh?"退信":"Bounced"}</option><option value="won">{zh?"赢单":"Won"}</option><option value="lost">{zh?"丢单":"Lost"}</option></select><select name="qualificationFeedback" aria-label={zh?"匹配反馈":"Qualification feedback"}><option value="">{zh?"匹配待确认":"Fit not reviewed"}</option><option value="confirmed_fit">{zh?"确认匹配":"Confirmed fit"}</option><option value="needs_review">{zh?"需要复核":"Needs review"}</option><option value="disqualified">{zh?"取消资格":"Disqualified"}</option></select><input name="feedbackReason" placeholder={zh?"反馈原因（用于改进排序）":"Feedback reason for ranking"}/><input name="outcome" placeholder={zh?"补充结果说明":"Outcome notes"}/><input name="nextAction" placeholder={zh?"下一步动作":"Next action"}/><input name="nextActionDue" type="date"/><button>{zh?"保存反馈与下一步":"Save feedback & next step"}</button></form></article>
          <article className="lead-drafts"><div className="lead-panel-title"><h3>{zh?"个性化外联草稿":"Personalized outreach drafts"}</h3><button onClick={generateDraft}>{zh?"生成新草稿":"Generate draft"}</button></div>{drafts.length?<div className="draft-list">{drafts.map(draft=><section key={draft.id}><div><span>{draft.channel.toUpperCase()} · {draft.updatedAt.slice(0,10)}</span><span className="draft-actions"><button type="button" onClick={()=>copyDraftBody(draft.body)}>{zh?"复制正文":"Copy body"}</button><select value={draft.status} onChange={event=>updateDraft(draft.id,{status:event.target.value as Draft["status"]})} aria-label={zh?"草稿状态":"Draft status"}><option value="draft">{zh?"草稿":"Draft"}</option><option value="approved">{zh?"已审核":"Approved"}</option><option value="sent">{zh?"已发送":"Sent"}</option><option value="archived">{zh?"已归档":"Archived"}</option></select></span></div><input defaultValue={draft.subject} aria-label={zh?"邮件主题":"Email subject"} onBlur={event=>{if(event.target.value!==draft.subject)updateDraft(draft.id,{subject:event.target.value})}}/><textarea defaultValue={draft.body} aria-label={zh?"邮件正文":"Email body"} onBlur={event=>{if(event.target.value!==draft.body)updateDraft(draft.id,{body:event.target.value})}}/><details><summary>{zh?"查看生成依据与审核提示":"Evidence and review notes"}</summary><p>{draft.evidenceSummary}</p><p>{draft.personalizationNotes}</p></details></section>)}</div>:<p>{zh?"尚无草稿。系统只生成待审核内容，不会自动发送。":"No drafts yet. Generated content requires review and is never sent automatically."}</p>}</article>
        </div>
      </section>:null}
    </div>
  </div>;
}
