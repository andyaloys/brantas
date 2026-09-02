import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { AllocationRecommendation, OptimizationDataService, SimulationScenario } from '../data/optimization-data.service';

@Component({ selector: 'app-optimization-page', templateUrl: './optimization-page.html', styleUrl: './optimization-page.css', changeDetection: ChangeDetectionStrategy.OnPush, imports: [DatePipe] })
export class OptimizationPageComponent {
  private readonly optimizationData = inject(OptimizationDataService);
  protected readonly povertyWeight = signal(30);
  protected readonly capPercent = signal(25);
  protected readonly recommendations = signal<AllocationRecommendation[]>([]);
  protected readonly totalBudget = signal<number | null>(null);
  protected readonly scenarioName = signal('Skenario baru');
  protected readonly scenarios = signal<SimulationScenario[]>([]);
  protected readonly saveMessage = signal<string | null>(null);
  protected readonly error = signal<string | null>(null);

  async ngOnInit(): Promise<void> { await Promise.all([this.runSimulation(), this.loadScenarios()]); }

  protected async runSimulation(): Promise<void> {
    this.error.set(null);
    try {
      const result = await firstValueFrom(this.optimizationData.getRecommendations(this.povertyWeight(), this.capPercent()));
      this.totalBudget.set(result.totalBudget);
      this.recommendations.set(result.recommendations);
    } catch { this.error.set('Simulasi belum dapat dihitung. Pastikan layanan BRANTAS aktif.'); }
  }

  protected updatePovertyWeight(event: Event): void { this.povertyWeight.set(Number((event.target as HTMLInputElement).value)); }
  protected updateCap(event: Event): void { this.capPercent.set(Number((event.target as HTMLInputElement).value)); }
  protected updateScenarioName(event: Event): void { this.scenarioName.set((event.target as HTMLInputElement).value); }
  protected async saveScenario(): Promise<void> {
    this.saveMessage.set(null);
    try {
      const scenario = await firstValueFrom(this.optimizationData.saveScenario(this.scenarioName(), this.povertyWeight(), this.capPercent()));
      this.saveMessage.set(`Skenario ${scenario.name} berhasil disimpan.`);
      await this.loadScenarios();
    } catch { this.saveMessage.set('Skenario tidak dapat disimpan.'); }
  }
  protected formatMoney(value: number): string { return `Rp${value.toLocaleString('id-ID', { maximumFractionDigits: 0 })} juta`; }

  protected exportCsv(): void {
    const list = this.recommendations();
    if (list.length === 0) return;
    let csv = 'Provinsi,BaselineJuta,RekomendasiJuta,PergeseranJuta,PergeseranPersen,IndeksIKW,PendudukMiskin\n';
    for (const r of list) {
      csv += `"${r.region}",${r.baselineAllocation},${r.recommendedAllocation},${r.delta},${r.deltaPercent},${r.vulnerabilityIndex},${r.poorPopulation}\n`;
    }
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `simulasi-alokasi-bobot-${this.povertyWeight()}pct-cap-${this.capPercent()}pct.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }

  private async loadScenarios(): Promise<void> { this.scenarios.set(await firstValueFrom(this.optimizationData.getScenarios())); }
}