import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  HostListener,
  ViewChild,
  computed,
  effect,
  inject,
  signal
} from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { JusiChatService, EXECUTIVE_QUICK_PROMPTS } from '../services/jusi-chat.service';
import { JusiWidgetService } from '../services/jusi-widget.service';

@Component({
  selector: 'app-jusi-chat-widget',
  standalone: true,
  imports: [CommonModule, DatePipe],
  templateUrl: './jusi-chat-widget.component.html',
  styleUrl: './jusi-chat-widget.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class JusiChatWidgetComponent {
  protected readonly chat = inject(JusiChatService);
  protected readonly widget = inject(JusiWidgetService);

  @ViewChild('scrollContainer') private scrollContainer?: ElementRef<HTMLElement>;
  @ViewChild('composerTextarea') private composerTextarea?: ElementRef<HTMLTextAreaElement>;

  protected readonly question = signal('');
  protected readonly isPromptsDismissed = signal(false);
  protected readonly quickPrompts = EXECUTIVE_QUICK_PROMPTS;

  // Onboarding input form signals (pre-filled with last user profile if available)
  protected readonly profileFormName = signal('');
  protected readonly profileFormUnit = signal('');

  // Hanya muncul jika sesi baru (belum ada pesan dari user)
  protected readonly isNewSession = computed(() => {
    const msgs = this.chat.activeMessages();
    return !msgs.some((m) => m.sender === 'user');
  });

  constructor() {
    const lastProfile = this.chat.getLastUserProfile();
    if (lastProfile.name) {
      this.profileFormName.set(lastProfile.name);
      this.profileFormUnit.set(lastProfile.unit);
    }

    // Auto scroll and focus when widget opens or messages update
    effect(() => {
      const isOpen = this.widget.isOpen();
      if (isOpen) {
        this.scrollToBottom();
        setTimeout(() => {
          this.composerTextarea?.nativeElement?.focus();
        }, 150);
      }
    });
  }

  @HostListener('window:keydown', ['$event'])
  handleGlobalShortcuts(event: KeyboardEvent): void {
    if ((event.ctrlKey || event.altKey) && (event.key === 'j' || event.key === 'J')) {
      event.preventDefault();
      this.widget.toggle();
    } else if (event.key === 'Escape' && this.widget.isOpen()) {
      if (this.widget.isSessionsDrawerOpen()) {
        this.widget.toggleSessionsDrawer();
      } else {
        this.widget.close();
      }
    }
  }

  protected updateQuestion(event: Event): void {
    this.question.set((event.target as HTMLTextAreaElement).value);
  }

  protected submitOnboarding(): void {
    const name = this.profileFormName().trim();
    const unit = this.profileFormUnit().trim();
    if (!name || !unit) return;
    this.chat.setUserProfile(name, unit);
    this.scrollToBottom();
    setTimeout(() => this.composerTextarea?.nativeElement?.focus(), 120);
  }

  protected usePrompt(query: string): void {
    this.question.set(query);
    this.ask();
  }

  protected dismissPrompts(): void {
    this.isPromptsDismissed.set(true);
  }

  protected onKeydown(event: KeyboardEvent): void {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      this.ask();
    }
  }

  protected startNewSession(): void {
    this.chat.startNewSession();
    const lastProfile = this.chat.getLastUserProfile();
    if (lastProfile.name) {
      this.profileFormName.set(lastProfile.name);
      this.profileFormUnit.set(lastProfile.unit);
    }
    this.isPromptsDismissed.set(false);
    this.widget.isSessionsDrawerOpen.set(false);
    this.question.set('');
    this.scrollToBottom();
    setTimeout(() => this.composerTextarea?.nativeElement?.focus(), 100);
  }

  protected selectSession(id: string): void {
    this.chat.selectSession(id);
    this.isPromptsDismissed.set(false);
    this.widget.isSessionsDrawerOpen.set(false);
    this.scrollToBottom();
  }

  protected deleteSession(id: string, event: MouseEvent): void {
    event.stopPropagation();
    this.chat.deleteSession(id);
    this.scrollToBottom();
  }

  protected async ask(): Promise<void> {
    const q = this.question();
    if (!q.trim()) return;
    this.question.set('');
    await this.chat.ask(q);
    this.scrollToBottom();
  }

  private scrollToBottom(): void {
    setTimeout(() => {
      if (this.scrollContainer?.nativeElement) {
        this.scrollContainer.nativeElement.scrollTop =
          this.scrollContainer.nativeElement.scrollHeight;
      }
    }, 50);
  }
}
