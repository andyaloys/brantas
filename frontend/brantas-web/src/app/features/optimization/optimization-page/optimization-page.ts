import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Subject, of, firstValueFrom } from 'rxjs';
import { debounceTime, switchMap, catchError, finalize } from 'rxjs/operators';
import { AllocationRecommendation, OptimizationDataService, SimulationScenario } from '../data/optimization-data.service';
import { formatCompactCurrency } from '../../../core/utils/currency-formatter';

@Component({ selector: 'app-optimization-page', templateUrl: './optimization-page.html', styleUrl: './optimization-page.css', changeDetection: ChangeDetectionStrategy.OnPush, imports: [CommonModule] })
export class OptimizationPageComponent {
  protected readonly formatCurrency = formatCompactCurrency;
  private readonly optimizationData = inject(OptimizationDataService);
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
          const bpsSub = this.getBpsSubWeight();
          return this.optimizationData
            .getRecommendations(
              this.povertyWeight(), 
              this.capPercent(), 
              this.disasterWeight(),
              bpsSub,
              bpsSub,
              bpsSub,
              bpsSub
            )
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

  // Perhitungan bobot komplementer untuk 4 dimensi dasar BPS (P1, P2, Gap IPM, Invers PDRB)
  // Menjamin closed simplex total tepat 100% tanpa distorsi rasio pilihan eksekutif
  protected getBpsSubWeight(): number {
    const remaining = Math.max(0, 100 - (this.povertyWeight() + this.disasterWeight()));
    return remaining / 4;
  }

  // Komposisi 6 dimensi IKW dengan Model Direct Complementary 100%
  protected readonly normalizedBreakdown = computed(() => {
    const povertyPct = this.povertyWeight();
    const disasterPct = this.disasterWeight();
    const executiveTotal = povertyPct + disasterPct;
    const othersPct = Math.max(0, 100 - executiveTotal);
    const bpsEach = Math.round((othersPct / 4) * 10) / 10;
    return {
      povertyPct,
      disasterPct,
      othersPct,
      bpsEach,
      executiveTotal,
      totalPct: 100
    };
  });

  // Kontrol rincian dasar perhitungan formula (default: tertutup/hide)
  protected readonly isCalculationBreakdownOpen = signal<boolean>(false);

  protected toggleCalculationBreakdown(): void {
    this.isCalculationBreakdownOpen.update(v => !v);
  }

  // Kontrol rincian dasar perhitungan batas pengaman / cap (default: tertutup/hide)
  protected readonly isCapExplainerOpen = signal<boolean>(false);

  protected toggleCapExplainer(): void {
    this.isCapExplainerOpen.update(v => !v);
  }

  // State Pagination Tabel Rekomendasi Alokasi (10, 25, 50 baris)
  protected readonly pageSize = signal<number>(10);
  protected readonly pageSizeOptions: number[] = [10, 25, 50];
  protected readonly currentPage = signal<number>(1);

  protected setPageSize(size: number): void {
    this.pageSize.set(size);
    this.currentPage.set(1);
  }

  protected setPage(page: number | string): void {
    if (typeof page === 'number' && page >= 1 && page <= this.totalPages()) {
      this.currentPage.set(page);
    }
  }

  protected prevPage(): void {
    if (this.currentPage() > 1) {
      this.currentPage.update(p => p - 1);
    }
  }

  protected nextPage(): void {
    if (this.currentPage() < this.totalPages()) {
      this.currentPage.update(p => p + 1);
    }
  }

  protected readonly totalPages = computed(() => {
    return Math.ceil(this.recommendations().length / this.pageSize()) || 1;
  });

  protected readonly paginatedRecommendations = computed(() => {
    const start = (this.currentPage() - 1) * this.pageSize();
    return this.recommendations().slice(start, start + this.pageSize());
  });

  protected readonly startIndex = computed(() => {
    return this.recommendations().length === 0 ? 0 : (this.currentPage() - 1) * this.pageSize() + 1;
  });

  protected readonly endIndex = computed(() => {
    return Math.min(this.currentPage() * this.pageSize(), this.recommendations().length);
  });

  protected readonly pagesList = computed(() => {
    const total = this.totalPages();
    const current = this.currentPage();
    const pages: (number | string)[] = [];
    if (total <= 7) {
      for (let i = 1; i <= total; i++) pages.push(i);
    } else {
      pages.push(1);
      if (current > 3) pages.push('...');
      const start = Math.max(2, current - 1);
      const end = Math.min(total - 1, current + 1);
      for (let i = start; i <= end; i++) {
        if (!pages.includes(i)) pages.push(i);
      }
      if (current < total - 2) pages.push('...');
      if (!pages.includes(total)) pages.push(total);
    }
    return pages;
  });

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
      const bpsSub = this.getBpsSubWeight();
      const result = await firstValueFrom(
        this.optimizationData.getRecommendations(
          this.povertyWeight(), 
          this.capPercent(), 
          this.disasterWeight(),
          bpsSub,
          bpsSub,
          bpsSub,
          bpsSub
        )
      );
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
    this.autoCalculate$.next();
  }

  protected updateDisasterWeight(event: Event): void {
    this.disasterWeight.set(Number((event.target as HTMLInputElement).value));
    this.activeScenarioId.set(null);
    this.activeScenarioName.set(null);
    this.autoCalculate$.next();
  }

  protected updateCap(event: Event): void {
    this.capPercent.set(Number((event.target as HTMLInputElement).value));
    this.activeScenarioId.set(null);
    this.activeScenarioName.set(null);
    this.autoCalculate$.next();
  }

  protected updateScenarioName(event: Event): void { this.scenarioName.set((event.target as HTMLInputElement).value); }

  protected async saveScenario(): Promise<void> {
    this.saveMessage.set(null);
    try {
      const bpsSub = this.getBpsSubWeight();
      const scenario = await firstValueFrom(
        this.optimizationData.saveScenario(
          this.scenarioName(), 
          this.povertyWeight(), 
          this.capPercent(), 
          this.disasterWeight(),
          bpsSub,
          bpsSub,
          bpsSub,
          bpsSub
        )
      );
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

  protected async loadScenarios(): Promise<void> {
    try {
      this.scenarios.set(await firstValueFrom(this.optimizationData.getScenarios()));
    } catch {
      this.scenarios.set([]);
    }
  }
}