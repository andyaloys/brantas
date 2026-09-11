import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { firstValueFrom } from 'rxjs';
import { ReportingDataService } from '../data/reporting-data.service';
import { OptimizationDataService, SimulationScenario } from '../../optimization/data/optimization-data.service';

@Component({
  selector: 'app-reporting-page',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './reporting-page.html',
  styleUrl: './reporting-page.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ReportingPageComponent implements OnInit {
  private readonly reportingData = inject(ReportingDataService);
  private readonly optimizationData = inject(OptimizationDataService);

  protected readonly downloadingType = signal<'pdf' | 'csv' | 'allocations' | 'allocations-xlsx' | 'anomalies-xlsx' | null>(null);
  protected readonly error = signal<string | null>(null);
  protected readonly scenarios = signal<SimulationScenario[]>([]);
  protected readonly selectedScenarioId = signal<string>('');

  async ngOnInit(): Promise<void> {
    try {
      const list = await firstValueFrom(this.optimizationData.getScenarios());
      this.scenarios.set(list);
    } catch {
      this.scenarios.set([]);
    }
  }

  protected isDownloading(): boolean {
    return this.downloadingType() !== null;
  }

  protected onScenarioChange(event: Event): void {
    const val = (event.target as HTMLSelectElement).value;
    this.selectedScenarioId.set(val);
  }

  protected async download(type: 'pdf' | 'csv' | 'allocations' | 'allocations-xlsx' | 'anomalies-xlsx'): Promise<void> {
    this.downloadingType.set(type);
    this.error.set(null);
    try {
      const selectedId = this.selectedScenarioId();
      const activeScenario = this.scenarios().find(s => s.id === selectedId);

      const file = await firstValueFrom(
        type === 'pdf' ? this.reportingData.downloadPolicyBrief({
          scenarioId: selectedId || undefined,
          scenarioName: activeScenario?.name || undefined,
          povertyWeight: activeScenario?.povertyWeight,
          disasterWeight: activeScenario?.disasterWeight,
          capPercent: activeScenario?.capPercent
        })
        : type === 'allocations-xlsx' ? this.reportingData.downloadAllocationsXlsx()
        : type === 'anomalies-xlsx' ? this.reportingData.downloadAnomaliesXlsx()
        : type === 'csv' ? this.reportingData.downloadAnomaliesCsv()
        : this.reportingData.downloadAllocationsCsv()
      );
      const url = URL.createObjectURL(file);
      const link = document.createElement('a');
      link.href = url;
      const slug = activeScenario?.name
        ? activeScenario.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')
        : 'standar';
      link.download = type === 'pdf'
        ? `rekomendasi-kebijakan-${slug}-2026.pdf`
        : type === 'allocations-xlsx'
          ? 'rekomendasi-alokasi-brantas.xlsx'
          : type === 'anomalies-xlsx'
            ? 'temuan-ketimpangan-brantas.xlsx'
            : type === 'csv'
              ? 'matriks-anomali-fiskal-brantas.csv'
              : 'simulasi-alokasi-anggaran-ikw-brantas.csv';
      link.click();
      URL.revokeObjectURL(url);
    } catch {
      this.error.set('Berkas analitik belum dapat diunduh. Pastikan layanan backend BRANTAS aktif.');
    } finally {
      this.downloadingType.set(null);
    }
  }
}