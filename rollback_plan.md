# خطة التراجع وخطة النشر التدريجي (Rollback & Deployment Plan)
## نظام ORCA Express Logistics

---

## 1. الإجراءات المسبقة قبل كل ترقية أو نشر (Pre-Deployment Checklist)

1. **النسخ الاحتياطي الكامل لقاعدة البيانات**:
   ```bash
   pg_dump "$DATABASE_URL" --format=c --file="backup_pre_deploy_$(date +%Y%m%d_%H%M%S).dump"
   pg_dump "$DATABASE_URL" --format=p --file="backup_pre_deploy_$(date +%Y%m%d_%H%M%S).sql"
   ```
2. **تسجيل بصمة التحقق (SHA-256 Checksum)**:
   ```bash
   sha256sum backup_pre_deploy_*.sql > backup_checksums.txt
   ```
3. **التحقق من قابلية الاستعادة (Dry-Run Restore)**:
   - استيراد النسخة إلى قاعدة بيانات تجريبية (Staging/Sandbox) والتحقق من:
     ```sql
     SELECT COUNT(*) FROM orca_entities;
     SELECT COUNT(*) FROM pg_views WHERE schemaname='public' AND viewname LIKE 'v_%'; -- 17
     SELECT COUNT(*) FROM pg_trigger WHERE tgrelid = 'orca_entities'::regclass AND NOT tgisinternal; -- 4
     ```

---

## 2. خطوات التراجع السريع عند الطوارئ (Rollback Execution Steps)

في حال حدوث عطل غير متوقع أو استثناءات في الـ Triggers أثناء الترقية:

### الخطوة 1: إيقاف خادم التطبيق وتوجيه المستخدمين لصفحة الصيانة
```bash
# إيقاف عملية السيرفر في بيئة الإنتاج
systemctl stop orca-express-server
# أو تحويل حركة المرور إلى صفحة الصيانة في Nginx / Cloud Load Balancer
```

### الخطوة 2: استعادة قاعدة البيانات من النسخة المعتمدة
```bash
# تنظيف واستعادة من النسخة المتطابقة
dropdb -h $PGHOST -U $PGUSER orca_express_db
createdb -h $PGHOST -U $PGUSER orca_express_db
psql "$DATABASE_URL" -f backup_pre_deploy_YYYYMMDD_HHMMSS.sql
```

### الخطوة 3: التحقق الفوري من سلامة الاستعادة
```sql
-- 1. التأكد من الـ Views الـ 17
SELECT COUNT(*) FROM pg_views WHERE schemaname='public' AND viewname LIKE 'v_%';

-- 2. التأكد من الـ Triggers الأربعة
SELECT tgname FROM pg_trigger WHERE tgrelid = 'orca_entities'::regclass AND NOT tgisinternal;

-- 3. تشغيل استعلام ميزان المراجعة اللحظي
SELECT * FROM v_branch_live_balances LIMIT 5;
```

### الخطوة 4: تشغيل السيرفر السابق (Git Rollback)
```bash
git checkout <PREVIOUS_STABLE_COMMIT_TAG>
npm run build
systemctl start orca-express-server
```

### الخطوة 5: إبلاغ المستخدمين وفريق العمليات
- فتح النظام للمستخدمين وإرسال إشعار فني باكتمال الاستعادة واستقرار الخدمات.

---

## 3. إجراءات ما بعد التراجع (Post-Rollback Protocol)

1. **تسجيل الحادثة في `orca_audit_logs`**:
   ```sql
   INSERT INTO orca_audit_logs (action, collection, entity_id, user_name, payload)
   VALUES ('ROLLBACK_EXECUTED', 'system', 'deploy_failure', 'release_engineer', 
           jsonb_build_object('timestamp', NOW(), 'reason', 'Production anomaly detected'));
   ```
2. **عزل سجلات الخطأ وتحليل السبب الجذري (Root Cause Analysis - RCA)**.
3. **عقد اجتماع مراجعة فنية مع الفريق قبل أي محاولة نشر جديدة**.

---

## 4. خطة النشر التدريجي لـ 30 يوماً (30-Day Staged Rollout Strategy)

### الأسبوع 1: الإطلاق التجريبي الداخلي (Internal Sandbox Team)
- **النطاق**: فريق داخلي مخصص (3-5 مستخدمين).
- **الفروع المشمولة**: فرع واحد تجريبي (المقر الرئيسي - دمشق).
- **حجم العمليات**: 50 طرداً يومياً كحد أقصى.
- **إجراءات المراقبة**: تشغيل استعلامات `monitoring_queries.sql` (Q1 إلى Q5) كل ساعتين.
- **الاجتماعات**: اجتماع يومي لتقييم سرعة الاستجابة ومطابقة الصناديق.

### الأسبوع 2: التوسيع الداخلي (Internal Expansion)
- **النطاق**: فرعان تشغيليان رئيسيان.
- **حجم العمليات**: 200 طرد يومياً.
- **إجراءات المراقبة**: تشغيل استعلامات Q1 إلى Q5 3 مرات يومياً والتحقق من عدم وجود أي فجوات مائية في `sync_state`.
- **الاجتماعات**: اجتماع كل يومين.

### الأسبوع 3 و 4: الإنتاج الجزئي المحكوم (Controlled Partial Production)
- **النطاق**: 5 فروع رئيسية ومكاتب فرعية.
- **حجم العمليات**: 1,000 طرد يومياً.
- **إجراءات المراقبة**: أتمتة مراقبة Q1-Q5 كل ساعة وتسجيل أي استثناءات، مراجعة دورية لجدول `inter_branch_obligations`.
- **الاجتماعات**: اجتماع أسبوعي وتوثيق كافة الملاحظات.

### الشهر الثاني فما بعد: الإنتاج الكامل (Full Production Scale)
- فتح النظام لكافة شبكة الفروع والمكاتب والمناديب في كافة المحافظات.
- تفعيل النسخ الاحتياطي التلقائي اليومي والشهري الدائم.
