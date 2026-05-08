# منصة تقييم القيادة

## الملفات
- `admin.html` : لوحة الأدمن
- `index.html` : صفحة المستخدمين
- `style.css` : التنسيق المشترك
- `config/firebase-config.js` : إعداد Firebase
- `js/shared.js` : الأدوات المشتركة وحساب النتائج
- `js/store.js` : التخزين المحلي + Firestore
- `js/admin.js` : منطق لوحة الأدمن
- `js/user.js` : منطق صفحة المستخدمين

## التشغيل
هذه الصفحات تستخدم ES Modules، لذلك تحتاج فتحها عبر سيرفر محلي وليس بالنقر المباشر على الملف.

### طريقة سريعة
```bash
python -m http.server 8000
```

ثم افتح:
- `http://localhost:8000/admin.html`
- `http://localhost:8000/index.html`

## Firebase
تم وضع إعداد Firebase داخل `config/firebase-config.js` باستخدام القيم التي زودتني بها.

### ما الذي يحفظ في Firebase؟
- الفورمات
- الأسئلة
- نتائج المستخدمين
- الإحصائيات الناتجة عن الإجابات

## ملاحظات مهمة
- صفحة المستخدمين لا تحتوي أي زر للوصول إلى الأدمن.
- الأدمن يفتح لوحة الإدارة مباشرة من `admin.html`.
- كل فورم له `formId` ورابط مستقل من الشكل:
  `index.html?formId=...`
- لو Firestore لم يكن متاحًا لأي سبب، سيعمل المشروع محليًا كنسخة احتياطية عبر `localStorage`.
