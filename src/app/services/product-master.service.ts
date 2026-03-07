import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import { Product, ProductAttachmentRequest, ProductAttachmentResponse } from '../models/productModel';

@Injectable({
    providedIn: 'root'
})
export class ProductMasterService {

    private baseURL = `${environment.apiUrl}/api/product`;

    constructor(private http: HttpClient) { }

    // Create a new product
    createProduct(product: Product): Observable<any> {
        return this.http.post(`${this.baseURL}`, product);
    }

    // Get all products
    getProducts(): Observable<Product[]> {
        return this.http.get<Product[]>(`${this.baseURL}`);
    }

    // Get a product by ID
    getProductById(productId: string): Observable<Product> {
        console.log('Fetching product with ID:', productId);
        return this.http.get<Product>(`${this.baseURL}/${productId}`);
    }

    // Update a product by ID
    updateProduct(productId: string, product: Product): Observable<any> {
        return this.http.put(`${this.baseURL}/${productId}`, product);
    }

    // Delete a product by ID
    deleteProduct(productId: string): Observable<any> {
        console.log('Deleting product with ID:', productId);
        return this.http.delete(`${this.baseURL}/${productId}`);
    }
    // Save/Update attachments for a specific product
    saveProductAttachments(productId: number, attachments: ProductAttachmentRequest[]): Observable<any> {
        return this.http.post(`${this.baseURL}/${productId}/attachments`, attachments);
    }

    // Delete a specific attachment
    deleteProductAttachment(productId: number, attachmentId: number): Observable<any> {
        return this.http.delete(`${this.baseURL}/${productId}/attachments/${attachmentId}`);
    }

    // Get attachments by product ID
    getAttachmentsByProductId(productId: number): Observable<ProductAttachmentResponse[]> {
        return this.http.get<ProductAttachmentResponse[]>(`${this.baseURL}/${productId}/attachments`);
    }
}
