import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';

@Component({
  selector: 'app-tickets',
  template: '',
})
export class TicketsComponent implements OnInit {
  constructor(private router: Router) {}
  ngOnInit(): void {
    // Redirect to the new user tickets route for backward compatibility
    this.router.navigate(['/helpdesk/user-tickets']);
  }
}
