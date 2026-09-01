import { Component, OnInit, OnDestroy, inject, signal, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { BrantasStateService, RegionData } from '../../services/brantas-state.service';
import * as L from 'leaflet';

@Component({
  selector: 'app-spatial-map',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './spatial-map.html',
  styleUrl: './spatial-map.css'
})
export class SpatialMapComponent implements OnInit, OnDestroy {
  protected readonly state = inject(BrantasStateService);
  
  // METRIC SELECTOR
  readonly selectedMetric = signal<'poverty' | 'budget' | 'anomalies'>('poverty');
  readonly selectedRegion = signal<RegionData | null>(null);

  private map: L.Map | null = null;
  private layerGroup: L.LayerGroup | null = null;
  private geoJsonLayer: L.GeoJSON | null = null;
  private geoJsonData: any = null;

  constructor() {
    // Re-draw map overlays (Choropleth or Bubbles) when metric, scope, or active data changes
    effect(() => {
      const metric = this.selectedMetric();
      const scope = this.state.selectedScope();
      const data = this.state.activeRegions();

      if (this.map && this.layerGroup) {
        if (scope === 'nasional') {
          // Hapus layer kabupaten/kota jika ada
          this.layerGroup.clearLayers();
          
          if (this.geoJsonData) {
            this.renderChoropleth(this.geoJsonData);
          } else {
            this.loadGeoJson();
          }
        } else {
          // Bersihkan layer GeoJSON jika sedang masuk ke detail kabupaten
          if (this.geoJsonLayer && this.map.hasLayer(this.geoJsonLayer)) {
            this.map.removeLayer(this.geoJsonLayer);
            this.geoJsonLayer = null;
          }
          this.drawMapOverlays();
        }
      }
    });

    // Watch scope to pan the map view dynamically
    effect(() => {
      const scope = this.state.selectedScope();
      if (!this.map) return;

      if (scope === 'nasional') {
        this.map.setView([-2.5489, 118.0149], 5);
        if (this.state.provinces().length > 0) {
          this.selectedRegion.set(this.state.provinces()[0]);
        }
      } else {
        const prov = this.state.provinces().find(p => p.id === scope);
        if (prov) {
          this.map.setView([prov.latitude, prov.longitude], 8);
          // Default select first kab/kota in the selected province
          setTimeout(() => {
            const activeData = this.state.activeRegions();
            if (activeData.length > 0) {
              this.selectedRegion.set(activeData[0]);
            }
          }, 100);
        }
      }
    });
  }

  ngOnInit(): void {
    // Set default selected region
    if (this.state.provinces().length > 0) {
      this.selectedRegion.set(this.state.provinces()[0]);
    }
    
    // Initialize leaflet map
    setTimeout(() => {
      this.initMap();
    }, 100);
  }

  ngOnDestroy(): void {
    if (this.map) {
      this.map.remove();
    }
  }

  private initMap(): void {
    // Koordinat pusat Indonesia sekitar -2.5489, 118.0149
    this.map = L.map('leaflet-map-container', {
      center: [-2.5489, 118.0149],
      zoom: 5,
      zoomControl: true,
      attributionControl: false
    });

    // Gunakan Tile Layer bertema Light Mode premium (CartoDB Positron)
    L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
      maxZoom: 19
    }).addTo(this.map);

    this.layerGroup = L.layerGroup().addTo(this.map);
    
    // Jalankan render pertama kali sesuai scope aktif
    const scope = this.state.selectedScope();
    if (scope === 'nasional') {
      this.loadGeoJson();
    } else {
      this.drawMapOverlays();
    }

    // Pastikan ukuran peta disesuaikan kembali setelah inisialisasi kontainer CSS selesai
    setTimeout(() => {
      this.map?.invalidateSize();
    }, 200);
  }

  setMetric(metric: 'poverty' | 'budget' | 'anomalies'): void {
    this.selectedMetric.set(metric);
  }

  changeScope(scopeValue: string): void {
    this.state.selectedScope.set(scopeValue);
  }

  drillDown(region: RegionData): void {
    if (this.state.selectedScope() === 'nasional' && region.id.length === 2) {
      this.state.selectedScope.set(region.id);
    }
  }

  goBackToNasional(): void {
    this.state.selectedScope.set('nasional');
  }

  selectRegion(region: RegionData): void {
    this.selectedRegion.set(region);
    if (this.map) {
      this.map.panTo([region.latitude, region.longitude]);
    }
  }

  // MEMUAT GEOJSON PROVINSI DARI CDN INTERNET (RUNS CLIENT-SIDE BROWSER)
  private loadGeoJson(): void {
    const url = 'https://raw.githubusercontent.com/denyherianto/indonesia-geojson-topojson-maps-with-38-provinces/main/GeoJSON/indonesia-38-provinces.geojson';
    
    fetch(url)
      .then(res => {
        if (!res.ok) throw new Error('Failed to load GeoJSON');
        return res.json();
      })
      .then(geoJsonData => {
        this.geoJsonData = geoJsonData;
        this.renderChoropleth(geoJsonData);
      })
      .catch(err => {
        console.warn('Gagal memuat GeoJSON wilayah Indonesia dari internet. Menggunakan fallback gelembung (bubble):', err);
        // Fallback: biarkan bubble map aktif
        this.drawMapOverlays();
      });
  }

  // MEWARNAI AREA/POLIGON PROVINSI (CHOROPLETH MAP)
  private renderChoropleth(geoJsonData: any): void {
    if (!this.map) return;

    if (this.geoJsonLayer && this.map.hasLayer(this.geoJsonLayer)) {
      this.map.removeLayer(this.geoJsonLayer);
    }

    const metric = this.selectedMetric();

    this.geoJsonLayer = L.geoJSON(geoJsonData, {
      style: (feature) => {
        const provNameInGeo = this.getProvinceNameFromFeature(feature);
        const prov = this.state.provinces().find(p => {
          return this.normalizeProvinceName(p.name) === this.normalizeProvinceName(provNameInGeo);
        });

        let color = '#e2e8f0';
        let fillOpacity = 0.15;

        if (prov) {
          color = this.getColorForRegion(prov, metric);
          fillOpacity = 0.70;
        }

        return {
          fillColor: color,
          weight: 1.5,
          opacity: 1,
          color: '#ffffff',
          dashArray: '3',
          fillOpacity: fillOpacity
        };
      },
      onEachFeature: (feature, layer) => {
        const provNameInGeo = this.getProvinceNameFromFeature(feature);
        const prov = this.state.provinces().find(p => {
          return this.normalizeProvinceName(p.name) === this.normalizeProvinceName(provNameInGeo);
        });

        if (prov) {
          let metricDisplay = '';
          if (metric === 'poverty') {
            metricDisplay = `Tingkat Kemiskinan: ${prov.povertyRate}%`;
          } else if (metric === 'budget') {
            metricDisplay = `Anggaran: Rp ${prov.actualBudget} Triliun`;
          } else if (metric === 'anomalies') {
            const totalA = prov.anomalies.asnTniPolri + prov.anomalies.ganda + prov.anomalies.meninggal + prov.anomalies.exclusion;
            metricDisplay = `Total Anomali: ${this.getFormattedNumber(totalA)} Kasus`;
          }

          const popupContent = `
            <div style="font-family: sans-serif; color: #1e293b; padding: 4px;">
              <h4 style="margin: 0 0 4px 0; font-weight: 700; color: #0f172a;">Provinsi ${prov.name}</h4>
              <p style="margin: 0; font-size: 12px; font-weight: 600; color: #0d9488;">${metricDisplay}</p>
              <p style="margin: 6px 0 0 0; font-size: 10px; color: #64748b;">Klik wilayah untuk detail / drill-down</p>
            </div>
          `;
          layer.bindPopup(popupContent);

          layer.on({
            click: () => {
              this.selectedRegion.set(prov);
            },
            mouseover: (e) => {
              const l = e.target;
              l.setStyle({
                fillOpacity: 0.75,
                weight: 2.5
              });
            },
            mouseout: (e) => {
              const l = e.target;
              this.geoJsonLayer?.resetStyle(l);
            }
          });
        }
      }
    }).addTo(this.map);
  }

  // GAMBAR BUBBLE MAP UNTUK KABUPATEN/KOTA (LOKAL)
  private drawMapOverlays(): void {
    if (!this.map || !this.layerGroup) return;

    this.layerGroup.clearLayers();
    const metric = this.selectedMetric();
    const data = this.state.activeRegions();

    data.forEach(r => {
      let color = '#14b8a6';
      let radius = 6000;
      let valueDisplay = '';

      if (metric === 'poverty') {
        const rate = r.povertyRate;
        valueDisplay = `Tingkat Kemiskinan: ${rate}%`;
        radius = 4000 + (rate * 450);
        
        if (rate < 7) color = '#059669'; // Emerald green
        else if (rate < 11) color = '#3b82f6'; // Blue
        else if (rate < 18) color = '#d97706'; // Amber/Orange
        else color = '#dc2626'; // Red
      } else if (metric === 'budget') {
        const budget = r.actualBudget;
        valueDisplay = `Anggaran: Rp ${budget} Miliar`;
        radius = 4000 + (budget * 75);
        
        if (budget < 40) color = '#a78bfa'; // Purple
        else if (budget < 80) color = '#4f46e5'; // Indigo
        else color = '#3b82f6'; // Blue
      } else if (metric === 'anomalies') {
        const totalA = r.anomalies.asnTniPolri + r.anomalies.ganda + r.anomalies.meninggal + r.anomalies.exclusion;
        valueDisplay = `Total Anomali: ${this.getFormattedNumber(totalA)} Kasus`;
        radius = 4000 + (totalA * 1.2);

        if (totalA < 2000) color = '#d97706'; // Amber/Orange
        else if (totalA < 6000) color = '#f97316'; // Orange Dark
        else color = '#dc2626'; // Red
      }

      // Gambar area persegi (Grid Choropleth) untuk Kabupaten/Kota
      const offsetLat = 0.08; // Sekitar 9km ke utara/selatan
      const offsetLng = 0.08; // Sekitar 9km ke timur/barat
      const bounds: L.LatLngBoundsExpression = [
        [r.latitude - offsetLat, r.longitude - offsetLng],
        [r.latitude + offsetLat, r.longitude + offsetLng]
      ];

      const rect = L.rectangle(bounds, {
        color: '#ffffff',
        fillColor: color,
        fillOpacity: 0.70,
        weight: 1.5
      });

      const popupContent = `
        <div style="font-family: sans-serif; color: #1e293b; padding: 4px;">
          <h4 style="margin: 0 0 4px 0; font-weight: 700; color: #0f172a;">${r.name}</h4>
          <p style="margin: 0; font-size: 12px; font-weight: 600; color: ${color};">${valueDisplay}</p>
        </div>
      `;

      rect.bindPopup(popupContent);

      rect.on('click', () => {
        this.selectedRegion.set(r);
      });

      rect.on('mouseover', () => {
        rect.setStyle({ fillOpacity: 0.8, weight: 2.5, color: '#0d9488' });
      });
      rect.on('mouseout', () => {
        rect.setStyle({ fillOpacity: 0.70, weight: 1.5, color: '#ffffff' });
      });

      this.layerGroup?.addLayer(rect);
    });
  }

  private getColorForRegion(r: RegionData, metric: string): string {
    if (metric === 'poverty') {
      const rate = r.povertyRate;
      if (rate < 7) return '#059669'; // Emerald green
      else if (rate < 11) return '#3b82f6'; // Blue
      else if (rate < 18) return '#d97706'; // Amber/Orange
      else return '#dc2626'; // Red
    } else if (metric === 'budget') {
      const budget = r.actualBudget;
      if (budget < 15) return '#a78bfa'; // Purple
      else if (budget < 40) return '#4f46e5'; // Indigo
      else return '#3b82f6'; // Blue
    } else {
      const totalA = r.anomalies.asnTniPolri + r.anomalies.ganda + r.anomalies.meninggal + r.anomalies.exclusion;
      if (totalA < 15000) return '#d97706'; // Amber/Orange
      else if (totalA < 45000) return '#f97316'; // Orange Dark
      else return '#dc2626'; // Red
    }
  }

  getFormattedCurrency(value: number): string {
    const isNasional = this.state.selectedScope() === 'nasional';
    const multiplier = isNasional ? 1000000000000 : 1000000000;
    return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 1 })
      .format(value * multiplier)
      .replace('IDR', 'Rp');
  }

  getFormattedNumber(value: number): string {
    return new Intl.NumberFormat('id-ID').format(value);
  }

  private getProvinceNameFromFeature(feature: any): string {
    if (!feature || !feature.properties) return '';
    const props = feature.properties;
    const keys = Object.keys(props);
    const targetKeys = ['provinsi', 'propinsi', 'province', 'name_1', 'name', 'state', 'region'];
    
    for (const key of keys) {
      if (targetKeys.includes(key.toLowerCase())) {
        return String(props[key]);
      }
    }
    return '';
  }

  private normalizeProvinceName(name: string): string {
    if (!name) return '';
    let val = name.toLowerCase();
    
    // Singkatan umum Provinsi
    if (val === 'kalteng') return 'kalimantantengah';
    if (val === 'kalbar') return 'kalimantanbarat';
    if (val === 'kalsel') return 'kalimantanselatan';
    if (val === 'kaltim') return 'kalimantantimur';
    if (val === 'kalut') return 'kalimantanutara';
    
    if (val === 'sulsel') return 'sulawesiselatan';
    if (val === 'sulut') return 'sulawesiutara';
    if (val === 'sultra') return 'sulawesitenggara';
    if (val === 'sulteng') return 'sulawesitengah';
    if (val === 'sulbar') return 'sulawesibarat';
    if (val === 'sumbar') return 'sumaterabarat';
    if (val === 'sumut') return 'sumaterautara';
    if (val === 'sumsel') return 'sumateraselatan';
    if (val === 'babel') return 'kepbangkabelitung';
    
    val = val
      .replace('kepulauan', 'kep')
      .replace('kep.', 'kep')
      .replace('daerah khusus ibukota', 'dki')
      .replace('dki', '')
      .replace('daerah khusus', 'dk')
      .replace('dk', '')
      .replace('daerah istimewa', 'di')
      .replace('di', '')
      .replace('kalimatan', 'kalimantan') // Penanganan typo 'kalimatan'
      .replace(/[^a-z0-9]/g, '')
      .trim();
      
    return val;
  }
}
