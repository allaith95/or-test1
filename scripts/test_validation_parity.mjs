import { validateParcelForm } from '../src/shared/parcelValidation.ts';
import { searchCustomers } from '../src/shared/useCustomerDirectory.ts';

const DUMMY_CUSTOMERS = [
  {
    id: 'cst_1',
    code: 'CST-101',
    fullName: 'محمد أحمد العلي',
    phone: '0933112233',
    secondaryPhone: '0944112233',
    nationalId: '01010101011',
    city: 'دمشق',
    customerType: 'merchant'
  },
  {
    id: 'cst_2',
    code: 'CST-102',
    fullName: 'سامر محمود الحسن',
    phone: '0955667788',
    secondaryPhone: '',
    nationalId: '02020202022',
    city: 'حلب',
    customerType: 'regular'
  },
  {
    id: 'cst_3',
    code: 'CST-103',
    fullName: 'محمد خالد المصري',
    phone: '0988776655',
    secondaryPhone: '',
    nationalId: '03030303033',
    city: 'حمص',
    customerType: 'vip'
  }
];

function runTests() {
  console.log('=== TEST 1: EMPTY MANDATORY FIELD (senderFatherName = "") ===');
  const test1Input = {
    packageType: 'كرتون عادي',
    senderFirstName: 'محمد',
    senderFatherName: '', // EMPTY!
    senderLastName: 'العلي',
    senderMotherName: 'فاطمة',
    senderBirthDate: '1990-05-15',
    senderNationalId: '01010101011',
    senderPhone: '0933112233',
    senderIdPhotoFront: 'data:image/jpeg;base64,...',
    receiverName: 'عمر خالد',
    receiverPhone: '0944556677',
    destinationHubId: 'br_aleppo',
    originHubId: 'br_damascus',
    destinationAddress: 'حلب - السليمانية - شارع الستين',
    activeShippingCost: 5000,
    weightKg: 2.5,
    packageNotes: 'ملابس قطنية',
    contentDescription: 'ألبسة جاهزة',
    paymentType: 'collect'
  };

  const res1 = validateParcelForm(test1Input);
  console.log('Valid:', res1.valid);
  console.log('Errors:', res1.errors);
  console.log('Bad Fields:', res1.badFields);
  if (!res1.valid && res1.errors.some(e => e.includes('اسم والد المرسل مطلوب'))) {
    console.log('=> TEST 1 PASSED: Correctly caught missing senderFatherName.');
  } else {
    throw new Error('TEST 1 FAILED');
  }

  console.log('\n=== TEST 2: MALFORMED FIELD (senderPhone = "123") ===');
  const test2Input = {
    ...test1Input,
    senderFatherName: 'أحمد',
    senderPhone: '123' // Invalid phone < 10 digits
  };

  const res2 = validateParcelForm(test2Input);
  console.log('Valid:', res2.valid);
  console.log('Errors:', res2.errors);
  if (!res2.valid && res2.errors.some(e => e.includes('رقم هاتف المرسل غير مكتمل'))) {
    console.log('=> TEST 2 PASSED: Correctly caught malformed phone number.');
  } else {
    throw new Error('TEST 2 FAILED');
  }

  console.log('\n=== TEST 3: VALID PARCEL INTAKE ===');
  const test3Input = {
    ...test1Input,
    senderFatherName: 'أحمد',
    senderPhone: '0933112233',
    senderIdPhoto: 'data:image/jpeg;base64,front_id_sample',
    senderIdPhotoBack: 'data:image/jpeg;base64,back_id_sample',
  };

  const res3 = validateParcelForm(test3Input);
  console.log('Valid:', res3.valid);
  console.log('Errors Count:', res3.errors.length);
  if (res3.valid && res3.errors.length === 0) {
    console.log('=> TEST 3 PASSED: Valid parcel passed validation 100%.');
  } else {
    throw new Error('TEST 3 FAILED: ' + JSON.stringify(res3.errors));
  }

  console.log('\n=== TEST 4: CUSTOMER SEARCH PARITY ===');
  const queryName = 'محمد';
  const queryPhone = '0955';
  const queryNid = '03030303033';

  const matchesByName = searchCustomers(DUMMY_CUSTOMERS, { query: queryName });
  const matchesByPhone = searchCustomers(DUMMY_CUSTOMERS, { query: queryPhone });
  const matchesByNid = searchCustomers(DUMMY_CUSTOMERS, { query: queryNid });

  console.log(`Search for "${queryName}": found ${matchesByName.length} customers (${matchesByName.map(c => c.fullName).join(', ')})`);
  console.log(`Search for "${queryPhone}": found ${matchesByPhone.length} customers (${matchesByPhone.map(c => c.fullName).join(', ')})`);
  console.log(`Search for "${queryNid}": found ${matchesByNid.length} customers (${matchesByNid.map(c => c.fullName).join(', ')})`);

  if (matchesByName.length === 2 && matchesByPhone.length === 1 && matchesByNid.length === 1) {
    console.log('=> TEST 4 PASSED: Customer search parity verified across name, phone, and national ID.');
  } else {
    throw new Error('TEST 4 FAILED');
  }

  console.log('\n=== ALL VALIDATION AND DIRECTORY PARITY TESTS PASSED SUCCESSFULLY! ===');
}

runTests();
