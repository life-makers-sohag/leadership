import {
  FILE_OPTIONS,
  buildResult,
  buildStarterForm,
  createQuestion,
  escapeHtml,
  fileTemplateLabel,
  formatDateTime,
  getQuestionTypeLabel,
  levelFromPercent,
  overallRecommendation,
  bestCategorySummary,
  uid
} from "./shared.js";

import {
  ensureStarterForm,
  listForms,
  saveForm,
  deleteForm,
  addSubmission,
  listSubmissions,
  watchForms,
  watchSubmissions,
  createBlankForm
} from "./store.js";

const el = (id) => document.getElementById(id);

const state = {
  forms: [],
  selectedFormId: null,
  submissions: [],
  adminTab: "forms",
  previewFormId: null,
  activeSubscriptions: []
};

function showToast(message) {
  const toast = el("toast");
  toast.textContent = message;
  toast.classList.add("show");
  clearTimeout(window.__toastTimer);
  window.__toastTimer = setTimeout(() => toast.classList.remove("show"), 1600);
}

function currentForm() {
  return state.forms.find((f) => f.id === state.selectedFormId) || state.forms[0] || null;
}

function setSelectedForm(formId) {
  state.selectedFormId = formId;
  localStorage.setItem("leadership_selected_admin_form", formId || "");
  renderAll();
}

function setAdminTab(tab) {
  state.adminTab = tab;
  ["forms", "builder", "stats", "results", "preview"].forEach((t) => {
    el(`tab-${t}`).classList.toggle("active", t === tab);
    el(`panel-${t}`).classList.toggle("hidden", t !== tab);
  });
}

function normalizeQuestionFormFields() {
  const type = el("qType").value;
  el("mcqEditor").classList.toggle("hidden", type !== "mcq");
  el("tfEditor").classList.toggle("hidden", type !== "tf");

  const category = el("qCategory").value;
  el("customCategory").classList.toggle("hidden", category !== "custom");
}

function populateFormSelector() {
  const sel = el("formSelector");
  sel.innerHTML = "";

  state.forms.forEach((form) => {
    const opt = document.createElement("option");
    opt.value = form.id;
    opt.textContent = `${form.title}${form.active ? "" : " — متوقف"}`;
    if (form.id === state.selectedFormId) opt.selected = true;
    sel.appendChild(opt);
  });

  const active = currentForm();
  const link = active ? `${location.origin}${location.pathname.replace(/admin\.html$/, "index.html")}?formId=${active.id}` : "";
  el("previewLink").value = link;
  const side = el("sidePreviewLink");
  if (side) side.value = link;
}

function renderFormsList() {
  const container = el("formsList");
  if (!state.forms.length) {
    container.innerHTML = `<div class="card">لا توجد فورمات حتى الآن.</div>`;
    return;
  }

  container.innerHTML = "";
  state.forms.forEach((form) => {
    const card = document.createElement("div");
    card.className = "question-item";
    card.innerHTML = `
      <div class="question-head">
        <div>
          <div class="tag">${form.active ? "نشط" : "متوقف"}</div>
          <h3 style="margin:10px 0 4px">${escapeHtml(form.title)}</h3>
          <div class="meta">${escapeHtml(form.description || "")}</div>
          <div class="meta" style="margin-top:6px">عدد الأسئلة: ${form.questions.length} · تاريخ آخر تحديث: ${formatDateTime(form.updatedAt || form.createdAt)}</div>
        </div>
        <div class="row">
          <button class="btn btn-secondary btn-small" data-select="${form.id}">فتح</button>
          <button class="btn btn-secondary btn-small" data-preview="${form.id}">معاينة</button>
          <button class="btn btn-secondary btn-small" data-copy="${form.id}">نسخ الرابط</button>
          <button class="btn btn-secondary btn-small" data-toggle="${form.id}">${form.active ? "إيقاف" : "تشغيل"}</button>
          <button class="btn btn-danger btn-small" data-delete="${form.id}">حذف</button>
        </div>
      </div>
    `;
    container.appendChild(card);
  });

  container.querySelectorAll("[data-select]").forEach((btn) => {
    btn.addEventListener("click", () => setSelectedForm(btn.getAttribute("data-select")));
  });

  container.querySelectorAll("[data-preview]").forEach((btn) => {
    btn.addEventListener("click", () => openPreview(btn.getAttribute("data-preview")));
  });

  container.querySelectorAll("[data-copy]").forEach((btn) => {
    btn.addEventListener("click", () => copyFormLink(btn.getAttribute("data-copy")));
  });

  container.querySelectorAll("[data-toggle]").forEach((btn) => {
    btn.addEventListener("click", () => toggleForm(btn.getAttribute("data-toggle")));
  });

  container.querySelectorAll("[data-delete]").forEach((btn) => {
    btn.addEventListener("click", () => removeForm(btn.getAttribute("data-delete")));
  });
}

function renderSelectedFormSummary() {
  const form = currentForm();
  if (!form) {
    el("selectedFormSummary").innerHTML = `<div class="meta">لا يوجد فورم محدد.</div>`;
    return;
  }

  el("selectedFormSummary").innerHTML = `
    <div class="row" style="justify-content:space-between;align-items:flex-start">
      <div>
        <div class="tag">${form.active ? "فورم نشط" : "فورم متوقف"}</div>
        <h3 style="margin:10px 0 4px">${escapeHtml(form.title)}</h3>
        <div class="meta">${escapeHtml(form.description || "")}</div>
      </div>
      <div class="tag">${form.questions.length} سؤال</div>
    </div>
    <div class="divider"></div>
    <div class="row">
      <button class="btn btn-secondary btn-small" id="btnPreviewSelected">معاينة المستخدم</button>
      <button class="btn btn-secondary btn-small" id="btnCopySelected">نسخ الرابط</button>
      <button class="btn btn-secondary btn-small" id="btnToggleSelected">${form.active ? "إيقاف" : "تشغيل"}</button>
    </div>
  `;

  el("btnPreviewSelected").addEventListener("click", () => openPreview(form.id));
  el("btnCopySelected").addEventListener("click", () => copyFormLink(form.id));
  el("btnToggleSelected").addEventListener("click", () => toggleForm(form.id));
}

function renderQuestions() {
  const form = currentForm();
  const list = el("questionList");
  if (!form) {
    list.innerHTML = `<div class="card">لا يوجد فورم محدد.</div>`;
    return;
  }

  if (!form.questions.length) {
    list.innerHTML = `<div class="card">هذا الفورم لا يحتوي على أسئلة بعد.</div>`;
    return;
  }

  list.innerHTML = "";
  form.questions.forEach((q, index) => {
    const card = document.createElement("div");
    card.className = "question-item";
    card.innerHTML = `
      <div class="question-head">
        <div>
          <div class="tag">${escapeHtml(q.category || "آخر")}</div>
          <h3 style="margin:10px 0 4px">${index + 1}. ${escapeHtml(q.text)}</h3>
          <div class="meta">النوع: ${getQuestionTypeLabel(q.type)} · عدد الخيارات: ${q.options.length}</div>
        </div>
        <div class="row">
          <button class="btn btn-secondary btn-small" data-edit="${q.id}">تعديل</button>
          <button class="btn btn-danger btn-small" data-del="${q.id}">حذف</button>
        </div>
      </div>
      <div class="divider"></div>
      <div class="answers">
        ${q.options.map((o) => `<div class="row" style="justify-content:space-between"><span>${escapeHtml(o.text)}</span><span class="tag">${Number(o.score || 0)} نقطة</span></div>`).join("")}
      </div>
    `;
    list.appendChild(card);
  });

  list.querySelectorAll("[data-del]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const qId = btn.getAttribute("data-del");
      const form = currentForm();
      if (!form) return;
      form.questions = form.questions.filter((x) => x.id !== qId);
      await saveForm(form);
      showToast("تم حذف السؤال");
      renderAll();
    });
  });

  list.querySelectorAll("[data-edit]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const qId = btn.getAttribute("data-edit");
      const form = currentForm();
      const question = form?.questions.find((q) => q.id === qId);
      if (!question) return;
      fillQuestionEditor(question, qId);
      showToast("تم تحميل السؤال للتعديل");
    });
  });
}

function fillQuestionEditor(question, editingId = null) {
  el("qText").value = question.text || "";
  el("qType").value = question.type || "mcq";
  el("qCategory").value = FILE_OPTIONS.includes(question.category) ? question.category : "custom";
  el("customCategory").value = FILE_OPTIONS.includes(question.category) ? "" : (question.category || "");
  normalizeQuestionFormFields();

  if ((question.type || "mcq") === "mcq") {
    const options = question.options || [];
    const fields = ["opt1", "opt2", "opt3", "opt4"];
    const scores = ["score1", "score2", "score3", "score4"];
    fields.forEach((id, i) => {
      el(id).value = options[i]?.text || "";
      el(scores[i]).value = options[i]?.score ?? 0;
    });
  } else {
    el("tfTrueText").value = question.options?.[0]?.text || "صح";
    el("tfTrueScore").value = question.options?.[0]?.score ?? 10;
    el("tfFalseText").value = question.options?.[1]?.text || "غلط";
    el("tfFalseScore").value = question.options?.[1]?.score ?? 0;
  }

  el("addQuestion").dataset.editing = editingId || "";
}

async function addOrUpdateQuestion() {
  const form = currentForm();
  if (!form) return showToast("لا يوجد فورم نشط");

  const text = el("qText").value.trim();
  const type = el("qType").value;
  const categoryValue = el("qCategory").value;
  const customCategory = el("customCategory").value.trim();
  const category = categoryValue === "custom" ? (customCategory || "آخر") : categoryValue;

  if (!text) return showToast("اكتب السؤال أولًا");

  let options = [];
  if (type === "mcq") {
    const rows = [
      [el("opt1").value.trim(), Number(el("score1").value || 0)],
      [el("opt2").value.trim(), Number(el("score2").value || 0)],
      [el("opt3").value.trim(), Number(el("score3").value || 0)],
      [el("opt4").value.trim(), Number(el("score4").value || 0)]
    ].filter(([t]) => t);

    if (rows.length < 2) return showToast("أضف خيارين على الأقل");
    options = rows.map(([t, s]) => ({ text: t, score: s }));
  } else {
    options = [
      { text: el("tfTrueText").value.trim() || "صح", score: Number(el("tfTrueScore").value || 10) },
      { text: el("tfFalseText").value.trim() || "غلط", score: Number(el("tfFalseScore").value || 0) }
    ];
  }

  const editingId = el("addQuestion").dataset.editing || "";
  const question = createQuestion({ text, type, category, options });

  if (editingId) {
    form.questions = form.questions.map((q) => (q.id === editingId ? { ...question, id: editingId } : q));
    el("addQuestion").dataset.editing = "";
  } else {
    form.questions.push(question);
  }

  await saveForm(form);
  clearQuestionEditor();
  showToast(editingId ? "تم تعديل السؤال" : "تمت إضافة السؤال");
  renderAll();
}

function clearQuestionEditor() {
  el("qText").value = "";
  el("opt1").value = "";
  el("opt2").value = "";
  el("opt3").value = "";
  el("opt4").value = "";
  el("score1").value = 0;
  el("score2").value = 0;
  el("score3").value = 0;
  el("score4").value = 0;
  el("tfTrueText").value = "صح";
  el("tfTrueScore").value = 10;
  el("tfFalseText").value = "غلط";
  el("tfFalseScore").value = 0;
  el("qCategory").value = "الجذب";
  el("customCategory").value = "";
  el("qType").value = "mcq";
  normalizeQuestionFormFields();
  el("addQuestion").dataset.editing = "";
}

async function saveFormHeader() {
  const form = currentForm();
  if (!form) return;
  form.title = el("formTitle").value.trim() || form.title;
  form.description = el("formDesc").value.trim();
  await saveForm(form);
  showToast("تم حفظ الفورم");
  renderAll();
}

async function createNewForm() {
  const title = el("formTitle").value.trim() || "فورم جديد";
  const description = el("formDesc").value.trim() || "وصف الفورم";
  const form = createBlankForm(title, description);
  await saveForm(form);
  state.selectedFormId = form.id;
  localStorage.setItem("leadership_selected_admin_form", form.id);
  showToast("تم إنشاء فورم جديد");
  renderAll();
}

async function removeForm(formId) {
  const form = state.forms.find((f) => f.id === formId);
  if (!form) return;
  if (!confirm(`هل تريد حذف الفورم "${form.title}"؟`)) return;
  await deleteForm(formId);
  if (state.selectedFormId === formId) state.selectedFormId = state.forms.find((f) => f.id !== formId)?.id || null;
  localStorage.setItem("leadership_selected_admin_form", state.selectedFormId || "");
  showToast("تم حذف الفورم");
  renderAll();
}

async function toggleForm(formId) {
  const form = state.forms.find((f) => f.id === formId);
  if (!form) return;
  form.active = !form.active;
  await saveForm(form);
  showToast(form.active ? "تم تشغيل الفورم" : "تم إيقاف الفورم");
  renderAll();
}

function copyText(text) {
  return navigator.clipboard?.writeText(text).catch(() => {
    const ta = document.createElement("textarea");
    ta.value = text;
    document.body.appendChild(ta);
    ta.select();
    document.execCommand("copy");
    ta.remove();
  });
}

function copyFormLink(formId) {
  const link = `${location.origin}${location.pathname.replace(/admin\.html$/, "index.html")}?formId=${formId}`;
  el("previewLink").value = link;
  copyText(link);
  showToast("تم نسخ الرابط");
}

function openPreview(formId) {
  const url = `${location.pathname.replace(/admin\.html$/, "index.html")}?formId=${formId}`;
  window.open(url, "_blank", "noopener,noreferrer");
}

function renderStats() {
  const selected = currentForm();
  const allSubs = selected ? state.submissions.filter((s) => s.formId === selected.id) : state.submissions;
  const count = allSubs.length;
  const avg = count ? Math.round(allSubs.reduce((sum, s) => sum + Number(s.overallPercent || 0), 0) / count) : 0;
  const leaders = allSubs.filter((s) => Number(s.overallPercent || 0) >= 70).length;
  const topFile = allSubs
    .flatMap((s) => s.fileScores?.map((f) => ({ ...f, formId: s.formId })) || [])
    .sort((a, b) => (b.percent || 0) - (a.percent || 0))[0];

  el("statResponses").textContent = count;
  el("statAverage").textContent = `${avg}%`;
  el("statLeaders").textContent = leaders;
  el("statTopFile").textContent = topFile ? topFile.category : "—";
  el("statBest").textContent = selected ? selected.title : "—";

  el("sideFormCount").textContent = state.forms.length;
  el("sideSubCount").textContent = count;
  el("sideLeaders").textContent = leaders;
  el("sideAvg").textContent = `${avg}%`;
}

function renderResultsList() {
  const container = el("submissionsList");
  const selected = currentForm();
  const subs = selected ? state.submissions.filter((s) => s.formId === selected.id) : state.submissions;

  if (!subs.length) {
    container.innerHTML = `<div class="card">لا توجد نتائج حتى الآن.</div>`;
    return;
  }

  container.innerHTML = "";
  subs.slice().reverse().forEach((s) => {
    const level = levelFromPercent(s.overallPercent || 0);
    const item = document.createElement("div");
    item.className = "submission-item";
    item.innerHTML = `
      <div class="submission-head">
        <div>
          <h3 style="margin:0 0 6px">${escapeHtml(s.name || "مستخدم")}</h3>
          <div class="meta">${escapeHtml(s.phone || "")} · ${formatDateTime(s.createdAt)}</div>
        </div>
        <div class="tag">${Number(s.overallPercent || 0)}%</div>
      </div>
      <div class="divider"></div>
      <div class="row" style="justify-content:space-between;align-items:center">
        <div>
          <div class="tag">${escapeHtml(level.label)}</div>
          <div class="meta" style="margin-top:8px">${escapeHtml(level.desc)}</div>
        </div>
        <button class="btn btn-secondary btn-small" data-detail="${s.id}">عرض التفاصيل</button>
      </div>
      <div class="meta hidden" id="detail_${s.id}" style="margin-top:12px"></div>
    `;
    container.appendChild(item);
  });

  container.querySelectorAll("[data-detail]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const id = btn.getAttribute("data-detail");
      const det = el(`detail_${id}`);
      const sub = subs.find((x) => x.id === id);
      if (!det || !sub) return;
      det.classList.toggle("hidden");

      const filesHtml = (sub.fileScores || [])
        .map((f) => `<li>${escapeHtml(f.category)} — ${f.percent}%</li>`)
        .join("");

      det.innerHTML = `
        <div class="card" style="margin-top:8px">
          <div><strong>الدرجة:</strong> ${sub.overallScore} / ${sub.overallMax}</div>
          <div><strong>التوصية:</strong> ${escapeHtml(sub.overallRecommendation || "")}</div>
          <div><strong>أفضل ملف:</strong> ${escapeHtml(sub.bestFile?.category || "—")}</div>
          <div><strong>تفاصيل الملفات:</strong></div>
          <ul>${filesHtml}</ul>
        </div>
      `;
    });
  });
}

function renderPreview() {
  const form = currentForm();
  const iframe = el("previewFrame");
  if (!form) {
    iframe.srcdoc = `<div style="font-family:Tahoma;text-align:center;padding:40px">لا يوجد فورم محدد</div>`;
    return;
  }
  iframe.src = `${location.pathname.replace(/admin\.html$/, "index.html")}?formId=${form.id}`;
  el("previewLink").value = `${location.origin}${location.pathname.replace(/admin\.html$/, "index.html")}?formId=${form.id}`;
}

function syncHeaderFields() {
  const form = currentForm();
  if (!form) return;
  el("formTitle").value = form.title || "";
  el("formDesc").value = form.description || "";
}

function updateCurrentFormInfo() {
  const form = currentForm();
  if (!form) {
    el("selectedFormSummary").innerHTML = `<div class="meta">لا يوجد فورم محدد.</div>`;
    return;
  }
  el("selectedFormSummary").innerHTML = `
    <div class="row" style="justify-content:space-between;align-items:flex-start">
      <div>
        <div class="tag">${form.active ? "فورم نشط" : "فورم متوقف"}</div>
        <h3 style="margin:10px 0 4px">${escapeHtml(form.title)}</h3>
        <div class="meta">${escapeHtml(form.description || "")}</div>
      </div>
      <div class="tag">${form.questions.length} سؤال</div>
    </div>
    <div class="divider"></div>
    <div class="row">
      <button class="btn btn-secondary btn-small" id="btnPreviewSelected">معاينة المستخدم</button>
      <button class="btn btn-secondary btn-small" id="btnCopySelected">نسخ الرابط</button>
      <button class="btn btn-secondary btn-small" id="btnToggleSelected">${form.active ? "إيقاف" : "تشغيل"}</button>
    </div>
  `;

  el("btnPreviewSelected").addEventListener("click", () => openPreview(form.id));
  el("btnCopySelected").addEventListener("click", () => copyFormLink(form.id));
  el("btnToggleSelected").addEventListener("click", () => toggleForm(form.id));
}

function renderAll() {
  populateFormsDropdown();
  renderFormsList();
  syncHeaderFields();
  renderQuestions();
  renderResultsList();
  renderStats();
  updateCurrentFormInfo();
  renderPreview();
  setAdminTab(state.adminTab);
}

function populateFormsDropdown() {
  const sel = el("formSelector");
  sel.innerHTML = "";
  state.forms.forEach((form) => {
    const opt = document.createElement("option");
    opt.value = form.id;
    opt.textContent = `${form.title}${form.active ? "" : " — متوقف"}`;
    if (form.id === state.selectedFormId) opt.selected = true;
    sel.appendChild(opt);
  });

  const active = currentForm();
  const link = active ? `${location.origin}${location.pathname.replace(/admin\.html$/, "index.html")}?formId=${active.id}` : "";
  el("previewLink").value = link;
  const side = el("sidePreviewLink");
  if (side) side.value = link;
}

async function loadSubmissionsForSelected() {
  const form = currentForm();
  state.submissions = form ? await listSubmissions(form.id) : [];
  renderResultsList();
  renderStats();
}

async function selectForm(formId) {
  state.selectedFormId = formId;
  localStorage.setItem("leadership_selected_admin_form", formId || "");
  await loadSubmissionsForSelected();
  renderAll();
}

function wireEditorEvents() {
  el("qType").addEventListener("change", normalizeQuestionFormFields);
  el("qCategory").addEventListener("change", normalizeQuestionFormFields);
  el("addQuestion").addEventListener("click", addOrUpdateQuestion);
  el("clearQuestion").addEventListener("click", clearQuestionEditor);
  el("saveFormHeader").addEventListener("click", saveFormHeader);
  el("newFormBtn").addEventListener("click", createNewForm);
  el("deleteForm").addEventListener("click", () => {
    const form = currentForm();
    if (!form) return;
    removeForm(form.id);
  });
  el("toggleForm").addEventListener("click", () => {
    const form = currentForm();
    if (!form) return;
    toggleForm(form.id);
  });
  el("copyLink").addEventListener("click", () => {
    const form = currentForm();
    if (!form) return;
    copyFormLink(form.id);
  });
  el("previewUser").addEventListener("click", () => {
    const form = currentForm();
    if (!form) return;
    openPreview(form.id);
  });
  el("openUserPage").addEventListener("click", () => {
    const form = currentForm();
    if (!form) return;
    openPreview(form.id);
  });
  el("formSelector").addEventListener("change", (e) => selectForm(e.target.value));
}

function wireTabs() {
  ["forms", "builder", "stats", "results", "preview"].forEach((tab) => {
    el(`tab-${tab}`).addEventListener("click", () => {
      state.adminTab = tab;
      ["forms", "builder", "stats", "results", "preview"].forEach((t) => {
        el(`tab-${t}`).classList.toggle("active", t === tab);
        el(`panel-${t}`).classList.toggle("hidden", t !== tab);
      });
      if (tab === "preview") renderPreview();
    });
  });
}

function wireQuestionFields() {
  el("qCategory").addEventListener("change", () => {
    const isCustom = el("qCategory").value === "custom";
    el("customCategory").classList.toggle("hidden", !isCustom);
  });

  el("qType").addEventListener("change", () => {
    const type = el("qType").value;
    el("mcqEditor").classList.toggle("hidden", type !== "mcq");
    el("tfEditor").classList.toggle("hidden", type !== "tf");
  });
}

async function init() {
  const savedSelected = localStorage.getItem("leadership_selected_admin_form") || "";
  await ensureStarterForm();

  state.forms = await listForms();
  state.selectedFormId = state.forms.find((f) => f.id === savedSelected)?.id || state.forms[0]?.id || null;
  state.submissions = [];
  if (state.selectedFormId) {
    state.submissions = await listSubmissions(state.selectedFormId);
  }

  wireTabs();
  wireEditorEvents();
  wireQuestionFields();

  watchForms(async (forms) => {
    state.forms = forms;
    if (!state.selectedFormId || !state.forms.some((f) => f.id === state.selectedFormId)) {
      state.selectedFormId = state.forms[0]?.id || null;
    }
    if (state.selectedFormId) {
      state.submissions = await listSubmissions(state.selectedFormId);
      watchSelectedSubmissions(state.selectedFormId);
    }
    renderAll();
  });

  watchSelectedSubmissions(state.selectedFormId);
  renderAll();
  setAdminTab("forms");
}

let currentSubWatcher = null;
function watchSelectedSubmissions(formId) {
  if (currentSubWatcher) {
    try { currentSubWatcher(); } catch {}
    currentSubWatcher = null;
  }
  if (!formId) return;
  currentSubWatcher = watchSubmissions(formId, (subs) => {
    state.submissions = subs;
    renderResultsList();
    renderStats();
  });
}

init();

document.addEventListener("keydown", (e) => {
  if (e.ctrlKey && e.key === "s") {
    e.preventDefault();
    saveFormHeader();
  }
});
