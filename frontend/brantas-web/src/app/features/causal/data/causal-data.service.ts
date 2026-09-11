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
export interface AdaptiveTreatedRegion {
  regionId: string;
  name: string;
  bpsCode: string;
  irbiScore: number;
  irbiCategory: string;
  threat: string;
  povertyRate: number;
  poorPopulation: number;
  affirmativeAllocation: number;
  povertyReduction: number;
  resilienceStatus: string;
}

export interface AdaptiveSocialProtectionData {
  highRiskTreatedCount: number;
  averageIrbiScore: number;
  contingencyBufferRatio: number;
  shockAbsorptionEfficiency: number;
  treatedRegions: AdaptiveTreatedRegion[];
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
  adaptiveSocialProtection?: AdaptiveSocialProtectionData;
}

@Injectable({ providedIn: 'root' })
export class CausalDataService {
  private readonly http = inject(HttpClient);
  getDid() { return this.http.get<CausalResult>(`${API_BASE_URL}/causal/did`); }
}