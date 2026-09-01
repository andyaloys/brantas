import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { BrantasStateService } from '../../services/brantas-state.service';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './dashboard.html',
  styleUrl: './dashboard.css'
})
export class DashboardComponent {
  protected readonly state = inject(BrantasStateService);

  getFormattedCurrency(value: number): string {
    return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 1 })
      .format(value * 1000000000000) // Konversi Rp Triliun ke Rupiah utuh
      .replace('IDR', 'Rp');
  }

  getFormattedNumber(value: number): string {
    return new Intl.NumberFormat('id-ID').format(value);
  }

  triggerPipeline(): void {
    this.state.runDataPipeline();
  }
}
