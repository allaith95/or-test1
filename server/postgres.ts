import { Pool, type PoolConfig } from 'pg';
import dotenv from 'dotenv';

dotenv.config();

let pool: Pool | null = null;
let isConnected = false;
let connectionError: string | null = null;
let lastPingTime = 0;
let initPromise: Promise<boolean> | null = null;
let tablesInitialized = false;

/**
 * Builds PostgreSQL pool configuration from environment variables
 */
function getPostgresConfig(): PoolConfig | null {
  const databaseUrl = process.env.DATABASE_URL;
  if (databaseUrl && databaseUrl.trim().length > 0) {
    const isExplicitDisabled = databaseUrl.includes('sslmode=disable');
    const isLocalhost = databaseUrl.includes('localhost') || databaseUrl.includes('127.0.0.1');
    const isCloud = databaseUrl.includes('supabase') || databaseUrl.includes('neon') || databaseUrl.includes('pooler') || databaseUrl.includes('aws') || databaseUrl.includes('render');
    const shouldEnableSsl = !isExplicitDisabled && (isCloud || process.env.PGSSL === 'true' || databaseUrl.includes('sslmode=require'));
    return {
      connectionString: databaseUrl.trim(),
      ssl: shouldEnableSsl && !isLocalhost ? { rejectUnauthorized: false } : undefined,
      max: 15,
      idleTimeoutMillis: 300000, // 5 minutes recommended for Neon / Supabase / Cloud Run pools
      connectionTimeoutMillis: 10000, // Wait up to 10s for new connection
      keepAlive: true,
      keepAliveInitialDelayMillis: 10000,
    };
  }

  const host = process.env.PGHOST;
  const user = process.env.PGUSER;
  const database = process.env.PGDATABASE;

  if (host && user && database) {
    return {
      host: host.trim(),
      port: parseInt(process.env.PGPORT || '5432', 10),
      user: user.trim(),
      password: process.env.PGPASSWORD || '',
      database: database.trim(),
      ssl: process.env.PGSSL === 'true' ? { rejectUnauthorized: false } : undefined,
      max: 15,
      idleTimeoutMillis: 300000, // 5 minutes recommended
      connectionTimeoutMillis: 10000,
      keepAlive: true,
      keepAliveInitialDelayMillis: 10000,
    };
  }

  return null;
}

/**
 * Complete Database Schema DDL Definition (Single Source of Truth)
 */
export const DATABASE_SCHEMA_DDL = `
    -- 1. Helper Functions (Safe casting utilities)
    CREATE OR REPLACE FUNCTION safe_numeric(txt text)
    RETURNS numeric AS $$
    BEGIN
      IF txt IS NULL OR TRIM(txt) = '' THEN RETURN NULL; END IF;
      RETURN txt::numeric;
    EXCEPTION WHEN others THEN
      RETURN NULL;
    END;
    $$ LANGUAGE plpgsql IMMUTABLE;

    CREATE OR REPLACE FUNCTION safe_boolean(txt text, default_val boolean DEFAULT false)
    RETURNS boolean AS $$
    BEGIN
      IF txt IS NULL OR TRIM(txt) = '' THEN RETURN default_val; END IF;
      IF LOWER(TRIM(txt)) IN ('true', 't', 'yes', 'y', '1') THEN RETURN true; END IF;
      IF LOWER(TRIM(txt)) IN ('false', 'f', 'no', 'n', '0') THEN RETURN false; END IF;
      RETURN default_val;
    EXCEPTION WHEN others THEN
      RETURN default_val;
    END;
    $$ LANGUAGE plpgsql IMMUTABLE;

    CREATE OR REPLACE FUNCTION safe_timestamptz(txt text)
    RETURNS timestamptz AS $$
    BEGIN
      IF txt IS NULL OR TRIM(txt) = '' THEN RETURN NULL; END IF;
      RETURN txt::timestamptz;
    EXCEPTION WHEN others THEN
      RETURN NULL;
    END;
    $$ LANGUAGE plpgsql IMMUTABLE;

    -- 2. Main Unified Entities & System Tables
    CREATE TABLE IF NOT EXISTS orca_entities (
      collection VARCHAR(64) NOT NULL,
      id VARCHAR(128) NOT NULL,
      data JSONB NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      PRIMARY KEY (collection, id)
    );

    -- Metadata and settings table
    CREATE TABLE IF NOT EXISTS orca_meta (
      key VARCHAR(128) PRIMARY KEY,
      value JSONB NOT NULL,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    -- Sync State Table for Delta Watermarking
    CREATE TABLE IF NOT EXISTS sync_state (
      key VARCHAR(128) PRIMARY KEY,
      value JSONB NOT NULL,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    -- Sync Audit Logs table
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

    -- Branch Balance Snapshots Table (الأرصدة المعتمدة ونقاط الإقفال للورديات)
    CREATE TABLE IF NOT EXISTS branch_balance_snapshots (
      id BIGSERIAL PRIMARY KEY,
      branch_id VARCHAR(128) NOT NULL,
      currency VARCHAR(16) NOT NULL,
      balance NUMERIC(18, 2) NOT NULL,
      snapshot_type VARCHAR(32) NOT NULL, -- 'shift_close' | 'daily_close' | 'manual'
      reference_id VARCHAR(128),          -- shiftSettlementVoucherId أو أي رقم سند
      created_by VARCHAR(128),
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE INDEX IF NOT EXISTS idx_balance_snapshots_branch 
      ON branch_balance_snapshots (branch_id, currency, created_at DESC);

    -- Financial Audit Trail Table (التدقيق المالي الآلي على مستوى قاعدة البيانات)
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

    CREATE INDEX IF NOT EXISTS idx_fin_audit_time ON financial_audit_trail(created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_fin_audit_branch ON financial_audit_trail(branch_id);
    CREATE INDEX IF NOT EXISTS idx_fin_audit_col ON financial_audit_trail(entity_collection, entity_id);

    -- Automatic Financial Audit Trigger (بما في ذلك المصاريف وسندات الصرف والقبض وتغيرات الصناديق والطرود والعملاء والمستخدمين)
    CREATE OR REPLACE FUNCTION audit_financial_changes()
    RETURNS TRIGGER AS $$
    DECLARE
      v_old_syp numeric;
      v_new_syp numeric;
      v_old_usd numeric;
      v_new_usd numeric;
      v_amount numeric;
    BEGIN
      IF (TG_OP = 'INSERT' OR TG_OP = 'UPDATE') AND NEW.collection IN (
        'transactions', 'vouchers', 'shiftSettlementVouchers', 'settlements',
        'branches', 'expenses', 'payrollRecords', 'courierIntakeSettlements',
        'interBranchObligations', 'fixedAssets'
      ) THEN
        v_old_syp := CASE WHEN TG_OP = 'UPDATE' THEN safe_numeric(OLD.data->>'boxSypBalance') ELSE NULL END;
        v_new_syp := safe_numeric(NEW.data->>'boxSypBalance');
        v_old_usd := CASE WHEN TG_OP = 'UPDATE' THEN safe_numeric(OLD.data->>'boxUsdBalance') ELSE NULL END;
        v_new_usd := safe_numeric(NEW.data->>'boxUsdBalance');
        
        v_amount := COALESCE(
          safe_numeric(NEW.data->>'amount'),
          safe_numeric(NEW.data->>'sypAmount'),
          safe_numeric(NEW.data->>'totalReceivedSyp'),
          safe_numeric(NEW.data->>'netPayableSyp'),
          safe_numeric(NEW.data->>'totalObligationAmount'),
          safe_numeric(NEW.data->>'purchasePrice'),
          safe_numeric(NEW.data->>'basicSalary'),
          0
        );

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
          COALESCE(NEW.data->>'branchId', NEW.data->>'currentLocationBranchId', NEW.data->>'originHubId', NEW.data->>'id'),
          COALESCE(NEW.data->>'createdByName', NEW.data->>'disbursedByName', NEW.data->>'approvedByName', NEW.data->>'userName', 'system'),
          v_amount,
          COALESCE(NEW.data->>'currency', 'SYP'),
          v_old_syp,
          v_new_syp,
          v_old_usd,
          v_new_usd,
          jsonb_build_object(
            'timestamp', NOW(),
            'newData', NEW.data,
            'oldData', CASE WHEN TG_OP = 'UPDATE' THEN OLD.data ELSE NULL END
          ),
          NOW()
        );
      ELSIF (TG_OP = 'DELETE') AND OLD.collection IN (
        'transactions', 'vouchers', 'shiftSettlementVouchers', 'settlements',
        'branches', 'expenses', 'payrollRecords', 'courierIntakeSettlements',
        'interBranchObligations', 'fixedAssets',
        'parcels', 'users', 'customers'
      ) THEN
        INSERT INTO financial_audit_trail (
          entity_collection,
          entity_id,
          event_type,
          branch_id,
          user_name,
          amount,
          currency,
          details,
          created_at
        ) VALUES (
          OLD.collection,
          OLD.id,
          'DELETE',
          COALESCE(OLD.data->>'branchId', OLD.data->>'currentLocationBranchId', OLD.data->>'originHubId', OLD.data->>'id'),
          'system',
          COALESCE(
            safe_numeric(OLD.data->>'amount'),
            safe_numeric(OLD.data->>'sypAmount'),
            safe_numeric(OLD.data->>'totalReceivedSyp'),
            safe_numeric(OLD.data->>'netPayableSyp'),
            safe_numeric(OLD.data->>'codAmount'),
            safe_numeric(OLD.data->>'totalObligationAmount'),
            safe_numeric(OLD.data->>'shippingCost'),
            safe_numeric(OLD.data->>'purchasePrice'),
            safe_numeric(OLD.data->>'basicSalary'),
            0
          ),
          COALESCE(OLD.data->>'currency', OLD.data->>'codCurrency', 'SYP'),
          jsonb_build_object('deletedData', OLD.data),
          NOW()
        );
      END IF;
      RETURN COALESCE(NEW, OLD);
    END;
    $$ LANGUAGE plpgsql;

    DROP TRIGGER IF EXISTS trg_financial_audit ON orca_entities;
    CREATE TRIGGER trg_financial_audit
    AFTER INSERT OR UPDATE OR DELETE ON orca_entities
    FOR EACH ROW
    EXECUTE FUNCTION audit_financial_changes();

    -- Optimized Core Indexes
    CREATE INDEX IF NOT EXISTS idx_orca_entities_composite ON orca_entities(collection, updated_at DESC);
    CREATE INDEX IF NOT EXISTS idx_orca_entities_updated_id ON orca_entities (updated_at ASC, id ASC);

    -- Branch Indexes (الفروع والمكاتب)
    CREATE INDEX IF NOT EXISTS idx_orca_branches_code ON orca_entities ((data->>'code')) WHERE collection = 'branches';
    CREATE INDEX IF NOT EXISTS idx_orca_branches_type ON orca_entities ((data->>'type')) WHERE collection = 'branches';
    CREATE INDEX IF NOT EXISTS idx_orca_branches_parent ON orca_entities ((data->>'parentHubId')) WHERE collection = 'branches';
    CREATE INDEX IF NOT EXISTS idx_orca_branches_gov ON orca_entities ((data->>'governorate')) WHERE collection = 'branches';

    -- User Role Indexes (المستخدمين والأدوار الوظيفية للفروع)
    CREATE INDEX IF NOT EXISTS idx_orca_users_username ON orca_entities ((data->>'username')) WHERE collection = 'users';
    CREATE INDEX IF NOT EXISTS idx_orca_users_branch ON orca_entities ((data->>'branchId')) WHERE collection = 'users';
    CREATE INDEX IF NOT EXISTS idx_orca_users_role ON orca_entities ((data->>'role')) WHERE collection = 'users';
    CREATE INDEX IF NOT EXISTS idx_orca_users_active ON orca_entities (safe_boolean(data->>'isActive', true)) WHERE collection = 'users';

    -- Parcels Indexes (الطرود والشحنات)
    CREATE INDEX IF NOT EXISTS idx_orca_parcels_tracking ON orca_entities ((data->>'trackingNumber')) WHERE collection = 'parcels';
    CREATE INDEX IF NOT EXISTS idx_orca_parcels_status ON orca_entities ((data->>'status')) WHERE collection = 'parcels';
    CREATE INDEX IF NOT EXISTS idx_orca_parcels_hstatus ON orca_entities ((data->>'handlingStatus')) WHERE collection = 'parcels';
    CREATE INDEX IF NOT EXISTS idx_orca_parcels_location ON orca_entities ((data->>'currentLocationBranchId')) WHERE collection = 'parcels';
    CREATE INDEX IF NOT EXISTS idx_orca_parcels_origin ON orca_entities ((data->>'originHubId')) WHERE collection = 'parcels';
    CREATE INDEX IF NOT EXISTS idx_orca_parcels_dest ON orca_entities ((data->>'destinationHubId')) WHERE collection = 'parcels';
    CREATE INDEX IF NOT EXISTS idx_orca_parcels_manifest ON orca_entities ((data->>'truckManifestId')) WHERE collection = 'parcels';
    CREATE INDEX IF NOT EXISTS idx_orca_parcels_receipt ON orca_entities ((data->>'paperReceiptNumber')) WHERE collection = 'parcels';

    -- Manifests Indexes (المنافيستات)
    CREATE INDEX IF NOT EXISTS idx_orca_manifests_number ON orca_entities ((data->>'manifestNumber')) WHERE collection = 'truckManifests';
    CREATE INDEX IF NOT EXISTS idx_orca_courier_manifest_num ON orca_entities ((data->>'manifestNumber')) WHERE collection = 'courierManifests';

    -- Financial & Vouchers Indexes (السندات والصناديق والمقاصة والمصاريف)
    CREATE INDEX IF NOT EXISTS idx_orca_tx_branch ON orca_entities ((data->>'branchId')) WHERE collection = 'transactions';
    CREATE INDEX IF NOT EXISTS idx_orca_tx_type ON orca_entities ((data->>'type')) WHERE collection = 'transactions';
    CREATE INDEX IF NOT EXISTS idx_orca_tx_currency ON orca_entities ((data->>'currency')) WHERE collection = 'transactions';
    CREATE INDEX IF NOT EXISTS idx_orca_tx_scope ON orca_entities ((data->>'cashboxScope')) WHERE collection = 'transactions';
    CREATE INDEX IF NOT EXISTS idx_orca_vouchers_branch ON orca_entities ((data->>'branchId')) WHERE collection = 'vouchers';
    CREATE INDEX IF NOT EXISTS idx_orca_vouchers_type ON orca_entities ((data->>'type')) WHERE collection = 'vouchers';
    CREATE INDEX IF NOT EXISTS idx_orca_shift_vouchers_branch ON orca_entities ((data->>'branchId')) WHERE collection = 'shiftSettlementVouchers';
    CREATE INDEX IF NOT EXISTS idx_orca_courier_intake_vouchers ON orca_entities ((data->>'voucherNumber')) WHERE collection = 'courierIntakeSettlements';
    CREATE INDEX IF NOT EXISTS idx_orca_courier_intake_branch ON orca_entities ((data->>'branchId')) WHERE collection = 'courierIntakeSettlements';
    CREATE INDEX IF NOT EXISTS idx_orca_expenses_branch ON orca_entities ((data->>'branchId')) WHERE collection = 'expenses';
    CREATE INDEX IF NOT EXISTS idx_orca_expenses_cat ON orca_entities ((data->>'categoryId')) WHERE collection = 'expenses';
    CREATE INDEX IF NOT EXISTS idx_orca_expenses_status ON orca_entities ((data->>'status')) WHERE collection = 'expenses';
    CREATE INDEX IF NOT EXISTS idx_orca_expenses_num ON orca_entities ((data->>'expenseNumber')) WHERE collection = 'expenses';

    -- Customers Indexes (العملاء)
    CREATE INDEX IF NOT EXISTS idx_orca_customers_phone ON orca_entities ((data->>'phone')) WHERE collection = 'customers';
    CREATE INDEX IF NOT EXISTS idx_orca_customers_national ON orca_entities ((data->>'nationalId')) WHERE collection = 'customers';

    -- Fleet & HR Indexes (المركبات والموظفين والرواتب والأصول)
    CREATE INDEX IF NOT EXISTS idx_orca_vehicles_plate ON orca_entities ((data->>'plateNumber')) WHERE collection = 'vehicles';
    CREATE INDEX IF NOT EXISTS idx_orca_employees_nid ON orca_entities ((data->>'nationalId')) WHERE collection = 'employees';
    CREATE INDEX IF NOT EXISTS idx_orca_employees_branch ON orca_entities ((data->>'branchId')) WHERE collection = 'employees';
    CREATE INDEX IF NOT EXISTS idx_orca_payroll_month ON orca_entities ((data->>'monthYear')) WHERE collection = 'payrollRecords';
    CREATE INDEX IF NOT EXISTS idx_orca_fixed_assets_tag ON orca_entities ((data->>'assetTag')) WHERE collection = 'fixedAssets';

    -- Automatic Timestamp Trigger
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

    -- Relational Views for direct SQL querying and reporting
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
      safe_boolean(data->>'isActive', true) AS is_active,
      COALESCE(safe_numeric(data->>'commissionRateShipping'), 0) AS commission_rate_shipping,
      COALESCE(safe_numeric(data->>'commissionRateTransfers'), 0) AS commission_rate_transfers,
      COALESCE(safe_numeric(data->>'boxSypBalance'), 0) AS box_syp_balance,
      COALESCE(safe_numeric(data->>'boxUsdBalance'), 0) AS box_usd_balance,
      data,
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
      safe_boolean(data->>'isActive', true) AS is_active,
      safe_boolean(data->>'canSwitchBranches', false) AS can_switch_branches,
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
      COALESCE(safe_numeric(data->>'weightKg'), 0) AS weight_kg,
      COALESCE(safe_numeric(data->>'piecesCount'), 1) AS pieces_count,
      COALESCE(safe_numeric(data->>'shippingCost'), 0) AS shipping_cost,
      COALESCE(safe_numeric(data->>'codAmount'), 0) AS cod_amount,
      COALESCE(safe_numeric(data->>'transferFee'), 0) AS transfer_fee,
      COALESCE(safe_numeric(data->>'totalDue'), 0) AS total_due,
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
      COALESCE(safe_numeric(data->>'amount'), 0) AS amount,
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
      COALESCE(safe_numeric(data->>'amount'), 0) AS amount,
      COALESCE(data->>'currency', 'SYP') AS currency,
      data->>'paidTo' AS paid_to,
      data->>'paymentMethod' AS payment_method,
      data->>'status' AS status,
      safe_boolean(data->>'requiresApproval', false) AS requires_approval,
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
      COALESCE(safe_numeric(data->>'amount'), 0) AS amount,
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

    -- Live Branch Balances & Sub-Box Balances (احتساب الأرصدة الحية اشتقاقياً من سجل القيود)
    CREATE OR REPLACE VIEW v_branch_live_balances AS
    WITH transaction_deltas AS (
      SELECT
        branch_id,
        currency,
        cashbox_scope,
        type,
        amount,
        CASE
          -- 1. عمليات التحويل الداخلي بين صناديق نفس الفرع (لا تؤثر على الإجمالي العام للخزينة)
          WHEN type IN ('shift_settlement_handover_outflow', 'shift_settlement_received_inflow', 'courier_handover_from_intake') THEN 0
          WHEN type IN ('deposit', 'withdrawal') AND (reference_id LIKE 'VTR-%') THEN 0
          
          -- 2. عهدة المناديب الميدانية (معزولة عن رصيد خزينة الفرع المالي حتى يتم توريدها وتسليمها)
          WHEN cashbox_scope IN ('courier', 'courier_intake', 'courier_delivery') THEN 0
          
          -- 3. العمليات الدائنة الإيجابية (قبض / توريد / إيداع)
          WHEN type IN (
            'shipping_income_prepaid',
            'courier_prepaid_collection',
            'courier_handover_to_outgoing',
            'shipping_collected_dest',
            'cod_collected_dest',
            'transfer_fee_income',
            'settlement_received_from_branch',
            'voucher_receipt',
            'deposit'
          ) THEN amount

          -- 4. العمليات المدينة السالبة (صرف / مصاريف / رد أمانات)
          WHEN type IN (
            'cod_paid_to_sender',
            'operating_expense',
            'voucher_payment',
            'settlement_transfer_to_hub',
            'branch_commission_payout',
            'withdrawal'
          ) THEN -amount

          ELSE 0
        END AS vault_delta,

        -- حركة الصندوق الفرعي المستقل (Sub-box Scope Balance Delta)
        CASE
          WHEN type IN (
            'shipping_income_prepaid',
            'courier_prepaid_collection',
            'courier_handover_to_outgoing',
            'shipping_collected_dest',
            'cod_collected_dest',
            'transfer_fee_income',
            'settlement_received_from_branch',
            'voucher_receipt',
            'deposit',
            'shift_settlement_received_inflow'
          ) THEN amount
          WHEN type IN (
            'cod_paid_to_sender',
            'operating_expense',
            'voucher_payment',
            'settlement_transfer_to_hub',
            'branch_commission_payout',
            'withdrawal',
            'shift_settlement_handover_outflow',
            'courier_handover_from_intake'
          ) THEN -amount
          ELSE 0
        END AS scoped_box_delta
      FROM v_transactions
    )
    SELECT
      b.id AS branch_id,
      b.code AS branch_code,
      b.name AS branch_name,
      
      -- Live vault balances = opening balance + sum of transactions
      COALESCE(safe_numeric(b.data->>'openingBalanceSyp'), 0) + 
        COALESCE(SUM(CASE WHEN t.currency = 'SYP' THEN t.vault_delta ELSE 0 END), 0) 
        AS live_vault_syp,
      
      COALESCE(safe_numeric(b.data->>'openingBalanceUsd'), 0) + 
        COALESCE(SUM(CASE WHEN t.currency = 'USD' THEN t.vault_delta ELSE 0 END), 0) 
        AS live_vault_usd,

      -- تفصيل أرصدة الصناديق الفرعية بالليرة السورية SYP (openingBalance صفر افتراضياً — لا يؤثر)
      COALESCE(SUM(CASE WHEN t.currency = 'SYP' AND t.cashbox_scope = 'master' 
        THEN t.scoped_box_delta ELSE 0 END), 0) AS master_box_syp,
      COALESCE(SUM(CASE WHEN t.currency = 'SYP' AND t.cashbox_scope = 'cashier' 
        THEN t.scoped_box_delta ELSE 0 END), 0) AS cashier_box_syp,
      COALESCE(SUM(CASE WHEN t.currency = 'SYP' AND t.cashbox_scope = 'outgoing' 
        THEN t.scoped_box_delta ELSE 0 END), 0) AS outgoing_box_syp,
      COALESCE(SUM(CASE WHEN t.currency = 'SYP' AND t.cashbox_scope = 'incoming' 
        THEN t.scoped_box_delta ELSE 0 END), 0) AS incoming_box_syp,
      
      -- عهدة المناديب الميدانية بالليرة السورية (منفصلة للرقابة)
      COALESCE(SUM(CASE WHEN t.currency = 'SYP' AND t.cashbox_scope IN 
        ('courier', 'courier_intake', 'courier_delivery') 
        THEN t.scoped_box_delta ELSE 0 END), 0) AS courier_box_syp,

      -- تفصيل أرصدة الصناديق الفرعية بالدولار USD
      COALESCE(SUM(CASE WHEN t.currency = 'USD' AND t.cashbox_scope = 'master' 
        THEN t.scoped_box_delta ELSE 0 END), 0) AS master_box_usd,
      COALESCE(SUM(CASE WHEN t.currency = 'USD' AND t.cashbox_scope = 'cashier' 
        THEN t.scoped_box_delta ELSE 0 END), 0) AS cashier_box_usd

    FROM v_branches b
    LEFT JOIN transaction_deltas t ON b.id = t.branch_id
    GROUP BY b.id, b.code, b.name, b.data;

    -- Function to fetch real-time calculated balances for a specific branch
    CREATE OR REPLACE FUNCTION get_branch_live_balance(
      p_branch_id VARCHAR(128)
    ) RETURNS TABLE (
      live_vault_syp NUMERIC,
      live_vault_usd NUMERIC,
      master_box_syp NUMERIC,
      master_box_usd NUMERIC,
      courier_box_syp NUMERIC
    ) AS $$
    BEGIN
      RETURN QUERY
      SELECT
        v.live_vault_syp,
        v.live_vault_usd,
        v.master_box_syp,
        v.master_box_usd,
        v.courier_box_syp
      FROM v_branch_live_balances v
      WHERE v.branch_id = p_branch_id;
    END;
    $$ LANGUAGE plpgsql STABLE;

    -- Inter-Branch Obligations (الذمم المالية التبادلية بين الفروع)
    CREATE TABLE IF NOT EXISTS inter_branch_obligations (
      id VARCHAR(64) PRIMARY KEY,
      parcel_id VARCHAR(64) NOT NULL,
      tracking_number VARCHAR(64) NOT NULL,
      obligation_type VARCHAR(32) NOT NULL DEFAULT 'cod',
      debtor_branch_id VARCHAR(64) NOT NULL,
      creditor_branch_id VARCHAR(64) NOT NULL,
      currency VARCHAR(8) NOT NULL DEFAULT 'SYP',
      cod_amount NUMERIC(15, 2) NOT NULL DEFAULT 0,
      shipping_share_amount NUMERIC(15, 2) NOT NULL DEFAULT 0,
      agent_commission_amount NUMERIC(15, 2) NOT NULL DEFAULT 0,
      transfer_fee_share_amount NUMERIC(15, 2) NOT NULL DEFAULT 0,
      total_obligation_amount NUMERIC(15, 2) NOT NULL,
      sender_payout_status VARCHAR(32) NOT NULL DEFAULT 'pending',
      sender_payout_voucher_id VARCHAR(64),
      sender_payout_at TIMESTAMPTZ,
      sender_payout_user_id VARCHAR(64),
      clearing_status VARCHAR(32) NOT NULL DEFAULT 'pending',
      clearing_voucher_id VARCHAR(64),
      clearing_voucher_number VARCHAR(64),
      cleared_at TIMESTAMPTZ,
      cleared_by_user_id VARCHAR(64),
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      metadata JSONB DEFAULT '{}'::jsonb,
      CONSTRAINT uq_obligation_parcel_currency UNIQUE (parcel_id, currency)
    );

    CREATE INDEX IF NOT EXISTS idx_obligations_debtor_clearing ON inter_branch_obligations(debtor_branch_id, clearing_status, currency);
    CREATE INDEX IF NOT EXISTS idx_obligations_creditor_clearing ON inter_branch_obligations(creditor_branch_id, clearing_status, currency);
    CREATE INDEX IF NOT EXISTS idx_obligations_creditor_payout ON inter_branch_obligations(creditor_branch_id, sender_payout_status);
    CREATE INDEX IF NOT EXISTS idx_obligations_parcel ON inter_branch_obligations(parcel_id);
    CREATE INDEX IF NOT EXISTS idx_obligations_tracking ON inter_branch_obligations(tracking_number);

    -- Automatic Synchronizer Trigger for Inter-Branch Obligations
    CREATE OR REPLACE FUNCTION sync_inter_branch_obligation()
    RETURNS TRIGGER AS $$
    BEGIN
      IF NEW.collection <> 'interBranchObligations' THEN
        RETURN NEW;
      END IF;

      INSERT INTO inter_branch_obligations (
        id, parcel_id, tracking_number, obligation_type,
        debtor_branch_id, creditor_branch_id, currency,
        cod_amount, shipping_share_amount,
        agent_commission_amount, transfer_fee_share_amount,
        total_obligation_amount,
        sender_payout_status, sender_payout_voucher_id,
        sender_payout_at, sender_payout_user_id,
        clearing_status, clearing_voucher_id,
        clearing_voucher_number, cleared_at, cleared_by_user_id,
        created_at, updated_at, metadata
      ) VALUES (
        NEW.id,
        COALESCE(NEW.data->>'parcelId', ''),
        COALESCE(NEW.data->>'trackingNumber', ''),
        COALESCE(NEW.data->>'obligationType', 'cod'),
        COALESCE(NEW.data->>'debtorBranchId', ''),
        COALESCE(NEW.data->>'creditorBranchId', ''),
        COALESCE(NEW.data->>'currency', 'SYP'),
        COALESCE(safe_numeric(NEW.data->>'codAmount'), 0),
        COALESCE(safe_numeric(NEW.data->>'shippingShareAmount'), 0),
        COALESCE(safe_numeric(NEW.data->>'agentCommissionAmount'), 0),
        COALESCE(safe_numeric(NEW.data->>'transferFeeShareAmount'), 0),
        COALESCE(safe_numeric(NEW.data->>'totalObligationAmount'), 0),
        COALESCE(NEW.data->>'senderPayoutStatus', 'pending'),
        NEW.data->>'senderPayoutVoucherId',
        safe_timestamptz(NEW.data->>'senderPayoutAt'),
        NEW.data->>'senderPayoutUserId',
        COALESCE(NEW.data->>'clearingStatus', 'pending'),
        NEW.data->>'clearingVoucherId',
        NEW.data->>'clearingVoucherNumber',
        safe_timestamptz(NEW.data->>'clearedAt'),
        NEW.data->>'clearedByUserId',
        NEW.created_at,
        NOW(),
        COALESCE(NEW.data->'metadata', '{}'::jsonb)
      )
      ON CONFLICT (id) DO UPDATE SET
        parcel_id = EXCLUDED.parcel_id,
        tracking_number = EXCLUDED.tracking_number,
        obligation_type = EXCLUDED.obligation_type,
        debtor_branch_id = EXCLUDED.debtor_branch_id,
        creditor_branch_id = EXCLUDED.creditor_branch_id,
        currency = EXCLUDED.currency,
        cod_amount = EXCLUDED.cod_amount,
        shipping_share_amount = EXCLUDED.shipping_share_amount,
        agent_commission_amount = EXCLUDED.agent_commission_amount,
        transfer_fee_share_amount = EXCLUDED.transfer_fee_share_amount,
        total_obligation_amount = EXCLUDED.total_obligation_amount,
        sender_payout_status = EXCLUDED.sender_payout_status,
        sender_payout_voucher_id = EXCLUDED.sender_payout_voucher_id,
        sender_payout_at = EXCLUDED.sender_payout_at,
        sender_payout_user_id = EXCLUDED.sender_payout_user_id,
        clearing_status = EXCLUDED.clearing_status,
        clearing_voucher_id = EXCLUDED.clearing_voucher_id,
        clearing_voucher_number = EXCLUDED.clearing_voucher_number,
        cleared_at = EXCLUDED.cleared_at,
        cleared_by_user_id = EXCLUDED.cleared_by_user_id,
        updated_at = EXCLUDED.updated_at,
        metadata = EXCLUDED.metadata;

      RETURN NEW;
    EXCEPTION WHEN others THEN
      RAISE WARNING '[Trigger] Non-fatal sync obligation error for %: %', NEW.id, SQLERRM;
      RETURN NEW;
    END;
    $$ LANGUAGE plpgsql;

    DROP TRIGGER IF EXISTS trg_sync_inter_branch_obligations ON orca_entities;
    CREATE TRIGGER trg_sync_inter_branch_obligations
    AFTER INSERT OR UPDATE ON orca_entities
    FOR EACH ROW
    WHEN (NEW.collection = 'interBranchObligations')
    EXECUTE FUNCTION sync_inter_branch_obligation();

    -- Parcel Events Log (سجل أحداث ودورة حياة الطرد - Append-Only)
    CREATE TABLE IF NOT EXISTS parcel_events (
      id VARCHAR(128) PRIMARY KEY,
      parcel_id VARCHAR(64) NOT NULL,
      tracking_number VARCHAR(64) NOT NULL,
      event_type VARCHAR(64) NOT NULL,
      dimension VARCHAR(32) NOT NULL DEFAULT 'handling',
      previous_status VARCHAR(64),
      new_status VARCHAR(64),
      precedence_rank INTEGER NOT NULL DEFAULT 0,
      branch_id VARCHAR(64),
      user_id VARCHAR(64),
      user_name VARCHAR(128),
      user_role VARCHAR(64),
      manifest_id VARCHAR(64),
      notes TEXT,
      metadata JSONB DEFAULT '{}'::jsonb,
      client_timestamp TIMESTAMPTZ,
      server_timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE INDEX IF NOT EXISTS idx_parcel_events_parcel 
      ON parcel_events (parcel_id, server_timestamp DESC);

    CREATE INDEX IF NOT EXISTS idx_parcel_events_tracking 
      ON parcel_events (tracking_number, server_timestamp DESC);

    CREATE INDEX IF NOT EXISTS idx_parcel_events_type 
      ON parcel_events (event_type, server_timestamp DESC);

    CREATE INDEX IF NOT EXISTS idx_parcel_events_dimension 
      ON parcel_events (dimension, server_timestamp DESC);

    CREATE INDEX IF NOT EXISTS idx_parcel_events_branch 
      ON parcel_events (branch_id, server_timestamp DESC);

    -- Automatic Synchronizer Trigger for Parcel Events (Append-Only)
    CREATE OR REPLACE FUNCTION sync_parcel_event()
    RETURNS TRIGGER AS $$
    BEGIN
      IF NEW.collection <> 'parcelEvents' THEN
        RETURN NEW;
      END IF;

      INSERT INTO parcel_events (
        id, parcel_id, tracking_number, event_type, dimension,
        previous_status, new_status, precedence_rank,
        branch_id, user_id, user_name, user_role, manifest_id,
        notes, metadata, client_timestamp, server_timestamp, created_at
      ) VALUES (
        NEW.id,
        COALESCE(NEW.data->>'parcelId', ''),
        COALESCE(NEW.data->>'trackingNumber', ''),
        COALESCE(NEW.data->>'eventType', 'unknown'),
        COALESCE(NEW.data->>'dimension', 'handling'),
        NEW.data->>'previousStatus',
        NEW.data->>'newStatus',
        COALESCE(safe_numeric(NEW.data->>'precedenceRank')::integer, 0),
        NEW.data->>'branchId',
        NEW.data->>'userId',
        NEW.data->>'userName',
        NEW.data->>'userRole',
        NEW.data->>'manifestId',
        NEW.data->>'notes',
        COALESCE(NEW.data->'metadata', '{}'::jsonb),
        safe_timestamptz(NEW.data->>'clientTimestamp'),
        COALESCE(safe_timestamptz(NEW.data->>'serverTimestamp'), NOW()),
        NEW.created_at
      )
      ON CONFLICT (id) DO NOTHING;

      RETURN NEW;
    EXCEPTION WHEN others THEN
      RAISE WARNING '[Trigger parcel_event] Non-fatal sync error for %: %', NEW.id, SQLERRM;
      RETURN NEW;
    END;
    $$ LANGUAGE plpgsql;

    DROP TRIGGER IF EXISTS trg_sync_parcel_event ON orca_entities;
    CREATE TRIGGER trg_sync_parcel_event
    AFTER INSERT ON orca_entities
    FOR EACH ROW
    WHEN (NEW.collection = 'parcelEvents')
    EXECUTE FUNCTION sync_parcel_event();

    -- Inter-Branch Balances & Net Positions View
    CREATE OR REPLACE VIEW v_inter_branch_balances AS
    WITH branch_pairs AS (
      SELECT 
        debtor_branch_id AS from_branch_id,
        creditor_branch_id AS to_branch_id,
        currency,
        SUM(total_obligation_amount) AS amount_owed,
        SUM(cod_amount) AS cod_total,
        SUM(shipping_share_amount) AS shipping_total,
        COUNT(*) AS pending_parcels_count
      FROM inter_branch_obligations
      WHERE clearing_status = 'pending'
      GROUP BY debtor_branch_id, creditor_branch_id, currency
    )
    SELECT
      p.from_branch_id AS debtor_branch_id,
      COALESCE(b1.name, p.from_branch_id) AS debtor_branch_name,
      COALESCE(b1.code, '') AS debtor_branch_code,
      p.to_branch_id AS creditor_branch_id,
      COALESCE(b2.name, p.to_branch_id) AS creditor_branch_name,
      COALESCE(b2.code, '') AS creditor_branch_code,
      p.currency,
      p.amount_owed,
      p.cod_total,
      p.shipping_total,
      p.pending_parcels_count,
      p.amount_owed - COALESCE(rev.amount_owed, 0) AS net_balance
    FROM branch_pairs p
    LEFT JOIN branch_pairs rev 
      ON p.from_branch_id = rev.to_branch_id 
     AND p.to_branch_id = rev.from_branch_id 
     AND p.currency = rev.currency
    LEFT JOIN v_branches b1 ON p.from_branch_id = b1.id
    LEFT JOIN v_branches b2 ON p.to_branch_id = b2.id;

    -- Parcel Timeline View (Chronological audit history per parcel)
    CREATE OR REPLACE VIEW v_parcel_timeline AS
    SELECT
      p.id AS parcel_id,
      COALESCE(p.data->>'trackingNumber', '') AS tracking_number,
      COALESCE(p.data->>'handlingStatus', '') AS current_status,
      COALESCE(p.data->>'codStatus', '') AS cod_status,
      COALESCE(p.data->>'shortageStatus', '') AS shortage_status,
      COALESCE(p.data->>'originHubId', '') AS origin_hub_id,
      COALESCE(p.data->>'destinationHubId', '') AS destination_hub_id,
      COALESCE(p.data->>'currentLocationBranchId', '') AS current_location_branch_id,
      
      -- Events aggregated as JSONB array (sorted chronologically by server_timestamp)
      COALESCE(
        (
          SELECT jsonb_agg(
            jsonb_build_object(
              'id', pe.id,
              'eventType', pe.event_type,
              'dimension', pe.dimension,
              'previousStatus', pe.previous_status,
              'newStatus', pe.new_status,
              'precedenceRank', pe.precedence_rank,
              'branchId', pe.branch_id,
              'userId', pe.user_id,
              'userName', pe.user_name,
              'userRole', pe.user_role,
              'manifestId', pe.manifest_id,
              'notes', pe.notes,
              'metadata', pe.metadata,
              'clientTimestamp', pe.client_timestamp,
              'serverTimestamp', pe.server_timestamp,
              'createdAt', pe.created_at
            )
            ORDER BY pe.precedence_rank ASC, pe.server_timestamp ASC
          )
          FROM parcel_events pe
          WHERE pe.parcel_id = p.id
        ),
        '[]'::jsonb
      ) AS events,
      
      -- Quick stats
      (SELECT COUNT(*)::int FROM parcel_events pe WHERE pe.parcel_id = p.id) AS events_count,
      
      (SELECT MIN(pe.server_timestamp) FROM parcel_events pe 
       WHERE pe.parcel_id = p.id) AS first_event_at,
      
      (SELECT MAX(pe.server_timestamp) FROM parcel_events pe 
       WHERE pe.parcel_id = p.id) AS last_event_at,
      
      -- Transit duration (first → last event in milliseconds)
      (SELECT EXTRACT(EPOCH FROM (MAX(pe.server_timestamp) - MIN(pe.server_timestamp))) * 1000
       FROM parcel_events pe WHERE pe.parcel_id = p.id)::bigint AS transit_duration_ms,
      
      p.created_at AS parcel_created_at,
      p.updated_at AS parcel_updated_at

    FROM orca_entities p
    WHERE p.collection = 'parcels';

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
      COALESCE(safe_numeric(data->>'parcelsCount'), 0) AS parcels_count,
      COALESCE(safe_numeric(data->>'totalWeightKg'), 0) AS total_weight_kg,
      COALESCE(safe_numeric(data->>'totalPieces'), 0) AS total_pieces,
      COALESCE(safe_numeric(data->>'totalFreightSyp'), 0) AS total_freight_syp,
      COALESCE(safe_numeric(data->>'totalFreightUsd'), 0) AS total_freight_usd,
      COALESCE(safe_numeric(data->>'totalCodSyp'), 0) AS total_cod_syp,
      COALESCE(safe_numeric(data->>'totalCodUsd'), 0) AS total_cod_usd,
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
      COALESCE(safe_numeric(data->>'totalCodToCollectSyp'), 0) AS total_cod_to_collect_syp,
      COALESCE(safe_numeric(data->>'totalCodToCollectUsd'), 0) AS total_cod_to_collect_usd,
      COALESCE(safe_numeric(data->>'totalCollectFreightSyp'), 0) AS total_collect_freight_syp,
      COALESCE(safe_numeric(data->>'totalCollectFreightUsd'), 0) AS total_collect_freight_usd,
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
      COALESCE(safe_numeric(data->>'sypAmount'), 0) AS syp_amount,
      COALESCE(safe_numeric(data->>'usdAmount'), 0) AS usd_amount,
      COALESCE(safe_numeric(data->>'parcelsCount'), 0) AS parcels_count,
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
      safe_boolean(data->>'isVerified', false) AS is_verified,
      safe_boolean(data->>'isBlacklisted', false) AS is_blacklisted,
      COALESCE(safe_numeric(data->>'totalShipmentsSent'), 0) AS total_shipments_sent,
      COALESCE(safe_numeric(data->>'totalShipmentsReceived'), 0) AS total_shipments_received,
      COALESCE(safe_numeric(data->>'totalSpentSyp'), 0) AS total_spent_syp,
      COALESCE(safe_numeric(data->>'totalSpentUsd'), 0) AS total_spent_usd,
      safe_boolean(data->>'portalAccessEnabled', false) AS portal_access_enabled,
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
      COALESCE(safe_numeric(data->>'basicSalary'), safe_numeric(data->>'baseSalarySyp'), 0) AS basic_salary,
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
      COALESCE(safe_numeric(data->>'basicSalary'), 0) AS basic_salary,
      COALESCE(data->>'currency', 'SYP') AS currency,
      COALESCE(safe_numeric(data->>'allowancesTotal'), safe_numeric(data->>'allowances'), 0) AS allowances_total,
      COALESCE(safe_numeric(data->>'deductionsTotal'), safe_numeric(data->>'deductions'), 0) AS deductions_total,
      COALESCE(safe_numeric(data->>'overtimeAmount'), 0) AS overtime_amount,
      COALESCE(safe_numeric(data->>'bonusAmount'), 0) AS bonus_amount,
      COALESCE(safe_numeric(data->>'netPayable'), 0) AS net_payable,
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
      COALESCE(safe_numeric(data->>'year'), EXTRACT(YEAR FROM NOW())::int) AS year,
      COALESCE(safe_numeric(data->>'maxWeightKg'), 0) AS max_weight_kg,
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
      COALESCE(safe_numeric(data->>'purchasePrice'), safe_numeric(data->>'purchaseCostSyp'), 0) AS purchase_price,
      COALESCE(data->>'currency', 'SYP') AS currency,
      data->>'condition' AS condition,
      data->>'serialNumber' AS serial_number,
      COALESCE(data->>'assignedEmployee', data->>'assignedToEmployee') AS assigned_employee,
      data->>'locationInBranch' AS location_in_branch,
      created_at,
      updated_at
    FROM orca_entities
    WHERE collection = 'fixedAssets';
`;

/**
 * Initialize PostgreSQL tables schema
 */
async function initTables(clientPool: Pool): Promise<void> {
  await clientPool.query(DATABASE_SCHEMA_DDL);
  console.log('[PostgreSQL] Database schemas, indexes & relational views verified successfully.');
}

/**
 * Connect to PostgreSQL and verify schema
 */
export async function initPostgres(): Promise<boolean> {
  if (initPromise) return initPromise;

  initPromise = (async () => {
    try {
      const config = getPostgresConfig();

      if (!config) {
        isConnected = false;
        connectionError = 'لم يتم تعيين متغيرات البيئة الخاصة بقاعدة بيانات PostgreSQL (DATABASE_URL أو PGHOST). النظام يعمل الآن عبر التخزين المحلي الآمن لحين ربط القاعدة.';
        console.log('[PostgreSQL] No connection configuration found in environment variables. Falling back to local JSON file storage.');
        return false;
      }

      if (pool) {
        await pool.end().catch(() => {});
      }

      pool = new Pool(config);

      // Prevent unhandled error crashes from idle client terminations
      pool.on('error', (err) => {
        console.warn('[PostgreSQL Pool Warning] Idle client connection error or server drop:', err.message);
      });

      const start = Date.now();
      const res = await pool.query('SELECT NOW() as current_time, current_database() as db_name, version() as pg_version');
      lastPingTime = Date.now() - start;
      isConnected = true;
      connectionError = null;

      console.log(`[PostgreSQL] Connected successfully to database: "${res.rows[0].db_name}" in ${lastPingTime}ms`);
      console.log(`[PostgreSQL] Engine: ${res.rows[0].pg_version.split(' on ')[0]}`);

      // Create schema only once per process lifecycle
      if (!tablesInitialized) {
        console.log('[PostgreSQL] Initializing tables, indexes, and triggers (DDL)...');
        await initTables(pool);
        tablesInitialized = true;
      } else {
        console.log('[PostgreSQL] Tables already initialized. Skipping DDL on reconnect.');
      }
      return true;
    } catch (err: any) {
      isConnected = false;
      connectionError = err.message || 'فشل الاتصال بقاعدة بيانات PostgreSQL';
      console.error('[PostgreSQL] Connection failure:', err.message);
      return false;
    } finally {
      initPromise = null;
    }
  })();

  return initPromise;
}

/**
 * Executes a query with automatic retry and pool re-initialization on connection timeouts or drops
 */
export async function queryWithRetry<T = any>(
  queryFn: (activePool: Pool) => Promise<T>,
  retries = 1
): Promise<T> {
  if (!pool || !isConnected) {
    const reconnected = await initPostgres();
    if (!reconnected || !pool) {
      throw new Error(connectionError || 'PostgreSQL connection unavailable');
    }
  }

  try {
    return await queryFn(pool);
  } catch (err: any) {
    const errMsg = String(err?.message || err);
    const isConnError =
      errMsg.includes('Connection terminated') ||
      errMsg.includes('timeout') ||
      errMsg.includes('closed') ||
      errMsg.includes('ECONNRESET') ||
      errMsg.includes('EPIPE') ||
      err?.code === '57P01' ||
      err?.code === '08006';

    if (isConnError && retries > 0) {
      console.warn('[PostgreSQL] Connection dropped or timed out. Re-initializing connection pool and retrying query...');
      isConnected = false;
      const reconnected = await initPostgres();
      if (reconnected && pool) {
        return await queryFn(pool);
      }
    }
    throw err;
  }
}

/**
 * Acquires a client connection for multi-query transactions with automatic re-initialization retry
 */
async function getPoolClientWithRetry(retries = 1) {
  if (!pool || !isConnected) {
    const reconnected = await initPostgres();
    if (!reconnected || !pool) throw new Error(connectionError || 'PostgreSQL connection unavailable');
  }
  try {
    return await pool.connect();
  } catch (err: any) {
    const errMsg = String(err?.message || err);
    const isConnError =
      errMsg.includes('Connection terminated') ||
      errMsg.includes('timeout') ||
      errMsg.includes('closed') ||
      errMsg.includes('ECONNRESET') ||
      err?.code === '57P01' ||
      err?.code === '08006';

    if (isConnError && retries > 0) {
      console.warn('[PostgreSQL] Failed to acquire client connection. Re-initializing pool and retrying...');
      isConnected = false;
      const reconnected = await initPostgres();
      if (reconnected && pool) {
        return await pool.connect();
      }
    }
    throw err;
  }
}

/**
 * Returns connection health status
 */
export async function getPostgresStatus(): Promise<{
  connected: boolean;
  pingMs: number;
  database?: string;
  error?: string | null;
  counts?: Record<string, number>;
  configSource?: string;
}> {
  const hasConfig = process.env.DATABASE_URL || process.env.PGHOST;
  if (!hasConfig && (!pool || !isConnected)) {
    return {
      connected: false,
      pingMs: 0,
      error: connectionError,
      configSource: 'none',
    };
  }

  try {
    return await queryWithRetry(async (activePool) => {
      const start = Date.now();
      const dbRes = await activePool.query('SELECT current_database() as db_name');
      const pingMs = Date.now() - start;

      // Get counts per collection
      const countsRes = await activePool.query(`
        SELECT collection, COUNT(*)::int as total 
        FROM orca_entities 
        GROUP BY collection
      `);

      const counts: Record<string, number> = {};
      countsRes.rows.forEach((r) => {
        counts[r.collection] = r.total;
      });

      return {
        connected: true,
        pingMs,
        database: dbRes.rows[0]?.db_name,
        counts,
        configSource: process.env.DATABASE_URL ? 'DATABASE_URL' : 'PGHOST',
      };
    });
  } catch (err: any) {
    isConnected = false;
    connectionError = err.message;
    return {
      connected: false,
      pingMs: 0,
      error: err.message,
      configSource: process.env.DATABASE_URL ? 'DATABASE_URL' : process.env.PGHOST ? 'PGHOST' : 'none',
    };
  }
}

/**
 * Load all entities from PostgreSQL grouped by collection
 */
export async function pullAllFromPostgres(): Promise<Record<string, any[]> | null> {
  const hasConfig = process.env.DATABASE_URL || process.env.PGHOST;
  if (!hasConfig && (!pool || !isConnected)) return null;

  try {
    return await queryWithRetry(async (activePool) => {
      const res = await activePool.query('SELECT collection, data FROM orca_entities ORDER BY updated_at ASC');
      const grouped: Record<string, any[]> = {};

      for (const row of res.rows) {
        if (!grouped[row.collection]) {
          grouped[row.collection] = [];
        }
        grouped[row.collection].push(row.data);
      }

      return grouped;
    });
  } catch (err) {
    console.error('[PostgreSQL] Error in pullAllFromPostgres:', err);
    return null;
  }
}

export interface SyncWatermark {
  updatedAt: string;
  id: string;
}

/**
 * Extracts the highest (updated_at, id) watermark from an array of entity rows
 */
export function extractWatermark(rows: Array<{ updated_at?: string; id?: string; data?: any }>): SyncWatermark | null {
  if (!rows || rows.length === 0) return null;
  let maxTime = '';
  let maxId = '';

  for (const r of rows) {
    const time = r.updated_at || r.data?.updatedAt || '';
    const id = r.id || r.data?.id || '';
    if (!time) continue;
    if (time > maxTime || (time === maxTime && id > maxId)) {
      maxTime = time;
      maxId = id;
    }
  }

  return maxTime ? { updatedAt: maxTime, id: maxId } : null;
}

/**
 * Retrieves the stored server-side sync watermark from sync_state table
 */
export async function getStoredSyncWatermark(): Promise<SyncWatermark | null> {
  const hasConfig = process.env.DATABASE_URL || process.env.PGHOST;
  if (!hasConfig && (!pool || !isConnected)) return null;

  try {
    return await queryWithRetry(async (activePool) => {
      const res = await activePool.query(`SELECT value FROM sync_state WHERE key = 'last_sync' LIMIT 1`);
      if (res.rows.length === 0 || !res.rows[0].value) return null;
      return res.rows[0].value as SyncWatermark;
    });
  } catch (err) {
    console.warn('[PostgreSQL] Could not read stored sync watermark:', err);
    return null;
  }
}

/**
 * Saves the latest sync watermark to sync_state table
 */
export async function saveStoredSyncWatermark(watermark: SyncWatermark): Promise<void> {
  const hasConfig = process.env.DATABASE_URL || process.env.PGHOST;
  if (!hasConfig && (!pool || !isConnected)) return;

  try {
    await queryWithRetry(async (activePool) => {
      await activePool.query(
        `INSERT INTO sync_state (key, value, updated_at)
         VALUES ('last_sync', $1, NOW())
         ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()`,
        [JSON.stringify(watermark)]
      );
    });
  } catch (err) {
    console.warn('[PostgreSQL] Could not save sync watermark:', err);
  }
}

/**
 * Load incremental changes from PostgreSQL using tuple watermark (updated_at, id)
 * Supports both tuple watermark object and legacy ISO timestamp string.
 */
export async function pullChangesSince(
  since: string | SyncWatermark
): Promise<{ data: Record<string, any[]>; watermark: SyncWatermark | null; totalCount: number } | null> {
  const hasConfig = process.env.DATABASE_URL || process.env.PGHOST;
  if (!hasConfig && (!pool || !isConnected)) return null;

  const sinceISO = typeof since === 'string' ? since : since?.updatedAt;
  const sinceId = typeof since === 'string' ? '' : (since?.id || '');

  if (!sinceISO) return null;

  try {
    return await queryWithRetry(async (activePool) => {
      // Precise tuple comparison: WHERE (updated_at > $1::timestamptz) OR (updated_at = $1::timestamptz AND id > $2)
      // to_char ensures exact full precision timestamp (microsecond UTC ISO8601) is returned without JS Date truncation
      const query = sinceId
        ? `SELECT collection, id, 
                  to_char(updated_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"') AS updated_at_text, 
                  data 
           FROM orca_entities 
           WHERE (updated_at > $1::timestamptz) OR (updated_at = $1::timestamptz AND id > $2)
           ORDER BY updated_at ASC, id ASC`
        : `SELECT collection, id, 
                  to_char(updated_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"') AS updated_at_text, 
                  data 
           FROM orca_entities 
           WHERE updated_at > $1::timestamptz 
           ORDER BY updated_at ASC, id ASC`;

      const params = sinceId ? [sinceISO, sinceId] : [sinceISO];
      const res = await activePool.query(query, params);

      const grouped: Record<string, any[]> = {};
      let maxWatermark: SyncWatermark | null = null;

      for (const row of res.rows) {
        if (!grouped[row.collection]) grouped[row.collection] = [];
        grouped[row.collection].push(row.data);

        const rowTime = row.updated_at_text || '';
        const rowId = String(row.id || '');
        if (rowTime) {
          if (!maxWatermark || rowTime > maxWatermark.updatedAt || (rowTime === maxWatermark.updatedAt && rowId > maxWatermark.id)) {
            maxWatermark = { updatedAt: rowTime, id: rowId };
          }
        }
      }

      return {
        data: grouped,
        watermark: maxWatermark,
        totalCount: res.rows.length,
      };
    });
  } catch (err) {
    console.error('[PostgreSQL] Error in pullChangesSince:', err);
    return null;
  }
}

/**
 * Resolves a canonical non-empty ID for any item
 */
function resolveEntityId(collection: string, item?: any, fallbackId?: string): string | null {
  if (item?.id && typeof item.id === 'string' && item.id.trim().length > 0) {
    return item.id.trim();
  }
  if (fallbackId && typeof fallbackId === 'string' && fallbackId.trim().length > 0) {
    return fallbackId.trim();
  }
  if (collection === 'users' && item?.username) {
    return `usr_${item.username.toLowerCase().trim().replace(/[^a-z0-9_]/g, '')}`;
  }
  if (collection === 'branches' && item?.code) {
    return `br_${item.code.toLowerCase().trim().replace(/[^a-z0-9_]/g, '')}`;
  }
  if (collection === 'parcels' && item?.trackingNumber) {
    return item.trackingNumber.trim().toUpperCase();
  }
  if ((collection === 'truckManifests' || collection === 'courierManifests') && item?.manifestNumber) {
    return item.manifestNumber.trim();
  }
  if (collection === 'vouchers' && item?.voucherNumber) {
    return item.voucherNumber.trim();
  }
  if (collection === 'expenses' && item?.expenseNumber) {
    return `exp_${item.expenseNumber.trim()}`;
  }
  if (collection === 'shiftSettlementVouchers' && item?.voucherNumber) {
    return `shift_${item.voucherNumber.trim()}`;
  }
  if (collection === 'courierIntakeSettlements' && (item?.voucherNumber || item?.id)) {
    return `intake_${(item.voucherNumber || item.id).trim()}`;
  }
  if (collection === 'brandingSettings') {
    return 'company_branding';
  }
  if (collection === 'codSettings') {
    return 'system_cod_settings';
  }
  if (collection === 'alertsSettings') {
    return 'system_alerts_settings';
  }
  if (collection === 'customers') {
    if (item?.nationalId && item.nationalId.trim().length >= 7) {
      return `cst_nid_${item.nationalId.replace(/\D/g, '')}`;
    }
    if (item?.phone && item.phone.trim().length >= 7) {
      return `cst_ph_${item.phone.replace(/\D/g, '')}`;
    }
  }
  if (collection === 'vehicles' && (item?.plateNumber || item?.code)) {
    return `veh_${(item.plateNumber || item.code).replace(/[^a-zA-Z0-9_\u0600-\u06FF]/g, '_')}`;
  }
  if (collection === 'employees' && (item?.nationalId || item?.code || item?.fullName)) {
    return `emp_${(item.nationalId || item.code || item.fullName).replace(/[^a-zA-Z0-9_\u0600-\u06FF]/g, '_')}`;
  }
  if (collection === 'expenseCategories' && (item?.name || item?.code)) {
    return `expcat_${(item.code || item.name).replace(/[^a-zA-Z0-9_\u0600-\u06FF]/g, '_')}`;
  }
  if (collection === 'fixedAssets' && (item?.assetCode || item?.assetTag || item?.name)) {
    return `asset_${(item.assetCode || item.assetTag || item.name).replace(/[^a-zA-Z0-9_\u0600-\u06FF]/g, '_')}`;
  }
  if (collection === 'payrollRecords' && item?.payrollNumber) {
    return `pay_${item.payrollNumber.replace(/[^a-zA-Z0-9_]/g, '_')}`;
  }
  if (item && typeof item === 'object') {
    console.warn(`[PostgreSQL] Cannot resolve stable id for collection "${collection}" — item skipped to prevent duplication.`);
    return null;
  }
  return null;
}

export {
  HANDLING_RANK,
  COD_STATUS_RANK,
  COD_PAYOUT_STATUS_RANK,
  SHORTAGE_STATUS_RANK,
  getHandlingStatusRank,
  getCodStatusRank,
  getCodPayoutStatusRank,
  getShortageStatusRank,
  mergeParcelSafely,
  mergeCustomerSafely,
  mergeUserSafely,
  mergeBranchSafely,
} from '../src/utils/parcelMergeEngine.ts';
import { mergeParcelSafely, mergeCustomerSafely, mergeUserSafely, mergeBranchSafely } from '../src/utils/parcelMergeEngine.ts';

/**
 * Save / Upsert single item into PostgreSQL with strict Transaction Isolation
 */
export async function saveItemToPostgres(
  collection: string,
  item: any,
  action: 'upsert' | 'delete',
  itemId?: string
): Promise<boolean> {
  const hasConfig = process.env.DATABASE_URL || process.env.PGHOST;
  if (!hasConfig && (!pool || !isConnected)) return false;

  const targetId = resolveEntityId(collection, item, itemId);
  if (!targetId) return false;

  const client = await getPoolClientWithRetry();

  try {
    await client.query('BEGIN');

    if (action === 'delete') {
      await client.query(
        `DELETE FROM orca_entities 
         WHERE collection = $1 AND (
           id = $2 
           OR (collection = 'parcels' AND data->>'trackingNumber' = $2)
           OR (collection = 'users' AND data->>'username' = $2)
           OR (collection = 'branches' AND data->>'code' = $2)
           OR (collection = 'truckManifests' AND data->>'manifestNumber' = $2)
           OR (collection = 'courierManifests' AND data->>'manifestNumber' = $2)
           OR (collection = 'vouchers' AND data->>'voucherNumber' = $2)
         )`,
        [collection, targetId]
      );
    } else {
      const now = new Date().toISOString();
      let updatedItem = {
        ...item,
        id: targetId,
        updatedAt: item.updatedAt || now,
        createdAt: item.createdAt || now,
      };

      // Clean up any legacy duplicate record keyed by trackingNumber instead of canonical id within transaction
      if (collection === 'parcels' && item?.trackingNumber && item.trackingNumber !== targetId) {
        await client.query('DELETE FROM orca_entities WHERE collection = $1 AND id = $2', [collection, item.trackingNumber]);
      }

      // Safe monotonic parcel, customer, user, and branch merging if record already exists in database
      if (collection === 'parcels') {
        const existingRes = await client.query(
          'SELECT data FROM orca_entities WHERE collection = $1 AND id = $2',
          [collection, targetId]
        );
        if (existingRes.rows.length > 0 && existingRes.rows[0].data) {
          updatedItem = mergeParcelSafely(existingRes.rows[0].data, updatedItem);
        }
      } else if (collection === 'customers') {
        const existingRes = await client.query(
          'SELECT data FROM orca_entities WHERE collection = $1 AND id = $2',
          [collection, targetId]
        );
        if (existingRes.rows.length > 0 && existingRes.rows[0].data) {
          updatedItem = mergeCustomerSafely(existingRes.rows[0].data, updatedItem);
        }
      } else if (collection === 'users') {
        const existingRes = await client.query(
          'SELECT data FROM orca_entities WHERE collection = $1 AND id = $2',
          [collection, targetId]
        );
        if (existingRes.rows.length > 0 && existingRes.rows[0].data) {
          updatedItem = mergeUserSafely(existingRes.rows[0].data, updatedItem);
        }
      } else if (collection === 'branches') {
        const existingRes = await client.query(
          'SELECT data FROM orca_entities WHERE collection = $1 AND id = $2',
          [collection, targetId]
        );
        if (existingRes.rows.length > 0 && existingRes.rows[0].data) {
          updatedItem = mergeBranchSafely(existingRes.rows[0].data, updatedItem);
        }
      }

      await client.query(
        `
        INSERT INTO orca_entities (collection, id, data, updated_at)
        VALUES ($1, $2, $3, NOW())
        ON CONFLICT (collection, id)
        DO UPDATE SET 
          data = EXCLUDED.data,
          updated_at = CASE 
            WHEN orca_entities.data IS DISTINCT FROM EXCLUDED.data 
            THEN NOW() 
            ELSE orca_entities.updated_at 
          END
        WHERE COALESCE(orca_entities.data->>'updatedAt', '') <= COALESCE(EXCLUDED.data->>'updatedAt', '');
      `,
        [collection, targetId, JSON.stringify(updatedItem)]
      );
    }

    await client.query('COMMIT');
    return true;
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    console.error(`[PostgreSQL] Error in saveItemToPostgres (${collection}/${targetId}):`, err);
    throw err;
  } finally {
    client.release();
  }
}

/**
 * Save batch operations inside a transaction with granular SAVEPOINT isolation
 */
export async function batchSaveToPostgres(
  operations: Array<{ collection: string; item?: any; action: 'upsert' | 'delete'; itemId?: string }>
): Promise<number> {
  const hasConfig = process.env.DATABASE_URL || process.env.PGHOST;
  if (!hasConfig && (!pool || !isConnected)) return 0;

  const client = await getPoolClientWithRetry();
  let processed = 0;
  let opIndex = 0;

  try {
    await client.query('BEGIN');

    for (const op of operations) {
      const targetId = resolveEntityId(op.collection, op.item, op.itemId);
      if (!targetId || !op.collection) {
        opIndex++;
        continue;
      }

      const savepointName = `sp_${opIndex}`;

      try {
        await client.query(`SAVEPOINT ${savepointName}`);

        if (op.action === 'delete') {
          await client.query(
            `DELETE FROM orca_entities 
             WHERE collection = $1 AND (
               id = $2 
               OR (collection = 'parcels' AND data->>'trackingNumber' = $2)
               OR (collection = 'users' AND data->>'username' = $2)
               OR (collection = 'branches' AND data->>'code' = $2)
               OR (collection = 'truckManifests' AND data->>'manifestNumber' = $2)
               OR (collection = 'courierManifests' AND data->>'manifestNumber' = $2)
               OR (collection = 'vouchers' AND data->>'voucherNumber' = $2)
             )`,
            [op.collection, targetId]
          );
        } else if (op.item) {
          if (op.collection === 'parcels' && op.item?.trackingNumber && op.item.trackingNumber !== targetId) {
            await client.query(
              'DELETE FROM orca_entities WHERE collection = $1 AND id = $2',
              [op.collection, op.item.trackingNumber]
            );
          }

          const now = new Date().toISOString();
          let itemToSave = {
            ...op.item,
            id: targetId,
            updatedAt: op.item.updatedAt || now,
            createdAt: op.item.createdAt || now,
          };

          // Safe monotonic parcel, customer, user, and branch merging inside batch transaction
          if (op.collection === 'parcels') {
            const existingRes = await client.query(
              'SELECT data FROM orca_entities WHERE collection = $1 AND id = $2',
              [op.collection, targetId]
            );
            if (existingRes.rows.length > 0 && existingRes.rows[0].data) {
              itemToSave = mergeParcelSafely(existingRes.rows[0].data, itemToSave);
            }
          } else if (op.collection === 'customers') {
            const existingRes = await client.query(
              'SELECT data FROM orca_entities WHERE collection = $1 AND id = $2',
              [op.collection, targetId]
            );
            if (existingRes.rows.length > 0 && existingRes.rows[0].data) {
              itemToSave = mergeCustomerSafely(existingRes.rows[0].data, itemToSave);
            }
          } else if (op.collection === 'users') {
            const existingRes = await client.query(
              'SELECT data FROM orca_entities WHERE collection = $1 AND id = $2',
              [op.collection, targetId]
            );
            if (existingRes.rows.length > 0 && existingRes.rows[0].data) {
              itemToSave = mergeUserSafely(existingRes.rows[0].data, itemToSave);
            }
          } else if (op.collection === 'branches') {
            const existingRes = await client.query(
              'SELECT data FROM orca_entities WHERE collection = $1 AND id = $2',
              [op.collection, targetId]
            );
            if (existingRes.rows.length > 0 && existingRes.rows[0].data) {
              itemToSave = mergeBranchSafely(existingRes.rows[0].data, itemToSave);
            }
          }

          await client.query(
            `INSERT INTO orca_entities (collection, id, data, updated_at)
             VALUES ($1, $2, $3, NOW())
             ON CONFLICT (collection, id)
             DO UPDATE SET 
               data = EXCLUDED.data,
               updated_at = CASE 
                 WHEN orca_entities.data IS DISTINCT FROM EXCLUDED.data 
                 THEN NOW() 
                 ELSE orca_entities.updated_at 
               END
             WHERE COALESCE(orca_entities.data->>'updatedAt', '') 
                 <= COALESCE(EXCLUDED.data->>'updatedAt', '');`,
            [op.collection, targetId, JSON.stringify(itemToSave)]
          );
        }

        await client.query(`RELEASE SAVEPOINT ${savepointName}`);
        processed++;
      } catch (opErr: any) {
        await client.query(`ROLLBACK TO SAVEPOINT ${savepointName}`).catch(() => {});
        console.warn(
          `[PostgreSQL] batchSave skipped op #${opIndex} (${op.collection}/${targetId}):`,
          opErr?.message || opErr
        );
      }

      opIndex++;
    }

    await client.query('COMMIT');
    return processed;
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    console.error('[PostgreSQL] Error in batchSaveToPostgres transaction:', err);
    throw err;
  } finally {
    client.release();
  }
}

/**
 * Bulk insert or overwrite entire database to PostgreSQL
 */
export async function pushAllToPostgres(entireDb: Record<string, any[]>): Promise<number> {
  const hasConfig = process.env.DATABASE_URL || process.env.PGHOST;
  if (!hasConfig && (!pool || !isConnected)) return 0;

  const client = await getPoolClientWithRetry();
  let totalSaved = 0;

  try {
    await client.query('BEGIN');

    for (const [collection, rawItems] of Object.entries(entireDb)) {
      const items = Array.isArray(rawItems)
        ? rawItems
        : rawItems && typeof rawItems === 'object'
        ? [rawItems]
        : [];

      for (const item of items) {
        const itemId = resolveEntityId(collection, item, item?.id);
        if (!itemId) continue;
        const itemWithId = { ...item, id: itemId };
        await client.query(
          `
          INSERT INTO orca_entities (collection, id, data, updated_at)
          VALUES ($1, $2, $3, NOW())
          ON CONFLICT (collection, id)
          DO UPDATE SET data = EXCLUDED.data, updated_at = NOW()
          WHERE COALESCE(orca_entities.data->>'updatedAt', '') < COALESCE(EXCLUDED.data->>'updatedAt', '');
        `,
          [collection, itemId, JSON.stringify(itemWithId)]
        );
        totalSaved++;
      }
    }

    await client.query('COMMIT');
    return totalSaved;
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    console.error('[PostgreSQL] Error in pushAllToPostgres:', err);
    throw err;
  } finally {
    client.release();
  }
}

/**
 * Generate full SQL DDL and INSERT dump for downloading / offline import into psql / pgAdmin
 */
export async function generateSqlDump(currentMemoryDb: Record<string, any[]>): Promise<string> {
  let sql = `-- =========================================================================
-- ORCA EXPRESS LOGISTICS - POSTGRESQL COMPLETE DATABASE DUMP
-- Generated on: ${new Date().toISOString()}
-- Platform: VPS / Cloud PostgreSQL (14, 15, 16)
-- =========================================================================

SET statement_timeout = 0;
SET lock_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;

${DATABASE_SCHEMA_DDL}

-- =========================================================================
-- DATA INSERTION STATEMENTS
-- =========================================================================
`;

  for (const [collection, items] of Object.entries(currentMemoryDb)) {
    if (!Array.isArray(items) || items.length === 0) continue;

    sql += `\n-- Collection: ${collection} (${items.length} records)\n`;
    for (const item of items) {
      if (!item || !item.id) continue;
      const escapedJson = JSON.stringify(item).replace(/'/g, "''");
      const escapedId = item.id.replace(/'/g, "''");
      const escapedCol = collection.replace(/'/g, "''");

      sql += `INSERT INTO orca_entities (collection, id, data, updated_at) VALUES ('${escapedCol}', '${escapedId}', '${escapedJson}'::jsonb, NOW()) ON CONFLICT (collection, id) DO UPDATE SET data = EXCLUDED.data, updated_at = NOW() WHERE COALESCE(orca_entities.data->>'updatedAt', '') < COALESCE(EXCLUDED.data->>'updatedAt', '');\n`;
    }
  }

  sql += `\n-- Dump Completed Successfully\n`;
  return sql;
}

export function isPostgresActive(): boolean {
  return isConnected;
}

/**
 * Truncates and clears all operational collections in PostgreSQL, leaving only admin users and company branding
 */
export async function clearPostgresOperationalData(): Promise<boolean> {
  const hasConfig = process.env.DATABASE_URL || process.env.PGHOST;
  if (!hasConfig && (!pool || !isConnected)) return false;

  const client = await getPoolClientWithRetry();
  try {
    await client.query('BEGIN');
    // Delete operational records from orca_entities
    await client.query(
      `DELETE FROM orca_entities 
       WHERE collection IN (
         'parcels', 'truckManifests', 'courierManifests', 'transactions', 
         'settlements', 'shiftSettlementVouchers', 'courierIntakeSettlements', 'vouchers', 'customers', 
         'vehicles', 'employees', 'payrollRecords', 'expenses', 'expenseCategories', 
         'fixedAssets', 'directMessages', 'notifications', 'pricingRules', 'branches'
       )`
    );
    // Purge non-admin users
    await client.query(
      `DELETE FROM orca_entities WHERE collection = 'users' AND id != 'usr_general_manager'`
    );
    await client.query('DELETE FROM orca_audit_logs');
    await client.query(`DELETE FROM orca_meta WHERE key NOT IN ('company_branding')`).catch(() => {});
    await client.query('DELETE FROM financial_audit_trail');
    await client.query('COMMIT');
    return true;
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    console.error('[PostgreSQL] Failed to clear operational data:', err);
    return false;
  } finally {
    client.release();
  }
}

/**
 * Fetch financial audit trail records directly from PostgreSQL
 */
export async function getFinancialAuditLogs(limit = 100): Promise<any[]> {
  const hasConfig = process.env.DATABASE_URL || process.env.PGHOST;
  if (!hasConfig && (!pool || !isConnected)) return [];

  try {
    return await queryWithRetry(async (activePool) => {
      const res = await activePool.query(
        `SELECT id, entity_collection, entity_id, event_type, branch_id, user_name, amount, currency,
                old_balance_syp, new_balance_syp, old_balance_usd, new_balance_usd, details, created_at
         FROM financial_audit_trail
         ORDER BY created_at DESC
         LIMIT $1`,
        [limit]
      );
      return res.rows;
    });
  } catch (err) {
    console.error('[PostgreSQL] Failed to fetch financial audit trail:', err);
    return [];
  }
}

/**
 * Idempotent backfill for inter-branch obligations.
 * Runs once at startup. Skips if already executed (tracked in orca_meta).
 * 
 * @param dryRun — if true, returns counts without inserting.
 */
export async function backfillObligationsOnce(dryRun = true): Promise<{
  executed: boolean;
  dryRun: boolean;
  inserted: number;
  skipped: number;
  stats: Array<{ currency: string; payment_type: string; count: number; total_volume: number }>;
}> {
  if (!isPostgresActive()) {
    return { executed: false, dryRun, inserted: 0, skipped: 0, stats: [] };
  }

  // 1. Check flag in orca_meta if not dryRun
  if (!dryRun) {
    try {
      const checkRes = await queryWithRetry(async (activePool) =>
        activePool.query(`SELECT value FROM orca_meta WHERE key = 'obligations_backfill_v1'`)
      );
      if (checkRes.rows.length > 0 && checkRes.rows[0].value?.completed) {
        return { executed: false, dryRun: false, inserted: 0, skipped: 0, stats: [] };
      }
    } catch (err) {
      console.warn('[Obligations Backfill] Flag check warning:', err);
    }
  }

  // 2. DRY-RUN / Statistics Query
  const statsQuery = `
    WITH pre_filtered AS (
      SELECT 
        p.id AS p_id,
        p.data,
        p.created_at AS p_created_at,
        COALESCE(p.data->>'originHubId', p.data->>'originCollectionBranchId') AS origin_id_resolved,
        p.data->>'destinationHubId' AS dest_id_resolved
      FROM orca_entities p
      WHERE p.collection = 'parcels'
    ),
    delivered_parcels AS (
      SELECT 
        pf.p_id,
        pf.data->>'trackingNumber' AS p_tracking,
        COALESCE(pf.data->>'paymentType', 'collect') AS p_payment_type,
        pf.origin_id_resolved AS p_origin_id,
        pf.dest_id_resolved AS p_dest_id,
        COALESCE(pf.data->>'currency', 'SYP') AS p_currency,
        COALESCE(safe_numeric(pf.data->>'codAmount'), 0) AS p_cod,
        COALESCE(safe_numeric(pf.data->>'shippingCost'), 0) AS p_shipping,
        COALESCE(safe_numeric(pf.data->>'transferFee'), 0) AS p_fee,
        safe_boolean(pf.data->>'codPaidToSender', false) AS p_cod_paid,
        CASE 
          WHEN b_dest.commission_rate_shipping IS NULL OR b_dest.commission_rate_shipping = 0 THEN 15 
          ELSE b_dest.commission_rate_shipping 
        END AS dest_comm_rate,
        CASE 
          WHEN b_dest.commission_rate_transfers IS NULL OR b_dest.commission_rate_transfers = 0 THEN 20 
          ELSE b_dest.commission_rate_transfers 
        END AS dest_transfer_comm_rate
      FROM pre_filtered pf
      LEFT JOIN v_branches b_dest ON pf.dest_id_resolved = b_dest.id
      WHERE (pf.data->>'handlingStatus' = 'delivered' OR pf.data->>'status' = 'delivered')
        AND pf.origin_id_resolved IS NOT NULL
        AND pf.dest_id_resolved IS NOT NULL
        AND pf.origin_id_resolved <> pf.dest_id_resolved
    ),
    calculated_obligations AS (
      SELECT
        p_id AS parcel_id,
        p_payment_type,
        p_currency AS currency,
        CASE 
          WHEN p_payment_type = 'prepaid' THEN ROUND((p_shipping * dest_comm_rate) / 100, 2)
          WHEN p_payment_type IN ('cod', 'cod_destination') THEN 
            p_cod + 
            ROUND(p_shipping * (1 - (dest_comm_rate / 100)), 2) + 
            ROUND(p_fee * (1 - (dest_transfer_comm_rate / 100)), 2)
          ELSE ROUND(p_shipping * (1 - (dest_comm_rate / 100)), 2)
        END AS total_obligation_amount
      FROM delivered_parcels
    )
    SELECT 
      currency,
      p_payment_type AS payment_type,
      COUNT(*)::int AS count,
      COALESCE(SUM(total_obligation_amount), 0)::numeric AS total_volume
    FROM calculated_obligations
    WHERE total_obligation_amount > 0
    GROUP BY currency, p_payment_type;
  `;

  let stats: Array<{ currency: string; payment_type: string; count: number; total_volume: number }> = [];
  try {
    const statsRes = await queryWithRetry(async (activePool) => activePool.query(statsQuery));
    stats = statsRes.rows.map((r: any) => ({
      currency: r.currency,
      payment_type: r.payment_type,
      count: Number(r.count),
      total_volume: Number(r.total_volume),
    }));
  } catch (err) {
    console.error('[Obligations Backfill] Failed to compute dry-run stats:', err);
    throw err;
  }

  if (dryRun) {
    const totalCount = stats.reduce((acc, s) => acc + s.count, 0);
    return {
      executed: true,
      dryRun: true,
      inserted: 0,
      skipped: totalCount,
      stats,
    };
  }

  // Pre-insert stats log
  console.log('[Obligations Backfill] Pre-insert stats:', JSON.stringify(stats, null, 2));

  // 3. Execution (INSERT ON CONFLICT DO NOTHING RETURNING id)
  const insertQuery = `
    WITH pre_filtered AS (
      SELECT 
        p.id AS p_id,
        p.data,
        p.created_at AS p_created_at,
        COALESCE(p.data->>'originHubId', p.data->>'originCollectionBranchId') AS origin_id_resolved,
        p.data->>'destinationHubId' AS dest_id_resolved
      FROM orca_entities p
      WHERE p.collection = 'parcels'
    ),
    delivered_parcels AS (
      SELECT 
        pf.p_id,
        pf.data->>'trackingNumber' AS p_tracking,
        COALESCE(pf.data->>'paymentType', 'collect') AS p_payment_type,
        pf.origin_id_resolved AS p_origin_id,
        pf.dest_id_resolved AS p_dest_id,
        COALESCE(pf.data->>'currency', 'SYP') AS p_currency,
        COALESCE(safe_numeric(pf.data->>'codAmount'), 0) AS p_cod,
        COALESCE(safe_numeric(pf.data->>'shippingCost'), 0) AS p_shipping,
        COALESCE(safe_numeric(pf.data->>'transferFee'), 0) AS p_fee,
        safe_boolean(pf.data->>'codPaidToSender', false) AS p_cod_paid,
        pf.data->>'codSenderPayoutVoucherId' AS p_payout_vch_id,
        pf.data->>'codSenderPayoutDate' AS p_payout_date,
        pf.data->>'codSenderPayoutByUserId' AS p_payout_user_id,
        CASE 
          WHEN b_dest.commission_rate_shipping IS NULL OR b_dest.commission_rate_shipping = 0 THEN 15 
          ELSE b_dest.commission_rate_shipping 
        END AS dest_comm_rate,
        CASE 
          WHEN b_dest.commission_rate_transfers IS NULL OR b_dest.commission_rate_transfers = 0 THEN 20 
          ELSE b_dest.commission_rate_transfers 
        END AS dest_transfer_comm_rate,
        pf.p_created_at
      FROM pre_filtered pf
      LEFT JOIN v_branches b_dest ON pf.dest_id_resolved = b_dest.id
      WHERE (pf.data->>'handlingStatus' = 'delivered' OR pf.data->>'status' = 'delivered')
        AND pf.origin_id_resolved IS NOT NULL
        AND pf.dest_id_resolved IS NOT NULL
        AND pf.origin_id_resolved <> pf.dest_id_resolved
    ),
    calculated_obligations AS (
      SELECT
        'obl_' || p_id || '_' || p_currency AS id,
        p_id AS parcel_id,
        p_tracking AS tracking_number,
        CASE 
          WHEN p_payment_type = 'prepaid' THEN 'shipping_only'
          WHEN p_payment_type IN ('cod', 'cod_destination') AND p_shipping > 0 THEN 'cod_and_shipping'
          WHEN p_payment_type IN ('cod', 'cod_destination') THEN 'cod'
          ELSE 'shipping_only'
        END AS obligation_type,
        CASE 
          WHEN p_payment_type = 'prepaid' THEN p_origin_id
          ELSE p_dest_id
        END AS debtor_branch_id,
        CASE 
          WHEN p_payment_type = 'prepaid' THEN p_dest_id
          ELSE p_origin_id
        END AS creditor_branch_id,
        p_currency AS currency,
        CASE WHEN p_payment_type IN ('cod', 'cod_destination') THEN p_cod ELSE 0 END AS cod_amount,
        CASE 
          WHEN p_payment_type = 'prepaid' THEN ROUND((p_shipping * dest_comm_rate) / 100, 2)
          ELSE ROUND(p_shipping * (1 - (dest_comm_rate / 100)), 2)
        END AS shipping_share_amount,
        ROUND((p_shipping * dest_comm_rate) / 100, 2) AS agent_commission_amount,
        CASE 
          WHEN p_payment_type IN ('cod', 'cod_destination') THEN ROUND(p_fee * (1 - (dest_transfer_comm_rate / 100)), 2)
          ELSE 0 
        END AS transfer_fee_share_amount,
        CASE 
          WHEN p_payment_type = 'prepaid' THEN ROUND((p_shipping * dest_comm_rate) / 100, 2)
          WHEN p_payment_type IN ('cod', 'cod_destination') THEN 
            p_cod + 
            ROUND(p_shipping * (1 - (dest_comm_rate / 100)), 2) + 
            ROUND(p_fee * (1 - (dest_transfer_comm_rate / 100)), 2)
          ELSE ROUND(p_shipping * (1 - (dest_comm_rate / 100)), 2)
        END AS total_obligation_amount,
        CASE 
          WHEN p_payment_type = 'prepaid' THEN 'paid'
          WHEN p_cod_paid = true THEN 'paid'
          ELSE 'pending'
        END AS sender_payout_status,
        p_payout_vch_id AS sender_payout_voucher_id,
        safe_timestamptz(p_payout_date) AS sender_payout_at,
        p_payout_user_id AS sender_payout_user_id,
        'pending' AS clearing_status,
        p_created_at AS created_at,
        NOW() AS updated_at
      FROM delivered_parcels
    )
    INSERT INTO inter_branch_obligations (
      id, parcel_id, tracking_number, obligation_type,
      debtor_branch_id, creditor_branch_id, currency,
      cod_amount, shipping_share_amount, agent_commission_amount,
      transfer_fee_share_amount, total_obligation_amount,
      sender_payout_status, sender_payout_voucher_id, sender_payout_at, sender_payout_user_id,
      clearing_status, created_at, updated_at
    )
    SELECT * FROM calculated_obligations
    WHERE total_obligation_amount > 0
    ON CONFLICT (parcel_id, currency) DO NOTHING
    RETURNING id;
  `;

  try {
    const insertRes = await queryWithRetry(async (activePool) => activePool.query(insertQuery));
    const insertedCount = insertRes.rowCount || insertRes.rows.length || 0;
    const totalCount = stats.reduce((acc, s) => acc + s.count, 0);
    const skippedCount = Math.max(0, totalCount - insertedCount);

    console.log(`[Obligations Backfill] Insert result: ${insertedCount} rows inserted, ${skippedCount} rows already existed.`);

    // 4. Save completion flag in orca_meta
    await queryWithRetry(async (activePool) =>
      activePool.query(
        `INSERT INTO orca_meta (key, value, updated_at)
         VALUES ('obligations_backfill_v1', $1, NOW())
         ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()`,
        [JSON.stringify({ completed: true, insertedCount, skippedCount, timestamp: new Date().toISOString() })]
      )
    );

    return {
      executed: true,
      dryRun: false,
      inserted: insertedCount,
      skipped: skippedCount,
      stats,
    };
  } catch (err) {
    console.error('[Obligations Backfill] Insert execution failed:', err);
    throw err;
  }
}

/**
 * Idempotent migration for historical parcel events.
 * Inserts a baseline event for any parcel that does not yet have any record in parcel_events.
 * Runs once at startup. Skips if already executed (tracked in orca_meta).
 * 
 * @param dryRun — if true, returns counts without inserting.
 */
export async function migrateParcelEventsOnce(dryRun = true): Promise<{
  executed: boolean;
  dryRun: boolean;
  inserted: number;
  skipped: number;
}> {
  if (!isPostgresActive()) {
    return { executed: false, dryRun, inserted: 0, skipped: 0 };
  }

  // 1. Check flag in orca_meta if not dryRun
  if (!dryRun) {
    try {
      const checkRes = await queryWithRetry(async (activePool) =>
        activePool.query(`SELECT value FROM orca_meta WHERE key = 'parcel_events_migration_v1'`)
      );
      if (checkRes.rows.length > 0 && checkRes.rows[0].value?.completed) {
        return { executed: false, dryRun: false, inserted: 0, skipped: 0 };
      }
    } catch (err) {
      console.warn('[Parcel Events Migration] Flag check warning:', err);
    }
  }

  // 2. Count parcels without events
  let unmigratedCount = 0;
  try {
    const countRes = await queryWithRetry(async (activePool) =>
      activePool.query(`
        SELECT COUNT(*) AS total
        FROM orca_entities p
        WHERE p.collection = 'parcels'
          AND NOT EXISTS (
            SELECT 1 FROM parcel_events pe WHERE pe.parcel_id = p.id
          )
      `)
    );
    unmigratedCount = parseInt(countRes.rows[0]?.total || '0', 10);
  } catch (err) {
    console.error('[Parcel Events Migration] Count query failed:', err);
    return { executed: false, dryRun, inserted: 0, skipped: 0 };
  }

  if (dryRun) {
    return {
      executed: false,
      dryRun: true,
      inserted: 0,
      skipped: unmigratedCount,
    };
  }

  if (unmigratedCount === 0) {
    // Record flag in orca_meta
    try {
      await queryWithRetry(async (activePool) =>
        activePool.query(`
          INSERT INTO orca_meta (key, value, updated_at)
          VALUES ('parcel_events_migration_v1', $1, NOW())
          ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()
        `, [JSON.stringify({ completed: true, migratedAt: new Date().toISOString(), inserted: 0 })])
      );
    } catch (e) {
      console.warn('[Parcel Events Migration] Failed to set meta flag:', e);
    }
    return { executed: true, dryRun: false, inserted: 0, skipped: 0 };
  }

  // 3. Perform Migration INSERT
  const insertSql = `
    INSERT INTO parcel_events (
      id, parcel_id, tracking_number, event_type, dimension,
      new_status, precedence_rank, branch_id,
      notes, metadata, server_timestamp, created_at
    )
    SELECT
      'evt_' || p.id || '_migrated_' || EXTRACT(EPOCH FROM NOW())::bigint || '_' || SUBSTRING(MD5(RANDOM()::text), 1, 4),
      p.id,
      COALESCE(p.data->>'trackingNumber', ''),
      COALESCE(p.data->>'handlingStatus', 'received_at_hub'),
      'handling',
      COALESCE(p.data->>'handlingStatus', 'received_at_hub'),
      CASE COALESCE(p.data->>'handlingStatus', 'received_at_hub')
        WHEN 'received_at_hub' THEN 10
        WHEN 'received_at_origin_hub' THEN 20
        WHEN 'loaded_in_truck' THEN 30
        WHEN 'in_transit' THEN 40
        WHEN 'received_at_dest' THEN 50
        WHEN 'with_courier' THEN 60
        WHEN 'out_for_delivery' THEN 60
        WHEN 'delivered_uncollected' THEN 70
        WHEN 'returned' THEN 90
        WHEN 'rerouted_forwarded' THEN 90
        WHEN 'delivered' THEN 95
        WHEN 'settled_loss_compensated' THEN 100
        ELSE 0
      END,
      COALESCE(p.data->>'currentLocationBranchId', p.data->>'originHubId'),
      'حدث تأسيسي - ترحيل تاريخي',
      jsonb_build_object(
        'migrated', true,
        'originalStatus', p.data->>'handlingStatus',
        'migratedAt', NOW()
      ),
      COALESCE(p.created_at, NOW()),
      COALESCE(p.created_at, NOW())
    FROM orca_entities p
    WHERE p.collection = 'parcels'
      AND NOT EXISTS (
        SELECT 1 FROM parcel_events pe WHERE pe.parcel_id = p.id
      );
  `;

  try {
    const insertRes = await queryWithRetry(async (activePool) =>
      activePool.query(insertSql)
    );
    const insertedCount = insertRes.rowCount || 0;

    // Record flag in orca_meta
    await queryWithRetry(async (activePool) =>
      activePool.query(`
        INSERT INTO orca_meta (key, value, updated_at)
        VALUES ('parcel_events_migration_v1', $1, NOW())
        ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()
      `, [JSON.stringify({ completed: true, migratedAt: new Date().toISOString(), inserted: insertedCount })])
    );

    return {
      executed: true,
      dryRun: false,
      inserted: insertedCount,
      skipped: 0,
    };
  } catch (err) {
    console.error('[Parcel Events Migration] Execution failed:', err);
    throw err;
  }
}

import { readFile } from 'fs/promises';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

/**
 * Applies schema_v2.sql (idempotent - CREATE TABLE IF NOT EXISTS).
 * Safe to run multiple times. Records flag in orca_meta.
 */
export async function applySchemaV2(): Promise<{
  applied: boolean;
  error?: string;
}> {
  if (!isPostgresActive()) {
    return { applied: false, error: 'PostgreSQL not connected' };
  }

  try {
    // 1. Ensure app_photos table exists regardless of previous flags
    const checkRes = await queryWithRetry(async (pool) =>
      pool.query(
        `SELECT 1 FROM pg_tables WHERE tablename = 'app_photos'`
      )
    );

    if (checkRes.rows.length === 0) {
      await queryWithRetry(async (pool) =>
        pool.query(`
          CREATE TABLE IF NOT EXISTS app_photos (
            key VARCHAR(255) PRIMARY KEY,
            base64_data TEXT NOT NULL,
            mime_type VARCHAR(64) DEFAULT 'image/jpeg',
            size_bytes INTEGER,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
          );
          CREATE INDEX IF NOT EXISTS idx_app_photos_created 
            ON app_photos(created_at DESC);
        `)
      );
      console.log('[Schema v2] app_photos table created.');
    }

    // 2. Check full schema flag
    const flagCheck = await queryWithRetry(async (pool) =>
      pool.query(
        `SELECT value FROM orca_meta WHERE key = 'schema_v2_applied_v2'`
      )
    );
    
    if (flagCheck.rows.length > 0) {
      return { applied: false };
    }

    // Read schema file
    const __filename = fileURLToPath(import.meta.url);
    const __dirname = dirname(__filename);
    const schemaPath = join(__dirname, 'schema_v2.sql');
    
    const schemaSql = await readFile(schemaPath, 'utf-8');

    // Apply
    await queryWithRetry(async (pool) => pool.query(schemaSql));

    // Set flag
    await queryWithRetry(async (pool) =>
      pool.query(
        `INSERT INTO orca_meta (key, value, updated_at)
         VALUES ('schema_v2_applied_v2', $1, NOW())
         ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, 
           updated_at = NOW()`,
        [JSON.stringify({ 
          appliedAt: new Date().toISOString(),
          version: 'v2.1'
        })]
      )
    );

    console.log('[Schema v2] Applied successfully.');
    return { applied: true };
  } catch (err: any) {
    console.error('[Schema v2] Failed:', err);
    return { applied: false, error: err.message };
  }
}

export interface MigrationStats {
  collection: string;
  total: number;
  migrated: number;
  skipped: number;
  failed: number;
  errors: string[];
}

/**
 * Migrates data from orca_entities (JSONB) to app_* relational tables.
 * Idempotent + Dry-run capable.
 */
export async function migrateCollectionsToAppTables(
  dryRun = true
): Promise<{
  executed: boolean;
  dryRun: boolean;
  totalMigrated: number;
  stats: MigrationStats[];
}> {
  if (!isPostgresActive()) {
    throw new Error('PostgreSQL is not connected or active');
  }

  // 1. Check flag if !dryRun
  if (!dryRun) {
    const flagRes = await queryWithRetry(async (pool) =>
      pool.query(`SELECT value FROM orca_meta WHERE key = 'app_tables_migration_v1'`)
    );
    if (flagRes.rows.length > 0) {
      const val = typeof flagRes.rows[0].value === 'string' ? JSON.parse(flagRes.rows[0].value) : flagRes.rows[0].value;
      console.log('[Migration to App Tables] Already completed previously:', val);
      return {
        executed: false,
        dryRun: false,
        totalMigrated: val?.totalMigrated || 0,
        stats: val?.stats || [],
      };
    }
  }

  const allStats: MigrationStats[] = [];

  // Ensure schema_v2 is applied first
  await applySchemaV2();

  // A. Branches
  {
    const stats: MigrationStats = {
      collection: 'branches',
      total: 0,
      migrated: 0,
      skipped: 0,
      failed: 0,
      errors: [],
    };
    try {
      const rowsRes = await queryWithRetry(async (p) =>
        p.query(`SELECT id, data FROM orca_entities WHERE collection = 'branches'`)
      );
      stats.total = rowsRes.rows.length;

      for (const row of rowsRes.rows) {
        const id = row.id;
        const d = row.data || {};
        if (!id || !d.code || !d.name) {
          stats.skipped++;
          continue;
        }

        if (dryRun) {
          stats.migrated++;
        } else {
          try {
            await queryWithRetry(async (p) =>
              p.query(
                `INSERT INTO app_branches (
                  id, name, code, governorate, type, parent_hub_id,
                  box_syp_balance, box_usd_balance,
                  opening_balance_syp, opening_balance_usd,
                  phone, address,
                  commission_rate_shipping, commission_rate_transfers,
                  is_active, created_at, updated_at
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)
                ON CONFLICT (id) DO NOTHING`,
                [
                  id,
                  d.name || 'فرع بدون اسم',
                  d.code || id,
                  d.governorate || 'دمشق',
                  d.type || (d.isMainHub ? 'main_hub' : 'sub_branch'),
                  d.parentHubId || null,
                  Number(d.boxSypBalance) || 0,
                  Number(d.boxUsdBalance) || 0,
                  Number(d.openingBalanceSyp) || 0,
                  Number(d.openingBalanceUsd) || 0,
                  d.phone || null,
                  d.address || null,
                  Number(d.commissionRateShipping) || 15.0,
                  Number(d.commissionRateTransfers) || 20.0,
                  d.isActive !== undefined ? Boolean(d.isActive) : true,
                  d.createdAt ? new Date(d.createdAt) : new Date(),
                  d.updatedAt ? new Date(d.updatedAt) : new Date(),
                ]
              )
            );
            stats.migrated++;
          } catch (rowErr: any) {
            stats.failed++;
            stats.errors.push(`Branch ${id}: ${rowErr.message}`);
          }
        }
      }
    } catch (err: any) {
      stats.errors.push(`Branches general error: ${err.message}`);
    }
    allStats.push(stats);
  }

  // B. Users
  {
    const stats: MigrationStats = {
      collection: 'users',
      total: 0,
      migrated: 0,
      skipped: 0,
      failed: 0,
      errors: [],
    };
    try {
      const rowsRes = await queryWithRetry(async (p) =>
        p.query(`SELECT id, data FROM orca_entities WHERE collection = 'users'`)
      );
      stats.total = rowsRes.rows.length;

      for (const row of rowsRes.rows) {
        const id = row.id;
        const d = row.data || {};
        if (!id || !d.username) {
          stats.skipped++;
          continue;
        }

        if (dryRun) {
          stats.migrated++;
        } else {
          try {
            await queryWithRetry(async (p) =>
              p.query(
                `INSERT INTO app_users (
                  id, username, full_name, password_hash, role, branch_id,
                  phone, is_active, permissions, last_login_at,
                  created_at, updated_at
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
                ON CONFLICT (id) DO NOTHING`,
                [
                  id,
                  d.username.toLowerCase(),
                  d.name || d.username,
                  d.password || d.passwordHash || '123456',
                  d.role || 'cashier',
                  d.branchId && d.branchId.trim() ? d.branchId.trim() : null,
                  d.phone || null,
                  d.isActive !== undefined ? Boolean(d.isActive) : true,
                  JSON.stringify(d.permissions || {}),
                  d.lastLoginAt ? new Date(d.lastLoginAt) : null,
                  d.createdAt ? new Date(d.createdAt) : new Date(),
                  d.updatedAt ? new Date(d.updatedAt) : new Date(),
                ]
              )
            );
            stats.migrated++;
          } catch (rowErr: any) {
            stats.failed++;
            stats.errors.push(`User ${id}: ${rowErr.message}`);
          }
        }
      }
    } catch (err: any) {
      stats.errors.push(`Users general error: ${err.message}`);
    }
    allStats.push(stats);
  }

  // C. Customers
  {
    const stats: MigrationStats = {
      collection: 'customers',
      total: 0,
      migrated: 0,
      skipped: 0,
      failed: 0,
      errors: [],
    };
    try {
      const rowsRes = await queryWithRetry(async (p) =>
        p.query(`SELECT id, data FROM orca_entities WHERE collection = 'customers'`)
      );
      stats.total = rowsRes.rows.length;

      for (const row of rowsRes.rows) {
        const id = row.id;
        const d = row.data || {};
        if (!id || (!d.fullName && !d.name) || !d.phone) {
          stats.skipped++;
          continue;
        }

        if (dryRun) {
          stats.migrated++;
        } else {
          try {
            await queryWithRetry(async (p) =>
              p.query(
                `INSERT INTO app_customers (
                  id, code, full_name, phone, secondary_phone, national_id,
                  city, address, customer_type, is_verified, is_blacklisted,
                  total_shipments_sent, total_shipments_received,
                  total_spent_syp, total_spent_usd,
                  portal_access_enabled, created_at, updated_at
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18)
                ON CONFLICT (id) DO NOTHING`,
                [
                  id,
                  d.code || null,
                  d.fullName || d.name || 'عميل بدون اسم',
                  d.phone,
                  d.secondaryPhone || null,
                  d.nationalId || null,
                  d.city || null,
                  d.address || null,
                  d.customerType || 'individual',
                  Boolean(d.isVerified),
                  Boolean(d.isBlacklisted),
                  Number(d.totalShipmentsSent) || 0,
                  Number(d.totalShipmentsReceived) || 0,
                  Number(d.totalSpentSyp) || 0,
                  Number(d.totalSpentUsd) || 0,
                  Boolean(d.portalAccessEnabled),
                  d.createdAt ? new Date(d.createdAt) : new Date(),
                  d.updatedAt ? new Date(d.updatedAt) : new Date(),
                ]
              )
            );
            stats.migrated++;
          } catch (rowErr: any) {
            stats.failed++;
            stats.errors.push(`Customer ${id}: ${rowErr.message}`);
          }
        }
      }
    } catch (err: any) {
      stats.errors.push(`Customers general error: ${err.message}`);
    }
    allStats.push(stats);
  }

  // D. Parcels + app_parcel_photos
  {
    const stats: MigrationStats = {
      collection: 'parcels',
      total: 0,
      migrated: 0,
      skipped: 0,
      failed: 0,
      errors: [],
    };
    try {
      const rowsRes = await queryWithRetry(async (p) =>
        p.query(`SELECT id, data FROM orca_entities WHERE collection = 'parcels'`)
      );
      stats.total = rowsRes.rows.length;

      for (const row of rowsRes.rows) {
        const id = row.id;
        const d = row.data || {};
        if (!id || !d.trackingNumber || !d.originHubId || !d.destinationHubId) {
          stats.skipped++;
          continue;
        }

        if (dryRun) {
          stats.migrated++;
        } else {
          try {
            await queryWithRetry(async (p) =>
              p.query(
                `INSERT INTO app_parcels (
                  id, tracking_number, paper_receipt_number,
                  origin_branch_id, destination_hub_id, current_location_id,
                  handling_status, payment_type,
                  shipping_cost, currency,
                  cod_amount, cod_currency, cod_paid_to_sender,
                  cod_payout_voucher_id, cod_payout_at, cod_payout_by_user_id,
                  package_type, weight_kg, pieces_count, content_description,
                  sender_data, receiver_data,
                  truck_manifest_id, courier_manifest_id,
                  delivered_at, delivered_by_user_id,
                  returned_at, return_reason,
                  created_at, updated_at
                ) VALUES (
                  $1, $2, $3, $4, $5, $6, $7, $8, $9, $10,
                  $11, $12, $13, $14, $15, $16, $17, $18, $19, $20,
                  $21, $22, $23, $24, $25, $26, $27, $28, $29, $30
                ) ON CONFLICT (id) DO NOTHING`,
                [
                  id,
                  d.trackingNumber,
                  d.paperReceiptNumber || null,
                  d.originHubId,
                  d.destinationHubId,
                  d.currentLocationBranchId || d.originHubId,
                  d.handlingStatus || 'received_at_hub',
                  d.paymentType || 'prepaid',
                  Number(d.shippingCost) || 0,
                  d.shippingCurrency || d.currency || 'SYP',
                  Number(d.codAmount) || 0,
                  d.codCurrency || 'SYP',
                  Boolean(d.codPaidToSender || d.codSenderPayoutStatus === 'paid_to_sender'),
                  d.codPayoutVoucherId || null,
                  d.codPaidAt ? new Date(d.codPaidAt) : null,
                  d.codPaidByUserId || null,
                  d.packageType || 'standard',
                  Number(d.weightKg) || 0,
                  Number(d.piecesCount) || 1,
                  d.contentDescription || null,
                  JSON.stringify(d.sender || {}),
                  JSON.stringify(d.receiver || {}),
                  d.truckManifestId || null,
                  d.courierManifestId || null,
                  d.deliveredAt ? new Date(d.deliveredAt) : null,
                  d.deliveredByUserId || null,
                  d.returnedAt ? new Date(d.returnedAt) : null,
                  d.returnReason || null,
                  d.createdAt ? new Date(d.createdAt) : new Date(),
                  d.updatedAt ? new Date(d.updatedAt) : new Date(),
                ]
              )
            );

            // Extract Base64 Photos if available (skip IndexedDB keys like 'parcel_*' / 'sender_*' / 'cust_*')
            const extractPhoto = async (side: string, photoVal?: string) => {
              if (
                photoVal &&
                typeof photoVal === 'string' &&
                photoVal.startsWith('data:image/')
              ) {
                await queryWithRetry(async (p) =>
                  p.query(
                    `INSERT INTO app_parcel_photos (parcel_id, side, base64_data, mime_type)
                     VALUES ($1, $2, $3, $4)
                     ON CONFLICT (parcel_id, side) DO NOTHING`,
                    [id, side, photoVal, photoVal.split(';')[0]?.replace('data:', '') || 'image/jpeg']
                  )
                ).catch(() => {});
              }
            };

            await extractPhoto('sender_front', d.sender?.idPhotoFront);
            await extractPhoto('sender_back', d.sender?.idPhotoBack);
            await extractPhoto('receiver_front', d.receiver?.nationalIdPhotoUrl || d.receiver?.idPhotoFront);
            await extractPhoto('receiver_back', d.receiver?.nationalIdBackPhotoUrl || d.receiver?.idPhotoBack);
            await extractPhoto('receiver_signature', d.receiver?.signatureUrl || d.signatureUrl);

            stats.migrated++;
          } catch (rowErr: any) {
            stats.failed++;
            stats.errors.push(`Parcel ${id}: ${rowErr.message}`);
          }
        }
      }
    } catch (err: any) {
      stats.errors.push(`Parcels general error: ${err.message}`);
    }
    allStats.push(stats);
  }

  // E. Truck Manifests
  {
    const stats: MigrationStats = {
      collection: 'truckManifests',
      total: 0,
      migrated: 0,
      skipped: 0,
      failed: 0,
      errors: [],
    };
    try {
      const rowsRes = await queryWithRetry(async (p) =>
        p.query(`SELECT id, data FROM orca_entities WHERE collection = 'truckManifests'`)
      );
      stats.total = rowsRes.rows.length;

      for (const row of rowsRes.rows) {
        const id = row.id;
        const d = row.data || {};
        if (!id || !d.manifestNumber || !d.originHubId || !d.destinationHubId) {
          stats.skipped++;
          continue;
        }

        if (dryRun) {
          stats.migrated++;
        } else {
          try {
            await queryWithRetry(async (p) =>
              p.query(
                `INSERT INTO app_truck_manifests (
                  id, manifest_number, origin_hub_id, destination_hub_id,
                  driver_name, driver_phone, truck_plate_number,
                  status, parcel_ids, shortage_parcel_ids, surplus_parcel_ids,
                  parcels_count,
                  dispatched_at, arrived_at, received_at,
                  created_by_user_id, received_by_user_id,
                  notes, created_at, updated_at
                ) VALUES (
                  $1, $2, $3, $4, $5, $6, $7, $8, $9, $10,
                  $11, $12, $13, $14, $15, $16, $17, $18, $19, $20
                ) ON CONFLICT (id) DO NOTHING`,
                [
                  id,
                  d.manifestNumber,
                  d.originHubId,
                  d.destinationHubId,
                  d.driverName || 'سائق غير محدد',
                  d.driverPhone || null,
                  d.truckPlate || d.truckPlateNumber || 'غير محدد',
                  d.status || 'preparing',
                  Array.isArray(d.parcelIds) ? d.parcelIds : [],
                  Array.isArray(d.shortageParcelIds) ? d.shortageParcelIds : [],
                  Array.isArray(d.surplusParcelIds) ? d.surplusParcelIds : [],
                  Array.isArray(d.parcelIds) ? d.parcelIds.length : Number(d.parcelsCount) || 0,
                  d.dispatchedAt ? new Date(d.dispatchedAt) : null,
                  d.arrivedAt ? new Date(d.arrivedAt) : null,
                  d.receivedAt ? new Date(d.receivedAt) : null,
                  d.createdById || d.createdByUserId || null,
                  d.receivedById || d.receivedByUserId || null,
                  d.notes || null,
                  d.createdAt ? new Date(d.createdAt) : new Date(),
                  d.updatedAt ? new Date(d.updatedAt) : new Date(),
                ]
              )
            );
            stats.migrated++;
          } catch (rowErr: any) {
            stats.failed++;
            stats.errors.push(`TruckManifest ${id}: ${rowErr.message}`);
          }
        }
      }
    } catch (err: any) {
      stats.errors.push(`TruckManifests general error: ${err.message}`);
    }
    allStats.push(stats);
  }

  // F. Courier Manifests
  {
    const stats: MigrationStats = {
      collection: 'courierManifests',
      total: 0,
      migrated: 0,
      skipped: 0,
      failed: 0,
      errors: [],
    };
    try {
      const rowsRes = await queryWithRetry(async (p) =>
        p.query(`SELECT id, data FROM orca_entities WHERE collection = 'courierManifests'`)
      );
      stats.total = rowsRes.rows.length;

      for (const row of rowsRes.rows) {
        const id = row.id;
        const d = row.data || {};
        if (!id || !d.manifestNumber || !d.courierId || !d.branchId) {
          stats.skipped++;
          continue;
        }

        if (dryRun) {
          stats.migrated++;
        } else {
          try {
            await queryWithRetry(async (p) =>
              p.query(
                `INSERT INTO app_courier_manifests (
                  id, manifest_number, courier_id, courier_name, branch_id,
                  status, parcel_ids, delivered_parcel_ids, returned_parcel_ids,
                  parcels_count, total_collected_syp, total_collected_usd,
                  assigned_at, settled_at, settled_by_user_id,
                  created_at, updated_at
                ) VALUES (
                  $1, $2, $3, $4, $5, $6, $7, $8, $9, $10,
                  $11, $12, $13, $14, $15, $16, $17
                ) ON CONFLICT (id) DO NOTHING`,
                [
                  id,
                  d.manifestNumber,
                  d.courierId,
                  d.courierName || 'موزع',
                  d.branchId,
                  d.status || 'assigned',
                  Array.isArray(d.parcelIds) ? d.parcelIds : [],
                  Array.isArray(d.deliveredParcelIds) ? d.deliveredParcelIds : [],
                  Array.isArray(d.returnedParcelIds) ? d.returnedParcelIds : [],
                  Array.isArray(d.parcelIds) ? d.parcelIds.length : Number(d.parcelsCount) || 0,
                  Number(d.totalCollectedSyp) || 0,
                  Number(d.totalCollectedUsd) || 0,
                  d.assignedAt ? new Date(d.assignedAt) : null,
                  d.settledAt ? new Date(d.settledAt) : null,
                  d.settledByUserId || null,
                  d.createdAt ? new Date(d.createdAt) : new Date(),
                  d.updatedAt ? new Date(d.updatedAt) : new Date(),
                ]
              )
            );
            stats.migrated++;
          } catch (rowErr: any) {
            stats.failed++;
            stats.errors.push(`CourierManifest ${id}: ${rowErr.message}`);
          }
        }
      }
    } catch (err: any) {
      stats.errors.push(`CourierManifests general error: ${err.message}`);
    }
    allStats.push(stats);
  }

  // G. Transactions
  {
    const stats: MigrationStats = {
      collection: 'transactions',
      total: 0,
      migrated: 0,
      skipped: 0,
      failed: 0,
      errors: [],
    };
    try {
      const rowsRes = await queryWithRetry(async (p) =>
        p.query(`SELECT id, data FROM orca_entities WHERE collection = 'transactions'`)
      );
      stats.total = rowsRes.rows.length;

      for (const row of rowsRes.rows) {
        const id = row.id;
        const d = row.data || {};
        const amount = Number(d.amount);
        if (!id || !d.branchId || isNaN(amount) || amount <= 0) {
          stats.skipped++;
          continue;
        }

        if (dryRun) {
          stats.migrated++;
        } else {
          try {
            await queryWithRetry(async (p) =>
              p.query(
                `INSERT INTO app_transactions (
                  id, branch_id, user_id, type, category,
                  amount, currency,
                  balance_after_syp, balance_after_usd,
                  related_parcel_id, related_voucher_id, reference_id,
                  description, cashbox_scope, metadata, created_at
                ) VALUES (
                  $1, $2, $3, $4, $5, $6, $7, $8, $9, $10,
                  $11, $12, $13, $14, $15, $16
                ) ON CONFLICT (id) DO NOTHING`,
                [
                  id,
                  d.branchId,
                  d.userId || d.createdById || 'usr_system',
                  d.type || 'income',
                  d.category || d.type || 'general',
                  amount,
                  d.currency || 'SYP',
                  Number(d.balanceAfterSyp) || 0,
                  Number(d.balanceAfterUsd) || 0,
                  d.relatedParcelId || d.parcelId || null,
                  d.relatedVoucherId || d.voucherId || null,
                  d.referenceId || null,
                  d.description || 'حركة مالية',
                  d.cashboxScope || 'branch',
                  JSON.stringify(d.metadata || {}),
                  d.createdAt ? new Date(d.createdAt) : new Date(),
                ]
              )
            );
            stats.migrated++;
          } catch (rowErr: any) {
            stats.failed++;
            stats.errors.push(`Transaction ${id}: ${rowErr.message}`);
          }
        }
      }
    } catch (err: any) {
      stats.errors.push(`Transactions general error: ${err.message}`);
    }
    allStats.push(stats);
  }

  // Calculate total migrated count across all collections
  const totalMigratedOverall = allStats.reduce((sum, s) => sum + s.migrated, 0);

  // Set flag if !dryRun
  if (!dryRun) {
    await queryWithRetry(async (p) =>
      p.query(
        `INSERT INTO orca_meta (key, value, updated_at)
         VALUES ('app_tables_migration_v1', $1, NOW())
         ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()`,
        [
          JSON.stringify({
            completedAt: new Date().toISOString(),
            totalMigrated: totalMigratedOverall,
            stats: allStats,
          }),
        ]
      )
    );
  }

  return {
    executed: !dryRun,
    dryRun,
    totalMigrated: totalMigratedOverall,
    stats: allStats,
  };
}



