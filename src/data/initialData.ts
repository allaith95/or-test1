import { DEFAULT_NUMBER_FORMAT_SETTINGS } from '../utils/numberFormatter';
import {
  Branch,
  User,
  Parcel,
  TruckManifest,
  CourierManifest,
  CashboxTransaction,
  DailySettlement,
  PricingRule,
  CodTransferSettings,
  CodCommissionBracket,
  ManifestTemplate,
  SystemNotification,
  CompanyBrandingSettings,
  AuditLogEntry,
  FinancialVoucher,
  AlertsAndDeadlinesSettings,
  Customer,
  Vehicle,
  Employee,
  PayrollRecord,
  Expense,
  ExpenseCategoryItem,
  DirectMessage,
  FixedAsset,
  ShiftSettlementVoucher,
} from '../types';
import { getDefaultPermissionsForRole } from '../utils/permissionEngine';
import { GOVERNORATE_CODES } from '../utils/branchHelper';
// ==========================================
// 1. الفروع (فارغة تماماً للبدء من الصفر)
// ==========================================
export const EMPTY_SYSTEM_BRANCH: Branch = {
  id: '',
  code: 'SYS-NONE',
  name: 'لا يوجد فرع محدد',
  type: 'main_hub',
  governorate: '' as any,
  commissionRateShipping: 0,
  commissionRateTransfers: 0,
  boxSypBalance: 0,
  boxUsdBalance: 0,
  address: 'لا توجد فروع مسجلة في النظام حتى الآن',
  phone: '',
  managerName: '',
  isActive: false,
};

export const ALL_BRANCHES_SUPERVISION_BRANCH: Branch = {
  id: '',
  code: 'ALL',
  name: 'كافة الفروع (إشراف عام)',
  type: 'main_hub',
  governorate: '' as any,
  commissionRateShipping: 0,
  commissionRateTransfers: 0,
  boxSypBalance: 0,
  boxUsdBalance: 0,
  address: 'إشراف عام وتحكم شامل بكافة الفروع',
  phone: '',
  managerName: 'مدير التطبيق العام',
  isActive: true,
};

export const INITIAL_BRANCHES: Branch[] = [];

const ALL_MAIN_BRANCH_IDS: string[] = [];

// ==========================================
// 2. مستخدم زائر فارغ (قاعدة بيانات صفرية مفرغة بالكامل)
// ==========================================
export const EMPTY_GUEST_USER: User = {
  id: '',
  name: 'زائر غير مسجل',
  username: '',
  password: '',
  role: 'cashier',
  branchId: '',
  canSwitchBranches: false,
  allowedBranchIds: [],
  phone: '',
  isActive: false,
};

export const INITIAL_USERS: User[] = [];

// ==========================================
// 3. قاعدة البيانات التشغيلية الصفرية (نظيفة ومفرغة بالكامل للبدء الفعلي)
// ==========================================
export const INITIAL_PARCELS: Parcel[] = [];
export const INITIAL_TRUCK_MANIFESTS: TruckManifest[] = [];
export const INITIAL_COURIER_MANIFESTS: CourierManifest[] = [];
export const INITIAL_TRANSACTIONS: CashboxTransaction[] = [];
export const INITIAL_SETTLEMENTS: DailySettlement[] = [];
export const INITIAL_SHIFT_SETTLEMENTS: ShiftSettlementVoucher[] = [];
export const INITIAL_VOUCHERS: FinancialVoucher[] = [];
export const INITIAL_AUDIT_LOGS: AuditLogEntry[] = [];

export const INITIAL_CUSTOMERS: Customer[] = [];
export const INITIAL_VEHICLES: Vehicle[] = [];
export const INITIAL_EMPLOYEES: Employee[] = [];
export const INITIAL_PAYROLL_RECORDS: PayrollRecord[] = [];
export const INITIAL_EXPENSES: Expense[] = [];
export const INITIAL_NOTIFICATIONS: SystemNotification[] = [];
export const INITIAL_DIRECT_MESSAGES: DirectMessage[] = [];
export const INITIAL_FIXED_ASSETS: FixedAsset[] = [];

// ==========================================
// 4. مصفوفة قواعد التسعير الرسمية
// ==========================================
export const INITIAL_PRICING_RULES: PricingRule[] = [];

export const DEFAULT_COD_BRACKETS_SYP: CodCommissionBracket[] = [
  { id: 'b_syp_1', fromAmount: 0, toAmount: 500000, fee: 3000 },
  { id: 'b_syp_2', fromAmount: 500001, toAmount: 1000000, fee: 6000 },
  { id: 'b_syp_3', fromAmount: 1000001, toAmount: 2000000, fee: 12000 },
  { id: 'b_syp_4', fromAmount: 2000001, toAmount: 5000000, fee: 25000 },
  { id: 'b_syp_5', fromAmount: 5000001, toAmount: 10000000, fee: 45000 },
];

export const DEFAULT_COD_BRACKETS_USD: CodCommissionBracket[] = [
  { id: 'b_usd_1', fromAmount: 0, toAmount: 50, fee: 1 },
  { id: 'b_usd_2', fromAmount: 51, toAmount: 100, fee: 2 },
  { id: 'b_usd_3', fromAmount: 101, toAmount: 300, fee: 4 },
  { id: 'b_usd_4', fromAmount: 301, toAmount: 500, fee: 7 },
  { id: 'b_usd_5', fromAmount: 501, toAmount: 1000, fee: 12 },
];

export const INITIAL_COD_SETTINGS: CodTransferSettings = {
  commissionMode: 'per_amount_tier',
  transferFeePercent: 0,
  tierAmountSyp: 0,
  tierFeeSyp: 0,
  tierAmountUsd: 0,
  tierFeeUsd: 0,
  bracketsSyp: DEFAULT_COD_BRACKETS_SYP,
  bracketsUsd: DEFAULT_COD_BRACKETS_USD,
  minTransferFeeSyp: 0,
  minTransferFeeUsd: 0,
  maxCodAllowedSyp: 0,
  maxCodAllowedUsd: 0,
  payoutGraceHours: 0,
  autoSmsOnCollection: false,
};

export const DEFAULT_MANIFEST_TEMPLATE: ManifestTemplate = {
  id: 'tmpl_standard_syria',
  name: 'النموذج السوري الرسمي المعتمد (A4 أفقي)',
  paperSize: 'A4',
  orientation: 'landscape',
  isDefault: true,
  elements: [
    {
      id: 'el_header',
      type: 'header_logo',
      title: 'ترويسة الشركة والجمهورية العربية السورية',
      x: 0,
      y: 0,
      width: 100,
      height: 12,
      fontSize: 14,
      fontWeight: 'bold',
      textColor: '#0f172a',
      backgroundColor: '#f8fafc',
      visible: true,
    },
    {
      id: 'el_trip',
      type: 'trip_info',
      title: 'بيانات الرحلة والمحافظات',
      x: 0,
      y: 13,
      width: 50,
      height: 15,
      fontSize: 11,
      fontWeight: 'normal',
      textColor: '#1e293b',
      backgroundColor: '#ffffff',
      visible: true,
    },
    {
      id: 'el_driver',
      type: 'driver_truck',
      title: 'بيانات السائق والشاحنة',
      x: 52,
      y: 13,
      width: 48,
      height: 15,
      fontSize: 11,
      fontWeight: 'normal',
      textColor: '#1e293b',
      backgroundColor: '#ffffff',
      visible: true,
    },
    {
      id: 'el_table',
      type: 'parcels_table',
      title: 'جدول بوالص الشحن والطرود',
      x: 0,
      y: 30,
      width: 100,
      height: 45,
      fontSize: 10,
      fontWeight: 'normal',
      textColor: '#000000',
      backgroundColor: '#ffffff',
      visible: true,
    },
    {
      id: 'el_summary',
      type: 'financial_summary',
      title: 'الملخص المالي والتحصيلات',
      x: 0,
      y: 77,
      width: 45,
      height: 18,
      fontSize: 10,
      fontWeight: 'bold',
      textColor: '#0f172a',
      backgroundColor: '#f1f5f9',
      visible: true,
    },
    {
      id: 'el_signatures',
      type: 'signatures_box',
      title: 'تواقيع الاستلام والتسليم والأختام',
      x: 48,
      y: 77,
      width: 52,
      height: 18,
      fontSize: 10,
      fontWeight: 'normal',
      textColor: '#0f172a',
      backgroundColor: '#ffffff',
      visible: true,
    },
  ],
};

export const DEFAULT_PACKAGE_TYPES: string[] = [
  'كرتون عادي',
  'طرد هش / قابل للكسر',
  'شوال / خيشة ملابس',
  'مواد سائلة ومستحضرات',
  'قطع غيار ومعدات',
  'وثائق ومستندات هامة',
  'أجهزة إلكترونية',
  'مفروشات وأثاث',
];

export const DEFAULT_ID_DOCUMENT_TYPES: string[] = [
  'هوية سورية',
  'هوية فلسطيني',
  'حكومة إنقاذ',
  'جواز سفر',
  'إخراج قيد',
];

export const INITIAL_COMPANY_BRANDING: CompanyBrandingSettings = {
  companyName: 'أوركا اكسبريس',
  companySubtitle: 'للشحن البري',
  logoUrl: '/orca_express_logo.jpg',
  printLogoUrl: '/orca_print_bw.png',
  appBackgroundUrl: '',
  officialPhone: '',
  customerServicePhone: '0991234567',
  officialEmail: '',
  headquartersAddress: '',
  taxNumber: '',
  commercialRegistry: '',
  receiptHeaderNotes: '',
  receiptFooterTerms: '',
  manifestFooterNotes: '',
  appTheme: 'mac_dark',
  accentColor: '#06b6d4',
  exchangeRateUsdToSyp: 0,
  fuelSurchargePercent: 0,
  enableMultiCurrency: true,
  allowMultiCurrencyDelivery: false, // افتراضياً: مقفل (إلزام القبض المنفصل وحفظ كل عملة بعملتها دون تحويل)
  autoPrintAfterIntake: false,
  activePricingPolicy: 'manual_pricing',
  defaultShippingCategory: 'cargo',
  packageTypes: DEFAULT_PACKAGE_TYPES,
  idDocumentTypes: DEFAULT_ID_DOCUMENT_TYPES,
  numberFormatSettings: DEFAULT_NUMBER_FORMAT_SETTINGS,
};

export const INITIAL_ALERTS_SETTINGS: AlertsAndDeadlinesSettings = {
  stagnantParcelDays: 3,
  maxStorageGraceDays: 5,
  dailyStorageFeeSyp: 0,
  dailyStorageFeeUsd: 0,
  autoAlertOnStagnant: true,

  courierDeliveryDeadlineHours: 24,
  courierOverdueAlertMinutes: 120,
  notifyReceiverOnArrival: true,
  notifyReceiverOnCourierOut: true,
  notifySenderOnDelivered: true,
  receiverPickupReminderIntervalHours: 24,
  maxReminderCount: 3,

  intercityTransitDeadlineHours: 14,
  truckDelayAlertThresholdHours: 3,
  autoAlertDispatchedTrucks: true,

  codPayoutGraceHours: 12,
  dailySettlementDeadlineHour: 20,
  alertSuperAdminOnDelayedSettlement: true,
  allowNegativeDisbursementGlobally: false, // افتراضياً: منع الصرف بالسالب إلا لمن يُمنح صلاحية استثنائية
  preventDuplicateAlerts: true, // منع تكرار ظهور نفس التنبيه مرتين لنفس السبب

  templates: {
    onIntakeSenderSms: 'شركة أوركا للشحن: تم استلام طردكم رقم {TRACKING_NO} بنجاح والموجه إلى {DEST_CITY}. نشكر ثقتكم بخدماتنا.',
    onArrivalReceiverSms: 'أهلاً {RECEIVER_NAME}، وصل طردكم رقم {TRACKING_NO} إلى مركز أوركا ({DEST_CITY}). يرجى الحضور للاستلام مصطحباً الهوية الشخصية.',
    onCourierOutReceiverSms: 'طردكم رقم {TRACKING_NO} في طريقه إليكم الآن مع مندوب أوركا للتوصيل. هاتف المندوب: {COURIER_PHONE}. المبلغ المطلوب: {AMOUNT} {CURRENCY}.',
    onDeliveredSenderSms: 'عزيزنا المرسل، تم تسليم طردكم {TRACKING_NO} في {DEST_CITY} بنجاح وقبض المبلغ المستحق {AMOUNT} {CURRENCY}.',
    onStagnantReminderSms: 'تذكير هام: طردكم {TRACKING_NO} متواجد في مستودع أوركا ({DEST_CITY}) منذ {DAYS} أيام. يرجى الاستلام لتجنب رسوم الأرضيات.',
    onCodReadySenderSms: 'إشعار مالي: حوالتكم المالية عن الشحنة {TRACKING_NO} بقيمة {AMOUNT} {CURRENCY} جاهزة للقبض في فرع أوركا ({ORIGIN_CITY}).',
  },
};

export const INITIAL_EXPENSE_CATEGORIES: ExpenseCategoryItem[] = [
  {
    id: 'cat_fuel',
    code: 'EXP-CAT-01',
    name: 'وقود ومحروقات',
    description: 'تعبئة وقود مازوت وبنزين للشاحنات وسيارات التوصيل والمولدات',
    requiresManagerApproval: false,
    maxDirectSpendLimitSyp: 0,
    color: '#f59e0b',
    icon: 'Fuel',
    isDefault: true,
    isActive: true,
    createdAt: '2024-01-01T00:00:00.000Z',
  },
  {
    id: 'cat_maintenance',
    code: 'EXP-CAT-02',
    name: 'صيانة مركبات وقطع غيار',
    description: 'إصلاحات ميكانيكية، غيار زيت وفلاتر، كواشيك، قطع غيار شاحنات',
    requiresManagerApproval: true,
    maxDirectSpendLimitSyp: 0,
    color: '#ef4444',
    icon: 'Wrench',
    isDefault: true,
    isActive: true,
    createdAt: '2024-01-01T00:00:00.000Z',
  },
  {
    id: 'cat_rent',
    code: 'EXP-CAT-03',
    name: 'إيجار مقرات ومستودعات',
    description: 'إيجارات مراكز الفروع والمستودعات المركزية ونقاط التجميع',
    requiresManagerApproval: true,
    color: '#8b5cf6',
    icon: 'Building',
    isDefault: true,
    isActive: true,
    createdAt: '2024-01-01T00:00:00.000Z',
  },
  {
    id: 'cat_utilities',
    code: 'EXP-CAT-04',
    name: 'كهرباء ومياه وخدمات',
    description: 'فواتير الكهرباء النظامية، اشتراكات الأمبيرات، صهاريج المياه',
    requiresManagerApproval: false,
    maxDirectSpendLimitSyp: 0,
    color: '#06b6d4',
    icon: 'Zap',
    isDefault: true,
    isActive: true,
    createdAt: '2024-01-01T00:00:00.000Z',
  },
  {
    id: 'cat_stationery',
    code: 'EXP-CAT-05',
    name: 'قرطاسية ومطبوعات ومواد تغليف',
    description: 'بوالص شحن ورقية، أكياس، ستكرات باركود، رولات تغليف، كراتين',
    requiresManagerApproval: false,
    maxDirectSpendLimitSyp: 0,
    color: '#10b981',
    icon: 'Printer',
    isDefault: true,
    isActive: true,
    createdAt: '2024-01-01T00:00:00.000Z',
  },
  {
    id: 'cat_hospitality',
    code: 'EXP-CAT-06',
    name: 'ضيافة وبوفيه ونظافة',
    description: 'شاي وقهوة وضيافة العملاء، مواد تنظيف للمستودع والمكاتب',
    requiresManagerApproval: false,
    maxDirectSpendLimitSyp: 0,
    color: '#6366f1',
    icon: 'Coffee',
    isDefault: true,
    isActive: true,
    createdAt: '2024-01-01T00:00:00.000Z',
  },
  {
    id: 'cat_telecom',
    code: 'EXP-CAT-07',
    name: 'اتصالات وإنترنت ورسائل SMS',
    description: 'اشتراكات الإنترنت الفضائي/الأرضي للفروع، باقات هواتف المتابعة',
    requiresManagerApproval: false,
    maxDirectSpendLimitSyp: 0,
    color: '#3b82f6',
    icon: 'Wifi',
    isDefault: true,
    isActive: true,
    createdAt: '2024-01-01T00:00:00.000Z',
  },
  {
    id: 'cat_official_fees',
    code: 'EXP-CAT-08',
    name: 'رسوم وطوابع ونفقات حكومية',
    description: 'رسوم بلدية، نقابة النقل، طوابع عقود، تراخيص شاحنات ومستودعات',
    requiresManagerApproval: true,
    color: '#f97316',
    icon: 'FileCheck',
    isDefault: true,
    isActive: true,
    createdAt: '2024-01-01T00:00:00.000Z',
  },
  {
    id: 'cat_daily_wages',
    code: 'EXP-CAT-09',
    name: 'رواتب وأجور عمالة يومية',
    description: 'أجور عتالة وتنزيل شحنات طارئة، عمالة مياومة غير مثبتة',
    requiresManagerApproval: false,
    maxDirectSpendLimitSyp: 0,
    color: '#ec4899',
    icon: 'Users',
    isDefault: true,
    isActive: true,
    createdAt: '2024-01-01T00:00:00.000Z',
  },
  {
    id: 'cat_other',
    code: 'EXP-CAT-11',
    name: 'أخرى ومصاريف طارئة',
    description: 'نفقات طارئة وتشغيلية غير مصنفة',
    requiresManagerApproval: true,
    color: '#64748b',
    icon: 'HelpCircle',
    isDefault: true,
    isActive: true,
    createdAt: '2024-01-01T00:00:00.000Z',
  },
];
