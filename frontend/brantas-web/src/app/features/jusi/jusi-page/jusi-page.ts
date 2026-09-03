import { ChangeDetectionStrategy, Component, ElementRef, ViewChild, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { JusiDataService, JusiResponse } from '../data/jusi-data.service';

export interface ChatMessage {
  id: string;
  sender: 'user' | 'assistant';
  text: string;
  timestamp: Date;
  source?: string;
  period?: string;
  usedFallback?: boolean;
  isError?: boolean;
}

@Component({
  selector: 'app-jusi-page',
  templateUrl: './jusi-page.html',
  styleUrl: './jusi-page.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class JusiPageComponent {
  private readonly jusiData = inject(JusiDataService);
  @ViewChild('scrollContainer') private scrollContainer?: ElementRef<HTMLElement>;

  protected readonly question = signal('');
  protected readonly messages = signal<ChatMessage[]>([
    {
      id: 'welcome',
      sender: 'assistant',
      text: 'Halo, saya JUSI. Saya siap membantu menelaah data kemiskinan, menghitung simulasi anggaran, dan mengevaluasi efektivitas program perlindungan sosial berdasarkan data aktif BRANTAS.',
      timestamp: new Date()
    }
  ]);
  protected readonly isLoading = signal(false);

  protected updateQuestion(event: Event): void {
    this.question.set((event.target as HTMLTextAreaElement).value);
  }

  protected useQuestion(q: string): void {
    this.question.set(q);
  }

  protected onKeydown(event: KeyboardEvent): void {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      this.ask();
    }
  }

  protected async ask(): Promise<void> {
    const q = this.question().trim();
    if (!q || this.isLoading()) return;

    this.question.set('');

    const userMsg: ChatMessage = {
      id: 'user-' + Date.now(),
      sender: 'user',
      text: q,
      timestamp: new Date()
    };

    this.messages.update((prev) => [...prev, userMsg]);
    this.isLoading.set(true);
    this.scrollToBottom();

    try {
      const res: JusiResponse = await firstValueFrom(this.jusiData.ask(q));
      const aiMsg: ChatMessage = {
        id: 'ai-' + Date.now(),
        sender: 'assistant',
        text: res.answer,
        timestamp: new Date(),
        source: res.source,
        period: res.period,
        usedFallback: res.usedFallback
      };
      this.messages.update((prev) => [...prev, aiMsg]);
    } catch {
      const errorMsg: ChatMessage = {
        id: 'err-' + Date.now(),
        sender: 'assistant',
        text: 'Pertanyaan tidak dapat diproses. Pastikan pertanyaan berada dalam domain BRANTAS dan tidak memuat identitas pribadi (NIK/NKK).',
        timestamp: new Date(),
        isError: true
      };
      this.messages.update((prev) => [...prev, errorMsg]);
    } finally {
      this.isLoading.set(false);
      this.scrollToBottom();
    }
  }

  private scrollToBottom(): void {
    setTimeout(() => {
      if (this.scrollContainer?.nativeElement) {
        this.scrollContainer.nativeElement.scrollTop = this.scrollContainer.nativeElement.scrollHeight;
      }
    }, 60);
  }
}