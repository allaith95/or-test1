export type Governorate =
  | 'دمشق'
  | 'ريف دمشق'
  | 'حلب'
  | 'حمص'
  | 'حماة'
  | 'اللاذقية'
  | 'طرطوس'
  | 'السويداء'
  | 'درعا'
  | 'دير الزور'
  | 'الحسكة'
  | 'الرقة'
  | 'إدلب'
  | 'القنيطرة';

export type BranchType = 'main_hub' | 'collection_point' | 'agent';

export interface Branch {
  id: string;
  code: string;
  name: string;
  type: BranchType;
  governorate: Governorate;
  parentHubId?: string; // If collection point, linked to main hub
  commissionRateShipping: number; // e.g. 15%
  commissionRateTransfers: number; // e.g. 20% of transfer fee
  shippingCommissionPercent?: number;
  codCommissionPercent?: number;
  boxSypBalance: number; // Cashbox 1: SYP
  boxUsdBalance: number; // Cashbox 2: USD
  openingBalanceSyp?: number;
  openingBalanceUsd?: number;
  address: string;
  phone: string;
  managerName: string;
  isActive: boolean;
  isMainHub?: boolean;
  isCentralHub?: boolean;
  city?: string;
  createdAt?: string;
  updatedAt?: string;
}

export type UserRole =
  | 'super_admin'
  | 'hub_manager'
  | 'outbound_operator'
  | 'inbound_operator'
  | 'reception_data_entry'
  | 'warehouse_keeper'
  | 'warehouseman'
  | 'cashier'
  | 'accountant'
  | 'operations'
  | 'courier'
  | 'driver'
  | 'custom';

export type ActiveModule =
  | 'dashboard'
  | 'intake'
  | 'manifests'
  | 'arrivals'
  | 'delivery'
  | 'cashbox'
  | 'pricing'
  | 'admin_users'
  | 'backup_cloud'
  | 'master_admin'
  | 'expenses'
  | 'customers'
  | 'vehicles'
  | 'payroll'
  | 'fixed_assets'
  | 'courier_portal'
  | 'customer_portal';

export type PricingPolicyMode = 'manual_pricing';
export type ShippingCategory = 'postal' | 'cargo'; // بريدي | شحن بضائع

export type PermissionActionType = 'view' | 'create' | 'edit' | 'delete' | 'export_print' | 'special';

export interface PermissionItem {
  key: string;
  label: string;
  action: PermissionActionType;
  isSensitive?: boolean;
}

export interface PermissionCategory {
  id: string;
  label: string;
  description: string;
  icon: string;
  items: PermissionItem[];
}

export interface UserModulePermissions {
  dashboard: boolean;
  intake: boolean;
  manifests: boolean;
  arrivals: boolean;
  delivery: boolean;
  cashbox: boolean;
  pricing: boolean;
  designer?: boolean;
  admin_users: boolean;
  backup_cloud: boolean;
  master_admin?: boolean;
  customers?: boolean;
  vehicles?: boolean;
  employees_payroll?: boolean;
  payroll?: boolean;
  expenses?: boolean;
  fixed_assets?: boolean;
  courier_portal?: boolean;
}

export interface UserFieldRestrictions {
  canViewFinancialTotals: boolean;
  canViewClientPhoneNumbers: boolean;
  canViewNationalId: boolean;
  canOverridePrices: boolean;
  canSwitchBranches: boolean;
  canDeleteRecords: boolean;
  canDisburseNegativeBalance?: boolean; // السماح بالصرف بالسالب وتجاوز الرصيد المتوفر في الصندوق
}

export interface UserPermissions {
  modules: UserModulePermissions;
  actions: Record<string, boolean>;
  fieldRestrictions: UserFieldRestrictions;
  allowedShortcuts?: string[]; // معرّفات أزرار واختصارات لوحة الإختصارات المصرح للمستخدم الوصول لها
}

export interface User {
  id: string;
  name: string;
  username: string;
  password?: string;
  passwordChangedAt?: string;
  pin?: string;
  role: UserRole;
  branchId?: string; // اختياري - المدير العام معزول عن أي فرع ولا يتبع لأي فرع
  allowedBranchIds?: string[]; // Multiple allowed branches if permitted
  canSwitchBranches?: boolean;
  phone: string;
  nationalId?: string;
  avatar?: string;
  isActive: boolean;
  permissions?: UserPermissions;
  employeeId?: string; // Linked Employee Card from Employees Directory
  vehicleType?: string; // نوع المركبة (دراجة نارية، سيارة، فان)
  vehiclePlate?: string; // رقم اللوحة
  coverageArea?: string; // قطاع / منطقة التوزيع
  notes?: string; // ملاحظات إضافية
  createdAt?: string;
  updatedAt?: string;
}

export type DigitStyle = 'latin' | 'arabic_indic'; // أرقام إنكليزية/لاتينية (123) | أرقام عربية مشرقية (١٢٣)
export type ThousandsSeparator = 'comma' | 'dot' | 'space' | 'apostrophe' | 'none'; // , | . | مسافة | ' | بدون
export type DecimalSeparator = 'dot' | 'comma' | 'arabic_comma'; // . | , | ٫

export interface NumberFormatSettings {
  digitStyle: DigitStyle; // نمط شكل الأرقام: لاتينية (123) أو عربية مشرقية (١٢٣)
  thousandsSeparator: ThousandsSeparator; // فاصلة الآلاف: فاصلة عادية، نقطة، مسافة، أو بدون
  decimalSeparator: DecimalSeparator; // فاصلة الكسور العشرية: نقطة، فاصلة، أو فاصلة عربية
  sypDecimals: number; // عدد الخانات العشرية لمبالغ الليرة السورية (الافتراضي: 0)
  usdDecimals: number; // عدد الخانات العشرية لمبالغ الدولار الأمريكي (الافتراضي: 2)
  quantityDecimals: number; // عدد الخانات العشرية للكميات وعدد الطرود (الافتراضي: 0)
  weightDecimals: number; // عدد الخانات العشرية للأوزان كغ والحجوم م³ (الافتراضي: 2)
  hideTrailingZeros: boolean; // إخفاء الأصفار العشرية الزائدة إذا كانت أصفاراً (مثلاً 15 بدلاً من 15.00)
  compactLargeNumbers: boolean; // اختصار الأرقام الكبيرة عند تفعيلها (مثلاً 1.5M أو 250K)
  currencyPosition: 'suffix' | 'prefix'; // موضع رمز العملة: بعد الرقم (15,000 ل.س) أو قبل الرقم ($100)
}

export interface PackageTypeRateInfo {
  fixedPriceSyp?: number;
  fixedPriceUsd?: number;
  minPriceSyp?: number; // الحد الأدنى المسموح به لتعديل أجور الشحن بالليرة السورية
  minPriceUsd?: number; // الحد الأدنى المسموح به لتعديل أجور الشحن بالدولار الأمريكي
  notes?: string;
  autoApply?: boolean;
}

export interface CompanyBrandingSettings {
  companyName: string;
  companySubtitle: string;
  logoUrl: string; // أيقونة وشعار التطبيق والواجهة الرقمية
  printLogoUrl?: string; // شعار المطبوعات والورقيات الرسمية (أبيض وأسود / ورق رسمي)
  appBackgroundUrl?: string; // صورة خلفية التطبيق وسطح المكتب المخصصة
  officialPhone: string;
  customerServicePhone?: string; // رقم خدمة الزبائن المعتمد للمطبوعات والبوالص والإيصالات الرسمية
  officialEmail: string;
  headquartersAddress: string;
  taxNumber: string;
  commercialRegistry: string;
  receiptHeaderNotes: string;
  receiptFooterTerms: string;
  manifestFooterNotes: string;
  appTheme: 'mac_dark' | 'emerald_luxury' | 'midnight_navy' | 'high_contrast';
  accentColor: string;
  exchangeRateUsdToSyp: number; // e.g. 15000 SYP
  fuelSurchargePercent: number; // e.g. 5%
  enableMultiCurrency: boolean;
  allowMultiCurrencyDelivery?: boolean; // خيار السماح بتعدد العملات في تسليم الطرود: عند قفله (false) يمنع التحويل ويقفل خيار تحديد نوع القبض وتلزم كل عملة بعملتها
  autoPrintAfterIntake: boolean;
  activePricingPolicy: PricingPolicyMode; // 'manual_pricing' | 'automated_matrix' | 'hybrid_flexible'
  defaultShippingCategory?: ShippingCategory; // 'postal' | 'cargo'
  packageTypes?: string[]; // أنواع الطرود المعتمدة في النظام وإدخال البيانات
  idDocumentTypes?: string[]; // أنواع وثائق الهوية المعتمدة في النظام وإدخال البيانات
  packageTypeMode?: 'manual_text' | 'directory_dropdown'; // خيار نمط إدخال نوع الطرد (يدوي / دليل)
  packageTypeRates?: Record<string, PackageTypeRateInfo>; // خريطة ربط الأجور الثابتة لكل نوع طرد
  numberFormatSettings?: NumberFormatSettings; // إعدادات ونمط إظهار الأرقام والكسور والفواصل
  updatedAt?: string; // توقيت التحديث الأخير لضمان دقة مزامنة إعدادات الهوية
}

export interface AuditLogEntry {
  id: string;
  action: string;
  category: 'auth' | 'cashbox' | 'pricing' | 'users' | 'branches' | 'system' | 'parcels' | 'manifests' | 'branding' | 'alerts';
  details: string;
  userId: string;
  userName: string;
  branchId: string;
  timestamp: string;
}

export type PackageType =
  | 'كرتون عادي'
  | 'طرد هش / قابل للكسر'
  | 'شوال / خيشة ملابس'
  | 'مواد سائلة ومستحضرات'
  | 'قطع غيار ومعدات'
  | 'وثائق ومستندات هامة'
  | 'أجهزة إلكترونية'
  | 'مفروشات وأثاث'
  | (string & {});

export type PaymentType = 'prepaid' | 'collect' | 'cod' | 'cod_destination'; // مدفوع سلفاً | على المستلم | ضد الدفع

export type Currency = 'SYP' | 'USD';

export type HandlingStatus =
  | 'received_at_hub' // مسجل في المركز
  | 'received_at_origin_hub' // مسجل بمركز الانطلاق
  | 'loaded_in_truck' // محمل بالسيارة
  | 'in_transit' // في الطريق بين المحافظات
  | 'received_at_dest' // واصل لمستودع الاستلام
  | 'rerouted_forwarded' // تمت إعادة توجيهه لجهة جديدة وبوليصة جديدة
  | 'shortage_missing' // نقص عند تفريغ المانافيست
  | 'leftover_origin_warehouse' // طرد ناقص متبقي في مستودع الصادر من شحنات سابقة
  | 'lost_in_transit' // طرد مفقود على الطريق
  | 'settled_loss_compensated' // طرد مفقود تمت تسويته وتعويضه
  | 'with_courier' // مع الموزع في عهدته
  | 'out_for_delivery' // خارج للتسليم مع المندوب
  | 'delivered' // تم التسليم للزبون
  | 'delivered_uncollected' // تم التسليم للزبون بدون قبض (ذمة على الموزع)
  | 'returned' // راجع / أعلن الموزع الإرجاع وبانتظار تسليمه للفرع
  | 'returned_received_at_branch' // استلمه الفرع فعلياً وسقطت عهدة الموزع
  | 'return_initiated' // مرتجع مُعلن من الفرع قبل التسليم
  | 'returning_to_origin' // في الطريق العكسي للشحن لفرع الأصل
  | 'returned_to_origin' // وصلت واستلمت بفرع الأصل بانتظار تسليمها للمرسل
  | 'returned_to_sender'; // سُلم المرتجع للمرسل الأصلي باليد وإغلاق البوليصة

export const PRE_DELIVERY_RETURN_REASONS = [
  'المستلم ألغى الطلب',
  'المرسل ألغى الشحنة',
  'العنوان خاطئ / غير موجود',
  'تعذّر الوصول للمستلم',
  'مشكلة في الدفع',
  'طرد مكرر',
  'خطأ في التسجيل',
  'سبب آخر',
] as const;

export type PreDeliveryReturnReason = typeof PRE_DELIVERY_RETURN_REASONS[number];

export interface Dimensions {
  lengthCm: number;
  widthCm: number;
  heightCm: number;
}

export type IdDocumentType = string; // نوع الوثيقة: هوية سورية / فلسطيني / حكومة إنقاذ / جواز سفر / إخراج قيد إلخ

export interface PartyInfo {
  name: string;
  firstName?: string;
  fatherName?: string;
  lastName?: string;
  motherName?: string;
  birthDate?: string;
  nationalId?: string; // 11-digit National ID (Syrian or Palestinian)
  idType?: IdDocumentType; // 'syrian' | 'palestinian'
  phone: string;
  city: string;
  address?: string;
  customerId?: string;
  idPhotoFront?: string;
  idPhotoBack?: string;
}

export interface ReceiverInfo extends PartyInfo {
  nationalIdPhotoUrl?: string;
  nationalIdBackPhotoUrl?: string;
  nationalIdScanned?: boolean;
  actualReceiverName?: string;
  receiverRelation?: string;
  idMotherName?: string;
  idFatherName?: string;
  idBirthPlace?: string;
  idCivilRecord?: string;
  signatureUrl?: string;
}

export type PricingBasis = 'auto' | 'weight_only' | 'volume_only' | 'size_tier_only'; // نوع التسعير: تلقائي (الأعلى) | وزن فقط | حجم CBM فقط | حسب فئة الحجم

export type ParcelSizeTier =
  | 'extra_small' // صغير جداً (مغلفات / وثائق / إكسسوارات خفيفة - حتى 0.005 م³)
  | 'small' // صغير (علب صغيرة / هواتف / ملابس - حتى 0.02 م³)
  | 'medium' // حجم متوسط (كرتونة قياسية - حتى 0.06 م³)
  | 'large' // حجم كبير (كرتونة تجارية / حقائب ضخمة - حتى 0.15 م³)
  | 'extra_large'; // كبير جداً (شحنات كبرى / معدات / أثاث - أكثر من 0.15 م³)

export interface Parcel {
  id: string;
  trackingNumber: string; // e.g. ORK-2026-8901
  paperReceiptNumber: string; // الرقم الورقي القادم من الفرع الثانوي
  originHubId: string;
  originCollectionBranchId?: string;
  destinationHubId: string;
  destinationAddress: string;
  sender: PartyInfo;
  receiver: ReceiverInfo;
  packageType: PackageType;
  shippingCategory?: ShippingCategory; // 'postal' | 'cargo' (بريدي أو شحن بضائع)
  packageNotes?: string; // حقل ملاحظة ومواصفات جانب نوع الطرد
  sizeTier?: ParcelSizeTier;
  weightKg: number;
  dimensions: Dimensions;
  volumeCbm: number;
  piecesCount: number;
  contentDescription: string;
  specialInstructions?: string;
  paymentType: PaymentType;
  currency: Currency;
  shippingCurrency?: Currency; // عملة أجور الشحن المنفصلة إن وجدت
  codCurrency?: Currency; // عملة الحوالة المالية المقيدة على البوليصة
  transferFeeCurrency?: Currency; // عملة عمولة الحوالة
  shippingCost: number;
  isManualPricing?: boolean; // هل تم التسعير وفق السياسة اليدوية
  manualShippingCost?: number; // أجار الشحن المحدد يدوياً
  transferredAmount?: number; // مبلغ محوّل (مثلاً لدفع أجور الموزع في الجهة المقابلة وتخصم من حصة الشركة بالمقاصة)
  transferredAmountReason?: string; // ملاحظة التحويل (السبب)
  transferredAmountCurrency?: Currency; // عملة المبلغ المحول (ل.س أو دولار)
  codAmount: number; // قيمة البضاعة المحولة للمرسل إن وجد
  transferFee: number; // عمولة الحوالة المالية
  codShippingPayer?: 'sender' | 'recipient'; // أجور الشحن في ضد الدفع: على المرسل (sender) أو على المستلم (recipient - الافتراضي)
  totalDue: number; // الإجمالي المالي المطلوب تحصيله
  pricingBasis?: PricingBasis; // طريقة التسعير المعتمدة
  distanceKm?: number;
  handlingStatus: HandlingStatus;
  truckManifestId?: string;
  courierManifestId?: string;
  customerId?: string;
  createdAt: string; // ISO
  createdById: string;
  createdByName?: string; // اسم مدخل البيانات
  // Warehouse aging & alerts
  arrivedAtDestAt?: string; // وقت الوصول لمستودع الاستلام
  storageGraceDays: number; // مهلة السماح (افتراضي 3 أيام)
  notifiedAt?: string; // وقت الضغط على زر "تم إبلاغ المستلم"
  notifiedByUserId?: string;
  notificationDueHours: number; // مهلة الحضور بعد الإبلاغ (مثلاً 24 ساعة)
  deliveredAt?: string;
  deliveredByUserId?: string;
  deliveryNotes?: string;
  returnReason?: string;
  returnNotes?: string;
  returnedAt?: string; // ISO timestamp
  returnedByUserId?: string;
  returnedByUserName?: string;
  receivedBackAtBranchId?: string; // الفرع الذي استلمه
  receivedBackAt?: string; // متى استُلم
  receivedBackByUserId?: string;
  assignedCourierId?: string; // معرف الموزع المكلف
  returnShippingCost?: number; // تكلفة الشحن العكسي لفرع الأصل
  returnShippingPaidBy?: 'sender' | 'company' | 'customer' | 'undecided'; // الطرف المتحمل لتكلفة الإرجاع
  returnFinancialStatus?: 'pending' | 'settled'; // الحالة المالية لأجور الإرجاع
  returnFinancialNotes?: string; // ملاحظات التسوية المالية للمرتجع
  isReverseShipment?: boolean; // هل هي شحنة مرتجعة في طريق العودة لفرع الأصل

  // A1: Return Pickup Deadlines (مهلة استلام المرتجع للأصل)
  returnPickupDeadline?: string; // ISO timestamp (30 يوم من تاريخ الوصول للأصل)
  returnPickupStatus?: 'pending' | 'overdue' | 'abandoned';

  // A2: Return Payment Status & Debt (ذمم وأجور الشحن العكسي عند التسليم)
  returnPaymentStatus?: 'pending' | 'paid' | 'refused';
  returnDebtAmount?: number;

  // B: Pre-delivery Return Fields (إرجاع قبل خروج الموزع للتسليم)
  returnInitiatedAt?: string;
  returnInitiatedByUserId?: string;
  returnInitiatedByUserName?: string;
  returnInitiatedReason?: string;
  returnInitiatedNotes?: string;
  returnSourceBranchId?: string;
  returnOriginalOriginHubId?: string;
  shortageNote?: string;
  collectedAmount?: number;
  collectedSyp?: number; // المقبوض بالليرة السورية
  collectedUsd?: number; // المقبوض بالدولار الأمريكي
  cashierForwarded?: boolean; // هل تم تحويل القبض لأمين الصندوق
  cashierForwardedAt?: string;
  cashierForwardedByUserId?: string;
  cashierForwardedByUserName?: string;
  cashierCollected?: boolean; // هل تم القبض الفعلي من قبل أمين الصندوق
  cashierCollectedAt?: string;
  cashierCollectedByUserId?: string;
  cashierCollectedByUserName?: string;
  cashierCollectedSyp?: number;
  cashierCollectedUsd?: number;
  cashierCollectionNotes?: string;
  cashierPaymentMethod?: string;
  assignedCourierName?: string;
  isCodCollectedByCashier?: boolean;
  codPayoutStatus?: 'pending_collection' | 'collected_ready' | 'paid_to_sender';
  codPayoutDate?: string;
  codPayoutVoucherNo?: string;
  senderName?: string;
  receiverName?: string;
  priceSyp?: number;
  originBranchId?: string;
  appliedBasis?: string;
  registeredByUserName?: string;
  // Courier Field Intake & Center Handover
  isCourierPickup?: boolean; // هل تم استلام الطرد ميدانياً بواسطة موزع
  collectedByCourierId?: string; // معرف الموزع المستلم ميدانياً
  collectedByCourierName?: string; // اسم الموزع المستلم ميدانياً
  registeredByCourierName?: string; // اسم الموزع المنفذ
  courierHandedOverToHub?: boolean; // هل تم تسليم الطرد لمركز الانطلاق
  courierHandoverTimestamp?: string; // توقيت تسليم الطرد لمركز الانطلاق
  // Shortage & Lost Parcel Lifecycle
  shortageStatus?: 'none' | 'pending_origin_verification' | 'confirmed_at_origin' | 'confirmed_lost_in_transit' | 'settled_loss';
  isRecoveredFromPreviousShortage?: boolean;
  previousShortageManifestNumber?: string;
  lastManifestId?: string; // مرجع المانافيست السابق بعد تأكيد الوجود
  lastManifestDispatchedAt?: string; // تاريخ انطلاق المانافيست السابق
  loadedInTruckAt?: string; // تاريخ تحميل الطرد بالشاحنة
  shortageManifestId?: string;
  shortageManifestNumber?: string;
  shortageReportedAt?: string;
  shortageReportedByBranchId?: string;
  shortageReportedByBranchName?: string;
  shortageOriginBranchId?: string;
  shortageResolutionNotes?: string;
  shortageResolvedAt?: string;
  shortageResolvedByUserId?: string;
  shortageResolvedByUserName?: string;
  currentLocationBranchId?: string;
  storedWarehouseType?: 'standard_received' | 'leftover_previous_shipments' | 'lost_parcels';
    lossCompensationDetails?: {
    settlementType?: 'administrative_compensation' | 'parcel_recovered' | 'waived';
    isAdministrativeExpense?: boolean;
    compensationAmount: number;
    currency: Currency;
    beneficiaryName: string;
    beneficiaryPhone?: string;
    responsibleParty: 'company' | 'driver' | 'insurance' | 'shared';
    voucherId?: string;
    voucherNumber?: string;
    settledAt: string;
    settledByUserId: string;
    settledByUserName: string;
    notes?: string;
  };
  // Rerouting / Forwarding (إعادة التوجيه)
  isRerouted?: boolean;
  reroutedFromParcelId?: string;
  reroutedFromTrackingNumber?: string;
  reroutedToParcelId?: string;
  reroutedToTrackingNumber?: string;
  carriedOverDueAmount?: number; // المبلغ المحول/المرحل من البوليصة السابقة
  carriedOverNotes?: string;
  reroutedAt?: string;
  reroutedByUserId?: string;
  reroutedByUserName?: string;
  rerouteReason?: string;
  // COD Sender Remittance Payout (صرف وتسليم حوالة ضد الدفع للمرسل)
  codStatus?: 'pending_collection' | 'collected_awaiting_sender_payout' | 'sender_notified' | 'paid_to_sender';
  codCollectedAt?: string;
  codSenderNotified?: boolean;
  codSenderNotifiedAt?: string;
  codSenderNotifiedByUserId?: string;
  codSenderNotifiedByUserName?: string;
  codSenderNotifiedMethod?: 'whatsapp' | 'sms' | 'call' | 'in_person';
  codSenderNotifiedNotes?: string;
  codPaidToSender?: boolean;
  codSenderPayoutDate?: string;
  codSenderPayoutByUserId?: string;
  codSenderPayoutByUserName?: string;
  codSenderPayoutBranchId?: string;
  codSenderPayoutAmountSyp?: number;
  codSenderPayoutAmountUsd?: number;
  codSenderPayoutVoucherId?: string;
  codSenderPayoutVoucherNumber?: string;
  codSenderPayoutNotes?: string;
  codSenderRecipientName?: string;
  codSenderRecipientNationalId?: string;
  codSenderRecipientPhone?: string;
  // Courier Intake Cashbox & Hub Reception Settlement (تسجيل الطرود ومقبوضات الموزع الميدانية)
  courierIntakeSettled?: boolean; // هل تم ترصيد وتسليم مقبوضات الطرد لفرع الانطلاق
  courierIntakeSettledAt?: string; // وقت التسليم والترصيد
  courierIntakeSettledVoucherId?: string;
  courierIntakeSettledVoucherNumber?: string;
  courierIntakeSettledByUserId?: string;
  courierIntakeSettledByUserName?: string;
  courierIntakeReceivedInHub?: boolean; // تم تدقيق واستلام الطرد في مستودع الفرع
  courierIntakeReceivedAt?: string;
  updatedAt?: string;
}

export interface CourierIntakeSettlementVoucher {
  id: string;
  voucherNumber: string; // e.g. ST-INT-2026-0001
  branchId: string;
  courierId: string;
  courierName: string;
  courierPhone?: string;
  parcelIds: string[];
  parcelsCount: number;
  totalPrepaidSyp: number;
  totalPrepaidUsd: number;
  totalCollectedSyp: number;
  totalCollectedUsd: number;
  receivedByUserId: string;
  receivedByUserName: string;
  timestamp: string;
  notes?: string;
}

export type ManifestStatus = 'preparing' | 'dispatched' | 'paused' | 'arrived_unloading' | 'received' | 'canceled';

export interface TruckManifest {
  id: string;
  manifestNumber: string; // e.g. MNF-TRK-2026-0412
  originHubId: string;
  destinationHubId: string;
  driverName: string;
  driverPhone: string;
  truckPlate: string;
  truckType: string;
  status: ManifestStatus;
  parcelIds: string[];
  parcelsCount?: number;
  totalWeightKg: number;
  totalPieces: number;
  totalFreightSyp: number;
  totalFreightUsd: number;
  totalCodSyp: number;
  totalCodUsd: number;
  notes?: string;
  isCourierManifest?: boolean;
  courierId?: string;
  courierName?: string;
  courierPhone?: string;
  createdById: string;
  createdAt: string;
  dispatchedAt?: string;
  arrivedAt?: string;
  receivedAt?: string;
  receivedByUserId?: string;
  missingParcelIds?: string[];
  shortageNotes?: string;
  updatedAt?: string;
}

export interface CourierManifest {
  id: string;
  manifestNumber: string; // e.g. MNF-CUR-2026-0105
  courierId: string;
  hubId: string;
  status: 'active' | 'settled' | 'courier_credit';
  parcelIds: string[];
  assignedAt: string;
  settledAt?: string;
  totalCodToCollectSyp: number;
  totalCodToCollectUsd: number;
  totalCollectFreightSyp: number;
  totalCollectFreightUsd: number;
  deliveredParcelIds: string[];
  uncollectedParcelIds?: string[];
  returnedParcelIds: string[];
  notes?: string;
  settlementSummary?: {
    deliveredCount: number;
    uncollectedCount?: number;
    returnedCount: number;
    totalCollectedSyp: number;
    totalCollectedUsd: number;
    totalUncollectedSyp?: number;
    totalUncollectedUsd?: number;
    courierCommissionSyp: number;
    netDepositedSyp: number;
    netDepositedUsd: number;
    returnReasons?: Record<string, string>;
    settledByUserId?: string;
    voucherNumber?: string;
  };
  updatedAt?: string;
}

export type VoucherType = 'receipt' | 'payment' | 'clearing' | 'transfer'; // سند قبض | سند دفع | سند مقاصة | سند مناقلة صناديق

export interface ClearingOperationItem {
  id: string;
  operationNumber: string; // e.g. ORK-2026-8901, PV-2026-0003, TX-101
  date: string;
  time?: string;
  timestamp: string;
  type: 'shipping_prepaid' | 'shipping_collect' | 'cod_collection' | 'transfer_fee' | 'branch_expense';
  typeLabel: string;
  referenceId?: string;
  description: string;
  partyName?: string;
  grossAmount: number;
  currency: Currency;
  branchCommissionRate: number; // e.g. 15%
  branchCommissionAmount: number; // إيراد الفرع
  companyShareAmount: number; // إيراد الشركة الأساسية (بعد خصم المبالغ المحولة)
  transferredAmount?: number; // مبلغ محول (أجور موزع وجهة) مخصوم من حصة الشركة
  transferredAmountReason?: string; // ملاحظة/سبب التحويل
  expenseAmount?: number; // مصروف تشغيلي مقتطع
}

export type ClearingSettlementMethod = 'instant_cash' | 'bank_transfer' | 'on_account';

export interface ClearingSettlementOptions {
  method: ClearingSettlementMethod;
  bankName?: string;
  transferRefNumber?: string;
  autoGenerateReceiptVoucher?: boolean;
  notes?: string;
}

export interface ClearingReconciliationDetails {
  periodFrom?: string;
  periodTo?: string;
  previousClearingVoucherNumber?: string;
  previousClearingDate?: string;
  firstOperationRef?: string;
  firstOperationDate?: string;
  lastOperationRef?: string;
  lastOperationDate?: string;
  parcelsCount: number;
  operationsCount?: number;
  // Key 4 figures for quick summary & compliance
  totalGrossAmountSyp?: number;
  totalGrossAmountUsd?: number;
  totalExpensesSyp?: number;
  totalExpensesUsd?: number;
  totalBranchShareSyp?: number;
  totalBranchShareUsd?: number;
  totalTransferredAmountsSyp?: number; // إجمالي المبالغ المحولة لأجور الموزعين المخصومة من حصة الشركة
  totalTransferredAmountsUsd?: number;
  totalShippingCollectedSyp: number;
  totalShippingCollectedUsd: number;
  branchShippingCommissionPercent: number; // e.g. 15%
  branchShippingCommissionAmountSyp: number;
  branchShippingCommissionAmountUsd: number;
  headOfficeNetShippingShareSyp: number;
  headOfficeNetShippingShareUsd: number;
  totalCodCollectedSyp: number;
  totalCodCollectedUsd: number;
  branchCodCommissionPercent: number; // e.g. 20%
  branchCodCommissionAmountSyp: number;
  branchCodCommissionAmountUsd: number;
  totalNetPayableToHeadOfficeSyp: number;
  totalNetPayableToHeadOfficeUsd: number;
  reconciliationNotes?: string;
  operations?: ClearingOperationItem[];
  settlementMethod?: ClearingSettlementMethod;
  bankName?: string;
  transferRefNumber?: string;
  linkedReceiptVoucherNumber?: string;
  linkedReceiptVoucherId?: string;
}

export interface FinancialVoucher {
  id: string;
  voucherNumber: string; // e.g. RV-2026-0012, PV-2026-0015, CLR-2026-0004
  type: VoucherType;
  branchId: string;
  counterpartyBranchId?: string; // For clearing / transfers to HQ or other branch
  currency: Currency;
  amount: number;
  paidByOrTo: string; // المستلم منه (في القبض) أو المدفوع له (في الصرف)
  reasonCategory: string; // نوع وتصنيف الحركة
  description: string;
  referenceNumber?: string; // رقم الفاتورة أو المستند الخارجي
  assetId?: string; // ربط السند بأصل ثابت (اختياري لمراقبة المصاريف)
  parcelId?: string;
  performedByUserId: string;
  performedByUserName?: string;
  date: string;
  timestamp: string;
  clearingDetails?: ClearingReconciliationDetails;
  cashboxScope?: CashboxScope;
  status: 'approved' | 'draft' | 'cancelled';
  linkedVoucherId?: string;
  linkedVoucherNumber?: string;
  settlementMethod?: ClearingSettlementMethod;
}

export type TransactionType =
  | 'shipping_income_prepaid'
  | 'shipping_collected_dest'
  | 'cod_collected_dest'
  | 'cod_paid_to_sender'
  | 'transfer_fee_income'
  | 'branch_commission_payout'
  | 'settlement_transfer_to_hub'
  | 'settlement_received_from_branch'
  | 'voucher_receipt'
  | 'voucher_payment'
  | 'voucher_clearing'
  | 'operating_expense'
  | 'shift_settlement_handover_outflow'
  | 'shift_settlement_received_inflow'
  | 'courier_prepaid_collection'
  | 'courier_handover_to_outgoing'
  | 'courier_handover_from_intake'
  | 'deposit'
  | 'withdrawal';

export type CashboxScope =
  | 'master'
  | 'manager'
  | 'outgoing'
  | 'incoming'
  | 'cashier'
  | 'accountant'
  | 'operations'
  | 'warehouse'
  | 'courier'
  | 'courier_intake'
  | 'courier_delivery';

export interface ShiftSettlementVoucher {
  id: string;
  voucherNumber: string; // e.g. ST-OUT-2026-001 or ST-INC-2026-001
  branchId: string;
  cashboxScope: 'outgoing' | 'incoming' | 'cashier' | 'operations' | 'warehouse' | 'courier' | 'manager' | 'accountant' | 'master';
  officerUserId: string;
  officerName: string;
  operatorName?: string; // alias for display
  managerUserId: string;
  managerName: string;
  approverName?: string; // alias for display
  sypAmount: number;
  usdAmount: number;
  parcelsCount: number;
  period?: 'morning' | 'evening' | 'full_day' | string;
  periodStart?: string;
  periodEnd?: string;
  date?: string;
  status: 'pending' | 'pending_approval' | 'approved' | 'rejected';
  approvedAt?: string;
  rejectedReason?: string;
  rejectionReason?: string; // alias for display
  notes?: string;
  managerNotes?: string;
  timestamp: string;
}

export interface CashboxTransaction {
  id: string;
  branchId: string;
  currency: Currency;
  type: TransactionType;
  amount: number;
  paymentMethod?: string;
  referenceId?: string; // Parcel ID or Manifest ID or Settlement ID
  description: string;
  performedByUserId: string;
  performedByUserName?: string;
  performedByRole?: UserRole;
  cashboxScope?: CashboxScope;
  targetBoxName?: string;
  shiftSettlementVoucherId?: string;
  timestamp: string;
  createdAt?: string;
  counterpartyBranchId?: string;
}

export interface DailySettlement {
  id: string;
  branchId: string;
  parentHubId: string;
  settlementDate: string;
  sypCalculatedBalance: number;
  usdCalculatedBalance: number;
  sypHandedOver: number;
  usdHandedOver: number;
  sypCommissionEarned: number;
  usdCommissionEarned: number;
  status: 'pending' | 'approved' | 'rejected';
  notes?: string;
  createdById: string;
  approvedById?: string;
  timestamp: string;
}

export interface PricingRule {
  id: string;
  title?: string;
  originGov: Governorate | 'all';
  destGov: Governorate | 'all';
  packageType: PackageType | 'all';
  defaultBasis?: PricingBasis;
  distanceKm?: number;
  exchangeRateSypPerUsd?: number;
  baseWeightKg: number; // e.g. 5kg
  baseRateSyp: number; // e.g. 25,000 SYP
  extraKgRateSyp: number; // e.g. 3,000 SYP/kg
  baseRateUsd: number; // e.g. $3.00
  extraKgRateUsd: number; // e.g. $0.50
  cbmRateSyp: number; // e.g. 150,000 SYP/m3
  cbmRateUsd: number; // e.g. $20.00/m3
  minFeeSyp: number;
  minFeeUsd: number;
  // Custom or distance-calculated prices for the 5 size categories
  sizePricesSyp?: {
    extra_small: number;
    small: number;
    medium: number;
    large: number;
    extra_large: number;
  };
  sizePricesUsd?: {
    extra_small: number;
    small: number;
    medium: number;
    large: number;
    extra_large: number;
  };
}

export type CodCommissionMode = 'percentage' | 'per_amount_tier' | 'custom_brackets';

export interface CodCommissionBracket {
  id: string;
  fromAmount: number; // المبلغ الأدنى للشريحة (من)
  toAmount: number;   // المبلغ الأعلى للشريحة (إلى)
  fee: number;        // قيمة العمولة المحددة لهذه الشريحة
}

export interface CodTransferSettings {
  commissionMode?: CodCommissionMode; // 'percentage' | 'per_amount_tier' | 'custom_brackets'
  transferFeePercent: number; // e.g. 2%
  tierAmountSyp?: number; // e.g. 1,000,000 SYP (شريحة المبلغ بالليرة السورية)
  tierFeeSyp?: number; // e.g. 8,000 SYP (عمولة كل شريحة بالليرة السورية)
  tierAmountUsd?: number; // e.g. $100 (شريحة المبلغ بالدولار)
  tierFeeUsd?: number; // e.g. $1.50 (عمولة كل شريحة بالدولار)
  bracketsSyp?: CodCommissionBracket[]; // شرائح العمولة بالليرة السورية (من مبلغ إلى مبلغ والعمولة)
  bracketsUsd?: CodCommissionBracket[]; // شرائح العمولة بالدولار الأمريكي
  minTransferFeeSyp: number; // e.g. 5,000 SYP
  minTransferFeeUsd: number; // e.g. $1.00
  maxCodAllowedSyp: number; // e.g. 500,000,000 SYP
  maxCodAllowedUsd: number; // e.g. $30,000
  payoutGraceHours: number; // e.g. 24h
  autoSmsOnCollection: boolean;
  updatedAt?: string;
}

export interface ManifestLayoutElement {
  id: string;
  type:
    | 'header_logo'
    | 'barcode_qr'
    | 'trip_info'
    | 'driver_truck'
    | 'parcels_table'
    | 'financial_summary'
    | 'terms_and_conditions'
    | 'signatures_box'
    | 'official_stamp'
    | 'custom_text';
  title: string;
  x: number;
  y: number;
  width: number;
  height: number;
  fontSize: number;
  fontWeight: 'normal' | 'bold';
  textColor: string;
  backgroundColor: string;
  borderColor?: string;
  customContent?: string;
  visible: boolean;
}

export interface ManifestTemplate {
  id: string;
  name: string;
  paperSize: 'A4' | 'A5' | 'Thermal80mm';
  orientation: 'portrait' | 'landscape';
  elements: ManifestLayoutElement[];
  isDefault: boolean;
}

export interface NotificationTemplates {
  onIntakeSenderSms: string;
  onArrivalReceiverSms: string;
  onCourierOutReceiverSms: string;
  onDeliveredSenderSms: string;
  onStagnantReminderSms: string;
  onCodReadySenderSms: string;
}

export interface AlertsAndDeadlinesSettings {
  // 1. فترات الركود وبقاء الطرود في المستودع (Warehouse Stagnancy & Storage)
  stagnantParcelDays: number; // عدد أيام الركود لتصنيف الطرد كراكد (افتراضي: 3 أيام)
  maxStorageGraceDays: number; // مهلة التخزين المجاني القصوى قبل احتساب غرامة أرضيات (افتراضي: 5 أيام)
  dailyStorageFeeSyp: number; // غرامة أرضيات اليوم الواحد ل.س (افتراضي: 5000 ل.س)
  dailyStorageFeeUsd: number; // غرامة أرضيات اليوم الواحد $ (افتراضي: 0.50 $)
  autoAlertOnStagnant: boolean; // تنبيه تلقائي في النظام لأمين المستودع ومدير الفرع عند ركود الطرد

  // 2. مهلات التوصيل وإشعارات التسليم (Delivery SLA & Courier Deadlines)
  courierDeliveryDeadlineHours: number; // المهلة القصوى للمندوب لتسليم الطرد للعميل بالساعات (افتراضي: 24 ساعة)
  courierOverdueAlertMinutes: number; // تنبيه قبل انتهاء مهلة المندوب بالدقائق (افتراضي: 120 دقيقة)
  notifyReceiverOnArrival: boolean; // إرسال إشعار فوري للمستلم فور وصول الطرد لفرع الوجهة
  notifyReceiverOnCourierOut: boolean; // إرسال إشعار للمستلم عند خروج الطرد مع المندوب
  notifySenderOnDelivered: boolean; // إرسال إشعار للمرسل فور استلام المستلم وتسديد الحساب
  receiverPickupReminderIntervalHours: number; // تكرار إرسال رسائل تذكير بالاستلام من الفرع كل X ساعة (افتراضي: 24 ساعة)
  maxReminderCount: number; // الحد الأقصى لمرات التذكير (افتراضي: 3 مرات)

  // 3. مهلات النقل البري وتتبع تأخر الشاحنات (Intercity Transit Deadlines)
  intercityTransitDeadlineHours: number; // المهلة المتوقعة للرحلة بين المحافظات بالساعات (افتراضي: 14 ساعة)
  truckDelayAlertThresholdHours: number; // عدد ساعات التأخر عن الموعد المتوقع لإطلاق إنذار طوارئ (افتراضي: 3 ساعات)
  autoAlertDispatchedTrucks: boolean; // مراقبة حية وإشعار الفروع بالرحلات المغادرة والمتأخرة

  // 4. مهلات تحصيل وتوريد مبالغ الحوالات المالية وCOD والمقاصة (Financial & Cashbox Remittance Deadlines)
  codPayoutGraceHours: number; // مهلة إتاحة مبالغ الحوالة للقبض للمرسل بعد التسليم بالساعات (افتراضي: 12 ساعة)
  dailySettlementDeadlineHour: number; // ساعة إقفال وتوريد كشف الصندوق اليومي (مثلا 20 = 8:00 مساءً)
  alertSuperAdminOnDelayedSettlement: boolean; // تنبيه المدير العام في حال تأخر أي فرع عن الإقفال المالي اليومي
  allowNegativeDisbursementGlobally?: boolean; // خيار عام للسماح أو منع الصرف بالسالب وتجاوز رصيد الصندوق
  preventDuplicateAlerts?: boolean; // منع تكرار ظهور نفس التنبيه مرتين لنفس السبب/الكيان

  // 5. قوالب الرسائل النصية والإشعارات التلقائية (SMS & Notification Templates)
  templates: NotificationTemplates;
}

export interface SystemNotification {
  id: string;
  title: string;
  message: string;
  type:
    | 'truck_dispatched'
    | 'truck_arrived'
    | 'manifest_unloaded'
    | 'shortage_alert'
    | 'lost_parcel'
    | 'overdue_storage'
    | 'uncollected_alert'
    | 'cash_settlement'
    | 'expense_approval'
    | 'payroll_alert'
    | 'admin_directive'
    | 'direct_message'
    | 'cod_payout_due'
    | 'cod_payout_sender'
    | 'vps_sync'
    | 'cloud_sync'
    | 'system'
    | 'sla_warning'
    | 'info';
  timestamp: string;
  read: boolean;
  readByUserIds?: string[]; // قائمة معرفات المستخدمين الذين قرأوا التنبيه أو حددوه كمقروء (عزل كامل لكل مستخدم)
  targetBranchId?: string; // إذا كان مخصصاً لفرع معين
  targetUserId?: string; // إذا كان مخصصاً لمستخدم بعينه
  targetRole?: UserRole; // إذا كان مخصصاً لأصحاب دور وظيفي محدد
  targetCustomerPhone?: string; // رقم هاتف العميل المستهدف
  senderUserId?: string; // معرف المرسل
  senderName?: string;
  isDirectMessage?: boolean; // هل هو توجيه / رسالة إدارية خاصة
  priority?: 'normal' | 'important' | 'urgent'; // أولوية التنبيه
  conversationId?: string; // معرف سجل المحادثة
  relatedId?: string;
  parcelSummary?: {
    trackingNumber: string;
    paperReceiptNumber?: string;
    receiverName: string;
    receiverPhone?: string;
    senderName?: string;
    senderPhone?: string;
    originBranchName?: string;
    destBranchName?: string;
    codAmount?: number;
    codCurrency?: Currency;
    amountToCollectSyp?: number;
    amountToCollectUsd?: number;
    amountSummary: string;
    payoutVoucherNumber?: string;
    payoutRecipientName?: string;
    payoutDate?: string;
  };
  shortageSummary?: {
    manifestId: string;
    manifestNumber: string;
    missingCount: number;
    parcelIds: string[];
    originBranchName: string;
    destBranchName: string;
    trackingNumbers: string[];
  };
  actionType?: 'cashier_collect' | 'cod_payout_sender' | 'view_manifest' | 'verify_shortage' | 'view_shortage_warehouse' | 'general';
  dedupKey?: string; // معرّف منع التكرار الذكي لضمان عدم ظهور نفس التنبيه مرتين لنفس السبب
}

// ==========================================
// 1. دليل العملاء (Comprehensive Customer Directory)
// ==========================================
export type CustomerType = 'individual' | 'merchant' | 'corporate'; // فرد | تاجر | شركة

export interface Customer {
  id: string;
  code: string; // e.g. CST-1001
  fullName: string;
  firstName?: string;
  fatherName?: string;
  lastName?: string;
  motherName?: string;
  birthDate?: string;
  nationalId?: string; // الرقم الوطني أو رقم الهوية المكون من 11 خانة
  idType?: IdDocumentType; // نوع الهوية: 'syrian' (سورية - افتراضي) | 'palestinian' (فلسطيني)
  phone: string;
  secondaryPhone?: string;
  city: Governorate;
  address: string;
  companyName?: string;
  customerType: CustomerType;
  idPhotoFront?: string; // صورة الهوية المدنية - الوجه الأمامي
  idPhotoBack?: string; // صورة الهوية المدنية - الوجه الخلفي
  civilRegistry?: string; // القيد المدني
  birthPlace?: string; // محل الولادة
  isVerified?: boolean; // هل العميل موثق رسمياً بالبطاقة الشخصية
  verificationSource?: 'handover_id' | 'intake' | 'manual_directory'; // مصدر التوثيق
  notes?: string;
  isBlacklisted?: boolean;
  blacklistReason?: string;
  totalShipmentsSent: number;
  totalShipmentsReceived: number;
  totalSpentSyp: number;
  totalSpentUsd: number;
  returnDebtBalance?: number; // إجمالي ذمم أجور الشحن العكسي غير المسددة على العميل
  // بيانات دخول بوابة تتبع الزبون (Customer Portal Credentials)
  portalAccessEnabled?: boolean; // تفعيل دخول بوابة الزبون
  portalUsername?: string; // اسم المستخدم المخصص لبوابة الزبون
  portalPassword?: string; // كلمة المرور الخاصة ببوابة الزبون
  portalLastLoginAt?: string; // تاريخ آخر تسجيل دخول للبوابة
  createdAt: string;
  updatedAt?: string;
  branchId?: string;
}

export interface CustomerPortalUser {
  id: string; // Customer ID
  customerId: string;
  name: string;
  phone: string;
  secondaryPhone?: string;
  username: string;
  password?: string;
  companyName?: string;
  city?: Governorate;
  address?: string;
  customerType?: CustomerType;
  nationalId?: string;
  isActive: boolean;
  createdAt: string;
  lastLoginAt?: string;
}

export interface CustomerAnalytics {
  totalShipments: number;
  sentShipmentsCount: number;
  receivedShipmentsCount: number;
  deliveredCount: number;
  inTransitCount: number;
  withCourierCount: number;
  atHubCount: number;
  returnedCount: number;
  deliverySuccessRate: number; // e.g. 96.5%
  // COD Summary
  totalCodDueSyp: number;
  totalCodDueUsd: number;
  collectedAwaitingPayoutSyp: number;
  collectedAwaitingPayoutUsd: number;
  paidToSenderSyp: number;
  paidToSenderUsd: number;
  totalShippingPaidSyp: number;
  totalShippingPaidUsd: number;
}

// ==========================================
// 2. دليل المركبات والأسطول (Vehicles & Fleet Directory)
// ==========================================
export type VehicleStatus = 'active' | 'in_transit' | 'maintenance' | 'standby' | 'out_of_service' | 'ready';
export type VehicleType =
  | 'شاحنة قاطرة ومقطورة'
  | 'شاحنة مغلقة (سكس)'
  | 'شاحنة متوسطة (دينا)'
  | 'فان بضائع مقفل'
  | 'بيك أب توزيع'
  | 'دراجة نارية بريدية'
  | 'freight_truck'
  | (string & {});

export interface Vehicle {
  id: string;
  code: string; // e.g. TRK-01
  plateNumber: string; // e.g. دمشق 893241
  type: VehicleType;
  model: string; // e.g. Mercedes Actros 2022
  brand?: string;
  year: number;
  maxWeightKg: number;
  capacityTons?: number;
  maxVolumeCbm: number;
  fuelType?: 'diesel' | 'petrol' | 'electric';
  driverName: string;
  driverPhone: string;
  driverNationalId?: string;
  driverLicenseNumber?: string;
  assignedBranchId: string;
  branchId?: string;
  status: VehicleStatus;
  insuranceExpiryDate?: string;
  licenseExpiryDate?: string;
  lastMaintenanceDate?: string;
  nextMaintenanceKm?: number;
  currentOdometerKm?: number;
  fuelTankLiters?: number;
  fuelTankCapacityLiters?: number;
  notes?: string;
  createdAt: string;
}

// ==========================================
// 3. دليل الموظفين والرواتب (Employees & Payroll Directory)
// ==========================================
export type EmployeeStatus = 'active' | 'on_leave' | 'suspended' | 'resigned' | 'terminated';

export interface Employee {
  id: string;
  code: string; // e.g. EMP-101
  fullName: string;
  jobTitle: string; // e.g. مدير فرع / عامل مستودع / سائق شاحنة / محاسب
  role?: UserRole;
  branchId: string;
  phone: string;
  nationalId: string;
  idPhotoFront?: string;
  idPhotoBack?: string;
  hireDate: string;
  birthDate?: string;
  status: EmployeeStatus;
  // Financial specs
  basicSalary: number;
  baseSalarySyp?: number;
  salaryCurrency: Currency;
  currency?: Currency;
  transportAllowance: number; // بدل نقل
  housingAllowance: number; // بدل سكن/معيشة
  bonusRate: number; // نسبة مكافآت أو حوافز
  bonusRatePercent?: number;
  standardDeductions: number; // استقطاعات وتأمينات
  bankNameOrIban?: string;
  bankAccountNumber?: string;
  emergencyContactPhone?: string;
  notes?: string;
  createdAt: string;
}

export interface PayrollRecord {
  id: string;
  payrollNumber: string; // e.g. PAY-2026-09-001
  employeeId: string;
  employeeName: string;
  branchId: string;
  month: string; // e.g. 2026-09
  basicSalary: number;
  currency: Currency;
  allowancesTotal?: number;
  allowances?: number;
  deductionsTotal?: number;
  deductions?: number;
  advanceDeductions?: number;
  overtimeAmount: number;
  bonusAmount: number;
  netPayable: number;
  paidAt?: string;
  paidByUserId?: string;
  paymentMethod?: 'cash_box' | 'bank_transfer' | 'cheque';
  status: 'paid' | 'pending' | 'draft';
  notes?: string;
  voucherId?: string; // Linked to cashbox payment voucher
  createdAt?: string;
}

// ==========================================
// 4. دليل المصاريف التشغيلية (Operational Expenses Directory)
// ==========================================
export interface ExpenseCategoryItem {
  id: string; // unique slug or ID
  name: string; // e.g. "وقود ومحروقات", "صيانة مركبات", "إيجار مقرات"
  code: string; // e.g. "CAT-01"
  description?: string;
  requiresManagerApproval: boolean; // يحتاج موافقة مدير (نعم / لا للصرف المباشر)
  maxDirectSpendLimitSyp?: number; // سقف الصرف المباشر بدون موافقة
  color?: string; // لون مميز للتحليلات
  icon?: string;
  isDefault?: boolean;
  isActive: boolean;
  createdAt: string;
}

export type ExpenseCategory =
  | 'وقود ومحروقات'
  | 'صيانة مركبات وقطع غيار'
  | 'إيجار مقرات ومستودعات'
  | 'كهرباء ومياه وخدمات'
  | 'اتصالات وإنترنت'
  | 'قرطاسية ومطبوعات'
  | 'ضيافة ونظافة'
  | 'رسوم حكومية ورخص'
  | 'رواتب وأجور عمالة يومية'
  | 'مصاريف نقل وشحن وسيط'
  | 'دعاية وإعلان وتسويق'
  | 'أخرى ومصاريف طارئة'
  | (string & {});

export interface Expense {
  id: string;
  expenseNumber: string; // e.g. EXP-2026-0142
  title: string;
  category: ExpenseCategory;
  categoryId?: string;
  branchId: string;
  vehicleId?: string; // Optional link to specific truck
  assetId?: string; // ربط المصروف بأصل ثابت محدد لمراقبة نفقات الأصل
  amount: number;
  currency: Currency;
  paidTo: string; // الجهة المستفيدة / البائع
  invoiceNumber?: string; // رقم الفاتورة أو الإيصال
  invoicePhotoUrl?: string; // صورة الفاتورة أو المستند
  invoicePhoto?: string;
  paymentMethod: 'cash_box' | 'bank_transfer' | 'petty_cash';
  paidByUserId?: string;
  performedByUserName?: string;
  cashboxScope?: CashboxScope;
  approvedByUserId?: string;
  requiresApproval?: boolean;
  status: 'approved' | 'approved_waiting_disbursement' | 'pending' | 'rejected';
  approvedAt?: string;
  approvedByUserName?: string;
  disbursedAt?: string;
  disbursedByUserId?: string;
  disbursedByUserName?: string;
  disbursedCashboxScope?: CashboxScope;
  date: string;
  expenseDate?: string;
  notes?: string;
  voucherId?: string; // Linked to cashbox payment voucher
  createdAt: string;
}

// ==========================================
// 5. المراسلات والتوجيهات الإدارية المباشرة (Direct Admin Directives & Messaging)
// ==========================================
export interface DirectMessage {
  id: string;
  senderUserId: string;
  senderName: string;
  senderRole: UserRole;
  recipientType: 'user' | 'branch';
  recipientUserId?: string;
  recipientUserName?: string;
  recipientBranchId?: string;
  recipientBranchName?: string;
  title: string;
  content: string;
  priority: 'normal' | 'important' | 'urgent';
  timestamp: string;
  isRead: boolean;
  readAt?: string;
  replyToId?: string;
}

// ==========================================
// 6. إدارة الأصول الثابتة وتجهيزات الفروع (Fixed Assets Management)
// ==========================================
export type AssetCategory =
  | 'computers_it' // أجهزة كمبيوتر ولابتوبات ومعدات شبكات
  | 'barcode_printers' // طابعات باركود وبوالص شحن حرارية
  | 'barcode_scanners' // قارئات وماسحات باركود
  | 'office_equipment' // تجهيزات ومعدات مكتبية وكهربائية (مكيفات، طاقة، مولدات)
  | 'furniture' // أثاث ومكاتب وديكور ورفوف مستودعات
  | 'security_cctv' // كاميرات مراقبة وأنظمة أمن وحماية
  | 'cash_counters' // عدادات نقود وخزائن حديدية
  | 'other'; // أخرى

export type AssetCondition =
  | 'excellent' // يعمل بكفاءة ممتازة
  | 'good' // يعمل بحالة جيدة
  | 'needs_repair' // بحاجة صيانة وفحص
  | 'in_maintenance' // قيد الصيانة والإصلاح حالياً
  | 'decommissioned' // خارج الخدمة / مكهن
  | 'lost_damaged'; // تالف / مفقود

export interface FixedAsset {
  id: string;
  assetCode: string; // كود مميز للأصل مثل: AST-DAM-0001
  name: string; // اسم وتوصيف الأصل
  category: AssetCategory;
  branchId: string; // الفرع التابع له
  purchaseDate: string; // تاريخ الشراء
  purchasePrice: number; // تكلفة الشراء
  currency: Currency; // عملة الشراء (SYP / USD)
  condition: AssetCondition; // الحالة التشغيلية
  serialNumber?: string; // الرقم التسلسلي S/N
  barcode?: string; // رمز الباركود للأصل
  barcodeTag?: string; // رمز باركود الأصل
  model?: string; // الموديل
  modelNumber?: string; // الموديل / الطراز
  assignedEmployee?: string; // اسم الموظف المستلم للعهدة
  assignedToEmployee?: string; // اسم الموظف المستلم للعهدة
  locationInBranch?: string; // الموقع الدقيق بالفرع (الاستقبال، المستودع، الإدارة)
  supplier?: string; // اسم المورد أو الشركة المجهزة
  warrantyExpiryDate?: string; // تاريخ انتهاء الضمان
  lastMaintenanceDate?: string; // تاريخ آخر صيانة للأصل
  notes?: string; // ملاحظات ومواصفات إضافية
  createdAt: string;
  updatedAt?: string;
}

// ==========================================
// 7. تهيئة وإعدادات سيرفر VPS (VPS Server & Cloud Sync Config)
// ==========================================
export interface VpsServerConfig {
  serverUrl: string; // e.g. "http://localhost:3000" or "https://api.orca-express.com"
  apiKey?: string; // Optional security auth token
  companyName: string;
  companyCode: string;
  autoSyncEnabled: boolean;
  syncIntervalSeconds: number; // e.g. 5 seconds
  isConnected: boolean;
  lastPingMs: number;
  lastConnectedAt: string | null;
  environmentMode: 'production' | 'staging' | 'local_vps';
  branchBindingId?: string;
}

export type CloudSyncStatus = 'idle' | 'syncing' | 'connected' | 'offline' | 'error' | 'retrying';
export type DatabaseBackendType = 'postgresql' | 'fallback_local' | 'disconnected';

export interface CloudSyncState {
  status: CloudSyncStatus;
  lastSyncTimestamp: string | null;
  pendingQueueCount: number;
  realtimeActive: boolean;
  boundBranchId?: string;
  errorMessage?: string;
  databaseBackend?: DatabaseBackendType;
  postgresConnected?: boolean;
  postgresPingMs?: number;
  postgresError?: string | null;
  isConnectionFrozen?: boolean;
  strictServerConfirmationPolicy?: boolean;
  retryCount?: number;
}

// Inter-Branch Obligations (الذمم المالية التبادلية بين الفروع)
export type ObligationType = 'cod' | 'shipping_only' | 'cod_and_shipping';

export type ObligationPayoutStatus = 'pending' | 'paid' | 'cancelled';

export type ObligationClearingStatus = 'pending' | 'cleared' | 'waived';

export interface InterBranchObligation {
  id: string; // obl_${parcelId}_${currency}
  parcelId: string;
  trackingNumber: string;
  obligationType: ObligationType;
  debtorBranchId: string;
  creditorBranchId: string;
  currency: Currency;
  codAmount: number;
  shippingShareAmount: number;
  agentCommissionAmount: number;
  transferFeeShareAmount: number;
  totalObligationAmount: number;
  senderPayoutStatus: ObligationPayoutStatus;
  senderPayoutVoucherId?: string;
  senderPayoutAt?: string;
  senderPayoutUserId?: string;
  clearingStatus: ObligationClearingStatus;
  clearingVoucherId?: string;
  clearingVoucherNumber?: string;
  clearedAt?: string;
  clearedByUserId?: string;
  createdAt: string;
  updatedAt: string;
  metadata?: Record<string, any>;
}

export type ParcelEventDimension = 
  | 'handling' 
  | 'financial_cod' 
  | 'cashier' 
  | 'investigation' 
  | 'location';

export interface ParcelEvent {
  id: string; // evt_{parcelId}_{eventType}_{timestamp}_{shortHash}
  parcelId: string;
  trackingNumber: string;
  eventType: string; // = handlingStatus أو أي event آخر
  dimension: ParcelEventDimension;
  previousStatus?: string;
  newStatus?: string;
  precedenceRank: number; // من HANDLING_RANK أو أي rank table
  branchId?: string;
  userId?: string;
  userName?: string;
  userRole?: string;
  manifestId?: string;
  notes?: string;
  metadata?: Record<string, any>;
  clientTimestamp?: string;
  serverTimestamp: string;
  createdAt: string;
}




