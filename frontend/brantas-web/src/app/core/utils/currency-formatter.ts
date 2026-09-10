export interface CompactCurrencyResult {
  compact: string; // e.g. "Rp437.7 T", "Rp108.9 T", "+Rp52.2 T", "Rp80.9 M", "Rp127.9 Juta"
  full: string;    // e.g. "Rp437.676.320.000.000"
}

/**
 * Memformat angka nominal anggaran fiskal APBN/TKDD menjadi singkatan dinamis
 * (T untuk Triliun, M untuk Miliar, Juta untuk Juta) dan nominal lengkap dalam Rupiah untuk tooltip.
 *
 * Contoh:
 * - 437676.32 -> Rp437.7 T (Full: Rp437.676.320.000.000)
 * - 108932.39 -> Rp108.9 T (Full: Rp108.932.390.000.000)
 * - 52209.43  -> +Rp52.2 T (Full: +Rp52.209.430.000.000)
 * - 80.9      -> Rp80.9 M (Full: Rp80.900.000.000)
 * - 0.1279    -> Rp127.9 Juta (Full: Rp127.900.000)
 */
export function formatCompactCurrency(val: number | null | undefined, showSign = false): CompactCurrencyResult {
  if (val === null || val === undefined || isNaN(val)) {
    return { compact: '—', full: '—' };
  }

  const sign = val > 0 && showSign ? '+' : val < 0 ? '-' : '';
  const absVal = Math.abs(val);

  // Basis 1 unit = 1 Miliar Rupiah (Rp1.000.000.000)
  const fullRupiah = Math.round(absVal * 1_000_000_000);
  const full = `${sign}Rp${fullRupiah.toLocaleString('id-ID')}`;

  let compact = '';
  if (absVal >= 1000) {
    const tVal = (absVal / 1000).toLocaleString('id-ID', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
    compact = `${sign}Rp${tVal} T`;
  } else if (absVal >= 1) {
    const mVal = absVal.toLocaleString('id-ID', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
    compact = `${sign}Rp${mVal} M`;
  } else if (absVal > 0) {
    const jVal = (absVal * 1000).toLocaleString('id-ID', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
    compact = `${sign}Rp${jVal} Juta`;
  } else {
    compact = `Rp0`;
  }

  return { compact, full };
}
