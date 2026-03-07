import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { PaymentService } from '../../../../services/payment.service';
import { ProductMasterService } from '../../../../services/product-master.service';
import { ToastrService } from 'ngx-toastr';
import { decryptData } from '../../../../utils/crypto-util';
import { FormsModule } from '@angular/forms';

@Component({
    selector: 'app-product-subscription',
    standalone: true,
    imports: [CommonModule, FormsModule],
    templateUrl: './product-subscription.component.html',
    styleUrls: ['./product-subscription.component.css']
})
export class ProductSubscriptionComponent implements OnInit {
    products: any[] = [];
    showModal = false;
    guestDetails = {
        email: '',
        phone: ''
    };
    selectedProduct: any = null;

    constructor(
        private productService: ProductMasterService,
        private paymentService: PaymentService,
        private router: Router,
        private toastr: ToastrService
    ) { }

    ngOnInit(): void {
        this.loadProducts();
    }

    loadProducts(): void {
        this.productService.getProducts().subscribe({
            next: (data) => {
                this.products = data.filter(p => p.is_active);
            },
            error: (err) => {
                console.error('Failed to load products', err);
                this.toastr.error('Failed to load products. Please try again later.');
            }
        });
    }

    formatPrice(amount: number) { return `₹${amount}/-`; }

    onBuyClick(product: any): void {
        this.selectedProduct = product;
        const encUserId = localStorage.getItem('user_id') || '';
        const userIdStr = decryptData(encUserId);
        const userId = Number(userIdStr) || 0;

        if (userId === 0) {
            this.showModal = true;
        } else {
            this.processPayment(userId);
        }
    }

    closeModal(): void {
        this.showModal = false;
        this.guestDetails = { email: '', phone: '' };
    }

    submitGuestDetails(): void {
        if (!this.guestDetails.email || !this.guestDetails.phone) {
            this.toastr.warning('Please provide both email and phone number.');
            return;
        }
        this.processPayment(0);
    }

    processPayment(userId: number): void {
        const p = this.selectedProduct;
        const amount = p.product_discount_price || p.product_price;
        const redirectWithParams = `${window.location.origin}/course/product-payment-verification`;

        const payload: any = {
            amount,
            purpose: `Product: ${p.product_name}`,
            buyer_name: 'Guest',
            email: this.guestDetails.email,
            phone: this.guestDetails.phone,
            redirect_url: redirectWithParams,
            payment_type: 'subscription',
            user_id: userId,
            subscription_type: String(p.product_id)
        };

        if (userId !== 0) {
            try {
                const rawName = localStorage.getItem('user_name') || '';
                const rawEmail = localStorage.getItem('user_email') || '';
                const rawPhone = localStorage.getItem('user_phone') || '';
                payload.buyer_name = decryptData(rawName) || rawName || 'User';
                payload.email = decryptData(rawEmail) || rawEmail || '';
                payload.phone = decryptData(rawPhone) || rawPhone || '';
            } catch (e) { console.warn('Failed to read buyer details', e); }
        }

        this.paymentService.createPayment(payload).subscribe({
            next: (res: any) => {
                const redirect = res?.payment_request?.longurl || res?.payment_request?.payment_url || res?.longurl;
                if (redirect) {
                    if (this.showModal) this.closeModal();
                    window.location.href = redirect;
                } else {
                    this.toastr.error('Unable to start payment.', 'Payment error');
                }
            },
            error: (err: any) => {
                console.error('Payment create error', err);
                this.toastr.error('Payment failed. Please try again.');
            }
        });
    }
}
