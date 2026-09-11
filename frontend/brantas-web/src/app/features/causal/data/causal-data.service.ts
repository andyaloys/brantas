import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { API_BASE_URL } from '../../../core/config/api.config';

export interface EventStudyPoint {
  year: number;
  effectPercentagePoints: number;
  treatedPovertyRate?: number;
  controlPovertyRate?: number;
  baselineTreatedPovertyRate?: number;
  baselineControlPovertyRate?: number;
  priorYearTreatedPovertyRate?: number;
}
export interface CausalResult {
  treatedRegionCount: number;
  controlRegionCount: number;
  treatmentStartYear: number;
  effectPercentagePoints: number;
  standardError: number;
  confidenceInterval95: { lower: number; upper: number };
  pValue: number;
  effectivenessPerTrillion: number;
  parallelTrendPassed: boolean;
  eventStudy: EventStudyPoint[];
}

@Injectable({ providedIn: 'root' })
export class CausalDataService {
  private readonly http = inject(HttpClient);
  getDid() { return this.http.get<CausalResult>(`${API_BASE_URL}/causal/did`); }
}