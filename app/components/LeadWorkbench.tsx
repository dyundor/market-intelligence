"use client";

import { FormEvent, useEffect, useState } from "react";

export type LeadStatus = "new" | "researching" | "contact_ready" | "contacted" | "follow_up" | "qualified" | "opportunity";

export type WatchlistItem = {
  id:string; companyId:string; status:string; notes:string; leadStatus:LeadStatus|null;
  outreachStrategy:string|null; recommendedProducts:string|null; confidence:string|null;
  commercialFitScore:number|null; outreachScore:number|null; createdAt:string; updatedAt:string;
  company:{id:string;name:string;country:string;countryCode:string|null;entityType:string;totalShipments:number|null;latestShipmentDate:string|null;website:string|null;location:string}|null;
};

type Contact = {id:string;contactType:string;contactValue:string;label:string|null;sourceUrl:string;verificationStatus:string;notes:string};
type Action = {id:string;actionType:string;channel:string|null;summary:string;outcome:string|null;nextAction:string|null;nextActionDue:string|null;createdAt:string};

const STATUS_OPTIONS:LeadStatus[]=["new","researching","contact_ready","contacted","follow_up","qualified","opportunity"];
const STATUS_ZH:Record<LeadStatus,string>={new:"新线索",researching:"调研中",contact_ready:"可联系",contacted:"已联系",follow_up:"待跟进",qualified:"已确认",opportunity:"商机"};

export function LeadWorkbench({items,loading,locale,onUpdate,onRemove,onOpenCompany}:{items:WatchlistItem[];loading:boolean;locale:string;onUpdate:(id:string,changes:Record<string,string|number>)=>Promise<void>;onRemove:(id:string)=>Promise<void>;onOpenCompany:(id:string)=>void}){
  const zh=locale==="zh-CN";
  const [selectedId,setSelectedId]=useState<string|null>(null);
  const selected=items.find(item=>item.id===selectedId)??items[0]??null;
  const selectedCompanyId=selected?.companyId??null;
  const [contacts,setContacts]=useState<Contact[]>([]);
  const [actions,setActions]=useState<Action[]>([]);
  const [loadedCompanyId,setLoadedCompanyId]=useState<string|null>(null);
  const [message,setMessage]=useState("");
  const detailLoading=selectedCompanyId!==null&&loadedCompanyId!==selectedCompanyId;

  useEffect(()=>{
    if(!selectedCompanyId)return;
    const controller=new AbortController();
    Promise.all([
      fetch(`/api/lead-contacts?companyId=${encodeURIComponent(selectedCompanyId)}`,{signal:controller.signal}).then(r=>r.ok?r.json():Promise.reject()),
      fetch(`/api/lead-actions?companyId=${encodeURIComponent(selectedCompanyId)}`,{signal:controller.signal}).then(r=>r.ok?r.json():Promise.reject()),
    ]).then(([contactData,actionData])=>{setContacts(contactData.items||[]);setActions(actionData.items||[]);setLoadedCompanyId(selectedCompanyId);setMessage("");}).catch(()=>{if(!controller.signal.aborted){setLoadedCompanyId(selectedCompanyId);setMessage(zh?"无法读取销售记录":"Unable to load sales records");}});
    return()=>controller.abort();
  },[selectedCompanyId,zh]);

  async function addContact(event:FormEvent<HTMLFormElement>){
    event.preventDefault();
    if(!selected)return;
    const form=new FormData(event.currentTarget);
    const response=await fetch("/api/lead-contacts",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({companyId:selected.companyId,contactType:form.get("contactType"),contactValue:form.get("contactValue"),sourceUrl:form.get("sourceUrl"),label:form.get("label"),verificationStatus:form.get("verificationStatus")})});
    if(!response.ok){setMessage(zh?"联系方式保存失败，请检查必填项":"Contact could not be saved");return;}
    const contact=await response.json() as Contact;
    setContacts(previous=>[contact,...previous.filter(item=>item.id!==contact.id)]);
    if(contact.verificationStatus==="verified")await onUpdate(selected.id,{leadStatus:"contact_ready"});
    event.currentTarget.reset();setMessage(zh?"联系方式已保存":"Contact saved");
  }

  async function addAction(event:FormEvent<HTMLFormElement>){
    event.preventDefault();
    if(!selected)return;
    const form=new FormData(event.currentTarget);
    const response=await fetch("/api/lead-actions",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({companyId:selected.companyId,actionType:form.get("actionType"),channel:form.get("channel"),summary:form.get("summary"),outcome:form.get("outcome"),nextAction:form.get("nextAction"),nextActionDue:form.get("nextActionDue")})});
    if(!response.ok){setMessage(zh?"跟进记录保存失败":"Activity could not be saved");return;}
    const action=await response.json() as Action;
    setActions(previous=>[action,...previous]);event.currentTarget.reset();setMessage(zh?"跟进记录已保存":"Activity saved");
  }

  if(!items.length)return <div className="supplier-empty"><strong>{zh?"清单为空":"Watchlist is empty"}</strong><span>{zh?"从进口商排名或企业详情页保存潜在客户。":"Save prospects from importer rankings or company details."}</span></div>;

  return <div className="lead-workbench" aria-busy={loading||detailLoading}>
    <div className="lead-pipeline">{STATUS_OPTIONS.map(status=><span key={status}><b>{items.filter(item=>(item.leadStatus||"new")===status).length}</b>{zh?STATUS_ZH[status]:status.replaceAll("_"," ")}</span>)}</div>
    <div className="lead-layout">
      <div className="lead-list">{items.map((item,index)=><button key={item.id} className={selected?.id===item.id?"active":""} onClick={()=>setSelectedId(item.id)}><i>{String(index+1).padStart(2,"0")}</i><span><strong>{item.company?.name||item.companyId}</strong><small>{item.outreachStrategy|| (zh?"待制定开发策略":"Strategy pending")}</small></span><em>{item.outreachScore??"—"}</em></button>)}</div>
      {selected?<section className="lead-detail">
        <header><div><small>{selected.company?.country||"—"} · {selected.company?.totalShipments??0} BOLs</small><button onClick={()=>onOpenCompany(selected.companyId)}>{selected.company?.name||selected.companyId}</button><p>{selected.recommendedProducts|| (zh?"推荐产品待确认":"Products pending")}</p></div><div><b>{selected.commercialFitScore??"—"}<small>/100 FIT</small></b><b>{selected.outreachScore??"—"}<small>/100 OUTREACH</small></b></div></header>
        <div className="lead-controls"><label>{zh?"销售阶段":"Lead stage"}<select value={selected.leadStatus||"new"} onChange={event=>onUpdate(selected.id,{leadStatus:event.target.value})}>{STATUS_OPTIONS.map(status=><option value={status} key={status}>{zh?STATUS_ZH[status]:status.replaceAll("_"," ")}</option>)}</select></label><label>{zh?"开发策略":"Outreach strategy"}<input defaultValue={selected.outreachStrategy||""} onBlur={event=>{if(event.target.value!==selected.outreachStrategy)onUpdate(selected.id,{outreachStrategy:event.target.value})}}/></label><label>{zh?"销售备注":"Sales notes"}<input defaultValue={selected.notes} onBlur={event=>{if(event.target.value!==selected.notes)onUpdate(selected.id,{notes:event.target.value})}}/></label><button className="lead-remove" onClick={()=>onRemove(selected.id)}>{zh?"移出清单":"Remove"}</button></div>
        {message?<p className="lead-message">{message}</p>:null}
        <div className="lead-panels">
          <article><h3>{zh?"联系方式与证据":"Contacts & evidence"}</h3>{contacts.length?<div className="lead-records">{contacts.map(contact=><div key={contact.id}><b>{contact.label||contact.contactType}</b><span>{contact.contactValue}</span><a href={contact.sourceUrl} target="_blank" rel="noreferrer">{contact.verificationStatus} ↗</a></div>)}</div>:<p>{zh?"尚无已保存联系方式。":"No contacts saved yet."}</p>}<form onSubmit={addContact} className="lead-form"><select name="contactType" aria-label={zh?"联系方式类型":"Contact type"}><option value="email">Email</option><option value="phone">Phone</option><option value="linkedin">LinkedIn</option><option value="website_contact_page">Contact page</option></select><input name="label" placeholder={zh?"联系人或部门":"Person or department"}/><input name="contactValue" required placeholder={zh?"邮箱、电话或链接":"Email, phone, or URL"}/><input name="sourceUrl" type="url" required placeholder={zh?"来源网址（必填）":"Source URL (required)"}/><select name="verificationStatus" aria-label={zh?"验证状态":"Verification status"}><option value="unverified">{zh?"未验证":"Unverified"}</option><option value="verified">{zh?"已验证":"Verified"}</option></select><button>{zh?"保存联系方式":"Save contact"}</button></form></article>
          <article><h3>{zh?"联系与跟进记录":"Outreach activity"}</h3>{actions.length?<div className="lead-records">{actions.map(action=><div key={action.id}><b>{action.actionType} · {action.channel||"—"}</b><span>{action.summary}</span><small>{action.nextActionDue?`${zh?"下次":"Next"}: ${action.nextActionDue}`:action.createdAt.slice(0,10)}</small></div>)}</div>:<p>{zh?"尚无销售活动。":"No sales activity yet."}</p>}<form onSubmit={addAction} className="lead-form"><select name="actionType" aria-label={zh?"动作类型":"Action type"}><option value="research">{zh?"调研":"Research"}</option><option value="outreach">{zh?"首次联系":"Outreach"}</option><option value="follow_up">{zh?"跟进":"Follow-up"}</option><option value="call">{zh?"电话":"Call"}</option></select><select name="channel" aria-label={zh?"渠道":"Channel"}><option value="email">Email</option><option value="linkedin">LinkedIn</option><option value="phone">Phone</option><option value="website">Website</option></select><input name="summary" required placeholder={zh?"本次动作摘要":"Activity summary"}/><input name="outcome" placeholder={zh?"结果":"Outcome"}/><input name="nextAction" placeholder={zh?"下一步动作":"Next action"}/><input name="nextActionDue" type="date"/><button>{zh?"记录销售动作":"Save activity"}</button></form></article>
        </div>
      </section>:null}
    </div>
  </div>;
}
