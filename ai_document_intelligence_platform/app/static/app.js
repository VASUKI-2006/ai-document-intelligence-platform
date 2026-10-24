const $ = (id) => document.getElementById(id);
let documentText = "";
let currentFilename = "";
let latestResult = null;

function toast(message) {
  const el = $("toast"); el.textContent = message; el.classList.add("show");
  setTimeout(() => el.classList.remove("show"), 2600);
}
function setDocument(name, text) {
  currentFilename = name; documentText = text;
  $("fileInfo").textContent = `${name} · ${text.length.toLocaleString()} readable characters`;
  $("analyzeBtn").disabled = false;
  $("emptyState").classList.remove("hidden");
}
async function loadSamples() {
  try {
    const samples = await (await fetch("/api/samples")).json();
    samples.forEach(s => {
      const opt = document.createElement("option"); opt.value = s.name; opt.textContent = s.name; opt.dataset.text = s.text;
      $("sampleSelect").appendChild(opt);
    });
  } catch { /* sample list is optional */ }
}
$("sampleSelect").addEventListener("change", e => {
  const option = e.target.selectedOptions[0];
  if (option && option.dataset.text) { setDocument(option.value, option.dataset.text); toast("Sample document loaded."); }
});
$("fileInput").addEventListener("change", async e => {
  const file = e.target.files[0]; if (!file) return;
  await uploadFile(file);
});
async function uploadFile(file) {
  const form = new FormData(); form.append("file", file);
  $("fileInfo").textContent = `Reading ${file.name}…`; $("analyzeBtn").disabled = true;
  try {
    const response = await fetch("/api/upload", {method:"POST", body:form});
    const data = await response.json();
    if (!response.ok) throw new Error(data.detail || "Upload failed.");
    setDocument(data.filename, data.text); toast("Document text extracted successfully.");
  } catch (err) { $("fileInfo").textContent = err.message; toast(err.message); }
}
const drop = $("dropzone");
["dragenter","dragover"].forEach(ev => drop.addEventListener(ev, e => {e.preventDefault();drop.classList.add("dragover")}));
["dragleave","drop"].forEach(ev => drop.addEventListener(ev, e => {e.preventDefault();drop.classList.remove("dragover")}));
drop.addEventListener("drop", e => { const file=e.dataTransfer.files[0]; if(file) uploadFile(file); });

function getFocus() {
  return [...document.querySelectorAll(".checks input:checked")].map(x => x.value);
}
$("analyzeBtn").addEventListener("click", async () => {
  if (!documentText) return;
  $("emptyState").classList.add("hidden"); $("resultContent").classList.add("hidden"); $("loading").classList.remove("hidden");
  $("analyzeBtn").disabled = true;
  try {
    const response = await fetch("/api/analyze", {method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({
      text:documentText, summary_style:$("style").value, analysis_level:$("level").value, focus_fields:getFocus()
    })});
    const data = await response.json(); if (!response.ok) throw new Error(data.detail || "Analysis failed.");
    latestResult = data; renderResults(data);
    $("loading").classList.add("hidden"); $("resultContent").classList.remove("hidden");
    $("notice").textContent = data.notice || "";
  } catch (err) { $("loading").classList.add("hidden"); $("emptyState").classList.remove("hidden"); toast(err.message); }
  finally { $("analyzeBtn").disabled = !documentText; }
});
function renderResults(data) {
  $("summary").textContent = data.summary;
  $("summaryMeta").textContent = `${data.analysis_level} analysis · ${data.summary_style} summary`;
  $("score").textContent = `${data.completeness.score}%`;
  $("progressBar").style.width = `${data.completeness.score}%`;
  $("scoreText").textContent = `${data.completeness.completed} of ${data.completeness.total} required fields found`;
  const x = data.extracted;
  $("skillCount").textContent = x.skills.length;
  $("experienceCount").textContent = x.work_experience.length;
  const findings = data.key_findings || [];
  $("findingsWrap").classList.toggle("hidden", findings.length === 0);
  $("findings").innerHTML = findings.map(v=>`<li>${escapeHtml(v)}</li>`).join("");
  renderFields(x); renderCharts(x, data.completeness);
}
function escapeHtml(s) { return String(s ?? "").replace(/[&<>"']/g, c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c])); }
function renderFields(x) {
  const fields = [
    ["name","Name",x.name],["email","Email",x.email],["phone","Phone",x.phone],
    ["skills","Skills (comma separated)",x.skills.join(", ")],
    ["education","Education (one item per line)",x.education.map(e=>[e.qualification,e.institution,e.field_of_study,e.graduation_year].filter(Boolean).join(" · ") || "Missing details").join("\n")],
    ["work_experience","Work experience (one item per line)",x.work_experience.map(e=>[e.role,e.company,e.duration,e.description].filter(Boolean).join(" · ") || "Missing details").join("\n")]
  ];
  $("fields").innerHTML = fields.map(([key,label,value])=>{
    const isMissing = value == null || value === "" || value === "[]" || value === "\n";
    const multiline = ["education","work_experience"].includes(key);
    return `<div class="field-item"><div class="field-top"><label for="field-${key}">${label}</label><span class="field-status ${isMissing?"missing":""}">${isMissing?"Missing / review":"Found"}</span></div>${multiline?`<textarea id="field-${key}" data-key="${key}">${escapeHtml(value||"")}</textarea>`:`<input id="field-${key}" data-key="${key}" value="${escapeHtml(value ?? "")}" placeholder="Not found in source">`}</div>`;
  }).join("");
}
function renderCharts(x, completeness) {
  const skills = x.skills || [];
  $("skillsChart").innerHTML = skills.length ? skills.slice(0,8).map((s,i)=>`<div class="skill-row"><span class="skill-name" title="${escapeHtml(s)}">${escapeHtml(s)}</span><div class="skill-track"><div class="skill-fill" style="width:${Math.max(20,100-i*9)}%"></div></div><span class="skill-val">${i+1}</span></div>`).join("") : `<p class="chart-note">No skills could be confidently extracted.</p>`;
  $("coverageChart").innerHTML = Object.entries(completeness.checks).map(([name,found])=>`<div class="coverage-row"><span>${escapeHtml(name)}</span><div class="coverage-track"><i style="width:${found?100:0}%"></i></div><strong>${found?"Found":"Missing"}</strong></div>`).join("");
}
function collectEdits() {
  if (!latestResult) return;
  const x = latestResult.extracted;
  x.name = $("field-name").value.trim() || null;
  x.email = $("field-email").value.trim() || null;
  x.phone = $("field-phone").value.trim() || null;
  x.skills = $("field-skills").value.split(",").map(s=>s.trim()).filter(Boolean);
  x.education = $("field-education").value.split("\n").map(s=>s.trim()).filter(Boolean).map(s=>({qualification:s,institution:null,field_of_study:null,graduation_year:null}));
  x.work_experience = $("field-work_experience").value.split("\n").map(s=>s.trim()).filter(Boolean).map(s=>({role:null,company:null,duration:null,description:s}));
  const checks = {"Name":!!x.name,"Email":!!x.email,"Skills":!!x.skills.length,"Education":!!x.education.length,"Work experience":!!x.work_experience.length};
  const completed = Object.values(checks).filter(Boolean).length;
  latestResult.completeness = {score:Math.round(completed/5*100),completed,total:5,checks};
  $("score").textContent = `${latestResult.completeness.score}%`; $("progressBar").style.width = `${latestResult.completeness.score}%`;
  $("scoreText").textContent = `${completed} of 5 required fields found`;
  renderCharts(x, latestResult.completeness);
  $("editNote").textContent = "Completeness recalculated from your edits.";
}
$("recheckBtn").addEventListener("click", collectEdits);
$("downloadBtn").addEventListener("click", () => {
  if (!latestResult) return;
  const blob = new Blob([JSON.stringify(latestResult,null,2)],{type:"application/json"});
  const url=URL.createObjectURL(blob); const a=document.createElement("a");a.href=url;a.download="resume-analysis.json";a.click();URL.revokeObjectURL(url);
});
$("copySummary").addEventListener("click", async () => {
  try { await navigator.clipboard.writeText($("summary").textContent); toast("Summary copied."); } catch { toast("Clipboard access is unavailable in this browser."); }
});
document.querySelectorAll(".feedback-actions button").forEach(btn => btn.addEventListener("click", () => {
  document.querySelectorAll(".feedback-actions button").forEach(b=>b.classList.remove("selected")); btn.classList.add("selected");
  const rating=btn.dataset.rating; $("notice").textContent=`Feedback recorded for this session: ${rating}. Feedback is not sent to a server.`; toast("Thanks for your feedback.");
}));
loadSamples();
