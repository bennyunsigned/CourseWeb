import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { BundleMasterService } from '../../../services/bundle-master.service';
import { PaymentService } from '../../../services/payment.service';
import { ToastrService } from 'ngx-toastr';
import { environment } from '../../../../environments/environment';
import { Bundle } from '../../../models/bundleModel';

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
        private bundleService: BundleMasterService,
        private paymentService: PaymentService,
        private toastr: ToastrService
    ) { }

    ngOnInit(): void {
        this.startTimer();
        this.route.paramMap.subscribe(params => {
            const id = params.get('bundleId');
            if (id) {
                this.bundleId = id;
                this.loadBundle();
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
        let totalSeconds = 4 * 60 * 60;
        const saved = sessionStorage.getItem('bundle_sale_timer');
        if (saved) {
            const diff = Math.floor((Date.now() - Number(saved)) / 1000);
            if (diff < totalSeconds) totalSeconds -= diff;
        } else {
            sessionStorage.setItem('bundle_sale_timer', String(Date.now()));
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
}
