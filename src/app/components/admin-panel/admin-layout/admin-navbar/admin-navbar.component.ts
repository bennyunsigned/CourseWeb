import { Component } from '@angular/core';
import { Router } from '@angular/router';
import { encryptData,decryptData } from '../../../../utils/crypto-util';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-admin-navbar',
  templateUrl: './admin-navbar.component.html',
  styleUrls: ['./admin-navbar.component.css'],
  imports:[CommonModule]
})
export class AdminNavbarComponent {
  constructor(private router: Router) {}

  userName: string = decryptData(localStorage.getItem('user_name') ?? '');
  

  logout(): void {
    // Clear all relevant keys from local storage   
    localStorage.removeItem('user_role');
    localStorage.removeItem('user_name');
    localStorage.removeItem('user_id');
    localStorage.removeItem('user_email');
    localStorage.removeItem('dark-mode');
    localStorage.removeItem('access_token');

    // Redirect to the login page using window.location.href
    window.location.href = '/login'; // Replace '/login' with your actual login route
  }

  sidebarToggle(): void {
    const sidebar = document.getElementById('sidebar');
    sidebar?.classList.toggle('collapsed');

    
  }

  showNotifications = false;
  showUserMenu = false;

  notifications = [
    { icon: 'bi bi-exclamation-circle text-danger', title: 'Update completed', message: 'Restart server 12 to complete the update.', time: '30m ago' },
    { icon: 'bi bi-bell text-warning', title: 'Lorem ipsum', message: 'Aliquam ex eros, imperdiet vulputate hendrerit et.', time: '2h ago' },
    { icon: 'bi bi-house text-primary', title: 'Login from 192.186.1.8', message: '', time: '5h ago' },
    { icon: 'bi bi-person-plus text-success', title: 'New connection', message: 'Christina accepted your request.', time: '14h ago' }
  ];
}
