export const FILE_OPTIONS = [
  "الجذب",
  "المعارض",
  "التنمية",
  "القوافل",
  "الملف الطبي",
  "الأطفال",
  "منسق مركز",
  "التمويل",
  "التقييم والمتابعة",
  "الميديا",
  "الطوارئ",
  "آخر"
];

export const FORM_STATUSES = {
  ACTIVE: "نشط",
  PAUSED: "متوقف"
};

export function uid(prefix = "id") {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}${Date.now().toString(36)}`;
}

export function escapeHtml(input) {
  return String(input ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

export function formatDateTime(value) {
  const d = typeof value === "number" ? new Date(value) : new Date(value || Date.now());
  return d.toLocaleString("ar-EG", {
    dateStyle: "medium",
    timeStyle: "short"
  });
}

export function createEmptyForm(title = "فورم جديد", description = "وصف الفورم") {
  const now = Date.now();
  return {
    id: uid("form"),
    title,
    description,
    active: true,
    createdAt: now,
    updatedAt: now,
    questions: []
  };
}

export function createQuestion({
  text,
  type = "mcq",
  category = "آخر",
  options = []
}) {
  return {
    id: uid("q"),
    text: text.trim(),
    type,
    category: category.trim() || "آخر",
    options: options.map((opt) => ({
      text: String(opt.text ?? "").trim(),
      score: Number(opt.score ?? 0)
    }))
  };
}

export function getQuestionTypeLabel(type) {
  return type === "tf" ? "صح وغلط" : "اختياري";
}

export function levelFromPercent(percent) {
  const p = Number(percent || 0);
  if (p >= 85) return { label: "قائد جاهز", desc: "مؤهل لقيادة ملف أو فريق بشكل واضح.", tone: "level-5" };
  if (p >= 70) return { label: "قائد ملف صغير", desc: "مناسب لقيادة مهمة أو فريق محدود.", tone: "level-4" };
  if (p >= 55) return { label: "قائد مساعد", desc: "يناسب المساندة وقيادة جزء من العمل.", tone: "level-3" };
  if (p >= 40) return { label: "مناسب كعضو فريق", desc: "جيد في المشاركة والتنفيذ ويحتاج نموًا في القيادة.", tone: "level-2" };
  return { label: "يحتاج إعدادًا أساسيًا", desc: "يحتاج بناء أساسي في المسؤولية والمبادرة قبل القيادة.", tone: "level-1" };
}

export function overallRecommendation(percent) {
  const p = Number(percent || 0);
  if (p >= 85) return "يناسب قيادة ملف كامل أو ملف تنسيقي كبير";
  if (p >= 70) return "يناسب قيادة ملف صغير أو فريق عملي";
  if (p >= 55) return "يناسب قائد مساعد داخل ملف نشط";
  if (p >= 40) return "يناسب العمل التطوعي كعضو فريق";
  return "يحتاج إعدادًا قبل أي مسؤولية قيادية";
}

export function buildResult(form, answers = {}) {
  const fileMap = {};
  let overallScore = 0;
  let overallMax = 0;

  (form.questions || []).forEach((q) => {
    const category = (q.category || "آخر").trim() || "آخر";
    const options = Array.isArray(q.options) ? q.options : [];
    const selectedIndex = answers[q.id] !== undefined ? Number(answers[q.id]) : -1;
    const selected = options[selectedIndex];
    const maxForQuestion = Math.max(1, ...options.map((o) => Number(o.score ?? 0)));

    if (!fileMap[category]) {
      fileMap[category] = { category, score: 0, max: 0, count: 0 };
    }

    fileMap[category].score += Number(selected?.score ?? 0);
    fileMap[category].max += maxForQuestion;
    fileMap[category].count += 1;

    overallScore += Number(selected?.score ?? 0);
    overallMax += maxForQuestion;
  });

  const fileScores = Object.values(fileMap)
    .map((item) => ({
      ...item,
      percent: item.max > 0 ? Math.round((item.score / item.max) * 100) : 0
    }))
    .sort((a, b) => b.percent - a.percent || b.count - a.count);

  const overallPercent = overallMax > 0 ? Math.round((overallScore / overallMax) * 100) : 0;
  const bestFile = fileScores[0] || null;
  const topThree = fileScores.slice(0, 3);

  return {
    overallScore,
    overallMax,
    overallPercent,
    overallLevel: levelFromPercent(overallPercent),
    overallRecommendation: overallRecommendation(overallPercent),
    bestFile,
    topThree,
    fileScores
  };
}

export function buildStarterForm() {
  const form = createEmptyForm(
    "استبيان اختيار القادة",
    "استبيان قيادي يحدد أنسب ملف للمتطوع بناءً على المهارات والسلوكيات."
  );

  form.questions = [
    createQuestion({
      text: "إذا ظهر خلاف بين متطوعين أثناء التنفيذ، ما تصرفك أولًا؟",
      category: "منسق مركز",
      options: [
        { text: "أتركهم حتى يهدأ الوضع", score: 0 },
        { text: "أدخل بهدوء وأستمع للطرفين ثم أرتب الحل", score: 10 },
        { text: "أنقل الخلاف مباشرة للمسؤول الأعلى", score: 4 },
        { text: "أكتفي بإيقاف المهمة نهائيًا", score: 2 }
      ]
    }),
    createQuestion({
      text: "عند التعامل مع مرضى أو أهاليهم في موقف حساس، ما الأسلوب الأقرب لك؟",
      category: "الملف الطبي",
      type: "tf",
      options: [
        { text: "أحافظ على الهدوء والطمأنة والسرية", score: 10 },
        { text: "أتصرف بسرعة دون شرح كافٍ", score: 2 }
      ]
    }),
    createQuestion({
      text: "إذا احتجت أن تتواصل مع جهة خارجية أو متبرع محتمل، كيف تتصرف؟",
      category: "الجذب",
      options: [
        { text: "أتجنب المبادرة وأنتظر من يتواصل", score: 0 },
        { text: "أتواصل بلطف وأشرح الهدف بوضوح", score: 10 },
        { text: "أضغط على الجهة حتى توافق فورًا", score: 3 },
        { text: "أترك التواصل بعد أول محاولة", score: 1 }
      ]
    }),
    createQuestion({
      text: "أمامك عمل ميداني مع ضغط زمني وتغيير مفاجئ، ما الأقرب لك؟",
      category: "القوافل",
      options: [
        { text: "أتوتر وأتوقف عن المتابعة", score: 0 },
        { text: "أعيد ترتيب الأولويات وأتحرك بسرعة", score: 10 },
        { text: "أنتظر تعليمات كثيرة قبل التحرك", score: 3 },
        { text: "أترك التنظيم لغيري تمامًا", score: 1 }
      ]
    }),
    createQuestion({
      text: "إذا كان عليك التنسيق مع أطباء ومعامل وصيدليات، ما أهم شيء تركز عليه؟",
      category: "التمويل",
      options: [
        { text: "السرعة فقط بدون متابعة", score: 2 },
        { text: "العلاقة الهادئة، الاتفاق الواضح، والتوثيق", score: 10 },
        { text: "الجدال لإثبات وجهة نظري", score: 0 },
        { text: "تغيير الاتفاق كل مرة", score: 1 }
      ]
    }),
    createQuestion({
      text: "لو كان المحتوى المطلوب للنشر عاجلًا لكنه يحتاج دقة، ماذا تفعل؟",
      category: "الميديا",
      options: [
        { text: "أنشر سريعًا دون مراجعة", score: 0 },
        { text: "أراجع وأوازن بين السرعة والجودة", score: 10 },
        { text: "أؤجل النشر كثيرًا", score: 2 },
        { text: "أتركه بالكامل", score: 1 }
      ]
    }),
    createQuestion({
      text: "إذا كانت هناك حالات كثيرة جدًا في اليوم نفسه، كيف تتعامل؟",
      category: "التقييم والمتابعة",
      options: [
        { text: "أتعامل مع كل حالة عشوائيًا", score: 1 },
        { text: "أرتب حسب الأولوية وأتابع بدقة", score: 10 },
        { text: "أؤجل المتابعة حتى آخر اليوم", score: 2 },
        { text: "أترك المشكلة من غير خطة", score: 0 }
      ]
    }),
    createQuestion({
      text: "عند العمل مع أطفال، أي سلوك أقرب لأسلوبك؟",
      category: "الأطفال",
      options: [
        { text: "أكون جافًا حتى يلتزموا", score: 0 },
        { text: "أكون صبورًا ولطيفًا وأدير الموقف بوضوح", score: 10 },
        { text: "أتعامل بعصبية وقت الضغط", score: 1 },
        { text: "أتركهم دون نظام", score: 0 }
      ]
    })
  ];

  return form;
}

export function fileTemplateLabel(value) {
  return FILE_OPTIONS.includes(value) ? value : "آخر";
}

export function bestCategorySummary(topThree) {
  if (!topThree || !topThree.length) return "لا توجد بيانات كافية بعد.";
  return topThree
    .map((x, i) => `${i + 1}) ${x.category} (${x.percent}%)`)
    .join(" · ");
}
