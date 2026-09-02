import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';

export interface DashboardSummary {
  datasetVersionId: string;
  period: string;
  regionCount: number;
  averagePovertyRate: number;
  totalPoorPopulation: number;
  highestPovertyRate: number;
}

export interface PriorityRegion {
  region: string;
  povertyRate: number;
  poorPopulation: number;
  humanDevelopmentIndex: number;
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

  runPipeline() {
    return this.http.post<PipelineResult>(`${this.apiUrl}/pipeline/run`, {});
  }
}