import { ApplicationConfig, provideZoneChangeDetection } from '@angular/core';
import { provideRouter } from '@angular/router';
import { routes } from './app.routes';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { AuthInterceptor } from './interceptor/auth.interceptor';
import { provideToastr } from 'ngx-toastr';
import { provideAnimations } from '@angular/platform-browser/animations';
import { provideHighcharts } from 'highcharts-angular';

export const appConfig: ApplicationConfig = {
  providers: [
    provideZoneChangeDetection({ eventCoalescing: true }),
    provideRouter(routes),
    provideHttpClient(withInterceptors([AuthInterceptor])),
    provideToastr({
      positionClass: 'toast-top-right', // Set position to top-right
      timeOut: 3000, // Optional: Set timeout for notifications
      closeButton: true, // Optional: Add a close button
      progressBar: true // Optional: Add a progress bar
    }),
    provideAnimations(),
    // Highcharts Angular v5 root provider (prevents DI issues and enables charts)
    provideHighcharts()
  ]
};
