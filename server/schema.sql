-- ==============================================================================
-- ORCA EXPRESS LOGISTICS - POSTGRESQL PRODUCTION & LOCAL DATABASE SCHEMA
-- نظام إدارة الشحن البري والطرود والخدمات اللوجستية - شركة أوركا إكسبريس
-- ==============================================================================

-- 1. Main Unified Entity Table for Orca Logistics
-- جدول الكيانات اللوجستية الموحد عالي الأداء مع دعم JSONB
CREATE TABLE IF NOT EXISTS orca_entities (
  collection VARCHAR(64) NOT NULL,
  id VARCHAR(128) NOT NULL,
  data JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (collection, id)
);

-- 2. Metadata and Settings Table
-- جدول الإعدادات العامة وبيانات الترويسة والطباعة
CREATE TABLE IF NOT EXISTS orca_meta (
  key VARCHAR(128) PRIMARY KEY,
  value JSONB NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. Sync Audit Logs Table
-- جدول سجلات التدقيق والمزامنة ومراقبة حركة الطرود وتفريغ الشاحنات
CREATE TABLE IF NOT EXISTS orca_audit_logs (
  id BIGSERIAL PRIMARY KEY,
  action VARCHAR(32) NOT NULL,
  collection VARCHAR(64),
  entity_id VARCHAR(128),
  user_name VARCHAR(128),
  branch_id VARCHAR(64),
  timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  payload JSONB
);

-- 4. Financial Audit Trail Table
-- التدقيق المالي الآلي على مستوى محرك قاعدة البيانات
CREATE TABLE IF NOT EXISTS financial_audit_trail (
  id BIGSERIAL PRIMARY KEY,
  entity_collection VARCHAR(64) NOT NULL,
  entity_id VARCHAR(128) NOT NULL,
  event_type VARCHAR(32) NOT NULL,
  branch_id VARCHAR(64),
  user_name VARCHAR(128),
  amount NUMERIC(18, 2),
  currency VARCHAR(16),
  old_balance_syp NUMERIC(18, 2),
  new_balance_syp NUMERIC(18, 2),
  old_balance_usd NUMERIC(18, 2),
  new_balance_usd NUMERIC(18, 2),
  details JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ==============================================================================
-- INDEXES FOR MAXIMUM QUERY SPEED & PERFORMANCE (فهارس الأداء العالي)
-- ==============================================================================

-- Collection and timestamp indexes
CREATE INDEX IF NOT EXISTS idx_orca_entities_col ON orca_entities(collection);
CREATE INDEX IF NOT EXISTS idx_orca_entities_updated ON orca_entities(updated_at);
CREATE INDEX IF NOT EXISTS idx_orca_entities_composite ON orca_entities(collection, updated_at DESC);

-- Parcel-specific accelerated queries (بحث الطرود السريع والتتبع)
CREATE INDEX IF NOT EXISTS idx_orca_parcels_tracking ON orca_entities ((data->>'trackingNumber')) WHERE collection = 'parcels';
CREATE INDEX IF NOT EXISTS idx_orca_parcels_status ON orca_entities ((data->>'handlingStatus')) WHERE collection = 'parcels';
CREATE INDEX IF NOT EXISTS idx_orca_parcels_location ON orca_entities ((data->>'currentLocationBranchId')) WHERE collection = 'parcels';
CREATE INDEX IF NOT EXISTS idx_orca_parcels_origin ON orca_entities ((data->>'originHubId')) WHERE collection = 'parcels';
CREATE INDEX IF NOT EXISTS idx_orca_parcels_dest ON orca_entities ((data->>'destinationHubId')) WHERE collection = 'parcels';
CREATE INDEX IF NOT EXISTS idx_orca_parcels_manifest ON orca_entities ((data->>'truckManifestId')) WHERE collection = 'parcels';
CREATE INDEX IF NOT EXISTS idx_orca_parcels_receipt ON orca_entities ((data->>'paperReceiptNumber')) WHERE collection = 'parcels';

-- Manifest-specific queries (المنافيستات وتفريغ الشحنات)
CREATE INDEX IF NOT EXISTS idx_orca_manifests_number ON orca_entities ((data->>'manifestNumber')) WHERE collection = 'truckManifests';
CREATE INDEX IF NOT EXISTS idx_orca_manifests_status ON orca_entities ((data->>'status')) WHERE collection = 'truckManifests';
CREATE INDEX IF NOT EXISTS idx_orca_manifests_dest ON orca_entities ((data->>'destinationHubId')) WHERE collection = 'truckManifests';
CREATE INDEX IF NOT EXISTS idx_orca_courier_manifests_num ON orca_entities ((data->>'manifestNumber')) WHERE collection = 'courierManifests';

-- Customer searches (دليل العملاء والبحث السريع بالهاتف أو الهوية)
CREATE INDEX IF NOT EXISTS idx_orca_customers_phone ON orca_entities ((data->>'phone')) WHERE collection = 'customers';
CREATE INDEX IF NOT EXISTS idx_orca_customers_national ON orca_entities ((data->>'nationalId')) WHERE collection = 'customers';
CREATE INDEX IF NOT EXISTS idx_orca_customers_name ON orca_entities ((data->>'fullName')) WHERE collection = 'customers';

-- Branch & User Role Indexes (الفروع والمستخدمين)
CREATE INDEX IF NOT EXISTS idx_orca_branches_code ON orca_entities ((data->>'code')) WHERE collection = 'branches';
CREATE INDEX IF NOT EXISTS idx_orca_branches_type ON orca_entities ((data->>'type')) WHERE collection = 'branches';
CREATE INDEX IF NOT EXISTS idx_orca_branches_parent ON orca_entities ((data->>'parentHubId')) WHERE collection = 'branches';
CREATE INDEX IF NOT EXISTS idx_orca_branches_gov ON orca_entities ((data->>'governorate')) WHERE collection = 'branches';
CREATE INDEX IF NOT EXISTS idx_orca_users_username ON orca_entities ((data->>'username')) WHERE collection = 'users';
CREATE INDEX IF NOT EXISTS idx_orca_users_branch ON orca_entities ((data->>'branchId')) WHERE collection = 'users';
CREATE INDEX IF NOT EXISTS idx_orca_users_role ON orca_entities ((data->>'role')) WHERE collection = 'users';
CREATE INDEX IF NOT EXISTS idx_orca_users_active ON orca_entities (((data->>'isActive')::boolean)) WHERE collection = 'users';

-- Financial & Vouchers Indexes (السندات والمقاصة والصناديق والمصاريف)
CREATE INDEX IF NOT EXISTS idx_orca_tx_branch ON orca_entities ((data->>'branchId')) WHERE collection = 'transactions';
CREATE INDEX IF NOT EXISTS idx_orca_vouchers_branch ON orca_entities ((data->>'branchId')) WHERE collection = 'vouchers';
CREATE INDEX IF NOT EXISTS idx_orca_vouchers_type ON orca_entities ((data->>'type')) WHERE collection = 'vouchers';
CREATE INDEX IF NOT EXISTS idx_orca_shift_vouchers_branch ON orca_entities ((data->>'branchId')) WHERE collection = 'shiftSettlementVouchers';
CREATE INDEX IF NOT EXISTS idx_orca_courier_intake_branch ON orca_entities ((data->>'branchId')) WHERE collection = 'courierIntakeSettlements';
CREATE INDEX IF NOT EXISTS idx_orca_expenses_branch ON orca_entities ((data->>'branchId')) WHERE collection = 'expenses';
CREATE INDEX IF NOT EXISTS idx_orca_expenses_cat ON orca_entities ((data->>'categoryId')) WHERE collection = 'expenses';
CREATE INDEX IF NOT EXISTS idx_orca_expenses_status ON orca_entities ((data->>'status')) WHERE collection = 'expenses';
CREATE INDEX IF NOT EXISTS idx_orca_expenses_num ON orca_entities ((data->>'expenseNumber')) WHERE collection = 'expenses';

-- Fleet & HR Indexes (المركبات والموظفين والرواتب والأصول)
CREATE INDEX IF NOT EXISTS idx_orca_vehicles_plate ON orca_entities ((data->>'plateNumber')) WHERE collection = 'vehicles';
CREATE INDEX IF NOT EXISTS idx_orca_employees_nid ON orca_entities ((data->>'nationalId')) WHERE collection = 'employees';
CREATE INDEX IF NOT EXISTS idx_orca_employees_branch ON orca_entities ((data->>'branchId')) WHERE collection = 'employees';
CREATE INDEX IF NOT EXISTS idx_orca_payroll_month ON orca_entities ((data->>'month')) WHERE collection = 'payrollRecords';
CREATE INDEX IF NOT EXISTS idx_orca_fixed_assets_code ON orca_entities ((COALESCE(data->>'assetCode', data->>'assetTag'))) WHERE collection = 'fixedAssets';

-- Financial audit logs index
CREATE INDEX IF NOT EXISTS idx_fin_audit_time ON financial_audit_trail(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_fin_audit_branch ON financial_audit_trail(branch_id);
CREATE INDEX IF NOT EXISTS idx_fin_audit_col ON financial_audit_trail(entity_collection, entity_id);

-- ==============================================
-- AUTOMATIC FINANCIAL AUDIT TRIGGER
-- ==============================================
CREATE OR REPLACE FUNCTION audit_financial_changes()
RETURNS TRIGGER AS $$
BEGIN
  IF (TG_OP = 'INSERT' OR TG_OP = 'UPDATE') AND NEW.collection IN ('transactions', 'vouchers', 'shiftSettlementVouchers', 'settlements', 'branches', 'expenses', 'payrollRecords', 'courierIntakeSettlements') THEN
    INSERT INTO financial_audit_trail (
      entity_collection,
      entity_id,
      event_type,
      branch_id,
      user_name,
      amount,
      currency,
      old_balance_syp,
      new_balance_syp,
      old_balance_usd,
      new_balance_usd,
      details,
      created_at
    ) VALUES (
      NEW.collection,
      NEW.id,
      TG_OP,
      COALESCE(NEW.data->>'branchId', NEW.data->>'id'),
      COALESCE(NEW.data->>'createdByName', NEW.data->>'disbursedByName', NEW.data->>'approvedByName', NEW.data->>'performedByUserName', NEW.data->>'userName', 'system'),
      COALESCE((NEW.data->>'amount')::numeric, (NEW.data->>'sypAmount')::numeric, (NEW.data->>'totalCollectedSyp')::numeric, (NEW.data->>'netPayable')::numeric, 0),
      COALESCE(NEW.data->>'currency', 'SYP'),
      CASE WHEN TG_OP = 'UPDATE' THEN (OLD.data->>'boxSypBalance')::numeric ELSE NULL END,
      (NEW.data->>'boxSypBalance')::numeric,
      CASE WHEN TG_OP = 'UPDATE' THEN (OLD.data->>'boxUsdBalance')::numeric ELSE NULL END,
      (NEW.data->>'boxUsdBalance')::numeric,
      jsonb_build_object(
        'timestamp', NOW(),
        'newData', NEW.data,
        'oldData', CASE WHEN TG_OP = 'UPDATE' THEN OLD.data ELSE NULL END
      ),
      NOW()
    );
  ELSIF (TG_OP = 'DELETE') AND OLD.collection IN ('transactions', 'vouchers', 'shiftSettlementVouchers', 'settlements', 'branches', 'expenses', 'payrollRecords', 'courierIntakeSettlements') THEN
    INSERT INTO financial_audit_trail (
      entity_collection,
      entity_id,
      event_type,
      branch_id,
      user_name,
      details,
      created_at
    ) VALUES (
      OLD.collection,
      OLD.id,
      'DELETE',
      COALESCE(OLD.data->>'branchId', OLD.data->>'id'),
      'system',
      jsonb_build_object('deletedData', OLD.data),
      NOW()
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_financial_audit ON orca_entities;
CREATE TRIGGER trg_financial_audit
AFTER INSERT OR UPDATE OR DELETE ON orca_entities
FOR EACH ROW
EXECUTE FUNCTION audit_financial_changes();

-- ==============================================
-- AUTOMATIC TIMESTAMP TRIGGER
-- ==============================================
CREATE OR REPLACE FUNCTION update_orca_entity_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_orca_entities_update ON orca_entities;
CREATE TRIGGER trg_orca_entities_update
BEFORE UPDATE ON orca_entities
FOR EACH ROW
EXECUTE FUNCTION update_orca_entity_timestamp();

-- ==============================================================================
-- RELATIONAL VIEWS (مشاهد علائقية دقيقة ونظيفة للاستعلام والتقارير المباشرة)
-- ==============================================================================

CREATE OR REPLACE VIEW v_branches AS
SELECT
  id,
  data->>'code' AS code,
  data->>'name' AS name,
  data->>'type' AS type,
  data->>'governorate' AS governorate,
  data->>'parentHubId' AS parent_hub_id,
  data->>'phone' AS phone,
  data->>'address' AS address,
  data->>'managerName' AS manager_name,
  COALESCE((data->>'isActive')::boolean, true) AS is_active,
  COALESCE((data->>'commissionRateShipping')::numeric, 0) AS commission_rate_shipping,
  COALESCE((data->>'commissionRateTransfers')::numeric, 0) AS commission_rate_transfers,
  COALESCE((data->>'boxSypBalance')::numeric, 0) AS box_syp_balance,
  COALESCE((data->>'boxUsdBalance')::numeric, 0) AS box_usd_balance,
  created_at,
  updated_at
FROM orca_entities
WHERE collection = 'branches';

CREATE OR REPLACE VIEW v_users AS
SELECT
  id,
  data->>'name' AS name,
  data->>'username' AS username,
  data->>'role' AS role,
  data->>'branchId' AS branch_id,
  data->>'phone' AS phone,
  data->>'nationalId' AS national_id,
  COALESCE((data->>'isActive')::boolean, true) AS is_active,
  COALESCE((data->>'canSwitchBranches')::boolean, false) AS can_switch_branches,
  data->'permissions' AS permissions,
  created_at,
  updated_at
FROM orca_entities
WHERE collection = 'users';

CREATE OR REPLACE VIEW v_parcels AS
SELECT
  id,
  data->>'trackingNumber' AS tracking_number,
  data->>'paperReceiptNumber' AS paper_receipt_number,
  data->>'handlingStatus' AS handling_status,
  data->>'paymentType' AS payment_type,
  data->>'originHubId' AS origin_hub_id,
  data->>'destinationHubId' AS destination_hub_id,
  data->>'currentLocationBranchId' AS current_location_branch_id,
  COALESCE(data->>'senderName', data->'sender'->>'name') AS sender_name,
  COALESCE(data->>'senderPhone', data->'sender'->>'phone') AS sender_phone,
  COALESCE(data->>'receiverName', data->'receiver'->>'name') AS receiver_name,
  COALESCE(data->>'receiverPhone', data->'receiver'->>'phone') AS receiver_phone,
  COALESCE(data->'receiver'->>'nationalId', data->>'nationalId') AS receiver_national_id,
  data->>'packageType' AS package_type,
  COALESCE((data->>'weightKg')::numeric, 0) AS weight_kg,
  COALESCE((data->>'piecesCount')::numeric, 1) AS pieces_count,
  COALESCE((data->>'shippingCost')::numeric, 0) AS shipping_cost,
  COALESCE((data->>'codAmount')::numeric, 0) AS cod_amount,
  COALESCE((data->>'transferFee')::numeric, 0) AS transfer_fee,
  COALESCE((data->>'totalDue')::numeric, 0) AS total_due,
  COALESCE(data->>'currency', 'SYP') AS currency,
  data->>'shippingCurrency' AS shipping_currency,
  data->>'codCurrency' AS cod_currency,
  data->>'truckManifestId' AS truck_manifest_id,
  data->>'courierManifestId' AS courier_manifest_id,
  data->>'createdByName' AS created_by_name,
  data->>'deliveredAt' AS delivered_at,
  data->>'arrivedAtDestAt' AS arrived_at_dest_at,
  created_at,
  updated_at
FROM orca_entities
WHERE collection = 'parcels';

CREATE OR REPLACE VIEW v_vouchers AS
SELECT
  id,
  data->>'voucherNumber' AS voucher_number,
  data->>'type' AS type,
  data->>'branchId' AS branch_id,
  data->>'counterpartyBranchId' AS counterparty_branch_id,
  COALESCE((data->>'amount')::numeric, 0) AS amount,
  COALESCE(data->>'currency', 'SYP') AS currency,
  data->>'paidByOrTo' AS paid_by_or_to,
  data->>'reasonCategory' AS reason_category,
  data->>'description' AS description,
  data->>'performedByUserName' AS performed_by_user_name,
  data->>'status' AS status,
  data->>'date' AS date,
  data->>'timestamp' AS timestamp,
  created_at,
  updated_at
FROM orca_entities
WHERE collection = 'vouchers';

CREATE OR REPLACE VIEW v_expenses AS
SELECT
  id,
  data->>'expenseNumber' AS expense_number,
  data->>'title' AS title,
  data->>'category' AS category,
  data->>'categoryId' AS category_id,
  data->>'branchId' AS branch_id,
  COALESCE((data->>'amount')::numeric, 0) AS amount,
  COALESCE(data->>'currency', 'SYP') AS currency,
  data->>'paidTo' AS paid_to,
  data->>'paymentMethod' AS payment_method,
  data->>'status' AS status,
  COALESCE((data->>'requiresApproval')::boolean, false) AS requires_approval,
  data->>'approvedByUserName' AS approved_by_user_name,
  data->>'disbursedByUserName' AS disbursed_by_user_name,
  data->>'disbursedAt' AS disbursed_at,
  data->>'date' AS date,
  created_at,
  updated_at
FROM orca_entities
WHERE collection = 'expenses';

CREATE OR REPLACE VIEW v_transactions AS
SELECT
  id,
  data->>'branchId' AS branch_id,
  data->>'type' AS type,
  COALESCE((data->>'amount')::numeric, 0) AS amount,
  COALESCE(data->>'currency', 'SYP') AS currency,
  data->>'description' AS description,
  data->>'cashboxScope' AS cashbox_scope,
  data->>'performedByUserName' AS performed_by_user_name,
  data->>'referenceId' AS reference_id,
  data->>'timestamp' AS timestamp,
  created_at,
  updated_at
FROM orca_entities
WHERE collection = 'transactions';

CREATE OR REPLACE VIEW v_truck_manifests AS
SELECT
  id,
  data->>'manifestNumber' AS manifest_number,
  data->>'originHubId' AS origin_hub_id,
  data->>'destinationHubId' AS destination_hub_id,
  data->>'driverName' AS driver_name,
  data->>'driverPhone' AS driver_phone,
  data->>'truckPlate' AS truck_plate,
  data->>'truckType' AS truck_type,
  data->>'status' AS status,
  COALESCE((data->>'parcelsCount')::numeric, 0) AS parcels_count,
  COALESCE((data->>'totalWeightKg')::numeric, 0) AS total_weight_kg,
  COALESCE((data->>'totalPieces')::numeric, 0) AS total_pieces,
  COALESCE((data->>'totalFreightSyp')::numeric, 0) AS total_freight_syp,
  COALESCE((data->>'totalFreightUsd')::numeric, 0) AS total_freight_usd,
  COALESCE((data->>'totalCodSyp')::numeric, 0) AS total_cod_syp,
  COALESCE((data->>'totalCodUsd')::numeric, 0) AS total_cod_usd,
  data->>'dispatchedAt' AS dispatched_at,
  data->>'arrivedAt' AS arrived_at,
  data->>'receivedAt' AS received_at,
  created_at,
  updated_at
FROM orca_entities
WHERE collection = 'truckManifests';

CREATE OR REPLACE VIEW v_courier_manifests AS
SELECT
  id,
  data->>'manifestNumber' AS manifest_number,
  data->>'courierId' AS courier_id,
  data->>'hubId' AS hub_id,
  data->>'status' AS status,
  data->>'assignedAt' AS assigned_at,
  data->>'settledAt' AS settled_at,
  COALESCE((data->>'totalCodToCollectSyp')::numeric, 0) AS total_cod_to_collect_syp,
  COALESCE((data->>'totalCodToCollectUsd')::numeric, 0) AS total_cod_to_collect_usd,
  COALESCE((data->>'totalCollectFreightSyp')::numeric, 0) AS total_collect_freight_syp,
  COALESCE((data->>'totalCollectFreightUsd')::numeric, 0) AS total_collect_freight_usd,
  created_at,
  updated_at
FROM orca_entities
WHERE collection = 'courierManifests';

CREATE OR REPLACE VIEW v_shift_settlement_vouchers AS
SELECT
  id,
  data->>'voucherNumber' AS voucher_number,
  data->>'branchId' AS branch_id,
  data->>'cashboxScope' AS cashbox_scope,
  data->>'officerUserId' AS officer_user_id,
  data->>'officerName' AS officer_name,
  data->>'managerName' AS manager_name,
  COALESCE((data->>'sypAmount')::numeric, 0) AS syp_amount,
  COALESCE((data->>'usdAmount')::numeric, 0) AS usd_amount,
  COALESCE((data->>'parcelsCount')::numeric, 0) AS parcels_count,
  data->>'status' AS status,
  data->>'approvedAt' AS approved_at,
  data->>'timestamp' AS timestamp,
  created_at,
  updated_at
FROM orca_entities
WHERE collection = 'shiftSettlementVouchers';

CREATE OR REPLACE VIEW v_customers AS
SELECT
  id,
  data->>'code' AS code,
  data->>'fullName' AS full_name,
  data->>'phone' AS phone,
  data->>'secondaryPhone' AS secondary_phone,
  data->>'nationalId' AS national_id,
  data->>'idType' AS id_type,
  data->>'city' AS city,
  data->>'address' AS address,
  data->>'companyName' AS company_name,
  data->>'customerType' AS customer_type,
  COALESCE((data->>'isVerified')::boolean, false) AS is_verified,
  COALESCE((data->>'isBlacklisted')::boolean, false) AS is_blacklisted,
  COALESCE((data->>'totalShipmentsSent')::numeric, 0) AS total_shipments_sent,
  COALESCE((data->>'totalShipmentsReceived')::numeric, 0) AS total_shipments_received,
  COALESCE((data->>'totalSpentSyp')::numeric, 0) AS total_spent_syp,
  COALESCE((data->>'totalSpentUsd')::numeric, 0) AS total_spent_usd,
  COALESCE((data->>'portalAccessEnabled')::boolean, false) AS portal_access_enabled,
  data->>'portalUsername' AS portal_username,
  created_at,
  updated_at
FROM orca_entities
WHERE collection = 'customers';

CREATE OR REPLACE VIEW v_employees AS
SELECT
  id,
  data->>'code' AS code,
  data->>'fullName' AS full_name,
  data->>'jobTitle' AS job_title,
  data->>'role' AS role,
  data->>'branchId' AS branch_id,
  data->>'phone' AS phone,
  data->>'nationalId' AS national_id,
  data->>'status' AS status,
  COALESCE((data->>'basicSalary')::numeric, (data->>'baseSalarySyp')::numeric, 0) AS basic_salary,
  COALESCE(data->>'salaryCurrency', data->>'currency', 'SYP') AS salary_currency,
  data->>'hireDate' AS hire_date,
  created_at,
  updated_at
FROM orca_entities
WHERE collection = 'employees';

CREATE OR REPLACE VIEW v_payroll_records AS
SELECT
  id,
  data->>'payrollNumber' AS payroll_number,
  data->>'employeeId' AS employee_id,
  data->>'employeeName' AS employee_name,
  data->>'branchId' AS branch_id,
  data->>'month' AS month,
  COALESCE((data->>'basicSalary')::numeric, 0) AS basic_salary,
  COALESCE(data->>'currency', 'SYP') AS currency,
  COALESCE((data->>'allowancesTotal')::numeric, (data->>'allowances')::numeric, 0) AS allowances_total,
  COALESCE((data->>'deductionsTotal')::numeric, (data->>'deductions')::numeric, 0) AS deductions_total,
  COALESCE((data->>'overtimeAmount')::numeric, 0) AS overtime_amount,
  COALESCE((data->>'bonusAmount')::numeric, 0) AS bonus_amount,
  COALESCE((data->>'netPayable')::numeric, 0) AS net_payable,
  data->>'status' AS status,
  data->>'paidAt' AS paid_at,
  created_at,
  updated_at
FROM orca_entities
WHERE collection = 'payrollRecords';

CREATE OR REPLACE VIEW v_vehicles AS
SELECT
  id,
  data->>'code' AS code,
  data->>'plateNumber' AS plate_number,
  data->>'type' AS type,
  data->>'model' AS model,
  COALESCE((data->>'year')::numeric, 2024) AS year,
  COALESCE((data->>'maxWeightKg')::numeric, 0) AS max_weight_kg,
  data->>'driverName' AS driver_name,
  data->>'driverPhone' AS driver_phone,
  COALESCE(data->>'assignedBranchId', data->>'branchId') AS assigned_branch_id,
  data->>'status' AS status,
  created_at,
  updated_at
FROM orca_entities
WHERE collection = 'vehicles';

CREATE OR REPLACE VIEW v_fixed_assets AS
SELECT
  id,
  COALESCE(data->>'assetCode', data->>'assetTag') AS asset_code,
  data->>'name' AS name,
  data->>'category' AS category,
  data->>'branchId' AS branch_id,
  data->>'purchaseDate' AS purchase_date,
  COALESCE((data->>'purchasePrice')::numeric, (data->>'purchaseCostSyp')::numeric, 0) AS purchase_price,
  COALESCE(data->>'currency', 'SYP') AS currency,
  data->>'condition' AS condition,
  data->>'serialNumber' AS serial_number,
  COALESCE(data->>'assignedEmployee', data->>'assignedToEmployee') AS assigned_employee,
  data->>'locationInBranch' AS location_in_branch,
  created_at,
  updated_at
FROM orca_entities
WHERE collection = 'fixedAssets';
