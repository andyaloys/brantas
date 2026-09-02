import { AfterViewInit, ChangeDetectionStrategy, Component, ElementRef, ViewChild, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { LeafletMapAdapter, SpatialIndicatorLayer } from '../data/leaflet-map.adapter';
import { MoranAnalysis, SpatialDataService, SpatialGeoJson, SpatialRegionProperties } from '../data/spatial-data.service';

@Component({
  selector: 'app-spatial-page',
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
  protected readonly activeLayer = signal<SpatialIndicatorLayer>('povertyRate');
  protected readonly error = signal<string | null>(null);
  protected readonly isExporting = signal(false);

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