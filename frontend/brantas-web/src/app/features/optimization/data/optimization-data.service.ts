import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { API_BASE_URL } from '../../../core/config/api.config';

export interface AllocationRecommendation {
  region: string;
  regionId?: string;
  regionName?: string;
  baselineAllocation: number;
  recommendedAllocation: number;
  delta: number;
  deltaPercent: number;
  vulnerabilityIndex: number;
  poorPopulation?: number;
}

export interface OptimizationResult {
  datasetVersionId: string;
  period: string;
  totalBudget: number;
  weights: {
    povertyRate: number;
    povertyDepth: number;
    povertySeverity: number;
    humanDevelopmentGap: number;
    inverseGdp: number;
  };
  recommendations: AllocationRecommendation[];
}

export interface SimulationScenario {
  id: string;
  name: string;
  povertyWeight?: number;
  disasterWeight?: number;
  capPercent?: number;
  createdAt: string;
  totalBudget: number;
  recommendations: AllocationRecommendation[];
}

@Injectable({ providedIn: 'root' })
export class OptimizationDataService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = `${API_BASE_URL}/optimization`;

  getRecommendations(povertyWeight: number, capPercent: number, disasterWeight?: number) {
    let params = new HttpParams().set('povertyWeight', povertyWeight).set('capPercent', capPercent / 100);
    if (disasterWeight !== undefined) {
      params = params.set('disasterWeight', disasterWeight);
    }
    return this.http.get<OptimizationResult>(`${this.apiUrl}/recommendations`, { params });
  }

  saveScenario(name: string, povertyWeight: number, capPercent: number, disasterWeight?: number) {
    return this.http.post<SimulationScenario>(`${this.apiUrl}/scenarios`, {
      name,
      povertyWeight,
      capPercent: capPercent / 100,
      disasterWeight: disasterWeight ?? 10
    });
  }

  getScenarios() {
    return this.http.get<SimulationScenario[]>(`${this.apiUrl}/scenarios`);
  }

  getScenarioById(id: string) {
    return this.http.get<SimulationScenario>(`${this.apiUrl}/scenarios/${id}`);
  }

  deleteScenario(id: string) {
    return this.http.delete(`${this.apiUrl}/scenarios/${id}`);
  }
}