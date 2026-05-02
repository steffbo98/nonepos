import Database from 'better-sqlite3';
import path from 'path';
import { app } from 'electron';
import fs from 'fs';
import crypto from 'crypto';

export class POSDatabase {
  private db: Database.Database;
  private dbPath: string;

  constructor() {
    // Use AppData/Local for database file, with fallback for non-Electron environments
    let appData: string;
    try {
      appData = app.getPath('userData');
    } catch (error) {
      // Fallback for development/server environments without Electron
      appData = path.join(process.cwd(), 'data');
      // Ensure the data directory exists
      if (!fs.existsSync(appData)) {
        fs.mkdirSync(appData, { recursive: true });
      }
    }
    this.dbPath = path.join(appData, 'pos.db');

    // Initialize database
    this.db = new Database(this.dbPath);
    this.initializeSchema();
  }

  private initializeSchema() {
    // Enable WAL mode for better concurrency
    this.db.pragma('journal_mode = WAL');

    // Create tables
    this.db.exec(`
      -- Users table
      CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        fullName TEXT NOT NULL,
        email TEXT NOT NULL,
        passwordHash TEXT,
        passwordSalt TEXT,
        role TEXT NOT NULL,
        active INTEGER NOT NULL DEFAULT 1,
        resetToken TEXT,
        resetTokenExpires TEXT,
        biometricCredentialId TEXT,
        createdAt TEXT DEFAULT CURRENT_TIMESTAMP,
        updatedAt TEXT DEFAULT CURRENT_TIMESTAMP
      );

      -- Products table
      CREATE TABLE IF NOT EXISTS products (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        price REAL NOT NULL,
        costPrice REAL DEFAULT 0,
        stock INTEGER NOT NULL DEFAULT 0,
        category TEXT NOT NULL,
        sku TEXT UNIQUE,
        imageUrl TEXT,
        active INTEGER DEFAULT 1,
        createdAt TEXT DEFAULT CURRENT_TIMESTAMP,
        updatedAt TEXT DEFAULT CURRENT_TIMESTAMP
      );

      -- Orders table
      CREATE TABLE IF NOT EXISTS orders (
        id TEXT PRIMARY KEY,
        staffId TEXT NOT NULL,
        customerId TEXT,
        items TEXT NOT NULL,
        subtotal REAL DEFAULT 0,
        vat REAL DEFAULT 0,
        totalAmount REAL NOT NULL,
        paymentMethod TEXT,
        amountPaid REAL DEFAULT 0,
        changeDue REAL DEFAULT 0,
        creditAmount REAL DEFAULT 0,
        cashPaid REAL DEFAULT 0,
        mpesaPaid REAL DEFAULT 0,
        mpesaRef TEXT,
        isCredit INTEGER DEFAULT 0,
        paymentStatus TEXT NOT NULL,
        orderStatus TEXT NOT NULL,
        createdAt TEXT DEFAULT CURRENT_TIMESTAMP,
        updatedAt TEXT DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (staffId) REFERENCES users(id),
        FOREIGN KEY (customerId) REFERENCES customers(id)
      );

      -- Customers table
      CREATE TABLE IF NOT EXISTS customers (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        phone TEXT,
        email TEXT,
        points INTEGER DEFAULT 0,
        debt REAL DEFAULT 0,
        createdAt TEXT DEFAULT CURRENT_TIMESTAMP,
        updatedAt TEXT DEFAULT CURRENT_TIMESTAMP
      );

      -- Settings table
      CREATE TABLE IF NOT EXISTS settings (
        id TEXT PRIMARY KEY,
        key TEXT UNIQUE NOT NULL,
        value TEXT NOT NULL,
        createdAt TEXT DEFAULT CURRENT_TIMESTAMP,
        updatedAt TEXT DEFAULT CURRENT_TIMESTAMP
      );

      -- Z Reports (daily / periodic tax & reconciliation summaries)
      CREATE TABLE IF NOT EXISTS z_reports (
        id TEXT PRIMARY KEY,
        createdAt TEXT NOT NULL,
        rangeStart TEXT NOT NULL,
        rangeEnd TEXT NOT NULL,
        createdBy TEXT,
        totalsJson TEXT NOT NULL,
        notes TEXT,
        createdAtLocal TEXT
      );

      -- Expenses table
      CREATE TABLE IF NOT EXISTS expenses (
        id TEXT PRIMARY KEY,
        description TEXT NOT NULL,
        amount REAL NOT NULL,
        category TEXT NOT NULL,
        date TEXT DEFAULT CURRENT_TIMESTAMP,
        createdAt TEXT DEFAULT CURRENT_TIMESTAMP,
        updatedAt TEXT DEFAULT CURRENT_TIMESTAMP
      );

      -- Customer debt ledger
      CREATE TABLE IF NOT EXISTS customer_ledger (
        id TEXT PRIMARY KEY,
        customerId TEXT NOT NULL,
        orderId TEXT,
        type TEXT NOT NULL,
        amount REAL NOT NULL,
        balanceAfter REAL NOT NULL,
        note TEXT,
        createdAt TEXT DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (customerId) REFERENCES customers(id),
        FOREIGN KEY (orderId) REFERENCES orders(id)
      );

      -- Inventory stock movement audit
      CREATE TABLE IF NOT EXISTS stock_movements (
        id TEXT PRIMARY KEY,
        productId TEXT NOT NULL,
        orderId TEXT,
        type TEXT NOT NULL,
        quantityChange INTEGER NOT NULL,
        stockAfter INTEGER NOT NULL,
        note TEXT,
        createdAt TEXT DEFAULT CURRENT_TIMESTAMP,
        updatedAt TEXT DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (productId) REFERENCES products(id),
        FOREIGN KEY (orderId) REFERENCES orders(id)
      );

      -- Suppliers
      CREATE TABLE IF NOT EXISTS suppliers (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        phone TEXT,
        email TEXT,
        address TEXT,
        createdAt TEXT DEFAULT CURRENT_TIMESTAMP,
        updatedAt TEXT DEFAULT CURRENT_TIMESTAMP
      );

      -- Purchase receipts / purchase orders
      CREATE TABLE IF NOT EXISTS purchase_orders (
        id TEXT PRIMARY KEY,
        supplierId TEXT,
        items TEXT NOT NULL,
        totalCost REAL NOT NULL,
        status TEXT NOT NULL,
        note TEXT,
        receivedAt TEXT,
        createdAt TEXT DEFAULT CURRENT_TIMESTAMP,
        updatedAt TEXT DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (supplierId) REFERENCES suppliers(id)
      );

      -- Sync queue for cloud sync
      CREATE TABLE IF NOT EXISTS sync_queue (
        id TEXT PRIMARY KEY,
        collection TEXT NOT NULL,
        entityId TEXT NOT NULL,
        operation TEXT NOT NULL,
        payload TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'pending',
        attempts INTEGER NOT NULL DEFAULT 0,
        lastAttemptAt TEXT,
        error TEXT,
        createdAt TEXT DEFAULT CURRENT_TIMESTAMP,
        updatedAt TEXT DEFAULT CURRENT_TIMESTAMP
      );

      -- Create indexes for performance
      CREATE INDEX IF NOT EXISTS idx_products_category ON products(category);
      CREATE INDEX IF NOT EXISTS idx_products_sku ON products(sku);
      CREATE INDEX IF NOT EXISTS idx_orders_staff ON orders(staffId);
      CREATE INDEX IF NOT EXISTS idx_orders_created ON orders(createdAt);
      CREATE INDEX IF NOT EXISTS idx_customers_phone ON customers(phone);
      CREATE INDEX IF NOT EXISTS idx_expenses_created ON expenses(createdAt);
      CREATE INDEX IF NOT EXISTS idx_expenses_category ON expenses(category);
      CREATE INDEX IF NOT EXISTS idx_customer_ledger_customer ON customer_ledger(customerId);
      CREATE INDEX IF NOT EXISTS idx_customer_ledger_created ON customer_ledger(createdAt);
      CREATE INDEX IF NOT EXISTS idx_stock_movements_product ON stock_movements(productId);
      CREATE INDEX IF NOT EXISTS idx_stock_movements_created ON stock_movements(createdAt);
      CREATE INDEX IF NOT EXISTS idx_purchase_orders_supplier ON purchase_orders(supplierId);
      CREATE INDEX IF NOT EXISTS idx_purchase_orders_created ON purchase_orders(createdAt);

      CREATE INDEX IF NOT EXISTS idx_z_reports_createdAt ON z_reports(createdAt);
      CREATE INDEX IF NOT EXISTS idx_z_reports_rangeStart ON z_reports(rangeStart);

      -- Stock Alert Rules for admins
      CREATE TABLE IF NOT EXISTS stock_alert_rules (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        minStockLevel INTEGER NOT NULL,
        productIds TEXT,
        categories TEXT,
        emailRecipients TEXT NOT NULL,
        enabled BOOLEAN DEFAULT 1,
        createdAt TEXT DEFAULT CURRENT_TIMESTAMP,
        updatedAt TEXT DEFAULT CURRENT_TIMESTAMP
      );

      -- Alert Logs for tracking sent alerts
      CREATE TABLE IF NOT EXISTS alert_logs (
        id TEXT PRIMARY KEY,
        ruleId TEXT,
        productId TEXT,
        alertType TEXT NOT NULL,
        message TEXT,
        sentTo TEXT,
        status TEXT DEFAULT 'pending',
        sentAt TEXT,
        createdAt TEXT DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (ruleId) REFERENCES stock_alert_rules(id),
        FOREIGN KEY (productId) REFERENCES products(id)
      );

      CREATE INDEX IF NOT EXISTS idx_alert_logs_created ON alert_logs(createdAt);
      CREATE INDEX IF NOT EXISTS idx_alert_logs_product ON alert_logs(productId);
    `);

    this.ensureUserColumns();
    this.ensureOrderColumns();
    this.ensureStockMovementColumns();
  }

  private ensureUserColumns() {
    const columns = this.db.prepare(`PRAGMA table_info(users)`).all() as { name: string }[];
    const existing = new Set(columns.map(column => column.name));
    const requiredColumns: Record<string, string> = {
      passwordHash: 'TEXT',
      passwordSalt: 'TEXT',
      resetToken: 'TEXT',
      resetTokenExpires: 'TEXT',
      biometricCredentialId: 'TEXT'
    };

    for (const [name, definition] of Object.entries(requiredColumns)) {
      if (!existing.has(name)) {
        this.db.prepare(`ALTER TABLE users ADD COLUMN ${name} ${definition}`).run();
      }
    }
  }

  private ensureOrderColumns() {
    const columns = this.db.prepare(`PRAGMA table_info(orders)`).all() as { name: string }[];
    const existing = new Set(columns.map(column => column.name));
    const requiredColumns: Record<string, string> = {
      subtotal: 'REAL DEFAULT 0',
      vat: 'REAL DEFAULT 0',
      amountPaid: 'REAL DEFAULT 0',
      changeDue: 'REAL DEFAULT 0',
      creditAmount: 'REAL DEFAULT 0',
      cashPaid: 'REAL DEFAULT 0',
      mpesaPaid: 'REAL DEFAULT 0',
      mpesaRef: 'TEXT',
      isCredit: 'INTEGER DEFAULT 0'
    };

    for (const [name, definition] of Object.entries(requiredColumns)) {
      if (!existing.has(name)) {
        this.db.prepare(`ALTER TABLE orders ADD COLUMN ${name} ${definition}`).run();
      }
    }
  }

  private ensureStockMovementColumns() {
    const columns = this.db.prepare(`PRAGMA table_info(stock_movements)`).all() as { name: string }[];
    const existing = new Set(columns.map(column => column.name));
    const requiredColumns: Record<string, string> = {
      updatedAt: 'TEXT DEFAULT CURRENT_TIMESTAMP'
    };

    for (const [name, definition] of Object.entries(requiredColumns)) {
      if (!existing.has(name)) {
        this.db.prepare(`ALTER TABLE stock_movements ADD COLUMN ${name} ${definition}`).run();
      }
    }
  }

  private shouldQueueCollection(collection: string) {
    const syncCollections = [
      'products',
      'orders',
      'customers',
      'settings',
      'expenses',
      'suppliers',
      'purchase_orders',
      'customer_ledger',
      'stock_movements'
    ];
    return syncCollections.includes(collection);
  }

  private queueSyncChange(collection: string, entityId: string, operation: string, payload: any) {
    const now = new Date().toISOString();
    const entry = {
      id: this.generateId(),
      collection,
      entityId,
      operation,
      payload: JSON.stringify(payload),
      status: 'pending',
      attempts: 0,
      lastAttemptAt: null,
      error: null,
      createdAt: now,
      updatedAt: now
    };

    // Prevent recursive queue creation
    this.create('sync_queue', entry, true).catch((error) => {
      console.error('Failed to queue sync change:', error);
    });
  }

  async listPendingSync(limit = 100): Promise<any[]> {
    return this.list('sync_queue', {
      where: `status = 'pending'`,
      orderBy: 'createdAt ASC',
      limit
    });
  }

  async markSyncSuccess(queueId: string): Promise<void> {
    await this.update('sync_queue', queueId, {
      status: 'synced',
      updatedAt: new Date().toISOString()
    }, true);
  }

  async markSyncFailure(queueId: string, error: string): Promise<void> {
    const existing = this.db.prepare(`SELECT attempts FROM sync_queue WHERE id = ?`).get(queueId) as { attempts: number };
    const attempts = existing?.attempts ? existing.attempts + 1 : 1;
    await this.update('sync_queue', queueId, {
      status: 'failed',
      attempts,
      lastAttemptAt: new Date().toISOString(),
      error,
      updatedAt: new Date().toISOString()
    }, true);
  }

  async applyRemoteChange(collection: string, id: string, data: any, operation: 'create' | 'update' | 'delete' = 'update'): Promise<any> {
    if (operation === 'delete') {
      return this.delete(collection, id, true);
    }

    const existing = await this.get(collection, id);
    const now = new Date().toISOString();
    const payload = { ...data, id, updatedAt: data.updatedAt || now, createdAt: data.createdAt || now };

    if (!existing) {
      return this.create(collection, payload, true);
    }

    const remoteUpdatedAt = new Date(payload.updatedAt).getTime();
    const localUpdatedAt = existing.updatedAt ? new Date(existing.updatedAt).getTime() : 0;

    if (remoteUpdatedAt > localUpdatedAt) {
      return this.update(collection, id, payload, true);
    }

    return existing;
  }

  // Generic CRUD operations
  async create(collection: string, data: any, skipSync = false): Promise<any> {
    const id = data.id || this.generateId();
    const now = new Date().toISOString();
    const insertData = this.normalizeSqliteData({ ...data, id, createdAt: data.createdAt || now, updatedAt: data.updatedAt || now });

    delete insertData.id;
    delete insertData.createdAt;
    delete insertData.updatedAt;

    const keys = Object.keys(insertData);

    const stmt = this.db.prepare(`
      INSERT INTO ${collection}
      (id, ${keys.join(', ')}, createdAt, updatedAt)
      VALUES (?, ${keys.map(() => '?').join(', ')}, ?, ?)
    `);

    const values = [id, ...Object.values(insertData), insertData.createdAt || now, insertData.updatedAt || now];
    stmt.run(values);

    const result = { id, ...data, createdAt: insertData.createdAt || now, updatedAt: insertData.updatedAt || now };

    if (!skipSync && this.shouldQueueCollection(collection)) {
      this.queueSyncChange(collection, id, 'create', result);
    }

    return result;
  }

  async update(collection: string, id: string, data: any, skipSync = false): Promise<any> {
    const now = new Date().toISOString();
    const updateData = this.normalizeSqliteData({ ...data, id, updatedAt: data.updatedAt || now });

    delete updateData.id;
    delete updateData.createdAt;
    delete updateData.updatedAt;

    const setClause = Object.keys(updateData).map(key => `${key} = ?`).join(', ');
    const stmt = this.db.prepare(`
      UPDATE ${collection}
      SET ${setClause}, updatedAt = ?
      WHERE id = ?
    `);

    const values = [...Object.values(updateData), updateData.updatedAt || now, id];
    stmt.run(values);

    const result = { id, ...data, updatedAt: updateData.updatedAt || now };

    if (!skipSync && this.shouldQueueCollection(collection)) {
      this.queueSyncChange(collection, id, 'update', result);
    }

    return result;
  }

  async delete(collection: string, id: string, skipSync = false): Promise<void> {
    const stmt = this.db.prepare(`DELETE FROM ${collection} WHERE id = ?`);
    stmt.run(id);

    if (!skipSync && this.shouldQueueCollection(collection)) {
      this.queueSyncChange(collection, id, 'delete', { id });
    }
  }

  async get(collection: string, id: string): Promise<any | null> {
    const stmt = this.db.prepare(`SELECT * FROM ${collection} WHERE id = ?`);
    const row = stmt.get(id);
    return row ? this.parseRow(row) : null;
  }

  async list(collection: string, options?: { where?: string; orderBy?: string; limit?: number }): Promise<any[]> {
    let query = `SELECT * FROM ${collection}`;

    if (options?.where) {
      query += ` WHERE ${options.where}`;
    }

    if (options?.orderBy) {
      query += ` ORDER BY ${options.orderBy}`;
    }

    if (options?.limit) {
      query += ` LIMIT ${options.limit}`;
    }

    const stmt = this.db.prepare(query);
    const rows = stmt.all();
    return (rows as any[]).map(row => this.parseRow(row));
  }

  // Product operations
  async getProduct(id: string): Promise<any> {
    return this.get('products', id);
  }

  async listProducts(options?: { category?: string; search?: string }): Promise<any[]> {
    let where = '';

    if (options?.category && options.category !== 'All') {
      where = `category = '${options.category}'`;
    }

    if (options?.search) {
      const searchCondition = `name LIKE '%${options.search}%' OR sku LIKE '%${options.search}%'`;
      where = where ? `${where} AND ${searchCondition}` : searchCondition;
    }

    return this.list('products', {
      where: where || undefined,
      orderBy: 'name ASC'
    });
  }

  async createProduct(data: any): Promise<any> {
    return this.create('products', data);
  }

  async updateProduct(id: string, data: any): Promise<any> {
    return this.update('products', id, data);
  }

  async deleteProduct(id: string): Promise<void> {
    return this.delete('products', id);
  }

  async listStockMovements(productId?: string): Promise<any[]> {
    return this.list('stock_movements', {
      where: productId ? `productId = '${productId}'` : undefined,
      orderBy: 'createdAt DESC',
      limit: productId ? undefined : 250
    });
  }

  async recordStockMovement(data: {
    productId: string;
    orderId?: string;
    type: string;
    quantityChange: number;
    stockAfter: number;
    note?: string;
  }): Promise<any> {
    const quantityChange = Number(data.quantityChange);
    const stockAfter = Number(data.stockAfter);

    if (!data.productId) throw new Error('Product is required');
    if (!data.type) throw new Error('Movement type is required');
    if (!Number.isFinite(quantityChange) || quantityChange === 0) throw new Error('Quantity change cannot be zero');
    if (!Number.isFinite(stockAfter) || stockAfter < 0) throw new Error('Stock after movement is invalid');

    const now = new Date().toISOString();
    return this.create('stock_movements', {
      productId: data.productId,
      orderId: data.orderId || null,
      type: data.type,
      quantityChange,
      stockAfter,
      note: data.note || null,
      createdAt: now,
      updatedAt: now
    });
  }

  // Order operations
  async listOrders(options?: { staffId?: string; limit?: number }): Promise<any[]> {
    let where = '';

    if (options?.staffId) {
      where = `staffId = '${options.staffId}'`;
    }

    return this.list('orders', {
      where: where || undefined,
      orderBy: 'createdAt DESC',
      limit: options?.limit
    });
  }

  async createOrder(data: any): Promise<any> {
    return this.create('orders', {
      ...data,
      items: JSON.stringify(data.items),
      isCredit: data.isCredit ? 1 : 0
    });
  }

  private sanitizeUser(row: any): any {
    if (!row) return null;

    const { passwordHash, passwordSalt, ...user } = row;
    return this.parseRow(user);
  }

  private hashPassword(password: string, salt = crypto.randomBytes(16).toString('hex')) {
    const hash = crypto.pbkdf2Sync(password, salt, 120000, 64, 'sha512').toString('hex');
    return { hash, salt };
  }

  private verifyPassword(password: string, salt: string, expectedHash: string) {
    const { hash } = this.hashPassword(password, salt);
    return crypto.timingSafeEqual(Buffer.from(hash, 'hex'), Buffer.from(expectedHash, 'hex'));
  }

  async getUserByEmail(email: string): Promise<any> {
    return this.db.prepare(`SELECT * FROM users WHERE lower(email) = ?`).get(email.trim().toLowerCase());
  }

  async requestPasswordReset(email: string): Promise<{ resetToken: string }> {
    const user = await this.getUserByEmail(email);
    if (!user) {
      throw new Error('No account exists for that email');
    }

    const resetToken = crypto.randomBytes(4).toString('hex').toUpperCase();
    const resetTokenExpires = new Date(Date.now() + 1000 * 60 * 60).toISOString();

    this.db.prepare(`
      UPDATE users
      SET resetToken = ?, resetTokenExpires = ?, updatedAt = ?
      WHERE id = ?
    `).run(resetToken, resetTokenExpires, new Date().toISOString(), user.id);

    return { resetToken };
  }

  async resetPassword(data: { email: string; token: string; newPassword: string }): Promise<any> {
    const user = await this.getUserByEmail(data.email);
    if (!user) {
      throw new Error('Invalid email or reset code');
    }

    if (!user.resetToken || user.resetToken !== data.token) {
      throw new Error('Invalid reset token');
    }

    if (!user.resetTokenExpires || new Date(user.resetTokenExpires) < new Date()) {
      throw new Error('Reset token has expired');
    }

    if (data.newPassword.length < 6) {
      throw new Error('Password must be at least 6 characters');
    }

    const { hash, salt } = this.hashPassword(data.newPassword);
    this.db.prepare(`
      UPDATE users
      SET passwordHash = ?, passwordSalt = ?, resetToken = NULL, resetTokenExpires = NULL, updatedAt = ?
      WHERE id = ?
    `).run(hash, salt, new Date().toISOString(), user.id);

    const updated = await this.getUserByEmail(data.email);
    return this.sanitizeUser(updated);
  }

  async registerBiometricCredential(email: string, credentialId: string): Promise<any> {
    const user = await this.getUserByEmail(email);
    if (!user) {
      throw new Error('User not found');
    }

    this.db.prepare(`
      UPDATE users
      SET biometricCredentialId = ?, updatedAt = ?
      WHERE id = ?
    `).run(credentialId, new Date().toISOString(), user.id);

    const updated = await this.getUserByEmail(email);
    return this.sanitizeUser(updated);
  }

  async loginWithBiometric(email: string, credentialId: string): Promise<any> {
    const user = await this.getUserByEmail(email);
    if (!user || !user.biometricCredentialId || user.biometricCredentialId !== credentialId || !user.active) {
      throw new Error('Biometric login failed');
    }

    return this.sanitizeUser(user);
  }

  async getAuthUserCount(): Promise<number> {
    const row = this.db.prepare(`
      SELECT COUNT(*) as count
      FROM users
      WHERE passwordHash IS NOT NULL AND passwordSalt IS NOT NULL
    `).get() as { count: number };

    return row.count;
  }

  async registerUser(data: { fullName: string; email: string; password: string }): Promise<any> {
    const email = data.email.trim().toLowerCase();
    const fullName = data.fullName.trim();

    if (!fullName) {
      throw new Error('Full name is required');
    }

    if (!email) {
      throw new Error('Email is required');
    }

    if (data.password.length < 6) {
      throw new Error('Password must be at least 6 characters');
    }

    const existing = this.db.prepare(`SELECT id FROM users WHERE lower(email) = ?`).get(email);
    if (existing) {
      throw new Error('An account with this email already exists');
    }

    const existingAuthUsers = await this.getAuthUserCount();
    const role = existingAuthUsers === 0 ? 'admin' : 'staff';
    const id = this.generateId();
    const now = new Date().toISOString();
    const { hash, salt } = this.hashPassword(data.password);

    this.db.prepare(`
      INSERT INTO users (id, fullName, email, passwordHash, passwordSalt, role, active, createdAt, updatedAt)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(id, fullName, email, hash, salt, role, 1, now, now);

    const user = this.db.prepare(`SELECT * FROM users WHERE id = ?`).get(id);
    return this.sanitizeUser(user);
  }

  async loginUser(data: { email: string; password: string }): Promise<any> {
    const email = data.email.trim().toLowerCase();
    const user = this.db.prepare(`SELECT * FROM users WHERE lower(email) = ?`).get(email) as any;

    if (!user || !user.passwordHash || !user.passwordSalt || !user.active) {
      throw new Error('Invalid email or password');
    }

    if (!this.verifyPassword(data.password, user.passwordSalt, user.passwordHash)) {
      throw new Error('Invalid email or password');
    }

    return this.sanitizeUser(user);
  }

  async updateOrder(id: string, data: any): Promise<any> {
    const orderData = { ...data };

    if ('items' in orderData) {
      orderData.items = JSON.stringify(orderData.items);
    }

    if ('isCredit' in orderData) {
      orderData.isCredit = orderData.isCredit ? 1 : 0;
    }

    await this.update('orders', id, orderData);
    return this.get('orders', id);
  }

  async listUsers(): Promise<any[]> {
    const rows = this.db.prepare(`
      SELECT * FROM users
      ORDER BY createdAt DESC
    `).all();

    return (rows as any[]).map(row => this.sanitizeUser(row));
  }

  async updateUser(id: string, data: any): Promise<any> {
    await this.update('users', id, data);
    const user = this.db.prepare(`SELECT * FROM users WHERE id = ?`).get(id);
    return this.sanitizeUser(user);
  }

  // Customer operations
  async listCustomers(options?: { search?: string }): Promise<any[]> {
    let where = '';

    if (options?.search) {
      where = `name LIKE '%${options.search}%' OR phone LIKE '%${options.search}%'`;
    }

    return this.list('customers', {
      where: where || undefined,
      orderBy: 'createdAt DESC'
    });
  }

  async createCustomer(data: any): Promise<any> {
    return this.create('customers', data);
  }

  async updateCustomer(id: string, data: any): Promise<any> {
    return this.update('customers', id, data);
  }

  async deleteCustomer(id: string): Promise<void> {
    return this.delete('customers', id);
  }

  async listCustomerLedger(customerId: string): Promise<any[]> {
    return this.list('customer_ledger', {
      where: `customerId = '${customerId}'`,
      orderBy: 'createdAt DESC'
    });
  }

  async recordCustomerDebt(
    customerId: string,
    data: { amount: number; orderId?: string; note?: string; type?: string }
  ): Promise<any> {
    const amount = Number(data.amount);
    if (!Number.isFinite(amount) || amount <= 0) {
      throw new Error('Debt amount must be greater than zero');
    }

    const tx = this.db.transaction(() => {
      const customer = this.db.prepare(`SELECT * FROM customers WHERE id = ?`).get(customerId) as any;
      if (!customer) throw new Error('Customer not found');

      const balanceAfter = Number(customer.debt || 0) + amount;
      const now = new Date().toISOString();
      const entry = {
        id: this.generateId(),
        customerId,
        orderId: data.orderId || null,
        type: data.type || 'credit_sale',
        amount,
        balanceAfter,
        note: data.note || 'Credit sale',
        createdAt: now
      };

      this.db.prepare(`UPDATE customers SET debt = ?, updatedAt = ? WHERE id = ?`).run(balanceAfter, now, customerId);
      this.db.prepare(`
        INSERT INTO customer_ledger (id, customerId, orderId, type, amount, balanceAfter, note, createdAt)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `).run(entry.id, entry.customerId, entry.orderId, entry.type, entry.amount, entry.balanceAfter, entry.note, entry.createdAt);

      const updatedCustomer = this.db.prepare(`SELECT * FROM customers WHERE id = ?`).get(customerId);
      return { customer: this.parseRow(updatedCustomer), entry };
    });

    return tx();
  }

  async recordCustomerPayment(
    customerId: string,
    data: { amount: number; note?: string }
  ): Promise<any> {
    const amount = Number(data.amount);
    if (!Number.isFinite(amount) || amount <= 0) {
      throw new Error('Payment amount must be greater than zero');
    }

    const tx = this.db.transaction(() => {
      const customer = this.db.prepare(`SELECT * FROM customers WHERE id = ?`).get(customerId) as any;
      if (!customer) throw new Error('Customer not found');

      const currentDebt = Number(customer.debt || 0);
      if (currentDebt <= 0) throw new Error('Customer has no outstanding debt');

      const payment = Math.min(amount, currentDebt);
      const balanceAfter = Math.max(0, currentDebt - payment);
      const now = new Date().toISOString();
      const entry = {
        id: this.generateId(),
        customerId,
        orderId: null,
        type: 'payment',
        amount: -payment,
        balanceAfter,
        note: data.note || 'Debt repayment',
        createdAt: now
      };

      this.db.prepare(`UPDATE customers SET debt = ?, updatedAt = ? WHERE id = ?`).run(balanceAfter, now, customerId);
      this.db.prepare(`
        INSERT INTO customer_ledger (id, customerId, orderId, type, amount, balanceAfter, note, createdAt)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `).run(entry.id, entry.customerId, entry.orderId, entry.type, entry.amount, entry.balanceAfter, entry.note, entry.createdAt);

      const updatedCustomer = this.db.prepare(`SELECT * FROM customers WHERE id = ?`).get(customerId);
      return { customer: this.parseRow(updatedCustomer), entry };
    });

    return tx();
  }

  // Expense operations
  async listExpenses(options?: { search?: string; limit?: number }): Promise<any[]> {
    let where = '';

    if (options?.search) {
      where = `description LIKE '%${options.search}%' OR category LIKE '%${options.search}%'`;
    }

    return this.list('expenses', {
      where: where || undefined,
      orderBy: 'createdAt DESC',
      limit: options?.limit
    });
  }

  async createExpense(data: any): Promise<any> {
    const description = String(data.description || '').trim();
    const category = String(data.category || 'Other').trim();
    const amount = Number(data.amount);

    if (!description) {
      throw new Error('Expense description is required');
    }

    if (!Number.isFinite(amount) || amount <= 0) {
      throw new Error('Expense amount must be greater than zero');
    }

    const now = new Date().toISOString();
    return this.create('expenses', {
      description,
      category,
      amount,
      date: data.date || now,
      createdAt: data.createdAt || now
    });
  }

  async deleteExpense(id: string): Promise<void> {
    return this.delete('expenses', id);
  }

  // Supplier and purchase operations
  async listSuppliers(): Promise<any[]> {
    return this.list('suppliers', { orderBy: 'name ASC' });
  }

  async createSupplier(data: any): Promise<any> {
    const name = String(data.name || '').trim();
    if (!name) throw new Error('Supplier name is required');

    return this.create('suppliers', {
      name,
      phone: data.phone || null,
      email: data.email || null,
      address: data.address || null
    });
  }

  async listPurchases(options?: { limit?: number }): Promise<any[]> {
    return this.list('purchase_orders', {
      orderBy: 'createdAt DESC',
      limit: options?.limit
    });
  }

  async receivePurchase(data: {
    supplierId?: string;
    productId: string;
    quantity: number;
    unitCost: number;
    note?: string;
  }): Promise<any> {
    const quantity = Number(data.quantity);
    const unitCost = Number(data.unitCost);

    if (!data.productId) throw new Error('Product is required');
    if (!Number.isFinite(quantity) || quantity <= 0) throw new Error('Quantity must be greater than zero');
    if (!Number.isFinite(unitCost) || unitCost < 0) throw new Error('Unit cost is invalid');

    const tx = this.db.transaction(() => {
      const product = this.db.prepare(`SELECT * FROM products WHERE id = ?`).get(data.productId) as any;
      if (!product) throw new Error('Product not found');

      if (data.supplierId) {
        const supplier = this.db.prepare(`SELECT id FROM suppliers WHERE id = ?`).get(data.supplierId);
        if (!supplier) throw new Error('Supplier not found');
      }

      const now = new Date().toISOString();
      const stockAfter = Number(product.stock || 0) + quantity;
      const totalCost = quantity * unitCost;
      const item = {
        productId: product.id,
        name: product.name,
        quantity,
        unitCost,
        totalCost
      };
      const purchaseId = this.generateId();

      this.db.prepare(`UPDATE products SET stock = ?, costPrice = ?, updatedAt = ? WHERE id = ?`)
        .run(stockAfter, unitCost, now, product.id);

      this.db.prepare(`
        INSERT INTO purchase_orders (id, supplierId, items, totalCost, status, note, receivedAt, createdAt, updatedAt)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        purchaseId,
        data.supplierId || null,
        JSON.stringify([item]),
        totalCost,
        'received',
        data.note || null,
        now,
        now,
        now
      );

      this.db.prepare(`
        INSERT INTO stock_movements (id, productId, orderId, type, quantityChange, stockAfter, note, createdAt, updatedAt)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        this.generateId(),
        product.id,
        purchaseId,
        'purchase_received',
        quantity,
        stockAfter,
        data.note || `Purchase received ${purchaseId.slice(0, 8).toUpperCase()}`,
        now,
        now
      );

      const purchase = this.db.prepare(`SELECT * FROM purchase_orders WHERE id = ?`).get(purchaseId);
      return this.parseRow(purchase);
    });

    return tx();
  }

  // Settings operations
  async getSetting(key: string): Promise<any> {
    const result = this.db.prepare(`SELECT * FROM settings WHERE key = ?`).get(key);
    return result || null;
  }

  async setSetting(key: string, value: any): Promise<void> {
    const existing = await this.getSetting(key);

    if (existing) {
      this.db.prepare(`UPDATE settings SET value = ?, updatedAt = ? WHERE key = ?`).run(JSON.stringify(value), new Date().toISOString(), key);
    } else {
      this.db.prepare(`INSERT INTO settings (id, key, value, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?)`).run(this.generateId(), key, JSON.stringify(value), new Date().toISOString(), new Date().toISOString());
    }
  }

  // === STOCK ALERT RULES ===
  async listStockAlertRules(): Promise<any[]> {
    return this.list('stock_alert_rules', { orderBy: 'createdAt DESC' });
  }

  async createStockAlertRule(data: any): Promise<any> {
    return this.create('stock_alert_rules', {
      ...data,
      emailRecipients: Array.isArray(data.emailRecipients) ? JSON.stringify(data.emailRecipients) : data.emailRecipients,
      productIds: data.productIds ? JSON.stringify(data.productIds) : null,
      categories: data.categories ? JSON.stringify(data.categories) : null,
    });
  }

  async updateStockAlertRule(id: string, data: any): Promise<any> {
    return this.update('stock_alert_rules', id, {
      ...data,
      emailRecipients: Array.isArray(data.emailRecipients) ? JSON.stringify(data.emailRecipients) : data.emailRecipients,
      productIds: data.productIds ? JSON.stringify(data.productIds) : null,
      categories: data.categories ? JSON.stringify(data.categories) : null,
    });
  }

  async deleteStockAlertRule(id: string): Promise<void> {
    return this.delete('stock_alert_rules', id);
  }

  // === ANALYTICS ===
  async getHotProducts(daysBack = 30, limit = 10): Promise<any[]> {
    const sinceDate = new Date();
    sinceDate.setDate(sinceDate.getDate() - daysBack);

    // Get all completed orders and manually aggregate
    const orders = this.db.prepare(`
      SELECT id, items FROM orders
      WHERE orderStatus = 'completed' AND createdAt >= ?
      ORDER BY createdAt DESC
    `).all(sinceDate.toISOString()) as any[];

    const productMap = new Map<string, any>();

    for (const order of orders) {
      const items = typeof order.items === 'string' ? JSON.parse(order.items) : order.items;
      for (const item of items || []) {
        const key = item.id || item.productId;
        if (!productMap.has(key)) {
          productMap.set(key, {
            id: key,
            name: item.name,
            sku: item.sku,
            category: item.category,
            totalSold: 0,
            revenue: 0,
            transactionCount: 0,
          });
        }
        const entry = productMap.get(key);
        entry.totalSold += item.quantity || 1;
        entry.revenue += (item.price || 0) * (item.quantity || 1);
        entry.transactionCount += 1;
      }
    }

    return Array.from(productMap.values())
      .sort((a, b) => b.totalSold - a.totalSold)
      .slice(0, limit);
  }

  async getProductsByCategory(): Promise<any[]> {
    const sql = `
      SELECT 
        p.category,
        COUNT(*) as productCount,
        SUM(p.stock) as totalStock,
        AVG(p.price) as avgPrice
      FROM products p
      GROUP BY p.category
      ORDER BY productCount DESC
    `;
    return this.db.prepare(sql).all() as any[];
  }

  async getFinancialPosition(daysBack = 30): Promise<any> {
    const sinceDate = new Date();
    sinceDate.setDate(sinceDate.getDate() - daysBack);

    const sales = this.db.prepare(`
      SELECT 
        SUM(totalAmount) as totalSales,
        COUNT(*) as transactionCount,
        AVG(totalAmount) as avgTransaction
      FROM orders
      WHERE orderStatus = 'completed' AND createdAt >= ?
    `).get(sinceDate.toISOString()) as any;

    const refunds = this.db.prepare(`
      SELECT SUM(totalAmount) as totalRefunded
      FROM orders
      WHERE orderStatus = 'refunded' AND createdAt >= ?
    `).get(sinceDate.toISOString()) as any;

    const expenses = this.db.prepare(`
      SELECT SUM(amount) as totalExpenses
      FROM expenses
      WHERE createdAt >= ?
    `).get(sinceDate.toISOString()) as any;

    return {
      sales: sales?.totalSales || 0,
      transactionCount: sales?.transactionCount || 0,
      avgTransaction: sales?.avgTransaction || 0,
      refunds: refunds?.totalRefunded || 0,
      expenses: expenses?.totalExpenses || 0,
      daysBack,
    };
  }

  async getLowStockProducts(threshold = 10): Promise<any[]> {
    return this.db.prepare(`
      SELECT id, name, sku, stock, category, price, costPrice
      FROM products
      WHERE stock <= ?
      ORDER BY stock ASC
    `).all(threshold) as any[];
  }

  // Utility methods
  private generateId(): string {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
  }

  private parseRow(row: any): any {
    // Parse JSON fields
    if (row.items && typeof row.items === 'string') {
      try {
        row.items = JSON.parse(row.items);
      } catch (e) {
        console.warn('Failed to parse items JSON:', e);
      }
    }

    // Convert SQLite integer boolean to JS boolean
    if (typeof row.active === 'number') {
      row.active = row.active === 1;
    }

    return row;
  }

  private normalizeSqliteData(data: any): any {
    return Object.fromEntries(
      Object.entries({ ...data }).map(([key, value]) => [
        key,
        typeof value === 'boolean' ? (value ? 1 : 0) : value
      ])
    );
  }

  // Z Reports
  private parseIsoDate(value: string): Date | null {
    if (!value) return null;
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? null : d;
  }

  private startOfLocalDayIso(date: Date): string {
    const local = new Date(date);
    local.setHours(0, 0, 0, 0);
    return local.toISOString();
  }

  async createZReport(input: {
    createdBy?: string;
    rangeStart?: string; // ISO
    rangeEnd?: string; // ISO
    notes?: string;
  }): Promise<any> {
    const now = new Date();
    const rangeStart =
      input.rangeStart && this.parseIsoDate(input.rangeStart)
        ? input.rangeStart
        : this.startOfLocalDayIso(now);

    const rangeEnd =
      input.rangeEnd && this.parseIsoDate(input.rangeEnd)
        ? input.rangeEnd
        : now.toISOString();

    const orders = this.db.prepare(`
      SELECT *
      FROM orders
      WHERE createdAt >= ? AND createdAt <= ?
    `).all(rangeStart, rangeEnd);

    const totals = {
      orders: orders.length,
      completedCount: 0,
      voidedCount: 0,
      refundedCount: 0,

      subtotalSales: 0,
      vatSales: 0,
      grossSales: 0,

      cashPaid: 0,
      mpesaPaid: 0,

      refunds: 0,
    } as {
      orders: number;
      completedCount: number;
      voidedCount: number;
      refundedCount: number;

      subtotalSales: number;
      vatSales: number;
      grossSales: number;

      cashPaid: number;
      mpesaPaid: number;

      refunds: number;
    };

    for (const o of orders as any[]) {
      const status = String(o.orderStatus || 'completed');
      const totalAmount = Number(o.totalAmount || 0);
      const subtotal = Number(o.subtotal || 0);
      const vat = Number(o.vat || 0);

      if (status === 'completed') {
        totals.completedCount += 1;
        totals.subtotalSales += subtotal;
        totals.vatSales += vat;
        totals.grossSales += totalAmount;

        totals.cashPaid += Number(o.cashPaid || 0);
        totals.mpesaPaid += Number(o.mpesaPaid || 0);
      } else if (status === 'voided') {
        totals.voidedCount += 1;
      } else if (status === 'refunded') {
        totals.refundedCount += 1;
        totals.refunds += totalAmount;
      }
    }

    const report = {
      id: this.generateId(),
      createdAt: new Date().toISOString(),
      rangeStart,
      rangeEnd,
      createdBy: input.createdBy || null,
      totalsJson: JSON.stringify(totals),
      notes: input.notes || null,
      createdAtLocal: new Date().toLocaleString('en-KE')
    };

    this.db.prepare(`
      INSERT INTO z_reports (id, createdAt, rangeStart, rangeEnd, createdBy, totalsJson, notes, createdAtLocal)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      report.id,
      report.createdAt,
      report.rangeStart,
      report.rangeEnd,
      report.createdBy,
      report.totalsJson,
      report.notes,
      report.createdAtLocal
    );

    return {
      id: report.id,
      createdAt: report.createdAt,
      rangeStart: report.rangeStart,
      rangeEnd: report.rangeEnd,
      createdBy: report.createdBy,
      notes: report.notes,
      totals,
    };
  }

  async listZReports(options?: { limit?: number }): Promise<any[]> {
    const limitValue = options?.limit ? Math.max(1, options.limit) : 20;
    const rows = this.db.prepare(`
      SELECT *
      FROM z_reports
      ORDER BY createdAt DESC
      LIMIT ?
    `).all(limitValue);

    return (rows as any[]).map((row) => {
      let totals: unknown = null;
      try {
        totals = JSON.parse(String(row.totalsJson || '{}'));
      } catch {
        totals = {};
      }

      return {
        id: row.id,
        createdAt: row.createdAt,
        rangeStart: row.rangeStart,
        rangeEnd: row.rangeEnd,
        createdBy: row.createdBy,
        notes: row.notes,
        createdAtLocal: row.createdAtLocal,
        totals,
      };
    });
  }

// Backup and restore
  private getBackupsDir(): string {
    return path.join(path.dirname(this.dbPath), 'backups');
  }

  async createBackup(): Promise<{ id: string; fileName: string; createdAt: string; sizeBytes: number }> {
    const dir = this.getBackupsDir();
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    const createdAt = new Date();
    const fileName = `pos_backup_${createdAt.getTime()}.db`;
    const backupPath = path.join(dir, fileName);

    try {
      this.db.backup(backupPath);

      const stat = fs.statSync(backupPath);
      return {
        id: fileName,
        fileName,
        createdAt: createdAt.toISOString(),
        sizeBytes: stat.size,
      };
    } catch (error) {
      console.error('Failed to create backup:', error);
      throw new Error(`Failed to create backup: ${(error as Error).message}`);
    }
  }

  async listBackups(): Promise<Array<{ id: string; fileName: string; createdAt: string; sizeBytes: number }>> {
    const dir = this.getBackupsDir();
    
    // Ensure backups directory exists
    if (!fs.existsSync(dir)) {
      try {
        fs.mkdirSync(dir, { recursive: true });
      } catch (error) {
        console.error('Failed to create backups directory:', error);
        return [];
      }
    }

    try {
      const entries = fs.readdirSync(dir);
      const backups = entries
        .filter((name) => name.startsWith('pos_backup_') && name.endsWith('.db'))
        .map((name) => {
          const filePath = path.join(dir, name);
          try {
            const stat = fs.statSync(filePath);
            return {
              id: name,
              fileName: name,
              createdAt: stat.mtime.toISOString(),
              sizeBytes: stat.size,
            };
          } catch (statError) {
            console.error(`Failed to stat backup file ${name}:`, statError);
            return null;
          }
        })
        .filter((backup): backup is { id: string; fileName: string; createdAt: string; sizeBytes: number } => backup !== null)
        .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));

      return backups;
    } catch (error) {
      console.error('Failed to read backups directory:', error);
      return [];
    }
  }

  async backup(backupPath: string): Promise<void> {
    // Ensure parent exists
    const parentDir = path.dirname(backupPath);
    if (!fs.existsSync(parentDir)) {
      fs.mkdirSync(parentDir, { recursive: true });
    }

    this.db.backup(backupPath);
  }

  async restoreFrom(backupPath: string): Promise<void> {
    if (!backupPath) throw new Error('Backup path is required');
    if (!fs.existsSync(backupPath)) throw new Error('Backup file not found');

    try {
      // Prevent restore while another restore is happening (best-effort)
      // Close db, replace file, reopen.
      this.db.close();

      fs.copyFileSync(backupPath, this.dbPath);

      this.db = new Database(this.dbPath);
      this.initializeSchema();
    } catch (error) {
      // Try to reopen DB if restore failed
      try {
        this.db = new Database(this.dbPath);
        this.initializeSchema();
      } catch (reopenError) {
        console.error('Failed to reopen database after restore failed:', reopenError);
      }
      throw new Error(`Failed to restore backup: ${(error as Error).message}`);
    }
  }

  async restoreBackupById(backupId: string): Promise<void> {
    if (!backupId) throw new Error('Backup id is required');
    const backupPath = path.join(this.getBackupsDir(), backupId);
    await this.restoreFrom(backupPath);
  }

  // Expose DB file path for advanced flows/debug
  getDatabaseFilePath(): string {
    return this.dbPath;
  }

  // Close database
  close(): void {
    this.db.close();
  }
}

// Singleton instance
let dbInstance: POSDatabase | null = null;

export function getDatabase(): POSDatabase {
  if (!dbInstance) {
    dbInstance = new POSDatabase();
  }
  return dbInstance;
}

export function closeDatabase(): void {
  if (dbInstance) {
    dbInstance.close();
    dbInstance = null;
  }
}
