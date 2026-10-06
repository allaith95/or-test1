import { ParcelEvent, ParcelEventDimension } from '../types';

/**
 * Filter and sort parcel events chronologically for a specific parcel.
 */
export function getParcelTimelineFromEvents(
  parcelId: string,
  events: ParcelEvent[],
  order: 'asc' | 'desc' = 'desc'
): ParcelEvent[] {
  if (!events || !Array.isArray(events)) return [];

  const filtered = events.filter((e) => e && e.parcelId === parcelId);

  filtered.sort((a, b) => {
    const rankA = a.precedenceRank ?? 0;
    const rankB = b.precedenceRank ?? 0;

    if (rankA !== rankB) {
      return rankA - rankB;
    }

    const timeA = new Date(a.serverTimestamp || a.createdAt || a.clientTimestamp || 0).getTime();
    const timeB = new Date(b.serverTimestamp || b.createdAt || b.clientTimestamp || 0).getTime();

    return timeA - timeB;
  });

  return order === 'desc' ? filtered.reverse() : filtered;
}

/**
 * Arabic human-readable label for every eventType.
 */
export function getEventLabelAr(eventType: string): string {
  switch (eventType) {
    case 'received_at_hub':
      return 'استلام وتجهيز بالمركز';
    case 'received_at_origin_hub':
      return 'استلام بمركز الانطلاق';
    case 'loaded_in_truck':
      return 'تحميل في الشاحنة';
    case 'in_transit':
      return 'في الطريق بين المحافظات';
    case 'received_at_dest':
      return 'وصول لمركز الوجهة';
    case 'with_courier':
      return 'مع الموزع للتوصيل';
    case 'out_for_delivery':
      return 'خارج للتسليم الميداني';
    case 'delivered_uncollected':
      return 'تم التسليم (ذمة بدون قبض)';
    case 'delivered':
      return 'تم التسليم والتحصيل';
    case 'returned':
      return 'مرتجع للمستودع';
    case 'shortage_missing':
      return 'نقص معلق عند التفريغ';
    case 'lost_in_transit':
      return 'مفقود على الطريق';
    case 'rerouted_forwarded':
      return 'إعادة توجيه لشحنة جديدة';
    case 'settled_loss_compensated':
      return 'تم التعويض والتسوية المالية';
    case 'leftover_origin_warehouse':
      return 'متبقٍ في مستودع الانطلاق';
    case 'truck_journey_resumed':
      return 'استئناف مسار الشاحنة';
    default:
      return eventType || 'حدث غير معرف';
  }
}

/**
 * Styling and badge properties based on ParcelEventDimension.
 */
export function getEventDimensionStyle(dim: ParcelEventDimension): {
  label: string;
  text: string;
  bg: string;
  border: string;
  dot: string;
} {
  switch (dim) {
    case 'handling':
      return {
        label: 'مناولة لوجستية',
        text: 'text-emerald-400',
        bg: 'bg-emerald-500/10',
        border: 'border-emerald-500/30',
        dot: 'bg-emerald-500',
      };
    case 'financial_cod':
      return {
        label: 'تحصيل وترصيد',
        text: 'text-cyan-400',
        bg: 'bg-cyan-500/10',
        border: 'border-cyan-500/30',
        dot: 'bg-cyan-500',
      };
    case 'investigation':
      return {
        label: 'تحقيق وجرد',
        text: 'text-amber-400',
        bg: 'bg-amber-500/10',
        border: 'border-amber-500/30',
        dot: 'bg-amber-500',
      };
    case 'location':
      return {
        label: 'موقع وحركة',
        text: 'text-purple-400',
        bg: 'bg-purple-500/10',
        border: 'border-purple-500/30',
        dot: 'bg-purple-500',
      };
    case 'cashier':
      return {
        label: 'صندوق ومقاصة',
        text: 'text-pink-400',
        bg: 'bg-pink-500/10',
        border: 'border-pink-500/30',
        dot: 'bg-pink-500',
      };
    default:
      return {
        label: 'عام',
        text: 'text-slate-400',
        bg: 'bg-slate-500/10',
        border: 'border-slate-500/30',
        dot: 'bg-slate-500',
      };
  }
}

/**
 * Format timestamp into structured date, time, and relative duration string.
 */
export function formatEventTimestamp(isoString?: string): {
  date: string;
  time: string;
  relative: string;
} {
  if (!isoString) {
    return { date: 'غير محدد', time: '--:--', relative: 'غير معروف' };
  }

  try {
    const d = new Date(isoString);
    if (isNaN(d.getTime())) {
      return { date: 'غير محدد', time: '--:--', relative: 'غير معروف' };
    }

    const date = d.toISOString().split('T')[0];
    const time = d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false });

    const now = Date.now();
    const diffMs = now - d.getTime();
    const diffSec = Math.floor(diffMs / 1000);
    const diffMin = Math.floor(diffSec / 60);
    const diffHour = Math.floor(diffMin / 60);
    const diffDay = Math.floor(diffHour / 24);

    let relative = 'الآن';
    if (diffMin < 1) {
      relative = 'منذ أقل من دقيقة';
    } else if (diffMin < 60) {
      relative = `منذ ${diffMin} دقيقة`;
    } else if (diffHour < 24) {
      relative = `منذ ${diffHour} ساعة`;
    } else if (diffDay === 1) {
      relative = 'أمس';
    } else {
      relative = `منذ ${diffDay} يوم`;
    }

    return { date, time, relative };
  } catch {
    return { date: 'غير محدد', time: '--:--', relative: 'غير معروف' };
  }
}

export interface PublicSafeEvent {
  eventType: string;
  labelAr: string;
  timestamp: string;
  formattedTime: string;
  notes?: string;
}

/**
 * Strips internal personnel credentials and returns a public-safe timeline.
 */
export function getPublicSafeTimeline(events: ParcelEvent[]): PublicSafeEvent[] {
  if (!events || !Array.isArray(events)) return [];

  return events.map((e) => {
    const iso = e.serverTimestamp || e.createdAt || e.clientTimestamp || new Date().toISOString();
    const { date, time } = formatEventTimestamp(iso);

    return {
      eventType: e.eventType,
      labelAr: getEventLabelAr(e.eventType),
      timestamp: `${date} ${time}`,
      formattedTime: `${date} ${time}`,
      notes: e.notes ? e.notes.replace(/\(الموظف:.*?\)/g, '').trim() : undefined,
    };
  });
}
