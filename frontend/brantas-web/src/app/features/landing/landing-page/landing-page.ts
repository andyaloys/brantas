import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterModule } from '@angular/router';
import { AuthService } from '../../../core/services/auth.service';

@Component({
  selector: 'app-landing-page',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './landing-page.html',
  styleUrl: './landing-page.css'
})
export class LandingPageComponent {
  private readonly router = inject(Router);
  private readonly authService = inject(AuthService);

  readonly isAuthenticated = this.authService.isAuthenticated;

  navigateTo(path: string = '/beranda'): void {
    if (this.isAuthenticated()) {
      this.router.navigate([path]);
    } else {
      this.router.navigate(['/login'], { queryParams: { returnUrl: path } });
    }
  }

  navigateToPortal(): void {
    if (this.isAuthenticated()) {
      this.router.navigate(['/beranda']);
    } else {
      this.router.navigate(['/login'], { queryParams: { returnUrl: '/beranda' } });
    }
  }
}
