import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { API_BASE_URL } from '../../../core/config/api.config';

export interface PolicyBriefDownloadParams {
  scenarioId?: string;
  scenarioName?: string;
  povertyWeight?: number;
  disasterWeight?: number;
  capPercent?: number;
  depthWeight?: number;
  severityWeight?: number;
  humanDevelopmentWeight?: number;
  gdpWeight?: number;
}

@Injectable({ providedIn: 'root' })
export class ReportingDataService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = API_BASE_URL;

  downloadPolicyBrief(params?: PolicyBriefDownloadParams) {
    let httpParams = new HttpParams();
    if (params) {
      if (params.scenarioId) httpParams = httpParams.set('scenarioId', params.scenarioId);
      if (params.scenarioName) httpParams = httpParams.set('scenarioName', params.scenarioName);
      if (params.povertyWeight !== undefined) httpParams = httpParams.set('povertyWeight', params.povertyWeight);
      if (params.disasterWeight !== undefined) httpParams = httpParams.set('disasterWeight', params.disasterWeight);
      if (params.capPercent !== undefined) httpParams = httpParams.set('capPercent', params.capPercent);
      if (params.depthWeight !== undefined) httpParams = httpParams.set('depthWeight', params.depthWeight);
      if (params.severityWeight !== undefined) httpParams = httpParams.set('severityWeight', params.severityWeight);
      if (params.humanDevelopmentWeight !== undefined) httpParams = httpParams.set('humanDevelopmentWeight', params.humanDevelopmentWeight);
      if (params.gdpWeight !== undefined) httpParams = httpParams.set('gdpWeight', params.gdpWeight);
    }
    return this.http.get(`${this.apiUrl}/reports/policy-brief.pdf`, {
      params: httpParams,
      responseType: 'blob'
    });
  }

  downloadAnomaliesCsv() {
    return this.http.get(`${this.apiUrl}/exports/anomalies.csv`, { responseType: 'blob' });
  }

  downloadAllocationsCsv() {
    return this.http.get(`${this.apiUrl}/exports/allocations.csv`, { responseType: 'blob' });
  }

  downloadAllocationsXlsx() {
    return this.http.get(`${this.apiUrl}/exports/allocations.xlsx`, { responseType: 'blob' });
  }

  downloadAnomaliesXlsx() {
    return this.http.get(`${this.apiUrl}/exports/anomalies.xlsx`, { responseType: 'blob' });
  }
}