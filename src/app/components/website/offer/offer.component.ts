import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { CourseProgressService } from '../../../services/course-progress.service';
import { PaymentService } from '../../../services/payment.service';
import { decryptData } from '../../../utils/crypto-util';
import { ToastrService } from 'ngx-toastr';
import { PublicCourseContent } from '../../../models/publicCourseContentModel';
import { environment } from '../../../../environments/environment';

import { RouterModule } from '@angular/router';

@Component({
    selector: 'app-offer',
    standalone: true,
    imports: [CommonModule, RouterModule],
    templateUrl: './offer.component.html',
    styleUrls: ['./offer.component.css']
})
export class OfferComponent implements OnInit {
    courseId!: number;
    course: PublicCourseContent | null = null;
    loading = true;
    error: string | null = null;

    constructor(
        private route: ActivatedRoute,
        private router: Router,
        private courseProgressService: CourseProgressService,
        private paymentService: PaymentService,
        private toastr: ToastrService
    ) { }

    ngOnInit(): void {
        this.route.paramMap.subscribe(params => {
            const idParam = params.get('courseId');
            console.log('[OfferComponent] Route param courseId:', idParam);

            if (idParam && !isNaN(Number(idParam))) {
                this.courseId = Number(idParam);
                this.loadCourse();
            } else {
                console.error('[OfferComponent] Invalid course ID');
                this.error = 'Invalid Offer Link';
                this.loading = false;
            }
        });
    }

    loadCourse() {
        console.log('[OfferComponent] Fetching content for course ID:', this.courseId);
        this.courseProgressService.getPublicCourseContent(this.courseId).subscribe({
            next: (data) => {
                console.log('[OfferComponent] Fetched course data:', data);
                this.course = data;
                this.loading = false;
            },
            error: (err) => {
                console.error('[OfferComponent] API Error:', err);
                this.error = 'Offer expired or not found.';
                this.loading = false;
            }
        });
    }

    get discountPercentage(): number {
        if (!this.course?.ActualPrice || !this.course?.DiscountedPrice) return 0;
        if (this.course.DiscountedPrice >= this.course.ActualPrice) return 0;
        return Math.round(((this.course.ActualPrice - this.course.DiscountedPrice) / this.course.ActualPrice) * 100);
    }

    buyNow() {
        const encUserId = localStorage.getItem('user_id') || '';
        const userIdStr = decryptData(encUserId);
        const userId = Number(userIdStr) || null;

        if (!userId) {
            this.router.navigate(['/login'], { queryParams: { returnUrl: this.router.url } });
            return;
        }

        if (!this.course) return;

        const amount = this.course.DiscountedPrice > 0 ? this.course.DiscountedPrice : this.course.ActualPrice;
        const redirectWithParams = `${window.location.origin}/course/payment-success`;

        const payload: any = {
            amount,
            purpose: `Purchase Offer: ${this.course.CourseName}`,
            buyer_name: '',
            email: '',
            phone: '',
            redirect_url: redirectWithParams,
            payment_type: 'individual',
            user_id: userId,
            course_id: String(this.courseId),
        };

        // Prefill user details
        try {
            const rawName = localStorage.getItem('user_name') || '';
            const rawEmail = localStorage.getItem('user_email') || '';
            const rawPhone = localStorage.getItem('user_phone') || '';
            const name = decryptData(rawName) || rawName;
            const email = decryptData(rawEmail) || rawEmail;
            const phone = decryptData(rawPhone) || rawPhone;

            if (name) payload.buyer_name = name;
            if (email) payload.email = email;
            if (phone) payload.phone = phone;
        } catch (e) { }

        this.paymentService.createPayment(payload).subscribe({
            next: (res: any) => {
                const redirect = res?.payment_request?.longurl || res?.payment_request?.payment_url || res?.longurl;
                if (redirect) {
                    try {
                        const pending = { user_id: userId, course_id: String(this.courseId), amount, payment_request_id: res?.payment_request?.id || res?.id || null };
                        localStorage.setItem('pending_payment', JSON.stringify(pending));
                    } catch (e) { }
                    window.location.href = redirect;
                } else {
                    this.toastr.error('Could not initiate payment');
                }
            },
            error: () => this.toastr.error('Payment initiation failed')
        });
    }
}
