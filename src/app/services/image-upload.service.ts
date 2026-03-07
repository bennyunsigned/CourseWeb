import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class ImageUploadService {
  private baseURL = `${environment.apiUrl}/api/media`;
  private uploadUrl = `${this.baseURL}/uploadCourseImage`;

  constructor(private http: HttpClient) { }

  uploadCourseImage(file: File): Observable<{ path: string }> {
    const formData = new FormData();
    formData.append('file', file);
    return this.http.post<{ path: string }>(this.uploadUrl, formData);
  }

  uploadProductImage(file: File): Observable<{ path: string }> {
    const formData = new FormData();
    formData.append('file', file);
    const productUploadUrl = `${this.baseURL}/uploadProductImage`;
    return this.http.post<{ path: string }>(productUploadUrl, formData);
  }
}
