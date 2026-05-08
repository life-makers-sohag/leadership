import {
  db,
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  addDoc,
  updateDoc,
  deleteDoc,
  onSnapshot
} from "../config/firebase-config.js";

import { buildStarterForm, createEmptyForm, uid } from "./shared.js";

const LOCAL_KEYS = {
  forms: "leadership_forms_local_v5",
  submissions: "leadership_submissions_local_v5"
};

let remoteHealthy = true;

function readLocalJSON(key, fallback) {
  try {
    return JSON.parse(localStorage.getItem(key) || JSON.stringify(fallback));
  } catch {
    return fallback;
  }
}

function writeLocalJSON(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
}

function localForms() {
  return readLocalJSON(LOCAL_KEYS.forms, []);
}

function localSubmissions() {
  return readLocalJSON(LOCAL_KEYS.submissions, {});
}

function saveLocalForm(form) {
  const forms = localForms();
  const idx = forms.findIndex((f) => f.id === form.id);
  if (idx >= 0) forms[idx] = form;
  else forms.unshift(form);
  writeLocalJSON(LOCAL_KEYS.forms, forms);
  return form;
}

function removeLocalForm(formId) {
  const forms = localForms().filter((f) => f.id !== formId);
  const submissions = localSubmissions();
  delete submissions[formId];
  writeLocalJSON(LOCAL_KEYS.forms, forms);
  writeLocalJSON(LOCAL_KEYS.submissions, submissions);
}

function saveLocalSubmission(formId, submission) {
  const submissions = localSubmissions();
  if (!submissions[formId]) submissions[formId] = [];
  submissions[formId].push(submission);
  writeLocalJSON(LOCAL_KEYS.submissions, submissions);
  return submission;
}

function normalizeForm(docId, data = {}) {
  return {
    id: docId,
    title: data.title || "فورم جديد",
    description: data.description || "",
    active: data.active !== false,
    createdAt: Number(data.createdAt || Date.now()),
    updatedAt: Number(data.updatedAt || Date.now()),
    questions: Array.isArray(data.questions) ? data.questions : []
  };
}

function normalizeSubmission(docId, data = {}) {
  return {
    id: docId,
    ...data,
    createdAt: Number(data.createdAt || Date.now())
  };
}

async function remoteListForms() {
  const snap = await getDocs(collection(db, "forms"));
  return snap.docs.map((d) => normalizeForm(d.id, d.data()))
    .sort((a, b) => (b.updatedAt || b.createdAt) - (a.updatedAt || a.createdAt));
}

async function remoteGetForm(formId) {
  const snap = await getDoc(doc(db, "forms", formId));
  if (!snap.exists()) return null;
  return normalizeForm(snap.id, snap.data());
}

async function remoteSaveForm(form) {
  const payload = {
    ...form,
    updatedAt: Date.now(),
    createdAt: Number(form.createdAt || Date.now())
  };
  await setDoc(doc(db, "forms", form.id), payload, { merge: true });
  return normalizeForm(form.id, payload);
}

async function remoteDeleteForm(formId) {
  await deleteDoc(doc(db, "forms", formId));
}

async function remoteAddSubmission(formId, submission) {
  const payload = {
    ...submission,
    createdAt: Number(submission.createdAt || Date.now())
  };
  const ref = await addDoc(collection(db, "forms", formId, "submissions"), payload);
  return normalizeSubmission(ref.id, payload);
}

async function remoteListSubmissions(formId) {
  const snap = await getDocs(collection(db, "forms", formId, "submissions"));
  return snap.docs.map((d) => normalizeSubmission(d.id, d.data()))
    .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
}

async function tryRemote(fn, fallback) {
  if (!remoteHealthy) return fallback();
  try {
    return await fn();
  } catch (err) {
    console.warn("Firebase fallback to local storage:", err);
    remoteHealthy = false;
    return fallback();
  }
}

function ensureStarterSeed() {
  const forms = localForms();
  if (forms.length) return;
  const starter = buildStarterForm();
  saveLocalForm(starter);
}

export async function ensureStarterForm() {
  const forms = await listForms();
  if (forms.length) return forms[0];
  const starter = buildStarterForm();
  await saveForm(starter);
  return starter;
}

export async function listForms() {
  return tryRemote(remoteListForms, async () => {
    ensureStarterSeed();
    return localForms()
      .sort((a, b) => (b.updatedAt || b.createdAt) - (a.updatedAt || a.createdAt));
  });
}

export async function getForm(formId) {
  if (!formId) return null;
  return tryRemote(() => remoteGetForm(formId), async () => {
    const form = localForms().find((f) => f.id === formId) || null;
    return form;
  });
}

export async function saveForm(form) {
  const cleaned = {
    ...form,
    createdAt: Number(form.createdAt || Date.now()),
    updatedAt: Date.now(),
    questions: Array.isArray(form.questions) ? form.questions : []
  };

  return tryRemote(async () => remoteSaveForm(cleaned), async () => {
    saveLocalForm(cleaned);
    return cleaned;
  });
}

export async function deleteForm(formId) {
  return tryRemote(async () => remoteDeleteForm(formId), async () => {
    removeLocalForm(formId);
    return true;
  });
}

export async function addSubmission(formId, submission) {
  const cleaned = {
    id: submission.id || uid("sub"),
    ...submission,
    createdAt: Number(submission.createdAt || Date.now())
  };

  return tryRemote(async () => remoteAddSubmission(formId, cleaned), async () => {
    saveLocalSubmission(formId, cleaned);
    return cleaned;
  });
}

export async function listSubmissions(formId) {
  return tryRemote(async () => remoteListSubmissions(formId), async () => {
    const submissions = localSubmissions();
    return (submissions[formId] || []).slice().sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
  });
}

export function watchForms(callback) {
  let stopped = false;

  const sendLocal = () => {
    ensureStarterSeed();
    callback(
      localForms().slice().sort((a, b) => (b.updatedAt || b.createdAt) - (a.updatedAt || a.createdAt))
    );
  };

  if (remoteHealthy) {
    try {
      const unsubscribe = onSnapshot(
        collection(db, "forms"),
        (snap) => {
          if (stopped) return;
          const forms = snap.docs.map((d) => normalizeForm(d.id, d.data()))
            .sort((a, b) => (b.updatedAt || b.createdAt) - (a.updatedAt || a.createdAt));
          callback(forms);
        },
        (err) => {
          console.warn("Firestore watch forms error:", err);
          remoteHealthy = false;
          sendLocal();
        }
      );
      return () => {
        stopped = true;
        try { unsubscribe(); } catch {}
      };
    } catch (err) {
      console.warn("Firestore watch forms fallback:", err);
      remoteHealthy = false;
    }
  }

  sendLocal();
  const timer = setInterval(() => {
    if (!stopped) sendLocal();
  }, 3000);
  return () => {
    stopped = true;
    clearInterval(timer);
  };
}

export function watchSubmissions(formId, callback) {
  let stopped = false;

  const sendLocal = () => {
    const submissions = localSubmissions();
    callback((submissions[formId] || []).slice().sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0)));
  };

  if (remoteHealthy) {
    try {
      const unsubscribe = onSnapshot(
        collection(db, "forms", formId, "submissions"),
        (snap) => {
          if (stopped) return;
          const subs = snap.docs.map((d) => normalizeSubmission(d.id, d.data()))
            .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
          callback(subs);
        },
        (err) => {
          console.warn("Firestore watch submissions error:", err);
          remoteHealthy = false;
          sendLocal();
        }
      );
      return () => {
        stopped = true;
        try { unsubscribe(); } catch {}
      };
    } catch (err) {
      console.warn("Firestore watch submissions fallback:", err);
      remoteHealthy = false;
    }
  }

  sendLocal();
  const timer = setInterval(() => {
    if (!stopped) sendLocal();
  }, 3000);
  return () => {
    stopped = true;
    clearInterval(timer);
  };
}

export async function seedStarterIfNeeded() {
  const forms = await listForms();
  if (forms.length) return forms;
  const starter = buildStarterForm();
  await saveForm(starter);
  return [starter];
}

export function setFormQuestions(form, questions) {
  return {
    ...form,
    questions: questions.slice(),
    updatedAt: Date.now()
  };
}

export function createBlankForm(title, description) {
  return createEmptyForm(title, description);
}
