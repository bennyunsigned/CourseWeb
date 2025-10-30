import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { encryptData,decryptData } from '../../../../utils/crypto-util';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-admin-navbar',
  templateUrl: './admin-navbar.component.html',
  styleUrls: ['./admin-navbar.component.css'],
  imports:[CommonModule]
})
export class AdminNavbarComponent implements OnInit {
  constructor(private router: Router) {}

  userName: string = '';
  userPicture: string = '';

  // internal display property (either the validated/encoded URL or fallback)
  private _displayPicture: string = '/img/avatars/avatar.jpg';

  // Expose a getter used by the template
  get safeUserPicture(): string {
    return this._displayPicture;
  }

  // Normalize and pre-load the user picture to detect failures early
  private prepareUserPicture(): void {
    try {
      let url = (this.userPicture ?? '').trim();
      if (!url) {
        this._displayPicture = '/img/avatars/avatar.jpg';
        return;
      }

      // Remove wrapping quotes if present
      if ((url.startsWith('"') && url.endsWith('"')) || (url.startsWith("'") && url.endsWith("'"))) {
        url = url.substring(1, url.length - 1).trim();
      }

      // Encode unsafe characters while preserving protocol and slashes
      url = encodeURI(url);

      // Preload the image to check if it actually loads; fall back on error
      const img = new Image();
      img.onload = () => {
        this._displayPicture = url;
      };
      img.onerror = () => {
        console.warn('[AdminNavbar] user picture failed to load:', url);
        this._displayPicture = '/img/avatars/avatar.jpg';
      };
      // Set src after handlers to start loading
      img.src = url;

      // Optimistically set it so UI shows quickly; error handler will revert if needed
      this._displayPicture = url;
    } catch (e) {
      console.warn('Error preparing user picture', e);
      this._displayPicture = '/img/avatars/avatar.jpg';
    }
  }

  ngOnInit(): void {
    // Decrypt user fields at init time (safer than during field initialization)
    try {
      const rawName = localStorage.getItem('user_name') ?? '';
      const rawPic = localStorage.getItem('user_picture') ?? '';
      const name = decryptData(rawName) || rawName || '';
      const pic = decryptData(rawPic) || rawPic || '';
      this.userName = name.trim();
      this.userPicture = pic.trim();
    } catch (e) {
      // Soft fallback
      this.userName = '';
      this.userPicture = '';
    }

    // Prepare the picture as soon as the component initializes
    this.prepareUserPicture();
  }
  

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

  showUserMenu = false;

}
