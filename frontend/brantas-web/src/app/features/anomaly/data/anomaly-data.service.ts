import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { API_BASE_URL } from '../../../core/config/api.config';

export interface AnomalySummary {
  datasetVersionId: string;
  period: string;
  totalCount: number;
  underAllocationCount: number;
  overAllocationCount: number;
  criticalCount: number;
  totalValueAtRisk: number;
}

export interface FiscalAnomaly {
  id: string;
  region: string;
  type: 'Under-allocation' | 'Over-allocation';
  severity: 'Medium' | 'High' | 'Critical';
  confidenceScore: number;
  zScore: number;
  valueAtRisk: number;
  explanation: string;
  reviewStatus: 'InVerification' | 'Valid' | 'FalsePositive';
}

export interface BeneficiaryAnomalySummary {
  totalBeneficiaries: number;
  activePublicServantCount: number;
  duplicateIdentityCount: number;
  deceasedCount: number;
  economicAssetCount: number;
}

export interface ExclusionError {
  region: string;
  gap: number;
  gapRate: number;
}

export interface BeneficiaryAnomalyFinding {
  region: string;
  type: string;
  count: number;
  confidenceScore: number;
  severity: 'Medium' | 'High';
  explanation: string;
}

export interface OnnxAnomalyItem {
  regionId: string;
  regionName: string;
  anomalyScore: number;
  confidenceScore: number;
  severity: 'Critical' | 'High' | 'Medium' | 'Low';
  explanation: string;
}

export interface OnnxAnomalyReport {
  datasetVersionId: string;
  period: string;
  model: string;
  totalEvaluated: number;
  criticalCount: number;
  highCount: number;
  results: OnnxAnomalyItem[];
}

@Injectable({ providedIn: 'root' })
export class AnomalyDataService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = API_BASE_URL;

  getSummary() {
    return this.http.get<AnomalySummary>(`${this.apiUrl}/anomalies/summary`);
  }

  getAnomalies() {
    return this.http.get<FiscalAnomaly[]>(`${this.apiUrl}/anomalies`);
  }

  updateReview(id: string, status: FiscalAnomaly['reviewStatus']) {
    return this.http.put<{ anomalyId: string; reviewStatus: FiscalAnomaly['reviewStatus']; updatedAt: string }>(`${this.apiUrl}/anomalies/${id}/review`, { status });
  }

  getBeneficiarySummary() {
    return this.http.get<BeneficiaryAnomalySummary>(`${this.apiUrl}/beneficiaries/anomaly-summary`);
  }

  getBeneficiaryFindings() {
    return this.http.get<BeneficiaryAnomalyFinding[]>(`${this.apiUrl}/beneficiaries/anomaly-findings`);
  }

  getOnnxMultivariate() {
    return this.http.get<OnnxAnomalyReport>(`${this.apiUrl}/anomalies/onnx-multivariate`);
  }

  getExclusionErrors() {
    return this.http.get<ExclusionError[]>(`${this.apiUrl}/beneficiaries/exclusion-errors`);
  }
}