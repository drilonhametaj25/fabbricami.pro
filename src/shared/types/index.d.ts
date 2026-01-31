export interface ApiResponse<T = any> {
    success: boolean;
    data?: T;
    error?: string;
    metadata?: {
        timestamp: string;
        version: string;
    };
}
export interface PaginatedResponse<T> {
    items: T[];
    pagination: {
        page: number;
        limit: number;
        total: number;
        totalPages: number;
        hasMore: boolean;
    };
}
export declare enum UserRole {
    ADMIN = "ADMIN",
    MANAGER = "MANAGER",
    CONTABILE = "CONTABILE",
    MAGAZZINIERE = "MAGAZZINIERE",
    OPERATORE = "OPERATORE",
    COMMERCIALE = "COMMERCIALE",
    VIEWER = "VIEWER"
}
export declare enum ProductType {
    SIMPLE = "SIMPLE",
    WITH_VARIANTS = "WITH_VARIANTS",
    RAW_MATERIAL = "RAW_MATERIAL",
    DIGITAL = "DIGITAL"
}
export declare enum InventoryLocation {
    WEB = "WEB",
    B2B = "B2B",
    EVENTI = "EVENTI",
    TRANSITO = "TRANSITO"
}
export declare enum OrderStatus {
    PENDING = "PENDING",
    CONFIRMED = "CONFIRMED",
    PROCESSING = "PROCESSING",
    READY = "READY",
    SHIPPED = "SHIPPED",
    DELIVERED = "DELIVERED",
    CANCELLED = "CANCELLED",
    REFUNDED = "REFUNDED"
}
export interface Warehouse {
    id: string;
    code: string;
    name: string;
    description?: string;
    address?: {
        street?: string;
        city?: string;
        zip?: string;
        country?: string;
    };
    isActive: boolean;
    isPrimary: boolean;
    createdAt: string;
    updatedAt: string;
}
export interface Product {
    id: string;
    sku: string;
    name: string;
    description?: string;
    type: ProductType;
    category?: string;
    unit: string;
    barcode?: string;
    cost: number;
    price: number;
    weight?: number;
    dimensions?: {
        width?: number;
        height?: number;
        depth?: number;
    };
    minStockLevel: number;
    reorderQuantity: number;
    leadTimeDays: number;
    isActive: boolean;
    isSellable: boolean;
    wordpressId?: number;
    supplierId?: string;
    createdAt: string;
    updatedAt: string;
}
export interface ProductVariant {
    id: string;
    productId: string;
    sku: string;
    name: string;
    attributes: Record<string, any>;
    barcode?: string;
    costDelta: number;
    priceDelta: number;
    isActive: boolean;
    createdAt: string;
    updatedAt: string;
}
export interface BomItem {
    id: string;
    parentProductId: string;
    componentProductId: string;
    quantity: number;
    unit: string;
    scrapPercentage: number;
    notes?: string;
    createdAt: string;
    updatedAt: string;
}
export interface ProductOperation {
    id: string;
    productId: string;
    operationName: string;
    sequence: number;
    standardTime: number;
    hourlyRate: number;
    setupTime: number;
    description?: string;
    createdAt: string;
    updatedAt: string;
}
export interface InventoryItem {
    id: string;
    warehouseId: string;
    productId: string;
    variantId?: string;
    location: InventoryLocation;
    quantity: number;
    reservedQuantity: number;
    lotNumber?: string;
    expiryDate?: string;
    lastCountDate?: string;
    createdAt: string;
    updatedAt: string;
}
export declare const API_VERSION = "v1";
export declare const DEFAULT_PAGE_SIZE = 20;
export declare const MAX_PAGE_SIZE = 100;
//# sourceMappingURL=index.d.ts.map