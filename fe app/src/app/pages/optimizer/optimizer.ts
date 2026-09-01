import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { BrantasStateService } from '../../services/brantas-state.service';

@Component({
  selector: 'app-optimizer',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './optimizer.html',
  styleUrl: './optimizer.css'
})
export class OptimizerComponent {
  protected readonly state = inject(BrantasStateService);

  getFormattedCurrency(value: number): string {
    return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 1 })
      .format(value * 1000000000000)
      .replace('IDR', 'Rp');
  }

  getFormattedNumber(value: number): string {
    return new Intl.NumberFormat('id-ID').format(value);
  }

  // Set individual weights with boundaries
  updateWeight(type: 'poverty' | 'ipm' | 'p1p2' | 'exclusion', value: string): void {
    const num = parseInt(value, 10) || 0;
    if (type === 'poverty') this.state.weightPoverty.set(num);
    if (type === 'ipm') this.state.weightIpm.set(num);
    if (type === 'p1p2') this.state.weightP1P2.set(num);
    if (type === 'exclusion') this.state.weightExclusion.set(num);
  }

  // Get total reallocation amount
  getReallocatedTotal(): number {
    const list = this.state.optimizedAllocations();
    // Jumlahkan semua selisih positif (atau negatif) untuk tahu berapa anggaran yang bergeser
    return list.reduce((sum, r) => r.difference > 0 ? sum + r.difference : sum, 0);
  }
}
