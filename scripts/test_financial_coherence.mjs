import { PGlite } from '@electric-sql/pglite';
import fs from 'fs';

async function runFinancialCoherenceTest() {
  console.log('================================================================');
  console.log('🧪 VERIFYING FINANCIAL COHERENCE (الترابط المالي للطرود)');
  console.log('================================================================');

  const db = new PGlite();
  if (fs.existsSync('test_dump.sql')) {
    const dumpSql = fs.readFileSync('test_dump.sql', 'utf8');
    await db.exec(dumpSql);
  }

  const branchId = 'br_1';
  const courierName = 'علي المحمدي';
  const courierId = 'usr_courier_dam_01';
  const parcelId = 'pcl_fin_' + Date.now();
  const trackingNumber = 'ORCA-DAM-2026-8888';
  const shippingAmount = 25000;

  // -------------------------------------------------------------
  // Baseline balances
  // -------------------------------------------------------------
  const baseBalRes = await db.query(
    'SELECT live_vault_syp, outgoing_box_syp, courier_box_syp FROM v_branch_live_balances WHERE branch_id = $1;',
    [branchId]
  );
  const baseBal = baseBalRes.rows[0] || { live_vault_syp: 0, outgoing_box_syp: 0, courier_box_syp: 0 };
  const baseCourierBox = Number(baseBal.courier_box_syp || 0);
  const baseOutgoingBox = Number(baseBal.outgoing_box_syp || 0);
  const baseVault = Number(baseBal.live_vault_syp || 0);

  console.log(`[Baseline Balances for ${branchId}]:`);
  console.log(`  courier_box_syp:  ${baseCourierBox.toLocaleString()} ل.س`);
  console.log(`  outgoing_box_syp: ${baseOutgoingBox.toLocaleString()} ل.س`);
  console.log(`  live_vault_syp:   ${baseVault.toLocaleString()} ل.س`);

  // -------------------------------------------------------------
  // Step a: Register prepaid parcel for 25,000 SYP
  // -------------------------------------------------------------
  console.log('\n--- Step a: Registering Prepaid Parcel (25,000 SYP) ---');
  const parcelData = {
    id: parcelId,
    trackingNumber,
    originHubId: branchId,
    destinationHubId: 'br_aleppo_main',
    sender: { name: 'محمد أحمد العلي', phone: '0944112233' },
    receiver: { name: 'علي حسن', phone: '0955223344' },
    paymentType: 'prepaid',
    shippingCost: shippingAmount,
    currency: 'SYP',
    handlingStatus: 'with_courier',
    createdById: courierId,
    registeredByCourierName: courierName,
    createdAt: new Date().toISOString()
  };

  await db.query(`
    INSERT INTO orca_entities (collection, id, data)
    VALUES ('parcels', $1, $2::jsonb);
  `, [parcelId, JSON.stringify(parcelData)]);

  // Record prepaid collection in courier_intake cashbox
  const tx1Id = 'tx_intake_' + Date.now();
  const tx1Data = {
    id: tx1Id,
    branchId,
    type: 'courier_prepaid_collection',
    amount: shippingAmount,
    currency: 'SYP',
    description: `مقبوضات تسجيل طرد ميداني (مدفوع سلفاً) - بوليصة ${trackingNumber} - الموزع: ${courierName}`,
    referenceId: parcelId,
    cashboxScope: 'courier_intake',
    performedByUserName: courierName,
    performedByUserId: courierId,
    timestamp: new Date().toISOString()
  };

  await db.query(`
    INSERT INTO orca_entities (collection, id, data)
    VALUES ('transactions', $1, $2::jsonb);
  `, [tx1Id, JSON.stringify(tx1Data)]);

  // -------------------------------------------------------------
  // Step b: Verify courier_intake_cashbox += 25,000
  // -------------------------------------------------------------
  console.log('\n--- Step b: Verifying courier_intake_cashbox += 25,000 ---');
  const balAfterRegRes = await db.query(
    'SELECT live_vault_syp, outgoing_box_syp, courier_box_syp FROM v_branch_live_balances WHERE branch_id = $1;',
    [branchId]
  );
  const balAfterReg = balAfterRegRes.rows[0];
  const courierBoxAfterReg = Number(balAfterReg.courier_box_syp);

  console.log(`  courier_box_syp after registration: ${courierBoxAfterReg.toLocaleString()} ل.س`);
  if (courierBoxAfterReg !== baseCourierBox + shippingAmount) {
    throw new Error(`Step b FAILED: Expected courier_box_syp to be ${baseCourierBox + shippingAmount}, got ${courierBoxAfterReg}`);
  }
  console.log('  ✅ Step b PASSED: courier_intake_cashbox increased by exactly +25,000 SYP');

  // -------------------------------------------------------------
  // Step c: Courier hands over parcel to branch
  // -------------------------------------------------------------
  console.log('\n--- Step c: Handing over Parcel to Hub (courierHandover) ---');
  const handoverId = 'hov_' + Date.now();
  const now = new Date().toISOString();

  // Update parcel status
  parcelData.handlingStatus = 'received_at_hub';
  parcelData.courierHandedOverToHub = true;
  parcelData.courierHandoverTimestamp = now;
  parcelData.courierIntakeSettled = true;
  parcelData.courierIntakeSettledAt = now;

  await db.query(`
    UPDATE orca_entities
    SET data = $1::jsonb
    WHERE id = $2;
  `, [JSON.stringify(parcelData), parcelId]);

  // Transaction 2: Transfer to outgoing box
  const tx2Id = 'tx_out_' + Date.now();
  const tx2Data = {
    id: tx2Id,
    branchId,
    type: 'courier_handover_to_outgoing',
    amount: shippingAmount,
    currency: 'SYP',
    description: `توريد مبالغ طرد من الموزع [${courierName}] إلى صندوق الصادر بالمركز`,
    referenceId: handoverId,
    cashboxScope: 'outgoing',
    performedByUserName: courierName,
    performedByUserId: courierId,
    timestamp: now
  };
  await db.query(`
    INSERT INTO orca_entities (collection, id, data)
    VALUES ('transactions', $1, $2::jsonb);
  `, [tx2Id, JSON.stringify(tx2Data)]);

  // Transaction 3: Deduction from courier intake
  const tx3Id = 'tx_in_deduct_' + Date.now();
  const tx3Data = {
    id: tx3Id,
    branchId,
    type: 'courier_handover_from_intake',
    amount: shippingAmount,
    currency: 'SYP',
    description: `تسليم وتصفية مقبوضات استلام طرود من عهدة الموزع [${courierName}] - تسليم ${handoverId}`,
    referenceId: handoverId,
    cashboxScope: 'courier_intake',
    performedByUserName: courierName,
    performedByUserId: courierId,
    timestamp: now
  };
  await db.query(`
    INSERT INTO orca_entities (collection, id, data)
    VALUES ('transactions', $1, $2::jsonb);
  `, [tx3Id, JSON.stringify(tx3Data)]);

  // -------------------------------------------------------------
  // Step d & e: Verify balances after handover
  // -------------------------------------------------------------
  console.log('\n--- Step d & e: Verifying Balances after Handover ---');
  const balAfterHandoverRes = await db.query(
    'SELECT live_vault_syp, outgoing_box_syp, courier_box_syp FROM v_branch_live_balances WHERE branch_id = $1;',
    [branchId]
  );
  const balAfterHandover = balAfterHandoverRes.rows[0];
  const courierBoxAfterHandover = Number(balAfterHandover.courier_box_syp);
  const outgoingBoxAfterHandover = Number(balAfterHandover.outgoing_box_syp);
  const vaultAfterHandover = Number(balAfterHandover.live_vault_syp);

  console.log(`  courier_box_syp:  ${courierBoxAfterHandover.toLocaleString()} ل.س (Expected: ${baseCourierBox.toLocaleString()} ل.س)`);
  console.log(`  outgoing_box_syp: ${outgoingBoxAfterHandover.toLocaleString()} ل.س (Expected: ${(baseOutgoingBox + shippingAmount).toLocaleString()} ل.س)`);
  console.log(`  live_vault_syp:   ${vaultAfterHandover.toLocaleString()} ل.س (Expected: ${(baseVault + shippingAmount).toLocaleString()} ل.س)`);

  if (courierBoxAfterHandover !== baseCourierBox) {
    throw new Error(`Step d FAILED: courier_box_syp did not decrease by 25,000 back to base.`);
  }
  console.log('  ✅ Step d PASSED: courier_intake_cashbox -= 25,000 (returned to base)');

  if (outgoingBoxAfterHandover !== baseOutgoingBox + shippingAmount) {
    throw new Error(`Step e FAILED: outgoing_box_syp did not increase by 25,000.`);
  }
  console.log('  ✅ Step e PASSED: outgoing_box += 25,000 (credited to branch outgoing box)');

  // -------------------------------------------------------------
  // Step f: Verify financial_audit_trail recording
  // -------------------------------------------------------------
  console.log('\n--- Step f: Verifying financial_audit_trail entries ---');
  const auditRes = await db.query(`
    SELECT entity_collection, entity_id, amount, currency, branch_id, details->'newData'->>'type' as tx_type
    FROM financial_audit_trail
    WHERE entity_id IN ($1, $2, $3)
    ORDER BY created_at ASC;
  `, [tx1Id, tx2Id, tx3Id]);

  console.log(`  Audit trail records found: ${auditRes.rows.length} / 3`);
  for (const row of auditRes.rows) {
    console.log(`    - [${row.tx_type}] | ID: ${row.entity_id} | Amount: ${row.amount} ${row.currency} | Branch: ${row.branch_id}`);
  }

  if (auditRes.rows.length !== 3) {
    throw new Error(`Step f FAILED: Expected 3 financial audit records, found ${auditRes.rows.length}`);
  }
  console.log('  ✅ Step f PASSED: All 3 financial transactions captured in immutable financial_audit_trail!');

  console.log('\n================================================================');
  console.log('🎉 ALL 6 STEPS OF FINANCIAL COHERENCE VERIFIED WITH 100% SUCCESS');
  console.log('================================================================');
}

runFinancialCoherenceTest().catch((err) => {
  console.error('❌ Test failed:', err);
  process.exit(1);
});
