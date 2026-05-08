import {
  escapeHtml,
  formatDateTime,
  levelFromPercent,
  overallRecommendation,
  bestCategorySummary,
  buildResult
} from "./shared.js";

import {
  ensureStarterForm,
  getForm,
  listForms,
  addSubmission,
  watchForms
} from "./store.js";

const $ = (id) => document.getElementById(id);

const state = {
  forms: [],
  formId: null,
  form: null,
  answers: {},
  result: null
};

function showToast(message) {
  const toast = $("toast");
  toast.textContent = message;
  toast.classList.add("show");
  clearTimeout(window.__toastTimer);
  window.__toastTimer = setTimeout(() => toast.classList.remove("show"), 1600);
}

function queryFormId() {
  return new URLSearchParams(location.search).get("formId");
}

function setUserTab(tab) {
  $("userTabTake").classList.toggle("active", tab === "take");
  $("userTabResults").classList.toggle("active", tab === "results");
  $("takeTestView").classList.toggle("hidden", tab !== "take");
  $("resultView").classList.toggle("hidden", tab !== "results");
}

function renderFormHeader() {
  const form = state.form;
  if (!form) {
    $("activeFormInfo").innerHTML = `<div class="meta">لم يتم العثور على الفورم المطلوب.</div>`;
    $("userQuestions").innerHTML = `<div class="card">هذا الرابط غير صالح أو تم حذف الفورم.</div>`;
    return;
  }

  $("activeFormInfo").innerHTML = `
    <div class="row" style="justify-content:space-between;align-items:flex-start">
      <div>
        <div class="tag">${form.active ? "فورم نشط" : "فورم متوقف"}</div>
        <h3 style="margin:10px 0 4px">${escapeHtml(form.title)}</h3>
        <div class="meta">${escapeHtml(form.description || "")}</div>
      </div>
      <div class="tag">${form.questions.length} سؤال</div>
    </div>
    <div class="divider"></div>
    <div class="meta">${form.active ? "أجب على الأسئلة ثم أرسل النتيجة." : "هذا الفورم متوقف حاليًا، ولا يمكن إرسال الإجابات."}</div>
  `;
}

function renderQuestions() {
  const form = state.form;
  const wrap = $("userQuestions");
  if (!form) {
    wrap.innerHTML = `<div class="card">هذا الرابط غير صالح أو الفورم غير موجود.</div>`;
    return;
  }

  if (!form.active) {
    wrap.innerHTML = `<div class="card">هذا الفورم متوقف حاليًا.</div>`;
    return;
  }

  if (!form.questions.length) {
    wrap.innerHTML = `<div class="card">لا توجد أسئلة داخل هذا الفورم حتى الآن.</div>`;
    return;
  }

  wrap.innerHTML = "";
  form.questions.forEach((q, index) => {
    const box = document.createElement("div");
    box.className = "question-item";
    box.innerHTML = `
      <div class="question-head">
        <div>
          <div class="tag">${escapeHtml(q.category || "آخر")}</div>
          <h3 style="margin:10px 0 4px">${index + 1}. ${escapeHtml(q.text)}</h3>
          <div class="meta">اختر الإجابة الأقرب لك</div>
        </div>
        <div class="tag">${q.type === "tf" ? "صح وغلط" : "اختياري"}</div>
      </div>
      <div class="answers">
        ${(q.options || []).map((o, idx) => `
          <label class="option">
            <input type="radio" name="q_${q.id}" value="${idx}" ${state.answers[q.id] === String(idx) ? "checked" : ""} />
            <div>
              <div class="txt">${escapeHtml(o.text)}</div>
            </div>
          </label>
        `).join("")}
      </div>
    `;
    wrap.appendChild(box);
  });

  wrap.querySelectorAll('input[type="radio"]').forEach((r) => {
    r.addEventListener("change", (e) => {
      const qId = e.target.name.replace("q_", "");
      state.answers[qId] = e.target.value;
    });
  });
}


function updateSidebar() {
  const form = state.form;
  $("sideStatus").textContent = !form ? "—" : (form.active ? "نشط" : "متوقف");
  $("sideQuestions").textContent = form ? String(form.questions.length) : "0";
  $("sidePercent").textContent = state.result ? `${Number(state.result.overallPercent || 0)}%` : "0%";
  $("sideBestFile").textContent = state.result?.bestFile?.category || "—";
}

function renderResult(submission) {
  const level = levelFromPercent(submission.overallPercent || 0);
  const topFiles = submission.topThree || [];
  state.result = submission;
  updateSidebar();
  $("resultArea").innerHTML = `
    <div class="result">
      <div class="chips">
        <span class="chip">${escapeHtml(submission.formTitle)}</span>
        <span class="chip">${Number(submission.overallPercent || 0)}%</span>
        <span class="chip">${escapeHtml(level.label)}</span>
      </div>

      <h3 style="margin-top:16px">${escapeHtml(submission.name || "مستخدم")}</h3>
      <p>النتيجة العامة: <b>${submission.overallScore}</b> من <b>${submission.overallMax}</b></p>
      <p style="margin-top:10px">${escapeHtml(level.desc)}</p>
      <div class="divider"></div>
      <p><b>التوصية:</b> ${escapeHtml(submission.overallRecommendation || "")}</p>
      <p><b>أفضل ملف:</b> ${escapeHtml(submission.bestFile?.category || "—")}</p>
      <p><b>أقوى الملفات:</b> ${escapeHtml(bestCategorySummary(topFiles))}</p>
      <p><b>رقم الهاتف:</b> ${escapeHtml(submission.phone || "")}</p>
    </div>
  `;
}

async function submitTest() {
  const form = state.form;
  const name = $("userName").value.trim();
  const phone = $("userPhone").value.trim();

  if (!form) return showToast("لا يوجد فورم صالح");
  if (!form.active) return showToast("هذا الفورم متوقف الآن");
  if (!name || !phone) return showToast("اكتب الاسم ورقم الهاتف أولًا");
  if (!form.questions.length) return showToast("لا توجد أسئلة داخل هذا الفورم");

  const result = buildResult(form, state.answers);
  const submission = {
    id: `sub_${Math.random().toString(36).slice(2, 10)}${Date.now().toString(36)}`,
    formId: form.id,
    formTitle: form.title,
    name,
    phone,
    answers: state.answers,
    overallScore: result.overallScore,
    overallMax: result.overallMax,
    overallPercent: result.overallPercent,
    overallLevel: result.overallLevel.label,
    overallRecommendation: result.overallRecommendation,
    bestFile: result.bestFile,
    topThree: result.topThree,
    fileScores: result.fileScores,
    createdAt: Date.now()
  };

  await addSubmission(form.id, submission);
  state.result = submission;
  renderResult(submission);
  setUserTab("results");
  showToast("تم إرسال النتيجة");
}

function wireTabs() {
  $("userTabTake").addEventListener("click", () => setUserTab("take"));
  $("userTabResults").addEventListener("click", () => setUserTab("results"));
}

function wireButtons() {
  $("submitTest").addEventListener("click", submitTest);
  $("clearAnswers").addEventListener("click", () => {
    state.answers = {};
    renderQuestions();
    showToast("تم مسح الإجابات");
  });
  $("backToTest").addEventListener("click", () => setUserTab("take"));
}

async function resolveForm() {
  const allForms = await listForms();
  state.forms = allForms;

  const fromQuery = queryFormId();
  let form = null;

  if (fromQuery) {
    form = await getForm(fromQuery);
  }

  if (!form) {
    form = allForms.find((f) => f.active) || allForms[0] || null;
    if (form) {
      const url = new URL(location.href);
      url.searchParams.set("formId", form.id);
      history.replaceState({}, "", url.toString());
    }
  }

  state.formId = form?.id || null;
  state.form = form;
  renderFormHeader();
  renderQuestions();
  updateSidebar();
  updateSidebar();
  updateSidebar();
}

function attachLiveUpdates() {
  watchForms((forms) => {
    state.forms = forms;
    const formId = queryFormId();
    const existing = formId ? forms.find((f) => f.id === formId) : null;

    if (existing) {
      state.form = existing;
      state.formId = existing.id;
    } else if (!state.form || !forms.some((f) => f.id === state.form.id)) {
      const fallback = forms.find((f) => f.active) || forms[0] || null;
      state.form = fallback;
      state.formId = fallback?.id || null;
      if (fallback) {
        const url = new URL(location.href);
        url.searchParams.set("formId", fallback.id);
        history.replaceState({}, "", url.toString());
      }
    }

    renderFormHeader();
    renderQuestions();
    updateSidebar();
  });
}

async function init() {
  await ensureStarterForm();
  wireTabs();
  wireButtons();
  await resolveForm();
  attachLiveUpdates();
  setUserTab("take");
}

init();
