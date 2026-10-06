-- =========================================================================
-- ORCA EXPRESS LOGISTICS - POSTGRESQL COMPLETE DATABASE DUMP
-- Generated on: 2026-10-04T07:35:31.701Z
-- Platform: VPS / Cloud PostgreSQL (14, 15, 16)
-- =========================================================================

SET statement_timeout = 0;
SET lock_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;


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


-- =========================================================================
-- DATA INSERTION STATEMENTS
-- =========================================================================

-- Collection: users (1 records)
INSERT INTO orca_entities (collection, id, data, updated_at) VALUES ('users', 'usr_1', '{"id":"usr_1","username":"admin","role":"admin"}'::jsonb, NOW()) ON CONFLICT (collection, id) DO UPDATE SET data = EXCLUDED.data, updated_at = NOW() WHERE COALESCE(orca_entities.data->>'updatedAt', '') < COALESCE(EXCLUDED.data->>'updatedAt', '');

-- Collection: branches (1 records)
INSERT INTO orca_entities (collection, id, data, updated_at) VALUES ('branches', 'br_1', '{"id":"br_1","name":"Damascus HQ","code":"DAM"}'::jsonb, NOW()) ON CONFLICT (collection, id) DO UPDATE SET data = EXCLUDED.data, updated_at = NOW() WHERE COALESCE(orca_entities.data->>'updatedAt', '') < COALESCE(EXCLUDED.data->>'updatedAt', '');

-- Dump Completed Successfully
