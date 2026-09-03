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
      category: 'PERINGATAN FISKAL',
      badgeClass: 'danger',
      icon: 'pi-exclamation-triangle',
      message: '3 Kabupaten di Papua Tengah mengalami indikasi under-allocation belanja bansos Rp18,4 Miliar terhadap rasio kedalaman kemiskinan (P1).',
      timestamp: 'LIVE'
    },
    {
      id: '2',
      category: 'AUDIT REGSOSEK NIK',
      badgeClass: 'warning',
      icon: 'pi-shield',
      message: '14.280 NIK ganda & 3.410 NIK berstatus ASN/TNI aktif teridentifikasi dalam desil 1 bansos daerah.',
      timestamp: 'ONNX 2026'
    },
    {
      id: '3',
      category: 'EVALUASI DAMPAK TWFE',
      badgeClass: 'success',
      icon: 'pi-bolt',
      message: 'Model Difference-in-Differences membuktikan intervensi formula IKW mempercepat penurunan kemiskinan sebesar 1,42 pp (p < 0.01).',
      timestamp: 'VERIFIED'
    },
    {
      id: '4',
      category: 'OPTIMASI FORMULASI',
      badgeClass: 'info',
      icon: 'pi-sliders-h',
      message: 'Simulasi GLOP Google OR-Tools meningkatkan keadilan alokasi ke 38 provinsi sebesar 12,8% tanpa menaikkan pagu total APBN.',
      timestamp: 'OPTIMAL'
    }
  ];
}
