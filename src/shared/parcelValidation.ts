import { validateBirthDate } from '../utils/birthDateUtility.ts';

export interface ParcelValidationInput {
  packageType?: string;
  senderFirstName?: string;
  senderFatherName?: string;
  senderLastName?: string;
  senderMotherName?: string;
  senderBirthDate?: string;
  senderNationalId?: string;
  senderPhone?: string;
  senderIdPhotoFront?: string;
  senderIdPhotoBack?: string;
  receiverName?: string;
  receiverPhone?: string;
  destinationHubId?: string;
  originHubId?: string;
  destinationAddress?: string;
  activeShippingCost?: number;
  currentPackageTypeMinPrice?: number;
  weightKg?: number;
  packageNotes?: string;
  contentDescription?: string;
  paymentType?: string;
  codAmount?: number;
  codCurrency?: string;
  currency?: string;
  maxCodAllowedFromEngine?: number;
  isManualPricing?: boolean;
}

export interface ParcelValidationResult {
  valid: boolean;
  errors: string[];
  badFields: Record<string, boolean>;
  firstErrorRefId: string | null;
}

/**
 * Unified Parcel Form Validation Rules.
 * Shared strictly between General App (ParcelIntakeView) and Courier App (CourierMobileIntake).
 */
export function validateParcelForm(data: ParcelValidationInput): ParcelValidationResult {
  const errors: string[] = [];
  const badFields: Record<string, boolean> = {};
  let firstErrorRefId: string | null = null;

  // 0. Package Type (نوع الطرد والشحنة)
  if (!data.packageType || !data.packageType.trim()) {
    errors.push('يرجى تحديد واختيار نوع الطرد والشحنة (*)');
    badFields['packageType'] = true;
    if (!firstErrorRefId) firstErrorRefId = 'select_package_type';
  }

  // 1. Mandatory Sender Fields (بيانات المرسل الإلزامية *)
  if (!data.senderFirstName || !data.senderFirstName.trim()) {
    errors.push('الاسم الأول للمرسل مطلوب (الاسم *)');
    badFields['senderFirstName'] = true;
    if (!firstErrorRefId) firstErrorRefId = 'input_sender_first_name';
  }

  if (!data.senderFatherName || !data.senderFatherName.trim()) {
    errors.push('اسم والد المرسل مطلوب (اسم الأب *)');
    badFields['senderFatherName'] = true;
    if (!firstErrorRefId) firstErrorRefId = 'input_sender_father_name';
  }

  if (!data.senderLastName || !data.senderLastName.trim()) {
    errors.push('كنية وعائلة المرسل مطلوبة (الكنية *)');
    badFields['senderLastName'] = true;
    if (!firstErrorRefId) firstErrorRefId = 'input_sender_last_name';
  }

  if (!data.senderMotherName || !data.senderMotherName.trim()) {
    errors.push('اسم أم المرسل مطلوب (اسم الأم *)');
    badFields['senderMotherName'] = true;
    if (!firstErrorRefId) firstErrorRefId = 'input_sender_mother_name';
  }

  const bDateCheck = validateBirthDate(data.senderBirthDate || '');
  if (!bDateCheck.isValid) {
    errors.push(bDateCheck.error || 'تاريخ ولادة المرسل مطلوب (اليوم: 1-31، الشهر: 1-12، السنة: 4 أرقام)');
    badFields['senderBirthDate'] = true;
    if (!firstErrorRefId) firstErrorRefId = 'input_sender_birth_date';
  }

  if (!data.senderNationalId || !data.senderNationalId.trim()) {
    errors.push('الرقم الوطني / رقم الهوية للمرسل مطلوب (الرقم الوطني *)');
    badFields['senderNationalId'] = true;
    if (!firstErrorRefId) firstErrorRefId = 'input_sender_national_id';
  } else if (data.senderNationalId.replace(/\D/g, '').length < 11) {
    errors.push('الرقم الوطني / رقم الهوية يجب أن يتكون من 11 رقماً (*)');
    badFields['senderNationalId'] = true;
    if (!firstErrorRefId) firstErrorRefId = 'input_sender_national_id';
  }

  if (!data.senderPhone || !data.senderPhone.trim()) {
    errors.push('رقم هاتف / جوال المرسل مطلوب (رقم الهاتف *)');
    badFields['senderPhone'] = true;
    if (!firstErrorRefId) firstErrorRefId = 'input_sender_phone';
  } else if (data.senderPhone.replace(/\D/g, '').length < 10) {
    errors.push('رقم هاتف المرسل غير مكتمل (يجب أن لا يقل عن 10 أرقام)');
    badFields['senderPhone'] = true;
    if (!firstErrorRefId) firstErrorRefId = 'input_sender_phone';
  }

  // 1.5 Sender ID Photo Attachment (صورة الهوية الشخصية للمرسل - الوجهان إلزاميان)
  if (!data.senderIdPhotoFront || !data.senderIdPhotoBack) {
    errors.push('صورتا الهوية (الوجه الأمامي والوجه الخلفي) مطلوبتان معاً');
    badFields['senderIdPhoto'] = true;
    if (!firstErrorRefId) firstErrorRefId = !data.senderIdPhotoFront ? 'upload_sender_id_front' : 'upload_sender_id_back';
  }

  // 2. Mandatory Receiver & Destination Fields (بيانات المستلم والوجهة *)
  if (!data.receiverName || !data.receiverName.trim()) {
    errors.push('اسم المستلم الكامل مطلوب (اسم المستلم الكامل *)');
    badFields['receiverName'] = true;
    if (!firstErrorRefId) firstErrorRefId = 'input_receiver_name';
  }

  if (!data.receiverPhone || !data.receiverPhone.trim()) {
    errors.push('رقم هاتف المستلم للتواصل والإبلاغ مطلوب (رقم هاتف المستلم *)');
    badFields['receiverPhone'] = true;
    if (!firstErrorRefId) firstErrorRefId = 'input_receiver_phone';
  } else if (data.receiverPhone.replace(/\D/g, '').length < 10) {
    errors.push('رقم هاتف المستلم غير مكتمل (يجب أن لا يقل عن 10 أرقام)');
    badFields['receiverPhone'] = true;
    if (!firstErrorRefId) firstErrorRefId = 'input_receiver_phone';
  }

  if (!data.destinationHubId || !data.destinationHubId.trim()) {
    errors.push('المركز الوجهة / المحافظة مطلوب (المركز الوجهة *)');
    badFields['destinationHubId'] = true;
    if (!firstErrorRefId) firstErrorRefId = 'select_destination_hub';
  } else if (data.originHubId && data.destinationHubId === data.originHubId) {
    errors.push('المركز الوجهة لا يمكن أن يكون نفس مركز الانطلاق الحالي (يرجى اختيار مركز وجهة آخر)');
    badFields['destinationHubId'] = true;
    if (!firstErrorRefId) firstErrorRefId = 'select_destination_hub';
  }

  if (!data.destinationAddress || !data.destinationAddress.trim()) {
    errors.push('عنوان التسليم أو التوصيل التفصيلي مطلوب ولا يمكن حفظ الطرد بدونه (عنوان التسليم *)');
    badFields['destinationAddress'] = true;
    if (!firstErrorRefId) firstErrorRefId = 'input_destination_address';
  }

  // 3. Shipping Cost Checks (أجور الشحن)
  const shippingCostVal = Number(data.activeShippingCost) || 0;
  if (shippingCostVal <= 0) {
    errors.push('أجور الشحن مطلوبة (يرجى تسجيل أجور الشحن في الحقل المخصص *)');
    badFields['shippingCost'] = true;
    if (!firstErrorRefId) firstErrorRefId = data.isManualPricing ? 'input_manual_shipping_cost' : 'input_weight_kg';
  } else if (data.currentPackageTypeMinPrice && shippingCostVal < data.currentPackageTypeMinPrice) {
    errors.push(
      `أجور الشحن لهذا النوع [${data.packageType || ''}] لا يمكن أن تقل عن الحد الأدنى للتعديل المحدد في محرك الأسعار (*)`
    );
    badFields['shippingCost'] = true;
    if (!firstErrorRefId) firstErrorRefId = data.isManualPricing ? 'input_manual_shipping_cost' : 'input_weight_kg';
  }

  // 4. Weight & Package Notes (وزن الشحنة وملاحظاتها)
  const hasPackageWeightNote = Boolean(
    (data.packageNotes && data.packageNotes.trim().length > 0) ||
    (data.weightKg && Number(data.weightKg) > 0)
  );
  if (!hasPackageWeightNote) {
    errors.push('يرجى كتابة وزن الشحنة وملاحظاتها');
    badFields['packageNotes'] = true;
    badFields['weightKg'] = true;
    if (!firstErrorRefId) firstErrorRefId = data.isManualPricing ? 'input_package_notes' : 'input_weight_kg';
  }

  // 5. Content Description (وصف محتوى الشحنة)
  if (!data.contentDescription || !data.contentDescription.trim()) {
    errors.push('وصف محتوى الشحنة مطلوب (وصف محتوى الشحنة *)');
    badFields['contentDescription'] = true;
    if (!firstErrorRefId) firstErrorRefId = data.isManualPricing ? 'input_content_description' : 'input_content_description_auto';
  }

  // 6. COD (ضد الدفع) Validation
  if (data.paymentType === 'cod') {
    const codVal = Number(data.codAmount) || 0;
    if (codVal <= 0) {
      errors.push('تم اختيار طريقة الدفع (ضد الدفع COD): يجب تسجيل مبلغ الحوالة المالية المطلوبة (*)');
      badFields['codAmount'] = true;
      if (!firstErrorRefId) firstErrorRefId = data.isManualPricing ? 'input_cod_amount_manual' : 'input_cod_amount_auto';
    } else if (data.maxCodAllowedFromEngine && codVal > data.maxCodAllowedFromEngine) {
      errors.push(
        `مبلغ الحوالة يتجاوز السقف الأعلى المسموح به في محرك الأسعار (*)`
      );
      badFields['codAmount'] = true;
      if (!firstErrorRefId) firstErrorRefId = data.isManualPricing ? 'input_cod_amount_manual' : 'input_cod_amount_auto';
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    badFields,
    firstErrorRefId,
  };
}
