import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { BundleMasterService } from '../../../services/bundle-master.service';
import { PaymentService } from '../../../services/payment.service';
import { ReviewService, Review } from '../../../services/review.service';
import { ToastrService } from 'ngx-toastr';
import { environment } from '../../../../environments/environment';
import { Bundle } from '../../../models/bundleModel';
import { decryptData } from '../../../utils/crypto-util';

@Component({
    selector: 'app-bundle-sale',
    standalone: true,
    imports: [CommonModule, RouterModule, FormsModule],
    templateUrl: './bundle-sale.component.html',
    styleUrls: ['./bundle-sale.component.css']
})
export class BundleSaleComponent implements OnInit, OnDestroy {
    bundleId!: string;
    bundle: Bundle | null = null;
    loading = true;
    error: string | null = null;
    mediaUrl = environment.apiUrl;
    reviews: Review[] = [];
    newReview: Review = { rating: 5, reviewText: '' };
    submittingReview = false;

    isLoggedIn(): boolean {
        try {
            return !!localStorage.getItem('access_token');
        } catch (e) {
            console.warn('localStorage access denied', e);
            return false;
        }
    }

    getUserId(): number {
        try {
            const encryptedId = localStorage.getItem('user_id');
            if (!encryptedId) return 0;
            const decryptedId = decryptData(encryptedId);
            return Number(decryptedId) || 0;
        } catch (e) {
            console.warn('localStorage access denied', e);
            return 0;
        }
    }

    getFullImageUrl(imagePath: string | undefined): string {
        if (!imagePath) return '';
        if (imagePath.startsWith('http')) return imagePath;
        const cleanPath = imagePath.startsWith('/') ? imagePath.substring(1) : imagePath;
        return `${this.mediaUrl}/${cleanPath}`;
    }

    resolveReviewAvatar(review: Review): string {
        if (review.userImage) {
            return this.getFullImageUrl(review.userImage);
        }
        return 'img/avatars/avatar.jpg';
    }

    showGuestModal = false;
    guestInfo = {
        name: '',
        email: '',
        phone: ''
    };

    showProductModal = false;
    selectedProduct: any = null;

    openProductModal(product: any) {
        this.selectedProduct = product;
        this.showProductModal = true;
    }

    closeProductModal() {
        this.showProductModal = false;
        this.selectedProduct = null;
    }

    timeLeft: any = { hours: 0, minutes: 0, seconds: 0 };
    private timerInterval: any;

    constructor(
        private route: ActivatedRoute,
        private router: Router,
        private bundleService: BundleMasterService,
        private paymentService: PaymentService,
        private reviewService: ReviewService,
        private toastr: ToastrService
    ) { }

    ngOnInit(): void {
        this.startTimer();
        this.route.paramMap.subscribe(params => {
            let id = params.get('bundleId');
            if (id) {
                try {
                    const decoded = decodeURIComponent(id);
                    const decrypted = decryptData(decoded);
                    if (decrypted && !isNaN(Number(decrypted))) {
                        id = decrypted;
                    }
                } catch (e) {
                    console.warn('Could not decrypt bundleId', e);
                }
                this.bundleId = id;
                this.loadBundle();
                this.loadReviews();
            } else {
                this.error = 'Invalid Bundle';
                this.loading = false;
            }
        });
    }

    ngOnDestroy(): void {
        if (this.timerInterval) clearInterval(this.timerInterval);
    }

    startTimer() {
        let totalSeconds = 1 * 60 * 60;
        try {
            const saved = sessionStorage.getItem('bundle_sale_timer');
            if (saved) {
                const diff = Math.floor((Date.now() - Number(saved)) / 1000);
                if (diff < totalSeconds) totalSeconds -= diff;
            } else {
                sessionStorage.setItem('bundle_sale_timer', String(Date.now()));
            }
        } catch (e) {
            console.warn('sessionStorage access denied', e);
            // Ignore error and just start a fresh 4-hour timer
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

    loadBundle() {
        this.bundleService.getBundleById(this.bundleId).subscribe({
            next: (data) => {
                this.bundle = data;
                this.loading = false;
            },
            error: (err) => {
                console.error('Error fetching bundle:', err);
                this.error = 'Bundle not found.';
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

        if (!this.bundle) return;

        const payload = {
            purpose: `Purchase: ${this.bundle.bundle_name}`,
            buyer_name: this.guestInfo.name,
            email: this.guestInfo.email,
            phone: this.guestInfo.phone,
            redirect_url: `${window.location.origin}/course/payment-success`,
            payment_type: 'bundle' as const,
            bundle_id: Number(this.bundleId)
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

    loadReviews() {
        this.reviewService.getTop30Reviews({ bundleId: Number(this.bundleId) }).subscribe({
            next: (data) => {
                this.reviews = data;
            },
            error: (err) => console.error('Error loading reviews:', err)
        });
    }

    submitReview() {
        if (!this.isLoggedIn()) {
            this.toastr.info('Please login to share your feedback', 'Login Required');
            this.router.navigate(['/login']);
            return;
        }
        if (this.newReview.rating < 1 || this.newReview.rating > 5) {
            this.toastr.warning('Please provide a rating between 1 and 5');
            return;
        }
        this.submittingReview = true;
        this.newReview.userId = this.getUserId();
        this.newReview.bundleId = Number(this.bundleId) || 0;
        this.newReview.courseId = 0;
        this.newReview.productId = 0;

        console.log('[BundleSale] Submitting review payload:', this.newReview);
        this.reviewService.addReview(this.newReview).subscribe({
            next: (res) => {
                this.toastr.success('Review added successfully');
                this.newReview = { rating: 5, reviewText: '' };
                this.loadReviews();
                this.submittingReview = false;
            },
            error: (err) => {
                console.error('Full error adding review:', err);
                const detail = err.error?.detail || err.error?.message || 'Make sure you are logged in.';
                this.toastr.error(`Failed to add review: ${detail}`);
                this.submittingReview = false;
            }
        });
    }
}
