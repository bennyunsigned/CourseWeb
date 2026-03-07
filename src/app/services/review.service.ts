import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { catchError, tap } from 'rxjs/operators';
import { environment } from '../../environments/environment';

export interface Review {
    reviewId?: number;
    userId?: number;
    userName?: string;
    userEmail?: string;
    userPhone?: string;
    userImage?: string;
    courseId?: number;
    bundleId?: number;
    productId?: number;
    rating: number;
    reviewText?: string;
    createdAt?: string;
    status?: string;
}

@Injectable({
    providedIn: 'root'
})
export class ReviewService {
    private apiUrl = `${environment.apiUrl}/api/reviews`;

    constructor(private http: HttpClient) { }

    addReview(review: Review): Observable<any> {
        // Reverting to strict documented payload to avoid 500 errors from extra keys
        const payload = {
            userId: review.userId || 0,
            courseId: review.courseId || 0,
            bundleId: review.bundleId || 0,
            productId: review.productId || 0,
            rating: review.rating,
            reviewText: review.reviewText || ''
        };

        // Restoring trailing slash as the logs show the server expects/redirects to it
        const url = this.apiUrl.endsWith('/') ? this.apiUrl : `${this.apiUrl}/`;

        console.log('[ReviewService] Sending POST to:', url, 'Payload:', payload);

        return this.http.post(url, payload).pipe(
            tap(res => console.log('[ReviewService] Success Response:', res)),
            catchError(err => {
                console.error('[ReviewService] Server Error Detail:', err);
                return throwError(() => err);
            })
        );
    }

    getTop30Reviews(filter: { courseId?: number; bundleId?: number; productId?: number } = {}): Observable<Review[]> {
        let params: any = {};
        if (filter.courseId) params.courseId = filter.courseId;
        if (filter.bundleId) params.bundleId = filter.bundleId;
        if (filter.productId) params.productId = filter.productId;

        return this.http.get<Review[]>(`${this.apiUrl}/top-30`, { params });
    }
}
