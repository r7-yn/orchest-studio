import type { Track, OrderRequest } from '../types/index.ts';

/**
 * Format duration in seconds to MM:SS string
 */
export function formatDuration(seconds: number): string {
  if (isNaN(seconds) || seconds < 0) return '00:00';
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

/**
 * Format number into Arabic readable format (e.g. 124893 -> 124,893 or 12.4K)
 */
export function formatNumberK(num: number): string {
  if (num >= 1000) {
    const k = (num / 1000).toFixed(1);
    return `${k.endsWith('.0') ? Math.floor(num / 1000) : k}K`;
  }
  return num.toString();
}

/**
 * Format integer with thousands commas
 */
export function formatCommas(num: number): string {
  return num.toLocaleString('en-US');
}

/**
 * Calculate conversion rate percentage
 */
export function calculateConversionRate(leads: number, visits: number): number {
  if (!visits || visits <= 0) return 0;
  const rate = (leads / visits) * 100;
  return Number(rate.toFixed(2));
}

export interface WhatsAppOrderInput {
  clientNames: string;
  modificationType: string;
  occasionDate: string;
  notes?: string;
  customPhone?: string;
}

/**
 * Generate formatted WhatsApp message for Studio checkout
 */
export function generateWhatsAppMessage(track: Track, form: WhatsAppOrderInput): string {
  const occasionDateStr = form.occasionDate ? form.occasionDate : 'غير محدد';
  const notesStr = form.notes && form.notes.trim() ? `\nملاحظات إضافية: ${form.notes.trim()}` : '';

  return `مرحباً، أود طلب عمل صوتي من استوديو أوركست:
• العمل: ${track.title}
• الكود: ${track.code}
• المنشد: ${track.artist}
• نوع الإيقاع: ${track.rhythm}
• أسماء العروسين / صاحب المناسبة: ${form.clientNames.trim()}
• نوع التعديل المطلوب: ${form.modificationType}
• تاريخ المناسبة: ${occasionDateStr}${notesStr}
• رابط العمل: https://orchest.com/tracks/${encodeURIComponent(track.code.replace('#', ''))}

يرجى إفادتي بتفاصيل التنفيذ والسعر. شكراً لكم! 🎵`;
}

/**
 * Generate WhatsApp Click-to-Chat URL
 */
export function generateWhatsAppUrl(phone: string, message: string): string {
  const sanitizedPhone = phone.replace(/[^0-9]/g, '');
  const encodedMsg = encodeURIComponent(message);
  return `https://wa.me/${sanitizedPhone}?text=${encodedMsg}`;
}

/**
 * Filter tracks by search query, category, and rhythm
 */
export function filterTracks(
  tracks: Track[],
  query: string = '',
  categoryId: string = 'all',
  rhythmFilter: string = 'all'
): Track[] {
  const cleanQuery = query.trim().toLowerCase();

  return tracks.filter((track) => {
    // Category match
    if (categoryId !== 'all' && track.categoryId !== categoryId) {
      return false;
    }

    // Rhythm match
    if (rhythmFilter !== 'all' && track.rhythm !== rhythmFilter) {
      return false;
    }

    // Query match
    if (!cleanQuery) return true;

    const matchTitle = track.title.toLowerCase().includes(cleanQuery);
    const matchArtist = track.artist.toLowerCase().includes(cleanQuery);
    const matchCode = track.code.toLowerCase().includes(cleanQuery);
    const matchCategory = track.categoryLabel.toLowerCase().includes(cleanQuery);
    const matchLyrics = track.lyrics ? track.lyrics.toLowerCase().includes(cleanQuery) : false;

    return matchTitle || matchArtist || matchCode || matchCategory || matchLyrics;
  });
}

/**
 * Validates and normalizes international WhatsApp phone numbers
 */
export function validateWhatsAppNumber(phone: string): {
  isValid: boolean;
  sanitized: string;
  formatted: string;
  error?: string;
} {
  const digitsOnly = phone.replace(/[^0-9]/g, '');

  if (!digitsOnly) {
    return {
      isValid: false,
      sanitized: '',
      formatted: '',
      error: 'يرجى إدخال رقم الواتساب',
    };
  }

  if (digitsOnly.length < 8 || digitsOnly.length > 15) {
    return {
      isValid: false,
      sanitized: digitsOnly,
      formatted: `+${digitsOnly}`,
      error: 'الرقم غير صالح. يجب أن يتراوح بين 9 و 15 رقماً بالصيغة الدولية',
    };
  }

  return {
    isValid: true,
    sanitized: digitsOnly,
    formatted: `+${digitsOnly}`,
  };
}

/**
 * Exports orders list to CSV formatted string with UTF-8 BOM for Excel support
 */
export function exportOrdersToCSV(orders: OrderRequest[]): string {
  const headers = [
    'معرف الطلب',
    'الاسم / صاحب المناسبة',
    'العمل الصوتي',
    'كود العمل',
    'نوع التعديل',
    'تاريخ المناسبة',
    'رقم التواصل',
    'تاريخ ووقت الطلب',
    'الحالة',
    'ملاحظات إضافية',
  ];

  const escapeCSV = (str: string = '') => {
    const escaped = str.replace(/"/g, '""');
    return `"${escaped}"`;
  };

  const rows = orders.map((ord) => [
    escapeCSV(ord.id),
    escapeCSV(ord.clientNames),
    escapeCSV(ord.trackTitle),
    escapeCSV(ord.trackCode),
    escapeCSV(ord.modificationType),
    escapeCSV(ord.occasionDate || 'غير محدد'),
    escapeCSV(ord.phone || 'غير مسجل'),
    escapeCSV(ord.timestamp),
    escapeCSV(ord.status),
    escapeCSV(ord.notes || ''),
  ]);

  // Prepend UTF-8 BOM (\uFEFF) so Microsoft Excel opens Arabic text correctly
  const csvContent = '\uFEFF' + [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
  return csvContent;
}

/**
 * Prepares formatted JSON backup string
 */
export function exportFullBackupJSON(data: {
  exportedAt: string;
  studioName: string;
  settings: any;
  tracks: any[];
  categories: any[];
  orders: any[];
}): string {
  return JSON.stringify(data, null, 2);
}

