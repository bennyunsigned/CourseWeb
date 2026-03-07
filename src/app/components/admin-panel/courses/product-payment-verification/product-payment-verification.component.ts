import { Component, OnInit } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { ActivatedRoute, Router } from '@angular/router';
import { environment } from '../../../../../environments/environment';
import { PaymentService } from '../../../../services/payment.service';
import { CommonModule } from '@angular/common';

@Component({
    selector: 'app-product-payment-verification',
    templateUrl: './product-payment-verification.component.html',
    styleUrl: './product-payment-verification.component.css',
    standalone: true,
    imports: [CommonModule]
})
export class ProductPaymentVerificationComponent implements OnInit {
    paymentRequestId: string | null = null;
    status: string = 'pending';
    message: string = '';

    constructor(private route: ActivatedRoute, private http: HttpClient, private router: Router, private paymentService: PaymentService) { }

    ngOnInit(): void {
        this.paymentRequestId = this.route.snapshot.queryParamMap.get('payment_request_id') || this.route.snapshot.queryParamMap.get('payment_request');
        if (!this.paymentRequestId) {
            this.message = 'No payment identifier found in the URL.';
            this.status = 'error';
            return;
        }

        this.checkPaymentStatus(this.paymentRequestId!);
    }

    checkPaymentStatus(paymentRequestId: string) {
        this.paymentService.getPaymentStatus(paymentRequestId).subscribe({
            next: (res: any) => {
                const pr = res?.payment_request || res;
                const statusRaw = pr?.status || pr?.payment_status || pr?.status_code || pr?.success;
                const statusStr = (typeof statusRaw === 'string' ? statusRaw : String(statusRaw)).toLowerCase();
                const isSuccess = [
                    'success', 'completed', 'credit', 'true', 'paid', 'approved'
                ].some(s => statusStr.includes(s));

                if (isSuccess) {
                    this.status = 'success';
                    this.message = 'Payment successful! Thank you for your purchase.';
                    // Add confirm logic if server needs recording specifically for products
                } else {
                    this.status = 'failed';
                    this.message = `Payment status: ${statusStr}. Payment not successful yet.`;
                }
            },
            error: (err) => {
                console.error('Failed to fetch payment status', err);
                this.status = 'error';
                this.message = 'Failed to fetch payment status.';
            }
        });
    }

    backToProducts() {
        this.router.navigate(['/course/product-subscription']);
    }
}
