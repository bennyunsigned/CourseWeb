import { CanActivateFn } from '@angular/router';
import { decryptData } from '../utils/crypto-util';

export const AdminOnlyGuard: CanActivateFn = (route, state) => {
  try {
    const stored = localStorage.getItem('user_email');
    if (!stored) return false;
    let email = decryptData(stored) || stored;
    const normalized = (email || '').trim().toLowerCase();
    return normalized === 'bennyunsigned@gmail.com';
  } catch {
    return false;
  }
};
