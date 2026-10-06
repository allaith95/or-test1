import { User, UserRole, UserPermissions, PermissionCategory, PermissionItem, ActiveModule, Branch } from '../types';

export const ALL_PERMISSION_CATEGORIES: PermissionCategory[] = [
  {
    id: 'dashboard',
    label: 'لوحة التحكم والمؤشرات (Dashboard)',
    description: 'رؤية الإحصائيات، الأرقام المالية، والمخططات البيانية ومؤشرات الأداء',
    icon: 'LayoutDashboard',
    items: [
      { key: 'dashboard.view', label: 'عرض شاشة لوحة التحكم والمؤشرات', action: 'view', isSensitive: false },
      { key: 'dashboard.view_financials', label: 'رؤية الأرقام المالية والأرباح وصناديق الفروع', action: 'view', isSensitive: true },
      { key: 'dashboard.view_charts', label: 'عرض المخططات البيانية وتحليلات الأداء المتقدمة', action: 'view', isSensitive: false },
      { key: 'dashboard.export_reports', label: 'تصدير وطباعة تقارير المؤشرات وتحليلات الفروع', action: 'export_print', isSensitive: false },
    ],
  },
  {
    id: 'parcels',
    label: 'استقبال وتسجيل الطرود (Parcel Intake)',
    description: 'إدخال الشحنات، تعديل البيانات، الحذف، التوجيه، وطباعة بوالص A4 والحراري',
    icon: 'PackagePlus',
    items: [
      { key: 'parcels.view', label: 'عرض قائمة وسجلات الطرود والبحث الشامل', action: 'view', isSensitive: false },
      { key: 'parcels.create', label: 'تسجيل وإدخال طرد / شحنة جديدة', action: 'create', isSensitive: false },
      { key: 'parcels.edit', label: 'تعديل بيانات الطرد (المرسل، المستلم، الأوزان)', action: 'edit', isSensitive: false },
      { key: 'parcels.delete', label: 'حذف أو إلغاء طرد مسجل بالنظام', action: 'delete', isSensitive: true },
      { key: 'parcels.override_pricing', label: 'تعديل وتجاوز أجور الشحن والخصم يدوياً', action: 'special', isSensitive: true },
      { key: 'parcels.print_consignment', label: 'طباعة بوليصة الشحن A4 والباركود والإيصال', action: 'export_print', isSensitive: false },
      { key: 'parcels.view_cod_amount', label: 'إظهار مبالغ التحصيل ضد الدفع (COD)', action: 'view', isSensitive: false },
      { key: 'parcels.view_phone_numbers', label: 'إظهار أرقام هواتف العملاء كاملة دون حجب', action: 'view', isSensitive: false },
      { key: 'parcels.view_national_id', label: 'إظهار والتحقق من الرقم الوطني للعميل', action: 'view', isSensitive: false },
      { key: 'parcels.reroute', label: 'إعادة توجيه وتحويل الطرد إلى فرع / وجهة بديلة', action: 'special', isSensitive: true },
      { key: 'parcels.resolve_shortage', label: 'معالجة الطرود الناقصة وتسوية التعويض المالي', action: 'special', isSensitive: true },
    ],
  },
  {
    id: 'manifests',
    label: 'الترحيل ومنافيست الشاحنات (Truck Manifests)',
    description: 'إنشاء كشوفات الشاحنات، ترحيل البضائع بين المحافظات وطباعة البيانات الرسمية',
    icon: 'Truck',
    items: [
      { key: 'manifests.view', label: 'عرض كشوفات ومنافيست الترحيل بين المحافظات', action: 'view', isSensitive: false },
      { key: 'manifests.create', label: 'إنشاء وإصدار منافيست شاحنة جديد', action: 'create', isSensitive: false },
      { key: 'manifests.edit', label: 'تعديل بيانات المنافيست، السائق ورقم اللوحة', action: 'edit', isSensitive: false },
      { key: 'manifests.delete', label: 'إلغاء أو حذف منافيست شاحنة مسجل', action: 'delete', isSensitive: true },
      { key: 'manifests.dispatch', label: 'تأكيد ترحيل وانطلاق الشاحنة على الطريق', action: 'special', isSensitive: false },
      { key: 'manifests.print', label: 'طباعة كشف ومنافيست الشاحنة A4 الرسمي', action: 'export_print', isSensitive: false },
    ],
  },
  {
    id: 'arrivals',
    label: 'مستودع الاستلام والوارد (Arrivals & Warehouse)',
    description: 'استلام الشاحنات القادمة، جرد ومطابقة الباركود، وإدارة طرود الركود',
    icon: 'Warehouse',
    items: [
      { key: 'arrivals.view', label: 'عرض شاشة مستودع الاستلام والطرود الواصلة', action: 'view', isSensitive: false },
      { key: 'arrivals.receive_truck', label: 'تأكيد وصول وتفريغ الشاحنة بالمستودع', action: 'special', isSensitive: false },
      { key: 'arrivals.scan_barcode', label: 'مسح الباركود وجرد ومطابقة الطرود الواردة', action: 'special', isSensitive: false },
      { key: 'arrivals.discharge_inspect', label: 'اعتماد تفريغ الشاحنة وفحص مطابقة الطرود', action: 'special', isSensitive: false },
      { key: 'arrivals.manage_overdue', label: 'إدارة طرود الركود وغرامات التخزين والمطالبات', action: 'edit', isSensitive: false },
      { key: 'arrivals.notify_receiver', label: 'إرسال إشعار SMS / واتساب للزبون بوصول الطرد', action: 'special', isSensitive: false },
    ],
  },
  {
    id: 'delivery',
    label: 'قسم التسليم والتوزيع (Delivery & Handover)',
    description: 'تسليم الطرود للزبائن في المركز أو عبر الموزعين مع تصوير الهوية والتحصيل',
    icon: 'PackageCheck',
    items: [
      { key: 'delivery.view', label: 'عرض شاشة التسليم ومنافيست الموزعين', action: 'view', isSensitive: false },
      { key: 'delivery.assign_courier', label: 'تسليم وتكليف مناديب التوزيع بالطرود', action: 'create', isSensitive: false },
      { key: 'delivery.deliver_customer', label: 'تسليم الطرد للزبون بالفرع وتسجيل المستلم', action: 'special', isSensitive: false },
      { key: 'delivery.settle_courier', label: 'تصفية وإقفال عهدة المندوب المالية وتسليم النقد', action: 'special', isSensitive: true },
      { key: 'delivery.record_national_id_photo', label: 'تصوير وأرشفة بطاقة الهوية والتوقيع للمستلم', action: 'special', isSensitive: false },
      { key: 'delivery.forward_to_cashier', label: 'تحويل قبض وتحصيل الطرد لأمين الصندوق', action: 'special', isSensitive: false },
    ],
  },
  {
    id: 'cashbox',
    label: 'الصناديق واليومية والمقاصة (Cashbox & Settlements)',
    description: 'إدارة حركة النقدية (SYP/USD)، صرف الحوالات COD، السندات، وإغلاق اليومية',
    icon: 'WalletCards',
    items: [
      { key: 'cashbox.view', label: 'عرض سجل حركات الصندوق واليوميات والترصيد', action: 'view', isSensitive: false },
      { key: 'cashbox.view_balances', label: 'إظهار أرصدة الصندوق النقدية (ل.س و $)', action: 'view', isSensitive: true },
      { key: 'cashbox.cash_in', label: 'تسجيل سند قبض / توريد نقد للصندوق', action: 'create', isSensitive: true },
      { key: 'cashbox.cash_out', label: 'تسجيل سند صرف / دفع نثريات ومصاريف', action: 'create', isSensitive: true },
      { key: 'cashbox.settle_cod', label: 'تسليم وصرف مبالغ ضد الدفع COD للمرسلين', action: 'special', isSensitive: true },
      { key: 'cashbox.allow_negative_disbursement', label: 'السماح بالصرف بالسالب وتجاوز رصيد الصندوق المتاح', action: 'special', isSensitive: true },
      { key: 'cashbox.shift_settlement', label: 'ترصيد وإغلاق صندوق الوردية وتصفيره للمدير', action: 'special', isSensitive: true },
      { key: 'cashbox.daily_closing', label: 'إغلاق الصندوق اليومي ورفع الترحيل للمركز', action: 'special', isSensitive: true },
      { key: 'cashbox.approve_settlement', label: 'الموافقة على تسويات الفروع والمقاصة (إدارة)', action: 'special', isSensitive: true },
      { key: 'cashbox.master_ledger', label: 'الاطلاع على سجل الصناديق العام لكافة الفروع', action: 'view', isSensitive: true },
      { key: 'cashbox.delete_voucher', label: 'إلغاء وحذف سند مالي مسجل (صرف أو قبض)', action: 'delete', isSensitive: true },
    ],
  },
  {
    id: 'pricing',
    label: 'محرك التسعير وجدول التقاطعات (Pricing Engine)',
    description: 'إدارة أجور الشحن بين المحافظات الـ 14، فئات الأحجام، وخوارزمية المسافات والـ COD',
    icon: 'SlidersHorizontal',
    items: [
      { key: 'pricing.view', label: 'عرض جدول التقاطعات ومحاكي الأسعار', action: 'view', isSensitive: false },
      { key: 'pricing.edit_matrix', label: 'تعديل وتثبيت أجور مسارات المحافظات الـ 14', action: 'edit', isSensitive: true },
      { key: 'pricing.edit_size_tiers', label: 'تعديل تسعيرة فئات الأحجام الـ 5 (XS, S, M, L, XL)', action: 'edit', isSensitive: true },
      { key: 'pricing.edit_distance_settings', label: 'تعديل معايير خوارزمية المسافات وعمولات COD', action: 'edit', isSensitive: true },
      { key: 'pricing.edit_cod_settings', label: 'تعديل سياسات وإعدادات تحصيل حوالات COD', action: 'edit', isSensitive: true },
    ],
  },
  {
    id: 'admin_users',
    label: 'المستخدمين والفروع والهيكل التنظيمي (Users & Branches)',
    description: 'إدارة الحسابات، الصلاحيات، الفروع الرئيسية، وفروع التجميع ومراكز التوزيع',
    icon: 'Users',
    items: [
      { key: 'users.view', label: 'عرض قائمة المستخدمين والفروع والنشاط', action: 'view', isSensitive: false },
      { key: 'users.create_user', label: 'إضافة مستخدم جديد وتحديد صلاحياته وأدواره', action: 'create', isSensitive: true },
      { key: 'users.edit_user', label: 'تعديل بيانات وصلاحيات وربط فروع المستخدمين', action: 'edit', isSensitive: true },
      { key: 'users.delete_user', label: 'حذف أو تعطيل حساب مستخدم مسجل', action: 'delete', isSensitive: true },
      { key: 'users.create_branch', label: 'إضافة وتعديل الفروع ومراكز التجميع وعمولاتها', action: 'create', isSensitive: true },
      { key: 'users.switch_branch_freely', label: 'حرية التبديل بين أي فرع دون تقييد بفرعه المخصص', action: 'special', isSensitive: true },
    ],
  },
  {
    id: 'backup_cloud',
    label: 'النسخ الاحتياطي ومزامنة السيرفر (Backup & Sync)',
    description: 'تصدير واستيراد بيانات النظام JSON، ربط سيرفر VPS، وإعادة ضبط المصنع',
    icon: 'Database',
    items: [
      { key: 'backup.view', label: 'عرض شاشة النسخ الاحتياطي وإعدادات السيرفر', action: 'view', isSensitive: true },
      { key: 'backup.export', label: 'تصدير وحفظ نسخة احتياطية كاملة JSON', action: 'export_print', isSensitive: true },
      { key: 'backup.import', label: 'استيراد واستعادة قاعدة البيانات من ملف خارجي', action: 'special', isSensitive: true },
      { key: 'backup.reset_demo', label: 'إعادة تهيئة النظام وضبط بيانات العرض التجريبية', action: 'delete', isSensitive: true },
      { key: 'backup.vps_config', label: 'إدارة إعدادات الربط مع سيرفر VPS والمزامنة اللحظية', action: 'edit', isSensitive: true },
    ],
  },
  {
    id: 'customers',
    label: 'دليل وسجلات العملاء (Customers Directory & CRM)',
    description: 'إدارة وتوثيق بطاقات الهوية، الأرشيف، بيانات الزبائن، والبحث السريع',
    icon: 'Contact',
    items: [
      { key: 'customers.view', label: 'عرض واستعراض دليل العملاء والبحث', action: 'view', isSensitive: false },
      { key: 'customers.create', label: 'إضافة عميل جديد وتوثيق الهوية وجهين', action: 'create', isSensitive: false },
      { key: 'customers.edit', label: 'تعديل بيانات العميل وصور الهوية والبيانات المدنية', action: 'edit', isSensitive: false },
      { key: 'customers.delete', label: 'حذف عميل أو تقييده في القائمة السوداء', action: 'delete', isSensitive: true },
      { key: 'customers.export', label: 'تصدير وطباعة كشوفات العملاء', action: 'export_print', isSensitive: false },
      { key: 'customers.portal_credentials', label: 'إدارة وتعيين رمز PIN لبوابة تتبع العميل', action: 'edit', isSensitive: false },
    ],
  },
  {
    id: 'vehicles',
    label: 'دليل المركبات والأسطول (Vehicles & Fleet Directory)',
    description: 'إدارة الشاحنات، اللوحات، الصيانة الدورية، رخص السير، وتكليف السائقين',
    icon: 'CarFront',
    items: [
      { key: 'vehicles.view', label: 'عرض دليل أسطول المركبات والشاحنات', action: 'view', isSensitive: false },
      { key: 'vehicles.create', label: 'إضافة مركبة / شاحنة جديدة للأسطول', action: 'create', isSensitive: true },
      { key: 'vehicles.edit', label: 'تعديل بيانات المركبة وتواريخ الصيانة والتأمين', action: 'edit', isSensitive: true },
      { key: 'vehicles.delete', label: 'حذف أو إيقاف مركبة عن الخدمة والتشغيل', action: 'delete', isSensitive: true },
      { key: 'vehicles.maintenance', label: 'تسجيل ومتابعة صيانة المركبة والمحروقات', action: 'special', isSensitive: false },
    ],
  },
  {
    id: 'employees_payroll',
    label: 'دليل الموظفين ومسير الرواتب (Employees & Payroll)',
    description: 'إدارة الكادر الوظيفي، العقود، الرواتب، البدلات، والاستقطاعات والصرف',
    icon: 'BadgePercent',
    items: [
      { key: 'employees.view', label: 'عرض دليل وبيانات الموظفين والبطاقات', action: 'view', isSensitive: false },
      { key: 'employees.create', label: 'إضافة وتعيين موظف جديد بالفرع أو الإدارة', action: 'create', isSensitive: true },
      { key: 'employees.edit', label: 'تعديل بيانات الموظف والراتب والبدلات والوثائق', action: 'edit', isSensitive: true },
      { key: 'employees.delete', label: 'إنهاء خدمة أو حذف بطاقة موظف', action: 'delete', isSensitive: true },
      { key: 'payroll.view', label: 'عرض مسير وكشوف الرواتب الشهرية والبدلات', action: 'view', isSensitive: true },
      { key: 'payroll.pay', label: 'اعتماد وصرف الرواتب وقيدها في صندوق الفرع', action: 'special', isSensitive: true },
    ],
  },
  {
    id: 'expenses',
    label: 'دليل المصاريف التشغيلية (Operational Expenses Directory)',
    description: 'إدارة النفقات اليومية، المحروقات، الصيانة، والإيجارات وفواتير التشغيل',
    icon: 'Receipt',
    items: [
      { key: 'expenses.view', label: 'عرض دليل وسجلات المصاريف التشغيلية', action: 'view', isSensitive: false },
      { key: 'expenses.create', label: 'تسجيل سند مصروف وإرفاق صورة الفاتورة', action: 'create', isSensitive: true },
      { key: 'expenses.approve', label: 'الموافقة والاعتماد المالي للمصروف وصرفه', action: 'special', isSensitive: true },
      { key: 'expenses.delete', label: 'إلغاء أو حذف سند مصروف مسجل', action: 'delete', isSensitive: true },
      { key: 'expenses.manage_categories', label: 'إضافة وتعديل بنود وفئات المصاريف التشغيلية', action: 'edit', isSensitive: true },
    ],
  },
  {
    id: 'fixed_assets',
    label: 'إدارة الأصول الثابتة (Fixed Assets)',
    description: 'تسجيل ومتابعة أصول الفروع، أجهزة الكمبيوتر، طابعات الباركود، التجهيزات، والصيانة',
    icon: 'Cpu',
    items: [
      { key: 'assets.view', label: 'عرض دليل وجدول أصول الفرع والبحث', action: 'view', isSensitive: false },
      { key: 'assets.view_all_branches', label: 'عرض أصول كامل فروع الشركة والفلترة (إدارة)', action: 'view', isSensitive: true },
      { key: 'assets.create', label: 'تسجيل أصل ثابت جديد وإدخال بياناته وقيمته', action: 'create', isSensitive: true },
      { key: 'assets.edit', label: 'تعديل بيانات الأصل، حالته التشغيلية والعهدة', action: 'edit', isSensitive: true },
      { key: 'assets.delete', label: 'حذف أو استبعاد أصل مسجل بالنظام', action: 'delete', isSensitive: true },
      { key: 'assets.link_expense', label: 'ربط مصاريف الصيانة والتشغيل بالأصل', action: 'special', isSensitive: false },
    ],
  },
  {
    id: 'shortcuts',
    label: 'لوحة الإختصارات والتوجيهات (Shortcuts & Directives)',
    description: 'التحكم في وصول المستخدم للوحة الإختصارات، تخصيص الأزرار المتاحة، والوصول للرسائل والتوجيهات',
    icon: 'SlidersHorizontal',
    items: [
      { key: 'shortcuts.view', label: 'إتاحة وعرض زر لوحة الإختصارات السريعة', action: 'view', isSensitive: false },
      { key: 'shortcuts.customize', label: 'السماح للمستخدم بتخصيص وإضافة/حذف أزرار اختصاراته', action: 'edit', isSensitive: false },
      { key: 'shortcuts.financial_actions', label: 'السماح باختصارات العمليات والتحصيلات وسندات الصرف/القبض', action: 'special', isSensitive: true },
      { key: 'shortcuts.reports', label: 'السماح باختصارات الكشوفات والتقارير الإدارية والتشغيلية', action: 'view', isSensitive: false },
      { key: 'directives.view', label: 'عرض المراسلات والكتب التوجيهية الرسمية الموجهة له', action: 'view', isSensitive: false },
      { key: 'directives.send', label: 'تحرير وإصدار توجيهات وكتب إدارية جديدة', action: 'create', isSensitive: true },
      { key: 'directives.delete', label: 'حذف أو أرشفة توجيه إداري مرسل', action: 'delete', isSensitive: true },
    ],
  },
];

export const ROLE_DEFINITIONS: Record<
  UserRole,
  {
    title: string;
    subtitle: string;
    badgeColor: string;
    allowedModules: string[];
    primaryModule: ActiveModule;
    forbiddenDescription: string;
  }
> = {
  super_admin: {
    title: 'المدير التنفيذي العام',
    subtitle: 'صلاحيات سيادية كاملة ومطلقة على كافة واجهات النظام الـ 16 دون أي قيود',
    badgeColor: 'bg-rose-500/20 text-rose-300 border-rose-500/40',
    allowedModules: [
      'dashboard',
      'intake',
      'manifests',
      'arrivals',
      'delivery',
      'cashbox',
      'pricing',
      'admin_users',
      'backup_cloud',
      'master_admin',
      'customers',
      'vehicles',
      'employees_payroll',
      'payroll',
      'expenses',
      'fixed_assets',
      'courier_portal',
    ],
    primaryModule: 'dashboard',
    forbiddenDescription: 'وصول شامل وغير مقيد لكافة الإعدادات والعمليات والرقابة المركزية',
  },
  hub_manager: {
    title: 'مدير المركز / الفرع',
    subtitle: 'إدارة العمليات التشغيلية للفرع (الطرود، الشاحنات، المستودع، الصندوق، الموظفين، والأصول)',
    badgeColor: 'bg-amber-500/20 text-amber-300 border-amber-500/40',
    allowedModules: [
      'intake',
      'manifests',
      'arrivals',
      'delivery',
      'customers',
      'vehicles',
      'employees_payroll',
      'payroll',
      'expenses',
      'fixed_assets',
      'courier_portal',
    ],
    primaryModule: 'intake',
    forbiddenDescription: 'محجوب عن: لوحة المؤشرات المركزية، التسعير العام، إدارة الحسابات، والنسخ الاحتياطي',
  },
  outbound_operator: {
    title: 'مدخل بيانات (صادر وشحن للمراكز)',
    subtitle: 'استلام الطرد من العميل، تسجيل البيانات، إصدار بوالص الشحن، وتحضير المانافيست، مع إدارة صندوق الصادر وسجل الحركات المالية وترصيد العهدة للمدير',
    badgeColor: 'bg-blue-500/20 text-blue-300 border-blue-500/40',
    allowedModules: ['intake', 'manifests', 'customers'],
    primaryModule: 'intake',
    forbiddenDescription: 'مخصص للصادر (استقبال الطرود + ترحيل الشاحنات + إدارة صندوق الصادر عبر شريط الرقابة والترصيد) • محجوب عن الوارد ولوحات الإدارة المركزية والخزينة العامة',
  },
  inbound_operator: {
    title: 'مسؤول تسليم الطرد والوارد',
    subtitle: 'استلام وتفريغ الشاحنات، تسليم الطرود للعملاء والموزعين، مع إدارة صندوق الوارد والتحصيلات وسجل الحركات وترصيد المبالغ للمدير',
    badgeColor: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40',
    allowedModules: ['arrivals', 'delivery', 'customers'],
    primaryModule: 'arrivals',
    forbiddenDescription: 'مخصص للوارد والتسليم (مستودع الوصول + قسم التسليم + إدارة صندوق الوارد عبر شريط الرقابة والترصيد) • محجوب عن الصادر ولوحات الإدارة المركزية والخزينة العامة',
  },
  reception_data_entry: {
    title: 'مدخل بيانات (استقبال وشحن للمراكز)',
    subtitle: 'استلام الطرد من العميل، تسجيل البيانات، إصدار بوالص الشحن، وتحضير المانافيست، مع إدارة صندوق الصادر وسجل الحركات المالية وترصيد العهدة للمدير',
    badgeColor: 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40',
    allowedModules: ['intake', 'manifests', 'customers'],
    primaryModule: 'intake',
    forbiddenDescription: 'مخصص للاستقبال والصادر (استقبال الطرود + ترحيل الشاحنات + إدارة صندوق الصادر عبر شريط الرقابة والترصيد) • محجوب عن الوارد ولوحات الإدارة المركزية والخزينة العامة',
  },
  warehouse_keeper: {
    title: 'أمين المستودع والأسطول',
    subtitle: 'تفريغ واستلام وجرد المستودع، متابعة الركود، كشوفات تحميل الشاحنات، وجاهزية المركبات',
    badgeColor: 'bg-teal-500/20 text-teal-300 border-teal-500/40',
    allowedModules: ['arrivals', 'manifests', 'vehicles'],
    primaryModule: 'arrivals',
    forbiddenDescription: 'محجوب تماماً عن: إدخال الطرود، تسليم الصناديق، التقارير المالية، ولوحات الإدارة',
  },
  cashier: {
    title: 'أمين صندوق الفرع (مالية ومقاصة)',
    subtitle: 'العمليات المالية للفرع، إدارة الخزينة والصناديق، اعتماد سندات ترصيد الورديات وتصفير الصناديق، المقاصة وسجل المصاريف',
    badgeColor: 'bg-amber-500/20 text-amber-300 border-amber-500/40',
    allowedModules: ['expenses', 'delivery'],
    primaryModule: 'delivery',
    forbiddenDescription: 'مخصص لإدارة الصناديق، اليوميات، سندات القبض والدفع، اعتماد ترصيد الورديات والمقاصة وسجل المصاريف',
  },
  accountant: {
    title: 'محاسب الفرع / المالي',
    subtitle: 'إدارة السجلات المحاسبية والقيود وسندات القبض والصرف وتدقيق الصناديق',
    badgeColor: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40',
    allowedModules: ['expenses', 'payroll', 'fixed_assets', 'dashboard'],
    primaryModule: 'expenses',
    forbiddenDescription: 'محجوب عن الإعدادات الهيكلية للنظام',
  },
  operations: {
    title: 'مسؤول العمليات والتشغيل',
    subtitle: 'متابعة حركة الشحنات والشاحنات والمنافيست والربط الميداني',
    badgeColor: 'bg-blue-500/20 text-blue-300 border-blue-500/40',
    allowedModules: ['dashboard', 'intake', 'manifests', 'arrivals', 'delivery', 'vehicles'],
    primaryModule: 'dashboard',
    forbiddenDescription: 'محجوب عن الصناديق المالية الرئيسية والإعدادات الجذرية',
  },
  courier: {
    title: 'مندوب توزيع محلي (الموزع)',
    subtitle: 'بوابة الجوال المخصصة لاستقبال المانافيست، التسليم الفردي، إرجاع الطرود بالسبب، وتصفية العهدة المالية',
    badgeColor: 'bg-purple-500/20 text-purple-300 border-purple-500/40',
    allowedModules: ['courier_portal', 'delivery'],
    primaryModule: 'courier_portal',
    forbiddenDescription: 'محجوب قطعياً عن باقي واجهات الإدارة المركزية والنظام',
  },
  warehouseman: {
    title: 'عامل مستودع ومناولة',
    subtitle: 'مناولة البضائع والطرود، المساعدة في التفريغ والتحميل وجرد المستودع',
    badgeColor: 'bg-teal-600/20 text-teal-300 border-teal-600/40',
    allowedModules: ['arrivals', 'manifests'],
    primaryModule: 'arrivals',
    forbiddenDescription: 'محجوب عن الإعدادات الإدارية والصناديق المالية',
  },
  driver: {
    title: 'سائق شاحنة شحن',
    subtitle: 'قيادة شاحنات النقل بين الفروع والمحافظات ومتابعة المنافيست والجاهزية',
    badgeColor: 'bg-indigo-500/20 text-indigo-300 border-indigo-500/40',
    allowedModules: ['manifests', 'vehicles'],
    primaryModule: 'manifests',
    forbiddenDescription: 'محجوب عن العمليات المكتبية والصناديق المالية',
  },
  custom: {
    title: 'دور مخصص',
    subtitle: 'صلاحيات مخصصة حسب التعيين الإداري',
    badgeColor: 'bg-slate-500/20 text-slate-300 border-slate-500/40',
    allowedModules: ['intake'],
    primaryModule: 'intake',
    forbiddenDescription: 'حسب الصلاحيات المحددة من الإدارة المركزية',
  },
};

export const getDefaultModuleForRole = (role: UserRole): ActiveModule => {
  return ROLE_DEFINITIONS[role]?.primaryModule || 'intake';
};

export const getDefaultPermissionsForRole = (role: UserRole): UserPermissions => {
  // Helper to build explicit actions dict
  const buildActions = (enabledKeys: string[]): Record<string, boolean> => {
    const actions: Record<string, boolean> = {};
    ALL_PERMISSION_CATEGORIES.forEach((cat) => {
      cat.items.forEach((item) => {
        actions[item.key] = enabledKeys.includes(item.key);
      });
    });
    return actions;
  };

  // 1. SUPER ADMIN - FULL ACCESS TO EVERYTHING
  if (role === 'super_admin') {
    const allActionKeys: string[] = [];
    ALL_PERMISSION_CATEGORIES.forEach((cat) => {
      cat.items.forEach((item) => allActionKeys.push(item.key));
    });

    return {
      modules: {
        dashboard: true,
        intake: true,
        manifests: true,
        arrivals: true,
        delivery: true,
        courier_portal: true,
        cashbox: true,
        pricing: true,
        admin_users: true,
        backup_cloud: true,
        master_admin: true,
        customers: true,
        vehicles: true,
        employees_payroll: true,
        payroll: true,
        expenses: true,
        fixed_assets: true,
      },
      actions: buildActions(allActionKeys),
      fieldRestrictions: {
        canViewFinancialTotals: true,
        canViewClientPhoneNumbers: true,
        canViewNationalId: true,
        canOverridePrices: true,
        canSwitchBranches: true,
        canDeleteRecords: true,
        canDisburseNegativeBalance: true,
      },
    };
  }

  // 2. HUB MANAGER - OPERATIONAL BRANCH MANAGEMENT
  if (role === 'hub_manager') {
    const managerKeys = [
      'parcels.view',
      'parcels.create',
      'parcels.edit',
      'parcels.print_consignment',
      'parcels.override_pricing',
      'parcels.view_cod_amount',
      'parcels.view_phone_numbers',
      'parcels.view_national_id',
      'parcels.reroute',
      'parcels.resolve_shortage',
      'manifests.view',
      'manifests.create',
      'manifests.edit',
      'manifests.dispatch',
      'manifests.print',
      'arrivals.view',
      'arrivals.receive_truck',
      'arrivals.scan_barcode',
      'arrivals.discharge_inspect',
      'arrivals.manage_overdue',
      'arrivals.notify_receiver',
      'delivery.view',
      'delivery.assign_courier',
      'delivery.deliver_customer',
      'delivery.settle_courier',
      'delivery.record_national_id_photo',
      'delivery.forward_to_cashier',
      'cashbox.view',
      'cashbox.view_balances',
      'cashbox.cash_in',
      'cashbox.cash_out',
      'cashbox.settle_cod',
      'cashbox.shift_settlement',
      'cashbox.daily_closing',
      'cashbox.approve_settlement',
      'customers.view',
      'customers.create',
      'customers.edit',
      'customers.export',
      'customers.portal_credentials',
      'vehicles.view',
      'vehicles.create',
      'vehicles.edit',
      'vehicles.maintenance',
      'employees.view',
      'payroll.view',
      'payroll.pay',
      'expenses.view',
      'expenses.create',
      'expenses.approve',
      'assets.view',
      'assets.create',
      'assets.edit',
      'assets.link_expense',
      'shortcuts.view',
      'shortcuts.customize',
      'shortcuts.financial_actions',
      'shortcuts.reports',
      'directives.view',
      'directives.send',
    ];

    return {
      modules: {
        dashboard: false,
        intake: true,
        manifests: true,
        arrivals: true,
        delivery: true,
        courier_portal: true,
        cashbox: false,
        pricing: false,
        admin_users: false,
        backup_cloud: false,
        master_admin: false,
        customers: true,
        vehicles: true,
        employees_payroll: true,
        payroll: true,
        expenses: true,
        fixed_assets: true,
      },
      actions: buildActions(managerKeys),
      fieldRestrictions: {
        canViewFinancialTotals: true,
        canViewClientPhoneNumbers: true,
        canViewNationalId: true,
        canOverridePrices: true,
        canSwitchBranches: false,
        canDeleteRecords: false,
        canDisburseNegativeBalance: false,
      },
    };
  }

  // 3. OUTBOUND OPERATOR (مدخل بيانات ومسؤول الصادر مع صندوق الصادر المدمج) - Intake, Manifests & Outgoing Cashbox
  if (role === 'outbound_operator' || role === 'reception_data_entry') {
    const outboundKeys = [
      'parcels.view',
      'parcels.create',
      'parcels.edit',
      'parcels.print_consignment',
      'parcels.view_phone_numbers',
      'parcels.view_national_id',
      'parcels.view_cod_amount',
      'manifests.view',
      'manifests.create',
      'manifests.edit',
      'manifests.dispatch',
      'manifests.print',
      'customers.view',
      'customers.create',
      'customers.edit',
      'cashbox.view',
      'cashbox.view_balances',
      'cashbox.shift_settlement',
      'shortcuts.view',
      'shortcuts.customize',
      'directives.view',
    ];

    return {
      modules: {
        dashboard: false,
        intake: true,
        manifests: true,
        arrivals: false,
        delivery: false,
        cashbox: false,
        pricing: false,
        admin_users: false,
        backup_cloud: false,
        master_admin: false,
        customers: true,
        vehicles: false,
        employees_payroll: false,
        payroll: false,
        expenses: false,
        fixed_assets: false,
      },
      actions: buildActions(outboundKeys),
      fieldRestrictions: {
        canViewFinancialTotals: true,
        canViewClientPhoneNumbers: true,
        canViewNationalId: true,
        canOverridePrices: false,
        canSwitchBranches: false,
        canDeleteRecords: false,
        canDisburseNegativeBalance: false,
      },
      allowedShortcuts: [],
    };
  }

  // 4. INBOUND OPERATOR (مسؤول تسليم الطرد والوارد مع صندوق الوارد والتسليم المدمج) - Arrivals, Delivery & Incoming Cashbox
  if (role === 'inbound_operator') {
    const inboundKeys = [
      'arrivals.view',
      'arrivals.receive_truck',
      'arrivals.scan_barcode',
      'arrivals.discharge_inspect',
      'arrivals.manage_overdue',
      'arrivals.notify_receiver',
      'delivery.view',
      'delivery.assign_courier',
      'delivery.deliver_customer',
      'delivery.record_national_id_photo',
      'delivery.forward_to_cashier',
      'delivery.settle_courier',
      'parcels.view',
      'parcels.print_consignment',
      'parcels.view_phone_numbers',
      'parcels.view_national_id',
      'parcels.view_cod_amount',
      'customers.view',
      'customers.create',
      'cashbox.view',
      'cashbox.view_balances',
      'cashbox.settle_cod',
      'cashbox.shift_settlement',
      'shortcuts.view',
      'shortcuts.customize',
      'directives.view',
    ];

    return {
      modules: {
        dashboard: false,
        intake: false,
        manifests: false,
        arrivals: true,
        delivery: true,
        cashbox: false,
        pricing: false,
        admin_users: false,
        backup_cloud: false,
        master_admin: false,
        customers: true,
        vehicles: false,
        employees_payroll: false,
        payroll: false,
        expenses: false,
        fixed_assets: false,
      },
      actions: buildActions(inboundKeys),
      fieldRestrictions: {
        canViewFinancialTotals: true,
        canViewClientPhoneNumbers: true,
        canViewNationalId: true,
        canOverridePrices: false,
        canSwitchBranches: false,
        canDeleteRecords: false,
        canDisburseNegativeBalance: false,
      },
      allowedShortcuts: [],
    };
  }

  // 5. WAREHOUSE KEEPER (أمين المستودع والأسطول) - Arrivals Unloading, Manifest Loading & Vehicles ONLY
  if (role === 'warehouse_keeper') {
    const keeperKeys = [
      'arrivals.view',
      'arrivals.receive_truck',
      'arrivals.scan_barcode',
      'arrivals.discharge_inspect',
      'arrivals.manage_overdue',
      'manifests.view',
      'manifests.edit',
      'manifests.print',
      'vehicles.view',
      'vehicles.edit',
      'vehicles.maintenance',
      'parcels.view',
      'parcels.print_consignment',
      'shortcuts.view',
      'shortcuts.customize',
      'shortcuts.reports',
      'directives.view',
    ];

    return {
      modules: {
        dashboard: false,
        intake: false,
        manifests: true,
        arrivals: true,
        delivery: false,
        cashbox: false,
        pricing: false,
        admin_users: false,
        backup_cloud: false,
        master_admin: false,
        customers: false,
        vehicles: true,
        employees_payroll: false,
        payroll: false,
        expenses: false,
        fixed_assets: false,
      },
      actions: buildActions(keeperKeys),
      fieldRestrictions: {
        canViewFinancialTotals: false,
        canViewClientPhoneNumbers: true,
        canViewNationalId: false,
        canOverridePrices: false,
        canSwitchBranches: false,
        canDeleteRecords: false,
        canDisburseNegativeBalance: false,
      },
    };
  }

  // 6. CASHIER (أمين الصندوق والمحاسب) - Cashbox, Expenses & Settlement Approval
  if (role === 'cashier') {
    const cashierKeys = [
      'cashbox.view',
      'cashbox.view_balances',
      'cashbox.settle_cod',
      'cashbox.daily_closing',
      'cashbox.approve_settlement',
      'delivery.view',
      'delivery.settle_courier',
      'delivery.deliver_customer',
      'parcels.view',
      'parcels.view_cod_amount',
      'expenses.view',
      'expenses.create',
      'shortcuts.view',
      'shortcuts.customize',
      'directives.view',
    ];

    return {
      modules: {
        dashboard: false,
        intake: false,
        manifests: false,
        arrivals: false,
        delivery: true,
        cashbox: false,
        pricing: false,
        admin_users: false,
        backup_cloud: false,
        master_admin: false,
        customers: false,
        vehicles: false,
        employees_payroll: false,
        payroll: false,
        expenses: true,
        fixed_assets: false,
      },
      actions: buildActions(cashierKeys),
      fieldRestrictions: {
        canViewFinancialTotals: true,
        canViewClientPhoneNumbers: true,
        canViewNationalId: true,
        canOverridePrices: false,
        canSwitchBranches: false,
        canDeleteRecords: false,
        canDisburseNegativeBalance: false,
      },
      allowedShortcuts: [],
    };
  }

  // 7. COURIER (مندوب التوزيع) - Assigned Deliveries ONLY
  if (role === 'courier') {
    const courierKeys = [
      'delivery.view',
      'delivery.deliver_customer',
      'delivery.record_national_id_photo',
      'parcels.view_phone_numbers',
      'parcels.view_cod_amount',
      'shortcuts.view',
      'directives.view',
    ];

    return {
      modules: {
        dashboard: false,
        intake: false,
        manifests: false,
        arrivals: false,
        delivery: true,
        courier_portal: true,
        cashbox: false,
        pricing: false,
        admin_users: false,
        backup_cloud: false,
        master_admin: false,
        customers: false,
        vehicles: false,
        employees_payroll: false,
        payroll: false,
        expenses: false,
        fixed_assets: false,
      },
      actions: buildActions(courierKeys),
      fieldRestrictions: {
        canViewFinancialTotals: false,
        canViewClientPhoneNumbers: true,
        canViewNationalId: true,
        canOverridePrices: false,
        canSwitchBranches: false,
        canDeleteRecords: false,
        canDisburseNegativeBalance: false,
      },
    };
  }

  // 8. WAREHOUSEMAN (عامل مستودع ومناولة)
  if (role === 'warehouseman') {
    const warehousemanKeys = [
      'arrivals.view',
      'arrivals.scan_barcode',
      'manifests.view',
      'directives.view',
      'shortcuts.view',
    ];
    return {
      modules: {
        dashboard: false,
        intake: false,
        manifests: true,
        arrivals: true,
        delivery: false,
        cashbox: false,
        pricing: false,
        admin_users: false,
        backup_cloud: false,
        master_admin: false,
        customers: false,
        vehicles: false,
        employees_payroll: false,
        payroll: false,
        expenses: false,
        fixed_assets: false,
      },
      actions: buildActions(warehousemanKeys),
      fieldRestrictions: {
        canViewFinancialTotals: false,
        canViewClientPhoneNumbers: false,
        canViewNationalId: false,
        canOverridePrices: false,
        canSwitchBranches: false,
        canDeleteRecords: false,
        canDisburseNegativeBalance: false,
      },
    };
  }

  // 9. DRIVER (سائق شاحنة شحن)
  if (role === 'driver') {
    const driverKeys = [
      'manifests.view',
      'manifests.dispatch',
      'vehicles.view',
      'vehicles.maintenance',
      'directives.view',
      'shortcuts.view',
    ];
    return {
      modules: {
        dashboard: false,
        intake: false,
        manifests: true,
        arrivals: false,
        delivery: false,
        cashbox: false,
        pricing: false,
        admin_users: false,
        backup_cloud: false,
        master_admin: false,
        customers: false,
        vehicles: true,
        employees_payroll: false,
        payroll: false,
        expenses: false,
        fixed_assets: false,
      },
      actions: buildActions(driverKeys),
      fieldRestrictions: {
        canViewFinancialTotals: false,
        canViewClientPhoneNumbers: false,
        canViewNationalId: false,
        canOverridePrices: false,
        canSwitchBranches: false,
        canDeleteRecords: false,
        canDisburseNegativeBalance: false,
      },
    };
  }

  // Default fallback for custom roles
  const defaultKeys = [
    'parcels.view',
    'parcels.create',
    'parcels.print_consignment',
    'customers.view',
    'shortcuts.view',
    'directives.view',
  ];
  return {
    modules: {
      dashboard: false,
      intake: true,
      manifests: false,
      arrivals: false,
      delivery: false,
      cashbox: false,
      pricing: false,
      admin_users: false,
      backup_cloud: false,
      master_admin: false,
      customers: true,
      vehicles: false,
      employees_payroll: false,
      payroll: false,
      expenses: false,
      fixed_assets: false,
    },
    actions: buildActions(defaultKeys),
    fieldRestrictions: {
      canViewFinancialTotals: false,
      canViewClientPhoneNumbers: true,
      canViewNationalId: false,
      canOverridePrices: false,
      canSwitchBranches: false,
      canDeleteRecords: false,
      canDisburseNegativeBalance: false,
    },
  };
};

/**
 * Normalizes action permission keys so aliases like parcels.print_a4 or cashbox.add_transaction
 * correctly map to their canonical keys.
 */
const normalizeActionKey = (key: string): string => {
  if (key === 'parcels.print_a4' || key === 'parcels.print_barcode') return 'parcels.print_consignment';
  if (key === 'parcels.view_phone') return 'parcels.view_phone_numbers';
  if (key === 'parcels.view_civil_id') return 'parcels.view_national_id';
  if (key === 'parcels.override_prices') return 'parcels.override_pricing';
  if (key === 'parcels.reroute_forward') return 'parcels.reroute';
  if (key === 'cashbox.add_transaction') return 'cashbox.cash_in';
  if (key === 'cashbox.spend_transaction') return 'cashbox.cash_out';
  if (key === 'cashbox.allow_negative_balance' || key === 'cashbox.negative_balance_disbursement') return 'cashbox.allow_negative_disbursement';
  if (key === 'assets.create_asset') return 'assets.create';
  if (key === 'vehicles.create_vehicle') return 'vehicles.create';
  if (key === 'expenses.record') return 'expenses.create';
  return key;
};

export const checkUserPermission = (
  user: User | null | undefined,
  permissionKey: string
): boolean => {
  if (!user) return false;
  // Super admin master override
  if (user.role === 'super_admin' || user.id === 'user_super_admin' || user.username === 'سليمان') return true;

  const normalizedKey = normalizeActionKey(permissionKey);

  // Check fieldRestrictions shortcuts if applicable
  if (normalizedKey === 'parcels.view_phone_numbers' && user.permissions?.fieldRestrictions?.canViewClientPhoneNumbers !== undefined) {
    if (!user.permissions.fieldRestrictions.canViewClientPhoneNumbers) return false;
  }
  if (normalizedKey === 'parcels.view_national_id' && user.permissions?.fieldRestrictions?.canViewNationalId !== undefined) {
    if (!user.permissions.fieldRestrictions.canViewNationalId) return false;
  }
  if (normalizedKey === 'parcels.override_pricing' && user.permissions?.fieldRestrictions?.canOverridePrices !== undefined) {
    if (!user.permissions.fieldRestrictions.canOverridePrices) return false;
  }
  if (normalizedKey === 'users.switch_branch_freely' && user.permissions?.fieldRestrictions?.canSwitchBranches !== undefined) {
    if (user.permissions.fieldRestrictions.canSwitchBranches) return true;
  }
  if (normalizedKey.endsWith('.delete') && user.permissions?.fieldRestrictions?.canDeleteRecords !== undefined) {
    if (!user.permissions.fieldRestrictions.canDeleteRecords && user.role !== 'hub_manager') return false;
  }
  if (normalizedKey === 'cashbox.allow_negative_disbursement' && user.permissions?.fieldRestrictions?.canDisburseNegativeBalance !== undefined) {
    return Boolean(user.permissions.fieldRestrictions.canDisburseNegativeBalance);
  }

  // Check explicit action permission in user.permissions
  if (user.permissions?.actions) {
    if (user.permissions.actions[normalizedKey] !== undefined) {
      return Boolean(user.permissions.actions[normalizedKey]);
    }
    if (user.permissions.actions[permissionKey] !== undefined) {
      return Boolean(user.permissions.actions[permissionKey]);
    }
  }

  // Fallback to strict role defaults
  const defaultPerms = getDefaultPermissionsForRole(user.role);
  if (normalizedKey === 'cashbox.allow_negative_disbursement' && defaultPerms.fieldRestrictions?.canDisburseNegativeBalance !== undefined) {
    return Boolean(defaultPerms.fieldRestrictions.canDisburseNegativeBalance);
  }
  if (defaultPerms.actions[normalizedKey] !== undefined) {
    return Boolean(defaultPerms.actions[normalizedKey]);
  }
  if (defaultPerms.actions[permissionKey] !== undefined) {
    return Boolean(defaultPerms.actions[permissionKey]);
  }

  return false;
};

/**
 * التحقق مما إذا كان المستخدم أو دوره مصرحاً له بالصرف بالسالب وتجاوز رصيد الصندوق المتوفر
 */
export const canUserDisburseNegativeBalance = (user: User | null | undefined): boolean => {
  if (!user) return false;
  if (user.role === 'super_admin' || user.id === 'user_super_admin' || user.username === 'سليمان') return true;

  if (user.permissions?.fieldRestrictions?.canDisburseNegativeBalance !== undefined) {
    return Boolean(user.permissions.fieldRestrictions.canDisburseNegativeBalance);
  }

  if (user.permissions?.actions?.['cashbox.allow_negative_disbursement'] !== undefined) {
    return Boolean(user.permissions.actions['cashbox.allow_negative_disbursement']);
  }

  const defaultPerms = getDefaultPermissionsForRole(user.role);
  if (defaultPerms.fieldRestrictions?.canDisburseNegativeBalance !== undefined) {
    return Boolean(defaultPerms.fieldRestrictions.canDisburseNegativeBalance);
  }

  return Boolean(defaultPerms.actions['cashbox.allow_negative_disbursement']);
};

export const checkUserModuleAccess = (
  user: User | null | undefined,
  moduleKey: string
): boolean => {
  if (!user) return false;
  // Super admin master override
  if (user.role === 'super_admin' || user.id === 'user_super_admin' || user.username === 'سليمان') return true;

  // Treasury / Cashbox Center (مركز الخزينة) is restricted strictly to Application Manager (super_admin)
  if (moduleKey === 'cashbox' || moduleKey === 'cashbox_quick') {
    return false;
  }

  // Normalize aliases
  let key = moduleKey;
  if (key === 'payroll') key = 'employees_payroll';
  if (key === 'cashbox') return false;

  // Check explicit module permission in user.permissions.modules
  if (user.permissions?.modules) {
    const directVal = user.permissions.modules[key as keyof typeof user.permissions.modules];
    if (directVal !== undefined) return Boolean(directVal);

    if (moduleKey === 'payroll' && user.permissions.modules.payroll !== undefined) {
      return Boolean(user.permissions.modules.payroll);
    }
  }

  // Fallback to strict role default modules
  const defaultPerms = getDefaultPermissionsForRole(user.role);
  const defaultVal = defaultPerms.modules[key as keyof typeof defaultPerms.modules];
  if (defaultVal !== undefined) {
    return Boolean(defaultVal);
  }

  if (moduleKey === 'payroll' && defaultPerms.modules.payroll !== undefined) {
    return Boolean(defaultPerms.modules.payroll);
  }

  return false;
};

/**
 * الأزرار الافتراضية للوحة الإختصارات السريعة مفروزة ومحددة بدقة لكل دور وظيفي
 */
export const ROLE_DEFAULT_SHORTCUTS: Record<UserRole, string[]> = {
  super_admin: [
    'analytics',
    'intake',
    'manifests',
    'cashbox',
    'receipt_voucher',
    'payment_voucher',
    'clearing',
    'directives',
    'users',
    'accounts',
  ],
  hub_manager: [
    'intake',
    'arrivals',
    'manifests',
    'delivery',
    'receipt_voucher',
    'payment_voucher',
    'clearing',
    'directives',
  ],
  outbound_operator: [
    'intake',
    'manifests',
    'shift_settlement',
    'report_cash_movement',
  ],
  inbound_operator: [
    'arrivals',
    'delivery',
    'shift_settlement',
    'report_cash_movement',
  ],
  reception_data_entry: [
    'intake',
    'manifests',
    'shift_settlement',
    'report_cash_movement',
  ],
  warehouse_keeper: [
    'arrivals',
    'manifests',
    'vehicles',
    'stagnant_sla',
    'report_stagnant_parcels',
    'directives',
  ],
  cashier: [
    'cashbox_quick',
    'report_cash_movement',
    'clearing',
    'report_operating_expenses',
  ],
  accountant: [
    'cashbox_quick',
    'report_cash_movement',
    'clearing',
    'report_operating_expenses',
  ],
  operations: [
    'intake',
    'arrivals',
    'manifests',
    'delivery',
    'vehicles',
    'directives',
  ],
  courier: [
    'delivery',
    'directives',
    'sound_toggle',
  ],
  warehouseman: [
    'arrivals',
    'manifests',
    'directives',
    'sound_toggle',
  ],
  driver: [
    'manifests',
    'vehicles',
    'directives',
    'sound_toggle',
  ],
  custom: [
    'intake',
    'search_spotlight',
    'directives',
    'sound_toggle',
  ],
};

/**
 * فحص استحقاق وأهلية المستخدم لزر معين في لوحة الإختصارات السريعة
 * يدمج صلاحيات الدور، الوحدات المصرحة، والصلاحيات الإجرائية، واستثناءات الإدارة لكل مستخدم
 */
export const isShortcutAllowedForUser = (
  shortcutId: string,
  user: User | null | undefined,
  canAccessModuleFn: (mod: ActiveModule) => boolean,
  hasPermissionFn: (perm: string) => boolean,
  currentBranch?: Branch | null
): boolean => {
  if (!user) return false;

  // 1. إذا كان إظهار لوحة الإختصارات ملغى لهذا المستخدم
  if (!hasPermissionFn('shortcuts.view')) {
    return false;
  }

  // 2. إذا حددت الإدارة المركزية قائمة أزرار مخصصة حصراً لهذا المستخدم
  if (user.permissions?.allowedShortcuts && Array.isArray(user.permissions.allowedShortcuts)) {
    if (user.permissions.allowedShortcuts.length > 0 && !user.permissions.allowedShortcuts.includes(shortcutId)) {
      return false;
    }
  }

  // 3. فحص الصلاحيات المالية التخصصية
  if (['clearing', 'receipt_voucher', 'payment_voucher', 'vault_transfer', 'cashbox_quick'].includes(shortcutId)) {
    if (!hasPermissionFn('shortcuts.financial_actions') && user.role !== 'super_admin') {
      return false;
    }
  }

  // 4. فحص صلاحيات التقارير والكشوفات
  if (shortcutId.startsWith('report_')) {
    if (!hasPermissionFn('shortcuts.reports') && user.role !== 'super_admin') {
      return false;
    }
  }

  // 5. فحص التوجيهات
  if (shortcutId === 'directives') {
    return hasPermissionFn('directives.view');
  }

  // 6. أدوات عامة مساعدة
  if (shortcutId === 'sound_toggle' || shortcutId === 'search_spotlight') {
    return true;
  }

  // 7. مطابقة كل زر مع وحدته التشغيلية وصلاحيته الإجرائية
  switch (shortcutId) {
    case 'intake':
      return canAccessModuleFn('intake') || hasPermissionFn('parcels.view');
    case 'arrivals':
      return canAccessModuleFn('arrivals') || hasPermissionFn('arrivals.view');
    case 'manifests':
      return canAccessModuleFn('manifests') || hasPermissionFn('manifests.view');
    case 'delivery':
      return canAccessModuleFn('delivery') || hasPermissionFn('delivery.view');
    case 'cashbox':
    case 'cashbox_quick':
      return user.role === 'super_admin';
    case 'pricing':
      return canAccessModuleFn('pricing') || hasPermissionFn('pricing.view');
    case 'analytics':
      return canAccessModuleFn('dashboard') || hasPermissionFn('dashboard.view');
    case 'users':
      return canAccessModuleFn('admin_users') || hasPermissionFn('users.view');
    case 'accounts':
    case 'forecasting':
    case 'audit':
      return user.role === 'super_admin' || canAccessModuleFn('master_admin');
    case 'payroll':
      return canAccessModuleFn('payroll') || user.permissions?.modules?.employees_payroll === true || hasPermissionFn('payroll.view');
    case 'expenses':
      return canAccessModuleFn('expenses') || hasPermissionFn('expenses.view');
    case 'customers':
      return canAccessModuleFn('customers') || hasPermissionFn('customers.view');
    case 'vehicles':
      return canAccessModuleFn('vehicles') || hasPermissionFn('vehicles.view');
    case 'fixed_assets':
      return canAccessModuleFn('fixed_assets') || hasPermissionFn('assets.view');
    case 'clearing':
      if (user.role === 'super_admin') return true;
      return currentBranch?.type === 'agent';
    case 'vault_transfer':
      return user.role === 'super_admin' || user.role === 'hub_manager' || (user.role as string) === 'branch_manager' || hasPermissionFn('cashbox.manage_vault');
    case 'receipt_voucher':
      return user.role === 'super_admin' || user.role === 'hub_manager' || (user.role as string) === 'branch_manager';
    case 'payment_voucher':
      return user.role === 'super_admin' || user.role === 'hub_manager' || (user.role as string) === 'branch_manager';
    case 'stagnant_sla':
      return canAccessModuleFn('arrivals') || canAccessModuleFn('dashboard') || user.role === 'super_admin' || user.role === 'hub_manager';
    case 'manifest_new':
      return hasPermissionFn('manifests.create') || canAccessModuleFn('manifests');
    case 'report_cash_movement':
      return hasPermissionFn('cashbox.view') || canAccessModuleFn('cashbox');
    case 'report_clearing_statement':
      if (user.role === 'super_admin') return true;
      return currentBranch?.type === 'agent';
    case 'report_shipping_revenues':
      return hasPermissionFn('dashboard.view_financials') || Boolean(user.permissions?.fieldRestrictions?.canViewFinancialTotals);
    case 'report_sla_branches':
      return canAccessModuleFn('dashboard') || user.role === 'super_admin' || user.role === 'hub_manager';
    case 'report_stagnant_parcels':
      return canAccessModuleFn('arrivals') || hasPermissionFn('arrivals.manage_overdue');
    case 'report_manifests_summary':
      return canAccessModuleFn('manifests') || hasPermissionFn('manifests.view');
    case 'report_operating_expenses':
      return canAccessModuleFn('expenses') || hasPermissionFn('expenses.view');
    case 'report_payroll_sheet':
      return canAccessModuleFn('payroll') || hasPermissionFn('payroll.view');
    case 'report_audit_trail':
      return user.role === 'super_admin' || hasPermissionFn('backup.view');
    default:
      return true;
  }
};

/**
 * تقييد فرز وعرض رسائل التوجيهات الإدارية بدقة تامة بين مسار الإرسال بين الطرفين فقط
 * يمنع ظهور المراسلات الخاصة بين مستخدمين لأي طرف ثالث
 */
export const isDirectiveAccessibleToUser = (
  msg: {
    senderUserId: string;
    recipientType: 'user' | 'branch';
    recipientUserId?: string;
    recipientBranchId?: string;
  } | null | undefined,
  currentUser: User | null | undefined,
  currentBranchId?: string
): boolean => {
  if (!msg || !currentUser) return false;

  // 1. المرسل يملك دائماً حق الوصول للتوجيه الذي قام بإرساله
  if (msg.senderUserId === currentUser.id) {
    return true;
  }

  // 2. المراسلات والتوجيهات الموجهة لمستخدم محدد (User to User):
  // مقيدة حصرياً بالمستلم المستهدف، ولا تظهر إطلاقاً لأي مستخدم آخر
  if (msg.recipientType === 'user') {
    return msg.recipientUserId === currentUser.id;
  }

  // 3. التعاميم والتوجيهات الموجهة لفرع كامل (Branch Broadcast):
  // تظهر حصرياً لكادر وموظفي ذلك الفرع المستلم فقط
  if (msg.recipientType === 'branch') {
    if (!msg.recipientBranchId) return false;
    if (msg.recipientBranchId === currentUser.branchId) return true;
    if (currentBranchId && msg.recipientBranchId === currentBranchId) return true;
    if (currentUser.allowedBranchIds && currentUser.allowedBranchIds.includes(msg.recipientBranchId)) {
      return true;
    }
  }

  return false;
};

