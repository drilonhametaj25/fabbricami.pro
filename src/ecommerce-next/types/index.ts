// Product Types
export interface Product {
  id: string;
  sku: string;
  name: string;
  slug: string;
  description?: string;
  price: number;
  salePrice?: number | null;
  onSale: boolean;
  featured?: boolean;
  inStock: boolean;
  stockStatus?: string;
  stockQuantity?: number;
  imageUrl: string | null;
  mainImageUrl?: string | null;
  images?: Array<string | { id: string; url: string; alt?: string }>;
  rating?: number | null;
  averageRating?: number | null;
  reviewCount?: number;
  category?: Category;
  categories?: Category[];
  isNew?: boolean;
}

export interface ProductDetail extends Product {
  description?: string;
  shortDescription?: string;
  weight?: number;
  dimensions?: { width: number; height: number; depth: number };
  images: Array<{ id: string; url: string; alt?: string }>;
  variants: ProductVariant[];
  relatedProducts: Product[];
  specifications?: Record<string, string>;
  meta?: {
    title: string;
    description: string;
  };
}

export interface ProductVariant {
  id: string;
  sku: string;
  name: string;
  attributes: Record<string, string>;
  price: number;
  salePrice?: number | null;
  onSale: boolean;
  inStock: boolean;
  stockQuantity?: number | null;
  imageUrl?: string | null;
}

// Category Types
export interface Category {
  id: string;
  name: string;
  slug: string;
  description?: string;
  imageUrl?: string | null;
  parentId?: string | null;
  productCount?: number;
  children?: Category[];
}

// Cart Types
export interface CartItem {
  id: string;
  productId: string;
  variantId?: string | null;
  quantity: number;
  unitPrice: number;
  product: {
    id: string;
    sku: string;
    name: string;
    slug: string;
    price: number;
    mainImageUrl: string | null;
    imageUrl?: string | null;
    weight?: number | null;
    wcStockStatus: string;
  };
  variant?: {
    id: string;
    sku: string;
    name: string;
    priceDelta: number;
    mainImageUrl: string | null;
  } | null;
}

export interface Cart {
  id: string;
  customerId?: string | null;
  sessionId?: string | null;
  subtotal: number;
  discount: number;
  shipping: number;
  tax: number;
  total: number;
  items: CartItem[];
  coupon?: {
    id: string;
    code: string;
    type: string;
    discountValue: number;
  } | null;
  shippingMethod?: {
    id: string;
    name: string;
    carrier: string;
    baseCost: number;
  } | null;
  shippingAddress?: ShippingAddress | null;
}

// Shipping Types
export interface ShippingAddress {
  firstName: string;
  lastName: string;
  company?: string;
  address1: string;
  address2?: string;
  city: string;
  state?: string;
  postcode: string;
  country: string;
  phone?: string;
}

export interface ShippingMethod {
  id: string;
  name: string;
  carrier: string;
  type: string;
  baseCost: number;
  freeAboveAmount?: number | null;
  estimatedDaysMin: number;
  estimatedDaysMax: number;
  description?: string;
  logoUrl?: string;
}

export interface ShippingCalculation {
  method: ShippingMethod;
  cost: number;
  estimatedDaysMin: number;
  estimatedDaysMax: number;
  isFreeShipping: boolean;
  amountForFreeShipping?: number;
}

// Wishlist Types
export interface WishlistItem {
  id: string;
  productId: string;
  variantId?: string | null;
  notifyRestock: boolean;
  addedAt: string;
  product: {
    id: string;
    sku: string;
    name: string;
    price: number;
    webPrice?: number | null;
    mainImageUrl: string | null;
    wcStockStatus: string;
    wcOnSale: boolean;
    wcSalePrice?: number | null;
  };
  variant?: {
    id: string;
    sku: string;
    name: string;
    priceDelta: number;
    webPrice?: number | null;
    mainImageUrl: string | null;
    wcStockStatus: string;
  } | null;
}

// Review Types
export interface Review {
  id: string;
  productId: string;
  customerId: string;
  rating: number;
  title?: string;
  comment?: string;
  pros?: string[];
  cons?: string[];
  images?: Array<{ url: string; thumbnail?: string }>;
  verified: boolean;
  status: string;
  helpfulCount: number;
  response?: string;
  respondedAt?: string;
  createdAt: string;
  customer: {
    id: string;
    firstName: string | null;
    lastName: string | null;
  };
}

export interface ReviewStats {
  averageRating: number;
  totalReviews: number;
  verifiedReviews: number;
  ratingDistribution: {
    1: number;
    2: number;
    3: number;
    4: number;
    5: number;
  };
}

// User/Auth Types
export interface User {
  id: string;
  email: string;
  firstName?: string;
  lastName?: string;
  customerId?: string;
}

export interface Customer {
  id: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  phone?: string | null;
  addresses?: Address[];
}

export interface Address {
  id: string;
  type: 'shipping' | 'billing';
  firstName: string;
  lastName: string;
  company?: string;
  address1: string;
  address2?: string;
  city: string;
  state?: string;
  postcode: string;
  country: string;
  phone?: string;
  isDefault: boolean;
}

// Order Types
export interface Order {
  id: string;
  orderNumber: string;
  status: string;
  subtotal: number;
  discount: number;
  shipping: number;
  tax: number;
  total: number;
  items: OrderItem[];
  shippingAddress: ShippingAddress;
  billingAddress?: ShippingAddress;
  paymentMethod: string;
  createdAt: string;
  updatedAt: string;
}

export interface OrderItem {
  id: string;
  productId: string;
  variantId?: string;
  name: string;
  sku: string;
  quantity: number;
  unitPrice: number;
  total: number;
  imageUrl?: string;
}

// API Response Types
export interface ApiResponse<T> {
  success: boolean;
  data: T;
  error?: string | null;
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
  };
}

// Filter Types
export interface ProductFilters {
  page?: number;
  limit?: number;
  category?: string;
  search?: string;
  minPrice?: number;
  maxPrice?: number;
  inStock?: boolean;
  onSale?: boolean;
  featured?: boolean;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}
