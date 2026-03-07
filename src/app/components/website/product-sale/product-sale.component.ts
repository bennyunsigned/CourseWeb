import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { ProductMasterService } from '../../../services/product-master.service';
import { PaymentService } from '../../../services/payment.service';
import { ToastrService } from 'ngx-toastr';
import { environment } from '../../../../environments/environment';
import { Product } from '../../../models/productModel';

@Component({
    selector: 'app-product-sale',
    standalone: true,
    imports: [CommonModule, RouterModule, FormsModule],
    templateUrl: './product-sale.component.html',
    styleUrls: ['./product-sale.component.css']
})
export class ProductSaleComponent implements OnInit, OnDestroy {
    productId!: string;
    product: Product | null = null;
    loading = true;
    error: string | null = null;
    mediaUrl = environment.apiUrl;

    getFullImageUrl(imagePath: string | undefined): string {
        if (!imagePath) return '';
        const cleanPath = imagePath.startsWith('/') ? imagePath.substring(1) : imagePath;
        return `${this.mediaUrl}/${cleanPath}`;
    }

    showGuestModal = false;
    guestInfo = {
        name: '',
        email: '',
        phone: ''
    };

    timeLeft: any = { hours: 0, minutes: 0, seconds: 0 };
    private timerInterval: any;

    constructor(
        private route: ActivatedRoute,
        private router: Router,
        private productService: ProductMasterService,
        private paymentService: PaymentService,
        private toastr: ToastrService
    ) { }

    ngOnInit(): void {
        this.startTimer();
        this.route.paramMap.subscribe(params => {
            const id = params.get('productId');
            if (id) {
                this.productId = id;
                this.loadProduct();
            } else {
                this.error = 'Invalid Product';
                this.loading = false;
            }
        });
    }

    ngOnDestroy(): void {
        if (this.timerInterval) clearInterval(this.timerInterval);
    }

    startTimer() {
        let totalSeconds = 4 * 60 * 60;
        const saved = sessionStorage.getItem('product_sale_timer');
        if (saved) {
            const diff = Math.floor((Date.now() - Number(saved)) / 1000);
            if (diff < totalSeconds) totalSeconds -= diff;
        } else {
            sessionStorage.setItem('product_sale_timer', String(Date.now()));
        }

        this.timerInterval = setInterval(() => {
            if (totalSeconds > 0) {
                totalSeconds--;
                this.timeLeft = {
                    hours: Math.floor(totalSeconds / 3600),
                    minutes: Math.floor((totalSeconds % 3600) / 60),
                    seconds: totalSeconds % 60
                };
            }
        }, 1000);
    }

    loadProduct() {
        this.productService.getProductById(this.productId).subscribe({
            next: (data) => {
                this.product = data;
                this.loading = false;
            },
            error: (err) => {
                console.error('Error fetching product:', err);
                this.error = 'Product not found.';
                this.loading = false;
            }
        });
    }

    buyNow() {
        this.showGuestModal = true;
    }

    closeModal() {
        this.showGuestModal = false;
    }

    onPayNow() {
        if (!this.guestInfo.name || !this.guestInfo.email || !this.guestInfo.phone) {
            this.toastr.warning('Please fill all fields');
            return;
        }

        if (!this.product) return;

        const payload = {
            purpose: `Purchase: ${this.product.product_name}`,
            buyer_name: this.guestInfo.name,
            email: this.guestInfo.email,
            phone: this.guestInfo.phone,
            redirect_url: `${window.location.origin}/course/payment-success`,
            payment_type: 'product' as const,
            product_id: Number(this.productId)
        };

        this.paymentService.createPayment(payload).subscribe({
            next: (res: any) => {
                const redirect = res?.payment_request?.longurl || res?.payment_request?.payment_url || res?.longurl;
                if (redirect) {
                    window.location.href = redirect;
                } else {
                    this.toastr.error('Could not initiate payment');
                }
            },
            error: (err) => {
                console.error('Payment initiation failed:', err);
                this.toastr.error('Payment failed to initiate. Please try again.');
            }
        });
    }
}
