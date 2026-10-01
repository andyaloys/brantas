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
    // Mode Demo: Otomatis masuk sebagai Dewan Juri / Eksekutif tanpa form login
    if (!this.isAuthenticated()) {
      this.authService.loginDemo();
    }
    this.router.navigate([path]);
  }

  navigateToPortal(): void {
    this.navigateTo('/beranda');
  }
}
