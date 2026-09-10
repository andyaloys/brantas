import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { firstValueFrom } from 'rxjs';
import { CausalDataService, CausalResult } from '../data/causal-data.service';

@Component({
  selector: 'app-causal-page',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './causal-page.html',
  styleUrl: './causal-page.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class CausalPageComponent implements OnInit {
  private readonly causalData = inject(CausalDataService);
  protected readonly result = signal<CausalResult | null>(null);
  protected readonly error = signal<string | null>(null);
  protected readonly isLoading = signal<boolean>(true);

  async ngOnInit(): Promise<void> {
    this.isLoading.set(true);
    this.error.set(null);
    try {
      this.result.set(await firstValueFrom(this.causalData.getDid()));
    } catch {
      this.error.set('Evaluasi dampak kebijakan fiskal belum dapat dimuat. Pastikan layanan backend BRANTAS aktif.');
    } finally {
      this.isLoading.set(false);
    }
  }

  protected width(effect: number): number {
    return Math.min(100, Math.max(14, Math.abs(effect) * 160));
  }
}