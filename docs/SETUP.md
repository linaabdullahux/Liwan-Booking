# دليل تشغيل نظام حجز قاعات ليوان أرُب

هذا الموقع جاهز بالكامل من ناحية الواجهة (Frontend)، ويحتاج منك خطوات ربط بسيطة
حتى يعمل بشكل حقيقي (قاعدة بيانات + بريد إلكتروني + استضافة). اتبعي الترتيب التالي.

---

## 1) إنشاء مشروع Supabase (قاعدة البيانات)

1. افتحي https://supabase.com وأنشئي مشروعًا جديدًا (Free Plan كافٍ للبداية).
2. من القائمة الجانبية: **SQL Editor → New query**، الصقي محتوى الملف
   `sql/schema.sql` كاملًا واضغطي **Run**. هذا ينشئ:
   - جدول القاعات (`rooms`) ومعبأ مسبقًا بقاعتين: قاعة الاجتماعات وقاعة العصف الذهني.
   - جدول الحجوزات (`bookings`) مع **قيد يمنع التعارض في قاعدة البيانات نفسها**
     (وليس فقط في JavaScript) — هذا هو الضمان الحقيقي ضد الحجز المزدوج.
   - جدول الضيوف المدعوين (`guests`).
   - كل دوال الحجز/الإلغاء/التعديل الآمنة (RPC functions).
3. من **Project Settings → API**، انسخي:
   - `Project URL`
   - `anon public key`
   وضعيهما في `js/supabase-client.js` بدلًا من:
   ```js
   const SUPABASE_URL = "https://YOUR-PROJECT-REF.supabase.co";
   const SUPABASE_ANON_KEY = "YOUR-ANON-PUBLIC-KEY";
   ```

## 2) إنشاء حسابات الإدارة (Admin)

1. من **Authentication → Users → Add user**، أنشئي حسابًا بإيميلك
   (linaalasmari4@gmail.com) وكلمة مرور. كرري الخطوة لأي عضو آخر بفريقك يحتاج دخول
   لوحة التحكم.
2. من **SQL Editor** نفذي (استبدلي USER_ID بمعرّف كل مستخدم من صفحة Users):
   ```sql
   insert into admin_users (user_id, full_name) values ('USER_ID', 'الاسم');
   ```
   بدون هذه الخطوة، حتى لو سجّل الشخص دخوله، لن يرى أي حجوزات (RLS تمنعه عمدًا).
3. الدخول من `/admin/login.html` بنفس الإيميل وكلمة المرور.

## 3) تفعيل البريد الإلكتروني (Resend)

الإرسال الفعلي للإيميلات يحتاج **Edge Function** (كود جاهز في `supabase/functions/`)
لأن المتصفح لا يقدر يرسل بريدًا مباشرة بأمان.

1. أنشئي حسابًا مجانيًا في https://resend.com (Free Tier كافٍ للبداية).
2. ثبّتي Supabase CLI محليًا، ثم من داخل مجلد المشروع:
   ```bash
   supabase login
   supabase link --project-ref YOUR-PROJECT-REF
   supabase secrets set RESEND_API_KEY=re_xxxxxxxx
   supabase secrets set FROM_EMAIL="ليوان أرُب <booking@yourdomain.com>"
   supabase secrets set ADMIN_NOTIFICATION_EMAIL=linaalasmari4@gmail.com
   supabase secrets set SITE_URL=https://yourbooking.pages.dev
   supabase functions deploy notify-booking
   supabase functions deploy notify-cancel
   supabase functions deploy send-reminders
   ```
   (بدون دومين موثّق في Resend، يمكن الإرسال مؤقتًا من
   `onboarding@resend.dev` للتجربة فقط.)
3. من لوحة Supabase: **Database → Webhooks → Create a new webhook**
   - الأول: Table = `bookings`, Event = `Insert` → HTTP Request → دالة `notify-booking`
   - الثاني: Table = `bookings`, Event = `Update` → HTTP Request → دالة `notify-cancel`
4. من **Edge Functions → send-reminders → Cron**: فعّلي جدولًا كل 5 دقائق
   (`*/5 * * * *`) لإرسال رسائل التذكير قبل الموعد.

## 4) النشر على Cloudflare Pages

1. ارفعي مجلد المشروع كامل (بدون مجلد `supabase/` — هذا خاص بالباك-إند فقط، لا يُنشر
   كموقع) إلى مستودع GitHub، أو استخدمي الرفع المباشر من Cloudflare.
2. Cloudflare Dashboard → **Workers & Pages → Create → Pages** → اربطي المستودع.
3. Build command: (لا شيء — الموقع HTML/CSS/JS ثابت). Output directory: `/`
4. بعد النشر تحصلين على رابط مثل `yourbooking.pages.dev`. حدّثي به قيمة
   `SITE_URL` في أسرار Supabase (الخطوة 3) حتى تكون الروابط داخل الإيميلات صحيحة.

## 5) اختبار سريع قبل الاستخدام الفعلي

- [ ] فتح الصفحة الرئيسية وتظهر القاعتان.
- [ ] عمل حجز تجريبي كامل ووصول إيميل التأكيد لكِ وللعميل.
- [ ] محاولة حجز نفس الوقت من نافذتين مختلفتين في نفس اللحظة — يجب أن ينجح واحد فقط.
- [ ] فتح رابط "إدارة الحجز" من الإيميل والتأكد من عمل التعديل والإلغاء.
- [ ] الدخول إلى `/admin/dashboard.html` والتأكد من ظهور الحجز، وتجربة "تصدير CSV".
- [ ] تجربة إغلاق وقت يدويًا من لوحة التحكم والتأكد أنه يظهر محجوزًا للعميل.

## ملاحظات وافتراضات اتخذتها

- **ساعات العمل الافتراضية للقاعتين:** 8:00 صباحًا – 10:00 مساءً، كل أيام
  الأسبوع (معدّلة في جدول `rooms`، عمودي `open_time`/`close_time`). عدّليها مباشرة
  من SQL Editor لو تحتاجين ساعات مختلفة؛ إضافة واجهة تعديلها من لوحة التحكم خطوة
  لاحقة سهلة إذا احتجتِها.
- **المنطقة الزمنية:** الموقع يعرض الأوقات بتوقيت جهاز المستخدم/المتصفح مباشرة؛
  بما أن العملاء والقاعات في نفس المدينة عادة هذا لا يسبب مشكلة، لكن لو كان هناك
  عملاء من مناطق زمنية مختلفة يحجزون، نحتاج تثبيت المنطقة الزمنية صراحة (Asia/Riyadh
  مثلًا) بدل الاعتماد على جهاز المستخدم.
- **النسخ الاحتياطي (Backup):** بيانات الحجوزات محفوظة في Supabase نفسها ومحمية
  بقيود قاعدة البيانات، وزر "تصدير CSV" في لوحة التحكم يعطيك نسخة كاملة وقت ما تريدين.
  Supabase أيضًا يوفر نسخًا احتياطية تلقائية يومية حتى في الخطة المجانية (Point-in-time
  حسب الخطة).
- **الحد الأقصى للمدة/الحجوزات المتكررة:** يمكن للعميل حجز أكثر من مرة في نفس اليوم
  طالما الأوقات متاحة، بلا حد أقصى لعدد الحجوزات — كما هو مطلوب.

## هيكل الملفات

```
index.html            الصفحة الرئيسية
booking.html           تدفق الحجز (4 خطوات)
confirmation.html      عرض/تعديل/إلغاء الحجز
admin/login.html       دخول الإدارة
admin/dashboard.html   لوحة التحكم
css/style.css          كل التنسيقات
js/                     منطق الواجهة (i18n, booking, admin, supabase-client)
assets/                الشعار، النمط، الخط
sql/schema.sql          قاعدة البيانات كاملة
supabase/functions/     دوال البريد الإلكتروني (Edge Functions)
```
