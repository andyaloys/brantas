import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class ReportingDataService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = 'http://localhost:5025/api/v1';

  downloadPolicyBrief() {
    return this.http.get(`${this.apiUrl}/reports/policy-brief.pdf`, { responseType: 'blob' });
  }

  downloadAnomaliesCsv() {
    return this.http.get(`${this.apiUrl}/exports/anomalies.csv`, { responseType: 'blob' });
  }

  downloadAllocationsCsv() {
    return this.http.get(`${this.apiUrl}/exports/allocations.csv`, { responseType: 'blob' });
  }
}