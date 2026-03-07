export interface ProductAttachmentRequest {
    file_name?: string;
    file_url: string;
    file_type?: string;
}

export interface ProductAttachmentResponse {
    attachment_id: number;
    product_id: number;
    file_name?: string;
    file_url: string;
    file_type?: string;
    uploaded_on: string;
}

export interface Product {
    product_id?: number;
    product_name: string;
    product_description: string;
    product_content: string;
    product_price: number;
    product_discount_price: number;
    product_image?: string;
    is_active: boolean;
    created_by?: string;
    created_on?: string;
    updated_on?: string;
    attachments?: ProductAttachmentResponse[];
}
