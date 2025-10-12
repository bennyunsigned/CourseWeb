import { CommonModule } from '@angular/common';
import { Component, ChangeDetectorRef, NgZone, OnInit } from '@angular/core';
import { AbstractControl, FormBuilder, FormGroup, Validators, ValidatorFn, ReactiveFormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { FirstkeyPipe } from '../../../pipes/firstkey.pipe';
import { AuthService } from '../../../services/auth.service';
import { ToastrService } from 'ngx-toastr';
import { lastValueFrom } from 'rxjs';
import { Router } from '@angular/router'; // Import Router
import { jwtDecode } from 'jwt-decode';
import { encryptData } from '../../../utils/crypto-util';
import { LoadingService } from '../../../services/loading.service';
import { environment } from '../../../../environments/environment';

@Component({
  selector: 'app-signup',
  imports: [RouterLink, ReactiveFormsModule, CommonModule, FirstkeyPipe],
  templateUrl: './signup.component.html',
  styleUrls: ['./signup.component.css']
})
export class SignupComponent implements OnInit {
  form: FormGroup;
  isSubmitted: boolean = false;
  googleAuthKey: string = environment.googleAuthKey;

  // Password match validator
  passwordMatchValidator: ValidatorFn = (control: AbstractControl) => {
    const password = control.get('password');
    const confirmPassword = control.get('confirmPassword');

    if (password && confirmPassword && password.value !== confirmPassword.value) {
      confirmPassword?.setErrors({ passwordMismatch: true });
    } else {
      confirmPassword?.setErrors(null);
    }
    return null;
  };

  constructor(
    private formBuilder: FormBuilder,
    private authService: AuthService,
    private toastr: ToastrService,
    private cdr: ChangeDetectorRef,
    private router: Router,
    private ngZone: NgZone,
    private loadingService: LoadingService
  ) {
    // Form initialization with validators
    this.form = this.formBuilder.group({
      name: ['', Validators.required],
      email: ['', [Validators.required, Validators.email]],
      password: ['', [Validators.required, Validators.minLength(6), Validators.pattern(/(?=.*[^a-zA-Z0-9])/)]],
      phone: ['0000000000'],
      confirmPassword: ['']
    }, { validators: this.passwordMatchValidator });
  }

  // Click handler for the Google button: request ID token and send to backend
  async signInWithGoogle(): Promise<void> {
    const w: any = window as any;
    this.loadingService.show();
    if (!w.google || !w.google.accounts || !w.google.accounts.id) {
      console.error('Google Identity Services not loaded');
      this.toastr.error('Google sign-in is not available right now');
      this.loadingService.hide();
      return;
    }

    try {
      const client_id = (document.querySelector('meta[name="google-signin-client_id"]') as HTMLMetaElement)?.content;
      if (!client_id) {
        console.error('No google client id configured');
        this.toastr.error('Google client id not configured');
        this.loadingService.hide();
        return;
      }

      w.google.accounts.id.initialize({
        client_id: client_id,
        callback: async (resp: any) => {
          try {
            const id_token = resp?.credential;
            if (!id_token) {
              console.error('No id_token returned by Google');
              this.toastr.error('Google sign-in failed');
              this.loadingService.hide();
              return;
            }
            const profile: any = jwtDecode(id_token);

            try {
              const res: any = await lastValueFrom(this.authService.googleCallback(id_token, { name: profile.name, email: profile.email, picture: profile.picture }));
              const appJwt = res?.access_token || res?.token || res?.accessToken || (res?.data && (res.data.access_token || res.data.token));
              if (appJwt) {
                this.handleAppJwt(appJwt);
                this.loadingService.hide();
                return;
              }

              // fallback: store profile and navigate
              try {
                if (profile?.name) localStorage.setItem('user_name', encryptData(profile.name));
                if (profile?.email) localStorage.setItem('user_email', encryptData(profile.email));
              } catch (e) { console.warn('Failed storing google profile', e); }

              this.ngZone.run(() => {
                this.toastr.success(`Signed in as ${profile?.name || profile?.email}`, 'Google', { timeOut: 3000 });
                this.router.navigate(['/dashboard']);
                this.loadingService.hide();
              });

            } catch (err) {
              console.error('Google callback failed:', err);
              this.ngZone.run(() => this.toastr.error('Google login failed on server'));
              this.loadingService.hide();
            }

          } catch (e) {
            console.error('Error processing Google credential', e);
            this.toastr.error('Failed to process Google sign-in');
            this.loadingService.hide();
          }
        }
      });

      w.google.accounts.id.prompt();
    } catch (err) {
      console.error('Google sign-in failed', err);
      this.toastr.error('Google sign-in failed');
      this.loadingService.hide();
    }
  }

  ngOnInit(): void {
    const token = localStorage.getItem('access_token');
    if (token) {
      this.setTokenTimeout(token);
      this.router.navigate(['/admin/dashboard']);
    }

    window.addEventListener('google-id-token', (ev: any) => {
      try {
        const detail = ev.detail || {};
        const id_token = detail.credential;
        const profile = detail.profile;
        if (id_token) {
          this.authService.googleCallback(id_token, profile).subscribe({
            next: (res: any) => {
              try {
                if (profile?.name) localStorage.setItem('user_name', encryptData(profile.name));
                if (profile?.email) localStorage.setItem('user_email', encryptData(profile.email));
                const appJwt = res?.access_token || res?.token || res?.accessToken || (res?.data && (res.data.access_token || res.data.token));
                if (appJwt) {
                  this.handleAppJwt(appJwt);
                  this.loadingService.hide();
                  return;
                }
              } catch (e) {
                console.warn('Failed storing google profile', e);
              }
              this.toastr.success(`Signed in as ${profile?.name || profile?.email}`, 'Google', { timeOut: 3000 });
              this.router.navigate(['/dashboard']);
              this.loadingService.hide();
            },
            error: (err: any) => {
              console.error('Google callback failed:', err);
              this.toastr.error('Google login failed on server');
              this.loadingService.hide();
            }
          });
        }
      } catch (e) {
        console.error('Error handling google-id-token event', e);
        this.loadingService.hide();
      }
    });
    // Show loader until Google button is rendered to avoid intermittent missing button
    this.loadingService.show();
    this.waitForGoogleButtonReady().then(() => this.loadingService.hide()).catch(() => this.loadingService.hide());
    // Trigger global initializer in case index.html init ran before Angular inserted the placeholder
    try { (window as any).__gsi_render_buttons && (window as any).__gsi_render_buttons(); } catch(e){}
  }

  private waitForGoogleButtonReady(timeoutMs = 10000): Promise<void> {
    return new Promise((resolve, reject) => {
      const start = Date.now();
      const check = () => {
        const w: any = window as any;
        const btn = document.querySelector('.g_id_signin');
        const ready = (w.google && w.google.accounts && w.google.accounts.id) && !!btn && (btn as HTMLElement).childElementCount > 0;
        if (ready) return resolve();
        if (Date.now() - start > timeoutMs) return reject(new Error('google button ready timeout'));
        setTimeout(check, 200);
      };
      check();
    });
  }

  // Form submission handler
  async onSubmit(): Promise<void> {
    this.isSubmitted = true;
    if (this.form.valid) {
      try {
        const payload = { ...this.form.value, provider: 'local', role: 'User' };
        delete payload.confirmPassword;
        const response = await lastValueFrom(this.authService.createUser(payload));
        this.toastr.success('User created successfully!', 'Success', { timeOut: 3000 });
        this.cdr.detectChanges();
        this.form.reset();
        this.isSubmitted = false;
        this.router.navigate(['/login']);
      } catch (error: any) {
        console.log(error);
        if (error?.error?.detail?.includes('Duplicate entry')) {
          this.toastr.error('Email already exists. Please use a different email.', 'Error', { timeOut: 3000 });
        } else {
          this.toastr.error('Something went wrong!', 'Error', { timeOut: 3000 });
        }
      }
    } else {
      this.toastr.info('Please fill the form correctly!', 'Error', { timeOut: 3000 });
    }
  }

  hasDisplayableError(controlName: string): Boolean {
    const control = this.form.get(controlName);
    return Boolean(control?.invalid) && (this.isSubmitted || Boolean(control?.touched) || Boolean(control?.dirty));
  }

  setTokenTimeout(token: string): void {
    try {
      const payload: any = jwtDecode(token);
      const currentTime = Math.floor(Date.now() / 1000);
      const timeout = (payload.exp - currentTime) * 1000;
      if (timeout > 0) {
        setTimeout(() => { this.logout(); }, timeout);
      }
    } catch (e) {
      console.error('Failed to decode token:', e);
    }
  }

  logout(): void {
    localStorage.removeItem('user_role');
    localStorage.removeItem('user_name');
    localStorage.removeItem('user_id');
    localStorage.removeItem('user_email');
    localStorage.removeItem('dark-mode');
    localStorage.removeItem('access_token');
    this.router.navigate(['/login']);
    this.toastr.info('Session expired. Please log in again.', 'Info', { timeOut: 3000 });
  }

  private handleAppJwt(token: string): void {
    try {
      localStorage.setItem('access_token', token);
      const claims: any = jwtDecode(token);
      const userId = claims.id ? claims.id.toString() : '';
      const userName = claims.name || '';
      const userEmail = claims.email || '';
      const userRole = claims.role || '';
      const picture = claims.picture || '';
      localStorage.setItem('user_id', encryptData(userId));
      localStorage.setItem('user_name', encryptData(userName));
      localStorage.setItem('user_email', encryptData(userEmail));
      localStorage.setItem('user_role', encryptData(userRole));
      localStorage.setItem('user_picture', picture);
      this.setTokenTimeout(token);
      this.ngZone.run(() => {
        this.toastr.success('Logged in successfully!', 'Success', { timeOut: 3000 });
        this.router.navigate(['/dashboard']);
      });
    } catch (e) {
      console.error('Error handling app JWT:', e);
    }
  }
}

