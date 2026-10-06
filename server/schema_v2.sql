-- ==============================================================================
-- ORCA EXPRESS LOGISTICS - POSTGRESQL RELATIONAL SCHEMA V2 (SERVER-AUTHORITATIVE)
-- مخطط قاعدة البيانات العلائقية المحدث v2 - شركة أوركا إكسبريس للشحن والنقل
-- المعمارية الجديدة: Server-Authoritative Architecture مع مفاتيح أجنبية وفهارس سريعة
-- ==============================================================================

-- 1. دالة تحديث طابع الوقت التلقائي (Universal Timestamp Trigger Function)
CREATE OR REPLACE FUNCTION update_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ==============================================================================
-- 2. جدول الفروع ومراكز التشغيل (app_branches)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS app_branches (
  id VARCHAR(64) PRIMARY KEY,
  name VARCHAR(128) NOT NULL,
  code VARCHAR(16) UNIQUE NOT NULL,
  governorate VARCHAR(64) NOT NULL,
  type VARCHAR(32) NOT NULL DEFAULT 'sub_branch', -- 'main_hub', 'sub_branch'
  parent_hub_id VARCHAR(64) REFERENCES app_branches(id),
  box_syp_balance NUMERIC(18, 2) NOT NULL DEFAULT 0.00,
  box_usd_balance NUMERIC(18, 2) NOT NULL DEFAULT 0.00,
  opening_balance_syp NUMERIC(18, 2) NOT NULL DEFAULT 0.00,
  opening_balance_usd NUMERIC(18, 2) NOT NULL DEFAULT 0.00,
  phone VARCHAR(32),
  address TEXT,
  commission_rate_shipping NUMERIC(5, 2) DEFAULT 15.00,
  commission_rate_transfers NUMERIC(5, 2) DEFAULT 20.00,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- فهارس الفروع
CREATE INDEX IF NOT EXISTS idx_app_branches_code ON app_branches(code);
CREATE INDEX IF NOT EXISTS idx_app_branches_gov ON app_branches(governorate);
CREATE INDEX IF NOT EXISTS idx_app_branches_parent ON app_branches(parent_hub_id);
CREATE INDEX IF NOT EXISTS idx_app_branches_active ON app_branches(is_active);

-- محفز تحديث الوقت
DROP TRIGGER IF EXISTS trg_branches_updated_at ON app_branches;
CREATE TRIGGER trg_branches_updated_at 
  BEFORE UPDATE ON app_branches 
  FOR EACH ROW EXECUTE FUNCTION update_timestamp();

-- ==============================================================================
-- 3. جدول الطرود العلائقي فائق السرعة (app_parcels)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS app_parcels (
  id VARCHAR(128) PRIMARY KEY,
  tracking_number VARCHAR(64) UNIQUE NOT NULL,
  paper_receipt_number VARCHAR(64),
  origin_branch_id VARCHAR(64) NOT NULL REFERENCES app_branches(id),
  destination_hub_id VARCHAR(64) NOT NULL REFERENCES app_branches(id),
  current_location_id VARCHAR(64) REFERENCES app_branches(id),
  handling_status VARCHAR(64) NOT NULL DEFAULT 'received_at_hub',
  payment_type VARCHAR(32) NOT NULL DEFAULT 'prepaid', -- 'prepaid', 'cod', 'on_delivery'
  shipping_cost NUMERIC(18, 2) NOT NULL DEFAULT 0.00,
  currency VARCHAR(16) NOT NULL DEFAULT 'SYP',
  cod_amount NUMERIC(18, 2) NOT NULL DEFAULT 0.00,
  cod_currency VARCHAR(16) NOT NULL DEFAULT 'SYP',
  cod_paid_to_sender BOOLEAN NOT NULL DEFAULT FALSE,
  cod_payout_voucher_id VARCHAR(128),
  cod_payout_at TIMESTAMPTZ,
  cod_payout_by_user_id VARCHAR(64),
  package_type VARCHAR(64) NOT NULL,
  weight_kg NUMERIC(10, 3) NOT NULL DEFAULT 0.000,
  pieces_count INTEGER DEFAULT 1,
  content_description TEXT,
  sender_data JSONB NOT NULL,
  receiver_data JSONB NOT NULL,
  truck_manifest_id VARCHAR(128),
  courier_manifest_id VARCHAR(128),
  delivered_at TIMESTAMPTZ,
  delivered_by_user_id VARCHAR(64),
  returned_at TIMESTAMPTZ,
  return_reason TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- فهارس الطرود المسرعة
CREATE INDEX IF NOT EXISTS idx_app_parcels_tracking ON app_parcels(tracking_number);
CREATE INDEX IF NOT EXISTS idx_app_parcels_status ON app_parcels(handling_status);
CREATE INDEX IF NOT EXISTS idx_app_parcels_origin ON app_parcels(origin_branch_id);
CREATE INDEX IF NOT EXISTS idx_app_parcels_dest ON app_parcels(destination_hub_id);
CREATE INDEX IF NOT EXISTS idx_app_parcels_location ON app_parcels(current_location_id);
CREATE INDEX IF NOT EXISTS idx_app_parcels_created ON app_parcels(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_app_parcels_truck_manifest ON app_parcels(truck_manifest_id);
CREATE INDEX IF NOT EXISTS idx_app_parcels_courier_manifest ON app_parcels(courier_manifest_id);
CREATE INDEX IF NOT EXISTS idx_app_parcels_sender_phone ON app_parcels ((sender_data->>'phone'));
CREATE INDEX IF NOT EXISTS idx_app_parcels_receiver_phone ON app_parcels ((receiver_data->>'phone'));
CREATE INDEX IF NOT EXISTS idx_app_parcels_sender_name ON app_parcels ((sender_data->>'name'));

-- محفز تحديث الوقت
DROP TRIGGER IF EXISTS trg_parcels_updated_at ON app_parcels;
CREATE TRIGGER trg_parcels_updated_at 
  BEFORE UPDATE ON app_parcels 
  FOR EACH ROW EXECUTE FUNCTION update_timestamp();

-- قيود النزاهة المالية
ALTER TABLE app_parcels 
  DROP CONSTRAINT IF EXISTS chk_shipping_cost,
  ADD CONSTRAINT chk_shipping_cost CHECK (shipping_cost >= 0);

ALTER TABLE app_parcels 
  DROP CONSTRAINT IF EXISTS chk_cod_amount,
  ADD CONSTRAINT chk_cod_amount CHECK (cod_amount >= 0);

ALTER TABLE app_parcels 
  DROP CONSTRAINT IF EXISTS chk_weight,
  ADD CONSTRAINT chk_weight CHECK (weight_kg >= 0);

-- ==============================================================================
-- 4. جدول صور الهويات والتواقيع المعزول (app_parcel_photos)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS app_parcel_photos (
  parcel_id VARCHAR(128) NOT NULL REFERENCES app_parcels(id) ON DELETE CASCADE,
  side VARCHAR(32) NOT NULL, -- 'sender_front', 'sender_back', 'receiver_signature', 'cargo'
  base64_data TEXT NOT NULL,
  mime_type VARCHAR(64) NOT NULL DEFAULT 'image/jpeg',
  file_size_bytes INTEGER,
  uploaded_by_user_id VARCHAR(64),
  uploaded_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (parcel_id, side)
);

CREATE INDEX IF NOT EXISTS idx_app_photos_parcel ON app_parcel_photos(parcel_id);

-- ==============================================================================
-- 5. جدول معاملات الصندوق والمحاسبة الذرية (app_transactions)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS app_transactions (
  id VARCHAR(128) PRIMARY KEY,
  branch_id VARCHAR(64) NOT NULL REFERENCES app_branches(id),
  user_id VARCHAR(64) NOT NULL,
  type VARCHAR(32) NOT NULL, -- 'income', 'expense', 'cod_collection', 'cod_payout', 'transfer_in', 'transfer_out'
  category VARCHAR(64) NOT NULL,
  amount NUMERIC(18, 2) NOT NULL,
  currency VARCHAR(16) NOT NULL DEFAULT 'SYP',
  balance_after_syp NUMERIC(18, 2) NOT NULL DEFAULT 0.00,
  balance_after_usd NUMERIC(18, 2) NOT NULL DEFAULT 0.00,
  related_parcel_id VARCHAR(128) REFERENCES app_parcels(id),
  related_voucher_id VARCHAR(128),
  reference_id VARCHAR(128),
  description TEXT NOT NULL,
  cashbox_scope VARCHAR(32),
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- فهارس الصندوق السريعة
CREATE INDEX IF NOT EXISTS idx_app_tx_branch_created ON app_transactions(branch_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_app_tx_parcel ON app_transactions(related_parcel_id);
CREATE INDEX IF NOT EXISTS idx_app_tx_type ON app_transactions(type);
CREATE INDEX IF NOT EXISTS idx_app_tx_created ON app_transactions(created_at DESC);

-- قيد المبلغ الإيجابي
ALTER TABLE app_transactions 
  DROP CONSTRAINT IF EXISTS chk_tx_amount,
  ADD CONSTRAINT chk_tx_amount CHECK (amount > 0);

-- ==============================================================================
-- 6. جدول مانافيست الشاحنات وترحيل المحافظات (app_truck_manifests)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS app_truck_manifests (
  id VARCHAR(128) PRIMARY KEY,
  manifest_number VARCHAR(64) UNIQUE NOT NULL,
  origin_hub_id VARCHAR(64) NOT NULL REFERENCES app_branches(id),
  destination_hub_id VARCHAR(64) NOT NULL REFERENCES app_branches(id),
  driver_name VARCHAR(128) NOT NULL,
  driver_phone VARCHAR(32),
  truck_plate_number VARCHAR(64) NOT NULL,
  status VARCHAR(32) NOT NULL DEFAULT 'preparing', -- 'preparing', 'dispatched', 'arrived_unloading', 'received'
  parcel_ids TEXT[] NOT NULL DEFAULT '{}',
  shortage_parcel_ids TEXT[] NOT NULL DEFAULT '{}',
  surplus_parcel_ids TEXT[] NOT NULL DEFAULT '{}',
  parcels_count INTEGER NOT NULL DEFAULT 0,
  dispatched_at TIMESTAMPTZ,
  arrived_at TIMESTAMPTZ,
  received_at TIMESTAMPTZ,
  created_by_user_id VARCHAR(64),
  received_by_user_id VARCHAR(64),
  notes TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- فهارس مانافيست الشاحنات
CREATE INDEX IF NOT EXISTS idx_app_manifests_status ON app_truck_manifests(status);
CREATE INDEX IF NOT EXISTS idx_app_manifests_origin ON app_truck_manifests(origin_hub_id);
CREATE INDEX IF NOT EXISTS idx_app_manifests_dest ON app_truck_manifests(destination_hub_id);
CREATE INDEX IF NOT EXISTS idx_app_manifests_number ON app_truck_manifests(manifest_number);

-- محفز تحديث الوقت
DROP TRIGGER IF EXISTS trg_manifests_updated_at ON app_truck_manifests;
CREATE TRIGGER trg_manifests_updated_at 
  BEFORE UPDATE ON app_truck_manifests 
  FOR EACH ROW EXECUTE FUNCTION update_timestamp();

-- ==============================================================================
-- 7. جدول مانافيست التوزيع المحلي للموزعين (app_courier_manifests)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS app_courier_manifests (
  id VARCHAR(128) PRIMARY KEY,
  manifest_number VARCHAR(64) UNIQUE NOT NULL,
  courier_id VARCHAR(64) NOT NULL,
  courier_name VARCHAR(128) NOT NULL,
  branch_id VARCHAR(64) NOT NULL REFERENCES app_branches(id),
  status VARCHAR(32) NOT NULL DEFAULT 'assigned', -- 'assigned', 'out_for_delivery', 'settled'
  parcel_ids TEXT[] NOT NULL DEFAULT '{}',
  delivered_parcel_ids TEXT[] NOT NULL DEFAULT '{}',
  returned_parcel_ids TEXT[] NOT NULL DEFAULT '{}',
  parcels_count INTEGER NOT NULL DEFAULT 0,
  total_collected_syp NUMERIC(18, 2) NOT NULL DEFAULT 0.00,
  total_collected_usd NUMERIC(18, 2) NOT NULL DEFAULT 0.00,
  assigned_at TIMESTAMPTZ,
  settled_at TIMESTAMPTZ,
  settled_by_user_id VARCHAR(64),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- فهارس مانافيست الموزعين
CREATE INDEX IF NOT EXISTS idx_app_courier_manifests_status ON app_courier_manifests(status);
CREATE INDEX IF NOT EXISTS idx_app_courier_manifests_courier ON app_courier_manifests(courier_id, assigned_at DESC);

-- محفز تحديث الوقت
DROP TRIGGER IF EXISTS trg_courier_manifests_updated_at ON app_courier_manifests;
CREATE TRIGGER trg_courier_manifests_updated_at 
  BEFORE UPDATE ON app_courier_manifests 
  FOR EACH ROW EXECUTE FUNCTION update_timestamp();

-- ==============================================================================
-- 8. جدول دليل العملاء (app_customers)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS app_customers (
  id VARCHAR(128) PRIMARY KEY,
  code VARCHAR(64),
  full_name VARCHAR(128) NOT NULL,
  phone VARCHAR(32) NOT NULL,
  secondary_phone VARCHAR(32),
  national_id VARCHAR(64),
  city VARCHAR(64),
  address TEXT,
  customer_type VARCHAR(32) DEFAULT 'individual', -- 'individual', 'merchant', 'corporate'
  is_verified BOOLEAN NOT NULL DEFAULT FALSE,
  is_blacklisted BOOLEAN NOT NULL DEFAULT FALSE,
  total_shipments_sent INTEGER NOT NULL DEFAULT 0,
  total_shipments_received INTEGER NOT NULL DEFAULT 0,
  total_spent_syp NUMERIC(18, 2) NOT NULL DEFAULT 0.00,
  total_spent_usd NUMERIC(18, 2) NOT NULL DEFAULT 0.00,
  portal_access_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- فهارس دليل العملاء
CREATE INDEX IF NOT EXISTS idx_app_customers_phone ON app_customers(phone);
CREATE INDEX IF NOT EXISTS idx_app_customers_name ON app_customers(full_name);
CREATE INDEX IF NOT EXISTS idx_app_customers_national ON app_customers(national_id);

-- محفز تحديث الوقت
DROP TRIGGER IF EXISTS trg_customers_updated_at ON app_customers;
CREATE TRIGGER trg_customers_updated_at 
  BEFORE UPDATE ON app_customers 
  FOR EACH ROW EXECUTE FUNCTION update_timestamp();

-- ==============================================================================
-- 9. جدول المستخدمين والموظفين والصلاحيات (app_users)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS app_users (
  id VARCHAR(64) PRIMARY KEY,
  username VARCHAR(64) UNIQUE NOT NULL,
  full_name VARCHAR(128) NOT NULL,
  password_hash VARCHAR(255),
  role VARCHAR(32) NOT NULL, -- 'super_admin', 'branch_manager', 'cashier', 'intake_staff', 'courier'
  branch_id VARCHAR(64) REFERENCES app_branches(id),
  phone VARCHAR(32),
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  permissions JSONB DEFAULT '{}'::jsonb,
  last_login_at TIMESTAMPTZ,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- فهارس المستخدمين
CREATE INDEX IF NOT EXISTS idx_app_users_username ON app_users(username);
CREATE INDEX IF NOT EXISTS idx_app_users_branch ON app_users(branch_id);
CREATE INDEX IF NOT EXISTS idx_app_users_role ON app_users(role);
CREATE INDEX IF NOT EXISTS idx_app_users_active ON app_users(is_active);

-- محفز تحديث الوقت
DROP TRIGGER IF EXISTS trg_users_updated_at ON app_users;
CREATE TRIGGER trg_users_updated_at 
  BEFORE UPDATE ON app_users 
  FOR EACH ROW EXECUTE FUNCTION update_timestamp();

-- ==============================================================================
-- 10. جدول تخزين ومزامنة صور الهويات المركزية (app_photos)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS app_photos (
  key VARCHAR(255) PRIMARY KEY,
  base64_data TEXT NOT NULL,
  mime_type VARCHAR(64) DEFAULT 'image/jpeg',
  size_bytes INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_app_photos_created 
  ON app_photos(created_at DESC);

