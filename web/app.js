"use strict";

let store = {prospects:[],quotes:[],runs:[],metrics:{},ollama:false,model:""};
let currentOutput = "";
let toastTimeout;

const byId = id => document.getElementById(id);
const money = value => new Intl.NumberFormat("es-MX",{style:"currency",currency:"MXN",maximumFractionDigits:2}).format(Number(value || 0));
const date = value => {
  if (!value) return "—";
  const time = new Date(value.replace(" ","T") + "Z");
  return Number.isNaN(time.getTime()) ? value : time.toLocaleDateString("es-MX",{day:"2-digit",month:"short",year:"numeric"});
};
const stageName = {nuevo:"Nuevo",contactado:"Contactado",negociacion:"Negociación",ganado:"Ganado",perdido:"Perdido"};
const quoteName = {borrador:"Borrador",enviada:"Enviada",aceptada:"Aceptada",rechazada:"Rechazada"};
const agentName = {coordinador:"Coordinador",prospeccion:"Prospección",ventas:"Ventas"};

function element(tag, className="", text=null) {
  const node=document.createElement(tag);
  if(className) node.className=className;
  if(text!==null) node.textContent=String(text);
  return node;
}
function empty(text) { const row=element("div","empty-box",text); return row; }
function clear(node) { node.replaceChildren(); }
function text(id,value) { byId(id).textContent=String(value); }
function alertUser(message,isError=false) {
  const toast=byId("toast");
  toast.textContent=message;
  toast.classList.toggle("error",isError);
  toast.classList.add("show");
  clearTimeout(toastTimeout);
  toastTimeout=setTimeout(()=>toast.classList.remove("show"),4200);
}
async function api(path,method="GET",body=null) {
  const options={method,headers:{}};
  if(body!==null) {
    options.headers["Content-Type"]="application/json";
    options.body=JSON.stringify(body);
  }
  let response;
  try {response=await fetch(path,options);}
  catch (_) {throw new Error("No se puede conectar al servidor local. ¿Sigue abierto?");}
  let data;
  try {data=await response.json();}
  catch (_) {throw new Error("El servidor devolvió una respuesta inválida");}
  if(!response.ok) throw new Error(data.error || "Operación fallida");
  return data;
}
async function load(silent=false) {
  try {
    store=await api("/api/state");
    render();
    if(!silent) alertUser("Datos actualizados");
  } catch(error) {alertUser(error.message,true);}
}
function navigate(page) {
  if(!byId("page-"+page)) return;
  document.querySelectorAll(".page").forEach(section=>section.classList.toggle("active",section.id==="page-"+page));
  document.querySelectorAll(".nav-btn").forEach(button=>button.classList.toggle("active",button.dataset.page===page));
  text("breadcrumb-current",{
    dashboard:"Visión general",prospects:"Prospectos",quotes:"Cotizaciones",
    agents:"Centro de agentes",settings:"Sistema"
  }[page]);
  if(window.innerWidth<801) window.scrollTo({top:0,behavior:"smooth"});
}
function render() {
  renderMetrics(); renderPipeline(); renderProspects();
  renderQuotes(); renderAgents(); renderRuns(); renderSettings();
}
function renderMetrics() {
  const m=store.metrics;
  text("m-prospects",m.prospects);
  text("m-active",m.active);
  text("m-pending",m.pending);
  text("m-profit",money(m.profit));
}
function renderPipeline() {
  const node=byId("pipeline");clear(node);
  const stages=["nuevo","contactado","negociacion","ganado","perdido"];
  const max=Math.max(1,...stages.map(s=>store.prospects.filter(p=>p.stage===s).length));
  for(const name of stages) {
    const count=store.prospects.filter(p=>p.stage===name).length;
    const row=element("div","pipeline-row");
    const label=element("span","pipeline-label",stageName[name]);
    const track=element("div","pipeline-track");
    const fill=element("div","pipeline-fill");
    fill.style.width=(count/max*100)+"%";
    track.append(fill);
    row.append(label,track,element("span","pipeline-count",count));
    node.append(row);
  }
}
function renderProspects() {
  text("prospect-count",store.prospects.length+" registros");
  const tbody=byId("prospect-rows");clear(tbody);
  if(!store.prospects.length) {
    const tr=element("tr");const td=element("td","", "Sin prospectos todavía. Usa «Agregar negocio» para comenzar.");
    td.colSpan=5;tr.append(td);tbody.append(tr);
  }
  for(const p of store.prospects) {
    const tr=element("tr");
    const business=element("td","",p.business);
    business.append(element("small","subtext",p.sector || "Sin sector"));
    const contact=element("td","",p.contact || "Sin contacto");
    contact.append(element("small","subtext",p.phone || "Sin teléfono"));
    const stage=element("td");const select=element("select","stage-select");
    select.setAttribute("aria-label","Etapa de "+p.business);
    for(const [value,label] of Object.entries(stageName)) {
      const option=element("option","",label);option.value=value;option.selected=p.stage===value;select.append(option);
    }
    select.addEventListener("change",async()=>{
      select.disabled=true;
      try {await api("/api/prospects/"+p.id,"PATCH",{stage:select.value});await load(true);alertUser("Etapa actualizada");}
      catch(e){select.value=p.stage;alertUser(e.message,true);}
      finally {select.disabled=false;}
    });
    stage.append(select);
    const priority=element("td");const indicator=element("span","priority");
    indicator.append(element("span","priority-dot"+(p.priority>=60?" high":"")));
    indicator.append(document.createTextNode(p.priority+"/100"));
    priority.append(indicator);
    tr.append(business,contact,stage,priority,element("td","",date(p.created_at)));
    tbody.append(tr);
  }
}
function renderQuotes() {
  text("quote-count",store.quotes.length+" registros");
  const tbody=byId("quote-rows");clear(tbody);
  if(!store.quotes.length) {
    const tr=element("tr"),td=element("td","", "No hay cotizaciones. Crea la primera cuando tengas un prospecto.");
    td.colSpan=6;tr.append(td);tbody.append(tr);
  }
  for(const q of store.quotes) {
    const p=store.prospects.find(p=>p.id===q.prospect_id);
    const tr=element("tr");
    const status=element("td"),select=element("select","stage-select");
    select.setAttribute("aria-label","Estado de cotización "+q.id);
    for(const [value,label] of Object.entries(quoteName)) {
      const option=element("option","",label);option.value=value;option.selected=q.status===value;select.append(option);
    }
    select.addEventListener("change",async()=>{
      select.disabled=true;
      try {await api("/api/quotes/"+q.id,"PATCH",{status:select.value});await load(true);alertUser("Cotización actualizada");}
      catch(e){select.value=q.status;alertUser(e.message,true);}
      finally {select.disabled=false;}
    });
    status.append(select);
    tr.append(
      element("td","",p ? p.business : "Prospecto #"+q.prospect_id),
      element("td","",q.quantity),
      element("td","",money(q.total)),
      element("td","",money(q.unit_cost)),
      status,element("td","",date(q.created_at))
    );
    tbody.append(tr);
  }
}
function setChoices(select,placeholder) {
  const old=select.value;clear(select);
  const first=element("option","",placeholder);first.value="";first.disabled=true;select.append(first);
  for(const p of store.prospects) {
    const option=element("option","",p.business);
    option.value=String(p.id);select.append(option);
  }
  select.value=store.prospects.some(p=>String(p.id)===old) ? old :
    (store.prospects.length ? String(store.prospects[0].id) : "");
  select.disabled=store.prospects.length===0;
}
function renderAgents() {
  setChoices(byId("prospection-select"),"Agrega un prospecto");
  setChoices(byId("sales-select"),"Agrega un prospecto");
  setChoices(byId("quote-prospect"),"Agrega un prospecto");
  for(const button of document.querySelectorAll(".run-agent")) {
    button.disabled=button.dataset.agent!=="coordinador"&&!store.prospects.length;
  }
}
function renderRuns() {
  const node=byId("latest-runs");clear(node);
  if(!store.runs.length) {node.append(empty("Sin actividad por ahora. Ejecuta un agente para comenzar."));return;}
  for(const run of store.runs.slice(0,4)) {
    const box=element("div","run-entry");
    const icon=element("span","run-symbol","✳");
    const content=element("div");
    content.append(element("strong","",agentName[run.agent]||run.agent));
    const p=store.prospects.find(p=>p.id===run.prospect_id);
    content.append(element("small","",(p ? p.business+" · " : "")+run.mode+" · "+date(run.created_at)));
    box.append(icon,content);node.append(box);
  }
}
function renderSettings() {
  text("ollama-status",store.ollama?"Servidor accesible":"No detectado · modo plantilla");
  text("ollama-model",store.model || "—");
  text("settings-profit",money(store.metrics.profit));
  text("settings-share",money(store.metrics.partner_share));
}
async function handleSubmit(form,path,data,dialogId) {
  const submit=form.querySelector('[type="submit"]');
  submit.disabled=true;
  try {
    await api(path,"POST",data);
    form.reset();
    byId(dialogId).close();
    await load(true);
    navigate(path==="/api/prospects"?"prospects":"quotes");
    alertUser("Guardado correctamente");
  } catch(e) {alertUser(e.message,true);}
  finally {submit.disabled=false;}
}
function bindForms() {
  byId("prospect-form").addEventListener("submit",e=>{
    e.preventDefault();
    const data=Object.fromEntries(new FormData(e.currentTarget));
    handleSubmit(e.currentTarget,"/api/prospects",data,"prospectDialog");
  });
  byId("quote-form").addEventListener("submit",e=>{
    e.preventDefault();
    const data=Object.fromEntries(new FormData(e.currentTarget));
    handleSubmit(e.currentTarget,"/api/quotes",data,"quoteDialog");
  });
}
async function executeAgent(button) {
  const agent=button.dataset.agent;
  let prospectId=null;
  if(agent==="prospeccion") prospectId=byId("prospection-select").value;
  if(agent==="ventas") prospectId=byId("sales-select").value;
  button.disabled=true;const label=button.textContent;
  button.textContent="Ejecutando…";
  try {
    const output=await api("/api/agents/run","POST",{agent,prospect_id:prospectId || null});
    currentOutput=output.result;
    text("agent-output",currentOutput);
    text("output-meta",agentName[agent]+" · "+output.mode.toUpperCase()+" · Requiere revisión humana");
    byId("copy-output").disabled=false;
    await load(true);
    alertUser("Resultado generado");
  } catch(e){alertUser(e.message,true);}
  finally {button.textContent=label;button.disabled=false;}
}
document.addEventListener("DOMContentLoaded",()=>{
  text("today",new Intl.DateTimeFormat("es-MX",{weekday:"long",day:"numeric",month:"long",year:"numeric"}).format(new Date()));
  document.querySelectorAll("[data-page]").forEach(button=>
    button.addEventListener("click",()=>navigate(button.dataset.page))
  );
  document.querySelectorAll("[data-open]").forEach(button=>
    button.addEventListener("click",()=>{
      const dialog=byId(button.dataset.open);
      if(button.dataset.open==="quoteDialog"&&!store.prospects.length) {
        alertUser("Primero registra al menos un prospecto",true);return;
      }
      dialog.showModal();
    })
  );
  document.querySelectorAll("[data-close]").forEach(button=>
    button.addEventListener("click",()=>button.closest("dialog").close())
  );
  document.querySelectorAll("dialog").forEach(dialog=>
    dialog.addEventListener("click",e=>{if(e.target===dialog)dialog.close();})
  );
  byId("refresh").addEventListener("click",()=>load());
  document.querySelectorAll(".run-agent").forEach(button=>
    button.addEventListener("click",()=>executeAgent(button))
  );
  byId("copy-output").addEventListener("click",async()=>{
    try {await navigator.clipboard.writeText(currentOutput);alertUser("Resultado copiado");}
    catch(_){alertUser("No se pudo copiar automáticamente. Selecciona el texto.",true);}
  });
  bindForms();load(true);
});