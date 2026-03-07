import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import { Bundle } from '../models/bundleModel';

@Injectable({
    providedIn: 'root'
})
export class BundleMasterService {

    private baseURL = `${environment.apiUrl}/api/bundle`;

    constructor(private http: HttpClient) { }

    // Create a new bundle
    createBundle(bundle: Bundle): Observable<any> {
        return this.http.post(`${this.baseURL}/`, bundle);
    }

    // Get all bundles
    getBundles(): Observable<Bundle[]> {
        return this.http.get<Bundle[]>(`${this.baseURL}/`);
    }

    // Get a bundle by ID
    getBundleById(bundleId: string): Observable<Bundle> {
        return this.http.get<Bundle>(`${this.baseURL}/${bundleId}`);
    }

    // Update a bundle by ID
    updateBundle(bundleId: string, bundle: Bundle): Observable<any> {
        return this.http.put(`${this.baseURL}/${bundleId}`, bundle);
    }

    // Delete a bundle by ID
    deleteBundle(bundleId: string): Observable<any> {
        return this.http.delete(`${this.baseURL}/${bundleId}`);
    }
}
