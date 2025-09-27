import { Routes } from '@angular/router';
import { AdminBaseComponent } from './components/admin-panel/admin-layout/admin-base/admin-base.component';
import { LoginComponent } from './components/auth/login/login.component';
import { SignupComponent } from './components/auth/signup/signup.component';
import { WebsiteBaseComponent } from './components/website/website-base/website-base.component';
import { DashboardComponent } from './components/admin-panel/dashboard/dashboard.component';
import { CourseMasterComponent } from './components/admin-panel/courses/course-master/course-master.component';
import { AuthGuard } from './authGuard/auth.guard';
import { CourseModuleComponent } from './components/admin-panel/courses/course-module/course-module.component';
import { CategoryMasterComponent } from './components/admin-panel/courses/category-master/category-master.component';
import { YoutubePlayerComponent } from './components/admin-panel/courses/youtube-player/youtube-player.component';
import { DailymotionPlayerComponent } from './components/admin-panel/courses/dailymotion-player/dailymotion-player.component';
import { TicketsComponent } from './components/admin-panel/helpdesk/tickets/tickets.component';
import { FaqComponent } from './components/admin-panel/helpdesk/faq/faq.component';
import { ErrorReportComponent } from './components/admin-panel/reports/error-report/error-report.component';
import { LoginReportComponent } from './components/admin-panel/reports/login-report/login-report.component';
import { SalesReportComponent } from './components/admin-panel/reports/sales-report/sales-report.component';
import { UserReportComponent } from './components/admin-panel/reports/user-report/user-report.component';
import { CourseProgressComponent } from './components/admin-panel/courses/course-progress/course-progress.component';
import { CourseContentDetailsComponent } from './components/admin-panel/courses/course-content-details/course-content-details.component';
import { AvailableCoursesComponent } from './components/admin-panel/courses/available-courses/available-courses.component';
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
            { path: 'course-content/:courseId', component: CourseContentDetailsComponent },
            { path: 'available-course', component: AvailableCoursesComponent},
            { path: 'payment-success', component: PaymentSuccessComponent },
            
            
        
        ]
    },
    {
        path: 'helpdesk', 
        component: AdminBaseComponent,
        children: [
            { path: 'tickets', component: TicketsComponent, canActivate: [AuthGuard] },
            { path: 'faq', component: FaqComponent, canActivate: [AuthGuard] },            
            
        ]
    },
    {
        path: 'reports', 
        component: AdminBaseComponent,
        children: [
            { path: 'error-report', component: ErrorReportComponent, canActivate: [AuthGuard] },
            { path: 'login-report', component: LoginReportComponent, canActivate: [AuthGuard] },    
            { path: 'sales-report', component: SalesReportComponent, canActivate: [AuthGuard] },
            { path: 'user-report', component: UserReportComponent, canActivate: [AuthGuard] },        
            
        ]
    }
];
