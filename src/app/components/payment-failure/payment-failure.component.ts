import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterModule } from '@angular/router';

@Component({
    selector: 'app-payment-failure',
    standalone: true,
    imports: [CommonModule, RouterModule],
    templateUrl: './payment-failure.component.html',
    styleUrls: ['./payment-failure.component.css']
})
export class PaymentFailureComponent {
    constructor(private router: Router) { }

    retry() {
        window.history.back();
    }

    goHome() {
        this.router.navigate(['/']);
    }
}
