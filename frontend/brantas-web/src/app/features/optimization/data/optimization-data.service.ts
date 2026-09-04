import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';

export interface AllocationRecommendation {
  region: string;
  baselineAllocation: number;
  recommendedAllocation: number;
  delta: number;
  deltaPercent: number;
  vulnerabilityIndex: number;
  poorPopulation?: number;
}

export interface OptimizationResult {
  totalBudget: number;
  recommendations: AllocationRecommendation[];
}

export interface SimulationScenario {
  id: string;
  name: string;
  totalBudget: number;
  povertyWeight?: number;
  capPercent?: number;
  weightsJson?: string;
  constraintsJson?: string;
  createdAt: string;
  recommendations?: AllocationRecommendation[];
}

@Injectable({ providedIn: 'root' })
export class OptimizationDataService {
  private readonly http = inject(HttpClient);

  getRecommendations(povertyWeight: number, capPercent: number) {
    const params = new HttpParams().set('povertyWeight', povertyWeight).set('capPercent', capPercent / 100);
    return this.http.get<OptimizationResult>('http://localhost:5025/api/v1/optimization/recommendations', { params });
  }

  saveScenario(name: string, povertyWeight: number, capPercent: number) {
    return this.http.post<SimulationScenario>('http://localhost:5025/api/v1/optimization/scenarios', { name, povertyWeight, capPercent: capPercent / 100 });
  }

  getScenarios() {
    return this.http.get<SimulationScenario[]>('http://localhost:5025/api/v1/optimization/scenarios');
  }

  getScenarioById(id: string) {
    return this.http.get<SimulationScenario>(`http://localhost:5025/api/v1/optimization/scenarios/${id}`);
  }

  deleteScenario(id: string) {
    return this.http.delete(`http://localhost:5025/api/v1/optimization/scenarios/${id}`);
  }
}