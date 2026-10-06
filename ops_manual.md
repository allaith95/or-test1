# دليل التشغيل والصيانة للبنية التحتية وقاعدة البيانات (Operations Manual)
## نظام ORCA Express Logistics — بنية PostgreSQL الموحدة

---

## 1. البنية العامة للنظام (Architecture Overview)

### 1.1 الجدول الموحد: `orca_entities`
- **الدور**: جدول الكيانات المركزي الموحد (Single Table Inheritance with JSONB).
- **الأعمدة**: `(collection VARCHAR(64), id VARCHAR(128), data JSONB, created_at TIMESTAMPTZ, updated_at TIMESTAMPTZ)`.
- **المفتاح الأساسي**: `(collection, id)`.
- **الفائدة**: 
  - مرونة تامة في التعديل بدون DDL Migration معقد لكل حقل.
  - دعم المزامنة المتوازية مع الذاكرة والـ IndexedDB للعمل دون انقطاع (Offline-First).
  - استخدام فهارس جزئية (Partial Indexes) على `(data->>'field') WHERE collection = '...'` لتحقيق سرعات استعلام فائقة (أقل من 1ms).

### 1.2 الجداول الـ 8 الأخرى وأدوارها
1. **`orca_entities`**: الجدول الرئيسي لجميع المجموعات التشغيلية.
2. **`orca_meta`**: الإعدادات العامة للنظام، الهوية البصرية، وأعلام الهجرة والـ Backfill.
3. **`sync_state`**: إدارة العلامة المائية للـ Delta Sync وتخزين آخر نقطة زمنية متزامنة (`last_sync`).
4. **`orca_audit_logs`**: سجل أحداث النظام التقنية وحركات المزامنة الشاملة.
5. **`branch_balance_snapshots`**: لقطات التدقيق اللحظية لأرصدة الفروع عند إغلاق الورديات اليومية (`shift_close`) أو التسويات المعتمدة لمنع التلاعب التاريخي.
6. **`financial_audit_trail`**: سجل التدقيق المالي التلقائي غير القابل للتعديل، يُسجل بواسطة المشغل `trg_financial_audit`.
7. **`parcel_events`**: سجل مسار الطرد الزمني والأحداث التشغيلية (Append-Only) لمراقبة دورة حياة الشحنات ومحطات الترانزيت.
8. **`inter_branch_obligations`**: جدول المرآة العلائقي للالتزامات المالية والمقاصة بين الفروع المحسوبة آلياً من تسليم الطرود.

### 1.3 الـ Views العلائقية الـ 17
توفر واجهات استعلام SQL قياسية دون الحاجة للتعامل مع مشغلات JSONB، ومحمية بالكامل بدوال `safe_numeric`, `safe_boolean`, `safe_timestamptz`:
1. `v_branches`: الفروع والمكاتب ونسب العمولات والأرصدة الافتتاحية.
2. `v_users`: المستخدمون، الأدوار الوظيفية، الصلاحيات، وحالة الحساب.
3. `v_parcels`: الطرود التشغيلية، مبالغ الـ COD، أجور الشحن، ومحطات الإرسال والاستقبال.
4. `v_vouchers`: سندات القبض والصرف الرسمية.
5. `v_expenses`: المصاريف التشغيلية والإدارية والضرائب وموافقات الصرف.
6. `v_transactions`: قيود الصناديق والمقبوضات والمدفوعات لجميع الصناديق.
7. `v_branch_live_balances`: ميزان المراجعة اللحظي لصناديق كل فرع (الخزينة الرئيسية، الماستر، الكاشير، الصادر، الوارد، المناديب).
8. `v_inter_branch_balances`: صافي المركز المالي التبادلي بين كل زوج من الفروع.
9. `v_parcel_timeline`: خط التتبع الزمني للشحنات وسرعات الانتقال.
10. `v_truck_manifests`: منافيستات شحن الشاحنات بين المدن وإحصائيات الحمولات.
11. `v_courier_manifests`: منافيستات تسليم المناديب ومبالغ التحصيل المطلوبة.
12. `v_shift_settlement_vouchers`: سندات إقفال وتسوية ورديات الكاشير.
13. `v_customers`: سجلات العملاء، أرقام الهواتف، والإنفاق التراكمي.
14. `v_employees`: الموظفون، الرواتب الأساسية، وتعيينات الفروع.
15. `v_payroll_records`: مسيرات الرواتب الشهرية والبدلات والاستقطاعات وصافي الصرف.
16. `v_vehicles`: أسطول الشاحنات والمركبات، الحمولات القصوى، والسائقين المكلفين.
17. `v_fixed_assets`: الأصول الثابتة، قيم الشراء، وعهد الموظفين.

### 1.4 المشغلات الأربعة (The 4 Triggers)
1. **`trg_financial_audit`**: مشغل التدقيق المالي الشامل على العمليات المالية.
2. **`trg_orca_entities_update`**: تحديث `updated_at = NOW()` تلقائياً قبل كل تعديل.
3. **`trg_sync_inter_branch_obligations`**: مزامنة الالتزامات المالية التبادلية لحظياً في جدول `inter_branch_obligations`.
4. **`trg_sync_parcel_event`**: تسجيل أي حدث طرد جديد فوراً في جدول `parcel_events`.

---

## 2. آلية المزامنة (Delta Sync & Replication Engine)

### 2.1 كيف تعمل المزامنة الجزئية (Delta Sync Watermark)
- تعتمد المزامنة على مقارنة ثنائية محكمة (Tuple Comparison):
  ```sql
  WHERE (updated_at > $1::timestamptz) OR (updated_at = $1::timestamptz AND id > $2)
  ORDER BY updated_at ASC, id ASC
  LIMIT $3;
  ```
- **الفائدة**: منع تخطي أي سجل تم تعديله في نفس الميلي ثانية وضمان عدم تكرار قراءة السجلات.
- يتم تخزين آخر نقطة متزامنة في جدول `sync_state` تحت المفتاح `last_sync`:
  ```json
  { "watermark": "2026-10-04T07:20:19.977Z", "lastId": "tx_99812", "timestamp": "2026-10-04T07:20:25Z" }
  ```

### 2.2 دورية إعادة المزامنة الكاملة (Full Resync)
- **في الوضع الطبيعي**: لا يتم عمل Full Resync لأن Delta Sync كافٍ ودقيق 100%.
- **الحالات الاستثنائية**:
  - عند اكتشاف فجوة مائية (Watermark Gap) تزيد عن 24 ساعة بسبب انقطاع ممتد.
  - عند استدعاء يدوي من واجهة الإدارة بواسطة المدير العام.

### 2.3 سلوك النظام عند انقطاع الاتصال (Fault Tolerance)
- في حال انقطاع اتصال PostgreSQL، يستمر التطبيق فوراً في العمل اعتماداً على الذاكرة والـ IndexedDB محلياً.
- يتم تجميع التعديلات في طابور محلي (Outbox Queue).
- بمجرد عودة الاتصال، يتم تنفيذ `pushChangesToPostgres` بنمط آمن عبر `ON CONFLICT (collection, id) DO UPDATE` لحل النزاعات بناءً على السجل الأحدث زمنياً (`updatedAt`).

---

## 3. التدقيق المالي الآلي (Financial Audit Trail)

### 3.1 ما يُسجّل في التدقيق المالي
- **عمليات INSERT و UPDATE**:
  - `transactions` (حركات الصناديق)
  - `vouchers` (سندات الصرف والقبض)
  - `shiftSettlementVouchers` (إقفال ورديات الكاشير)
  - `settlements` (تسويات الشركاء والعملاء)
  - `branches` (تعديل أرصدة الصناديق الافتتاحية)
  - `expenses` (صرف المصاريف)
  - `payrollRecords` (صرف الرواتب)
  - `courierIntakeSettlements` (تسليمات أموال المناديب)
  - `interBranchObligations` (المقاصة بين الفروع)
  - `fixedAssets` (شراء واستبعاد الأصول)
- **عمليات DELETE**:
  - تُسجل لجميع المجموعات المالية والتشغيلية المذكورة أعلاه إضافة إلى حركات حذف الطرود أو العملاء أو المستخدمين لأسباب أمنية.

### 3.2 ما لا يُسجّل كحركة مالية (عن قصد ومعمارية مدروسة)
- تحديثات مسار الطرود التشغيلية (`parcels UPDATE` من استلام وشحن ونقل وتسليم).
- تعديلات بيانات العملاء (`customers UPDATE`).
- تعديلات بيانات الموظفين والمستخدمين (`users UPDATE`).
- **المبرر**: منع تضخم جدول التدقيق المالي بعشرات آلاف السجلات اليومية غير المالية، وضمان أن `financial_audit_trail` مخصص حصرياً للمساءلة والمطابقة المحاسبية.

### 3.3 قراءة تقرير التدقيق المالي
- يتم الاستعلام المباشر عبر الواجهة أو عبر SQL:
  ```sql
  SELECT entity_collection, entity_id, event_type, branch_id, user_name, amount, currency, created_at
  FROM financial_audit_trail
  ORDER BY created_at DESC LIMIT 50;
  ```

---

## 4. النسخ الاحتياطي والاستعادة (Dump & Restore)

### 4.1 توقيت إنشاء النسخ الاحتياطية (Dump Schedule)
- **يومياً**: عند الساعة 02:00 صباحاً بتوقيت الخادم (cron job آلي).
- **شهرياً**: مع إقفال الحسابات والرواتب.
- **فورياً**: قبل أي عملية ترقية أو نشر إصدار جديد.

### 4.2 إجراء الاستعادة الرسمي (Restore Procedure)
1. إنشاء قاعدة بيانات جديدة أو تنظيف الحالية.
2. تنفيذ ملف الـ Dump:
   ```bash
   psql "$DATABASE_URL" -f orca_backup_YYYYMMDD.sql
   ```
3. التحقق من عدد الـ Views والجداول:
   ```sql
   SELECT COUNT(*) FROM pg_views WHERE schemaname='public' AND viewname LIKE 'v_%'; -- المتوقع: 17
   SELECT COUNT(*) FROM pg_trigger WHERE tgrelid = 'orca_entities'::regclass AND NOT tgisinternal; -- المتوقع: 4
   ```

---

## 5. خطة الطوارئ والتشخيص السريع (Emergency Procedures)

### 5.1 إيقاف الكتابات (Read-Only Emergency Mode)
في حال الاشتباه في اختراق أو خطأ بيانات كارثي، يمكن تحويل قاعدة البيانات للقراءة فقط فوراً:
```sql
ALTER DATABASE orca_express_db SET default_transaction_read_only = on;
```
أو سحب صلاحيات الكتابة مؤقتاً:
```sql
REVOKE INSERT, UPDATE, DELETE ON orca_entities FROM orca_app_user;
```

### 5.2 تشخيص اختلال مالي في صناديق فرع
1. تشغيل استعلام ميزان الفرع اللحظي:
   ```sql
   SELECT * FROM v_branch_live_balances WHERE branch_id = 'br_xxx';
   ```
2. مراجعة آخر حركات الصناديق في جدول التدقيق:
   ```sql
   SELECT * FROM financial_audit_trail 
   WHERE branch_id = 'br_xxx' 
   ORDER BY created_at DESC LIMIT 20;
   ```
3. مراجعة لقطات الإقفال المعتمدة:
   ```sql
   SELECT * FROM branch_balance_snapshots 
   WHERE branch_id = 'br_xxx' 
   ORDER BY created_at DESC LIMIT 5;
   ```
