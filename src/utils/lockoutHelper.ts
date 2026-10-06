import { safeStorage } from './storage';

export interface LockoutInfo {
  attempts: number;
  lockedUntil: number | null; // epoch timestamp in ms
}

const STORAGE_KEY = 'orca_login_lockouts';
export const MAX_LOGIN_ATTEMPTS = 5;
export const LOCKOUT_DURATION_SECONDS = 600; // 10 minutes (600 seconds)

export interface LockoutState {
  isLocked: boolean;
  remainingSeconds: number;
  attemptsCount: number;
  attemptsRemaining: number;
}

function getLockoutsRecord(): Record<string, LockoutInfo> {
  const raw = safeStorage.getItem(STORAGE_KEY);
  if (!raw) return {};
  try {
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

function saveLockoutsRecord(record: Record<string, LockoutInfo>): void {
  safeStorage.setItem(STORAGE_KEY, JSON.stringify(record));
}

export function checkLockoutState(identifier: string): LockoutState {
  const cleanKey = (identifier || 'global').trim().toLowerCase();
  const record = getLockoutsRecord();
  const info = record[cleanKey];

  if (!info) {
    return {
      isLocked: false,
      remainingSeconds: 0,
      attemptsCount: 0,
      attemptsRemaining: MAX_LOGIN_ATTEMPTS,
    };
  }

  const now = Date.now();
  if (info.lockedUntil && now < info.lockedUntil) {
    const remainingSeconds = Math.ceil((info.lockedUntil - now) / 1000);
    return {
      isLocked: true,
      remainingSeconds,
      attemptsCount: info.attempts || MAX_LOGIN_ATTEMPTS,
      attemptsRemaining: 0,
    };
  }

  // If lockedUntil expired, clean up
  if (info.lockedUntil && now >= info.lockedUntil) {
    delete record[cleanKey];
    saveLockoutsRecord(record);
    return {
      isLocked: false,
      remainingSeconds: 0,
      attemptsCount: 0,
      attemptsRemaining: MAX_LOGIN_ATTEMPTS,
    };
  }

  const attemptsCount = info.attempts || 0;
  return {
    isLocked: false,
    remainingSeconds: 0,
    attemptsCount,
    attemptsRemaining: Math.max(0, MAX_LOGIN_ATTEMPTS - attemptsCount),
  };
}

export function recordFailedLoginAttempt(identifier: string): LockoutState {
  const cleanKey = (identifier || 'global').trim().toLowerCase();
  const record = getLockoutsRecord();
  const current = record[cleanKey] || { attempts: 0, lockedUntil: null };

  const newAttempts = current.attempts + 1;
  const now = Date.now();

  let lockedUntil: number | null = current.lockedUntil;
  if (newAttempts >= MAX_LOGIN_ATTEMPTS) {
    lockedUntil = now + LOCKOUT_DURATION_SECONDS * 1000;
  }

  record[cleanKey] = {
    attempts: newAttempts,
    lockedUntil,
  };

  saveLockoutsRecord(record);

  const isLocked = !!lockedUntil && now < lockedUntil;
  const remainingSeconds = isLocked ? Math.ceil((lockedUntil! - now) / 1000) : 0;

  return {
    isLocked,
    remainingSeconds,
    attemptsCount: newAttempts,
    attemptsRemaining: Math.max(0, MAX_LOGIN_ATTEMPTS - newAttempts),
  };
}

export function clearLockoutState(identifier: string): void {
  const cleanKey = (identifier || 'global').trim().toLowerCase();
  const record = getLockoutsRecord();
  if (record[cleanKey]) {
    delete record[cleanKey];
    saveLockoutsRecord(record);
  }
}

export function formatCountdownTimer(totalSeconds: number): string {
  if (totalSeconds <= 0) return '00:00';
  const mins = Math.floor(totalSeconds / 60);
  const secs = totalSeconds % 60;
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}
