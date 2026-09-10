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
import { KioskModeService } from '../../../core/services/kiosk-mode.service';
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
  protected readonly kiosk = inject(KioskModeService);

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

    effect(() => {
      // Re-invalidate map and charts when kiosk / fullscreen mode toggles
      this.kiosk.isKioskActive();
      setTimeout(() => {
        if (this.activeTab() === 'macro') {
          this.mapAdapter.invalidateSize();
        }
        this.quadrantChartInstance?.resize();
        this.trendChartInstance?.resize();
      }, 120);
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
          { name: 'Papua Pegunungan', x: 32.8, y: 1.2, cat: 'Defisit Kritis', symbolSize: 22 },
          { name: 'Papua Tengah', x: 29.4, y: 1.4, cat: 'Defisit Kritis', symbolSize: 20 },
          { name: 'Papua Barat', x: 21.3, y: 2.1, cat: 'Perlu Afirmasi', symbolSize: 18 },
          { name: 'Maluku', x: 16.2, y: 2.5, cat: 'Perlu Afirmasi', symbolSize: 16 },
          { name: 'NTT', x: 19.8, y: 2.3, cat: 'Perlu Afirmasi', symbolSize: 18 },
          { name: 'Gorontalo', x: 14.7, y: 2.8, cat: 'Sesuai Kebutuhan', symbolSize: 14 },
          { name: 'Sulawesi Barat', x: 11.5, y: 3.1, cat: 'Sesuai Kebutuhan', symbolSize: 14 },
          { name: 'Jawa Tengah', x: 10.4, y: 4.8, cat: 'Sesuai Kebutuhan', symbolSize: 24 },
          { name: 'Jawa Timur', x: 10.2, y: 5.2, cat: 'Sesuai Kebutuhan', symbolSize: 26 },
          { name: 'Jawa Barat', x: 7.8, y: 6.1, cat: 'Melampaui Rerata', symbolSize: 28 },
          { name: 'DKI Jakarta', x: 4.3, y: 7.5, cat: 'Melampaui Rerata', symbolSize: 22 },
          { name: 'Bali', x: 4.1, y: 6.8, cat: 'Melampaui Rerata', symbolSize: 16 },
          { name: 'Kalimantan Timur', x: 6.1, y: 6.4, cat: 'Melampaui Rerata', symbolSize: 16 },
          { name: 'Sumatera Utara', x: 8.1, y: 4.2, cat: 'Sesuai Kebutuhan', symbolSize: 20 },
          { name: 'Aceh', x: 14.4, y: 3.3, cat: 'Perlu Afirmasi', symbolSize: 16 }
        ];

        const quadrantCategories = [
          { name: 'Defisit Kritis', color: '#fb7185' },
          { name: 'Perlu Afirmasi', color: '#fbbf24' },
          { name: 'Sesuai Kebutuhan', color: '#2dd4bf' },
          { name: 'Melampaui Rerata', color: '#38bdf8' }
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
                `Persentase Kemiskinan: <strong style="color:#fb7185">${d.value[0]}%</strong><br/>` +
                `Alokasi Anggaran: <strong>Rp${d.value[1]} Jt/jiwa miskin</strong><br/>` +
                `Klasifikasi: <strong style="color:${d.color}">${d.cat}</strong>`;
            }
          },
          legend: {
            data: quadrantCategories.map(c => c.name),
            bottom: 6,
            icon: 'circle',
            itemWidth: 8,
            itemHeight: 8,
            itemGap: 16,
            textStyle: { color: textMuted, fontSize: 10.5, fontWeight: 600 }
          },
          grid: { left: 45, right: 25, bottom: 44, top: 28, containLabel: true },
          xAxis: {
            name: 'Persentase Kemiskinan Daerah (%)',
            nameLocation: 'middle',
            nameGap: 18,
            nameTextStyle: { color: textColor, fontSize: 10.5, fontWeight: 700 },
            type: 'value',
            min: 0,
            max: 35,
            axisLabel: { color: textMuted, fontWeight: 600, fontSize: 10 },
            splitLine: { lineStyle: { color: splitLineColor } }
          },
          yAxis: {
            name: 'Pagu per Jiwa Miskin (Juta Rp)',
            nameTextStyle: { color: textColor, fontSize: 10.5, fontWeight: 700, padding: [0, 0, 0, 40] },
            type: 'value',
            min: 0,
            max: 8,
            axisLabel: { color: textMuted, fontWeight: 600, fontSize: 10 },
            splitLine: { lineStyle: { color: splitLineColor } }
          },
          series: quadrantCategories.map((cat, idx) => ({
            name: cat.name,
            type: 'scatter',
            itemStyle: {
              color: cat.color
            },
            data: scatterData.filter(d => d.cat === cat.name).map(d => ({
              name: d.name,
              value: [d.x, d.y],
              cat: cat.name,
              color: cat.color,
              symbolSize: d.symbolSize,
              itemStyle: {
                color: cat.color,
                shadowBlur: 10,
                shadowColor: cat.color
              }
            })),
            markLine: idx === 0 ? {
              silent: true,
              lineStyle: { type: 'dashed', color: isDark ? 'rgba(255, 255, 255, 0.25)' : 'rgba(0, 0, 0, 0.25)' },
              data: [
                { xAxis: 12, label: { formatter: 'Batas Rerata 12%', color: '#fbbf24', fontSize: 10 } },
                { yAxis: 3.5, label: { formatter: 'Median Alokasi', color: '#2dd4bf', fontSize: 10 } }
              ]
            } : undefined
          }))
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
            data: ['Realisasi Historis BPS', 'Simulasi Formula Afirmatif BRANTAS', 'Target Sasaran RPJMN'],
            bottom: 6,
            textStyle: { color: textMuted, fontSize: 10.5, fontWeight: 600 }
          },
          grid: { left: '4%', right: '4%', bottom: 42, top: 26, containLabel: true },
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
              name: 'Realisasi Historis BPS',
              type: 'line',
              data: [10.14, 9.57, 9.36, 9.03, 8.85, null, null],
              smooth: true,
              lineStyle: { width: 3, color: '#38bdf8' },
              itemStyle: { color: '#38bdf8' }
            },
            {
              name: 'Simulasi Formula Afirmatif BRANTAS',
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
              name: 'Target Sasaran RPJMN',
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