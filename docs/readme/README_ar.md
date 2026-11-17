<div dir="rtl">

<p align="center">
  <img src="../../apps/desktop/src-tauri/icons/128x128@2x.png" alt="ReqMate" width="96" height="96" />
</p>

<h1 align="center">ReqMate</h1>

<p align="center">
  <strong>منصة API التي تحترم خصوصيتك وذاكرتك وسير عملك مع Git.</strong>
</p>

<p align="center">
  بدون تسجيل دخول. بدون سحابة. بدون تضخم.
</p>

<p align="center">
  <em>Postman يستهلك 800 ميجابايت من الذاكرة. ReqMate يستهلك 60 ميجابايت.</em>
</p>

<p align="center">
  <a href="https://github.com/anan2620/ReqMate/releases/latest"><img src="https://img.shields.io/github/v/release/anan2620/ReqMate?style=flat-square&color=6366f1" alt="آخر إصدار" /></a>
  <a href="https://github.com/anan2620/ReqMate/releases/latest"><img src="https://img.shields.io/github/downloads/anan2620/ReqMate/total?style=flat-square&color=22c55e" alt="التنزيلات" /></a>
  <a href="https://github.com/anan2620/ReqMate/stargazers"><img src="https://img.shields.io/github/stars/anan2620/ReqMate?style=flat-square&color=eab308" alt="النجوم" /></a>
  <a href="https://github.com/anan2620/ReqMate/actions/workflows/ci.yml"><img src="https://img.shields.io/github/actions/workflow/status/anan2620/ReqMate/ci.yml?style=flat-square&label=CI" alt="CI" /></a>
  <a href="../../LICENSE"><img src="https://img.shields.io/github/license/anan2620/ReqMate?style=flat-square" alt="رخصة MIT" /></a>
</p>

<p align="center">
  <a href="#التنزيل">التنزيل</a> &bull;
  <a href="#الميزات">الميزات</a> &bull;
  <a href="#الانتقال-من-postman">الانتقال من Postman</a> &bull;
  <a href="#الأداء">الأداء</a> &bull;
  <a href="#المجتمع">المجتمع</a> &bull;
  <a href="#التطوير">التطوير</a>
</p>

<p align="center">
  <a href="../../README.md">English</a> &bull;
  <a href="README_es.md">Espa&#241;ol</a> &bull;
  <a href="README_fr.md">Fran&#231;ais</a> &bull;
  <a href="README_de.md">Deutsch</a> &bull;
  <a href="README_pt.md">Portugu&#234;s</a> &bull;
  <a href="README_zh.md">&#20013;&#25991;</a> &bull;
  <a href="README_ja.md">&#26085;&#26412;&#35486;</a> &bull;
  <a href="README_ko.md">&#54620;&#44397;&#50612;</a> &bull;
  <a href="README_ar.md">&#1575;&#1604;&#1593;&#1585;&#1576;&#1610;&#1577;</a>
</p>

</div>

---

<!-- TODO: Add hero screenshot/GIF here -->
<!-- <p align="center"><img src="../../docs/hero.gif" alt="عرض ReqMate التوضيحي" width="800" /></p> -->

## لماذا ReqMate؟

| | Postman | Bruno | Hoppscotch | **ReqMate** |
|---|---|---|---|---|
| **إطار العمل** | Electron | Electron | Tauri | **Tauri v2** |
| **استهلاك الذاكرة** | 300-800 MB | 150-300 MB | 50-80 MB | **~60 MB** |
| **وقت التشغيل** | 10-30s | 3-8s | <2s | **<2s** |
| **يتطلب حسابًا** | نعم | لا | اختياري | **لا** |
| **تخزين البيانات** | سحابي | نظام الملفات | IndexedDB | **نظام الملفات (YAML)** |
| **متوافق مع Git** | لا | نعم (.bru) | لا | **نعم (YAML قياسي)** |
| **gRPC** | نعم | نعم | لا | **نعم** |
| **WebSocket** | نعم | لا | نعم | **نعم** |
| **SSE** | نعم | لا | نعم | **نعم** |
| **MQTT** | لا | لا | لا | **نعم** |
| **خوادم وهمية** | سحابي فقط | لا | لا | **محلي** |
| **المراقبة** | سحابي فقط | لا | لا | **محلي** |
| **نظام الإضافات** | لا | لا | لا | **JS + WASM** |
| **التقاط الوكيل** | لا | لا | لا | **نعم** |
| **مقارنة الاستجابات** | لا | لا | لا | **نعم** |

## التنزيل

**[آخر إصدار](https://github.com/anan2620/ReqMate/releases/latest)**

| المنصة | التنزيل |
|----------|----------|
| **Windows** | [مثبّت `.exe`](https://github.com/anan2620/ReqMate/releases/latest) &bull; [`.msi`](https://github.com/anan2620/ReqMate/releases/latest) |
| **macOS** | [Apple Silicon `.dmg`](https://github.com/anan2620/ReqMate/releases/latest) &bull; [Intel `.dmg`](https://github.com/anan2620/ReqMate/releases/latest) |
| **Linux** | [`.AppImage`](https://github.com/anan2620/ReqMate/releases/latest) &bull; [`.deb`](https://github.com/anan2620/ReqMate/releases/latest) &bull; [`.rpm`](https://github.com/anan2620/ReqMate/releases/latest) |

<details>
<summary><strong>مديرو الحزم</strong></summary>

```bash
# Homebrew (macOS/Linux) — قريبًا
brew install --cask reqmate

# Chocolatey (Windows) — قريبًا
choco install reqmate

# Snap (Linux) — قريبًا
sudo snap install reqmate

# AUR (Arch Linux) — قريبًا
yay -S reqmate-bin
```

هل أنت مهتم بصيانة حزمة؟ [افتح issue](https://github.com/anan2620/ReqMate/issues/new) وسنعمل معك.
</details>

<details>
<summary><strong>البناء من الشيفرة المصدرية</strong></summary>

**المتطلبات الأساسية:** Node.js 22+، pnpm 10+، أدوات Rust، [متطلبات نظام Tauri v2](https://v2.tauri.app/start/prerequisites/)

```bash
git clone https://github.com/anan2620/ReqMate.git
cd reqmate
pnpm install
pnpm tauri build
```
</details>

## الانتقال من Postman

1. صدّر مجموعتك من Postman (Collection v2.1 JSON)
2. افتح ReqMate
3. `Ctrl+K` > "Import Collection" > اختر ملفك
4. انتهى. طلباتك الآن ملفات YAML تملكها أنت.

يمكن الاستيراد أيضًا من: **Insomnia**، **Bruno**، **Hoppscotch**، **OpenAPI 3.x**، **HAR**، **cURL**.

## الميزات

**متعدد البروتوكولات** — REST، GraphQL، gRPC، WebSocket، SSE، MQTT، Socket.IO في تطبيق واحد. لا توجد أداة أخرى تغطي هذا العدد من البروتوكولات.

**تخزين محلي أولًا** — كل طلب هو ملف `.yaml`. المجموعات هي مجلدات. كل شيء متوافق مع Git diff. بدون صيغ مملوكة.

**الوضع الداكن + السمات** — سمات داكنة وفاتحة وسوداء/OLED مع 8 ألوان تمييز.

**برمجة TypeScript** — سكريبتات ما قبل/بعد الطلب مع تعريفات أنواع كاملة. `req.test()`، `req.expect()`، `req.env.set()`.

**منفّذ المجموعات** — شغّل مجموعات كاملة مع اختبارات مبنية على البيانات (CSV/JSON)، تكرارات قابلة للتخصيص، تقارير JUnit/HTML.

**خوادم وهمية محلية** — أنشئ واجهات API وهمية من مجموعاتك. بيانات Faker.js، محاكاة التأخير، حقن الأخطاء. بدون سحابة، بدون حدود استخدام.

**مراقبة مجدولة** — اختبارات آلية مبنية على cron مع إشعارات سطح المكتب وتنبيهات webhook. تعمل محليًا، وليس على خادم شخص آخر.

**توليد وثائق API** — إنشاء وثائق HTML + Markdown من مجموعاتك.

**محرر OpenAPI** — تحرير والتحقق من مواصفات OpenAPI مع تكامل Spectral.

**مقارنة الاستجابات** — قارن الاستجابات جنبًا إلى جنب عبر عمليات التشغيل المختلفة.

**التقاط الوكيل** — وكيل HTTP/HTTPS محلي اعتراضي لفحص حركة المرور وإعادة تشغيلها.

**مساعد الذكاء الاصطناعي** — من اللغة الطبيعية إلى الطلبات، توليد اختبارات تلقائيًا، API متوافق مع OpenAI.

**نظام الإضافات** — وسّع ReqMate بإضافات JavaScript أو WASM.

**استيراد كل شيء** — Postman، Insomnia، Bruno، Hoppscotch، OpenAPI، HAR، cURL. انتقال بنقرة واحدة.

## الأداء

مبني بتقنية Tauri v2 (واجهة خلفية Rust + webview أصلي لنظام التشغيل)، وليس Electron.

| المقياس | الهدف |
|---|---|
| حجم الملف التنفيذي | ~20 MB |
| الذاكرة في وضع الخمول | ~60 MB |
| بدء التشغيل البارد | <2s |
| تأخير إرسال الطلب | <10ms حمل إضافي |

## صيغة البيانات

بياناتك هي YAML بسيط. بدون تقييد بمزوّد. بدون ترميز مملوك.

```yaml
# users/create-user.yaml
name: Create User
method: POST
url: "{{baseUrl}}/api/users"

headers:
  Content-Type: application/json

auth:
  type: bearer
  token: "{{adminToken}}"

body:
  type: json
  content: |
    {
      "name": "{{userName}}",
      "email": "{{userEmail}}"
    }

assert:
  status: 201
  body.id: { type: string }
  responseTime: { lt: 2000 }

tests: |
  req.test("should return created user", () => {
    const body = req.response.json();
    req.expect(body).to.have.property("id");
  });
```

## CLI

```bash
# تشغيل مجموعة
reqmate run ./my-collection --env production

# مع اختبارات مبنية على البيانات
reqmate run ./my-collection --data users.csv --reporter junit

# استيراد مجموعة Postman
reqmate import postman-export.json
```

## تعهد عدم التقييد

> إذا قررت مغادرة ReqMate، فإن بياناتك تغادر معك. كل ملف بصيغة قياسية. كل قاعدة بيانات مفتوحة. لن نجعل الانتقال إلى أداة أخرى صعبًا أبدًا.

## المجتمع

- [Discord](https://discord.gg/reqmate) — محادثة، أسئلة وملاحظات
- [Twitter / X](https://x.com/apiabordes) — تحديثات وإعلانات
- [GitHub Discussions](https://github.com/anan2620/ReqMate/discussions) — أفكار، أسئلة وأجوبة، شارك مشروعك
- [GitHub Issues](https://github.com/anan2620/ReqMate/issues) — تقارير الأخطاء وطلبات الميزات

## الترجمات

واجهة ReqMate تدعم التدويل عبر `react-i18next`. متوفرة حاليًا باللغة **الإنجليزية**.

ساعدنا في ترجمة ReqMate إلى لغتك! راجع مجلد [`locales/`](../../apps/desktop/src/locales/) وأرسل PR.

## التطوير

```bash
# تثبيت التبعيات
pnpm install

# التشغيل في وضع التطوير
pnpm tauri dev

# فحص TypeScript
pnpm -C apps/desktop exec tsc --noEmit

# البناء للإنتاج
pnpm tauri build
```

### هيكل المشروع

```
reqmate/
├── apps/
│   ├── desktop/           # تطبيق سطح المكتب Tauri v2
│   │   ├── src/           # واجهة React الأمامية
│   │   └── src-tauri/     # واجهة Rust الخلفية
│   ├── cli/               # أداة CLI (Rust)
│   ├── mcp-server/        # خادم MCP لمحررات الذكاء الاصطناعي
│   └── vscode-extension/  # إضافة VS Code
├── packages/
│   ├── types/             # أنواع TypeScript المشتركة
│   └── importer/          # مستوردو المجموعات
└── docs/                  # Documentation
```

### التقنيات المستخدمة

**الواجهة الأمامية:** React 19, TypeScript, Vite 6, Zustand, Tailwind CSS 4, Monaco Editor, Radix UI

**الواجهة الخلفية:** Rust, Tauri v2, reqwest, tokio, tonic (gRPC), axum (خوادم وهمية), deno_core (محرك البرمجة)

## المساهمة

Contributions are welcome! Check out the [GitHub Issues](https://github.com/anan2620/ReqMate/issues) for open tasks and feature requests.

<a href="https://github.com/anan2620/ReqMate/graphs/contributors">
  <img src="https://contrib.rocks/image?repo=anan2620/ReqMate" alt="المساهمون" />
</a>

## الرخصة

[MIT](../../LICENSE)

---

<p align="center">
  <sub>إذا ساعدك ReqMate في سير عملك، فكّر في منحه نجمة. يساعد ذلك الآخرين على اكتشاف المشروع.</sub>
</p>
