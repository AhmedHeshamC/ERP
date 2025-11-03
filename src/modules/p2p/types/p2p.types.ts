/**
 * P2P (Procure-to-Pay) Module Types and Interfaces
 * Following SOLID principles with single responsibility for each type definition
 */

// P2P Process States and Enums
export enum P2PProcessState {
  DRAFT = 'DRAFT',
  SUBMITTED = 'SUBMITTED',
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED',
  IN_PROGRESS = 'IN_PROGRESS',
  COMPLETED = 'COMPLETED',
  CANCELLED = 'CANCELLED',
  ON_HOLD = 'ON_HOLD'
}

export enum RequisitionPriority {
  LOW = 'LOW',
  NORMAL = 'NORMAL',
  HIGH = 'HIGH',
  URGENT = 'URGENT'
}

export enum RequisitionType {
  STOCK = 'STOCK',
  DIRECT = 'DIRECT',
  SERVICE = 'SERVICE',
  ASSET = 'ASSET'
}

export enum MatchingStatus {
  PENDING = 'PENDING',
  MATCHED = 'MATCHED',
  MISMATCHED = 'MISMATCHED',
  VARIANCE_ACCEPTED = 'VARIANCE_ACCEPTED',
  EXCEPTION = 'EXCEPTION'
}

export enum InvoiceStatus {
  DRAFT = 'DRAFT',
  RECEIVED = 'RECEIVED',
  VALIDATED = 'VALIDATED',
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED',
  PAID = 'PAID',
  OVERDUE = 'OVERDUE',
  CANCELLED = 'CANCELLED'
}

export enum PaymentStatus {
  PENDING = 'PENDING',
  SCHEDULED = 'SCHEDULED',
  PROCESSING = 'PROCESSING',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED',
  CANCELLED = 'CANCELLED'
}

// Core Domain Entities
export interface PurchaseRequisition {
  id: string;
  requestNumber: string;
  title: string;
  description?: string;
  requestorId: string;
  departmentId: string;
  priority: RequisitionPriority;
  type: RequisitionType;
  status: P2PProcessState;
  totalAmount: number;
  currency: string;
  requiredDate: Date;
  justification?: string;
  items: RequisitionItem[];
  approvals: RequisitionApproval[];
  attachments: string[];
  createdAt: Date;
  updatedAt: Date;
  submittedAt?: Date;
  approvedAt?: Date;
  completedAt?: Date;
}

export interface RequisitionItem {
  id: string;
  requisitionId: string;
  productId?: string;
  description: string;
  quantity: number;
  unitPrice?: number;
  estimatedPrice: number;
  currency: string;
  uom: string;
  specifications?: string;
  preferredSupplier?: string;
  suggestedSuppliers: string[];
  category: string;
  requestedDeliveryDate: Date;
  notes?: string;
}

export interface RequisitionApproval {
  id: string;
  requisitionId: string;
  approverId: string;
  approverName: string;
  approverRole: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  comments?: string;
  approvedAt?: Date;
  level: number;
  isRequired: boolean;
  isDelegated?: boolean;
  delegatedTo?: string;
}

// Supplier Management Types
export interface SupplierQualification {
  id: string;
  supplierId: string;
  category: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'SUSPENDED';
  score: number;
  certifications: Certification[];
  capabilities: Capability[];
  performanceHistory: PerformanceMetric[];
  validFrom: Date;
  validUntil?: Date;
  approvedBy?: string;
  approvedAt?: Date;
  lastReviewDate: Date;
  nextReviewDate: Date;
}

export interface Certification {
  id: string;
  name: string;
  type: string;
  certificateNumber: string;
  issuedBy: string;
  issuedDate: Date;
  expiryDate: Date;
  status: 'ACTIVE' | 'EXPIRED' | 'SUSPENDED';
  documents: string[];
}

export interface Capability {
  category: string;
  description: string;
  capacity: number;
  leadTime: number;
  qualityRating: number;
  costRating: number;
}

export interface PerformanceMetric {
  id: string;
  period: string;
  type: 'QUALITY' | 'DELIVERY' | 'COST' | 'SERVICE';
  metric: string;
  value: number;
  target: number;
  achieved: boolean;
  trend: 'IMPROVING' | 'STABLE' | 'DECLINING';
}

// Purchase Order Types
export interface PurchaseOrderEnhanced {
  id: string;
  orderNumber: string;
  requisitionId?: string;
  supplierId: string;
  status: P2PProcessState;
  orderDate: Date;
  expectedDeliveryDate: Date;
  actualDeliveryDate?: Date;
  subtotal: number;
  taxAmount: number;
  totalAmount: number;
  currency: string;
  paymentTerms: string;
  deliveryTerms: string;
  shippingAddress: Address;
  billingAddress: Address;
  notes?: string;
  attachments: string[];
  items: PurchaseOrderItemEnhanced[];
  approvals: PurchaseOrderApproval[];
  receipts: PurchaseReceiptEnhanced[];
  invoices: Invoice[];
  createdAt: Date;
  updatedAt: Date;
  approvedAt?: Date;
  sentAt?: Date;
  confirmedAt?: Date;
  closedAt?: Date;
}

export interface PurchaseOrderItemEnhanced {
  id: string;
  orderId: string;
  requisitionItemId?: string;
  productId?: string;
  supplierSku?: string;
  description: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  currency: string;
  discount: number;
  taxRate: number;
  taxAmount: number;
  uom: string;
  expectedDeliveryDate: Date;
  actualDeliveryDate?: Date;
  specifications?: string;
  qualityRequirements?: string;
  receivedQuantity: number;
  acceptedQuantity: number;
  rejectedQuantity: number;
  notes?: string;
}

export interface PurchaseOrderApproval {
  id: string;
  orderId: string;
  approverId: string;
  approverName: string;
  approverRole: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  comments?: string;
  approvedAt?: Date;
  level: number;
  isRequired: boolean;
  delegationChain?: string[];
}

// Receiving and Inspection Types
export interface PurchaseReceiptEnhanced {
  id: string;
  receiptNumber: string;
  orderId: string;
  status: 'DRAFT' | 'IN_PROGRESS' | 'COMPLETED' | 'REJECTED';
  receiptDate: Date;
  receivedBy: string;
  deliveryNoteNumber?: string;
  carrier?: string;
  vehicleNumber?: string;
  notes?: string;
  items: ReceiptItem[];
  inspections: QualityInspection[];
  documents: string[];
  createdAt: Date;
  updatedAt: Date;
  completedAt?: Date;
}

export interface ReceiptItem {
  id: string;
  receiptId: string;
  orderItemId: string;
  productId?: string;
  description: string;
  orderedQuantity: number;
  receivedQuantity: number;
  acceptedQuantity: number;
  rejectedQuantity: number;
  pendingQuantity: number;
  unitPrice: number;
  batchNumber?: string;
  expiryDate?: Date;
  lotNumber?: string;
  serialNumbers?: string[];
  storageLocation?: string;
  condition: 'EXCELLENT' | 'GOOD' | 'ACCEPTABLE' | 'DAMAGED' | 'DEFECTIVE';
  notes?: string;
}

export interface QualityInspection {
  id: string;
  receiptId: string;
  receiptItemId: string;
  inspectorId: string;
  inspectorName: string;
  inspectionDate: Date;
  status: 'PENDING' | 'PASSED' | 'FAILED' | 'CONDITIONAL_PASS';
  overallResult: 'ACCEPT' | 'REJECT' | 'ACCEPT_WITH_RESERVATIONS';
  criteria: InspectionCriterion[];
  defects: DefectRecord[];
  recommendations: string[];
  nextInspectionDate?: Date;
  documents: string[];
  notes?: string;
}

export interface InspectionCriterion {
  id: string;
  name: string;
  description: string;
  type: 'QUANTITATIVE' | 'QUALITATIVE';
  specification: string;
  tolerance?: string;
  measurement?: number;
  unit?: string;
  result: 'PASS' | 'FAIL' | 'WARNING';
  notes?: string;
}

export interface DefectRecord {
  id: string;
  type: string;
  severity: 'MINOR' | 'MAJOR' | 'CRITICAL';
  description: string;
  quantity: number;
  action: 'ACCEPT' | 'REJECT' | 'REWORK' | 'RETURN';
  disposition?: string;
  costImpact?: number;
  photos?: string[];
  reportedBy: string;
  reportedAt: Date;
}

// Invoice and Payment Types
export interface InvoiceEnhanced {
  id: string;
  invoiceNumber: string;
  orderId: string;
  supplierId: string;
  status: InvoiceStatus;
  invoiceDate: Date;
  dueDate: Date;
  currency: string;
  subtotal: number;
  taxAmount: number;
  totalAmount: number;
  discountAmount?: number;
  paidAmount: number;
  balanceAmount: number;
  matchingStatus: MatchingStatus;
  matchingDetails: MatchingDetail[];
  approvals: InvoiceApproval[];
  payments: Payment[];
  notes?: string;
  attachments: string[];
  createdAt: Date;
  updatedAt: Date;
  receivedAt?: Date;
  approvedAt?: Date;
  paidAt?: Date;
}

export interface MatchingDetail {
  id: string;
  invoiceId: string;
  orderId: string;
  receiptId: string;
  type: 'THREE_WAY' | 'TWO_WAY';
  status: MatchingStatus;
  poAmount: number;
  receiptAmount: number;
  invoiceAmount: number;
  varianceAmount: number;
  variancePercentage: number;
  tolerance: number;
  issues: MatchingIssue[];
  resolvedAt?: Date;
  resolvedBy?: string;
}

export interface MatchingIssue {
  id: string;
  type: 'QUANTITY_VARIANCE' | 'PRICE_VARIANCE' | 'TAX_VARIANCE' | 'ITEM_MISMATCH' | 'MISSING_RECEIPT';
  description: string;
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  expectedValue: number;
  actualValue: number;
  variance: number;
  tolerance: number;
  action: 'AUTO_ACCEPT' | 'MANUAL_REVIEW' | 'REJECT' | 'ESCALATE';
  resolved: boolean;
  resolvedAt?: Date;
  resolvedBy?: string;
  resolution?: string;
}

export interface InvoiceApproval {
  id: string;
  invoiceId: string;
  approverId: string;
  approverName: string;
  approverRole: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  comments?: string;
  approvedAt?: Date;
  level: number;
  isRequired: boolean;
}

export interface Payment {
  id: string;
  paymentNumber: string;
  invoiceId: string;
  supplierId: string;
  status: PaymentStatus;
  amount: number;
  currency: string;
  paymentDate: Date;
  scheduledDate?: Date;
  paymentMethod: string;
  referenceNumber?: string;
  bankAccount?: string;
  approvalRequired: boolean;
  approvedBy?: string;
  approvedAt?: Date;
  processedBy?: string;
  processedAt?: Date;
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}

// Workflow and Event Types
export interface P2PWorkflowContext {
  processType: 'REQUISITION' | 'PURCHASE_ORDER' | 'RECEIPT' | 'INVOICE' | 'PAYMENT';
  entityId: string;
  entityData: any;
  initiatorId: string;
  currentStep: string;
  previousStep?: string;
  variables: Record<string, any>;
  metadata: Record<string, any>;
  startTime: Date;
  correlationId: string;
}

export interface P2PEvent {
  id: string;
  eventType: string;
  entityType: string;
  entityId: string;
  data: any;
  userId?: string;
  timestamp: Date;
  correlationId?: string;
  source: string;
  version: string;
}

// Configuration and Rule Types
export interface P2PConfiguration {
  approvalRules: ApprovalRule[];
  matchingRules: MatchingRule[];
  paymentRules: PaymentRule[];
  supplierSelectionRules: SupplierSelectionRule[];
  notificationSettings: NotificationSettings;
  integrationSettings: IntegrationSettings;
}

export interface ApprovalRule {
  id: string;
  processType: string;
  condition: string;
  approvers: ApproverDefinition[];
  escalationRule?: EscalationRule;
  isActive: boolean;
  priority: number;
}

export interface ApproverDefinition {
  userId?: string;
  roleId?: string;
  level: number;
  required: boolean;
  timeoutHours?: number;
  delegateTo?: string;
}

export interface EscalationRule {
  afterHours: number;
  escalateTo: string[];
  notificationTemplate: string;
}

export interface MatchingRule {
  id: string;
  name: string;
  type: 'THREE_WAY' | 'TWO_WAY';
  tolerancePercentage: number;
  toleranceAmount: number;
  varianceHandling: 'AUTO_ACCEPT' | 'MANUAL_REVIEW' | 'REJECT';
  conditions: string[];
  isActive: boolean;
}

export interface PaymentRule {
  id: string;
  name: string;
  condition: string;
  paymentTerms: string;
  discountDays?: number;
  discountPercentage?: number;
  priority: number;
  isActive: boolean;
}

export interface SupplierSelectionRule {
  id: string;
  category: string;
  criteria: SelectionCriteria[];
  minimumScore: number;
  maxSuppliers: number;
  considerPreviousPerformance: boolean;
  considerCapacity: boolean;
  isActive: boolean;
}

export interface SelectionCriteria {
  factor: 'PRICE' | 'QUALITY' | 'DELIVERY' | 'SERVICE' | 'CAPACITY';
  weight: number;
  measurement: string;
  threshold?: number;
}

// Supporting Types
export interface Address {
  line1: string;
  line2?: string;
  city: string;
  state: string;
  postalCode: string;
  country: string;
}

export interface NotificationSettings {
  email: boolean;
  sms: boolean;
  inApp: boolean;
  templates: Record<string, string>;
  recipients: Record<string, string[]>;
}

export interface IntegrationSettings {
  accountingSystem: boolean;
  bankingSystem: boolean;
  supplierPortal: boolean;
  inventorySystem: boolean;
  apiEndpoints: Record<string, string>;
  webhooks: Record<string, string>;
}

// API DTO Types
export interface CreateRequisitionDto {
  title: string;
  description?: string;
  departmentId: string;
  priority: RequisitionPriority;
  type: RequisitionType;
  requiredDate: string;
  justification?: string;
  items: CreateRequisitionItemDto[];
}

export interface CreateRequisitionItemDto {
  productId?: string;
  description: string;
  quantity: number;
  unitPrice?: number;
  estimatedPrice: number;
  currency: string;
  uom: string;
  specifications?: string;
  preferredSupplier?: string;
  suggestedSuppliers: string[];
  category: string;
  requestedDeliveryDate: string;
  notes?: string;
}

export interface UpdateRequisitionDto {
  title?: string;
  description?: string;
  priority?: RequisitionPriority;
  requiredDate?: string;
  justification?: string;
  items?: CreateRequisitionItemDto[];
}

export interface RequisitionQueryDto {
  status?: P2PProcessState;
  priority?: RequisitionPriority;
  type?: RequisitionType;
  requestorId?: string;
  departmentId?: string;
  dateFrom?: string;
  dateTo?: string;
  search?: string;
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export interface SupplierSelectionDto {
  category: string;
  items: SupplierSelectionItemDto[];
  criteria?: SelectionCriteria[];
  maxSuppliers?: number;
}

export interface SupplierSelectionItemDto {
  description: string;
  quantity: number;
  specifications?: string;
  category: string;
  deliveryLocation?: string;
  deliveryDate?: string;
}

export interface SupplierRecommendationDto {
  supplierId: string;
  supplierName: string;
  score: number;
  rank: number;
  reasons: string[];
  estimatedPrice?: number;
  estimatedDeliveryDate?: string;
  strengths: string[];
  weaknesses: string[];
  lastOrderDate?: string;
  totalOrders?: number;
  performanceScore?: number;
}

// Error Types
export class P2PError extends Error {
  public readonly code: string;
  public readonly category: 'VALIDATION' | 'BUSINESS_RULE' | 'SYSTEM' | 'INTEGRATION';
  public readonly details?: Record<string, any>;

  constructor(
    code: string,
    message: string,
    category: P2PError['category'],
    details?: Record<string, any>
  ) {
    super(message);
    this.name = 'P2PError';
    this.code = code;
    this.category = category;
    this.details = details;
  }
}

export class RequisitionValidationError extends P2PError {
  constructor(message: string, details?: Record<string, any>) {
    super('REQUISITION_VALIDATION_ERROR', message, 'VALIDATION', details);
  }
}

export class SupplierSelectionError extends P2PError {
  constructor(message: string, details?: Record<string, any>) {
    super('SUPPLIER_SELECTION_ERROR', message, 'BUSINESS_RULE', details);
  }
}

export class OrderCreationError extends P2PError {
  constructor(message: string, details?: Record<string, any>) {
    super('ORDER_CREATION_ERROR', message, 'BUSINESS_RULE', details);
  }
}

export class MatchingError extends P2PError {
  constructor(message: string, details?: Record<string, any>) {
    super('MATCHING_ERROR', message, 'BUSINESS_RULE', details);
  }
}

export class PaymentProcessingError extends P2PError {
  constructor(message: string, details?: Record<string, any>) {
    super('PAYMENT_PROCESSING_ERROR', message, 'SYSTEM', details);
  }
}

// Constants
export const P2P_CONSTANTS = {
  // Default values
  DEFAULT_CURRENCY: 'USD',
  DEFAULT_PAYMENT_TERMS: 'NET30',
  DEFAULT_TAX_RATE: 0,

  // Tolerances
  DEFAULT_MATCHING_TOLERANCE_PERCENTAGE: 5,
  DEFAULT_PRICE_VARIANCE_TOLERANCE: 10,
  DEFAULT_QUANTITY_VARIANCE_TOLERANCE: 5,

  // Timeouts and delays
  APPROVAL_TIMEOUT_HOURS: 72,
  ESCALATION_TIMEOUT_HOURS: 24,
  PAYMENT_PROCESSING_DAYS: 3,

  // Limits
  MAX_REQUISITION_ITEMS: 50,
  MAX_APPROVAL_LEVELS: 5,
  MAX_SUPPLIER_RECOMMENDATIONS: 10,

  // Workflow
  WORKFLOW_TIMEOUT_MINUTES: 4320, // 72 hours
  MAX_RETRY_ATTEMPTS: 3,

  // Notifications
  NOTIFICATION_RETRY_ATTEMPTS: 3,
  BATCH_SIZE: 100,
} as const;