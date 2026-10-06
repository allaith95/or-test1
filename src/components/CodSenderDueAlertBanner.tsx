import React from 'react';

interface CodSenderDueAlertBannerProps {
  onOpenPayoutModal?: (parcelId: string) => void;
}

/**
 * CodSenderDueAlertBanner
 * 
 * According to system directive:
 * Alerts for ready COD remittances must NOT be displayed to the delivery/cashier staff automatically.
 * Alerts are exclusively shown to the customer in their Customer Portal application.
 * The delivery staff accesses ready remittances only by searching via receipt number.
 */
export const CodSenderDueAlertBanner: React.FC<CodSenderDueAlertBannerProps> = () => {
  // Suppress automatic banner alerts for staff members
  return null;
};
