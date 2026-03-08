import { CommonModule } from '@angular/common';
import { Component, AfterViewInit, OnInit } from '@angular/core'; // <-- Add OnInit
import { RouterLink, Router } from '@angular/router';
import { CartService } from '../../../../services/cart.service';
import { Subscription } from 'rxjs';
import { decryptData } from '../../../../utils/crypto-util';

// Extend the Window interface to include the feather and bootstrap properties
declare global {
  interface Window {
    feather?: { replace: () => void };
    bootstrap?: any;
  }
}

@Component({
  selector: 'app-admin-sidebar',
  templateUrl: './admin-sidebar.component.html',
  styleUrls: ['./admin-sidebar.component.css'],
  imports: [RouterLink, CommonModule]
})
export class AdminSidebarComponent implements OnInit, AfterViewInit { // <-- Add OnInit
  isCoursesMenuOpen = false;
  isProductsMenuOpen = false;
  isHelpdeskMenuOpen = false;
  isReportsMenuOpen = false;
  isSpecialUser = false; // when true show alternate submenus
  cartCount = 0;
  private _subs: Subscription[] = [];

  constructor(private router: Router, private cartService: CartService) { }

  ngOnInit(): void {
    this.setActiveMenuOnLoad(); // <-- Move here
    try {
      const stored = localStorage.getItem('user_email');
      if (stored) {

        let email = decryptData(stored);
        if (!email) {
          email = stored;
        }
        const normalized = email.trim().toLowerCase();
        console.log("Email check:" + normalized);
        this.isSpecialUser = (normalized === 'bennyunsigned@gmail.com');
        // debug - remove in production if noisy
        console.log('admin-sidebar: resolved user email=', normalized, 'isSpecialUser=', this.isSpecialUser);
      } else {
        this.isSpecialUser = false;
      }
    } catch (e) {
      console.warn('Failed to determine user email from localStorage:', e);
      this.isSpecialUser = false;
    }

    // Subscribe to cart count if logged in
    try {
      this._subs.push(this.cartService.cartCount$.subscribe(c => this.cartCount = c));
      this.cartService.refreshCount();
    } catch (e) { /* ignore */ }

  }

  ngAfterViewInit(): void {
    // Reinitialize Feather icons
    if (window.feather) {
      window.feather.replace();
    }

    // Reinitialize Bootstrap components
    this.reinitializeBootstrapComponents();

    // REMOVE this.setActiveMenuOnLoad();
  }

  ngOnDestroy(): void {
    this._subs.forEach(s => s.unsubscribe());
  }

  setActiveMenuOnLoad(): void {
    // Check the current route and activate the corresponding menu
    if (this.router.url.includes('/dashboard/home')) {
      this.closeAllMenus();
    } else if (this.router.url.includes('/course/product-master') ||
      this.router.url.includes('/course/bundle-master') ||
      this.router.url.includes('/course/product-subscription')) {
      this.isProductsMenuOpen = true;
    } else if (this.router.url.includes('/course')) {
      this.isCoursesMenuOpen = true;
    } else if (this.router.url.includes('/helpdesk')) {
      this.isHelpdeskMenuOpen = true;
    } else if (this.router.url.includes('/reports')) {
      this.isReportsMenuOpen = true;
    }
  }

  toggleMenu(menu: string): void {
    // Close all menus first without auto-hiding the sidebar
    this.closeAllMenus(false);

    // Open the clicked menu
    if (menu === 'courses') {
      this.isCoursesMenuOpen = true;
    } else if (menu === 'products') {
      this.isProductsMenuOpen = true;
    } else if (menu === 'helpdesk') {
      this.isHelpdeskMenuOpen = true;
    } else if (menu === 'reports') {
      this.isReportsMenuOpen = true;
    }
  }

  activateSubmenu(parentMenu: string): void {
    // Expand the parent menu when a submenu is clicked
    this.closeAllMenus();
    if (parentMenu === 'courses') {
      this.isCoursesMenuOpen = true;
    } else if (parentMenu === 'products') {
      this.isProductsMenuOpen = true;
    } else if (parentMenu === 'helpdesk') {
      this.isHelpdeskMenuOpen = true;
    } else if (parentMenu === 'reports') {
      this.isReportsMenuOpen = true;
    }
    // Auto-hide sidebar on mobile after selecting a submenu item
    this.collapseSidebarIfMobile();
  }

  closeAllMenus(autoHideSidebar: boolean = false): void {
    this.isCoursesMenuOpen = false;
    this.isProductsMenuOpen = false;
    this.isHelpdeskMenuOpen = false;
    this.isReportsMenuOpen = false;
    // Optionally auto-hide sidebar on mobile when invoked from a navigation click
    if (autoHideSidebar) {
      this.collapseSidebarIfMobile();
    }
  }

  isActive(route: string): boolean {
    return this.router.url.includes(route);
  }

  isSubmenuActive(routes: string[]): boolean {
    return routes.some(route => this.router.url.includes(route));
  }

  private reinitializeBootstrapComponents(): void {
    // Reinitialize dropdowns
    const dropdownTriggerList = [].slice.call(document.querySelectorAll('.dropdown-toggle'));
    dropdownTriggerList.forEach(dropdownTriggerEl => {
      new window.bootstrap.Dropdown(dropdownTriggerEl);
    });

    // Reinitialize collapses
    const collapseTriggerList = [].slice.call(document.querySelectorAll('[data-bs-toggle="collapse"]'));
    collapseTriggerList.forEach(collapseTriggerEl => {
      new window.bootstrap.Collapse(collapseTriggerEl, { toggle: false });
    });
  }

  private collapseSidebarIfMobile(): void {
    try {
      if (window.innerWidth < 992) { // Bootstrap lg breakpoint
        const sidebar = document.getElementById('sidebar');
        // On mobile, ".sidebar" default is hidden and ".sidebar.collapsed" is visible (see public/css/app.css)
        // To auto-hide after navigation, REMOVE the "collapsed" class.
        sidebar?.classList.remove('collapsed');
      }
    } catch { /* noop */ }
  }

  // Used by top-level navigation items (e.g., Dashboard) to close menus and hide sidebar on mobile
  handleTopLevelNavClick(): void {
    this.closeAllMenus(true);
  }
}
