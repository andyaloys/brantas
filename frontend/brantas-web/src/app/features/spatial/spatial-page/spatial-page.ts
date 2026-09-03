import { AfterViewInit, ChangeDetectionStrategy, Component, ElementRef, ViewChild, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { firstValueFrom } from 'rxjs';
import { LeafletMapAdapter, SpatialIndicatorLayer } from '../data/leaflet-map.adapter';
import { MoranAnalysis, SpatialDataService, SpatialGeoJson, SpatialRegionProperties } from '../data/spatial-data.service';

@Component({
  selector: 'app-spatial-page',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './spatial-page.html',
  styleUrl: './spatial-page.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class SpatialPageComponent implements AfterViewInit {
  private readonly spatialData = inject(SpatialDataService);
  private readonly mapAdapter = inject(LeafletMapAdapter);

  @ViewChild('map') private mapElement?: ElementRef<HTMLElement>;

  protected readonly analysis = signal<MoranAnalysis | null>(null);
  protected readonly geoJson = signal<SpatialGeoJson | null>(null);
  protected readonly selectedRegion = signal<SpatialRegionProperties | null>(null);
  protected readonly selectedProvince = signal<string>('all');
  protected readonly activeLayer = signal<SpatialIndicatorLayer>('povertyRate');
  protected readonly error = signal<string | null>(null);
  protected readonly isExporting = signal(false);

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

    return {
      name: prov,
      regencyCount: count,
      avgPoverty,
      totalPoor,
      avgHdi,
      avgDepth,
      avgSeverity
    };
  });

  async ngAfterViewInit(): Promise<void> {
    try {
      const [analysis, geoJson] = await Promise.all([
        firstValueFrom(this.spatialData.getMoranAnalysis()),
        firstValueFrom(this.spatialData.getRegionsGeoJson())
      ]);
      this.analysis.set(analysis);
      this.geoJson.set(geoJson);
      this.mapAdapter.render(this.mapElement!.nativeElement, geoJson, (region) => {
        this.selectedRegion.set(region);
      });
    } catch {
      this.error.set('Analisis spasial belum dapat dimuat. Pastikan layanan BRANTAS aktif.');
    }
  }

  protected switchLayer(layer: SpatialIndicatorLayer): void {
    this.activeLayer.set(layer);
    this.mapAdapter.setLayer(layer);
  }

  protected onProvinceChange(event: Event): void {
    const target = event.target as HTMLSelectElement;
    const prov = target.value;
    this.selectedProvince.set(prov);
    this.selectedRegion.set(null); // Reset single regency inspector
    this.mapAdapter.filterAndZoomProvince(prov);
  }

  protected resetToNational(): void {
    this.selectedProvince.set('all');
    this.selectedRegion.set(null);
    this.mapAdapter.filterAndZoomProvince('all');
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