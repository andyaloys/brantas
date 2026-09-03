import { AfterViewInit, ChangeDetectionStrategy, Component, ElementRef, NgZone, ViewChild, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import * as echarts from 'echarts';
import {
  DashboardDataService,
  DashboardSummary,
  DistributionResponse,
  PriorityRegion,
  RegencyRanksResponse,
  RegionalCorridor
} from '../data/dashboard-data.service';

export type DashboardViewTab = 'corridors' | 'regencies' | 'distribution';

@Component({
  selector: 'app-dashboard-page',
  templateUrl: './dashboard-page.html',
  styleUrl: './dashboard-page.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class DashboardPageComponent implements AfterViewInit {
  private readonly dashboardData = inject(DashboardDataService);
  private readonly zone = inject(NgZone);

  @ViewChild('corridorChart') private corridorChartRef?: ElementRef<HTMLElement>;
  @ViewChild('distChart') private distChartRef?: ElementRef<HTMLElement>;

  protected readonly isRunning = signal(false);
  protected readonly summary = signal<DashboardSummary | null>(null);
  protected readonly priorityRegions = signal<PriorityRegion[]>([]);
  protected readonly corridors = signal<RegionalCorridor[]>([]);
  protected readonly regencyRanks = signal<RegencyRanksResponse | null>(null);
  protected readonly distribution = signal<DistributionResponse | null>(null);
  protected readonly activeTab = signal<DashboardViewTab>('corridors');
  protected readonly regencyFilter = signal<'top' | 'lowest'>('top');
  protected readonly searchTerm = signal('');
  protected readonly error = signal<string | null>(null);

  private corridorChartInstance?: echarts.ECharts;
  private distChartInstance?: echarts.ECharts;

  async ngOnInit(): Promise<void> {
    await this.loadAllDashboardData();
  }

  ngAfterViewInit(): void {
    if (this.corridors().length > 0 && this.distribution()) {
      this.renderCharts(this.corridors(), this.distribution()!);
    }
  }

  protected setTab(tab: DashboardViewTab): void {
    this.activeTab.set(tab);
    setTimeout(() => {
      if (this.corridors().length > 0 && this.distribution()) {
        this.renderCharts(this.corridors(), this.distribution()!);
      }
      this.corridorChartInstance?.resize();
      this.distChartInstance?.resize();
    }, 60);
  }

  protected setRegencyFilter(filter: 'top' | 'lowest'): void {
    this.regencyFilter.set(filter);
  }

  protected onSearchChange(event: Event): void {
    const val = (event.target as HTMLInputElement).value.toLowerCase();
    this.searchTerm.set(val);
  }

  protected async runPipeline(): Promise<void> {
    this.isRunning.set(true);
    this.error.set(null);
    try {
      await firstValueFrom(this.dashboardData.runPipeline());
      await this.loadAllDashboardData();
    } catch {
      this.error.set('Pipeline tidak dapat dijalankan. Pastikan layanan BRANTAS aktif.');
    } finally {
      this.isRunning.set(false);
    }
  }

  private async loadAllDashboardData(): Promise<void> {
    try {
      const [summary, priorityRegions, corridors, regencyRanks, distribution] = await Promise.all([
        firstValueFrom(this.dashboardData.getSummary()),
        firstValueFrom(this.dashboardData.getPriorityRegions()),
        firstValueFrom(this.dashboardData.getCorridors()),
        firstValueFrom(this.dashboardData.getRegencyRanks()),
        firstValueFrom(this.dashboardData.getDistribution())
      ]);

      this.summary.set(summary);
      this.priorityRegions.set(priorityRegions);
      this.corridors.set(corridors);
      this.regencyRanks.set(regencyRanks);
      this.distribution.set(distribution);

      setTimeout(() => {
        this.renderCharts(corridors, distribution);
      }, 80);
    } catch {
      this.summary.set(null);
      this.error.set('Gagal memuat data dashboard. Pastikan backend aktif.');
    }
  }

  private renderCharts(corridors: RegionalCorridor[], distribution: DistributionResponse): void {
    this.zone.runOutsideAngular(() => {
      if (this.corridorChartRef && corridors.length > 0) {
        this.corridorChartInstance?.dispose();
        this.corridorChartInstance = echarts.init(this.corridorChartRef.nativeElement);
        
        const sorted = [...corridors].reverse();
        this.corridorChartInstance.setOption({
          tooltip: {
            trigger: 'axis',
            axisPointer: { type: 'shadow' },
            formatter: (params: any) => {
              const item = sorted[params[0].dataIndex];
              return `<strong>${item.corridor}</strong><br/>` +
                `Kemiskinan: <strong>${item.averagePovertyRate.toFixed(2)}%</strong><br/>` +
                `Penduduk Miskin: ${item.totalPoorPopulation.toLocaleString('id-ID')} jiwa<br/>` +
                `Alokasi Bansos: Rp${item.totalAllocation.toLocaleString('id-ID', { maximumFractionDigits: 0 })} jt`;
            }
          },
          grid: { left: '3%', right: '8%', bottom: '3%', top: '5%', containLabel: true },
          xAxis: {
            type: 'value',
            axisLabel: { formatter: '{value}%' },
            splitLine: { lineStyle: { color: '#f1f5f9' } }
          },
          yAxis: {
            type: 'category',
            data: sorted.map(c => c.corridor),
            axisLabel: { color: '#334155', fontWeight: 600 }
          },
          series: [
            {
              name: 'Rata-rata Kemiskinan',
              type: 'bar',
              data: sorted.map(c => ({
                value: c.averagePovertyRate,
                itemStyle: {
                  color: c.averagePovertyRate >= 15 ? '#e11d48' : c.averagePovertyRate >= 10 ? '#f59e0b' : '#0d9488',
                  borderRadius: [0, 4, 4, 0]
                }
              })),
              label: {
                show: true,
                position: 'right',
                formatter: '{c}%',
                fontWeight: 700,
                color: '#0f172a'
              }
            }
          ]
        });
      }

      if (this.distChartRef && distribution.distribution.length > 0) {
        this.distChartInstance?.dispose();
        this.distChartInstance = echarts.init(this.distChartRef.nativeElement);
        this.distChartInstance.setOption({
          tooltip: {
            trigger: 'item',
            formatter: '{b}: <strong>{c} Kab/Kota</strong> ({d}%)'
          },
          legend: {
            bottom: '0%',
            left: 'center',
            textStyle: { fontSize: 11, color: '#475569' }
          },
          series: [
            {
              name: 'Sebaran Kelas Kemiskinan',
              type: 'pie',
              radius: ['45%', '72%'],
              center: ['50%', '42%'],
              avoidLabelOverlap: false,
              itemStyle: {
                borderRadius: 6,
                borderColor: '#fff',
                borderWidth: 2
              },
              label: { show: false },
              emphasis: {
                label: { show: true, fontSize: 13, fontWeight: 'bold' }
              },
              data: distribution.distribution.map(d => ({
                value: d.count,
                name: d.label,
                itemStyle: { color: d.color }
              }))
            }
          ]
        });
      }

      window.addEventListener('resize', () => {
        this.corridorChartInstance?.resize();
        this.distChartInstance?.resize();
      });
    });
  }

  protected filteredRegencies(): any[] {
    const ranks = this.regencyRanks();
    if (!ranks) return [];
    const list = this.regencyFilter() === 'top' ? ranks.topPoverty : ranks.lowestPoverty;
    const term = this.searchTerm();
    if (!term) return list;
    return list.filter(r => r.regencyName.toLowerCase().includes(term) || r.provinceName.toLowerCase().includes(term));
  }
}