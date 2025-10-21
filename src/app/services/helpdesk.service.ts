import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { environment } from '../../environments/environment';
import { decryptData } from '../utils/crypto-util';
import { Observable, throwError } from 'rxjs';
import { tap, catchError } from 'rxjs/operators';

@Injectable({
  providedIn: 'root'
})
export class HelpdeskService {
  private baseUrl = `${environment.apiUrl}/api/helpdesk/tickets`;

  constructor(private http: HttpClient) { }

  // Create ticket (with optional file)
  createTicket(subject: string, description?: string, priority: string = 'medium', file?: File): Observable<any> {
    const form = new FormData();
    form.append('subject', subject);
    if (description !== undefined) form.append('description', description);
    form.append('priority', priority);
    if (file) form.append('file', file, file.name);
  console.log('[HelpdeskService] createTicket -> URL:', `${this.baseUrl}/`, { subject, priority, hasFile: !!file });
    return this.http.post<any>(`${this.baseUrl}/`, form).pipe(
      tap(res => console.log('[HelpdeskService] createTicket response', res)),
      catchError(err => { console.error('[HelpdeskService] createTicket error', err); return throwError(() => err); })
    );
  }

  // Get ticket details (messages + attachments)
  getTicket(ticketId: number | string): Observable<any> {
    console.log('[HelpdeskService] getTicket ->', `${this.baseUrl}/${ticketId}`);
    return this.http.get<any>(`${this.baseUrl}/${ticketId}`).pipe(
      tap(res => console.log('[HelpdeskService] getTicket response', res)),
      catchError(err => { console.error('[HelpdeskService] getTicket error', err); return throwError(() => err); })
    );
  }

  // List tickets for a user
  // List tickets for a specific user (owner or admin). New API path: /tickets/user/{user_id}
  listTicketsByUser(userId: number | string): Observable<any[]> {
    console.log('[HelpdeskService] listTicketsByUser ->', `${this.baseUrl}/user/${userId}`);
    return this.http.get<any[]>(`${this.baseUrl}/user/${userId}`).pipe(
      tap(res => console.log('[HelpdeskService] listTicketsByUser response', res)),
      catchError(err => { console.error('[HelpdeskService] listTicketsByUser error', err); return throwError(() => err); })
    );
  }

  // List tickets for the authenticated user (uses JWT claims on server) - new endpoint
  listMyTickets(): Observable<any[]> {
    const uidRaw = localStorage.getItem('user_id');
    if (uidRaw) {
      const decrypted = decryptData(uidRaw);
      const uidToUse = decrypted && decrypted !== '' ? decrypted : uidRaw;
      console.log('[HelpdeskService] listMyTickets -> delegating to listTicketsByUser', { raw: uidRaw, used: uidToUse, decrypted: !!decrypted });
      return this.listTicketsByUser(uidToUse);
    }
    console.log('[HelpdeskService] listMyTickets ->', `${this.baseUrl}/mine`);
    return this.http.get<any[]>(`${this.baseUrl}/mine`).pipe(
      tap(res => console.log('[HelpdeskService] listMyTickets response', res)),
      catchError(err => { console.error('[HelpdeskService] listMyTickets error', err); return throwError(() => err); })
    );
  }

  // List open tickets (admin)
  listOpenTickets(): Observable<any[]> {
    console.log('[HelpdeskService] listOpenTickets ->', `${this.baseUrl}/open`);
    return this.http.get<any[]>(`${this.baseUrl}/open`).pipe(
      tap(res => console.log('[HelpdeskService] listOpenTickets response', res)),
      catchError(err => { console.error('[HelpdeskService] listOpenTickets error', err); return throwError(() => err); })
    );
  }

  // Add a message to a ticket
  addMessage(ticketId: number | string, message: string): Observable<any> {
    console.log('[HelpdeskService] addMessage ->', `${this.baseUrl}/${ticketId}/messages`, { message });
    return this.http.post<any>(`${this.baseUrl}/${ticketId}/messages`, { message }).pipe(
      tap(res => console.log('[HelpdeskService] addMessage response', res)),
      catchError(err => { console.error('[HelpdeskService] addMessage error', err); return throwError(() => err); })
    );
  }

  // Update ticket status
  updateStatus(ticketId: number | string, status: string): Observable<any> {
    console.log('[HelpdeskService] updateStatus ->', `${this.baseUrl}/${ticketId}/status`, { status });
    return this.http.patch<any>(`${this.baseUrl}/${ticketId}/status`, { status }).pipe(
      tap(res => console.log('[HelpdeskService] updateStatus response', res)),
      catchError(err => { console.error('[HelpdeskService] updateStatus error', err); return throwError(() => err); })
    );
  }

  // Add attachment to existing ticket
  addAttachment(ticketId: number | string, file: File): Observable<any> {
    const form = new FormData();
    form.append('file', file, file.name);
    console.log('[HelpdeskService] addAttachment ->', `${this.baseUrl}/${ticketId}/attachments`, { fileName: file.name, fileType: file.type });
    return this.http.post<any>(`${this.baseUrl}/${ticketId}/attachments`, form).pipe(
      tap(res => console.log('[HelpdeskService] addAttachment response', res)),
      catchError(err => { console.error('[HelpdeskService] addAttachment error', err); return throwError(() => err); })
    );
  }

  // List attachments for ticket
  listAttachments(ticketId: number | string): Observable<any[]> {
    console.log('[HelpdeskService] listAttachments ->', `${this.baseUrl}/${ticketId}/attachments`);
    return this.http.get<any[]>(`${this.baseUrl}/${ticketId}/attachments`).pipe(
      tap(res => console.log('[HelpdeskService] listAttachments response', res)),
      catchError(err => { console.error('[HelpdeskService] listAttachments error', err); return throwError(() => err); })
    );
  }

  // Delete ticket (admin)
  deleteTicket(ticketId: number | string): Observable<any> {
    console.log('[HelpdeskService] deleteTicket ->', `${this.baseUrl}/${ticketId}`);
    return this.http.delete<any>(`${this.baseUrl}/${ticketId}`).pipe(
      tap(res => console.log('[HelpdeskService] deleteTicket response', res)),
      catchError(err => { console.error('[HelpdeskService] deleteTicket error', err); return throwError(() => err); })
    );
  }
}
