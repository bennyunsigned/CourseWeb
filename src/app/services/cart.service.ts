import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, BehaviorSubject, of } from 'rxjs';
import { tap, catchError } from 'rxjs/operators';
import { environment } from '../../environments/environment';

export interface CartItem {
  CartId: number;
  UserId: number;
  CourseId: number;
  CourseName: string;
  ActualPrice: number;
  DiscountedPrice: number;  
  BannerImage?: string;
  BannerImageUrl?: string;
  CreatedAt: string;
  Status: string;
}

@Injectable({ providedIn: 'root' })
export class CartService {
  private base = `${environment.apiUrl}/api/cart`;
  private _count$ = new BehaviorSubject<number>(0);

  get cartCount$() {
    return this._count$.asObservable();
  }

  constructor(private http: HttpClient) {}

  // GET /api/cart/ -> returns CartItem[]
  getCart(): Observable<CartItem[]> {
    return this.http.get<CartItem[]>(`${this.base}/`).pipe(
      tap((res) => {
        try { this._count$.next((res || []).length); } catch (e) { /* ignore */ }
      }),
      catchError(err => { return of([] as CartItem[]); })
    );
  }

  // POST /api/cart/ -> adds to cart
  // Backend expects { course_id: number } and derives user from auth
  addToCart(payload: { course_id: number }): Observable<any> {
    return this.http.post(`${this.base}/`, payload).pipe(
      tap(() => this.refreshCount()),
      catchError(err => { throw err; })
    );
  }

  // NOTE: quantity is not managed client-side; backend controls quantities per user/cart.

  // Delete a cart item by course id (backend derives user from auth)
  deleteCart(courseId: number): Observable<any> {
    // send course_id as query param to identify which course to remove
    return this.http.delete(`${this.base}/?course_id=${courseId}`).pipe(
      tap(() => this.refreshCount()),
      catchError(err => { throw err; })
    );
  }

  // manual refresh of the count (calls getCart internally)
  refreshCount() {
    this.http.get<CartItem[]>(`${this.base}/`).subscribe({
      next: (res) => this._count$.next((res || []).length),
      error: () => { /* ignore */ }
    });
  }
}
