import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { CausalDataService, CausalResult } from '../data/causal-data.service';

@Component({ selector: 'app-causal-page', templateUrl: './causal-page.html', styleUrl: './causal-page.css', changeDetection: ChangeDetectionStrategy.OnPush })
export class CausalPageComponent {
  private readonly causalData = inject(CausalDataService);
  protected readonly result = signal<CausalResult | null>(null);
  protected readonly error = signal<string | null>(null);
  async ngOnInit(): Promise<void> { try { this.result.set(await firstValueFrom(this.causalData.getDid())); } catch { this.error.set('Evaluasi dampak belum dapat dimuat. Pastikan layanan BRANTAS aktif.'); } }
  protected width(effect: number): number { return Math.min(100, Math.abs(effect) * 160); }
}