/**
 * P2P Service Interfaces following Interface Segregation Principle
 * Each interface focuses on a specific P2P capability
 */

import {
  PurchaseRequisition,
  RequisitionItem,
  RequisitionApproval,
  CreateRequisitionDto,
  UpdateRequisitionDto,
  RequisitionQueryDto,
  SupplierQualification,
  SupplierSelectionDto,
  SupplierRecommendationDto,
  PurchaseOrderEnhanced,
  PurchaseOrderItemEnhanced,
  PurchaseReceiptEnhanced,
  ReceiptItem,
  QualityInspection,
  InvoiceEnhanced,
  MatchingDetail,
  Payment,
  P2PWorkflowContext,
  P2PEvent
} from '../types/p2p.types';

// Purchase Requisition Service Interface
export interface IPurchaseRequisitionService {
  // Core requisition operations
  createRequisition(dto: CreateRequisitionDto, requestorId: string): Promise<PurchaseRequisition>;
  updateRequisition(id: string, dto: UpdateRequisitionDto, userId: string): Promise<PurchaseRequisition>;
  getRequisition(id: string): Promise<PurchaseRequisition>;
  queryRequisitions(query: RequisitionQueryDto): Promise<{ items: PurchaseRequisition[]; total: number }>;

  // Requisition lifecycle
  submitRequisition(id: string, userId: string): Promise<PurchaseRequisition>;
  approveRequisition(id: string, approverId: string, comments?: string): Promise<PurchaseRequisition>;
  rejectRequisition(id: string, approverId: string, reason: string): Promise<PurchaseRequisition>;
  cancelRequisition(id: string, userId: string, reason: string): Promise<PurchaseRequisition>;

  // Requisition items management
  addRequisitionItem(requisitionId: string, item: Omit<RequisitionItem, 'id' | 'requisitionId'>): Promise<RequisitionItem>;
  updateRequisitionItem(itemId: string, updates: Partial<RequisitionItem>): Promise<RequisitionItem>;
  removeRequisitionItem(itemId: string): Promise<void>;

  // Approval workflow
  getApprovalHistory(requisitionId: string): Promise<RequisitionApproval[]>;
  getNextApprovalLevel(requisitionId: string): Promise<number>;
  canApprove(requisitionId: string, userId: string): Promise<boolean>;

  // Validation and compliance
  validateRequisition(requisition: PurchaseRequisition): Promise<{ valid: boolean; errors: string[] }>;
  checkBudgetAvailability(requisitionId: string): Promise<{ available: boolean; amount: number }>;
}

// Supplier Management Service Interface
export interface ISupplierManagementService {
  // Supplier qualification and assessment
  qualifySupplier(supplierId: string, category: string): Promise<SupplierQualification>;
  updateQualification(qualificationId: string, updates: Partial<SupplierQualification>): Promise<SupplierQualification>;
  getQualifiedSuppliers(category?: string): Promise<SupplierQualification[]>;

  // Automated supplier selection
  recommendSuppliers(selectionDto: SupplierSelectionDto): Promise<SupplierRecommendationDto[]>;
  evaluateSupplier(supplierId: string, criteria: any): Promise<{ score: number; details: any }>;

  // Supplier performance tracking
  updateSupplierPerformance(supplierId: string, metrics: any): Promise<void>;
  getSupplierPerformance(supplierId: string, period?: string): Promise<any>;

  // Supplier relationship management
  activateSupplier(supplierId: string): Promise<void>;
  suspendSupplier(supplierId: string, reason: string): Promise<void>;
  deactivateSupplier(supplierId: string, reason: string): Promise<void>;

  // Compliance and documentation
  validateSupplierCompliance(supplierId: string): Promise<{ compliant: boolean; issues: string[] }>;
  getSupplierDocuments(supplierId: string): Promise<string[]>;
}

// Purchase Order Service Interface
export interface IPurchaseOrderService {
  // Order creation and management
  createOrder(requisitionId: string, supplierId: string, userId: string): Promise<PurchaseOrderEnhanced>;
  updateOrder(id: string, updates: Partial<PurchaseOrderEnhanced>, userId: string): Promise<PurchaseOrderEnhanced>;
  getOrder(id: string): Promise<PurchaseOrderEnhanced>;
  queryOrders(filters: any): Promise<{ items: PurchaseOrderEnhanced[]; total: number }>;

  // Order lifecycle
  submitOrder(id: string, userId: string): Promise<PurchaseOrderEnhanced>;
  approveOrder(id: string, approverId: string, comments?: string): Promise<PurchaseOrderEnhanced>;
  rejectOrder(id: string, approverId: string, reason: string): Promise<PurchaseOrderEnhanced>;
  cancelOrder(id: string, userId: string, reason: string): Promise<PurchaseOrderEnhanced>;
  closeOrder(id: string, userId: string): Promise<PurchaseOrderEnhanced>;

  // Order items management
  addOrderItem(orderId: string, item: Omit<PurchaseOrderItemEnhanced, 'id' | 'orderId'>): Promise<PurchaseOrderItemEnhanced>;
  updateOrderItem(itemId: string, updates: Partial<PurchaseOrderItemEnhanced>): Promise<PurchaseOrderItemEnhanced>;
  removeOrderItem(itemId: string): Promise<void>;

  // Order fulfillment
  updateDeliveryDate(orderId: string, deliveryDate: Date): Promise<PurchaseOrderEnhanced>;
  confirmOrder(orderId: string, confirmationDetails: any): Promise<PurchaseOrderEnhanced>;

  // Integration
  sendOrderToSupplier(orderId: string): Promise<{ sent: boolean; method: string; reference?: string }>;
  getOrderStatusFromSupplier(orderId: string): Promise<any>;
}

// Receiving Service Interface
export interface IReceivingService {
  // Receipt creation and management
  createReceipt(orderId: string, receivedBy: string): Promise<PurchaseReceiptEnhanced>;
  updateReceipt(receiptId: string, updates: Partial<PurchaseReceiptEnhanced>): Promise<PurchaseReceiptEnhanced>;
  getReceipt(receiptId: string): Promise<PurchaseReceiptEnhanced>;
  queryReceipts(filters: any): Promise<{ items: PurchaseReceiptEnhanced[]; total: number }>;

  // Receipt processing
  addReceiptItem(receiptId: string, item: Omit<ReceiptItem, 'id' | 'receiptId'>): Promise<ReceiptItem>;
  updateReceiptItem(itemId: string, updates: Partial<ReceiptItem>): Promise<ReceiptItem>;
  completeReceipt(receiptId: string, completedBy: string): Promise<PurchaseReceiptEnhanced>;

  // Quality inspection
  createInspection(receiptId: string, receiptItemId: string, inspectorId: string): Promise<QualityInspection>;
  updateInspection(inspectionId: string, updates: Partial<QualityInspection>): Promise<QualityInspection>;
  recordDefect(inspectionId: string, defect: any): Promise<void>;
  approveInspection(inspectionId: string, approvedBy: string): Promise<QualityInspection>;

  // Inventory integration
  updateStockLevels(receiptId: string): Promise<void>;
  generatePutAwayList(receiptId: string): Promise<any>;
}

// Three-Way Matching Service Interface
export interface IThreeWayMatchingService {
  // Matching operations
  performMatching(invoiceId: string): Promise<MatchingDetail>;
  rematchInvoice(invoiceId: string): Promise<MatchingDetail>;
  getMatchingDetails(invoiceId: string): Promise<MatchingDetail>;

  // Matching rules and configuration
  configureMatchingRules(rules: any): Promise<void>;
  validateMatchingRules(): Promise<{ valid: boolean; errors: string[] }>;

  // Exception handling
  handleMatchingVariance(matchingId: string, action: string, notes?: string): Promise<MatchingDetail>;
  escalateMatchingException(matchingId: string, escalationDetails: any): Promise<void>;

  // Reporting and analytics
  getMatchingMetrics(filters?: any): Promise<any>;
  getExceptionReports(filters?: any): Promise<any>;
}

// Invoice Processing Service Interface
export interface IInvoiceProcessingService {
  // Invoice creation and management
  createInvoice(invoiceData: any): Promise<InvoiceEnhanced>;
  updateInvoice(id: string, updates: Partial<InvoiceEnhanced>): Promise<InvoiceEnhanced>;
  getInvoice(id: string): Promise<InvoiceEnhanced>;
  queryInvoices(filters: any): Promise<{ items: InvoiceEnhanced[]; total: number }>;

  // Invoice validation and processing
  validateInvoice(invoiceId: string): Promise<{ valid: boolean; errors: string[]; warnings: string[] }>;
  processInvoice(invoiceId: string): Promise<InvoiceEnhanced>;
  approveInvoice(invoiceId: string, approverId: string, comments?: string): Promise<InvoiceEnhanced>;
  rejectInvoice(invoiceId: string, approverId: string, reason: string): Promise<InvoiceEnhanced>;

  // Invoice lifecycle
  holdInvoice(invoiceId: string, reason: string): Promise<InvoiceEnhanced>;
  releaseInvoice(invoiceId: string, releasedBy: string): Promise<InvoiceEnhanced>;
  voidInvoice(invoiceId: string, reason: string): Promise<InvoiceEnhanced>;

  // Integration
  sendInvoiceToAccounting(invoiceId: string): Promise<{ sent: boolean; reference?: string }>;
  getInvoiceFromSupplier(supplierId: string, invoiceNumber: string): Promise<any>;
}

// Payment Execution Service Interface
export interface IPaymentExecutionService {
  // Payment creation and management
  createPayment(invoiceId: string, paymentDetails: any): Promise<Payment>;
  updatePayment(paymentId: string, updates: Partial<Payment>): Promise<Payment>;
  getPayment(paymentId: string): Promise<Payment>;
  queryPayments(filters: any): Promise<{ items: Payment[]; total: number }>;

  // Payment processing
  schedulePayment(paymentId: string, scheduledDate: Date): Promise<Payment>;
  processPayment(paymentId: string): Promise<Payment>;
  cancelPayment(paymentId: string, reason: string): Promise<Payment>;

  // Payment approval
  approvePayment(paymentId: string, approverId: string): Promise<Payment>;
  rejectPayment(paymentId: string, approverId: string, reason: string): Promise<Payment>;

  // Integration
  sendPaymentToBank(paymentId: string): Promise<{ sent: boolean; reference?: string }>;
  getPaymentStatusFromBank(paymentId: string): Promise<any>;

  // Cash management
  optimizePaymentSchedule(invoices: InvoiceEnhanced[]): Promise<Payment[]>;
  forecastCashOutflows(filters?: any): Promise<any>;
}

// P2P Workflow Service Interface
export interface IP2PWorkflowService {
  // Workflow management
  startWorkflow(context: P2PWorkflowContext): Promise<string>;
  advanceWorkflow(instanceId: string, action: string, data?: any): Promise<void>;
  suspendWorkflow(instanceId: string, reason: string): Promise<void>;
  resumeWorkflow(instanceId: string, userId: string): Promise<void>;
  terminateWorkflow(instanceId: string, reason: string): Promise<void>;

  // Workflow status and history
  getWorkflowStatus(instanceId: string): Promise<any>;
  getWorkflowHistory(instanceId: string): Promise<any[]>;
  getPendingWorkflows(userId: string): Promise<any[]>;

  // Workflow configuration
  defineWorkflow(definition: any): Promise<void>;
  updateWorkflowDefinition(workflowId: string, updates: any): Promise<void>;
  activateWorkflow(workflowId: string): Promise<void>;
  deactivateWorkflow(workflowId: string): Promise<void>;
}

// P2P Event Service Interface
export interface IP2PEventService {
  // Event publishing and handling
  publishEvent(event: P2PEvent): Promise<void>;
  subscribeToEvents(eventType: string, handler: (event: P2PEvent) => Promise<void>): Promise<string>;
  unsubscribeFromEvents(subscriptionId: string): Promise<void>;

  // Event querying and analysis
  getEvents(filters: any): Promise<P2PEvent[]>;
  getEventTimeline(entityId: string, entityType: string): Promise<P2PEvent[]>;

  // Event replay and recovery
  replayEvents(fromDate: Date, toDate: Date, eventType?: string): Promise<void>;
  getEventStatistics(filters?: any): Promise<any>;
}

// P2P Analytics Service Interface
export interface IP2PAnalyticsService {
  // Performance metrics
  getProcurementMetrics(filters?: any): Promise<any>;
  getSupplierMetrics(supplierId?: string, filters?: any): Promise<any>;
  getProcessMetrics(processType: string, filters?: any): Promise<any>;

  // Cost analysis
  getSpendAnalysis(filters?: any): Promise<any>;
  getPriceVarianceAnalysis(filters?: any): Promise<any>;
  getCostSavingsOpportunities(filters?: any): Promise<any>;

  // Efficiency metrics
  getProcurementCycleTime(filters?: any): Promise<any>;
  getApprovalEfficiencyMetrics(filters?: any): Promise<any>;
  getMatchingEfficiencyMetrics(filters?: any): Promise<any>;

  // Predictive analytics
  forecastSpend(category?: string, period?: number): Promise<any>;
  predictSupplierPerformance(supplierId: string): Promise<any>;
  identifyProcessBottlenecks(): Promise<any>;
}

// P2P Configuration Service Interface
export interface IP2PConfigurationService {
  // Configuration management
  getConfiguration(key?: string): Promise<any>;
  updateConfiguration(key: string, value: any): Promise<void>;
  resetConfiguration(key: string): Promise<void>;

  // Rules management
  getApprovalRules(processType: string): Promise<any[]>;
  updateApprovalRule(ruleId: string, rule: any): Promise<void>;
  activateApprovalRule(ruleId: string): Promise<void>;
  deactivateApprovalRule(ruleId: string): Promise<void>;

  // Integration settings
  getIntegrationSettings(): Promise<any>;
  updateIntegrationSettings(settings: any): Promise<void>;
  testIntegration(integrationType: string): Promise<{ success: boolean; message: string }>;

  // User preferences
  getUserPreferences(userId: string): Promise<any>;
  updateUserPreferences(userId: string, preferences: any): Promise<void>;
}