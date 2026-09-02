import { Injectable, NgZone, inject } from '@angular/core';
import * as L from 'leaflet';
import { SpatialGeoJson, SpatialRegionProperties } from './spatial-data.service';

export type SpatialIndicatorLayer = 'povertyRate' | 'povertyDepth' | 'povertySeverity' | 'hdi' | 'cluster';

@Injectable({ providedIn: 'root' })
export class LeafletMapAdapter {
  private readonly zone = inject(NgZone);
  private map: L.Map | null = null;
  private geoJsonLayer: L.GeoJSON | null = null;
  private currentGeoJson: SpatialGeoJson | null = null;
  private currentLayer: SpatialIndicatorLayer = 'povertyRate';
  private onSelectRegionCallback?: (region: SpatialRegionProperties) => void;

  render(element: HTMLElement, data: SpatialGeoJson, onSelect?: (region: SpatialRegionProperties) => void): void {
    this.currentGeoJson = data;
    this.onSelectRegionCallback = onSelect;
    this.zone.runOutsideAngular(() => {
      this.map?.remove();
      this.map = L.map(element, { zoomControl: true, scrollWheelZoom: true }).setView([-2.5, 116], 4);
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 8, attribution: '&copy; OpenStreetMap' }).addTo(this.map);
      this.updateLayerStyle();
    });
  }

  setLayer(layer: SpatialIndicatorLayer): void {
    this.currentLayer = layer;
    this.zone.runOutsideAngular(() => {
      this.updateLayerStyle();
    });
  }

  private updateLayerStyle(): void {
    if (!this.map || !this.currentGeoJson) return;
    if (this.geoJsonLayer) {
      this.map.removeLayer(this.geoJsonLayer);
    }
    this.geoJsonLayer = L.geoJSON(this.currentGeoJson, {
      style: (feature) => {
        const props = feature?.properties as SpatialRegionProperties;
        return {
          color: '#ffffff',
          weight: 0.6,
          fillColor: this.resolveColor(props, this.currentLayer),
          fillOpacity: 0.85
        };
      },
      onEachFeature: (feature, polygon) => {
        const props = feature.properties as SpatialRegionProperties;
        polygon.bindPopup(this.popupContent(props));
        polygon.on('click', () => {
          if (this.onSelectRegionCallback) {
            this.zone.run(() => this.onSelectRegionCallback!(props));
          }
        });
      }
    }).addTo(this.map);

    this.map.fitBounds(this.geoJsonLayer.getBounds(), { padding: [12, 12], maxZoom: 6 });
  }

  private resolveColor(props: SpatialRegionProperties, layer: SpatialIndicatorLayer): string {
    switch (layer) {
      case 'cluster':
        return props.cluster === 'High-High' ? '#c2410c' : props.cluster === 'Low-Low' ? '#0f766e' : props.cluster === 'High-Low' ? '#b45309' : '#2563eb';
      case 'povertyDepth':
        return props.povertyDepthIndex >= 4.0 ? '#9f1239' : props.povertyDepthIndex >= 2.5 ? '#e11d48' : props.povertyDepthIndex >= 1.5 ? '#f97316' : '#0f766e';
      case 'povertySeverity':
        return props.povertySeverityIndex >= 1.2 ? '#9f1239' : props.povertySeverityIndex >= 0.7 ? '#e11d48' : props.povertySeverityIndex >= 0.3 ? '#f97316' : '#0f766e';
      case 'hdi':
        return props.humanDevelopmentIndex >= 75 ? '#0f766e' : props.humanDevelopmentIndex >= 70 ? '#14b8a6' : props.humanDevelopmentIndex >= 65 ? '#f59e0b' : '#b91c1c';
      case 'povertyRate':
      default:
        return props.povertyRate >= 20 ? '#9f1239' : props.povertyRate >= 14 ? '#e11d48' : props.povertyRate >= 9 ? '#f97316' : props.povertyRate >= 6 ? '#fbbf24' : '#0f766e';
    }
  }

  private popupContent(properties: SpatialRegionProperties): HTMLElement {
    const content = document.createElement('div');
    const name = document.createElement('strong');
    name.textContent = properties.name;
    const detail = document.createElement('div');
    detail.textContent = `${properties.parent} | Kemiskinan: ${properties.povertyRate.toFixed(2)}% | IPM: ${properties.humanDevelopmentIndex.toFixed(2)} | Klaster: ${properties.cluster}`;
    content.append(name, detail);
    return content;
  }
}