import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';

export interface SpatialRegion {
  name: string;
  parent: string;
  latitude: number;
  longitude: number;
  povertyRate: number;
  cluster: 'High-High' | 'Low-Low' | 'High-Low' | 'Low-High';
  localScore: number;
}

export interface MoranAnalysis {
  datasetVersionId: string;
  period: string;
  globalMoranI: number;
  regionCount: number;
  regions: SpatialRegion[];
}

export interface SpatialRegionProperties {
  regionId: string;
  name: string;
  parent: string;
  povertyRate: number;
  povertyDepthIndex: number;
  povertySeverityIndex: number;
  humanDevelopmentIndex: number;
  gdpPerCapita: number;
  poorPopulation: number;
  cluster: 'High-High' | 'Low-Low' | 'High-Low' | 'Low-High';
  localScore: number;
}

export interface SpatialGeoJson {
  type: 'FeatureCollection';
  datasetVersionId: string;
  period: string;
  globalMoranI: number;
  features: GeoJSON.Feature<GeoJSON.Polygon, SpatialRegionProperties>[];
}

@Injectable({ providedIn: 'root' })
export class SpatialDataService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = 'http://localhost:5025/api/v1';

  getMoranAnalysis() {
    return this.http.get<MoranAnalysis>(`${this.apiUrl}/spatial/morans-i`);
  }

  getRegionsGeoJson() {
    return this.http.get<SpatialGeoJson>(`${this.apiUrl}/spatial/regions.geojson`);
  }

  getIndonesiaGeoJson() {
    return this.http.get<any>('assets/geo/indonesia-provinces.json');
  }

  getIndonesiaKabupatenGeoJson() {
    return this.http.get<any>('assets/geo/indonesia-kabupaten.json');
  }

  downloadSpatialCsv() {
    return this.http.get(`${this.apiUrl}/spatial/regions.csv`, { responseType: 'blob' });
  }
}