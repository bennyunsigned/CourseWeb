import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class PwaService {
  private deferredPrompt: any = null;
  private canInstallPromptSubject = new BehaviorSubject<boolean>(false);
  private installedSubject = new BehaviorSubject<boolean>(false);

  canInstallPrompt$ = this.canInstallPromptSubject.asObservable();
  installed$ = this.installedSubject.asObservable();

  constructor() {
    // Listen as early as possible so we don't miss the event during route changes
    window.addEventListener('beforeinstallprompt', (e: any) => {
      e.preventDefault();
      this.deferredPrompt = e;
      this.canInstallPromptSubject.next(true);
    });

    window.addEventListener('appinstalled', () => {
      this.deferredPrompt = null;
      this.canInstallPromptSubject.next(false);
      this.installedSubject.next(true);
    });
  }

  hasPrompt(): boolean { return !!this.deferredPrompt; }

  async promptInstall(): Promise<boolean> {
    if (!this.deferredPrompt) return false;
    try {
      this.deferredPrompt.prompt();
      await this.deferredPrompt.userChoice;
    } catch {
      // ignore
    } finally {
      this.deferredPrompt = null; // one-time per page load
      this.canInstallPromptSubject.next(false);
    }
    return true;
  }

  // Utility for other components
  isInstalledNow(): boolean {
    try {
      const mq = window.matchMedia && window.matchMedia('(display-mode: standalone)').matches;
      // @ts-ignore
      const iosStandalone = !!(navigator as any).standalone;
      const androidRef = document.referrer && document.referrer.startsWith('android-app://');
      return !!(mq || iosStandalone || androidRef);
    } catch {
      return false;
    }
  }
}
