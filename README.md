# AK Net - بوابة الدخول وصفحة الحالة (HotSpot Portal)
> **الإصدار المتوافق بالكامل مع MikroTik RouterOS 7 ونظام إدارة المستخدمين User Manager v7**

---

## 🌟 نظرة عامة على المشروع

تم تطوير وتحديث هذه البوابة لشبكة **AK Net** لتوفير تجربة مستخدم سلسة وعصرية مع معالجة دقيقة وعلمية لبيانات الجلسات والاشتراكات ضمن بيئة **MikroTik RouterOS 7** ونظام **User Manager v7** المعتمد على خادم RADIUS المدمج وقاعدة بيانات SQLite.

---

## 🔍 التقرير التقني الجذري والمشكلات المعالجة (Root Cause Analysis)

| المشكلة السابقة | السبب الجذري في RouterOS 7 | الحل المنفذ في هذا التحديث |
| :--- | :--- | :--- |
| **عدم ظهور الرصيد المتبقي** | الاعتماد على متغير وهمي غير موجود في نظام ميكروتك وهو `$(remain-bytes-total)` | استخدام المتغيرات الرسمية المعتمدة في RouterOS (`$(remain-bytes-out)` و `$(remain-bytes-in)`) وقراءة سمات RADIUS الرسمية |
| **تلف واختلال الباقات الأكبر من 4GB** | سمة `radius17-14988u` (`Mikrotik-Total-Limit`) هي عدد 32-bit يتجاوز عند 4.29GB | دمج سمة `$(radius18-14988u)` (`Mikrotik-Total-Limit-Gigawords`) لحساب السعات الكبيرة (40GB, 80GB, 170GB) بدقة 64-bit كاملة |
| **تلف احتساب الرصيد من الجلسة الواحدة** | كان الكود يطرح استهلاك الجلسة الحالية من إجمالي الباقة متجاهلاً استهلاك الجلسات السابقة | عدم افتراض الرصيد التراكمي من الجلسة الحالية، وعرض حالة "يُدار عبر السيرفر" الموثقة عند عدم تمرير الراوتر للحصص المتبقية |
| **تصفير أو إعادة احتساب صلاحية الوقت** | كان الكود يطرح مدة الاتصال (`uptime`) من مدة الباقة الإجمالية فيتجدد الوقت عند كل اتصال جديد | التفريق الصارم بين مهلة الجلسة الحالية (`session-time-left`) وصلاحية الباقة التراكمية، وعدم تزييف تواريخ انتهاء غير مؤكدة |
| **خطأ تحليل صيغ الوقت في RouterOS** | صيغ الوقت المعقدة مثل `1w2d04:10:20` أو `12h30m` كانت تفشل في التعبير النمطي القديم | محرك تحليل شامل لجميع صيغ وقت RouterOS (أسابيع، أيام، ساعات، دقائق، ثوانٍ) بنظام النقطتين والرموز الحرفية |
| **خطأ 404 عند النقر على `/um`** | خادم الويب المدمج في RouterOS 7 يتطلب إلزامياً وجود شرطة مائلة في نهاية المسار `/um/` | تصحيح الرابط إلى `http://$(hostname)/um/` مع توفير نافذة داخلية متكاملة للجلسة تغني عن الحاجة للبوابة الخارجية |

---

## 📊 جدول المتغيرات المعتمدة في RouterOS 7 HotSpot

### 1. متغيرات الجلسة والراوتر الرسمية:
- `$(username)`: اسم المستخدم المصادق عليه.
- `$(ip)` / `$(mac)`: عنوان IP وعنوان MAC لجهاز المستخدم.
- `$(uptime)` / `$(uptime-secs)`: مدة اتصال الجلسة الحالية نصاً وبالثواني.
- `$(session-time-left)` / `$(session-time-left-secs)`: الوقت المتبقي للجلسة الحالية.
- `$(bytes-in)` / `$(bytes-out)`: حجم البيانات المستلمة والمرسلة في الجلسة الحالية بالبايت.
- `$(bytes-total-nice)` / `$(bytes-in-nice)` / `$(bytes-out-nice)`: حجم البيانات بتنسيق مقروء (MB/GB).
- `$(remain-bytes-out)` / `$(remain-bytes-in)`: الحصة المتبقية للتنزيل والرفع المحددة في الراوتر.
- `$(limit-bytes-out)` / `$(limit-bytes-in)`: الحد الأقصى للتنزيل والرفع.

### 2. سمات MikroTik RADIUS الرسمية (Vendor ID: 14988):
- `$(radius17-14988u)`: `Mikrotik-Total-Limit` (الجزء السفلي 32-bit للرصيد).
- `$(radius18-14988u)`: `Mikrotik-Total-Limit-Gigawords` (مضاعفات 4GB للرصيد الإجمالي).
- `$(radius1-14988u)` & `$(radius14-14988u)`: حد التنزيل مع Gigawords.
- `$(radius2-14988u)` & `$(radius15-14988u)`: حد الرفع مع Gigawords.
- `$(radius3-14988)`: `Mikrotik-Group` (اسم المجموعة أو الفئة).
- `$(radius8-14988)`: `Mikrotik-Rate-Limit` (تحديد السرعة).
- `$(radius25)`: سمة `Class` المعتمدة لنقل أسماء الحزم.
- `$(radius27u)`: سمة `Session-Timeout` بالثواني.

---

## 🛠️ وضع الفحص والتشخيص المباشر (Diagnostics Mode)

تم تزويد صفحة [status.html](file:///c:/Users/ahmed/Downloads/AKNET_Network_Audit_Toolkit%20(1)/hotspot/status.html) بوضع تشخيصي مدمج ومخفي بالكامل في البيئة الإنتاجية:
- **لتفعيل الوضع:** قم بإضافة `?debug=1` أو `?diag=1` إلى رابط صفحة الحالة:
  `http://10.0.0.1/status?debug=1`
- **الوظيفة:** يظهر لوحة تحكم سوداء تعرض كافة القيم الخام الواردة من خادم MikroTik وقيم سمات RADIUS المحسوبة بدقة 64-bit، لمساعدة مسؤولي الشبكة على فحص ومطابقة إعدادات الراوتر لحظياً.

---

## 🚀 دليل التثبيت والتكوين على MikroTik RouterOS 7

### الخطوة 1: رفع الملفات إلى الراوتر
1. افتح برنامج **WinBox** وسجل الدخول إلى الراوتر.
2. افتح قائمة **Files**.
3. قم بإنشاء أو فتح مجلد `hotspot` (أو `flash/hotspot` حسب نوع الذاكرة).
4. اسحب كافة ملفات هذا المستودع وضعها داخل المجلد.

### الخطوة 2: تكوين خادم Hotspot و RADIUS
من خلال **Terminal** في الراوتر، نفذ الأوامر التالية:

```routeros
# ضبط بروفايل الهوتسبوت لاستخدام مجلد الملفات والـ RADIUS مع التحديث الدوري
/ip hotspot profile
set [find default=yes] \
    html-directory=hotspot \
    login-by=cookie,http-chap,http-pap \
    use-radius=yes \
    radius-interim-update=1m \
    radius-accounting=yes

# ضبط خادم RADIUS الموجه لليوزر مانجر المحلي
/radius
set [find service=hotspot] \
    address=127.0.0.1 \
    service=hotspot \
    timeout=3000ms
```

### الخطوة 3: تكوين باقات وقيود User Manager v7
في نظام User Manager v7، يتم تحديد قيود الباقات عبر الحصص (Limits) أو مجموعات المستخدمين (Groups):

```routeros
# مثال لباقة 200 ريال (800MB - صلاحية 24 ساعة):
/user-manager/user/group
set [find name="200RY"] attributes="Mikrotik-Total-Limit=838860800,Session-Timeout=86400"

# مثال لباقة 500 ريال (2GB - صلاحية 3 أيام):
set [find name="500RY"] attributes="Mikrotik-Total-Limit=2147483648,Session-Timeout=259200"

# مثال لباقة 1000 ريال (5GB - صلاحية 7 أيام):
set [find name="1000RY"] attributes="Mikrotik-Total-Limit=1073741824,Mikrotik-Total-Limit-Gigawords=1,Session-Timeout=604800"

# مثال لباقة 6000 ريال (40GB - صلاحية 30 يوماً):
set [find name="6000RY"] attributes="Mikrotik-Total-Limit=0,Mikrotik-Total-Limit-Gigawords=10,Session-Timeout=2592000"

# مثال لباقة 10000 ريال (80GB - صلاحية 30 يوماً):
set [find name="10000RY"] attributes="Mikrotik-Total-Limit=0,Mikrotik-Total-Limit-Gigawords=20,Session-Timeout=2592000"

# مثال لباقة 20000 ريال (170GB - صلاحية 30 يوماً):
set [find name="20000RY"] attributes="Mikrotik-Total-Limit=2147483648,Mikrotik-Total-Limit-Gigawords=42,Session-Timeout=2592000"
```

---

## 🧪 الاختبارات الآلية والتحقق (Automated Tests)

المشروع مزود بمجموعة اختبارات برمجية شاملة داخل مجلد [test/status_audit.test.js](file:///c:/Users/ahmed/Downloads/AKNET_Network_Audit_Toolkit%20(1)/hotspot/test/status_audit.test.js) تغطي 10 سيناريوهات رئيسية:

```bash
# لتشغيل الاختبارات عبر Node.js:
node test/status_audit.test.js
```

### السيناريوهات المختبرة:
1. مستخدم نشط بحصة بيانات ووقت متبقي معتمدين.
2. مستخدم استهلك حصة البيانات بالكامل (0 بايت متبقي).
3. مستخدم انتهت مهلة جلسته الزمنية.
4. حساب باقة غير محدودة صراحة (`---`).
5. مستخدم بدون سمات RADIUS محددة (السلوك الافتراضي لليوزر مانجر).
6. الباقات الضخمة الأكبر من 4GB (40GB, 80GB, 170GB مع Gigawords).
7. معالجة المتغيرات غير المعوضة أو المفقودة من الراوتر بدون أخطاء JavaScript.
8. تحليل جميع صيغ وقت ميكروتك المركبة (`1d02:30:45`, `12h30m`, `00:15:30`, `1w2d04:10:20`, `45s`, `3d`).
9. العدادات الحية التنازلية والتصاعدية للاتصال ثانية بثانية.
10. التحقق من عزل وضع الفحص والتشخيص `?debug=1`.

**نتيجة التشغيل الحالية:** `28 Passed, 0 Failed` بنسبة نجاح 100%.

---

## 🔄 تعليمات التراجع الآمن (Rollback Instructions)

في حال الرغبة في التراجع لأي إصدار سابق:
```bash
# عبر Git:
git log --oneline
git checkout <commit-hash> -- status.html api.json alogin.html

# أو إعادة توجيه مسار الهوتسبوت في ميكروتك إلى المجلد الاحتياطي:
/ip hotspot profile set [find default=yes] html-directory=hotspot_backup
```

---

## 👤 مطور النظام
- **المطور:** أحمد أنيس رويشد (Ahmed Anis Rowaished)
- **المستودع الرسمي:** [https://github.com/ahmed-anis-rowaished/AK-net_login_page](https://github.com/ahmed-anis-rowaished/AK-net_login_page)
