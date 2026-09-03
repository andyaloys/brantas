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
      this.map = L.map(element, {
        zoomControl: true,
        scrollWheelZoom: true,
        attributionControl: false
      }).setView([-2.2, 118], 5);

      // Official Free ESRI World Dark Gray Basemap (Zero Watermark / Full Resolution)
      L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}', {
        maxZoom: 16,
        attribution: 'Tiles &copy; Esri &mdash; Esri, DeLorme, NAVTEQ'
      }).addTo(this.map);

      this.updateLayerStyle();
    });
  }

  setLayer(layer: SpatialIndicatorLayer): void {
    this.currentLayer = layer;
    this.zone.runOutsideAngular(() => {
      this.updateLayerStyle();
    });
  }

  filterAndZoomProvince(provinceName: string): void {
    if (!this.map || !this.geoJsonLayer || !this.currentGeoJson) return;

    this.zone.runOutsideAngular(() => {
      const bounds = L.latLngBounds([]);
      let matchCount = 0;

      this.geoJsonLayer!.eachLayer((layer: any) => {
        const feature = layer.feature;
        const props = feature?.properties as SpatialRegionProperties;
        if (!props) return;

        const isMatch = provinceName === 'all' || props.parent.toLowerCase() === provinceName.toLowerCase();

        if (isMatch) {
          matchCount++;
          const color = this.resolveColor(props, this.currentLayer);
          const radius = this.resolveRadius(props);
          if (layer.setStyle) {
            layer.setStyle({
              radius: provinceName === 'all' ? radius : radius + 2,
              fillColor: color,
              color: '#ffffff',
              weight: provinceName === 'all' ? 1.2 : 2.5,
              opacity: 1,
              fillOpacity: provinceName === 'all' ? 0.75 : 0.95
            });
          }
          if (layer.getLatLng) {
            bounds.extend(layer.getLatLng());
          } else if (layer.getBounds) {
            bounds.extend(layer.getBounds());
          }
        } else {
          if (layer.setStyle) {
            layer.setStyle({
              opacity: 0.12,
              fillOpacity: 0.05,
              weight: 0.5
            });
          }
        }
      });

      if (provinceName === 'all') {
        this.map!.flyTo([-2.2, 118], 5, { animate: true, duration: 1.2 });
      } else if (matchCount > 0 && bounds.isValid()) {
        this.map!.flyToBounds(bounds, { padding: [60, 60], maxZoom: 9, animate: true, duration: 1.2 });
      }
    });
  }

  private updateLayerStyle(): void {
    if (!this.map || !this.currentGeoJson) return;
    if (this.geoJsonLayer) {
      this.map.removeLayer(this.geoJsonLayer);
    }

    this.geoJsonLayer = L.geoJSON(this.currentGeoJson, {
      pointToLayer: (feature, latlng) => {
        const props = feature.properties as SpatialRegionProperties;
        const color = this.resolveColor(props, this.currentLayer);
        const radius = this.resolveRadius(props);

        return L.circleMarker(latlng, {
          radius: radius,
          fillColor: color,
          color: '#ffffff',
          weight: 1.5,
          opacity: 0.95,
          fillOpacity: 0.82
        });
      },
      onEachFeature: (feature, layer) => {
        const props = feature.properties as SpatialRegionProperties;
        
        // Custom Dark Glassmorphic Popup
        layer.bindPopup(this.popupContent(props), {
          className: 'spatial-dark-popup'
        });

        layer.on({
          mouseover: (e) => {
            const target = e.target;
            if (target.setStyle) {
              const radius = this.resolveRadius(props);
              target.setStyle({
                weight: 3,
                color: '#38bdf8',
                fillOpacity: 1.0,
                radius: radius + 3
              });
            }
          },
          mouseout: (e) => {
            const target = e.target;
            if (target.setStyle) {
              const radius = this.resolveRadius(props);
              const color = this.resolveColor(props, this.currentLayer);
              target.setStyle({
                weight: 1.5,
                color: '#ffffff',
                fillColor: color,
                fillOpacity: 0.82,
                radius: radius
              });
            }
          },
          click: () => {
            if (this.onSelectRegionCallback) {
              this.zone.run(() => this.onSelectRegionCallback!(props));
            }
          }
        });
      }
    }).addTo(this.map);

    try {
      const bounds = this.geoJsonLayer.getBounds();
      if (bounds.isValid()) {
        this.map.fitBounds(bounds, { padding: [20, 20], maxZoom: 6 });
      }
    } catch {}
  }

  private resolveRadius(props: SpatialRegionProperties): number {
    const pop = props.poorPopulation || 30000;
    if (pop > 100000) return 14;
    if (pop > 50000) return 11;
    if (pop > 25000) return 8;
    return 6;
  }

  private resolveColor(props: SpatialRegionProperties, layer: SpatialIndicatorLayer): string {
    switch (layer) {
      case 'cluster':
        return props.cluster === 'High-High'
          ? '#fb7185' // Hotspot Merah Neon
          : props.cluster === 'Low-Low'
          ? '#2dd4bf' // Coldspot Teal Neon
          : props.cluster === 'High-Low'
          ? '#fb923c' // Outlier Tinggi Orange
          : '#facc15'; // Outlier Rendah Kuning
      case 'povertyDepth':
        return props.povertyDepthIndex >= 4.0 ? '#fb7185' : props.povertyDepthIndex >= 2.5 ? '#f43f5e' : props.povertyDepthIndex >= 1.5 ? '#fbbf24' : '#2dd4bf';
      case 'povertySeverity':
        return props.povertySeverityIndex >= 1.2 ? '#fb7185' : props.povertySeverityIndex >= 0.7 ? '#f43f5e' : props.povertySeverityIndex >= 0.3 ? '#fbbf24' : '#2dd4bf';
      case 'hdi':
        return props.humanDevelopmentIndex >= 75 ? '#2dd4bf' : props.humanDevelopmentIndex >= 70 ? '#38bdf8' : props.humanDevelopmentIndex >= 65 ? '#fbbf24' : '#fb7185';
      case 'povertyRate':
      default:
        return props.povertyRate >= 20 ? '#fb7185' : props.povertyRate >= 14 ? '#f43f5e' : props.povertyRate >= 9 ? '#fbbf24' : props.povertyRate >= 6 ? '#38bdf8' : '#2dd4bf';
    }
  }

  private popupContent(properties: SpatialRegionProperties): HTMLElement {
    const content = document.createElement('div');
    content.style.padding = '4px';

    const header = document.createElement('div');
    header.style.color = '#38bdf8';
    header.style.fontWeight = '800';
    header.style.fontSize = '13px';
    header.style.marginBottom = '4px';
    header.textContent = properties.name;

    const sub = document.createElement('div');
    sub.style.color = '#94a3b8';
    sub.style.fontSize = '11px';
    sub.style.marginBottom = '8px';
    sub.textContent = properties.parent;

    const stats = document.createElement('div');
    stats.style.fontSize = '12px';
    stats.style.lineHeight = '1.6';
    stats.style.color = '#f8fafc';
    stats.innerHTML = `
      Kemiskinan: <strong style="color:#fb7185">${properties.povertyRate.toFixed(2)}%</strong><br/>
      IPM: <strong style="color:#2dd4bf">${properties.humanDevelopmentIndex.toFixed(1)}</strong><br/>
      Klaster Spasial: <strong>${properties.cluster}</strong>
    `;

    content.append(header, sub, stats);
    return content;
  }
}