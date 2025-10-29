-- Database initialization script for ERP system
-- This script runs when the PostgreSQL container starts for the first time

-- Create extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Create custom functions
CREATE OR REPLACE FUNCTION generate_account_code()
RETURNS TRIGGER AS $$
BEGIN
  -- Generate unique account code based on account type
  IF NEW.type = 'ASSET' THEN
    NEW.code := '1' || LPAD((COALESCE(
      (SELECT MAX(SUBSTRING(code, 2)::int) FROM accounts WHERE type = 'ASSET'), 0) + 1)::text, 5, '0');
  ELSIF NEW.type = 'LIABILITY' THEN
    NEW.code := '2' || LPAD((COALESCE(
      (SELECT MAX(SUBSTRING(code, 2)::int) FROM accounts WHERE type = 'LIABILITY'), 0) + 1)::text, 5, '0');
  ELSIF NEW.type = 'EQUITY' THEN
    NEW.code := '3' || LPAD((COALESCE(
      (SELECT MAX(SUBSTRING(code, 2)::int) FROM accounts WHERE type = 'EQUITY'), 0) + 1)::text, 5, '0');
  ELSIF NEW.type = 'REVENUE' THEN
    NEW.code := '4' || LPAD((COALESCE(
      (SELECT MAX(SUBSTRING(code, 2)::int) FROM accounts WHERE type = 'REVENUE'), 0) + 1)::text, 5, '0');
  ELSIF NEW.type = 'EXPENSE' THEN
    NEW.code := '5' || LPAD((COALESCE(
      (SELECT MAX(SUBSTRING(code, 2)::int) FROM accounts WHERE type = 'EXPENSE'), 0) + 1)::text, 5, '0');
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for account code generation
CREATE TRIGGER account_code_trigger
  BEFORE INSERT ON accounts
  FOR EACH ROW
  WHEN (NEW.code IS NULL OR NEW.code = '')
  EXECUTE FUNCTION generate_account_code();

-- Create function for transaction number generation
CREATE OR REPLACE FUNCTION generate_transaction_number()
RETURNS TRIGGER AS $$
DECLARE
  prefix TEXT;
  sequence_num INTEGER;
BEGIN
  -- Generate prefix based on transaction type
  CASE NEW.type
    WHEN 'JOURNAL' THEN prefix := 'JRNL';
    WHEN 'PAYMENT' THEN prefix := 'PAY';
    WHEN 'RECEIPT' THEN prefix := 'REC';
    WHEN 'SALES_INVOICE' THEN prefix := 'INV';
    WHEN 'PURCHASE_INVOICE' THEN prefix := 'BILL';
    ELSE prefix := 'TXN';
  END CASE;

  -- Get next sequence number
  SELECT COALESCE(MAX(CAST(SUBSTRING(number FROM '\d+$') AS INTEGER)), 0) + 1
  INTO sequence_num
  FROM transactions
  WHERE type = NEW.type
  AND DATE(date) = CURRENT_DATE;

  -- Generate transaction number
  NEW.number := prefix || '-' || TO_CHAR(CURRENT_DATE, 'YYYYMMDD') || '-' || LPAD(sequence_num::text, 4, '0');

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for transaction number generation
CREATE TRIGGER transaction_number_trigger
  BEFORE INSERT ON transactions
  FOR EACH ROW
  WHEN (NEW.number IS NULL OR NEW.number = '')
  EXECUTE FUNCTION generate_transaction_number();

-- Create function for sales order number generation
CREATE OR REPLACE FUNCTION generate_sales_order_number()
RETURNS TRIGGER AS $$
DECLARE
  sequence_num INTEGER;
BEGIN
  SELECT COALESCE(MAX(CAST(SUBSTRING(number FROM '\d+$') AS INTEGER)), 0) + 1
  INTO sequence_num
  FROM sales_orders
  WHERE DATE(orderDate) = CURRENT_DATE;

  NEW.number := 'SO-' || TO_CHAR(CURRENT_DATE, 'YYYYMMDD') || '-' || LPAD(sequence_num::text, 4, '0');

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for sales order number generation
CREATE TRIGGER sales_order_number_trigger
  BEFORE INSERT ON sales_orders
  FOR EACH ROW
  WHEN (NEW.number IS NULL OR NEW.number = '')
  EXECUTE FUNCTION generate_sales_order_number();

-- Create function for purchase order number generation
CREATE OR REPLACE FUNCTION generate_purchase_order_number()
RETURNS TRIGGER AS $$
DECLARE
  sequence_num INTEGER;
BEGIN
  SELECT COALESCE(MAX(CAST(SUBSTRING(number FROM '\d+$') AS INTEGER)), 0) + 1
  INTO sequence_num
  FROM purchase_orders
  WHERE DATE(orderDate) = CURRENT_DATE;

  NEW.number := 'PO-' || TO_CHAR(CURRENT_DATE, 'YYYYMMDD') || '-' || LPAD(sequence_num::text, 4, '0');

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for purchase order number generation
CREATE TRIGGER purchase_order_number_trigger
  BEFORE INSERT ON purchase_orders
  FOR EACH ROW
  WHEN (NEW.number IS NULL OR NEW.number = '')
  EXECUTE FUNCTION generate_purchase_order_number();

-- Create function for customer code generation
CREATE OR REPLACE FUNCTION generate_customer_code()
RETURNS TRIGGER AS $$
DECLARE
  sequence_num INTEGER;
BEGIN
  SELECT COALESCE(MAX(CAST(SUBSTRING(code FROM '\d+$') AS INTEGER)), 0) + 1
  INTO sequence_num
  FROM customers;

  NEW.code := 'CUST-' || LPAD(sequence_num::text, 5, '0');

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for customer code generation
CREATE TRIGGER customer_code_trigger
  BEFORE INSERT ON customers
  FOR EACH ROW
  WHEN (NEW.code IS NULL OR NEW.code = '')
  EXECUTE FUNCTION generate_customer_code();

-- Create function for supplier code generation
CREATE OR REPLACE FUNCTION generate_supplier_code()
RETURNS TRIGGER AS $$
DECLARE
  sequence_num INTEGER;
BEGIN
  SELECT COALESCE(MAX(CAST(SUBSTRING(code FROM '\d+$') AS INTEGER)), 0) + 1
  INTO sequence_num
  FROM suppliers;

  NEW.code := 'SUPP-' || LPAD(sequence_num::text, 5, '0');

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for supplier code generation
CREATE TRIGGER supplier_code_trigger
  BEFORE INSERT ON suppliers
  FOR EACH ROW
  WHEN (NEW.code IS NULL OR NEW.code = '')
  EXECUTE FUNCTION generate_supplier_code();

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);
CREATE INDEX IF NOT EXISTS idx_users_is_active ON users(is_active);
CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_expires_at ON sessions(expires_at);
CREATE INDEX IF NOT EXISTS idx_sessions_is_active ON sessions(is_active);

-- Accounting indexes
CREATE INDEX IF NOT EXISTS idx_accounts_code ON accounts(code);
CREATE INDEX IF NOT EXISTS idx_accounts_type ON accounts(type);
CREATE INDEX IF NOT EXISTS idx_accounts_is_active ON accounts(is_active);
CREATE INDEX IF NOT EXISTS idx_transactions_date ON transactions(date);
CREATE INDEX IF NOT EXISTS idx_transactions_type ON transactions(type);
CREATE INDEX IF NOT EXISTS idx_transactions_status ON transactions(status);
CREATE INDEX IF NOT EXISTS idx_transaction_entries_transaction_id ON transaction_entries(transaction_id);
CREATE INDEX IF NOT EXISTS idx_transaction_entries_account_id ON transaction_entries(account_id);

-- Inventory indexes
CREATE INDEX IF NOT EXISTS idx_categories_parent_id ON categories(parent_id);
CREATE INDEX IF NOT EXISTS idx_products_sku ON products(sku);
CREATE INDEX IF NOT EXISTS idx_products_category_id ON products(category_id);
CREATE INDEX IF NOT EXISTS idx_products_is_active ON products(is_active);
CREATE INDEX IF NOT EXISTS idx_stock_movements_product_id ON stock_movements(product_id);
CREATE INDEX IF NOT EXISTS idx_stock_movements_type ON stock_movements(movement_type);

-- Sales indexes
CREATE INDEX IF NOT EXISTS idx_customers_code ON customers(code);
CREATE INDEX IF NOT EXISTS idx_customers_is_active ON customers(is_active);
CREATE INDEX IF NOT EXISTS idx_sales_orders_number ON sales_orders(number);
CREATE INDEX IF NOT EXISTS idx_sales_orders_customer_id ON sales_orders(customer_id);
CREATE INDEX IF NOT EXISTS idx_sales_orders_status ON sales_orders(status);
CREATE INDEX IF NOT EXISTS idx_sales_orders_order_date ON sales_orders(orderDate);

-- Purchasing indexes
CREATE INDEX IF NOT EXISTS idx_suppliers_code ON suppliers(code);
CREATE INDEX IF NOT EXISTS idx_suppliers_is_active ON suppliers(is_active);
CREATE INDEX IF NOT EXISTS idx_purchase_orders_number ON purchase_orders(number);
CREATE INDEX IF NOT EXISTS idx_purchase_orders_supplier_id ON purchase_orders(supplier_id);
CREATE INDEX IF NOT EXISTS idx_purchase_orders_status ON purchase_orders(status);
CREATE INDEX IF NOT EXISTS idx_purchase_orders_order_date ON purchase_orders(orderDate);

-- Create view for current stock levels
CREATE OR REPLACE VIEW current_stock AS
SELECT
  p.id as product_id,
  p.sku,
  p.name as product_name,
  c.name as category_name,
  COALESCE(
    SUM(CASE WHEN sm.movement_type = 'IN' THEN sm.quantity ELSE 0 END) -
    SUM(CASE WHEN sm.movement_type = 'OUT' THEN sm.quantity ELSE 0 END) +
    SUM(CASE WHEN sm.movement_type = 'ADJUSTMENT' THEN sm.quantity ELSE 0 END),
    0
  ) as current_quantity,
  p.reorder_level,
  p.reorder_quantity,
  p.unit_price,
  p.cost_price
FROM products p
LEFT JOIN categories c ON p.category_id = c.id
LEFT JOIN stock_movements sm ON p.id = sm.productId
WHERE p.is_active = true
GROUP BY p.id, p.sku, p.name, c.name, p.reorder_level, p.reorder_quantity, p.unit_price, p.cost_price;

-- Create view for low stock products
CREATE OR REPLACE VIEW low_stock_products AS
SELECT * FROM current_stock
WHERE current_quantity <= reorder_level
AND current_quantity > 0;

-- Create view for out of stock products
CREATE OR REPLACE VIEW out_of_stock_products AS
SELECT * FROM current_stock
WHERE current_quantity <= 0;

-- Grant necessary permissions
GRANT USAGE ON SCHEMA public TO erp_user;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO erp_user;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO erp_user;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO erp_user;