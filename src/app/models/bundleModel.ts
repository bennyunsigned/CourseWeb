import { Product } from './productModel';

export interface Bundle {
    bundle_id?: number;
    bundle_name: string;
    bundle_description: string;
    bundle_price: number;
    bundle_discount_price: number;
    is_active: boolean;
    product_ids?: number[];
    created_on?: string;
    updated_on?: string;
    products?: Product[];
}
