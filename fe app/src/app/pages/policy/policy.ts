import { Component, inject, signal, ElementRef, ViewChild, AfterViewChecked } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { BrantasStateService } from '../../services/brantas-state.service';

@Component({
  selector: 'app-policy',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './policy.html',
  styleUrl: './policy.css'
})
export class PolicyComponent implements AfterViewChecked {
  protected readonly state = inject(BrantasStateService);
  
  readonly userMessage = signal<string>('');
  readonly isPdfGenerating = signal<boolean>(false);
  readonly isPdfDone = signal<boolean>(false);

  @ViewChild('chatScrollContainer') private chatScrollContainer!: ElementRef;

  ngAfterViewChecked(): void {
    this.scrollToBottom();
  }

  sendMessage(): void {
    const text = this.userMessage();
    if (!text.trim()) return;

    this.state.sendMessageToJusi(text);
    this.userMessage.set('');
  }

  sendPresetMessage(text: string): void {
    this.state.sendMessageToJusi(text);
  }

  downloadPolicyBrief(): void {
    if (this.isPdfGenerating() || this.isPdfDone()) return;

    this.isPdfGenerating.set(true);
    setTimeout(() => {
      this.isPdfGenerating.set(false);
      this.isPdfDone.set(true);
      
      // Auto reset status banner after 4 seconds
      setTimeout(() => {
        this.isPdfDone.set(false);
      }, 4000);
    }, 1500);
  }

  private scrollToBottom(): void {
    try {
      const el = this.chatScrollContainer.nativeElement;
      el.scrollTop = el.scrollHeight;
    } catch (err) {
      // Container not ready
    }
  }
}
