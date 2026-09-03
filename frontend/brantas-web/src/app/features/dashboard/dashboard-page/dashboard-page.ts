import { AfterViewInit, ChangeDetectionStrategy, Component, ElementRef, NgZone, ViewChild, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute } from '@angular/router';
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

export type DashboardExecutiveTab = 'macro' | 'allocation';

@Component({
  selector: 'app-dashboard-page',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './dashboard-page.html',
  styleUrl: './dashboard-page.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class DashboardPageComponent implements AfterViewInit {
  private readonly dashboardData = inject(DashboardDataService);
  private readonly route = inject(ActivatedRoute);
  private readonly zone = inject(NgZone);

  @ViewChild('corridorChart') private corridorChartRef?: ElementRef<HTMLElement>;
  @ViewChild('distChart') private distChartRef?: ElementRef<HTMLElement>;
  @ViewChild('quadrantChart') private quadrantChartRef?: ElementRef<HTMLElement>;
  @ViewChild('trendChart') private trendChartRef?: ElementRef<HTMLElement>;

  protected readonly isRunning = signal(false);
  protected readonly summary = signal<DashboardSummary | null>(null);
  protected readonly priorityRegions = signal<PriorityRegion[]>([]);
  protected readonly corridors = signal<RegionalCorridor[]>([]);
  protected readonly regencyRanks = signal<RegencyRanksResponse | null>(null);
  protected readonly distribution = signal<DistributionResponse | null>(null);
  protected readonly activeTab = signal<DashboardExecutiveTab>('macro');
  protected readonly error = signal<string | null>(null);

  private corridorChartInstance?: echarts.ECharts;
  private distChartInstance?: echarts.ECharts;
  private quadrantChartInstance?: echarts.ECharts;
  private trendChartInstance?: echarts.ECharts;

  async ngOnInit(): Promise<void> {
    this.route.queryParams.subscribe(params => {
      if (params['tab'] === 'allocation') {
        this.setTab('allocation');
      } else if (params['tab'] === 'macro') {
        this.setTab('macro');
      }
    });

    await this.loadAllDashboardData();
  }

  protected setTab(tab: DashboardExecutiveTab): void {
    this.activeTab.set(tab);
    setTimeout(() => {
      this.renderAllExecutiveCharts();
    }, 60);
  }

  ngAfterViewInit(): void {
    if (this.corridors().length > 0 && this.distribution()) {
      this.renderAllExecutiveCharts();
    }
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
        this.renderAllExecutiveCharts();
      }, 100);
    } catch {
      this.summary.set(null);
      this.error.set('Gagal memuat data dashboard. Pastikan backend aktif.');
    }
  }

  private renderAllExecutiveCharts(): void {
    const corridors = this.corridors();
    const distribution = this.distribution();
    if (!corridors.length || !distribution) return;

    this.zone.runOutsideAngular(() => {
      // 1. Chart Koridor Spasial
      if (this.corridorChartRef) {
        this.corridorChartInstance?.dispose();
        this.corridorChartInstance = echarts.init(this.corridorChartRef.nativeElement);
        const sorted = [...corridors].reverse();
        this.corridorChartInstance.setOption({
          backgroundColor: 'transparent',
          tooltip: {
            trigger: 'axis',
            axisPointer: { type: 'shadow' },
            backgroundColor: '#0b1120',
            borderColor: 'rgba(255,255,255,0.15)',
            textStyle: { color: '#f8fafc' },
            formatter: (params: any) => {
              const item = sorted[params[0].dataIndex];
              return `<strong style="color:#38bdf8">${item.corridor}</strong><br/>` +
                `Kemiskinan: <strong style="color:#2dd4bf">${item.averagePovertyRate.toFixed(2)}%</strong><br/>` +
                `Penduduk Miskin: ${item.totalPoorPopulation.toLocaleString('id-ID')} jiwa<br/>` +
                `Alokasi: Rp${item.totalAllocation.toLocaleString('id-ID', { maximumFractionDigits: 0 })} jt`;
            }
          },
          grid: { left: '3%', right: '10%', bottom: '3%', top: '5%', containLabel: true },
          xAxis: {
            type: 'value',
            axisLabel: { formatter: '{value}%', color: '#94a3b8' },
            splitLine: { lineStyle: { color: 'rgba(255, 255, 255, 0.06)' } }
          },
          yAxis: {
            type: 'category',
            data: sorted.map(c => c.corridor),
            axisLabel: { color: '#cbd5e1', fontWeight: 600 }
          },
          series: [
            {
              name: 'Kemiskinan',
              type: 'bar',
              data: sorted.map(c => ({
                value: c.averagePovertyRate,
                itemStyle: {
                  color: c.averagePovertyRate >= 15 ? '#fb7185' : c.averagePovertyRate >= 10 ? '#fbbf24' : '#2dd4bf',
                  borderRadius: [0, 6, 6, 0]
                }
              })),
              label: {
                show: true,
                position: 'right',
                formatter: '{c}%',
                fontWeight: 700,
                color: '#f8fafc',
                fontFamily: 'JetBrains Mono'
              }
            }
          ]
        });
      }

      // 2. Chart Sebaran & Akurasi Desil
      if (this.distChartRef) {
        this.distChartInstance?.dispose();
        this.distChartInstance = echarts.init(this.distChartRef.nativeElement);
        this.distChartInstance.setOption({
          backgroundColor: 'transparent',
          tooltip: {
            trigger: 'item',
            backgroundColor: '#0b1120',
            borderColor: 'rgba(255,255,255,0.15)',
            textStyle: { color: '#f8fafc' },
            formatter: '{b}: <strong style="color:#38bdf8">{c} Kab/Kota</strong> ({d}%)'
          },
          legend: {
            bottom: '0%',
            left: 'center',
            textStyle: { fontSize: 11, color: '#94a3b8' }
          },
          series: [
            {
              name: 'Sebaran Kelas Kemiskinan',
              type: 'pie',
              radius: ['45%', '70%'],
              center: ['50%', '42%'],
              avoidLabelOverlap: false,
              itemStyle: {
                borderRadius: 6,
                borderColor: '#0f172a',
                borderWidth: 2
              },
              label: { show: false },
              emphasis: {
                label: { show: true, fontSize: 13, fontWeight: 'bold', color: '#f8fafc' }
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

      // 3. Scatter Matrix Kuadran Alokasi Fiskal (Poverty Severity vs Budget Allocation)
      if (this.quadrantChartRef) {
        this.quadrantChartInstance?.dispose();
        this.quadrantChartInstance = echarts.init(this.quadrantChartRef.nativeElement);
        
        // Data Mock Kuadran 38 Provinsi
        const scatterData = [
          { name: 'Papua Pegunungan', x: 32.8, y: 1.2, cat: 'KRITIS DEFISIT', symbolSize: 22, color: '#fb7185' },
          { name: 'Papua Tengah', x: 29.4, y: 1.4, cat: 'KRITIS DEFISIT', symbolSize: 20, color: '#fb7185' },
          { name: 'Papua Barat', x: 21.3, y: 2.1, cat: 'PRIORITAS DEFISIT', symbolSize: 18, color: '#fbbf24' },
          { name: 'Maluku', x: 16.2, y: 2.5, cat: 'PRIORITAS DEFISIT', symbolSize: 16, color: '#fbbf24' },
          { name: 'NTT', x: 19.8, y: 2.3, cat: 'PRIORITAS DEFISIT', symbolSize: 18, color: '#fbbf24' },
          { name: 'Gorontalo', x: 14.7, y: 2.8, cat: 'OPTIMAL', symbolSize: 14, color: '#2dd4bf' },
          { name: 'Sulawesi Barat', x: 11.5, y: 3.1, cat: 'OPTIMAL', symbolSize: 14, color: '#2dd4bf' },
          { name: 'Jawa Tengah', x: 10.4, y: 4.8, cat: 'OPTIMAL', symbolSize: 24, color: '#2dd4bf' },
          { name: 'Jawa Timur', x: 10.2, y: 5.2, cat: 'OPTIMAL', symbolSize: 26, color: '#2dd4bf' },
          { name: 'Jawa Barat', x: 7.8, y: 6.1, cat: 'OVER-ALLOCATION', symbolSize: 28, color: '#38bdf8' },
          { name: 'DKI Jakarta', x: 4.3, y: 7.5, cat: 'OVER-ALLOCATION', symbolSize: 22, color: '#38bdf8' },
          { name: 'Bali', x: 4.1, y: 6.8, cat: 'OVER-ALLOCATION', symbolSize: 16, color: '#38bdf8' },
          { name: 'Kalimantan Timur', x: 6.1, y: 6.4, cat: 'OVER-ALLOCATION', symbolSize: 16, color: '#38bdf8' },
          { name: 'Sumatera Utara', x: 8.1, y: 4.2, cat: 'OPTIMAL', symbolSize: 20, color: '#2dd4bf' },
          { name: 'Aceh', x: 14.4, y: 3.3, cat: 'PRIORITAS DEFISIT', symbolSize: 16, color: '#fbbf24' }
        ];

        this.quadrantChartInstance.setOption({
          backgroundColor: 'transparent',
          tooltip: {
            backgroundColor: '#0b1120',
            borderColor: 'rgba(255,255,255,0.15)',
            textStyle: { color: '#f8fafc' },
            formatter: (p: any) => {
              const d = p.data;
              return `<strong style="color:#38bdf8">${d.name}</strong><br/>` +
                `Tingkat Kemiskinan: <strong style="color:#fb7185">${d.value[0]}%</strong><br/>` +
                `Alokasi per Kapita: <strong>Rp${d.value[1]} Jt/jiwa</strong><br/>` +
                `Status: <strong style="color:${d.color}">${d.cat}</strong>`;
            }
          },
          grid: { left: '8%', right: '8%', bottom: '12%', top: '10%' },
          xAxis: {
            name: 'Tingkat Kemiskinan (%)',
            nameLocation: 'middle',
            nameGap: 28,
            nameTextStyle: { color: '#94a3b8', fontSize: 11 },
            type: 'value',
            min: 0,
            max: 35,
            axisLabel: { color: '#94a3b8' },
            splitLine: { lineStyle: { color: 'rgba(255, 255, 255, 0.06)' } }
          },
          yAxis: {
            name: 'Pagu per Kapita (Jt Rp)',
            nameTextStyle: { color: '#94a3b8', fontSize: 11 },
            type: 'value',
            min: 0,
            max: 8,
            axisLabel: { color: '#94a3b8' },
            splitLine: { lineStyle: { color: 'rgba(255, 255, 255, 0.06)' } }
          },
          series: [
            {
              type: 'scatter',
              data: scatterData.map(d => ({
                name: d.name,
                value: [d.x, d.y],
                cat: d.cat,
                color: d.color,
                symbolSize: d.symbolSize,
                itemStyle: {
                  color: d.color,
                  shadowBlur: 10,
                  shadowColor: d.color
                }
              })),
              markLine: {
                silent: true,
                lineStyle: { type: 'dashed', color: 'rgba(255, 255, 255, 0.2)' },
                data: [
                  { xAxis: 12, label: { formatter: 'Batas Rerata 12%', color: '#fbbf24', fontSize: 10 } },
                  { yAxis: 3.5, label: { formatter: 'Median Alokasi', color: '#2dd4bf', fontSize: 10 } }
                ]
              }
            }
          ]
        });
      }

      // 4. Chart Trajektori Penurunan Kemiskinan & Target RPJMN 2026
      if (this.trendChartRef) {
        this.trendChartInstance?.dispose();
        this.trendChartInstance = echarts.init(this.trendChartRef.nativeElement);

        this.trendChartInstance.setOption({
          backgroundColor: 'transparent',
          tooltip: {
            trigger: 'axis',
            backgroundColor: '#0b1120',
            borderColor: 'rgba(255,255,255,0.15)',
            textStyle: { color: '#f8fafc' }
          },
          legend: {
            data: ['Historis BPS', 'Proyeksi Formula IKW BRANTAS', 'Target RPJMN 2026'],
            bottom: '0%',
            textStyle: { color: '#94a3b8', fontSize: 11 }
          },
          grid: { left: '3%', right: '5%', bottom: '14%', top: '8%', containLabel: true },
          xAxis: {
            type: 'category',
            boundaryGap: false,
            data: ['2021', '2022', '2023', '2024', '2025', '2026 (Target)', '2027 (Proyeksi)'],
            axisLabel: { color: '#cbd5e1' }
          },
          yAxis: {
            type: 'value',
            min: 5,
            max: 11,
            axisLabel: { formatter: '{value}%', color: '#94a3b8' },
            splitLine: { lineStyle: { color: 'rgba(255, 255, 255, 0.06)' } }
          },
          series: [
            {
              name: 'Historis BPS',
              type: 'line',
              data: [10.14, 9.57, 9.36, 9.03, 8.85, null, null],
              smooth: true,
              lineStyle: { width: 3, color: '#38bdf8' },
              itemStyle: { color: '#38bdf8' }
            },
            {
              name: 'Proyeksi Formula IKW BRANTAS',
              type: 'line',
              data: [null, null, null, null, 8.85, 7.43, 6.82],
              smooth: true,
              lineStyle: { width: 3, color: '#2dd4bf', type: 'solid' },
              areaStyle: {
                color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
                  { offset: 0, color: 'rgba(45, 212, 191, 0.35)' },
                  { offset: 1, color: 'rgba(45, 212, 191, 0.0)' }
                ])
              },
              itemStyle: { color: '#2dd4bf' }
            },
            {
              name: 'Target RPJMN 2026',
              type: 'line',
              data: [7.5, 7.5, 7.5, 7.5, 7.5, 7.5, 7.5],
              lineStyle: { width: 2, color: '#fb7185', type: 'dashed' },
              itemStyle: { color: '#fb7185' }
            }
          ]
        });
      }

      window.addEventListener('resize', () => {
        this.corridorChartInstance?.resize();
        this.distChartInstance?.resize();
        this.quadrantChartInstance?.resize();
        this.trendChartInstance?.resize();
      });
    });
  }
}