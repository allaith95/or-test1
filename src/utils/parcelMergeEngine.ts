/**
 * Parcel Merge Engine (Phase 5-A: Conflict Resolution & Monotonic Parcel Merging)
 * 
 * Provides deterministic, conflict-free state progression and field-level merging
 * for parcels across distributed multi-branch operations, offline workers, and concurrent clients.
 * Protects financial settlements, monotonic booleans, and lifecycle progression from LWW overwrites.
 */

// Canonical Progression Ranks for Multi-Branch State Reconciliation
export const HANDLING_RANK: Record<string, number> = {
  received_at_hub: 10,
  received_at_origin_hub: 20,
  leftover_origin_warehouse: 25,
  loaded_in_truck: 30,
  in_transit: 40,
  shortage_missing: 45,
  lost_in_transit: 48,
  received_at_dest: 50,
  with_courier: 60,
  out_for_delivery: 60,
  delivered_uncollected: 70,
  return_initiated: 85,
  returned: 90,
  returned_received_at_branch: 95,
  returning_to_origin: 96,
  returned_to_origin: 97,
  rerouted_forwarded: 97,
  delivered: 98,
  returned_to_sender: 100,
  settled_loss_compensated: 100,
};

export const COD_STATUS_RANK: Record<string, number> = {
  pending_collection: 0,
  collected_awaiting_sender_payout: 10,
  sender_notified: 20,
  paid_to_sender: 30,
};

export const COD_PAYOUT_STATUS_RANK: Record<string, number> = {
  pending_collection: 0,
  collected_ready: 10,
  paid_to_sender: 20,
};

export const SHORTAGE_STATUS_RANK: Record<string, number> = {
  none: 0,
  pending_origin_verification: 10,
  confirmed_at_origin: 20,
  confirmed_lost_in_transit: 30,
  settled_loss: 40,
};

export function getHandlingStatusRank(s: string | undefined): number {
  if (!s) return 0;
  return HANDLING_RANK[s] ?? 0;
}

export function getCodStatusRank(s: string | undefined): number {
  if (!s) return 0;
  return COD_STATUS_RANK[s] ?? 0;
}

export function getCodPayoutStatusRank(s: string | undefined): number {
  if (!s) return 0;
  return COD_PAYOUT_STATUS_RANK[s] ?? 0;
}

export function getShortageStatusRank(s: string | undefined): number {
  if (!s) return 0;
  return SHORTAGE_STATUS_RANK[s] ?? 0;
}

/**
 * Merges an incoming parcel update into an existing parcel record without rolling back
 * its progress status, location, or financial records due to stale network packets or LWW races.
 */
export function mergeParcelSafely(existing: any, incoming: any): any {
  if (!existing || typeof existing !== 'object') return incoming;
  if (!incoming || typeof incoming !== 'object') return existing;

  const merged = { ...existing, ...incoming };

  // 1. Monotonic booleans (never revert to false once true)
  const monotonicBooleans = [
    'codPaidToSender',
    'cashierCollected',
    'cashierForwarded',
    'codSenderNotified',
    'courierHandedOverToHub',
    'courierIntakeSettled',
    'isCodCollectedByCashier',
    'courierIntakeReceivedInHub',
    'isRerouted',
    'isRecoveredFromPreviousShortage',
    'isVerified',
  ];
  for (const key of monotonicBooleans) {
    merged[key] = Boolean(existing[key]) || Boolean(incoming[key]);
  }

  // 2. Monotonic timestamps (never clear once set)
  const monotonicTimestamps = [
    'createdAt',
    'arrivedAtDestAt',
    'deliveredAt',
    'codCollectedAt',
    'codSenderPayoutDate',
    'cashierCollectedAt',
    'cashierForwardedAt',
    'shortageReportedAt',
    'shortageResolvedAt',
    'reroutedAt',
    'courierHandoverTimestamp',
    'courierIntakeSettledAt',
    'notifiedAt',
    'codSenderNotifiedAt',
    'courierIntakeReceivedAt',
  ];
  for (const key of monotonicTimestamps) {
    merged[key] = existing[key] || incoming[key];
  }

  // 3. Monotonic Vouchers & Attribution (User IDs & Voucher numbers)
  const monotonicVouchersAndActors = [
    'codSenderPayoutVoucherId',
    'codSenderPayoutVoucherNumber',
    'codSenderPayoutByUserId',
    'codSenderPayoutByUserName',
    'deliveredByUserId',
    'cashierCollectedByUserId',
    'cashierCollectedByUserName',
    'courierIntakeSettledVoucherId',
    'courierIntakeSettledVoucherNumber',
    'shortageResolvedByUserId',
    'shortageResolvedByUserName',
  ];
  for (const key of monotonicVouchersAndActors) {
    merged[key] = existing[key] || incoming[key];
  }

  // 4. handlingStatus: pick higher rank with courier intake handover exception
  const existingHandlingRank = getHandlingStatusRank(existing.handlingStatus);
  const incomingHandlingRank = getHandlingStatusRank(incoming.handlingStatus);

  // Exception: Courier intake handover (with_courier → received_at_hub)
  // ONLY when courierHandedOverToHub === true.
  if (
    incoming.handlingStatus === 'received_at_hub' &&
    existing.handlingStatus === 'with_courier' &&
    incoming.courierHandedOverToHub === true
  ) {
    merged.handlingStatus = 'received_at_hub';
    merged.currentLocationBranchId =
      incoming.currentLocationBranchId || existing.currentLocationBranchId;
    // Skip normal rank comparison for this field
  } else if (
    existing.handlingStatus === 'received_at_hub' &&
    incoming.handlingStatus === 'with_courier' &&
    existing.courierHandedOverToHub === true
  ) {
    merged.handlingStatus = 'received_at_hub';
    merged.currentLocationBranchId =
      existing.currentLocationBranchId || incoming.currentLocationBranchId;
    // Protect already-handed-over parcel from being rolled back by stale with_courier packet
  } else {
    // Normal rank-based merge (as currently implemented)
    if (existingHandlingRank > incomingHandlingRank) {
      merged.handlingStatus = existing.handlingStatus;
      merged.currentLocationBranchId = existing.currentLocationBranchId || incoming.currentLocationBranchId;
      merged.storedWarehouseType = existing.storedWarehouseType || incoming.storedWarehouseType;
    } else {
      merged.handlingStatus = incoming.handlingStatus || existing.handlingStatus;
    }
  }

  // Destination protection: If parcel reached received_at_dest (rank 50), protect from rollback to origin/transit
  if (existing.handlingStatus === 'received_at_dest' && incomingHandlingRank < 50) {
    merged.handlingStatus = 'received_at_dest';
    merged.currentLocationBranchId = existing.currentLocationBranchId;
  }

  // ⚡ Recovery Exception: allow downgrade when recovering from lost/shortage state with explicit flag.
  if (incoming.isRecoveredFromPreviousShortage === true &&
      (existing.handlingStatus === 'lost_in_transit' || existing.handlingStatus === 'shortage_missing')) {
    merged.handlingStatus = incoming.handlingStatus;
    merged.currentLocationBranchId = incoming.currentLocationBranchId || existing.currentLocationBranchId;
    merged.storedWarehouseType = incoming.storedWarehouseType || existing.storedWarehouseType;
    merged.shortageStatus = incoming.shortageStatus || existing.shortageStatus;
  }

  // Preserve critical discharge metadata
  if (existing.arrivedAtDestAt && !incoming.arrivedAtDestAt) {
    merged.arrivedAtDestAt = existing.arrivedAtDestAt;
  }
  if (existing.storedWarehouseType && !incoming.storedWarehouseType) {
    merged.storedWarehouseType = existing.storedWarehouseType;
  }

  // 5. codStatus: pick higher rank
  const existingCodRank = getCodStatusRank(existing.codStatus);
  const incomingCodRank = getCodStatusRank(incoming.codStatus);
  merged.codStatus = existingCodRank > incomingCodRank ? existing.codStatus : (incoming.codStatus || existing.codStatus);

  // 6. codPayoutStatus: pick higher rank
  const existingPayoutRank = getCodPayoutStatusRank(existing.codPayoutStatus);
  const incomingPayoutRank = getCodPayoutStatusRank(incoming.codPayoutStatus);
  merged.codPayoutStatus = existingPayoutRank > incomingPayoutRank ? existing.codPayoutStatus : (incoming.codPayoutStatus || existing.codPayoutStatus);

  // 7. shortageStatus: pick higher rank
  const existingShortageRank = getShortageStatusRank(existing.shortageStatus);
  const incomingShortageRank = getShortageStatusRank(incoming.shortageStatus);
  merged.shortageStatus = existingShortageRank > incomingShortageRank ? existing.shortageStatus : (incoming.shortageStatus || existing.shortageStatus);

  // 8. Financial collected amounts: preserve non-zero if incoming is zero/missing
  if ((Number(existing.collectedAmount) || 0) > 0 && !(Number(incoming.collectedAmount) || 0)) {
    merged.collectedAmount = existing.collectedAmount;
    merged.collectedSyp = existing.collectedSyp;
    merged.collectedUsd = existing.collectedUsd;
  }
  if ((Number(existing.codSenderPayoutAmountSyp) || 0) > 0 && !(Number(incoming.codSenderPayoutAmountSyp) || 0)) {
    merged.codSenderPayoutAmountSyp = existing.codSenderPayoutAmountSyp;
  }
  if ((Number(existing.codSenderPayoutAmountUsd) || 0) > 0 && !(Number(incoming.codSenderPayoutAmountUsd) || 0)) {
    merged.codSenderPayoutAmountUsd = existing.codSenderPayoutAmountUsd;
  }
  if ((Number(existing.cashierCollectedSyp) || 0) > 0 && !(Number(incoming.cashierCollectedSyp) || 0)) {
    merged.cashierCollectedSyp = existing.cashierCollectedSyp;
  }
  if ((Number(existing.cashierCollectedUsd) || 0) > 0 && !(Number(incoming.cashierCollectedUsd) || 0)) {
    merged.cashierCollectedUsd = existing.cashierCollectedUsd;
  }

  // 9. Preserve immutable fields
  if (existing.id) merged.id = existing.id;
  if (existing.trackingNumber) merged.trackingNumber = existing.trackingNumber;
  if (existing.originBranchId) merged.originBranchId = existing.originBranchId;
  if (existing.destinationBranchId) merged.destinationBranchId = existing.destinationBranchId;
  if (existing.destinationHubId) merged.destinationHubId = existing.destinationHubId;

  // 10. Timestamp
  const existingTime = existing.updatedAt ? new Date(existing.updatedAt).getTime() : 0;
  const incomingTime = incoming.updatedAt ? new Date(incoming.updatedAt).getTime() : 0;
  merged.updatedAt = incomingTime > existingTime ? incoming.updatedAt : (existing.updatedAt || new Date().toISOString());

  return merged;
}

/**
 * Safely merges an incoming customer update with existing data.
 * Protects monotonic flags, images, and cumulative counters from 
 * LWW overwrites.
 */
export function mergeCustomerSafely(existing: any, incoming: any): any {
  if (!existing || typeof existing !== 'object') return incoming;
  if (!incoming || typeof incoming !== 'object') return existing;

  const merged = { ...existing, ...incoming };

  // 1. Monotonic booleans (لا ترتد إلى false)
  const monotonicBooleans = [
    'isVerified',
    'isBlacklisted',
    'portalAccessEnabled',
  ];
  for (const key of monotonicBooleans) {
    if (incoming[key] === true || existing[key] === true) {
      merged[key] = true;
    }
  }

  // 2. Monotonic timestamps (لا تُمسح)
  const monotonicTimestamps = [
    'createdAt',
    'portalLastLoginAt',
  ];
  for (const key of monotonicTimestamps) {
    merged[key] = existing[key] || incoming[key];
  }

  // 3. 🔴 صور Base64 (لا تُمسح — الأكبر حجماً والأثمن)
  const monotonicImages = [
    'idPhotoFront',
    'idPhotoBack',
  ];
  for (const key of monotonicImages) {
    merged[key] = existing[key] || incoming[key];
  }

  // 4. verificationSource (لا تُمسح بعد التعيين)
  merged.verificationSource = 
    existing.verificationSource || incoming.verificationSource;

  // 5. الحقول المتراكمة (لا تنقص أبداً)
  const cumulativeNumbers = [
    'totalShipmentsSent',
    'totalShipmentsReceived',
    'totalSpentSyp',
    'totalSpentUsd',
  ];
  for (const key of cumulativeNumbers) {
    const a = Number(existing[key]) || 0;
    const b = Number(incoming[key]) || 0;
    merged[key] = Math.max(a, b);
  }

  // 6. Immutable fields (لا تتغير)
  if (existing.id) merged.id = existing.id;
  if (existing.code) merged.code = existing.code;
  if (existing.nationalId) merged.nationalId = existing.nationalId;

  // 7. updatedAt: الأحدث يفوز
  const existTime = existing.updatedAt
    ? new Date(existing.updatedAt).getTime() : 0;
  const incomingTime = incoming.updatedAt
    ? new Date(incoming.updatedAt).getTime() : 0;
  merged.updatedAt = incomingTime > existTime
    ? incoming.updatedAt
    : existing.updatedAt || new Date().toISOString();

  return merged;
}

export function mergeUserSafely(existing: any, incoming: any): any {
  if (!existing || typeof existing !== 'object') return incoming;
  if (!incoming || typeof incoming !== 'object') return existing;

  const merged = { ...existing, ...incoming };

  // 1. Monotonic booleans
  const monotonicBooleans = ['isActive', 'canSwitchBranches'];
  for (const key of monotonicBooleans) {
    if (incoming[key] === true || existing[key] === true) {
      merged[key] = true;
    }
  }

  // 2. Monotonic timestamps (excluding passwordChangedAt which uses LWW comparison)
  const monotonicTimestamps = ['createdAt', 'lastLoginAt'];
  for (const key of monotonicTimestamps) {
    merged[key] = existing[key] || incoming[key];
  }

  // 3. ✅ password: يجب استخدام passwordChangedAt كحكم نهائي
  const inPassword = incoming.password;
  const exPassword = existing.password;
  const inPwdChangedAt = incoming.passwordChangedAt 
    ? new Date(incoming.passwordChangedAt).getTime() : 0;
  const exPwdChangedAt = existing.passwordChangedAt 
    ? new Date(existing.passwordChangedAt).getTime() : 0;

  // الحالات:
  // 1. incoming له password جديد (passwordChangedAt أحدث) → اقبل
  // 2. incoming ليس له password تغيير → احتفظ بالقديم
  // 3. incoming له password لكن passwordChangedAt أقدم → احتفظ بالقديم
  if (inPassword && inPassword !== '' && inPwdChangedAt > exPwdChangedAt) {
    // ✅ تغيير جديد مقصود
    merged.password = inPassword;
    merged.passwordChangedAt = incoming.passwordChangedAt;
  } else if (exPassword && exPassword !== '') {
    // ✅ احتفظ بالقديمة
    merged.password = exPassword;
    merged.passwordChangedAt = existing.passwordChangedAt;
  } else if (inPassword && inPassword !== '') {
    // إذا لم يكن هناك password قديم
    merged.password = inPassword;
    if (incoming.passwordChangedAt) {
      merged.passwordChangedAt = incoming.passwordChangedAt;
    }
  }

  // نفس المنطق لـ passwordHash (إن وُجد)
  if (incoming.passwordHash && incoming.passwordHash !== '' && inPwdChangedAt > exPwdChangedAt) {
    merged.passwordHash = incoming.passwordHash;
  } else if (existing.passwordHash && existing.passwordHash !== '') {
    merged.passwordHash = existing.passwordHash;
  }

  // نفس المنطق لـ pin (إن وُجد)
  if (incoming.pin && incoming.pin !== '' && incoming.pin !== existing.pin) {
    merged.pin = incoming.pin;
  } else if (existing.pin) {
    merged.pin = existing.pin;
  }

  // 4. permissions: كائن — احتفظ بالأحدث إذا كان updatedAt الأحدث
  if (existing.permissions && incoming.permissions) {
    const existTime = existing.updatedAt
      ? new Date(existing.updatedAt).getTime() : 0;
    const incomingTime = incoming.updatedAt
      ? new Date(incoming.updatedAt).getTime() : 0;
    merged.permissions = incomingTime > existTime
      ? incoming.permissions
      : existing.permissions;
  }

  // 5. Immutable identity
  if (existing.id) merged.id = existing.id;
  if (existing.username) merged.username = existing.username;
  if (existing.nationalId) merged.nationalId = existing.nationalId;

  // 6. updatedAt
  const existTime = existing.updatedAt
    ? new Date(existing.updatedAt).getTime() : 0;
  const incomingTime = incoming.updatedAt
    ? new Date(incoming.updatedAt).getTime() : 0;
  merged.updatedAt = incomingTime > existTime
    ? incoming.updatedAt
    : existing.updatedAt || new Date().toISOString();

  return merged;
}

export function mergeBranchSafely(existing: any, incoming: any): any {
  if (!existing || typeof existing !== 'object') return incoming;
  if (!incoming || typeof incoming !== 'object') return existing;

  const merged = { ...existing, ...incoming };

  // 1. Monotonic booleans
  const monotonicBooleans = ['isActive', 'isMainHub', 'isCentralHub'];
  for (const key of monotonicBooleans) {
    if (incoming[key] === true || existing[key] === true) {
      merged[key] = true;
    }
  }

  // 2. Monotonic timestamps
  merged.createdAt = existing.createdAt || incoming.createdAt;

  // 3. openingBalance: immutable بمجرد التعيين (حتى لو 0)
  const openingBalances = ['openingBalanceSyp', 'openingBalanceUsd'];
  for (const key of openingBalances) {
    merged[key] = existing[key] !== undefined 
      ? existing[key] 
      : incoming[key];
  }

  // 4. boxSypBalance/boxUsdBalance: متروكة تحت updatedAt (لا حماية خاصة لأن الرصيد الحقيقي مشتق من Ledger)

  // 5. Immutable identity
  if (existing.id) merged.id = existing.id;
  if (existing.code) merged.code = existing.code;

  // 6. updatedAt
  const existTime = existing.updatedAt
    ? new Date(existing.updatedAt).getTime() : 0;
  const incomingTime = incoming.updatedAt
    ? new Date(incoming.updatedAt).getTime() : 0;
  merged.updatedAt = incomingTime > existTime
    ? incoming.updatedAt
    : existing.updatedAt || new Date().toISOString();

  return merged;
}

/**
 * Checks if a status transition is allowed.
 * Returns true if OK, false if it's an illegal rollback.
 */
export function isTransitionAllowed(
  oldStatus: string | undefined,
  newStatus: string | undefined
): boolean {
  if (!oldStatus || !newStatus) return true;
  if (oldStatus === newStatus) return true;

  const oldRank = getHandlingStatusRank(oldStatus);
  const newRank = getHandlingStatusRank(newStatus);

  // Going UP in rank → always allowed
  if (newRank > oldRank) return true;

  // Same rank → allowed
  if (newRank === oldRank) return true;

  // Going DOWN → check legitimate exceptions:
  // 1. Courier intake handover: with_courier (60) → received_at_hub (10)
  if (oldStatus === 'with_courier' && newStatus === 'received_at_hub') {
    return true;
  }

  // 2. Legitimate resets (admin actions): leftover_origin_warehouse (25) → received_at_hub (10)
  if (oldStatus === 'leftover_origin_warehouse' && newStatus === 'received_at_hub') {
    return true;
  }

  // 3. Truck manifest reset / unload: in_transit (40) → loaded_in_truck (30) or received_at_origin_hub (20)
  if (oldStatus === 'in_transit' && (newStatus === 'loaded_in_truck' || newStatus === 'received_at_origin_hub')) {
    return true;
  }

  // 4. Delivery courier returns undelivered parcel: with_courier / out_for_delivery (60) → received_at_dest (50)
  if ((oldStatus === 'with_courier' || oldStatus === 'out_for_delivery') && newStatus === 'received_at_dest') {
    return true;
  }

  // 4b. Returned parcel intake at branch: returned_received_at_branch (95) or returned (90) → received_at_dest (50)
  if ((oldStatus === 'returned_received_at_branch' || oldStatus === 'returned') && newStatus === 'received_at_dest') {
    return true;
  }

  // 4c. Pre-delivery return cancellation: return_initiated (85) → received_at_dest (50)
  if (oldStatus === 'return_initiated' && newStatus === 'received_at_dest') {
    return true;
  }

  // 5. Shortage/lost recovery to warehouse (45/48 → 20/25/50)
  if (
    (oldStatus === 'shortage_missing' || oldStatus === 'lost_in_transit') &&
    (newStatus === 'received_at_origin_hub' || newStatus === 'received_at_dest' || newStatus === 'leftover_origin_warehouse')
  ) {
    return true;
  }

  // 6. Post-delivery return (delivered 95 / delivered_uncollected 70 → returned 90)
  if ((oldStatus === 'delivered' || oldStatus === 'delivered_uncollected') && newStatus === 'returned') {
    return true;
  }

  // All other downgrades → BLOCKED
  return false;
}
