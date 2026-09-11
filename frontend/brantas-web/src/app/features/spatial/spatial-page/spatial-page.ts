import { AfterViewInit, ChangeDetectionStrategy, Component, ElementRef, OnDestroy, ViewChild, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { firstValueFrom } from 'rxjs';
import { GisChoroplethAdapter, SpatialIndicatorLayer, CARTOGRAPHIC_BASEMAPS, CLUSTER_COLORS, CLUSTER_META } from '../data/gis-choropleth.adapter';
import { MoranAnalysis, SpatialDataService, SpatialGeoJson, SpatialRegionProperties } from '../data/spatial-data.service';

@Component({
  selector: 'app-spatial-page',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './spatial-page.html',
  styleUrl: './spatial-page.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class SpatialPageComponent implements AfterViewInit, OnDestroy {
  private readonly spatialData = inject(SpatialDataService);
  private readonly mapAdapter = inject(GisChoroplethAdapter);

  @ViewChild('mapContainer') private mapContainerRef?: ElementRef<HTMLElement>;

  protected readonly analysis = signal<MoranAnalysis | null>(null);
  protected readonly geoJson = signal<SpatialGeoJson | null>(null);
  protected readonly selectedRegion = signal<SpatialRegionProperties | null>(null);
  protected readonly selectedProvince = signal<string>('all');
  protected readonly activeLayer = signal<SpatialIndicatorLayer>('cluster');
  protected readonly error = signal<string | null>(null);
  protected readonly isExporting = signal(false);

  // Basemap & View Controls
  protected readonly basemaps = CARTOGRAPHIC_BASEMAPS;
  protected readonly activeBasemap = signal<string>('topo');
  protected readonly isBasemapPanelOpen = signal<boolean>(false);
  protected readonly isMapMaximized = signal<boolean>(false);
  protected readonly contentViewMode = signal<'map' | 'table'>('map');
  protected readonly cursorCoords = signal<{ lat: number; lng: number } | null>(null);

  // Extract unique provinces list sorted alphabetically
  protected readonly provinces = computed(() => {
    const data = this.geoJson();
    if (!data) return [];
    const unique = new Set<string>();
    for (const f of data.features) {
      if (f.properties?.parent) {
        unique.add(f.properties.parent);
      }
    }
    return Array.from(unique).sort((a, b) => a.localeCompare(b, 'id'));
  });

  // Filtered regions list for Table view
  protected readonly filteredRegions = computed(() => {
    const data = this.geoJson();
    if (!data) return [];
    const prov = this.selectedProvince();
    return data.features
      .map(f => f.properties)
      .filter(p => !!p && (prov === 'all' || p.parent.toLowerCase() === prov.toLowerCase()))
      .sort((a, b) => b.povertyRate - a.povertyRate);
  });

  // Compute aggregate stats for selected province
  protected readonly provinceAggregate = computed(() => {
    const prov = this.selectedProvince();
    const data = this.geoJson();
    if (!data || prov === 'all') return null;

    const matching = data.features
      .map(f => f.properties)
      .filter(p => p && p.parent.toLowerCase() === prov.toLowerCase());

    if (matching.length === 0) return null;

    const count = matching.length;
    const avgPoverty = matching.reduce((sum, r) => sum + r.povertyRate, 0) / count;
    const totalPoor = matching.reduce((sum, r) => sum + r.poorPopulation, 0);
    const avgHdi = matching.reduce((sum, r) => sum + r.humanDevelopmentIndex, 0) / count;
    const avgDepth = matching.reduce((sum, r) => sum + r.povertyDepthIndex, 0) / count;
    const avgSeverity = matching.reduce((sum, r) => sum + r.povertySeverityIndex, 0) / count;
    const avgDisaster = matching.reduce((sum, r) => sum + (r.disasterRisk ?? 0.5), 0) / count;

    // Determine dominant cluster
    const clusterTally: Record<string, number> = {
      'High-High': 0,
      'High-Low': 0,
      'Low-High': 0,
      'Low-Low': 0
    };
    for (const r of matching) {
      if (clusterTally[r.cluster] !== undefined) {
        clusterTally[r.cluster]++;
      }
    }
    let dominantCluster: 'High-High' | 'Low-Low' | 'High-Low' | 'Low-High' = 'Low-Low';
    let maxCount = -1;
    for (const [cl, cnt] of Object.entries(clusterTally)) {
      if (cnt > maxCount) {
        maxCount = cnt;
        dominantCluster = cl as any;
      }
    }

    return {
      name: prov,
      regencyCount: count,
      avgPoverty,
      totalPoor,
      avgHdi,
      avgDepth,
      avgSeverity,
      avgDisaster,
      cluster: dominantCluster
    };
  });

  async ngAfterViewInit(): Promise<void> {
    try {
      const [analysis, geoJson, idnKabGeoJson] = await Promise.all([
        firstValueFrom(this.spatialData.getMoranAnalysis()),
        firstValueFrom(this.spatialData.getRegionsGeoJson()),
        firstValueFrom(this.spatialData.getIndonesiaKabupatenGeoJson())
      ]);
      this.analysis.set(analysis);
      this.geoJson.set(geoJson);

      // Sinkronisasi data indikator & risiko bencana IRBI BNPB ke poligon kartografi
      if (geoJson?.features && idnKabGeoJson?.features) {
        const beMap = new Map<string, any>();
        const parentMap = new Map<string, { risk: number; cat: string }>();
        for (const f of geoJson.features) {
          if (f.properties?.regionId) {
            beMap.set(f.properties.regionId, f.properties);
          }
          if (f.properties?.parent && f.properties.disasterRisk !== undefined) {
            parentMap.set(f.properties.parent.toLowerCase(), {
              risk: f.properties.disasterRisk,
              cat: f.properties.disasterCategory ?? 'Sedang'
            });
          }
        }

        for (const f of idnKabGeoJson.features) {
          const be = beMap.get(f.properties?.regionId);
          if (be) {
            f.properties.disasterRisk = be.disasterRisk;
            f.properties.disasterCategory = be.disasterCategory;
            f.properties.cluster = be.cluster ?? f.properties.cluster;
            f.properties.povertyRate = be.povertyRate ?? f.properties.povertyRate;
            f.properties.humanDevelopmentIndex = be.humanDevelopmentIndex ?? f.properties.humanDevelopmentIndex;
          } else if (f.properties?.parent) {
            const fallback = parentMap.get(f.properties.parent.toLowerCase());
            if (fallback) {
              f.properties.disasterRisk = fallback.risk;
              f.properties.disasterCategory = fallback.cat;
            }
          }
        }
      }

      if (this.mapContainerRef) {
        this.mapAdapter.render(
          this.mapContainerRef.nativeElement,
          idnKabGeoJson,
          (region) => this.onRegionSelected(region),
          (lat, lng) => this.cursorCoords.set({ lat, lng })
        );
      }
    } catch {
      this.error.set('Analisis spasial belum dapat dimuat. Pastikan layanan BRANTAS aktif.');
    }
  }

  ngOnDestroy(): void {
    this.mapAdapter.destroy();
  }

  protected switchLayer(layer: SpatialIndicatorLayer): void {
    this.activeLayer.set(layer);
    this.mapAdapter.setLayer(layer);
  }

  protected toggleBasemapPanel(): void {
    this.isBasemapPanelOpen.update(v => !v);
  }

  protected selectBasemap(id: string): void {
    this.activeBasemap.set(id);
    this.mapAdapter.switchBasemap(id);
    this.isBasemapPanelOpen.set(false);
  }

  protected onProvinceChange(event: Event): void {
    const target = event.target as HTMLSelectElement;
    const prov = target.value;
    this.selectedProvince.set(prov);
    this.selectedRegion.set(null);
    this.mapAdapter.filterAndZoomProvince(prov);
  }

  protected onRegionSelected(region: SpatialRegionProperties): void {
    this.selectedRegion.set(region);
    this.selectedProvince.set(region.parent);
  }

  protected resetMapView(): void {
    this.selectedProvince.set('all');
    this.selectedRegion.set(null);
    this.mapAdapter.filterAndZoomProvince('all');
    this.mapAdapter.resetZoom();
  }

  protected zoomIn(): void {
    this.mapAdapter.zoomIn();
  }

  protected zoomOut(): void {
    this.mapAdapter.zoomOut();
  }

  protected toggleContentView(mode: 'map' | 'table'): void {
    this.contentViewMode.set(mode);
    if (mode === 'map') {
      setTimeout(() => {
        this.mapAdapter.invalidateSize();
      }, 60);
    }
  }

  protected toggleMapMaximize(): void {
    this.isMapMaximized.update(v => !v);
    setTimeout(() => {
      this.mapAdapter.invalidateSize();
    }, 60);
  }

  protected selectRegionFromTable(region: SpatialRegionProperties): void {
    this.selectedRegion.set(region);
    this.selectedProvince.set(region.parent);
    this.contentViewMode.set('map');

    setTimeout(() => {
      this.mapAdapter.invalidateSize();
      this.mapAdapter.filterAndZoomProvince(region.parent);
      this.mapAdapter.zoomToRegion(region.name);
    }, 60);
  }

  protected async exportCsv(): Promise<void> {
    this.isExporting.set(true);
    try {
      const file = await firstValueFrom(this.spatialData.downloadSpatialCsv());
      const url = URL.createObjectURL(file);
      const link = document.createElement('a');
      link.href = url;
      link.download = `spasial-kemiskinan-brantas-${this.geoJson()?.period ?? '2026'}.csv`;
      link.click();
      URL.revokeObjectURL(url);
    } catch {
      this.error.set('Ekspor data spasial gagal.');
    } finally {
      this.isExporting.set(false);
    }
  }

  protected translateCluster(cluster: string): string {
    switch (cluster) {
      case 'High-High': return 'Klaster Kemiskinan Tinggi (Hotspot)';
      case 'High-Low': return 'Kantong Miskin Terisolasi (Outlier Tinggi)';
      case 'Low-High': return 'Wilayah Maju Terjepit (Outlier Rendah)';
      case 'Low-Low': return 'Klaster Sejahtera (Coldspot)';
      default: return cluster;
    }
  }

  protected translateClusterShort(cluster: string): string {
    switch (cluster) {
      case 'High-High': return 'Hotspot (Tinggi)';
      case 'High-Low': return 'Outlier Tinggi';
      case 'Low-High': return 'Outlier Rendah';
      case 'Low-Low': return 'Coldspot (Sejahtera)';
      default: return cluster;
    }
  }

  protected getClusterClass(cluster: string): string {
    switch (cluster) {
      case 'High-High': return 'cluster-hh';
      case 'High-Low': return 'cluster-hl';
      case 'Low-High': return 'cluster-lh';
      case 'Low-Low': return 'cluster-ll';
      default: return '';
    }
  }

  protected exportGeoJson(): void {
    const data = this.geoJson();
    if (!data) return;
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/geo+json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `wilayah-spasial-brantas-${data.period}.geojson`;
    link.click();
    URL.revokeObjectURL(url);
  }
}