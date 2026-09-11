import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { AnomalyDataService, AnomalySummary, BeneficiaryAnomalyFinding, BeneficiaryAnomalySummary, ExclusionError, FiscalAnomaly, OnnxAnomalyItem, OnnxAnomalyReport } from '../data/anomaly-data.service';
import { formatCompactCurrency } from '../../../core/utils/currency-formatter';
import { resolveRegionName, getParentProvince } from '../../../core/utils/region-name-resolver';
import { PROVINCE_DISASTER_RISK } from '../../spatial/data/gis-choropleth.adapter';

@Component({
  selector: 'app-anomaly-page',
  templateUrl: './anomaly-page.html',
  styleUrl: './anomaly-page.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class AnomalyPageComponent {
  protected readonly formatCurrency = formatCompactCurrency;
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

  protected readonly highRiskAnomalyStats = computed(() => {
    const list = this.anomalies();
    if (list.length === 0) return { count: 0, percentage: 0 };
    const highCount = list.filter(a => {
      const prov = getParentProvince(a.region);
      const r = PROVINCE_DISASTER_RISK[prov]?.risk ?? 0.5;
      return r >= 0.65;
    }).length;
    return {
      count: highCount,
      percentage: Math.round((highCount / list.length) * 100)
    };
  });

  protected resolveRegion(name: string): string {
    return resolveRegionName(name);
  }

  protected getDisasterRisk(regionName: string): { risk: number; percent: string; category: string; color: string; bg: string } {
    const province = getParentProvince(regionName);
    const meta = PROVINCE_DISASTER_RISK[province] ?? { risk: 0.55, cat: 'Sedang' };
    const riskVal = meta.risk;
    let color = '#16a34a';
    let bg = 'rgba(22, 163, 74, 0.12)';
    if (riskVal >= 0.70) {
      color = '#dc2626';
      bg = 'rgba(220, 38, 38, 0.12)';
    } else if (riskVal >= 0.45) {
      color = '#ea580c';
      bg = 'rgba(234, 88, 12, 0.12)';
    }
    return {
      risk: riskVal,
      percent: `${(riskVal * 100).toFixed(0)}%`,
      category: meta.cat,
      color,
      bg
    };
  }

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