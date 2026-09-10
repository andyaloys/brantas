import { ChangeDetectionStrategy, Component } from '@angular/core';
import { CommonModule } from '@angular/common';

export interface IntelligenceItem {
  id: string;
  category: string;
  badgeClass: 'danger' | 'warning' | 'success' | 'info';
  icon: string;
  message: string;
  timestamp: string;
}

@Component({
  selector: 'app-executive-ticker',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './executive-ticker.component.html',
  styleUrl: './executive-ticker.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ExecutiveTickerComponent {
  readonly items: IntelligenceItem[] = [
    {
      id: '1',
      category: 'PERINGATAN ANGGARAN',
      badgeClass: 'danger',
      icon: 'pi-exclamation-triangle',
      message: '3 Kabupaten di Papua Tengah terdeteksi kekurangan alokasi bantuan sosial sebesar Rp18,4 Miliar jika dibandingkan dengan tingkat keparahan kemiskinan setempat.',
      timestamp: 'AKTUAL'
    },
    {
      id: '2',
      category: 'VERIFIKASI PENERIMA',
      badgeClass: 'warning',
      icon: 'pi-shield',
      message: 'Sebanyak 14.280 NIK ganda dan 3.410 penerima berstatus ASN/TNI terdeteksi masuk dalam daftar penerima bantuan kemiskinan ekstrem daerah.',
      timestamp: 'TERVERIFIKASI'
    },
    {
      id: '3',
      category: 'EVALUASI DAMPAK BANSOS',
      badgeClass: 'success',
      icon: 'pi-bolt',
      message: 'Penyaluran bantuan afirmatif terbukti mempercepat penurunan angka kemiskinan daerah hingga 1,42 persen lebih cepat dibanding metode konvensional.',
      timestamp: 'HASIL EVALUASI'
    },
    {
      id: '4',
      category: 'PEMERATAAN ANGGARAN',
      badgeClass: 'info',
      icon: 'pi-sliders-h',
      message: 'Simulasi pemerataan anggaran mampu meningkatkan ketepatan sasaran bantuan di 38 provinsi sebesar 12,8% tanpa menambah total pagu belanja APBN.',
      timestamp: 'REKOMENDASI'
    },
    {
      id: '5',
      category: 'SASARAN RPJMN 2026',
      badgeClass: 'success',
      icon: 'pi-flag',
      message: 'Target nasional penurunan kemiskinan menuju 7,5% pada 2026 membutuhkan percepatan graduasi mandiri bagi keluarga penerima manfaat PKH.',
      timestamp: 'TARGET NASIONAL'
    }
  ];
}
