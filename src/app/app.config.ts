import { ApplicationConfig, provideZoneChangeDetection, isDevMode } from '@angular/core';
import { provideRouter } from '@angular/router';
import { routes } from './app.routes';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { AuthInterceptor } from './interceptor/auth.interceptor';
import { provideToastr } from 'ngx-toastr';
import { provideAnimations } from '@angular/platform-browser/animations';
import { provideHighcharts } from 'highcharts-angular';
import { provideServiceWorker } from '@angular/service-worker';

export const appConfig: ApplicationConfig = {
  providers: [
    provideZoneChangeDetection({ eventCoalescing: true }),
    provideRouter(routes),
    provideHttpClient(withInterceptors([AuthInterceptor])),
    provideToastr({
      positionClass: 'toast-top-right', // Set position to top-right
      timeOut: 3000, // Optional: Set timeout for notifications
      closeButton: true, // Optional: Add a close button
      progressBar: true, // Optional: Add a progress bar
      preventDuplicates: true, // Prevent same message from popping up multiple times
      countDuplicates: true // Optional: Count duplicate messages instead of showing new toasts
    }),
    provideAnimations(),
    // Highcharts Angular v5 root provider (prevents DI issues and enables charts)
    provideHighcharts(), provideServiceWorker('ngsw-worker.js', {
      enabled: !isDevMode(),
      registrationStrategy: 'registerWhenStable:30000'
    }), provideServiceWorker('ngsw-worker.js', {
      enabled: !isDevMode(),
      registrationStrategy: 'registerWhenStable:30000'
    })
  ]
};
