import { CommonModule } from '@angular/common';
import { Component, OnInit, NgZone } from '@angular/core';
import { environment } from '../../../../environments/environment';
import { FormBuilder, FormGroup, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { FirstkeyPipe } from '../../../pipes/firstkey.pipe';
import { ToastrService } from 'ngx-toastr';
import { jwtDecode } from 'jwt-decode'; // Import jwt-decode
import { firstValueFrom } from 'rxjs';
import { encryptData } from '../../../utils/crypto-util';
import { AuthService } from '../../../services/auth.service';
import { LoadingService } from '../../../services/loading.service';

@Component({
  selector: 'app-login',
  imports: [RouterLink, CommonModule, ReactiveFormsModule, FormsModule, FirstkeyPipe],
  templateUrl: './login.component.html',
  styleUrl: './login.component.css'
})
export class LoginComponent implements OnInit {
  form: FormGroup;
  isSubmitted: boolean = false;
  // expose the google auth key on the component so templates or tests can access it
  googleAuthKey: string = environment.googleAuthKey;

  constructor(
    private formBuilder: FormBuilder,
    private toastr: ToastrService,
    private authService: AuthService,
    private router: Router,
    private ngZone: NgZone,
    private loadingService: LoadingService,
  ) {
    this.form = this.formBuilder.group({
      email: ['', [Validators.required, Validators.email]], // Added email validation
      password: ['', Validators.required]
    });
  }

   
  ngOnInit(): void {    

    const token = localStorage.getItem('access_token');
    if (token) {
      this.setTokenTimeout(token); // Set token timeout if already logged in
      this.router.navigate(['/admin/dashboard']); // Redirect if already logged in
    }

    // Listen for google-id-token events dispatched from index.html
    window.addEventListener('google-id-token', (ev: any) => {
      try {
        const detail = ev.detail || {};
        const id_token = detail.credential;
        const profile = detail.profile;
        console.log('Received google-id-token event', { id_token, profile });
        if (id_token) {
          this.authService.googleCallback(id_token, profile).subscribe({
            next: (res: any) => {
              console.log('Backend GoogleCallBack response:', res);
              // store returned info if needed
              try {
                if (profile?.name) localStorage.setItem('user_name', encryptData(profile.name));
                if (profile?.email) localStorage.setItem('user_email', encryptData(profile.email));
                // Prefer the application JWT returned by the backend instead of storing the Google id_token
                const appJwt = res?.access_token || res?.token || res?.accessToken || (res?.data && (res.data.access_token || res.data.token));
                if (appJwt) {
                  // Use the same handling as normal login
                  this.handleAppJwt(appJwt);
                  this.loadingService.hide();
                  return;
                }
                // If backend did not return an app token, do NOT store the Google id_token as access_token
                // (we keep profile info but rely on the backend-provided token when available)
              } catch (e) {
                console.warn('Failed storing google profile', e);
              }
              this.toastr.success(`Signed in as ${profile?.name || profile?.email}`, 'Google', { timeOut: 3000 });
              this.ngZone.run(() => {
                this.router.navigate(['/dashboard']);
                this.loadingService.hide();
              });
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
    // Start loader until Google button is rendered (masks intermittent CDN/script timing issues)
    this.loadingService.show();
    this.waitForGoogleButtonReady().then(() => this.loadingService.hide()).catch(() => this.loadingService.hide());
    // Trigger global initializer in case index.html init ran before Angular inserted the placeholder
    try { (window as any).__gsi_render_buttons && (window as any).__gsi_render_buttons(); } catch(e){}
  }

  // Poll until the Google button is rendered or timeout
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

  async onSubmit(): Promise<void> {
    this.isSubmitted = true;
    if (this.form.valid) {
      this.authService.login(this.form.value).subscribe({
        next: (res: any) => {
          const token = res.access_token; // Extract the token
          localStorage.setItem('access_token', token); // Save the token in localStorage

          // Decode the token to extract claims
          const claims: any = jwtDecode(token);

          // Validate and convert claims to strings before encryption
          const userId = claims.id ? claims.id.toString() : '';
          const userName = claims.name || '';
          const userEmail = claims.email || '';
          const userRole = claims.role || '';

          // Encrypt and store claims in localStorage
          localStorage.setItem('user_id', encryptData(userId));
          localStorage.setItem('user_name', encryptData(userName));
          localStorage.setItem('user_email', encryptData(userEmail));
          localStorage.setItem('user_role', encryptData(userRole));

          this.setTokenTimeout(token); // Set token timeout after login
          this.setTokenTimeout(token); // Set token timeout after login
          this.ngZone.run(() => {
            this.router.navigate(['/dashboard']); // Correct path
            this.toastr.success('Logged in successfully!', 'Success', { timeOut: 3000 });
          });
        },
        error: (err: any) => {
          if (err.error?.detail === 'Invalid email or password') {
            this.toastr.error('Invalid email or password!', 'Error', {
              timeOut: 3000
            });
          } else {
            console.log(err);
            this.toastr.error('Something went wrong!', 'Error', { timeOut: 3000 });
          }
        }
      });
    } else {
      this.toastr.info('Please fill the form correctly!', 'Error', {
        timeOut: 3000
      });
    }
  }

  setTokenTimeout(token: string): void {
    try {
      const payload: any = jwtDecode(token);
      const currentTime = Math.floor(Date.now() / 1000);
      const timeout = (payload.exp - currentTime) * 1000; // Calculate timeout in milliseconds

      if (timeout > 0) {
        setTimeout(() => {
          this.logout(); // Automatically log out when the token expires
        }, timeout);
      }
    } catch (e) {
      console.error('Failed to decode token:', e);
    }
  }

  logout(): void {
    // Clear all relevant keys from local storage   
    localStorage.removeItem('user_role');
    localStorage.removeItem('user_name');
    localStorage.removeItem('user_id');
    localStorage.removeItem('user_email');
    localStorage.removeItem('dark-mode');
    localStorage.removeItem('access_token');

    // Redirect to the login page
    this.router.navigate(['/login']); // Replace '/login' with your actual login route
    this.toastr.info('Session expired. Please log in again.', 'Info', {
      timeOut: 3000
    });
  }

  hasDisplayableError(controlName: string): Boolean {
    const control = this.form.get(controlName);
    return Boolean(control?.invalid) && (this.isSubmitted || Boolean(control?.touched) || Boolean(control?.dirty));
  }

  private handleAppJwt(token: string): void {
    try {
      // Save token
      localStorage.setItem('access_token', token);

      // Decode the token to extract claims
      const claims: any = jwtDecode(token);

      // Validate and convert claims to strings before encryption
      const userId = claims.id ? claims.id.toString() : '';
      const userName = claims.name || '';
      const userEmail = claims.email || '';
      const userRole = claims.role || '';
      const picture = claims.picture || '';

      console.log('Decoded app JWT claims:', claims);

      // Encrypt and store claims in localStorage
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
