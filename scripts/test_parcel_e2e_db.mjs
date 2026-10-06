import { PGlite } from '@electric-sql/pglite';
import fs from 'fs';

async function testParcelRegistrationDB() {
  console.log('--- Initializing PostgreSQL Test Database ---');
  const db = new PGlite();
  
  if (fs.existsSync('test_dump.sql')) {
    const dumpSql = fs.readFileSync('test_dump.sql', 'utf8');
    await db.exec(dumpSql);
  }

  // 1. Initial count of parcels
  const initialRes = await db.query("SELECT COUNT(*) as count FROM orca_entities WHERE collection='parcels';");
  const initialCount = parseInt(initialRes.rows[0].count, 10);
  console.log(`Initial parcel count in orca_entities: ${initialCount}`);

  // 2. Insert a new simulated registered parcel from CourierMobileIntake
  const parcelId = 'pcl_test_' + Date.now();
  const trackingNumber = 'ORCA-DAM-2026-9999';
  const parcelData = {
    id: parcelId,
    trackingNumber,
    originHubId: 'br_damascus_main',
    destinationHubId: 'br_aleppo_main',
    sender: {
      name: 'محمد خالد النجار',
      phone: '0944112233',
      nationalId: '01010022334',
      fatherName: 'خالد',
      motherName: 'مريم',
      birthDate: '1988-04-12'
    },
    receiver: {
      name: 'سامر أحمد العلي',
      phone: '0933556677',
      address: 'حلب - الجميلية - شارع الأطباء'
    },
    weightKg: 2.5,
    packageType: 'طرود وبضائع',
    shippingCost: 25000,
    currency: 'SYP',
    paymentType: 'sender_prepaid',
    totalDue: 25000,
    status: 'registered_with_courier',
    createdAt: new Date().toISOString()
  };

  await db.query(`
    INSERT INTO orca_entities (collection, id, data)
    VALUES ('parcels', $1, $2::jsonb);
  `, [parcelId, JSON.stringify(parcelData)]);

  // 3. Final count
  const finalRes = await db.query("SELECT COUNT(*) as count FROM orca_entities WHERE collection='parcels';");
  const finalCount = parseInt(finalRes.rows[0].count, 10);
  console.log(`Final parcel count in orca_entities: ${finalCount}`);

  if (finalCount === initialCount + 1) {
    console.log(`✅ SUCCESS: orca_entities parcel count increased exactly by 1 (${initialCount} -> ${finalCount})`);
  } else {
    throw new Error(`Count did not increment by 1: initial=${initialCount}, final=${finalCount}`);
  }
}

testParcelRegistrationDB().catch(err => {
  console.error('Error running parcel registration DB test:', err);
  process.exit(1);
});
