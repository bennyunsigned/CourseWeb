import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

export interface EmailPayload {
    recipient_email: string;
    subject?: string;
    body?: string;
    attachments?: string | null;
}

@Injectable({
    providedIn: 'root'
})
export class EmailService {
    private apiUrl = `${environment.apiUrl}/api/email`;

    constructor(private http: HttpClient) { }

    sendEmail(payload: EmailPayload): Observable<any> {
        return this.http.post(`${this.apiUrl}/add`, payload);
    }
}
