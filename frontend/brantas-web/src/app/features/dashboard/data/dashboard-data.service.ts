import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';

export interface DashboardSummary {
  datasetVersionId: string;
  period: string;
  provinceCount: number;
  regencyCount: number;
  averagePovertyRate: number;
  totalPoorPopulation: number;
  highestPovertyRate: number;
  highestProvinceName: string;
  lowestPovertyRate: number;
  lowestProvinceName: string;
  averagePovertyDepth: number;
  averagePovertySeverity: number;
  averageHumanDevelopmentIndex: number;
  totalBudget: number;
  totalAnomalies: number;
  totalValueAtRisk: number;
}

export interface PriorityRegion {
  region: string;
  povertyRate: number;
  poorPopulation: number;
  humanDevelopmentIndex: number;
}

export interface RegionalCorridor {
  corridor: string;
  provinceCount: number;
  averagePovertyRate: number;
  totalPoorPopulation: number;
  totalAllocation: number;
  averageHdi: number;
  averageP1: number;
  highestPovertyProvince: string;
  highestPovertyRate: number;
}

export interface RegencyRankItem {
  regencyName: string;
  provinceName: string;
  povertyRate: number;
  poorPopulation: number;
  humanDevelopmentIndex: number;
  povertyDepthIndex: number;
  povertySeverityIndex: number;
  gdpPerCapita: number;
}

export interface RegencyRanksResponse {
  totalRegencies: number;
  topPoverty: RegencyRankItem[];
  lowestPoverty: RegencyRankItem[];
}

export interface DistributionBucket {
  label: string;
  count: number;
  color: string;
}

export interface DistributionResponse {
  totalEvaluated: number;
  distribution: DistributionBucket[];
}

interface PipelineResult {
  datasetVersionId: string;
}

@Injectable({ providedIn: 'root' })
export class DashboardDataService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = 'http://localhost:5025/api/v1';

  getSummary() {
    return this.http.get<DashboardSummary>(`${this.apiUrl}/dashboard/summary`);
  }

  getPriorityRegions() {
    return this.http.get<PriorityRegion[]>(`${this.apiUrl}/dashboard/priority-regions`);
  }

  getCorridors() {
    return this.http.get<RegionalCorridor[]>(`${this.apiUrl}/dashboard/corridors`);
  }

  getRegencyRanks() {
    return this.http.get<RegencyRanksResponse>(`${this.apiUrl}/dashboard/regency-ranks`);
  }

  getDistribution() {
    return this.http.get<DistributionResponse>(`${this.apiUrl}/dashboard/distribution`);
  }

  runPipeline() {
    return this.http.post<PipelineResult>(`${this.apiUrl}/pipeline/run`, {});
  }
}