import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { EmailService } from '../../../services/email.service';
import { ToastrService } from 'ngx-toastr';

@Component({
  selector: 'app-website-contactus',
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './website-contactus.component.html',
  styleUrl: './website-contactus.component.css'
})
export class WebsiteContactusComponent implements OnInit {
  contactForm: FormGroup;
  isSubmitting = false;

  constructor(
    private fb: FormBuilder,
    private emailService: EmailService,
    private toastr: ToastrService
  ) {
    this.contactForm = this.fb.group({
      name: ['', [Validators.required, Validators.minLength(2)]],
      email: ['', [Validators.required, Validators.email]],
      mobile: ['', [Validators.required, Validators.pattern(/^[0-9]{10}$/)]],
      message: ['', [Validators.required, Validators.minLength(10)]]
    });
  }

  ngOnInit(): void { }

  onSubmit(): void {
    if (this.contactForm.invalid) {
      this.contactForm.markAllAsTouched();
      this.toastr.warning('Please fill all required fields correctly', 'Validation Error');
      return;
    }

    this.isSubmitting = true;
    const formData = this.contactForm.value;

    // Construct HTML email body
    const emailBody = `
      <html>
        <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
          <h2 style="color: #4a90e2;">New Contact Form Submission</h2>
          <div style="background-color: #f4f4f4; padding: 20px; border-radius: 5px;">
            <p><strong>Name:</strong> ${formData.name}</p>
            <p><strong>Email:</strong> ${formData.email}</p>
            <p><strong>Mobile:</strong> ${formData.mobile}</p>
            <p><strong>Message:</strong></p>
            <p style="background-color: white; padding: 15px; border-left: 4px solid #4a90e2;">
              ${formData.message}
            </p>
          </div>
        </body>
      </html>
    `;

    const emailPayload = {
      recipient_email: 'bennyunsigned@gmail.com',
      subject: `Contact Form: Message from ${formData.name}`,
      body: emailBody,
      attachments: null
    };

    this.emailService.sendEmail(emailPayload).subscribe({
      next: () => {
        this.toastr.success('Your message has been sent successfully!', 'Success');
        this.contactForm.reset();
        this.isSubmitting = false;
      },
      error: (err) => {
        console.error('Email send error:', err);
        this.toastr.error('Failed to send message. Please try again.', 'Error');
        this.isSubmitting = false;
      }
    });
  }
}
