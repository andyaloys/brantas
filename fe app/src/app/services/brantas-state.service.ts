import { Injectable, signal, computed } from '@angular/core';

export interface RegionData {
  id: string;
  name: string;
  povertyRate: number;      // %
  p1: number;               // Indeks Kedalaman Kemiskinan
  p2: number;               // Indeks Keparahan Kemiskinan
  ipm: number;              // Indeks Pembangunan Manusia
  pdrbPerCapita: number;    // Juta Rupiah
  actualBudget: number;     // Rp Triliun (jika Provinsi) atau Rp Miliar (jika Kab/Kota)
  danaDesa: number;         // Rp Triliun atau Miliar
  penerimaDTKS: number;     // Jiwa
  anomalies: {
    asnTniPolri: number;    // Terdeteksi ASN/TNI/Polri aktif
    ganda: number;          // Data Ganda
    meninggal: number;      // NIK Meninggal Dunia
    exclusion: number;      // Warga Sangat Miskin Tidak Terdata
  };
  latitude: number;
  longitude: number;
}

export interface ChatMessage {
  id: string;
  sender: 'user' | 'jusi';
  text: string;
  timestamp: Date;
}

@Injectable({
  providedIn: 'root'
})
export class BrantasStateService {
  // 1. DYNAMIC SCOPE SELECTOR
  // 'nasional' atau BPS kode Provinsi (e.g., '32' untuk Jawa Barat, '31' untuk DKI Jakarta)
  readonly selectedScope = signal<string>('nasional');

  // 2. DATA PIPELINE STATE
  readonly isPipelineRunning = signal<boolean>(false);
  readonly pipelineProgress = signal<number>(0);
  readonly pipelineStatusText = signal<string>('System Idle - Repositori Terintegrasi');
  readonly lastPipelineRun = signal<Date | null>(null);

  // 3. NATIONAL PROVINCES DATASET (38 PROVINSI)
  readonly provinces = signal<RegionData[]>([
    {
      id: '11', name: 'Aceh', povertyRate: 14.39, p1: 2.35, p2: 0.58, ipm: 72.80, pdrbPerCapita: 39.5,
      actualBudget: 15.4, danaDesa: 4.8, penerimaDTKS: 1850000,
      anomalies: { asnTniPolri: 8900, ganda: 24500, meninggal: 7800, exclusion: 34000 },
      latitude: 4.6951, longitude: 96.7494
    },
    {
      id: '12', name: 'Sumatera Utara', povertyRate: 8.15, p1: 1.15, p2: 0.24, ipm: 72.71, pdrbPerCapita: 57.2,
      actualBudget: 28.5, danaDesa: 4.2, penerimaDTKS: 3820000,
      anomalies: { asnTniPolri: 12400, ganda: 42100, meninggal: 11500, exclusion: 58000 },
      latitude: 2.1121, longitude: 99.3905
    },
    {
      id: '13', name: 'Sumatera Barat', povertyRate: 5.95, p1: 0.85, p2: 0.18, ipm: 73.26, pdrbPerCapita: 48.9,
      actualBudget: 12.1, danaDesa: 0.9, penerimaDTKS: 1220000,
      anomalies: { asnTniPolri: 4100, ganda: 11800, meninggal: 3200, exclusion: 18000 },
      latitude: -0.7399, longitude: 100.8000
    },
    {
      id: '14', name: 'Riau', povertyRate: 6.68, p1: 0.92, p2: 0.20, ipm: 73.52, pdrbPerCapita: 112.4,
      actualBudget: 18.2, danaDesa: 1.6, penerimaDTKS: 1450000,
      anomalies: { asnTniPolri: 5200, ganda: 16500, meninggal: 4500, exclusion: 22000 },
      latitude: 0.2933, longitude: 101.7068
    },
    {
      id: '15', name: 'Jambi', povertyRate: 7.58, p1: 1.05, p2: 0.22, ipm: 72.14, pdrbPerCapita: 68.2,
      actualBudget: 9.4, danaDesa: 1.2, penerimaDTKS: 880000,
      anomalies: { asnTniPolri: 3100, ganda: 9200, meninggal: 2800, exclusion: 14000 },
      latitude: -1.6186, longitude: 102.7797
    },
    {
      id: '16', name: 'Sumatera Selatan', povertyRate: 11.95, p1: 2.10, p2: 0.52, ipm: 70.90, pdrbPerCapita: 59.8,
      actualBudget: 22.8, danaDesa: 2.5, penerimaDTKS: 2650000,
      anomalies: { asnTniPolri: 9200, ganda: 28900, meninggal: 8400, exclusion: 46000 },
      latitude: -3.3194, longitude: 103.9144
    },
    {
      id: '17', name: 'Bengkulu', povertyRate: 14.34, p1: 2.40, p2: 0.60, ipm: 72.16, pdrbPerCapita: 36.4,
      actualBudget: 6.2, danaDesa: 1.0, penerimaDTKS: 650000,
      anomalies: { asnTniPolri: 2800, ganda: 7400, meninggal: 2100, exclusion: 12500 },
      latitude: -3.7928, longitude: 102.2608
    },
    {
      id: '18', name: 'Lampung', povertyRate: 11.11, p1: 1.85, p2: 0.44, ipm: 70.45, pdrbPerCapita: 42.1,
      actualBudget: 19.5, danaDesa: 2.4, penerimaDTKS: 2800000,
      anomalies: { asnTniPolri: 8400, ganda: 26400, meninggal: 7900, exclusion: 41000 },
      latitude: -4.5586, longitude: 105.4000
    },
    {
      id: '19', name: 'Kep. Bangka Belitung', povertyRate: 4.53, p1: 0.52, p2: 0.10, ipm: 72.24, pdrbPerCapita: 62.4,
      actualBudget: 4.8, danaDesa: 0.4, penerimaDTKS: 350000,
      anomalies: { asnTniPolri: 1100, ganda: 3200, meninggal: 900, exclusion: 4800 },
      latitude: -2.7410, longitude: 106.4406
    },
    {
      id: '21', name: 'Kep. Riau', povertyRate: 5.78, p1: 0.72, p2: 0.15, ipm: 76.59, pdrbPerCapita: 122.5,
      actualBudget: 6.5, danaDesa: 0.3, penerimaDTKS: 480000,
      anomalies: { asnTniPolri: 1500, ganda: 4100, meninggal: 1200, exclusion: 6200 },
      latitude: 3.9456, longitude: 108.1428
    },
    {
      id: '31', name: 'DKI Jakarta', povertyRate: 4.44, p1: 0.45, p2: 0.08, ipm: 81.65, pdrbPerCapita: 285.2,
      actualBudget: 65.4, danaDesa: 0.0, penerimaDTKS: 3500000,
      anomalies: { asnTniPolri: 4200, ganda: 29500, meninggal: 11200, exclusion: 15000 },
      latitude: -6.2088, longitude: 106.8456
    },
    {
      id: '32', name: 'Jawa Barat', povertyRate: 7.62, p1: 1.10, p2: 0.22, ipm: 73.12, pdrbPerCapita: 48.2,
      actualBudget: 92.5, danaDesa: 6.2, penerimaDTKS: 10200000,
      anomalies: { asnTniPolri: 32400, ganda: 94500, meninggal: 28500, exclusion: 120000 },
      latitude: -6.9175, longitude: 107.6191
    },
    {
      id: '33', name: 'Jawa Tengah', povertyRate: 10.77, p1: 1.78, p2: 0.41, ipm: 72.79, pdrbPerCapita: 41.5,
      actualBudget: 74.8, danaDesa: 8.1, penerimaDTKS: 9400000,
      anomalies: { asnTniPolri: 28900, ganda: 88400, meninggal: 26100, exclusion: 110000 },
      latitude: -7.1509, longitude: 110.1402
    },
    {
      id: '34', name: 'DI Yogyakarta', povertyRate: 11.04, p1: 1.82, p2: 0.42, ipm: 80.64, pdrbPerCapita: 44.2,
      actualBudget: 14.2, danaDesa: 0.8, penerimaDTKS: 1280000,
      anomalies: { asnTniPolri: 2900, ganda: 12400, meninggal: 3400, exclusion: 16500 },
      latitude: -7.8753, longitude: 110.4262
    },
    {
      id: '35', name: 'Jawa Timur', povertyRate: 10.35, p1: 1.65, p2: 0.38, ipm: 72.75, pdrbPerCapita: 66.2,
      actualBudget: 85.6, danaDesa: 7.9, penerimaDTKS: 9800000,
      anomalies: { asnTniPolri: 31000, ganda: 91200, meninggal: 27800, exclusion: 115000 },
      latitude: -7.5360, longitude: 112.2384
    },
    {
      id: '36', name: 'Banten', povertyRate: 6.17, p1: 0.88, p2: 0.19, ipm: 73.32, pdrbPerCapita: 60.5,
      actualBudget: 24.5, danaDesa: 1.1, penerimaDTKS: 2400000,
      anomalies: { asnTniPolri: 6800, ganda: 22000, meninggal: 6500, exclusion: 28000 },
      latitude: -6.4058, longitude: 106.0600
    },
    {
      id: '51', name: 'Bali', povertyRate: 4.25, p1: 0.48, p2: 0.09, ipm: 76.44, pdrbPerCapita: 58.2,
      actualBudget: 10.2, danaDesa: 0.7, penerimaDTKS: 750000,
      anomalies: { asnTniPolri: 1200, ganda: 4800, meninggal: 1400, exclusion: 5900 },
      latitude: -8.4095, longitude: 115.1889
    },
    {
      id: '52', name: 'Nusa Tenggara Barat', povertyRate: 13.82, p1: 2.30, p2: 0.55, ipm: 69.46, pdrbPerCapita: 29.5,
      actualBudget: 16.5, danaDesa: 1.4, penerimaDTKS: 1780000,
      anomalies: { asnTniPolri: 5900, ganda: 16200, meninggal: 4800, exclusion: 24000 },
      latitude: -8.6529, longitude: 117.3616
    },
    {
      id: '53', name: 'Nusa Tenggara Timur', povertyRate: 19.96, p1: 3.82, p2: 0.98, ipm: 65.90, pdrbPerCapita: 22.1,
      actualBudget: 18.4, danaDesa: 2.8, penerimaDTKS: 2850000,
      anomalies: { asnTniPolri: 9800, ganda: 24800, meninggal: 7900, exclusion: 62000 },
      latitude: -8.6573, longitude: 121.0794
    },
    {
      id: '61', name: 'Kalimantan Barat', povertyRate: 7.25, p1: 0.95, p2: 0.20, ipm: 68.63, pdrbPerCapita: 44.8,
      actualBudget: 18.5, danaDesa: 2.1, penerimaDTKS: 1650000,
      anomalies: { asnTniPolri: 5800, ganda: 18200, meninggal: 4900, exclusion: 22500 },
      latitude: -0.2789, longitude: 111.4753
    },
    {
      id: '62', name: 'Kalimantan Tengah', povertyRate: 5.11, p1: 0.65, p2: 0.12, ipm: 71.63, pdrbPerCapita: 66.8,
      actualBudget: 11.5, danaDesa: 1.5, penerimaDTKS: 920000,
      anomalies: { asnTniPolri: 2900, ganda: 7900, meninggal: 2400, exclusion: 9800 },
      latitude: -1.6814, longitude: 113.3823
    },
    {
      id: '63', name: 'Kalimantan Selatan', povertyRate: 4.29, p1: 0.50, p2: 0.09, ipm: 71.84, pdrbPerCapita: 58.9,
      actualBudget: 12.8, danaDesa: 1.6, penerimaDTKS: 1100000,
      anomalies: { asnTniPolri: 1800, ganda: 4900, meninggal: 1200, exclusion: 5100 },
      latitude: -3.0926, longitude: 115.2837
    },
    {
      id: '64', name: 'Kalimantan Timur', povertyRate: 11.35, p1: 0.88, p2: 0.19, ipm: 77.44, pdrbPerCapita: 182.4,
      actualBudget: 42.4, danaDesa: 0.9, penerimaDTKS: 1250000,
      anomalies: { asnTniPolri: 4100, ganda: 11500, meninggal: 3200, exclusion: 14000 },
      latitude: 1.6406, longitude: 116.4194
    },
    {
      id: '65', name: 'Kalimantan Utara', povertyRate: 6.45, p1: 0.90, p2: 0.19, ipm: 71.83, pdrbPerCapita: 142.5,
      actualBudget: 5.2, danaDesa: 0.5, penerimaDTKS: 280000,
      anomalies: { asnTniPolri: 900, ganda: 2400, meninggal: 700, exclusion: 3100 },
      latitude: 3.0731, longitude: 116.0413
    },
    {
      id: '71', name: 'Sulawesi Utara', povertyRate: 7.28, p1: 1.02, p2: 0.22, ipm: 73.81, pdrbPerCapita: 52.4,
      actualBudget: 9.8, danaDesa: 1.2, penerimaDTKS: 940000,
      anomalies: { asnTniPolri: 2800, ganda: 7900, meninggal: 2300, exclusion: 10500 },
      latitude: 0.6247, longitude: 123.9750
    },
    {
      id: '72', name: 'Sulawesi Tengah', povertyRate: 12.30, p1: 2.15, p2: 0.50, ipm: 69.79, pdrbPerCapita: 48.9,
      actualBudget: 11.2, danaDesa: 1.8, penerimaDTKS: 1200000,
      anomalies: { asnTniPolri: 4100, ganda: 11400, meninggal: 3500, exclusion: 18500 },
      latitude: -1.4300, longitude: 121.4456
    },
    {
      id: '73', name: 'Sulawesi Selatan', povertyRate: 8.70, p1: 1.22, p2: 0.26, ipm: 72.82, pdrbPerCapita: 58.2,
      actualBudget: 26.5, danaDesa: 2.4, penerimaDTKS: 3100000,
      anomalies: { asnTniPolri: 9100, ganda: 28400, meninggal: 8100, exclusion: 42000 },
      latitude: -3.6687, longitude: 119.9740
    },
    {
      id: '74', name: 'Sulawesi Tenggara', povertyRate: 11.17, p1: 1.95, p2: 0.45, ipm: 72.07, pdrbPerCapita: 39.5,
      actualBudget: 9.6, danaDesa: 1.6, penerimaDTKS: 1050000,
      anomalies: { asnTniPolri: 3200, ganda: 9800, meninggal: 2900, exclusion: 17000 },
      latitude: -4.1449, longitude: 122.1746
    },
    {
      id: '75', name: 'Gorontalo', povertyRate: 15.15, p1: 2.65, p2: 0.64, ipm: 69.81, pdrbPerCapita: 28.4,
      actualBudget: 5.4, danaDesa: 0.6, penerimaDTKS: 490000,
      anomalies: { asnTniPolri: 1900, ganda: 4800, meninggal: 1400, exclusion: 9400 },
      latitude: 0.6999, longitude: 122.4500
    },
    {
      id: '76', name: 'Sulawesi Barat', povertyRate: 11.49, p1: 2.05, p2: 0.48, ipm: 66.92, pdrbPerCapita: 29.1,
      actualBudget: 4.8, danaDesa: 0.6, penerimaDTKS: 450000,
      anomalies: { asnTniPolri: 1500, ganda: 3900, meninggal: 1100, exclusion: 8800 },
      latitude: -2.8441, longitude: 119.2320
    },
    {
      id: '81', name: 'Maluku', povertyRate: 15.97, p1: 2.85, p2: 0.70, ipm: 70.22, pdrbPerCapita: 24.8,
      actualBudget: 7.2, danaDesa: 1.1, penerimaDTKS: 720000,
      anomalies: { asnTniPolri: 2600, ganda: 6400, meninggal: 1900, exclusion: 14200 },
      latitude: -3.2384, longitude: 130.1456
    },
    {
      id: '82', name: 'Maluku Utara', povertyRate: 6.37, p1: 0.85, p2: 0.18, ipm: 69.47, pdrbPerCapita: 42.5,
      actualBudget: 4.5, danaDesa: 0.8, penerimaDTKS: 420000,
      anomalies: { asnTniPolri: 1200, ganda: 3400, meninggal: 900, exclusion: 6100 },
      latitude: 1.5700, longitude: 127.8000
    },
    {
      id: '91', name: 'Papua Barat', povertyRate: 20.12, p1: 4.10, p2: 1.05, ipm: 65.89, pdrbPerCapita: 58.4,
      actualBudget: 10.8, danaDesa: 1.6, penerimaDTKS: 680000,
      anomalies: { asnTniPolri: 3100, ganda: 7800, meninggal: 2300, exclusion: 18000 },
      latitude: -1.3361, longitude: 132.5710
    },
    {
      id: '92', name: 'Papua', povertyRate: 26.03, p1: 5.85, p2: 1.68, ipm: 61.39, pdrbPerCapita: 49.5,
      actualBudget: 25.4, danaDesa: 4.5, penerimaDTKS: 1850000,
      anomalies: { asnTniPolri: 6200, ganda: 18500, meninggal: 5400, exclusion: 58000 },
      latitude: -4.2699, longitude: 138.0803
    },
    {
      id: '93', name: 'Papua Tengah', povertyRate: 24.50, p1: 5.20, p2: 1.45, ipm: 60.50, pdrbPerCapita: 38.5,
      actualBudget: 12.4, danaDesa: 2.1, penerimaDTKS: 850000,
      anomalies: { asnTniPolri: 2900, ganda: 9200, meninggal: 2600, exclusion: 24000 },
      latitude: -4.0000, longitude: 136.0000
    },
    {
      id: '94', name: 'Papua Pegunungan', povertyRate: 28.10, p1: 6.20, p2: 1.85, ipm: 59.20, pdrbPerCapita: 24.2,
      actualBudget: 14.6, danaDesa: 2.8, penerimaDTKS: 1100000,
      anomalies: { asnTniPolri: 3800, ganda: 11500, meninggal: 3100, exclusion: 36000 },
      latitude: -4.1000, longitude: 139.0000
    },
    {
      id: '95', name: 'Papua Selatan', povertyRate: 22.10, p1: 4.80, p2: 1.25, ipm: 61.50, pdrbPerCapita: 34.1,
      actualBudget: 8.9, danaDesa: 1.5, penerimaDTKS: 620000,
      anomalies: { asnTniPolri: 1900, ganda: 6400, meninggal: 1800, exclusion: 16000 },
      latitude: -6.8000, longitude: 140.0000
    },
    {
      id: '96', name: 'Papua Barat Daya', povertyRate: 18.50, p1: 3.60, p2: 0.95, ipm: 64.20, pdrbPerCapita: 42.8,
      actualBudget: 7.5, danaDesa: 0.9, penerimaDTKS: 550000,
      anomalies: { asnTniPolri: 1600, ganda: 5200, meninggal: 1400, exclusion: 11000 },
      latitude: -1.0000, longitude: 131.5000
    }
  ]);

  // 4. SUB-DATASETS KABUPATEN/KOTA UNTUK FILTER PROVINSI
  readonly kabKotaJawaBarat: RegionData[] = [
    {
      id: '3201', name: 'Kab. Bogor', povertyRate: 7.73, p1: 1.12, p2: 0.28, ipm: 71.85, pdrbPerCapita: 34.2,
      actualBudget: 120.5, danaDesa: 85.2, penerimaDTKS: 450000,
      anomalies: { asnTniPolri: 1240, ganda: 3450, meninggal: 980, exclusion: 4120 },
      latitude: -6.5971, longitude: 106.7949
    },
    {
      id: '3202', name: 'Kab. Sukabumi', povertyRate: 7.51, p1: 0.98, p2: 0.22, ipm: 68.32, pdrbPerCapita: 24.5,
      actualBudget: 85.3, danaDesa: 72.8, penerimaDTKS: 280000,
      anomalies: { asnTniPolri: 890, ganda: 2110, meninggal: 640, exclusion: 3200 },
      latitude: -6.9181, longitude: 106.9266
    },
    {
      id: '3203', name: 'Kab. Cianjur', povertyRate: 10.22, p1: 1.85, p2: 0.52, ipm: 66.58, pdrbPerCapita: 21.3,
      actualBudget: 95.0, danaDesa: 80.4, penerimaDTKS: 320000,
      anomalies: { asnTniPolri: 1450, ganda: 4120, meninggal: 1200, exclusion: 6800 },
      latitude: -7.2189, longitude: 107.1517
    },
    {
      id: '3204', name: 'Kab. Bandung', povertyRate: 6.56, p1: 0.76, p2: 0.15, ipm: 73.80, pdrbPerCapita: 38.9,
      actualBudget: 110.2, danaDesa: 65.5, penerimaDTKS: 390000,
      anomalies: { asnTniPolri: 920, ganda: 1890, meninggal: 750, exclusion: 2450 },
      latitude: -7.0252, longitude: 107.5198
    },
    {
      id: '3205', name: 'Kab. Garut', povertyRate: 9.97, p1: 1.62, p2: 0.44, ipm: 67.41, pdrbPerCapita: 19.8,
      actualBudget: 105.8, danaDesa: 98.2, penerimaDTKS: 350000,
      anomalies: { asnTniPolri: 1620, ganda: 4890, meninggal: 1430, exclusion: 7200 },
      latitude: -7.2279, longitude: 107.9087
    },
    {
      id: '3206', name: 'Kab. Tasikmalaya', povertyRate: 11.30, p1: 2.10, p2: 0.61, ipm: 67.22, pdrbPerCapita: 18.2,
      actualBudget: 98.4, danaDesa: 88.6, penerimaDTKS: 300000,
      anomalies: { asnTniPolri: 1540, ganda: 3980, meninggal: 1100, exclusion: 8400 },
      latitude: -7.3820, longitude: 108.1250
    },
    {
      id: '3207', name: 'Kab. Ciamis', povertyRate: 7.72, p1: 0.89, p2: 0.19, ipm: 71.18, pdrbPerCapita: 22.4,
      actualBudget: 62.0, danaDesa: 54.3, penerimaDTKS: 180000,
      anomalies: { asnTniPolri: 410, ganda: 1200, meninggal: 480, exclusion: 2100 },
      latitude: -7.3254, longitude: 108.3533
    },
    {
      id: '3208', name: 'Kab. Kuningan', povertyRate: 12.66, p1: 2.45, p2: 0.72, ipm: 70.16, pdrbPerCapita: 17.5,
      actualBudget: 74.5, danaDesa: 58.9, penerimaDTKS: 210000,
      anomalies: { asnTniPolri: 1890, ganda: 5200, meninggal: 1650, exclusion: 9100 },
      latitude: -6.9764, longitude: 108.4795
    },
    {
      id: '3209', name: 'Kab. Cirebon', povertyRate: 11.20, p1: 2.05, p2: 0.58, ipm: 70.08, pdrbPerCapita: 23.8,
      actualBudget: 115.6, danaDesa: 92.1, penerimaDTKS: 380000,
      anomalies: { asnTniPolri: 2110, ganda: 6410, meninggal: 1980, exclusion: 8800 },
      latitude: -6.7659, longitude: 108.5558
    },
    {
      id: '3210', name: 'Kab. Majalengka', povertyRate: 11.53, p1: 2.15, p2: 0.60, ipm: 68.55, pdrbPerCapita: 20.1,
      actualBudget: 68.2, danaDesa: 62.7, penerimaDTKS: 220000,
      anomalies: { asnTniPolri: 1180, ganda: 3200, meninggal: 950, exclusion: 6100 },
      latitude: -6.8378, longitude: 108.2238
    },
    {
      id: '3211', name: 'Kab. Sumedang', povertyRate: 9.76, p1: 1.55, p2: 0.40, ipm: 72.44, pdrbPerCapita: 25.1,
      actualBudget: 58.0, danaDesa: 48.2, penerimaDTKS: 160000,
      anomalies: { asnTniPolri: 740, ganda: 2150, meninggal: 590, exclusion: 3400 },
      latitude: -6.8589, longitude: 107.9189
    },
    {
      id: '3212', name: 'Kab. Indramayu', povertyRate: 12.13, p1: 2.30, p2: 0.68, ipm: 68.12, pdrbPerCapita: 29.5,
      actualBudget: 125.4, danaDesa: 112.5, penerimaDTKS: 410000,
      anomalies: { asnTniPolri: 2540, ganda: 7120, meninggal: 2310, exclusion: 11200 },
      latitude: -6.3267, longitude: 108.3249
    },
    {
      id: '3213', name: 'Kab. Subang', povertyRate: 9.38, p1: 1.42, p2: 0.38, ipm: 69.87, pdrbPerCapita: 27.2,
      actualBudget: 72.8, danaDesa: 68.1, penerimaDTKS: 230000,
      anomalies: { asnTniPolri: 980, ganda: 2800, meninggal: 810, exclusion: 4200 },
      latitude: -6.5715, longitude: 107.7622
    },
    {
      id: '3214', name: 'Kab. Purwakarta', povertyRate: 6.28, p1: 0.72, p2: 0.13, ipm: 71.39, pdrbPerCapita: 48.6,
      actualBudget: 42.1, danaDesa: 32.5, penerimaDTKS: 110000,
      anomalies: { asnTniPolri: 310, ganda: 920, meninggal: 290, exclusion: 1200 },
      latitude: -6.5569, longitude: 107.4429
    },
    {
      id: '3215', name: 'Kab. Karawang', povertyRate: 7.82, p1: 1.05, p2: 0.25, ipm: 71.74, pdrbPerCapita: 82.5,
      actualBudget: 94.6, danaDesa: 68.9, penerimaDTKS: 290000,
      anomalies: { asnTniPolri: 1120, ganda: 2950, meninggal: 870, exclusion: 3100 },
      latitude: -6.3024, longitude: 107.3075
    },
    {
      id: '3216', name: 'Kab. Bekasi', povertyRate: 5.30, p1: 0.61, p2: 0.11, ipm: 74.45, pdrbPerCapita: 110.4,
      actualBudget: 88.0, danaDesa: 42.3, penerimaDTKS: 310000,
      anomalies: { asnTniPolri: 890, ganda: 2450, meninggal: 780, exclusion: 1800 },
      latitude: -6.2191, longitude: 107.1704
    },
    {
      id: '3217', name: 'Kab. Bandung Barat', povertyRate: 10.52, p1: 1.90, p2: 0.50, ipm: 69.04, pdrbPerCapita: 26.8,
      actualBudget: 78.5, danaDesa: 54.6, penerimaDTKS: 240000,
      anomalies: { asnTniPolri: 1320, ganda: 3890, meninggal: 1080, exclusion: 5900 },
      latitude: -6.8437, longitude: 107.4729
    },
    {
      id: '3218', name: 'Kab. Pangandaran', povertyRate: 9.11, p1: 1.35, p2: 0.35, ipm: 69.02, pdrbPerCapita: 21.0,
      actualBudget: 28.4, danaDesa: 24.8, penerimaDTKS: 750000,
      anomalies: { asnTniPolri: 290, ganda: 880, meninggal: 240, exclusion: 1950 },
      latitude: -7.7024, longitude: 108.4965
    },
    {
      id: '3271', name: 'Kota Bogor', povertyRate: 7.10, p1: 0.92, p2: 0.20, ipm: 76.85, pdrbPerCapita: 42.3,
      actualBudget: 35.2, danaDesa: 0.0, penerimaDTKS: 115000,
      anomalies: { asnTniPolri: 410, ganda: 1100, meninggal: 350, exclusion: 1400 },
      latitude: -6.5950, longitude: 106.8166
    },
    {
      id: '3272', name: 'Kota Sukabumi', povertyRate: 8.02, p1: 1.15, p2: 0.26, ipm: 74.60, pdrbPerCapita: 32.1,
      actualBudget: 18.5, danaDesa: 0.0, penerimaDTKS: 55000,
      anomalies: { asnTniPolri: 190, ganda: 520, meninggal: 160, exclusion: 890 },
      latitude: -6.9277, longitude: 106.9300
    },
    {
      id: '3273', name: 'Kota Bandung', povertyRate: 4.25, p1: 0.45, p2: 0.08, ipm: 82.50, pdrbPerCapita: 98.4,
      actualBudget: 72.4, danaDesa: 0.0, penerimaDTKS: 210000,
      anomalies: { asnTniPolri: 620, ganda: 1750, meninggal: 510, exclusion: 1100 },
      latitude: -6.9175, longitude: 107.6191
    },
    {
      id: '3274', name: 'Kota Cirebon', povertyRate: 9.82, p1: 1.58, p2: 0.42, ipm: 75.88, pdrbPerCapita: 48.9,
      actualBudget: 22.1, danaDesa: 0.0, penerimaDTKS: 68000,
      anomalies: { asnTniPolri: 320, ganda: 980, meninggal: 290, exclusion: 1700 },
      latitude: -6.7320, longitude: 108.5555
    },
    {
      id: '3275', name: 'Kota Bekasi', povertyRate: 4.10, p1: 0.42, p2: 0.07, ipm: 82.20, pdrbPerCapita: 89.2,
      actualBudget: 68.0, danaDesa: 0.0, penerimaDTKS: 220000,
      anomalies: { asnTniPolri: 510, ganda: 1620, meninggal: 480, exclusion: 950 },
      latitude: -6.2383, longitude: 106.9756
    },
    {
      id: '3276', name: 'Kota Depok', povertyRate: 2.53, p1: 0.22, p2: 0.03, ipm: 81.86, pdrbPerCapita: 68.4,
      actualBudget: 38.5, danaDesa: 0.0, penerimaDTKS: 130000,
      anomalies: { asnTniPolri: 280, ganda: 920, meninggal: 250, exclusion: 410 },
      latitude: -6.4025, longitude: 106.7942
    },
    {
      id: '3277', name: 'Kota Cimahi', povertyRate: 5.52, p1: 0.65, p2: 0.13, ipm: 78.90, pdrbPerCapita: 55.4,
      actualBudget: 19.8, danaDesa: 0.0, penerimaDTKS: 62000,
      anomalies: { asnTniPolri: 180, ganda: 540, meninggal: 190, exclusion: 620 },
      latitude: -6.8724, longitude: 107.5414
    },
    {
      id: '3278', name: 'Kota Tasikmalaya', povertyRate: 12.72, p1: 2.50, p2: 0.74, ipm: 73.85, pdrbPerCapita: 28.5,
      actualBudget: 42.6, danaDesa: 0.0, penerimaDTKS: 118000,
      anomalies: { asnTniPolri: 980, ganda: 2800, meninggal: 910, exclusion: 4900 },
      latitude: -7.3274, longitude: 108.2207
    },
    {
      id: '3279', name: 'Kota Banjar', povertyRate: 6.95, p1: 0.85, p2: 0.18, ipm: 72.20, pdrbPerCapita: 22.8,
      actualBudget: 11.2, danaDesa: 0.0, penerimaDTKS: 35000,
      anomalies: { asnTniPolri: 90, ganda: 280, meninggal: 70, exclusion: 420 },
      latitude: -7.3719, longitude: 108.5361
    }
  ];

  readonly kabKotaDkiJakarta: RegionData[] = [
    {
      id: '3101', name: 'Kep. Seribu', povertyRate: 11.20, p1: 1.85, p2: 0.38, ipm: 72.44, pdrbPerCapita: 42.1,
      actualBudget: 2.4, danaDesa: 0.0, penerimaDTKS: 22000,
      anomalies: { asnTniPolri: 80, ganda: 240, meninggal: 90, exclusion: 650 },
      latitude: -5.5959, longitude: 106.5500
    },
    {
      id: '3171', name: 'Jakarta Pusat', povertyRate: 3.80, p1: 0.38, p2: 0.06, ipm: 82.50, pdrbPerCapita: 312.4,
      actualBudget: 11.2, danaDesa: 0.0, penerimaDTKS: 550000,
      anomalies: { asnTniPolri: 650, ganda: 4200, meninggal: 1800, exclusion: 2100 },
      latitude: -6.1864, longitude: 106.8340
    },
    {
      id: '3172', name: 'Jakarta Utara', povertyRate: 5.30, p1: 0.65, p2: 0.11, ipm: 78.44, pdrbPerCapita: 115.8,
      actualBudget: 12.8, danaDesa: 0.0, penerimaDTKS: 720000,
      anomalies: { asnTniPolri: 980, ganda: 6400, meninggal: 2400, exclusion: 3800 },
      latitude: -6.1384, longitude: 106.8640
    },
    {
      id: '3173', name: 'Jakarta Barat', povertyRate: 4.20, p1: 0.45, p2: 0.08, ipm: 79.52, pdrbPerCapita: 98.4,
      actualBudget: 13.5, danaDesa: 0.0, penerimaDTKS: 650000,
      anomalies: { asnTniPolri: 810, ganda: 5200, meninggal: 1950, exclusion: 2900 },
      latitude: -6.1683, longitude: 106.7583
    },
    {
      id: '3174', name: 'Jakarta Selatan', povertyRate: 3.10, p1: 0.30, p2: 0.05, ipm: 83.12, pdrbPerCapita: 185.4,
      actualBudget: 10.4, danaDesa: 0.0, penerimaDTKS: 420000,
      anomalies: { asnTniPolri: 410, ganda: 3100, meninggal: 1400, exclusion: 1200 },
      latitude: -6.2614, longitude: 106.8106
    },
    {
      id: '3175', name: 'Jakarta Timur', povertyRate: 4.50, p1: 0.50, p2: 0.09, ipm: 80.22, pdrbPerCapita: 82.5,
      actualBudget: 15.1, danaDesa: 0.0, penerimaDTKS: 850000,
      anomalies: { asnTniPolri: 1100, ganda: 8200, meninggal: 3100, exclusion: 4100 },
      latitude: -6.2250, longitude: 106.9000
    }
  ];

  readonly kabKotaJawaTimur: RegionData[] = [
    {
      id: '3501', name: 'Kab. Pacitan', povertyRate: 13.80, p1: 2.30, p2: 0.55, ipm: 68.90, pdrbPerCapita: 22.4,
      actualBudget: 12.8, danaDesa: 8.5, penerimaDTKS: 180000,
      anomalies: { asnTniPolri: 520, ganda: 1850, meninggal: 640, exclusion: 2400 },
      latitude: -8.1844, longitude: 111.1000
    },
    {
      id: '3510', name: 'Kab. Banyuwangi', povertyRate: 7.20, p1: 0.95, p2: 0.20, ipm: 71.44, pdrbPerCapita: 48.5,
      actualBudget: 35.4, danaDesa: 24.2, penerimaDTKS: 410000,
      anomalies: { asnTniPolri: 1100, ganda: 3400, meninggal: 1150, exclusion: 3800 },
      latitude: -8.2192, longitude: 114.3691
    },
    {
      id: '3509', name: 'Kab. Jember', povertyRate: 9.80, p1: 1.55, p2: 0.38, ipm: 67.89, pdrbPerCapita: 26.2,
      actualBudget: 42.8, danaDesa: 32.5, penerimaDTKS: 650000,
      anomalies: { asnTniPolri: 1650, ganda: 5200, meninggal: 1850, exclusion: 6800 },
      latitude: -8.1844, longitude: 113.6680
    },
    {
      id: '3573', name: 'Kota Malang', povertyRate: 4.30, p1: 0.45, p2: 0.08, ipm: 82.04, pdrbPerCapita: 74.8,
      actualBudget: 18.5, danaDesa: 0.0, penerimaDTKS: 150000,
      anomalies: { asnTniPolri: 320, ganda: 1200, meninggal: 480, exclusion: 1100 },
      latitude: -7.9797, longitude: 112.6304
    },
    {
      id: '3578', name: 'Kota Surabaya', povertyRate: 4.80, p1: 0.50, p2: 0.09, ipm: 82.90, pdrbPerCapita: 185.6,
      actualBudget: 62.4, danaDesa: 0.0, penerimaDTKS: 780000,
      anomalies: { asnTniPolri: 1200, ganda: 6200, meninggal: 2100, exclusion: 3400 },
      latitude: -7.2575, longitude: 112.7521
    }
  ];

  readonly kabKotaAceh: RegionData[] = [
    {
      id: '1171', name: 'Kota Banda Aceh', povertyRate: 7.15, p1: 1.05, p2: 0.22, ipm: 85.47, pdrbPerCapita: 78.4,
      actualBudget: 4.8, danaDesa: 0.0, penerimaDTKS: 85000,
      anomalies: { asnTniPolri: 280, ganda: 920, meninggal: 350, exclusion: 1100 },
      latitude: 5.5619, longitude: 95.3193
    },
    {
      id: '1173', name: 'Kota Lhokseumawe', povertyRate: 9.85, p1: 1.55, p2: 0.38, ipm: 77.20, pdrbPerCapita: 48.2,
      actualBudget: 3.2, danaDesa: 0.0, penerimaDTKS: 62000,
      anomalies: { asnTniPolri: 190, ganda: 740, meninggal: 220, exclusion: 1400 },
      latitude: 5.1804, longitude: 97.1507
    },
    {
      id: '1106', name: 'Kab. Aceh Besar', povertyRate: 13.56, p1: 2.15, p2: 0.52, ipm: 73.58, pdrbPerCapita: 32.1,
      actualBudget: 15.0, danaDesa: 12.4, penerimaDTKS: 190000,
      anomalies: { asnTniPolri: 890, ganda: 2450, meninggal: 780, exclusion: 3800 },
      latitude: 5.3787, longitude: 95.5222
    },
    {
      id: '1108', name: 'Kab. Aceh Utara', povertyRate: 16.85, p1: 2.85, p2: 0.72, ipm: 69.80, pdrbPerCapita: 28.5,
      actualBudget: 24.2, danaDesa: 18.5, penerimaDTKS: 320000,
      anomalies: { asnTniPolri: 1540, ganda: 4890, meninggal: 1430, exclusion: 7200 },
      latitude: 5.0222, longitude: 97.2000
    },
    {
      id: '1104', name: 'Kab. Aceh Tengah', povertyRate: 14.90, p1: 2.45, p2: 0.62, ipm: 73.15, pdrbPerCapita: 34.2,
      actualBudget: 8.5, danaDesa: 6.8, penerimaDTKS: 110000,
      anomalies: { asnTniPolri: 520, ganda: 1850, meninggal: 540, exclusion: 2400 },
      latitude: 4.5833, longitude: 96.9000
    },
    {
      id: '1105', name: 'Kab. Aceh Barat', povertyRate: 17.95, p1: 3.10, p2: 0.82, ipm: 71.35, pdrbPerCapita: 38.9,
      actualBudget: 11.2, danaDesa: 8.9, penerimaDTKS: 125000,
      anomalies: { asnTniPolri: 620, ganda: 2110, meninggal: 640, exclusion: 3200 },
      latitude: 4.4500, longitude: 96.1800
    },
    {
      id: '1101', name: 'Kab. Aceh Selatan', povertyRate: 12.18, p1: 1.95, p2: 0.45, ipm: 67.22, pdrbPerCapita: 22.8,
      actualBudget: 9.6, danaDesa: 7.5, penerimaDTKS: 130000,
      anomalies: { asnTniPolri: 410, ganda: 1400, meninggal: 480, exclusion: 2100 },
      latitude: 3.2500, longitude: 97.2200
    }
  ];

  // 5. COMPUTED SIGNAL YANG DIBACA OLEH UI (DAPAT DISKALA SECARA DINAMIS)
  readonly activeRegions = computed(() => {
    const scope = this.selectedScope();
    if (scope === 'nasional') {
      return this.provinces();
    }
    
    // Temukan data provinsi induk untuk basis angka
    const parentProv = this.provinces().find(p => p.id === scope);
    if (!parentProv) return [];

    if (scope === '32') return this.kabKotaJawaBarat;
    if (scope === '31') return this.kabKotaDkiJakarta;
    if (scope === '35') return this.kabKotaJawaTimur;
    if (scope === '11') return this.kabKotaAceh;

    // Generasi dinamis untuk provinsi lain agar navigasi interaktif tetap berjalan untuk semua 38 provinsi
    return [
      {
        id: `${scope}01`, name: `Kab. ${parentProv.name} Barat`, 
        povertyRate: Math.round(parentProv.povertyRate * 1.15 * 100) / 100,
        p1: Math.round(parentProv.p1 * 1.1 * 100) / 100, p2: Math.round(parentProv.p2 * 1.1 * 100) / 100,
        ipm: Math.round(parentProv.ipm * 0.95 * 100) / 100, pdrbPerCapita: Math.round(parentProv.pdrbPerCapita * 0.7 * 10) / 10,
        actualBudget: Math.round(parentProv.actualBudget * 45) / 10, // Konversi skala T ke Miliar untuk Kab/Kota
        danaDesa: Math.round(parentProv.danaDesa * 50) / 10,
        penerimaDTKS: Math.round(parentProv.penerimaDTKS * 0.4),
        anomalies: {
          asnTniPolri: Math.round(parentProv.anomalies.asnTniPolri * 0.4),
          ganda: Math.round(parentProv.anomalies.ganda * 0.4),
          meninggal: Math.round(parentProv.anomalies.meninggal * 0.4),
          exclusion: Math.round(parentProv.anomalies.exclusion * 0.45)
        },
        latitude: parentProv.latitude + 0.35, longitude: parentProv.longitude - 0.35
      },
      {
        id: `${scope}02`, name: `Kab. ${parentProv.name} Timur`, 
        povertyRate: Math.round(parentProv.povertyRate * 0.95 * 100) / 100,
        p1: Math.round(parentProv.p1 * 0.9 * 100) / 100, p2: Math.round(parentProv.p2 * 0.9 * 100) / 100,
        ipm: Math.round(parentProv.ipm * 0.98 * 100) / 100, pdrbPerCapita: Math.round(parentProv.pdrbPerCapita * 0.8 * 10) / 10,
        actualBudget: Math.round(parentProv.actualBudget * 35) / 10,
        danaDesa: Math.round(parentProv.danaDesa * 40) / 10,
        penerimaDTKS: Math.round(parentProv.penerimaDTKS * 0.35),
        anomalies: {
          asnTniPolri: Math.round(parentProv.anomalies.asnTniPolri * 0.35),
          ganda: Math.round(parentProv.anomalies.ganda * 0.35),
          meninggal: Math.round(parentProv.anomalies.meninggal * 0.35),
          exclusion: Math.round(parentProv.anomalies.exclusion * 0.35)
        },
        latitude: parentProv.latitude - 0.35, longitude: parentProv.longitude + 0.35
      },
      {
        id: `${scope}03`, name: `Kota ${parentProv.name}`, 
        povertyRate: Math.round(parentProv.povertyRate * 0.65 * 100) / 100,
        p1: Math.round(parentProv.p1 * 0.6 * 100) / 100, p2: Math.round(parentProv.p2 * 0.6 * 100) / 100,
        ipm: Math.round(parentProv.ipm * 1.08 * 100) / 100, pdrbPerCapita: Math.round(parentProv.pdrbPerCapita * 1.8 * 10) / 10,
        actualBudget: Math.round(parentProv.actualBudget * 20) / 10,
        danaDesa: 0,
        penerimaDTKS: Math.round(parentProv.penerimaDTKS * 0.25),
        anomalies: {
          asnTniPolri: Math.round(parentProv.anomalies.asnTniPolri * 0.25),
          ganda: Math.round(parentProv.anomalies.ganda * 0.25),
          meninggal: Math.round(parentProv.anomalies.meninggal * 0.25),
          exclusion: Math.round(parentProv.anomalies.exclusion * 0.2)
        },
        latitude: parentProv.latitude, longitude: parentProv.longitude
      }
    ];
  });

  // STATISTIK NASIONAL TERPADU (TETAP STABIL BERDASARKAN PROVINSI)
  readonly totalBudget = computed(() => this.provinces().reduce((sum, r) => sum + r.actualBudget, 0));
  readonly totalPenerima = computed(() => this.provinces().reduce((sum, r) => sum + r.penerimaDTKS, 0));
  readonly totalAnomalies = computed(() => {
    return this.provinces().reduce((sum, r) => {
      const a = r.anomalies;
      return sum + a.asnTniPolri + a.ganda + a.meninggal + a.exclusion;
    }, 0);
  });

  readonly anomalyAlerts = computed(() => {
    const alerts: Array<{ regionName: string; type: string; count: number; severity: 'high' | 'medium'; longitude: number }> = [];
    this.provinces().forEach(r => {
      if (r.anomalies.asnTniPolri > 15000) {
        alerts.push({ regionName: r.name, type: 'Penerima ASN/TNI/Polri Aktif', count: r.anomalies.asnTniPolri, severity: 'high', longitude: r.longitude });
      }
      if (r.anomalies.exclusion > 50000) {
        alerts.push({ regionName: r.name, type: 'Exclusion Error (Sangat Miskin Terlewat)', count: r.anomalies.exclusion, severity: 'high', longitude: r.longitude });
      }
      if (r.anomalies.ganda > 40000) {
        alerts.push({ regionName: r.name, type: 'Identitas Ganda/Duplikat', count: r.anomalies.ganda, severity: 'medium', longitude: r.longitude });
      }
    });
    return alerts.sort((a, b) => a.longitude - b.longitude);
  });

  // 6. OPTIMIZER STATE (BERJALAN DINAMIS SESUAI CAKUPAN YANG DIPILIH)
  readonly weightPoverty = signal<number>(40);
  readonly weightIpm = signal<number>(20);
  readonly weightP1P2 = signal<number>(20);
  readonly weightExclusion = signal<number>(20);

  readonly optimizedAllocations = computed(() => {
    const wPoverty = this.weightPoverty();
    const wIpm = this.weightIpm();
    const wP1P2 = this.weightP1P2();
    const wExclusion = this.weightExclusion();
    const totalW = wPoverty + wIpm + wP1P2 + wExclusion;

    const list = this.activeRegions();
    const totalActualBudget = list.reduce((sum, r) => sum + r.actualBudget, 0);

    const rawScores = list.map(r => {
      // Normalisasi dinamis
      const maxPoverty = Math.max(...list.map(reg => reg.povertyRate)) || 1;
      const normPoverty = r.povertyRate / maxPoverty;

      const minIpm = Math.min(...list.map(reg => reg.ipm)) || 1;
      const maxIpm = Math.max(...list.map(reg => reg.ipm)) || 100;
      const normIpm = (maxIpm - r.ipm) / (maxIpm - minIpm || 1);

      const normP1P2 = (r.p1 + r.p2) / 8;
      const normExclusion = (r.anomalies.exclusion / r.penerimaDTKS) * 5;

      const vulnerabilityScore = (
        (normPoverty * wPoverty) +
        (normIpm * wIpm) +
        (normP1P2 * wP1P2) +
        (normExclusion * wExclusion)
      ) / totalW;

      return {
        ...r,
        vulnerabilityScore: Math.min(10, Math.max(1, vulnerabilityScore * 10))
      };
    });

    const sumVulnerability = rawScores.reduce((sum, r) => sum + r.vulnerabilityScore, 0);

    return rawScores.map(r => {
      const optimizedBudget = (r.vulnerabilityScore / sumVulnerability) * totalActualBudget;
      const diff = optimizedBudget - r.actualBudget;
      const pctChange = (diff / r.actualBudget) * 100;

      return {
        id: r.id,
        name: r.name,
        actualBudget: r.actualBudget,
        optimizedBudget: Math.round(optimizedBudget * 10) / 10,
        vulnerabilityScore: Math.round(r.vulnerabilityScore * 100) / 100,
        difference: Math.round(diff * 10) / 10,
        pctChange: Math.round(pctChange * 10) / 10,
        longitude: r.longitude
      };
    }).sort((a, b) => a.longitude - b.longitude);
  });

  // 7. CHATBOT MESSAGES
  readonly chatMessages = signal<ChatMessage[]>([
    {
      id: 'init-1',
      sender: 'jusi',
      text: 'Halo! Saya JUSI (Juru Bantuan Sosial Interaktif), Copilot kebijakan sosial nasional Anda. Silakan tanyakan data kemiskinan provinsi, analisis anggaran APBN/TKDD nasional, atau simulasi kebijakan BRANTAS.',
      timestamp: new Date()
    }
  ]);

  // SIMULASI PIPELINE RUN
  runDataPipeline(): void {
    if (this.isPipelineRunning()) return;

    this.isPipelineRunning.set(true);
    this.pipelineProgress.set(0);
    this.pipelineStatusText.set('Menghubungkan ke API BPS Nasional & Portal DJPK...');

    const interval = setInterval(() => {
      const currentProgress = this.pipelineProgress();
      if (currentProgress < 30) {
        this.pipelineProgress.set(currentProgress + 5);
        this.pipelineStatusText.set('Mengunduh dataset makro kemiskinan 38 Provinsi BPS 2026...');
      } else if (currentProgress < 60) {
        this.pipelineProgress.set(currentProgress + 8);
        this.pipelineStatusText.set('Sinkronisasi data realisasi belanja Perlinsos Kemenkeu seluruh Provinsi...');
      } else if (currentProgress < 85) {
        this.pipelineProgress.set(currentProgress + 6);
        this.pipelineStatusText.set('Mengekstrak data spasial BIG & data P3KE Kemenko PMK Nasional...');
      } else if (currentProgress < 100) {
        this.pipelineProgress.set(currentProgress + 4);
        this.pipelineStatusText.set('Menjalankan Cross-Dataset Anomaly Checker (AI Engine Nasional)...');
      } else {
        clearInterval(interval);
        this.isPipelineRunning.set(false);
        this.lastPipelineRun.set(new Date());
        this.pipelineStatusText.set('Ingestion Nasional Berhasil! 38 Provinsi tersinkronisasi, AI Model ter-update.');

        // Simulasikan perbaikan kecil pada data
        const updatedProvs = this.provinces().map(r => ({
          ...r,
          anomalies: {
            asnTniPolri: Math.max(100, Math.floor(r.anomalies.asnTniPolri * 0.95)),
            ganda: Math.max(500, Math.floor(r.anomalies.ganda * 0.92)),
            meninggal: Math.max(200, Math.floor(r.anomalies.meninggal * 0.90)),
            exclusion: Math.max(1000, Math.floor(r.anomalies.exclusion * 0.97))
          }
        }));
        this.provinces.set(updatedProvs);
      }
    }, 300);
  }

  sendMessageToJusi(messageText: string): void {
    if (!messageText.trim()) return;

    const userMsg: ChatMessage = {
      id: `user-${Date.now()}`,
      sender: 'user',
      text: messageText,
      timestamp: new Date()
    };
    this.chatMessages.update(msgs => [...msgs, userMsg]);

    setTimeout(() => {
      const responseText = this.generateJusiResponse(messageText);
      const jusiMsg: ChatMessage = {
        id: `jusi-${Date.now()}`,
        sender: 'jusi',
        text: responseText,
        timestamp: new Date()
      };
      this.chatMessages.update(msgs => [...msgs, jusiMsg]);
    }, 800);
  }

  private generateJusiResponse(prompt: string): string {
    const text = prompt.toLowerCase();

    const outOfScopeKeywords = [
      'presiden', 'pemilu', 'prabowo', 'gibran', 'anies', 'ganjar', 'partai', 'pilkada', 'politik',
      'resep', 'masak', 'cuaca', 'lagu', 'film', 'game', 'bermain', 'wisata', 'hiburan',
      'siapa kamu', 'luar angkasa', 'bercanda', 'pantun', 'puisi', 'cerita lucu'
    ];

    const isOutOfScope = outOfScopeKeywords.some(keyword => {
      return text.includes(keyword);
    });

    if (isOutOfScope) {
      return 'Mohon maaf, ruang lingkup pengetahuan saya dibatasi khusus untuk analisis data kemiskinan, alokasi anggaran APBN/TKDD, dan rekomendasi kebijakan pada sistem BRANTAS.';
    }

    if (text.includes('brantas') && (text.includes('apa') || text.includes('penjelasan'))) {
      return 'BRANTAS (Basis Rekomendasi & Analisis Terpadu Anggaran Sosial) adalah sistem terpadu berbasis AI untuk mengintegrasikan data kemiskinan lintas instansi, mendeteksi anomali anggaran secara real-time, memetakan kantong kemiskinan spasial seluruh Indonesia, serta merumuskan rekomendasi kebijakan alokasi anggaran perlindungan sosial secara presisi.';
    }

    if (text.includes('kemiskinan') && (text.includes('nasional') || text.includes('bps') || text.includes('persen'))) {
      return 'Berdasarkan rilis resmi BPS per Maret 2026, persentase penduduk miskin secara nasional adalah sebesar 8,07% (sekitar 22,93 juta jiwa). Angka ini menunjukkan tren penurunan konsisten dibandingkan posisi September 2025 yang tercatat sebesar 8,25% (23,36 juta jiwa). Target jangka panjang kita adalah menuju 0% kemiskinan ekstrem melalui Precision Fiscal Governance.';
    }

    if (text.includes('anggaran') || text.includes('apbn') || text.includes('dana')) {
      return 'Alokasi anggaran Perlindungan Sosial terus mengalami kenaikan dalam APBN, yaitu Rp493,5 Triliun (2024), Rp504,7 Triliun (2025), hingga mencapai Rp508,2 Triliun pada APBN 2026. Selain itu, porsi Transfer ke Daerah (TKDD) seperti Dana Desa juga sangat bergantung pada indikator kemiskinan daerah sebagai variabel penimbang fiskal.';
    }

    if (text.includes('anomali') || text.includes('salah sasaran') || text.includes('asn') || text.includes('tni') || text.includes('polri')) {
      const topAnomalyRegion = [...this.provinces()].sort((a, b) => b.anomalies.asnTniPolri - a.anomalies.asnTniPolri)[0];
      return `Berdasarkan data audit AI terpadu nasional, terdeteksi beberapa anomali inklusi di tingkat provinsi. Provinsi dengan anomali penerima dari kalangan ASN/TNI/Polri tertinggi saat ini berada di ${topAnomalyRegion.name} dengan ${this.getFormattedNumber(topAnomalyRegion.anomalies.asnTniPolri)} kasus. Kami merekomendasikan pembersihan data NIK bekerjasama dengan Kemendagri secara terintegrasi untuk menghemat anggaran bansos hingga 30-40%.`;
    }

    if (text.includes('rekomendasi') || text.includes('kebijakan') || text.includes('fiskal')) {
      return 'Berdasarkan model Causal Policy Evaluator, kami menyarankan 3 poin kebijakan: 1) Re-alokasi anggaran perlinsos sebesar Rp12,4 Triliun ke 5 wilayah dengan tingkat kerentanan ekstrem (vulnerability score > 8.5), 2) Menyesuaikan formula pembobotan TKDD dengan menambah bobot persentase kemiskinan dari 40% menjadi 55%, dan 3) Melakukan sinkronisasi data kependudukan secara near real-time bulanan.';
    }

    if (text.includes('vulnerability') || text.includes('skor') || text.includes('kerentanan') || text.includes('tertinggi')) {
      const highVulnerable = [...this.optimizedAllocations()]
        .sort((a, b) => b.vulnerabilityScore - a.vulnerabilityScore)
        .slice(0, 3);
      const details = highVulnerable.map(h => `${h.name} (Skor: ${h.vulnerabilityScore})`).join(', ');
      return `Berdasarkan parameter pembobotan saat ini, 3 provinsi dengan tingkat kerentanan (Vulnerability Score) tertinggi di Indonesia adalah: ${details}. Kami menyarankan prioritas alokasi dana bantuan sosial dan peningkatan transfer daerah khusus pada wilayah tersebut.`;
    }

    return 'Pertanyaan Anda sangat menarik. Secara umum, sistem BRANTAS menyarankan restrukturisasi alokasi anggaran perlindungan sosial dengan mengintegrasikan data mikro dari BPS, Kemenkeu, dan Bappenas. Hal ini akan mengurangi error inklusi dan eksklusi secara drastis dari rata-rata 14 hari proses manual menjadi di bawah 10 menit (near real-time). Ada data spesifik wilayah Indonesia yang ingin Anda ketahui?';
  }

  private getFormattedNumber(value: number): string {
    return new Intl.NumberFormat('id-ID').format(value);
  }
}
