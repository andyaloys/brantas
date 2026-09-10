import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { firstValueFrom } from 'rxjs';
import { ReportingDataService } from '../data/reporting-data.service';

@Component({
  selector: 'app-reporting-page',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './reporting-page.html',
  styleUrl: './reporting-page.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ReportingPageComponent {
  private readonly reportingData = inject(ReportingDataService);
  protected readonly downloadingType = signal<'pdf' | 'csv' | 'allocations' | 'allocations-xlsx' | 'anomalies-xlsx' | null>(null);
  protected readonly error = signal<string | null>(null);

  protected isDownloading(): boolean {
    return this.downloadingType() !== null;
  }

  protected async download(type: 'pdf' | 'csv' | 'allocations' | 'allocations-xlsx' | 'anomalies-xlsx'): Promise<void> {
    this.downloadingType.set(type);
    this.error.set(null);
    try {
      const file = await firstValueFrom(
        type === 'pdf' ? this.reportingData.downloadPolicyBrief()
        : type === 'allocations-xlsx' ? this.reportingData.downloadAllocationsXlsx()
        : type === 'anomalies-xlsx' ? this.reportingData.downloadAnomaliesXlsx()
        : type === 'csv' ? this.reportingData.downloadAnomaliesCsv()
        : this.reportingData.downloadAllocationsCsv()
      );
      const url = URL.createObjectURL(file);
      const link = document.createElement('a');
      link.href = url;
      link.download = type === 'pdf'
        ? 'rekomendasi-kebijakan-brantas.pdf'
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