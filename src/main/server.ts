import express, { Express, Request, Response } from 'express';
import cors from 'cors';
import path from 'path';
import { getDatabase } from './database';

export function createServer(isDev: boolean): Express {
  const app = express();
  const db = getDatabase();

  // Middleware
  app.use(express.json());
  app.use(cors());

  // === AUTH API ===
  app.post('/api/auth/register', async (req: Request, res: Response) => {
    try {
      const user = await db.registerUser(req.body);
      res.json({ user });
    } catch (error) {
      const message = (error as Error).message;
      const status = message.includes('already exists') ? 409 : 400;
      res.status(status).json({ error: message });
    }
  });

  app.post('/api/auth/login', async (req: Request, res: Response) => {
    try {
      const user = await db.loginUser(req.body);
      res.json({ user });
    } catch (error) {
      res.status(401).json({ error: (error as Error).message });
    }
  });

  app.post('/api/auth/request-reset', async (req: Request, res: Response) => {
    try {
      const { email } = req.body;
      const result = await db.requestPasswordReset(email);
      res.json(result);
    } catch (error) {
      res.status(400).json({ error: (error as Error).message });
    }
  });

  app.post('/api/auth/reset-password', async (req: Request, res: Response) => {
    try {
      const user = await db.resetPassword(req.body);
      res.json({ user });
    } catch (error) {
      res.status(400).json({ error: (error as Error).message });
    }
  });

  app.post('/api/auth/biometric/register', async (req: Request, res: Response) => {
    try {
      const { email, credentialId } = req.body;
      const user = await db.registerBiometricCredential(email, credentialId);
      res.json({ user });
    } catch (error) {
      res.status(400).json({ error: (error as Error).message });
    }
  });

  app.get('/api/auth/biometric/credential', async (req: Request, res: Response) => {
    try {
      const { email } = req.query;
      const user = await db.getUserByEmail(email as string);
      if (!user || !user.biometricCredentialId) {
        return res.status(404).json({ error: 'No biometric credential registered' });
      }

      res.json({ credentialId: user.biometricCredentialId });
    } catch (error) {
      res.status(500).json({ error: (error as Error).message });
    }
  });

  app.post('/api/auth/biometric/login', async (req: Request, res: Response) => {
    try {
      const { email, credentialId } = req.body;
      const user = await db.loginWithBiometric(email, credentialId);
      res.json({ user });
    } catch (error) {
      res.status(401).json({ error: (error as Error).message });
    }
  });

  app.get('/api/users', async (req: Request, res: Response) => {
    try {
      const users = await db.listUsers();
      res.json(users);
    } catch (error) {
      res.status(500).json({ error: (error as Error).message });
    }
  });

  app.put('/api/users/:id', async (req: Request, res: Response) => {
    try {
      const user = await db.updateUser(req.params.id, req.body);
      res.json(user);
    } catch (error) {
      res.status(500).json({ error: (error as Error).message });
    }
  });

  // Serve static files in production
  if (!isDev) {
    app.use(express.static(path.join(__dirname, '../renderer/dist')));
  }

  // === PRODUCTS API ===
  app.get('/api/products', async (req: Request, res: Response) => {
    try {
      const { category, search } = req.query;
      const products = await db.listProducts({
        category: category as string,
        search: search as string
      });
      res.json(products);
    } catch (error) {
      res.status(500).json({ error: (error as Error).message });
    }
  });

  app.get('/api/products/:id', async (req: Request, res: Response) => {
    try {
      const product = await db.getProduct(req.params.id);
      if (!product) {
        return res.status(404).json({ error: 'Product not found' });
      }
      res.json(product);
    } catch (error) {
      res.status(500).json({ error: (error as Error).message });
    }
  });

  app.post('/api/products', async (req: Request, res: Response) => {
    try {
      const product = await db.createProduct(req.body);
      res.json(product);
    } catch (error) {
      res.status(500).json({ error: (error as Error).message });
    }
  });

  app.put('/api/products/:id', async (req: Request, res: Response) => {
    try {
      const product = await db.updateProduct(req.params.id, req.body);
      res.json(product);
    } catch (error) {
      res.status(500).json({ error: (error as Error).message });
    }
  });

  app.delete('/api/products/:id', async (req: Request, res: Response) => {
    try {
      await db.deleteProduct(req.params.id);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: (error as Error).message });
    }
  });

  app.get('/api/products/:id/movements', async (req: Request, res: Response) => {
    try {
      const movements = await db.listStockMovements(req.params.id);
      res.json(movements);
    } catch (error) {
      res.status(500).json({ error: (error as Error).message });
    }
  });

  app.post('/api/products/:id/movements', async (req: Request, res: Response) => {
    try {
      const movement = await db.recordStockMovement({
        ...req.body,
        productId: req.params.id
      });
      res.json(movement);
    } catch (error) {
      res.status(400).json({ error: (error as Error).message });
    }
  });

  // === ORDERS API ===
  app.get('/api/orders', async (req: Request, res: Response) => {
    try {
      const { staffId, limit } = req.query;
      const orders = await db.listOrders({
        staffId: staffId as string,
        limit: limit ? parseInt(limit as string) : undefined
      });
      res.json(orders);
    } catch (error) {
      res.status(500).json({ error: (error as Error).message });
    }
  });

  app.post('/api/orders', async (req: Request, res: Response) => {
    try {
      const order = await db.createOrder(req.body);
      res.json(order);
    } catch (error) {
      res.status(500).json({ error: (error as Error).message });
    }
  });

  app.put('/api/orders/:id', async (req: Request, res: Response) => {
    try {
      const order = await db.updateOrder(req.params.id, req.body);
      res.json(order);
    } catch (error) {
      res.status(500).json({ error: (error as Error).message });
    }
  });

  // === CUSTOMERS API ===
  app.get('/api/customers', async (req: Request, res: Response) => {
    try {
      const { search } = req.query;
      const customers = await db.listCustomers({ search: search as string });
      res.json(customers);
    } catch (error) {
      res.status(500).json({ error: (error as Error).message });
    }
  });

  app.post('/api/customers', async (req: Request, res: Response) => {
    try {
      const customer = await db.createCustomer(req.body);
      res.json(customer);
    } catch (error) {
      res.status(500).json({ error: (error as Error).message });
    }
  });

  app.put('/api/customers/:id', async (req: Request, res: Response) => {
    try {
      const customer = await db.updateCustomer(req.params.id, req.body);
      res.json(customer);
    } catch (error) {
      res.status(500).json({ error: (error as Error).message });
    }
  });

  app.delete('/api/customers/:id', async (req: Request, res: Response) => {
    try {
      await db.deleteCustomer(req.params.id);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: (error as Error).message });
    }
  });

  app.get('/api/customers/:id/ledger', async (req: Request, res: Response) => {
    try {
      const entries = await db.listCustomerLedger(req.params.id);
      res.json(entries);
    } catch (error) {
      res.status(500).json({ error: (error as Error).message });
    }
  });

  app.post('/api/customers/:id/debt', async (req: Request, res: Response) => {
    try {
      const result = await db.recordCustomerDebt(req.params.id, req.body);
      res.json(result);
    } catch (error) {
      res.status(400).json({ error: (error as Error).message });
    }
  });

  app.post('/api/customers/:id/payments', async (req: Request, res: Response) => {
    try {
      const result = await db.recordCustomerPayment(req.params.id, req.body);
      res.json(result);
    } catch (error) {
      res.status(400).json({ error: (error as Error).message });
    }
  });

  // === EXPENSES API ===
  app.get('/api/expenses', async (req: Request, res: Response) => {
    try {
      const { search, limit } = req.query;
      const expenses = await db.listExpenses({
        search: search as string,
        limit: limit ? parseInt(limit as string) : undefined
      });
      res.json(expenses);
    } catch (error) {
      res.status(500).json({ error: (error as Error).message });
    }
  });

  app.post('/api/expenses', async (req: Request, res: Response) => {
    try {
      const expense = await db.createExpense(req.body);
      res.json(expense);
    } catch (error) {
      res.status(400).json({ error: (error as Error).message });
    }
  });

  app.delete('/api/expenses/:id', async (req: Request, res: Response) => {
    try {
      await db.deleteExpense(req.params.id);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: (error as Error).message });
    }
  });

  // === SUPPLIERS & PURCHASES API ===
  app.get('/api/suppliers', async (req: Request, res: Response) => {
    try {
      const suppliers = await db.listSuppliers();
      res.json(suppliers);
    } catch (error) {
      res.status(500).json({ error: (error as Error).message });
    }
  });

  app.post('/api/suppliers', async (req: Request, res: Response) => {
    try {
      const supplier = await db.createSupplier(req.body);
      res.json(supplier);
    } catch (error) {
      res.status(400).json({ error: (error as Error).message });
    }
  });

  app.get('/api/purchases', async (req: Request, res: Response) => {
    try {
      const { limit } = req.query;
      const purchases = await db.listPurchases({
        limit: limit ? parseInt(limit as string) : undefined
      });
      res.json(purchases);
    } catch (error) {
      res.status(500).json({ error: (error as Error).message });
    }
  });

  app.post('/api/purchases/receive', async (req: Request, res: Response) => {
    try {
      const purchase = await db.receivePurchase(req.body);
      res.json(purchase);
    } catch (error) {
      res.status(400).json({ error: (error as Error).message });
    }
  });

// === SETTINGS API ===
  app.get('/api/settings/:key', async (req: Request, res: Response) => {
    try {
      const setting = await db.getSetting(req.params.key);
      res.json(setting);
    } catch (error) {
      res.status(500).json({ error: (error as Error).message });
    }
  });

  app.post('/api/settings/:key', async (req: Request, res: Response) => {
    try {
      await db.setSetting(req.params.key, req.body.value);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: (error as Error).message });
    }
  });

  // === SYNC API ===
  app.get('/api/sync/queue', async (req: Request, res: Response) => {
    try {
      const limit = req.query.limit ? parseInt(String(req.query.limit), 10) : 100;
      const queue = await db.listPendingSync(limit);
      res.json(queue);
    } catch (error) {
      res.status(500).json({ error: (error as Error).message });
    }
  });

  app.post('/api/sync/queue/:id/complete', async (req: Request, res: Response) => {
    try {
      await db.markSyncSuccess(req.params.id);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: (error as Error).message });
    }
  });

  app.post('/api/sync/queue/:id/fail', async (req: Request, res: Response) => {
    try {
      await db.markSyncFailure(req.params.id, String(req.body.error || 'Unknown error'));
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: (error as Error).message });
    }
  });

  app.post('/api/sync/apply', async (req: Request, res: Response) => {
    try {
      const { collection, item, operation } = req.body;
      if (!collection || !item || !item.id) {
        return res.status(400).json({ error: 'collection and item.id are required' });
      }
      const result = await db.applyRemoteChange(collection, item.id, item, operation || 'update');
      res.json(result);
    } catch (error) {
      res.status(500).json({ error: (error as Error).message });
    }
  });

  // === Z-REPORTS API ===
  app.get('/api/zreports', async (req: Request, res: Response) => {
    try {
      const limit = req.query.limit ? parseInt(String(req.query.limit), 10) : undefined;
      const reports = await db.listZReports({ limit });
      res.json(reports);
    } catch (error) {
      res.status(500).json({ error: (error as Error).message });
    }
  });

  app.post('/api/zreports', async (req: Request, res: Response) => {
    try {
      const report = await db.createZReport({
        createdBy: req.body?.createdBy || null,
        rangeStart: req.body?.rangeStart,
        rangeEnd: req.body?.rangeEnd,
        notes: req.body?.notes,
      });
      res.json(report);
    } catch (error) {
      res.status(400).json({ error: (error as Error).message });
    }
  });

  // === BACKUP / RESTORE API ===
  app.get('/api/backups', async (_req: Request, res: Response) => {
    try {
      const backups = await db.listBackups();
      res.json(backups);
    } catch (error) {
      res.status(500).json({ error: (error as Error).message });
    }
  });

  app.post('/api/backups/create', async (_req: Request, res: Response) => {
    try {
      const backup = await db.createBackup();
      res.json(backup);
    } catch (error) {
      res.status(500).json({ error: (error as Error).message });
    }
  });

  app.post('/api/backups/restore', async (req: Request, res: Response) => {
    try {
      const backupId = String(req.body?.backupId || '');
      if (!backupId) {
        return res.status(400).json({ error: 'backupId is required' });
      }
      await db.restoreBackupById(backupId);
      res.json({ success: true });
    } catch (error) {
      res.status(400).json({ error: (error as Error).message });
    }
  });

  // === HEALTH CHECK ===
  app.get('/api/health', (req: Request, res: Response) => {
    res.json({ status: 'ok' });
  });

  // Serve React app in production
  if (!isDev) {
    app.get('*', (req: Request, res: Response) => {
      res.sendFile(path.join(__dirname, '../renderer/dist/index.html'));
    });
  }

  return app;
}
