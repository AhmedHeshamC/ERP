export enum AccountType {
  ASSET = 'ASSET',
  LIABILITY = 'LIABILITY',
  EQUITY = 'EQUITY',
  REVENUE = 'REVENUE',
  EXPENSE = 'EXPENSE',
}

export enum AccountCategory {
  // Asset Categories
  CURRENT_ASSETS = 'Current Assets',
  FIXED_ASSETS = 'Fixed Assets',
  INTANGIBLE_ASSETS = 'Intangible Assets',
  OTHER_ASSETS = 'Other Assets',

  // Liability Categories
  CURRENT_LIABILITIES = 'Current Liabilities',
  LONG_TERM_LIABILITIES = 'Long Term Liabilities',
  OTHER_LIABILITIES = 'Other Liabilities',

  // Equity Categories
  SHARE_CAPITAL = 'Share Capital',
  RETAINED_EARNINGS = 'Retained Earnings',
  OTHER_EQUITY = 'Other Equity',

  // Revenue Categories
  OPERATING_REVENUE = 'Operating Revenue',
  NON_OPERATING_REVENUE = 'Non Operating Revenue',

  // Expense Categories
  OPERATING_EXPENSES = 'Operating Expenses',
  NON_OPERATING_EXPENSES = 'Non Operating Expenses',
}

export enum TransactionStatus {
  PENDING = 'PENDING',
  POSTED = 'POSTED',
  CANCELLED = 'CANCELLED',
}

export enum TransactionType {
  SALE = 'SALE',
  PURCHASE = 'PURCHASE',
  PAYMENT = 'PAYMENT',
  RECEIPT = 'RECEIPT',
  ADJUSTMENT = 'ADJUSTMENT',
  JOURNAL_ENTRY = 'JOURNAL_ENTRY',
}