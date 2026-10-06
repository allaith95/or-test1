-- =========================================================================
-- ORCA EXPRESS LOGISTICS - DAILY MONITORING & HEALTH CHECKLIST
-- 5 Essential Health Check Queries for PostgreSQL & Financial Integrity
-- =========================================================================

-- -------------------------------------------------------------------------
-- Q1: صحة التدقيق المالي الآلي (Financial Audit Trail Integrity)
-- المتوقع: bad = 0 (لا توجد مبالغ NULL مطلقاً)، total > 0، latest أقل من 5 دقائق
-- -------------------------------------------------------------------------
SELECT 
  COUNT(*) FILTER (WHERE amount IS NULL) AS bad_records,
  COUNT(*) AS total_records_last_hour,
  MAX(created_at) AS latest_audit_timestamp,
  NOW() - MAX(created_at) AS time_since_last_financial_event
FROM financial_audit_trail
WHERE created_at > NOW() - INTERVAL '1 hour';

-- -------------------------------------------------------------------------
-- Q2: تطابق جداول المرايا العلائقية مع جدول الكيانات الموحد (Mirror Tables Parity)
-- المتوقع: main = mirror تماماً (الفرق = 0)
-- -------------------------------------------------------------------------
SELECT 
  (SELECT COUNT(*) FROM orca_entities WHERE collection = 'interBranchObligations') AS main_obligations,
  (SELECT COUNT(*) FROM inter_branch_obligations) AS mirror_obligations,
  ((SELECT COUNT(*) FROM orca_entities WHERE collection = 'interBranchObligations') - 
   (SELECT COUNT(*) FROM inter_branch_obligations)) AS obligations_diff,
  (SELECT COUNT(*) FROM orca_entities WHERE collection = 'parcelEvents') AS main_events,
  (SELECT COUNT(*) FROM parcel_events) AS mirror_events,
  ((SELECT COUNT(*) FROM orca_entities WHERE collection = 'parcelEvents') - 
   (SELECT COUNT(*) FROM parcel_events)) AS events_diff;

-- -------------------------------------------------------------------------
-- Q3: حداثة وصحة العلامة المائية للمزامنة (Delta Sync Watermark Freshness)
-- المتوقع: age أقل من 5 دقائق أثناء ساعات العمل النشطة
-- -------------------------------------------------------------------------
SELECT 
  key,
  value->>'watermark' AS last_watermark_timestamp,
  value->>'lastId' AS last_processed_entity_id,
  updated_at AS sync_state_updated_at,
  NOW() - updated_at AS watermark_age
FROM sync_state 
WHERE key = 'last_sync';

-- -------------------------------------------------------------------------
-- Q4: أرصدة الصناديق الحية لأكبر 5 فروع (Branch Live Balances Verification)
-- المتوقع: أرقام متوازنة ومطابقة لميزان المراجعة اليومي
-- -------------------------------------------------------------------------
SELECT 
  branch_code,
  branch_name,
  live_vault_syp,
  live_vault_usd,
  master_box_syp,
  cashier_box_syp,
  courier_box_syp
FROM v_branch_live_balances
ORDER BY live_vault_syp DESC 
LIMIT 5;

-- -------------------------------------------------------------------------
-- Q5: إجمالي الطرود وحالة التسليم الفعلية (Operational Parcels Health)
-- المتوقع: تطابق إجمالي الطرود والمسلّم مع شاشات التقارير التشغيلية
-- -------------------------------------------------------------------------
SELECT 
  (SELECT COUNT(*) FROM orca_entities WHERE collection = 'parcels') AS total_parcels,
  (SELECT COUNT(*) FROM orca_entities WHERE collection = 'parcels' 
   AND (data->>'handlingStatus' = 'delivered' OR data->>'status' = 'delivered')) AS delivered_parcels,
  (SELECT COUNT(*) FROM orca_entities WHERE collection = 'parcels' 
   AND data->>'handlingStatus' IN ('received_at_hub', 'in_transit', 'with_courier')) AS active_in_transit_parcels;
