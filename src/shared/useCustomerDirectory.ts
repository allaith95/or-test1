import { useMemo, useState } from 'react';
import { Customer } from '../types';
import { normalizeArabicComparison, normalizePhoneForComparison } from '../utils/nameUtils';

export interface CustomerSearchOptions {
  query?: string;
  city?: string;
  type?: string;
  limit?: number;
}

/**
 * Shared Customer Directory Search Hook.
 * Provides unified customer filtering, matching, and lookup across General App and Courier App.
 */
export function searchCustomers(customers: Customer[], options: CustomerSearchOptions): Customer[] {
  const { query = '', city = 'all', type = 'all', limit = 50 } = options;
  const q = query.trim().toLowerCase();
  const cleanQ = normalizeArabicComparison(q);
  const cleanDigits = q.replace(/\D/g, '');
  const normDigits = normalizePhoneForComparison(cleanDigits);

  let filtered = customers;

  // City filter
  if (city && city !== 'all') {
    filtered = filtered.filter((c) => c.city === city);
  }

  // Type filter
  if (type && type !== 'all') {
    filtered = filtered.filter((c) => c.customerType === type);
  }

  // Search query match
  if (q.length > 0) {
    filtered = filtered.filter((c) => {
      // Phone & National ID search
      if (cleanDigits.length >= 2) {
        const rawPhone = (c.phone || '').replace(/\D/g, '');
        const rawSecPhone = (c.secondaryPhone || '').replace(/\D/g, '');
        const normPhone = normalizePhoneForComparison(c.phone);
        const normSecPhone = normalizePhoneForComparison(c.secondaryPhone);
        const nid = (c.nationalId || '').replace(/\D/g, '');

        if (
          (rawPhone && rawPhone.includes(cleanDigits)) ||
          (rawSecPhone && rawSecPhone.includes(cleanDigits)) ||
          (normDigits && normPhone && normPhone.includes(normDigits)) ||
          (normDigits && normSecPhone && normSecPhone.includes(normDigits)) ||
          (nid && nid.includes(cleanDigits))
        ) {
          return true;
        }
      }

      // Name & Code search
      const cName = normalizeArabicComparison(c.fullName);
      if (cName.includes(cleanQ)) return true;
      if (c.code && c.code.toLowerCase().includes(q)) return true;

      return false;
    });
  }

  return filtered.slice(0, limit);
}

export function useCustomerDirectory(customers: Customer[]) {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCity, setSelectedCity] = useState('all');
  const [selectedType, setSelectedType] = useState('all');

  const filteredCustomers = useMemo(() => {
    return searchCustomers(customers, {
      query: searchTerm,
      city: selectedCity,
      type: selectedType,
      limit: 100,
    });
  }, [customers, searchTerm, selectedCity, selectedType]);

  return {
    searchTerm,
    setSearchTerm,
    selectedCity,
    setSelectedCity,
    selectedType,
    setSelectedType,
    filteredCustomers,
    searchCustomers: (q: string, limit = 5) => searchCustomers(customers, { query: q, limit }),
  };
}
