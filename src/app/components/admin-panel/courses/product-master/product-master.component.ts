import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators, FormsModule } from '@angular/forms';
import { ProductMasterService } from '../../../../services/product-master.service';
import { ProductAttachmentRequest, ProductAttachmentResponse } from '../../../../models/productModel';
import { ToastrService } from 'ngx-toastr';
import { HttpClient } from '@angular/common/http';
import { ImageUploadService } from '../../../../services/image-upload.service';
import { environment } from '../../../../../environments/environment';
import { CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { encryptData } from '../../../../utils/crypto-util';


@Component({
    selector: 'app-product-master',
    imports: [
        CommonModule,
        ReactiveFormsModule,
        FormsModule,

    ],
    templateUrl: './product-master.component.html',
    styleUrl: './product-master.component.css',
    schemas: [CUSTOM_ELEMENTS_SCHEMA]
})
export class ProductMasterComponent implements OnInit {
    mediaUrl = environment.apiUrl;
    ActiveTab = 'Add';
    productForm!: FormGroup;
    searchText: string = '';
    currentPage: number = 1;
    itemsPerPage: number = 10;
    totalPages: number = 0;
    paginatedData: any[] = [];
    products: any[] = [];
    filteredProducts: any[] = [];
    selectedProductId: string | null = null;
    sortColumn: string = '';
    sortDirection: boolean = true;
    product_content: string = '';

    // Attachment specific variables
    selectedProductForAttachment: any = null;
    tempAttachments: any[] = [];
    isAttachmentModalOpen = false;

    constructor(
        private fb: FormBuilder,
        private productService: ProductMasterService,
        private imageUploadService: ImageUploadService,
        private toastr: ToastrService,

    ) { }

    ngOnInit() {
        this.productForm = this.fb.group({
            product_name: ['', Validators.required],
            product_description: ['', Validators.required],
            product_content: [this.product_content || '', Validators.required],
            product_price: [0, [Validators.required, Validators.min(0)]],
            product_discount_price: [0, [Validators.required, Validators.min(0)]],
            product_image: [''],
            is_active: [true],
        });

        this.loadProducts();
    }

    changeActiveTab(tabName: string) {
        this.ActiveTab = tabName;
        if (tabName === 'Add') this.resetForm();
    }

    onSubmit(): void {
        if (this.productForm.invalid) {
            this.toastr.warning('Please fill all required fields.', 'Validation Error');
            return;
        }
        console.log(this.productForm.value);
        if (this.selectedProductId) {
            this.productService.updateProduct(this.selectedProductId, this.productForm.value).subscribe({
                next: (res) => {
                    this.toastr.success('Product updated successfully!', 'Success');
                    // Save attachments if any
                    if (this.tempAttachments.length > 0) {
                        this.saveAttachmentsAfterProductUpdate(Number(this.selectedProductId));
                    } else {
                        this.resetForm();
                        this.loadProducts();
                    }
                },
                error: (err) => {
                    console.error(err);
                    this.toastr.error('Failed to update product.', 'Error');
                },
            });
        } else {
            this.productService.createProduct(this.productForm.value).subscribe({
                next: (res) => {
                    this.toastr.success('Product created successfully!', 'Success');
                    // Assume res contains product_id or we get it from the response
                    const newProductId = res.product_id;
                    if (newProductId && this.tempAttachments.length > 0) {
                        this.saveAttachmentsAfterProductUpdate(newProductId);
                    } else {
                        this.resetForm();
                        this.loadProducts();
                    }
                },
                error: (err) => {
                    console.error(err);
                    this.toastr.error('Failed to create product.', 'Error');
                },
            });
        }
    }

    private saveAttachmentsAfterProductUpdate(productId: number): void {
        const attachmentsToSave: ProductAttachmentRequest[] = this.tempAttachments.map(a => ({
            file_name: a.file_name,
            file_url: a.file_url,
            file_type: a.file_type
        }));

        this.productService.saveProductAttachments(productId, attachmentsToSave).subscribe({
            next: () => {
                this.toastr.success('Attachments saved successfully!', 'Success');
                this.resetForm();
                this.loadProducts();
            },
            error: (err) => {
                console.error(err);
                this.toastr.error('Failed to save attachments.', 'Error');
                // Still reset and load products even if attachments fail? Or keep form?
                // Let's reset but warn.
                this.resetForm();
                this.loadProducts();
            }
        });
    }

    loadProducts(): void {
        this.productService.getProducts().subscribe({
            next: (data) => {
                this.products = data;
                this.filterData();
            },
            error: (err) => {
                console.error(err);
                this.toastr.error('Failed to load products.', 'Error');
            }
        });
    }

    editProduct(productId: number): void {
        this.productService.getProductById(productId.toString()).subscribe({
            next: (product) => {
                this.changeActiveTab('Add');
                this.selectedProductId = productId.toString();
                this.selectedProductForAttachment = product;
                // Patch form
                this.productForm.patchValue({
                    product_name: product.product_name,
                    product_description: product.product_description,
                    product_content: product.product_content,
                    product_price: product.product_price,
                    product_discount_price: product.product_discount_price,
                    product_image: product.product_image,
                    is_active: product.is_active,
                });
                // Set Trix editor content after patch (2 seconds delay)
                setTimeout(() => {
                    const trixEditor = document.querySelector('trix-editor[input="productContentInput"]') as any;
                    if (trixEditor) {
                        trixEditor.editor.loadHTML(product.product_content || '');
                    }
                }, 2000);

                // Explicitly fetch attachments to ensure they show up in the Add/Edit tab
                this.productService.getAttachmentsByProductId(productId).subscribe({
                    next: (attachments) => {
                        if (this.selectedProductForAttachment) {
                            // Use spread operator to ensure Angular detects the change for UI reactivity
                            this.selectedProductForAttachment = {
                                ...this.selectedProductForAttachment,
                                attachments: attachments
                            };
                        }
                    },
                    error: (err) => {
                        console.error('Failed to fetch attachments for edit:', err);
                    }
                });
            },
            error: (err) => {
                this.toastr.error('Failed to fetch product details.', 'Error');
            }
        });
    }

    deleteProduct(productId: number): void {
        if (confirm('Are you sure you want to delete this product?')) {
            this.productService.deleteProduct(productId.toString()).subscribe({
                next: () => {
                    this.toastr.success('Product deleted successfully!', 'Success');
                    this.loadProducts();
                    this.filterData();
                },
                error: (err) => {
                    console.error(err);
                    this.toastr.error('Failed to delete product.', 'Error');
                }
            });
        }
    }

    filterData(): void {
        this.filteredProducts = this.products.filter(product =>
            Object.values(product).some(value =>
                typeof value === 'string' && value.toLowerCase().includes(this.searchText.toLowerCase())
            )
        );

        this.totalPages = Math.ceil(this.filteredProducts.length / this.itemsPerPage);
        this.goToPage(1);
    }

    goToPage(page: number): void {
        if (page < 1 || page > this.totalPages) return;
        this.currentPage = page;
        const startIndex = (page - 1) * this.itemsPerPage;
        const endIndex = startIndex + this.itemsPerPage;
        this.paginatedData = this.filteredProducts.slice(startIndex, endIndex);
    }

    resetForm(): void {
        this.productForm.reset({
            product_name: '',
            product_description: '',
            product_content: '',
            product_price: 0,
            product_discount_price: 0,
            product_image: '',
            is_active: true,
        });
        this.selectedProductId = null;
        this.selectedProductForAttachment = null;
        this.tempAttachments = [];
        // Clear Trix editor content (2 seconds delay)
        setTimeout(() => {
            const trixEditor = document.querySelector('trix-editor[input="productContentInput"]') as any;
            if (trixEditor) {
                trixEditor.editor.loadHTML('');
            }
        }, 2000);
    }

    sortData(column: string): void {
        this.sortDirection = this.sortColumn === column ? !this.sortDirection : true;
        this.sortColumn = column;

        this.filteredProducts.sort((a, b) => {
            const valueA = a[column]?.toString().toLowerCase() || '';
            const valueB = b[column]?.toString().toLowerCase() || '';
            return this.sortDirection ? valueA.localeCompare(valueB) : valueB.localeCompare(valueA);
        });

        this.goToPage(1);
    }

    setItemsPerPage(items: number | string): void {
        if (items === 'all') {
            this.itemsPerPage = this.filteredProducts.length; // Show all items
        } else {
            this.itemsPerPage = Number(items); // Convert to number if not already
        }
        this.currentPage = 1;
        this.filterData();
    }

    onProductImageChange(event: any): void {
        const file: File = event.target.files[0];
        if (file) {
            this.imageUploadService.uploadProductImage(file).subscribe({
                next: (res) => {
                    this.productForm.patchValue({ product_image: res.path });
                    this.toastr.success('Product image uploaded!', 'Success');
                },
                error: () => {
                    this.toastr.error('Failed to upload image.', 'Error');
                }
            });
        }
    }

    // Called when Trix editor changes
    onTrixChange(event: any) {
        // Always get the latest HTML from the editor
        const trixEditor = event.target;
        const value = trixEditor.editor.getDocument().toString().trim() === '' ? '' : trixEditor.innerHTML;
        this.productForm.get('product_content')?.setValue(value);
    }

    // Optional: If you want to handle ngModelChange as well
    onTrixModelChange(value: string) {
        this.productForm.get('product_content')?.setValue(value);
    }

    // Attachment Methods
    openAttachmentModal(product: any) {
        this.selectedProductForAttachment = { ...product };
        if (!this.selectedProductForAttachment.attachments) {
            this.selectedProductForAttachment.attachments = [];
        }
        this.tempAttachments = [];
        this.isAttachmentModalOpen = true;
        // Optionally reload attachments from API if needed, but assuming product already has them or we use the 'all' API?
        // Let's just use what's in the product for now.
    }

    closeAttachmentModal() {
        this.isAttachmentModalOpen = false;
        this.selectedProductForAttachment = null;
        this.tempAttachments = [];
    }

    addAttachmentRow() {
        this.tempAttachments.push({
            file_name: '',
            file_url: '',
            file_type: ''
        });
    }

    removeAttachmentRow(index: number) {
        this.tempAttachments.splice(index, 1);
    }

    onAttachmentFileChange(event: any, index: number) {
        const file: File = event.target.files[0];
        if (file) {
            this.imageUploadService.uploadProductImage(file).subscribe({
                next: (res) => {
                    this.tempAttachments[index].file_url = res.path;
                    this.tempAttachments[index].file_name = file.name;
                    this.tempAttachments[index].file_type = file.type;
                    this.toastr.success('File uploaded!', 'Success');
                },
                error: () => {
                    this.toastr.error('Failed to upload file.', 'Error');
                }
            });
        }
    }

    saveAttachments() {
        if (this.tempAttachments.length === 0) {
            this.toastr.warning('No new attachments to save.', 'Warning');
            return;
        }

        // Validate that all temp attachments have a URL
        const invalid = this.tempAttachments.some(a => !a.file_url);
        if (invalid) {
            this.toastr.error('Please upload files for all rows or remove empty rows.', 'Error');
            return;
        }

        const attachmentsToSave: ProductAttachmentRequest[] = this.tempAttachments.map(a => ({
            file_name: a.file_name,
            file_url: a.file_url,
            file_type: a.file_type
        }));

        this.productService.saveProductAttachments(this.selectedProductForAttachment.product_id, attachmentsToSave).subscribe({
            next: (res) => {
                this.toastr.success('Attachments saved successfully!', 'Success');
                this.loadProducts(); // Reload to get updated attachments
                this.closeAttachmentModal();
            },
            error: (err) => {
                console.error(err);
                this.toastr.error('Failed to save attachments.', 'Error');
            }
        });
    }

    deleteExistingAttachment(attachmentId: number, index: number) {
        if (confirm('Are you sure you want to delete this attachment?')) {
            this.productService.deleteProductAttachment(this.selectedProductForAttachment.product_id, attachmentId).subscribe({
                next: () => {
                    this.toastr.success('Attachment deleted successfully!', 'Success');
                    // Use immutable update to ensure reactivity
                    this.selectedProductForAttachment = {
                        ...this.selectedProductForAttachment,
                        attachments: this.selectedProductForAttachment.attachments.filter((_: any, i: number) => i !== index)
                    };
                    this.loadProducts(); // Update the main list
                },
                error: (err) => {
                    console.error(err);
                    this.toastr.error('Failed to delete attachment.', 'Error');
                }
            });
        }
    }

    getEncryptedId(id: number | string): string {
        if (!id) return '';
        return encodeURIComponent(encryptData(id.toString()));
    }
}
