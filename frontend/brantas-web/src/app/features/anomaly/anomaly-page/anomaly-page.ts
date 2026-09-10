import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { AnomalyDataService, AnomalySummary, BeneficiaryAnomalyFinding, BeneficiaryAnomalySummary, ExclusionError, FiscalAnomaly, OnnxAnomalyItem, OnnxAnomalyReport } from '../data/anomaly-data.service';

@Component({
  selector: 'app-anomaly-page',
  templateUrl: './anomaly-page.html',
  styleUrl: './anomaly-page.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class AnomalyPageComponent {
  private readonly anomalyData = inject(AnomalyDataService);
  protected readonly isLoading = signal(true);
  protected readonly summary = signal<AnomalySummary | null>(null);
  protected readonly anomalies = signal<FiscalAnomaly[]>([]);
  protected readonly beneficiarySummary = signal<BeneficiaryAnomalySummary | null>(null);
  protected readonly beneficiaryFindings = signal<BeneficiaryAnomalyFinding[]>([]);
  protected readonly onnxReport = signal<OnnxAnomalyReport | null>(null);
  protected readonly exclusionErrors = signal<ExclusionError[]>([]);
  protected readonly updatingReviewId = signal<string | null>(null);
  protected readonly error = signal<string | null>(null);

  async ngOnInit(): Promise<void> {
    try {
      const [summary, anomalies, beneficiarySummary, beneficiaryFindings, onnxReport, exclusionErrors] = await Promise.all([
        firstValueFrom(this.anomalyData.getSummary()),
        firstValueFrom(this.anomalyData.getAnomalies()),
        firstValueFrom(this.anomalyData.getBeneficiarySummary()),
        firstValueFrom(this.anomalyData.getBeneficiaryFindings()),
        firstValueFrom(this.anomalyData.getOnnxMultivariate()),
        firstValueFrom(this.anomalyData.getExclusionErrors())
      ]);
      this.summary.set(summary);
      this.anomalies.set(anomalies);
      this.beneficiarySummary.set(beneficiarySummary);
      this.beneficiaryFindings.set(beneficiaryFindings);
      this.onnxReport.set(onnxReport);
      this.exclusionErrors.set(exclusionErrors);
    } catch {
      this.error.set('Temuan anomali belum dapat dimuat. Pastikan layanan BRANTAS aktif.');
    } finally {
      this.isLoading.set(false);
    }
  }

  protected formatRisk(value: number): string {
    return `Rp${value.toLocaleString('id-ID', { maximumFractionDigits: 0 })} juta`;
  }

  protected translateType(type: string): string {
    if (type === 'Under-allocation') return 'Alokasi Kurang';
    if (type === 'Over-allocation') return 'Alokasi Berlebih';
    return type;
  }

  protected translateSeverity(severity: string): string {
    if (severity === 'Critical') return 'Kritis';
    if (severity === 'High') return 'Tinggi';
    if (severity === 'Medium') return 'Sedang';
    return severity;
  }

  protected formatFiscalExplanation(item: FiscalAnomaly): string {
    if (item.type === 'Under-allocation') {
      return 'Anggaran bansos per jiwa jauh di bawah kebutuhan riil daerah. Berisiko memicu defisit perlindungan sosial dan kemiskinan ekstrem.';
    }
    if (item.type === 'Over-allocation') {
      return 'Pagu anggaran melampaui estimasi kebutuhan riil daerah. Berpotensi inefisiensi belanja dan disarankan untuk realokasi ke daerah defisit.';
    }
    return item.explanation;
  }

  protected formatOnnxExplanation(item: OnnxAnomalyItem): string {
    if (item.severity === 'Critical') {
      return 'Ketidaksinkronan ekstrem antara tingginya angka kemiskinan dengan rendahnya realisasi penyerapan bansos daerah.';
    }
    if (item.severity === 'High') {
      return 'Pola belanja daerah tidak proporsional terhadap indeks kedalaman kemiskinan wilayah.';
    }
    return 'Fluktuasi tren penyaluran bansos memerlukan pemantauan dan evaluasi berkala.';
  }

  protected formatBeneficiaryExplanation(item: BeneficiaryAnomalyFinding): string {
    const typeLower = item.type.toLowerCase();
    if (typeLower.includes('asn') || typeLower.includes('aparatur')) {
      return 'NIK terdaftar aktif sebagai aparatur negara/keamanan. Rekomendasi: Penonaktifan hak bansos dan pemulihan dana.';
    }
    if (typeLower.includes('meninggal') || typeLower.includes('kematian')) {
      return 'Penerima telah tercatat meninggal di Dukcapil namun dana tetap tersalurkan. Rekomendasi: Graduasi data dan rekonsiliasi perbankan.';
    }
    if (typeLower.includes('aset') || typeLower.includes('ekonomi')) {
      return 'Terindikasi ketidaksesuaian kriteria desil kemiskinan akibat kepemilikan aset. Rekomendasi: Verifikasi faktual lapangan.';
    }
    return item.explanation;
  }

  protected async updateReview(item: FiscalAnomaly, event: Event): Promise<void> {
    const status = (event.target as HTMLSelectElement).value as FiscalAnomaly['reviewStatus'];
    this.updatingReviewId.set(item.id);
    try {
      const result = await firstValueFrom(this.anomalyData.updateReview(item.id, status));
      this.anomalies.update((items) => items.map((current) => current.id === item.id ? { ...current, reviewStatus: result.reviewStatus } : current));
    } catch {
      this.error.set('Status tinjauan belum dapat disimpan. Pastikan layanan BRANTAS aktif.');
    } finally {
      this.updatingReviewId.set(null);
    }
  }
}