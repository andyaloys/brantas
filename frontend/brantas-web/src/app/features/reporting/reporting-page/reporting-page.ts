import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { ReportingDataService } from '../data/reporting-data.service';

@Component({ selector: 'app-reporting-page', templateUrl: './reporting-page.html', styleUrl: './reporting-page.css', changeDetection: ChangeDetectionStrategy.OnPush })
export class ReportingPageComponent {
  private readonly reportingData = inject(ReportingDataService);
  protected readonly isDownloading = signal(false);
  protected readonly error = signal<string | null>(null);

  protected async download(type: 'pdf' | 'csv' | 'allocations'): Promise<void> {
    this.isDownloading.set(true);
    this.error.set(null);
    try {
      const file = await firstValueFrom(
        type === 'pdf' ? this.reportingData.downloadPolicyBrief()
        : type === 'csv' ? this.reportingData.downloadAnomaliesCsv()
        : this.reportingData.downloadAllocationsCsv()
      );
      const url = URL.createObjectURL(file);
      const link = document.createElement('a');
      link.href = url;
      link.download = type === 'pdf' ? 'telaahan-kebijakan-brantas.pdf' : type === 'csv' ? 'anomali-brantas.csv' : 'alokasi-anggaran-brantas.csv';
      link.click();
      URL.revokeObjectURL(url);
    } catch {
      this.error.set('Berkas belum dapat dihasilkan. Pastikan layanan BRANTAS aktif.');
    } finally {
      this.isDownloading.set(false);
    }
  }
}