import { ChangeDetectionStrategy, Component, HostListener, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { KioskModeService } from '../../core/services/kiosk-mode.service';
import { ExecutiveTickerComponent } from '../executive-ticker/executive-ticker.component';

@Component({
  selector: 'app-shell',
  standalone: true,
  imports: [CommonModule, RouterLink, RouterLinkActive, RouterOutlet, ExecutiveTickerComponent],
  templateUrl: './app-shell.html',
  styleUrl: './app-shell.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class AppShellComponent {
  protected readonly kiosk = inject(KioskModeService);

  @HostListener('window:keydown', ['$event'])
  handleKeyboardEvent(event: KeyboardEvent): void {
    if (this.kiosk.isKioskActive()) {
      if (event.code === 'Space') {
        event.preventDefault();
        this.kiosk.togglePlay();
      } else if (event.code === 'ArrowRight') {
        event.preventDefault();
        this.kiosk.nextSlide();
      } else if (event.code === 'ArrowLeft') {
        event.preventDefault();
        this.kiosk.prevSlide();
      } else if (event.code === 'Escape') {
        this.kiosk.stopKiosk();
      }
    }
  }
}