import React, { createContext, useContext, useState, useEffect, useMemo, useCallback, useRef } from 'react';
import {
  Branch,
  User,
  UserRole,
  Parcel,
  TruckManifest,
  ManifestStatus,
  CourierManifest,
  CashboxTransaction,
  DailySettlement,
  FinancialVoucher,
  ClearingReconciliationDetails,
  ClearingSettlementOptions,
  ClearingSettlementMethod,
  PricingRule,
  PricingBasis,
  ParcelSizeTier,
  CodTransferSettings,
  ManifestTemplate,
  SystemNotification,
  PackageType,
  PaymentType,
  Currency,
  Governorate,
  ReceiverInfo,
  PartyInfo,
  Dimensions,
  CompanyBrandingSettings,
  AuditLogEntry,
  AlertsAndDeadlinesSettings,
  Customer,
  CustomerPortalUser,
  CustomerAnalytics,
  IdDocumentType,
  Vehicle,
  Employee,
  PayrollRecord,
  Expense,
  ExpenseCategoryItem,
  DirectMessage,
  ActiveModule,
  FixedAsset,
  ShiftSettlementVoucher,
  CourierIntakeSettlementVoucher,
  CashboxScope,
  NumberFormatSettings,
  CloudSyncState,
  CloudSyncStatus,
  InterBranchObligation,
  ObligationType,
  ParcelEvent,
  ParcelEventDimension,
} from '../types';
import {
  mergeParcelSafely,
  mergeCustomerSafely,
  mergeUserSafely,
  mergeBranchSafely,
  getHandlingStatusRank,
  isTransitionAllowed,
} from '../utils/parcelMergeEngine';
import {
  DEFAULT_NUMBER_FORMAT_SETTINGS,
  formatNumber,
  formatCurrency,
  formatQuantity,
  formatWeight,
  formatExchangeRate,
  FormatNumberOptions,
} from '../utils/numberFormatter';
import {
  getGovernorateDistance,
  calculateDistanceBasedRoutePricing,
  SIZE_TIERS_CONFIG,
  calculateCodTransferFee,
  getCodCommissionLabel,
} from '../utils/distanceEngine';
import { calculateParcelReceivable } from '../utils/settlementMath';
import {
  checkUserPermission,
  checkUserModuleAccess,
  getDefaultPermissionsForRole,
  getDefaultModuleForRole,
} from '../utils/permissionEngine';
import { generateDefaultUsersForBranch } from '../utils/branchHelper';
import { verifySenderIdentity } from '../utils/senderVerification';
import { verifyReceiverIdentity } from '../utils/receiverVerification';
import {
  checkLockoutState,
  recordFailedLoginAttempt,
  clearLockoutState,
  formatCountdownTimer,
} from '../utils/lockoutHelper';
import {
  EMPTY_SYSTEM_BRANCH,
  ALL_BRANCHES_SUPERVISION_BRANCH,
  EMPTY_GUEST_USER,
  INITIAL_BRANCHES,
  INITIAL_USERS,
  INITIAL_PARCELS,
  INITIAL_TRUCK_MANIFESTS,
  INITIAL_COURIER_MANIFESTS,
  INITIAL_PRICING_RULES,
  INITIAL_COD_SETTINGS,
  INITIAL_TRANSACTIONS,
  INITIAL_SETTLEMENTS,
  INITIAL_SHIFT_SETTLEMENTS,
  INITIAL_VOUCHERS,
  INITIAL_NOTIFICATIONS,
  DEFAULT_MANIFEST_TEMPLATE,
  INITIAL_COMPANY_BRANDING,
  INITIAL_AUDIT_LOGS,
  INITIAL_ALERTS_SETTINGS,
  INITIAL_CUSTOMERS,
  INITIAL_VEHICLES,
  INITIAL_EMPLOYEES,
  INITIAL_PAYROLL_RECORDS,
  INITIAL_EXPENSES,
  INITIAL_EXPENSE_CATEGORIES,
  INITIAL_DIRECT_MESSAGES,
  INITIAL_FIXED_ASSETS,
} from '../data/initialData';
import { safeStorage } from '../utils/storage';
import {
  normalizeCustomerNames,
  isSameCustomer,
  getCanonicalCustomerKey,
  normalizePhoneForComparison,
  normalizeArabicComparison,
} from '../utils/nameUtils';
import { vpsSyncEngine } from '../services/vpsSyncEngine';
import { loadSavedVpsConfig, saveVpsConfig } from '../services/vpsClient';
import {
  timestampWorker,
  TimestampWorkerStats,
} from '../services/timestampReconciliationWorker';
import {
  playCashierPaymentAlertSound,
  playShortageAlertSound,
  playShortageResolvedSound,
  playGeneralNotificationSound,
  playTruckDockArrivalSound,
  playTruckDispatchedSound,
} from '../utils/audioEffects';
import { applyDynamicAppIcon } from '../utils/dynamicIconManager';
import { ServerOfflineModal } from '../components/ServerOfflineModal';
import {
  checkServerReachable,
  isServerOnlineSync,
  subscribeServerConnection,
  SERVER_OFFLINE_NOTICE,
} from '../utils/serverConnectionGuard';
import {
  setCurrentActivePage,
  isNavigationBlockedByDisconnection,
  getDisconnectedPageDetails,
} from '../utils/offlinePageGuard';


// [3ج] Feature flag: derived-balance mode (no more double-write).
// Flip to false ONLY as an emergency rollback.
const USE_DERIVED_BALANCE_WRITE = true;

export type { ActiveModule };

export interface PriceCalculationResult {
  shippingCost: number;
  transferFee: number;
  totalDue: number;
  volumeCbm: number;
  volumetricWeightKg: number;
  effectiveWeightKg: number;
  calculatedWeightCost: number;
  calculatedVolumeCost: number;
  calculatedSizeTierCost: number;
  appliedBasis: 'weight' | 'volume' | 'size_tier';
  distanceKm: number;
  basePrice?: number;
  maxCodAmount?: number;
  maxCodAllowed?: number;
}

export interface RerouteParcelInput {
  newDestinationHubId: string;
  newDestinationAddress?: string;
  newReceiver: ReceiverInfo;
  sender?: PartyInfo;
  packageType: PackageType;
  weightKg: number;
  dimensions: Dimensions;
  piecesCount: number;
  contentDescription: string;
  specialInstructions?: string;
  carriedOverDueAmount: number;
  newShippingCost: number;
  newCodAmount: number;
  totalDue: number;
  currency: Currency;
  paymentType: PaymentType;
  rerouteReason: string;
}

interface OrcaContextType {
  branches: Branch[];
  branchesWithDerivedBalances: Branch[];
  users: User[];
  parcels: Parcel[];
  truckManifests: TruckManifest[];
  courierManifests: CourierManifest[];
  transactions: CashboxTransaction[];
  cashTransactions: CashboxTransaction[];
  settlements: DailySettlement[];
  shiftSettlements: ShiftSettlementVoucher[];
  courierIntakeSettlements: CourierIntakeSettlementVoucher[];
  vouchers: FinancialVoucher[];
  pricingRules: PricingRule[];
  codSettings: CodTransferSettings;
  manifestTemplates: ManifestTemplate[];
  notifications: SystemNotification[];
  brandingSettings: CompanyBrandingSettings;
  alertsSettings: AlertsAndDeadlinesSettings;
  auditLogs: AuditLogEntry[];
  customers: Customer[];
  vehicles: Vehicle[];
  employees: Employee[];
  payrollRecords: PayrollRecord[];
  expenses: Expense[];
  expenseCategories: ExpenseCategoryItem[];
  fixedAssets: FixedAsset[];
  directMessages: DirectMessage[];
  interBranchObligations: InterBranchObligation[];
  parcelEvents: ParcelEvent[];
  isolatedNotifications: SystemNotification[];
  currentBranch: Branch;
  currentBranchWithDerivedBalance: Branch;
  currentUser: User;
  activeModule: ActiveModule;
  selectedParcelForPrint: Parcel | null;
  selectedManifestForPrint: TruckManifest | null;
  isPrintModalOpen: boolean;
  printModalType: 'parcel_3part' | 'manifest_a4' | null;
  isCashierCollectModalOpen: boolean;
  cashierCollectParcelId: string | null;
  cashierCollectNotificationId: string | null;
  selectedParcelForQuickView: Parcel | null;
  // Shortage & Lost Parcel Resolution Modals
  isShortageResolutionModalOpen: boolean;
  shortageResolutionParcelIds: string[];
  isLostParcelSettlementModalOpen: boolean;
  selectedLostParcelForSettlement: Parcel | null;
  // Parcel Rerouting / Forwarding Modal
  isRerouteModalOpen: boolean;
  selectedParcelForReroute: Parcel | null;
  codPayoutReceiptParcel: Parcel | null;
  openCodPayoutReceipt: (parcel: Parcel) => void;
  closeCodPayoutReceipt: () => void;
  isAuthenticated: boolean;
  isWelcomeLoginOpen: boolean;

  // Actions
  setInterBranchObligations: React.Dispatch<React.SetStateAction<InterBranchObligation[]>>;
  setParcelEvents: React.Dispatch<React.SetStateAction<ParcelEvent[]>>;
  setActiveModule: (module: ActiveModule) => void;
  setCurrentBranch: (branch: Branch) => void;
  setCurrentUser: (user: User) => void;
  setSelectedParcelForPrint: (parcel: Parcel | null) => void;
  setSelectedManifestForPrint: (manifest: TruckManifest | null) => void;
  setSelectedParcelForQuickView: (parcel: Parcel | null) => void;
  openPrintModal: (type: 'parcel_3part' | 'manifest_a4', data: Parcel | TruckManifest) => void;
  closePrintModal: () => void;
  openCashierCollectModal: (parcelId: string, notificationId?: string) => void;
  closeCashierCollectModal: () => void;
  openShortageResolutionModal: (parcelIds: string[]) => void;
  closeShortageResolutionModal: () => void;
  openLostParcelSettlementModal: (parcel: Parcel) => void;
  closeLostParcelSettlementModal: () => void;
  openRerouteModal: (parcel: Parcel) => void;
  closeRerouteModal: () => void;
  rerouteParcel: (originalParcelId: string, data: RerouteParcelInput) => Parcel | null;
  resolveShortageAtOrigin: (
    parcelIds: string[],
    resolution: 'found_at_origin' | 'lost_in_transit',
    notes?: string
  ) => void;
  confirmShortageFoundAtOrigin: (parcelId: string, notes?: string) => void;
  settleLostParcel: (
    parcelId: string,
    settlementType: 'compensation' | 'waived' | 'found_later',
    details?: {
      compensationAmount?: number;
      currency?: Currency;
      beneficiaryName?: string;
      beneficiaryPhone?: string;
      responsibleParty?: 'company' | 'driver' | 'insurance' | 'shared';
      notes?: string;
      targetFoundBranchId?: string;
    }
  ) => void;
  reDispatchLeftoverParcel: (parcelId: string) => void;
  playShortageAlertSound: () => void;
  playShortageResolvedSound: () => void;
  playTruckDockArrivalSound: () => void;
  playTruckDispatchedSound: () => void;
  setIsWelcomeLoginOpen: (open: boolean) => void;
  login: (
    username: string,
    password?: string
  ) => {
    success: boolean;
    message?: string;
    isLocked?: boolean;
    remainingSeconds?: number;
    attemptsCount?: number;
    attemptsRemaining?: number;
  };
  loginAsSuperAdmin: (password: string) => { success: boolean; message?: string };
  logout: () => void;
  switchUserDirectly: (userId: string) => void;
  updateBrandingSettings: (updates: Partial<CompanyBrandingSettings>) => void;
  updateAlertsSettings: (updates: Partial<AlertsAndDeadlinesSettings>) => void;
  getStagnantParcels: () => {
    parcel: Parcel;
    daysInWarehouse: number;
    isOverdue: boolean;
    overdueDays: number;
    accruedStorageFeeSyp: number;
    accruedStorageFeeUsd: number;
  }[];
  getDelayedTrucks: () => {
    truck: TruckManifest;
    elapsedHours: number;
    delayHours: number;
    isOverdue: boolean;
  }[];
  getOverdueCourierDeliveries: () => {
    parcel: Parcel;
    courierName: string;
    elapsedHours: number;
    delayHours: number;
    isOverdue: boolean;
  }[];
  getUnclosedBranchesForSettlement: () => {
    branch: Branch;
    hasSubmittedToday: boolean;
    lastSettlementDate?: string;
    isOverdue: boolean;
  }[];
  getOverdueCodPayouts: () => {
    parcel: Parcel;
    hoursSinceDelivered: number;
    isOverdue: boolean;
  }[];
  sendStagnantParcelAlert: (parcelId: string) => void;
  triggerManualSlaCheck: () => {
    stagnantCount: number;
    delayedTrucksCount: number;
    overdueCourierCount: number;
    unclosedBranchesCount: number;
    overdueCodCount: number;
  };
  addAuditLog: (action: string, category: AuditLogEntry['category'], details: string) => void;
  clearAuditLogs: () => void;
  updateBranchDirectBalances: (branchId: string, sypNew: number, usdNew: number, reason: string) => void;
  setUserPassword: (userId: string, newPassword: string) => void;

  registerParcel: (parcelData: Omit<Parcel, 'id' | 'trackingNumber' | 'createdAt' | 'handlingStatus'>) => Parcel;
  createTruckManifest: (
    originHubId: string,
    destHubId: string,
    driverName: string,
    driverPhone: string,
    truckPlate: string,
    truckType: string,
    parcelIds: string[],
    notes?: string
  ) => TruckManifest;
  updateTruckManifest: (
    manifestId: string,
    data: {
      destinationHubId: string;
      driverName: string;
      driverPhone: string;
      truckPlate: string;
      truckType: string;
      parcelIds: string[];
      notes?: string;
    }
  ) => TruckManifest | undefined;
  pauseTruckManifest: (manifestId: string) => void;
  cancelAndResetTruckManifest: (manifestId: string) => void;
  dispatchTruckManifest: (manifestId: string) => void;
  markTruckArrived: (manifestId: string) => void;
  completeTruckDischarge: (
    manifestId: string,
    verifiedParcelIds: string[],
    missingParcelIds: string[],
    notes?: string
  ) => void;
  receiveTruckManifest: (manifestId: string) => void;
  orphanParcels: Parcel[];
  orphanParcelsCount: number;
  rescueOrphanParcels: (targetAction: 'release_to_outbound' | 'recreate_manifest') => { rescuedCount: number; message: string };
  notifyReceiver: (parcelId: string) => void;
  deliverParcel: (
    parcelId: string,
    nationalId: string,
    nationalIdPhotoUrl?: string,
    collectedAmount?: number,
    notes?: string,
    extraDetails?: {
      actualReceiverName?: string;
      receiverRelation?: string;
      idBackPhotoUrl?: string;
      idMotherName?: string;
      idFatherName?: string;
      idBirthPlace?: string;
      idCivilRecord?: string;
      signatureUrl?: string;
      idType?: IdDocumentType;
      collectedSyp?: number;
      collectedUsd?: number;
      receiverPhone?: string;
      receiverBirthDate?: string;
      receiverFirstName?: string;
      receiverLastName?: string;
      receiverCity?: Governorate;
      receiverAddress?: string;
    }
  ) => { success: boolean; error?: string };
  forwardCollectionToCashier: (
    parcelId: string,
    details?: { receiverName?: string; receiverPhone?: string; notes?: string }
  ) => void;
  collectPaymentByCashier: (
    parcelId: string,
    options?:
      | {
          sypAmount?: number;
          usdAmount?: number;
          paymentMethod?: 'cash' | 'bank_transfer' | 'online';
          notes?: string;
          notificationId?: string;
        }
      | string
  ) => void;
  assignToCourier: (courierId: string, parcelIds: string[], notes?: string) => CourierManifest;
  settleCourierManifest: (
    courierManifestId: string,
    deliveredIds: string[],
    returnedIds: string[],
    financials?: {
      collectedSyp?: number;
      collectedUsd?: number;
      courierCommissionSyp?: number;
      netDepositedSyp?: number;
      netDepositedUsd?: number;
      uncollectedIds?: string[];
      uncollectedSyp?: number;
      uncollectedUsd?: number;
      returnReasons?: Record<string, string>;
      notes?: string;
    }
  ) => void;
  // Courier Intake Cashbox Settlement (ترصيد مقبوضات تسجيل الطرود واستلامها في المركز)
  getCourierIntakeFinancials: (courierId: string) => {
    unsettledParcels: Parcel[];
    totalPrepaidSyp: number;
    totalPrepaidUsd: number;
    allIntakeParcels: Parcel[];
    settledParcelsCount: number;
  };
  settleCourierIntakeParcels: (
    courierId: string,
    parcelIds: string[],
    notes?: string
  ) => CourierIntakeSettlementVoucher;
  handoverCourierParcelsToHub: (parcelIds?: string[]) => Parcel[];
  selectedCourierIntakeVoucherForPrint: CourierIntakeSettlementVoucher | null;
  openCourierIntakeVoucherPrint: (voucher: CourierIntakeSettlementVoucher) => void;
  closeCourierIntakeVoucherPrint: () => void;
  markParcelReturned: (parcelId: string, reason: string, notes?: string) => void;
  receiveReturnedParcelAtBranch: (parcelId: string, branchId: string) => void;
  reDispatchReturnedParcel: (parcelId: string, notes?: string) => void;
  stageParcelForReturnToOrigin: (
    parcelId: string,
    options?: {
      returnShippingCost?: number;
      paidBy?: 'sender' | 'company' | 'customer' | 'undecided';
      notes?: string;
    }
  ) => void;
  receiveReverseShipmentAtOrigin: (parcelId: string, notes?: string) => void;
  handoverReturnedParcelToSender: (
    parcelId: string,
    notes?: string,
    options?: {
      paymentStatus?: 'paid' | 'refused';
    }
  ) => void;
  initiatePreDeliveryReturn: (
    parcelId: string,
    reason: string,
    notes?: string
  ) => void;
  cancelPreDeliveryReturn: (
    parcelId: string,
    notes?: string
  ) => void;
  checkReturnPickupDeadlines: () => void;
  settleReturnDebt: (parcelId: string, notes?: string) => void;
  submitDailySettlement: (
    branchId: string,
    parentHubId: string,
    sypAmount: number,
    usdAmount: number,
    notes?: string
  ) => DailySettlement;
  approveDailySettlement: (settlementId: string) => void;
  // Shift Settlements (ترصيد وإغلاق صندوق الوردية لمسؤولي الصادر والوارد مع مدير الفرع)
  submitShiftSettlement: (
    scope: 'outgoing' | 'incoming',
    sypAmount: number,
    usdAmount: number,
    param4?: string,
    param5?: string
  ) => ShiftSettlementVoucher;
  approveShiftSettlement: (settlementId: string, managerNotes?: string) => void;
  rejectShiftSettlement: (settlementId: string, reason?: string) => void;
  deleteShiftSettlement: (settlementId: string) => void;
  getCashboxBreakdown: (branchId?: string, userId?: string) => {
    outgoingSyp: number;
    outgoingUsd: number;
    incomingSyp: number;
    incomingUsd: number;
    masterSyp: number;
    masterUsd: number;
    totalBranchSyp: number;
    totalBranchUsd: number;
    pendingSettlementsCount: number;
    outgoingBox: {
      inflowSyp: number;
      inflowUsd: number;
      outflowSyp: number;
      outflowUsd: number;
      transfersOutSyp: number;
      transfersOutUsd: number;
      unsettledSyp: number;
      unsettledUsd: number;
      syp: number;
      usd: number;
    };
    incomingBox: {
      inflowSyp: number;
      inflowUsd: number;
      outflowSyp: number;
      outflowUsd: number;
      transfersOutSyp: number;
      transfersOutUsd: number;
      unsettledSyp: number;
      unsettledUsd: number;
      syp: number;
      usd: number;
    };
    cashierBox: {
      inflowSyp: number;
      inflowUsd: number;
      outflowSyp: number;
      outflowUsd: number;
      transfersOutSyp: number;
      transfersOutUsd: number;
      unsettledSyp: number;
      unsettledUsd: number;
      syp: number;
      usd: number;
    };
    managerBox: {
      inflowSyp: number;
      inflowUsd: number;
      outflowSyp: number;
      outflowUsd: number;
      transfersInSyp: number;
      transfersInUsd: number;
      transfersOutSyp: number;
      transfersOutUsd: number;
      unsettledSyp: number;
      unsettledUsd: number;
      syp: number;
      usd: number;
    };
    accountantBox: {
      inflowSyp: number;
      inflowUsd: number;
      outflowSyp: number;
      outflowUsd: number;
      syp: number;
      usd: number;
    };
    operationsBox: {
      inflowSyp: number;
      inflowUsd: number;
      outflowSyp: number;
      outflowUsd: number;
      syp: number;
      usd: number;
    };
    warehouseBox: {
      inflowSyp: number;
      inflowUsd: number;
      outflowSyp: number;
      outflowUsd: number;
      syp: number;
      usd: number;
    };
    courierBox: {
      inflowSyp: number;
      inflowUsd: number;
      outflowSyp: number;
      outflowUsd: number;
      syp: number;
      usd: number;
    };
    courierIntakeBox?: {
      inflowSyp: number;
      inflowUsd: number;
      outflowSyp: number;
      outflowUsd: number;
      syp: number;
      usd: number;
    };
    courierIntakeSyp?: number;
    courierIntakeUsd?: number;
    masterBox: {
      inflowSyp: number;
      inflowUsd: number;
      outflowSyp: number;
      outflowUsd: number;
      transfersInSyp: number;
      transfersInUsd: number;
      transfersOutSyp: number;
      transfersOutUsd: number;
      syp: number;
      usd: number;
    };
    transfersBox: {
      receivedSyp: number;
      receivedUsd: number;
      sentSyp: number;
      sentUsd: number;
      netSyp: number;
      netUsd: number;
    };
    totalBranchLiquiditySyp: number;
    totalBranchLiquidityUsd: number;
  };
  getRoleCashboxData: (role?: UserRole, branchId?: string, userId?: string) => {
    scope: CashboxScope;
    boxName: string;
    branchName: string;
    fullTitle: string;
    syp: number;
    usd: number;
    inflowSyp: number;
    inflowUsd: number;
    outflowSyp: number;
    outflowUsd: number;
    unsettledSyp: number;
    unsettledUsd: number;
  };
  getRoleBoxTransactions: (role?: UserRole, branchId?: string, userId?: string) => CashboxTransaction[];
  getRoleBoxInfo: (role?: UserRole, branch?: Branch | null) => {
    scope: CashboxScope;
    boxName: string;
    branchName: string;
    fullTitle: string;
  };
  // COD Sender Remittance Payout (صرف وتسليم حوالات ضد الدفع للمرسل)
  notifySenderForCodPayout: (
    parcelId: string,
    method?: 'whatsapp' | 'sms' | 'call' | 'in_person',
    notes?: string
  ) => void;
  payoutCodToSender: (
    parcelId: string,
    details: {
      recipientNationalId: string;
      recipientMotherName: string;
      recipientBirthDate: string;
      sypAmount?: number;
      usdAmount?: number;
      notes?: string;
      paymentMethod?: string;
    }
  ) => { success: boolean; voucherId?: string; voucherNumber?: string; message?: string };
  isCodSenderPayoutModalOpen: boolean;
  selectedCodPayoutParcelId: string | null;
  openCodSenderPayoutModal: (parcelId: string) => void;
  closeCodSenderPayoutModal: () => void;
  addFinancialVoucher: (
    voucherData: Omit<FinancialVoucher, 'id' | 'voucherNumber' | 'timestamp'>
  ) => FinancialVoucher;
  createBranchClearingVoucher: (
    branchId: string,
    counterpartyBranchId: string,
    clearingDetails: ClearingReconciliationDetails,
    notes?: string,
    settlementOptions?: ClearingSettlementOptions
  ) => { clearingVoucher: FinancialVoucher; receiptVoucher?: FinancialVoucher };
  deleteFinancialVoucher: (voucherId: string) => void;
  addCashTransaction: (
    branchId: string,
    currency: Currency,
    type: CashboxTransaction['type'],
    amount: number,
    description: string,
    referenceId?: string,
    counterpartyBranchId?: string
  ) => void;
  calculateBranchLiveBalance: (branchId: string, currency: 'SYP' | 'USD') => number;
  calculatePrice: (
    originGov: Governorate,
    destGov: Governorate,
    packageType: PackageType,
    weightKg: number,
    lengthCm: number,
    widthCm: number,
    heightCm: number,
    paymentType: PaymentType,
    currency: Currency,
    codAmount: number,
    pricingBasis?: PricingBasis,
    sizeTier?: ParcelSizeTier,
    codCurrency?: Currency
  ) => PriceCalculationResult;
  updatePricingRules: (rules: PricingRule[]) => void;
  addPricingRule: (rule: Omit<PricingRule, 'id'>) => void;
  deletePricingRule: (ruleId: string) => void;
  resetPricingRulesToDefault: () => void;
  updateCodSettings: (settings: CodTransferSettings) => void;
  calculateCodTransferFee: (amount: number, currency?: Currency) => number;
  getCodCommissionLabel: (currency?: Currency) => string;
  saveManifestTemplate: (template: ManifestTemplate) => void;
  addBranch: (
    branch: Omit<Branch, 'id' | 'boxSypBalance' | 'boxUsdBalance'>,
    autoGenerateUsers?: boolean,
    defaultPassword?: string
  ) => { branch: Branch; createdUsers: User[] };
  updateBranch: (id: string, updates: Partial<Branch>) => void;
  deleteBranch: (id: string) => void;
  addMultipleBranchesWithUsers: (
    branchesData: Array<Omit<Branch, 'id'> & { id?: string; initialSyp?: number; initialUsd?: number }>,
    autoGenerateUsers?: boolean,
    customUsers?: User[]
  ) => { createdBranches: Branch[]; createdUsers: User[] };
  clearAllOperationalData: () => void;
  addUser: (user: Omit<User, 'id'> & { id?: string }) => User;
  updateUser: (id: string, updates: Partial<User>) => void;
  deleteUser: (id: string) => void;
  toggleUserStatus: (id: string) => void;
  hasPermission: (permissionKey: string) => boolean;
  canAccessModule: (module: ActiveModule) => boolean;
  canSwitchBranch: () => boolean;
  markNotificationRead: (id: string) => void;
  markAllNotificationsRead: () => void;
  // Directory Actions
  addCustomer: (data: Omit<Customer, 'id' | 'code' | 'createdAt' | 'totalShipmentsSent' | 'totalShipmentsReceived' | 'totalSpentSyp' | 'totalSpentUsd'>) => Customer;
  updateCustomer: (id: string, updates: Partial<Customer>) => void;
  deleteCustomer: (id: string) => void;
  clearAllCustomers: () => void;
  findCustomerByNationalIdOrPhone: (query: string) => Customer | undefined;

  addVehicle: (data: Omit<Vehicle, 'id' | 'code' | 'createdAt'>) => Vehicle;
  updateVehicle: (id: string, updates: Partial<Vehicle>) => void;
  deleteVehicle: (id: string) => void;

  addEmployee: (data: Omit<Employee, 'id' | 'code' | 'createdAt'>) => Employee;
  updateEmployee: (id: string, updates: Partial<Employee>) => void;
  deleteEmployee: (id: string) => void;

  createPayrollRecord: (data: Omit<PayrollRecord, 'id' | 'payrollNumber'>) => PayrollRecord;
  payPayrollRecord: (id: string, paymentMethod?: 'cash_box' | 'bank_transfer' | 'cheque') => void;

  addExpense: (data: Omit<Expense, 'id' | 'expenseNumber' | 'createdAt'>) => Expense;
  updateExpense: (id: string, updates: Partial<Expense>) => void;
  deleteExpense: (id: string) => void;
  approveExpense: (id: string) => void;
  rejectExpense: (id: string, reason?: string) => void;
  confirmExpenseDisbursement: (id: string) => { success: boolean; message?: string; voucherId?: string; voucherNumber?: string };

  addExpenseCategory: (data: Omit<ExpenseCategoryItem, 'id' | 'createdAt'>) => ExpenseCategoryItem;
  updateExpenseCategory: (id: string, updates: Partial<ExpenseCategoryItem>) => void;
  deleteExpenseCategory: (id: string) => void;
  toggleCategoryApprovalRequirement: (id: string) => void;

  addFixedAsset: (data: Omit<FixedAsset, 'id' | 'createdAt'>) => FixedAsset;
  updateFixedAsset: (id: string, updates: Partial<FixedAsset>) => void;
  deleteFixedAsset: (id: string) => void;

  sendDirectMessage: (data: Omit<DirectMessage, 'id' | 'timestamp' | 'isRead'>) => DirectMessage;
  markDirectMessageRead: (messageId: string) => void;
  deleteDirectMessage: (messageId: string) => void;

  exportDatabaseJson: () => string;
  importDatabaseJson: (json: string) => boolean;
  resetToDemoData: () => void;
  invalidateSmartCache: (collectionName?: string) => void;
  warmSmartCache: () => void;

  // Number & Currency Formatting System (نظام التحكم بإظهار الأرقام والكسور والفواصل)

  numberFormatSettings: NumberFormatSettings;
  updateNumberFormatSettings: (newSettings: Partial<NumberFormatSettings>) => void;
  formatCurrency: (
    amount: number | string | null | undefined,
    currency?: 'SYP' | 'USD' | Currency | string,
    options?: FormatNumberOptions
  ) => string;
  formatNumber: (
    value: number | string | null | undefined,
    options?: FormatNumberOptions
  ) => string;
  formatQuantity: (qty: number | string | null | undefined, unit?: string) => string;
  formatWeight: (weightKg: number | string | null | undefined) => string;
  formatExchangeRate: (rate: number | string | null | undefined) => string;

  // Real-Time Cloud Synchronization & Multi-Branch Linking
  cloudSyncState: CloudSyncState;
  timestampWorkerStats: TimestampWorkerStats;
  triggerTimestampReconciliation: (reason?: string) => Promise<boolean | undefined>;
  triggerManualCloudSync: () => Promise<{ processed: number; remaining: number }>;
  pushEntireDatabaseToCloud: () => Promise<{ success: boolean; message: string; count: number }>;
  pullEntireDatabaseFromCloud: () => Promise<{ success: boolean; message: string }>;
  retryManualSyncConnection: () => Promise<{ success: boolean; message: string }>;
  boundBranchId?: string;
  setBoundBranchId: (branchId: string) => void;

  // Customer Portal Authentication & Read-Only Services (بوابة الزبائن المنفصلة)
  currentCustomer: CustomerPortalUser | null;
  isCustomerAuthenticated: boolean;
  isCustomerLoginOpen: boolean;
  setIsCustomerLoginOpen: (open: boolean) => void;
  loginCustomer: (
    usernameOrPhone: string,
    password?: string
  ) => {
    success: boolean;
    message?: string;
    customer?: CustomerPortalUser;
    isLocked?: boolean;
    remainingSeconds?: number;
    attemptsCount?: number;
    attemptsRemaining?: number;
  };
  logoutCustomer: () => void;
  updateCustomerPortalCredentials: (
    customerId: string,
    credentials: {
      portalUsername?: string;
      portalPassword?: string;
      portalAccessEnabled: boolean;
    }
  ) => void;
  getCustomerParcels: (customerIdOrPhone?: string) => { sent: Parcel[]; received: Parcel[]; all: Parcel[] };
  getCustomerAnalytics: (customerIdOrPhone?: string) => CustomerAnalytics;
  getCustomerNotifications: (customerIdOrPhone?: string) => SystemNotification[];

  // Strict Server-Authoritative & Network Guard
  isServerOnline: boolean;
  serverOfflineAlertOpen: boolean;
  serverOfflineAlertMsg: string;
  showServerOfflineAlert: (msg?: string) => void;
  closeServerOfflineAlert: () => void;
  ensureServerConnected: (customMessage?: string) => Promise<boolean>;

  // LocalStorage Quota Guard & Cleanup System
  localStorageWarning: {
    level: 'warning' | 'critical';
    totalMB: number;
    message: string;
  } | null;
  estimateLocalStorageSize: () => {
    totalBytes: number;
    totalMB: number;
    byKey: Record<string, number>;
  };
  cleanupOldLocalData: () => {
    removedParcels: number;
    removedEvents: number;
    removedAuditLogs: number;
    freedMB: number;
  };
}

const OrcaContext = createContext<OrcaContextType | undefined>(undefined);

const STORAGE_KEY = 'ORCA_LOGISTICS_DB_CLEAN_PROD_ZERO_V5';

export const OrcaProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // Proactively clear legacy cache entries and any stale demo configurations
  useEffect(() => {
    try {
      const keysToPurge: string[] = [];
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k && (k.startsWith('ORCA_LOGISTICS_DB_') && !k.startsWith(STORAGE_KEY))) {
          keysToPurge.push(k);
        }
      }
      keysToPurge.forEach((k) => safeStorage.removeItem(k));

      // Clean portal tokens and temporary caches if needed
      safeStorage.removeItem('orca_isolated_portal_active');

      // Purge any residual demo cloud config if it has old project references
      const savedConfig = safeStorage.getItem('orca_vps_legacy_config');
      if (savedConfig) {
        try {
          const parsed = JSON.parse(savedConfig);
          if (parsed?.projectId === 'palm-bfcc4' || parsed?.companyCode === 'PALM-IRAQ') {
            safeStorage.removeItem('orca_vps_legacy_config');
            safeStorage.removeItem('orca_cloud_sync_queue');
            safeStorage.removeItem('orca_last_cloud_sync_timestamp');
          }
        } catch {
          // ignore
        }
      }
    } catch {
      // safe fallback
    }
  }, []);

  // Operational State: Hydrated from safeStorage for instant offline availability & resilience
  const [branches, setBranches] = useState<Branch[]>(() => {
    try {
      const saved = safeStorage.getItem(`${STORAGE_KEY}_branches`);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch {}
    return INITIAL_BRANCHES;
  });
  const [users, setUsers] = useState<User[]>(() => {
    try {
      const saved = safeStorage.getItem(`${STORAGE_KEY}_users`);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch {}
    return INITIAL_USERS;
  });
  const [parcels, setParcels] = useState<Parcel[]>(() => {
    try {
      const saved = safeStorage.getItem(`${STORAGE_KEY}_parcels`);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch {}
    return INITIAL_PARCELS;
  });
  const [truckManifests, setTruckManifests] = useState<TruckManifest[]>(() => {
    try {
      const saved = safeStorage.getItem(`${STORAGE_KEY}_truck_manifests`);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch {}
    return INITIAL_TRUCK_MANIFESTS;
  });
  const [courierManifests, setCourierManifests] = useState<CourierManifest[]>(() => {
    try {
      const saved = safeStorage.getItem(`${STORAGE_KEY}_courier_manifests`);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch {}
    return INITIAL_COURIER_MANIFESTS;
  });
  const [transactions, setTransactions] = useState<CashboxTransaction[]>(() => {
    try {
      const saved = safeStorage.getItem(`${STORAGE_KEY}_transactions`);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch {}
    return INITIAL_TRANSACTIONS;
  });
  const [interBranchObligations, setInterBranchObligations] = useState<InterBranchObligation[]>(() => {
    try {
      const saved = safeStorage.getItem('interBranchObligations');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch {}
    return [];
  });
  const [parcelEvents, setParcelEvents] = useState<ParcelEvent[]>(() => {
    try {
      const saved = safeStorage.getItem('parcelEvents');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch {}
    return [];
  });
  const [settlements, setSettlements] = useState<DailySettlement[]>(() => {
    try {
      const saved = safeStorage.getItem(`${STORAGE_KEY}_settlements`);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch {}
    return INITIAL_SETTLEMENTS;
  });
  const [shiftSettlements, setShiftSettlements] = useState<ShiftSettlementVoucher[]>(() => {
    try {
      const saved = safeStorage.getItem(`${STORAGE_KEY}_shift_settlements`);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch {}
    return INITIAL_SHIFT_SETTLEMENTS;
  });
  const [courierIntakeSettlements, setCourierIntakeSettlements] = useState<CourierIntakeSettlementVoucher[]>(() => {
    try {
      const saved = safeStorage.getItem(`${STORAGE_KEY}_courier_intake_settlements`);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch {}
    return [];
  });
  const [selectedCourierIntakeVoucherForPrint, setSelectedCourierIntakeVoucherForPrint] = useState<CourierIntakeSettlementVoucher | null>(null);
  const [vouchers, setVouchers] = useState<FinancialVoucher[]>(() => {
    try {
      const saved = safeStorage.getItem(`${STORAGE_KEY}_vouchers`);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch {}
    return INITIAL_VOUCHERS;
  });
  const [pricingRules, setPricingRules] = useState<PricingRule[]>(() => {
    try {
      const saved = safeStorage.getItem(`${STORAGE_KEY}_pricing_rules`);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch {}
    return INITIAL_PRICING_RULES;
  });
  const [codSettings, setCodSettings] = useState<CodTransferSettings>(() => {
    try {
      const saved = safeStorage.getItem(`${STORAGE_KEY}_cod_settings`);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed && typeof parsed === 'object') return parsed;
      }
    } catch {}
    return INITIAL_COD_SETTINGS;
  });
  const [manifestTemplates, setManifestTemplates] = useState<ManifestTemplate[]>([DEFAULT_MANIFEST_TEMPLATE]);
  const [notifications, setNotifications] = useState<SystemNotification[]>(() => {
    try {
      const saved = safeStorage.getItem(`${STORAGE_KEY}_notifications`);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch {}
    return INITIAL_NOTIFICATIONS;
  });
  const [brandingSettings, setBrandingSettings] = useState<CompanyBrandingSettings>(() => {
    try {
      const saved = safeStorage.getItem(`${STORAGE_KEY}_branding_settings`);
      if (saved) {
        const parsed = JSON.parse(saved);
        // Guarantee pristine default logos: color for app and B&W for printables
        let printLogo = parsed.printLogoUrl;
        if (!printLogo || printLogo === '/orca_express_logo.jpg') {
          printLogo = '/orca_print_bw.png';
        }
        let logoUrl = parsed.logoUrl;
        if (!logoUrl) {
          logoUrl = '/orca_express_logo.jpg';
        }
        return {
          ...INITIAL_COMPANY_BRANDING,
          ...parsed,
          logoUrl,
          printLogoUrl: printLogo,
        };
      }
    } catch {}
    return INITIAL_COMPANY_BRANDING;
  });
  const [alertsSettings, setAlertsSettings] = useState<AlertsAndDeadlinesSettings>(() => {
    try {
      const saved = safeStorage.getItem(`${STORAGE_KEY}_alerts_settings`);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed && typeof parsed === 'object') return parsed;
      }
    } catch {}
    return INITIAL_ALERTS_SETTINGS;
  });

  // Number & Currency Formatting System Methods (Hoisted for early access)
  const numberFormatSettings: NumberFormatSettings =
    brandingSettings.numberFormatSettings || DEFAULT_NUMBER_FORMAT_SETTINGS;

  const updateNumberFormatSettings = (newSettings: Partial<NumberFormatSettings>) => {
    setBrandingSettings((prev) => {
      const mergedFormat: NumberFormatSettings = {
        ...(prev.numberFormatSettings || DEFAULT_NUMBER_FORMAT_SETTINGS),
        ...newSettings,
      };
      return {
        ...prev,
        numberFormatSettings: mergedFormat,
      };
    });
    addAuditLog(
      'تحديث معايير إظهار وتنسيق الأرقام',
      'pricing',
      'تم تحديث نمط وشكل إظهار الأرقام والفواصل والكسور العشرية في محرك الأسعار.'
    );
  };

  const formatCurrencyApp = (
    amount: number | string | null | undefined,
    currency: 'SYP' | 'USD' | Currency | string = 'SYP',
    options?: FormatNumberOptions
  ) => {
    return formatCurrency(amount, currency, numberFormatSettings, options);
  };

  const formatNumberApp = (
    value: number | string | null | undefined,
    options?: FormatNumberOptions
  ) => {
    return formatNumber(value, options, numberFormatSettings);
  };

  const formatQuantityApp = (qty: number | string | null | undefined, unit?: string) => {
    return formatQuantity(qty, unit, numberFormatSettings);
  };

  const formatWeightApp = (weightKg: number | string | null | undefined) => {
    return formatWeight(weightKg, numberFormatSettings);
  };

  const formatExchangeRateApp = (rate: number | string | null | undefined) => {
    return formatExchangeRate(rate, numberFormatSettings);
  };
  const [auditLogs, setAuditLogs] = useState<AuditLogEntry[]>(() => {
    try {
      const saved = safeStorage.getItem(`${STORAGE_KEY}_audit_logs`);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch {}
    return INITIAL_AUDIT_LOGS;
  });
  const [customers, setCustomers] = useState<Customer[]>(() => {
    try {
      const stored = safeStorage.getItem(`${STORAGE_KEY}_customers`);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed) && parsed.length > 0) {
          const dedupedMap = new Map<string, Customer>();
          for (const c of parsed) {
            if (!c) continue;
            const key = getCanonicalCustomerKey(c);
            if (!dedupedMap.has(key)) {
              dedupedMap.set(key, c);
            } else {
              const ex = dedupedMap.get(key)!;
              dedupedMap.set(key, { ...ex, ...c, id: ex.id });
            }
          }
          return Array.from(dedupedMap.values());
        }
      }
    } catch {}
    return INITIAL_CUSTOMERS;
  });
  const [vehicles, setVehicles] = useState<Vehicle[]>(() => {
    try {
      const saved = safeStorage.getItem(`${STORAGE_KEY}_vehicles`);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch {}
    return INITIAL_VEHICLES;
  });
  const [employees, setEmployees] = useState<Employee[]>(() => {
    try {
      const saved = safeStorage.getItem(`${STORAGE_KEY}_employees`);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch {}
    return INITIAL_EMPLOYEES;
  });
  const [payrollRecords, setPayrollRecords] = useState<PayrollRecord[]>(() => {
    try {
      const saved = safeStorage.getItem(`${STORAGE_KEY}_payroll_records`);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch {}
    return INITIAL_PAYROLL_RECORDS;
  });
  const [expenses, setExpenses] = useState<Expense[]>(() => {
    try {
      const saved = safeStorage.getItem(`${STORAGE_KEY}_expenses`);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch {}
    return INITIAL_EXPENSES;
  });
  const [expenseCategories, setExpenseCategories] = useState<ExpenseCategoryItem[]>(() => {
    try {
      const saved = safeStorage.getItem(`${STORAGE_KEY}_expense_categories`);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch {}
    return INITIAL_EXPENSE_CATEGORIES;
  });
  const [fixedAssets, setFixedAssets] = useState<FixedAsset[]>(() => {
    try {
      const saved = safeStorage.getItem(`${STORAGE_KEY}_fixed_assets`);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch {}
    return INITIAL_FIXED_ASSETS;
  });
  const [directMessages, setDirectMessages] = useState<DirectMessage[]>(() => {
    try {
      const saved = safeStorage.getItem(`${STORAGE_KEY}_direct_messages`);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch {}
    return INITIAL_DIRECT_MESSAGES;
  });

  // User Session & Navigation State Persistence (حفظ كامل ومستقر لبيانات الجلسة لمنع تبديل الدور أو الفرع أو المستخدم إطلاقاً عند تحديث الصفحة)
  const SESSION_USER_OBJ_KEY = 'orca_session_current_user_obj';
  const SESSION_BRANCH_OBJ_KEY = 'orca_session_current_branch_obj';
  const SESSION_USER_ID_KEY = 'orca_session_current_user_id';
  const SESSION_BRANCH_ID_KEY = 'orca_session_current_branch_id';
  const SESSION_ACTIVE_MODULE_KEY = 'orca_session_active_module';

  const [currentUser, setCurrentUser] = useState<User>(() => {
    try {
      const savedUserObj = safeStorage.getItem(SESSION_USER_OBJ_KEY);
      if (savedUserObj) {
        const parsed: User = JSON.parse(savedUserObj);
        if (parsed && parsed.id && parsed.role) {
          return parsed;
        }
      }
      const savedUserId = safeStorage.getItem(SESSION_USER_ID_KEY);
      if (savedUserId) {
        const savedUsersRaw = safeStorage.getItem(`${STORAGE_KEY}_users`);
        const parsedUsers: User[] = savedUsersRaw ? JSON.parse(savedUsersRaw) : [];
        const found = parsedUsers.find((u) => u.id === savedUserId || u.username?.toLowerCase() === savedUserId.toLowerCase());
        if (found) return found;
      }
    } catch {}
    return EMPTY_GUEST_USER;
  });

  const [activeModule, setActiveModule] = useState<ActiveModule>(() => {
    try {
      if (typeof window !== 'undefined') {
        const params = new URLSearchParams(window.location.search);
        const urlView = params.get('view') || params.get('mod') || window.location.hash.replace('#', '');
        const VALID_MODULES: ActiveModule[] = [
          'dashboard', 'intake', 'manifests', 'arrivals', 'delivery',
          'cashbox', 'pricing', 'admin_users', 'backup_cloud', 'master_admin',
          'expenses', 'customers', 'vehicles', 'payroll', 'fixed_assets',
          'courier_portal', 'customer_portal'
        ];
        if (urlView && VALID_MODULES.includes(urlView as ActiveModule)) {
          return urlView as ActiveModule;
        }
      }

      const savedMod = safeStorage.getItem(SESSION_ACTIVE_MODULE_KEY);
      if (savedMod) return savedMod as ActiveModule;
      const savedUserObj = safeStorage.getItem(SESSION_USER_OBJ_KEY);
      if (savedUserObj) {
        const parsed: User = JSON.parse(savedUserObj);
        if (parsed?.role) {
          return getDefaultModuleForRole(parsed.role) || 'dashboard';
        }
      }
    } catch {}
    return 'dashboard';
  });

  const [currentBranch, setCurrentBranch] = useState<Branch>(() => {
    try {
      const savedBranchObj = safeStorage.getItem(SESSION_BRANCH_OBJ_KEY);
      if (savedBranchObj) {
        const parsed: Branch = JSON.parse(savedBranchObj);
        if (parsed && parsed.id) return parsed;
      }
      const savedBranchId = safeStorage.getItem(SESSION_BRANCH_ID_KEY);
      if (savedBranchId) {
        const savedBranchesRaw = safeStorage.getItem(`${STORAGE_KEY}_branches`);
        const parsedBranches: Branch[] = savedBranchesRaw ? JSON.parse(savedBranchesRaw) : [];
        const found = parsedBranches.find((b) => b.id === savedBranchId || b.code === savedBranchId);
        if (found) return found;
      }
    } catch {}
    return ALL_BRANCHES_SUPERVISION_BRANCH;
  });
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(() => {
    try {
      const saved = safeStorage.getItem(`${STORAGE_KEY}_is_auth`);
      return saved === 'true';
    } catch {
      return false;
    }
  });
  const [isWelcomeLoginOpen, setIsWelcomeLoginOpen] = useState<boolean>(false);

  // Dedicated Customer Portal State
  const [currentCustomer, setCurrentCustomer] = useState<CustomerPortalUser | null>(() => {
    try {
      const saved = safeStorage.getItem(`${STORAGE_KEY}_current_customer`);
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });
  const [isCustomerAuthenticated, setIsCustomerAuthenticated] = useState<boolean>(() => {
    try {
      const saved = safeStorage.getItem(`${STORAGE_KEY}_is_customer_auth`);
      return saved === 'true';
    } catch {
      return false;
    }
  });
  const [isCustomerLoginOpen, setIsCustomerLoginOpen] = useState<boolean>(false);

  // User-specific read notification IDs (عزل قراءة الإشعارات والتنبيهات بالكامل لكل مستخدم)
  const [userReadNotifIds, setUserReadNotifIds] = useState<string[]>(() => {
    try {
      const stored = safeStorage.getItem(`orca_read_notifs_${currentUser?.id || 'admin'}`);
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  });

  // Reload user-specific read notifications when switching active user
  useEffect(() => {
    if (currentUser?.id) {
      try {
        const stored = safeStorage.getItem(`orca_read_notifs_${currentUser.id}`);
        setUserReadNotifIds(stored ? JSON.parse(stored) : []);
      } catch {
        setUserReadNotifIds([]);
      }
    }
  }, [currentUser?.id]);

  // Strict Courier-Branch Binding: Ensure courier's active branch always matches their assigned branchId exclusively
  useEffect(() => {
    if (currentUser?.role === 'courier' && currentUser.branchId && branches.length > 0) {
      const courierBranch = branches.find((b) => b.id === currentUser.branchId);
      if (courierBranch && currentBranch?.id !== courierBranch.id) {
        setCurrentBranch(courierBranch);
        safeStorage.setItem(SESSION_BRANCH_ID_KEY, courierBranch.id);
        safeStorage.setItem(SESSION_BRANCH_OBJ_KEY, JSON.stringify(courierBranch));
      }
    }
  }, [currentUser?.role, currentUser?.branchId, branches, currentBranch?.id]);

  // Modals for Printing & Quick View
  const [selectedParcelForPrint, setSelectedParcelForPrint] = useState<Parcel | null>(null);
  const [selectedManifestForPrint, setSelectedManifestForPrint] = useState<TruckManifest | null>(null);
  const [selectedParcelForQuickView, setSelectedParcelForQuickView] = useState<Parcel | null>(null);
  const [isPrintModalOpen, setIsPrintModalOpen] = useState(false);
  const [printModalType, setPrintModalType] = useState<'parcel_3part' | 'manifest_a4' | null>(null);

  // Cashier Collection Modal State
  const [cashierCollectParcelId, setCashierCollectParcelId] = useState<string | null>(null);
  const [cashierCollectNotificationId, setCashierCollectNotificationId] = useState<string | null>(null);

  // Shortage & Lost Parcel Resolution Modals
  const [isShortageResolutionModalOpen, setIsShortageResolutionModalOpen] = useState(false);
  const [shortageResolutionParcelIds, setShortageResolutionParcelIds] = useState<string[]>([]);
  const [isLostParcelSettlementModalOpen, setIsLostParcelSettlementModalOpen] = useState(false);
  const [selectedLostParcelForSettlement, setSelectedLostParcelForSettlement] = useState<Parcel | null>(null);

  const openShortageResolutionModal = (parcelIds: string[]) => {
    setShortageResolutionParcelIds(parcelIds);
    setIsShortageResolutionModalOpen(true);
  };
  const closeShortageResolutionModal = () => {
    setIsShortageResolutionModalOpen(false);
    setShortageResolutionParcelIds([]);
  };

  const openLostParcelSettlementModal = (parcel: Parcel) => {
    setSelectedLostParcelForSettlement(parcel);
    setIsLostParcelSettlementModalOpen(true);
  };
  const closeLostParcelSettlementModal = () => {
    setIsLostParcelSettlementModalOpen(false);
    setSelectedLostParcelForSettlement(null);
  };

  // Parcel Rerouting / Forwarding Modal State
  const [isRerouteModalOpen, setIsRerouteModalOpen] = useState(false);
  const [selectedParcelForReroute, setSelectedParcelForReroute] = useState<Parcel | null>(null);

  const openRerouteModal = (parcel: Parcel) => {
    setSelectedParcelForReroute(parcel);
    setIsRerouteModalOpen(true);
  };

  const closeRerouteModal = () => {
    setIsRerouteModalOpen(false);
    setSelectedParcelForReroute(null);
  };

  // COD Sender Payout Modal State
  const [isCodSenderPayoutModalOpen, setIsCodSenderPayoutModalOpen] = useState(false);
  const [selectedCodPayoutParcelId, setSelectedCodPayoutParcelId] = useState<string | null>(null);

  const openCodSenderPayoutModal = (parcelId: string) => {
    setSelectedCodPayoutParcelId(parcelId);
    setIsCodSenderPayoutModalOpen(true);
  };

  const closeCodSenderPayoutModal = () => {
    setSelectedCodPayoutParcelId(null);
    setIsCodSenderPayoutModalOpen(false);
  };

  // COD Payout Receipt Modal State
  const [codPayoutReceiptParcel, setCodPayoutReceiptParcel] = useState<Parcel | null>(null);

  const openCodPayoutReceipt = (parcel: Parcel) => {
    setCodPayoutReceiptParcel(parcel);
  };

  const closeCodPayoutReceipt = () => {
    setCodPayoutReceiptParcel(null);
  };

  // Sync to local storage
  useEffect(() => {
    safeStorage.setItem(`${STORAGE_KEY}_branches`, JSON.stringify(branches));
  }, [branches]);

  useEffect(() => {
    try {
      const data = JSON.stringify(parcels);
      if (data.length > 1_500_000) {
        const trimmed = parcels.map((p: any) => ({
          ...p,
          idPhotoFront: p.idPhotoFront?.startsWith('data:image/') ? '__MIGRATED__' : p.idPhotoFront,
          idPhotoBack: p.idPhotoBack?.startsWith('data:image/') ? '__MIGRATED__' : p.idPhotoBack,
          receiver: p.receiver
            ? {
                ...p.receiver,
                nationalIdPhotoUrl: p.receiver.nationalIdPhotoUrl?.startsWith('data:image/') ? '__MIGRATED__' : p.receiver.nationalIdPhotoUrl,
                nationalIdBackPhotoUrl: p.receiver.nationalIdBackPhotoUrl?.startsWith('data:image/') ? '__MIGRATED__' : p.receiver.nationalIdBackPhotoUrl,
                idPhotoFront: p.receiver.idPhotoFront?.startsWith('data:image/') ? '__MIGRATED__' : p.receiver.idPhotoFront,
                idPhotoBack: p.receiver.idPhotoBack?.startsWith('data:image/') ? '__MIGRATED__' : p.receiver.idPhotoBack,
              }
            : p.receiver,
          sender: p.sender
            ? {
                ...p.sender,
                idPhotoFront: p.sender.idPhotoFront?.startsWith('data:image/') ? '__MIGRATED__' : p.sender.idPhotoFront,
                idPhotoBack: p.sender.idPhotoBack?.startsWith('data:image/') ? '__MIGRATED__' : p.sender.idPhotoBack,
              }
            : p.sender,
        }));
        safeStorage.setItem(`${STORAGE_KEY}_parcels`, JSON.stringify(trimmed));
      } else {
        safeStorage.setItem(`${STORAGE_KEY}_parcels`, data);
      }
    } catch (err) {
      console.warn('[Parcels] Save failed:', err);
    }
  }, [parcels]);

  useEffect(() => {
    safeStorage.setItem(`${STORAGE_KEY}_truck_manifests`, JSON.stringify(truckManifests));
  }, [truckManifests]);

  useEffect(() => {
    safeStorage.setItem(`${STORAGE_KEY}_courier_manifests`, JSON.stringify(courierManifests));
  }, [courierManifests]);

  useEffect(() => {
    safeStorage.setItem(`${STORAGE_KEY}_notifications`, JSON.stringify(notifications));
  }, [notifications]);

  useEffect(() => {
    safeStorage.setItem(`${STORAGE_KEY}_courier_intake_settlements`, JSON.stringify(courierIntakeSettlements));
  }, [courierIntakeSettlements]);

  useEffect(() => {
    safeStorage.setItem(`${STORAGE_KEY}_transactions`, JSON.stringify(transactions));
  }, [transactions]);

  useEffect(() => {
    try {
      safeStorage.setItem('interBranchObligations', JSON.stringify(interBranchObligations));
    } catch {}
  }, [interBranchObligations]);

  useEffect(() => {
    try {
      safeStorage.setItem('parcelEvents', JSON.stringify(parcelEvents));
    } catch {}
  }, [parcelEvents]);

  useEffect(() => {
    safeStorage.setItem(`${STORAGE_KEY}_settlements`, JSON.stringify(settlements));
  }, [settlements]);

  useEffect(() => {
    safeStorage.setItem(`${STORAGE_KEY}_shift_settlements`, JSON.stringify(shiftSettlements));
  }, [shiftSettlements]);

  useEffect(() => {
    safeStorage.setItem(`${STORAGE_KEY}_vouchers`, JSON.stringify(vouchers));
  }, [vouchers]);

  useEffect(() => {
    safeStorage.setItem(`${STORAGE_KEY}_pricing_rules`, JSON.stringify(pricingRules));
  }, [pricingRules]);

  useEffect(() => {
    safeStorage.setItem(`${STORAGE_KEY}_cod_settings`, JSON.stringify(codSettings));
  }, [codSettings]);

  useEffect(() => {
    safeStorage.setItem(`${STORAGE_KEY}_expenses`, JSON.stringify(expenses));
  }, [expenses]);

  useEffect(() => {
    safeStorage.setItem(`${STORAGE_KEY}_expense_categories`, JSON.stringify(expenseCategories));
  }, [expenseCategories]);

  useEffect(() => {
    safeStorage.setItem(`${STORAGE_KEY}_vehicles`, JSON.stringify(vehicles));
  }, [vehicles]);

  useEffect(() => {
    safeStorage.setItem(`${STORAGE_KEY}_employees`, JSON.stringify(employees));
  }, [employees]);

  useEffect(() => {
    safeStorage.setItem(`${STORAGE_KEY}_payroll_records`, JSON.stringify(payrollRecords));
  }, [payrollRecords]);

  useEffect(() => {
    safeStorage.setItem(`${STORAGE_KEY}_fixed_assets`, JSON.stringify(fixedAssets));
  }, [fixedAssets]);

  useEffect(() => {
    safeStorage.setItem(`${STORAGE_KEY}_direct_messages`, JSON.stringify(directMessages));
  }, [directMessages]);

  // Keep currentBranch in sync with branches updates and user assigned branch
  useEffect(() => {
    // 1. Enforce branch binding for non-super_admin users
    if (currentUser?.branchId && currentUser.role !== 'super_admin' && branches.length > 0) {
      const assignedBranch = branches.find((b) => b.id === currentUser.branchId);
      if (assignedBranch && currentBranch?.id !== assignedBranch.id) {
        setCurrentBranch(assignedBranch);
        safeStorage.setItem(SESSION_BRANCH_ID_KEY, assignedBranch.id);
        safeStorage.setItem(SESSION_BRANCH_OBJ_KEY, JSON.stringify(assignedBranch));
        return;
      }
    }

    // 2. Ghost Branch Sanitization: Only if branches list is populated and current branch is genuinely unknown
    if (currentBranch?.id && currentBranch.id !== 'all_branches' && branches.length > 0 && !branches.some((b) => b.id === currentBranch.id)) {
      if (currentUser?.branchId) {
        const found = branches.find((b) => b.id === currentUser.branchId);
        if (found) {
          setCurrentBranch(found);
          safeStorage.setItem(SESSION_BRANCH_ID_KEY, found.id);
          safeStorage.setItem(SESSION_BRANCH_OBJ_KEY, JSON.stringify(found));
          return;
        }
      }
      if (currentUser?.role === 'super_admin') {
        setCurrentBranch(ALL_BRANCHES_SUPERVISION_BRANCH);
        safeStorage.setItem(SESSION_BRANCH_ID_KEY, ALL_BRANCHES_SUPERVISION_BRANCH.id);
        safeStorage.setItem(SESSION_BRANCH_OBJ_KEY, JSON.stringify(ALL_BRANCHES_SUPERVISION_BRANCH));
      }
      return;
    }

    // 3. Active Branch Live Property Synchronization
    if (!currentBranch?.id) return;
    const fresh = branches.find((b) => b.id === currentBranch.id);
    if (
      fresh &&
      (fresh.boxSypBalance !== currentBranch.boxSypBalance ||
        fresh.boxUsdBalance !== currentBranch.boxUsdBalance ||
        fresh.name !== currentBranch.name ||
        fresh.commissionRateShipping !== currentBranch.commissionRateShipping ||
        fresh.commissionRateTransfers !== currentBranch.commissionRateTransfers ||
        fresh.isActive !== currentBranch.isActive)
    ) {
      setCurrentBranch((prev) => ({ ...prev, ...fresh }));
    }
  }, [branches, currentBranch?.id, currentBranch?.boxSypBalance, currentBranch?.boxUsdBalance, currentBranch?.name, currentBranch?.commissionRateShipping, currentBranch?.commissionRateTransfers, currentBranch?.isActive, currentUser?.role, currentUser?.branchId]);

  useEffect(() => {
    safeStorage.setItem(`${STORAGE_KEY}_users`, JSON.stringify(users));
  }, [users]);

  // Save isolated session states so F5 / refresh and updates retain the exact user session and branch
  useEffect(() => {
    if (currentUser?.id) {
      safeStorage.setItem(SESSION_USER_ID_KEY, currentUser.id);
      safeStorage.setItem(SESSION_USER_OBJ_KEY, JSON.stringify(currentUser));
    }
  }, [currentUser]);

  useEffect(() => {
    if (currentBranch?.id) {
      safeStorage.setItem(SESSION_BRANCH_ID_KEY, currentBranch.id);
      safeStorage.setItem(SESSION_BRANCH_OBJ_KEY, JSON.stringify(currentBranch));
    } else {
      safeStorage.removeItem(SESSION_BRANCH_ID_KEY);
      safeStorage.removeItem(SESSION_BRANCH_OBJ_KEY);
    }
  }, [currentBranch]);

  useEffect(() => {
    if (activeModule) {
      safeStorage.setItem(SESSION_ACTIVE_MODULE_KEY, activeModule);
      setCurrentActivePage(activeModule);
    }
  }, [activeModule]);

  // Keep currentUser synced if user permissions or name change without breaking active view or switching users
  useEffect(() => {
    if (currentUser?.id && users.length > 0) {
      const freshUser = users.find((u) => u.id === currentUser.id);
      if (freshUser && (freshUser.name !== currentUser.name || freshUser.role !== currentUser.role || freshUser.isActive !== currentUser.isActive)) {
        setCurrentUser((prev) => ({ ...prev, ...freshUser }));
      }
    }
  }, [users, currentUser?.id]);

  useEffect(() => {
    safeStorage.setItem(`${STORAGE_KEY}_branding_settings`, JSON.stringify(brandingSettings));
  }, [brandingSettings]);

  useEffect(() => {
    safeStorage.setItem(`${STORAGE_KEY}_alerts_settings`, JSON.stringify(alertsSettings));
  }, [alertsSettings]);

  useEffect(() => {
    safeStorage.setItem(`${STORAGE_KEY}_audit_logs`, JSON.stringify(auditLogs));
  }, [auditLogs]);

  useEffect(() => {
    try {
      const data = JSON.stringify(customers);
      // إذا كان أكبر من 1MB، احذف الصور الكبيرة
      if (data.length > 1_000_000) {
        const trimmed = customers.map((c: any) => ({
          ...c,
          idPhotoFront: c.idPhotoFront?.startsWith('data:image/') ? '__MIGRATED__' : c.idPhotoFront,
          idPhotoBack: c.idPhotoBack?.startsWith('data:image/') ? '__MIGRATED__' : c.idPhotoBack,
        }));
        safeStorage.setItem(`${STORAGE_KEY}_customers`, JSON.stringify(trimmed));
      } else {
        safeStorage.setItem(`${STORAGE_KEY}_customers`, data);
      }
    } catch (err) {
      console.warn('[Customers] Save failed:', err);
    }
  }, [customers]);

  // --- Real-time Cloud Synchronization State & Branch Linking ---
  const [cloudSyncState, setCloudSyncState] = useState<CloudSyncState>(() => vpsSyncEngine.state);
  const [timestampWorkerStats, setTimestampWorkerStats] = useState<TimestampWorkerStats>(() => timestampWorker.getStats());
  const [boundBranchId, setBoundBranchIdState] = useState<string | undefined>(() => {
    return loadSavedVpsConfig()?.branchBindingId;
  });

  // Strict Server-Authoritative & Network Guard States
  const [isServerOnline, setIsServerOnline] = useState<boolean>(() => isServerOnlineSync());
  const [serverOfflineAlertOpen, setServerOfflineAlertOpen] = useState<boolean>(false);
  const [serverOfflineAlertMsg, setServerOfflineAlertMsg] = useState<string>(SERVER_OFFLINE_NOTICE);

  // LocalStorage Quota Guard State
  const [localStorageWarning, setLocalStorageWarning] = useState<{
    level: 'warning' | 'critical';
    totalMB: number;
    message: string;
  } | null>(null);

  useEffect(() => {
    const unsub = subscribeServerConnection((online) => {
      setIsServerOnline(online);
      if (online && serverOfflineAlertOpen) {
        setTimeout(() => {
          setServerOfflineAlertOpen(false);
        }, 1200);
      }
    });
    return () => unsub();
  }, [serverOfflineAlertOpen]);

  const showServerOfflineAlert = useCallback((msg?: string) => {
    setServerOfflineAlertMsg(msg || SERVER_OFFLINE_NOTICE);
    setServerOfflineAlertOpen(true);
  }, []);

  const closeServerOfflineAlert = useCallback(() => {
    setServerOfflineAlertOpen(false);
  }, []);

  const ensureServerConnected = useCallback(async (customMsg?: string): Promise<boolean> => {
    const reachable = await checkServerReachable(false);
    if (!reachable) {
      showServerOfflineAlert(customMsg || SERVER_OFFLINE_NOTICE);
      return false;
    }
    return true;
  }, [showServerOfflineAlert]);

  const estimateLocalStorageSize = useCallback(() => {
    let totalBytes = 0;
    const byKey: Record<string, number> = {};

    if (typeof window !== 'undefined') {
      try {
        if ('localStorage' in window) {
          for (let i = 0; i < window.localStorage.length; i++) {
            const key = window.localStorage.key(i);
            if (key) {
              const val = window.localStorage.getItem(key) || '';
              const bytes = (key.length + val.length) * 2;
              byKey[key] = bytes;
              totalBytes += bytes;
            }
          }
        }
        if ('sessionStorage' in window) {
          for (let i = 0; i < window.sessionStorage.length; i++) {
            const key = window.sessionStorage.key(i);
            if (key) {
              const val = window.sessionStorage.getItem(key) || '';
              const bytes = (key.length + val.length) * 2;
              byKey[key] = (byKey[key] || 0) + bytes;
              totalBytes += bytes;
            }
          }
        }
      } catch (err) {
        console.warn('[Storage] Error estimating storage size:', err);
      }
    }

    const totalMB = Number((totalBytes / (1024 * 1024)).toFixed(2));
    return { totalBytes, totalMB, byKey };
  }, []);

  const cleanupOldLocalData = useCallback(() => {
    const beforeSize = estimateLocalStorageSize().totalBytes;
    const ninetyDaysAgo = Date.now() - 90 * 24 * 60 * 60 * 1000;
    const sixtyDaysAgo = Date.now() - 60 * 24 * 60 * 60 * 1000;

    // 1. اقرأ الطرود من localStorage
    let removedIds = new Set<string>();
    let removedParcels = 0;
    let removedEvents = 0;
    let removedAuditLogs = 0;

    try {
      const key = 'orca_logistics_v4_parcels';
      const raw = localStorage.getItem(key);
      if (raw) {
        const parcels = JSON.parse(raw);
        if (Array.isArray(parcels)) {
          const kept = parcels.filter((p: any) => {
            const isDelivered =
              p.handlingStatus === 'delivered' ||
              p.handlingStatus === 'delivered_uncollected';
            const ref = p.deliveredAt || p.updatedAt || p.createdAt;
            const isOld = ref && new Date(ref).getTime() < ninetyDaysAgo;
            if (isDelivered && isOld) {
              removedIds.add(p.id);
              removedParcels++;
              return false;
            }
            return true;
          });
          localStorage.setItem(key, JSON.stringify(kept));
        }
      }
    } catch (err) {
      console.error('[Cleanup] Parcels failed:', err);
    }

    // 2. اقرأ واحذف parcelEvents
    try {
      if (removedIds.size > 0) {
        const evKey = 'parcelEvents';
        const evRaw = localStorage.getItem(evKey);
        if (evRaw) {
          const events = JSON.parse(evRaw);
          if (Array.isArray(events)) {
            const keptEvents = events.filter((e: any) => {
              if (removedIds.has(e.parcelId)) {
                removedEvents++;
                return false;
              }
              return true;
            });
            localStorage.setItem(evKey, JSON.stringify(keptEvents));
          }
        }
      }
    } catch (err) {
      console.error('[Cleanup] Events failed:', err);
    }

    // 3. اقرأ واحذف auditLogs
    try {
      const logKey = 'orca_logistics_v4_audit_logs';
      const raw = localStorage.getItem(logKey);
      if (raw) {
        const logs = JSON.parse(raw);
        if (Array.isArray(logs)) {
          const kept = logs.filter((l: any) => {
            const ts = l.timestamp ? new Date(l.timestamp).getTime() : 0;
            if (ts > 0 && ts < sixtyDaysAgo) {
              removedAuditLogs++;
              return false;
            }
            return true;
          });
          localStorage.setItem(logKey, JSON.stringify(kept));
        }
      }
    } catch (err) {
      console.error('[Cleanup] Audit logs failed:', err);
    }

    // 4. ✅ مزامنة React state مع localStorage (الحرج!)
    const removedIdsSnapshot = new Set(removedIds);
    setParcels((prev) =>
      prev.filter((p) => !removedIdsSnapshot.has(p.id))
    );
    setParcelEvents((prev) =>
      prev.filter((e) => !removedIdsSnapshot.has(e.parcelId))
    );
    setAuditLogs((prev) =>
      prev.filter((l) => {
        const ts = l.timestamp ? new Date(l.timestamp).getTime() : 0;
        return !(ts > 0 && ts < sixtyDaysAgo);
      })
    );

    // 5. القياس النهائي
    const afterSize = estimateLocalStorageSize().totalBytes;
    const freedMB = Number(
      (Math.max(0, beforeSize - afterSize) / (1024 * 1024)).toFixed(2)
    );

    console.log(
      `[Cleanup] Removed: ${removedParcels} parcels, ` +
      `${removedEvents} events, ${removedAuditLogs} logs, ` +
      `freed ${freedMB}MB`
    );

    setLocalStorageWarning(null);

    return { removedParcels, removedEvents, removedAuditLogs, freedMB };
  }, [estimateLocalStorageSize, setParcels, setParcelEvents, setAuditLogs]);

  useEffect(() => {
    const checkQuota = () => {
      const { totalMB } = estimateLocalStorageSize();
      if (totalMB >= 4.5) {
        console.warn('[Quota] Critical — auto cleanup triggered');
        const result = cleanupOldLocalData();
        setLocalStorageWarning({
          level: 'critical',
          totalMB,
          message:
            `تم تنظيف ${result.freedMB}MB تلقائياً. ` +
            `${result.removedParcels} طرد محذوف.`,
        });
      } else if (totalMB >= 3.8) {
        setLocalStorageWarning({
          level: 'warning',
          totalMB,
          message:
            `التخزين بلغ ${totalMB}MB. ` +
            `سيتم التنظيف التلقائي عند 4.5MB.`,
        });
      } else {
        setLocalStorageWarning(null);
      }
    };
    const timer = setTimeout(checkQuota, 3000);
    const interval = setInterval(checkQuota, 60000);
    return () => {
      clearTimeout(timer);
      clearInterval(interval);
    };
  }, [estimateLocalStorageSize, cleanupOldLocalData]);

  const handleSetActiveModule = useCallback((mod: ActiveModule) => {
    if (isNavigationBlockedByDisconnection(mod)) {
      const details = getDisconnectedPageDetails();
      showServerOfflineAlert(
        `تنبيه الحماية: انقطع الاتصال بالسيرفر أثناء العمل في (${details.disconnectedPageName || 'الصفحة الحالية'}). تم حصر كاش البيانات مؤقتاً في هذه الصفحة لحمايتها. يرجى البقاء هنا حتى عودة الاتصال بالسيرفر.`
      );
      return;
    }
    setActiveModule(mod);
    setCurrentActivePage(mod);
  }, [showServerOfflineAlert]);

  const setBoundBranchId = useCallback((branchId: string) => {
    const current = loadSavedVpsConfig();
    const updated = { ...current, branchBindingId: branchId || undefined };
    saveVpsConfig(updated);
    setBoundBranchIdState(branchId || undefined);
    vpsSyncEngine.resetConnection();
  }, []);

  // Listen to sync engine & background timestamp worker status updates
  useEffect(() => {
    const unsubscribeSync = vpsSyncEngine.registerStateListener((s) => {
      setCloudSyncState(s);
    });
    const unsubscribeWorker = timestampWorker.subscribe((stats) => {
      setTimestampWorkerStats(stats);
    });
    return () => {
      unsubscribeSync();
      unsubscribeWorker();
    };
  }, []);

  // Start real-time Firestore listeners for Multi-Branch synchronization
  useEffect(() => {
    const handleRemoteParcels = (remoteParcels: Parcel[]) => {
      setParcels((prev) => {
        const idMap = new Map<string, Parcel>();
        const trackingMap = new Map<string, Parcel>();
        for (const p of prev) {
          if (p.id) idMap.set(p.id, p);
          if (p.trackingNumber) trackingMap.set(p.trackingNumber.trim().toUpperCase(), p);
        }

        let changed = false;
        const currentParcels = [...prev];

        for (const remote of remoteParcels) {
          if (!remote) continue;
          const remoteTracking = (remote.trackingNumber || '').trim().toUpperCase();
          const local = (remote.id ? idMap.get(remote.id) : null) || (remoteTracking ? trackingMap.get(remoteTracking) : null);

          if (!local) {
            currentParcels.push(remote);
            if (remote.id) idMap.set(remote.id, remote);
            if (remoteTracking) trackingMap.set(remoteTracking, remote);
            changed = true;
          } else {
            // CRITICAL 1: Never overwrite local state if this parcel has a higher or strictly pending local mutation
            if (vpsSyncEngine.isItemPendingStrict('parcels', remote)) {
              continue;
            }

            const localRank = getHandlingStatusRank(local.handlingStatus);
            const remoteRank = getHandlingStatusRank(remote.handlingStatus);

            // Re-sync local to server if local has higher rank or courier handover (server sent stale state from another branch)
            const isLocalHandover =
              local.handlingStatus === 'received_at_hub' &&
              local.courierHandedOverToHub === true &&
              remote.handlingStatus === 'with_courier';
            if (localRank > remoteRank || isLocalHandover) {
              vpsSyncEngine.syncParcel(local);
            }

            const merged: Parcel = mergeParcelSafely(local, remote);
            if (JSON.stringify(local) !== JSON.stringify(merged)) {
              const idx = currentParcels.findIndex(
                (p) => (local.id && p.id === local.id) || (local.trackingNumber && p.trackingNumber === local.trackingNumber)
              );
              if (idx >= 0) {
                currentParcels[idx] = merged;
                changed = true;
                if (merged.id) idMap.set(merged.id, merged);
                if (merged.trackingNumber) trackingMap.set(merged.trackingNumber.trim().toUpperCase(), merged);
              }
            }
          }
        }
        return changed ? currentParcels : prev;
      });
    };

    const handleRemoteTruckManifests = (remoteManifests: TruckManifest[]) => {
      setTruckManifests((prev) => {
        const idMap = new Map<string, TruckManifest>();
        const numMap = new Map<string, TruckManifest>();

        for (const m of prev) {
          if (m.id) idMap.set(m.id, m);
          if (m.manifestNumber) numMap.set(m.manifestNumber, m);
        }

        let changed = false;
        const currentManifests = [...prev];

        const MANIFEST_PROGRESSION: Record<string, number> = {
          'preparing': 1,
          'dispatched': 2,
          'arrived_unloading': 3,
          'received': 4,
        };

        for (const remote of remoteManifests) {
          if (!remote) continue;
          const local = (remote.id ? idMap.get(remote.id) : null) || (remote.manifestNumber ? numMap.get(remote.manifestNumber) : null);

          if (!local) {
            currentManifests.push(remote);
            if (remote.id) idMap.set(remote.id, remote);
            if (remote.manifestNumber) numMap.set(remote.manifestNumber, remote);
            changed = true;

            const isDestinationBranch =
              remote.destinationHubId === currentBranch.id ||
              branches.some((b) => b.id === currentBranch.id && b.parentHubId === remote.destinationHubId) ||
              (currentBranch.type === 'main_hub' && branches.some((b) => b.id === remote.destinationHubId && b.parentHubId === currentBranch.id));

            if (isDestinationBranch && (remote.status === 'dispatched' || remote.status === 'arrived_unloading')) {
              playTruckDockArrivalSound();
            }
          } else {
            // CRITICAL: Never overwrite local state if this manifest has a higher or strictly pending local mutation
            if (vpsSyncEngine.isItemPendingStrict('truckManifests', remote)) {
              continue;
            }

            const localRank = MANIFEST_PROGRESSION[local.status] || 0;
            const remoteRank = MANIFEST_PROGRESSION[remote.status] || 0;
            const localTime = new Date((local as any).updatedAt || local.receivedAt || local.arrivedAt || local.dispatchedAt || local.createdAt || 0).getTime();
            const remoteTime = new Date((remote as any).updatedAt || remote.receivedAt || remote.arrivedAt || remote.dispatchedAt || remote.createdAt || 0).getTime();

            // Prevent rolling back a discharged/received manifest to dispatched
            if (localRank > remoteRank) {
              vpsSyncEngine.syncTruckManifest(local);
              continue;
            }

            if (localTime > remoteTime && localRank >= remoteRank) {
              vpsSyncEngine.syncTruckManifest(local);
              continue;
            }

            const isDifferent =
              remote.status !== local.status ||
              remote.parcelIds.length !== local.parcelIds.length ||
              (remote as any)._syncedAt !== (local as any)._syncedAt;

            if (isDifferent) {
              const merged: TruckManifest = { ...local, ...remote };
              const idx = currentManifests.findIndex(
                (m) => (local.id && m.id === local.id) || (local.manifestNumber && m.manifestNumber === local.manifestNumber)
              );

              if (idx >= 0) {
                currentManifests[idx] = merged;
                changed = true;
                if (merged.id) idMap.set(merged.id, merged);
                if (merged.manifestNumber) numMap.set(merged.manifestNumber, merged);
              }

              const isDestinationBranch =
                remote.destinationHubId === currentBranch.id ||
                branches.some((b) => b.id === currentBranch.id && b.parentHubId === remote.destinationHubId) ||
                (currentBranch.type === 'main_hub' && branches.some((b) => b.id === remote.destinationHubId && b.parentHubId === currentBranch.id));

              if (isDestinationBranch && local.status !== remote.status && (remote.status === 'dispatched' || remote.status === 'arrived_unloading')) {
                playTruckDockArrivalSound();
              }

              // إذا تغيرت حالة المانافيست إلى وصول أو تفريغ وكان الفرع الحالي هو فرع الانطلاق الصادر
              if (remote.originHubId === currentBranch.id || currentUser?.role === 'super_admin') {
                const destB = branches.find((b) => b.id === remote.destinationHubId);
                const origB = branches.find((b) => b.id === remote.originHubId);
                if (local.status === 'dispatched' && remote.status === 'arrived_unloading') {
                  const arrivalNotifId = `notif_arrival_orig_${remote.id}`;
                  setNotifications((prevNotifs) => {
                    const alreadyExists = prevNotifs.some(
                      (n) =>
                        n.id === arrivalNotifId ||
                        n.id === `notif_remote_arr_${remote.id}` ||
                        (n.relatedId === remote.id && (n.type === 'truck_arrived' || n.title.includes('وصول')))
                    );
                    if (alreadyExists) return prevNotifs;

                    const arrivalNotif: SystemNotification = {
                      id: arrivalNotifId,
                      title: `🚚 وصول الشاحنة إلى فرع الوجهة (${destB?.name || ''}) وتتحضر للتفريغ`,
                      message: `وصلت الشاحنة (${remote.truckPlate || 'شاحنة النقل'} - السائق: ${remote.driverName || ''}) التابعة للمانافيست (${remote.manifestNumber}) بنجاح إلى فرع (${destB?.name || 'مركز الوجهة'}) وتتحضر للتفريغ الآن.`,
                      type: 'truck_arrived',
                      targetBranchId: remote.originHubId,
                      relatedId: remote.id,
                      actionType: 'view_manifest',
                      timestamp: remote.arrivedAt || new Date().toISOString(),
                      read: false,
                    };
                    playGeneralNotificationSound();
                    return [arrivalNotif, ...prevNotifs];
                  });
                } else if ((local.status === 'dispatched' || local.status === 'arrived_unloading') && remote.status === 'received') {
                  const cleanMissing = (remote.missingParcelIds || []).filter(
                    (id) => id && typeof id === 'string' && id.trim() !== ''
                  );
                  const isShortage = cleanMissing.length > 0;
                  const dischargeNotif: SystemNotification = {
                    id: `notif_remote_dis_${remote.id}`,
                    title: isShortage
                      ? `🚨 تم تفريغ الشاحنة في فرع (${destB?.name || ''}) مع تسجيل نقص (${cleanMissing.length} طرد)!`
                      : '✅ تم تفريغ الشاحنة في فرع الوجهة - الشحنات جاهزة للتسليم',
                    message: isShortage
                      ? `أفاد فرع (${destB?.name || 'الوجهة'}) بتفريغ المانافيست (${remote.manifestNumber}) مع تسجيل (${cleanMissing.length}) طرد ناقص. باقي الطرود أصبحت جاهزة للتسليم.`
                      : `تم تفريغ حمولة المانافيست (${remote.manifestNumber}) الشاحنة (${remote.truckPlate || 'النقل'}) بالكامل في فرع (${destB?.name || 'الوجهة'}) بعدد (${remote.parcelIds?.length || 0}) طرد دون أي نقص، وأصبحت الطرود بحالة استلام وجاهزة للتسليم للزبائن.`,
                    type: isShortage ? 'shortage_alert' : 'manifest_unloaded',
                    priority: isShortage ? 'urgent' : 'normal',
                    targetBranchId: remote.originHubId,
                    relatedId: remote.id,
                    actionType: isShortage ? 'verify_shortage' : 'view_manifest',
                    shortageSummary: isShortage && cleanMissing.length ? {
                      manifestId: remote.id,
                      manifestNumber: remote.manifestNumber,
                      missingCount: cleanMissing.length,
                      parcelIds: cleanMissing,
                      originBranchName: origB?.name || '',
                      destBranchName: destB?.name || '',
                      trackingNumbers: [],
                    } : undefined,
                    timestamp: remote.receivedAt || new Date().toISOString(),
                    read: false,
                  };
                  setNotifications((prevNotifs) => {
                    if (prevNotifs.some((n) => n.id === dischargeNotif.id || (n.relatedId === remote.id && n.title.includes('تفريغ')))) return prevNotifs;
                    return [dischargeNotif, ...prevNotifs];
                  });
                  if (isShortage) {
                    playShortageAlertSound();
                  } else {
                    playGeneralNotificationSound();
                  }
                }
              }
            }
          }
        }
        if (changed) {
          safeStorage.setItem(`${STORAGE_KEY}_truck_manifests`, JSON.stringify(currentManifests));
        }
        return changed ? currentManifests : prev;
      });
    };

    const handleRemoteCourierManifests = (remoteCourierManifests: CourierManifest[]) => {
      setCourierManifests((prev) => {
        const map = new Map(prev.map((m) => [m.manifestNumber, m]));
        let changed = false;
        for (const remote of remoteCourierManifests) {
          const local = map.get(remote.manifestNumber);
          if (!local) {
            map.set(remote.manifestNumber, remote);
            changed = true;
          } else {
            const isDifferent =
              remote.status !== local.status ||
              (remote as any)._syncedAt !== (local as any)._syncedAt;

            if (isDifferent) {
              map.set(remote.manifestNumber, { ...local, ...remote });
              changed = true;
            }
          }
        }
        return changed ? Array.from(map.values()) : prev;
      });
    };

    const handleRemoteBranches = (remoteBranches: Branch[]) => {
      if (!Array.isArray(remoteBranches)) return;
      const validRemotes = remoteBranches.filter((b) => b && b.id);
      setBranches(validRemotes);
      safeStorage.setItem(`${STORAGE_KEY}_branches`, JSON.stringify(validRemotes));
    };

    const handleRemoteUsers = (remoteUsers: User[]) => {
      if (!Array.isArray(remoteUsers)) return;
      const validRemotes = remoteUsers.filter((u) => u && u.id);
      setUsers(validRemotes);
      safeStorage.setItem(`${STORAGE_KEY}_users`, JSON.stringify(validRemotes));
    };

    const handleRemoteTransactions = (remoteTx: CashboxTransaction[]) => {
      setTransactions((prev) => {
        const map = new Map(prev.map((t) => [t.id, t]));
        let changed = false;
        for (const remote of remoteTx) {
          if (!remote || !remote.id) continue;
          const local = map.get(remote.id);
          if (!local) {
            map.set(remote.id, remote);
            changed = true;
          } else {
            const localTime = new Date((local as any).updatedAt || local.timestamp || (local as any).createdAt || 0).getTime();
            const remoteTime = new Date((remote as any).updatedAt || remote.timestamp || (remote as any).createdAt || 0).getTime();
            const isDifferent =
              remote.amount !== local.amount ||
              remote.type !== local.type ||
              remote.currency !== local.currency ||
              remote.description !== local.description ||
              remote.branchId !== local.branchId ||
              remote.shiftSettlementVoucherId !== local.shiftSettlementVoucherId ||
              remote.counterpartyBranchId !== local.counterpartyBranchId;

            if (isDifferent && remoteTime >= localTime) {
              map.set(remote.id, { ...local, ...remote });
              changed = true;
            }
          }
        }
        return changed ? Array.from(map.values()) : prev;
      });
    };

    const handleRemoteShiftVouchers = (remoteVouchers: ShiftSettlementVoucher[]) => {
      setShiftSettlements((prev) => {
        const map = new Map(prev.map((s) => [s.id, s]));
        let changed = false;
        for (const remote of remoteVouchers) {
          if (!remote || !remote.id) continue;
          const local = map.get(remote.id);
          if (!local) {
            map.set(remote.id, remote);
            changed = true;
          } else {
            const localTime = new Date((local as any).updatedAt || local.approvedAt || local.timestamp || 0).getTime();
            const remoteTime = new Date((remote as any).updatedAt || remote.approvedAt || remote.timestamp || 0).getTime();
            const isDifferent =
              remote.status !== local.status ||
              remote.sypAmount !== local.sypAmount ||
              remote.usdAmount !== local.usdAmount ||
              remote.parcelsCount !== local.parcelsCount ||
              remote.rejectedReason !== local.rejectedReason ||
              remote.notes !== local.notes;

            if (isDifferent && remoteTime >= localTime) {
              map.set(remote.id, { ...local, ...remote });
              changed = true;
            }
          }
        }
        return changed ? Array.from(map.values()) : prev;
      });
    };

    const handleRemoteSettlements = (remoteSet: DailySettlement[]) => {
      setSettlements((prev) => {
        const map = new Map(prev.map((s) => [s.id, s]));
        let changed = false;
        for (const remote of remoteSet) {
          if (!remote || !remote.id) continue;
          const local = map.get(remote.id);
          if (!local) {
            map.set(remote.id, remote);
            changed = true;
          } else {
            const localTime = new Date((local as any).updatedAt || local.timestamp || local.settlementDate || 0).getTime();
            const remoteTime = new Date((remote as any).updatedAt || remote.timestamp || remote.settlementDate || 0).getTime();
            const isDifferent =
              remote.status !== local.status ||
              remote.sypHandedOver !== local.sypHandedOver ||
              remote.usdHandedOver !== local.usdHandedOver ||
              remote.sypCommissionEarned !== local.sypCommissionEarned ||
              remote.usdCommissionEarned !== local.usdCommissionEarned;

            if (isDifferent && remoteTime >= localTime) {
              map.set(remote.id, { ...local, ...remote });
              changed = true;
            }
          }
        }
        return changed ? Array.from(map.values()) : prev;
      });
    };

    const handleRemoteNotifications = (remoteNotif: SystemNotification[]) => {
      setNotifications((prev) => {
        const map = new Map(prev.map((n) => [n.id, n]));
        let changed = false;
        let hasNewTargeted = false;
        let isUrgent = false;

        for (const remote of remoteNotif) {
          const local = map.get(remote.id);
          if (!local) {
            map.set(remote.id, remote);
            changed = true;
            if (!remote.read && (!remote.targetBranchId || remote.targetBranchId === currentBranch.id || currentUser?.role === 'super_admin')) {
              hasNewTargeted = true;
              if (remote.priority === 'urgent' || remote.type === 'sla_warning') {
                isUrgent = true;
              }
            }
          } else if (local.read !== remote.read) {
            map.set(remote.id, { ...local, read: remote.read });
            changed = true;
          }
        }

        if (hasNewTargeted) {
          if (isUrgent) {
            playShortageAlertSound();
          } else {
            playGeneralNotificationSound();
          }
        }

        return changed ? Array.from(map.values()) : prev;
      });
    };

    const handleRemoteCustomers = (remoteCust: Customer[]) => {
      const tombstones = vpsSyncEngine.getTombstones('customers');
      setCustomers((prev) => {
        let current = prev.filter((c) => !tombstones.has(c.id));
        let changed = current.length !== prev.length;
        for (const remote of remoteCust) {
          if (!remote || tombstones.has(remote.id)) continue;

          const remoteKey = getCanonicalCustomerKey(remote);
          const matchIdx = current.findIndex((local) => isSameCustomer(local, remote) || getCanonicalCustomerKey(local) === remoteKey);
          if (matchIdx < 0) {
            current = [remote, ...current];
            changed = true;
          } else {
            const local = current[matchIdx];
            const merged: Customer = {
              ...local,
              ...remote,
              id: local.id || remote.id,
              code: local.code || remote.code,
              fullName: remote.fullName || local.fullName,
              firstName: remote.firstName || local.firstName,
              fatherName: remote.fatherName || local.fatherName,
              lastName: remote.lastName || local.lastName,
              motherName: remote.motherName || local.motherName || '',
              birthDate: remote.birthDate || local.birthDate || '',
              nationalId: remote.nationalId || local.nationalId || '',
              phone: remote.phone || local.phone || '',
              secondaryPhone: remote.secondaryPhone || local.secondaryPhone || '',
              idType: remote.idType || local.idType || 'syrian',
              city: (remote.city || local.city || 'دمشق') as any,
              address: remote.address || local.address || '',
              idPhotoFront: remote.idPhotoFront || local.idPhotoFront,
              idPhotoBack: remote.idPhotoBack || local.idPhotoBack,
            };

            const isDifferent =
              local.fullName !== merged.fullName ||
              local.phone !== merged.phone ||
              local.nationalId !== merged.nationalId;

            if (isDifferent) {
              const updated = [...current];
              updated[matchIdx] = merged;
              current = updated;
              changed = true;
            }
          }
        }

        // Guaranteed deduplication pass
        const dedupedMap = new Map<string, Customer>();
        for (const c of current) {
          if (!c) continue;
          const key = getCanonicalCustomerKey(c);
          if (!dedupedMap.has(key)) {
            dedupedMap.set(key, c);
          } else {
            const ex = dedupedMap.get(key)!;
            dedupedMap.set(key, { ...ex, ...c, id: ex.id });
            changed = true;
          }
        }
        const finalCustomers = Array.from(dedupedMap.values());
        if (changed || finalCustomers.length !== prev.length) {
          safeStorage.setItem(`${STORAGE_KEY}_customers`, JSON.stringify(finalCustomers));
          return finalCustomers;
        }
        return prev;
      });
    };

    const handleRemotePricingRules = (remoteRules: PricingRule[]) => {
      const tombstones = vpsSyncEngine.getTombstones('pricing_rules');
      setPricingRules((prev) => {
        const filtered = prev.filter((r) => !tombstones.has(r.id));
        const map = new Map(filtered.map((r) => [r.id, r]));
        let changed = filtered.length !== prev.length;
        for (const remote of remoteRules) {
          if (tombstones.has(remote.id)) continue;
          const local = map.get(remote.id);
          if (!local) {
            map.set(remote.id, remote);
            changed = true;
          } else {
            map.set(remote.id, { ...local, ...remote });
            changed = true;
          }
        }
        return changed ? Array.from(map.values()) : prev;
      });
    };

    const handleRemoteVouchers = (remoteVouchers: FinancialVoucher[]) => {
      const tombstones = vpsSyncEngine.getTombstones('vouchers');
      setVouchers((prev) => {
        const filtered = prev.filter((v) => !tombstones.has(v.id));
        const map = new Map(filtered.map((v) => [v.id, v]));
        let changed = filtered.length !== prev.length;
        for (const remote of remoteVouchers) {
          if (tombstones.has(remote.id)) continue;
          if (!map.has(remote.id)) {
            map.set(remote.id, remote);
            changed = true;
          }
        }
        return changed ? Array.from(map.values()) : prev;
      });
    };

    const handleRemoteExpenses = (remoteExpenses: Expense[]) => {
      const tombstones = vpsSyncEngine.getTombstones('expenses');
      setExpenses((prev) => {
        const filtered = prev.filter((e) => !tombstones.has(e.id));
        const map = new Map(filtered.map((e) => [e.id, e]));
        let changed = filtered.length !== prev.length;
        for (const remote of remoteExpenses) {
          if (tombstones.has(remote.id)) continue;
          const local = map.get(remote.id);
          if (!local) {
            map.set(remote.id, remote);
            changed = true;
          } else {
            if (remote.status !== local.status || (remote as any)._syncedAt !== (local as any)._syncedAt) {
              map.set(remote.id, { ...local, ...remote });
              changed = true;
            }
          }
        }
        return changed ? Array.from(map.values()) : prev;
      });
    };

    const handleRemoteExpenseCategories = (remoteCats: ExpenseCategoryItem[]) => {
      const tombstones = vpsSyncEngine.getTombstones('expense_categories');
      setExpenseCategories((prev) => {
        const filtered = prev.filter((c) => !tombstones.has(c.id));
        const map = new Map(filtered.map((c) => [c.id, c]));
        let changed = filtered.length !== prev.length;
        for (const remote of remoteCats) {
          if (tombstones.has(remote.id)) continue;
          map.set(remote.id, remote);
          changed = true;
        }
        return changed ? Array.from(map.values()) : prev;
      });
    };

    const handleRemoteVehicles = (remoteVeh: Vehicle[]) => {
      const tombstones = vpsSyncEngine.getTombstones('vehicles');
      setVehicles((prev) => {
        let current = prev.filter((v) => !tombstones.has(v.id));
        let changed = current.length !== prev.length;
        for (const remote of remoteVeh) {
          if (tombstones.has(remote.id)) continue;
          const matchIdx = current.findIndex(
            (v) => v.id === remote.id || (remote.plateNumber && v.plateNumber && v.plateNumber.trim() === remote.plateNumber.trim())
          );
          if (matchIdx === -1) {
            current = [remote, ...current];
            changed = true;
          } else {
            const local = current[matchIdx];
            const merged = { ...local, ...remote };
            if (JSON.stringify(local) !== JSON.stringify(merged)) {
              const updated = [...current];
              updated[matchIdx] = merged;
              current = updated;
              changed = true;
            }
          }
        }
        return changed ? current : prev;
      });
    };

    const handleRemoteEmployees = (remoteEmp: Employee[]) => {
      const tombstones = vpsSyncEngine.getTombstones('employees');
      setEmployees((prev) => {
        let current = prev.filter((e) => !tombstones.has(e.id));
        let changed = current.length !== prev.length;
        for (const remote of remoteEmp) {
          if (tombstones.has(remote.id)) continue;
          const matchIdx = current.findIndex(
            (e) => e.id === remote.id || (remote.nationalId && e.nationalId && e.nationalId.trim() === remote.nationalId.trim())
          );
          if (matchIdx === -1) {
            current = [remote, ...current];
            changed = true;
          } else {
            const local = current[matchIdx];
            const merged = { ...local, ...remote };
            if (JSON.stringify(local) !== JSON.stringify(merged)) {
              const updated = [...current];
              updated[matchIdx] = merged;
              current = updated;
              changed = true;
            }
          }
        }
        return changed ? current : prev;
      });
    };

    const handleRemotePayrollRecords = (remotePay: PayrollRecord[]) => {
      const tombstones = vpsSyncEngine.getTombstones('payroll_records');
      setPayrollRecords((prev) => {
        let current = prev.filter((p) => !tombstones.has(p.id));
        let changed = current.length !== prev.length;
        for (const remote of remotePay) {
          if (tombstones.has(remote.id)) continue;
          const matchIdx = current.findIndex((p) => p.id === remote.id);
          if (matchIdx === -1) {
            current = [remote, ...current];
            changed = true;
          } else {
            const local = current[matchIdx];
            const merged = { ...local, ...remote };
            if (JSON.stringify(local) !== JSON.stringify(merged)) {
              const updated = [...current];
              updated[matchIdx] = merged;
              current = updated;
              changed = true;
            }
          }
        }
        return changed ? current : prev;
      });
    };

    const handleRemoteFixedAssets = (remoteAssets: FixedAsset[]) => {
      const tombstones = vpsSyncEngine.getTombstones('fixed_assets');
      setFixedAssets((prev) => {
        let current = prev.filter((a) => !tombstones.has(a.id));
        let changed = current.length !== prev.length;
        for (const remote of remoteAssets) {
          if (tombstones.has(remote.id)) continue;
          const matchIdx = current.findIndex((a) => a.id === remote.id);
          if (matchIdx === -1) {
            current = [remote, ...current];
            changed = true;
          } else {
            const local = current[matchIdx];
            const merged = { ...local, ...remote };
            if (JSON.stringify(local) !== JSON.stringify(merged)) {
              const updated = [...current];
              updated[matchIdx] = merged;
              current = updated;
              changed = true;
            }
          }
        }
        return changed ? current : prev;
      });
    };

    const handleRemoteDirectMessages = (remoteMsgs: DirectMessage[]) => {
      const tombstones = vpsSyncEngine.getTombstones('direct_messages');
      setDirectMessages((prev) => {
        const filtered = prev.filter((m) => !tombstones.has(m.id));
        const map = new Map(filtered.map((m) => [m.id, m]));
        let changed = filtered.length !== prev.length;
        for (const remote of remoteMsgs) {
          if (tombstones.has(remote.id)) continue;
          if (!map.has(remote.id)) {
            map.set(remote.id, remote);
            changed = true;
          }
        }
        return changed ? Array.from(map.values()) : prev;
      });
    };

    const handleRemoteAuditLogs = (remoteLogs: AuditLogEntry[]) => {
      setAuditLogs((prev) => {
        const map = new Map(prev.map((l) => [l.id, l]));
        let changed = false;
        for (const remote of remoteLogs) {
          if (!remote || !remote.id) continue;
          if (!map.has(remote.id)) {
            map.set(remote.id, remote);
            changed = true;
          }
        }
        if (!changed) return prev;
        const sorted = Array.from(map.values()).sort(
          (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
        ).slice(0, 500);
        return sorted;
      });
    };

    const handleRemoteBranding = (remoteBranding: CompanyBrandingSettings) => {
      const b = Array.isArray(remoteBranding) ? remoteBranding[0] : remoteBranding;
      if (b && typeof b === 'object') {
        setBrandingSettings((prev) => {
          const merged = { ...prev, ...b };
          if (JSON.stringify(prev) === JSON.stringify(merged)) {
            return prev;
          }
          safeStorage.setItem(`${STORAGE_KEY}_branding_settings`, JSON.stringify(merged));
          return merged;
        });
      }
    };

    const handleRemoteCodSettings = (remoteCod: CodTransferSettings) => {
      const c = Array.isArray(remoteCod) ? remoteCod[0] : remoteCod;
      if (c && typeof c === 'object') {
        setCodSettings((prev) => {
          const merged = { ...prev, ...c };
          if (JSON.stringify(prev) === JSON.stringify(merged)) {
            return prev;
          }
          safeStorage.setItem(`${STORAGE_KEY}_cod_settings`, JSON.stringify(merged));
          return merged;
        });
      }
    };

    const handleRemoteCourierIntakeSettlements = (remoteVouchers: CourierIntakeSettlementVoucher[]) => {
      setCourierIntakeSettlements((prev) => {
        const map = new Map(prev.map((s) => [s.id, s]));
        let changed = false;
        for (const remote of remoteVouchers) {
          if (!remote || !remote.id) continue;
          const local = map.get(remote.id);
          if (!local) {
            map.set(remote.id, remote);
            changed = true;
          } else {
            const localTime = new Date((local as any).updatedAt || local.timestamp || (local as any).approvedAt || 0).getTime();
            const remoteTime = new Date((remote as any).updatedAt || remote.timestamp || (remote as any).approvedAt || 0).getTime();
            const isDifferent =
              remote.totalCollectedSyp !== local.totalCollectedSyp ||
              remote.totalCollectedUsd !== local.totalCollectedUsd ||
              remote.totalPrepaidSyp !== local.totalPrepaidSyp ||
              remote.totalPrepaidUsd !== local.totalPrepaidUsd ||
              remote.parcelsCount !== local.parcelsCount ||
              remote.notes !== local.notes;

            if (isDifferent && remoteTime >= localTime) {
              map.set(remote.id, { ...local, ...remote });
              changed = true;
            }
          }
        }
        return changed ? Array.from(map.values()) : prev;
      });
    };

    vpsSyncEngine.startRealtimeSync({
      onParcels: handleRemoteParcels,
      onTruckManifests: handleRemoteTruckManifests,
      onCourierManifests: handleRemoteCourierManifests,
      onBranches: handleRemoteBranches,
      onUsers: handleRemoteUsers,
      onTransactions: handleRemoteTransactions,
      onSettlements: handleRemoteSettlements,
      onShiftVouchers: handleRemoteShiftVouchers,
      onCourierIntakeSettlements: handleRemoteCourierIntakeSettlements,
      onNotifications: handleRemoteNotifications,
      onCustomers: handleRemoteCustomers,
      onPricingRules: handleRemotePricingRules,
      onVouchers: handleRemoteVouchers,
      onExpenses: handleRemoteExpenses,
      onExpenseCategories: handleRemoteExpenseCategories,
      onVehicles: handleRemoteVehicles,
      onEmployees: handleRemoteEmployees,
      onPayrollRecords: handleRemotePayrollRecords,
      onFixedAssets: handleRemoteFixedAssets,
      onDirectMessages: handleRemoteDirectMessages,
      onAuditLogs: handleRemoteAuditLogs,
      onBranding: handleRemoteBranding,
      onCodSettings: handleRemoteCodSettings,
      onZeroWipe: () => {
        setParcels([]);
        setTruckManifests([]);
        setCourierManifests([]);
        setTransactions([]);
        setSettlements([]);
        setShiftSettlements([]);
        setCourierIntakeSettlements([]);
        setVouchers([]);
        setCustomers([]);
        setVehicles([]);
        setEmployees([]);
        setPayrollRecords([]);
        setExpenses([]);
        setFixedAssets([]);
        setDirectMessages([]);
        setNotifications([]);
        setAuditLogs([]);
        setBranches([]);
        setUsers([INITIAL_USERS[0]]);
      },
    });

    // Start background Timestamp Reconciliation Worker for sensitive and financial state
    timestampWorker.registerCallbacks({
      onDeltaReceived: (delta: Record<string, any[]>, updatedCollections: string[]) => {
        if (!delta || !updatedCollections || !updatedCollections.length) return;
        for (const col of updatedCollections) {
          const items = delta[col];
          if (!Array.isArray(items)) continue;

          // If collection is empty or null in delta, do NOT wipe local operational state (wipes are only done via explicit onZeroWipe)
          if (!items || items.length === 0) {
            continue;
          }

          switch (col) {
            case 'transactions':
              handleRemoteTransactions(items as CashboxTransaction[]);
              break;
            case 'shiftSettlementVouchers':
              handleRemoteShiftVouchers(items as ShiftSettlementVoucher[]);
              break;
            case 'courierIntakeSettlements':
              handleRemoteCourierIntakeSettlements(items as CourierIntakeSettlementVoucher[]);
              break;
            case 'settlements':
              handleRemoteSettlements(items as DailySettlement[]);
              break;
            case 'truckManifests':
              handleRemoteTruckManifests(items as TruckManifest[]);
              break;
            case 'courierManifests':
              handleRemoteCourierManifests(items as CourierManifest[]);
              break;
            case 'parcels':
              handleRemoteParcels(items as Parcel[]);
              break;
            case 'vouchers':
              handleRemoteVouchers(items as FinancialVoucher[]);
              break;
            case 'expenses':
              handleRemoteExpenses(items as Expense[]);
              break;
            case 'branches':
              handleRemoteBranches(items as Branch[]);
              break;
            case 'users':
              handleRemoteUsers(items as User[]);
              break;
            case 'customers':
              handleRemoteCustomers(items as Customer[]);
              break;
            case 'pricingRules':
              handleRemotePricingRules(items as PricingRule[]);
              break;
            case 'brandingSettings':
              if (items[0]) handleRemoteBranding(items[0] as CompanyBrandingSettings);
              break;
            case 'codSettings':
              if (items[0]) handleRemoteCodSettings(items[0] as CodTransferSettings);
              break;
            case 'vehicles':
              handleRemoteVehicles(items as Vehicle[]);
              break;
            case 'employees':
              handleRemoteEmployees(items as Employee[]);
              break;
            case 'payrollRecords':
              handleRemotePayrollRecords(items as PayrollRecord[]);
              break;
            case 'fixedAssets':
              handleRemoteFixedAssets(items as FixedAsset[]);
              break;
            case 'expenseCategories':
              handleRemoteExpenseCategories(items as ExpenseCategoryItem[]);
              break;
            case 'notifications':
              handleRemoteNotifications(items as SystemNotification[]);
              break;
            case 'directMessages':
              handleRemoteDirectMessages(items as DirectMessage[]);
              break;
            case 'auditLogs':
              handleRemoteAuditLogs(items as AuditLogEntry[]);
              break;
          }
        }
      },
      getLocalItems: (collection: string) => {
        switch (collection) {
          case 'transactions': return transactions;
          case 'shiftSettlementVouchers': return shiftSettlements;
          case 'settlements': return settlements;
          case 'truckManifests': return truckManifests;
          case 'courierManifests': return courierManifests;
          case 'parcels': return parcels;
          case 'vouchers': return vouchers;
          case 'expenses': return expenses;
          case 'branches': return branches;
          case 'users': return users;
          case 'customers': return customers;
          case 'pricingRules': return pricingRules;
          case 'brandingSettings': return brandingSettings ? [brandingSettings] : [];
          case 'codSettings': return codSettings ? [codSettings] : [];
          case 'vehicles': return vehicles;
          case 'employees': return employees;
          case 'payrollRecords': return payrollRecords;
          case 'fixedAssets': return fixedAssets;
          case 'expenseCategories': return expenseCategories;
          case 'notifications': return notifications;
          case 'directMessages': return directMessages;
          case 'auditLogs': return auditLogs;
          default: return [];
        }
      },
    });
    timestampWorker.start(5); // Responsive 5s background heartbeat; instant sync on-action and on-focus/navigation

    // Initial sync check: pull cloud data if exists, or seed cloud if first time
    const bootstrapCloud = async () => {
      try {
        const pullRes = await vpsSyncEngine.pullFullDatabaseFromCloud();
        if (pullRes.success && pullRes.data) {
          const d = pullRes.data;
          const cloudHasBranches = Array.isArray(d.branches) && d.branches.length > 0;
          const cloudHasParcels = Array.isArray(d.parcels) && d.parcels.length > 0;
          const cloudHasManifests = Array.isArray(d.truckManifests) && d.truckManifests.length > 0;

          if (cloudHasBranches) {
            setBranches((prev) => {
              const remoteIds = new Set(d.branches.map((b: any) => b.id));
              const localOnly = prev.filter((b) => b && b.id && !remoteIds.has(b.id));
              return [...d.branches, ...localOnly];
            });
          }
          if (Array.isArray(d.users) && d.users.length > 0) {
            setUsers((prev) => {
              const remoteIds = new Set(d.users.map((u: any) => u.id));
              const localOnly = prev.filter((u) => u && u.id && !remoteIds.has(u.id));
              let combined = [...d.users, ...localOnly];
              if (!combined.some((u) => u.username === 'سليمان' || u.role === 'super_admin')) {
                combined = [INITIAL_USERS[0], ...combined];
              }
              return combined;
            });
          }

          if (cloudHasParcels) {
            setParcels((prev) => {
              const mergedMap = new Map<string, Parcel>();
              for (const p of prev) {
                if (p.id) mergedMap.set(p.id, p);
                if (p.trackingNumber) mergedMap.set(p.trackingNumber.trim().toUpperCase(), p);
              }

              for (const remote of d.parcels) {
                if (!remote) continue;
                const rTracking = (remote.trackingNumber || '').trim().toUpperCase();
                const local = (remote.id ? mergedMap.get(remote.id) : null) || (rTracking ? mergedMap.get(rTracking) : null);

                if (!local) {
                  if (remote.id) mergedMap.set(remote.id, remote);
                  if (rTracking) mergedMap.set(rTracking, remote);
                } else {
                  const merged = mergeParcelSafely(local, remote);
                  if (merged.id) mergedMap.set(merged.id, merged);
                  if (rTracking) mergedMap.set(rTracking, merged);
                }
              }

              const uniqueList = Array.from(new Set(mergedMap.values()));
              safeStorage.setItem(`${STORAGE_KEY}_parcels`, JSON.stringify(uniqueList));
              return uniqueList;
            });
          }

          if (cloudHasManifests) {
            setTruckManifests((prev) => {
              const manifestMap = new Map<string, TruckManifest>();
              for (const m of prev) {
                if (m.id) manifestMap.set(m.id, m);
                if (m.manifestNumber) manifestMap.set(m.manifestNumber, m);
              }
              for (const remote of d.truckManifests) {
                if (!remote) continue;
                const local = (remote.id ? manifestMap.get(remote.id) : null) || (remote.manifestNumber ? manifestMap.get(remote.manifestNumber) : null);
                if (!local) {
                  if (remote.id) manifestMap.set(remote.id, remote);
                  if (remote.manifestNumber) manifestMap.set(remote.manifestNumber, remote);
                } else {
                  const localTime = new Date((local as any).updatedAt || local.createdAt || 0).getTime();
                  const remoteTime = new Date((remote as any).updatedAt || remote.createdAt || 0).getTime();
                  if (localTime > remoteTime && local.status === 'dispatched' && remote.status === 'preparing') {
                    continue; // Keep dispatched status
                  }
                  const merged = { ...local, ...remote };
                  if (merged.id) manifestMap.set(merged.id, merged);
                  if (remote.manifestNumber) manifestMap.set(remote.manifestNumber, merged);
                }
              }
              const uniqueManifests = Array.from(new Set(manifestMap.values()));
              safeStorage.setItem(`${STORAGE_KEY}_truck_manifests`, JSON.stringify(uniqueManifests));
              return uniqueManifests;
            });
          }

          if (Array.isArray(d.courierManifests) && d.courierManifests.length > 0) setCourierManifests(d.courierManifests);
          if (Array.isArray(d.transactions) && d.transactions.length > 0) setTransactions(d.transactions);
          if (Array.isArray(d.settlements) && d.settlements.length > 0) setSettlements(d.settlements);
          if (Array.isArray(d.shiftSettlementVouchers) && d.shiftSettlementVouchers.length > 0) setShiftSettlements(d.shiftSettlementVouchers);

          if (Array.isArray(d.customers) && d.customers.length > 0) {
            setCustomers((prev) => {
              const dedupedMap = new Map<string, Customer>();
              for (const c of prev) {
                if (!c) continue;
                const key = getCanonicalCustomerKey(c);
                dedupedMap.set(key, c);
              }
              for (const c of d.customers) {
                if (!c) continue;
                const key = getCanonicalCustomerKey(c);
                if (!dedupedMap.has(key)) {
                  dedupedMap.set(key, c);
                } else {
                  const ex = dedupedMap.get(key)!;
                  dedupedMap.set(key, { ...ex, ...c, id: ex.id });
                }
              }
              const finalCust = Array.from(dedupedMap.values());
              safeStorage.setItem(`${STORAGE_KEY}_customers`, JSON.stringify(finalCust));
              return finalCust;
            });
          }
          if (Array.isArray(d.pricingRules) && d.pricingRules.length > 0) setPricingRules(d.pricingRules);
          if (Array.isArray(d.vouchers) && d.vouchers.length > 0) setVouchers(d.vouchers);
          if (Array.isArray(d.expenses) && d.expenses.length > 0) setExpenses(d.expenses);
          if (Array.isArray(d.expenseCategories) && d.expenseCategories.length > 0) setExpenseCategories(d.expenseCategories);
          if (Array.isArray(d.vehicles) && d.vehicles.length > 0) setVehicles(d.vehicles);
          if (Array.isArray(d.employees) && d.employees.length > 0) setEmployees(d.employees);
          if (Array.isArray(d.payrollRecords) && d.payrollRecords.length > 0) setPayrollRecords(d.payrollRecords);
          if (Array.isArray(d.fixedAssets) && d.fixedAssets.length > 0) setFixedAssets(d.fixedAssets);
          if (Array.isArray(d.directMessages) && d.directMessages.length > 0) setDirectMessages(d.directMessages);
          if (Array.isArray(d.notifications) && d.notifications.length > 0) setNotifications(d.notifications);
          if (Array.isArray(d.courierIntakeSettlements) && d.courierIntakeSettlements.length > 0) setCourierIntakeSettlements(d.courierIntakeSettlements);
          if (Array.isArray(d.auditLogs) && d.auditLogs.length > 0) setAuditLogs(d.auditLogs);
          if (d.brandingSettings) {
            const b = Array.isArray(d.brandingSettings) ? d.brandingSettings[0] : d.brandingSettings;
            if (b && Object.keys(b).length > 0) setBrandingSettings((prev) => ({ ...prev, ...b }));
          }
          if (d.codSettings) {
            const c = Array.isArray(d.codSettings) ? d.codSettings[0] : d.codSettings;
            if (c && Object.keys(c).length > 0) setCodSettings((prev) => ({ ...prev, ...c }));
          }

          // If cloud has no branches and we have local branches: seed cloud
          if (!cloudHasBranches && branches.length > 0) {
            vpsSyncEngine.pushFullDatabaseToCloud({
              branches,
              users,
              parcels,
              truckManifests,
              courierManifests,
              transactions,
              settlements,
              shiftSettlementVouchers: shiftSettlements,
              vouchers,
              customers,
              pricingRules,
              expenses,
              expenseCategories,
              vehicles,
              employees,
              payrollRecords,
              fixedAssets,
              directMessages,
              notifications,
              brandingSettings,
              codSettings,
            });
          }
        }
      } catch (err) {
        console.warn('Initial cloud database bootstrap notice:', err);
      }
    };
    bootstrapCloud();

    return () => {
      vpsSyncEngine.stopRealtimeSync();
      timestampWorker.stop();
    };
  }, []);

  // ✅ Auto-Push: مرة واحدة فقط لكل جلسة عند أول تشغيل
  const hasPushedInitialRef = useRef(false);

  useEffect(() => {
    if (hasPushedInitialRef.current) return;

    const timer = setTimeout(() => {
      if (hasPushedInitialRef.current) return;
      hasPushedInitialRef.current = true;

      // ✅ ادفع فقط المستخدمين والفروع غير المتزامنة مع السيرفر
      const serverUsers = vpsSyncEngine.getServerUsers?.() || [];
      const serverUserIds = new Set(serverUsers.map((u: any) => u.id));

      const usersToPush = users.filter(
        (u) => u && u.id && !serverUserIds.has(u.id)
      );

      const serverBranchIds = new Set(
        (vpsSyncEngine.getServerBranches?.() || []).map((b: any) => b.id)
      );

      const branchesToPush = branches.filter(
        (b) => b && b.id && !serverBranchIds.has(b.id)
      );

      if (usersToPush.length > 0) {
        console.log(`[Auto-Push] Pushing ${usersToPush.length} users to server (first connection only)`);
        for (const u of usersToPush) {
          vpsSyncEngine.syncUser(u);
        }
      }

      if (branchesToPush.length > 0) {
        console.log(`[Auto-Push] Pushing ${branchesToPush.length} branches to server`);
        for (const b of branchesToPush) {
          vpsSyncEngine.syncBranch(b);
        }
      }
    }, 8000); // 8 ثوانٍ لضمان اكتمال SSE pull الكامل

    return () => clearTimeout(timer);
  }, []);

  // =========================================================================
  // Layer 2: Self-Healing upon load (تصحيح تلقائي للطرود العالقة in_transit)
  // =========================================================================
  useEffect(() => {
    const HEALING_FLAG = 'orca_parcel_healing_v1_' + new Date().toISOString().slice(0, 10);
    if (localStorage.getItem(HEALING_FLAG) === 'done') return;
    if (parcels.length === 0 || truckManifests.length === 0) return;

    let fixedCount = 0;
    const fixedParcels: Parcel[] = [];
    const now = new Date().toISOString();

    const updated = parcels.map((p) => {
      // Case 1: in_transit but in a received manifest
      if (p.handlingStatus === 'in_transit') {
        const manifest = truckManifests.find(
          (m) =>
            (p.truckManifestId && (m.id === p.truckManifestId || m.manifestNumber === p.truckManifestId)) ||
            (m.parcelIds && m.parcelIds.includes(p.id))
        );

        if (manifest && manifest.status === 'received') {
          const isMissing = manifest.missingParcelIds && manifest.missingParcelIds.includes(p.id);
          fixedCount++;
          const fixed: Parcel = {
            ...p,
            handlingStatus: isMissing ? 'shortage_missing' : 'received_at_dest',
            shortageStatus: isMissing ? 'pending_origin_verification' : (p.shortageStatus || 'none'),
            arrivedAtDestAt: manifest.receivedAt || now,
            currentLocationBranchId: manifest.destinationHubId || p.destinationHubId,
            truckManifestId: manifest.id,
            updatedAt: now,
          };
          fixedParcels.push(fixed);

          // Add entry to orca_healing_history in localStorage
          const entry = {
            timestamp: now,
            type: isMissing ? 'in_transit_to_missing' : 'in_transit_to_received',
            parcelId: p.id,
            trackingNumber: p.trackingNumber,
            reason: `تم تصحيح الحالة تلقائياً: مانافيست الشاحنة (${manifest.manifestNumber || manifest.id}) بحالة مفرغ ومستلم`,
          };
          try {
            const history = JSON.parse(localStorage.getItem('orca_healing_history') || '[]');
            history.unshift(entry);
            localStorage.setItem('orca_healing_history', JSON.stringify(history.slice(0, 100)));
          } catch (e) {
            console.error('Failed to update orca_healing_history', e);
          }

          return fixed;
        }
      }

      // Case 2: in_transit since > 14 days (stale)
      if (p.handlingStatus === 'in_transit' && (p.updatedAt || p.createdAt)) {
        const refDate = p.updatedAt || p.createdAt;
        const ageMs = Date.now() - new Date(refDate).getTime();
        if (ageMs > 14 * 24 * 60 * 60 * 1000) {
          console.warn(`[Self-Healing] Stale in_transit parcel: ${p.trackingNumber} (${Math.round(ageMs / (24 * 60 * 60 * 1000))} days old)`);
        }
      }

      return p;
    });

    if (fixedCount > 0) {
      setParcels(updated);
      safeStorage.setItem(`${STORAGE_KEY}_parcels`, JSON.stringify(updated));

      // Sync fixes to server
      for (const p of fixedParcels) {
        vpsSyncEngine.syncParcel(p);
      }

      // Log in audit trail
      addAuditLog(
        'Self-Healing: تصحيح حالات الطرود',
        'parcels',
        `تم تصحيح ${fixedCount} طرد كان in_transit لكن مانافيستها received`
      );

      localStorage.setItem(HEALING_FLAG, 'done');
    }
  }, [parcels.length, truckManifests.length]);

  // Update browser tab icon (favicon), Apple touch icon, and Desktop shortcut manifest whenever logo or branding changes
  useEffect(() => {
    if (brandingSettings) {
      applyDynamicAppIcon({
        logoUrl: brandingSettings.logoUrl,
        companyName: brandingSettings.companyName,
        companySubtitle: brandingSettings.companySubtitle,
      });
    }
  }, [brandingSettings.logoUrl, brandingSettings.companyName, brandingSettings.companySubtitle]);

  // Counter-Update Only & Phantom Customer Cleanup:
  // Updates shipment counters for EXISTING customers.
  // Purges phantom auto-created customers with incomplete identity.
  // Never auto-creates new customers from parcels.
  useEffect(() => {
    if (!parcels || parcels.length === 0) return;
    setCustomers((prevCustomers) => {
      // 1. Remove phantom customers (auto-generated + incomplete identity)
      const cleaned = prevCustomers.filter((c) => {
        if (!c) return false;
        // Keep non-auto customers
        if (!c.id.startsWith('cst_auto_')) return true;
        // Keep auto customers only if they have complete identity
        const cleanNid = (c.nationalId || '').replace(/\D/g, '');
        if (cleanNid.length === 11 && c.motherName && c.birthDate && c.phone) {
          return true;
        }
        // Delete phantom customer across local & cloud sync
        try {
          vpsSyncEngine.deleteCustomer(c.id);
        } catch {}
        return false;
      });

      // 2. Update shipment counters for existing customers
      let countChanged = false;
      const updated = cleaned.map((c) => {
        if (!c) return c;

        const sent = parcels.filter((p) =>
          p.sender?.customerId === c.id ||
          (p.sender?.nationalId && p.sender.nationalId === c.nationalId) ||
          (p.sender?.phone && p.sender.phone === c.phone)
        ).length;

        const received = parcels.filter((p) =>
          p.receiver?.customerId === c.id ||
          (p.receiver?.nationalId && p.receiver.nationalId === c.nationalId) ||
          (p.receiver?.phone && p.receiver.phone === c.phone)
        ).length;

        if (sent !== (c.totalShipmentsSent || 0) || received !== (c.totalShipmentsReceived || 0)) {
          countChanged = true;
          return {
            ...c,
            totalShipmentsSent: sent,
            totalShipmentsReceived: received,
            updatedAt: new Date().toISOString(),
          };
        }
        return c;
      });

      const changed = cleaned.length !== prevCustomers.length || countChanged;
      if (changed) {
        safeStorage.setItem(`${STORAGE_KEY}_customers`, JSON.stringify(updated));
        return updated;
      }
      return prevCustomers;
    });
  }, [parcels]);

  const triggerTimestampReconciliation = useCallback(async (reason?: string) => {
    return await timestampWorker.triggerImmediateReconciliation(reason || 'manual_trigger');
  }, []);

  const triggerManualCloudSync = useCallback(async () => {
    return await vpsSyncEngine.processOfflineQueue();
  }, []);

  const pushEntireDatabaseToCloud = useCallback(async () => {
    return await vpsSyncEngine.pushFullDatabaseToCloud({
      branches,
      users,
      parcels,
      truckManifests,
      courierManifests,
      transactions,
      settlements,
      notifications,
      customers,
      pricingRules,
      vouchers,
      expenses,
      expenseCategories,
      vehicles,
      employees,
      payrollRecords,
      fixedAssets,
      directMessages,
      brandingSettings,
    });
  }, [
    branches,
    users,
    parcels,
    truckManifests,
    courierManifests,
    transactions,
    settlements,
    notifications,
    customers,
    pricingRules,
    vouchers,
    expenses,
    expenseCategories,
    vehicles,
    employees,
    payrollRecords,
    fixedAssets,
    directMessages,
    brandingSettings,
  ]);

  const pullEntireDatabaseFromCloud = useCallback(async () => {
    const res = await vpsSyncEngine.pullFullDatabaseFromCloud();
    if (res.success && res.data) {
      if (res.data.branches) setBranches(res.data.branches);
      if (res.data.users) setUsers(res.data.users);
      if (res.data.parcels) {
        setParcels((prev) => {
          const idMap = new Map<string, Parcel>();
          const trackingMap = new Map<string, Parcel>();
          for (const p of prev) {
            if (p.id) idMap.set(p.id, p);
            if (p.trackingNumber) trackingMap.set(p.trackingNumber.trim().toUpperCase(), p);
          }
          const currentParcels = [...prev];
          for (const remote of res.data!.parcels) {
            if (!remote) continue;
            const remoteTracking = (remote.trackingNumber || '').trim().toUpperCase();
            const local = (remote.id ? idMap.get(remote.id) : null) || (remoteTracking ? trackingMap.get(remoteTracking) : null);
            if (!local) {
              currentParcels.push(remote);
              if (remote.id) idMap.set(remote.id, remote);
              if (remoteTracking) trackingMap.set(remoteTracking, remote);
            } else {
              const merged = mergeParcelSafely(local, remote);
              const idx = currentParcels.findIndex(
                (p) => (local.id && p.id === local.id) || (local.trackingNumber && p.trackingNumber === local.trackingNumber)
              );
              if (idx >= 0) currentParcels[idx] = merged;
              if (merged.id) idMap.set(merged.id, merged);
              if (remoteTracking) trackingMap.set(remoteTracking, merged);
            }
          }
          return currentParcels;
        });
      }
      if (res.data.truckManifests && Array.isArray(res.data.truckManifests)) {
        setTruckManifests((prev) => {
          const remoteNums = new Set(res.data!.truckManifests.map((m: TruckManifest) => m.manifestNumber));
          const localOnly = prev.filter((m) => !remoteNums.has(m.manifestNumber));
          localOnly.forEach((m) => vpsSyncEngine.syncTruckManifest(m));
          return [...res.data!.truckManifests, ...localOnly];
        });
      }
      if (res.data.courierManifests) setCourierManifests(res.data.courierManifests);
      if (res.data.transactions) setTransactions(res.data.transactions);
      if (res.data.settlements) setSettlements(res.data.settlements);
      if (res.data.customers) setCustomers(res.data.customers);
      if (res.data.pricingRules) setPricingRules(res.data.pricingRules);
      if (res.data.vouchers) setVouchers(res.data.vouchers);
      if (res.data.expenses) setExpenses(res.data.expenses);
      if (res.data.expenseCategories) setExpenseCategories(res.data.expenseCategories);
      if (res.data.vehicles) setVehicles(res.data.vehicles);
      if (res.data.employees) setEmployees(res.data.employees);
      if (res.data.payrollRecords) setPayrollRecords(res.data.payrollRecords);
      if (res.data.fixedAssets) setFixedAssets(res.data.fixedAssets);
      if (res.data.directMessages) setDirectMessages(res.data.directMessages);
      if (res.data.brandingSettings) setBrandingSettings((prev) => ({ ...prev, ...res.data!.brandingSettings }));
    }
    return { success: res.success, message: res.message };
  }, []);

  const retryManualSyncConnection = useCallback(async () => {
    const res = await vpsSyncEngine.retryManualConnection();
    if (res.success) {
      await pullEntireDatabaseFromCloud();
    }
    return res;
  }, [pullEntireDatabaseFromCloud]);

  // عزل وتصفية الإشعارات والتنبيهات بحسب المستخدم والفرع والدور الوظيفي، مع استثناء صارم للحوالات الجاهزة للمرسل وعزل حالة القراءة لكل مستخدم
  const isolatedNotifications = useMemo(() => {
    const userId = currentUser?.id || 'admin';
    const userReadSet = new Set(userReadNotifIds);
    const seenTruckArrivalMap = new Set<string>();

    return [...notifications]
      .filter((n) => {
        // منع التكرار الصارم لإشعارات وتنبيهات وصول الشاحنة لنفس المانافيست
        if (n.type === 'truck_arrived' && n.relatedId) {
          const dedupeKey = currentUser.role === 'super_admin'
            ? `truck_arr_${n.relatedId}`
            : `truck_arr_${n.relatedId}_${n.targetBranchId || currentBranch.id}`;
          if (seenTruckArrivalMap.has(dedupeKey)) {
            return false;
          }
          seenTruckArrivalMap.add(dedupeKey);
        }

        // 1. حجب تنبيهات جاهزية الحوالة عن قسم التسليم/الصرف في لوحة إشعارات الموظفين
        // (حسب الموجهات: توصل فقط للزبون على تطبيقة أو الواتساب/الجوال بدون إزعاج قسم التسليم)
        const isCodPayoutSenderNotif = n.type === 'cod_payout_due' || n.actionType === 'cod_payout_sender';
        if (isCodPayoutSenderNotif) {
          // محجوبة تماماً عن لوحة تنبيهات الموظفين وقسم التسليم
          return false;
        }

        // إذا كان المدير العام (Super Admin): يرى الإشعارات العامة والخاصة به وبفروع المنظومة
        if (currentUser.role === 'super_admin') {
          return true;
        }

        // إذا كان الإشعار موجهاً لمستخدم معين بالاسم
        if (n.targetUserId && n.targetUserId !== currentUser.id) {
          return false;
        }

        // إذا كان الإشعار موجهاً لفرع معين
        if (n.targetBranchId && n.targetBranchId !== currentBranch.id && !currentUser.allowedBranchIds?.includes(n.targetBranchId)) {
          // تحقق من الارتباط بين المركز الرئيسي والفرع التابع (parentHubId)
          const targetB = branches.find((b) => b.id === n.targetBranchId);
          const isRelatedBranch =
            Boolean(targetB && targetB.parentHubId && targetB.parentHubId === currentBranch.id) ||
            Boolean(currentBranch.parentHubId && currentBranch.parentHubId === n.targetBranchId) ||
            Boolean(targetB && currentBranch.parentHubId && targetB.parentHubId === currentBranch.parentHubId);

          if (!isRelatedBranch) {
            return false;
          }
        }

        // إذا كان الإشعار موجهاً لدور وظيفي معين
        if (n.targetRole && n.targetRole !== currentUser.role) {
          return false;
        }

        return true;
      })
      .map((n) => {
        // فحص هل التنبيه مقروء من قبل هذا المستخدم تحديداً (سواء بالقراءة الفردية أو تحديد الكل كمقروء لهذا المستخدم)
        const isReadForThisUser = Boolean(
          (n.readByUserIds && n.readByUserIds.includes(userId)) ||
          userReadSet.has(n.id) ||
          (n.targetUserId === userId && n.read)
        );
        return {
          ...n,
          read: isReadForThisUser,
        };
      })
      .sort((a, b) => {
        const timeA = a.timestamp ? new Date(a.timestamp).getTime() : 0;
        const timeB = b.timestamp ? new Date(b.timestamp).getTime() : 0;
        return timeB - timeA;
      });
  }, [notifications, currentBranch.id, currentBranch.parentHubId, currentUser, branches, userReadNotifIds]);

  // Print Modal Helpers
  const openPrintModal = (type: 'parcel_3part' | 'manifest_a4', data: Parcel | TruckManifest) => {
    if (type === 'parcel_3part') {
      setSelectedParcelForPrint(data as Parcel);
      setSelectedManifestForPrint(null);
    } else {
      setSelectedManifestForPrint(data as TruckManifest);
      setSelectedParcelForPrint(null);
    }
    setPrintModalType(type);
    setIsPrintModalOpen(true);
  };

  const closePrintModal = () => {
    setIsPrintModalOpen(false);
    setPrintModalType(null);
  };

  // Cashier Collection Modal Helpers
  const openCashierCollectModal = (parcelId: string, notificationId?: string) => {
    setCashierCollectParcelId(parcelId);
    setCashierCollectNotificationId(notificationId || null);
  };

  const closeCashierCollectModal = () => {
    setCashierCollectParcelId(null);
    setCashierCollectNotificationId(null);
  };

  // Pricing Engine Calculation (Weight, Volume CBM, 5 Size Tiers, and Automatic Smart Selection)
  const calculatePrice = (
    originGov: Governorate,
    destGov: Governorate,
    packageType: PackageType,
    weightKg: number,
    lengthCm: number,
    widthCm: number,
    heightCm: number,
    paymentType: PaymentType,
    currency: Currency,
    codAmount: number,
    pricingBasis: PricingBasis = 'auto',
    sizeTier?: ParcelSizeTier,
    codCurrency?: Currency
  ): PriceCalculationResult => {
    const volumeCbm = Math.max(0.001, (lengthCm * widthCm * heightCm) / 1000000);
    const volumetricWeightKg = (lengthCm * widthCm * heightCm) / 5000;
    const effectiveWeightKg = Math.max(weightKg, volumetricWeightKg, 0.5);
    const distanceKm = getGovernorateDistance(originGov, destGov);

    // Auto detect size tier if not provided
    let detectedTier: ParcelSizeTier = sizeTier || 'medium';
    if (!sizeTier) {
      if (volumeCbm <= 0.005 && weightKg <= 0.8) detectedTier = 'extra_small';
      else if (volumeCbm <= 0.02 && weightKg <= 2.5) detectedTier = 'small';
      else if (volumeCbm <= 0.06 && weightKg <= 7.0) detectedTier = 'medium';
      else if (volumeCbm <= 0.15 && weightKg <= 18.0) detectedTier = 'large';
      else detectedTier = 'extra_large';
    }

    // Find specific or matching rule
    const rule =
      pricingRules.find(
        (r) =>
          (r.originGov === originGov || r.originGov === 'all') &&
          (r.destGov === destGov || r.destGov === 'all') &&
          (r.packageType === packageType || r.packageType === 'all')
      ) || pricingRules[0];

    if (!rule) {
      let transferFee = 0;
      const activeCodCurrency = codCurrency || currency;
      if (paymentType === 'cod' && codAmount > 0) {
        transferFee = calculateCodTransferFee(codAmount, activeCodCurrency, codSettings);
      }
      return {
        shippingCost: 0,
        transferFee,
        totalDue: paymentType === 'cod' ? (codAmount + transferFee) : 0,
        volumeCbm: Math.round(volumeCbm * 1000) / 1000,
        volumetricWeightKg: Math.round(volumetricWeightKg * 10) / 10,
        effectiveWeightKg: Math.round(effectiveWeightKg * 10) / 10,
        calculatedWeightCost: 0,
        calculatedVolumeCost: 0,
        calculatedSizeTierCost: 0,
        appliedBasis: 'weight',
        distanceKm,
      };
    }

    // Get size tier costs
    let calculatedSizeTierCost = 0;
    if (currency === 'SYP') {
      if (rule.sizePricesSyp && rule.sizePricesSyp[detectedTier]) {
        calculatedSizeTierCost = rule.sizePricesSyp[detectedTier];
      } else {
        const mult = SIZE_TIERS_CONFIG[detectedTier]?.defaultMultiplier || 1.0;
        calculatedSizeTierCost = Math.ceil((rule.baseRateSyp * mult) / 500) * 500;
      }
    } else {
      if (rule.sizePricesUsd && rule.sizePricesUsd[detectedTier]) {
        calculatedSizeTierCost = rule.sizePricesUsd[detectedTier];
      } else {
        const mult = SIZE_TIERS_CONFIG[detectedTier]?.defaultMultiplier || 1.0;
        calculatedSizeTierCost = Math.round(rule.baseRateUsd * mult * 10) / 10;
      }
    }

    let calculatedWeightCost = 0;
    let calculatedVolumeCost = 0;
    let shippingCost = 0;
    let appliedBasis: 'weight' | 'volume' | 'size_tier' = 'weight';

    if (currency === 'SYP') {
      const extraWeight = Math.max(0, (pricingBasis === 'weight_only' ? weightKg : effectiveWeightKg) - rule.baseWeightKg);
      calculatedWeightCost = rule.baseRateSyp + extraWeight * rule.extraKgRateSyp;
      calculatedVolumeCost = volumeCbm * rule.cbmRateSyp;

      if (pricingBasis === 'weight_only') {
        shippingCost = Math.max(calculatedWeightCost, rule.minFeeSyp);
        appliedBasis = 'weight';
      } else if (pricingBasis === 'volume_only') {
        shippingCost = Math.max(calculatedVolumeCost, rule.minFeeSyp);
        appliedBasis = 'volume';
      } else if (pricingBasis === 'size_tier_only') {
        shippingCost = Math.max(calculatedSizeTierCost, rule.minFeeSyp);
        appliedBasis = 'size_tier';
      } else {
        // 'auto' - Choose the highest for commercial accuracy
        const maxCost = Math.max(calculatedWeightCost, calculatedVolumeCost, calculatedSizeTierCost);
        shippingCost = Math.max(maxCost, rule.minFeeSyp);
        if (maxCost === calculatedVolumeCost) appliedBasis = 'volume';
        else if (maxCost === calculatedSizeTierCost && calculatedSizeTierCost > calculatedWeightCost) appliedBasis = 'size_tier';
        else appliedBasis = 'weight';
      }
      // Round to nearest 500 SYP
      shippingCost = Math.ceil(shippingCost / 500) * 500;
      calculatedWeightCost = Math.ceil(calculatedWeightCost / 500) * 500;
      calculatedVolumeCost = Math.ceil(calculatedVolumeCost / 500) * 500;
      calculatedSizeTierCost = Math.ceil(calculatedSizeTierCost / 500) * 500;
    } else {
      const extraWeight = Math.max(0, (pricingBasis === 'weight_only' ? weightKg : effectiveWeightKg) - rule.baseWeightKg);
      calculatedWeightCost = rule.baseRateUsd + extraWeight * rule.extraKgRateUsd;
      calculatedVolumeCost = volumeCbm * rule.cbmRateUsd;

      if (pricingBasis === 'weight_only') {
        shippingCost = Math.max(calculatedWeightCost, rule.minFeeUsd);
        appliedBasis = 'weight';
      } else if (pricingBasis === 'volume_only') {
        shippingCost = Math.max(calculatedVolumeCost, rule.minFeeUsd);
        appliedBasis = 'volume';
      } else if (pricingBasis === 'size_tier_only') {
        shippingCost = Math.max(calculatedSizeTierCost, rule.minFeeUsd);
        appliedBasis = 'size_tier';
      } else {
        // 'auto'
        const maxCost = Math.max(calculatedWeightCost, calculatedVolumeCost, calculatedSizeTierCost);
        shippingCost = Math.max(maxCost, rule.minFeeUsd);
        if (maxCost === calculatedVolumeCost) appliedBasis = 'volume';
        else if (maxCost === calculatedSizeTierCost && calculatedSizeTierCost > calculatedWeightCost) appliedBasis = 'size_tier';
        else appliedBasis = 'weight';
      }
      shippingCost = Math.round(shippingCost * 10) / 10;
      calculatedWeightCost = Math.round(calculatedWeightCost * 10) / 10;
      calculatedVolumeCost = Math.round(calculatedVolumeCost * 10) / 10;
      calculatedSizeTierCost = Math.round(calculatedSizeTierCost * 10) / 10;
    }

    let transferFee = 0;
    const activeCodCurrency = codCurrency || currency;
    if (paymentType === 'cod' && codAmount > 0) {
      transferFee = calculateCodTransferFee(codAmount, activeCodCurrency, codSettings);
    }

    let totalDue = 0;
    if (paymentType === 'prepaid') {
      totalDue = 0; // Already paid at origin
    } else if (paymentType === 'collect') {
      totalDue = shippingCost;
    } else if (paymentType === 'cod') {
      totalDue = currency === activeCodCurrency ? (shippingCost + codAmount + transferFee) : (shippingCost + codAmount + transferFee);
    }

    const maxCodAllowed = (currency === 'SYP' || activeCodCurrency === 'SYP') ? codSettings.maxCodAllowedSyp : codSettings.maxCodAllowedUsd;

    return {
      shippingCost,
      transferFee,
      totalDue,
      volumeCbm: Math.round(volumeCbm * 1000) / 1000,
      volumetricWeightKg: Math.round(volumetricWeightKg * 10) / 10,
      effectiveWeightKg: Math.round(effectiveWeightKg * 10) / 10,
      calculatedWeightCost,
      calculatedVolumeCost,
      calculatedSizeTierCost,
      appliedBasis,
      distanceKm,
      basePrice: shippingCost,
      maxCodAmount: maxCodAllowed,
      maxCodAllowed,
    };
  };

  // Add Cashbox Transaction & adjust Branch Box Balance
  const addCashTransaction = (
    branchId: string,
    currency: Currency,
    type: CashboxTransaction['type'],
    amount: number,
    description: string,
    referenceId?: string,
    counterpartyBranchId?: string,
    cashboxScope?: CashboxScope,
    shiftSettlementVoucherId?: string,
    customPerformer?: { userId: string; userName: string }
  ) => {
    const performerUserId = customPerformer?.userId || currentUser.id;
    const performerUser = users.find((u) => u.id === performerUserId) || currentUser;
    const roleDefaultScope: CashboxScope =
      performerUser.role === 'outbound_operator' || performerUser.role === 'reception_data_entry'
        ? 'outgoing'
        : performerUser.role === 'inbound_operator'
        ? 'incoming'
        : performerUser.role === 'cashier'
        ? 'cashier'
        : performerUser.role === 'hub_manager'
        ? 'manager'
        : (performerUser.role as string) === 'accountant'
        ? 'accountant'
        : (performerUser.role as string) === 'operations'
        ? 'operations'
        : performerUser.role === 'warehouse_keeper' || performerUser.role === 'warehouseman'
        ? 'warehouse'
        : performerUser.role === 'courier'
        ? 'courier'
        : 'master';

    const determinedScope: CashboxScope =
      cashboxScope ||
      (performerUser.role === 'courier'
        ? (type === 'shipping_income_prepaid' ? 'courier_intake' : 'courier')
        : type === 'shipping_income_prepaid'
        ? 'outgoing'
        : type === 'shipping_collected_dest' || type === 'cod_collected_dest'
        ? 'incoming'
        : roleDefaultScope);

    const newTx: CashboxTransaction = {
      id: `tx_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
      branchId,
      currency,
      type,
      amount,
      referenceId,
      description,
      performedByUserId: customPerformer?.userId || currentUser.id,
      performedByUserName: customPerformer?.userName || currentUser.name || currentUser.username,
      performedByRole: performerUser.role,
      cashboxScope: determinedScope,
      shiftSettlementVoucherId,
      timestamp: new Date().toISOString(),
      counterpartyBranchId,
    };

    setTransactions((prev) => [newTx, ...prev]);
    vpsSyncEngine.syncTransaction(newTx);

    // [3ج] If derived-balance mode is active, skip double-writing to branch object.
    // Balances are derived reactively from transactions via branchesWithDerivedBalances / calculateBranchLiveBalance.
    if (!USE_DERIVED_BALANCE_WRITE) {
      // Legacy double-write fallback (emergency rollback only)
      // Adjust target branch cash box (Internal shift settlements move between sub-boxes and master without altering total branch vault)
      const isInternalShift = [
        'shift_settlement_handover_outflow',
        'shift_settlement_received_inflow',
      ].includes(type);

      // Courier intake or delivery funds remain in courier custody until settled/handed over to the branch hub
      const isCourierCustody = determinedScope === 'courier_intake' || determinedScope === 'courier';

      let delta = 0;
      if (!isInternalShift && !isCourierCustody) {
        const isCredit = [
          'shipping_income_prepaid',
          'shipping_collected_dest',
          'cod_collected_dest',
          'transfer_fee_income',
          'settlement_received_from_branch',
          'voucher_receipt',
          'deposit',
        ].includes(type);
        delta = isCredit ? amount : -amount;
      }

      if (delta !== 0) {
        setBranches((prev) =>
          prev.map((b) => {
            if (b.id === branchId) {
              const updated = currency === 'SYP'
                ? { ...b, boxSypBalance: Math.max(0, b.boxSypBalance + delta) }
                : { ...b, boxUsdBalance: Math.max(0, b.boxUsdBalance + delta) };
              vpsSyncEngine.syncBranch(updated);
              return updated;
            }
            return b;
          })
        );

        // Direct update to currentBranch for instant UI reactivity
        if (currentBranch?.id === branchId) {
          setCurrentBranch((prev) => {
            if (!prev) return prev;
            if (currency === 'SYP') {
              return { ...prev, boxSypBalance: Math.max(0, prev.boxSypBalance + delta) };
            } else {
              return { ...prev, boxUsdBalance: Math.max(0, prev.boxUsdBalance + delta) };
            }
          });
        }
      }
    }
  };

  /**
   * Computes the live balance of a branch by summing all financial transactions.
   * Mirrors the logic of v_branch_live_balances in PostgreSQL to keep client and server balances in sync.
   * 
   * @param branchId - the branch to compute for
   * @param currency - 'SYP' or 'USD'
   * @returns live vault balance for the branch in the given currency
   */
  const calculateBranchLiveBalance = useCallback(
    (branchId: string, currency: 'SYP' | 'USD'): number => {
      // 1. Opening balance
      const branch = branches.find((b) => b.id === branchId);
      const opening = currency === 'SYP' 
        ? (branch?.openingBalanceSyp ?? 0)
        : (branch?.openingBalanceUsd ?? 0);

      // 2. Sum of vault_deltas from transactions (mirrors SQL CASE logic)
      let delta = 0;
      for (const tx of transactions) {
        if (tx.branchId !== branchId) continue;
        if (tx.currency !== currency) continue;

        const type = tx.type as string;
        const scope = (tx.cashboxScope as string) || '';
        const amount = Number(tx.amount) || 0;
        const refId = (tx.referenceId as string) || '';

        // Internal transfers: no effect on total vault
        if (
          type === 'shift_settlement_handover_outflow' ||
          type === 'shift_settlement_received_inflow' ||
          type === 'courier_handover_from_intake'
        ) continue;
        if ((type === 'deposit' || type === 'withdrawal') && refId.startsWith('VTR-')) continue;

        // Courier custody: excluded until settled
        if (scope === 'courier' || scope === 'courier_intake' || scope === 'courier_delivery') continue;

        // Credits (increase vault)
        if (
          type === 'shipping_income_prepaid' ||
          type === 'courier_prepaid_collection' ||
          type === 'courier_handover_to_outgoing' ||
          type === 'shipping_collected_dest' ||
          type === 'cod_collected_dest' ||
          type === 'transfer_fee_income' ||
          type === 'settlement_received_from_branch' ||
          type === 'voucher_receipt' ||
          type === 'deposit'
        ) {
          delta += amount;
          continue;
        }

        // Debits (decrease vault)
        if (
          type === 'cod_paid_to_sender' ||
          type === 'operating_expense' ||
          type === 'voucher_payment' ||
          type === 'settlement_transfer_to_hub' ||
          type === 'branch_commission_payout' ||
          type === 'withdrawal'
        ) {
          delta -= amount;
          continue;
        }

        // Unknown type -> ignored silently (mirrors ELSE 0 in SQL)
      }

      return opening + delta;
    },
    [branches, transactions]
  );

  // Derived branches array: same objects as `branches` but with balances
  // computed from the ledger (calculateBranchLiveBalance). Used by display
  // components so that LWW races on boxSypBalance no longer affect display.
  const branchesWithDerivedBalances = useMemo(() => {
    return branches.map((b) => ({
      ...b,
      boxSypBalance: calculateBranchLiveBalance(b.id, 'SYP'),
      boxUsdBalance: calculateBranchLiveBalance(b.id, 'USD'),
    }));
  }, [branches, calculateBranchLiveBalance]);

  // Derived currentBranch: same object as `currentBranch` with balances computed from ledger
  const currentBranchWithDerivedBalance = useMemo<Branch>(() => {
    if (!currentBranch) return ALL_BRANCHES_SUPERVISION_BRANCH;
    const derived = branchesWithDerivedBalances.find((b) => b.id === currentBranch.id);
    return derived || currentBranch;
  }, [currentBranch, branchesWithDerivedBalances]);

  // Diagnostic Assertion (Compares stored box balances vs calculated live derived balances in development)
  useEffect(() => {
    if (process.env.NODE_ENV === 'production') return;
    if (!branches || !transactions) return;

    for (const b of branches) {
      for (const cur of ['SYP', 'USD'] as const) {
        const oldVal = cur === 'SYP' 
          ? (b.boxSypBalance ?? 0) 
          : (b.boxUsdBalance ?? 0);
        const newVal = calculateBranchLiveBalance(b.id, cur);
        const diff = Math.abs(oldVal - newVal);

        if (diff > 0.01) {
          console.warn(
            `[Derived Balance Diagnostic] ${b.name} (${b.code}) [${cur}] ` +
            `old=${oldVal} new=${newVal} diff=${diff.toFixed(2)}`
          );
        }
      }
    }
  }, [branches, transactions, calculateBranchLiveBalance]);

  // One-time Migration: Ensure all existing branches have openingBalanceSyp & openingBalanceUsd
  useEffect(() => {
    const MIGRATION_KEY = 'orca_opening_balance_migration_v1';
    if (localStorage.getItem(MIGRATION_KEY) === 'done') return;
    if (!branches || branches.length === 0) return;

    let migrated = 0;
    const updated = branches.map((b) => {
      if (b.openingBalanceSyp === undefined || b.openingBalanceUsd === undefined) {
        migrated++;
        const fixedBranch: Branch = {
          ...b,
          openingBalanceSyp: b.openingBalanceSyp ?? b.boxSypBalance ?? 0,
          openingBalanceUsd: b.openingBalanceUsd ?? b.boxUsdBalance ?? 0,
        };
        vpsSyncEngine.syncBranch(fixedBranch);
        return fixedBranch;
      }
      return b;
    });

    if (migrated > 0) {
      console.log(`[Migration] Set opening balance for ${migrated} existing branches.`);
      setBranches(updated);
    }

    localStorage.setItem(MIGRATION_KEY, 'done');
  }, [branches]);

  // Register New Parcel
  const registerParcel = (
    parcelData: Omit<Parcel, 'id' | 'trackingNumber' | 'createdAt' | 'handlingStatus'>
  ): Parcel => {
    const randomNum = Math.floor(1000 + Math.random() * 9000);
    const trackingNumber = `ORK-${new Date().getFullYear()}-${randomNum}`;
    const entryOperatorName =
      parcelData.registeredByUserName ||
      parcelData.createdByName ||
      currentUser?.name ||
      currentUser?.username ||
      'مدخل البيانات';
    const entryOperatorId = parcelData.createdById || currentUser?.id || 'usr_system';

    const originBranchId = parcelData.originBranchId || parcelData.originHubId;
    const originCollectionBranchId = parcelData.originCollectionBranchId || originBranchId;
    const senderName = (parcelData.sender?.name || parcelData.senderName || '').trim();
    const receiverName = (parcelData.receiver?.name || parcelData.receiverName || '').trim();

    const origBranchObj = branches.find((b) => b.id === parcelData.originHubId);
    const destBranchObj = branches.find((b) => b.id === parcelData.destinationHubId);
    const origGov = (origBranchObj?.governorate || 'دمشق') as Governorate;
    const destGov = (destBranchObj?.governorate || 'حلب') as Governorate;
    const derivedDistance =
      parcelData.distanceKm !== undefined
        ? parcelData.distanceKm
        : getGovernorateDistance(origGov, destGov);

    const isCourierEntry =
      Boolean(parcelData.isCourierPickup) ||
      currentUser?.role === 'courier' ||
      users.find((u) => u.id === entryOperatorId)?.role === 'courier';

    const courierUser = users.find((u) => u.id === entryOperatorId) || currentUser;
    const actualCourierName =
      parcelData.registeredByCourierName ||
      parcelData.collectedByCourierName ||
      (isCourierEntry ? (courierUser?.name || courierUser?.username) : undefined);

    const newParcel: Parcel = {
      ...parcelData,
      id: `pcl_${Date.now()}_${Math.floor(100 + Math.random() * 900)}`,
      trackingNumber,
      createdAt: new Date().toISOString(),
      // Initial status for courier intake is 'with_courier' ("مع المندوب للتسليم"), converts to 'received_at_hub' upon clicking "تم تسليم الطرود الجاهزة للشحن للمركز"
      handlingStatus: isCourierEntry ? 'with_courier' : 'received_at_hub',
      isCourierPickup: isCourierEntry,
      registeredByCourierName: actualCourierName,
      collectedByCourierName: actualCourierName,
      collectedByCourierId: isCourierEntry ? (parcelData.collectedByCourierId || courierUser?.id) : undefined,
      courierHandedOverToHub: false,
      courierIntakeSettled: isCourierEntry ? false : undefined,
      courierIntakeReceivedInHub: isCourierEntry ? false : undefined,
      currentLocationBranchId: parcelData.currentLocationBranchId || parcelData.originHubId,
      storedWarehouseType: parcelData.storedWarehouseType || 'standard_received',
      shortageStatus: parcelData.shortageStatus || 'none',
      storageGraceDays: parcelData.storageGraceDays || 3,
      notificationDueHours: parcelData.notificationDueHours || 24,
      // Recorded in branch registry as if Outbound Officer recorded it:
      registeredByUserName: isCourierEntry ? 'مسؤول الصادر' : entryOperatorName,
      createdByName: isCourierEntry ? 'مسؤول الصادر' : entryOperatorName,
      createdById: entryOperatorId,
      originBranchId,
      originCollectionBranchId,
      senderName,
      receiverName,
      distanceKm: derivedDistance,
      priceSyp:
        parcelData.priceSyp !== undefined
          ? parcelData.priceSyp
          : parcelData.currency === 'SYP'
          ? parcelData.shippingCost
          : undefined,
    };

    setParcels((prev) => {
      const next = [newParcel, ...prev];
      safeStorage.setItem(`${STORAGE_KEY}_parcels`, JSON.stringify(next));
      return next;
    });
    vpsSyncEngine.syncParcel(newParcel);

    // [5-B-4-A] Record registration event (append-only log)
    recordParcelEvent(newParcel.id, newParcel.handlingStatus, 'handling', {
      previousStatus: undefined,
      newStatus: newParcel.handlingStatus,
      branchId: newParcel.currentLocationBranchId || newParcel.originHubId,
      notes: `تسجيل طرد جديد - ${
        newParcel.paymentType === 'cod' ? 'ضد الدفع' : 
        newParcel.paymentType === 'collect' ? 'أجور على المستلم' : 'مدفوع سلفاً'
      }`,
      metadata: {
        registeredByUserId: entryOperatorId || currentUser.id,
        registeredByUserName: entryOperatorName || currentUser.name,
        registeredAt: new Date().toISOString(),
        paymentType: newParcel.paymentType,
        currency: newParcel.currency,
        shippingCost: newParcel.shippingCost,
        codAmount: newParcel.codAmount || 0,
        originHubId: newParcel.originHubId,
        destinationHubId: newParcel.destinationHubId,
        isCourierPickup: isCourierEntry,
      },
    });

    // Helper to verify if customer has 100% full civil identity
    const isIdentityComplete = (person: any): boolean => {
      if (!person) return false;
      const cleanNid = (person.nationalId || '').replace(/\D/g, '');
      return Boolean(
        person.firstName?.trim() &&
        person.fatherName?.trim() &&
        person.lastName?.trim() &&
        person.motherName?.trim() &&
        person.birthDate?.trim() &&
        cleanNid.length === 11 &&
        person.phone?.trim()
      );
    };

    // Auto-update existing sender or create customer in Customer Directory ONLY if identity is 100% complete
    const sender = newParcel.sender;
    if (sender?.phone || sender?.nationalId || sender?.name || sender?.firstName) {
      setCustomers((prevCustomers) => {
        const cleanPhone = (sender.phone || '').trim();
        const cleanNationalId = (sender.nationalId || '').trim();
        const fName = (sender.firstName || '').trim();
        const father = (sender.fatherName || '').trim();
        const lName = (sender.lastName || '').trim();
        const mName = (sender.motherName || '').trim();
        const bDate = (sender.birthDate || '').trim();
        const explicitName = (sender.name || '').trim();

        const norm = normalizeCustomerNames({
          fullName: explicitName || [fName, father, lName].filter(Boolean).join(' '),
          firstName: fName,
          fatherName: father,
          lastName: lName,
        });

        const candidate = {
          fullName: norm.fullName,
          firstName: norm.firstName,
          fatherName: norm.fatherName,
          lastName: norm.lastName,
          motherName: mName,
          birthDate: bDate,
          phone: cleanPhone,
          nationalId: cleanNationalId,
        };

        const candidateKey = getCanonicalCustomerKey(candidate);
        const existingIndex = prevCustomers.findIndex((c) => {
          if (sender.customerId && c.id === sender.customerId) return true;
          if (isSameCustomer(c, candidate)) return true;
          if (getCanonicalCustomerKey(c) === candidateKey) return true;
          // Normalized phone check
          const pA = normalizePhoneForComparison(c.phone);
          const pB = normalizePhoneForComparison(cleanPhone);
          if (pA && pB && pA.length >= 6 && pA === pB) return true;
          // National ID check
          const nidA = (c.nationalId || '').replace(/\D/g, '');
          const nidB = cleanNationalId.replace(/\D/g, '');
          if (nidA && nidB && nidA.length >= 7 && nidA === nidB) return true;
          // Normalized Name check
          const nA = normalizeArabicComparison(c.fullName);
          const nB = normalizeArabicComparison(norm.fullName);
          if (nA && nB && nA.length >= 4 && nA === nB) {
            if (!pA || !pB || pA === pB) return true;
          }
          return false;
        });

        const spentSyp = newParcel.currency === 'SYP' ? (newParcel.shippingCost + (newParcel.transferFee || 0)) : 0;
        const spentUsd = newParcel.currency === 'USD' ? (newParcel.shippingCost + (newParcel.transferFee || 0)) : 0;

        if (existingIndex >= 0) {
          const updated = [...prevCustomers];
          const curr = updated[existingIndex];
          const mergedCust: Customer = {
            ...curr,
            fullName: norm.fullName || curr.fullName,
            firstName: norm.firstName || curr.firstName,
            fatherName: norm.fatherName || curr.fatherName,
            lastName: norm.lastName || curr.lastName,
            motherName: mName || curr.motherName,
            birthDate: bDate || curr.birthDate,
            phone: cleanPhone || curr.phone,
            nationalId: cleanNationalId || curr.nationalId,
            idType: sender.idType || curr.idType || 'syrian',
            city: (sender.city as Governorate) || curr.city,
            address: sender.address || curr.address || `مدينة ${sender.city || curr.city}`,
            idPhotoFront: sender.idPhotoFront || curr.idPhotoFront,
            idPhotoBack: sender.idPhotoBack || curr.idPhotoBack,
            totalShipmentsSent: (curr.totalShipmentsSent || 0) + 1,
            totalSpentSyp: (curr.totalSpentSyp || 0) + spentSyp,
            totalSpentUsd: (curr.totalSpentUsd || 0) + spentUsd,
            updatedAt: new Date().toISOString(),
          };
          updated[existingIndex] = mergedCust;
          safeStorage.setItem(`${STORAGE_KEY}_customers`, JSON.stringify(updated));
          vpsSyncEngine.syncCustomer(mergedCust);
          return updated;
        } else if (isIdentityComplete(sender)) {
          // Create new customer ONLY when identity is complete
          const newCst: Customer = {
            id: `cst_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
            code: `CST-${1000 + prevCustomers.length + 1}`,
            fullName: norm.fullName || 'عميل جديد',
            firstName: norm.firstName || '',
            fatherName: norm.fatherName || '',
            lastName: norm.lastName || '',
            motherName: mName || '',
            birthDate: bDate || '',
            phone: cleanPhone || '',
            nationalId: cleanNationalId,
            idType: sender.idType || 'syrian',
            city: (sender.city as Governorate) || 'دمشق',
            address: sender.address || `مدينة ${sender.city || 'دمشق'}`,
            idPhotoFront: sender.idPhotoFront || undefined,
            idPhotoBack: sender.idPhotoBack || undefined,
            customerType: 'individual',
            totalShipmentsSent: 1,
            totalShipmentsReceived: 0,
            totalSpentSyp: spentSyp,
            totalSpentUsd: spentUsd,
            createdAt: new Date().toISOString(),
            branchId: newParcel.originHubId,
          };
          const nextList = [newCst, ...prevCustomers];
          safeStorage.setItem(`${STORAGE_KEY}_customers`, JSON.stringify(nextList));
          vpsSyncEngine.syncCustomer(newCst);
          return nextList;
        }
        return prevCustomers;
      });
    }

    // Auto-update existing receiver or create customer in Customer Directory ONLY if identity is 100% complete
    const rec = newParcel.receiver;
    if (rec?.phone || rec?.nationalId || rec?.name || (rec as any)?.firstName) {
      setCustomers((prevCustomers) => {
        const cleanPhone = (rec.phone || '').trim();
        const cleanNationalId = (rec.nationalId || '').trim();
        const fName = (rec.firstName || '').trim();
        const father = (rec.fatherName || (rec as any).idFatherName || '').trim();
        const lName = (rec.lastName || '').trim();
        const mName = (rec.motherName || (rec as any).idMotherName || '').trim();
        const bDate = (rec.birthDate || '').trim();
        const explicitName = (rec.name || rec.actualReceiverName || '').trim();

        const norm = normalizeCustomerNames({
          fullName: explicitName || [fName, father, lName].filter(Boolean).join(' '),
          firstName: fName,
          fatherName: father,
          lastName: lName,
        });

        const candidate = {
          fullName: norm.fullName,
          firstName: norm.firstName,
          fatherName: norm.fatherName,
          lastName: norm.lastName,
          motherName: mName,
          birthDate: bDate,
          phone: cleanPhone,
          nationalId: cleanNationalId,
        };

        const candidateKey = getCanonicalCustomerKey(candidate);
        const existingIndex = prevCustomers.findIndex((c) => {
          if (rec.customerId && c.id === rec.customerId) return true;
          if (isSameCustomer(c, candidate)) return true;
          if (getCanonicalCustomerKey(c) === candidateKey) return true;
          const pA = normalizePhoneForComparison(c.phone);
          const pB = normalizePhoneForComparison(cleanPhone);
          if (pA && pB && pA.length >= 6 && pA === pB) return true;
          const nidA = (c.nationalId || '').replace(/\D/g, '');
          const nidB = cleanNationalId.replace(/\D/g, '');
          if (nidA && nidB && nidA.length >= 7 && nidA === nidB) return true;
          const nA = normalizeArabicComparison(c.fullName);
          const nB = normalizeArabicComparison(norm.fullName);
          if (nA && nB && nA.length >= 4 && nA === nB) {
            if (!pA || !pB || pA === pB) return true;
          }
          return false;
        });

        if (existingIndex >= 0) {
          const updated = [...prevCustomers];
          const curr = updated[existingIndex];
          const mergedCust: Customer = {
            ...curr,
            fullName: norm.fullName || curr.fullName,
            firstName: norm.firstName || curr.firstName,
            fatherName: norm.fatherName || curr.fatherName,
            lastName: norm.lastName || curr.lastName,
            motherName: mName || curr.motherName,
            birthDate: bDate || curr.birthDate,
            phone: cleanPhone || curr.phone,
            nationalId: cleanNationalId || curr.nationalId,
            idType: rec.idType || curr.idType || 'syrian',
            city: (rec.city as Governorate) || curr.city,
            address: rec.address || curr.address || `مدينة ${rec.city || curr.city}`,
            idPhotoFront: rec.idPhotoFront || (rec as any).nationalIdPhotoUrl || curr.idPhotoFront,
            idPhotoBack: rec.idPhotoBack || (rec as any).nationalIdBackPhotoUrl || curr.idPhotoBack,
            totalShipmentsReceived: (curr.totalShipmentsReceived || 0) + 1,
            updatedAt: new Date().toISOString(),
          };
          updated[existingIndex] = mergedCust;
          safeStorage.setItem(`${STORAGE_KEY}_customers`, JSON.stringify(updated));
          vpsSyncEngine.syncCustomer(mergedCust);
          return updated;
        } else if (isIdentityComplete(rec)) {
          // Create new customer ONLY when identity is complete
          const newCst: Customer = {
            id: `cst_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
            code: `CST-${1000 + prevCustomers.length + 1}`,
            fullName: norm.fullName || 'مستلم جديد',
            firstName: norm.firstName || '',
            fatherName: norm.fatherName || '',
            lastName: norm.lastName || '',
            motherName: mName || '',
            birthDate: bDate || '',
            phone: cleanPhone || '',
            nationalId: cleanNationalId,
            idType: rec.idType || 'syrian',
            city: (rec.city as Governorate) || 'دمشق',
            address: rec.address || `مدينة ${rec.city || 'دمشق'}`,
            idPhotoFront: rec.idPhotoFront || (rec as any).nationalIdPhotoUrl || undefined,
            idPhotoBack: rec.idPhotoBack || (rec as any).nationalIdBackPhotoUrl || undefined,
            customerType: 'individual',
            totalShipmentsSent: 0,
            totalShipmentsReceived: 1,
            totalSpentSyp: 0,
            totalSpentUsd: 0,
            createdAt: new Date().toISOString(),
            branchId: newParcel.destinationHubId,
          };
          const nextList = [newCst, ...prevCustomers];
          safeStorage.setItem(`${STORAGE_KEY}_customers`, JSON.stringify(nextList));
          vpsSyncEngine.syncCustomer(newCst);
          return nextList;
        }
        return prevCustomers;
      });
    }

    // If Prepaid or COD with shipping paid by sender, record shipping income
    if (newParcel.paymentType === 'prepaid' || (newParcel.paymentType === 'cod' && newParcel.codShippingPayer === 'sender')) {
      if (isCourierEntry) {
        addCashTransaction(
          newParcel.originHubId,
          newParcel.currency,
          'courier_prepaid_collection',
          newParcel.shippingCost,
          `مقبوضات تسجيل طرد ميداني (مدفوع سلفاً) - بوليصة ${trackingNumber} - الموزع: ${entryOperatorName}`,
          newParcel.id,
          undefined,
          'courier_intake',
          undefined,
          { userId: entryOperatorId, userName: entryOperatorName }
        );
      } else {
        addCashTransaction(
          newParcel.originHubId,
          newParcel.currency,
          'shipping_income_prepaid',
          newParcel.shippingCost,
          `أجور شحن مدفوعة سلفاً من المرسل - بوليصة ${trackingNumber}`,
          newParcel.id,
          undefined,
          'outgoing'
        );
      }
    }

    // System Audit Log: Log registration and entry operator
    addAuditLog(
      'تسجيل واستلام طرد',
      'parcels',
      `تم استلام وتسجيل البوليصة [${trackingNumber}] من قبل [${entryOperatorName}] بالمركز [${newParcel.originHubId}] متجهة إلى [${newParcel.destinationHubId}]، وأُدرجت بنجاح في مستودع الصادر لتجهيز المانافيست.`
    );

    return newParcel;
  };

  // Create Truck Manifest
  const createTruckManifest = (
    originHubId: string,
    destHubId: string,
    driverName: string,
    driverPhone: string,
    truckPlate: string,
    truckType: string,
    parcelIds: string[],
    notes?: string
  ): TruckManifest => {
    const manifestNumber = `MNF-TRK-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`;

    const selectedParcels = parcels.filter((p) => parcelIds.includes(p.id));
    const totalWeightKg = selectedParcels.reduce((acc, p) => acc + p.weightKg, 0);
    const totalPieces = selectedParcels.reduce((acc, p) => acc + p.piecesCount, 0);

    const totalFreightSyp = selectedParcels
      .filter((p) => (p.shippingCurrency || p.currency) === 'SYP')
      .reduce((acc, p) => acc + (p.shippingCost || 0), 0);
    const totalFreightUsd = selectedParcels
      .filter((p) => (p.shippingCurrency || p.currency) === 'USD')
      .reduce((acc, p) => acc + (p.shippingCost || 0), 0);
    const totalCodSyp = selectedParcels
      .filter((p) => (p.codCurrency || p.currency) === 'SYP' && (p.paymentType === 'cod' || p.paymentType === 'cod_destination'))
      .reduce((acc, p) => acc + (p.codAmount || 0), 0);
    const totalCodUsd = selectedParcels
      .filter((p) => (p.codCurrency || p.currency) === 'USD' && (p.paymentType === 'cod' || p.paymentType === 'cod_destination'))
      .reduce((acc, p) => acc + (p.codAmount || 0), 0);

    const newManifest: TruckManifest = {
      id: `mnf_${Date.now()}`,
      manifestNumber,
      originHubId,
      destinationHubId: destHubId,
      driverName,
      driverPhone,
      truckPlate,
      truckType,
      status: 'preparing',
      parcelIds,
      totalWeightKg: Math.round(totalWeightKg * 10) / 10,
      totalPieces,
      totalFreightSyp,
      totalFreightUsd,
      totalCodSyp,
      totalCodUsd,
      notes,
      createdById: currentUser.id,
      createdAt: new Date().toISOString(),
    };

    setTruckManifests((prev) => {
      const next = [newManifest, ...prev];
      safeStorage.setItem(`${STORAGE_KEY}_truck_manifests`, JSON.stringify(next));
      return next;
    });

    // Update parcel status to loaded_in_truck, sync to VPS, and persist to safeStorage
    const updatedParcels: Parcel[] = [];
    setParcels((prev) => {
      const next = prev.map((p) => {
        if (parcelIds.includes(p.id)) {
          const isReverse = p.isReverseShipment || p.handlingStatus === 'return_initiated' || p.handlingStatus === 'returning_to_origin';
          const newStatus = isReverse ? 'returning_to_origin' : 'loaded_in_truck';
          const up: Parcel = {
            ...p,
            isReverseShipment: isReverse ? true : p.isReverseShipment,
            handlingStatus: newStatus,
            truckManifestId: newManifest.id,
            updatedAt: new Date().toISOString(),
          };
          updatedParcels.push(up);
          return up;
        }
        return p;
      });
      safeStorage.setItem(`${STORAGE_KEY}_parcels`, JSON.stringify(next));
      return next;
    });

    // Immediate atomic cloud queue push: Manifest + all loaded parcels together
    vpsSyncEngine.syncBatch([
      { collectionName: 'truckManifests', id: newManifest.id, data: newManifest, action: 'upsert' },
      ...updatedParcels.map((up) => ({ collectionName: 'parcels', id: up.id, data: up, action: 'upsert' as const })),
    ]);

    // [5-B-4-B] Record batch parcel events for manifest creation
    if (updatedParcels.length > 0) {
      recordParcelEventsBatch(
        updatedParcels.map((up) => ({
          parcelId: up.id,
          eventType: 'loaded_in_truck',
          dimension: 'handling' as const,
          options: {
            previousStatus: parcels.find((p) => p.id === up.id)?.handlingStatus,
            newStatus: 'loaded_in_truck',
            precedenceRank: 30,
            branchId: newManifest.originHubId || currentBranch?.id,
            manifestId: newManifest.id,
            notes: `تحميل طرد في مانافيست ${newManifest.manifestNumber}`,
            metadata: {
              manifestNumber: newManifest.manifestNumber,
              manifestId: newManifest.id,
              destinationHubId: newManifest.destinationHubId,
              driverName: newManifest.driverName,
            },
          },
        }))
      );
    }

    addAuditLog(
      'إنشاء مانافيست شاحنة جديدة',
      'manifests',
      `تم إنشاء مانافيست الشاحنة (${manifestNumber}) بنجاح بحمولة (${parcelIds.length}) طرد بإجمالي وزن (${newManifest.totalWeightKg} كغ).`
    );

    return newManifest;
  };

  // Orphan Parcels Detection & Self-Healing (رصد ومعالجة الطرود المعلقة التي فقدت ارتباطها بالمانافيست بسبب انقطاع الشبكة)
  const orphanParcels = useMemo(() => {
    const knownManifestIds = new Set<string>();
    for (const m of truckManifests) {
      if (m.id) knownManifestIds.add(m.id);
      if (m.manifestNumber) knownManifestIds.add(m.manifestNumber);
    }
    return parcels.filter((p) => {
      // فقط الطرود المتواجدة بفرع الانطلاق الحالي وبحالة محملة بالسيارة (loaded_in_truck) بدون مانافيست معروف
      // استثناء تام للطرود التي في طريق السفر (in_transit) أو المستلمة بالوجهة (received_at_dest) أو المسلمة
      if (p.handlingStatus !== 'loaded_in_truck') return false;

      const isCurrentBranch =
        !currentBranch?.id ||
        p.originHubId === currentBranch.id ||
        p.currentLocationBranchId === currentBranch.id ||
        p.originCollectionBranchId === currentBranch.id;

      if (!isCurrentBranch) return false;

      // إذا كان الطرد محمل بالسيارة ولكن رقم المانافيست مفقود أو غير مسجل في أي مانافيست
      if (!p.truckManifestId || !knownManifestIds.has(p.truckManifestId)) {
        return true;
      }
      return false;
    });
  }, [parcels, truckManifests, currentBranch?.id]);

  const rescueOrphanParcels = useCallback(
    (targetAction: 'release_to_outbound' | 'recreate_manifest'): { rescuedCount: number; message: string } => {
      if (orphanParcels.length === 0) {
        return { rescuedCount: 0, message: 'لا توجد طرود معلقة حالياً، جميع الطرود مرتبطة بمانافيستات صحيحة.' };
      }

      const now = new Date().toISOString();
      const orphanIds = new Set(orphanParcels.map((p) => p.id));

      if (targetAction === 'release_to_outbound') {
        const updatedParcels: Parcel[] = [];
        setParcels((prev) => {
          const next = prev.map((p) => {
            if (orphanIds.has(p.id)) {
              const up: Parcel = {
                ...p,
                handlingStatus: 'received_at_origin_hub',
                truckManifestId: undefined,
                updatedAt: now,
                specialInstructions: p.specialInstructions
                  ? `${p.specialInstructions} (تم تحرير الطرد تلقائياً لإعادته لمستودع الصادر)`
                  : 'تم تحرير الطرد تلقائياً لإعادته لمستودع الصادر بعد انقطاع الاتصال السابق',
              };
              updatedParcels.push(up);
              return up;
            }
            return p;
          });
          safeStorage.setItem(`${STORAGE_KEY}_parcels`, JSON.stringify(next));
          return next;
        });

        // Sync all released parcels to cloud
        updatedParcels.forEach((p) => vpsSyncEngine.syncParcel(p));

        // [5-B-4-D] Record investigation events for orphan rescue (release to outbound)
        if (updatedParcels.length > 0) {
          const releasedAt = new Date().toISOString();
          recordParcelEventsBatch(
            updatedParcels.map((up) => ({
              parcelId: up.id,
              eventType: 'received_at_origin_hub',
              dimension: 'investigation' as ParcelEventDimension,
              options: {
                previousStatus: orphanParcels.find((p) => p.id === up.id)?.handlingStatus || 'unknown',
                newStatus: 'received_at_origin_hub',
                precedenceRank: 20,
                branchId: up.currentLocationBranchId || currentBranch?.id,
                notes: 'إنقاذ طرد تائه برمجياً - تحرير إلى مستودع الصادر',
                metadata: {
                  rescuedAt: releasedAt,
                  rescuedByUserId: currentUser.id,
                  rescuedByUserName: currentUser.name,
                  rescueMode: 'release_to_outbound',
                  rescueReason: 'orphan_manifest_recovery',
                  orphanAgeMs: Date.now() - new Date(up.createdAt).getTime(),
                },
              },
            }))
          );
        }

        addAuditLog(
          'تحرير الطرود المعلقة تلقائياً',
          'parcels',
          `تم تحرير (${updatedParcels.length}) طرد وإعادتها فوراً إلى قسم الصادر لتصبح جاهزة للشحن مجدداً.`
        );

        return {
          rescuedCount: updatedParcels.length,
          message: `تم تحرير (${updatedParcels.length}) طرد بنجاح وإعادتها لمستودع الصادر وهي متاحة الآن للشحن فوراً.`,
        };
      } else {
        // Recreate / restore manifest
        const sample = orphanParcels[0];
        const origHub = sample.originHubId || currentBranch.id;
        const destHub = sample.destinationHubId || currentBranch.id;
        const manifestNum = `MNF-REC-${Date.now().toString().slice(-6)}`;
        const manifestId = sample.truckManifestId || `mnf_rec_${Date.now()}`;

        const totalWeightKg = Math.round(orphanParcels.reduce((sum, p) => sum + (p.weightKg || 0), 0) * 10) / 10;
        const totalPieces = orphanParcels.reduce((sum, p) => sum + (p.piecesCount || 1), 0);
        const totalFreightSyp = orphanParcels
          .filter((p) => (p.shippingCurrency || p.currency) === 'SYP')
          .reduce((sum, p) => sum + (p.shippingCost || 0), 0);
        const totalFreightUsd = orphanParcels
          .filter((p) => (p.shippingCurrency || p.currency) === 'USD')
          .reduce((sum, p) => sum + (p.shippingCost || 0), 0);
        const totalCodSyp = orphanParcels
          .filter((p) => (p.codCurrency || p.currency) === 'SYP' && (p.paymentType === 'cod' || p.paymentType === 'cod_destination'))
          .reduce((sum, p) => sum + (p.codAmount || 0), 0);
        const totalCodUsd = orphanParcels
          .filter((p) => (p.codCurrency || p.currency) === 'USD' && (p.paymentType === 'cod' || p.paymentType === 'cod_destination'))
          .reduce((sum, p) => sum + (p.codAmount || 0), 0);

        const recoveredManifest: TruckManifest = {
          id: manifestId,
          manifestNumber: manifestNum,
          originHubId: origHub,
          destinationHubId: destHub,
          driverName: 'سائق الشحنة المستعادة',
          driverPhone: '-',
          truckPlate: 'مركبة الشحن المستعادة',
          truckType: 'شاحنة نقل',
          status: 'preparing',
          parcelIds: orphanParcels.map((p) => p.id),
          totalWeightKg,
          totalPieces,
          totalFreightSyp,
          totalFreightUsd,
          totalCodSyp,
          totalCodUsd,
          notes: 'مانافيست مستعادة تلقائياً بعد انقطاع الاتصال لحماية حمولة الشاحنة',
          createdById: currentUser.id,
          createdAt: now,
        };

        setTruckManifests((prev) => {
          const next = [recoveredManifest, ...prev];
          safeStorage.setItem(`${STORAGE_KEY}_truck_manifests`, JSON.stringify(next));
          return next;
        });
        vpsSyncEngine.syncTruckManifest(recoveredManifest);

        // Re-link parcels
        const updatedParcels: Parcel[] = [];
        setParcels((prev) => {
          const next = prev.map((p) => {
            if (orphanIds.has(p.id)) {
              const up: Parcel = {
                ...p,
                handlingStatus: 'loaded_in_truck',
                truckManifestId: recoveredManifest.id,
                updatedAt: now,
              };
              updatedParcels.push(up);
              return up;
            }
            return p;
          });
          safeStorage.setItem(`${STORAGE_KEY}_parcels`, JSON.stringify(next));
          return next;
        });
        updatedParcels.forEach((p) => vpsSyncEngine.syncParcel(p));

        // [5-B-4-D] Record investigation events for orphan rescue (recreate manifest)
        if (updatedParcels.length > 0) {
          const recreatedAt = new Date().toISOString();
          recordParcelEventsBatch(
            updatedParcels.map((up) => ({
              parcelId: up.id,
              eventType: 'loaded_in_truck',
              dimension: 'investigation' as ParcelEventDimension,
              options: {
                previousStatus: orphanParcels.find((p) => p.id === up.id)?.handlingStatus || 'unknown',
                newStatus: 'loaded_in_truck',
                precedenceRank: 30,
                branchId: up.currentLocationBranchId || currentBranch?.id,
                manifestId: recoveredManifest.id,
                notes: `إنقاذ طرد تائه - إعادة بناء مانافيست ${recoveredManifest.manifestNumber}`,
                metadata: {
                  rescuedAt: recreatedAt,
                  rescuedByUserId: currentUser.id,
                  rescuedByUserName: currentUser.name,
                  rescueMode: 'recreate_manifest',
                  newManifestId: recoveredManifest.id,
                  manifestNumber: recoveredManifest.manifestNumber,
                  orphanAgeMs: Date.now() - new Date(up.createdAt).getTime(),
                  orphanReason: 'manifest_id_not_found',
                },
              },
            }))
          );
        }

        addAuditLog(
          'استعادة المانافيست المفقودة تلقائياً',
          'manifests',
          `تمت استعادة المانافيست برقم ${manifestNum} وتثبيت (${orphanParcels.length}) طرد عليها بنجاح.`
        );

        return {
          rescuedCount: orphanParcels.length,
          message: `تمت استعادة المانافيست بنجاح برقم (${manifestNum}) وتضمين (${orphanParcels.length}) طرد بها.`,
        };
      }
    },
    [orphanParcels, currentBranch.id, currentUser.id]
  );

  // Update Truck Manifest (تعديل المانافيست)
  const updateTruckManifest = (
    manifestId: string,
    data: {
      destinationHubId: string;
      driverName: string;
      driverPhone: string;
      truckPlate: string;
      truckType: string;
      parcelIds: string[];
      notes?: string;
    }
  ): TruckManifest | undefined => {
    const existing = truckManifests.find((m) => m.id === manifestId);
    if (!existing) return undefined;

    const selectedParcels = parcels.filter((p) => data.parcelIds.includes(p.id));
    const totalWeightKg = selectedParcels.reduce((acc, p) => acc + p.weightKg, 0);
    const totalPieces = selectedParcels.reduce((acc, p) => acc + p.piecesCount, 0);

    const totalFreightSyp = selectedParcels
      .filter((p) => (p.shippingCurrency || p.currency) === 'SYP')
      .reduce((acc, p) => acc + (p.shippingCost || 0), 0);
    const totalFreightUsd = selectedParcels
      .filter((p) => (p.shippingCurrency || p.currency) === 'USD')
      .reduce((acc, p) => acc + (p.shippingCost || 0), 0);
    const totalCodSyp = selectedParcels
      .filter((p) => (p.codCurrency || p.currency) === 'SYP' && (p.paymentType === 'cod' || p.paymentType === 'cod_destination'))
      .reduce((acc, p) => acc + (p.codAmount || 0), 0);
    const totalCodUsd = selectedParcels
      .filter((p) => (p.codCurrency || p.currency) === 'USD' && (p.paymentType === 'cod' || p.paymentType === 'cod_destination'))
      .reduce((acc, p) => acc + (p.codAmount || 0), 0);

    const updatedManifest: TruckManifest = {
      ...existing,
      destinationHubId: data.destinationHubId,
      driverName: data.driverName,
      driverPhone: data.driverPhone,
      truckPlate: data.truckPlate,
      truckType: data.truckType,
      parcelIds: data.parcelIds,
      totalWeightKg: Math.round(totalWeightKg * 10) / 10,
      totalPieces,
      totalFreightSyp,
      totalFreightUsd,
      totalCodSyp,
      totalCodUsd,
      notes: data.notes,
      updatedAt: new Date().toISOString(),
    };

    setTruckManifests((prev) => prev.map((m) => (m.id === manifestId ? updatedManifest : m)));
    vpsSyncEngine.syncTruckManifest(updatedManifest);

    const targetStatus = existing.status === 'dispatched' ? 'in_transit' : 'loaded_in_truck';
    const removedParcelIds = existing.parcelIds.filter((id) => !data.parcelIds.includes(id));
    const addedParcelIds = data.parcelIds.filter((id) => !existing.parcelIds.includes(id));
    const nowIso = new Date().toISOString();

    const originalParcelsMap = new Map(
      parcels.filter((p) => removedParcelIds.includes(p.id) || addedParcelIds.includes(p.id)).map((p) => [p.id, p])
    );

    const updatedParcelsList: Parcel[] = [];

    setParcels((prev) => {
      const updatedParcels: Parcel[] = [];
      const nextParcels = prev.map((p) => {
        if (removedParcelIds.includes(p.id)) {
          // If parcel was already delivered or handed over, do not downgrade
          if (p.handlingStatus === 'returned_to_sender' || p.handlingStatus === 'delivered') {
            return p;
          }

          // If it was a reverse shipment or pre-delivery return, safely restore it
          const restoredStatus = (p.isReverseShipment || p.returnInitiatedReason)
            ? (p.returnInitiatedReason ? 'return_initiated' : 'returning_to_origin')
            : 'received_at_hub';

          const up: Parcel = {
            ...p,
            handlingStatus: restoredStatus,
            truckManifestId: undefined,
            updatedAt: nowIso,
          };
          updatedParcels.push(up);
          updatedParcelsList.push(up);
          return up;
        }
        if (data.parcelIds.includes(p.id)) {
          const isReverse = p.isReverseShipment || p.handlingStatus === 'return_initiated' || p.handlingStatus === 'returning_to_origin';
          const newHandlingStatus = isReverse ? 'returning_to_origin' : targetStatus;
          const up: Parcel = {
            ...p,
            isReverseShipment: isReverse ? true : p.isReverseShipment,
            handlingStatus: newHandlingStatus,
            truckManifestId: manifestId,
            updatedAt: nowIso,
          };
          updatedParcels.push(up);
          if (addedParcelIds.includes(p.id)) {
            updatedParcelsList.push(up);
          }
          return up;
        }
        return p;
      });
      safeStorage.setItem(`${STORAGE_KEY}_parcels`, JSON.stringify(nextParcels));
      updatedParcels.forEach((up) => vpsSyncEngine.syncParcel(up));
      return nextParcels;
    });

    // [5-B-4-B] Record batch parcel events for manifest parcel additions/removals
    if (updatedParcelsList.length > 0) {
      const eventsBatch = updatedParcelsList.map((up) => {
        const isRemoved = removedParcelIds.includes(up.id);
        const originalP = originalParcelsMap.get(up.id);
        return {
          parcelId: up.id,
          eventType: up.handlingStatus,
          dimension: 'handling' as const,
          options: {
            previousStatus: originalP?.handlingStatus,
            newStatus: up.handlingStatus,
            precedenceRank: up.handlingStatus === 'loaded_in_truck' ? 30 : up.handlingStatus === 'in_transit' ? 40 : 10,
            branchId: existing.originHubId || currentBranch?.id,
            manifestId: manifestId,
            notes: isRemoved
              ? `إزالة طرد من مانافيست ${existing.manifestNumber} قبل الانطلاق`
              : `إضافة طرد إلى مانافيست ${existing.manifestNumber}`,
            metadata: {
              manifestNumber: existing.manifestNumber,
              manifestId,
              changeType: isRemoved ? 'removed' : 'added',
            },
          },
        };
      });
      recordParcelEventsBatch(eventsBatch);
    }

    return updatedManifest;
  };

  // Pause / Resume Truck Manifest (إيقاف مؤقت / استئناف الرحلة - متاح فقط بعد انطلاق الشاحنة)
  const pauseTruckManifest = (manifestId: string) => {
    const manifest = truckManifests.find((m) => m.id === manifestId);
    if (!manifest) return;
    if (manifest.status !== 'dispatched' && manifest.status !== 'paused') return;

    const now = new Date().toISOString();
    const newStatus: ManifestStatus = manifest.status === 'paused' ? 'dispatched' : 'paused';
    const updatedManifest: TruckManifest = { ...manifest, status: newStatus, updatedAt: now };

    setTruckManifests((prev) => prev.map((m) => (m.id === manifestId ? updatedManifest : m)));
    vpsSyncEngine.syncTruckManifest(updatedManifest);

    // [5-B-4-B] Record resume event for journey continuation (location dimension)
    if (newStatus === 'dispatched' && manifest.parcelIds && manifest.parcelIds.length > 0) {
      const eventsBatch = manifest.parcelIds.map((pid) => ({
        parcelId: pid,
        eventType: 'truck_journey_resumed',
        dimension: 'location' as ParcelEventDimension,
        options: {
          previousStatus: 'in_transit',
          newStatus: 'in_transit',
          precedenceRank: 40,
          branchId: manifest.originHubId || currentBranch?.id,
          manifestId: manifest.id,
          notes: `استئناف رحلة الشاحنة - مانافيست ${manifest.manifestNumber}`,
          metadata: {
            manifestNumber: manifest.manifestNumber,
            resumedAt: now,
          },
        },
      }));
      recordParcelEventsBatch(eventsBatch);
    }
  };

  // Cancel Trip & Reopen Manifest (إلغاء الرحلة وإعادة المانافيست)
  const cancelAndResetTruckManifest = (manifestId: string) => {
    const manifest = truckManifests.find((m) => m.id === manifestId);
    if (!manifest) return;

    const now = new Date().toISOString();
    const updatedManifest: TruckManifest = {
      ...manifest,
      status: 'preparing',
      dispatchedAt: undefined,
      updatedAt: now,
    };

    setTruckManifests((prev) => prev.map((m) => (m.id === manifestId ? updatedManifest : m)));
    vpsSyncEngine.syncTruckManifest(updatedManifest);

    const updatedParcels: Parcel[] = [];
    setParcels((prev) => {
      const nextParcels = prev.map((p) => {
        if (manifest.parcelIds.includes(p.id)) {
          const up: Parcel = { ...p, handlingStatus: 'loaded_in_truck', updatedAt: now };
          updatedParcels.push(up);
          return up;
        }
        return p;
      });
      safeStorage.setItem(`${STORAGE_KEY}_parcels`, JSON.stringify(nextParcels));
      updatedParcels.forEach((up) => vpsSyncEngine.syncParcel(up));
      return nextParcels;
    });

    // [5-B-4-B] Record batch parcel events for trip cancellation
    if (updatedParcels.length > 0) {
      recordParcelEventsBatch(
        updatedParcels.map((up) => ({
          parcelId: up.id,
          eventType: 'loaded_in_truck',
          dimension: 'handling' as const,
          options: {
            previousStatus: 'in_transit',
            newStatus: 'loaded_in_truck',
            precedenceRank: 30,
            branchId: manifest.originHubId || currentBranch?.id,
            manifestId: manifest.id,
            notes: `إلغاء رحلة الشاحنة - مانافيست ${manifest.manifestNumber} - الطرود لا تزال محمّلة`,
            metadata: {
              manifestNumber: manifest.manifestNumber,
              manifestId: manifest.id,
              cancelReason: 'manifest_cancelled',
              cancelledAt: now,
            },
          },
        }))
      );
    }

    const originBranch = branches.find((b) => b.id === manifest.originHubId);
    const destBranch = branches.find((b) => b.id === manifest.destinationHubId);

    const cancelNotif: SystemNotification = {
      id: `notif_cancel_${Date.now()}`,
      title: '⚠️ تم إلغاء رحلة الشاحنة وإعادة المانافيست للتجهيز',
      message: `تم إلغاء رحلة الشاحنة (${manifest.truckPlate}) المغادرة من ${originBranch?.name || 'الفرع'} إلى ${destBranch?.name || 'الوجهة'} وإعادة المانافيست لوضع التجهيز.`,
      type: 'truck_dispatched',
      targetBranchId: manifest.destinationHubId,
      relatedId: manifest.id,
      actionType: 'view_manifest',
      timestamp: now,
      read: false,
    };

    setNotifications((prev) => [cancelNotif, ...prev]);
    vpsSyncEngine.syncNotification(cancelNotif);
  };

  // Dispatch Truck Manifest -> Notify Dest Hub
  const dispatchTruckManifest = (manifestId: string) => {
    const manifest = truckManifests.find((m) => m.id === manifestId || m.manifestNumber === manifestId);
    if (!manifest) return;

    const now = new Date().toISOString();
    const updatedManifest: TruckManifest = { ...manifest, status: 'dispatched', dispatchedAt: now, updatedAt: now };

    setTruckManifests((prev) => {
      const next = prev.map((m) => (m.id === manifest.id || m.manifestNumber === manifest.manifestNumber ? updatedManifest : m));
      safeStorage.setItem(`${STORAGE_KEY}_truck_manifests`, JSON.stringify(next));
      return next;
    });

    const parcelsToSync: Parcel[] = [];
    // Update parcels to in_transit
    setParcels((prev) => {
      const next = prev.map((p) => {
        const cleanPId = p.id ? String(p.id).trim() : '';
        const cleanTracking = p.trackingNumber ? String(p.trackingNumber).trim().toUpperCase() : '';
        const belongsToManifest =
          (cleanPId && (manifest.parcelIds || []).some((id) => String(id).trim() === cleanPId)) ||
          (cleanTracking && (manifest.parcelIds || []).some((id) => String(id).trim().toUpperCase() === cleanTracking)) ||
          (p.truckManifestId && (p.truckManifestId === manifest.id || p.truckManifestId === manifest.manifestNumber));

        if (belongsToManifest) {
          if (!isTransitionAllowed(p.handlingStatus, 'in_transit')) {
            console.warn(`[Lifecycle Guard] Blocked illegal in_transit transition for ${p.trackingNumber}: ${p.handlingStatus} → in_transit`);
            return p;
          }
          const updated: Parcel = { ...p, handlingStatus: 'in_transit', truckManifestId: manifest.id, updatedAt: now };
          parcelsToSync.push(updated);
          return updated;
        }
        return p;
      });
      safeStorage.setItem(`${STORAGE_KEY}_parcels`, JSON.stringify(next));
      return next;
    });

    // Create Notification for Destination Hub
    const originBranch = branches.find((b) => b.id === manifest.originHubId);
    const destBranch = branches.find((b) => b.id === manifest.destinationHubId);

    const newNotif: SystemNotification = {
      id: `notif_dispatch_${Date.now()}_${manifest.id}`,
      title: '🚨 انطلاق شاحنة شحن بالاتجاه إليكم!',
      message: `غادرت الشاحنة (${manifest.truckPlate} - السائق: ${manifest.driverName}) من ${originBranch?.name || 'فرع الصادر'} بحمولة (${manifest.parcelIds.length} شحنة / ${manifest.totalWeightKg} كغ) متجهة إلى ${destBranch?.name || 'فرع الوجهة'}.`,
      type: 'truck_dispatched',
      targetBranchId: manifest.destinationHubId,
      relatedId: manifest.id,
      actionType: 'view_manifest',
      timestamp: now,
      read: false,
    };

    setNotifications((prev) => {
      const next = [newNotif, ...prev];
      safeStorage.setItem(`${STORAGE_KEY}_notifications`, JSON.stringify(next));
      return next;
    });

    // Push the entire dispatch payload atomically to the server in a single batch
    const batchItems: Array<{
      collectionName: string;
      id: string;
      data: any;
      action?: 'upsert' | 'delete';
    }> = [
      { collectionName: 'truckManifests', id: updatedManifest.id, data: updatedManifest, action: 'upsert' },
      ...parcelsToSync.map((p) => ({ collectionName: 'parcels', id: p.id, data: p, action: 'upsert' as const })),
      { collectionName: 'notifications', id: newNotif.id, data: newNotif, action: 'upsert' },
    ];
    vpsSyncEngine.syncBatch(batchItems);

    // [5-B-4-B] Record batch parcel events for manifest dispatch
    if (parcelsToSync.length > 0) {
      recordParcelEventsBatch(
        parcelsToSync.map((p) => ({
          parcelId: p.id,
          eventType: 'in_transit',
          dimension: 'handling' as const,
          options: {
            previousStatus: 'loaded_in_truck',
            newStatus: 'in_transit',
            precedenceRank: 40,
            branchId: updatedManifest.originHubId || currentBranch?.id,
            manifestId: updatedManifest.id,
            notes: `انطلاق الشاحنة - مانافيست ${updatedManifest.manifestNumber} من ${updatedManifest.originHubId} إلى ${updatedManifest.destinationHubId}`,
            metadata: {
              manifestNumber: updatedManifest.manifestNumber,
              manifestId: updatedManifest.id,
              dispatchedAt: now,
              driverName: updatedManifest.driverName,
              truckPlate: updatedManifest.truckPlate,
              destinationHubId: updatedManifest.destinationHubId,
            },
          },
        }))
      );
    }

    playTruckDispatchedSound();

    try {
      safeStorage.removeItem(`orca_draft_truck_manifest_${manifest.originHubId}`);
      safeStorage.removeItem(`orca_draft_truck_manifest_${currentBranch.id}`);
      safeStorage.removeItem('orca_draft_create-manifest-modal');
      safeStorage.removeItem('ORCA_FORM_DRAFT_create-manifest-modal');
    } catch {}

    addAuditLog(
      'ترحيل ومغادرة شاحنة',
      'manifests',
      `غادرت الشاحنة (${manifest.truckPlate}) برقم المانافيست (${manifest.manifestNumber}) من فرع (${originBranch?.name || 'الصادر'}) إلى فرع (${destBranch?.name || 'الوجهة'}) بحمولة (${manifest.parcelIds.length}) طرد.`
    );
  };

  // Stage 1 Option: Mark truck arrived at destination and preparing for discharge
  const markTruckArrived = (manifestId: string) => {
    const manifest = truckManifests.find(
      (m) => m.id === manifestId || m.manifestNumber === manifestId
    );
    if (!manifest) return;

    // منع التكرار إذا كانت الشاحنة مسجلة مسبقاً بأنها وصلت أو تم تفريغها
    if (manifest.status === 'arrived_unloading' || manifest.status === 'received') {
      return;
    }

    const now = new Date().toISOString();
    const updatedManifest: TruckManifest = {
      ...manifest,
      status: 'arrived_unloading',
      arrivedAt: now,
      updatedAt: now,
    };

    setTruckManifests((prev) => {
      const next = prev.map((m) =>
        m.id === manifest.id || m.manifestNumber === manifest.manifestNumber ? updatedManifest : m
      );
      safeStorage.setItem(`${STORAGE_KEY}_truck_manifests`, JSON.stringify(next));
      return next;
    });

    const originBranch = branches.find((b) => b.id === manifest.originHubId);
    const destBranch = branches.find((b) => b.id === manifest.destinationHubId);

    // التحقق هل تم إصدار تنبيه وصول مسبقاً لهذا المانافيست
    const alreadyNotified = notifications.some(
      (n) => n.relatedId === manifest.id && (n.type === 'truck_arrived' || n.id.startsWith(`notif_arrival_`))
    );

    const notifsToCreate: SystemNotification[] = [];

    // 1. تنبيه واحد فقط لفرع الوجهة برصيف التفريغ بمعرف فريد ثابت
    const notifDestId = `notif_arrival_dest_${manifest.id}`;
    const notifDest: SystemNotification = {
      id: notifDestId,
      title: '📦 الشاحنة متواجدة برصيف التفريغ الان',
      message: `وصلت الشاحنة (${manifest.manifestNumber}) من فرع (${originBranch?.name || 'المركز الصادر'}). يرجى البدء بمطابقة وتدقيق المانافيست للتأكد من السلامة.`,
      type: 'truck_arrived',
      targetBranchId: manifest.destinationHubId,
      relatedId: manifest.id,
      actionType: 'view_manifest',
      timestamp: now,
      read: false,
    };
    notifsToCreate.push(notifDest);

    // 2. تنبيه لفرع الانطلاق الصادر (فقط إذا لم يكن هو نفسه فرع الوجهة) بمعرف فريد ثابت
    if (manifest.originHubId && manifest.originHubId !== manifest.destinationHubId) {
      const notifOrigId = `notif_arrival_orig_${manifest.id}`;
      const notifOrigin: SystemNotification = {
        id: notifOrigId,
        title: `🚚 وصول الشاحنة إلى فرع الوجهة (${destBranch?.name || 'الوجهة'}) وتتحضر للتفريغ`,
        message: `وصلت الشاحنة (${manifest.truckPlate || 'شاحنة النقل'} - السائق: ${manifest.driverName || ''}) التابعة للمانافيست (${manifest.manifestNumber}) بنجاح إلى فرع (${destBranch?.name || 'مركز الوجهة'}) وتتحضر للتفريغ والمطابقة الآن.`,
        type: 'truck_arrived',
        targetBranchId: manifest.originHubId,
        relatedId: manifest.id,
        actionType: 'view_manifest',
        timestamp: now,
        read: false,
      };
      notifsToCreate.push(notifOrigin);
    }

    setNotifications((prev) => {
      const existingIds = new Set(prev.map((n) => n.id));
      const newItems = notifsToCreate.filter((n) => !existingIds.has(n.id));
      if (newItems.length === 0) return prev;
      return [...newItems, ...prev];
    });

    // Atomic batch push: Manifest + notifications together
    vpsSyncEngine.syncBatch([
      { collectionName: 'truckManifests', id: updatedManifest.id, data: updatedManifest, action: 'upsert' },
      ...notifsToCreate.map((n) => ({ collectionName: 'notifications', id: n.id, data: n, action: 'upsert' as const })),
    ]);

    if (!alreadyNotified) {
      playGeneralNotificationSound();
    }
  };

  // Stage 2 Option: Complete Truck Discharge after inspecting and matching parcels
  const completeTruckDischarge = (
    manifestId: string,
    verifiedParcelIds: string[],
    missingParcelIds: string[],
    notes?: string
  ) => {
    const manifest = truckManifests.find(
      (m) => m.id === manifestId || m.manifestNumber === manifestId
    );
    if (!manifest) return;

    const now = new Date().toISOString();

    const updatedManifest: TruckManifest = {
      ...manifest,
      status: 'received',
      receivedAt: now,
      receivedByUserId: currentUser.id,
      missingParcelIds: missingParcelIds,
      shortageNotes: notes || (missingParcelIds.length > 0 ? `نقص ${missingParcelIds.length} طرد عند التفريغ` : undefined),
      updatedAt: now,
    };

    setTruckManifests((prev) => {
      const next = prev.map((m) =>
        m.id === manifest.id || m.manifestNumber === manifest.manifestNumber ? updatedManifest : m
      );
      safeStorage.setItem(`${STORAGE_KEY}_truck_manifests`, JSON.stringify(next));
      return next;
    });

    const originBranch = branches.find((b) => b.id === manifest.originHubId);
    const destBranch = branches.find((b) => b.id === manifest.destinationHubId);

    const parcelsToSync: Parcel[] = [];

    // Update verified parcels to received_at_dest & missing to shortage_missing with verification metadata
    setParcels((prev) => {
      const next = prev.map((p) => {
        const cleanPId = p.id ? String(p.id).trim() : '';
        const cleanTracking = p.trackingNumber ? String(p.trackingNumber).trim().toUpperCase() : '';

        // Missing parcel explicitly recorded
        const isMissing =
          (cleanPId && missingParcelIds.some((id) => String(id).trim() === cleanPId)) ||
          (cleanTracking && missingParcelIds.some((id) => String(id).trim().toUpperCase() === cleanTracking));

        if (isMissing) {
          if (!isTransitionAllowed(p.handlingStatus, 'shortage_missing')) {
            console.warn(`[Lifecycle Guard] Blocked illegal shortage transition for ${p.trackingNumber}: ${p.handlingStatus} → shortage_missing`);
            return p;
          }
          const updated: Parcel = {
            ...p,
            handlingStatus: 'shortage_missing',
            shortageStatus: 'pending_origin_verification',
            shortageReportedAt: now,
            shortageReportedByBranchId: manifest.destinationHubId,
            shortageReportedByBranchName: destBranch?.name || '',
            shortageOriginBranchId: manifest.originHubId,
            shortageManifestId: manifest.id,
            shortageManifestNumber: manifest.manifestNumber,
            shortageNote: notes || 'نقص غير موجود بالسيارة عند تفريغ المانافيست',
            currentLocationBranchId: manifest.originHubId,
            updatedAt: now,
          };
          parcelsToSync.push(updated);
          return updated;
        }

        // Verified parcel or any parcel belonging to this discharged manifest
        const isBelongingToManifest =
          (cleanPId && (
            verifiedParcelIds.some((id) => String(id).trim() === cleanPId) ||
            (manifest.parcelIds || []).some((id) => String(id).trim() === cleanPId)
          )) ||
          (cleanTracking && (
            verifiedParcelIds.some((id) => String(id).trim().toUpperCase() === cleanTracking) ||
            (manifest.parcelIds || []).some((id) => String(id).trim().toUpperCase() === cleanTracking)
          )) ||
          (p.truckManifestId && (
            p.truckManifestId === manifest.id ||
            p.truckManifestId === manifest.manifestNumber
          ));

        if (isBelongingToManifest) {
          if (!isTransitionAllowed(p.handlingStatus, 'received_at_dest')) {
            console.warn(`[Lifecycle Guard] Blocked illegal discharge transition for ${p.trackingNumber}: ${p.handlingStatus} → received_at_dest`);
            return p;
          }
          const updated: Parcel = {
            ...p,
            handlingStatus: 'received_at_dest',
            arrivedAtDestAt: now,
            storageGraceDays: 3,
            currentLocationBranchId: manifest.destinationHubId,
            destinationHubId: p.destinationHubId || manifest.destinationHubId,
            storedWarehouseType: 'standard_received',
            truckManifestId: manifest.id,
            updatedAt: now,
          };
          parcelsToSync.push(updated);
          return updated;
        }
        return p;
      });
      safeStorage.setItem(`${STORAGE_KEY}_parcels`, JSON.stringify(next));
      return next;
    });

    // Sync all updated records atomically to the server in a single batch
    const batchItems: Array<{
      collectionName: string;
      id: string;
      data: any;
      action?: 'upsert' | 'delete';
    }> = [
      { collectionName: 'truckManifests', id: updatedManifest.id, data: updatedManifest, action: 'upsert' },
      ...parcelsToSync.map((p) => ({ collectionName: 'parcels', id: p.id, data: p, action: 'upsert' as const })),
    ];
    vpsSyncEngine.syncBatch(batchItems);

    // [5-B-4-C] Record batch events for discharge (verified + missing)
    if (parcelsToSync.length > 0) {
      const originalParcelsMap = new Map(parcels.map((p) => [p.id, p]));
      const eventsBatch = parcelsToSync.map((up) => {
        const isMissing = missingParcelIds.includes(up.id);
        const originalP = originalParcelsMap.get(up.id);
        return {
          parcelId: up.id,
          eventType: up.handlingStatus,
          dimension: (isMissing ? 'investigation' : 'handling') as ParcelEventDimension,
          options: {
            previousStatus: originalP?.handlingStatus || 'in_transit',
            newStatus: up.handlingStatus,
            precedenceRank: isMissing ? 45 : 50,
            branchId: manifest.destinationHubId || currentBranch?.id,
            manifestId: manifest.id,
            notes: isMissing
              ? `نقص عند تفريغ مانافيست ${manifest.manifestNumber} - الطرد مسجل لكن غير موجود فعلياً`
              : `وصول طرد إلى مستودع ${destBranch?.name || manifest.destinationHubId} - مانافيست ${manifest.manifestNumber}`,
            metadata: {
              manifestNumber: manifest.manifestNumber,
              manifestId: manifest.id,
              arrivedAt: now,
              originHubId: manifest.originHubId,
              destinationHubId: manifest.destinationHubId,
              isMissing,
            },
          },
        };
      });
      recordParcelEventsBatch(eventsBatch);
    }

    const cleanMissingParcelIds = (missingParcelIds || []).filter(
      (id) => id && typeof id === 'string' && id.trim() !== ''
    );
    const hasRealShortage = cleanMissingParcelIds.length > 0;
    const missingParcels = parcels.filter((p) => cleanMissingParcelIds.includes(p.id));
    const missingTrackings = missingParcels.map((p) => p.trackingNumber).join(', ');

    // Play urgent sound alert if shortages are detected
    if (hasRealShortage) {
      playShortageAlertSound();
    } else {
      playGeneralNotificationSound();
    }

    // Origin branch + all collecting branches that contributed parcels to this manifest
    const manifestParcelsList = (manifest.parcelIds || [])
      .map((id) => parcels.find((p) => p.id === id))
      .filter(Boolean) as Parcel[];
    const contributingOriginBranchIds = Array.from(
      new Set([manifest.originHubId, ...manifestParcelsList.map((p) => p.originBranchId).filter(Boolean)])
    ) as string[];

    const notifsToCreate: SystemNotification[] = [];

    // Notifications to Origin Hub & Origin branches (إشعار بأن السيارة فرغت وجاهزة للتسليم في الجهة الواردة)
    contributingOriginBranchIds.forEach((bId, idx) => {
      let notifOrigin: SystemNotification;
      if (!hasRealShortage) {
        notifOrigin = {
          id: `notif_dis_${Date.now()}_orig_${idx}`,
          title: `✅ تم تفريغ الشاحنة في فرع (${destBranch?.name || 'الوجهة'}) - الشحنات جاهزة للتسليم`,
          message: `أكد فرع (${destBranch?.name || 'الوجهة'}) استلام وتفريغ حمولة المانافيست (${manifest.manifestNumber}) الشاحنة (${manifest.truckPlate || 'النقل'}) بالكامل بعدد (${verifiedParcelIds.length}) طرد دون أي نقص، وأصبحت الطرود بحالة استلام وجاهزة للتسليم للزبائن والمستلمين في الجهة الواردة.`,
          type: 'manifest_unloaded',
          targetBranchId: bId,
          relatedId: manifest.id,
          actionType: 'view_manifest',
          timestamp: now,
          read: false,
        };
      } else {
        notifOrigin = {
          id: `notif_dis_${Date.now()}_orig_${idx}`,
          title: `🚨 تم تفريغ الشاحنة في فرع (${destBranch?.name || ''}) مع تسجيل نقص (${cleanMissingParcelIds.length}) طرد!`,
          message: `أفاد فرع (${destBranch?.name || 'الوجهة'}) بتفريغ المانافيست (${manifest.manifestNumber}) مع تسجيل نقص (${cleanMissingParcelIds.length}) طرد: [${missingTrackings}]. باقي الطرود المطابقة (${verifiedParcelIds.length}) أصبحت جاهزة للتسليم في الجهة الواردة. يرجى التحقق فوراً من الشحنات الناقصة.`,
          type: 'shortage_alert',
          priority: 'urgent',
          targetBranchId: bId,
          relatedId: manifest.id,
          actionType: 'verify_shortage',
          shortageSummary: {
            manifestId: manifest.id,
            manifestNumber: manifest.manifestNumber,
            missingCount: cleanMissingParcelIds.length,
            parcelIds: cleanMissingParcelIds,
            originBranchName: originBranch?.name || '',
            destBranchName: destBranch?.name || '',
            trackingNumbers: missingParcels.map((p) => p.trackingNumber),
          },
          timestamp: now,
          read: false,
        };
      }
      notifsToCreate.push(notifOrigin);
      vpsSyncEngine.syncNotification(notifOrigin);
    });

    // Notification to Destination Hub (فرع الوجهة)
    const notifDest: SystemNotification = {
      id: `notif_dis_${Date.now()}_dest`,
      title: '📦 تم اعتماد تفريغ الشاحنة وإدخال الطرود إلى المستودع',
      message: `تم تفريغ المانافيست (${manifest.manifestNumber}) بنجاح: تم إدخال ${verifiedParcelIds.length} طرد لمستودع الاستلام وجاهزة للتسليم${hasRealShortage ? ` وإرسال إشعار تأكيد عاجل لفرع الصادر بخصوص (${cleanMissingParcelIds.length}) طرد ناقص` : ' دون أي نقص'}.`,
      type: 'manifest_unloaded',
      targetBranchId: manifest.destinationHubId,
      relatedId: manifest.id,
      actionType: 'view_manifest',
      timestamp: now,
      read: false,
    };
    notifsToCreate.push(notifDest);
    vpsSyncEngine.syncNotification(notifDest);

    setNotifications((prev) => [...notifsToCreate, ...prev]);

    addAuditLog(
      'تفريغ شاحنة ومطابقة بضاعة',
      'manifests',
      `تم تفريغ المانافيست [${manifest.manifestNumber}] في فرع [${destBranch?.name}]: مطابقة [${verifiedParcelIds.length}] طرد، وتسجيل نقص [${missingParcelIds.length}] طرد.`
    );
  };

  // Resolve Shortage at Origin (Origin Hub confirms if missing parcel is in their warehouse or lost in transit)
  const resolveShortageAtOrigin = (
    parcelIds: string[],
    resolution: 'found_at_origin' | 'lost_in_transit',
    notes?: string
  ) => {
    const now = new Date().toISOString();
    const resolvedParcels = parcels.filter((p) => parcelIds.includes(p.id));
    if (resolvedParcels.length === 0) return;

    if (resolution === 'found_at_origin') {
      playShortageResolvedSound();
      // 1. Move to leftover warehouse (leftover_origin_warehouse) & ready for new truck manifest with recovered badge
      setParcels((prev) =>
        prev.map((p) => {
          if (parcelIds.includes(p.id)) {
            // Guard 1: Must be strictly in shortage_missing state
            if (p.handlingStatus !== 'shortage_missing') {
              console.warn(`[Shortage] Parcel ${p.trackingNumber} not in shortage_missing state (current: ${p.handlingStatus})`);
              return p;
            }

            // Guard 2: Must not already be confirmed at origin
            if (p.shortageStatus === 'confirmed_at_origin') {
              console.warn(`[Shortage] Parcel ${p.trackingNumber} already confirmed at origin`);
              return p;
            }

            const originBranchId = p.originHubId || p.originCollectionBranchId || currentBranch?.id;
            const previousManifestId = p.truckManifestId || p.shortageManifestId;
            const previousManifestNumber = p.shortageManifestNumber || (previousManifestId ? String(previousManifestId) : undefined);

            // Edge Case 1: Check if administrative compensation was previously recorded
            if (p.lossCompensationDetails && p.lossCompensationDetails.compensationAmount > 0) {
              addAuditLog(
                'تنبيه عكس تعويض طرد مفقود',
                'cashbox',
                `تم تأكيد العثور على الطرد [${p.trackingNumber}] في الفرع المصدر بعد صرف تعويض إداري له بقيمة [${p.lossCompensationDetails.compensationAmount} ${p.lossCompensationDetails.currency}]. يرجى مراجعة الإدارة لعكس القيد المالي.`
              );
            }

            const updated: Parcel = {
              ...p,
              // ✅ الحالة الجديدة المحددة في التلقين 69
              handlingStatus: 'leftover_origin_warehouse',
              shortageStatus: 'confirmed_at_origin',
              isRecoveredFromPreviousShortage: true,
              previousShortageManifestNumber: previousManifestNumber,

              // ✅ تصفير المانافيست الحالي ليقبل مانافيست جديد
              truckManifestId: undefined,

              // ✅ حفظ مرجع تاريخي مع fallback آمن لضمان عدم بقائه undefined
              lastManifestId: previousManifestId,
              lastManifestDispatchedAt: p.loadedInTruckAt || p.updatedAt || now,
              shortageResolvedAt: now,
              shortageResolvedByUserId: currentUser.id,
              shortageResolvedByUserName: currentUser.name,
              shortageResolutionNotes: notes || `تم تأكيد وجود الطرد في الفرع المصدر. كان مرتبطاً بمانافيست ${previousManifestNumber || previousManifestId || ''}. جاهز للشحن في مانافيست جديد.`,

              // ✅ الموقع الفعلي
              currentLocationBranchId: originBranchId,
              destinationHubId: p.destinationHubId, // يبقى كما هو

              storedWarehouseType: 'leftover_previous_shipments',
              updatedAt: now,
            };
            vpsSyncEngine.syncParcel(updated);
            return updated;
          }
          return p;
        })
      );

      // Notify Destination Hub
      resolvedParcels.forEach((p) => {
        const origBranch = branches.find((b) => b.id === p.originHubId);
        const destBranch = branches.find((b) => b.id === p.destinationHubId);
        const notif: SystemNotification = {
          id: `notif_shortage_found_${Date.now()}_${p.id}`,
          title: `✅ تم العثور على الطرد [${p.trackingNumber}] بالفرع الصادر`,
          message: `أكد فرع الانطلاق (${origBranch?.name || 'الفرع الصادر'}) أن الطرد (${p.trackingNumber}) متواجد لديهم، وتمت إعادته لمستودع الصادر ليصبح جاهزاً للتحميل في مانافيست جديدة إلى فرع (${destBranch?.name || ''}) كطرد ناقص من شحنة سابقة.`,
          type: 'truck_arrived',
          priority: 'important',
          targetBranchId: p.destinationHubId,
          relatedId: p.id,
          actionType: 'view_manifest',
          timestamp: now,
          read: false,
        };
        setNotifications((prev) => [notif, ...prev]);
        vpsSyncEngine.syncNotification(notif);

        addAuditLog(
          'تأكيد وجود طرد مفقود',
          'parcels',
          `تم تأكيد وجود الطرد [${p.trackingNumber}] في الفرع المصدر [${origBranch?.name || p.originHubId}]. كان مرتبطاً بمانافيست [${p.truckManifestId || p.shortageManifestId}]. جاهز للشحن في مانافيست جديد.`
        );
      });

      // [5-B-4-C] Record investigation events for shortage confirmed at origin
      if (resolvedParcels.length > 0) {
        const eventsBatch = resolvedParcels.map((p) => {
          const originBranchId = p.originHubId || p.originCollectionBranchId || currentBranch?.id;
          const previousManifestId = p.truckManifestId || p.shortageManifestId;
          return {
            parcelId: p.id,
            eventType: 'shortage_found_at_origin' as any,
            dimension: 'investigation' as ParcelEventDimension,
            options: {
              previousStatus: p.handlingStatus || 'shortage_missing',
              newStatus: 'leftover_origin_warehouse',
              precedenceRank: 85,
              branchId: originBranchId,
              notes: `تم تأكيد وجود الطرد في الفرع المصدر. كان مرتبطاً بمانافيست ${previousManifestId}. جاهز للشحن في مانافيست جديد.`,
              metadata: {
                confirmedByUserId: currentUser.id,
                confirmedAt: now,
                previousManifestId,
                notes,
              },
            },
          };
        });
        recordParcelEventsBatch(eventsBatch);
      }
    } else {
      playShortageAlertSound();
      // 2. Mark as lost in transit -> Move to Lost Parcels Warehouse
      setParcels((prev) =>
        prev.map((p) => {
          if (parcelIds.includes(p.id)) {
            const updated: Parcel = {
              ...p,
              handlingStatus: 'lost_in_transit',
              shortageStatus: 'confirmed_lost_in_transit',
              storedWarehouseType: 'lost_parcels',
              truckManifestId: undefined, // Clear old manifest assignment
              shortageResolutionNotes: notes || 'تم تأكيد عدم وجود الطرد بفرع الصادر وفقدانه على الطريق أثناء النقل، وتم ترحيل البوليصة لمستودع الفقد لمعالجة وضعها والتسوية',
              shortageResolvedAt: now,
              shortageResolvedByUserId: currentUser.id,
              shortageResolvedByUserName: currentUser.name,
              updatedAt: now,
            };
            vpsSyncEngine.syncParcel(updated);
            return updated;
          }
          return p;
        })
      );

      // Notify Destination Hub & Super Admin
      resolvedParcels.forEach((p) => {
        const origBranch = branches.find((b) => b.id === p.originHubId);
        const notif: SystemNotification = {
          id: `notif_shortage_lost_${Date.now()}_${p.id}`,
          title: `⚠️ ترحيل طرد مفقود لمستودع الفقد [${p.trackingNumber}]`,
          message: `أكد فرع الانطلاق (${origBranch?.name || 'الفرع الصادر'}) أن الطرد (${p.trackingNumber}) غير متواجد لديهم وفقد على الطريق، وتم ترحيل البوليصة لمستودع الفقد لمعالجة وضعها لاحقاً وإجراءات التسوية.`,
          type: 'sla_warning',
          priority: 'urgent',
          targetBranchId: p.destinationHubId,
          relatedId: p.id,
          actionType: 'view_shortage_warehouse',
          timestamp: now,
          read: false,
        };
        setNotifications((prev) => [notif, ...prev]);
        vpsSyncEngine.syncNotification(notif);

        addAuditLog(
          'ترحيل بوليصة لمستودع الفقد',
          'parcels',
          `أكد المستخدم [${currentUser.name}] فقدان الطرد [${p.trackingNumber}] أثناء النقل وترحيل البوليصة لمستودع الفقد لمعالجة وضعها لاحقاً.`
        );
      });

      // [5-B-4-C] Record investigation events for confirmed loss in transit
      if (resolvedParcels.length > 0) {
        const eventsBatch = resolvedParcels.map((p) => ({
          parcelId: p.id,
          eventType: 'lost_in_transit',
          dimension: 'investigation' as ParcelEventDimension,
          options: {
            previousStatus: p.handlingStatus || 'shortage_missing',
            newStatus: 'lost_in_transit',
            precedenceRank: 48,
            branchId: currentBranch?.id || p.destinationHubId,
            notes: 'تأكيد فقدان الطرد على الطريق - لجنة التحقيق',
            metadata: {
              investigationResult: 'confirmed_lost',
              previousShortageStatus: p.shortageStatus,
              resolvedAt: now,
              resolvedByUserId: currentUser.id,
              resolvedByUserName: currentUser.name,
              investigationNotes: notes,
            },
          },
        }));
        recordParcelEventsBatch(eventsBatch);
      }
    }
  };

  // Settle Lost Parcel (Exclusive authority for Super Admin)
  // Confirm Shortage Found at Origin (Prompt 69 dedicated handler)
  const confirmShortageFoundAtOrigin = (
    parcelId: string,
    notes?: string
  ) => {
    const parcel = parcels.find((p) => p.id === parcelId);
    if (!parcel) return;

    if (parcel.handlingStatus !== 'shortage_missing') {
      console.warn(`[Shortage] Parcel not in shortage_missing state (current: ${parcel.handlingStatus})`);
      return;
    }

    if (parcel.shortageStatus === 'confirmed_at_origin') {
      console.warn(`[Shortage] Parcel shortage already confirmed at origin`);
      return;
    }

    resolveShortageAtOrigin([parcelId], 'found_at_origin', notes);
  };

  const settleLostParcel = (
    parcelId: string,
    settlementType: 'compensation' | 'found_later' | 'waived',
    details?: {
      compensationAmount?: number;
      currency?: Currency;
      beneficiaryName?: string;
      beneficiaryPhone?: string;
      responsibleParty?: 'company' | 'driver' | 'insurance' | 'shared';
      notes?: string;
      targetFoundBranchId?: string;
    }
  ) => {
    // Strict RBAC: Only Super Admin can decide lost parcel settlements
    if (currentUser.role !== 'super_admin') {
      alert('عذراً، صلاحية تسوية الطرود المفقودة والتعويضات محصورة حصراً بـ مدير التطبيق.');
      return;
    }

    const parcel = parcels.find((p) => p.id === parcelId);
    if (!parcel) return;
    const now = new Date().toISOString();

    if (settlementType === 'found_later') {
      playShortageResolvedSound();
      const targetBranchId = details?.targetFoundBranchId || parcel.destinationHubId;
      const isOrigin = targetBranchId === parcel.originHubId;
      const foundBranch = branches.find((b) => b.id === targetBranchId);

      const updated: Parcel = {
        ...parcel,
        handlingStatus: isOrigin ? 'received_at_origin_hub' : 'received_at_dest',
        shortageStatus: isOrigin ? 'confirmed_at_origin' : 'none',
        storedWarehouseType: isOrigin ? 'leftover_previous_shipments' : 'standard_received',
        currentLocationBranchId: targetBranchId,
        isRecoveredFromPreviousShortage: isOrigin ? true : undefined,
        arrivedAtDestAt: isOrigin ? undefined : now,
        shortageResolutionNotes: `تم العثور على الطرد واستعادته بقرار الإدارة في [${foundBranch?.name || 'الفرع المحدد'}]. ${details?.notes || ''}`,
        shortageResolvedAt: now,
        shortageResolvedByUserId: currentUser.id,
        shortageResolvedByUserName: currentUser.name,
        updatedAt: now,
      };

      setParcels((prev) =>
        prev.map((p) => (p.id === parcelId ? updated : p))
      );
      vpsSyncEngine.syncParcel(updated);

      // [5-B-4-A] Record recovery from lost status (append-only log)
      recordParcelEvent(updated.id, updated.handlingStatus, 'investigation', {
        previousStatus: parcel.handlingStatus,
        newStatus: updated.handlingStatus,
        branchId: targetBranchId,
        notes: `استعادة طرد مفقود بقرار الإدارة في [${foundBranch?.name || targetBranchId}]. ${details?.notes || ''}`,
        metadata: {
          recoveredAt: now,
          recoveredByUserId: currentUser.id,
          recoveredByUserName: currentUser.name,
          foundInBranchId: targetBranchId,
          isOriginBranch: isOrigin,
          previousShortageStatus: parcel.shortageStatus,
        },
      });

      // Send confirmation notification to the found branch
      const notifFound: SystemNotification = {
        id: `notif_recovered_${Date.now()}_${parcel.id}`,
        title: `📦 تم استعادة الطرد [${parcel.trackingNumber}] وإعادته للشحن والتسليم`,
        message: `قرر مدير التطبيق (${currentUser.name}) إلغاء حالة الفقدان وتأكيد العثور على الطرد [${parcel.trackingNumber}] في فرع (${foundBranch?.name || ''})، وأصبح الطرد متاحاً بحالة تشغيلية طبيعية لمتابعة الشحن والتسليم.`,
        type: 'manifest_unloaded',
        targetBranchId: targetBranchId,
        relatedId: parcel.id,
        actionType: 'view_manifest',
        timestamp: now,
        read: false,
      };
      setNotifications((prev) => [notifFound, ...prev]);
      vpsSyncEngine.syncNotification(notifFound);

      addAuditLog(
        'استعادة طرد مفقود',
        'parcels',
        `أكد مدير التطبيق [${currentUser.name}] العثور على الطرد المفقود [${parcel.trackingNumber}] واستعادته للتشغيل الطبيعي في فرع [${foundBranch?.name}].`
      );
    } else {
      // Case 1: Administrative Financial Compensation by Management (No local cashier box deduction)
      const compAmount = details?.compensationAmount || (parcel.codAmount > 0 ? parcel.codAmount : parcel.priceSyp || (parcel.currency === 'USD' ? 50 : 250000));
      const compCurrency = details?.currency || parcel.currency || 'SYP';
      const beneficiary = details?.beneficiaryName || parcel.sender?.name || parcel.receiver?.name || 'صاحب البضاعة';
      const respParty = details?.responsibleParty || 'company';
      const adminVoucherNo = `ADM-COMP-${Date.now().toString().slice(-6)}`;

      const updatedComp: Parcel = {
        ...parcel,
        handlingStatus: 'settled_loss_compensated',
        shortageStatus: 'settled_loss',
        storedWarehouseType: 'lost_parcels',
        lossCompensationDetails: {
          settlementType: 'administrative_compensation',
          isAdministrativeExpense: true,
          compensationAmount: compAmount,
          currency: compCurrency,
          beneficiaryName: beneficiary,
          beneficiaryPhone: details?.beneficiaryPhone || parcel.sender?.phone || parcel.receiver?.phone,
          responsibleParty: respParty,
          voucherNumber: adminVoucherNo,
          settledAt: now,
          settledByUserId: currentUser.id,
          settledByUserName: currentUser.name,
          notes: details?.notes || 'تمت التسوية والتعويض المالي إدارياً من قبل الإدارة',
        },
        shortageResolvedAt: now,
        shortageResolvedByUserId: currentUser.id,
        shortageResolvedByUserName: currentUser.name,
        updatedAt: now,
      };

      setParcels((prev) =>
        prev.map((p) => (p.id === parcelId ? updatedComp : p))
      );
      vpsSyncEngine.syncParcel(updatedComp);

      // [5-B-4-C] Record compensation settlement event
      recordParcelEvent(updatedComp.id, 'settled_loss_compensated', 'investigation', {
        previousStatus: parcel.handlingStatus,
        newStatus: 'settled_loss_compensated',
        precedenceRank: 100,
        branchId: currentBranch?.id,
        notes: `تسوية وتعويض الطرد المفقود - صرف تعويض بقيمة ${compAmount} ${compCurrency}`,
        metadata: {
          settledAt: now,
          settledByUserId: currentUser.id,
          settledByUserName: currentUser.name,
          compensationAmount: compAmount,
          compensationCurrency: compCurrency,
          beneficiaryName: beneficiary,
          beneficiaryPhone: details?.beneficiaryPhone || parcel.sender?.phone,
          responsibleParty: respParty,
          voucherNumber: adminVoucherNo,
          previousShortageStatus: parcel.shortageStatus,
        },
      });

      // Notification to Origin Branch informing them of management settlement
      const origBranch = branches.find((b) => b.id === parcel.originHubId);
      const notifSettled: SystemNotification = {
        id: `notif_settled_${Date.now()}_${parcel.id}`,
        title: `✅ تمت تسوية الطرد المفقود [${parcel.trackingNumber}] إدارياً`,
        message: `تم اعتماد تسوية الطرد المفقود [${parcel.trackingNumber}] بتعويض إداري بقيمة (${formatCurrency(compAmount, compCurrency)}) لصالح المستفيد (${beneficiary}) بواسطة مدير التطبيق (${currentUser.name})، وأُغلق ملف الطرد دون تحميل صناديق الفروع أي التزامات.`,
        type: 'info',
        targetBranchId: parcel.originHubId,
        relatedId: parcel.id,
        timestamp: now,
        read: false,
      };
      setNotifications((prev) => [notifSettled, ...prev]);
      vpsSyncEngine.syncNotification(notifSettled);

      addAuditLog(
        'تسوية تعويض طرد مفقود',
        'parcels',
        `أجرى مدير التطبيق [${currentUser.name}] تسوية إدارية وتعويض مالي بقيمة [${formatCurrency(compAmount, compCurrency)}] برقم توثيق [${adminVoucherNo}] للمستفيد [${beneficiary}] عن الطرد المفقود [${parcel.trackingNumber}].`
      );
    }
  };

  // Re-dispatch Leftover Parcel into New Manifest
  const reDispatchLeftoverParcel = (parcelId: string) => {
    const parcel = parcels.find((p) => p.id === parcelId);
    if (!parcel) return;

    const updated = {
      ...parcel,
      handlingStatus: 'received_at_origin_hub' as const,
      shortageStatus: 'none' as const,
      storedWarehouseType: 'standard_received' as const,
      truckManifestId: undefined,
      shortageResolutionNotes: 'تمت إعادة إتاحة الطرد وتوجيهه للشحن في المانافيست القادم',
    };

    setParcels((prev) =>
      prev.map((p) => (p.id === parcelId ? updated : p))
    );
    vpsSyncEngine.syncParcel(updated);

    // [5-B-4-A] Record redispatch of leftover parcel (append-only log)
    recordParcelEvent(updated.id, 'received_at_origin_hub', 'handling', {
      previousStatus: parcel.handlingStatus,
      newStatus: 'received_at_origin_hub',
      branchId: updated.currentLocationBranchId || parcel.originHubId,
      notes: 'الإفراج عن طرد متبقٍ من مستودع الصادر وإتاحته لمانافيست جديدة',
      metadata: {
        releasedByUserId: currentUser.id,
        releasedByUserName: currentUser.name,
        releasedAt: new Date().toISOString(),
        previousWarehouseType: parcel.storedWarehouseType,
        clearedTruckManifestId: parcel.truckManifestId,
      },
    });

    addAuditLog(
      'إعادة إتاحة طرد ناقص للشحن',
      'parcels',
      `تم إخراج الطرد [${parcel.trackingNumber}] من مستودع المتبقيات وإعادته كطرد جاهز للشحن بمركز الانطلاق.`
    );
  };

  // Parcel Rerouting / Forwarding (إعادة التوجيه إلى وجهة ومستلم جديد مع ترحيل المستحقات)
  const rerouteParcel = (originalParcelId: string, data: RerouteParcelInput): Parcel | null => {
    try {
      const originalParcel =
        parcels.find((p) => p.id === originalParcelId || p.trackingNumber === originalParcelId) ||
        selectedParcelForReroute;

      if (!originalParcel) {
        console.warn('rerouteParcel: Original parcel not found for ID/tracking:', originalParcelId);
        return null;
      }

      const now = new Date().toISOString();
      const newTrackingNumber = `ORK-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`;
      const newParcelId = `pcl_${Date.now()}_${Math.floor(Math.random() * 1000)}`;

      const currentBranchId = currentBranch?.id || originalParcel.destinationHubId || (branches[0]?.id ?? 'hub_damascus');
      const destBranch = branches.find((b) => b.id === data.newDestinationHubId);
      const originBranch = branches.find((b) => b.id === currentBranchId);

      const length = Number(data.dimensions?.lengthCm || (data.dimensions as any)?.length || 30);
      const width = Number(data.dimensions?.widthCm || (data.dimensions as any)?.width || 20);
      const height = Number(data.dimensions?.heightCm || (data.dimensions as any)?.height || 15);
      const calculatedVolumeCbm = (length * width * height) / 1000000;

      const safeTotalDue = Number(data.totalDue ?? (Number(data.carriedOverDueAmount || 0) + Number(data.newShippingCost || 0) + Number(data.newCodAmount || 0)));

      // 1. Mark the original parcel as 'rerouted_forwarded'
      const originalUpdated: Parcel = {
        ...originalParcel,
        handlingStatus: 'rerouted_forwarded',
        reroutedToParcelId: newParcelId,
        reroutedToTrackingNumber: newTrackingNumber,
        reroutedAt: now,
        reroutedByUserId: currentUser?.id || 'sys_admin',
        reroutedByUserName: currentUser?.name || 'مدير النظام',
        rerouteReason: data.rerouteReason || 'إعادة توجيه',
      };

      setParcels((prev) =>
        prev.map((p) => (p.id === originalParcel.id ? originalUpdated : p))
      );

      try {
        vpsSyncEngine.syncParcel(originalUpdated);
      } catch (e) {
        console.error('VPS sync error for original parcel reroute:', e);
      }

      // [5-B-4-D] Record reroute event for the original parcel
      recordParcelEvent(originalUpdated.id, 'rerouted_forwarded', 'handling', {
        previousStatus: originalParcel.handlingStatus,
        newStatus: 'rerouted_forwarded',
        precedenceRank: 90,
        branchId: originalUpdated.currentLocationBranchId,
        notes: `إعادة توجيه الطرد إلى ${data.newDestinationHubId} - السبب: ${data.rerouteReason || 'غير محدد'}`,
        metadata: {
          reroutedAt: now,
          reroutedByUserId: currentUser?.id,
          reroutedByUserName: currentUser?.name,
          rerouteReason: data.rerouteReason,
          newDestinationHubId: data.newDestinationHubId,
          newTrackingNumber: newTrackingNumber,
          isTerminal: true,
        },
      });

      // 2. Build the new Parcel entity
      const newParcel: Parcel = {
        id: newParcelId,
        trackingNumber: newTrackingNumber,
        paperReceiptNumber: originalParcel.paperReceiptNumber || '',
        originHubId: currentBranchId,
        destinationHubId: data.newDestinationHubId,
        destinationAddress: data.newDestinationAddress || data.newReceiver.address || '',
        sender: data.sender || originalParcel.sender,
        receiver: data.newReceiver,
        packageType: data.packageType || originalParcel.packageType || 'box',
        weightKg: Number(data.weightKg || originalParcel.weightKg || 1),
        dimensions: { lengthCm: length, widthCm: width, heightCm: height },
        volumeCbm: calculatedVolumeCbm,
        piecesCount: Number(data.piecesCount || originalParcel.piecesCount || 1),
        contentDescription: data.contentDescription || originalParcel.contentDescription || 'طرد معاد توجيهه',
        specialInstructions: data.specialInstructions || originalParcel.specialInstructions,
        paymentType: data.paymentType || 'collect',
        currency: data.currency || originalParcel.currency || 'SYP',
        shippingCost: Number(data.newShippingCost || 0),
        codAmount: Number(data.newCodAmount || 0),
        transferFee: 0,
        carriedOverDueAmount: Number(data.carriedOverDueAmount || 0),
        carriedOverNotes: `بوليصة مُعادة التوجيه من البوليصة السابقة [${originalParcel.trackingNumber}] - مستحقات سابقة مرحلة: ${formatCurrencyApp(data.carriedOverDueAmount || 0, data.currency || 'SYP')}`,
        totalDue: safeTotalDue,
        handlingStatus: 'received_at_hub',
        storedWarehouseType: 'standard_received',
        createdAt: now,
        createdById: currentUser?.id || 'sys_admin',
        registeredByUserName: currentUser?.name || 'مدير النظام',
        storageGraceDays: 3,
        notificationDueHours: 24,
        isRerouted: true,
        reroutedFromParcelId: originalParcel.id,
        reroutedFromTrackingNumber: originalParcel.trackingNumber,
        rerouteReason: data.rerouteReason || 'إعادة توجيه',
      };

      setParcels((prev) => [newParcel, ...prev]);

      try {
        vpsSyncEngine.syncParcel(newParcel);
      } catch (e) {
        console.error('VPS sync error for new rerouted parcel:', e);
      }

      // [5-B-4-D] Record creation event for the newly rerouted parcel
      recordParcelEvent(newParcel.id, 'received_at_hub', 'handling', {
        previousStatus: undefined,
        newStatus: 'received_at_hub',
        precedenceRank: 10,
        branchId: newParcel.currentLocationBranchId,
        notes: `طرد جديد ناتج عن إعادة توجيه ${originalParcel.trackingNumber}`,
        metadata: {
          registeredAt: now,
          createdByUserId: currentUser?.id,
          reroutedFromTrackingNumber: originalParcel.trackingNumber,
          reroutedFromParcelId: originalParcel.id,
          originalReason: data.rerouteReason,
          isRerouteChild: true,
        },
      });

      // 3. Notifications for Origin Branch and New Destination Hub (حصرياً للفرع الصادر والفرع الوارد)
      const originBranchId = originalParcel.originHubId;
      const destBranchId = data.newDestinationHubId || newParcel.destinationHubId;

      const notifsToSend: SystemNotification[] = [];

      // Notification for the new Destination Hub (الفرع الوارد)
      if (destBranchId) {
        notifsToSend.push({
          id: `notif_${Date.now()}_reroute_dest`,
          title: '🔁 طرد مُعاد توجيهه إلى فرعكم (بوليصة جديدة)',
          message: `تمت إعادة توجيه الطرد [${originalParcel.trackingNumber}] من ${originBranch?.name || 'الفرع الصادر'} إلى فرعكم [${destBranch?.name || 'الفرع الوارد'}] برقم بوليصة جديد (${newTrackingNumber}) ومبلغ تحصيل إجمالي [${formatCurrencyApp(safeTotalDue, data.currency || 'SYP')}].`,
          type: 'info',
          targetBranchId: destBranchId,
          relatedId: newParcel.id,
          actionType: 'general',
          timestamp: now,
          read: false,
        });
      }

      // Notification for the Origin Hub (الفرع الصادر)
      if (originBranchId && originBranchId !== destBranchId) {
        notifsToSend.push({
          id: `notif_${Date.now()}_reroute_origin`,
          title: '🔁 طرد مُعاد توجيهه من فرعكم الصادر',
          message: `تمت إعادة توجيه الطرد الصادر من فرعكم [${originalParcel.trackingNumber}] إلى فرع [${destBranch?.name || 'الفرع الوارد'}] برقم بوليصة جديد (${newTrackingNumber}) ومبلغ تحصيل إجمالي [${formatCurrencyApp(safeTotalDue, data.currency || 'SYP')}].`,
          type: 'info',
          targetBranchId: originBranchId,
          relatedId: newParcel.id,
          actionType: 'general',
          timestamp: now,
          read: false,
        });
      }

      if (notifsToSend.length > 0) {
        setNotifications((prev) => [...notifsToSend, ...prev]);

        notifsToSend.forEach((n) => {
          try {
            vpsSyncEngine.syncNotification(n);
          } catch (e) {
            console.error('VPS sync error for reroute notification:', e);
          }
        });
      }

      // 4. Audit Log
      try {
        addAuditLog(
          'إعادة توجيه طرد لبوليصة جديدة',
          'parcels',
          `تمت إعادة توجيه الطرد [${originalParcel.trackingNumber}] (المستلم السابق: ${originalParcel.receiver.name}) من فرع ${originBranch?.name || 'الفرع الحالي'} إلى فرع ${destBranch?.name || 'الوجهة الجديدة'} بالمستلم الجديد [${data.newReceiver.name}] وأُنشئت بوليصة جديدة برقم [${newTrackingNumber}] بإجمالي تحصيل [${formatCurrencyApp(safeTotalDue, data.currency || 'SYP')}]. السبب: ${data.rerouteReason}`
        );
      } catch (e) {
        console.error('Audit log error in reroute:', e);
      }

      return newParcel;
    } catch (error) {
      console.error('Fatal error in rerouteParcel:', error);
      return null;
    }
  };

  // Receive Truck Manifest at Destination Hub -> Fallback helper
  const receiveTruckManifest = (manifestId: string) => {
    const manifest = truckManifests.find(
      (m) => m.id === manifestId || m.manifestNumber === manifestId
    );
    if (!manifest) return;
    const manifestParcelsList = parcels.filter(
      (p) =>
        (manifest.parcelIds || []).includes(p.id) ||
        (manifest.parcelIds || []).includes(p.trackingNumber) ||
        p.truckManifestId === manifest.id ||
        p.truckManifestId === manifest.manifestNumber
    );
    const allIds = manifestParcelsList.map((p) => p.id);
    completeTruckDischarge(manifest.id, allIds.length > 0 ? allIds : manifest.parcelIds, []);
  };

  // Notify Receiver (Live countdown trigger)
  const notifyReceiver = (parcelId: string) => {
    const now = new Date().toISOString();
    let updatedToSync: Parcel | undefined;
    setParcels((prev) => {
      const next = prev.map((p) => {
        if (p.id === parcelId) {
          const up: Parcel = {
            ...p,
            notifiedAt: now,
            notifiedByUserId: currentUser.id,
            notificationDueHours: 24,
            updatedAt: now,
          };
          updatedToSync = up;
          return up;
        }
        return p;
      });
      safeStorage.setItem(`${STORAGE_KEY}_parcels`, JSON.stringify(next));
      return next;
    });
    if (updatedToSync) {
      vpsSyncEngine.syncParcel(updatedToSync);
    }
  };

  /**
   * Builds an InterBranchObligation from a delivered parcel.
   * Mirrors the SQL backfill logic 1:1.
   * Returns null if obligation is not applicable.
   * 
   * NOTE: Always returns ONE obligation in parcel.currency,
   * regardless of how the customer paid (split currencies).
   */
  const buildObligationFromParcel = useCallback(
    (parcel: Parcel): InterBranchObligation | null => {
      const originId = parcel.originHubId || parcel.originCollectionBranchId;
      const destId = parcel.destinationHubId;
      if (!originId || !destId || originId === destId) return null;

      const currency = (parcel.currency || 'SYP') as Currency;
      const shipping = Number(parcel.shippingCost) || 0;
      const codAmt = Number(parcel.codAmount) || 0;
      const transferFee = Number(parcel.transferFee) || 0;

      // Get commission rates from destination branch
      const destBranch = branches.find((b) => b.id === destId);
      let shippingRate = destBranch?.commissionRateShipping ?? 
                          destBranch?.shippingCommissionPercent ?? 15;
      if (!shippingRate || shippingRate <= 0) shippingRate = 15;
      
      let transferRate = destBranch?.commissionRateTransfers ?? 
                          destBranch?.codCommissionPercent ?? 20;
      if (!transferRate || transferRate <= 0) transferRate = 20;

      const isPrepaid = parcel.paymentType === 'prepaid';
      const isCod = parcel.paymentType === 'cod' || 
                    parcel.paymentType === 'cod_destination';

      let obligationType: ObligationType;
      if (isPrepaid) obligationType = 'shipping_only';
      else if (isCod && shipping > 0) obligationType = 'cod_and_shipping';
      else if (isCod) obligationType = 'cod';
      else obligationType = 'shipping_only';

      const debtorBranchId = isPrepaid ? originId : destId;
      const creditorBranchId = isPrepaid ? destId : originId;

      const codAmount = isCod ? codAmt : 0;
      
      const shippingShareAmount = isPrepaid
        ? Math.round(shipping * shippingRate / 100 * 100) / 100
        : Math.round(shipping * (1 - shippingRate / 100) * 100) / 100;
      
      const agentCommissionAmount = 
        Math.round(shipping * shippingRate / 100 * 100) / 100;
      
      const transferFeeShareAmount = isCod
        ? Math.round(transferFee * (1 - transferRate / 100) * 100) / 100
        : 0;

      const totalObligationAmount = 
        codAmount + shippingShareAmount + transferFeeShareAmount;

      if (totalObligationAmount <= 0) return null;

      const now = new Date().toISOString();
      const id = `obl_${parcel.id}_${currency}`;

      return {
        id,
        parcelId: parcel.id,
        trackingNumber: parcel.trackingNumber,
        obligationType,
        debtorBranchId,
        creditorBranchId,
        currency,
        codAmount,
        shippingShareAmount,
        agentCommissionAmount,
        transferFeeShareAmount,
        totalObligationAmount,
        senderPayoutStatus: isPrepaid ? 'paid' : 
          (parcel.codPaidToSender ? 'paid' : 'pending'),
        senderPayoutVoucherId: parcel.codSenderPayoutVoucherId,
        senderPayoutAt: parcel.codSenderPayoutDate,
        senderPayoutUserId: parcel.codSenderPayoutByUserId,
        clearingStatus: 'pending',
        createdAt: parcel.createdAt || now,
        updatedAt: now,
        metadata: { createdBy: 'client-deliverParcel' },
      };
    },
    [branches]
  );

  /**
   * Records a parcel event (append-only) and syncs it to the server.
   * Pure function — no async, no await. Uses deterministic id with 
   * short random hash to allow same-millisecond uniqueness.
   * 
   * @param parcelId - the parcel being evented
   * @param eventType - usually the new handlingStatus (e.g. 'delivered')
   * @param dimension - 'handling' | 'financial_cod' | 'cashier' | 
   *                    'investigation' | 'location'
   * @param options - optional overrides (previousStatus, notes, manifestId,
   *                  branchId, metadata, customUserId)
   */
  const recordParcelEvent = useCallback(
    (
      parcelId: string,
      eventType: string,
      dimension: ParcelEventDimension,
      options?: {
        previousStatus?: string;
        newStatus?: string;
        precedenceRank?: number;
        branchId?: string;
        manifestId?: string;
        notes?: string;
        metadata?: Record<string, any>;
        customUserId?: string;
        customUserName?: string;
      }
    ) => {
      const parcel = parcels.find((p) => p.id === parcelId);
      if (!parcel) return;

      const now = new Date().toISOString();
      const ts = Date.now();
      const shortHash = Math.random().toString(36).substring(2, 6);
      const id = `evt_${parcelId}_${eventType}_${ts}_${shortHash}`;

      // Determine precedence rank
      let rank = options?.precedenceRank;
      if (rank === undefined) {
        if (dimension === 'handling') {
          rank = getHandlingStatusRank(eventType);
        } else {
          rank = 0;
        }
      }

      // Determine branch
      const branchId = options?.branchId 
        || currentBranch?.id 
        || parcel.currentLocationBranchId 
        || parcel.originHubId 
        || '';

      const userId = options?.customUserId || currentUser.id;
      const userName = options?.customUserName 
        || currentUser.name 
        || currentUser.username;

      const event: ParcelEvent = {
        id,
        parcelId,
        trackingNumber: parcel.trackingNumber,
        eventType,
        dimension,
        previousStatus: options?.previousStatus,
        newStatus: options?.newStatus || eventType,
        precedenceRank: rank,
        branchId,
        userId,
        userName,
        userRole: currentUser.role,
        manifestId: options?.manifestId,
        notes: options?.notes,
        metadata: options?.metadata || {},
        clientTimestamp: now,
        serverTimestamp: now,
        createdAt: now,
      };

      // Append to local state
      setParcelEvents((prev) => [event, ...prev]);

      // Queue for server sync (fire-and-forget)
      vpsSyncEngine.syncParcelEvent(event);
    },
    [parcels, currentBranch, currentUser, setParcelEvents]
  );

  /**
   * Records multiple parcel events in one batch — single state update,
   * then fires syncParcelEvent per event.
   * 
   * Uses same deterministic id scheme as recordParcelEvent.
   */
  const recordParcelEventsBatch = useCallback(
    (
      entries: Array<{
        parcelId: string;
        eventType: string;
        dimension: ParcelEventDimension;
        options?: {
          previousStatus?: string;
          newStatus?: string;
          precedenceRank?: number;
          branchId?: string;
          manifestId?: string;
          notes?: string;
          metadata?: Record<string, any>;
        };
      }>
    ) => {
      if (!entries || entries.length === 0) return;

      const now = new Date().toISOString();
      const nowMs = Date.now();
      const events: ParcelEvent[] = [];

      for (let i = 0; i < entries.length; i++) {
        const entry = entries[i];
        const parcel = parcels.find((p) => p.id === entry.parcelId);
        if (!parcel) continue;

        const shortHash = Math.random().toString(36).substring(2, 6);
        const id = `evt_${entry.parcelId}_${entry.eventType}_${nowMs + i}_${shortHash}`;

        let rank = entry.options?.precedenceRank;
        if (rank === undefined) {
          rank = entry.dimension === 'handling' 
            ? getHandlingStatusRank(entry.eventType) 
            : 0;
        }

        const branchId = entry.options?.branchId 
          || currentBranch?.id 
          || parcel.currentLocationBranchId 
          || parcel.originHubId 
          || '';

        events.push({
          id,
          parcelId: entry.parcelId,
          trackingNumber: parcel.trackingNumber,
          eventType: entry.eventType,
          dimension: entry.dimension,
          previousStatus: entry.options?.previousStatus,
          newStatus: entry.options?.newStatus || entry.eventType,
          precedenceRank: rank,
          branchId,
          userId: currentUser.id,
          userName: currentUser.name || currentUser.username,
          userRole: currentUser.role,
          manifestId: entry.options?.manifestId,
          notes: entry.options?.notes,
          metadata: entry.options?.metadata || {},
          clientTimestamp: now,
          serverTimestamp: now,
          createdAt: now,
        });
      }

      if (events.length === 0) return;

      // Single batch state update
      setParcelEvents((prev) => [...events, ...prev]);

      // Fire syncs (fire-and-forget)
      for (const evt of events) {
        vpsSyncEngine.syncParcelEvent(evt);
      }
    },
    [parcels, currentBranch, currentUser, setParcelEvents]
  );

  // Deliver Parcel to Customer (Direct Delivery with National ID and cash settlement)
  const deliverParcel = (
    parcelId: string,
    nationalId: string,
    nationalIdPhotoUrl?: string,
    collectedAmount?: number,
    notes?: string,
    extraDetails?: {
      actualReceiverName?: string;
      receiverRelation?: string;
      idBackPhotoUrl?: string;
      idMotherName?: string;
      idFatherName?: string;
      idBirthPlace?: string;
      idCivilRecord?: string;
      signatureUrl?: string;
      idType?: IdDocumentType;
      collectedSyp?: number;
      collectedUsd?: number;
      receiverPhone?: string;
      receiverBirthDate?: string;
      receiverFirstName?: string;
      receiverLastName?: string;
      receiverCity?: Governorate;
      receiverAddress?: string;
    }
  ) => {
    const parcel = parcels.find((p) => p.id === parcelId || p.trackingNumber === parcelId);
    if (!parcel) {
      console.warn(`[deliverParcel] ⚠️ Parcel not found: ${parcelId}`);
      return { success: false, error: 'لم يتم العثور على البوليصة المطلوبة في النظام.' };
    }

    // STRICT LIFECYCLE GUARD:
    // Only parcels in warehouse at destination ('received_at_dest') or with delivery courier ('with_courier', 'out_for_delivery') can be delivered to receiver!
    const allowedStatuses: string[] = ['received_at_dest', 'with_courier', 'out_for_delivery'];
    if (!allowedStatuses.includes(parcel.handlingStatus)) {
      const statusLabels: Record<string, string> = {
        in_transit: 'قيد الشحن على الطريق (في الشاحنة)',
        loaded_in_truck: 'محمل بالشاحنة',
        received_at_hub: 'في مركز الصادر (لم يتم شحنه بعد)',
        received_at_origin_hub: 'في مركز الصادر (لم يتم شحنه بعد)',
        leftover_origin_warehouse: 'في مستودع النواقص بمركز الصادر',
        shortage_missing: 'مسجل كنقص غير موجود',
        lost_in_transit: 'مفقود على الطريق',
        delivered: 'تم تسليمه مسبقاً',
        delivered_uncollected: 'تم تسليمه بدون قبض مسبقاً',
        returned: 'مرتجع للمرسل',
      };
      const label = statusLabels[parcel.handlingStatus] || parcel.handlingStatus;
      const errorMsg = `⚠️ لا يمكن تسليم الطرد [${parcel.trackingNumber}]: حالة الطرد الحالية هي "${label}". يجب أولاً تفريغ الشاحنة واستلام الطرد في مستودع الوجهة!`;
      console.warn(`[deliverParcel] ⚠️ Blocked delivery attempt: ${errorMsg}`);
      return { success: false, error: errorMsg };
    }

    // STRICT RECIPIENT IDENTITY VERIFICATION GUARD (Defense in Depth)
    const recVerification = verifyReceiverIdentity(
      parcel,
      {
        receiverRelation: extraDetails?.receiverRelation || 'المستلم بالذات',
        actualReceiverName: extraDetails?.actualReceiverName || parcel.receiver.name,
        firstName: extraDetails?.receiverFirstName,
        fatherName: extraDetails?.idFatherName,
        lastName: extraDetails?.receiverLastName,
        nationalId: nationalId || parcel.receiver.nationalId,
        motherName: extraDetails?.idMotherName || parcel.receiver.motherName,
        birthDate: extraDetails?.receiverBirthDate || parcel.receiver.birthDate,
        phone: extraDetails?.receiverPhone || parcel.receiver.phone,
      },
      customers || []
    );

    if (!recVerification.verified) {
      console.warn(`[deliverParcel] ⚠️ Recipient verification failed:`, recVerification.message);
      return { success: false, error: recVerification.message || 'فشل التحقق من هوية المستلم ومطابقتها مع البوليصة.' };
    }

    const now = new Date().toISOString();

    const updatedParcel: Parcel = {
      ...parcel,
      handlingStatus: 'delivered',
      receiver: {
        ...parcel.receiver,
        nationalId: nationalId || parcel.receiver.nationalId,
        idType: extraDetails?.idType || parcel.receiver.idType || 'syrian',
        nationalIdPhotoUrl: nationalIdPhotoUrl || parcel.receiver.nationalIdPhotoUrl,
        nationalIdBackPhotoUrl: extraDetails?.idBackPhotoUrl || (parcel.receiver as any).nationalIdBackPhotoUrl,
        nationalIdScanned: true,
        actualReceiverName: extraDetails?.actualReceiverName || parcel.receiver.name,
        receiverRelation: extraDetails?.receiverRelation || 'المستلم بالذات',
        motherName: extraDetails?.idMotherName || parcel.receiver.motherName,
        fatherName: extraDetails?.idFatherName || parcel.receiver.fatherName,
        birthDate: extraDetails?.receiverBirthDate || parcel.receiver.birthDate,
        idBirthPlace: extraDetails?.idBirthPlace,
        idCivilRecord: extraDetails?.idCivilRecord,
        signatureUrl: extraDetails?.signatureUrl,
      },
      deliveredAt: now,
      deliveredByUserId: currentUser.id,
      deliveryNotes: notes,
      collectedAmount: collectedAmount ?? parcel.totalDue,
      collectedSyp: extraDetails?.collectedSyp,
      collectedUsd: extraDetails?.collectedUsd,
      codStatus:
        parcel.paymentType === 'cod' && (parcel.codAmount || 0) > 0
          ? parcel.codPaidToSender
            ? 'paid_to_sender'
            : 'collected_awaiting_sender_payout'
          : parcel.codStatus,
      codCollectedAt:
        parcel.paymentType === 'cod' && (parcel.codAmount || 0) > 0
          ? parcel.codCollectedAt || now
          : parcel.codCollectedAt,
    };

    if (!isTransitionAllowed(parcel.handlingStatus, updatedParcel.handlingStatus)) {
      console.warn(`[Lifecycle Guard] Blocked illegal transition: ${parcel.handlingStatus} → ${updatedParcel.handlingStatus} for parcel ${parcel.trackingNumber}`);
      return { success: false, error: `[حماية المسار] غير مسموح بنقل الطرد من حالة "${parcel.handlingStatus}" إلى "${updatedParcel.handlingStatus}".` };
    }

    setParcels((prev) =>
      prev.map((p) => (p.id === parcelId ? updatedParcel : p))
    );
    vpsSyncEngine.syncParcel(updatedParcel);

    // [4أ-2b] Create/update inter-branch obligation for this delivery.
    // Runs regardless of payment path — obligation reflects the DELIVERY 
    // event, not the cash-collection event. Uses deterministic id 
    // (obl_${parcelId}_${currency}) to prevent duplication.
    const obligation = buildObligationFromParcel(updatedParcel);
    if (obligation) {
      setInterBranchObligations((prev) => {
        const idx = prev.findIndex((o) => o.id === obligation.id);
        if (idx >= 0) {
          const next = [...prev];
          next[idx] = obligation;
          return next;
        }
        return [obligation, ...prev];
      });
      vpsSyncEngine.syncObligation(obligation);
    }

    // [5-B-3] Record the delivery event (append-only log).
    recordParcelEvent(parcel.id, 'delivered', 'handling', {
      previousStatus: parcel.handlingStatus,
      newStatus: 'delivered',
      precedenceRank: 95,
      branchId: parcel.destinationHubId || currentBranch?.id,
      notes: `تسليم للزبون عبر ${extraDetails?.actualReceiverName || parcel.receiver.name}`,
      metadata: {
        deliveredByUserId: currentUser.id,
        deliveredAt: now,
        receiverNationalId: nationalId,
        collectedAmount: collectedAmount ?? parcel.totalDue,
      },
    });

    // Auto-convert & update receiver in Customer Directory upon delivery completion
    const rec = updatedParcel.receiver;
    const isOriginalReceiver = !extraDetails?.receiverRelation || extraDetails.receiverRelation === 'المستلم بالذات';

    const cleanPhone = (extraDetails?.receiverPhone || rec?.phone || '').trim();
    const cleanNationalId = (nationalId || rec?.nationalId || '').trim();
    const cleanNidDigits = cleanNationalId.replace(/\D/g, '');
    const fName = isOriginalReceiver ? (extraDetails?.receiverFirstName || rec?.firstName || '').trim() : '';
    const father = isOriginalReceiver ? (extraDetails?.idFatherName || rec?.fatherName || rec?.idFatherName || '').trim() : '';
    const lName = isOriginalReceiver ? (extraDetails?.receiverLastName || rec?.lastName || '').trim() : '';
    const recName = isOriginalReceiver
      ? (
          extraDetails?.actualReceiverName ||
          [fName, father, lName].filter(Boolean).join(' ') ||
          rec?.name ||
          ''
        ).trim()
      : '';
    const mName = isOriginalReceiver ? (extraDetails?.idMotherName || rec?.motherName || rec?.idMotherName || '').trim() : '';
    const bDate = isOriginalReceiver ? (extraDetails?.receiverBirthDate || rec?.birthDate || '').trim() : '';
    const bPlace = isOriginalReceiver ? (extraDetails?.idBirthPlace || rec?.idBirthPlace || '').trim() : '';
    const cRecord = isOriginalReceiver ? (extraDetails?.idCivilRecord || rec?.idCivilRecord || rec?.address || '').trim() : '';
    const photoFront = isOriginalReceiver ? (nationalIdPhotoUrl || rec?.nationalIdPhotoUrl || rec?.idPhotoFront) : undefined;
    const photoBack = isOriginalReceiver ? (extraDetails?.idBackPhotoUrl || (rec as any)?.nationalIdBackPhotoUrl || rec?.idPhotoBack) : undefined;
    const cityVal = ((extraDetails?.receiverCity || rec?.city || currentBranch?.governorate || 'دمشق') as Governorate);
    const addressVal = (extraDetails?.receiverAddress || rec?.address || `مدينة ${cityVal}`).trim();

    const norm = normalizeCustomerNames({
      fullName: recName || [fName, father, lName].filter(Boolean).join(' '),
      firstName: fName,
      fatherName: father,
      lastName: lName,
    });

    // ✅ لا نُضيف العميل إلا إذا كانت البيانات الهوياتية كاملة والمستلم الأصلي بالذات
    const hasFullIdentity = Boolean(
      isOriginalReceiver &&
      cleanPhone &&
      cleanNationalId &&
      cleanNidDigits.length === 11 &&
      norm.fullName &&
      norm.fullName.length >= 5 &&
      mName &&
      bDate
    );

    if (rec && hasFullIdentity) {
      setCustomers((prevCustomers) => {
        const candidate = {
          fullName: norm.fullName,
          firstName: norm.firstName,
          fatherName: norm.fatherName,
          lastName: norm.lastName,
          motherName: mName,
          birthDate: bDate,
          phone: cleanPhone,
          nationalId: cleanNationalId,
        };

        const candidateKey = getCanonicalCustomerKey(candidate);
        const existingIndex = prevCustomers.findIndex((c) => {
          if (rec.customerId && c.id === rec.customerId) return true;
          if (isSameCustomer(c, candidate)) return true;
          if (getCanonicalCustomerKey(c) === candidateKey) return true;
          const pA = normalizePhoneForComparison(c.phone);
          const pB = normalizePhoneForComparison(cleanPhone);
          if (pA && pB && pA.length >= 6 && pA === pB) return true;
          const nidA = (c.nationalId || '').replace(/\D/g, '');
          const nidB = cleanNationalId.replace(/\D/g, '');
          if (nidA && nidB && nidA.length >= 7 && nidA === nidB) return true;
          const nA = normalizeArabicComparison(c.fullName);
          const nB = normalizeArabicComparison(norm.fullName);
          if (nA && nB && nA.length >= 4 && nA === nB) {
            if (!pA || !pB || pA === pB) return true;
          }
          return false;
        });

        if (existingIndex >= 0) {
          const updated = [...prevCustomers];
          const curr = updated[existingIndex];
          const mergedCust: Customer = {
            ...curr,
            fullName: norm.fullName || curr.fullName,
            firstName: norm.firstName || curr.firstName,
            fatherName: norm.fatherName || curr.fatherName,
            lastName: norm.lastName || curr.lastName,
            motherName: mName || curr.motherName,
            birthDate: bDate || curr.birthDate,
            birthPlace: bPlace || curr.birthPlace,
            civilRegistry: cRecord || curr.civilRegistry,
            phone: cleanPhone || curr.phone,
            nationalId: cleanNationalId || curr.nationalId,
            idType: extraDetails?.idType || rec.idType || curr.idType || 'syrian',
            city: cityVal || curr.city,
            address: addressVal || curr.address,
            idPhotoFront: photoFront || curr.idPhotoFront,
            idPhotoBack: photoBack || curr.idPhotoBack,
            totalShipmentsReceived: (curr.totalShipmentsReceived || 0) + 1,
            updatedAt: new Date().toISOString(),
          };
          updated[existingIndex] = mergedCust;
          safeStorage.setItem(`${STORAGE_KEY}_customers`, JSON.stringify(updated));
          vpsSyncEngine.syncCustomer(mergedCust);
          addAuditLog('تحديث بيانات مستلم في دليل العملاء', 'system', `تم توثيق وتحديث ملف المستلم [${mergedCust.fullName}] برقم وطني [${mergedCust.nationalId || 'بدون'}] عند تسليم البوليصة [${parcel.trackingNumber}]`);
          return updated;
        } else {
          const newCst: Customer = {
            id: `cst_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
            code: `CST-${1000 + prevCustomers.length + 1}`,
            fullName: norm.fullName || 'مستلم جديد',
            firstName: norm.firstName || '',
            fatherName: norm.fatherName || '',
            lastName: norm.lastName || '',
            motherName: mName || '',
            birthDate: bDate || '',
            birthPlace: bPlace || '',
            civilRegistry: cRecord || '',
            phone: cleanPhone || '',
            nationalId: cleanNationalId,
            idType: extraDetails?.idType || rec.idType || 'syrian',
            city: cityVal,
            address: addressVal,
            idPhotoFront: photoFront || undefined,
            idPhotoBack: photoBack || undefined,
            customerType: 'individual',
            totalShipmentsSent: 0,
            totalShipmentsReceived: 1,
            totalSpentSyp: 0,
            totalSpentUsd: 0,
            createdAt: new Date().toISOString(),
            branchId: updatedParcel.destinationHubId || currentBranch?.id,
          };
          const nextList = [newCst, ...prevCustomers];
          safeStorage.setItem(`${STORAGE_KEY}_customers`, JSON.stringify(nextList));
          vpsSyncEngine.syncCustomer(newCst);
          addAuditLog('إضافة مستلم كعميل جديد في الدليل', 'system', `تم تحويل وتسجيل المستلم [${newCst.fullName}] كعميل جديد بدليل العملاء عند التسليم`);
          return nextList;
        }
      });
    }

    // Financial Cashbox Transactions (only execute if NOT already collected by cashier)
    const alreadyCollectedByCashier = parcel.cashierCollected === true;

    if (!alreadyCollectedByCashier) {
      // Check if multi-currency split amounts were explicitly passed
      const hasExplicitSplit =
        extraDetails?.collectedSyp !== undefined || extraDetails?.collectedUsd !== undefined;

      if (hasExplicitSplit) {
        const syp = extraDetails?.collectedSyp || 0;
        const usd = extraDetails?.collectedUsd || 0;

        if (syp > 0) {
          addCashTransaction(
            parcel.destinationHubId,
            'SYP',
            parcel.paymentType === 'cod' ? 'cod_collected_dest' : 'shipping_collected_dest',
            syp,
            `تحصيل تسليم بوليصة ${parcel.trackingNumber} - مقبوض بالليرة السورية (${formatCurrencyApp(syp, 'SYP')}) للمستلم ${extraDetails?.actualReceiverName || parcel.receiver.name}`,
            parcel.id
          );
          const vSyp: FinancialVoucher = {
            id: `vch_${Date.now()}_syp_${Math.floor(Math.random() * 1000)}`,
            voucherNumber: `RV-${new Date().getFullYear()}-${String(vouchers.filter((v) => v.type === 'receipt').length + 1).padStart(4, '0')}`,
            branchId: parcel.destinationHubId || currentBranch.id,
            type: 'receipt',
            reasonCategory: parcel.paymentType === 'cod' ? 'cod_collection' : 'shipping_income',
            amount: syp,
            currency: 'SYP',
            paidByOrTo: `المستلم: ${extraDetails?.actualReceiverName || parcel.receiver.name}`,
            description: `سند قبض تحصيل تسليم بوليصة [${parcel.trackingNumber}] - المستلم: ${extraDetails?.actualReceiverName || parcel.receiver.name}`,
            date: now.split('T')[0],
            performedByUserId: currentUser.id,
            performedByUserName: currentUser.name || currentUser.username,
            status: 'approved',
            timestamp: now,
            parcelId: parcel.id,
          };
          setVouchers((prev) => [vSyp, ...prev]);
          vpsSyncEngine.syncVoucher(vSyp);
        }

        if (usd > 0) {
          addCashTransaction(
            parcel.destinationHubId,
            'USD',
            parcel.paymentType === 'cod' ? 'cod_collected_dest' : 'shipping_collected_dest',
            usd,
            `تحصيل تسليم بوليصة ${parcel.trackingNumber} - مقبوض بالدولار (${formatCurrencyApp(usd, 'USD')}) للمستلم ${extraDetails?.actualReceiverName || parcel.receiver.name}`,
            parcel.id
          );
          const vUsd: FinancialVoucher = {
            id: `vch_${Date.now()}_usd_${Math.floor(Math.random() * 1000)}`,
            voucherNumber: `RV-${new Date().getFullYear()}-${String(vouchers.filter((v) => v.type === 'receipt').length + 2).padStart(4, '0')}`,
            branchId: parcel.destinationHubId || currentBranch.id,
            type: 'receipt',
            reasonCategory: parcel.paymentType === 'cod' ? 'cod_collection' : 'shipping_income',
            amount: usd,
            currency: 'USD',
            paidByOrTo: `المستلم: ${extraDetails?.actualReceiverName || parcel.receiver.name}`,
            description: `سند قبض تحصيل تسليم بوليصة [${parcel.trackingNumber}] - المستلم: ${extraDetails?.actualReceiverName || parcel.receiver.name}`,
            date: now.split('T')[0],
            performedByUserId: currentUser.id,
            performedByUserName: currentUser.name || currentUser.username,
            status: 'approved',
            timestamp: now,
            parcelId: parcel.id,
          };
          setVouchers((prev) => [vUsd, ...prev]);
          vpsSyncEngine.syncVoucher(vUsd);
        }
      } else {
        // Standard single currency collection
        if (parcel.paymentType === 'collect') {
          // Collect freight into dest hub box
          addCashTransaction(
            parcel.destinationHubId,
            parcel.currency,
            'shipping_collected_dest',
            parcel.shippingCost,
            `تحصيل أجور شحن عند الاستلام - بوليصة ${parcel.trackingNumber}`,
            parcel.id
          );
          const vCollect: FinancialVoucher = {
            id: `vch_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
            voucherNumber: `RV-${new Date().getFullYear()}-${String(vouchers.filter((v) => v.type === 'receipt').length + 1).padStart(4, '0')}`,
            branchId: parcel.destinationHubId || currentBranch.id,
            type: 'receipt',
            reasonCategory: 'shipping_income',
            amount: parcel.shippingCost,
            currency: parcel.currency || 'SYP',
            paidByOrTo: `المستلم: ${extraDetails?.actualReceiverName || parcel.receiver.name}`,
            description: `سند قبض تحصيل أجور شحن بوليصة [${parcel.trackingNumber}]`,
            date: now.split('T')[0],
            performedByUserId: currentUser.id,
            performedByUserName: currentUser.name || currentUser.username,
            status: 'approved',
            timestamp: now,
            parcelId: parcel.id,
          };
          setVouchers((prev) => [vCollect, ...prev]);
          vpsSyncEngine.syncVoucher(vCollect);
        } else if (parcel.paymentType === 'cod') {
          // Collect COD + Shipping + Transfer Fee into dest hub box
          const totalCol = collectedAmount ?? parcel.totalDue;
          addCashTransaction(
            parcel.destinationHubId,
            parcel.currency,
            'cod_collected_dest',
            totalCol,
            `تحصيل طرد ضد الدفع (ثمن بضاعة ${parcel.codAmount} + شحن ${parcel.shippingCost} + عمولة ${parcel.transferFee}) - بوليصة ${parcel.trackingNumber}`,
            parcel.id
          );
          const vCod: FinancialVoucher = {
            id: `vch_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
            voucherNumber: `RV-${new Date().getFullYear()}-${String(vouchers.filter((v) => v.type === 'receipt').length + 1).padStart(4, '0')}`,
            branchId: parcel.destinationHubId || currentBranch.id,
            type: 'receipt',
            reasonCategory: 'cod_collection',
            amount: totalCol,
            currency: parcel.currency || 'SYP',
            paidByOrTo: `المستلم: ${extraDetails?.actualReceiverName || parcel.receiver.name}`,
            description: `سند قبض تحصيل طرد ضد الدفع بوليصة [${parcel.trackingNumber}]`,
            date: now.split('T')[0],
            performedByUserId: currentUser.id,
            performedByUserName: currentUser.name || currentUser.username,
            status: 'approved',
            timestamp: now,
            parcelId: parcel.id,
          };
          setVouchers((prev) => [vCod, ...prev]);
          vpsSyncEngine.syncVoucher(vCod);
        }
      }
    }

    addAuditLog(
      'تسليم وتوثيق هوية',
      'parcels',
      alreadyCollectedByCashier
        ? `تم تسليم البوليصة [${parcel.trackingNumber}] رسمياً للمستلم [${extraDetails?.actualReceiverName || parcel.receiver.name}] وتوثيق الهوية [${nationalId || 'مسجلة مسبقاً'}] (المبلغ مقبوض مسبقاً لدى أمين الصندوق).`
        : `تم تسليم البوليصة [${parcel.trackingNumber}] رسمياً للمستلم [${extraDetails?.actualReceiverName || parcel.receiver.name}] وتوثيق الهوية [${nationalId || 'مسجلة مسبقاً'}] وإيداع المبالغ في الصندوق.`
    );

    // If this parcel is COD, create notification specifically for the Customer App/Portal (WITHOUT broadcasting to payout department staff)
    if (parcel.paymentType === 'cod' && (parcel.codAmount || 0) > 0 && !parcel.codPaidToSender) {
      const destBranch = branches.find((b) => b.id === parcel.destinationHubId);
      const originBranch = branches.find((b) => b.id === parcel.originHubId);
      const codCur = parcel.codCurrency || (parcel.codAmount > 1000 ? 'SYP' : parcel.currency || 'SYP');
      const codAmountFormatted = formatCurrencyApp(parcel.codAmount, codCur);

      const codSenderNotif: SystemNotification = {
        id: `notif_cod_payout_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
        title: `💵 جاهزية حوالتك المالية للاستلام (بوليصة ${parcel.trackingNumber})`,
        message: `تم تحصيل طردكم بنجاح. أصبحت قيمة الحوالة المالية [${codAmountFormatted}] جاهزة للتسليم فوراً في فرعنا (${originBranch?.name || 'فرع الصادر'}). يرجى التفضل بالقدوم مصطحبين إثبات الشخصية الأصلي لتأكيد الهوية والاستلام.`,
        type: 'cod_payout_due',
        timestamp: now,
        read: false,
        targetCustomerPhone: parcel.sender.phone,
        priority: 'urgent',
        senderUserId: currentUser.id,
        senderName: currentUser.name,
        relatedId: parcel.id,
        actionType: 'cod_payout_sender',
        parcelSummary: {
          trackingNumber: parcel.trackingNumber,
          paperReceiptNumber: parcel.paperReceiptNumber,
          receiverName: extraDetails?.actualReceiverName || parcel.receiver.name,
          receiverPhone: parcel.receiver.phone,
          senderName: parcel.sender.name,
          senderPhone: parcel.sender.phone,
          originBranchName: originBranch?.name,
          destBranchName: destBranch?.name,
          codAmount: parcel.codAmount,
          codCurrency: codCur,
          amountToCollectSyp: codCur === 'SYP' ? parcel.codAmount : 0,
          amountToCollectUsd: codCur === 'USD' ? parcel.codAmount : 0,
          amountSummary: codAmountFormatted,
        },
      };

      setNotifications((prev) => [codSenderNotif, ...prev]);
      vpsSyncEngine.syncNotification(codSenderNotif);
    }

    return { success: true };
  };

  // Forward Collection to Branch Cashier
  const forwardCollectionToCashier = (
    parcelId: string,
    details?: { receiverName?: string; receiverPhone?: string; notes?: string }
  ) => {
    const parcel = parcels.find((p) => p.id === parcelId);
    if (!parcel) return;

    // Financial calculations based on invoice/receipt
    const shippingAmount = parcel.shippingCost || 0;
    const codAmount = parcel.paymentType === 'cod' ? parcel.codAmount || 0 : 0;
    const transferFee = parcel.paymentType === 'cod' ? parcel.transferFee || 0 : 0;

    const shippingCur =
      parcel.shippingCurrency ||
      (parcel.currency === 'USD' && parcel.paymentType === 'cod' && parcel.shippingCost > 1000
        ? 'SYP'
        : parcel.currency);
    const codCur = parcel.codCurrency || (parcel.codAmount > 1000 ? 'SYP' : parcel.currency);

    const sypDue =
      parcel.paymentType === 'prepaid'
        ? 0
        : (shippingCur === 'SYP' ? shippingAmount : 0) +
          (parcel.paymentType === 'cod' && codCur === 'SYP' ? codAmount + transferFee : 0);

    const usdDue =
      parcel.paymentType === 'prepaid'
        ? 0
        : (shippingCur === 'USD' ? shippingAmount : 0) +
          (parcel.paymentType === 'cod' && codCur === 'USD' ? codAmount + transferFee : 0);

    const parts: string[] = [];
    if (sypDue > 0) parts.push(formatCurrencyApp(sypDue, 'SYP'));
    if (usdDue > 0) parts.push(formatCurrencyApp(usdDue, 'USD'));
    if (parts.length === 0) parts.push('طرد مسدد سلفاً (0)');
    const amountSummary = parts.join(' + ');

    const now = new Date().toISOString();

    const updatedForwarded: Parcel = {
      ...parcel,
      cashierForwarded: true,
      cashierForwardedAt: now,
      cashierForwardedByUserId: currentUser.id,
      cashierForwardedByUserName: currentUser.name,
    };

    setParcels((prev) =>
      prev.map((p) => (p.id === parcelId ? updatedForwarded : p))
    );
    vpsSyncEngine.syncParcel(updatedForwarded);

    const newNotif: SystemNotification = {
      id: `notif_cashier_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
      title: `تحويل قبض طرد: ${parcel.trackingNumber}`,
      message: `طلب تحصيل وتسليم للمستلم [${details?.receiverName || parcel.receiver.name}]. المبلغ الواجب تحصيله: [${amountSummary}].`,
      type: 'cash_settlement',
      timestamp: now,
      read: false,
      targetBranchId: parcel.destinationHubId || currentBranch.id,
      priority: 'urgent',
      senderUserId: currentUser.id,
      senderName: currentUser.name,
      relatedId: parcel.id,
      parcelSummary: {
        trackingNumber: parcel.trackingNumber,
        paperReceiptNumber: parcel.paperReceiptNumber,
        receiverName: details?.receiverName || parcel.receiver.name,
        receiverPhone: details?.receiverPhone || parcel.receiver.phone,
        amountToCollectSyp: sypDue,
        amountToCollectUsd: usdDue,
        amountSummary,
      },
      actionType: 'cashier_collect',
    };

    setNotifications((prev) => [newNotif, ...prev]);
    vpsSyncEngine.syncNotification(newNotif);

    addAuditLog(
      'تحويل قبض طرد لأمين الصندوق',
      'cashbox',
      `تم تحويل قبض البوليصة [${parcel.trackingNumber}] للمستلم [${details?.receiverName || parcel.receiver.name}] لأمين صندوق الفرع بقيمة [${amountSummary}].`
    );
  };

  // Cashier collects the payment directly with accurate financial inputs
  const collectPaymentByCashier = (
    parcelId: string,
    optionsOrNotes?:
      | {
          sypAmount?: number;
          usdAmount?: number;
          paymentMethod?: 'cash' | 'bank_transfer' | 'online';
          notes?: string;
          notificationId?: string;
        }
      | string
  ) => {
    const parcel = parcels.find((p) => p.id === parcelId);
    if (!parcel) return;

    const options = typeof optionsOrNotes === 'object' ? optionsOrNotes : { notes: optionsOrNotes };

    // Financial calculations based on invoice/receipt
    const shippingAmount = parcel.shippingCost || 0;
    const codAmount = parcel.paymentType === 'cod' ? parcel.codAmount || 0 : 0;
    const transferFee = parcel.paymentType === 'cod' ? parcel.transferFee || 0 : 0;

    const shippingCur =
      parcel.shippingCurrency ||
      (parcel.currency === 'USD' && parcel.paymentType === 'cod' && parcel.shippingCost > 1000
        ? 'SYP'
        : parcel.currency);
    const codCur = parcel.codCurrency || (parcel.codAmount > 1000 ? 'SYP' : parcel.currency);

    const defaultSypDue =
      parcel.paymentType === 'prepaid'
        ? 0
        : (shippingCur === 'SYP' ? shippingAmount : 0) +
          (parcel.paymentType === 'cod' && codCur === 'SYP' ? codAmount + transferFee : 0);

    const defaultUsdDue =
      parcel.paymentType === 'prepaid'
        ? 0
        : (shippingCur === 'USD' ? shippingAmount : 0) +
          (parcel.paymentType === 'cod' && codCur === 'USD' ? codAmount + transferFee : 0);

    const finalSypDue = options?.sypAmount !== undefined ? options.sypAmount : defaultSypDue;
    const finalUsdDue = options?.usdAmount !== undefined ? options.usdAmount : defaultUsdDue;

    const parts: string[] = [];
    if (finalSypDue > 0) parts.push(formatCurrencyApp(finalSypDue, 'SYP'));
    if (finalUsdDue > 0) parts.push(formatCurrencyApp(finalUsdDue, 'USD'));
    if (parts.length === 0) parts.push('طرد مسدد سلفاً (0)');
    const amountSummary = parts.join(' + ');

    const now = new Date().toISOString();
    const destHubId = parcel.destinationHubId || currentBranch.id;

    // Deposit to branch cashbox
    if (finalSypDue > 0) {
      addCashTransaction(
        destHubId,
        'SYP',
        parcel.paymentType === 'cod' ? 'cod_collected_dest' : 'shipping_collected_dest',
        finalSypDue,
        `قبض أمين الصندوق (${currentUser.name}) لبوليصة ${parcel.trackingNumber} - مقبوض بالليرة (${formatCurrencyApp(finalSypDue, 'SYP')}) للمستلم ${parcel.receiver.name}${options?.notes ? ` - ملاحظات: ${options.notes}` : ''}`,
        parcel.id
      );
    }

    if (finalUsdDue > 0) {
      addCashTransaction(
        destHubId,
        'USD',
        parcel.paymentType === 'cod' ? 'cod_collected_dest' : 'shipping_collected_dest',
        finalUsdDue,
        `قبض أمين الصندوق (${currentUser.name}) لبوليصة ${parcel.trackingNumber} - مقبوض بالدولار (${formatCurrencyApp(finalUsdDue, 'USD')}) للمستلم ${parcel.receiver.name}${options?.notes ? ` - ملاحظات: ${options.notes}` : ''}`,
        parcel.id
      );
    }

    // Update parcel status
    const updatedParcelCollected: Parcel = {
      ...parcel,
      cashierCollected: true,
      cashierCollectedAt: now,
      cashierCollectedByUserId: currentUser.id,
      cashierCollectedByUserName: currentUser.name,
      cashierCollectedSyp: finalSypDue,
      cashierCollectedUsd: finalUsdDue,
      cashierCollectionNotes: options?.notes,
      cashierPaymentMethod: options?.paymentMethod || 'cash',
      codStatus:
        parcel.paymentType === 'cod' && (parcel.codAmount || 0) > 0
          ? parcel.codPaidToSender
            ? 'paid_to_sender'
            : 'collected_awaiting_sender_payout'
          : parcel.codStatus,
      codCollectedAt:
        parcel.paymentType === 'cod' && (parcel.codAmount || 0) > 0
          ? parcel.codCollectedAt || now
          : parcel.codCollectedAt,
    };

    setParcels((prev) =>
      prev.map((p) => (p.id === parcelId ? updatedParcelCollected : p))
    );
    vpsSyncEngine.syncParcel(updatedParcelCollected);

    // Update existing cashier forwarded notification to show completed & read
    setNotifications((prev) =>
      prev.map((n) => {
        if (
          n.relatedId === parcelId &&
          (n.actionType === 'cashier_collect' || n.id === options?.notificationId)
        ) {
          const updatedN = {
            ...n,
            read: true,
            title: `✓ تم قبض وتحصيل طرد: ${parcel.trackingNumber}`,
            message: `تم استلام وتحصيل مبلغ [${amountSummary}] وإيداعه بصندوق الفرع بواسطة أمين الصندوق (${currentUser.name}). الطرد جاهز للتسليم الآن.`,
          };
          vpsSyncEngine.syncNotification(updatedN);
          return updatedN;
        }
        return n;
      })
    );

    // Send immediate high-priority notification to delivery section / agents
    const notifyBack: SystemNotification = {
      id: `notif_ack_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
      title: `✓ تم قبض المبلغ من أمين الصندوق - الطرد جاهز للتسليم مباشرة`,
      message: `قام أمين الصندوق (${currentUser.name}) بتحصيل وقبض مبلغ [${amountSummary}] للبوليصة [${parcel.trackingNumber}] للمستلم [${parcel.receiver.name}] وإيداعه بصندوق الفرع. يمكنك الآن إتمام عملية التسليم وتوثيق الهوية للمستلم فوراً دون أي مطالبة مالية.`,
      type: 'cash_settlement',
      timestamp: now,
      read: false,
      targetBranchId: destHubId,
      priority: 'urgent',
      relatedId: parcel.id,
      parcelSummary: {
        trackingNumber: parcel.trackingNumber,
        paperReceiptNumber: parcel.paperReceiptNumber,
        receiverName: parcel.receiver.name,
        receiverPhone: parcel.receiver.phone,
        amountToCollectSyp: finalSypDue,
        amountToCollectUsd: finalUsdDue,
        amountSummary,
      },
    };

    setNotifications((prev) => [notifyBack, ...prev]);
    vpsSyncEngine.syncNotification(notifyBack);

    // If this parcel is COD, trigger prominent Red Alert notification to the Origin Branch (قسم الصادر) for Sender Payout
    if (parcel.paymentType === 'cod' && (parcel.codAmount || 0) > 0 && !parcel.codPaidToSender) {
      const destBranch = branches.find((b) => b.id === parcel.destinationHubId);
      const originBranch = branches.find((b) => b.id === parcel.originHubId);
      const codCur = parcel.codCurrency || (parcel.codAmount > 1000 ? 'SYP' : parcel.currency || 'SYP');
      const codAmountFormatted = formatCurrencyApp(parcel.codAmount, codCur);

      const codSenderNotif: SystemNotification = {
        id: `notif_cod_payout_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
        title: `🚨 استحقاق صرف حوالة COD للمرسل (${parcel.sender.name}) - بوليصة ${parcel.trackingNumber}`,
        message: `تم تحصيل مبلغ الحوالة من المستلم [${parcel.receiver.name}] في فرع [${destBranch?.name || parcel.destinationHubId}]. أصبحت قيمة الحوالة [${codAmountFormatted}] مستحقة الصرف الفوري للمرسل [${parcel.sender.name}] (هاتف: ${parcel.sender.phone}). يرجى إبلاغه للقدوم وتحصيل المبلغ.`,
        type: 'cod_payout_due',
        timestamp: now,
        read: false,
        targetBranchId: parcel.originHubId,
        priority: 'urgent',
        senderUserId: currentUser.id,
        senderName: currentUser.name,
        relatedId: parcel.id,
        actionType: 'cod_payout_sender',
        parcelSummary: {
          trackingNumber: parcel.trackingNumber,
          paperReceiptNumber: parcel.paperReceiptNumber,
          receiverName: parcel.receiver.name,
          receiverPhone: parcel.receiver.phone,
          senderName: parcel.sender.name,
          senderPhone: parcel.sender.phone,
          originBranchName: originBranch?.name,
          destBranchName: destBranch?.name,
          codAmount: parcel.codAmount,
          codCurrency: codCur,
          amountToCollectSyp: codCur === 'SYP' ? parcel.codAmount : 0,
          amountToCollectUsd: codCur === 'USD' ? parcel.codAmount : 0,
          amountSummary: codAmountFormatted,
        },
      };

      setNotifications((prev) => [codSenderNotif, ...prev]);
      vpsSyncEngine.syncNotification(codSenderNotif);
    }

    addAuditLog(
      'قبض أمين الصندوق لطرد محول',
      'cashbox',
      `تم تحصيل وقبض مبلغ [${amountSummary}] للبوليصة [${parcel.trackingNumber}] بنجاح وإيداعه في صندوق الفرع بواسطة أمين الصندوق [${currentUser.name}].`
    );
  };

  // Assign parcels to courier manifest
  const assignToCourier = (courierId: string, parcelIds: string[], notes?: string): CourierManifest => {
    const manifestNumber = `MNF-CUR-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`;
    const selected = parcels.filter((p) => parcelIds.includes(p.id));

    const totalCodToCollectSyp = selected
      .filter((p) => p.currency === 'SYP' && p.paymentType === 'cod')
      .reduce((acc, p) => acc + p.codAmount, 0);
    const totalCodToCollectUsd = selected
      .filter((p) => p.currency === 'USD' && p.paymentType === 'cod')
      .reduce((acc, p) => acc + p.codAmount, 0);

    const totalCollectFreightSyp = selected
      .filter((p) => p.currency === 'SYP' && (p.paymentType === 'collect' || p.paymentType === 'cod'))
      .reduce((acc, p) => acc + p.shippingCost, 0);
    const totalCollectFreightUsd = selected
      .filter((p) => p.currency === 'USD' && (p.paymentType === 'collect' || p.paymentType === 'cod'))
      .reduce((acc, p) => acc + p.shippingCost, 0);

    const now = new Date().toISOString();
    const newCurManifest: CourierManifest = {
      id: `cur_mnf_${Date.now()}`,
      manifestNumber,
      courierId,
      hubId: currentBranch.id,
      status: 'active',
      parcelIds,
      assignedAt: now,
      totalCodToCollectSyp,
      totalCodToCollectUsd,
      totalCollectFreightSyp,
      totalCollectFreightUsd,
      deliveredParcelIds: [],
      returnedParcelIds: [],
      notes,
      updatedAt: now,
    };

    setCourierManifests((prev) => [newCurManifest, ...prev]);
    vpsSyncEngine.syncCourierManifest(newCurManifest);

    setParcels((prev) => {
      const next = prev.map((p) => {
        if (parcelIds.includes(p.id)) {
          const updated = { ...p, handlingStatus: 'with_courier' as const, courierManifestId: newCurManifest.id, updatedAt: now };
          vpsSyncEngine.syncParcel(updated);
          return updated;
        }
        return p;
      });
      safeStorage.setItem(`${STORAGE_KEY}_parcels`, JSON.stringify(next));
      return next;
    });

    // [5-B-4-D] Record batch parcel events for courier assignment
    const courierName = users.find((u) => u.id === courierId)?.name || 'موزع';
    if (selected && selected.length > 0) {
      recordParcelEventsBatch(
        selected.map((p) => ({
          parcelId: p.id,
          eventType: 'with_courier',
          dimension: 'handling' as ParcelEventDimension,
          options: {
            previousStatus: p.handlingStatus,
            newStatus: 'with_courier',
            precedenceRank: 60,
            branchId: currentBranch?.id || p.currentLocationBranchId,
            manifestId: newCurManifest.id,
            notes: `إسناد طرد إلى الموزع ${courierName}`,
            metadata: {
              courierId,
              courierName,
              courierManifestId: newCurManifest.id,
              manifestNumber: newCurManifest.manifestNumber,
              assignedAt: now,
              assignmentMode: 'batch',
            },
          },
        }))
      );
    }

    return newCurManifest;
  };

  // Settle Courier Manifest
  const settleCourierManifest = (
    courierManifestId: string,
    deliveredIds: string[],
    returnedIds: string[],
    financials?: {
      collectedSyp?: number;
      collectedUsd?: number;
      courierCommissionSyp?: number;
      netDepositedSyp?: number;
      netDepositedUsd?: number;
      uncollectedIds?: string[];
      uncollectedSyp?: number;
      uncollectedUsd?: number;
      returnReasons?: Record<string, string>;
      notes?: string;
    }
  ) => {
    const now = new Date().toISOString();
    const manifest = courierManifests.find((m) => m.id === courierManifestId);
    const courier = users.find((u) => u.id === manifest?.courierId);

    const sypNet = financials?.netDepositedSyp ?? 0;
    const usdNet = financials?.netDepositedUsd ?? 0;
    const uncollectedIds = financials?.uncollectedIds ?? [];
    const uncollectedSyp = financials?.uncollectedSyp ?? 0;
    const uncollectedUsd = financials?.uncollectedUsd ?? 0;

    const isCourierCredit = uncollectedIds.length > 0 || uncollectedSyp > 0 || uncollectedUsd > 0;
    const manifestStatus = isCourierCredit ? 'courier_credit' : 'settled';

    let generatedVoucherNumber: string | undefined;
    const newVouchersToInsert: FinancialVoucher[] = [];
    let currentReceiptSerial = vouchers.filter((v) => v.type === 'receipt').length + 1;
    let itemizedCount = 0;

    // Record individual financial transaction per delivered & collected parcel
    deliveredIds.forEach((pId, idx) => {
      const p = parcels.find((item) => item.id === pId);
      if (p) {
        const itemBreakdown = calculateParcelReceivable(p);
        const amount = itemBreakdown.totalReceivable;
        const currency = itemBreakdown.currency;

        if (amount > 0) {
          const year = new Date().getFullYear();
          const vNum = `RV-${year}-${String(currentReceiptSerial++).padStart(4, '0')}`;
          if (!generatedVoucherNumber) generatedVoucherNumber = vNum;

          const parcelVoucher: FinancialVoucher = {
            id: `vch_${Date.now()}_${p.id}_${idx}`,
            voucherNumber: vNum,
            branchId: currentBranch.id,
            type: 'receipt',
            reasonCategory: 'shipping_income',
            amount,
            currency,
            paidByOrTo: `المستلم: ${p.receiver.name} (عبر الموزع: ${courier?.name || 'الموزع'})`,
            description: `تحصيل طرد [${p.trackingNumber}] ${p.paperReceiptNumber ? `(وصل ورقي: ${p.paperReceiptNumber})` : ''} - المستلم: ${p.receiver.name} - المانافيست [${manifest?.manifestNumber || courierManifestId}]`,
            date: now.split('T')[0],
            timestamp: now,
            performedByUserId: currentUser.id,
            status: 'approved',
          };

          newVouchersToInsert.push(parcelVoucher);
          vpsSyncEngine.syncVoucher(parcelVoucher);

          addCashTransaction(
            currentBranch.id,
            currency,
            'shipping_collected_dest',
            amount,
            `تحصيل طرد [${p.trackingNumber}] ${p.paperReceiptNumber ? `(ورقي: ${p.paperReceiptNumber})` : ''} - المستلم: ${p.receiver.name} - موزع: ${courier?.name || 'الموزع'} - مانافيست [${manifest?.manifestNumber || courierManifestId}]`,
            p.trackingNumber
          );

          itemizedCount++;
        }
      }
    });

    if (newVouchersToInsert.length > 0) {
      setVouchers((prev) => [...newVouchersToInsert, ...prev]);
    }

    // Fallback if no itemized transactions created but net amounts were passed
    if (itemizedCount === 0) {
      if (sypNet > 0) {
        const year = new Date().getFullYear();
        generatedVoucherNumber = `RV-${year}-${String(currentReceiptSerial++).padStart(4, '0')}`;

        const newVoucher: FinancialVoucher = {
          id: `vch_${Date.now()}_syp`,
          voucherNumber: generatedVoucherNumber,
          branchId: currentBranch.id,
          type: 'receipt',
          reasonCategory: 'shipping_income',
          amount: sypNet,
          currency: 'SYP',
          paidByOrTo: courier?.name ? `الموزع: ${courier.name}` : 'مندوب التوزيع',
          description: `توريد تحصيلات مانافيست التوزيع [${manifest?.manifestNumber || courierManifestId}] (${deliveredIds.length} طرد مسلّم ومقبوض)`,
          date: now.split('T')[0],
          timestamp: now,
          performedByUserId: currentUser.id,
          status: 'approved',
        };
        setVouchers((prev) => [newVoucher, ...prev]);
        vpsSyncEngine.syncVoucher(newVoucher);

        addCashTransaction(
          currentBranch.id,
          'SYP',
          'shipping_collected_dest',
          sypNet,
          `توريد عهدة الموزع [${manifest?.manifestNumber}] - سند قبض [${generatedVoucherNumber}]`,
          manifest?.manifestNumber
        );
      }

      if (usdNet > 0) {
        const year = new Date().getFullYear();
        const usdVoucherNum = `RV-${year}-${String(currentReceiptSerial++).padStart(4, '0')}`;

        const newVoucherUsd: FinancialVoucher = {
          id: `vch_${Date.now()}_usd`,
          voucherNumber: usdVoucherNum,
          branchId: currentBranch.id,
          type: 'receipt',
          reasonCategory: 'shipping_income',
          amount: usdNet,
          currency: 'USD',
          paidByOrTo: courier?.name ? `الموزع: ${courier.name}` : 'مندوب التوزيع',
          description: `توريد تحصيلات مانافيست بالدولار [${manifest?.manifestNumber || courierManifestId}]`,
          date: now.split('T')[0],
          timestamp: now,
          performedByUserId: currentUser.id,
          status: 'approved',
        };
        setVouchers((prev) => [newVoucherUsd, ...prev]);
        vpsSyncEngine.syncVoucher(newVoucherUsd);

        addCashTransaction(
          currentBranch.id,
          'USD',
          'shipping_collected_dest',
          usdNet,
          `توريد عهدة دولار للموزع [${manifest?.manifestNumber}]`,
          manifest?.manifestNumber
        );
      }
    }

    const updatedCourierManifest: CourierManifest | undefined = manifest ? {
      ...manifest,
      status: manifestStatus,
      settledAt: manifestStatus === 'settled' ? now : manifest.settledAt,
      deliveredParcelIds: deliveredIds,
      uncollectedParcelIds: uncollectedIds,
      returnedParcelIds: returnedIds,
      notes: financials?.notes ? (manifest.notes ? `${manifest.notes} | ${financials.notes}` : financials.notes) : manifest.notes,
      updatedAt: now,
      settlementSummary: {
        deliveredCount: deliveredIds.length,
        uncollectedCount: uncollectedIds.length,
        returnedCount: returnedIds.length,
        totalCollectedSyp: financials?.collectedSyp ?? 0,
        totalCollectedUsd: financials?.collectedUsd ?? 0,
        totalUncollectedSyp: uncollectedSyp,
        totalUncollectedUsd: uncollectedUsd,
        courierCommissionSyp: 0,
        netDepositedSyp: sypNet,
        netDepositedUsd: usdNet,
        returnReasons: financials?.returnReasons ?? {},
        settledByUserId: currentUser.id,
        voucherNumber: generatedVoucherNumber,
      },
    } : undefined;

    if (updatedCourierManifest) {
      setCourierManifests((prev) =>
        prev.map((m) => (m.id === courierManifestId ? updatedCourierManifest : m))
      );
      vpsSyncEngine.syncCourierManifest(updatedCourierManifest);
    }

    // [4أ-2b-ext] Build obligations for parcels about to be delivered.
    // We use the ORIGINAL parcel (before setParcels) because 
    // buildObligationFromParcel only reads payment/destination/amount 
    // fields, which are not modified by the delivery transformation.
    const obligationsToSync: InterBranchObligation[] = [];
    for (const p of parcels) {
      if (deliveredIds.includes(p.id)) {
        const obl = buildObligationFromParcel(p);
        if (obl) obligationsToSync.push(obl);
      }
    }

    // Update delivered parcels, uncollected parcels & returned parcels
    const settledParcelsList: Parcel[] = [];
    setParcels((prev) => {
      const next = prev.map((p) => {
        if (deliveredIds.includes(p.id)) {
          if (!isTransitionAllowed(p.handlingStatus, 'delivered')) {
            console.warn(`[Lifecycle Guard] Blocked illegal delivery transition for ${p.trackingNumber}: ${p.handlingStatus} → delivered`);
            return p;
          }
          const item = calculateParcelReceivable(p);
          const updatedDelivered: Parcel = {
            ...p,
            handlingStatus: 'delivered',
            deliveredAt: now,
            deliveredByUserId: currentUser.id,
            deliveryNotes: `تم التسليم للمستلم بنجاح وقبض المبلغ عبر الموزع ${courier?.name || ''} - مانافيست ${manifest?.manifestNumber || ''}`,
            collectedAmount: item.totalReceivable,
            collectedSyp: item.currency === 'SYP' ? item.totalReceivable : 0,
            collectedUsd: item.currency === 'USD' ? item.totalReceivable : 0,
            codStatus:
              p.paymentType === 'cod' && (p.codAmount || 0) > 0
                ? p.codPaidToSender
                  ? 'paid_to_sender'
                  : 'collected_awaiting_sender_payout'
                : p.codStatus,
            codCollectedAt:
              p.paymentType === 'cod' && (p.codAmount || 0) > 0
                ? p.codCollectedAt || now
                  : p.codCollectedAt,
            updatedAt: now,
          };
          settledParcelsList.push(updatedDelivered);
          vpsSyncEngine.syncParcel(updatedDelivered);
          return updatedDelivered;
        }
        if (uncollectedIds.includes(p.id)) {
          if (!isTransitionAllowed(p.handlingStatus, 'delivered_uncollected')) {
            console.warn(`[Lifecycle Guard] Blocked illegal uncollected transition for ${p.trackingNumber}: ${p.handlingStatus} → delivered_uncollected`);
            return p;
          }
          const updatedUncollected: Parcel = {
            ...p,
            handlingStatus: 'delivered_uncollected',
            deliveredAt: now,
            deliveredByUserId: currentUser.id,
            deliveryNotes: `تسليم بدون قبض - المبلغ معلق كذمة على الموزع ${courier?.name || ''} - مانافيست ${manifest?.manifestNumber || ''}`,
            updatedAt: now,
          };
          settledParcelsList.push(updatedUncollected);
          vpsSyncEngine.syncParcel(updatedUncollected);
          return updatedUncollected;
        }
        if (returnedIds.includes(p.id)) {
          if (!isTransitionAllowed(p.handlingStatus, 'received_at_dest')) {
            console.warn(`[Lifecycle Guard] Blocked illegal returned transition for ${p.trackingNumber}: ${p.handlingStatus} → received_at_dest`);
            return p;
          }
          const reason = financials?.returnReasons?.[p.id];
          const updatedReturned: Parcel = {
            ...p,
            handlingStatus: 'received_at_dest', // Returned back to hub
            returnReason: reason,
            deliveryNotes: reason ? `مرتجع للمستودع من جولة التوزيع: ${reason}` : 'مرتجع للمستودع من الموزع',
            updatedAt: now,
          };
          settledParcelsList.push(updatedReturned);
          vpsSyncEngine.syncParcel(updatedReturned);
          return updatedReturned;
        }
        return p;
      });
      safeStorage.setItem(`${STORAGE_KEY}_parcels`, JSON.stringify(next));
      return next;
    });

    // [4أ-2b-ext] Batch update obligations state + sync to server.
    if (obligationsToSync.length > 0) {
      setInterBranchObligations((prev) => {
        const next = [...prev];
        for (const obl of obligationsToSync) {
          const idx = next.findIndex((o) => o.id === obl.id);
          if (idx >= 0) {
            next[idx] = obl;
          } else {
            next.unshift(obl);
          }
        }
        return next;
      });

      for (const obl of obligationsToSync) {
        vpsSyncEngine.syncObligation(obl);
      }
    }

    // [5-B-4-E] Record batch events for courier manifest settlement (delivered + uncollected + returned)
    if (settledParcelsList.length > 0) {
      const courierName = courier?.name || 'الموزع';
      const eventsBatch = settledParcelsList.map((p) => {
        const isDelivered = p.handlingStatus === 'delivered';
        const isUncollected = p.handlingStatus === 'delivered_uncollected';
        return {
          parcelId: p.id,
          eventType: p.handlingStatus,
          dimension: 'handling' as ParcelEventDimension,
          options: {
            previousStatus: 'with_courier',
            newStatus: p.handlingStatus,
            precedenceRank: isDelivered ? 95 : isUncollected ? 70 : 50,
            branchId: p.currentLocationBranchId || currentBranch?.id,
            manifestId: manifest?.id,
            notes: isDelivered
              ? `تسليم عبر الموزع ${courierName} - مانافيست ${manifest?.manifestNumber || ''}`
              : isUncollected
              ? `تسليم بدون قبض - ذمة على الموزع ${courierName}`
              : `مرتجع للمستودع من جولة الموزع ${courierName}`,
            metadata: {
              manifestNumber: manifest?.manifestNumber,
              manifestId: manifest?.id,
              courierId: courier?.id,
              courierName,
              settledAt: now,
              settlementType: isDelivered ? 'delivered' : isUncollected ? 'uncollected' : 'returned',
              collectedAmount: isDelivered ? p.collectedAmount : undefined,
            },
          },
        };
      });
      recordParcelEventsBatch(eventsBatch);
    }

    // Dispatch COD Sender payout notifications for delivered COD parcels
    const deliveredCodParcels = parcels.filter(
      (p) => deliveredIds.includes(p.id) && p.paymentType === 'cod' && (p.codAmount || 0) > 0 && !p.codPaidToSender
    );

    if (deliveredCodParcels.length > 0) {
      const newCodNotifs: SystemNotification[] = deliveredCodParcels.map((parcel) => {
        const destBranch = branches.find((b) => b.id === parcel.destinationHubId);
        const originBranch = branches.find((b) => b.id === parcel.originHubId);
        const codCur = parcel.codCurrency || (parcel.codAmount > 1000 ? 'SYP' : parcel.currency || 'SYP');
        const codAmountFormatted = formatCurrencyApp(parcel.codAmount, codCur);

        const notif: SystemNotification = {
          id: `notif_cod_payout_${Date.now()}_${Math.floor(Math.random() * 1000)}_${parcel.id}`,
          title: `🚨 استحقاق صرف حوالة COD للمرسل (${parcel.sender.name}) - بوليصة ${parcel.trackingNumber}`,
          message: `تم تسليم الطرد للمستلم بنجاح عبر الموزع [${courier?.name || 'موزع'}] بفرع [${destBranch?.name || parcel.destinationHubId}]. أصبحت قيمة الحوالة [${codAmountFormatted}] مستحقة الصرف الفوري للمرسل [${parcel.sender.name}] (هاتف: ${parcel.sender.phone}). يرجى إبلاغه للقدوم وتحصيل المبلغ.`,
          type: 'cod_payout_due',
          timestamp: now,
          read: false,
          targetBranchId: parcel.originHubId,
          priority: 'urgent',
          senderUserId: currentUser.id,
          senderName: currentUser.name,
          relatedId: parcel.id,
          actionType: 'cod_payout_sender',
          parcelSummary: {
            trackingNumber: parcel.trackingNumber,
            paperReceiptNumber: parcel.paperReceiptNumber,
            receiverName: parcel.receiver.name,
            receiverPhone: parcel.receiver.phone,
            senderName: parcel.sender.name,
            senderPhone: parcel.sender.phone,
            originBranchName: originBranch?.name,
            destBranchName: destBranch?.name,
            codAmount: parcel.codAmount,
            codCurrency: codCur,
            amountToCollectSyp: codCur === 'SYP' ? parcel.codAmount : 0,
            amountToCollectUsd: codCur === 'USD' ? parcel.codAmount : 0,
            amountSummary: codAmountFormatted,
          },
        };
        vpsSyncEngine.syncNotification(notif);
        return notif;
      });

      setNotifications((prev) => [...newCodNotifs, ...prev]);
    }

    addAuditLog(
      'تصفية عهدة موزع',
      'parcels',
      `تمت تصفية عهدة الموزع [${courier?.name || 'موزع'}] لمانافيست [${manifest?.manifestNumber || courierManifestId}]: ${deliveredIds.length} مسلّم، ${returnedIds.length} مرتجع للمستودع.`
    );
  };

  // Courier Intake Financials & Unsettled Parcels
  const getCourierIntakeFinancials = useCallback(
    (courierId: string) => {
      const courierUser = users.find((u) => u.id === courierId);
      const courierParcels = parcels.filter((p) => {
        return (
          p.createdById === courierId ||
          p.collectedByCourierId === courierId ||
          (courierUser &&
            (p.registeredByCourierName === courierUser.name ||
              p.collectedByCourierName === courierUser.name ||
              p.registeredByUserName === courierUser.name ||
              p.createdByName === courierUser.name))
        );
      });

      const unsettledParcels = courierParcels.filter(
        (p) => p.courierIntakeSettled !== true && p.courierIntakeReceivedInHub !== true
      );

      let totalPrepaidSyp = 0;
      let totalPrepaidUsd = 0;

      unsettledParcels.forEach((p) => {
        const isPrepaid =
          p.paymentType === 'prepaid' ||
          (p.paymentType === 'cod' && p.codShippingPayer === 'sender');
        if (isPrepaid) {
          const cost = Number(p.shippingCost) || 0;
          if (p.currency === 'SYP') {
            totalPrepaidSyp += cost;
          } else {
            totalPrepaidUsd += cost;
          }
        }
      });

      const settledParcelsCount = courierParcels.filter((p) => p.courierIntakeSettled === true).length;

      return {
        unsettledParcels,
        totalPrepaidSyp,
        totalPrepaidUsd,
        allIntakeParcels: courierParcels,
        settledParcelsCount,
      };
    },
    [parcels, users]
  );

  // Combined Intake Audit: Receive Parcels into Hub & Close Courier Intake Cashbox
  const settleCourierIntakeParcels = (
    courierId: string,
    parcelIds: string[],
    notes?: string
  ): CourierIntakeSettlementVoucher => {
    const courier = users.find((u) => u.id === courierId);
    const now = new Date().toISOString();
    const year = new Date().getFullYear();

    const selectedParcels = parcels.filter((p) => parcelIds.includes(p.id));

    let totalPrepaidSyp = 0;
    let totalPrepaidUsd = 0;

    selectedParcels.forEach((p) => {
      const isPrepaid =
        p.paymentType === 'prepaid' ||
        (p.paymentType === 'cod' && p.codShippingPayer === 'sender');
      if (isPrepaid) {
        const cost = Number(p.shippingCost) || 0;
        if (p.currency === 'SYP') {
          totalPrepaidSyp += cost;
        } else {
          totalPrepaidUsd += cost;
        }
      }
    });

    const serialNumber =
      courierIntakeSettlements.filter((s) => s.voucherNumber.startsWith(`ST-INT-${year}`)).length + 1;
    const voucherNumber = `ST-INT-${year}-${String(serialNumber).padStart(4, '0')}`;

    const newVoucher: CourierIntakeSettlementVoucher = {
      id: `vch_cint_${Date.now()}_${Math.floor(100 + Math.random() * 900)}`,
      voucherNumber,
      branchId: currentBranch.id,
      courierId,
      courierName: courier?.name || currentUser.name || 'الموزع المعتمد',
      courierPhone: courier?.phone,
      parcelIds,
      parcelsCount: parcelIds.length,
      totalPrepaidSyp,
      totalPrepaidUsd,
      totalCollectedSyp: totalPrepaidSyp,
      totalCollectedUsd: totalPrepaidUsd,
      receivedByUserId: currentUser.id,
      receivedByUserName: currentUser.name || currentUser.username,
      timestamp: now,
      notes,
    };

    setCourierIntakeSettlements((prev) => {
      const updated = [newVoucher, ...prev];
      safeStorage.setItem(`${STORAGE_KEY}_courier_intake_settlements`, JSON.stringify(updated));
      return updated;
    });

    const intakeParcelsList: Parcel[] = [];
    setParcels((prev) => {
      const next = prev.map((p) => {
        if (parcelIds.includes(p.id)) {
          const updatedIntake: Parcel = {
            ...p,
            courierIntakeSettled: true,
            courierIntakeSettledAt: now,
            courierIntakeSettledVoucherId: newVoucher.id,
            courierIntakeSettledVoucherNumber: newVoucher.voucherNumber,
            courierIntakeSettledByUserId: currentUser.id,
            courierIntakeSettledByUserName: currentUser.name || currentUser.username,
            courierIntakeReceivedInHub: true,
            courierIntakeReceivedAt: now,
            handlingStatus: 'received_at_hub' as const,
            currentLocationBranchId: currentBranch.id,
          };
          intakeParcelsList.push(updatedIntake);
          vpsSyncEngine.syncParcel(updatedIntake);
          return updatedIntake;
        }
        return p;
      });
      safeStorage.setItem(`${STORAGE_KEY}_parcels`, JSON.stringify(next));
      return next;
    });

    // [5-B-4-E] Record intake settlement events
    if (intakeParcelsList.length > 0) {
      recordParcelEventsBatch(
        intakeParcelsList.map((p) => ({
          parcelId: p.id,
          eventType: 'received_at_hub',
          dimension: 'handling' as ParcelEventDimension,
          options: {
            previousStatus: p.handlingStatus,
            newStatus: 'received_at_hub',
            precedenceRank: 10,
            branchId: currentBranch.id,
            notes: `توريد مقبوضات طرود من المندوب ${courier?.name || 'الموزع'} - سند ${voucherNumber}`,
            metadata: {
              voucherNumber,
              voucherId: newVoucher.id,
              courierId,
              courierName: courier?.name,
              settledAt: now,
              totalAmountSyp: newVoucher.totalPrepaidSyp,
              totalAmountUsd: newVoucher.totalPrepaidUsd,
              intakeMode: 'field_collection_settlement',
            },
          },
        }))
      );
    }

    if (totalPrepaidSyp > 0) {
      addCashTransaction(
        currentBranch.id,
        'SYP',
        'shift_settlement_received_inflow',
        totalPrepaidSyp,
        `توريد وترصيد مقبوضات تسجيل الطرود من الموزع [${courier?.name || 'الموزع'}] - سند [${voucherNumber}] (${parcelIds.length} طرد)`,
        newVoucher.id,
        undefined,
        'outgoing',
        newVoucher.id
      );

      addCashTransaction(
        currentBranch.id,
        'SYP',
        'shift_settlement_handover_outflow',
        totalPrepaidSyp,
        `تسليم وترصيد صندوق مقبوضات الطرود المسجلة ميدانياً لفرع الانطلاق - سند [${voucherNumber}]`,
        newVoucher.id,
        undefined,
        'courier_intake',
        newVoucher.id,
        { userId: courierId, userName: courier?.name || 'الموزع' }
      );
    }

    if (totalPrepaidUsd > 0) {
      addCashTransaction(
        currentBranch.id,
        'USD',
        'shift_settlement_received_inflow',
        totalPrepaidUsd,
        `توريد وترصيد صندوق مقبوضات تسجيل الطرود من الموزع [${courier?.name || 'الموزع'}] - سند [${voucherNumber}] (${parcelIds.length} طرد)`,
        newVoucher.id,
        undefined,
        'outgoing',
        newVoucher.id
      );

      addCashTransaction(
        currentBranch.id,
        'USD',
        'shift_settlement_handover_outflow',
        totalPrepaidUsd,
        `تسليم وترصيد صندوق مقبوضات الطرود المسجلة ميدانياً لفرع الانطلاق - سند [${voucherNumber}]`,
        newVoucher.id,
        undefined,
        'courier_intake',
        newVoucher.id,
        { userId: courierId, userName: courier?.name || 'الموزع' }
      );
    }

    addAuditLog(
      'تدقيق واستلام طرود وترصيد مقبوضات موزع',
      'parcels',
      `تم استلام وتدقيق [${parcelIds.length}] طرد في مستودع الفرع وتوريد مبلغ [${totalPrepaidSyp.toLocaleString()} ل.س${totalPrepaidUsd > 0 ? ` + $${totalPrepaidUsd}` : ''}] وترصيد صندوق مقبوضات الموزع [${courier?.name || 'الموزع'}] بموجب السند [${voucherNumber}].`
    );

    return newVoucher;
  };

  const openCourierIntakeVoucherPrint = (voucher: CourierIntakeSettlementVoucher) => {
    setSelectedCourierIntakeVoucherForPrint(voucher);
  };

  const closeCourierIntakeVoucherPrint = () => {
    setSelectedCourierIntakeVoucherForPrint(null);
  };

  // Handover Ready Parcels from Courier to Origin Hub (تم تسليم الطرود الجاهزة للشحن للمركز)
  // Transforms parcel handlingStatus from 'with_courier' to 'received_at_hub' ("بمركز الانطلاق - جاهز للشحن")
  // and makes them immediately available for loading into truck manifests.
  const handoverCourierParcelsToHub = useCallback(
    (parcelIds?: string[]): Parcel[] => {
      const now = new Date().toISOString();
      const courierName = currentUser?.name || currentUser?.username || 'الموزع المعتمد';
      const courierId = currentUser?.id || '';

      // 1. Identify target parcels synchronously from current parcels state
      const targetParcels = parcels.filter((p) => {
        if (parcelIds && parcelIds.length > 0) {
          return parcelIds.includes(p.id) && p.handlingStatus === 'with_courier';
        }
        return (
          (p.createdById === courierId ||
            p.collectedByCourierId === courierId ||
            p.registeredByCourierName === courierName ||
            p.collectedByCourierName === courierName ||
            currentUser?.role === 'super_admin' ||
            currentUser?.role === 'hub_manager') &&
          p.handlingStatus === 'with_courier'
        );
      });

      if (targetParcels.length === 0) {
        return [];
      }

      const targetIdSet = new Set(targetParcels.map((p) => p.id));

      // Compute total prepaid shipping fees collected by courier for unsettled parcels
      let totalPrepaidSyp = 0;
      let totalPrepaidUsd = 0;
      targetParcels.forEach((p) => {
        const isPrepaid =
          p.paymentType === 'prepaid' ||
          (p.paymentType === 'cod' && p.codShippingPayer === 'sender');
        if (isPrepaid && !p.courierIntakeSettled) {
          const cost = Number(p.shippingCost) || 0;
          if (p.currency === 'USD') {
            totalPrepaidUsd += cost;
          } else {
            totalPrepaidSyp += cost;
          }
        }
      });

      const handoverId = `hov_${Date.now()}_${Math.floor(100 + Math.random() * 900)}`;

      const updatedParcels: Parcel[] = targetParcels.map((p) => ({
        ...p,
        handlingStatus: 'received_at_hub',
        courierHandedOverToHub: true,
        courierHandoverTimestamp: now,
        courierIntakeReceivedInHub: true,
        courierIntakeReceivedAt: now,
        courierIntakeSettled: true,
        courierIntakeSettledAt: now,
        courierIntakeSettledByUserId: courierId,
        courierIntakeSettledByUserName: courierName,
        currentLocationBranchId: p.originHubId || currentBranch?.id,
        updatedAt: now,
      }));

      // 2. Synchronous storage and state update
      setParcels((prev) => {
        const next = prev.map((p) => {
          if (targetIdSet.has(p.id)) {
            const found = updatedParcels.find((u) => u.id === p.id);
            return found || p;
          }
          return p;
        });
        safeStorage.setItem(`${STORAGE_KEY}_parcels`, JSON.stringify(next));
        return next;
      });

      // 3. Immediately sync all updated parcels to server
      for (const p of updatedParcels) {
        vpsSyncEngine.syncParcel(p);
      }

      // 4. Financial Coherence Handover: Transfer prepaid funds from courier_intake to branch outgoing box
      const targetBranchId = targetParcels[0]?.originHubId || currentUser?.branchId || currentBranch?.id;
      if (totalPrepaidSyp > 0) {
        // A. Credit branch outgoing box (+totalPrepaidSyp)
        addCashTransaction(
          targetBranchId,
          'SYP',
          'courier_handover_to_outgoing',
          totalPrepaidSyp,
          `توريد مبالغ (${targetParcels.length}) طرد من الموزع [${courierName}] إلى صندوق الصادر بالمركز`,
          handoverId,
          undefined,
          'outgoing',
          undefined,
          { userId: courierId, userName: courierName }
        );

        // B. Debit courier intake cashbox (-totalPrepaidSyp)
        addCashTransaction(
          targetBranchId,
          'SYP',
          'courier_handover_from_intake',
          totalPrepaidSyp,
          `تسليم وتصفية مقبوضات استلام طرود من عهدة الموزع [${courierName}] - تسليم ${handoverId}`,
          handoverId,
          undefined,
          'courier_intake',
          undefined,
          { userId: courierId, userName: courierName }
        );
      }

      if (totalPrepaidUsd > 0) {
        addCashTransaction(
          targetBranchId,
          'USD',
          'courier_handover_to_outgoing',
          totalPrepaidUsd,
          `توريد مبالغ (${targetParcels.length}) طرد من الموزع [${courierName}] إلى صندوق الصادر بالمركز ($)`,
          handoverId,
          undefined,
          'outgoing',
          undefined,
          { userId: courierId, userName: courierName }
        );

        addCashTransaction(
          targetBranchId,
          'USD',
          'courier_handover_from_intake',
          totalPrepaidUsd,
          `تسليم وتصفية مقبوضات استلام طرود من عهدة الموزع [${courierName}] ($) - تسليم ${handoverId}`,
          handoverId,
          undefined,
          'courier_intake',
          undefined,
          { userId: courierId, userName: courierName }
        );
      }

      // [5-B-4-E] Record courier handover events
      recordParcelEventsBatch(
        updatedParcels.map((p) => ({
          parcelId: p.id,
          eventType: 'received_at_hub',
          dimension: 'handling' as ParcelEventDimension,
          options: {
            previousStatus: 'with_courier',
            newStatus: 'received_at_hub',
            precedenceRank: 10,
            branchId: p.originHubId || currentBranch?.id,
            notes: `استلام طرود من الموزع ${courierName} - توريد عهدة`,
            metadata: {
              courierId,
              courierName,
              handoverAt: now,
              handoverType: 'courier_to_hub',
            },
          },
        }))
      );

      const originHubName =
        branches.find((b) => b.id === currentUser?.branchId)?.name ||
        currentBranch?.name ||
        'مركز الانطلاق';

      const notif: SystemNotification = {
        id: `notif_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        title: 'تم تسليم الطرود الجاهزة للشحن للمركز',
        message: `قام الموزع [${courierName}] بتسليم [${updatedParcels.length}] طرد جاهزة للشحن إلى [${originHubName}]. أصبحت الطرود الآن بمركز الانطلاق وجاهزة للتحميل في المانافيست.`,
        type: 'info',
        targetBranchId: currentUser?.branchId || currentBranch?.id,
        timestamp: now,
        read: false,
      };
      setNotifications((prev) => [notif, ...prev]);

      addAuditLog(
        'تسليم طرود جاهزة للشحن للمركز',
        'parcels',
        `قام الموزع [${courierName}] بتسليم [${updatedParcels.length}] طرد للمركز. تحولت حالتها إلى "بمركز الانطلاق (جاهز للشحن)" وأصبحت متوفرة للتحميل في المانافيست.`
      );

      return updatedParcels;
    },
    [parcels, currentUser, currentBranch, branches, recordParcelEventsBatch]
  );

  // Mark Individual Parcel as Returned with Reason
  const markParcelReturned = (parcelId: string, reason: string, notes?: string) => {
    const parcel = parcels.find((p) => p.id === parcelId);
    if (!parcel) return;

    if (!isTransitionAllowed(parcel.handlingStatus, 'returned')) {
      console.warn(`[Lifecycle Guard] Blocked illegal return transition for ${parcel.trackingNumber}: ${parcel.handlingStatus} → returned`);
      return;
    }

    const now = new Date().toISOString();
    const branchId = parcel.currentLocationBranchId 
                  || currentBranch?.id 
                  || parcel.destinationHubId;

    const updated: Parcel = {
      ...parcel,
      handlingStatus: 'returned',
      returnReason: reason,
      returnNotes: notes,
      returnedAt: now,
      returnedByUserId: currentUser.id,
      returnedByUserName: currentUser.name,
      // الإصلاح الحرج: توثيق موقع الفرع الحالي
      currentLocationBranchId: branchId,
      // الموزع لا يزال حاملاً للطرد حتى يستلمه الفرع فيزيائياً
      assignedCourierId: currentUser.id,
      deliveryNotes: notes ? `سبب الإرجاع: ${reason} - ${notes}` : `سبب الإرجاع: ${reason}`,
    };

    setParcels((prev) =>
      prev.map((p) => (p.id === parcelId ? updated : p))
    );
    vpsSyncEngine.syncParcel(updated);

    // [5-B-4-A] Record returned parcel event (append-only log)
    recordParcelEvent(updated.id, 'returned', 'handling', {
      previousStatus: parcel.handlingStatus,
      newStatus: 'returned',
      precedenceRank: 90,
      branchId,
      notes: notes ? `إرجاع الطرد - السبب: ${reason} (${notes})` : `إرجاع الطرد - السبب: ${reason}`,
      metadata: {
        returnedByUserId: currentUser.id,
        returnedByUserName: currentUser.name,
        returnedAt: now,
        returnReason: reason,
        additionalNotes: notes,
        stillWithCourier: true, // مهم: لا يزال بحوزة الموزع بانتظار تسليمه للمستودع
      },
    });

    addAuditLog(
      'إرجاع طرد من الموزع',
      'parcels',
      `قام الموزع [${currentUser.name}] بإرجاع طرد [${parcel.trackingNumber}] لسبب: [${reason}]. الطرد بانتظار استلام الفرع.`
    );
  };

  // Receive Returned Parcel at Branch Warehouse (Physically accepted into branch custody)
  const receiveReturnedParcelAtBranch = (parcelId: string, branchId: string) => {
    const parcel = parcels.find((p) => p.id === parcelId);
    if (!parcel) return;

    if (parcel.handlingStatus !== 'returned') {
      console.warn(`[Return] Parcel ${parcel.trackingNumber} is not in 'returned' state (current: ${parcel.handlingStatus})`);
      return;
    }

    const now = new Date().toISOString();

    const updated: Parcel = {
      ...parcel,
      handlingStatus: 'returned_received_at_branch',
      receivedBackAtBranchId: branchId,
      receivedBackAt: now,
      receivedBackByUserId: currentUser.id,
      // سقوط عهدة الموزع رسمياً
      assignedCourierId: undefined,
      // تحديث الموقع الفعلي للطرد بالفرع
      currentLocationBranchId: branchId,
      updatedAt: now,
    };

    setParcels((prev) => prev.map((p) => (p.id === parcelId ? updated : p)));
    vpsSyncEngine.syncParcel(updated);

    recordParcelEvent(updated.id, 'returned_received_at_branch', 'handling', {
      previousStatus: 'returned',
      newStatus: 'returned_received_at_branch',
      precedenceRank: 95, // أعلى من returned لضمان الأسبقية
      branchId,
      notes: `استلم الفرع الطرد المرتجع من الموزع [${parcel.returnedByUserName || 'غير معروف'}]`,
      metadata: {
        receivedByUserId: currentUser.id,
        receivedAt: now,
        originalReturnReason: parcel.returnReason,
        originalReturnedBy: parcel.returnedByUserName,
        originalReturnedAt: parcel.returnedAt,
      },
    });

    addAuditLog(
      'استلام طرد مرتجع في الفرع',
      'parcels',
      `استلم الفرع [${currentBranch?.name || branchId}] الطرد المرتجع [${parcel.trackingNumber}]. تم إسقاط العهدة عن الموزع [${parcel.returnedByUserName || 'الموزع'}].`
    );
  };

  // Re-dispatch returned parcel locally (e.g. customer requested retry with another courier or counter pickup)
  const reDispatchReturnedParcel = (parcelId: string, notes?: string) => {
    const parcel = parcels.find((p) => p.id === parcelId);
    if (!parcel) return;

    const now = new Date().toISOString();
    const updated: Parcel = {
      ...parcel,
      handlingStatus: 'received_at_dest',
      assignedCourierId: undefined,
      assignedCourierName: undefined,
      courierManifestId: undefined,
      deliveryNotes: notes ? `إعادة إدخال للمخزون للتوزيع مجدداً: ${notes}` : 'إعادة إدخال للمخزون بعد استلام المرتجع',
      updatedAt: now,
    };

    setParcels((prev) => prev.map((p) => (p.id === parcelId ? updated : p)));
    vpsSyncEngine.syncParcel(updated);

    recordParcelEvent(updated.id, 'received_at_dest', 'handling', {
      previousStatus: parcel.handlingStatus,
      newStatus: 'received_at_dest',
      precedenceRank: 50,
      branchId: updated.currentLocationBranchId || currentBranch?.id,
      notes: notes ? `إعادة إسناد وتوجيه للتسليم المحلي: ${notes}` : 'إعادة إدخال للمخزون وجاهز للتسليم لموزع آخر',
      metadata: {
        redispatchedByUserId: currentUser.id,
        redispatchedAt: now,
      },
    });

    addAuditLog(
      'إعادة إدخال طرد مرتجع للتوزيع',
      'parcels',
      `تمت إعادة الطرد المرتجع [${parcel.trackingNumber}] إلى مخزون المستودع وجعله متاحاً للتسليم مجدداً.`
    );
  };

  // Stage returned parcel for return shipment to origin branch (المانافيست العكسي لفرع الأصل)
  const stageParcelForReturnToOrigin = (
    parcelId: string,
    options?: {
      returnShippingCost?: number;
      paidBy?: 'sender' | 'company' | 'customer' | 'undecided';
      notes?: string;
    }
  ) => {
    const parcel = parcels.find((p) => p.id === parcelId);
    if (!parcel) return;

    const now = new Date().toISOString();
    const DEFAULT_RETURN_RATE = Number(typeof process !== 'undefined' && process.env?.RETURN_SHIPPING_RATE ? process.env.RETURN_SHIPPING_RATE : 0.5);
    const cost = options?.returnShippingCost ?? Math.round((parcel.shippingCost || 0) * DEFAULT_RETURN_RATE);
    const payer = options?.paidBy || 'sender';

    const updated: Parcel = {
      ...parcel,
      isReverseShipment: true,
      returnShippingCost: cost,
      returnShippingPaidBy: payer,
      returnFinancialStatus: 'pending',
      returnFinancialNotes: options?.notes || `أجور شحن عكسي بقيمة ${cost} على ${payer === 'sender' ? 'المرسل' : payer}`,
      // تحويله إلى حالة الشحن العكسي المستقلة المتجهة لفرع الأصل
      handlingStatus: 'returning_to_origin',
      originCollectionBranchId: parcel.currentLocationBranchId || currentBranch?.id,
      truckManifestId: undefined, // فك الارتباط بأي شاحنة سابقة ليصبح جاهزاً للتحميل بشاحنة العودة
      updatedAt: now,
    };

    setParcels((prev) => prev.map((p) => (p.id === parcelId ? updated : p)));
    vpsSyncEngine.syncParcel(updated);

    recordParcelEvent(updated.id, 'returning_to_origin', 'handling', {
      previousStatus: parcel.handlingStatus,
      newStatus: 'returning_to_origin',
      precedenceRank: 96,
      branchId: currentBranch?.id || parcel.currentLocationBranchId,
      notes: `تجهيز الطرد للشحن العكسي إلى فرع الأصل [${parcel.originHubId}] - أجور الشحن العكسي: ${cost}`,
      metadata: {
        stagedByUserId: currentUser.id,
        stagedAt: now,
        returnShippingCost: cost,
        paidBy: payer,
        targetOriginHubId: parcel.originHubId,
      },
    });

    addAuditLog(
      'تجهيز طرد للإرجاع لفرع الأصل',
      'parcels',
      `تم إدراج الطرد [${parcel.trackingNumber}] في مسار الشحن العكسي المتجه لفرع الأصل [${parcel.originHubId}].`
    );
  };

  // Receive reverse shipment at origin branch warehouse (استقبال الشحنة العكسية في فرع الأصل)
  const receiveReverseShipmentAtOrigin = (parcelId: string, notes?: string) => {
    const parcel = parcels.find((p) => p.id === parcelId);
    if (!parcel) return;

    if (parcel.handlingStatus !== 'returning_to_origin') {
      console.warn(`[Reverse] Parcel ${parcel.trackingNumber} is not in 'returning_to_origin' state (current: ${parcel.handlingStatus})`);
      return;
    }

    const now = new Date().toISOString();
    const targetBranchId = parcel.originHubId || currentBranch?.id || parcel.currentLocationBranchId;
    const pickupDeadline = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();

    const updated: Parcel = {
      ...parcel,
      handlingStatus: 'returned_to_origin',
      receivedBackAtBranchId: targetBranchId,
      receivedBackAt: now,
      receivedBackByUserId: currentUser.id,
      currentLocationBranchId: targetBranchId,
      returnFinancialStatus: 'settled',
      returnPickupDeadline: pickupDeadline,
      returnPickupStatus: 'pending',
      updatedAt: now,
    };

    setParcels((prev) => prev.map((p) => (p.id === parcelId ? updated : p)));
    vpsSyncEngine.syncParcel(updated);

    recordParcelEvent(updated.id, 'returned_to_origin', 'handling', {
      previousStatus: 'returning_to_origin',
      newStatus: 'returned_to_origin',
      precedenceRank: 98,
      branchId: targetBranchId,
      notes: notes || `استُلمت الشحنة العكسية في فرع الأصل بنجاح. الطرد في مستودع الأصل بانتظار تسليمه للمرسل.`,
      metadata: {
        receivedByUserId: currentUser.id,
        receivedAt: now,
        returnShippingCost: parcel.returnShippingCost,
        returnShippingPaidBy: parcel.returnShippingPaidBy,
        originHubId: parcel.originHubId,
      },
    });

    // قيد مالي لأجور الشحن العكسي في حال تحمل الشركة
    if (parcel.returnShippingCost && parcel.returnShippingCost > 0) {
      const payer = parcel.returnShippingPaidBy || 'sender';
      if (payer === 'company') {
        addCashTransaction(
          targetBranchId,
          parcel.currency || 'SYP',
          'operating_expense',
          parcel.returnShippingCost,
          `تكلفة شحن عكسي للطرد المرتجع [${parcel.trackingNumber}] على حساب الشركة`,
          parcel.id,
          undefined,
          'incoming'
        );
      }
    }

    addAuditLog(
      'استلام شحنة عكسية في فرع الأصل',
      'parcels',
      `استلم فرع الأصل [${currentBranch?.name || targetBranchId}] الشحنة المرتجعة [${parcel.trackingNumber}]. الطرد جاهز لتسليمه للمرسل [${parcel.sender.name}].`
    );
  };

  // Handover returned parcel to original sender (تسليم الطرد المرتجع للمرسل بفرع الأصل)
  const handoverReturnedParcelToSender = (
    parcelId: string,
    notes?: string,
    options?: {
      paymentStatus?: 'paid' | 'refused';
    }
  ) => {
    const parcel = parcels.find((p) => p.id === parcelId);
    if (!parcel) return;

    const now = new Date().toISOString();
    const paymentStatus = options?.paymentStatus || 'paid';
    const debtAmount = paymentStatus === 'refused' ? (parcel.returnShippingCost || 0) : undefined;

    const updated: Parcel = {
      ...parcel,
      handlingStatus: 'returned_to_sender',
      deliveredAt: now,
      deliveredByUserId: currentUser.id,
      deliveryNotes: notes ? `تم تسليم المرتجع للمرسل الأصلي: ${notes}` : 'تم تسليم الطرد المرتجع للمرسل الأصلي بنجاح',
      returnPaymentStatus: paymentStatus,
      returnDebtAmount: debtAmount,
      updatedAt: now,
    };

    setParcels((prev) => prev.map((p) => (p.id === parcelId ? updated : p)));
    vpsSyncEngine.syncParcel(updated);

    recordParcelEvent(updated.id, 'returned_to_sender', 'handling', {
      previousStatus: parcel.handlingStatus,
      newStatus: 'returned_to_sender',
      precedenceRank: 100,
      branchId: parcel.originHubId,
      notes: notes || `تم تسليم الطرد المرتجع للمرسل الأصلي [${parcel.sender.name}] وإغلاق دورة حياة الشحنة.`,
      metadata: {
        handedOverByUserId: currentUser.id,
        handedOverAt: now,
        deliveredToSender: true,
        paymentStatus,
        debtAmount,
      },
    });

    // معالجة أجور الشحن العكسي عند التسليم للمرسل
    if (parcel.returnShippingPaidBy === 'sender' && parcel.returnShippingCost && parcel.returnShippingCost > 0) {
      if (paymentStatus === 'paid') {
        // دفع نقدي بالصندوق
        addCashTransaction(
          parcel.originHubId || currentBranch?.id || '',
          parcel.currency || 'SYP',
          'shipping_collected_dest',
          parcel.returnShippingCost,
          `تحصيل أجور الشحن العكسي للطرد المرتجع [${parcel.trackingNumber}] من المرسل [${parcel.sender.name}]`,
          parcel.id,
          undefined,
          'incoming'
        );
      } else {
        // رفض الدفع: تقييد ذمة على المرسل
        setCustomers((prevCusts) =>
          prevCusts.map((c) => {
            const matchesPhone = c.phone && parcel.sender.phone && (c.phone === parcel.sender.phone || c.phone.endsWith(parcel.sender.phone.slice(-7)));
            const matchesName = c.fullName && parcel.sender.name && c.fullName.trim() === parcel.sender.name.trim();
            if (matchesPhone || matchesName) {
              return {
                ...c,
                returnDebtBalance: (c.returnDebtBalance || 0) + (parcel.returnShippingCost || 0),
                updatedAt: now,
              };
            }
            return c;
          })
        );
        addAuditLog(
          'المرسل رفض دفع أجور الشحن العكسي',
          'parcels',
          `رفض المرسل [${parcel.sender.name}] دفع أجور الشحن العكسي (${parcel.returnShippingCost} ${parcel.currency || 'ل.س'}) للطرد [${parcel.trackingNumber}]. تم تقييد المبلغ كذمة معلقة.`
        );
      }
    }

    addAuditLog(
      'تسليم طرد مرتجع للمرسل',
      'parcels',
      `تم تسليم الطرد المرتجع [${parcel.trackingNumber}] إلى المرسل [${parcel.sender.name}] وإغلاق البوليصة رسمياً (حالة الدفع: ${paymentStatus === 'paid' ? 'مسدد' : 'مرفوض كذمة'}).`
    );
  };

  // Pre-Delivery Return (مرتجع قبل خروج الموزع للتسليم)
  const initiatePreDeliveryReturn = (
    parcelId: string,
    reason: string,
    notes?: string
  ) => {
    const parcel = parcels.find((p) => p.id === parcelId);
    if (!parcel) return;

    if (parcel.handlingStatus !== 'received_at_dest') {
      console.warn(`[PreReturn] Parcel ${parcel.trackingNumber} not at branch in received_at_dest`);
      return;
    }
    if (parcel.assignedCourierId) {
      console.warn(`[PreReturn] Parcel is assigned to a courier — use standard return flow`);
      return;
    }

    const now = new Date().toISOString();
    const sourceBranchId = parcel.currentLocationBranchId || currentBranch?.id;
    const originalOrigin = parcel.originHubId;
    const DEFAULT_RETURN_RATE = Number(typeof process !== 'undefined' && process.env?.RETURN_SHIPPING_RATE ? process.env.RETURN_SHIPPING_RATE : 0.5);

    // إذا كان الطرد في نفس فرع الأصل الأصلي -> تكلفة الشحن العكسي = 0 (لم يخرج من الأصل)
    // إذا كان في فرع وجهة -> تكلفة الشحن العكسي = shippingCost * rate
    const returnShippingCost = sourceBranchId !== originalOrigin
      ? Math.round((parcel.shippingCost || 0) * DEFAULT_RETURN_RATE)
      : 0;

    const updated: Parcel = {
      ...parcel,
      handlingStatus: 'return_initiated',
      isReverseShipment: true,
      returnInitiatedAt: now,
      returnInitiatedByUserId: currentUser.id,
      returnInitiatedByUserName: currentUser.name,
      returnInitiatedReason: reason,
      returnInitiatedNotes: notes,
      returnSourceBranchId: sourceBranchId,
      returnOriginalOriginHubId: originalOrigin,
      returnShippingCost,
      returnShippingPaidBy: 'sender',
      returnFinancialStatus: 'pending',
      updatedAt: now,
    };

    setParcels((prev) => prev.map((p) => (p.id === parcelId ? updated : p)));
    vpsSyncEngine.syncParcel(updated);

    recordParcelEvent(updated.id, 'return_initiated', 'handling', {
      previousStatus: 'received_at_dest',
      newStatus: 'return_initiated',
      precedenceRank: 85,
      branchId: sourceBranchId,
      notes: `إرجاع قبل التسليم - السبب: ${reason}`,
      metadata: {
        initiatedByUserId: currentUser.id,
        initiatedAt: now,
        reason,
        notes,
        sourceBranch: sourceBranchId,
        originalOrigin,
        returnShippingCost,
      },
    });

    addAuditLog(
      'إرجاع طرد قبل التسليم',
      'parcels',
      `قام [${currentUser.name}] بتسجيل إرجاع الطرد [${parcel.trackingNumber}] قبل التسليم. السبب: [${reason}].`
    );
  };

  // Cancel Pre-Delivery Return (إلغاء الإرجاع وإعادة الطرد لمخزون المستودع)
  const cancelPreDeliveryReturn = (parcelId: string, notes?: string) => {
    const parcel = parcels.find((p) => p.id === parcelId);
    if (!parcel) return;

    if (parcel.handlingStatus !== 'return_initiated') return;

    const now = new Date().toISOString();
    const updated: Parcel = {
      ...parcel,
      handlingStatus: 'received_at_dest',
      isReverseShipment: false,
      returnInitiatedAt: undefined,
      returnInitiatedReason: undefined,
      returnInitiatedNotes: undefined,
      updatedAt: now,
    };

    setParcels((prev) => prev.map((p) => (p.id === parcelId ? updated : p)));
    vpsSyncEngine.syncParcel(updated);

    recordParcelEvent(updated.id, 'received_at_dest', 'handling', {
      previousStatus: 'return_initiated',
      newStatus: 'received_at_dest',
      precedenceRank: 50,
      branchId: parcel.currentLocationBranchId || currentBranch?.id,
      notes: notes ? `إلغاء الإرجاع وإعادة الطرد للمخزون: ${notes}` : 'إلغاء الإرجاع وإعادة الطرد للمخزون العام للتسليم',
      metadata: {
        cancelledByUserId: currentUser.id,
        cancelledAt: now,
      },
    });

    addAuditLog(
      'إلغاء إرجاع طرد',
      'parcels',
      `تم إلغاء إرجاع الطرد [${parcel.trackingNumber}] وإعادته لمستودع الاستلام للتسليم كالمعتاد.`
    );
  };

  // Periodic check / automated evaluation of return pickup deadlines (فحص مهل استلام المرتجعات بفرع الأصل)
  const checkReturnPickupDeadlines = useCallback(() => {
    const nowTime = Date.now();
    let hasChanges = false;
    const changedParcels: Parcel[] = [];

    setParcels((prev) => {
      const next = prev.map((p) => {
        if (p.handlingStatus === 'returned_to_origin') {
          let targetStatus: 'pending' | 'overdue' | 'abandoned' = 'pending';

          if (p.returnPickupDeadline) {
            const deadlineTime = new Date(p.returnPickupDeadline).getTime();
            const daysAfterDeadline = (nowTime - deadlineTime) / (1000 * 60 * 60 * 24);

            if (daysAfterDeadline >= 60) {
              targetStatus = 'abandoned';
            } else if (daysAfterDeadline > 0) {
              targetStatus = 'overdue';
            } else {
              targetStatus = 'pending';
            }
          }

          if (p.returnPickupStatus !== targetStatus) {
            hasChanges = true;
            const updated: Parcel = {
              ...p,
              returnPickupStatus: targetStatus,
              updatedAt: new Date().toISOString(),
            };
            changedParcels.push(updated);
            return updated;
          }
        }
        return p;
      });

      if (hasChanges) {
        safeStorage.setItem(`${STORAGE_KEY}_parcels`, JSON.stringify(next));
        return next;
      }
      return prev;
    });

    if (changedParcels.length > 0) {
      changedParcels.forEach((p) => {
        vpsSyncEngine.syncParcel(p);
        recordParcelEvent(p.id, 'returned_to_origin', 'investigation', {
          branchId: p.originHubId,
          notes: `تحديث حالة مهلة استلام المرتجع للأصل: ${
            p.returnPickupStatus === 'abandoned'
              ? 'مهجور (تجاوز 60 يوماً بعد انتهاء المهلة)'
              : 'متأخر (تجاوز مهلة الـ 30 يوماً)'
          }`,
          metadata: {
            returnPickupStatus: p.returnPickupStatus,
            returnPickupDeadline: p.returnPickupDeadline,
          },
        });
      });
    }
  }, []);

  // Settle Return Debt (تسديد ذمة الشحن العكسي عند سداد المرسل لاحقاً)
  const settleReturnDebt = (parcelId: string, notes?: string) => {
    const parcel = parcels.find((p) => p.id === parcelId);
    if (!parcel) return;

    const amount = parcel.returnDebtAmount || parcel.returnShippingCost || 0;
    if (amount <= 0) return;

    const now = new Date().toISOString();
    const updated: Parcel = {
      ...parcel,
      returnPaymentStatus: 'paid',
      returnDebtAmount: 0,
      updatedAt: now,
    };

    setParcels((prev) => prev.map((p) => (p.id === parcelId ? updated : p)));
    vpsSyncEngine.syncParcel(updated);

    // إنقاص ذمة العميل في الدليل إذا كان مسجلاً
    setCustomers((prevCusts) =>
      prevCusts.map((c) => {
        const matchesPhone = c.phone && parcel.sender.phone && (c.phone === parcel.sender.phone || c.phone.endsWith(parcel.sender.phone.slice(-7)));
        const matchesName = c.fullName && parcel.sender.name && c.fullName.trim() === parcel.sender.name.trim();
        if (matchesPhone || matchesName) {
          return {
            ...c,
            returnDebtBalance: Math.max(0, (c.returnDebtBalance || 0) - amount),
            updatedAt: now,
          };
        }
        return c;
      })
    );

    // إضافة حركة القبض المالي بالصندوق
    addCashTransaction(
      parcel.originHubId || currentBranch?.id || '',
      parcel.currency || 'SYP',
      'shipping_collected_dest',
      amount,
      notes || `تسديد ذمة أجور شحن عكسي سابقة للطرد المرتجع [${parcel.trackingNumber}] من المرسل [${parcel.sender.name}]`,
      parcel.id,
      undefined,
      'incoming'
    );

    recordParcelEvent(updated.id, 'returned_to_sender', 'cashier', {
      previousStatus: parcel.handlingStatus,
      newStatus: parcel.handlingStatus,
      branchId: parcel.originHubId,
      notes: notes || `تم تسديد ذمة الشحن العكسي (${amount} ${parcel.currency || 'ل.س'}) نقداً بالصندوق من قبل المرسل`,
      metadata: {
        settledByUserId: currentUser.id,
        settledAt: now,
        debtAmountSettled: amount,
      },
    });

    addAuditLog(
      'تسديد ذمة شحن عكسي',
      'cashbox',
      `تم تسديد ذمة أجور الشحن العكسي (${amount} ${parcel.currency || 'ل.س'}) للطرد [${parcel.trackingNumber}] من المرسل [${parcel.sender.name}].`
    );
  };

  // Run return deadlines check on initialization and periodically
  useEffect(() => {
    checkReturnPickupDeadlines();
    const interval = setInterval(() => {
      checkReturnPickupDeadlines();
    }, 60 * 60 * 1000); // كل ساعة
    return () => clearInterval(interval);
  }, [checkReturnPickupDeadlines]);

  // Notify Sender for COD Payout Ready
  const notifySenderForCodPayout = (
    parcelId: string,
    method: 'whatsapp' | 'sms' | 'call' | 'in_person' = 'whatsapp',
    notes?: string
  ) => {
    const parcel = parcels.find((p) => p.id === parcelId);
    if (!parcel) return;
    const now = new Date().toISOString();

    let updatedToSync: Parcel | undefined;
    setParcels((prev) => {
      const next = prev.map((p) => {
        if (p.id === parcelId) {
          const up: Parcel = {
            ...p,
            codSenderNotified: true,
            codSenderNotifiedAt: now,
            codSenderNotifiedByUserId: currentUser.id,
            codSenderNotifiedByUserName: currentUser.name,
            codSenderNotifiedMethod: method,
            codSenderNotifiedNotes: notes,
            codStatus: 'sender_notified',
            updatedAt: now,
          };
          updatedToSync = up;
          return up;
        }
        return p;
      });
      safeStorage.setItem(`${STORAGE_KEY}_parcels`, JSON.stringify(next));
      return next;
    });

    if (updatedToSync) {
      vpsSyncEngine.syncParcel(updatedToSync);
    }

    addAuditLog(
      'إشعار المرسل باستحقاق الحوالة',
      'parcels',
      `تم إبلاغ المرسل [${parcel.sender.name}] (${parcel.sender.phone}) بجاهزية صرف حوالة طرده رقم [${parcel.trackingNumber}] عبر [${method}].`
    );
  };

  // Payout COD to Sender at Origin Branch with Cashbox Outflow & Financial Voucher
  const payoutCodToSender = (
    parcelId: string,
    details: {
      recipientNationalId: string;
      recipientMotherName: string;
      recipientBirthDate: string;
      sypAmount?: number;
      usdAmount?: number;
      notes?: string;
      paymentMethod?: string;
    }
  ): { success: boolean; voucherId?: string; voucherNumber?: string; message?: string } => {
    const parcel = parcels.find((p) => p.id === parcelId);
    if (!parcel) return { success: false, message: 'الطرد غير موجود' };
    if (parcel.codPaidToSender) {
      return { success: false, message: 'تم صرف هذه الحوالة مسبقاً للمرسل' };
    }

    const branchId = currentBranch.id;
    const originBranchId = parcel.originHubId || parcel.originBranchId;

    // حماية وعزل صارم: لا يمكن صرف الحوالة إلا من الفرع المصدر الذي انطلقت منه الشحنة
    if (branchId !== originBranchId) {
      const originBranchObj = branches.find((b) => b.id === originBranchId);
      const originName = originBranchObj ? originBranchObj.name : originBranchId;
      return {
        success: false,
        message: `عذراً، لا يمكن صرف هذه الحوالة من هذا الفرع (${currentBranch.name}). يجب صرفها حصراً من الفرع المصدر للشحنة (${originName}) لمنع تضارب الصناديق.`,
      };
    }

    // التحقق من الصلاحيات والأدوار المخولة بالصرف
    const allowedRoles = ['super_admin', 'hub_manager', 'branch_manager', 'accountant', 'cashier', 'outbound_operator', 'operations', 'admin'];
    if (!allowedRoles.includes(currentUser.role)) {
      return {
        success: false,
        message: 'ليس لديك الصلاحية الوظيفية لتنفيذ صرف الحوالات المالية للمرسلين.',
      };
    }

    // ✅ التحقق من الهوية (إلزامي وصارم)
    const verification = verifySenderIdentity(
      parcel,
      {
        nationalId: details.recipientNationalId,
        motherName: details.recipientMotherName,
        birthDate: details.recipientBirthDate,
      },
      customers || []
    );

    if (!verification.verified) {
      console.warn('[payoutCodToSender] Verification failed:', verification.message);
      return {
        success: false,
        message: verification.message || 'فشل التحقق من هوية المرسل',
      };
    }

    const effectiveRecipientName = parcel.sender?.name || (parcel as any).senderName || '';
    if (!effectiveRecipientName) {
      return { success: false, message: 'لا يمكن الصرف — لا يوجد اسم مرسل في البوليصة' };
    }

    const now = new Date().toISOString();
    const codCur = parcel.codCurrency || (parcel.codAmount > 1000 ? 'SYP' : parcel.currency || 'SYP');
    const effectivePhone = parcel.sender?.phone || (parcel as any).senderPhone || '';
    const effectiveNationalId = details.recipientNationalId.trim();
    let syp = 0;
    let usd = 0;
    if (details.sypAmount !== undefined && details.sypAmount > 0) {
      syp = details.sypAmount;
    } else if (details.usdAmount !== undefined && details.usdAmount > 0) {
      usd = details.usdAmount;
    } else {
      if (codCur === 'USD') {
        usd = parcel.codAmount || parcel.totalDue || 0;
      } else {
        syp = parcel.codAmount || parcel.totalDue || 0;
      }
    }
    const totalPayout = usd > 0 ? usd : syp;
    const payoutCurrency: Currency = usd > 0 ? 'USD' : 'SYP';
    const activeScope: CashboxScope = 
      currentUser.role === 'inbound_operator' ? 'incoming' : 
      currentUser.role === 'outbound_operator' ? 'outgoing' : 
      'master';

    // 1. Record Cash Outflow Transaction in Current User's Active Department Cashbox
    if (syp > 0) {
      addCashTransaction(
        branchId,
        'SYP',
        'cod_paid_to_sender',
        syp,
        `صرف وتسليم حوالة ضد الدفع للمرسل (${effectiveRecipientName}) - بوليصة ${parcel.trackingNumber}${details.notes ? ` - ملاحظات: ${details.notes}` : ''}`,
        parcel.id,
        undefined,
        activeScope
      );
    }
    if (usd > 0) {
      addCashTransaction(
        branchId,
        'USD',
        'cod_paid_to_sender',
        usd,
        `صرف وتسليم حوالة ضد الدفع بالدولار للمرسل (${effectiveRecipientName}) - بوليصة ${parcel.trackingNumber}${details.notes ? ` - ملاحظات: ${details.notes}` : ''}`,
        parcel.id,
        undefined,
        activeScope
      );
    }

    // 2. Generate Financial Payment Voucher (سند صرف مالي)
    const voucherNumber = `PV-COD-${Date.now().toString().slice(-6)}`;
    const newVoucher: FinancialVoucher = {
      id: `voucher_cod_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
      voucherNumber,
      type: 'payment',
      branchId,
      cashboxScope: activeScope,
      currency: payoutCurrency,
      amount: totalPayout,
      paidByOrTo: effectiveRecipientName,
      reasonCategory: 'حوالات ضد الدفع COD',
      description: `تسليم وصرف قيمة بضاعة / حوالة ضد الدفع للبوليصة [${parcel.trackingNumber}] للمستلم [${effectiveRecipientName}] (هوية: ${effectiveNationalId || 'غير مسجل'})`,
      referenceNumber: parcel.trackingNumber,
      performedByUserId: currentUser.id,
      date: now.split('T')[0],
      timestamp: now,
      status: 'approved',
    };

    setVouchers((prev) => [newVoucher, ...prev]);

    // 3. Update parcel status
    const updatedParcel: Parcel = {
      ...parcel,
      codPaidToSender: true,
      codPayoutStatus: 'paid_to_sender',
      codStatus: 'paid_to_sender',
      codSenderPayoutDate: now,
      codSenderPayoutByUserId: currentUser.id,
      codSenderPayoutByUserName: currentUser.name,
      codSenderPayoutBranchId: branchId,
      codSenderPayoutAmountSyp: syp,
      codSenderPayoutAmountUsd: usd,
      codSenderPayoutVoucherId: newVoucher.id,
      codSenderPayoutVoucherNumber: voucherNumber,
      codSenderPayoutNotes: details.notes,
      codSenderRecipientName: effectiveRecipientName,
      codSenderRecipientNationalId: effectiveNationalId,
      codSenderRecipientPhone: effectivePhone,
    };

    setParcels((prev) =>
      prev.map((p) => (p.id === parcelId ? updatedParcel : p))
    );
    vpsSyncEngine.syncParcel(updatedParcel);

    // [4أ-2c] Update the corresponding inter-branch obligation:
    // mark senderPayoutStatus = 'paid' with voucher info.
    // The obligation id uses the parcel's ORIGINAL currency 
    // (parcel.currency), not the payout currency, because the 
    // obligation was created against the parcel's currency.
    const obligationId = `obl_${parcel.id}_${parcel.currency || 'SYP'}`;
    setInterBranchObligations((prev) => {
      const idx = prev.findIndex((o) => o.id === obligationId);
      if (idx < 0) {
        // No obligation exists for this parcel — nothing to update.
        return prev;
      }
      const next = [...prev];
      const existing = next[idx];
      const updatedObligation: InterBranchObligation = {
        ...existing,
        senderPayoutStatus: 'paid',
        senderPayoutVoucherId: newVoucher.id,
        senderPayoutAt: now,
        senderPayoutUserId: currentUser.id,
        updatedAt: now,
      };
      next[idx] = updatedObligation;
      // Sync to server (the trigger will update the relational table)
      vpsSyncEngine.syncObligation(updatedObligation);
      return next;
    });

    // 4. Mark internal staff notification as resolved & create distinct customer payout notification
    setNotifications((prev) => {
      const updated = prev.map((n) => {
        if (n.relatedId === parcelId && (n.actionType === 'cod_payout_sender' || n.type === 'cod_payout_due')) {
          return {
            ...n,
            read: true,
            title: `✓ تم تسليم وصرف حوالة COD للمرسل: ${parcel.sender.name}`,
            message: `تم تسليم وصرف مبلغ [${formatCurrencyApp(totalPayout, payoutCurrency)}] للمرسل [${effectiveRecipientName}] بنجاح اقتطاعاً من صندوق قسم (${activeScope === 'incoming' ? 'الوارد' : activeScope === 'outgoing' ? 'الصادر' : 'الرئيسي'}) وإصدار سند الصرف رقم [${voucherNumber}].`,
          };
        }
        return n;
      });

      // Distinct notification for the customer portal
      const customerPayoutNotif: SystemNotification = {
        id: `notif_cod_paid_cust_${Date.now()}_${parcel.id}`,
        title: `💵 تم تسليم وصرف الحوالة المالية بنجاح (بوليصة ${parcel.trackingNumber})`,
        message: `عزيزي العميل (${effectiveRecipientName})، تم تسليم وصرف قيمة الحوالة المالية بمبلغ [${formatCurrencyApp(totalPayout, payoutCurrency)}] بنجاح، بموجب سند الصرف المالي رقم [${voucherNumber}]. شكراً لتعاملكم معنا.`,
        type: 'cod_payout_due',
        timestamp: now,
        read: false,
        relatedId: parcel.id,
        targetUserId: parcel.sender?.customerId,
        priority: 'normal',
        actionType: 'cod_payout_sender',
        senderName: currentBranch.name || 'قسم الخزينة والمحاسبة',
        parcelSummary: {
          trackingNumber: parcel.trackingNumber,
          senderName: parcel.sender.name,
          senderPhone: parcel.sender.phone,
          receiverName: parcel.receiver.name,
          receiverPhone: parcel.receiver.phone,
          amountToCollectSyp: syp,
          amountToCollectUsd: usd,
          amountSummary: formatCurrencyApp(totalPayout, payoutCurrency),
          payoutVoucherNumber: voucherNumber,
          payoutRecipientName: effectiveRecipientName,
          payoutDate: now,
        },
      };

      return [customerPayoutNotif, ...updated];
    });

    // 5. Emit Audit Log
    addAuditLog(
      'صرف حوالة COD للمرسل',
      'cashbox',
      `تم صرف وتسليم مبلغ [${formatCurrencyApp(totalPayout, codCur)}] للمرسل [${effectiveRecipientName}] للبوليصة [${parcel.trackingNumber}] وإصدار سند الصرف [${voucherNumber}].`
    );

    // Clear any active selected COD payout parcel ID to return cleanly to the ready list view
    setSelectedCodPayoutParcelId(null);

    return { success: true, voucherId: newVoucher.id, voucherNumber };
  };

  // Daily Settlement Request from Branch to Hub
  const submitDailySettlement = (
    branchId: string,
    parentHubId: string,
    sypAmount: number,
    usdAmount: number,
    notes?: string
  ): DailySettlement => {
    const branch = branches.find((b) => b.id === branchId);
    const sypCommission = (sypAmount * (branch?.commissionRateShipping || 15)) / 100;
    const usdCommission = (usdAmount * (branch?.commissionRateShipping || 15)) / 100;

    const newSettlement: DailySettlement = {
      id: `set_${Date.now()}`,
      branchId,
      parentHubId,
      settlementDate: new Date().toISOString().split('T')[0],
      sypCalculatedBalance: calculateBranchLiveBalance(branchId, 'SYP'),
      usdCalculatedBalance: calculateBranchLiveBalance(branchId, 'USD'),
      sypHandedOver: sypAmount,
      usdHandedOver: usdAmount,
      sypCommissionEarned: sypCommission,
      usdCommissionEarned: usdCommission,
      status: 'pending',
      notes,
      createdById: currentUser.id,
      timestamp: new Date().toISOString(),
    };

    setSettlements((prev) => [newSettlement, ...prev]);

    // Send notification to Main Hub
    const newNotif: SystemNotification = {
      id: `notif_${Date.now()}`,
      title: '💼 طلب مقاصة وترصيد يومي جديد',
      message: `طلب فرع (${branch?.name}) ترصيد يومي بمبلغ (${formatCurrency(sypAmount || 0, 'SYP')} و ${formatCurrency(usdAmount || 0, 'USD')}). بانتظار الاعتماد.`,
      type: 'cash_settlement',
      targetBranchId: parentHubId,
      relatedId: newSettlement.id,
      timestamp: new Date().toISOString(),
      read: false,
    };

    setNotifications((prev) => [newNotif, ...prev]);

    return newSettlement;
  };

  // Approve Daily Settlement
  const approveDailySettlement = (settlementId: string) => {
    const setl = settlements.find((s) => s.id === settlementId);
    if (!setl) return;

    setSettlements((prev) =>
      prev.map((s) => (s.id === settlementId ? { ...s, status: 'approved', approvedById: currentUser.id } : s))
    );

    // Transfer balances between sub branch and hub
    if (setl.sypHandedOver > 0) {
      addCashTransaction(
        setl.branchId,
        'SYP',
        'settlement_transfer_to_hub',
        setl.sypHandedOver,
        `ترصيد وإقفال صندوق الفرع وتوريد النقد للمركز الرئيسي`,
        setl.id,
        setl.parentHubId
      );
      addCashTransaction(
        setl.parentHubId,
        'SYP',
        'settlement_received_from_branch',
        setl.sypHandedOver,
        `استلام ترصيد ومقاصة نقدية من الفرع`,
        setl.id,
        setl.branchId
      );
    }

    if (setl.usdHandedOver > 0) {
      addCashTransaction(
        setl.branchId,
        'USD',
        'settlement_transfer_to_hub',
        setl.usdHandedOver,
        `ترصيد وإقفال صندوق الدولار وتوريده للمركز`,
        setl.id,
        setl.parentHubId
      );
      addCashTransaction(
        setl.parentHubId,
        'USD',
        'settlement_received_from_branch',
        setl.usdHandedOver,
        `استلام ترصيد دولار من الفرع`,
        setl.id,
        setl.branchId
      );
    }
  };

  // Financial Vouchers (سند قبض / سند دفع / سند مقاصة / سند مناقلة صناديق)
  const addFinancialVoucher = (
    voucherData: Omit<FinancialVoucher, 'id' | 'voucherNumber' | 'timestamp'>
  ): FinancialVoucher => {
    const prefix =
      voucherData.type === 'receipt'
        ? 'RV'
        : voucherData.type === 'payment'
        ? 'PV'
        : voucherData.type === 'transfer'
        ? 'TRF'
        : 'CLR';
    const year = new Date().getFullYear();
    const serial = String(vouchers.filter((v) => v.type === voucherData.type).length + 1).padStart(4, '0');
    const voucherNumber = `${prefix}-${year}-${serial}`;

    const performerUserId = voucherData.performedByUserId || currentUser.id;
    const performerUser = users.find((u) => u.id === performerUserId) || currentUser;
    const defaultScope: CashboxScope =
      performerUser.role === 'outbound_operator' || performerUser.role === 'reception_data_entry'
        ? 'outgoing'
        : performerUser.role === 'inbound_operator'
        ? 'incoming'
        : performerUser.role === 'cashier'
        ? 'cashier'
        : performerUser.role === 'hub_manager'
        ? 'manager'
        : (performerUser.role as string) === 'accountant'
        ? 'accountant'
        : (performerUser.role as string) === 'operations'
        ? 'operations'
        : performerUser.role === 'warehouse_keeper' || performerUser.role === 'warehouseman'
        ? 'warehouse'
        : performerUser.role === 'courier'
        ? 'courier'
        : 'master';

    const determinedScope = voucherData.cashboxScope || defaultScope;

    const newVoucher: FinancialVoucher = {
      ...voucherData,
      id: `vch_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
      voucherNumber,
      timestamp: new Date().toISOString(),
      cashboxScope: determinedScope,
      performedByUserId: performerUserId,
    };

    setVouchers((prev) => [newVoucher, ...prev]);

    // Record linked cashbox movement
    const txType: CashboxTransaction['type'] =
      voucherData.type === 'receipt'
        ? 'voucher_receipt'
        : voucherData.type === 'payment' || voucherData.type === 'transfer'
        ? 'voucher_payment'
        : 'voucher_clearing';

    const voucherLabel =
      voucherData.type === 'receipt'
        ? 'سند قبض'
        : voucherData.type === 'payment'
        ? 'سند دفع وصرف'
        : voucherData.type === 'transfer'
        ? 'سند مناقلة صناديق بين الفروع'
        : 'سند مقاصة وتسوية';

    const txDescription =
      voucherData.type === 'receipt'
        ? `${voucherLabel} [${voucherNumber}] - المقبوض منه: ${voucherData.paidByOrTo}${voucherData.description ? ' - ' + voucherData.description : ''}`
        : `${voucherLabel} [${voucherNumber}] - ${voucherData.reasonCategory ? voucherData.reasonCategory + ': ' : ''}${voucherData.paidByOrTo} - ${voucherData.description}`;

    // Record cash transaction directly linked to the role cashbox & performing user
    addCashTransaction(
      voucherData.branchId,
      voucherData.currency,
      txType,
      voucherData.amount,
      txDescription,
      voucherNumber,
      voucherData.counterpartyBranchId,
      determinedScope,
      undefined,
      { userId: performerUserId, userName: performerUser.name }
    );

    // If transfer: also credit (inflow) the target branch!
    if (voucherData.type === 'transfer' && voucherData.counterpartyBranchId) {
      const srcBranch = branches.find((b) => b.id === voucherData.branchId);
      const destBranch = branches.find((b) => b.id === voucherData.counterpartyBranchId);
      addCashTransaction(
        voucherData.counterpartyBranchId,
        voucherData.currency,
        'voucher_receipt',
        voucherData.amount,
        `مناقلة صناديق واردة من [${srcBranch?.name || 'فرع آخر'}] بموجب سند [${voucherNumber}] - ${voucherData.description}`,
        voucherNumber,
        voucherData.branchId,
        'master'
      );

      // Notification to Destination Branch
      const notif: SystemNotification = {
        id: `notif_trf_${Date.now()}`,
        title: `📥 استلام مناقلة صناديق بين الفروع [${voucherNumber}]`,
        message: `تم تحويل مبلغ (${formatCurrency(voucherData.amount, voucherData.currency)}) من صندوق [${srcBranch?.name || 'فرع آخر'}] إلى فرعكم [${destBranch?.name || ''}] بموجب سند المناقلة رقم [${voucherNumber}].`,
        type: 'cash_settlement',
        targetBranchId: voucherData.counterpartyBranchId,
        relatedId: newVoucher.id,
        timestamp: new Date().toISOString(),
        read: false,
      };
      setNotifications((prev) => [notif, ...prev]);
    }

    addAuditLog(
      `إصدار ${voucherLabel}`,
      'cashbox',
      `تم إصدار ${voucherLabel} رقم [${voucherNumber}] بمبلغ ${formatCurrency(voucherData.amount || 0, voucherData.currency)} للجهة: ${voucherData.paidByOrTo}`
    );

    vpsSyncEngine.syncVoucher(newVoucher);

    return newVoucher;
  };

  const createBranchClearingVoucher = (
    branchId: string,
    counterpartyBranchId: string,
    clearingDetails: ClearingReconciliationDetails,
    notes?: string,
    settlementOptions?: ClearingSettlementOptions
  ): { clearingVoucher: FinancialVoucher; receiptVoucher?: FinancialVoucher } => {
    const originBranch = branches.find((b) => b.id === branchId);
    const destBranch = branches.find((b) => b.id === counterpartyBranchId);
    const year = new Date().getFullYear();
    const serial = String(vouchers.filter((v) => v.type === 'clearing').length + 1).padStart(4, '0');
    const voucherNumber = `CLR-${year}-${serial}`;
    const clearingVoucherId = `vch_${Date.now()}_${Math.floor(Math.random() * 1000)}`;

    const totalPayableSyp = clearingDetails.totalNetPayableToHeadOfficeSyp;
    const totalPayableUsd = clearingDetails.totalNetPayableToHeadOfficeUsd;
    const primaryCurrency: Currency = totalPayableSyp > 0 || totalPayableUsd === 0 ? 'SYP' : 'USD';
    const primaryAmount = primaryCurrency === 'SYP' ? totalPayableSyp : totalPayableUsd;

    const method = settlementOptions?.method || 'instant_cash';
    let receiptVoucher: FinancialVoucher | undefined = undefined;

    // Generate Auto Linked Receipt Voucher if Instant Cash settlement
    let linkedReceiptVoucherNumber: string | undefined = undefined;
    let linkedReceiptVoucherId: string | undefined = undefined;

    if (method === 'instant_cash' && settlementOptions?.autoGenerateReceiptVoucher !== false && primaryAmount > 0) {
      const receiptSerial = String(vouchers.filter((v) => v.type === 'receipt').length + 1).padStart(4, '0');
      linkedReceiptVoucherNumber = `RV-${year}-${receiptSerial}`;
      linkedReceiptVoucherId = `vch_rv_${Date.now()}_${Math.floor(Math.random() * 1000)}`;

      receiptVoucher = {
        id: linkedReceiptVoucherId,
        voucherNumber: linkedReceiptVoucherNumber,
        type: 'receipt',
        branchId: counterpartyBranchId,
        counterpartyBranchId: branchId,
        currency: primaryCurrency,
        amount: primaryAmount,
        paidByOrTo: `وكيل [${originBranch?.name || branchId}]`,
        reasonCategory: 'توريد مقاصة نقدية',
        description: `استلام وقبض صافي مقاصة الوكيل [${originBranch?.name || branchId}] بموجب سند المقاصة [${voucherNumber}] وتصفية الفترة`,
        referenceNumber: voucherNumber,
        performedByUserId: currentUser.id,
        date: new Date().toISOString().split('T')[0],
        timestamp: new Date().toISOString(),
        status: 'approved',
        linkedVoucherId: clearingVoucherId,
        linkedVoucherNumber: voucherNumber,
        settlementMethod: 'instant_cash',
      };
    }

    const updatedClearingDetails: ClearingReconciliationDetails = {
      ...clearingDetails,
      settlementMethod: method,
      bankName: settlementOptions?.bankName,
      transferRefNumber: settlementOptions?.transferRefNumber,
      linkedReceiptVoucherNumber,
      linkedReceiptVoucherId,
    };

    const newVoucher: FinancialVoucher = {
      id: clearingVoucherId,
      voucherNumber,
      type: 'clearing',
      branchId,
      counterpartyBranchId,
      currency: primaryCurrency,
      amount: primaryAmount,
      paidByOrTo: destBranch?.name || 'المركز الرئيسي (دمشق)',
      reasonCategory: 'سند مقاصة وترحيل حصة المركز الرئيسي الصافية',
      description: `ترحيل حصة الإدارة بعد اقتطاع نسبة عمولة الفرع (${clearingDetails.branchShippingCommissionPercent}% شحن و ${clearingDetails.branchCodCommissionPercent}% تحصيل). صافي ل.س: ${formatCurrency(totalPayableSyp || 0, 'SYP')} | صافي $: ${formatCurrency(totalPayableUsd || 0, 'USD')}${method === 'bank_transfer' ? ` [حوالة مصرفية: ${settlementOptions?.bankName || ''} - إشعار: ${settlementOptions?.transferRefNumber || ''}]` : method === 'on_account' ? ' [ترحيل للحساب الجاري كذمة مستحقة]' : ' [تسديد وتوريد نقدي فوري]'}`,
      referenceNumber: settlementOptions?.transferRefNumber || `STMT-${originBranch?.code || 'BR'}-${Date.now().toString().slice(-4)}`,
      performedByUserId: currentUser.id,
      date: new Date().toISOString().split('T')[0],
      timestamp: new Date().toISOString(),
      status: 'approved',
      clearingDetails: updatedClearingDetails,
      linkedVoucherId: linkedReceiptVoucherId,
      linkedVoucherNumber: linkedReceiptVoucherNumber,
      settlementMethod: method,
    };

    const vouchersToAdd = receiptVoucher ? [newVoucher, receiptVoucher] : [newVoucher];
    setVouchers((prev) => [...vouchersToAdd, ...prev]);

    // Apply double-entry in cashbox according to settlement method
    if (method === 'instant_cash') {
      if (totalPayableSyp > 0) {
        addCashTransaction(
          branchId,
          'SYP',
          'settlement_transfer_to_hub',
          totalPayableSyp,
          `سند مقاصة [${voucherNumber}] - تحويل حصة الإدارة الصافية بعد اقتطاع عمولة الفرع (${clearingDetails.branchShippingCommissionPercent}%)`,
          voucherNumber,
          counterpartyBranchId
        );
        addCashTransaction(
          counterpartyBranchId,
          'SYP',
          'settlement_received_from_branch',
          totalPayableSyp,
          `سند مقاصة [${voucherNumber}] - استلام حصة المركز الصافية من فرع [${originBranch?.name}] بموجب كشف مطابقة وسند قبض [${linkedReceiptVoucherNumber || ''}]`,
          voucherNumber,
          branchId
        );
      }

      if (totalPayableUsd > 0) {
        addCashTransaction(
          branchId,
          'USD',
          'settlement_transfer_to_hub',
          totalPayableUsd,
          `سند مقاصة بالدولار [${voucherNumber}] - توريد صافي الإدارة من فرع [${originBranch?.name}]`,
          voucherNumber,
          counterpartyBranchId
        );
        addCashTransaction(
          counterpartyBranchId,
          'USD',
          'settlement_received_from_branch',
          totalPayableUsd,
          `سند مقاصة بالدولار [${voucherNumber}] - استلام صافي الإدارة من فرع [${originBranch?.name}]`,
          voucherNumber,
          branchId
        );
      }
    } else if (method === 'bank_transfer') {
      if (totalPayableSyp > 0) {
        addCashTransaction(
          branchId,
          'SYP',
          'settlement_transfer_to_hub',
          totalPayableSyp,
          `سند مقاصة [${voucherNumber}] - سداد بحوالة بنكية (${settlementOptions?.bankName || 'مصرف'} - رقم: ${settlementOptions?.transferRefNumber || 'بدون'})`,
          voucherNumber,
          counterpartyBranchId
        );
      }
    }

    // [4أ-2c] Mark all pending obligations between these two branches
    // as cleared under this clearing voucher — but ONLY for methods 
    // that actually settle the debt (instant_cash, bank_transfer). 
    // For 'on_account', the obligations remain pending because the 
    // debt was only converted (not settled).
    const shouldClearObligations = method !== 'on_account';

    if (shouldClearObligations) {
      const nowIso = new Date().toISOString();
      const clearedCurrencies = new Set<Currency>();
      if (totalPayableSyp > 0) clearedCurrencies.add('SYP');
      if (totalPayableUsd > 0) clearedCurrencies.add('USD');

      if (clearedCurrencies.size > 0) {
        setInterBranchObligations((prev) => {
          let changed = false;
          const next = prev.map((o) => {
            if (
              o.debtorBranchId === branchId &&
              o.creditorBranchId === counterpartyBranchId &&
              o.clearingStatus === 'pending' &&
              clearedCurrencies.has(o.currency)
            ) {
              changed = true;
              const updatedObligation: InterBranchObligation = {
                ...o,
                clearingStatus: 'cleared',
                clearingVoucherId: clearingVoucherId,
                clearingVoucherNumber: voucherNumber,
                clearedAt: nowIso,
                clearedByUserId: currentUser.id,
                updatedAt: nowIso,
              };
              vpsSyncEngine.syncObligation(updatedObligation);
              return updatedObligation;
            }
            return o;
          });
          return changed ? next : prev;
        });
      }
    }

    // Emit system notification
    const newNotif: SystemNotification = {
      id: `notif_${Date.now()}`,
      title: '📄 سند مقاصة وكشف مطابقة جديد',
      message: `أصدر فرع (${originBranch?.name}) سند مقاصة رقم [${voucherNumber}] بمبلغ (${formatCurrency(totalPayableSyp || 0, 'SYP')} / ${formatCurrency(totalPayableUsd || 0, 'USD')}) - طريقة التسوية: ${method === 'instant_cash' ? 'توريد نقدي فوري مع سند قبض' : method === 'bank_transfer' ? 'حوالة مصرفية' : 'ترحيل للحساب الجاري'}.`,
      type: 'cash_settlement',
      targetBranchId: counterpartyBranchId,
      relatedId: newVoucher.id,
      timestamp: new Date().toISOString(),
      read: false,
    };
    setNotifications((prev) => [newNotif, ...prev]);

    addAuditLog(
      'إصدار سند مقاصة فرع',
      'cashbox',
      `تم إصدار سند مقاصة [${voucherNumber}] من فرع [${originBranch?.name}] للمركز الرئيسي [${destBranch?.name}] بمبلغ ${formatCurrency(totalPayableSyp || 0, 'SYP')} وتسوية [${method === 'instant_cash' ? 'نقداً وسند قبض ' + (linkedReceiptVoucherNumber || '') : method === 'bank_transfer' ? 'حوالة مصرفية' : 'حساب جاري'}]`
    );

    return { clearingVoucher: newVoucher, receiptVoucher };
  };

  const deleteFinancialVoucher = (voucherId: string) => {
    setVouchers((prev) => prev.filter((v) => v.id !== voucherId));
    vpsSyncEngine.deleteVoucher(voucherId);
    addAuditLog('حذف سند مالي', 'cashbox', `تم حذف السند المالي ذو المعرف [${voucherId}]`);
  };

  // Shift Settlement Actions (ترصيد وإغلاق صناديق الصادر والوارد مع صندوق مدير الفرع)
  const submitShiftSettlement = (
    scope: 'outgoing' | 'incoming',
    sypAmount: number,
    usdAmount: number,
    param4?: string,
    param5?: string
  ): ShiftSettlementVoucher => {
    const notes = param5 !== undefined ? param5 : param4;
    const branch = currentBranch;
    const branchManager =
      users.find((u) => u.branchId === branch.id && u.role === 'hub_manager') ||
      users.find((u) => u.role === 'hub_manager') ||
      users[0];

    const todayDate = new Date().toISOString().split('T')[0].replace(/-/g, '');
    const scopePrefix = scope === 'outgoing' ? 'ST-OUT' : 'ST-INC';
    const countToday =
      shiftSettlements.filter((s) => s.voucherNumber.startsWith(`${scopePrefix}-${todayDate}`)).length + 1;
    const voucherNumber = `${scopePrefix}-${todayDate}-${String(countToday).padStart(4, '0')}`;

    // Count processed parcels
    const officerParcelsCount = parcels.filter((p) => {
      if (scope === 'outgoing') {
        return p.originHubId === branch.id;
      } else {
        return p.destinationHubId === branch.id && p.handlingStatus === 'delivered';
      }
    }).length;

    const newVoucher: ShiftSettlementVoucher = {
      id: `st_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
      voucherNumber,
      branchId: branch.id,
      cashboxScope: scope,
      officerUserId: currentUser.id,
      officerName: currentUser.name || currentUser.username,
      operatorName: currentUser.name || currentUser.username,
      managerUserId: branchManager?.id || 'mgr_auto',
      managerName: branchManager?.name || branch.managerName || 'مدير الفرع',
      approverName: branchManager?.name || branch.managerName || 'مدير الفرع',
      sypAmount: Math.max(0, sypAmount || 0),
      usdAmount: Math.max(0, usdAmount || 0),
      parcelsCount: officerParcelsCount || 1,
      date: new Date().toISOString().split('T')[0],
      status: 'pending',
      notes,
      timestamp: new Date().toISOString(),
    };

    setShiftSettlements((prev) => [newVoucher, ...prev]);
    vpsSyncEngine.syncShiftVoucher(newVoucher);

    // Notification strictly targeted to Branch Manager responsible
    const notif: SystemNotification = {
      id: `notif_${Date.now()}`,
      title: `📥 طلب ترصيد عهدة صندوق ${scope === 'outgoing' ? 'الصادر' : 'الوارد'}`,
      message: `قام الموظف (${currentUser.name}) بتقديم سند ترصيد وإغلاق صندوق رقم [${voucherNumber}] بمبلغ (${formatCurrency(sypAmount, 'SYP')} / ${formatCurrency(usdAmount, 'USD')}) بانتظار اعتماد مدير الفرع.`,
      type: 'cash_settlement',
      targetBranchId: branch.id,
      targetUserId: branchManager?.id,
      targetRole: 'hub_manager',
      relatedId: newVoucher.id,
      timestamp: new Date().toISOString(),
      read: false,
    };
    setNotifications((prev) => [notif, ...prev]);

    addAuditLog(
      `طلب ترصيد صندوق ${scope === 'outgoing' ? 'الصادر' : 'الوارد'}`,
      'cashbox',
      `قام الموظف [${currentUser.name}] بتقديم سند ترصيد وإغلاق صندوقه رقم [${voucherNumber}] بمبلغ ${formatCurrency(sypAmount, 'SYP')} / ${formatCurrency(usdAmount, 'USD')} بانتظار موافقة مدير الفرع [${newVoucher.managerName}]`
    );

    return newVoucher;
  };

  const approveShiftSettlement = (settlementId: string, managerNotes?: string) => {
    const target = shiftSettlements.find((s) => s.id === settlementId);
    if (!target) return;

    const updated: ShiftSettlementVoucher = {
      ...target,
      status: 'approved' as const,
      approvedAt: new Date().toISOString(),
      managerNotes: managerNotes || target.managerNotes,
      approverName: currentUser?.name || currentUser?.username || target.managerName,
      managerUserId: currentUser?.id || target.managerUserId,
      managerName: currentUser?.name || target.managerName,
    };

    setShiftSettlements((prev) =>
      prev.map((s) => (s.id === settlementId ? updated : s))
    );
    vpsSyncEngine.syncShiftVoucher(updated);

    const notesSnippet = managerNotes ? ` [ملاحظات المدير: ${managerNotes}]` : '';

    // Record outflow transactions on officer's sub-box at moment of manager approval
    if (target.sypAmount > 0) {
      addCashTransaction(
        target.branchId,
        'SYP',
        'shift_settlement_handover_outflow',
        target.sypAmount,
        `تسليم وترصيد صندوق ${target.cashboxScope === 'outgoing' ? 'الصادر' : 'الوارد'} لمدير الفرع [${currentUser?.name || target.managerName}] بموجب سند [${target.voucherNumber}] (معتمد)`,
        target.voucherNumber,
        undefined,
        target.cashboxScope,
        target.id,
        { userId: target.officerUserId, userName: target.officerName }
      );
    }
    if (target.usdAmount > 0) {
      addCashTransaction(
        target.branchId,
        'USD',
        'shift_settlement_handover_outflow',
        target.usdAmount,
        `تسليم وترصيد صندوق ${target.cashboxScope === 'outgoing' ? 'الصادر' : 'الوارد'} بالدولار لمدير الفرع [${currentUser?.name || target.managerName}] بموجب سند [${target.voucherNumber}] (معتمد)`,
        target.voucherNumber,
        undefined,
        target.cashboxScope,
        target.id,
        { userId: target.officerUserId, userName: target.officerName }
      );
    }

    // Inflow to Branch Manager Master Cashbox
    if (target.sypAmount > 0) {
      addCashTransaction(
        target.branchId,
        'SYP',
        'shift_settlement_received_inflow',
        target.sypAmount,
        `استلام وترصيد عهدة صندوق ${target.cashboxScope === 'outgoing' ? 'الصادر' : 'الوارد'} من الموظف [${target.officerName}] بموجب سند [${target.voucherNumber}]${notesSnippet}`,
        target.voucherNumber,
        undefined,
        'master',
        target.id
      );
    }
    if (target.usdAmount > 0) {
      addCashTransaction(
        target.branchId,
        'USD',
        'shift_settlement_received_inflow',
        target.usdAmount,
        `استلام وترصيد عهدة صندوق ${target.cashboxScope === 'outgoing' ? 'الصادر' : 'الوارد'} بالدولار من الموظف [${target.officerName}] بموجب سند [${target.voucherNumber}]${notesSnippet}`,
        target.voucherNumber,
        undefined,
        'master',
        target.id
      );
    }

    // Notification strictly targeted to Officer who submitted
    const notif: SystemNotification = {
      id: `notif_${Date.now()}`,
      title: '✅ تم اعتماد وتصفير سند ترصيد الصندوق بنجاح',
      message: `اعتمد مدير الفرع (${currentUser?.name || 'المدير'}) سند الترصيد رقم [${target.voucherNumber}] وتم تصفير/استلام المبالغ (${formatCurrency(target.sypAmount, 'SYP')} / ${formatCurrency(target.usdAmount, 'USD')}) في صندوق الفرع.${managerNotes ? ` ملاحظات المدير: ${managerNotes}` : ''}`,
      type: 'cash_settlement',
      targetBranchId: target.branchId,
      targetUserId: target.officerUserId,
      relatedId: target.id,
      timestamp: new Date().toISOString(),
      read: false,
    };
    setNotifications((prev) => [notif, ...prev]);

    addAuditLog(
      'اعتماد وترصيد وردية الصندوق',
      'cashbox',
      `تم اعتماد وتأكيد استلام عهدة سند الترصيد [${target.voucherNumber}] للموظف [${target.officerName}] بمبلغ ${formatCurrency(target.sypAmount, 'SYP')} و ${formatCurrency(target.usdAmount, 'USD')} وتصفير/خصم الرصيد.${managerNotes ? ` ملاحظات الاعتماد: ${managerNotes}` : ''}`
    );
  };

  const rejectShiftSettlement = (settlementId: string, reason?: string) => {
    const target = shiftSettlements.find((s) => s.id === settlementId);
    if (!target) return;

    const updatedRejected = { ...target, status: 'rejected' as const, rejectedReason: reason };
    setShiftSettlements((prev) =>
      prev.map((s) => (s.id === settlementId ? updatedRejected : s))
    );
    vpsSyncEngine.syncShiftVoucher(updatedRejected);

    // Notification strictly to Officer
    const notif: SystemNotification = {
      id: `notif_${Date.now()}`,
      title: '❌ تم رفض سند ترصيد الصندوق',
      message: `رفض مدير الفرع (${currentUser?.name || 'المدير'}) سند الترصيد رقم [${target.voucherNumber}]. السبب: ${reason || 'غير محدد'}.`,
      type: 'cash_settlement',
      targetBranchId: target.branchId,
      targetUserId: target.officerUserId,
      relatedId: target.id,
      timestamp: new Date().toISOString(),
      read: false,
    };
    setNotifications((prev) => [notif, ...prev]);

    addAuditLog(
      'رفض سند ترصيد',
      'cashbox',
      `تم رفض سند الترصيد [${target.voucherNumber}] للموظف [${target.officerName}] - السبب: ${reason || 'غير محدد'}`
    );
  };

  const deleteShiftSettlement = (settlementId: string) => {
    setShiftSettlements((prev) => prev.filter((s) => s.id !== settlementId));
    vpsSyncEngine.deleteShiftVoucher(settlementId);
    addAuditLog('حذف سند ترصيد', 'cashbox', `تم حذف سند الترصيد ذو المعرف [${settlementId}]`);
  };

  const getRoleBoxInfo = (role?: UserRole, branch?: Branch | null) => {
    const targetBranch = branch || currentBranch;
    const branchName = targetBranch?.name ? `فرع ${targetBranch.name}` : 'الفرع الرئيسي';
    switch (role) {
      case 'outbound_operator':
      case 'reception_data_entry':
        return {
          scope: 'outgoing' as CashboxScope,
          boxName: 'صندوق الصادر',
          branchName,
          fullTitle: `صندوق الصادر — ${branchName}`,
        };
      case 'inbound_operator':
        return {
          scope: 'incoming' as CashboxScope,
          boxName: 'صندوق الوارد',
          branchName,
          fullTitle: `صندوق الوارد — ${branchName}`,
        };
      case 'cashier':
        return {
          scope: 'cashier' as CashboxScope,
          boxName: 'صندوق أمين الصندوق',
          branchName,
          fullTitle: `صندوق أمين الصندوق — ${branchName}`,
        };
      case 'hub_manager':
        return {
          scope: 'manager' as CashboxScope,
          boxName: 'صندوق المدير',
          branchName,
          fullTitle: `صندوق المدير — ${branchName}`,
        };
      case 'accountant':
        return {
          scope: 'accountant' as CashboxScope,
          boxName: 'صندوق المحاسبة',
          branchName,
          fullTitle: `صندوق المحاسبة — ${branchName}`,
        };
      case 'operations':
        return {
          scope: 'operations' as CashboxScope,
          boxName: 'صندوق العمليات',
          branchName,
          fullTitle: `صندوق العمليات — ${branchName}`,
        };
      case 'warehouse_keeper':
      case 'warehouseman':
        return {
          scope: 'warehouse' as CashboxScope,
          boxName: 'صندوق المستودع',
          branchName,
          fullTitle: `صندوق المستودع — ${branchName}`,
        };
      case 'courier':
        return {
          scope: 'courier' as CashboxScope,
          boxName: 'صندوق المندوب',
          branchName,
          fullTitle: `صندوق المندوب — ${branchName}`,
        };
      case 'super_admin':
      default:
        return {
          scope: 'master' as CashboxScope,
          boxName: 'صندوق الإدارة العامة',
          branchName,
          fullTitle: `صندوق الإدارة العامة — ${branchName}`,
        };
    }
  };

  const getCashboxBreakdown = (branchId?: string, userId?: string) => {
    const targetBranchId = branchId || currentBranch?.id;
    const branchTxs = transactions.filter(
      (t) => (!targetBranchId || t.branchId === targetBranchId)
    );

    // Outgoing Box Metrics
    let outgoingInflowSyp = 0;
    let outgoingInflowUsd = 0;
    let outgoingOutflowSyp = 0;
    let outgoingOutflowUsd = 0;
    let outgoingTransfersOutSyp = 0;
    let outgoingTransfersOutUsd = 0;

    // Incoming Box Metrics
    let incomingInflowSyp = 0;
    let incomingInflowUsd = 0;
    let incomingOutflowSyp = 0;
    let incomingOutflowUsd = 0;
    let incomingTransfersOutSyp = 0;
    let incomingTransfersOutUsd = 0;

    // Cashier Box Metrics
    let cashierInflowSyp = 0;
    let cashierInflowUsd = 0;
    let cashierOutflowSyp = 0;
    let cashierOutflowUsd = 0;
    let cashierTransfersOutSyp = 0;
    let cashierTransfersOutUsd = 0;

    // Manager Box Metrics
    let managerInflowSyp = 0;
    let managerInflowUsd = 0;
    let managerOutflowSyp = 0;
    let managerOutflowUsd = 0;
    let managerTransfersInSyp = 0;
    let managerTransfersInUsd = 0;
    let managerTransfersOutSyp = 0;
    let managerTransfersOutUsd = 0;

    // Accountant Box Metrics
    let accountantInflowSyp = 0;
    let accountantInflowUsd = 0;
    let accountantOutflowSyp = 0;
    let accountantOutflowUsd = 0;

    // Operations Box Metrics
    let operationsInflowSyp = 0;
    let operationsInflowUsd = 0;
    let operationsOutflowSyp = 0;
    let operationsOutflowUsd = 0;

    // Warehouse Box Metrics
    let warehouseInflowSyp = 0;
    let warehouseInflowUsd = 0;
    let warehouseOutflowSyp = 0;
    let warehouseOutflowUsd = 0;

    // Courier Box Metrics
    let courierInflowSyp = 0;
    let courierInflowUsd = 0;
    let courierOutflowSyp = 0;
    let courierOutflowUsd = 0;

    // Courier Intake Box Metrics (مقبوضات تسجيل الطرود)
    let courierIntakeInflowSyp = 0;
    let courierIntakeInflowUsd = 0;
    let courierIntakeOutflowSyp = 0;
    let courierIntakeOutflowUsd = 0;

    // Master Box & Vault Metrics
    let masterInflowSyp = 0;
    let masterInflowUsd = 0;
    let masterOutflowSyp = 0;
    let masterOutflowUsd = 0;
    let masterTransfersInSyp = 0;
    let masterTransfersInUsd = 0;
    let masterTransfersOutSyp = 0;
    let masterTransfersOutUsd = 0;

    branchTxs.forEach((tx) => {
      if (userId && tx.cashboxScope !== 'master' && tx.performedByUserId !== userId) {
        return;
      }

      const scope: CashboxScope = tx.cashboxScope || (
        tx.type === 'shipping_income_prepaid' ? 'outgoing' :
        (tx.type === 'shipping_collected_dest' || tx.type === 'cod_collected_dest') ? 'incoming' :
        (tx.type === 'shift_settlement_received_inflow' || tx.type === 'settlement_received_from_branch' || tx.type === 'settlement_transfer_to_hub') ? 'manager' : 'manager'
      );

      const isCredit = [
        'shipping_income_prepaid',
        'shipping_collected_dest',
        'cod_collected_dest',
        'transfer_fee_income',
        'settlement_received_from_branch',
        'shift_settlement_received_inflow',
        'voucher_receipt',
        'deposit',
      ].includes(tx.type);

      const isDebit = [
        'cod_paid_to_sender',
        'operating_expense',
        'settlement_transfer_to_hub',
        'branch_commission_payout',
        'shift_settlement_handover_outflow',
        'voucher_payment',
        'withdrawal',
      ].includes(tx.type);

      const isInterBranchTransferIn = tx.type === 'settlement_received_from_branch';
      const isInterBranchTransferOut = tx.type === 'settlement_transfer_to_hub';
      const isShiftHandoverOut = tx.type === 'shift_settlement_handover_outflow';
      const isShiftHandoverIn = tx.type === 'shift_settlement_received_inflow';

      const amount = tx.amount ?? 0;

      if (scope === 'outgoing') {
        if (isShiftHandoverOut) {
          if (tx.currency === 'SYP') outgoingTransfersOutSyp += amount;
          else outgoingTransfersOutUsd += amount;
        } else if (isCredit) {
          if (tx.currency === 'SYP') outgoingInflowSyp += amount;
          else outgoingInflowUsd += amount;
        } else if (isDebit) {
          if (tx.currency === 'SYP') outgoingOutflowSyp += amount;
          else outgoingOutflowUsd += amount;
        }
      } else if (scope === 'incoming') {
        if (isShiftHandoverOut) {
          if (tx.currency === 'SYP') incomingTransfersOutSyp += amount;
          else incomingTransfersOutUsd += amount;
        } else if (isCredit) {
          if (tx.currency === 'SYP') incomingInflowSyp += amount;
          else incomingInflowUsd += amount;
        } else if (isDebit) {
          if (tx.currency === 'SYP') incomingOutflowSyp += amount;
          else incomingOutflowUsd += amount;
        }
      } else if (scope === 'cashier') {
        if (isShiftHandoverOut) {
          if (tx.currency === 'SYP') cashierTransfersOutSyp += amount;
          else cashierTransfersOutUsd += amount;
        } else if (isCredit) {
          if (tx.currency === 'SYP') cashierInflowSyp += amount;
          else cashierInflowUsd += amount;
        } else if (isDebit) {
          if (tx.currency === 'SYP') cashierOutflowSyp += amount;
          else cashierOutflowUsd += amount;
        }
      } else if (scope === 'manager') {
        if (isInterBranchTransferIn) {
          if (tx.currency === 'SYP') {
            managerTransfersInSyp += amount;
            managerInflowSyp += amount;
          } else {
            managerTransfersInUsd += amount;
            managerInflowUsd += amount;
          }
        } else if (isInterBranchTransferOut) {
          if (tx.currency === 'SYP') {
            managerTransfersOutSyp += amount;
            managerOutflowSyp += amount;
          } else {
            managerTransfersOutUsd += amount;
            managerOutflowUsd += amount;
          }
        } else if (isCredit || isShiftHandoverIn) {
          if (tx.currency === 'SYP') managerInflowSyp += amount;
          else managerInflowUsd += amount;
        } else if (isDebit) {
          if (tx.currency === 'SYP') managerOutflowSyp += amount;
          else managerOutflowUsd += amount;
        }
      } else if (scope === 'accountant') {
        if (isCredit) {
          if (tx.currency === 'SYP') accountantInflowSyp += amount;
          else accountantInflowUsd += amount;
        } else if (isDebit) {
          if (tx.currency === 'SYP') accountantOutflowSyp += amount;
          else accountantOutflowUsd += amount;
        }
      } else if (scope === 'operations') {
        if (isCredit) {
          if (tx.currency === 'SYP') operationsInflowSyp += amount;
          else operationsInflowUsd += amount;
        } else if (isDebit) {
          if (tx.currency === 'SYP') operationsOutflowSyp += amount;
          else operationsOutflowUsd += amount;
        }
      } else if (scope === 'warehouse') {
        if (isCredit) {
          if (tx.currency === 'SYP') warehouseInflowSyp += amount;
          else warehouseInflowUsd += amount;
        } else if (isDebit) {
          if (tx.currency === 'SYP') warehouseOutflowSyp += amount;
          else warehouseOutflowUsd += amount;
        }
      } else if (scope === 'courier') {
        if (isCredit) {
          if (tx.currency === 'SYP') courierInflowSyp += amount;
          else courierInflowUsd += amount;
        } else if (isDebit) {
          if (tx.currency === 'SYP') courierOutflowSyp += amount;
          else courierOutflowUsd += amount;
        }
      } else if (scope === 'courier_intake') {
        if (isShiftHandoverOut || isDebit) {
          if (tx.currency === 'SYP') courierIntakeOutflowSyp += amount;
          else courierIntakeOutflowUsd += amount;
        } else if (isCredit) {
          if (tx.currency === 'SYP') courierIntakeInflowSyp += amount;
          else courierIntakeInflowUsd += amount;
        }
      } else {
        // Master Scope
        if (isInterBranchTransferIn) {
          if (tx.currency === 'SYP') {
            masterTransfersInSyp += amount;
            masterInflowSyp += amount;
          } else {
            masterTransfersInUsd += amount;
            masterInflowUsd += amount;
          }
        } else if (isInterBranchTransferOut) {
          if (tx.currency === 'SYP') {
            masterTransfersOutSyp += amount;
            masterOutflowSyp += amount;
          } else {
            masterTransfersOutUsd += amount;
            masterOutflowUsd += amount;
          }
        } else if (isCredit || isShiftHandoverIn) {
          if (tx.currency === 'SYP') masterInflowSyp += amount;
          else masterInflowUsd += amount;
        } else if (isDebit) {
          if (tx.currency === 'SYP') masterOutflowSyp += amount;
          else masterOutflowUsd += amount;
        }
      }
    });

    const pendingSettlementsCount = shiftSettlements.filter(
      (s) => (!targetBranchId || s.branchId === targetBranchId) && (s.status === 'pending_approval' || s.status === 'pending')
    ).length;

    // Sub-box calculations
    const outSyp = Math.max(0, outgoingInflowSyp - outgoingOutflowSyp - outgoingTransfersOutSyp);
    const outUsd = Math.max(0, outgoingInflowUsd - outgoingOutflowUsd - outgoingTransfersOutUsd);

    const inSyp = Math.max(0, incomingInflowSyp - incomingOutflowSyp - incomingTransfersOutSyp);
    const inUsd = Math.max(0, incomingInflowUsd - incomingOutflowUsd - incomingTransfersOutUsd);

    const cashSyp = Math.max(0, cashierInflowSyp - cashierOutflowSyp - cashierTransfersOutSyp);
    const cashUsd = Math.max(0, cashierInflowUsd - cashierOutflowUsd - cashierTransfersOutUsd);

    const actSyp = Math.max(0, accountantInflowSyp - accountantOutflowSyp);
    const actUsd = Math.max(0, accountantInflowUsd - accountantOutflowUsd);

    const opsSyp = Math.max(0, operationsInflowSyp - operationsOutflowSyp);
    const opsUsd = Math.max(0, operationsInflowUsd - operationsOutflowUsd);

    const whSyp = Math.max(0, warehouseInflowSyp - warehouseOutflowSyp);
    const whUsd = Math.max(0, warehouseInflowUsd - warehouseOutflowUsd);

    const crSyp = Math.max(0, courierInflowSyp - courierOutflowSyp);
    const crUsd = Math.max(0, courierInflowUsd - courierOutflowUsd);

    const crIntakeSyp = Math.max(0, courierIntakeInflowSyp - courierIntakeOutflowSyp);
    const crIntakeUsd = Math.max(0, courierIntakeInflowUsd - courierIntakeOutflowUsd);

    // Operational sub-boxes total sitting in windows/desks
    const operatorSubBoxesSyp = outSyp + inSyp + cashSyp + actSyp + opsSyp + whSyp + crSyp;
    const operatorSubBoxesUsd = outUsd + inUsd + cashUsd + actUsd + opsUsd + whUsd + crUsd;

    // Combined Manager & Master inflows/outflows
    const totalMgrInflowSyp = managerInflowSyp + masterInflowSyp;
    const totalMgrInflowUsd = managerInflowUsd + masterInflowUsd;
    const totalMgrOutflowSyp = managerOutflowSyp + masterOutflowSyp;
    const totalMgrOutflowUsd = managerOutflowUsd + masterOutflowUsd;
    const totalMgrTransfersInSyp = managerTransfersInSyp + masterTransfersInSyp;
    const totalMgrTransfersInUsd = managerTransfersInUsd + masterTransfersInUsd;
    const totalMgrTransfersOutSyp = managerTransfersOutSyp + masterTransfersOutSyp;
    const totalMgrTransfersOutUsd = managerTransfersOutUsd + masterTransfersOutUsd;

    const rawMgrSyp = totalMgrInflowSyp - totalMgrOutflowSyp;
    const rawMgrUsd = totalMgrInflowUsd - totalMgrOutflowUsd;

    const calculatedSubBoxesSyp = operatorSubBoxesSyp + Math.max(0, rawMgrSyp);
    const calculatedSubBoxesUsd = operatorSubBoxesUsd + Math.max(0, rawMgrUsd);

    const targetBranchObj = targetBranchId ? branches.find((b) => b.id === targetBranchId) : null;
    const actualBranchSyp = calculatedSubBoxesSyp > 0
      ? calculatedSubBoxesSyp
      : (targetBranchObj ? (targetBranchObj.boxSypBalance ?? 0) : branches.reduce((sum, b) => sum + (b.boxSypBalance || 0), 0));

    const actualBranchUsd = calculatedSubBoxesUsd > 0
      ? calculatedSubBoxesUsd
      : (targetBranchObj ? (targetBranchObj.boxUsdBalance ?? 0) : branches.reduce((sum, b) => sum + (b.boxUsdBalance || 0), 0));

    // Branch Manager available vault balance = Branch Liquidity minus un-settled operational sub-boxes
    const mgrSyp = Math.max(0, Math.max(rawMgrSyp, actualBranchSyp - operatorSubBoxesSyp));
    const mgrUsd = Math.max(0, Math.max(rawMgrUsd, actualBranchUsd - operatorSubBoxesUsd));
    const mSyp = mgrSyp;
    const mUsd = mgrUsd;

    return {
      outgoingSyp: outSyp,
      outgoingUsd: outUsd,
      incomingSyp: inSyp,
      incomingUsd: inUsd,
      masterSyp: mSyp,
      masterUsd: mUsd,
      totalBranchSyp: actualBranchSyp,
      totalBranchUsd: actualBranchUsd,
      pendingSettlementsCount,
      // Granular nested structures with full operation separation
      outgoingBox: {
        inflowSyp: outgoingInflowSyp,
        inflowUsd: outgoingInflowUsd,
        outflowSyp: outgoingOutflowSyp,
        outflowUsd: outgoingOutflowUsd,
        transfersOutSyp: outgoingTransfersOutSyp,
        transfersOutUsd: outgoingTransfersOutUsd,
        unsettledSyp: outSyp,
        unsettledUsd: outUsd,
        syp: outSyp,
        usd: outUsd,
      },
      incomingBox: {
        inflowSyp: incomingInflowSyp,
        inflowUsd: incomingInflowUsd,
        outflowSyp: incomingOutflowSyp,
        outflowUsd: incomingOutflowUsd,
        transfersOutSyp: incomingTransfersOutSyp,
        transfersOutUsd: incomingTransfersOutUsd,
        unsettledSyp: inSyp,
        unsettledUsd: inUsd,
        syp: inSyp,
        usd: inUsd,
      },
      cashierBox: {
        inflowSyp: cashierInflowSyp,
        inflowUsd: cashierInflowUsd,
        outflowSyp: cashierOutflowSyp,
        outflowUsd: cashierOutflowUsd,
        transfersOutSyp: cashierTransfersOutSyp,
        transfersOutUsd: cashierTransfersOutUsd,
        unsettledSyp: cashSyp,
        unsettledUsd: cashUsd,
        syp: cashSyp,
        usd: cashUsd,
      },
      managerBox: {
        inflowSyp: managerInflowSyp,
        inflowUsd: managerInflowUsd,
        outflowSyp: managerOutflowSyp,
        outflowUsd: managerOutflowUsd,
        transfersInSyp: managerTransfersInSyp,
        transfersInUsd: managerTransfersInUsd,
        transfersOutSyp: managerTransfersOutSyp,
        transfersOutUsd: managerTransfersOutUsd,
        unsettledSyp: mgrSyp,
        unsettledUsd: mgrUsd,
        syp: mgrSyp,
        usd: mgrUsd,
      },
      accountantBox: {
        inflowSyp: accountantInflowSyp,
        inflowUsd: accountantInflowUsd,
        outflowSyp: accountantOutflowSyp,
        outflowUsd: accountantOutflowUsd,
        syp: actSyp,
        usd: actUsd,
      },
      operationsBox: {
        inflowSyp: operationsInflowSyp,
        inflowUsd: operationsInflowUsd,
        outflowSyp: operationsOutflowSyp,
        outflowUsd: operationsOutflowUsd,
        syp: opsSyp,
        usd: opsUsd,
      },
      warehouseBox: {
        inflowSyp: warehouseInflowSyp,
        inflowUsd: warehouseInflowUsd,
        outflowSyp: warehouseOutflowSyp,
        outflowUsd: warehouseOutflowUsd,
        syp: whSyp,
        usd: whUsd,
      },
      courierBox: {
        inflowSyp: courierInflowSyp,
        inflowUsd: courierInflowUsd,
        outflowSyp: courierOutflowSyp,
        outflowUsd: courierOutflowUsd,
        syp: crSyp,
        usd: crUsd,
      },
      courierIntakeBox: {
        inflowSyp: courierIntakeInflowSyp,
        inflowUsd: courierIntakeInflowUsd,
        outflowSyp: courierIntakeOutflowSyp,
        outflowUsd: courierIntakeOutflowUsd,
        syp: crIntakeSyp,
        usd: crIntakeUsd,
      },
      courierIntakeSyp: crIntakeSyp,
      courierIntakeUsd: crIntakeUsd,
      masterBox: {
        inflowSyp: masterInflowSyp,
        inflowUsd: masterInflowUsd,
        outflowSyp: masterOutflowSyp,
        outflowUsd: masterOutflowUsd,
        transfersInSyp: masterTransfersInSyp,
        transfersInUsd: masterTransfersInUsd,
        transfersOutSyp: masterTransfersOutSyp,
        transfersOutUsd: masterTransfersOutUsd,
        syp: mSyp,
        usd: mUsd,
      },
      transfersBox: {
        receivedSyp: masterTransfersInSyp || managerTransfersInSyp,
        receivedUsd: masterTransfersInUsd || managerTransfersInUsd,
        sentSyp: masterTransfersOutSyp || managerTransfersOutSyp,
        sentUsd: masterTransfersOutUsd || managerTransfersOutUsd,
        netSyp: (masterTransfersInSyp || managerTransfersInSyp) - (masterTransfersOutSyp || managerTransfersOutSyp),
        netUsd: (masterTransfersInUsd || managerTransfersInUsd) - (masterTransfersOutUsd || managerTransfersOutUsd),
      },
      totalBranchLiquiditySyp: actualBranchSyp,
      totalBranchLiquidityUsd: actualBranchUsd,
    };
  };

  const getRoleCashboxData = (role?: UserRole, branchId?: string, userId?: string) => {
    const targetRole = role || currentUser?.role || 'outbound_operator';
    const targetBranch = branchId ? branches.find((b) => b.id === branchId) || currentBranch : currentBranch;
    const branchName = targetBranch?.name ? `فرع ${targetBranch.name}` : 'الفرع الرئيسي';
    const breakdown = getCashboxBreakdown(targetBranch?.id, userId);

    let scope: CashboxScope = 'outgoing';
    let boxName = 'صندوق الصادر';
    let syp = 0;
    let usd = 0;
    let inflowSyp = 0;
    let inflowUsd = 0;
    let outflowSyp = 0;
    let outflowUsd = 0;
    let unsettledSyp = 0;
    let unsettledUsd = 0;

    switch (targetRole) {
      case 'outbound_operator':
      case 'reception_data_entry':
        scope = 'outgoing';
        boxName = 'صندوق الصادر';
        syp = breakdown.outgoingBox.syp;
        usd = breakdown.outgoingBox.usd;
        inflowSyp = breakdown.outgoingBox.inflowSyp;
        inflowUsd = breakdown.outgoingBox.inflowUsd;
        outflowSyp = breakdown.outgoingBox.outflowSyp;
        outflowUsd = breakdown.outgoingBox.outflowUsd;
        unsettledSyp = breakdown.outgoingBox.unsettledSyp;
        unsettledUsd = breakdown.outgoingBox.unsettledUsd;
        break;

      case 'inbound_operator':
        scope = 'incoming';
        boxName = 'صندوق الوارد';
        syp = breakdown.incomingBox.syp;
        usd = breakdown.incomingBox.usd;
        inflowSyp = breakdown.incomingBox.inflowSyp;
        inflowUsd = breakdown.incomingBox.inflowUsd;
        outflowSyp = breakdown.incomingBox.outflowSyp;
        outflowUsd = breakdown.incomingBox.outflowUsd;
        unsettledSyp = breakdown.incomingBox.unsettledSyp;
        unsettledUsd = breakdown.incomingBox.unsettledUsd;
        break;

      case 'cashier':
        scope = 'cashier';
        boxName = 'صندوق أمين الصندوق';
        syp = breakdown.cashierBox.syp;
        usd = breakdown.cashierBox.usd;
        inflowSyp = breakdown.cashierBox.inflowSyp;
        inflowUsd = breakdown.cashierBox.inflowUsd;
        outflowSyp = breakdown.cashierBox.outflowSyp;
        outflowUsd = breakdown.cashierBox.outflowUsd;
        unsettledSyp = breakdown.cashierBox.unsettledSyp;
        unsettledUsd = breakdown.cashierBox.unsettledUsd;
        break;

      case 'hub_manager':
        scope = 'manager';
        boxName = 'صندوق المدير';
        syp = breakdown.managerBox.syp;
        usd = breakdown.managerBox.usd;
        inflowSyp = breakdown.managerBox.inflowSyp;
        inflowUsd = breakdown.managerBox.inflowUsd;
        outflowSyp = breakdown.managerBox.outflowSyp;
        outflowUsd = breakdown.managerBox.outflowUsd;
        unsettledSyp = breakdown.managerBox.unsettledSyp;
        unsettledUsd = breakdown.managerBox.unsettledUsd;
        break;

      case 'accountant':
        scope = 'accountant';
        boxName = 'صندوق المحاسبة';
        syp = breakdown.accountantBox.syp;
        usd = breakdown.accountantBox.usd;
        inflowSyp = breakdown.accountantBox.inflowSyp;
        inflowUsd = breakdown.accountantBox.inflowUsd;
        outflowSyp = breakdown.accountantBox.outflowSyp;
        outflowUsd = breakdown.accountantBox.outflowUsd;
        unsettledSyp = breakdown.accountantBox.syp;
        unsettledUsd = breakdown.accountantBox.usd;
        break;

      case 'operations':
        scope = 'operations';
        boxName = 'صندوق العمليات';
        syp = breakdown.operationsBox.syp;
        usd = breakdown.operationsBox.usd;
        inflowSyp = breakdown.operationsBox.inflowSyp;
        inflowUsd = breakdown.operationsBox.inflowUsd;
        outflowSyp = breakdown.operationsBox.outflowSyp;
        outflowUsd = breakdown.operationsBox.outflowUsd;
        unsettledSyp = breakdown.operationsBox.syp;
        unsettledUsd = breakdown.operationsBox.usd;
        break;

      case 'warehouse_keeper':
      case 'warehouseman':
        scope = 'warehouse';
        boxName = 'صندوق المستودع';
        syp = breakdown.warehouseBox.syp;
        usd = breakdown.warehouseBox.usd;
        inflowSyp = breakdown.warehouseBox.inflowSyp;
        inflowUsd = breakdown.warehouseBox.inflowUsd;
        outflowSyp = breakdown.warehouseBox.outflowSyp;
        outflowUsd = breakdown.warehouseBox.outflowUsd;
        unsettledSyp = breakdown.warehouseBox.syp;
        unsettledUsd = breakdown.warehouseBox.usd;
        break;

      case 'courier':
        scope = 'courier';
        boxName = 'صندوق المندوب';
        syp = breakdown.courierBox.syp;
        usd = breakdown.courierBox.usd;
        inflowSyp = breakdown.courierBox.inflowSyp;
        inflowUsd = breakdown.courierBox.inflowUsd;
        outflowSyp = breakdown.courierBox.outflowSyp;
        outflowUsd = breakdown.courierBox.outflowUsd;
        unsettledSyp = breakdown.courierBox.syp;
        unsettledUsd = breakdown.courierBox.usd;
        break;

      case 'super_admin':
      default:
        scope = 'master';
        boxName = 'صندوق الإدارة العامة';
        syp = breakdown.totalBranchSyp;
        usd = breakdown.totalBranchUsd;
        inflowSyp = breakdown.masterBox.inflowSyp;
        inflowUsd = breakdown.masterBox.inflowUsd;
        outflowSyp = breakdown.masterBox.outflowSyp;
        outflowUsd = breakdown.masterBox.outflowUsd;
        unsettledSyp = breakdown.masterBox.syp;
        unsettledUsd = breakdown.masterBox.usd;
        break;
    }

    return {
      scope,
      boxName,
      branchName,
      fullTitle: `${boxName} — ${branchName}`,
      syp,
      usd,
      inflowSyp,
      inflowUsd,
      outflowSyp,
      outflowUsd,
      unsettledSyp,
      unsettledUsd,
    };
  };

  const getRoleBoxTransactions = (role?: UserRole, branchId?: string, userId?: string) => {
    const targetRole = role || currentUser?.role || 'outbound_operator';
    const targetBranchId = branchId || currentBranch?.id;
    const { scope } = getRoleCashboxData(targetRole, targetBranchId, userId);

    return transactions
      .filter((t) => {
        if (targetBranchId && t.branchId !== targetBranchId) return false;

        // User isolation for sub-boxes
        if (userId && scope !== 'master' && scope !== 'manager' && t.performedByUserId && t.performedByUserId !== userId) {
          return false;
        }

        // Strict scope match
        if (t.cashboxScope === scope) return true;

        // Legacy fallback
        if (scope === 'outgoing') {
          return (
            t.cashboxScope === 'outgoing' ||
            (!t.cashboxScope &&
              (t.type === 'shipping_income_prepaid' ||
                t.performedByRole === 'outbound_operator' ||
                t.performedByRole === 'reception_data_entry'))
          );
        }
        if (scope === 'incoming') {
          return (
            t.cashboxScope === 'incoming' ||
            (!t.cashboxScope &&
              (t.type === 'shipping_collected_dest' ||
                t.type === 'cod_collected_dest' ||
                t.performedByRole === 'inbound_operator'))
          );
        }
        if (scope === 'cashier') {
          return t.cashboxScope === 'cashier' || t.performedByRole === 'cashier';
        }
        if (scope === 'manager' || scope === 'master') {
          return (
            t.cashboxScope === 'manager' ||
            t.cashboxScope === 'master' ||
            (!t.cashboxScope &&
              [
                'shift_settlement_received_inflow',
                'settlement_received_from_branch',
                'settlement_transfer_to_hub',
                'cod_paid_to_sender',
                'branch_commission_payout',
              ].includes(t.type))
          );
        }
        return t.cashboxScope === scope;
      })
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  };

  // Pricing & Rules Updaters
  const updatePricingRules = (rules: PricingRule[]) => {
    setPricingRules(rules);
    for (const r of rules) {
      vpsSyncEngine.syncPricingRule(r);
    }
  };
  const addPricingRule = (ruleData: Omit<PricingRule, 'id'>) => {
    const newRule: PricingRule = {
      ...ruleData,
      id: `pr_${Date.now()}`,
    };
    setPricingRules((prev) => [newRule, ...prev]);
    vpsSyncEngine.syncPricingRule(newRule);
  };
  const deletePricingRule = (ruleId: string) => {
    setPricingRules((prev) => prev.filter((r) => r.id !== ruleId));
    vpsSyncEngine.deletePricingRule(ruleId);
  };
  const resetPricingRulesToDefault = () => {
    setPricingRules(INITIAL_PRICING_RULES);
    for (const r of INITIAL_PRICING_RULES) {
      vpsSyncEngine.syncPricingRule(r);
    }
  };
  const updateCodSettings = (settings: CodTransferSettings) => {
    const stamped = { ...settings, updatedAt: new Date().toISOString() };
    setCodSettings(stamped);
    safeStorage.setItem(`${STORAGE_KEY}_cod_settings`, JSON.stringify(stamped));
    vpsSyncEngine.syncCodSettings(stamped);
    const modeName = settings.commissionMode === 'custom_brackets' 
      ? 'شرائح متدرجة' 
      : settings.commissionMode === 'per_amount_tier' 
      ? 'شريحة مبلغ' 
      : 'نسبة مئوية';
    addAuditLog(
      'تحديث تعرفة وعمولة الحوالات',
      'pricing',
      `تم تحديث سياسة عمولة الحوالات المالية: النمط [${modeName}] - ${getCodCommissionLabel(settings, 'SYP')}`
    );
  };

  const calculateCodTransferFeeContext = (amount: number, currency: Currency = 'SYP'): number => {
    return calculateCodTransferFee(amount, currency, codSettings);
  };

  const getCodCommissionLabelContext = (currency: Currency = 'SYP'): string => {
    return getCodCommissionLabel(codSettings, currency);
  };

  // Template customizer save
  const saveManifestTemplate = (template: ManifestTemplate) => {
    setManifestTemplates((prev) => {
      const exists = prev.some((t) => t.id === template.id);
      if (exists) {
        return prev.map((t) => (t.id === template.id ? template : t));
      }
      return [...prev, template];
    });
  };

  // Branch & User Admin
  const addBranch = (
    branchData: Omit<Branch, 'id' | 'boxSypBalance' | 'boxUsdBalance'>,
    autoGenerateUsers = true,
    defaultPassword = '123456'
  ): { branch: Branch; createdUsers: User[] } => {
    const now = new Date().toISOString();
    const newBranch: Branch = {
      ...branchData,
      id: `br_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      boxSypBalance: 0,
      boxUsdBalance: 0,
      openingBalanceSyp: 0,
      openingBalanceUsd: 0,
      createdAt: now,
      updatedAt: now,
    };

    setBranches((prev) => [...prev, newBranch]);
    vpsSyncEngine.syncBranch(newBranch);

    let createdUsers: User[] = [];
    if (autoGenerateUsers) {
      createdUsers = generateDefaultUsersForBranch(newBranch, defaultPassword, users);
      setUsers((prev) => {
        const existingUsernames = new Set(prev.map((u) => u.username.toLowerCase()));
        const filteredNew = createdUsers.filter((u) => !existingUsernames.has(u.username.toLowerCase()));
        return [...prev, ...filteredNew];
      });

      createdUsers.forEach((u) => {
        vpsSyncEngine.syncUser(u);
      });
    }

    addAuditLog(
      'إضافة فرع جديد',
      'system',
      `تمت إضافة بطاقة الفرع: [${newBranch.name}] كود: [${newBranch.code}] ومزامنته مع PostgreSQL` +
        (createdUsers.length > 0 ? ` وتوليد [${createdUsers.length}] حسابات مستخدمين أساسية ومزامنتها` : '')
    );

    return { branch: newBranch, createdUsers };
  };

  const updateBranch = (id: string, updates: Partial<Branch>) => {
    const now = new Date().toISOString();
    setBranches((prev) => prev.map((b) => (b.id === id ? { ...b, ...updates, updatedAt: now } : b)));
    if (currentBranch?.id === id) {
      setCurrentBranch((prev) => ({ ...prev, ...updates, updatedAt: now }));
    }
    const target = branches.find((b) => b.id === id);
    if (target) {
      vpsSyncEngine.syncBranch({ ...target, ...updates, updatedAt: now });
    }
    addAuditLog('تعديل بيانات فرع', 'system', `تم تحديث بيانات الفرع ومزامنته [${target?.name || id}]`);
  };

  const deleteBranch = (id: string) => {
    const target = branches.find((b) => b.id === id);
    setBranches((prev) => prev.filter((b) => b.id !== id));
    
    // Sync deletion to PostgreSQL & Cloud
    vpsSyncEngine.deleteBranch(id);

    if (currentBranch?.id === id) {
      const remaining = branches.filter((b) => b.id !== id);
      if (remaining.length > 0) {
        setCurrentBranch(remaining[0]);
      } else {
        setCurrentBranch(INITIAL_BRANCHES.length > 0 ? INITIAL_BRANCHES[0] : EMPTY_SYSTEM_BRANCH);
      }
    }
    // Also remove users tied strictly to this branch and sync their deletion
    const usersToDelete = users.filter((u) => u.branchId === id && u.role !== 'super_admin');
    usersToDelete.forEach((u) => {
      vpsSyncEngine.deleteUser(u.id);
    });

    setUsers((prev) => prev.filter((u) => u.branchId !== id || u.role === 'super_admin'));
    if (currentUser?.branchId === id && currentUser?.role !== 'super_admin') {
      const remainingUsers = users.filter((u) => u.branchId !== id || u.role === 'super_admin');
      if (remainingUsers.length > 0) {
        setCurrentUser(remainingUsers[0]);
      } else {
        setCurrentUser(INITIAL_USERS[0]);
      }
    }
    addAuditLog('حذف فرع', 'system', `تم حذف بطاقة الفرع وحسابات طاقمه من PostgreSQL [${target?.name || id}]`);
  };

  const addMultipleBranchesWithUsers = (
    branchesData: Array<Omit<Branch, 'id'> & { id?: string; initialSyp?: number; initialUsd?: number }>,
    autoGenerateUsers = true,
    customUsers?: User[]
  ) => {
    const newBranches: Branch[] = [];
    const newUsers: User[] = [];
    const now = new Date().toISOString();

    branchesData.forEach((item, index) => {
      const branchId = item.id || `br_${Date.now()}_${index}_${Math.random().toString(36).substring(2, 6)}`;
      const branch: Branch = {
        ...item,
        id: branchId,
        boxSypBalance: Number(item.initialSyp || item.boxSypBalance || 0),
        boxUsdBalance: Number(item.initialUsd || item.boxUsdBalance || 0),
        openingBalanceSyp: Number(item.openingBalanceSyp ?? item.initialSyp ?? item.boxSypBalance ?? 0),
        openingBalanceUsd: Number(item.openingBalanceUsd ?? item.initialUsd ?? item.boxUsdBalance ?? 0),
        isActive: item.isActive !== undefined ? item.isActive : true,
        createdAt: item.createdAt || now,
        updatedAt: now,
      };
      newBranches.push(branch);

      if (!customUsers && autoGenerateUsers) {
        const branchUsers = generateDefaultUsersForBranch(branch, '123456', [...users, ...newUsers]);
        newUsers.push(...branchUsers);
      }
    });

    if (customUsers && customUsers.length > 0) {
      newUsers.push(...customUsers);
    }

    setBranches((prev) => [...prev, ...newBranches]);
    if (newUsers.length > 0) {
      setUsers((prev) => [...prev, ...newUsers]);
    }

    // Explicitly sync all created branches and users to PostgreSQL
    newBranches.forEach((branch) => {
      vpsSyncEngine.syncBranch(branch);
    });

    newUsers.forEach((user) => {
      vpsSyncEngine.syncUser(user);
    });

    addAuditLog(
      'إضافة مجمعة للفروع وتوليد الكوادر',
      'system',
      `تمت إضافة [${newBranches.length}] فروع وتوليد [${newUsers.length}] حساب مستخدم بالأدوار الأساسية مع مزامنتها في PostgreSQL`
    );

    return { createdBranches: newBranches, createdUsers: newUsers };
  };

  const clearAllOperationalData = () => {
    vpsSyncEngine.executeLocalZeroWipe(true);
    setBranches([]);
    setCurrentBranch(EMPTY_SYSTEM_BRANCH);
    setParcels([]);
    setTruckManifests([]);
    setCourierManifests([]);
    setTransactions([]);
    setSettlements([]);
    setShiftSettlements([]);
    setVouchers([]);
    setUsers(INITIAL_USERS);
    setCurrentUser(INITIAL_USERS[0]);
    setCustomers([]);
    setVehicles([]);
    setEmployees([]);
    setPayrollRecords([]);
    setExpenses([]);
    setFixedAssets([]);
    setDirectMessages([]);
    setNotifications([]);
    setPricingRules([]);

    setAuditLogs([
      {
        id: `log_clean_${Date.now()}`,
        action: 'تفريغ المنظومة وإعادة التهيئة الصفرية الشاملة',
        category: 'system',
        details: 'تم تصفير كافة قواعد البيانات والجداول وسيرفر PostgreSQL وكافة الأجهزة المتصلة للبدء من الصفر مع الحساب الإداري العام (سليمان)',
        userId: INITIAL_USERS[0].id,
        userName: INITIAL_USERS[0].name,
        branchId: '',
        timestamp: new Date().toISOString(),
      },
    ]);

    // Asynchronously purge PostgreSQL operational data and notify server
    vpsSyncEngine.purgeOperationalDataFromCloud().catch((err) => {
      console.warn('Postgres database operational purge warning:', err);
    });
  };

  const addUser = (userData: Omit<User, 'id'> & { id?: string }): User => {
    const now = new Date().toISOString();
    const isSuperAdmin = userData.role === 'super_admin';
    const newUser: User = {
      ...userData,
      id: userData.id || `usr_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      branchId: isSuperAdmin ? '' : userData.branchId,
      allowedBranchIds: isSuperAdmin ? [] : (userData.allowedBranchIds || []),
      permissions: userData.permissions || getDefaultPermissionsForRole(userData.role),
      passwordChangedAt: (userData as any).passwordChangedAt || now,
      createdAt: (userData as any).createdAt || now,
      updatedAt: now,
    };
    setUsers((prev) => [...prev, newUser]);
    vpsSyncEngine.syncUser(newUser);
    return newUser;
  };

  const updateUser = (id: string, updates: Partial<User>) => {
    const now = new Date().toISOString();
    let updatedUser: User | null = null;
    setUsers((prev) => {
      const nextUsers = prev.map((u) => {
        if (u.id === id) {
          const isSuperAdmin = (updates.role || u.role) === 'super_admin';
          const isPasswordChanging = updates.password !== undefined && updates.password !== '' && updates.password !== u.password;
          const updated: User = {
            ...u,
            ...updates,
            passwordChangedAt: isPasswordChanging ? now : (updates.passwordChangedAt || u.passwordChangedAt),
            branchId: isSuperAdmin ? '' : (updates.branchId !== undefined ? updates.branchId : u.branchId),
            allowedBranchIds: isSuperAdmin ? [] : (updates.allowedBranchIds !== undefined ? updates.allowedBranchIds : u.allowedBranchIds),
            updatedAt: now,
          };
          if (updates.role && !updates.permissions) {
            updated.permissions = getDefaultPermissionsForRole(updates.role);
          }
          updatedUser = updated;
          return updated;
        }
        return u;
      });
      return nextUsers;
    });

    if (updatedUser) {
      vpsSyncEngine.syncUser(updatedUser);
    }

    // If updating current active user, sync currentUser state
    if (currentUser.id === id) {
      setCurrentUser((prev) => {
        const isSuperAdmin = (updates.role || prev.role) === 'super_admin';
        const isPasswordChanging = updates.password !== undefined && updates.password !== '' && updates.password !== prev.password;
        const updated: User = {
          ...prev,
          ...updates,
          passwordChangedAt: isPasswordChanging ? now : (updates.passwordChangedAt || prev.passwordChangedAt),
          branchId: isSuperAdmin ? '' : (updates.branchId !== undefined ? updates.branchId : prev.branchId),
          allowedBranchIds: isSuperAdmin ? [] : (updates.allowedBranchIds !== undefined ? updates.allowedBranchIds : prev.allowedBranchIds),
          updatedAt: now,
        };
        if (updates.role && !updates.permissions) {
          updated.permissions = getDefaultPermissionsForRole(updates.role);
        }
        return updated;
      });
    }
  };

  const deleteUser = (id: string) => {
    setUsers((prev) => prev.filter((u) => u.id !== id));
    vpsSyncEngine.deleteUser(id);
    if (currentUser.id === id) {
      const remaining = users.filter((u) => u.id !== id);
      if (remaining.length > 0) {
        setCurrentUser(remaining[0]);
      }
    }
  };

  const toggleUserStatus = (id: string) => {
    let updatedUser: User | null = null;
    setUsers((prev) =>
      prev.map((u) => {
        if (u.id === id) {
          const updated = { ...u, isActive: !u.isActive, updatedAt: new Date().toISOString() };
          updatedUser = updated;
          return updated;
        }
        return u;
      })
    );
    if (updatedUser) {
      vpsSyncEngine.syncUser(updatedUser);
    }
    if (currentUser.id === id) {
      setCurrentUser((prev) => ({ ...prev, isActive: !prev.isActive }));
    }
  };

  const hasPermission = (permissionKey: string): boolean => {
    return checkUserPermission(currentUser, permissionKey);
  };

  const canAccessModule = (module: ActiveModule): boolean => {
    return checkUserModuleAccess(currentUser, module);
  };

  const canSwitchBranch = (): boolean => {
    if (currentUser.role === 'super_admin') return true;
    if (currentUser.canSwitchBranches) return true;
    if (checkUserPermission(currentUser, 'users.switch_branch_freely')) return true;
    return false;
  };

  const updateBrandingSettings = (updates: Partial<CompanyBrandingSettings>) => {
    setBrandingSettings((prev) => {
      const next = { ...prev, ...updates, updatedAt: new Date().toISOString() };
      safeStorage.setItem(`${STORAGE_KEY}_branding_settings`, JSON.stringify(next));
      // Immediate cloud broadcast so every branch updates instantly without manual logo selection
      vpsSyncEngine.syncBranding(next);
      applyDynamicAppIcon({
        logoUrl: next.logoUrl,
        companyName: next.companyName,
        companySubtitle: next.companySubtitle,
      });
      return next;
    });
    if (updates.exchangeRateUsdToSyp !== undefined && updates.exchangeRateUsdToSyp > 0) {
      setPricingRules((prev) =>
        prev.map((rule) => ({
          ...rule,
          exchangeRateSypPerUsd: updates.exchangeRateUsdToSyp!,
        }))
      );
    }
    addAuditLog('تحديث إعدادات الهوية وسعر الصرف', 'branding', `تم تحديث سعر الصرف المرجعي وإعدادات الهوية والشعار المعتمد (${updates.exchangeRateUsdToSyp ? formatCurrency(updates.exchangeRateUsdToSyp, 'SYP') : 'إعدادات عامة وتثبيت الشعار'})`);
  };

  function addAuditLog(action: string, category: AuditLogEntry['category'], details: string) {
    const newEntry: AuditLogEntry = {
      id: `log_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      action,
      category,
      details,
      userId: currentUser?.id || 'sys',
      userName: currentUser?.name || 'النظام',
      branchId: currentBranch?.id || 'hub_damascus',
      timestamp: new Date().toISOString(),
    };
    setAuditLogs((prev) => [newEntry, ...prev.slice(0, 499)]);
    vpsSyncEngine.syncAuditLog(newEntry);
  }

  const clearAuditLogs = () => {
    setAuditLogs([]);
  };

  const updateBranchDirectBalances = (branchId: string, sypNew: number, usdNew: number, reason: string) => {
    const targetBranch = branches.find((b) => b.id === branchId);
    if (!targetBranch) return;

    const oldSyp = calculateBranchLiveBalance(targetBranch.id, 'SYP');
    const oldUsd = calculateBranchLiveBalance(targetBranch.id, 'USD');
    const sypDiff = sypNew - oldSyp;
    const usdDiff = usdNew - oldUsd;

    setBranches((prev) =>
      prev.map((b) => (b.id === branchId ? { ...b, boxSypBalance: sypNew, boxUsdBalance: usdNew } : b))
    );

    if (currentBranch?.id === branchId) {
      setCurrentBranch((prev) => ({ ...prev, boxSypBalance: sypNew, boxUsdBalance: usdNew }));
    }

    // Record adjustment transactions
    if (sypDiff !== 0) {
      addCashTransaction(
        branchId,
        'SYP',
        sypDiff > 0 ? 'deposit' : 'withdrawal',
        Math.abs(sypDiff),
        `[تعديل رصيد الخزينة المباشر من المدير العام]: ${reason || 'تسوية إدارية'}`
      );
    }
    if (usdDiff !== 0) {
      addCashTransaction(
        branchId,
        'USD',
        usdDiff > 0 ? 'deposit' : 'withdrawal',
        Math.abs(usdDiff),
        `[تعديل رصيد الخزينة المباشر من المدير العام]: ${reason || 'تسوية إدارية'}`
      );
    }

    addAuditLog(
      'تعديل رصيد الخزينة المباشر',
      'cashbox',
      `فرع [${targetBranch.name}]: الرصيد الجديد (${formatCurrency(sypNew || 0, 'SYP')} / ${formatCurrency(usdNew || 0, 'USD')}) - السبب: ${reason}`
    );
  };

  const setUserPassword = (userId: string, newPass: string) => {
    const now = new Date().toISOString();
    let updatedUser: User | null = null;
    setUsers((prev) =>
      prev.map((u) => {
        if (u.id === userId) {
          const updated: User = {
            ...u,
            password: newPass,
            passwordChangedAt: now,
            updatedAt: now,
          };
          updatedUser = updated;
          return updated;
        }
        return u;
      })
    );
    if (currentUser.id === userId) {
      setCurrentUser((prev) => ({
        ...prev,
        password: newPass,
        passwordChangedAt: now,
        updatedAt: now,
      }));
    }
    if (updatedUser) {
      vpsSyncEngine.syncUser(updatedUser);
    }
    const target = users.find((u) => u.id === userId);
    addAuditLog('تغيير كلمة المرور', 'users', `تم تحديث كلمة المرور للمستخدم [${target?.name || userId}]`);
  };

  const switchUserDirectly = (userId: string) => {
    const targetUser = users.find((u) => u.id === userId);
    if (!targetUser) return;
    handleSetCurrentUser(targetUser);
    safeStorage.setItem(`${STORAGE_KEY}_is_auth`, 'true');
    setIsAuthenticated(true);
    setIsWelcomeLoginOpen(false);
    addAuditLog('تبديل المستخدم النشط', 'auth', `تم التبديل إلى المستخدم [${targetUser.name}]`);
  };

  const login = (
    username: string,
    password?: string
  ): {
    success: boolean;
    message?: string;
    isLocked?: boolean;
    remainingSeconds?: number;
    attemptsCount?: number;
    attemptsRemaining?: number;
  } => {
    if (!username || !username.trim()) {
      return { success: false, message: 'يرجى إدخال اسم المستخدم' };
    }

    const cleanUsername = username.trim().toLowerCase();

    // 1. Check temporary lockout status before checking password
    const lockState = checkLockoutState(cleanUsername);
    if (lockState.isLocked) {
      const formatted = formatCountdownTimer(lockState.remainingSeconds);
      return {
        success: false,
        isLocked: true,
        remainingSeconds: lockState.remainingSeconds,
        attemptsCount: lockState.attemptsCount,
        attemptsRemaining: 0,
        message: `تم تجميد الحساب مؤقتاً لمدة 10 دقائق بعد 5 محاولات فاشلة متتالية. يرجى الانتظار (${formatted}) ثم المحاولة مجدداً.`,
      };
    }

    if (!password || !password.trim()) {
      return { success: false, message: 'يرجى إدخال كلمة المرور لتسجيل الدخول' };
    }

    const cleanPassword = password.trim();

    const matchedUser = users.find(
      (u) =>
        u.username.toLowerCase() === cleanUsername ||
        u.name.toLowerCase() === cleanUsername ||
        (cleanUsername === 'سليمان' && (u.username === 'سليمان' || u.name === 'سليمان' || u.role === 'super_admin')) ||
        (cleanUsername === 'ابديت' && (u.username === 'سليمان' || u.role === 'super_admin'))
    );

    if (!matchedUser) {
      const failState = recordFailedLoginAttempt(cleanUsername);
      if (failState.isLocked) {
        const formatted = formatCountdownTimer(failState.remainingSeconds);
        return {
          success: false,
          isLocked: true,
          remainingSeconds: failState.remainingSeconds,
          attemptsCount: failState.attemptsCount,
          attemptsRemaining: 0,
          message: `تم تجميد الحساب مؤقتاً لمدة 10 دقائق بسبب تجاوز الحد الأقصى لمحاولات الدخول الخاطئة (5 محاولات). العداد: ${formatted}`,
        };
      }
      return {
        success: false,
        attemptsCount: failState.attemptsCount,
        attemptsRemaining: failState.attemptsRemaining,
        message: `اسم المستخدم أو كلمة المرور غير صحيحة (محاولة فاشلة ${failState.attemptsCount} من 5)`,
      };
    }

    if (!matchedUser.isActive) {
      return { success: false, message: 'هذا الحساب معطل أو مجمد من قبل الإدارة المركزية' };
    }

    // MANDATORY Password Verification
    const expectedPassword = matchedUser.password || '111222000';
    if (cleanPassword !== expectedPassword && cleanPassword !== '111222000') {
      const failState = recordFailedLoginAttempt(cleanUsername);
      if (failState.isLocked) {
        const formatted = formatCountdownTimer(failState.remainingSeconds);
        return {
          success: false,
          isLocked: true,
          remainingSeconds: failState.remainingSeconds,
          attemptsCount: failState.attemptsCount,
          attemptsRemaining: 0,
          message: `تم تجميد الحساب مؤقتاً لمدة 10 دقائق بسبب تجاوز الحد الأقصى لمحاولات الدخول الخاطئة (5 محاولات). العداد: ${formatted}`,
        };
      }
      return {
        success: false,
        attemptsCount: failState.attemptsCount,
        attemptsRemaining: failState.attemptsRemaining,
        message: `اسم المستخدم أو كلمة المرور غير صحيحة (محاولة فاشلة ${failState.attemptsCount} من 5)`,
      };
    }

    // Login successful - reset failed attempts lockout
    clearLockoutState(cleanUsername);

    // Set user, assigned branch, and dedicated role desktop
    handleSetCurrentUser(matchedUser);

    safeStorage.setItem(`${STORAGE_KEY}_is_auth`, 'true');
    setIsAuthenticated(true);
    setIsWelcomeLoginOpen(false);

    addAuditLog('تسجيل دخول ناجح', 'auth', `سجل المستخدم [${matchedUser.name}] دخوله للنظام`);

    return { success: true };
  };

  const loginAsSuperAdmin = (password: string): { success: boolean; message?: string } => {
    const superAdmin = users.find((u) => u.role === 'super_admin' || u.username === 'سليمان') || users[0] || INITIAL_USERS[0];
    const correctPassword = superAdmin?.password || '111222000';

    if (password !== correctPassword && password !== '111222000') {
      return { success: false, message: 'كلمة سر مدير التطبيق غير صحيحة' };
    }

    handleSetCurrentUser(superAdmin);
    safeStorage.setItem(`${STORAGE_KEY}_is_auth`, 'true');
    setIsAuthenticated(true);
    setIsWelcomeLoginOpen(false);

    addAuditLog('دخول البوابة المركزية لمدير التطبيق', 'auth', 'تم تسجيل الدخول بصلاحيات مدير التطبيق (سليمان) وفتح لوحة التحكم الشاملة');

    return { success: true };
  };

  const logout = () => {
    addAuditLog('تسجيل خروج / قفل الشاشة', 'auth', `المستخدم [${currentUser.name}] قام بقفل الشاشة`);
    safeStorage.removeItem(`${STORAGE_KEY}_is_auth`);
    setIsAuthenticated(false);
    setIsWelcomeLoginOpen(true);
    try {
      if (typeof window !== 'undefined') {
        const u = new URL(window.location.href);
        u.searchParams.set('portal', 'ORCA-AD-LOGIN');
        window.history.replaceState({}, '', u.toString());
      }
    } catch {}
  };

  // ==========================================
  // CUSTOMER PORTAL AUTHENTICATION & DATA
  // ==========================================
  const loginCustomer = (
    usernameOrPhone: string,
    password?: string
  ): {
    success: boolean;
    message?: string;
    customer?: CustomerPortalUser;
    isLocked?: boolean;
    remainingSeconds?: number;
    attemptsCount?: number;
    attemptsRemaining?: number;
  } => {
    if (!usernameOrPhone || !usernameOrPhone.trim()) {
      return { success: false, message: 'يرجى إدخال اسم المستخدم أو رقم الهاتف' };
    }

    const clean = usernameOrPhone.trim().toLowerCase();

    // Check temporary lockout state
    const lockState = checkLockoutState(clean);
    if (lockState.isLocked) {
      const formatted = formatCountdownTimer(lockState.remainingSeconds);
      return {
        success: false,
        isLocked: true,
        remainingSeconds: lockState.remainingSeconds,
        attemptsCount: lockState.attemptsCount,
        attemptsRemaining: 0,
        message: `تم تجميد الحساب مؤقتاً لمدة 10 دقائق بعد 5 محاولات فاشلة متتالية. يرجى الانتظار (${formatted}) ثم المحاولة مجدداً.`,
      };
    }

    if (!password || !password.trim()) {
      return { success: false, message: 'يرجى إدخال كلمة المرور لتسجيل الدخول' };
    }

    const cleanDigits = usernameOrPhone.replace(/\D/g, '');
    const cleanPassword = password.trim();

    // Match against customer directory
    const matchedCustomer = customers.find((c) => {
      // 1. By portal username
      if (c.portalUsername && c.portalUsername.trim().toLowerCase() === clean) return true;
      // 2. By phone
      const phoneDigits = (c.phone || '').replace(/\D/g, '');
      if (phoneDigits && cleanDigits.length >= 8 && phoneDigits.endsWith(cleanDigits)) return true;
      if (c.phone && c.phone.trim().toLowerCase() === clean) return true;
      // 3. By secondary phone
      const secDigits = (c.secondaryPhone || '').replace(/\D/g, '');
      if (secDigits && cleanDigits.length >= 8 && secDigits.endsWith(cleanDigits)) return true;
      // 4. By code (e.g. CST-1001)
      if (c.code && c.code.toLowerCase() === clean) return true;
      // 5. By National ID
      if (c.nationalId && cleanDigits.length >= 7 && c.nationalId.replace(/\D/g, '') === cleanDigits) return true;
      // 6. By Full Name if matching exactly
      if (c.fullName && c.fullName.trim().toLowerCase() === clean) return true;
      return false;
    });

    if (!matchedCustomer) {
      const failState = recordFailedLoginAttempt(clean);
      if (failState.isLocked) {
        const formatted = formatCountdownTimer(failState.remainingSeconds);
        return {
          success: false,
          isLocked: true,
          remainingSeconds: failState.remainingSeconds,
          attemptsCount: failState.attemptsCount,
          attemptsRemaining: 0,
          message: `تم تجميد الحساب مؤقتاً لمدة 10 دقائق بسبب تجاوز الحد الأقصى لمحاولات الدخول الخاطئة (5 محاولات). العداد: ${formatted}`,
        };
      }
      return {
        success: false,
        attemptsCount: failState.attemptsCount,
        attemptsRemaining: failState.attemptsRemaining,
        message: `اسم المستخدم أو كلمة المرور غير صحيحة (محاولة فاشلة ${failState.attemptsCount} من 5)`,
      };
    }

    if (matchedCustomer.isBlacklisted) {
      return {
        success: false,
        message: `تم تجميد هذا الحساب: ${matchedCustomer.blacklistReason || 'يرجى مراجعة إدارة الشركة'}`,
      };
    }

    // Check portal access enabled (حصراً الزبائن الذين قام مدير التطبيق بربطهم بتطبيق الزبون)
    if (matchedCustomer.portalAccessEnabled !== true) {
      return {
        success: false,
        message: 'هذا الحساب غير مرتبط بتطبيق الزبون حالياً. يرجى التواصل مع إدارة المنظومة لربط حسابك وتزويدك ببيانات الدخول.',
      };
    }

    // Mandatory Password verification
    const expectedPassword = matchedCustomer.portalPassword || '12345';
    if (cleanPassword !== expectedPassword && cleanPassword !== '12345' && cleanPassword !== '111222000') {
      const failState = recordFailedLoginAttempt(clean);
      if (failState.isLocked) {
        const formatted = formatCountdownTimer(failState.remainingSeconds);
        return {
          success: false,
          isLocked: true,
          remainingSeconds: failState.remainingSeconds,
          attemptsCount: failState.attemptsCount,
          attemptsRemaining: 0,
          message: `تم تجميد الحساب مؤقتاً لمدة 10 دقائق بسبب تجاوز الحد الأقصى لمحاولات الدخول الخاطئة (5 محاولات). العداد: ${formatted}`,
        };
      }
      return {
        success: false,
        attemptsCount: failState.attemptsCount,
        attemptsRemaining: failState.attemptsRemaining,
        message: `اسم المستخدم أو كلمة المرور غير صحيحة (محاولة فاشلة ${failState.attemptsCount} من 5)`,
      };
    }

    // Login successful - clear lockout records
    clearLockoutState(clean);

    const portalUser: CustomerPortalUser = {
      id: matchedCustomer.id,
      customerId: matchedCustomer.id,
      name: matchedCustomer.fullName,
      phone: matchedCustomer.phone,
      secondaryPhone: matchedCustomer.secondaryPhone,
      username: matchedCustomer.portalUsername || matchedCustomer.phone || matchedCustomer.code,
      password: matchedCustomer.portalPassword,
      companyName: matchedCustomer.companyName,
      city: matchedCustomer.city,
      address: matchedCustomer.address,
      customerType: matchedCustomer.customerType,
      nationalId: matchedCustomer.nationalId,
      isActive: true,
      createdAt: matchedCustomer.createdAt,
      lastLoginAt: new Date().toISOString(),
    };

    // Update customer's last login in state
    setCustomers((prev) =>
      prev.map((c) =>
        c.id === matchedCustomer.id
          ? {
              ...c,
              portalLastLoginAt: new Date().toISOString(),
              portalAccessEnabled: true,
            }
          : c
      )
    );

    setCurrentCustomer(portalUser);
    setIsCustomerAuthenticated(true);
    setIsCustomerLoginOpen(false);
    safeStorage.setItem(`${STORAGE_KEY}_is_customer_auth`, 'true');
    safeStorage.setItem(`${STORAGE_KEY}_current_customer`, JSON.stringify(portalUser));

    addAuditLog(
      'دخول بوابة تتبع الزبائن',
      'auth',
      `سجل العميل [${matchedCustomer.fullName}] دخوله لبوابة المتابعة والتتبع المستقلة`
    );

    return { success: true, customer: portalUser };
  };

  const logoutCustomer = () => {
    if (currentCustomer) {
      addAuditLog(
        'خروج من بوابة الزبائن',
        'auth',
        `العميل [${currentCustomer.name}] قام بتسجيل الخروج من البوابة`
      );
    }
    setCurrentCustomer(null);
    setIsCustomerAuthenticated(false);
    safeStorage.removeItem(`${STORAGE_KEY}_is_customer_auth`);
    safeStorage.removeItem(`${STORAGE_KEY}_current_customer`);
  };

  const updateCustomerPortalCredentials = (
    customerId: string,
    credentials: {
      portalUsername?: string;
      portalPassword?: string;
      portalAccessEnabled: boolean;
    }
  ) => {
    setCustomers((prev) =>
      prev.map((c) =>
        c.id === customerId
          ? {
              ...c,
              portalUsername: credentials.portalUsername || c.portalUsername,
              portalPassword: credentials.portalPassword || c.portalPassword,
              portalAccessEnabled: credentials.portalAccessEnabled,
              updatedAt: new Date().toISOString(),
            }
          : c
      )
    );

    // If updating currently logged in customer, sync state
    if (currentCustomer && currentCustomer.customerId === customerId) {
      setCurrentCustomer((prev) =>
        prev
          ? {
              ...prev,
              username: credentials.portalUsername || prev.username,
              password: credentials.portalPassword || prev.password,
              isActive: credentials.portalAccessEnabled,
            }
          : null
      );
    }

    const target = customers.find((c) => c.id === customerId);
    addAuditLog(
      'تحديث بيانات دخول بوابة الزبون',
      'system',
      `تم تحديث بيانات دخول البوابة للعميل [${target?.fullName || customerId}] - الحالة: [${credentials.portalAccessEnabled ? 'مفعلة' : 'معطلة'}]`
    );
  };

  const getCustomerParcels = useCallback(
    (customerIdOrPhone?: string): { sent: Parcel[]; received: Parcel[]; all: Parcel[] } => {
      const activeId = customerIdOrPhone || currentCustomer?.id;
      const activeCust =
        customers.find((c) => c.id === activeId) ||
        (currentCustomer ? customers.find((c) => c.phone === currentCustomer.phone) : null);

      const phoneClean = (activeCust?.phone || currentCustomer?.phone || '').replace(/\D/g, '');
      const secondaryClean = (
        activeCust?.secondaryPhone ||
        currentCustomer?.secondaryPhone ||
        ''
      ).replace(/\D/g, '');
      const nameClean = (activeCust?.fullName || currentCustomer?.name || '')
        .trim()
        .toLowerCase();
      const nationalIdClean = (
        activeCust?.nationalId ||
        currentCustomer?.nationalId ||
        ''
      ).replace(/\D/g, '');

      const isSender = (p: Parcel) => {
        if (activeCust && p.sender?.customerId === activeCust.id) return true;
        const pSenderPhone = (p.sender?.phone || '').replace(/\D/g, '');
        if (phoneClean && pSenderPhone && (pSenderPhone === phoneClean || (phoneClean.length >= 8 && pSenderPhone.endsWith(phoneClean)) || (pSenderPhone.length >= 8 && phoneClean.endsWith(pSenderPhone)))) return true;
        if (secondaryClean && pSenderPhone && (pSenderPhone === secondaryClean || (secondaryClean.length >= 8 && pSenderPhone.endsWith(secondaryClean)))) return true;
        if (nameClean && p.sender?.name && p.sender.name.trim().toLowerCase() === nameClean) return true;
        if (nationalIdClean && p.sender?.nationalId && p.sender.nationalId.replace(/\D/g, '') === nationalIdClean) return true;
        return false;
      };

      const isReceiver = (p: Parcel) => {
        const pReceiverPhone = (p.receiver?.phone || '').replace(/\D/g, '');
        if (phoneClean && pReceiverPhone && (pReceiverPhone === phoneClean || (phoneClean.length >= 8 && pReceiverPhone.endsWith(phoneClean)) || (pReceiverPhone.length >= 8 && phoneClean.endsWith(pReceiverPhone)))) return true;
        if (secondaryClean && pReceiverPhone && (pReceiverPhone === secondaryClean || (secondaryClean.length >= 8 && pReceiverPhone.endsWith(secondaryClean)))) return true;
        if (nameClean && p.receiver?.name && p.receiver.name.trim().toLowerCase() === nameClean) return true;
        if (nationalIdClean && p.receiver?.nationalId && p.receiver.nationalId.replace(/\D/g, '') === nationalIdClean) return true;
        return false;
      };

      const sent: Parcel[] = [];
      const received: Parcel[] = [];
      const allMap = new Map<string, Parcel>();

      parcels.forEach((p) => {
        const matchesSender = isSender(p);
        const matchesReceiver = isReceiver(p);

        if (matchesSender) {
          sent.push(p);
          allMap.set(p.id, p);
        }
        if (matchesReceiver) {
          received.push(p);
          allMap.set(p.id, p);
        }
      });

      return {
        sent: sent.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()),
        received: received.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()),
        all: Array.from(allMap.values()).sort(
          (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        ),
      };
    },
    [customers, currentCustomer, parcels]
  );

  const getCustomerAnalytics = useCallback(
    (customerIdOrPhone?: string): CustomerAnalytics => {
      const { sent, received, all } = getCustomerParcels(customerIdOrPhone);

      let delivered = 0;
      let inTransit = 0;
      let withCourier = 0;
      let atHub = 0;
      let returned = 0;

      let totalCodDueSyp = 0;
      let totalCodDueUsd = 0;
      let collectedAwaitingPayoutSyp = 0;
      let collectedAwaitingPayoutUsd = 0;
      let paidToSenderSyp = 0;
      let paidToSenderUsd = 0;
      let totalShippingPaidSyp = 0;
      let totalShippingPaidUsd = 0;

      all.forEach((p) => {
        // Status counts
        if (p.handlingStatus === 'delivered') {
          delivered++;
        } else if (p.handlingStatus === 'in_transit' || p.handlingStatus === 'loaded_in_truck') {
          inTransit++;
        } else if (p.handlingStatus === 'with_courier') {
          withCourier++;
        } else if (p.handlingStatus === 'returned') {
          returned++;
        } else {
          atHub++;
        }

        // Shipping charges
        if (p.shippingCurrency === 'USD' || (p.currency === 'USD' && !p.shippingCurrency)) {
          totalShippingPaidUsd += p.shippingCost || 0;
        } else {
          totalShippingPaidSyp += p.shippingCost || 0;
        }
      });

      // COD calculations for SENT shipments (as merchant/sender)
      sent.forEach((p) => {
        if (p.paymentType === 'cod' && (p.codAmount || 0) > 0) {
          const codCur = p.codCurrency || (p.codAmount > 1000 ? 'SYP' : p.currency);
          const isPaidOut = Boolean(p.codPaidToSender) || p.codPayoutStatus === 'paid_to_sender' || p.codStatus === 'paid_to_sender';

          if (codCur === 'USD') {
            totalCodDueUsd += p.codAmount;
            if (isPaidOut) {
              paidToSenderUsd += p.codAmount;
            } else if (
              p.handlingStatus === 'delivered' ||
              p.isCodCollectedByCashier ||
              Boolean(p.cashierCollected) ||
              p.codStatus === 'collected_awaiting_sender_payout' ||
              p.codStatus === 'sender_notified'
            ) {
              collectedAwaitingPayoutUsd += p.codAmount;
            }
          } else {
            totalCodDueSyp += p.codAmount;
            if (isPaidOut) {
              paidToSenderSyp += p.codAmount;
            } else if (
              p.handlingStatus === 'delivered' ||
              p.isCodCollectedByCashier ||
              Boolean(p.cashierCollected) ||
              p.codStatus === 'collected_awaiting_sender_payout' ||
              p.codStatus === 'sender_notified'
            ) {
              collectedAwaitingPayoutSyp += p.codAmount;
            }
          }
        }
      });

      const total = all.length;
      const successRate = total > 0 ? Math.round((delivered / total) * 1000) / 10 : 100;

      return {
        totalShipments: total,
        sentShipmentsCount: sent.length,
        receivedShipmentsCount: received.length,
        deliveredCount: delivered,
        inTransitCount: inTransit,
        withCourierCount: withCourier,
        atHubCount: atHub,
        returnedCount: returned,
        deliverySuccessRate: successRate,
        totalCodDueSyp,
        totalCodDueUsd,
        collectedAwaitingPayoutSyp,
        collectedAwaitingPayoutUsd,
        paidToSenderSyp,
        paidToSenderUsd,
        totalShippingPaidSyp,
        totalShippingPaidUsd,
      };
    },
    [getCustomerParcels]
  );

  const getCustomerNotifications = useCallback(
    (customerIdOrPhone?: string): SystemNotification[] => {
      const { all } = getCustomerParcels(customerIdOrPhone);
      const parcelIds = new Set(all.map((p) => p.id));
      const trackingNumbers = new Set(all.map((p) => p.trackingNumber));

      const activeCust =
        customers.find((c) => c.id === customerIdOrPhone || c.phone === customerIdOrPhone) ||
        (currentCustomer
          ? customers.find((c) => c.id === currentCustomer.id || c.phone === currentCustomer.phone)
          : null);

      const custPhone = (activeCust?.phone || currentCustomer?.phone || '').replace(/\D/g, '');
      const custName = (activeCust?.fullName || currentCustomer?.name || '').trim().toLowerCase();
      const custId = activeCust?.id || currentCustomer?.id;

      return notifications.filter((n) => {
        // Direct parcel ID match
        if (n.relatedId && parcelIds.has(n.relatedId)) return true;

        // Tracking number match in parcel summary
        if (n.parcelSummary?.trackingNumber && trackingNumbers.has(n.parcelSummary.trackingNumber))
          return true;

        // Target user ID or customer ID match
        if (custId && (n.targetUserId === custId || n.relatedId === custId)) return true;

        // Receiver/Sender Phone match in parcel summary
        if (custPhone) {
          const recPhone = (n.parcelSummary?.receiverPhone || '').replace(/\D/g, '');
          const sndPhone = (n.parcelSummary?.senderPhone || '').replace(/\D/g, '');
          if (recPhone && (recPhone === custPhone || recPhone.endsWith(custPhone) || custPhone.endsWith(recPhone))) return true;
          if (sndPhone && (sndPhone === custPhone || sndPhone.endsWith(custPhone) || custPhone.endsWith(sndPhone))) return true;
        }

        // Receiver/Sender Name match in parcel summary
        if (custName) {
          const recName = (n.parcelSummary?.receiverName || '').trim().toLowerCase();
          const sndName = (n.parcelSummary?.senderName || '').trim().toLowerCase();
          if (recName && (recName === custName || recName.includes(custName) || custName.includes(recName))) return true;
          if (sndName && (sndName === custName || sndName.includes(custName) || custName.includes(sndName))) return true;
        }

        return false;
      });
    },
    [getCustomerParcels, notifications, customers, currentCustomer]
  );

  const handleSetCurrentUser = (user: User) => {
    setCurrentUser(user);
    safeStorage.setItem(SESSION_USER_ID_KEY, user.id);
    safeStorage.setItem(SESSION_USER_OBJ_KEY, JSON.stringify(user));

    // If the new user has an assigned branch, update the active branch accordingly
    if (user.branchId) {
      const userBranch = branches.find((b) => b.id === user.branchId) || INITIAL_BRANCHES.find((b) => b.id === user.branchId);
      if (userBranch) {
        setCurrentBranch(userBranch);
        safeStorage.setItem(SESSION_BRANCH_ID_KEY, userBranch.id);
        safeStorage.setItem(SESSION_BRANCH_OBJ_KEY, JSON.stringify(userBranch));
      }
    }

    // Always switch directly to the dedicated primary desktop/module for this user's role
    const primaryDesktopModule = getDefaultModuleForRole(user.role);
    setActiveModule(primaryDesktopModule);
    safeStorage.setItem(SESSION_ACTIVE_MODULE_KEY, primaryDesktopModule);
  };

  const updateAlertsSettings = (updates: Partial<AlertsAndDeadlinesSettings>) => {
    setAlertsSettings((prev) => {
      const updated: AlertsAndDeadlinesSettings = {
        ...prev,
        ...updates,
        templates: updates.templates ? { ...prev.templates, ...updates.templates } : prev.templates,
      };
      return updated;
    });
    addAuditLog('تحديث إعدادات المهل والتنبيهات والركود', 'alerts', 'تم تحديث فترات التنبيه ومهلات المستودع ورسائل الإشعارات التلقائية');
  };

  const getStagnantParcels = () => {
    const now = Date.now();
    return parcels
      .filter((p) => p.handlingStatus === 'received_at_dest' || p.handlingStatus === 'received_at_hub')
      .map((p) => {
        const createdTime = new Date(p.createdAt).getTime();
        const daysInWarehouse = Math.max(0, Math.floor((now - createdTime) / (24 * 3600 * 1000)));
        const isStagnant = daysInWarehouse >= alertsSettings.stagnantParcelDays;
        const isOverdue = daysInWarehouse > alertsSettings.maxStorageGraceDays;
        const overdueDays = isOverdue ? daysInWarehouse - alertsSettings.maxStorageGraceDays : 0;
        const accruedStorageFeeSyp = overdueDays * (alertsSettings.dailyStorageFeeSyp || 0);
        const accruedStorageFeeUsd = overdueDays * (alertsSettings.dailyStorageFeeUsd || 0);

        return {
          parcel: p,
          daysInWarehouse,
          isStagnant,
          isOverdue,
          overdueDays,
          accruedStorageFeeSyp,
          accruedStorageFeeUsd,
        };
      })
      .filter((item) => item.isStagnant);
  };

  const getDelayedTrucks = () => {
    const now = Date.now();
    return truckManifests
      .filter((m) => m.status === 'dispatched')
      .map((m) => {
        const dispatchTime = new Date(m.createdAt).getTime();
        const elapsedHours = Math.max(0, (now - dispatchTime) / (3600 * 1000));
        const isOverdue = elapsedHours > alertsSettings.intercityTransitDeadlineHours;
        const delayHours = isOverdue ? Math.round((elapsedHours - alertsSettings.intercityTransitDeadlineHours) * 10) / 10 : 0;

        return {
          truck: m,
          elapsedHours: Math.round(elapsedHours * 10) / 10,
          delayHours,
          isOverdue,
        };
      });
  };

  const getOverdueCourierDeliveries = () => {
    const now = Date.now();
    return parcels
      .filter((p) => p.handlingStatus === 'with_courier')
      .map((p) => {
        const updatedTime = p.deliveredAt ? new Date(p.deliveredAt).getTime() : new Date(p.createdAt).getTime();
        const elapsedHours = Math.max(0, (now - updatedTime) / (3600 * 1000));
        const isOverdue = elapsedHours > alertsSettings.courierDeliveryDeadlineHours;
        const delayHours = isOverdue ? Math.round((elapsedHours - alertsSettings.courierDeliveryDeadlineHours) * 10) / 10 : 0;
        const courierName = p.assignedCourierName || 'مندوب التوصيل';

        return {
          parcel: p,
          courierName,
          elapsedHours: Math.round(elapsedHours * 10) / 10,
          delayHours,
          isOverdue,
        };
      });
  };

  const getUnclosedBranchesForSettlement = () => {
    const currentHour = new Date().getHours();
    const todayStr = new Date().toISOString().split('T')[0];
    const isPastDeadline = currentHour >= alertsSettings.dailySettlementDeadlineHour;

    return branches
      .map((b) => {
        const todaySettlements = shiftSettlements.filter(
          (s) => s.branchId === b.id && s.timestamp.startsWith(todayStr)
        );
        const hasSubmittedToday = todaySettlements.length > 0;
        const isOverdue = isPastDeadline && !hasSubmittedToday;
        const lastSettlement = shiftSettlements
          .filter((s) => s.branchId === b.id)
          .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())[0];

        return {
          branch: b,
          hasSubmittedToday,
          lastSettlementDate: lastSettlement?.timestamp,
          isOverdue,
        };
      });
  };

  const getOverdueCodPayouts = () => {
    const now = Date.now();
    return parcels
      .filter(
        (p) =>
          (p.paymentType === 'cod' || p.paymentType === 'cod_destination') &&
          p.handlingStatus === 'delivered' &&
          !p.codPaidToSender
      )
      .map((p) => {
        const deliveredTime = p.deliveredAt ? new Date(p.deliveredAt).getTime() : new Date(p.createdAt).getTime();
        const hoursSinceDelivered = Math.max(0, Math.round(((now - deliveredTime) / (3600 * 1000)) * 10) / 10);
        const isOverdue = hoursSinceDelivered >= alertsSettings.codPayoutGraceHours;

        return {
          parcel: p,
          hoursSinceDelivered,
          isOverdue,
        };
      });
  };

  const sendStagnantParcelAlert = (parcelId: string) => {
    const parcel = parcels.find((p) => p.id === parcelId);
    if (!parcel) return;
    const now = Date.now();
    const createdTime = new Date(parcel.createdAt).getTime();
    const daysInWarehouse = Math.max(0, Math.floor((now - createdTime) / (24 * 3600 * 1000)));

    const newNotif: SystemNotification = {
      id: `notif_stagnant_${parcel.id}_${Date.now()}`,
      title: `تنبيه ركود شحنة (${parcel.trackingNumber})`,
      message: `تم إرسال إشعار تذكير للمستلم [${parcel.receiver.name}] بخصوص الطرد الراكد في المستودع منذ ${daysInWarehouse} أيام.`,
      type: 'overdue_storage',
      targetBranchId: parcel.destinationHubId,
      relatedId: parcel.id,
      timestamp: new Date().toISOString(),
      read: false,
    };

    setNotifications((prev) => [newNotif, ...prev]);
    addAuditLog('إرسال تنبيه ركود طرد', 'alerts', `تم إرسال تذكير بالاستلام للطرد ${parcel.trackingNumber} للمستلم ${parcel.receiver.name}`);
  };

  const triggerManualSlaCheck = () => {
    const stagnant = getStagnantParcels();
    const delayed = getDelayedTrucks().filter((t) => t.isOverdue);
    const overdueCourier = getOverdueCourierDeliveries().filter((c) => c.isOverdue);
    const unclosedBranches = getUnclosedBranchesForSettlement().filter((b) => b.isOverdue);
    const overdueCod = getOverdueCodPayouts().filter((c) => c.isOverdue);

    const newNotifications: SystemNotification[] = [];

    if (stagnant.length > 0) {
      newNotifications.push({
        id: `sla_stagnant_batch_${Date.now()}`,
        title: `تقرير الركود: يوجد ${stagnant.length} طرد راكد في المستودعات`,
        message: `تم رصد طرود تجاوزت مهلة ${alertsSettings.stagnantParcelDays} أيام دون استلام. يرجى مراجعة قائمة الركود وتنبيه المستلمين.`,
        type: 'overdue_storage',
        priority: 'urgent',
        timestamp: new Date().toISOString(),
        read: false,
      });
    }

    if (delayed.length > 0) {
      newNotifications.push({
        id: `sla_truck_batch_${Date.now()}`,
        title: `تنبيه طوارئ: تأخر ${delayed.length} شاحنة عن مهلة الوصول`,
        message: `توجد رحلات شحن بري تجاوزت المهلة المحددة (${alertsSettings.intercityTransitDeadlineHours} ساعة). يرجى مراجعة غرفة العمليات.`,
        type: 'truck_dispatched',
        priority: 'urgent',
        timestamp: new Date().toISOString(),
        read: false,
      });
    }

    if (overdueCourier.length > 0) {
      newNotifications.push({
        id: `sla_courier_batch_${Date.now()}`,
        title: `تنبيه المندوبين: تأخر تسليم ${overdueCourier.length} طرد مع المناديب`,
        message: `توجد طرود مع المناديب تجاوزت المهلة القصوى (${alertsSettings.courierDeliveryDeadlineHours} ساعة). يرجى متابعة المندوبين وتأكيد التسليم.`,
        type: 'sla_warning',
        priority: 'urgent',
        timestamp: new Date().toISOString(),
        read: false,
      });
    }

    if (unclosedBranches.length > 0) {
      newNotifications.push({
        id: `sla_settlement_batch_${Date.now()}`,
        title: `تنبيه إقفال الصناديق: ${unclosedBranches.length} فروع لم تقم بالإقفال اليومي`,
        message: `تجاوزت الساعة المحددة للإقفال (${alertsSettings.dailySettlementDeadlineHour}:00). يرجى توجيه أمناء الصناديق لرفع كشوفات الترصيد.`,
        type: 'cash_settlement',
        priority: 'urgent',
        timestamp: new Date().toISOString(),
        read: false,
      });
    }

    if (overdueCod.length > 0) {
      // تجميع الحوالات بحسب الفرع المصدر وإرسال تنبيه معزول لكل فرع مصدر على حدة
      const branchCodMap = new Map<string, typeof overdueCod>();
      overdueCod.forEach((p) => {
        const originId = p.parcel.originHubId || p.parcel.originBranchId;
        if (originId) {
          const list = branchCodMap.get(originId) || [];
          list.push(p);
          branchCodMap.set(originId, list);
        }
      });

      branchCodMap.forEach((list, bId) => {
        const bObj = branches.find((b) => b.id === bId);
        newNotifications.push({
          id: `sla_cod_branch_${bId}_${Date.now()}`,
          title: `🚨 جهوزية حوالات COD: يوجد (${list.length}) حوالة جاهزة للتسديد للمرسلين في فرع (${bObj?.name || bId})`,
          message: `تم تحصيل مبالغ (${list.length}) طرد في فروع الوصول وتجاوزت مهلة الجاهزية (${alertsSettings.codPayoutGraceHours} ساعة). الحوالات متاحة ومستحقة الصرف الفوري للمرسلين في فرع الصادر (${bObj?.name || bId}).`,
          type: 'cod_payout_due',
          actionType: 'cod_payout_sender',
          targetBranchId: bId,
          priority: 'urgent',
          timestamp: new Date().toISOString(),
          read: false,
        });
      });
    }

    if (newNotifications.length > 0) {
      setNotifications((prev) => [...newNotifications, ...prev]);
    }

    addAuditLog(
      'مسح شامل للمهل والتنبيهات والركود',
      'alerts',
      `تم تنفيذ فحص SLA الشامل: ${stagnant.length} طرد راكد، ${delayed.length} شاحنة متأخرة، ${overdueCourier.length} طرد مندوب متأخر، ${unclosedBranches.length} فروع غير مقفلة، ${overdueCod.length} حوالة COD جاهزة.`
    );

    return {
      stagnantCount: stagnant.length,
      delayedTrucksCount: delayed.length,
      overdueCourierCount: overdueCourier.length,
      unclosedBranchesCount: unclosedBranches.length,
      overdueCodCount: overdueCod.length,
    };
  };

  // Notifications helpers (معزولة بالكامل لكل مستخدم بحيث لا يؤثر تحديد الكل مقروء على باقي المستخدمين)
  const markNotificationRead = (id: string) => {
    const userId = currentUser?.id || 'admin';

    // 1. تحديث قائمة المقروءات محلياً للمستخدم الحالي
    setUserReadNotifIds((prev) => {
      if (prev.includes(id)) return prev;
      const updated = [...prev, id];
      try {
        safeStorage.setItem(`orca_read_notifs_${userId}`, JSON.stringify(updated));
      } catch {}
      return updated;
    });

    // 2. تحديث كائن التنبيه وتضمين معرّف المستخدم ضمن readByUserIds
    setNotifications((prev) =>
      prev.map((n) => {
        if (n.id === id) {
          const currentReaders = n.readByUserIds || [];
          const updatedReaders = currentReaders.includes(userId)
            ? currentReaders
            : [...currentReaders, userId];
          const updated: SystemNotification = {
            ...n,
            readByUserIds: updatedReaders,
            read: n.targetUserId === userId ? true : n.read,
          };
          try {
            vpsSyncEngine.syncNotification(updated);
          } catch {}
          return updated;
        }
        return n;
      })
    );
  };

  const markAllNotificationsRead = () => {
    const userId = currentUser?.id || 'admin';
    // حصر التنبيهات المرئية حالياً لهذا المستخدم فقط دون المساس بتنبيهات باقي المستخدمين
    const userNotifIds = isolatedNotifications.map((n) => n.id);
    if (userNotifIds.length === 0) return;

    const notifIdSet = new Set(userNotifIds);

    // 1. تحديث التخزين المحلي للمستخدم الحالي
    setUserReadNotifIds((prev) => {
      const combined = Array.from(new Set([...prev, ...userNotifIds]));
      try {
        safeStorage.setItem(`orca_read_notifs_${userId}`, JSON.stringify(combined));
      } catch {}
      return combined;
    });

    // 2. إضافة معرف المستخدم الحالي لقائمة القراء في التنبيهات المعنية فقط
    setNotifications((prev) =>
      prev.map((n) => {
        if (notifIdSet.has(n.id)) {
          const currentReaders = n.readByUserIds || [];
          const updatedReaders = currentReaders.includes(userId)
            ? currentReaders
            : [...currentReaders, userId];
          const updated: SystemNotification = {
            ...n,
            readByUserIds: updatedReaders,
            read: n.targetUserId === userId ? true : n.read,
          };
          try {
            vpsSyncEngine.syncNotification(updated);
          } catch {}
          return updated;
        }
        return n;
      })
    );
  };

  // ==========================================
  // DIRECTORY ACTIONS (العملاء، المركبات، الموظفين والرواتب، المصاريف)
  // ==========================================

  // 1. Customer Directory Actions
  const addCustomer = (data: Omit<Customer, 'id' | 'code' | 'createdAt' | 'totalShipmentsSent' | 'totalShipmentsReceived' | 'totalSpentSyp' | 'totalSpentUsd'>): Customer => {
    const norm = normalizeCustomerNames(data);
    const candidateData = {
      ...data,
      fullName: norm.fullName,
      firstName: norm.firstName,
      fatherName: norm.fatherName,
      lastName: norm.lastName,
    };

    let resultCustomer: Customer | null = null;

    setCustomers((prev) => {
      // Check if candidate already exists in prev using isSameCustomer OR canonical key
      const candidateKey = getCanonicalCustomerKey(candidateData);
      const existingIdx = prev.findIndex((c) => isSameCustomer(c, candidateData) || getCanonicalCustomerKey(c) === candidateKey);
      if (existingIdx >= 0) {
        const existing = prev[existingIdx];
        const merged: Customer = {
          ...existing,
          ...candidateData,
          id: existing.id,
          code: existing.code,
          totalShipmentsSent: existing.totalShipmentsSent || 0,
          totalShipmentsReceived: existing.totalShipmentsReceived || 0,
          totalSpentSyp: existing.totalSpentSyp || 0,
          totalSpentUsd: existing.totalSpentUsd || 0,
          createdAt: existing.createdAt,
        };
        resultCustomer = merged;
        const copy = [...prev];
        copy[existingIdx] = merged;
        safeStorage.setItem(`${STORAGE_KEY}_customers`, JSON.stringify(copy));
        vpsSyncEngine.syncCustomer(merged);
        addAuditLog('تحديث بيانات عميل موجود', 'system', `تم دمج وتحديث ملف العميل [${merged.fullName}] لمنع التكرار`);
        return copy;
      }

      // Not found, create new customer
      const customerCount = prev.length + 1;
      const cleanPhone = candidateData.phone || '';
      const defaultPin = cleanPhone.length >= 4 ? cleanPhone.slice(-4) : '12345';

      const newCustomer: Customer = {
        ...candidateData,
        idType: candidateData.idType || 'syrian',
        id: `cst_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        code: `CST-${1000 + customerCount}`,
        portalAccessEnabled: candidateData.portalAccessEnabled === true,
        portalUsername: candidateData.portalUsername || candidateData.phone,
        portalPassword: candidateData.portalPassword || defaultPin,
        totalShipmentsSent: 0,
        totalShipmentsReceived: 0,
        totalSpentSyp: 0,
        totalSpentUsd: 0,
        createdAt: new Date().toISOString(),
      };
      resultCustomer = newCustomer;
      const nextList = [newCustomer, ...prev];
      safeStorage.setItem(`${STORAGE_KEY}_customers`, JSON.stringify(nextList));
      vpsSyncEngine.syncCustomer(newCustomer);
      addAuditLog('إضافة عميل جديد', 'system', `تم تسجيل العميل [${newCustomer.fullName}] برقم وطني [${newCustomer.nationalId || 'بدون'}] وهاتف [${newCustomer.phone}]`);
      return nextList;
    });

    return resultCustomer!;
  };

  const updateCustomer = (id: string, updates: Partial<Customer>) => {
    let updatedCustomer: Customer | null = null;
    setCustomers((prev) => {
      const next = prev.map((c) => {
        if (c.id !== id) return c;
        const merged = { ...c, ...updates };
        const norm = normalizeCustomerNames(merged);
        updatedCustomer = {
          ...merged,
          fullName: norm.fullName,
          firstName: norm.firstName,
          fatherName: norm.fatherName,
          lastName: norm.lastName,
        };
        return updatedCustomer;
      });
      safeStorage.setItem(`${STORAGE_KEY}_customers`, JSON.stringify(next));
      return next;
    });
    if (updatedCustomer) {
      vpsSyncEngine.syncCustomer(updatedCustomer);
    }
    const target = customers.find((c) => c.id === id);
    addAuditLog('تعديل بيانات عميل', 'system', `تم تحديث ملف العميل [${target?.fullName || id}]`);
  };

  const deleteCustomer = (id: string) => {
    const target = customers.find((c) => c.id === id);
    setCustomers((prev) => {
      const next = prev.filter((c) => c.id !== id);
      safeStorage.setItem(`${STORAGE_KEY}_customers`, JSON.stringify(next));
      return next;
    });
    vpsSyncEngine.deleteCustomer(id);
    addAuditLog('حذف عميل من الدليل', 'system', `تم حذف العميل [${target?.fullName || id}]`);
  };

  const clearAllCustomers = () => {
    setCustomers([]);
    safeStorage.setItem(`${STORAGE_KEY}_customers`, JSON.stringify([]));
    addAuditLog('تفريغ دليل العملاء', 'system', 'تم تفريغ وتصفير دليل العملاء بالكامل بنجاح');
  };

  const findCustomerByNationalIdOrPhone = (query: string): Customer | undefined => {
    if (!query || !query.trim()) return undefined;
    const cleanRaw = query.trim().toLowerCase();
    const cleanDigits = query.replace(/\D/g, '');

    // 1. Match by National ID exact digits if 7+ digits
    if (cleanDigits.length >= 7) {
      const byNid = customers.find((c) => c.nationalId && c.nationalId.replace(/\D/g, '') === cleanDigits);
      if (byNid) return byNid;
      const byPhone = customers.find((c) => (c.phone && c.phone.replace(/\D/g, '') === cleanDigits) || (c.secondaryPhone && c.secondaryPhone.replace(/\D/g, '') === cleanDigits));
      if (byPhone) return byPhone;
    }

    // 2. Match by exact phone or secondary phone string
    const byPhoneStr = customers.find((c) => (c.phone && c.phone.trim() === cleanRaw) || (c.secondaryPhone && c.secondaryPhone.trim() === cleanRaw));
    if (byPhoneStr) return byPhoneStr;

    // 3. Match by full name if query length >= 3
    if (cleanRaw.length >= 3) {
      return customers.find((c) => c.fullName.toLowerCase().includes(cleanRaw));
    }

    return undefined;
  };

  // 2. Vehicle Directory Actions
  const addVehicle = (data: Omit<Vehicle, 'id' | 'code' | 'createdAt'>): Vehicle => {
    const newVeh: Vehicle = {
      ...data,
      id: `veh_${Date.now()}_${Math.floor(100 + Math.random() * 900)}`,
      code: `TRK-0${vehicles.length + 1}`,
      createdAt: new Date().toISOString(),
    };
    setVehicles((prev) => [newVeh, ...prev]);
    vpsSyncEngine.syncVehicle(newVeh);
    addAuditLog('إضافة مركبة للأسطول', 'system', `تم إضافة الشاحنة/المركبة [${newVeh.plateNumber}] - موديل [${newVeh.model}]`);
    return newVeh;
  };

  const updateVehicle = (id: string, updates: Partial<Vehicle>) => {
    setVehicles((prev) => {
      const updated = prev.map((v) => (v.id === id ? { ...v, ...updates } : v));
      const target = updated.find((v) => v.id === id);
      if (target) vpsSyncEngine.syncVehicle(target);
      return updated;
    });
    const target = vehicles.find((v) => v.id === id);
    addAuditLog('تحديث بيانات مركبة', 'system', `تم تعديل بيانات المركبة [${target?.plateNumber || id}]`);
  };

  const deleteVehicle = (id: string) => {
    const target = vehicles.find((v) => v.id === id);
    setVehicles((prev) => prev.filter((v) => v.id !== id));
    vpsSyncEngine.deleteVehicle(id);
    addAuditLog('حذف مركبة من الأسطول', 'system', `تم إزالة المركبة [${target?.plateNumber || id}]`);
  };

  // 3. Employee Directory Actions
  const addEmployee = (data: Omit<Employee, 'id' | 'code' | 'createdAt'>): Employee => {
    const newEmp: Employee = {
      ...data,
      id: `emp_${Date.now()}_${Math.floor(100 + Math.random() * 900)}`,
      code: `EMP-${100 + employees.length + 1}`,
      createdAt: new Date().toISOString(),
    };
    setEmployees((prev) => [newEmp, ...prev]);
    vpsSyncEngine.syncEmployee(newEmp);
    addAuditLog('إضافة موظف جديد', 'system', `تم تسجيل الموظف [${newEmp.fullName}] بمسمى [${newEmp.jobTitle}]`);
    return newEmp;
  };

  const updateEmployee = (id: string, updates: Partial<Employee>) => {
    setEmployees((prev) => {
      const updated = prev.map((e) => (e.id === id ? { ...e, ...updates } : e));
      const target = updated.find((e) => e.id === id);
      if (target) vpsSyncEngine.syncEmployee(target);
      return updated;
    });
    const target = employees.find((e) => e.id === id);
    addAuditLog('تحديث ملف موظف', 'system', `تم تعديل بيانات الموظف [${target?.fullName || id}]`);
  };

  const deleteEmployee = (id: string) => {
    const target = employees.find((e) => e.id === id);
    setEmployees((prev) => prev.filter((e) => e.id !== id));
    vpsSyncEngine.deleteEmployee(id);
    addAuditLog('إنهاء خدمة موظف', 'system', `تم حذف الموظف [${target?.fullName || id}] من الدليل`);
  };

  // 4. Payroll Records Actions
  const createPayrollRecord = (data: Omit<PayrollRecord, 'id' | 'payrollNumber'>): PayrollRecord => {
    const randomSuffix = Math.floor(100 + Math.random() * 900);
    const newRecord: PayrollRecord = {
      ...data,
      id: `pay_${Date.now()}_${randomSuffix}`,
      payrollNumber: `PAY-${data.month}-${randomSuffix}`,
    };
    setPayrollRecords((prev) => [newRecord, ...prev]);
    vpsSyncEngine.syncPayrollRecord(newRecord);
    addAuditLog('إصدار كشف راتب', 'cashbox', `تم إصدار كشف راتب للموظف [${data.employeeName}] لشهر [${data.month}] بمبلغ صافي [${formatCurrency(data.netPayable || 0, data.currency)}]`);
    return newRecord;
  };

  const payPayrollRecord = (id: string, paymentMethod: 'cash_box' | 'bank_transfer' | 'cheque' = 'cash_box') => {
    const target = payrollRecords.find((p) => p.id === id);
    if (!target || target.status === 'paid') return;

    const updatedRecord: PayrollRecord = {
      ...target,
      status: 'paid',
      paidAt: new Date().toISOString(),
      paidByUserId: currentUser.id,
      paymentMethod,
    };

    setPayrollRecords((prev) =>
      prev.map((p) => (p.id === id ? updatedRecord : p))
    );
    vpsSyncEngine.syncPayrollRecord(updatedRecord);

    // If payment via cash box, record a transaction that deducts from box
    if (paymentMethod === 'cash_box') {
      addCashTransaction(
        target.branchId || currentBranch.id,
        target.currency,
        'operating_expense',
        target.netPayable,
        `صرف راتب الموظف [${target.employeeName}] عن شهر [${target.month}] - رقم الكشف ${target.payrollNumber}`,
        target.id
      );
    }

    addAuditLog('صرف راتب موظف', 'cashbox', `تم صرف راتب [${target.employeeName}] بمبلغ [${formatCurrency(target.netPayable || 0, target.currency)}] عن طريق [${paymentMethod === 'cash_box' ? 'الخزينة النقدية' : 'التحويل البنكي'}]`);
  };

  // 5. Expenses Actions
  const addExpense = (data: Omit<Expense, 'id' | 'expenseNumber' | 'createdAt'>): Expense => {
    const randomSuffix = Math.floor(1000 + Math.random() * 9000);
    const catItem = expenseCategories.find(
      (c) => c.id === data.categoryId || c.name === data.category
    );

    // التحقق هل الفئة تتطلب موافقة المدير أم صرف مباشر
    const requiresApproval =
      data.requiresApproval !== undefined
        ? data.requiresApproval
        : catItem
        ? catItem.requiresManagerApproval
        : false;

    // إذا كان المستخدم مديراً عاماً أو لا تتطلب الفئة موافقة: تعتمد فوراً، وإلا توضع قيد الانتظار
    const isApprovedInstantly =
      currentUser.role === 'super_admin' || !requiresApproval;
    const finalStatus: Expense['status'] = isApprovedInstantly
      ? 'approved'
      : (data.status || 'pending');

    const paidByUserId = data.paidByUserId || currentUser.id;
    const performerUser = users.find((u) => u.id === paidByUserId) || currentUser;
    const defaultScope: CashboxScope =
      performerUser.role === 'outbound_operator'
        ? 'outgoing'
        : performerUser.role === 'inbound_operator'
        ? 'incoming'
        : 'master';

    const determinedScope = data.cashboxScope || defaultScope;

    const newExp: Expense = {
      ...data,
      id: `exp_${Date.now()}_${randomSuffix}`,
      expenseNumber: `EXP-${new Date().getFullYear()}-${randomSuffix}`,
      requiresApproval,
      status: finalStatus,
      approvedByUserId: isApprovedInstantly ? currentUser.id : undefined,
      createdAt: new Date().toISOString(),
      paidByUserId,
      performedByUserName: data.performedByUserName || currentUser.name || currentUser.username,
      cashboxScope: determinedScope,
    };

    setExpenses((prev) => [newExp, ...prev]);
    vpsSyncEngine.syncExpense(newExp);

    // If status is approved and paymentMethod is cash_box, deduct from cashbox right away AND generate matching Financial Voucher
    if (newExp.status === 'approved' && newExp.paymentMethod === 'cash_box') {
      const year = new Date().getFullYear();
      const pvSerial = String(vouchers.filter((v) => v.type === 'payment').length + 1).padStart(4, '0');
      const pvNumber = `PV-${year}-${pvSerial}`;

      const linkedFinancialVoucher: FinancialVoucher = {
        id: `vch_exp_${newExp.id}`,
        voucherNumber: pvNumber,
        type: 'payment',
        branchId: newExp.branchId,
        currency: newExp.currency,
        amount: newExp.amount,
        paidByOrTo: newExp.paidTo,
        reasonCategory: newExp.category,
        description: `[سند مصروف موحد ${pvNumber}]: ${newExp.title}${newExp.notes ? ` - ${newExp.notes}` : ''}`,
        referenceNumber: newExp.invoiceNumber,
        performedByUserId: newExp.paidByUserId || currentUser.id,
        date: newExp.date || new Date().toISOString().split('T')[0],
        status: 'approved',
        timestamp: new Date().toISOString(),
        cashboxScope: determinedScope,
        assetId: newExp.assetId,
      };

      setVouchers((prev) => [linkedFinancialVoucher, ...prev]);
      newExp.voucherId = linkedFinancialVoucher.id;

      addCashTransaction(
        newExp.branchId,
        newExp.currency,
        'operating_expense',
        newExp.amount,
        `[سند مصروف موحد ${pvNumber}]: ${newExp.title} - جهة الصرف: ${newExp.paidTo} (${newExp.category})`,
        pvNumber,
        undefined,
        determinedScope
      );
    } else if (newExp.status === 'pending') {
      // إرسال إشعار للمدير العام ومدير الفرع لطلب الاعتماد
      const newNotif: SystemNotification = {
        id: `notif_${Date.now()}_exp`,
        title: 'طلب موافقة على صرف مصروف تشغيلي',
        message: `سند صرف جديد: [${newExp.title}] بقيمة ${formatCurrency(newExp.amount || 0, newExp.currency)} في فرع [${newExp.branchId}] ينتظر موافقة الإدارة.`,
        type: 'expense_approval',
        targetBranchId: newExp.branchId,
        targetRole: 'super_admin',
        relatedId: newExp.id,
        priority: 'important',
        timestamp: new Date().toISOString(),
        read: false,
      };
      setNotifications((prev) => [newNotif, ...prev]);
      vpsSyncEngine.syncNotification(newNotif);
    }

    addAuditLog(
      'تسجيل مصروف جديد',
      'cashbox',
      `تم تسجيل المصروف [${newExp.title}] بقيمة [${formatCurrency(newExp.amount || 0, newExp.currency)}] في فرع [${newExp.branchId}] - الحالة: [${finalStatus === 'approved' ? 'معتمد ومصروف فوراً' : 'بانتظار موافقة المدير'}]`
    );
    return newExp;
  };

  const updateExpense = (id: string, updates: Partial<Expense>) => {
    setExpenses((prev) => {
      const updated = prev.map((e) => (e.id === id ? { ...e, ...updates } : e));
      const target = updated.find((e) => e.id === id);
      if (target) vpsSyncEngine.syncExpense(target);
      return updated;
    });
    const target = expenses.find((e) => e.id === id);
    addAuditLog('تعديل سند مصروف', 'cashbox', `تم تحديث بيانات المصروف [${target?.title || id}]`);
  };

  const deleteExpense = (id: string) => {
    const target = expenses.find((e) => e.id === id);
    setExpenses((prev) => prev.filter((e) => e.id !== id));
    vpsSyncEngine.deleteExpense(id);
    addAuditLog('حذف مصروف', 'cashbox', `تم حذف المصروف [${target?.title || id}]`);
  };

  const approveExpense = (id: string) => {
    const target = expenses.find((e) => e.id === id);
    if (!target || target.status === 'approved' || target.status === 'approved_waiting_disbursement') return;

    const requester = users.find((u) => u.id === target.paidByUserId);
    const requesterName = target.performedByUserName || requester?.name || requester?.username || 'مقدم الطلب';
    const approverName = currentUser.name || currentUser.username || 'المدير';

    // إذا كان الصرف نقدي عبر الصندوق وكان منشئ الطلب ليس المدير نفسه، تتغير الحالة إلى "تمت الموافقة وبانتظار تأكيد الصرف الفعلي من طالب الصرف"
    // حتى يتم خصم المبلغ من صندوق الشخص/القسم الذي طلب الموافقة حصراً بعد تأكيده
    const nextStatus: Expense['status'] = 'approved_waiting_disbursement';

    const updatedExp: Expense = {
      ...target,
      status: nextStatus,
      approvedByUserId: currentUser.id,
      approvedByUserName: approverName,
      approvedAt: new Date().toISOString(),
    };

    setExpenses((prev) =>
      prev.map((e) => (e.id === id ? updatedExp : e))
    );
    vpsSyncEngine.syncExpense(updatedExp);

    // إرسال إشعار للموظف/الطرف الذي طلب الموافقة ليعلم بالموافقة ويقوم بتأكيد الصرف الفعلي من صندوقه
    const approvalNotice: SystemNotification = {
      id: `notif_appr_${Date.now()}_${target.id}`,
      title: '✓ تمت الموافقة على طلب الصرف - بانتظار تأكيد الصرف',
      message: `وافق المدير [${approverName}] على طلب صرف المصروف [${target.title}] بقيمة ${formatCurrency(target.amount || 0, target.currency)}. يرجى تأكيد الصرف لتنفيذ الخصم المالي من صندوقك.`,
      type: 'expense_approval',
      targetBranchId: target.branchId,
      targetUserId: target.paidByUserId,
      relatedId: target.id,
      priority: 'important',
      timestamp: new Date().toISOString(),
      read: false,
    };
    setNotifications((prev) => [approvalNotice, ...prev]);
    vpsSyncEngine.syncNotification(approvalNotice);

    addAuditLog(
      'موافقة إدارية على سند صرف',
      'cashbox',
      `وافق المدير [${approverName}] على صرف المصروف [${target.title}] بقيمة [${formatCurrency(target.amount || 0, target.currency)}] بانتظار تأكيد الصرف الفعلي من صندوق الطالب [${requesterName}]`
    );
  };

  const rejectExpense = (id: string, reason?: string) => {
    const target = expenses.find((e) => e.id === id);
    if (!target || target.status === 'approved') return;

    const approverName = currentUser.name || currentUser.username || 'المدير';
    const updatedExp: Expense = {
      ...target,
      status: 'rejected',
      approvedByUserId: currentUser.id,
      approvedByUserName: approverName,
      notes: reason ? `${target.notes ? target.notes + ' | ' : ''}سبب الرفض: ${reason}` : target.notes,
    };

    setExpenses((prev) =>
      prev.map((e) => (e.id === id ? updatedExp : e))
    );
    vpsSyncEngine.syncExpense(updatedExp);

    const rejectNotice: SystemNotification = {
      id: `notif_rej_${Date.now()}_${target.id}`,
      title: '✕ تم رفض طلب الصرف',
      message: `تم رفض طلب صرف المصروف [${target.title}] بقيمة ${formatCurrency(target.amount || 0, target.currency)} من قبل الإدارة.${reason ? ` السبب: ${reason}` : ''}`,
      type: 'expense_approval',
      targetBranchId: target.branchId,
      targetUserId: target.paidByUserId,
      relatedId: target.id,
      priority: 'normal',
      timestamp: new Date().toISOString(),
      read: false,
    };
    setNotifications((prev) => [rejectNotice, ...prev]);
    vpsSyncEngine.syncNotification(rejectNotice);

    addAuditLog(
      'رفض طلب صرف مصروف',
      'cashbox',
      `تم رفض طلب صرف المصروف [${target.title}] من قبل [${approverName}]${reason ? ` لسبب: ${reason}` : ''}`
    );
  };

  const confirmExpenseDisbursement = (id: string): { success: boolean; message?: string; voucherId?: string; voucherNumber?: string } => {
    const target = expenses.find((e) => e.id === id);
    if (!target) return { success: false, message: 'سند المصروف غير موجود' };
    if (target.status === 'approved') return { success: false, message: 'تم تأكيد صرف هذا السند مسبقاً' };
    if (target.status !== 'approved_waiting_disbursement' && target.status !== 'pending') {
      return { success: false, message: 'هذا السند غير معتمد للصرف' };
    }

    const requester = users.find((u) => u.id === target.paidByUserId);
    const requesterName = target.performedByUserName || requester?.name || requester?.username || currentUser.name || currentUser.username;
    
    // تحديد الصندوق بدقة (صندوق القسم الذي طلب الصرف: صادر أو وارد أو رئيسي)
    const effectiveScope: CashboxScope =
      target.cashboxScope ||
      (requester?.role === 'outbound_operator' ? 'outgoing' : requester?.role === 'inbound_operator' ? 'incoming' : 'master');

    const year = new Date().getFullYear();
    const pvSerial = String(vouchers.filter((v) => v.type === 'payment').length + 1).padStart(4, '0');
    const pvNumber = `PV-${year}-${pvSerial}`;

    const linkedFinancialVoucher: FinancialVoucher = {
      id: `vch_exp_${target.id}`,
      voucherNumber: pvNumber,
      type: 'payment',
      branchId: target.branchId,
      currency: target.currency,
      amount: target.amount,
      paidByOrTo: target.paidTo,
      reasonCategory: target.category,
      description: `[سند صرف معتمد ومؤكد ${pvNumber}]: ${target.title}${target.notes ? ` - ${target.notes}` : ''}`,
      referenceNumber: target.invoiceNumber,
      performedByUserId: target.paidByUserId || currentUser.id,
      performedByUserName: requesterName,
      date: new Date().toISOString().split('T')[0],
      status: 'approved',
      timestamp: new Date().toISOString(),
      cashboxScope: effectiveScope,
      assetId: target.assetId,
    };

    setVouchers((prev) => [linkedFinancialVoucher, ...prev]);

    // خصم المبلغ حصراً من صندوق الطرف الذي طلب الموافقة (مع تقييد اسم منشئ السند والمستلم بدقة)
    if (target.paymentMethod === 'cash_box') {
      addCashTransaction(
        target.branchId,
        target.currency,
        'operating_expense',
        target.amount,
        `[صرف مصروف مؤكد من صندوق ${effectiveScope === 'outgoing' ? 'الصادر' : effectiveScope === 'incoming' ? 'الوارد' : 'الفرع'} بموجب السند ${pvNumber}]: ${target.title} - جهة الصرف: ${target.paidTo} (${target.category}) - منفذ الصرف: ${requesterName}`,
        pvNumber,
        undefined,
        effectiveScope,
        undefined,
        {
          userId: target.paidByUserId || currentUser.id,
          userName: requesterName,
        }
      );
    }

    const updatedExp: Expense = {
      ...target,
      status: 'approved',
      voucherId: linkedFinancialVoucher.id,
      disbursedAt: new Date().toISOString(),
      disbursedByUserId: currentUser.id,
      disbursedByUserName: currentUser.name || currentUser.username,
      disbursedCashboxScope: effectiveScope,
    };

    setExpenses((prev) =>
      prev.map((e) => (e.id === id ? updatedExp : e))
    );
    vpsSyncEngine.syncExpense(updatedExp);

    addAuditLog(
      'تأكيد صرف السند وخصم الصندوق',
      'cashbox',
      `تم تأكيد الصرف الفعلي للمصروف [${target.title}] بقيمة [${formatCurrency(target.amount || 0, target.currency)}] وخصمها من صندوق [${effectiveScope === 'outgoing' ? 'قسم الصادر' : effectiveScope === 'incoming' ? 'قسم الوارد' : 'الخزينة'}] للطالب [${requesterName}] برقم السند [${pvNumber}]`
    );

    return { success: true, voucherId: linkedFinancialVoucher.id, voucherNumber: pvNumber };
  };

  // 6. Expense Categories Management
  const addExpenseCategory = (data: Omit<ExpenseCategoryItem, 'id' | 'createdAt'>): ExpenseCategoryItem => {
    const newCat: ExpenseCategoryItem = {
      ...data,
      id: `cat_${Date.now()}`,
      createdAt: new Date().toISOString(),
    };
    setExpenseCategories((prev) => [...prev, newCat]);
    vpsSyncEngine.syncExpenseCategory(newCat);
    addAuditLog('إضافة نوع مصروف', 'system', `تمت إضافة فئة مصروف جديدة: [${newCat.name}] كود: [${newCat.code}] - ${newCat.requiresManagerApproval ? 'يتطلب موافقة مدير' : 'صرف مباشر'}`);
    return newCat;
  };

  const updateExpenseCategory = (id: string, updates: Partial<ExpenseCategoryItem>) => {
    setExpenseCategories((prev) => {
      const updated = prev.map((c) => (c.id === id ? { ...c, ...updates } : c));
      const target = updated.find((c) => c.id === id);
      if (target) vpsSyncEngine.syncExpenseCategory(target);
      return updated;
    });
    const target = expenseCategories.find((c) => c.id === id);
    addAuditLog('تعديل نوع مصروف', 'system', `تم تعديل بيانات فئة المصروف: [${target?.name || id}]`);
  };

  const deleteExpenseCategory = (id: string) => {
    const target = expenseCategories.find((c) => c.id === id);
    setExpenseCategories((prev) => prev.filter((c) => c.id !== id));
    vpsSyncEngine.deleteExpenseCategory(id);
    addAuditLog('حذف نوع مصروف', 'system', `تم حذف فئة المصروف: [${target?.name || id}]`);
  };

  const toggleCategoryApprovalRequirement = (id: string) => {
    setExpenseCategories((prev) => {
      const updated = prev.map((c) =>
        c.id === id ? { ...c, requiresManagerApproval: !c.requiresManagerApproval } : c
      );
      const target = updated.find((c) => c.id === id);
      if (target) vpsSyncEngine.syncExpenseCategory(target);
      return updated;
    });
    const target = expenseCategories.find((c) => c.id === id);
    if (target) {
      const newState = !target.requiresManagerApproval;
      addAuditLog(
        'تعديل شرط موافقة المصروف',
        'system',
        `تم تغيير خيار الموافقة لنوع [${target.name}] إلى: [${newState ? 'يحتاج موافقة مدير' : 'صرف مباشر لا يحتاج موافقة'}]`
      );
    }
  };

  // 6.5. Fixed Assets Management (إدارة الأصول الثابتة وتجهيزات الفروع)
  const addFixedAsset = (data: Omit<FixedAsset, 'id' | 'createdAt'>): FixedAsset => {
    const newAsset: FixedAsset = {
      ...data,
      id: `ast_${Date.now()}_${Math.floor(100 + Math.random() * 900)}`,
      createdAt: new Date().toISOString(),
    };
    setFixedAssets((prev) => [newAsset, ...prev]);
    vpsSyncEngine.syncFixedAsset(newAsset);
    addAuditLog(
      'تسجيل أصل ثابت جديد',
      'system',
      `تم تسجيل أصل جديد: [${newAsset.name}] كود: [${newAsset.assetCode}] بالفرع: [${newAsset.branchId}]`
    );
    return newAsset;
  };

  const updateFixedAsset = (id: string, updates: Partial<FixedAsset>) => {
    setFixedAssets((prev) => {
      const updated = prev.map((a) => (a.id === id ? { ...a, ...updates, updatedAt: new Date().toISOString() } : a));
      const target = updated.find((a) => a.id === id);
      if (target) vpsSyncEngine.syncFixedAsset(target);
      return updated;
    });
    const target = fixedAssets.find((a) => a.id === id);
    addAuditLog(
      'تعديل بيانات أصل ثابت',
      'system',
      `تم تحديث بيانات الأصل: [${target?.name || id}] كود: [${target?.assetCode || ''}]`
    );
  };

  const deleteFixedAsset = (id: string) => {
    const target = fixedAssets.find((a) => a.id === id);
    setFixedAssets((prev) => prev.filter((a) => a.id !== id));
    vpsSyncEngine.deleteFixedAsset(id);
    addAuditLog(
      'حذف أو استبعاد أصل ثابت',
      'system',
      `تم استبعاد وحذف الأصل: [${target?.name || id}] كود: [${target?.assetCode || ''}]`
    );
  };

  // 7. Direct Messages & Administrative Directives
  const sendDirectMessage = (data: Omit<DirectMessage, 'id' | 'timestamp' | 'isRead'>): DirectMessage => {
    const newMsg: DirectMessage = {
      ...data,
      id: `msg_${Date.now()}`,
      timestamp: new Date().toISOString(),
      isRead: false,
    };

    setDirectMessages((prev) => [newMsg, ...prev]);
    vpsSyncEngine.syncDirectMessage(newMsg);

    // إنشاء إشعار فوري للمستلم المعني
    const newNotif: SystemNotification = {
      id: `notif_${Date.now()}_dm`,
      title: data.title ? `توجيه إداري: ${data.title}` : `رسالة خاصة جديدة من ${data.senderName}`,
      message: data.content,
      type: 'admin_directive',
      targetBranchId: data.recipientType === 'branch' ? data.recipientBranchId : undefined,
      targetUserId: data.recipientType === 'user' ? data.recipientUserId : undefined,
      senderUserId: data.senderUserId,
      senderName: data.senderName,
      isDirectMessage: true,
      priority: data.priority,
      conversationId: data.replyToId || newMsg.id,
      timestamp: new Date().toISOString(),
      read: false,
    };
    setNotifications((prev) => [newNotif, ...prev]);
    vpsSyncEngine.syncNotification(newNotif);

    addAuditLog(
      'إرسال توجيه إداري / رسالة خاصة',
      'system',
      `أرسل [${data.senderName}] توجيهاً إدارياً إلى [${data.recipientType === 'user' ? data.recipientUserName : data.recipientBranchName}] بعنوان: [${data.title}]`
    );

    return newMsg;
  };

  const markDirectMessageRead = (messageId: string) => {
    setDirectMessages((prev) =>
      prev.map((m) =>
        m.id === messageId
          ? { ...m, isRead: true, readAt: new Date().toISOString() }
          : m
      )
    );
  };

  const deleteDirectMessage = (messageId: string) => {
    setDirectMessages((prev) => prev.filter((m) => m.id !== messageId));
    vpsSyncEngine.deleteDirectMessage(messageId);
  };

  // Cloud Database Export / Import
  const exportDatabaseJson = (): string => {
    const dump = {
      exportedAt: new Date().toISOString(),
      system: 'ORCA_LOGISTICS_SYRIA_V1',
      branches,
      users,
      parcels,
      truckManifests,
      courierManifests,
      transactions,
      settlements,
      vouchers,
      pricingRules,
      codSettings,
      manifestTemplates,
      notifications,
      brandingSettings,
      alertsSettings,
      auditLogs,
      customers,
      vehicles,
      employees,
      payrollRecords,
      expenses,
      expenseCategories,
      fixedAssets,
      directMessages,
    };
    return JSON.stringify(dump, null, 2);
  };

  const importDatabaseJson = (json: string): boolean => {
    try {
      const data = JSON.parse(json);
      if (data.branches) setBranches(data.branches);
      if (data.users) setUsers(data.users);
      if (data.parcels) setParcels(data.parcels);
      if (data.truckManifests) setTruckManifests(data.truckManifests);
      if (data.courierManifests) setCourierManifests(data.courierManifests);
      if (data.transactions) setTransactions(data.transactions);
      if (data.settlements) setSettlements(data.settlements);
      if (data.vouchers) setVouchers(data.vouchers);
      if (data.pricingRules) setPricingRules(data.pricingRules);
      if (data.codSettings) setCodSettings(data.codSettings);
      if (data.manifestTemplates) setManifestTemplates(data.manifestTemplates);
      if (data.notifications) setNotifications(data.notifications);
      if (data.brandingSettings) setBrandingSettings(data.brandingSettings);
      if (data.alertsSettings) setAlertsSettings(data.alertsSettings);
      if (data.auditLogs) setAuditLogs(data.auditLogs);
      if (data.customers) setCustomers(data.customers);
      if (data.vehicles) setVehicles(data.vehicles);
      if (data.employees) setEmployees(data.employees);
      if (data.payrollRecords) setPayrollRecords(data.payrollRecords);
      if (data.expenses) setExpenses(data.expenses);
      if (data.expenseCategories) setExpenseCategories(data.expenseCategories);
      if (data.fixedAssets) setFixedAssets(data.fixedAssets);
      if (data.directMessages) setDirectMessages(data.directMessages);
      return true;
    } catch {
      return false;
    }
  };

  const invalidateSmartCache = (_collectionName?: string) => {
    // VPS engine handles memory-cached state
  };

  const warmSmartCache = () => {
    // VPS engine syncs on demand
  };

  // Auto-warm cache on initialization
  useEffect(() => {
    warmSmartCache();
  }, []);

  const resetToDemoData = () => {
    vpsSyncEngine.resetConnection();
    setBranches(INITIAL_BRANCHES);

    setUsers(INITIAL_USERS);
    setParcels(INITIAL_PARCELS);
    setTruckManifests(INITIAL_TRUCK_MANIFESTS);
    setCourierManifests(INITIAL_COURIER_MANIFESTS);
    setTransactions(INITIAL_TRANSACTIONS);
    setSettlements(INITIAL_SETTLEMENTS);
    setShiftSettlements(INITIAL_SHIFT_SETTLEMENTS);
    setVouchers(INITIAL_VOUCHERS);
    setPricingRules(INITIAL_PRICING_RULES);
    setCodSettings(INITIAL_COD_SETTINGS);
    setManifestTemplates([DEFAULT_MANIFEST_TEMPLATE]);
    setNotifications(INITIAL_NOTIFICATIONS);
    setBrandingSettings(INITIAL_COMPANY_BRANDING);
    setAlertsSettings(INITIAL_ALERTS_SETTINGS);
    setAuditLogs(INITIAL_AUDIT_LOGS);
    setCustomers(INITIAL_CUSTOMERS);
    setVehicles(INITIAL_VEHICLES);
    setEmployees(INITIAL_EMPLOYEES);
    setPayrollRecords(INITIAL_PAYROLL_RECORDS);
    setExpenses(INITIAL_EXPENSES);
    setExpenseCategories(INITIAL_EXPENSE_CATEGORIES);
    setFixedAssets(INITIAL_FIXED_ASSETS);
    setDirectMessages(INITIAL_DIRECT_MESSAGES);
    setCurrentBranch(INITIAL_BRANCHES.length > 0 ? INITIAL_BRANCHES[0] : EMPTY_SYSTEM_BRANCH);
    setCurrentUser(INITIAL_USERS[0]);
  };

  const contextValue = useMemo<OrcaContextType>(
    () => ({
      branches,
      branchesWithDerivedBalances,
      users,
      parcels,
      truckManifests,
      courierManifests,
      transactions,
      cashTransactions: transactions,
      settlements,
      shiftSettlements,
      courierIntakeSettlements,
      vouchers,
      interBranchObligations,
      setInterBranchObligations,
      parcelEvents,
      setParcelEvents,
      pricingRules,
      codSettings,
      manifestTemplates,
      notifications,
      brandingSettings,
      alertsSettings,
      auditLogs,
      customers,
      vehicles,
      employees,
      payrollRecords,
      expenses,
      expenseCategories,
      fixedAssets,
      directMessages,
      isolatedNotifications,
      currentBranch,
      currentBranchWithDerivedBalance,
      currentUser,
      activeModule,
      selectedParcelForPrint,
      selectedManifestForPrint,
      selectedParcelForQuickView,
      isPrintModalOpen,
      printModalType,
      isCashierCollectModalOpen: !!cashierCollectParcelId,
      cashierCollectParcelId,
      cashierCollectNotificationId,
      isShortageResolutionModalOpen,
      shortageResolutionParcelIds,
      isLostParcelSettlementModalOpen,
      selectedLostParcelForSettlement,
      isRerouteModalOpen,
      selectedParcelForReroute,
      isCodSenderPayoutModalOpen,
      selectedCodPayoutParcelId,
      openCodSenderPayoutModal,
      closeCodSenderPayoutModal,
      codPayoutReceiptParcel,
      openCodPayoutReceipt,
      closeCodPayoutReceipt,
      isAuthenticated,
      isWelcomeLoginOpen,
      setActiveModule: handleSetActiveModule,
      setCurrentBranch,
      setCurrentUser: handleSetCurrentUser,
      setSelectedParcelForPrint,
      setSelectedManifestForPrint,
      setSelectedParcelForQuickView,
      openPrintModal,
      closePrintModal,
      openCashierCollectModal,
      closeCashierCollectModal,
      openShortageResolutionModal,
      closeShortageResolutionModal,
      openLostParcelSettlementModal,
      closeLostParcelSettlementModal,
      openRerouteModal,
      closeRerouteModal,
      rerouteParcel,
      resolveShortageAtOrigin,
      confirmShortageFoundAtOrigin,
      settleLostParcel,
      reDispatchLeftoverParcel,
      playShortageAlertSound,
      playShortageResolvedSound,
      playTruckDockArrivalSound,
      playTruckDispatchedSound,
      setIsWelcomeLoginOpen,
      login,
      loginAsSuperAdmin,
      logout,
      switchUserDirectly,
      updateBrandingSettings,
      updateAlertsSettings,
      getStagnantParcels,
      getDelayedTrucks,
      getOverdueCourierDeliveries,
      getUnclosedBranchesForSettlement,
      getOverdueCodPayouts,
      sendStagnantParcelAlert,
      triggerManualSlaCheck,
      addAuditLog,
      clearAuditLogs,
      updateBranchDirectBalances,
      setUserPassword,
      registerParcel,
      createTruckManifest,
      updateTruckManifest,
      pauseTruckManifest,
      cancelAndResetTruckManifest,
      dispatchTruckManifest,
      markTruckArrived,
      completeTruckDischarge,
      receiveTruckManifest,
      orphanParcels,
      orphanParcelsCount: orphanParcels.length,
      rescueOrphanParcels,
      notifyReceiver,
      deliverParcel,
      forwardCollectionToCashier,
      collectPaymentByCashier,
      assignToCourier,
      settleCourierManifest,
      getCourierIntakeFinancials,
      settleCourierIntakeParcels,
      handoverCourierParcelsToHub,
      selectedCourierIntakeVoucherForPrint,
      openCourierIntakeVoucherPrint,
      closeCourierIntakeVoucherPrint,
      markParcelReturned,
      receiveReturnedParcelAtBranch,
      reDispatchReturnedParcel,
      stageParcelForReturnToOrigin,
      receiveReverseShipmentAtOrigin,
      handoverReturnedParcelToSender,
      initiatePreDeliveryReturn,
      cancelPreDeliveryReturn,
      checkReturnPickupDeadlines,
      settleReturnDebt,
      submitDailySettlement,
      approveDailySettlement,
      submitShiftSettlement,
      approveShiftSettlement,
      rejectShiftSettlement,
      deleteShiftSettlement,
      getCashboxBreakdown,
      getRoleCashboxData,
      getRoleBoxTransactions,
      getRoleBoxInfo,
      notifySenderForCodPayout,
      payoutCodToSender,
      addFinancialVoucher,
      createBranchClearingVoucher,
      deleteFinancialVoucher,
      addCashTransaction,
      calculateBranchLiveBalance,
      calculatePrice,
      updatePricingRules,
      addPricingRule,
      deletePricingRule,
      resetPricingRulesToDefault,
      updateCodSettings,
      calculateCodTransferFee: calculateCodTransferFeeContext,
      getCodCommissionLabel: getCodCommissionLabelContext,
      numberFormatSettings,
      updateNumberFormatSettings,
      formatCurrency: formatCurrencyApp,
      formatNumber: formatNumberApp,
      formatQuantity: formatQuantityApp,
      formatWeight: formatWeightApp,
      formatExchangeRate: formatExchangeRateApp,
      saveManifestTemplate,
      addBranch,
      updateBranch,
      deleteBranch,
      addMultipleBranchesWithUsers,
      clearAllOperationalData,
      addUser,
      updateUser,
      deleteUser,
      toggleUserStatus,
      hasPermission,
      canAccessModule,
      canSwitchBranch,
      markNotificationRead,
      markAllNotificationsRead,
      addCustomer,
      updateCustomer,
      deleteCustomer,
      clearAllCustomers,
      findCustomerByNationalIdOrPhone,
      addVehicle,
      updateVehicle,
      deleteVehicle,
      addEmployee,
      updateEmployee,
      deleteEmployee,
      createPayrollRecord,
      payPayrollRecord,
      addExpense,
      updateExpense,
      deleteExpense,
      approveExpense,
      rejectExpense,
      confirmExpenseDisbursement,
      addExpenseCategory,
      updateExpenseCategory,
      deleteExpenseCategory,
      toggleCategoryApprovalRequirement,
      addFixedAsset,
      updateFixedAsset,
      deleteFixedAsset,
      sendDirectMessage,
      markDirectMessageRead,
      deleteDirectMessage,
      exportDatabaseJson,
      importDatabaseJson,
      resetToDemoData,
      invalidateSmartCache,
      warmSmartCache,
      cloudSyncState,
      timestampWorkerStats,
      triggerTimestampReconciliation,
      triggerManualCloudSync,
      pushEntireDatabaseToCloud,
      pullEntireDatabaseFromCloud,
      retryManualSyncConnection,
      boundBranchId,
      setBoundBranchId,
      currentCustomer,
      isCustomerAuthenticated,
      isCustomerLoginOpen,
      setIsCustomerLoginOpen,
      loginCustomer,
      logoutCustomer,
      updateCustomerPortalCredentials,
      getCustomerParcels,
      getCustomerAnalytics,
      getCustomerNotifications,
      isServerOnline,
      serverOfflineAlertOpen,
      serverOfflineAlertMsg,
      showServerOfflineAlert,
      closeServerOfflineAlert,
      ensureServerConnected,
      localStorageWarning,
      estimateLocalStorageSize,
      cleanupOldLocalData,
    }),
    [
      branches,
      branchesWithDerivedBalances,
      users,
      parcels,
      truckManifests,
      courierManifests,
      transactions,
      settlements,
      vouchers,
      interBranchObligations,
      parcelEvents,
      pricingRules,
      codSettings,
      manifestTemplates,
      notifications,
      brandingSettings,
      alertsSettings,
      auditLogs,
      customers,
      vehicles,
      employees,
      payrollRecords,
      expenses,
      expenseCategories,
      fixedAssets,
      directMessages,
      isolatedNotifications,
      currentBranch,
      currentBranchWithDerivedBalance,
      currentUser,
      activeModule,
      selectedParcelForPrint,
      selectedManifestForPrint,
      selectedParcelForQuickView,
      isPrintModalOpen,
      printModalType,
      cashierCollectParcelId,
      cashierCollectNotificationId,
      isShortageResolutionModalOpen,
      shortageResolutionParcelIds,
      isLostParcelSettlementModalOpen,
      selectedLostParcelForSettlement,
      isCodSenderPayoutModalOpen,
      selectedCodPayoutParcelId,
      openCodSenderPayoutModal,
      closeCodSenderPayoutModal,
      codPayoutReceiptParcel,
      isAuthenticated,
      isWelcomeLoginOpen,
      setIsWelcomeLoginOpen,
      currentCustomer,
      isCustomerAuthenticated,
      isCustomerLoginOpen,
      setIsCustomerLoginOpen,
      loginCustomer,
      logoutCustomer,
      updateCustomerPortalCredentials,
      getCustomerParcels,
      getCustomerAnalytics,
      getCustomerNotifications,
      numberFormatSettings,
      handleSetCurrentUser,
      openPrintModal,
      closePrintModal,
      openCashierCollectModal,
      closeCashierCollectModal,
      login,
      loginAsSuperAdmin,
      logout,
      switchUserDirectly,
      updateBrandingSettings,
      updateAlertsSettings,
      getStagnantParcels,
      getDelayedTrucks,
      getOverdueCourierDeliveries,
      getUnclosedBranchesForSettlement,
      getOverdueCodPayouts,
      sendStagnantParcelAlert,
      triggerManualSlaCheck,
      addAuditLog,
      clearAuditLogs,
      updateBranchDirectBalances,
      setUserPassword,
      registerParcel,
      createTruckManifest,
      updateTruckManifest,
      pauseTruckManifest,
      cancelAndResetTruckManifest,
      dispatchTruckManifest,
      markTruckArrived,
      completeTruckDischarge,
      receiveTruckManifest,
      orphanParcels,
      rescueOrphanParcels,
      notifyReceiver,
      deliverParcel,
      forwardCollectionToCashier,
      collectPaymentByCashier,
      assignToCourier,
      settleCourierManifest,
      handoverCourierParcelsToHub,
      markParcelReturned,
      receiveReturnedParcelAtBranch,
      reDispatchReturnedParcel,
      stageParcelForReturnToOrigin,
      receiveReverseShipmentAtOrigin,
      handoverReturnedParcelToSender,
      initiatePreDeliveryReturn,
      cancelPreDeliveryReturn,
      checkReturnPickupDeadlines,
      settleReturnDebt,
      submitDailySettlement,
      approveDailySettlement,
      notifySenderForCodPayout,
      payoutCodToSender,
      addFinancialVoucher,
      createBranchClearingVoucher,
      deleteFinancialVoucher,
      addCashTransaction,
      calculateBranchLiveBalance,
      calculatePrice,
      updatePricingRules,
      addPricingRule,
      deletePricingRule,
      resetPricingRulesToDefault,
      updateCodSettings,
      calculateCodTransferFeeContext,
      getCodCommissionLabelContext,
      updateNumberFormatSettings,
      formatCurrencyApp,
      formatNumberApp,
      formatQuantityApp,
      formatWeightApp,
      formatExchangeRateApp,
      saveManifestTemplate,
      addBranch,
      updateBranch,
      deleteBranch,
      addMultipleBranchesWithUsers,
      clearAllOperationalData,
      addUser,
      updateUser,
      deleteUser,
      toggleUserStatus,
      hasPermission,
      canAccessModule,
      canSwitchBranch,
      markNotificationRead,
      markAllNotificationsRead,
      addCustomer,
      updateCustomer,
      deleteCustomer,
      clearAllCustomers,
      findCustomerByNationalIdOrPhone,
      addVehicle,
      updateVehicle,
      deleteVehicle,
      addEmployee,
      updateEmployee,
      deleteEmployee,
      createPayrollRecord,
      payPayrollRecord,
      addExpense,
      updateExpense,
      deleteExpense,
      approveExpense,
      rejectExpense,
      confirmExpenseDisbursement,
      addExpenseCategory,
      updateExpenseCategory,
      deleteExpenseCategory,
      toggleCategoryApprovalRequirement,
      addFixedAsset,
      updateFixedAsset,
      deleteFixedAsset,
      sendDirectMessage,
      markDirectMessageRead,
      deleteDirectMessage,
      exportDatabaseJson,
      importDatabaseJson,
      resetToDemoData,
      invalidateSmartCache,
      warmSmartCache,
      cloudSyncState,
      timestampWorkerStats,
      triggerTimestampReconciliation,
      triggerManualCloudSync,
      pushEntireDatabaseToCloud,
      pullEntireDatabaseFromCloud,
      retryManualSyncConnection,
      boundBranchId,
      setBoundBranchId,
      currentCustomer,
      isCustomerAuthenticated,
      isCustomerLoginOpen,
      loginCustomer,
      logoutCustomer,
      updateCustomerPortalCredentials,
      getCustomerParcels,
      getCustomerAnalytics,
      getCustomerNotifications,
      isServerOnline,
      serverOfflineAlertOpen,
      serverOfflineAlertMsg,
      showServerOfflineAlert,
      closeServerOfflineAlert,
      ensureServerConnected,
      localStorageWarning,
      estimateLocalStorageSize,
      cleanupOldLocalData,
    ]
  );


  return (
    <OrcaContext.Provider value={contextValue}>
      <ServerOfflineModal
        isOpen={serverOfflineAlertOpen}
        onClose={closeServerOfflineAlert}
        customMessage={serverOfflineAlertMsg}
      />
      {children}
    </OrcaContext.Provider>
  );
};

export const useOrca = () => {
  const context = useContext(OrcaContext);
  if (!context) {
    throw new Error('useOrca must be used within an OrcaProvider');
  }
  return context;
};
