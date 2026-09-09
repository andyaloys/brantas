import { Injectable, NgZone, inject } from '@angular/core';
import * as L from 'leaflet';
import { SpatialRegionProperties } from './spatial-data.service';

export type SpatialIndicatorLayer = 'cluster' | 'povertyRate' | 'povertyDepth' | 'povertySeverity' | 'hdi';

export interface BasemapDef {
  id: string;
  label: string;
  url: string;
  attribution: string;
  subdomains?: string[];
  maxZoom: number;
}

export const CLUSTER_COLORS = {
  'High-High': '#991b1b', // Merah pekat (Hotspot)
  'High-Low': '#ef4444',  // Merah normal (Outlier Tinggi)
  'Low-High': '#f97316',  // Orange (Outlier Rendah)
  'Low-Low': '#eab308'    // Kuning (Coldspot)
};

export const CLUSTER_META = {
  'High-High': { label: 'High-High (Hotspot)', bg: '#991b1b', text: '#ffffff' },
  'High-Low': { label: 'High-Low (Outlier Tinggi)', bg: '#ef4444', text: '#ffffff' },
  'Low-High': { label: 'Low-High (Outlier Rendah)', bg: '#f97316', text: '#ffffff' },
  'Low-Low': { label: 'Low-Low (Coldspot)', bg: '#eab308', text: '#0f172a' }
};

export const CARTOGRAPHIC_BASEMAPS: BasemapDef[] = [
  {
    id: 'topo',
    label: 'Topografi (Esri Topo)',
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Topo_Map/MapServer/tile/{z}/{y}/{x}',
    attribution: 'Tiles &copy; Esri &mdash; Esri, DeLorme, NAVTEQ',
    maxZoom: 18
  },
  {
    id: 'street',
    label: 'Jalan & Wilayah (Esri Street)',
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}',
    attribution: 'Tiles &copy; Esri &mdash; Esri, DeLorme, NAVTEQ',
    maxZoom: 18
  },
  {
    id: 'osm',
    label: 'Jalan & Kota (OSM)',
    url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
    attribution: '&copy; OpenStreetMap contributors',
    subdomains: ['a', 'b', 'c'],
    maxZoom: 19
  },
  {
    id: 'satellite',
    label: 'Citra Satelit (Esri)',
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    attribution: 'Tiles &copy; Esri &mdash; Source: Esri, Maxar, Earthstar Geographics',
    maxZoom: 18
  },
  {
    id: 'lightgray',
    label: 'Light Canvas (Esri)',
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Light_Gray_Base/MapServer/tile/{z}/{y}/{x}',
    attribution: 'Tiles &copy; Esri &mdash; Esri, HERE, Garmin',
    maxZoom: 18
  }
];

export const PROVINCE_CENTROIDS: Record<string, [number, number]> = {
  'Aceh': [3.9696, 96.6621],
  'Bali': [-8.4095, 115.1889],
  'Banten': [-6.4489, 105.9503],
  'Bengkulu': [-3.8972, 102.4064],
  'DI Yogyakarta': [-7.8721, 110.421],
  'DKI Jakarta': [-6.2088, 106.8456],
  'Gorontalo': [0.6725, 122.357],
  'Jambi': [-1.7501, 102.8108],
  'Jawa Barat': [-6.8707, 107.6047],
  'Jawa Tengah': [-6.991, 110.124],
  'Jawa Timur': [-7.1046, 113.3985],
  'Kalimantan Barat': [-0.4873, 111.4491],
  'Kalimantan Selatan': [-3.0733, 115.4524],
  'Kalimantan Tengah': [-1.3853, 113.2909],
  'Kalimantan Timur': [0.0779, 116.4116],
  'Kalimantan Utara': [2.7547, 116.2767],
  'Kepulauan Bangka Belitung': [-2.3866, 106.7014],
  'Kepulauan Riau': [0.95, 104.45],
  'Lampung': [-4.9495, 104.7547],
  'Maluku': [-3.65, 128.18],
  'Maluku Utara': [0.0842, 127.1032],
  'Nusa Tenggara Barat': [-8.5932, 117.5759],
  'Nusa Tenggara Timur': [-8.65, 121.08],
  'Papua': [-2.3673, 137.8996],
  'Papua Barat': [-2.4849, 133.5746],
  'Papua Barat Daya': [-1.1219, 131.4228],
  'Papua Pegunungan': [-4.1344, 139.3579],
  'Papua Selatan': [-6.8454, 139.3303],
  'Papua Tengah': [-3.9503, 136.4699],
  'Riau': [0.7117, 101.9306],
  'Sulawesi Barat': [-2.2063, 119.3159],
  'Sulawesi Selatan': [-4.6855, 119.746],
  'Sulawesi Tengah': [-1.1419, 121.73],
  'Sulawesi Tenggara': [-4.4926, 122.4733],
  'Sulawesi Utara': [2.5388, 125.1301],
  'Sumatera Barat': [-1.2923, 100.2406],
  'Sumatera Selatan': [-3.2767, 104.0803],
  'Sumatera Utara': [1.8314, 98.7467]
};

export const MAJOR_ISLAND_LABELS: { name: string; center: [number, number] }[] = [
  { name: 'SUMATERA', center: [-0.13, 102.08] },
  { name: 'JAWA', center: [-7.10, 110.51] },
  { name: 'KALIMANTAN', center: [-0.22, 113.84] },
  { name: 'SULAWESI', center: [-1.32, 120.90] },
  { name: 'BALI & NUSA TENGGARA', center: [-8.60, 119.50] },
  { name: 'MALUKU', center: [-2.85, 129.59] },
  { name: 'PAPUA', center: [-4.54, 137.20] }
];

@Injectable({ providedIn: 'root' })
export class GisChoroplethAdapter {
  private readonly zone = inject(NgZone);
  private readonly ZOOM_PROV_THRESHOLD = 6;
  private readonly ZOOM_KAB_THRESHOLD = 7;
  private map: L.Map | null = null;
  private currentTileLayer: L.TileLayer | null = null;
  private geoJsonLayer: L.GeoJSON | null = null;
  private islandLabelsLayer: L.LayerGroup | null = null;
  private provLabelsLayer: L.LayerGroup | null = null;
  private kabLabelsLayer: L.LayerGroup | null = null;
  private currentLayer: SpatialIndicatorLayer = 'cluster';
  private currentBasemapId = 'topo';
  private regencyLayerMap = new Map<string, any>();
  private allFeatures: any[] = [];
  private onSelectRegionCallback?: (region: SpatialRegionProperties) => void;

  render(
    container: HTMLElement,
    kabupatenGeoJson: any,
    onSelectRegion: (region: SpatialRegionProperties) => void,
    onCoords?: (lat: number, lng: number) => void
  ): void {
    this.allFeatures = kabupatenGeoJson?.features || [];
    this.onSelectRegionCallback = onSelectRegion;

    this.zone.runOutsideAngular(() => {
      // 1. Destroy any existing instance
      this.destroy();

      // 2. Initialize Leaflet Map centered on Indonesia
      this.map = L.map(container, {
        center: [-2.2, 118.0],
        zoom: 5,
        minZoom: 4,
        maxZoom: 14,
        zoomControl: false,
        attributionControl: false
      });

      // 3. Create Custom Labels Pane for 514 Regency Names (zIndex 500, above polygons 400, below tooltip 10000)
      const labelsPane = this.map.createPane('labelsPane');
      labelsPane.style.zIndex = '500';
      labelsPane.style.pointerEvents = 'none';

      // 4. Ensure Tooltip Pane sits at top level (zIndex 10000) so tooltips are never obstructed
      const tooltipPane = this.map.getPane('tooltipPane');
      if (tooltipPane) {
        tooltipPane.style.zIndex = '10000';
      }

      // 5. Add Default Cartographic Basemap (Official Esri World Topo Map, without watermark)
      this.switchBasemap('topo');

      // 6. Render Regency/City Level Choropleth Polygons, Province Labels, and Regency Labels
      this.renderRegencyChoropleth(kabupatenGeoJson);

      // 7. Dynamic Multiscale (LOD) Zoom Listener
      this.map.on('zoomend', () => {
        this.updateLabelsVisibility();
      });

      // 8. Track Cursor Coordinates WGS84
      if (onCoords) {
        this.map.on('mousemove', (e: L.LeafletMouseEvent) => {
          this.zone.run(() => {
            onCoords(e.latlng.lat, e.latlng.lng);
          });
        });
      }

      // Initial view centered on Indonesia & apply initial label visibility (zoom < 7 -> province only)
      this.fitIndonesiaBounds();
      this.updateLabelsVisibility();
    });
  }

  setLayer(layer: SpatialIndicatorLayer): void {
    this.currentLayer = layer;
    this.updateChoroplethStyles();
  }

  switchBasemap(id: string): void {
    if (!this.map) return;
    const def = CARTOGRAPHIC_BASEMAPS.find(b => b.id === id) || CARTOGRAPHIC_BASEMAPS[0];
    this.currentBasemapId = def.id;

    if (this.currentTileLayer) {
      this.map.removeLayer(this.currentTileLayer);
    }

    this.currentTileLayer = L.tileLayer(def.url, {
      attribution: def.attribution,
      subdomains: def.subdomains || 'abc',
      maxZoom: def.maxZoom
    }).addTo(this.map);

    // Ensure polygons and labels remain on top
    this.geoJsonLayer?.bringToFront();
  }

  filterAndZoomProvince(provName: string): void {
    if (!this.map || !this.geoJsonLayer) return;

    if (provName === 'all') {
      this.fitIndonesiaBounds();
      this.resetLayerHighlights();
    } else {
      const bounds = L.latLngBounds([]);
      let count = 0;

      this.geoJsonLayer.eachLayer((layer: any) => {
        const p = layer.feature?.properties;
        const isMatch = p && p.parent && p.parent.toLowerCase() === provName.toLowerCase();
        const markerEl = layer._labelMarker?.getElement?.();

        if (isMatch) {
          bounds.extend(layer.getBounds());
          count++;
          layer.setStyle({
            weight: 1.8,
            color: '#0f172a',
            fillOpacity: 0.85
          });
          if (markerEl) {
            markerEl.style.opacity = '1';
            markerEl.style.display = '';
          }
        } else {
          layer.setStyle({
            fillOpacity: 0.22,
            weight: 0.5,
            color: '#94a3b8'
          });
          if (markerEl) {
            markerEl.style.opacity = '0.25';
          }
        }
      });

      if (count > 0 && bounds.isValid()) {
        this.map.fitBounds(bounds, {
          padding: [40, 40],
          maxZoom: 9,
          animate: true
        });
        if (this.islandLabelsLayer && this.map.hasLayer(this.islandLabelsLayer)) {
          this.map.removeLayer(this.islandLabelsLayer);
        }
        if (this.provLabelsLayer && this.map.hasLayer(this.provLabelsLayer)) {
          this.map.removeLayer(this.provLabelsLayer);
        }
        if (this.kabLabelsLayer && !this.map.hasLayer(this.kabLabelsLayer)) {
          this.map.addLayer(this.kabLabelsLayer);
        }
      }
    }
  }

  zoomIn(): void {
    this.map?.zoomIn();
  }

  zoomOut(): void {
    this.map?.zoomOut();
  }

  resetZoom(): void {
    this.fitIndonesiaBounds();
  }

  fitIndonesiaBounds(): void {
    if (!this.map) return;
    this.map.setView([-2.2, 118.0], 5, { animate: true });
    this.updateLabelsVisibility();
  }

  invalidateSize(): void {
    if (this.map) {
      setTimeout(() => {
        this.map?.invalidateSize();
      }, 50);
    }
  }

  destroy(): void {
    if (this.map) {
      this.map.remove();
      this.map = null;
    }
    this.currentTileLayer = null;
    this.geoJsonLayer = null;
    this.islandLabelsLayer = null;
    this.provLabelsLayer = null;
    this.kabLabelsLayer = null;
    this.regencyLayerMap.clear();
  }

  private updateLabelsVisibility(): void {
    if (!this.map || !this.islandLabelsLayer || !this.provLabelsLayer || !this.kabLabelsLayer) return;
    const currentZoom = this.map.getZoom();

    if (currentZoom < this.ZOOM_PROV_THRESHOLD) {
      // 1. Skala Nasional (Zoom <= 5): Hanya Tampilkan Label 7 Pulau Besar
      if (!this.map.hasLayer(this.islandLabelsLayer)) {
        this.map.addLayer(this.islandLabelsLayer);
      }
      if (this.map.hasLayer(this.provLabelsLayer)) {
        this.map.removeLayer(this.provLabelsLayer);
      }
      if (this.map.hasLayer(this.kabLabelsLayer)) {
        this.map.removeLayer(this.kabLabelsLayer);
      }
    } else if (currentZoom < this.ZOOM_KAB_THRESHOLD) {
      // 2. Skala Regional (Zoom 6): Tampilkan 38 Nama Provinsi
      if (this.map.hasLayer(this.islandLabelsLayer)) {
        this.map.removeLayer(this.islandLabelsLayer);
      }
      if (!this.map.hasLayer(this.provLabelsLayer)) {
        this.map.addLayer(this.provLabelsLayer);
      }
      if (this.map.hasLayer(this.kabLabelsLayer)) {
        this.map.removeLayer(this.kabLabelsLayer);
      }
    } else {
      // 3. Skala Detail (Zoom >= 7): Tampilkan Nama Kab/Kota
      if (this.map.hasLayer(this.islandLabelsLayer)) {
        this.map.removeLayer(this.islandLabelsLayer);
      }
      if (this.map.hasLayer(this.provLabelsLayer)) {
        this.map.removeLayer(this.provLabelsLayer);
      }
      if (!this.map.hasLayer(this.kabLabelsLayer)) {
        this.map.addLayer(this.kabLabelsLayer);
      }
    }
  }

  private getColorForProps(p: SpatialRegionProperties): string {
    if (!p) return '#eab308';

    switch (this.currentLayer) {
      case 'cluster':
        return CLUSTER_COLORS[p.cluster] ?? '#eab308';

      case 'povertyRate':
        if (p.povertyRate >= 18) return '#991b1b'; // Merah pekat
        if (p.povertyRate >= 12) return '#ef4444'; // Merah normal
        if (p.povertyRate >= 7)  return '#f97316'; // Orange
        return '#eab308';                           // Kuning

      case 'povertyDepth':
        if (p.povertyDepthIndex >= 2.5) return '#991b1b';
        if (p.povertyDepthIndex >= 1.5) return '#ef4444';
        if (p.povertyDepthIndex >= 0.8) return '#f97316';
        return '#eab308';

      case 'povertySeverity':
        if (p.povertySeverityIndex >= 0.8) return '#991b1b';
        if (p.povertySeverityIndex >= 0.4) return '#ef4444';
        if (p.povertySeverityIndex >= 0.2) return '#f97316';
        return '#eab308';

      case 'hdi':
        if (p.humanDevelopmentIndex >= 75) return '#059669'; // Emerald
        if (p.humanDevelopmentIndex >= 70) return '#0d9488'; // Teal
        if (p.humanDevelopmentIndex >= 66) return '#0284c7'; // Sky blue
        return '#d97706';                                   // Amber
    }
  }

  private renderRegencyChoropleth(geoJsonData: any): void {
    if (!this.map || !geoJsonData) return;

    if (this.geoJsonLayer) {
      this.map.removeLayer(this.geoJsonLayer);
    }
    if (this.islandLabelsLayer) {
      this.map.removeLayer(this.islandLabelsLayer);
    }
    if (this.provLabelsLayer) {
      this.map.removeLayer(this.provLabelsLayer);
    }
    if (this.kabLabelsLayer) {
      this.map.removeLayer(this.kabLabelsLayer);
    }

    this.regencyLayerMap.clear();
    this.islandLabelsLayer = L.layerGroup([], { pane: 'labelsPane' });
    this.provLabelsLayer = L.layerGroup([], { pane: 'labelsPane' });
    this.kabLabelsLayer = L.layerGroup([], { pane: 'labelsPane' });

    // 1. Build Major Island / Regional Labels (Skala Nasional Zoom 4-5)
    for (const island of MAJOR_ISLAND_LABELS) {
      const marker = L.marker(island.center, {
        pane: 'labelsPane',
        icon: L.divIcon({
          className: 'island-plain-label',
          html: `<span>${island.name}</span>`,
          iconSize: [220, 24],
          iconAnchor: [110, 12]
        }),
        interactive: false
      });
      this.islandLabelsLayer.addLayer(marker);
    }

    // 2. Build Province Plain Black Labels (38 Provinces, Skala Regional Zoom 6)
    const uniqueParents = new Set<string>();
    for (const f of geoJsonData.features || []) {
      if (f.properties?.parent) {
        uniqueParents.add(f.properties.parent);
      }
    }

    for (const provName of uniqueParents) {
      const coords = PROVINCE_CENTROIDS[provName];
      if (coords) {
        const provMarker = L.marker(coords, {
          pane: 'labelsPane',
          icon: L.divIcon({
            className: 'prov-plain-label',
            html: `<span>${provName}</span>`,
            iconSize: [160, 20],
            iconAnchor: [80, 10]
          }),
          interactive: false
        });
        this.provLabelsLayer.addLayer(provMarker);
      }
    }

    // 2. Build Regency Polygons & Kab/Kota Plain Black Labels (displayed at zoom >= 7)
    this.geoJsonLayer = L.geoJSON(geoJsonData, {
      style: (feature) => {
        const p: SpatialRegionProperties = feature?.properties;
        const fillColor = this.getColorForProps(p);

        return {
          fillColor,
          fillOpacity: 0.58,
          color: '#ffffff',
          weight: 0.85,
          opacity: 0.95
        };
      },
      onEachFeature: (feature, layer) => {
        const p: SpatialRegionProperties = feature?.properties;
        if (!p) return;

        if (p.name) {
          this.regencyLayerMap.set(p.name.toLowerCase(), layer);
        }

        // Add pure black text label at polygon center (All 514 regencies/cities)
        const center = (layer as any).getBounds?.()?.getCenter?.();
        if (center && p.name && this.kabLabelsLayer) {
          const labelMarker = L.marker(center, {
            pane: 'labelsPane',
            icon: L.divIcon({
              className: 'kab-plain-label',
              html: `<span>${p.name}</span>`,
              iconSize: [110, 16],
              iconAnchor: [55, 8]
            }),
            interactive: false
          });
          (layer as any)._labelMarker = labelMarker;
          this.kabLabelsLayer.addLayer(labelMarker);
        }

        // Build Executive Tooltip with 5 Required Parameters
        const tooltipHtml = this.createRegencyTooltipHtml(p);
        layer.bindTooltip(tooltipHtml, {
          sticky: true,
          direction: 'auto',
          className: 'executive-map-tooltip',
          offset: [0, -10]
        });

        // Interactive Regency Hover & Click Events
        layer.on({
          mouseover: (e) => {
            const poly = e.target;
            poly.setStyle({
              weight: 2.0,
              color: '#0f172a',
              fillOpacity: 0.82
            });
            if (!L.Browser.ie && !L.Browser.opera && !L.Browser.edge) {
              poly.bringToFront();
            }
          },
          mouseout: (e) => {
            const poly = e.target;
            poly.setStyle({
              fillColor: this.getColorForProps(p),
              fillOpacity: 0.58,
              color: '#ffffff',
              weight: 0.85,
              opacity: 0.95
            });
          },
          click: () => {
            this.zone.run(() => {
              this.onSelectRegionCallback?.(p);
            });
          }
        });
      }
    }).addTo(this.map);
  }

  private updateChoroplethStyles(): void {
    if (!this.geoJsonLayer) return;

    this.geoJsonLayer.eachLayer((layer: any) => {
      const p: SpatialRegionProperties = layer.feature?.properties;
      if (!p) return;

      const fillColor = this.getColorForProps(p);

      layer.setStyle({
        fillColor,
        fillOpacity: 0.58,
        color: '#ffffff',
        weight: 0.85,
        opacity: 0.95
      });

      // Update tooltip content
      const tooltipHtml = this.createRegencyTooltipHtml(p);
      layer.setTooltipContent(tooltipHtml);
    });
  }

  private resetLayerHighlights(): void {
    this.updateChoroplethStyles();
    if (this.geoJsonLayer) {
      this.geoJsonLayer.eachLayer((layer: any) => {
        const markerEl = layer._labelMarker?.getElement?.();
        if (markerEl) {
          markerEl.style.opacity = '1';
          markerEl.style.display = '';
        }
      });
    }
  }

  private createRegencyTooltipHtml(p: SpatialRegionProperties): string {
    const meta = CLUSTER_META[p.cluster] ?? {
      label: p.cluster,
      bg: '#64748b',
      text: '#ffffff'
    };

    return `
      <div class="tooltip-card">
        <div class="tooltip-header">
          <span class="tooltip-name">${p.name}</span>
          <span class="tooltip-tag">${p.parent}</span>
        </div>
        <table class="tooltip-table">
          <tr>
            <td class="lbl">Kabupaten / Kota</td>
            <td class="val"><strong>${p.name}</strong></td>
          </tr>
          <tr>
            <td class="lbl">Kemiskinan (%)</td>
            <td class="val"><strong class="val-poverty">${p.povertyRate.toFixed(2)}%</strong></td>
          </tr>
          <tr>
            <td class="lbl">Jumlah Penduduk Miskin</td>
            <td class="val mono"><strong>${p.poorPopulation.toLocaleString('id-ID')} jiwa</strong></td>
          </tr>
          <tr>
            <td class="lbl">IPM</td>
            <td class="val"><strong>${p.humanDevelopmentIndex.toFixed(2)}</strong></td>
          </tr>
          <tr>
            <td class="lbl">Klaster Spasial</td>
            <td class="val">
              <span class="tooltip-cluster-badge" style="background: ${meta.bg}; color: ${meta.text};">
                ${meta.label}
              </span>
            </td>
          </tr>
        </table>
      </div>
    `;
  }
}
