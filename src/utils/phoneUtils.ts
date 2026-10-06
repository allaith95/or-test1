import { Customer } from '../types';

export function normalizePhone(phone: string): string {
  if (!phone) return '';
  let digits = String(phone).replace(/\D/g, '');
  // Remove country code 963
  if (digits.startsWith('963')) digits = digits.substring(3);
  // Remove leading 0
  if (digits.startsWith('0')) digits = digits.substring(1);
  return digits;
}

export function phonesMatch(a: string, b: string): boolean {
  const na = normalizePhone(a);
  const nb = normalizePhone(b);
  if (!na || !nb) return false;
  if (na.length < 9 || nb.length < 9) return false;
  return na === nb;
}

export interface CustomerMatchResult {
  match: Customer | null;
  multiple: Customer[];
}

export function findCustomerByPhone(
  customers: Customer[],
  rawPhone: string
): CustomerMatchResult {
  const normalized = normalizePhone(rawPhone);
  if (normalized.length < 9) {
    return { match: null, multiple: [] };
  }

  const matches = customers.filter((c) => {
    if (!c) return false;
    return (
      phonesMatch(c.phone || '', rawPhone) ||
      phonesMatch(c.secondaryPhone || '', rawPhone)
    );
  });

  if (matches.length === 0) return { match: null, multiple: [] };
  if (matches.length === 1) return { match: matches[0], multiple: [] };
  return { match: null, multiple: matches };
}

export function findCustomerByNationalId(
  customers: Customer[],
  rawNid: string
): CustomerMatchResult {
  const clean = String(rawNid || '').replace(/\D/g, '');
  if (clean.length !== 11) return { match: null, multiple: [] };

  const matches = customers.filter(
    (c) => c && String(c.nationalId || '').replace(/\D/g, '') === clean
  );

  if (matches.length === 0) return { match: null, multiple: [] };
  if (matches.length === 1) return { match: matches[0], multiple: [] };
  return { match: null, multiple: matches };
}
