import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { PaymentService } from '../../../../services/payment.service';
import { BundleMasterService } from '../../../../services/bundle-master.service';
import { ToastrService } from 'ngx-toastr';
import { decryptData } from '../../../../utils/crypto-util';
import { FormsModule } from '@angular/forms';
import { environment } from '../../../../../environments/environment';

@Component({
    selector: 'app-bundle-subscription',
    standalone: true,
    imports: [CommonModule, FormsModule],
    templateUrl: './bundle-subscription.component.html',
    styleUrls: ['./bundle-subscription.component.css']
})
export class BundleSubscriptionComponent implements OnInit {
    bundles: any[] = [];
    showModal = false;
    guestDetails = { email: '', phone: '' };
    selectedBundle: any = null;
    mediaUrl = environment.apiUrl;

    // Pagination & Description Modal
    currentPage: number = 1;
    itemsPerPage: number = 6;
    showDescriptionModal: boolean = false;
    selectedBundleForDescription: any = null;

    constructor(
        private bundleService: BundleMasterService,
        private paymentService: PaymentService,
        private router: Router,
        private toastr: ToastrService
    ) { }

    ngOnInit(): void {
        this.loadBundles();
    }

    resolveImagePath(path: string | null | undefined): string {
        if (!path) return 'img/photos/carausel3.png';
        if (path.startsWith('http') || path.startsWith('data:')) return path;
        return `${this.mediaUrl}/${path.replace(/^\//, '')}`;
    }

    loadBundles(): void {
        this.bundleService.getBundles().subscribe({
            next: (data: any[]) => {
                this.bundles = data.filter((b: any) => b.is_active);
            },
            error: (err: any) => {
                console.error('Failed to load bundles', err);
                this.toastr.error('Failed to load bundles. Please try again later.');
            }
        });
    }

    get paginatedBundles(): any[] {
        const startIndex = (this.currentPage - 1) * this.itemsPerPage;
        return this.bundles.slice(startIndex, startIndex + this.itemsPerPage);
    }

    get totalPages(): number {
        return Math.ceil(this.bundles.length / this.itemsPerPage);
    }

    onPageChange(page: number): void {
        this.currentPage = page;
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }

    openDescriptionModal(bundle: any): void {
        this.selectedBundleForDescription = bundle;
        this.showDescriptionModal = true;
    }

    closeDescriptionModal(): void {
        this.showDescriptionModal = false;
        this.selectedBundleForDescription = null;
    }

    onBuyClick(bundle: any): void {
        this.selectedBundle = bundle;
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
        const b = this.selectedBundle;
        const amount = b.bundle_discount_price || b.bundle_price;
        const redirectWithParams = `${window.location.origin}/course/bundle-payment-verification`;

        const payload: any = {
            amount,
            purpose: `Bundle: ${b.bundle_name}`,
            buyer_name: 'Guest',
            email: this.guestDetails.email,
            phone: this.guestDetails.phone,
            redirect_url: redirectWithParams,
            payment_type: 'bundle_subscription',
            user_id: userId,
            subscription_type: String(b.bundle_id)
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
