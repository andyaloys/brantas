import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { API_BASE_URL } from '../../../core/config/api.config';

@Injectable({ providedIn: 'root' })
export class ReportingDataService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = API_BASE_URL;

  downloadPolicyBrief() {
    return this.http.get(`${this.apiUrl}/reports/policy-brief.pdf`, { responseType: 'blob' });
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