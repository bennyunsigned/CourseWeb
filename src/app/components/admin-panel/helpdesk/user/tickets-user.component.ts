import { Component, OnInit } from '@angular/core';
import { environment } from '../../../../../environments/environment';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HelpdeskService } from '../../../../services/helpdesk.service';
import { ToastrService } from 'ngx-toastr';
import { decryptData } from '../../../../utils/crypto-util';

@Component({
  selector: 'app-tickets-user',
  templateUrl: './tickets-user.component.html',
  styleUrls: ['./tickets-user.component.css'],
  imports: [CommonModule, FormsModule]
})
export class TicketsUserComponent implements OnInit {
  // Create fields
  subject = '';
  description = '';
  priority: 'low' | 'medium' | 'high' | 'urgent' = 'medium';
  file?: File | null = null;
  // validation rules / state
  readonly MAX_SUBJECT_LENGTH = 50;
  readonly MAX_DESC_LENGTH = 200;
  readonly MAX_MESSAGE_LENGTH = 2000;
  readonly MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
  readonly ALLOWED_FILE_TYPES: string[] = [
    'image/png', 'image/jpeg', 'image/jpg', 'application/pdf', 'text/plain', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  ];
  fileError: string | null = null;
  subjectError: string | null = null;
  descriptionError: string | null = null;
  messageError: string | null = null;

  // List/pagination/search
  tickets: any[] = [];
  filtered: any[] = [];
  searchText = '';
  filterStatus = '';
  filterPriority = '';
  fromDate = '';
  toDate = '';
  currentPage = 1;
  itemsPerPage = 10;
  totalPages = 0;

  // Details
  selectedTicket: any = null;
  showModal = false;
  newMessage = '';
  // UI flags
  showListCard = true;

  constructor(private helpdesk: HelpdeskService, private toastr: ToastrService) {}

  private userModal: any = null;
  // helper similar to admin for attachment URLs
  loggedInUserId: number | null = null;
  resolveUrl(path: string | null | undefined): string {
    if (!path) return '';
    if (/^https?:\/\//i.test(path)) return path;
    const base = environment.apiUrl.replace(/\/$/, '');
    return base + (path.startsWith('/') ? path : '/' + path);
  }

  closeListCard(): void {
    this.showListCard = false;
  }

  ngOnInit(): void {
    console.log('[TicketsUserComponent] ngOnInit start');
    try {
      this.computeLoggedInUserId();
      console.log('[TicketsUserComponent] computed loggedInUserId', this.loggedInUserId);
    } catch (e) {
      console.error('[TicketsUserComponent] computeLoggedInUserId failed', e);
    }
    try {
      this.loadTickets();
    } catch (e) {
      console.error('[TicketsUserComponent] loadTickets threw', e);
    }
    console.log('[TicketsUserComponent] ngOnInit end');
  }

  private computeLoggedInUserId(): void {
    try {
      const enc = localStorage.getItem('user_id') || '';
      const dec = decryptData(enc);
      const id = parseInt(dec || enc || '', 10);
      this.loggedInUserId = Number.isFinite(id) ? id : null;
    } catch (e) {
      this.loggedInUserId = null;
    }
  }

  onFileChange(ev: any) {
    const f: File = ev.target.files && ev.target.files[0];
    this.file = f || null;
    // validate file immediately
    this.fileError = null;
    if (this.file) {
      const v = this.validateFile(this.file);
      if (!v.valid) {
        this.fileError = v.reason || 'Invalid file';
        this.file = null;
        // clear the input element so user can reselect
        const input = ev.target as HTMLInputElement | null;
        if (input) input.value = '';
      }
    }
    console.log('[TicketsUserComponent] onFileChange', { file: this.file, ev, fileError: this.fileError });
  }

  createTicket(): void {
    if (!this.validateCreateTicket()) return;
    console.log('[TicketsUserComponent] createTicket start', { subject: this.subject, priority: this.priority, hasFile: !!this.file });
    this.helpdesk.createTicket(this.subject.trim(), this.description, this.priority, this.file as File).subscribe({
      next: () => {
        console.log('[TicketsUserComponent] createTicket success');
        this.toastr.success('Ticket created', 'Success');
        this.resetForm();
        this.loadTickets();
      },
      error: (err) => { console.error('[TicketsUserComponent] createTicket error', err); this.toastr.error(err?.error?.detail || 'Failed to create ticket', 'Error'); }
    });
  }

  resetForm(): void {
    this.subject = '';
    this.description = '';
    this.priority = 'medium';
    this.file = null;
    this.fileError = null;
    this.subjectError = null;
    this.descriptionError = null;
    const input = document.querySelector('#user-helpdesk-file') as HTMLInputElement | null;
    if (input) input.value = '';
  }

  loadTickets(): void {
    console.log('[TicketsUserComponent] loadTickets -> calling listMyTickets');
    this.helpdesk.listMyTickets().subscribe({
      next: (data) => {
        console.log('[TicketsUserComponent] listMyTickets response', data);
        this.tickets = data;
        try { this.applyFilters(); } catch (e) { console.error('[TicketsUserComponent] applyFilters failed', e); }
      },
      error: (err) => {
        console.error('[TicketsUserComponent] listMyTickets error', err);
        this.toastr.error('Failed to load your tickets', 'Error');
      }
    });
  }

  applyFilters(): void {
    const from = this.fromDate ? new Date(this.fromDate + 'T00:00:00') : null;
    const to = this.toDate ? new Date(this.toDate + 'T23:59:59') : null;
    this.filtered = this.tickets.filter(t => {
      if (this.filterStatus && t.status !== this.filterStatus) return false;
      if (this.filterPriority && t.priority !== this.filterPriority) return false;
      if (this.searchText) {
        const s = this.searchText.toLowerCase();
        if (!((t.subject || '').toLowerCase().includes(s) || (t.description || '').toLowerCase().includes(s))) return false;
      }
      if (from || to) {
        const created = t.created_at ? new Date(t.created_at.replace(' ', 'T')) : null;
        if (!created) return false;
        if (from && created < from) return false;
        if (to && created > to) return false;
      }
      return true;
    });
    this.totalPages = Math.max(1, Math.ceil(this.filtered.length / this.itemsPerPage));
    console.log('[TicketsUserComponent] applyFilters ->', { filteredCount: this.filtered.length, totalPages: this.totalPages });
    this.goToPage(1);
  }

  goToPage(page: number): void {
    if (page < 1) page = 1;
    if (page > this.totalPages) page = this.totalPages;
    this.currentPage = page;
  }

  paginated(): any[] {
    const start = (this.currentPage - 1) * this.itemsPerPage;
    return this.filtered.slice(start, start + this.itemsPerPage);
  }

  openDetails(ticket: any): void {
    console.log('[TicketsUserComponent] openDetails start', { ticketId: ticket?.ticket_id });
    try {
      this.helpdesk.getTicket(ticket.ticket_id).subscribe({
        next: (d) => {
          console.log('[TicketsUserComponent] getTicket response', d);
          this.selectedTicket = d;
          console.log('[TicketsUserComponent] selectedTicket set', { selectedTicket: this.selectedTicket });
          try {
            // Log each message's user_id for debugging
            if (Array.isArray(this.selectedTicket.messages)) {
              this.selectedTicket.messages.forEach((m: any, idx: number) => {
                console.log('[TicketsUserComponent] message user_id', { index: idx, user_id: m?.user_id, messageId: m?.id || m?.message_id, sender: m?.sender });
              });
            }
          } catch (e) { console.error('[TicketsUserComponent] logging messages user_id failed', e); }
          try { this.logSelectedTicket(); } catch (e) { console.error('[TicketsUserComponent] logSelectedTicket failed', e); }
          try {
            const modalEl = document.getElementById('ticketModalUser') as any;
            console.log('[TicketsUserComponent] modalEl lookup', { modalElExists: !!modalEl });
            if (modalEl) {
              if (!this.userModal) {
                // @ts-ignore
                this.userModal = new (window as any).bootstrap.Modal(modalEl);
                console.log('[TicketsUserComponent] userModal instance created');
              }
              this.userModal.show();
              console.log('[TicketsUserComponent] userModal shown');
            }
          } catch (e) {
            console.warn('[TicketsUserComponent] Failed to show bootstrap modal', e);
          }
        },
        error: (err) => {
          console.error('[TicketsUserComponent] getTicket error', err);
          this.toastr.error('Failed to load details', 'Error');
        }
      });
    } catch (e) {
      console.error('[TicketsUserComponent] openDetails outer error', e);
    }
    // scroll messages after short delay to allow render
    setTimeout(() => { try { this.scrollMessagesToBottom('messagesContainerUser'); console.log('[TicketsUserComponent] scrollMessagesToBottom invoked'); } catch (e) { console.error('[TicketsUserComponent] scrollMessagesToBottom error', e); } }, 120);
    // focus composer
    setTimeout(() => {
      try {
        const ta = document.getElementById('userComposer') as HTMLTextAreaElement | null;
        console.log('[TicketsUserComponent] composer lookup', { taExists: !!ta });
        if (ta) ta.focus();
      } catch (e) { console.warn('[TicketsUserComponent] composer focus failed', e); }
    }, 180);
  }

  // Pagination helper: compute visible page window (maxButtons wide)
  pageNumbers(): number[] {
    const maxButtons = 5;
    const total = this.totalPages || 1;
    let start = Math.max(1, this.currentPage - Math.floor(maxButtons / 2));
    let end = start + maxButtons - 1;
    if (end > total) {
      end = total;
      start = Math.max(1, end - maxButtons + 1);
    }
    const nums: number[] = [];
    for (let i = start; i <= end; i++) nums.push(i);
    return nums;
  }

  pageRangeStart(): number {
    const nums = this.pageNumbers();
    return nums.length ? nums[0] : 1;
  }

  pageRangeEnd(): number {
    const nums = this.pageNumbers();
    return nums.length ? nums[nums.length - 1] : this.totalPages || 1;
  }

  prevPage(): void {
    const target = Math.max(1, this.currentPage - 1);
    console.log('[TicketsUserComponent] prevPage ->', { currentPage: this.currentPage, target });
    this.goToPage(target);
  }

  nextPage(): void {
    const target = Math.min(this.totalPages || 1, this.currentPage + 1);
    console.log('[TicketsUserComponent] nextPage ->', { currentPage: this.currentPage, target, totalPages: this.totalPages });
    this.goToPage(target);
  }

  closeModal(): void {
    // hide bootstrap modal if present
    try { if (this.userModal) this.userModal.hide(); } catch (e) { /* ignore */ }
    this.selectedTicket = null;
    this.newMessage = '';
  }

  postMessage(): void {
    if (!this.selectedTicket) return;
    if (!this.validatePostMessage()) return;
    console.log('[TicketsUserComponent] postMessage start', { ticketId: this.selectedTicket.ticket_id, message: this.newMessage });
  this.helpdesk.addMessage(this.selectedTicket.ticket_id, this.newMessage.trim()).subscribe({ next: () => { console.log('[TicketsUserComponent] addMessage success'); this.toastr.success('Message posted', 'Success'); this.openDetails(this.selectedTicket); this.newMessage = ''; }, error: (err) => { console.error('[TicketsUserComponent] addMessage error', err); this.toastr.error('Failed to post message', 'Error'); } });
  }

  clearComposer(): void {
    this.newMessage = '';
  }

  // Debug helper: log key parts of the selected ticket
  private logSelectedTicket(): void {
    if (!this.selectedTicket) { console.log('[TicketsUserComponent] logSelectedTicket: no selectedTicket'); return; }
    try {
      const summary = {
        ticket_id: this.selectedTicket.ticket_id,
        subject: this.selectedTicket.subject,
        status: this.selectedTicket.status,
        priority: this.selectedTicket.priority,
        messagesCount: Array.isArray(this.selectedTicket.messages) ? this.selectedTicket.messages.length : 0,
        attachmentsCount: Array.isArray(this.selectedTicket.attachments) ? this.selectedTicket.attachments.length : 0
      };
      console.log('[TicketsUserComponent] selectedTicket summary', summary);
      if (Array.isArray(this.selectedTicket.messages)) console.log('[TicketsUserComponent] recent messages', this.selectedTicket.messages.slice(-5));
    } catch (e) {
      console.error('[TicketsUserComponent] logSelectedTicket exception', e);
    }
  }

  private scrollMessagesToBottom(containerId: string): void {
    try {
      const el = document.getElementById(containerId);
      if (el) {
        el.scrollTop = el.scrollHeight;
      }
    } catch (e) {
      console.warn('[TicketsUserComponent] scrollMessagesToBottom failed', e);
    }
  }

  // Deterministic color by name (simple hash -> HSL)
  senderColor(name?: string | null): string {
    const n = (name || 'user').toString();
    let h = 0;
    for (let i = 0; i < n.length; i++) h = (h << 5) - h + n.charCodeAt(i);
    const hue = Math.abs(h) % 360;
    return `hsl(${hue} 65% 40%)`;
  }

  // Format date to dd/MM/yyyy HH:MM
  formatDate(d?: string | null): string {
    if (!d) return '';
    try {
      const dt = new Date(d);
      if (isNaN(dt.getTime())) return d;
      const dd = String(dt.getDate()).padStart(2, '0');
      const mm = String(dt.getMonth() + 1).padStart(2, '0');
      const yyyy = dt.getFullYear();
      const hours24 = dt.getHours();
      const ampm = hours24 >= 12 ? 'PM' : 'AM';
      let hours12 = hours24 % 12;
      if (hours12 === 0) hours12 = 12;
      const hh = String(hours12).padStart(2, '0');
      const min = String(dt.getMinutes()).padStart(2, '0');
      return `${dd}/${mm}/${yyyy} ${hh}:${min} ${ampm}`;
    } catch (e) {
      return d;
    }
  }

  // Determine if a message is from an admin/support agent.
  messageIsFromAdmin(m: any): boolean {
    if (!m) return false;
    // If message contains a user_id, compare with logged in user id
    if (typeof m.user_id === 'number' && this.loggedInUserId !== null) {
      // If message user_id equals logged-in id -> message is from current user, not admin
      return m.user_id !== this.loggedInUserId && m.user_id === 1;
    }
    // explicit flags fallback
    if (m.is_admin === true || m.is_agent === true) return true;
    const s = (m.sender || '').toString().toLowerCase();
    return /admin|support|staff|agent|helpdesk/.test(s);
  }

  // Validation helpers
  private validateFile(f: File): { valid: boolean; reason?: string } {
    try {
      if (!f) return { valid: false, reason: 'No file' };
      if (f.size > this.MAX_FILE_SIZE) return { valid: false, reason: `File too large (max ${this.MAX_FILE_SIZE / 1024 / 1024} MB)` };
      if (this.ALLOWED_FILE_TYPES.length && !this.ALLOWED_FILE_TYPES.includes(f.type)) return { valid: false, reason: 'File type not allowed' };
      return { valid: true };
    } catch (e) {
      return { valid: false, reason: 'Invalid file' };
    }
  }

  private validateCreateTicket(): boolean {
    this.subjectError = null;
    this.descriptionError = null;
    const subj = (this.subject || '').trim();
    if (!subj) {
      this.subjectError = 'Subject is required';
      this.toastr.warning(this.subjectError, 'Validation');
      return false;
    }
    if (subj.length > this.MAX_SUBJECT_LENGTH) {
      this.subjectError = `Subject too long (max ${this.MAX_SUBJECT_LENGTH} chars)`;
      this.toastr.warning(this.subjectError, 'Validation');
      return false;
    }
    if (this.description && this.description.length > this.MAX_DESC_LENGTH) {
      this.descriptionError = `Description too long (max ${this.MAX_DESC_LENGTH} chars)`;
      this.toastr.warning(this.descriptionError, 'Validation');
      return false;
    }
    // file error was set on change; re-validate
    if (this.file) {
      const vf = this.validateFile(this.file);
      if (!vf.valid) {
        this.fileError = vf.reason || 'Invalid file';
        this.toastr.warning(this.fileError, 'Validation');
        return false;
      }
    }
    // allowed priorities
    if (!['low', 'medium', 'high', 'urgent'].includes(this.priority)) {
      this.toastr.warning('Invalid priority selected', 'Validation');
      return false;
    }
    return true;
  }

  private validatePostMessage(): boolean {
    this.messageError = null;
    const msg = (this.newMessage || '').trim();
    if (!msg) {
      this.messageError = 'Message cannot be empty';
      this.toastr.warning(this.messageError, 'Validation');
      return false;
    }
    if (msg.length > this.MAX_MESSAGE_LENGTH) {
      this.messageError = `Message too long (max ${this.MAX_MESSAGE_LENGTH} chars)`;
      this.toastr.warning(this.messageError, 'Validation');
      return false;
    }
    return true;
  }

  // Exposed getter to compute Create button disabled state and help debug
  get createDisabled(): boolean {
    const subjLen = (this.subject || '').trim().length;
    const disabled = !(subjLen > 0) || !!this.subjectError || !!this.descriptionError || !!this.fileError;
    console.log('[TicketsUserComponent] createDisabled check', { subject: this.subject, subjLen, subjectError: this.subjectError, descriptionError: this.descriptionError, fileError: this.fileError, disabled });
    return disabled;
  }

  changeStatus(newStatus: string): void {
    if (!this.selectedTicket) return;
    console.log('[TicketsUserComponent] changeStatus start', { ticketId: this.selectedTicket.ticket_id, newStatus });
    this.helpdesk.updateStatus(this.selectedTicket.ticket_id, newStatus).subscribe({
      next: () => {
        console.log('[TicketsUserComponent] updateStatus success');
        this.toastr.success('Status updated', 'Success');
        this.openDetails(this.selectedTicket);
      },
      error: (err) => {
        console.error('[TicketsUserComponent] updateStatus error', err);
        this.toastr.error('Failed to update status', 'Error');
      }
    });
  }

  uploadAttachment(input: HTMLInputElement): void {
    if (!this.selectedTicket) return;
    const f = input.files && input.files[0];
    if (!f) { this.toastr.warning('Select a file', 'Validation'); return; }
    const v = this.validateFile(f);
    if (!v.valid) { this.toastr.warning(v.reason || 'Invalid file', 'Validation'); return; }
    console.log('[TicketsUserComponent] uploadAttachment start', { ticketId: this.selectedTicket.ticket_id, fileName: f.name, fileType: f.type });
    this.helpdesk.addAttachment(this.selectedTicket.ticket_id, f).subscribe({
      next: () => {
        console.log('[TicketsUserComponent] addAttachment success');
        this.toastr.success('Uploaded', 'Success');
        this.openDetails(this.selectedTicket);
        input.value = '';
      },
      error: (err) => {
        console.error('[TicketsUserComponent] addAttachment error', err);
        this.toastr.error('Failed to upload', 'Error');
      }
    });
  }

  loadMore(): void {
    console.log('[TicketsUserComponent] loadMore');
    this.itemsPerPage += 10;
    this.totalPages = Math.max(1, Math.ceil(this.filtered.length / this.itemsPerPage));
  }

  isAdmin(): boolean {
    return localStorage.getItem('user_id') === '1';
  }

  deleteTicket(ticketId: number): void {
    if (!this.isAdmin()) return;
    if (!confirm('Are you sure you want to delete this ticket?')) return;
    console.log('[TicketsUserComponent] deleteTicket', ticketId);
    this.helpdesk.deleteTicket(ticketId).subscribe({ next: () => { console.log('[TicketsUserComponent] deleteTicket success'); this.toastr.success('Ticket deleted','Success'); this.loadTickets(); if (this.selectedTicket && this.selectedTicket.ticket_id === ticketId) this.selectedTicket = null; }, error: (err) => { console.error('[TicketsUserComponent] deleteTicket error', err); this.toastr.error('Failed to delete','Error'); } });
  }
}
