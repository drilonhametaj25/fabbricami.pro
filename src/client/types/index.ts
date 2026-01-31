/**
 * EcommerceERP - Type Definitions
 */

// ============================================
// COMMON
// ============================================

export interface PaginationParams {
  page: number;
  limit: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export interface PaginatedResponse<T> {
  items: T[];
  pagination: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

export interface ApiResponse<T> {
  success: boolean;
  data: T;
  error?: string;
  metadata?: {
    timestamp: string;
    version: string;
  };
}

export interface Address {
  street?: string;
  city?: string;
  zip?: string;
  state?: string;
  country?: string;
}

// ============================================
// USER & AUTH
// ============================================

export type UserRole = 'ADMIN' | 'MANAGER' | 'CONTABILE' | 'MAGAZZINIERE' | 'OPERATORE' | 'COMMERCIALE' | 'VIEWER';

export interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: UserRole;
  isActive: boolean;
  lastLogin?: string;
  createdAt: string;
}

export interface AuthState {
  user: User | null;
  token: string | null;
  refreshToken: string | null;
}

export interface LoginCredentials {
  email: string;
  password: string;
}

// ============================================
// PRODUCTS
// ============================================

export type ProductType = 'SIMPLE' | 'WITH_VARIANTS' | 'RAW_MATERIAL' | 'DIGITAL';
export type SyncStatus = 'NOT_SYNCED' | 'SYNCED' | 'PENDING' | 'ERROR';

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
  dimensions?: { width: number; height: number; depth: number };
  minStock: number;
  maxStock?: number;
  reorderPoint: number;
  reorderQuantity: number;
  leadTimeDays: number;
  isActive: boolean;
  isSellable: boolean;
  syncStatus: SyncStatus;
  lastSyncAt?: string;
  supplierId?: string;
  supplier?: Supplier;
  woocommerceId?: number;
  images: string[];
  createdAt: string;
  updatedAt: string;
}

export interface ProductVariant {
  id: string;
  productId: string;
  sku: string;
  name: string;
  attributes: Record<string, string>;
  barcode?: string;
  costDelta: number;
  priceDelta: number;
  isActive: boolean;
}

export interface BomItem {
  id: string;
  parentProductId: string;
  componentProductId: string;
  componentProduct?: Product;
  quantity: number;
  unit: string;
  scrapPercentage: number;
  notes?: string;
}

// ============================================
// INVENTORY
// ============================================

export type InventoryLocation = 'WEB' | 'B2B' | 'EVENTI' | 'TRANSITO';
export type MovementType = 'IN' | 'OUT' | 'TRANSFER' | 'ADJUSTMENT' | 'PRODUCTION' | 'RETURN';

export interface InventoryItem {
  id: string;
  warehouseId: string;
  warehouse?: Warehouse;
  productId: string;
  product?: Product;
  variantId?: string;
  variant?: ProductVariant;
  location: InventoryLocation;
  quantity: number;
  reservedQuantity: number;
  lotNumber?: string;
  expiryDate?: string;
  lastCountDate?: string;
}

export interface InventoryMovement {
  id: string;
  productId: string;
  product?: Product;
  fromLocation?: InventoryLocation;
  toLocation?: InventoryLocation;
  type: MovementType;
  quantity: number;
  lotNumber?: string;
  reference?: string;
  notes?: string;
  performedBy?: string;
  createdAt: string;
}

export interface Warehouse {
  id: string;
  code: string;
  name: string;
  description?: string;
  address?: Address;
  isActive: boolean;
  isPrimary: boolean;
  createdAt: string;
}

// ============================================
// CUSTOMERS
// ============================================

export type CustomerType = 'B2C' | 'B2B';

export interface WooCommerceAddress {
  firstName?: string;
  lastName?: string;
  company?: string;
  address1?: string;
  address2?: string;
  city?: string;
  state?: string;
  postcode?: string;
  country?: string;
  email?: string;
  phone?: string;
}

export interface CustomerContact {
  id: string;
  customerId: string;
  firstName: string;
  lastName: string;
  role?: string;
  department?: string;
  email?: string;
  phone?: string;
  mobile?: string;
  isPrimary: boolean;
  isActive: boolean;
  notes?: string;
  createdAt: string;
}

export interface CustomerBankInfo {
  id: string;
  customerId: string;
  bankName?: string;
  iban?: string;
  swift?: string;
  notes?: string;
  createdAt: string;
}

export interface Customer {
  id: string;
  type: CustomerType;
  code: string;
  businessName?: string;
  firstName?: string;
  lastName?: string;
  email?: string;
  phone?: string;
  taxId?: string;
  fiscalCode?: string;
  sdiCode?: string;
  pecEmail?: string;
  billingAddress?: WooCommerceAddress;
  shippingAddress?: WooCommerceAddress;
  address?: Address;
  paymentTerms: number;
  creditLimit?: number;
  discount: number;
  priceListId?: string;
  priceList?: PriceList;
  customerGroup?: string;
  acquisitionSource?: string;
  tags?: string[];
  isActive: boolean;
  wordpressId?: number;
  wcUsername?: string;
  wcAvatarUrl?: string;
  wcRole?: string;
  wcIsPayingCustomer?: boolean;
  wcOrdersCount?: number;
  wcTotalSpent?: number;
  syncStatus?: SyncStatus;
  lastSyncAt?: string;
  lastOrderDate?: string;
  totalOrders: number;
  totalSpent: number;
  contacts?: CustomerContact[];
  bankInfo?: CustomerBankInfo;
  notes?: string;
  createdAt: string;
  updatedAt?: string;
}

// ============================================
// PRICE LISTS (B2B)
// ============================================

export type DiscountType = 'PERCENTAGE' | 'FIXED' | 'OVERRIDE';

export interface PriceList {
  id: string;
  code: string;
  name: string;
  description?: string;
  isActive: boolean;
  isDefault: boolean;
  globalDiscount: number;
  validFrom?: string;
  validTo?: string;
  priority: number;
  items?: PriceListItem[];
  categoryDiscounts?: CategoryDiscount[];
  _count?: {
    items: number;
    customers: number;
    categoryDiscounts: number;
  };
  createdAt: string;
  updatedAt?: string;
}

export interface PriceListItem {
  id: string;
  priceListId: string;
  productId: string;
  product?: Product;
  discountPercent?: number;
  fixedPrice?: number;
  minQuantity: number;
  createdAt: string;
}

export interface CategoryDiscount {
  id: string;
  priceListId: string;
  categoryId: string;
  category?: ProductCategory;
  discountPercent: number;
  createdAt: string;
}

export interface ProductCategory {
  id: string;
  name: string;
  slug: string;
  description?: string;
  parentId?: string;
  woocommerceId?: number;
  image?: string;
  position: number;
  isActive: boolean;
}

export interface PriceCalculation {
  basePrice: number;
  finalPrice: number;
  discount: number;
  discountType: string;
  discountSource: string;
  priceListName?: string;
}

// ============================================
// ORDERS
// ============================================

export type OrderSource = 'WORDPRESS' | 'B2B' | 'MANUAL';
export type OrderStatus = 'PENDING' | 'CONFIRMED' | 'PROCESSING' | 'READY' | 'SHIPPED' | 'DELIVERED' | 'CANCELLED' | 'REFUNDED';

export interface Order {
  id: string;
  orderNumber: string;
  customerId: string;
  customer?: Customer;
  source: OrderSource;
  status: OrderStatus;
  subtotal: number;
  discount: number;
  tax: number;
  shipping: number;
  total: number;
  shippingAddress?: Address;
  billingAddress?: Address;
  paymentMethod?: string;
  paymentStatus?: string;
  wordpressId?: number;
  notes?: string;
  orderDate: string;
  shippedDate?: string;
  deliveredDate?: string;
  items?: OrderItem[];
  createdAt: string;
}

export interface OrderItem {
  id: string;
  orderId: string;
  productId: string;
  product?: Product;
  variantId?: string;
  productName: string;
  sku: string;
  quantity: number;
  unitPrice: number;
  tax: number;
  total: number;
}

// ============================================
// SUPPLIERS & PURCHASE ORDERS
// ============================================

export interface Supplier {
  id: string;
  code: string;
  businessName: string;
  email?: string;
  phone?: string;
  taxId?: string;
  address?: Address;
  paymentTerms: number;
  isActive: boolean;
  notes?: string;
  createdAt: string;
}

export type PurchaseOrderStatus = 'DRAFT' | 'SENT' | 'CONFIRMED' | 'PARTIALLY_RECEIVED' | 'RECEIVED' | 'CANCELLED';

export interface PurchaseOrder {
  id: string;
  orderNumber: string;
  supplierId: string;
  supplier?: Supplier;
  status: PurchaseOrderStatus;
  subtotal: number;
  tax: number;
  total: number;
  expectedDate?: string;
  receivedDate?: string;
  notes?: string;
  items?: PurchaseOrderItem[];
  createdAt: string;
}

export interface PurchaseOrderItem {
  id: string;
  purchaseOrderId: string;
  productId: string;
  product?: Product;
  quantity: number;
  receivedQuantity: number;
  unitPrice: number;
  tax: number;
  total: number;
}

// ============================================
// ACCOUNTING
// ============================================

export type InvoiceType = 'SALE' | 'PURCHASE';
export type InvoiceStatus = 'DRAFT' | 'ISSUED' | 'PAID' | 'PARTIALLY_PAID' | 'OVERDUE' | 'CANCELLED';
export type PaymentMethod = 'CASH' | 'BANK_TRANSFER' | 'CREDIT_CARD' | 'PAYPAL' | 'OTHER';
export type OverheadCategory = 'RENT' | 'UTILITIES' | 'INSURANCE' | 'MAINTENANCE' | 'OTHER';

export interface Invoice {
  id: string;
  invoiceNumber: string;
  type: InvoiceType;
  customerId?: string;
  customer?: Customer;
  orderId?: string;
  status: InvoiceStatus;
  issueDate: string;
  dueDate: string;
  paidDate?: string;
  subtotal: number;
  tax: number;
  total: number;
  paidAmount: number;
  notes?: string;
  createdAt: string;
}

export interface Payment {
  id: string;
  invoiceId?: string;
  supplierInvoiceId?: string;
  amount: number;
  method: PaymentMethod;
  reference?: string;
  paymentDate: string;
  notes?: string;
}

export interface OverheadCost {
  id: string;
  category: OverheadCategory;
  description: string;
  amount: number;
  startDate: string;
  endDate?: string;
  isRecurring: boolean;
  frequency?: string;
  allocationMethod: string;
}

// ============================================
// EMPLOYEES
// ============================================

export type TimeEntryType = 'WORK' | 'OVERTIME' | 'BREAK';
export type LeaveType = 'VACATION' | 'SICK' | 'PERSONAL' | 'OTHER';

export interface Employee {
  id: string;
  userId: string;
  user?: User;
  employeeCode: string;
  position: string;
  hourlyRate: number;
  hireDate: string;
  isActive: boolean;
  createdAt: string;
}

export interface TimeEntry {
  id: string;
  employeeId: string;
  employee?: Employee;
  type: TimeEntryType;
  clockIn: string;
  clockOut?: string;
  duration?: number;
  taskId?: string;
  notes?: string;
  createdAt: string;
}

export interface EmployeeLeave {
  id: string;
  employeeId: string;
  employee?: Employee;
  type: LeaveType;
  startDate: string;
  endDate: string;
  days: number;
  status: string;
  notes?: string;
}

// ============================================
// TASKS
// ============================================

export type TaskStatus = 'TODO' | 'IN_PROGRESS' | 'ON_HOLD' | 'COMPLETED' | 'CANCELLED';
export type TaskPriority = 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';

export interface Task {
  id: string;
  title: string;
  description?: string;
  orderId?: string;
  order?: Order;
  assignedToId?: string;
  assignedTo?: User;
  createdById: string;
  createdBy?: User;
  workflowId?: string;
  workflowStep?: number;
  status: TaskStatus;
  priority: TaskPriority;
  estimatedHours?: number;
  actualHours?: number;
  dueDate?: string;
  completedDate?: string;
  createdAt: string;
}

// ============================================
// NOTIFICATIONS
// ============================================

export type NotificationType = 'LOW_STOCK' | 'TASK_ASSIGNED' | 'TASK_OVERDUE' | 'PAYMENT_DUE' | 'PAYMENT_OVERDUE' | 'ORDER_RECEIVED' | 'SYSTEM' | 'CALENDAR_EVENT';

export interface Notification {
  id: string;
  userId: string;
  type: NotificationType;
  title: string;
  message: string;
  link?: string;
  isRead: boolean;
  createdAt: string;
}

// ============================================
// CALENDAR
// ============================================

export interface CalendarEvent {
  id: string;
  title: string;
  description?: string;
  eventType: string;
  startDate: string;
  endDate?: string;
  allDay: boolean;
  location?: string;
  relatedId?: string;
  reminderMinutes?: number;
  createdAt: string;
}

// ============================================
// ANALYTICS
// ============================================

export interface DashboardStats {
  ordersToday: number;
  revenueToday: number;
  revenueMonth: number;
  pendingOrders: number;
  lowStockProducts: number;
  overdueInvoices: number;
  tasksOverdue: number;
}

export interface ProductAnalytics {
  productId: string;
  sku: string;
  name: string;
  totalSold: number;
  revenue: number;
  margin: number;
  marginPercentage: number;
}

export interface CustomerAnalytics {
  customerId: string;
  name: string;
  totalOrders: number;
  totalSpent: number;
  avgOrderValue: number;
  lastOrderDate: string;
}

// ============================================
// MRP
// ============================================

export interface MRPRequirement {
  productId: string;
  sku: string;
  name: string;
  unit: string;
  requiredQuantity: number;
  availableQuantity: number;
  reservedQuantity: number;
  shortageQuantity: number;
  reorderPoint: number;
  reorderQuantity: number;
  leadTimeDays: number;
  supplierId?: string;
  supplierName?: string;
  suggestedOrderDate: string | null;
  priority: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
  estimatedCost: number;
}

// ============================================
// DASHBOARD "COSA FARE OGGI"
// ============================================

export interface GreetingSection {
  message: string;
  subMessage: string;
  userName: string;
  currentTime: string;
  dayOfWeek: string;
}

export interface KpiItem {
  id: string;
  label: string;
  value: number | string;
  previousValue?: number | string;
  changePercent?: number;
  trend?: 'up' | 'down' | 'stable';
  icon?: string;
  color?: string;
  link?: string;
}

export interface DailyKpiSection {
  items: KpiItem[];
  lastUpdated: string;
}

export type UrgentTaskType = 'ORDER' | 'TASK' | 'PRODUCTION' | 'PAYMENT' | 'STOCK' | 'SUPPLIER';
export type UrgentTaskPriority = 'CRITICAL' | 'HIGH' | 'MEDIUM';

export interface UrgentTask {
  id: string;
  type: UrgentTaskType;
  title: string;
  description: string;
  priority: UrgentTaskPriority;
  dueDate?: string;
  link: string;
  metadata?: Record<string, unknown>;
}

export interface UrgentTaskSection {
  items: UrgentTask[];
  total: number;
}

export type DayPlanItemType = 'MEETING' | 'TASK' | 'DEADLINE' | 'PRODUCTION' | 'DELIVERY' | 'OTHER';

export interface DayPlanItem {
  id: string;
  time?: string;
  title: string;
  description?: string;
  type: DayPlanItemType;
  completed: boolean;
  link?: string;
}

export interface DayPlanSection {
  items: DayPlanItem[];
  completedCount: number;
  totalCount: number;
}

export interface QuickStat {
  id: string;
  label: string;
  value: number | string;
  suffix?: string;
  color?: 'success' | 'warning' | 'danger' | 'info';
}

export interface QuickStatsSection {
  items: QuickStat[];
}

// Suggestion types
export type SuggestionType =
  | 'REORDER'
  | 'STOCKOUT_ALERT'
  | 'MARGIN_ALERT'
  | 'TREND_UP'
  | 'TREND_DOWN'
  | 'SEASONAL_PEAK'
  | 'BATCH_PRODUCTION'
  | 'ORDER_GROUPING'
  | 'DEAD_STOCK'
  | 'PAYMENT_DUE';

export type SuggestionPriority = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
export type SuggestionStatus = 'PENDING' | 'DISMISSED' | 'ACTED' | 'EXPIRED' | 'AUTO_RESOLVED';

export interface Suggestion {
  id: string;
  type: SuggestionType;
  priority: SuggestionPriority;
  status: SuggestionStatus;
  title: string;
  description: string;
  actionLabel?: string;
  actionLink?: string;
  data?: Record<string, unknown>;
  productId?: string;
  product?: Product;
  supplierId?: string;
  supplier?: Supplier;
  customerId?: string;
  expiresAt?: string;
  dismissedAt?: string;
  dismissedById?: string;
  dismissReason?: string;
  actedAt?: string;
  actedById?: string;
  createdAt: string;
}

export interface SuggestionStats {
  total: number;
  byPriority: Record<SuggestionPriority, number>;
  byType: Record<string, number>;
  byStatus: Record<SuggestionStatus, number>;
  actedThisWeek: number;
  dismissedThisWeek: number;
}

export interface SuggestionSection {
  items: Suggestion[];
  total: number;
  stats: SuggestionStats;
}

export interface TodayDashboard {
  greeting: GreetingSection;
  dailyKpis: DailyKpiSection;
  urgentTasks: UrgentTaskSection;
  dayPlan: DayPlanSection;
  suggestions: SuggestionSection;
  quickStats: QuickStatsSection;
}

export interface DashboardPreferences {
  layout?: Array<{
    id: string;
    position: number;
    size: 'small' | 'medium' | 'large';
    visible: boolean;
  }>;
  emailDailyDigest: boolean;
  emailWeeklyDigest: boolean;
  emailUrgentAlerts: boolean;
  showSuggestions: boolean;
  suggestionTypes?: string[];
  defaultDateRange: string;
  showKpis: boolean;
  showUrgentTasks: boolean;
  showDayPlan: boolean;
  compactMode: boolean;
}

export interface DashboardKpisResponse {
  current: {
    orders: number;
    revenue: number;
    avgOrderValue: number;
    newCustomers: number;
  };
  previous: {
    orders: number;
    revenue: number;
    avgOrderValue: number;
    newCustomers: number;
  };
  changes: {
    orders: number;
    revenue: number;
    avgOrderValue: number;
    newCustomers: number;
  };
  dateRange: string;
  startDate: string;
  endDate: string;
}
