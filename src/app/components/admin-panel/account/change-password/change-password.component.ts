import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { ToastrService } from 'ngx-toastr';
import { AuthService } from '../../../../services/auth.service';
import { jwtDecode } from 'jwt-decode';

@Component({
  selector: 'app-change-password',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './change-password.component.html',
  styleUrls: ['./change-password.component.css']
})
export class ChangePasswordComponent {
  form: FormGroup;
  submitting = false;
  isGoogleUser = false;
  showCurrent = false;
  showNew = false;
  showConfirm = false;

  constructor(private fb: FormBuilder, private auth: AuthService, private toastr: ToastrService) {
    this.form = this.fb.group({
      currentPassword: ['', [Validators.required, Validators.minLength(6)]],
      newPassword: ['', [Validators.required, Validators.minLength(8)]],
      confirmPassword: ['', [Validators.required]]
    }, { validators: this.passwordsMatchValidator });

    // Best-effort detection of Google sign-in from JWT claims
    try {
      const token = localStorage.getItem('access_token');
      if (token) {
        const claims: any = jwtDecode(token);
        const provider = (claims.provider || claims.auth_provider || '').toString().toLowerCase();
        const iss = (claims.iss || '').toString().toLowerCase();
        this.isGoogleUser = provider === 'google' || iss.includes('google');
      }
    } catch { /* ignore */ }
  }

  private passwordsMatchValidator(group: FormGroup) {
    const n = group.get('newPassword')?.value || '';
    const c = group.get('confirmPassword')?.value || '';
    // Do not flag error until both fields have a value
    if (!n || !c) return null;
    return n === c ? null : { passwordsMismatch: true };
  }

  get f() { return this.form.controls; }

  get newPasswordStrength(): { label: 'Weak' | 'Medium' | 'Strong'; score: number } {
    const pwd = this.form.get('newPassword')?.value || '';
    if (!pwd) {
      return { label: '' as any, score: 0 };
    }
    let score = 0;
    if (pwd.length >= 8) score++;
    if (/[A-Z]/.test(pwd) && /[a-z]/.test(pwd)) score++;
    if (/\d/.test(pwd) && /[^A-Za-z0-9]/.test(pwd)) score++;
    if (score <= 1) return { label: 'Weak', score: 1 };
    if (score === 2) return { label: 'Medium', score: 2 };
    return { label: 'Strong', score: 3 };
  }

  submit() {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      this.toastr.warning('Please fix the errors before submitting.');
      return;
    }

    if (this.isGoogleUser) {
      // Mirror server policy: block on client too for clearer UX
      this.toastr.info('Google sign-in users cannot change password');
      return;
    }
    this.submitting = true;
    const { currentPassword, newPassword } = this.form.value;
    // Map to API payload keys
    this.auth.changePassword({ old_password: currentPassword, new_password: newPassword }).subscribe({
      next: (res: any) => {
        const msg = res?.message || 'Password changed successfully';
        this.toastr.success(msg);
        this.form.reset();
        this.submitting = false;
        // Close the modal if present
        try {
          const el = document.getElementById('changePasswordModal');
          const Modal = (window as any).bootstrap?.Modal;
          if (el && Modal) {
            const instance = Modal.getOrCreateInstance(el);
            instance.hide();
          }
        } catch {}
      },
      error: (err) => {
        const status = err?.status;
        const detail = err?.error?.detail || err?.error?.message || 'Failed to change password';
        if (status === 400) {
          this.toastr.error(detail === 'Old password is incorrect' ? detail : detail);
        } else if (status === 401) {
          this.toastr.error(detail || 'Session expired. Please log in again.');
        } else if (status === 403) {
          this.toastr.error(detail || 'Google sign-in users cannot change password');
        } else if (status === 404) {
          this.toastr.error(detail || 'User not found');
        } else {
          this.toastr.error(detail);
        }
        this.submitting = false;
      }
    });
  }
}
