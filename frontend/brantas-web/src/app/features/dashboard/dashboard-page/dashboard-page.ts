import {
  AfterViewInit,
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  HostListener,
  NgZone,
  OnDestroy,
  ViewChild,
  effect,
  inject,
  signal
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import * as echarts from 'echarts';
import { GisChoroplethAdapter } from '../../spatial/data/gis-choropleth.adapter';
import { SpatialDataService } from '../../spatial/data/spatial-data.service';
import { ThemeService } from '../../../core/services/theme.service';
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
  imports: [CommonModule, RouterLink],
  providers: [GisChoroplethAdapter],
  templateUrl: './dashboard-page.html',
  styleUrl: './dashboard-page.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class DashboardPageComponent implements AfterViewInit, OnDestroy {
  private readonly dashboardData = inject(DashboardDataService);
  private readonly spatialData = inject(SpatialDataService);
  private readonly mapAdapter = inject(GisChoroplethAdapter);
  private readonly route = inject(ActivatedRoute);
  private readonly zone = inject(NgZone);
  protected readonly themeService = inject(ThemeService);

  @ViewChild('dashboardMapContainer') private dashboardMapContainerRef?: ElementRef<HTMLElement>;
  @ViewChild('quadrantChart') private quadrantChartRef?: ElementRef<HTMLElement>;
  @ViewChild('trendChart') private trendChartRef?: ElementRef<HTMLElement>;

  constructor() {
    effect(() => {
      // React to theme changes
      this.themeService.theme();
      if (this.activeTab() === 'allocation') {
        setTimeout(() => this.renderAllExecutiveCharts(), 50);
      }
    });
  }

  protected readonly isRunning = signal(false);
  protected readonly summary = signal<DashboardSummary | null>(null);
  protected readonly priorityRegions = signal<PriorityRegion[]>([]);
  protected readonly corridors = signal<RegionalCorridor[]>([]);
  protected readonly regencyRanks = signal<RegencyRanksResponse | null>(null);
  protected readonly distribution = signal<DistributionResponse | null>(null);
  protected readonly activeTab = signal<DashboardExecutiveTab>('macro');
  protected readonly error = signal<string | null>(null);

  private idnKabGeoJson: any = null;
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
      if (tab === 'macro') {
        this.renderDashboardMap();
      }
    }, 60);
  }

  ngAfterViewInit(): void {
    if (this.corridors().length > 0 && this.distribution()) {
      this.renderAllExecutiveCharts();
    }
    if (this.activeTab() === 'macro') {
      this.renderDashboardMap();
    }
  }

  ngOnDestroy(): void {
    this.mapAdapter.destroy();
    this.quadrantChartInstance?.dispose();
    this.trendChartInstance?.dispose();
  }

  @HostListener('window:resize')
  protected onWindowResize(): void {
    this.quadrantChartInstance?.resize();
    this.trendChartInstance?.resize();
    if (this.activeTab() === 'macro') {
      this.mapAdapter.invalidateSize();
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
      const [summary, priorityRegions, corridors, regencyRanks, distribution, idnKabGeoJson] = await Promise.all([
        firstValueFrom(this.dashboardData.getSummary()),
        firstValueFrom(this.dashboardData.getPriorityRegions()),
        firstValueFrom(this.dashboardData.getCorridors()),
        firstValueFrom(this.dashboardData.getRegencyRanks()),
        firstValueFrom(this.dashboardData.getDistribution()),
        firstValueFrom(this.spatialData.getIndonesiaKabupatenGeoJson())
      ]);

      this.summary.set(summary);
      this.priorityRegions.set(priorityRegions);
      this.corridors.set(corridors);
      this.regencyRanks.set(regencyRanks);
      this.distribution.set(distribution);
      this.idnKabGeoJson = idnKabGeoJson;

      setTimeout(() => {
        this.renderAllExecutiveCharts();
        if (this.activeTab() === 'macro') {
          this.renderDashboardMap();
        }
      }, 100);
    } catch {
      this.summary.set(null);
      this.error.set('Gagal memuat data dashboard. Pastikan backend aktif.');
    }
  }

  private renderDashboardMap(): void {
    if (this.dashboardMapContainerRef && this.idnKabGeoJson) {
      this.mapAdapter.render(
        this.dashboardMapContainerRef.nativeElement,
        this.idnKabGeoJson,
        () => {}
      );
      setTimeout(() => {
        this.mapAdapter.invalidateSize();
      }, 100);
    }
  }

  private renderAllExecutiveCharts(): void {
    this.zone.runOutsideAngular(() => {
      const isDark = this.themeService.theme() === 'dark';
      const textColor = isDark ? '#f8fafc' : '#0f172a';
      const textMuted = isDark ? '#94a3b8' : '#475569';
      const splitLineColor = isDark ? 'rgba(255, 255, 255, 0.08)' : '#e2e8f0';
      const tooltipBg = isDark ? '#0b1120' : '#1e293b';
      const tooltipBorder = isDark ? 'rgba(255, 255, 255, 0.15)' : 'rgba(0, 0, 0, 0.1)';

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
            backgroundColor: tooltipBg,
            borderColor: tooltipBorder,
            textStyle: { color: '#f8fafc' },
            formatter: (p: any) => {
              const d = p.data;
              return `<strong style="color:#38bdf8">${d.name}</strong><br/>` +
                `Tingkat Kemiskinan: <strong style="color:#fb7185">${d.value[0]}%</strong><br/>` +
                `Alokasi per Kapita: <strong>Rp${d.value[1]} Jt/jiwa</strong><br/>` +
                `Status: <strong style="color:${d.color}">${d.cat}</strong>`;
            }
          },
          grid: { left: '7%', right: '7%', bottom: '13%', top: '9%' },
          xAxis: {
            name: 'Tingkat Kemiskinan (%)',
            nameLocation: 'middle',
            nameGap: 24,
            nameTextStyle: { color: textColor, fontSize: 10.5, fontWeight: 700 },
            type: 'value',
            min: 0,
            max: 35,
            axisLabel: { color: textMuted, fontWeight: 600, fontSize: 10 },
            splitLine: { lineStyle: { color: splitLineColor } }
          },
          yAxis: {
            name: 'Pagu per Kapita (Jt Rp)',
            nameTextStyle: { color: textColor, fontSize: 10.5, fontWeight: 700 },
            type: 'value',
            min: 0,
            max: 8,
            axisLabel: { color: textMuted, fontWeight: 600, fontSize: 10 },
            splitLine: { lineStyle: { color: splitLineColor } }
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
                lineStyle: { type: 'dashed', color: isDark ? 'rgba(255, 255, 255, 0.25)' : 'rgba(0, 0, 0, 0.25)' },
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
            backgroundColor: tooltipBg,
            borderColor: tooltipBorder,
            textStyle: { color: '#f8fafc' }
          },
          legend: {
            data: ['Historis BPS', 'Proyeksi Formula IKW BRANTAS', 'Target RPJMN 2026'],
            bottom: '0%',
            textStyle: { color: textMuted, fontSize: 10.5, fontWeight: 600 }
          },
          grid: { left: '3%', right: '4%', bottom: '15%', top: '8%', containLabel: true },
          xAxis: {
            type: 'category',
            boundaryGap: false,
            data: ['2021', '2022', '2023', '2024', '2025', '2026 (Target)', '2027 (Proyeksi)'],
            axisLabel: { color: textColor, fontWeight: 600, fontSize: 10 }
          },
          yAxis: {
            type: 'value',
            min: 5,
            max: 11,
            axisLabel: { formatter: '{value}%', color: textMuted, fontWeight: 600, fontSize: 10 },
            splitLine: { lineStyle: { color: splitLineColor } }
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
    });
  }
}