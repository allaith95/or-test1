import { SystemNotification } from '../types';

export type NotificationCategory =
  | 'remittance'        // 1. تنبيهات الحوالات (أحمر + تنبيه)
  | 'loss'              // 2. تنبيهات الفقدان والنقص التشغيلي الفعلي (أحمر + تنبيه + حركة مميزة)
  | 'manifest_unloaded' // 3. تنبيهات تم تفريغ الحملة بنجاح (برتقالي)
  | 'truck_departure'   // 4. تنبيهات مغادرة سيارة باتجاه المركز (أخضر + تنبيه)
  | 'truck_arrival'     // 5. تنبيهات وصول السيارة للوجهة (أزرق + تنبيه)
  | 'other';            // تنبيهات عامة والنظام

/**
 * الكلمات والعبارات الدالة صراحة على عدم وجود أي نقص أو فقدان
 * (Negation patterns indicating ZERO shortage / successful full delivery)
 */
const EXPLICIT_NO_SHORTAGE_PATTERNS = [
  'دون أي نقص',
  'بدون أي نقص',
  'دون نقص',
  'بدون نقص',
  'لا يوجد نقص',
  'ليس هناك نقص',
  'دون وجود أي نقص',
  'بدون وجود أي نقص',
  'دون أي فقدان',
  'بدون أي فقدان',
  'دون فقدان',
  'بدون فقدان',
  'لا يوجد مفقود',
  'لا توجد طرود مفقودة',
  'لا يوجد طرد مفقود',
  'لا توجد شحنات مفقودة',
  'لا توجد أي طرود مفقودة',
  'دون أي عجز',
  'بدون عجز',
  'دون عجز',
  'سليمة بالكامل',
  'سليمة تماماً',
  'سليم بالكامل',
  'تم العثور على الطرد',
  '0 طرد ناقص',
  '0 طرد مفقود',
  'صفر طرد',
  'تم التفريغ بنجاح',
  'بالكامل دون أي نقص',
  'الشحنات جاهزة للتسليم',
];

export function getNotificationCategory(n: SystemNotification): NotificationCategory {
  const title = (n.title || '').toLowerCase();
  const msg = (n.message || '').toLowerCase();
  const typeStr = (n.type || '') as string;
  const actionTypeStr = (n.actionType || '') as string;
  const combinedText = `${title} ${msg}`;

  // 1. التحقق من نفي النقص صراحة (مثل: "دون أي نقص" أو "بدون نقص" أو "لا يوجد مفقود")
  const isExplicitlyNoShortage = EXPLICIT_NO_SHORTAGE_PATTERNS.some((pattern) =>
    combinedText.includes(pattern.toLowerCase())
  );

  // 2. تصنيف تنبيهات الحوالات والقبض المالي والتحصيلات (Remittance / Cash / COD Payout / Cashier Collect)
  if (
    typeStr === 'cod_payout_due' ||
    typeStr === 'cod_payout_sender' ||
    typeStr === 'cash_settlement' ||
    actionTypeStr === 'cod_payout_sender' ||
    actionTypeStr === 'cashier_collect' ||
    title.includes('حوالة') ||
    title.includes('صرف') ||
    title.includes('تحصيل') ||
    title.includes('مستحقات') ||
    title.includes('صندوق') ||
    msg.includes('حوالة') ||
    msg.includes('صرف مبلغ') ||
    msg.includes('تحصيل طرد') ||
    msg.includes('مستحقات')
  ) {
    return 'remittance';
  }

  // 3. التحقق مما إذا كان الإشعار متعلقاً بتفريغ الحملة / المانافيست / الشاحنة
  const isManifestDischarge =
    typeStr === 'manifest_unloaded' ||
    actionTypeStr === 'manifest_unloaded' ||
    title.includes('تفريغ') ||
    title.includes('تفريع') ||
    title.includes('الشحنات جاهزة للتسليم') ||
    msg.includes('تم تفريغ') ||
    msg.includes('تفريغ الحملة') ||
    msg.includes('تفريغ الشحنة') ||
    msg.includes('تفريغ المانافيست') ||
    msg.includes('جاهزة للتسليم');

  // التحقق من وجود ملخص نقص فعلي بعدد أكبر من صفر
  const hasConfirmedMissingCount = Boolean(
    n.shortageSummary &&
    typeof n.shortageSummary.missingCount === 'number' &&
    n.shortageSummary.missingCount > 0
  );

  // إذا كان تفريغ مانافيست / شاحنة:
  if (isManifestDischarge) {
    // إذا لم يكن هناك نقص حقيقي مؤكد، أو إذا كان النص ينفي النقص صراحة ("دون أي نقص"):
    // فهو حتماً وبشكل قاطع تفريغ شحنة ناجح ولا يمكن تصنيفه كفقدان إطلاقاً
    if (isExplicitlyNoShortage || !hasConfirmedMissingCount) {
      if (!title.includes('تسجيل نقص') && typeStr !== 'shortage_alert') {
        return 'manifest_unloaded';
      }
      if (isExplicitlyNoShortage) {
        return 'manifest_unloaded';
      }
    }
  }

  // 4. تنبيهات الفقدان والنقص التشغيلي الفعلي المؤكد فقط (Loss)
  // شرط حاسم: لا يجوز أبداً تصنيف أي إشعار كفقدان إذا كان ينفي النقص صراحة
  if (!isExplicitlyNoShortage) {
    // وجود ملخص نقص فعلي بعدد أكبر من صفر
    if (hasConfirmedMissingCount) {
      return 'loss';
    }

    // نوع الإشعار أو الإجراء خاص بالنقص/الفقدان الفعلي المؤكد
    if (
      typeStr === 'lost_parcel' ||
      actionTypeStr === 'view_shortage_warehouse' ||
      (typeStr === 'shortage_alert' && !isManifestDischarge) ||
      (actionTypeStr === 'verify_shortage' && !isManifestDischarge)
    ) {
      return 'loss';
    }

    // تحقق نصي حقيقي من الفقدان في العنوان
    const hasLossKeywordsInTitle =
      title.includes('تسجيل نقص') ||
      title.includes('طرد ناقص') ||
      title.includes('طرود ناقصة') ||
      title.includes('طرد مفقود') ||
      title.includes('طرود مفقودة') ||
      title.includes('عجز في الحمولة') ||
      title.includes('فقدان على الطريق') ||
      title.includes('ترحيل طرد مفقود');

    if (hasLossKeywordsInTitle) {
      return 'loss';
    }

    // تحقق نصي في نص الرسالة (فقط إذا لم يكن إشعار تفريغ حمولة)
    const hasLossKeywordsInMsg =
      msg.includes('تسجيل نقص') ||
      msg.includes('طرد ناقص') ||
      msg.includes('طرود ناقصة') ||
      msg.includes('طرد مفقود') ||
      msg.includes('طرود مفقودة') ||
      msg.includes('فقد على الطريق') ||
      msg.includes('عجز في الحمولة');

    if (hasLossKeywordsInMsg && !isManifestDischarge) {
      return 'loss';
    }
  }

  // 5. تنبيهات تم تفريغ الحملة / الشحنة (Manifest Unloaded / Offloaded)
  if (isManifestDischarge) {
    return 'manifest_unloaded';
  }

  // 6. تنبيهات وصول السيارة للوجهة (Vehicle Arrival - وصول الشاحنة لرصيف التفريغ)
  if (
    typeStr === 'truck_arrived' ||
    title.includes('وصلت السيارة') ||
    title.includes('وصلت الشاحنة') ||
    title.includes('وصول الشاحنة') ||
    title.includes('رصيف التفريغ') ||
    msg.includes('وصلت الشاحنة') ||
    msg.includes('وصلت السيارة') ||
    msg.includes('وصلت إلى')
  ) {
    return 'truck_arrival';
  }

  // 7. تنبيهات مغادرة وانطلاق سيارة باتجاه المركز (Vehicle Departure)
  if (
    typeStr === 'truck_dispatched' ||
    title.includes('انطلاق شاحنة') ||
    title.includes('انطلاق سيارة') ||
    title.includes('غادرت الشاحنة') ||
    title.includes('مغادرة الشاحنة') ||
    title.includes('في طريقها إلى') ||
    msg.includes('انطلقت الشاحنة') ||
    msg.includes('غادرت الشاحنة') ||
    msg.includes('في طريقها إلى')
  ) {
    return 'truck_departure';
  }

  return 'other';
}

/**
 * توليد معرّف منع التكرار الذكي للإشعار (Notification Deduplication Key)
 * يضمن عدم تكرار نفس الإشعار إطلاقاً لنفس السبب/الكيان/الحدث التشغيلي
 */
export function getNotificationDedupKey(n: Partial<SystemNotification>): string {
  if (n.dedupKey && typeof n.dedupKey === 'string' && n.dedupKey.trim().length > 0) {
    return n.dedupKey.trim();
  }

  const type = n.type || 'info';
  const relatedId = n.relatedId ? n.relatedId.trim() : '';
  const branchId = n.targetBranchId ? n.targetBranchId.trim() : 'all';
  const userId = n.targetUserId ? n.targetUserId.trim() : 'all';
  const actionType = n.actionType ? n.actionType.trim() : '';

  // 1. إذا كان مرتبطاً بكيان تشغيلي معروف (مانافيست، طرد، سند مالي، موظف)
  if (relatedId) {
    return `dedup_${type}_${relatedId}_${actionType}_${branchId}_${userId}`;
  }

  // 2. إذا كان إشعار طرد ملخص (parcelSummary)
  if (n.parcelSummary?.trackingNumber) {
    return `dedup_${type}_tracking_${n.parcelSummary.trackingNumber.trim()}_${actionType}_${branchId}`;
  }

  // 3. إذا كان إشعار نقص مانافيست (shortageSummary)
  if (n.shortageSummary?.manifestId || n.shortageSummary?.manifestNumber) {
    const mId = n.shortageSummary.manifestId || n.shortageSummary.manifestNumber;
    return `dedup_shortage_${mId}_${branchId}`;
  }

  // 4. معالجة وتطبيع العنوان لاستخراج نمط السبب الأساسي وتجريده من الأرقام المتغيرة (مثل الطوابع الزمنية والتعدادات اللحظية)
  const normalizedTitle = (n.title || '')
    .replace(/[0-9٠-٩]+/g, '#')
    .replace(/\s+/g, '_')
    .trim();

  return `dedup_${type}_${normalizedTitle}_${actionType}_${branchId}_${userId}`;
}

/**
 * فلترة وتوحيد مصفوفة الإشعارات لمنع أي تكرار لنفس السبب
 * يحافظ على أحدث نسخة من الإشعار ويمنع ظهور تكرارات غير مبررة
 */
export function deduplicateNotifications(notifications: SystemNotification[]): SystemNotification[] {
  if (!Array.isArray(notifications) || notifications.length === 0) {
    return [];
  }

  const seenKeys = new Set<string>();
  const seenIds = new Set<string>();
  const result: SystemNotification[] = [];

  for (const notif of notifications) {
    if (!notif) continue;
    
    // إذا كان نفس الـ id مكرر
    if (notif.id && seenIds.has(notif.id)) {
      continue;
    }

    const key = getNotificationDedupKey(notif);
    if (seenKeys.has(key)) {
      // إشعار لنفس السبب والكيان موجود مسبقاً -> منع التكرار
      continue;
    }

    if (notif.id) {
      seenIds.add(notif.id);
    }
    seenKeys.add(key);
    result.push(notif);
  }

  return result;
}

