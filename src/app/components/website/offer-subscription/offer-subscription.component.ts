import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { PaymentService } from '../../../services/payment.service';
import { CourseProgressService } from '../../../services/course-progress.service';
// import { AllCourseContent } from '../../../models/allPublicCourseContentModel'; // Removed
import { decryptData } from '../../../utils/crypto-util';
import { ToastrService } from 'ngx-toastr';
import { environment } from '../../../../environments/environment';
import { AvailableCoursesComponent } from '../../admin-panel/courses/available-courses/available-courses.component';

@Component({
    selector: 'app-offer-subscription',
    standalone: true,
    imports: [CommonModule, RouterModule, AvailableCoursesComponent],
    templateUrl: './offer-subscription.component.html',
    styleUrls: ['./offer-subscription.component.css']
})
export class OfferSubscriptionComponent implements OnInit, OnDestroy {
    subscriptionId!: string;
    subscription: any = null;
    loading = true;
    error: string | null = null;

    // New features
    // topCourses: AllCourseContent[] = []; // Removed
    timeLeft: any = { hours: 0, minutes: 0, seconds: 0 };
    private timerInterval: any;

    // Pagination specific logic removed as we use AvailableCoursesComponent


    testimonials = [
        { name: 'Rahul Sharma', text: 'Vidyaroop transformed my career. The lifetime plan is a steal!', img: '/img/photos/p1.jpg' },
        { name: 'Anjali Verma', text: 'Best platform for structured learning. Highly recommended.', img: '/img/photos/p4.jpg' },
        { name: 'Amit Kumar', text: 'Affordable and high quality. The mentors are top notch.', img: '/img/photos/p2.jpg' }
    ];

    aboutStats = [
        { value: '10k+', label: 'Happy Students', icon: 'bi-people-fill' },
        { value: '50+', label: 'Expert Mentors', icon: 'bi-person-badge-fill' },
        { value: '100+', label: 'Premium Courses', icon: 'bi-journal-bookmark-fill' },
        { value: '4.8/5', label: 'Average Rating', icon: 'bi-star-fill' }
    ];

    // Hardcoded plans matching CourseSubscriptionComponent
    availableSubscriptions = [
        {
            SubscriptionId: 'S06',
            SubscriptionName: '6 Months Plan',
            SubscriptionPrice: 599,
            OriginalPrice: 1999,
            Duration: '6 Months',
            Description: 'Perfect for semester preparation.',
            Features: ['Access to all courses', '6 Months Validity', 'Email Support', 'Certificate Included']
        },
        {
            SubscriptionId: 'S12',
            SubscriptionName: '1 Year Plan',
            SubscriptionPrice: 999,
            OriginalPrice: 3999,
            Duration: '1 Year',
            Description: 'Best value for year-long learning.',
            Features: ['Access to all courses', '1 Year Validity', 'Priority Support', 'Offline Downloads', 'Certificates']
        },
        {
            SubscriptionId: 'LFT',
            SubscriptionName: 'Lifetime Access',
            SubscriptionPrice: 4999,
            OriginalPrice: 14999,
            Duration: 'Lifetime',
            Description: 'One-time payment for career-long access.',
            Features: ['Unlimited Course Access', 'Lifetime Updates', 'VIP Support', 'Mentor Access', 'All Future Courses']
        }
    ];

    constructor(
        private route: ActivatedRoute,
        private router: Router,
        private paymentService: PaymentService,
        private courseService: CourseProgressService,
        private toastr: ToastrService
    ) { }

    ngOnInit(): void {
        this.startTimer();
        // this.fetchAllCourses(); // Removed


        // Subscribe to params to handle route changes
        this.route.paramMap.subscribe(params => {
            const idParam = params.get('subId');
            if (idParam) {
                this.subscriptionId = idParam;
                this.loadSubscription();
            } else {
                this.error = 'Invalid Subscription Link';
                this.loading = false;
            }
        });
    }

    ngOnDestroy(): void {
        if (this.timerInterval) clearInterval(this.timerInterval);
    }

    startTimer() {
        // 4 hour countdown loop
        let totalSeconds = 4 * 60 * 60;

        // Try to recover state from session storage to keep timer consistent on refresh
        const saved = sessionStorage.getItem('offer_timer');
        if (saved) {
            const diff = Math.floor((Date.now() - Number(saved)) / 1000);
            if (diff < totalSeconds) totalSeconds -= diff;
        } else {
            sessionStorage.setItem('offer_timer', String(Date.now()));
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

    loadSubscription() {
        // Simulate API fetch delay for smoother UX
        setTimeout(() => {
            // Case-insensitive match just in case
            this.subscription = this.availableSubscriptions.find(s => s.SubscriptionId.toLowerCase() === this.subscriptionId.toLowerCase());

            if (!this.subscription) {
                this.error = 'Subscription plan not found or expired.';
            }
            this.loading = false;
        }, 300);
    }

    get discountPercentage(): number {
        if (!this.subscription?.OriginalPrice || !this.subscription?.SubscriptionPrice) return 0;
        return Math.round(((this.subscription.OriginalPrice - this.subscription.SubscriptionPrice) / this.subscription.OriginalPrice) * 100);
    }


    buyNow() {
        const encUserId = localStorage.getItem('user_id') || '';
        const userIdStr = decryptData(encUserId);
        const userId = Number(userIdStr) || null;

        if (!userId) {
            const intent = {
                type: 'subscription',
                subscriptionId: String(this.subscription.SubscriptionId),
                subscriptionName: this.subscription.SubscriptionName,
                amount: this.subscription.SubscriptionPrice,
                // store other necessary details if needed
            };
            localStorage.setItem('pending_subscription_intent', JSON.stringify(intent));
            this.router.navigate(['/login'], { queryParams: { returnUrl: this.router.url } });
            return;
        }

        if (!this.subscription) return;

        const amount = this.subscription.SubscriptionPrice;
        const redirectWithParams = `${window.location.origin}/course/payment-success`;

        const payload: any = {
            amount,
            purpose: `Subscription: ${this.subscription.SubscriptionName}`,
            buyer_name: '',
            email: '',
            phone: '',
            redirect_url: redirectWithParams,
            payment_type: 'subscription',
            user_id: userId,
            subscription_type: String(this.subscription.SubscriptionId),
        };

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
                        const pending = { user_id: userId, subscription_id: String(this.subscriptionId), amount, payment_request_id: res?.payment_request?.id || res?.id || null };
                        localStorage.setItem('pending_payment', JSON.stringify(pending));
                    } catch (e) { }
                    window.location.href = redirect;
                } else {
                    this.toastr.error('Could not initiate payment');
                }
            },
            error: (err) => {
                console.error('Payment initiation failed:', err);
                const msg = err?.error?.message || err?.message || 'Unknown error';
                this.toastr.error(`Payment failed: ${msg}`, 'Error');
            }
        });
    }
}
