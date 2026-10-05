import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { API_BASE_URL } from '../../../core/config/api.config';

export interface ChatHistoryPayload {
  role: 'user' | 'assistant';
  content: string;
}

export interface JusiResponse {
  answer: string;
  source: string;
  datasetVersionId: string;
  period: string;
  usedFallback: boolean;
}

@Injectable({ providedIn: 'root' })
export class JusiDataService {
  private readonly http = inject(HttpClient);

  ask(question: string, history?: ChatHistoryPayload[]) {
    return this.http.post<JusiResponse>(`${API_BASE_URL}/jusi/chat`, {
      question,
      history
    });
  }
}