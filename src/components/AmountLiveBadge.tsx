import React from 'react';
import { formatAmountInWordsArabic, formatAmountWithSeparators } from '../utils/numberFormatter';

interface AmountLiveBadgeProps {
  amount: number | string | null | undefined;
  currency?: 'SYP' | 'USD' | string;
  className?: string;
  showWords?: boolean;
}

export const AmountLiveBadge: React.FC<AmountLiveBadgeProps> = () => {
  return null;
};

