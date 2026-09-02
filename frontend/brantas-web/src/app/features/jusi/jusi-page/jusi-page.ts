import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { JusiDataService, JusiResponse } from '../data/jusi-data.service';

@Component({ selector: 'app-jusi-page', templateUrl: './jusi-page.html', styleUrl: './jusi-page.css', changeDetection: ChangeDetectionStrategy.OnPush })
export class JusiPageComponent {
  private readonly jusiData = inject(JusiDataService);
  protected readonly question = signal('Berapa rata-rata kemiskinan nasional?');
  protected readonly response = signal<JusiResponse | null>(null);
  protected readonly error = signal<string | null>(null);
  protected readonly isLoading = signal(false);
  protected updateQuestion(event: Event): void { this.question.set((event.target as HTMLTextAreaElement).value); }
  protected useQuestion(question: string): void { this.question.set(question); }
  protected async ask(): Promise<void> {
    this.isLoading.set(true); this.error.set(null);
    try { this.response.set(await firstValueFrom(this.jusiData.ask(this.question()))); }
    catch (error: unknown) { this.response.set(null); this.error.set('Pertanyaan tidak dapat diproses. Pastikan pertanyaan berada dalam domain BRANTAS dan tidak memuat identitas pribadi.'); }
    finally { this.isLoading.set(false); }
  }
}