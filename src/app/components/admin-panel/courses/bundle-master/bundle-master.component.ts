import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators, FormsModule } from '@angular/forms';
import { BundleMasterService } from '../../../../services/bundle-master.service';
import { ProductMasterService } from '../../../../services/product-master.service';
import { Bundle } from '../../../../models/bundleModel';
import { Product } from '../../../../models/productModel';
import { ToastrService } from 'ngx-toastr';
import { NgSelectModule } from '@ng-select/ng-select';
import { environment } from '../../../../../environments/environment';

@Component({
    selector: 'app-bundle-master',
    standalone: true,
    imports: [
        CommonModule,
        ReactiveFormsModule,
        FormsModule,
        NgSelectModule
    ],
    templateUrl: './bundle-master.component.html',
    styleUrl: './bundle-master.component.css'
})
export class BundleMasterComponent implements OnInit {
    mediaUrl = environment.apiUrl;
    ActiveTab = 'Add';
    bundleForm!: FormGroup;
    searchText: string = '';
    currentPage: number = 1;
    itemsPerPage: number = 10;
    totalPages: number = 0;
    paginatedData: Bundle[] = [];
    bundles: Bundle[] = [];
    filteredBundles: Bundle[] = [];
    products: Product[] = [];
    selectedBundleId: string | null = null;
    sortColumn: string = '';
    sortDirection: boolean = true;

    constructor(
        private fb: FormBuilder,
        private bundleService: BundleMasterService,
        private productService: ProductMasterService,
        private toastr: ToastrService
    ) { }

    ngOnInit() {
        this.bundleForm = this.fb.group({
            bundle_name: ['', Validators.required],
            bundle_description: ['', Validators.required],
            bundle_price: [0, [Validators.required, Validators.min(0)]],
            bundle_discount_price: [0, [Validators.required, Validators.min(0)]],
            is_active: [true],
            product_ids: [[], Validators.required]
        });

        this.loadBundles();
        this.loadProducts();
    }

    loadBundles(): void {
        this.bundleService.getBundles().subscribe({
            next: (data) => {
                this.bundles = data;
                this.filterData();
            },
            error: (err) => {
                console.error(err);
                this.toastr.error('Failed to load bundles.', 'Error');
            }
        });
    }

    loadProducts(): void {
        this.productService.getProducts().subscribe({
            next: (data) => {
                this.products = data;
            },
            error: (err) => {
                console.error(err);
                this.toastr.error('Failed to load products.', 'Error');
            }
        });
    }

    changeActiveTab(tabName: string) {
        this.ActiveTab = tabName;
        if (tabName === 'Add') this.resetForm();
    }

    onSubmit(): void {
        if (this.bundleForm.invalid) {
            this.toastr.warning('Please fill all required fields.', 'Validation Error');
            return;
        }

        const bundleData = this.bundleForm.value;

        if (this.selectedBundleId) {
            this.bundleService.updateBundle(this.selectedBundleId, bundleData).subscribe({
                next: () => {
                    this.toastr.success('Bundle updated successfully!', 'Success');
                    this.resetForm();
                    this.loadBundles();
                },
                error: (err) => {
                    console.error(err);
                    this.toastr.error('Failed to update bundle.', 'Error');
                }
            });
        } else {
            this.bundleService.createBundle(bundleData).subscribe({
                next: () => {
                    this.toastr.success('Bundle created successfully!', 'Success');
                    this.resetForm();
                    this.loadBundles();
                },
                error: (err) => {
                    console.error(err);
                    this.toastr.error('Failed to create bundle.', 'Error');
                }
            });
        }
    }

    editBundle(bundleId: number): void {
        this.bundleService.getBundleById(bundleId.toString()).subscribe({
            next: (bundle) => {
                this.changeActiveTab('Add');
                this.selectedBundleId = bundleId.toString();
                this.bundleForm.patchValue({
                    bundle_name: bundle.bundle_name,
                    bundle_description: bundle.bundle_description,
                    bundle_price: bundle.bundle_price,
                    bundle_discount_price: bundle.bundle_discount_price,
                    is_active: bundle.is_active,
                    product_ids: bundle.products?.map(p => p.product_id) || []
                });
            },
            error: (err) => {
                console.error(err);
                this.toastr.error('Failed to fetch bundle details.', 'Error');
            }
        });
    }

    deleteBundle(bundleId: number): void {
        if (confirm('Are you sure you want to delete this bundle?')) {
            this.bundleService.deleteBundle(bundleId.toString()).subscribe({
                next: () => {
                    this.toastr.success('Bundle deleted successfully!', 'Success');
                    this.loadBundles();
                },
                error: (err) => {
                    console.error(err);
                    this.toastr.error('Failed to delete bundle.', 'Error');
                }
            });
        }
    }

    filterData(): void {
        this.filteredBundles = this.bundles.filter(bundle =>
            Object.values(bundle).some(value =>
                typeof value === 'string' && value.toLowerCase().includes(this.searchText.toLowerCase())
            )
        );

        this.totalPages = Math.ceil(this.filteredBundles.length / this.itemsPerPage);
        this.goToPage(1);
    }

    goToPage(page: number): void {
        if (page < 1 || page > this.totalPages) return;
        this.currentPage = page;
        const startIndex = (page - 1) * this.itemsPerPage;
        const endIndex = startIndex + this.itemsPerPage;
        this.paginatedData = this.filteredBundles.slice(startIndex, endIndex);
    }

    resetForm(): void {
        this.bundleForm.reset({
            bundle_name: '',
            bundle_description: '',
            bundle_price: 0,
            bundle_discount_price: 0,
            is_active: true,
            product_ids: []
        });
        this.selectedBundleId = null;
    }

    sortData(column: string): void {
        this.sortDirection = this.sortColumn === column ? !this.sortDirection : true;
        this.sortColumn = column;

        this.filteredBundles.sort((a: any, b: any) => {
            const valueA = a[column]?.toString().toLowerCase() || '';
            const valueB = b[column]?.toString().toLowerCase() || '';
            return this.sortDirection ? valueA.localeCompare(valueB) : valueB.localeCompare(valueA);
        });

        this.goToPage(1);
    }

    setItemsPerPage(items: number | string): void {
        if (items === 'all') {
            this.itemsPerPage = this.filteredBundles.length || 10;
        } else {
            this.itemsPerPage = Number(items);
        }
        this.currentPage = 1;
        this.filterData();
    }
}
