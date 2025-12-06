import { Routes } from '@angular/router';
import { AdminBaseComponent } from './components/admin-panel/admin-layout/admin-base/admin-base.component';
import { LoginComponent } from './components/auth/login/login.component';
import { SignupComponent } from './components/auth/signup/signup.component';
import { WebsiteBaseComponent } from './components/website/website-base/website-base.component';
import { DashboardComponent } from './components/admin-panel/dashboard/dashboard.component';
import { CourseMasterComponent } from './components/admin-panel/courses/course-master/course-master.component';
import { AuthGuard } from './authGuard/auth.guard';
import { AdminOnlyGuard } from './authGuard/admin-only.guard';
import { CourseModuleComponent } from './components/admin-panel/courses/course-module/course-module.component';
import { CategoryMasterComponent } from './components/admin-panel/courses/category-master/category-master.component';
import { TicketsComponent } from './components/admin-panel/helpdesk/tickets/tickets.component';
import { TicketsUserComponent } from './components/admin-panel/helpdesk/user/tickets-user.component';
import { TicketsAdminComponent } from './components/admin-panel/helpdesk/admin/tickets-admin.component';
import { FaqComponent } from './components/admin-panel/helpdesk/faq/faq.component';
import { ErrorReportComponent } from './components/admin-panel/reports/error-report/error-report.component';
import { LoginReportComponent } from './components/admin-panel/reports/login-report/login-report.component';
import { SalesReportComponent } from './components/admin-panel/reports/sales-report/sales-report.component';
import { UserReportComponent } from './components/admin-panel/reports/user-report/user-report.component';
import { CourseProgressComponent } from './components/admin-panel/courses/course-progress/course-progress.component';
import { CourseContentDetailsComponent } from './components/admin-panel/courses/course-content-details/course-content-details.component';
import { AvailableCoursesComponent } from './components/admin-panel/courses/available-courses/available-courses.component';
import { CartComponent } from './components/admin-panel/cart/cart.component';
import { PaymentSuccessComponent } from './components/payment-success/payment-success.component';
import { WebsiteRefundCancellationPolicyComponent } from './components/website/website-refund-cancellation-policy/website-refund-cancellation-policy.component';
import { WebsiteTermsComponent } from './components/website/website-terms/website-terms.component';

export const routes: Routes = [
    {
        path: '',
        component: WebsiteBaseComponent,
        pathMatch: 'full',
    },
    {
        path: 'available-course',
        component: AvailableCoursesComponent
    },
    {
        path: 'offer/:courseId',
        loadComponent: () => import('./components/website/offer/offer.component').then(m => m.OfferComponent)
    },
    {
        path: 'offer-subscription/:subId',
        loadComponent: () => import('./components/website/offer-subscription/offer-subscription.component').then(m => m.OfferSubscriptionComponent)
    },

    {
        path: 'login',
        component: LoginComponent,
    },

    {
        path: 'signup',
        component: SignupComponent,
    },
    {
        path: 'RefundPolicy',
        component: WebsiteRefundCancellationPolicyComponent,
    },
    {
        path: 'TermsAndConditions',
        component: WebsiteTermsComponent,
    },
    {
        path: 'dashboard',
        component: AdminBaseComponent,
        children: [
            { path: '', redirectTo: 'home', pathMatch: 'full' },

            { path: 'home', component: DashboardComponent, canActivate: [AuthGuard] },


        ]
    },
    {
        path: 'course',
        component: AdminBaseComponent,
        children: [


            { path: 'category-master', component: CategoryMasterComponent, canActivate: [AuthGuard] },
            { path: 'course-master', component: CourseMasterComponent, canActivate: [AuthGuard] },
            { path: 'module-master', component: CourseModuleComponent, canActivate: [AuthGuard] },
            { path: 'course-progress', component: CourseProgressComponent, canActivate: [AuthGuard] },
            { path: 'course-content', component: CourseContentDetailsComponent },
            { path: 'course-content/:courseId', component: CourseContentDetailsComponent },
            { path: 'available-course', component: AvailableCoursesComponent },
            { path: 'my-courses', loadComponent: () => import('./components/admin-panel/courses/my-courses/my-courses.component').then(m => m.MyCoursesComponent) },
            { path: 'course-subscription', loadComponent: () => import('./components/admin-panel/courses/course-subscription/course-subscription.component').then(m => m.CourseSubscriptionComponent) },
            { path: 'cart', component: CartComponent, canActivate: [AuthGuard] },
            { path: 'payment-success', component: PaymentSuccessComponent },



        ]
    },
    {
        path: 'helpdesk',
        component: AdminBaseComponent,
        children: [
            // Backwards-compatible path (defaults to user tickets)
            { path: 'tickets', component: TicketsUserComponent, canActivate: [AuthGuard] },
            { path: 'user-tickets', component: TicketsUserComponent, canActivate: [AuthGuard] },
            { path: 'admin-tickets', component: TicketsAdminComponent, canActivate: [AuthGuard] },
            { path: 'faq', component: FaqComponent, canActivate: [AuthGuard] },
        ]
    },
    {
        path: 'reports',
        component: AdminBaseComponent,
        children: [
            { path: 'error-report', component: ErrorReportComponent, canActivate: [AuthGuard] },
            { path: 'login-report', component: LoginReportComponent, canActivate: [AuthGuard, AdminOnlyGuard] },
            { path: 'sales-report', component: SalesReportComponent, canActivate: [AuthGuard] },
            { path: 'user-report', component: UserReportComponent, canActivate: [AuthGuard] },
            { path: 'admin-total', loadComponent: () => import('./components/admin-panel/reports/admin-total-report/admin-total-report.component').then(m => m.AdminTotalReportComponent), canActivate: [AuthGuard, AdminOnlyGuard] },
            { path: 'my-payments', loadComponent: () => import('./components/admin-panel/reports/my-payments-report/my-payments-report.component').then(m => m.MyPaymentsReportComponent), canActivate: [AuthGuard] },

        ]
    }
    ,
    {
        path: 'account',
        component: AdminBaseComponent,
        children: [
            { path: 'change-password', loadComponent: () => import('./components/admin-panel/account/change-password/change-password.component').then(m => m.ChangePasswordComponent), canActivate: [AuthGuard] }
        ]
    }
];
