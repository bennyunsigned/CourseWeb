import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../environments/environment';
@Injectable({
  providedIn: 'root'
})
export class AuthService {

  constructor(private http: HttpClient) { }

  baseURL = environment.apiUrl + "/auth"; // Use baseURL from environment

  createUser(formData: { name: string; email: string; password: string; phone: string; provider: string; role: string }) {
    return this.http.post(`${this.baseURL}/register`, formData);
  }

  login(formData: { email: string; password: string }) {
    return this.http.post(`${this.baseURL}/login`, formData);
  }

  // Send id_token and decoded profile to backend /auth/GoogleCallBack
  googleCallback(id_token: string, profile: any) {
    const payload = { id_token, profile };
    return this.http.post(`${this.baseURL}/GoogleCallBack`, payload);
  }

  // Change password for the currently authenticated user
  // API: POST /auth/changePassword with JSON body { old_password, new_password }
  // Auth header is added by AuthInterceptor
  changePassword(payload: { old_password: string; new_password: string }) {
    return this.http.post(`${this.baseURL}/changePassword`, payload);
  }
}
