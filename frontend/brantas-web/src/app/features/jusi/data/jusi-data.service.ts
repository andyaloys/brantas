import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';

export interface JusiResponse { answer: string; source: string; datasetVersionId: string; period: string; usedFallback: boolean; }

@Injectable({ providedIn: 'root' })
export class JusiDataService {
  private readonly http = inject(HttpClient);
  ask(question: string) { return this.http.post<JusiResponse>('http://localhost:5025/api/v1/jusi/chat', { question }); }
}