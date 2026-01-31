// Shared Types and Constants

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

// User Roles
export enum UserRole {
  ADMIN = 'ADMIN',
  MANAGER = 'MANAGER',
  CONTABILE = 'CONTABILE',
  MAGAZZINIERE = 'MAGAZZINIERE',
  OPERATORE = 'OPERATORE',
  COMMERCIALE = 'COMMERCIALE',
  VIEWER = 'VIEWER',
}

// Product Types
export enum ProductType {
  SIMPLE = 'SIMPLE',
  WITH_VARIANTS = 'WITH_VARIANTS',
  RAW_MATERIAL = 'RAW_MATERIAL',
  DIGITAL = 'DIGITAL',
}

// Inventory Locations
export enum InventoryLocation {
  WEB = 'WEB',
  B2B = 'B2B',
  EVENTI = 'EVENTI',
  TRANSITO = 'TRANSITO',
}

// Order Status
export enum OrderStatus {
  PENDING = 'PENDING',
  CONFIRMED = 'CONFIRMED',
  PROCESSING = 'PROCESSING',
  READY = 'READY',
  SHIPPED = 'SHIPPED',
  DELIVERED = 'DELIVERED',
  CANCELLED = 'CANCELLED',
  REFUNDED = 'REFUNDED',
}

// Warehouse
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

// Product
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

// Product Variant
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

// BOM Item
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

// Product Operation (Work Process)
export interface ProductOperation {
  id: string;
  productId: string;
  operationName: string;
  sequence: number;
  standardTime: number; // minuti
  hourlyRate: number;
  setupTime: number;
  description?: string;
  createdAt: string;
  updatedAt: string;
}

// Inventory Item
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

// Constants
export const API_VERSION = 'v1';
export const DEFAULT_PAGE_SIZE = 20;
export const MAX_PAGE_SIZE = 100;
