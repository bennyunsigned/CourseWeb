import { HttpInterceptorFn } from '@angular/common/http';

export const AuthInterceptor: HttpInterceptorFn = (req, next) => {
  const token = localStorage.getItem('access_token');

  if (token) {
    console.log('[AuthInterceptor] Attaching token to request:', req.url);
    const cloned = req.clone({
      headers: req.headers.set('Authorization', `Bearer ${token}`)
    });
    return next(cloned);
  }

  console.log('[AuthInterceptor] No token found for request:', req.url);
  return next(req);
};