import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Subject, of, firstValueFrom } from 'rxjs';
import { debounceTime, switchMap, catchError, finalize } from 'rxjs/operators';
import { AllocationRecommendation, OptimizationDataService, SimulationScenario } from '../data/optimization-data.service';
import { ReportingDataService } from '../../reporting/data/reporting-data.service';
import { formatCompactCurrency } from '../../../core/utils/currency-formatter';

@Component({ selector: 'app-optimization-page', templateUrl: './optimization-page.html', styleUrl: './optimization-page.css', changeDetection: ChangeDetectionStrategy.OnPush, imports: [CommonModule] })
export class OptimizationPageComponent {
  protected readonly formatCurrency = formatCompactCurrency;
  private readonly optimizationData = inject(OptimizationDataService);
  private readonly reportingData = inject(ReportingDataService);
  private readonly autoCalculate$ = new Subject<void>();

  protected readonly povertyWeight = signal(30);
  protected readonly disasterWeight = signal(10);
  protected readonly capPercent = signal(25);
  protected readonly recommendations = signal<AllocationRecommendation[]>([]);
  protected readonly totalBudget = signal<number | null>(null);
  protected readonly scenarioName = signal('Skenario baru');
  protected readonly scenarios = signal<SimulationScenario[]>([]);
  protected readonly saveMessage = signal<string | null>(null);
  protected readonly error = signal<string | null>(null);
  protected readonly isRunning = signal<boolean>(false);

  protected readonly activeScenarioId = signal<string | null>(null);
  protected readonly activeScenarioName = signal<string | null>(null);
  protected readonly isLoadingScenario = signal<boolean>(false);

  constructor() {
    // Reaktif otomatis: menghitung ulang simulasi begitu parameter slider digeser
    this.autoCalculate$
      .pipe(
        debounceTime(180),
        switchMap(() => {
          this.isRunning.set(true);
          this.error.set(null);
          return this.optimizationData
            .getRecommendations(this.povertyWeight(), this.capPercent(), this.disasterWeight())
            .pipe(
              catchError(() => {
                this.error.set('Simulasi belum dapat dihitung. Pastikan layanan BRANTAS aktif.');
                return of(null);
              }),
              finalize(() => this.isRunning.set(false))
            );
        }),
        takeUntilDestroyed()
      )
      .subscribe((result) => {
        if (result) {
          this.totalBudget.set(result.totalBudget);
          this.recommendations.set(result.recommendations);
        }
      });
  }

  // Status apakah parameter saat ini sesuai rekomendasi ideal sistem BRANTAS
  protected readonly isIdealActive = computed(() => this.povertyWeight() === 45 && this.capPercent() === 20 && this.disasterWeight() === 15);

  // Ringkasan dampak fiskal eksekutif
  protected readonly summaryImpact = computed(() => {
    const list = this.recommendations();
    let increasedCount = 0;
    let increasedTotal = 0;
    let decreasedCount = 0;
    let decreasedTotal = 0;
    let unchangedCount = 0;

    for (const item of list) {
      if (item.delta > 0) {
        increasedCount++;
        increasedTotal += item.delta;
      } else if (item.delta < 0) {
        decreasedCount++;
        decreasedTotal += Math.abs(item.delta);
      } else {
        unchangedCount++;
      }
    }

    return {
      totalCount: list.length,
      increasedCount,
      increasedTotal,
      decreasedCount,
      decreasedTotal,
      unchangedCount
    };
  });

  async ngOnInit(): Promise<void> { await Promise.all([this.runSimulation(), this.loadScenarios()]); }

  protected async runSimulation(): Promise<void> {
    this.error.set(null);
    this.isRunning.set(true);
    try {
      const result = await firstValueFrom(this.optimizationData.getRecommendations(this.povertyWeight(), this.capPercent(), this.disasterWeight()));
      this.totalBudget.set(result.totalBudget);
      this.recommendations.set(result.recommendations);
    } catch { 
      this.error.set('Simulasi belum dapat dihitung. Pastikan layanan BRANTAS aktif.'); 
    } finally {
      this.isRunning.set(false);
    }
  }

  protected updatePovertyWeight(event: Event): void {
    this.povertyWeight.set(Number((event.target as HTMLInputElement).value));
    this.activeScenarioId.set(null);
    this.activeScenarioName.set(null);
  }

  protected updateDisasterWeight(event: Event): void {
    this.disasterWeight.set(Number((event.target as HTMLInputElement).value));
    this.activeScenarioId.set(null);
    this.activeScenarioName.set(null);
  }

  protected updateCap(event: Event): void {
    this.capPercent.set(Number((event.target as HTMLInputElement).value));
    this.activeScenarioId.set(null);
    this.activeScenarioName.set(null);
  }

  protected updateScenarioName(event: Event): void { this.scenarioName.set((event.target as HTMLInputElement).value); }

  protected async saveScenario(): Promise<void> {
    this.saveMessage.set(null);
    try {
      const scenario = await firstValueFrom(this.optimizationData.saveScenario(this.scenarioName(), this.povertyWeight(), this.capPercent(), this.disasterWeight()));
      this.saveMessage.set(`Skenario "${scenario.name}" berhasil disimpan.`);
      this.activeScenarioId.set(scenario.id);
      this.activeScenarioName.set(scenario.name);
      await this.loadScenarios();
    } catch { this.saveMessage.set('Skenario tidak dapat disimpan.'); }
  }

  protected async loadScenario(scenario: SimulationScenario): Promise<void> {
    this.isLoadingScenario.set(true);
    this.saveMessage.set(null);
    this.error.set(null);
    try {
      const detail = await firstValueFrom(this.optimizationData.getScenarioById(scenario.id));
      if (detail.povertyWeight !== undefined) {
        this.povertyWeight.set(detail.povertyWeight);
      }
      if (detail.disasterWeight !== undefined) {
        this.disasterWeight.set(detail.disasterWeight);
      }
      if (detail.capPercent !== undefined) {
        this.capPercent.set(detail.capPercent);
      }
      this.scenarioName.set(detail.name);
      this.activeScenarioId.set(detail.id);
      this.activeScenarioName.set(detail.name);
      this.totalBudget.set(detail.totalBudget);
      if (detail.recommendations && detail.recommendations.length > 0) {
        this.recommendations.set(detail.recommendations);
      } else {
        await this.runSimulation();
      }
      this.saveMessage.set(`Skenario "${detail.name}" berhasil dimuat ke simulasi.`);
    } catch {
      // Fallback if detail fetch fails
      if (scenario.povertyWeight !== undefined) this.povertyWeight.set(scenario.povertyWeight);
      if (scenario.disasterWeight !== undefined) this.disasterWeight.set(scenario.disasterWeight);
      if (scenario.capPercent !== undefined) this.capPercent.set(scenario.capPercent);
      this.scenarioName.set(scenario.name);
      this.activeScenarioId.set(scenario.id);
      this.activeScenarioName.set(scenario.name);
      await this.runSimulation();
      this.saveMessage.set(`Skenario "${scenario.name}" dimuat.`);
    } finally {
      this.isLoadingScenario.set(false);
    }
  }

  protected async deleteScenario(id: string, event: Event): Promise<void> {
    event.stopPropagation();
    try {
      await firstValueFrom(this.optimizationData.deleteScenario(id));
      if (this.activeScenarioId() === id) {
        this.activeScenarioId.set(null);
        this.activeScenarioName.set(null);
      }
      this.saveMessage.set('Skenario berhasil dihapus.');
      await this.loadScenarios();
    } catch {
      this.saveMessage.set('Gagal menghapus skenario.');
    }
  }

  protected async applyIdealParameters(): Promise<void> {
    this.povertyWeight.set(45);
    this.disasterWeight.set(15);
    this.capPercent.set(20);
    this.activeScenarioId.set(null);
    this.activeScenarioName.set(null);
    this.saveMessage.set(null);
    await this.runSimulation();
  }

  protected async resetParameters(): Promise<void> {
    this.povertyWeight.set(30);
    this.disasterWeight.set(10);
    this.capPercent.set(25);
    this.scenarioName.set('Skenario baru');
    this.activeScenarioId.set(null);
    this.activeScenarioName.set(null);
    this.saveMessage.set('Parameter dikembalikan ke standar APBN (30% kemiskinan, 10% bencana, 25% cap).');
    await this.runSimulation();
  }

  protected exportXlsx(): void {
    this.reportingData.downloadAllocationsXlsx().subscribe({
      next: (blob) => {
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `rekomendasi-alokasi-anggaran-2026.xlsx`;
        link.click();
        URL.revokeObjectURL(url);
      },
      error: () => {
        this.exportCsv();
      }
    });
  }

  protected exportCsv(): void {
    const list = this.recommendations();
    if (list.length === 0) return;
    let csv = 'Provinsi,BaselineJuta,RekomendasiJuta,PergeseranJuta,PergeseranPersen,IndeksIKW,PendudukMiskin\n';
    for (const r of list) {
      csv += `"${r.region}",${r.baselineAllocation},${r.recommendedAllocation},${r.delta},${r.deltaPercent},${r.vulnerabilityIndex},${r.poorPopulation ?? ''}\n`;
    }
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `simulasi-alokasi-bobot-${this.povertyWeight()}pct-cap-${this.capPercent()}pct.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }

  protected async loadScenarios(): Promise<void> {
    try {
      this.scenarios.set(await firstValueFrom(this.optimizationData.getScenarios()));
    } catch {
      this.scenarios.set([]);
    }
  }
}