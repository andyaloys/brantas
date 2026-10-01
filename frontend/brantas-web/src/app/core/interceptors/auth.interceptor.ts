import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { AuthService } from '../services/auth.service';

/**
 * Interceptor untuk menyertakan identitas pengguna aktif (X-Brantas-User, X-Brantas-Role)
 * pada seluruh request HTTP keluar ke backend API BRANTAS.
 * Ini memastikan isolasi data privat skenario dan audit logging yang akurat.
 */
export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const authService = inject(AuthService);
  const user = authService.currentUser();

  if (user) {
    const authReq = req.clone({
      setHeaders: {
        'X-Brantas-User': user.username,
        'X-Brantas-Role': user.role
      }
    });
    return next(authReq);
  }

  return next(req);
};
