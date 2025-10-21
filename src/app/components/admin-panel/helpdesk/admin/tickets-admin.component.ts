import { Component, OnInit } from '@angular/core';
import { environment } from '../../../../../environments/environment';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HelpdeskService } from '../../../../services/helpdesk.service';
import { ToastrService } from 'ngx-toastr';
import { decryptData } from '../../../../utils/crypto-util';

@Component({
  selector: 'app-tickets-admin',
  templateUrl: './tickets-admin.component.html',
  styleUrls: ['./tickets-admin.component.css'],
  imports: [CommonModule, FormsModule]
})
export class TicketsAdminComponent implements OnInit {
  tickets: any[] = [];
  filtered: any[] = [];
  searchText = '';
  filterPriority = '';
  filterStatus = '';
  // Date range filters (YYYY-MM-DD)
  fromDate = '';
  toDate = '';
  currentPage = 1;
  itemsPerPage = 10;
  totalPages = 0;

  selectedTicket: any = null;
  showModal = false;
  newMessage = '';
  // validation rules/state
  readonly MAX_SUBJECT_LENGTH = 200;
  readonly MAX_DESC_LENGTH = 5000;
  readonly MAX_MESSAGE_LENGTH = 5000;
  readonly MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB for admin uploads
  readonly ALLOWED_FILE_TYPES: string[] = [
    'image/png', 'image/jpeg', 'image/jpg', 'application/pdf', 'text/plain', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  ];
  fileError: string | null = null;
  messageError: string | null = null;

  constructor(private helpdesk: HelpdeskService, private toastr: ToastrService) {}

  // bootstrap Modal instance
  private adminModal: any = null;
  readonly apiBase = environment.apiUrl;
  loggedInUserId: number | null = null;

  ngOnInit(): void { this.loadOpenTickets(); }

  ngOnChanges(): void {
    // try to compute logged in user id on input changes as well
    this.computeLoggedInUserId();
  }

  private computeLoggedInUserId(): void {
    try {
      const enc = localStorage.getItem('user_id') || '';
      const dec = decryptData(enc);
      const id = parseInt(dec || enc || '', 10);
      this.loggedInUserId = Number.isFinite(id) ? id : null;
      console.log('[TicketsAdminComponent] computeLoggedInUserId ->', { raw: enc, decrypted: dec, loggedInUserId: this.loggedInUserId });
    } catch (e) {
      this.loggedInUserId = null;
      console.error('[TicketsAdminComponent] computeLoggedInUserId error', e);
    }
  }

  loadOpenTickets(): void {
    console.log('[TicketsAdminComponent] loadOpenTickets start');
    this.helpdesk.listOpenTickets().subscribe({
      next: (d) => {
        console.log('[TicketsAdminComponent] listOpenTickets response', d);
        this.tickets = d;
        try { this.applyFilters(); } catch (e) { console.error('[TicketsAdminComponent] applyFilters failed', e); }
      },
      error: (err) => { console.error('[TicketsAdminComponent] listOpenTickets error', err); this.toastr.error('Failed to load open tickets', 'Error'); }
    });
  }

  resolveUrl(path: string | null | undefined): string {
    if (!path) return '';
    // If already absolute (starts with http) return as-is
    if (/^https?:\/\//i.test(path)) return path;
    // Ensure single slash between base and path
    const base = this.apiBase.replace(/\/$/, '');
    return base + (path.startsWith('/') ? path : '/' + path);
  }

  

  paginated(): any[] { const start = (this.currentPage-1)*this.itemsPerPage; return this.filtered.slice(start, start + this.itemsPerPage); }
  goToPage(p: number) { if (p<1) p=1; if (p>this.totalPages) p=this.totalPages; this.currentPage=p; }

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

  // Wrapper helpers to improve logging and avoid template expressions with arithmetic
  prevPage(): void {
    const target = Math.max(1, this.currentPage - 1);
    console.log('[TicketsAdminComponent] prevPage ->', { currentPage: this.currentPage, target });
    this.goToPage(target);
  }

  nextPage(): void {
    const target = Math.min(this.totalPages || 1, this.currentPage + 1);
    console.log('[TicketsAdminComponent] nextPage ->', { currentPage: this.currentPage, target, totalPages: this.totalPages });
    this.goToPage(target);
  }

  openDetails(t: any) {
    console.log('[TicketsAdminComponent] openDetails start', { ticketId: t?.ticket_id });
    try {
      this.helpdesk.getTicket(t.ticket_id).subscribe({
        next: d => {
          console.log('[TicketsAdminComponent] getTicket response', d);
          this.selectedTicket = d;
          console.log('[TicketsAdminComponent] selectedTicket set', { selectedTicket: this.selectedTicket });
          try { this.logSelectedTicket(); } catch (e) { console.error('[TicketsAdminComponent] logSelectedTicket failed', e); }
          try {
            // Log each message's user_id for debugging
            if (Array.isArray(this.selectedTicket.messages)) {
              this.selectedTicket.messages.forEach((m: any, idx: number) => {
                console.log('[TicketsAdminComponent] message user_id', { index: idx, user_id: m?.user_id, messageId: m?.id || m?.message_id, sender: m?.sender });
              });
            }
          } catch (e) { console.error('[TicketsAdminComponent] logging messages user_id failed', e); }
          // open bootstrap modal
          try {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const modalEl = document.getElementById('ticketModalAdmin') as any;
            console.log('[TicketsAdminComponent] modalEl lookup', { modalElExists: !!modalEl });
            if (modalEl) {
              // lazy-initialize modal instance
              // @ts-ignore
              if (!this.adminModal) {
                this.adminModal = new (window as any).bootstrap.Modal(modalEl);
                console.log('[TicketsAdminComponent] adminModal instance created');
              }
              this.adminModal.show();
              console.log('[TicketsAdminComponent] adminModal shown');
              // scroll messages to bottom after modal shown (small timeout to allow render)
              setTimeout(() => { try { this.scrollMessagesToBottom('messagesContainerAdmin'); console.log('[TicketsAdminComponent] scrollMessagesToBottom invoked'); } catch (e) { console.error('[TicketsAdminComponent] scrollMessagesToBottom error', e); } }, 100);
              // focus composer
              setTimeout(() => {
                try {
                  const ta = document.getElementById('adminComposer') as HTMLTextAreaElement | null;
                  console.log('[TicketsAdminComponent] admin composer lookup', { taExists: !!ta });
                  if (ta) ta.focus();
                } catch (e) { console.warn('[TicketsAdminComponent] composer focus failed', e); }
              }, 160);
            }
          } catch (e) { console.warn('[TicketsAdminComponent] Failed to show bootstrap modal', e); }
        },
        error: (err) => {
          console.error('[TicketsAdminComponent] getTicket error', err);
          this.toastr.error('Failed to load details', 'Error');
        }
      });
    } catch (e) {
      console.error('[TicketsAdminComponent] openDetails outer error', e);
    }
  }

  private scrollMessagesToBottom(containerId: string): void {
    try {
      const el = document.getElementById(containerId);
      if (el) {
        el.scrollTop = el.scrollHeight;
        console.log('[TicketsAdminComponent] scrollMessagesToBottom scrolled', { containerId, scrollTop: el.scrollTop, scrollHeight: el.scrollHeight });
      }
    } catch (e) {
      console.warn('[TicketsAdminComponent] scrollMessagesToBottom failed', e);
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

  // Validation helpers (admin)
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
    // If message object contains user_id, use it. For admin component, user_id==1 is admin.
    if (typeof m.user_id === 'number') {
      return m.user_id === 1;
    }
    // Explicit flag from backend
    if (m.is_admin === true || m.is_agent === true) return true;
    const s = (m.sender || '').toString().toLowerCase();
    return /admin|support|staff|agent|helpdesk/.test(s);
  }

  closeModal(): void {
    this.showModal = false;
    this.selectedTicket = null;
    this.newMessage = '';
  }

  // Close the admin bootstrap modal instance (used by header X button)
  closeAdminModal(): void {
    try {
      if (this.adminModal && typeof this.adminModal.hide === 'function') {
        this.adminModal.hide();
      }
    } catch (e) {
      console.warn('[TicketsAdminComponent] closeAdminModal hide failed', e);
    }
    this.showModal = false;
    this.selectedTicket = null;
    this.newMessage = '';
  }

  postMessage() { if(!this.selectedTicket) return; if(!this.newMessage.trim()) { this.toastr.warning('Message empty','Validation'); return; } console.log('[TicketsAdminComponent] postMessage', { ticketId: this.selectedTicket.ticket_id, message: this.newMessage }); this.helpdesk.addMessage(this.selectedTicket.ticket_id,this.newMessage.trim()).subscribe({ next: ()=> { console.log('[TicketsAdminComponent] addMessage success'); this.toastr.success('Message posted','Success'); this.openDetails(this.selectedTicket); this.newMessage=''; }, error: (err)=> { console.error('[TicketsAdminComponent] addMessage error', err); this.toastr.error('Failed to post message','Error'); } }); }

  clearComposer(): void {
    // Clear the composer input
    this.newMessage = '';
  }



  changeStatus(s: string) { if(!this.selectedTicket) return; console.log('[TicketsAdminComponent] changeStatus', { ticketId: this.selectedTicket.ticket_id, newStatus: s }); this.helpdesk.updateStatus(this.selectedTicket.ticket_id, s).subscribe({ next: ()=> { console.log('[TicketsAdminComponent] updateStatus success'); this.toastr.success('Status updated','Success'); this.openDetails(this.selectedTicket); }, error: (err)=> { console.error('[TicketsAdminComponent] updateStatus error', err); this.toastr.error('Failed to update status','Error'); } }); }

  uploadAttachment(input: HTMLInputElement) { if(!this.selectedTicket) return; const f = input.files && input.files[0]; if(!f) { this.toastr.warning('Select a file','Validation'); return; } console.log('[TicketsAdminComponent] uploadAttachment', { ticketId: this.selectedTicket.ticket_id, fileName: f.name }); this.helpdesk.addAttachment(this.selectedTicket.ticket_id, f).subscribe({ next: ()=> { console.log('[TicketsAdminComponent] addAttachment success'); this.toastr.success('Uploaded','Success'); this.openDetails(this.selectedTicket); input.value=''; }, error: (err)=> { console.error('[TicketsAdminComponent] addAttachment error', err); this.toastr.error('Failed to upload','Error'); } }); }

  // Admin-only: delete ticket with confirmation
  deleteTicket(ticketId: number): void {
    if (!confirm('Are you sure you want to permanently delete this ticket? This operation cannot be undone.')) return;
    console.log('[TicketsAdminComponent] deleteTicket', ticketId);
    this.helpdesk.deleteTicket(ticketId).subscribe({
      next: () => {
        console.log('[TicketsAdminComponent] deleteTicket success');
        this.toastr.success('Ticket deleted', 'Success');
        // Refresh list and clear details if the deleted ticket was open
        if (this.selectedTicket && this.selectedTicket.ticket_id === ticketId) {
          this.selectedTicket = null;
        }
        this.loadOpenTickets();
      },
      error: (err) => {
        console.error('[TicketsAdminComponent] deleteTicket error', err);
        this.toastr.error(err?.error?.detail || 'Failed to delete ticket', 'Error');
      }
    });
  }

  // Load more (infinite-scroll style)
  loadMore(): void {
    console.log('[TicketsAdminComponent] loadMore');
    this.itemsPerPage += 10;
    this.totalPages = Math.max(1, Math.ceil(this.filtered.length / this.itemsPerPage));
  }

  // Debug helper: log key parts of the selected ticket
  private logSelectedTicket(): void {
    if (!this.selectedTicket) { console.log('[TicketsAdminComponent] logSelectedTicket: no selectedTicket'); return; }
    try {
      const summary = {
        ticket_id: this.selectedTicket.ticket_id,
        subject: this.selectedTicket.subject,
        status: this.selectedTicket.status,
        priority: this.selectedTicket.priority,
        messagesCount: Array.isArray(this.selectedTicket.messages) ? this.selectedTicket.messages.length : 0,
        attachmentsCount: Array.isArray(this.selectedTicket.attachments) ? this.selectedTicket.attachments.length : 0
      };
      console.log('[TicketsAdminComponent] selectedTicket summary', summary);
      if (Array.isArray(this.selectedTicket.messages)) console.log('[TicketsAdminComponent] recent messages', this.selectedTicket.messages.slice(-5));
    } catch (e) {
      console.error('[TicketsAdminComponent] logSelectedTicket exception', e);
    }
  }

  // Date helper
  private parseDateString(s: string | null | undefined): Date | null {
    if (!s) return null;
    // Normalize 'YYYY-MM-DD HH:MM:SS' to 'YYYY-MM-DDTHH:MM:SS' for Date parsing
    const normalized = s.replace(' ', 'T');
    const d = new Date(normalized);
    return isNaN(d.getTime()) ? null : d;
  }

  // Extend filter to include date range
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
        const created = this.parseDateString(t.created_at);
        if (!created) return false;
        if (from && created < from) return false;
        if (to && created > to) return false;
      }
      return true;
    });
    this.totalPages = Math.max(1, Math.ceil(this.filtered.length / this.itemsPerPage));
    console.log('[TicketsAdminComponent] applyFilters ->', { filteredCount: this.filtered.length, totalPages: this.totalPages });
    this.goToPage(1);
  }
}
