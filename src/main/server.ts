import express, { Express, Request, Response } from 'express';
import cors from 'cors';
import path from 'path';
import os from 'os';
import http from 'http';
import https from 'https';
import crypto from 'crypto';
import nodemailer from 'nodemailer';
import { getDatabase } from './database';
import LipanaPaymentService from './mpesaService';

const LICENSE_SIGNING_SECRET = process.env.LICENSE_SIGNING_SECRET?.trim() || 'nonepos-default-license-secret-v1';

function normalizeLicenseKey(value: string) {
  return String(value).toUpperCase().replace(/[^A-Z0-9]/g, '');
}

function isLicenseKeyFormat(value: string) {
  const normalized = normalizeLicenseKey(value);
  return /^[A-Z0-9]{16}$/.test(normalized);
}

function createLicenseSignature(payload: string) {
  return crypto.createHmac('sha256', LICENSE_SIGNING_SECRET)
    .update(payload)
    .digest('hex')
    .slice(0, 4)
    .toUpperCase();
}

function verifyLicenseKey(key: string) {
  const normalized = normalizeLicenseKey(key);
  if (!/^[A-Z0-9]{16}$/.test(normalized)) {
    return false;
  }

  const payload = normalized.slice(0, 12);
  const checksum = normalized.slice(12);
  return createLicenseSignature(payload) === checksum;
}

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
      if (!email) {
        return res.status(400).json({ error: 'Email is required' });
      }

      const result = await db.requestPasswordReset(email);
      await sendPasswordResetEmail(email, result.resetToken);
      res.json({ success: true, message: 'Reset code sent to your email address' });
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

      const product = await db.getProduct(req.params.id);
      const ownerSetting = await db.getSetting('ownerNotifications');
      const ownerConfig = ownerSetting?.value ? JSON.parse(ownerSetting.value) : null;
      const threshold = ownerConfig?.lowStockThreshold ?? 10;

      if (product && movement.type && movement.type.toLowerCase().includes('sale') && product.stock <= threshold) {
        void sendOwnerNotification(
          `Low stock alert: ${product.name}`,
          `Stock has declined below the threshold for ${product.name} (${product.sku || 'SKU unknown'}).\nRemaining quantity: ${product.stock}\nReorder now to avoid stockout.`
        );
      }
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

      void sendOwnerNotification(
        `New sale recorded: ${order.id}`,
        `A new sale has been completed.\nOrder ID: ${order.id}\nTotal: Ksh ${Number(order.totalAmount || order.total || 0).toFixed(2)}\nCustomer: ${order.customerName || order.customer?.name || 'Walk-in'}\nPayment: ${order.paymentMethod || 'Unknown'}\nDate: ${new Date(order.createdAt || Date.now()).toLocaleString()}`
      );
    } catch (error) {
      res.status(500).json({ error: (error as Error).message });
    }
  });

  app.put('/api/orders/:id', async (req: Request, res: Response) => {
    try {
      const order = await db.updateOrder(req.params.id, req.body);
      res.json(order);

      const isRefund = req.body.status === 'refunded' || req.body.refundedAmount || req.body.refundAmount;
      if (isRefund) {
        void sendOwnerNotification(
          `Refund processed for order ${order.id}`,
          `A refund has been processed.\nOrder ID: ${order.id}\nRefund amount: Ksh ${Number(req.body.refundedAmount || req.body.refundAmount || 0).toFixed(2)}\nCustomer: ${order.customerName || order.customer?.name || 'Unknown'}\nDate: ${new Date().toLocaleString()}`
        );
      }
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

      void sendOwnerNotification(
        `New expense recorded: ${expense.category || expense.description || 'Expense'}`,
        `A new expense has been added.\nCategory: ${expense.category || expense.description || 'General'}\nAmount: Ksh ${Number(expense.amount || 0).toFixed(2)}\nDate: ${new Date(expense.createdAt || Date.now()).toLocaleString()}`
      );
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

      void sendOwnerNotification(
        `Purchase received: ${purchase.id}`,
        `A purchase order has been received and stock has been updated.\nPurchase ID: ${purchase.id}\nTotal items received: ${purchase.totalItems || 'Unknown'}\nDate: ${new Date(purchase.receivedAt || Date.now()).toLocaleString()}`
      );
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

  app.post('/api/billing/activate', async (req: Request, res: Response) => {
    try {
      const { licenseKey, terminalId, plan } = req.body || {};
      if (!licenseKey || !terminalId) {
        return res.status(400).json({ error: 'License key and terminal ID are required for activation' });
      }

      if (!plan) {
        return res.status(400).json({ error: 'Plan selection is required' });
      }

      const normalizedKey = String(licenseKey).trim();
      if (!isLicenseKeyFormat(normalizedKey) || !verifyLicenseKey(normalizedKey)) {
        return res.status(400).json({ error: 'Invalid activation key. Please contact support for a valid activation key.' });
      }

      // Calculate expiry based on plan
      const now = new Date();
      let expiresAt: Date;

      switch (plan.toLowerCase()) {
        case 'lifetime':
          expiresAt = new Date(now.getTime() + 100 * 365 * 24 * 60 * 60 * 1000); // 100 years
          break;
        case '12months':
          expiresAt = new Date(now.getTime() + 12 * 30 * 24 * 60 * 60 * 1000);
          break;
        case '9months':
          expiresAt = new Date(now.getTime() + 9 * 30 * 24 * 60 * 60 * 1000);
          break;
        case '6months':
          expiresAt = new Date(now.getTime() + 6 * 30 * 24 * 60 * 60 * 1000);
          break;
        case '3months':
          expiresAt = new Date(now.getTime() + 3 * 30 * 24 * 60 * 60 * 1000);
          break;
        case 'monthly':
          expiresAt = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
          break;
        default:
          return res.status(400).json({ error: 'Invalid plan selected' });
      }

      const planLabel = normalizedKey.toUpperCase().includes('PRO')
        ? 'Professional'
        : normalizedKey.toUpperCase().includes('PREMIUM')
        ? 'Premium'
        : 'Standard';

      const billingRecord = {
        active: true,
        plan: plan,
        planLabel: planLabel,
        licenseKey: normalizedKey,
        terminalId,
        activationUrl: `https://billing.nonepos.local/activate?license=${encodeURIComponent(normalizedKey)}&terminal=${encodeURIComponent(terminalId)}&plan=${encodeURIComponent(plan)}`,
        expiresAt: expiresAt.toISOString(),
        lastChecked: new Date().toISOString(),
      };

      await db.setSetting('billing', billingRecord);
      res.json({ billing: billingRecord });
    } catch (error) {
      res.status(500).json({ error: (error as Error).message });
    }
  });

  // === M-PESA BILLING PAYMENT ===
  app.post('/api/billing/mpesa-initiate', async (req: Request, res: Response) => {
    try {
      const { phone, amount, licenseKey, terminalId, plan } = req.body || {};

      if (!phone || !amount || !plan) {
        return res.status(400).json({ error: 'Phone, amount, and plan are required' });
      }

      const lipanaKey = String(process.env.LIPANA_SECRET_KEY || '').trim();
      const lipanaEnvironment = (process.env.LIPANA_ENVIRONMENT || 'sandbox') as 'sandbox' | 'production';

      if (!lipanaKey) {
        console.error('[LIPANA] Missing configuration: LIPANA_SECRET_KEY is required');
        return res.status(500).json({ error: 'Payment gateway is not configured. Please contact support.' });
      }

      const lipanaService = new LipanaPaymentService({
        apiKey: lipanaKey,
        environment: lipanaEnvironment,
      });

      const paymentResponse = await lipanaService.initiatePayment({
        phone,
        amount: Number(amount),
        description: `NonePOS ${plan} Plan Activation`,
        licenseKey,
        terminalId,
      });

      const paymentRecord = {
        id: paymentResponse.transactionId,
        lipanaTransactionId: paymentResponse.lipanaTransactionId,
        phone: paymentResponse.phone,
        amount: paymentResponse.amount,
        plan,
        licenseKey,
        terminalId,
        status: 'PENDING',
        createdAt: new Date().toISOString(),
      };

      await db.setSetting(`lipana_payment_${paymentResponse.transactionId}`, paymentRecord);

      res.json({
        ok: true,
        transactionId: paymentResponse.transactionId,
        lipanaTransactionId: paymentResponse.lipanaTransactionId,
        message: paymentResponse.message,
      });
    } catch (error) {
      console.error('[LIPANA] Payment initiation error:', error);
      res.status(500).json({ error: (error as Error).message || 'Failed to initiate payment' });
    }
  });

  app.get('/api/billing/mpesa-status/:transactionId', async (req: Request, res: Response) => {
    try {
      const { transactionId } = req.params;

      const paymentRecord = await db.getSetting(`lipana_payment_${transactionId}`);
      if (!paymentRecord?.value) {
        return res.status(404).json({ error: 'Transaction not found' });
      }

      const payment = JSON.parse(paymentRecord.value);

      if (payment.status === 'COMPLETED') {
        return res.json({ status: 'success', message: 'Payment completed' });
      }

      const lipanaKey = String(process.env.LIPANA_SECRET_KEY || '').trim();
      const lipanaEnvironment = (process.env.LIPANA_ENVIRONMENT || 'sandbox') as 'sandbox' | 'production';
      if (!lipanaKey) {
        return res.status(500).json({ error: 'Payment gateway is not configured.' });
      }

      const lipanaService = new LipanaPaymentService({
        apiKey: lipanaKey,
        environment: lipanaEnvironment,
      });

      const transactionIdToCheck = payment.lipanaTransactionId || payment.id || transactionId;
      const statusResponse = await lipanaService.checkPaymentStatus(transactionIdToCheck);

      if (statusResponse.status === 'SUCCESS') {
        payment.status = 'COMPLETED';
        payment.completedAt = new Date().toISOString();

        const planDurations: Record<string, number> = {
          lifetime: 100 * 365,
          '12months': 12 * 30,
          '9months': 9 * 30,
          '6months': 6 * 30,
          '3months': 3 * 30,
          monthly: 30,
        };

        const days = planDurations[payment.plan] || 30;
        const expiresAt = payment.plan === 'lifetime'
          ? new Date(Date.now() + planDurations.lifetime * 24 * 60 * 60 * 1000)
          : new Date(Date.now() + days * 24 * 60 * 60 * 1000);

        const billingData = {
          active: true,
          plan: payment.plan,
          licenseKey: payment.licenseKey,
          terminalId: payment.terminalId,
          expiresAt: expiresAt.toISOString(),
          lastChecked: new Date().toISOString(),
          paymentStatus: 'COMPLETED',
          lipanaTransactionId: transactionIdToCheck,
        };

        await db.setSetting('billing', billingData);
        await db.setSetting(`lipana_payment_${transactionId}`, payment);
      }

      res.json({
        status: statusResponse.status.toLowerCase(),
        transactionId,
        message: statusResponse.status === 'SUCCESS'
          ? 'Payment successful! License activated.'
          : `Payment ${statusResponse.status.toLowerCase()}`,
      });
    } catch (error) {
      console.error('[LIPANA] Status check error:', error);
      res.status(500).json({ error: (error as Error).message || 'Failed to check payment status' });
    }
  });

  app.post('/api/billing/mpesa-callback', async (req: Request, res: Response) => {
    try {
      const callbackData = req.body;
      console.log('[LIPANA] Webhook callback received:', JSON.stringify(callbackData, null, 2));

      const status = callbackData?.status || callbackData?.data?.status || callbackData?.result?.status;
      const transactionId = callbackData?.data?.transactionId || callbackData?.transactionId || callbackData?.checkoutRequestId;
      const phone = callbackData?.data?.phone || callbackData?.data?.phoneNumber || callbackData?.phone;
      const amount = callbackData?.data?.amount || callbackData?.amount;

      if (String(status).toLowerCase() === 'success') {
        const paymentRecords = await db.getSetting(`lipana_payment_${transactionId}`);
        if (paymentRecords?.value) {
          const payment = JSON.parse(paymentRecords.value);
          payment.status = 'COMPLETED';
          payment.completedAt = new Date().toISOString();
          payment.callbackPayload = callbackData;
          await db.setSetting(`lipana_payment_${transactionId}`, payment);

          const planDurations: Record<string, number> = {
            lifetime: 100 * 365,
            '12months': 12 * 30,
            '9months': 9 * 30,
            '6months': 6 * 30,
            '3months': 3 * 30,
            monthly: 30,
          };

          const days = planDurations[payment.plan] || 30;
          const expiresAt = payment.plan === 'lifetime'
            ? new Date(Date.now() + planDurations.lifetime * 24 * 60 * 60 * 1000)
            : new Date(Date.now() + days * 24 * 60 * 60 * 1000);

          const billingData = {
            active: true,
            plan: payment.plan,
            licenseKey: payment.licenseKey,
            terminalId: payment.terminalId,
            expiresAt: expiresAt.toISOString(),
            lastChecked: new Date().toISOString(),
            paymentStatus: 'COMPLETED',
            lipanaTransactionId: transactionId,
          };
          await db.setSetting('billing', billingData);
        }
      }

      res.json({ received: true });
    } catch (error) {
      console.error('[LIPANA] Webhook error:', error);
      res.status(500).json({ error: 'Error processing callback' });
    }
  });

  app.use('/api', async (req: Request, res: Response, next: any) => {
    // Allow auth, settings, billing activation, backups, and sync endpoints to work without an active license.
    const publicPaths = ['/auth', '/settings', '/billing', '/backups', '/sync'];
    if (publicPaths.some(path => req.path.startsWith(path))) {
      return next();
    }

    const billingSetting = await db.getSetting('billing');
    const config = billingSetting?.value ? JSON.parse(billingSetting.value) : null;
    const isActive = Boolean(config?.active) && (!config?.expiresAt || new Date(config.expiresAt) > new Date());

    if (!isActive) {
      return res.status(402).json({ error: 'License inactive. Please activate your POS subscription via /billing.' });
    }

    next();
  });

  // === EMAIL RECEIPTS ===
  function sendBrevoApiEmail(apiKey: string, payload: Record<string, any>) {
    return new Promise<void>((resolve, reject) => {
      const requestBody = JSON.stringify(payload);
      const request = https.request(
        {
          hostname: 'api.brevo.com',
          path: '/v3/smtp/email',
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Content-Length': Buffer.byteLength(requestBody),
            'api-key': apiKey,
          },
        },
        (response) => {
          let responseBody = '';
          response.on('data', (chunk) => {
            responseBody += chunk;
          });
          response.on('end', () => {
            if (response.statusCode && response.statusCode >= 200 && response.statusCode < 300) {
              resolve();
            } else {
              reject(new Error(`Brevo API error ${response.statusCode}: ${responseBody || response.statusMessage}`));
            }
          });
        }
      );

      request.on('error', reject);
      request.write(requestBody);
      request.end();
    });
  }

  async function sendWhatsAppMessage(config: any, message: string, recipients: string[]) {
    if (!config?.apiUrl || !recipients?.length) {
      return;
    }

    const payloadTemplate = config.payloadTemplate || '{"to":"%to%","from":"%from%","body":"%message%"}';
    const sender = config.sender || '';
    const subject = config.subjectPrefix || '';

    await Promise.all(recipients.map((recipient: string) => {
      return new Promise<void>((resolve, reject) => {
        const templateText = payloadTemplate
          .replace(/%to%/g, recipient)
          .replace(/%from%/g, sender)
          .replace(/%message%/g, message)
          .replace(/%subject%/g, subject);

        let requestBody: any = { to: recipient, from: sender, body: message, subject };
        try {
          requestBody = JSON.parse(templateText);
        } catch {
          requestBody = { to: recipient, from: sender, body: message, subject };
        }

        const endpoint = new URL(config.apiUrl);
        const headers: Record<string, string> = {
          'Content-Type': config.contentType || 'application/json',
        };

        if (config.apiKey) {
          const headerName = config.keyHeaderName || 'Authorization';
          headers[headerName] = config.apiKey.startsWith('Bearer ') ? config.apiKey : `Bearer ${config.apiKey}`;
        }

        const transport = endpoint.protocol === 'http:' ? http : https;
        const request = transport.request(
          {
            hostname: endpoint.hostname,
            port: endpoint.port ? Number(endpoint.port) : endpoint.protocol === 'https:' ? 443 : 80,
            path: `${endpoint.pathname}${endpoint.search}`,
            method: 'POST',
            headers,
          },
          (response) => {
            let responseBody = '';
            response.on('data', (chunk) => {
              responseBody += chunk;
            });
            response.on('end', () => {
              if (response.statusCode && response.statusCode >= 200 && response.statusCode < 300) {
                resolve();
              } else {
                reject(new Error(`WhatsApp API error ${response.statusCode}: ${responseBody || response.statusMessage}`));
              }
            });
          }
        );

        request.on('error', reject);
        request.write(JSON.stringify(requestBody));
        request.end();
      });
    }));
  }

  async function sendSmsMessage(config: any, message: string, recipients: string[]) {
    if (!config?.apiUrl || !recipients?.length) {
      return;
    }

    const payloadTemplate = config.payloadTemplate || '{"to":"%to%","from":"%from%","body":"%message%"}';
    const sender = config.sender || '';

    await Promise.all(recipients.map((recipient: string) => {
      return new Promise<void>((resolve, reject) => {
        const templateText = payloadTemplate
          .replace(/%to%/g, recipient)
          .replace(/%from%/g, sender)
          .replace(/%message%/g, message);

        let requestBody: any = { to: recipient, from: sender, body: message };
        try {
          requestBody = JSON.parse(templateText);
        } catch {
          requestBody = { to: recipient, from: sender, body: message };
        }

        const endpoint = new URL(config.apiUrl);
        const headers: Record<string, string> = {
          'Content-Type': config.contentType || 'application/json',
        };

        if (config.apiKey) {
          const headerName = config.keyHeaderName || 'Authorization';
          headers[headerName] = config.apiKey.startsWith('Bearer ') ? config.apiKey : `Bearer ${config.apiKey}`;
        }

        const transport = endpoint.protocol === 'http:' ? http : https;
        const request = transport.request(
          {
            hostname: endpoint.hostname,
            port: endpoint.port ? Number(endpoint.port) : endpoint.protocol === 'https:' ? 443 : 80,
            path: `${endpoint.pathname}${endpoint.search}`,
            method: 'POST',
            headers,
          },
          (response) => {
            let responseBody = '';
            response.on('data', (chunk) => {
              responseBody += chunk;
            });
            response.on('end', () => {
              if (response.statusCode && response.statusCode >= 200 && response.statusCode < 300) {
                resolve();
              } else {
                reject(new Error(`SMS API error ${response.statusCode}: ${responseBody || response.statusMessage}`));
              }
            });
          }
        );

        request.on('error', reject);
        request.write(JSON.stringify(requestBody));
        request.end();
      });
    }));
  }

  async function sendOwnerEmailNotification(subject: string, message: string, recipients: string[]) {
    if (!recipients?.length) {
      return;
    }

    const emailSetting = await db.getSetting('emailReceipts');
    if (!emailSetting?.value) {
      return;
    }

    const config = JSON.parse(emailSetting.value);
    if (!config.fromEmail) {
      return;
    }

    const businessSetting = await db.getSetting('business');
    const businessInfo = businessSetting?.value ? JSON.parse(businessSetting.value) : {};
    const html = `
      <div style="font-family:Arial,sans-serif;color:#111;background:#ffffff;padding:20px;">
        <h2 style="margin-bottom:12px;">${subject}</h2>
        <p style="line-height:1.6;color:#333;">${message.replace(/\n/g, '<br/>')}</p>
        <hr style="margin:24px 0;border:none;border-top:1px solid #e2e8f0;" />
        <p style="font-size:12px;color:#6b7280;">${businessInfo.name || 'OmniSync POS'}</p>
      </div>
    `;

    const transportMode = config.transportMode || 'smtp';
    if (transportMode === 'brevo-api') {
      if (!config.brevoApiKey) {
        return;
      }

      const payload: Record<string, any> = {
        sender: {
          email: config.fromEmail,
          name: businessInfo.name || 'OmniSync POS',
        },
        to: recipients.map((email: string) => ({ email })),
        subject,
        htmlContent: html,
      };

      await sendBrevoApiEmail(config.brevoApiKey, payload);
      return;
    }

    const transportOptions: any = {};
    if (transportMode === 'direct') {
      transportOptions.direct = true;
      transportOptions.name = os.hostname() || 'localhost';
      transportOptions.tls = { rejectUnauthorized: false };
    } else {
      const host = config.smtpHost || (transportMode === 'brevo' ? 'smtp-relay.brevo.com' : undefined);
      const port = config.smtpPort || (transportMode === 'brevo' ? 587 : undefined);

      if (!host || !port) {
        return;
      }

      transportOptions.host = host;
      transportOptions.port = Number(port);
      transportOptions.secure = Boolean(config.smtpSecure);
      transportOptions.tls = { rejectUnauthorized: false };

      if (config.smtpUser && config.smtpPass) {
        transportOptions.auth = {
          user: config.smtpUser,
          pass: config.smtpPass,
        };
      }
    }

    const transporter = nodemailer.createTransport(transportOptions);
    await transporter.sendMail({
      from: config.fromEmail,
      to: recipients.join(', '),
      subject,
      html,
    });
  }

  async function sendPasswordResetEmail(email: string, token: string) {
    const emailSetting = await db.getSetting('emailReceipts');
    if (!emailSetting?.value) {
      throw new Error('Email transport is not configured');
    }

    const config = JSON.parse(emailSetting.value);
    if (!config.enabled || !config.fromEmail) {
      throw new Error('Email transport is not configured');
    }

    const businessSetting = await db.getSetting('business');
    const businessInfo = businessSetting?.value ? JSON.parse(businessSetting.value) : {};
    const subject = 'NonePOS Password Reset Code';
    const html = `
      <div style="font-family:Arial,sans-serif;color:#111;background:#ffffff;padding:20px;">
        <h2 style="margin-bottom:12px;">Password Reset Request</h2>
        <p style="line-height:1.6;color:#333;">A password reset was requested for your account.</p>
        <p style="font-size:16px;font-weight:700;background:#f5f7fb;padding:12px;border-radius:8px;display:inline-block;">${token}</p>
        <p style="margin-top:16px;color:#333;">Enter this code in the app to complete the password reset. The code expires in one hour.</p>
        <hr style="margin:24px 0;border:none;border-top:1px solid #e2e8f0;" />
        <p style="font-size:12px;color:#6b7280;">${businessInfo.name || 'NonePOS'}</p>
      </div>
    `;

    const transportMode = config.transportMode || 'smtp';
    if (transportMode === 'brevo-api') {
      if (!config.brevoApiKey) {
        throw new Error('Brevo API key is missing for password reset email');
      }

      const payload: Record<string, any> = {
        sender: {
          email: config.fromEmail,
          name: businessInfo.name || 'NonePOS',
        },
        to: [{ email }],
        subject,
        htmlContent: html,
      };

      await sendBrevoApiEmail(config.brevoApiKey, payload);
      return;
    }

    const transportOptions: any = {};
    if (transportMode === 'direct') {
      transportOptions.direct = true;
      transportOptions.name = os.hostname() || 'localhost';
      transportOptions.tls = { rejectUnauthorized: false };
    } else {
      const host = config.smtpHost || (transportMode === 'brevo' ? 'smtp-relay.brevo.com' : undefined);
      const port = config.smtpPort || (transportMode === 'brevo' ? 587 : undefined);

      if (!host || !port) {
        throw new Error('Email transport host and port are required');
      }

      transportOptions.host = host;
      transportOptions.port = Number(port);
      transportOptions.secure = Boolean(config.smtpSecure);
      transportOptions.tls = { rejectUnauthorized: false };

      if (config.smtpUser && config.smtpPass) {
        transportOptions.auth = {
          user: config.smtpUser,
          pass: config.smtpPass,
        };
      }
    }

    const transporter = nodemailer.createTransport(transportOptions);
    await transporter.sendMail({
      from: config.fromEmail,
      to: email,
      subject,
      html,
    });
  }

  async function sendOwnerNotification(subject: string, message: string) {
    const ownerSetting = await db.getSetting('ownerNotifications');
    if (!ownerSetting?.value) {
      return;
    }

    const config = JSON.parse(ownerSetting.value);
    if (!config.enabled) {
      return;
    }

    const notifications: Promise<void>[] = [];

    if (config.email?.enabled && Array.isArray(config.email.recipients) && config.email.recipients.length) {
      const subjectPrefix = String(config.email.subjectPrefix || '');
      const combinedSubject = `${subjectPrefix ? `${subjectPrefix} ` : ''}${subject}`.trim();
      notifications.push(sendOwnerEmailNotification(combinedSubject, message, config.email.recipients));
    }

    if (config.whatsapp?.enabled && Array.isArray(config.whatsapp.recipients) && config.whatsapp.recipients.length) {
      notifications.push(sendWhatsAppMessage(config.whatsapp, message, config.whatsapp.recipients));
    }

    if (config.sms?.enabled && Array.isArray(config.sms.recipients) && config.sms.recipients.length) {
      notifications.push(sendSmsMessage(config.sms, message, config.sms.recipients));
    }

    await Promise.allSettled(notifications);
  }

  async function sendCustomerInvoiceSms(phone: string, message: string) {
    const ownerSetting = await db.getSetting('ownerNotifications');
    if (!ownerSetting?.value) {
      return;
    }

    const config = JSON.parse(ownerSetting.value);
    if (!config.sms?.enabled) {
      return;
    }

    await sendSmsMessage(config.sms, message, [phone]);
  }

  function buildReceiptHtml(order: any, businessInfo: any, config: any) {
    const formatMoney = (value: number) => Number(value || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    const cashier = order.cashierName || order.staffName || order.cashier || 'Cashier';
    const customerName = order.customerName || order.customer?.name || 'Customer';
    const createdAt = new Date(order.createdAt || Date.now()).toLocaleString();
    const items = Array.isArray(order.items) ? order.items : [];
    const itemRows = items.map((item: any) => {
      const lineTotal = Number(item.price || 0) * Number(item.quantity || 1);
      return `
        <tr>
          <td class="item-name">${item.name || item.sku || 'Item'}</td>
          <td class="item-total">${formatMoney(lineTotal)}</td>
        </tr>
        <tr>
          <td class="item-meta">${item.quantity || 1} x ${formatMoney(Number(item.price || 0))}</td>
          <td></td>
        </tr>
      `;
    }).join('');

    const cashLine = order.cashAmount ? `Cash: Ksh ${formatMoney(Number(order.cashAmount))}` : '';
    return `
      <div style="font-family: 'Segoe UI', Arial, sans-serif; color: #111; background:#fff; padding:24px; max-width:700px; margin:0 auto;">
        <div style="text-align:center; margin-bottom:24px;">
          <h1 style="margin:0;font-size:28px;letter-spacing:2px;">${businessInfo.name || 'OMNISYNC POS'}</h1>
          <p style="margin:8px 0 0;font-size:12px;color:#777;letter-spacing:3px;text-transform:uppercase;">Official Receipt</p>
          <p style="margin:14px 0 0;font-size:13px;color:#555;">${businessInfo.address || ''}</p>
          <p style="margin:2px 0 0;font-size:12px;color:#555;">PIN: ${businessInfo.pin || ''}</p>
          <p style="margin:2px 0 0;font-size:12px;color:#555;">Tel: ${businessInfo.phone || ''}</p>
        </div>

        <div style="border-top:1px dashed #ddd;border-bottom:1px dashed #ddd;padding:16px 0;margin-bottom:24px;color:#333;font-size:13px;">
          <div style="display:flex;justify-content:space-between;margin-bottom:8px;">
            <span>Receipt #</span><strong>${String(order.id || '')}</strong>
          </div>
          <div style="display:flex;justify-content:space-between;margin-bottom:8px;">
            <span>Date</span><strong>${createdAt}</strong>
          </div>
          <div style="display:flex;justify-content:space-between;">
            <span>Cashier</span><strong>${cashier}</strong>
          </div>
        </div>

        <table style="width:100%;border-collapse:collapse;font-size:13px;color:#222;">
          <tbody>${itemRows}</tbody>
        </table>

        <div style="margin-top:24px;padding-top:16px;border-top:1px dashed #ddd;font-size:13px;color:#333;">
          <div style="display:flex;justify-content:space-between;margin-bottom:8px;"><span>Subtotal</span><strong>${formatMoney(Number(order.subtotal || 0))}</strong></div>
          <div style="display:flex;justify-content:space-between;margin-bottom:8px;"><span>VAT (${config.vatRate || 16}%)</span><strong>${formatMoney(Number(order.vat || 0))}</strong></div>
          <div style="display:flex;justify-content:space-between;font-size:16px;font-weight:700;"><span>Total Ksh</span><strong>${formatMoney(Number(order.totalAmount || order.total || 0))}</strong></div>
        </div>

        <div style="margin-top:18px;padding-top:18px;border-top:1px dashed #ddd;color:#555;font-size:12px;">
          <p style="margin:0;font-weight:700;letter-spacing:1px;">Customer: ${customerName}</p>
          ${cashLine ? `<p style="margin:6px 0 0;">${cashLine}</p>` : ''}
        </div>

        <div style="margin-top:24px;padding:16px 20px;background:#f7f7f7;border-radius:12px;font-size:12px;color:#555;text-align:center;">
          <p style="margin:0 0 8px;">Asante Sana! Karibu Tena</p>
          <p style="margin:0;color:#999;">A software by OmniSync KE</p>
        </div>
      </div>
    `;
  }

  app.post('/api/notifications/email-receipt', async (req: Request, res: Response) => {
    try {
      const { order, customerEmail } = req.body;
      if (!order || !customerEmail) {
        return res.status(400).json({ error: 'order and customerEmail are required' });
      }

      const emailSetting = await db.getSetting('emailReceipts');
      if (!emailSetting || !emailSetting.value) {
        return res.status(400).json({ error: 'Email receipt configuration not found' });
      }

      const config = JSON.parse(emailSetting.value);
      if (!config.enabled) {
        return res.status(400).json({ error: 'Email receipts are disabled in settings' });
      }

      if (!config.fromEmail) {
        return res.status(400).json({ error: 'Email sender address is required' });
      }

      const transportMode = config.transportMode || 'smtp';

      if (transportMode === 'brevo-api') {
        if (!config.brevoApiKey) {
          return res.status(400).json({ error: 'Brevo API key is required for Brevo API mode' });
        }

        const businessSetting = await db.getSetting('business');
        const businessInfo = businessSetting?.value ? JSON.parse(businessSetting.value) : {};

        const payload: Record<string, any> = {
          sender: {
            email: config.fromEmail,
            name: businessInfo.name || 'OmniSync POS',
          },
          to: [{ email: customerEmail }],
          subject: config.subject || 'Your receipt from OmniSync POS',
        };

        // Use custom HTML first, then built-in receipt HTML
        if (config.brevoTemplateHtml) {
          payload.htmlContent = config.brevoTemplateHtml;
        } else {
          payload.htmlContent = buildReceiptHtml(order, businessInfo, config);
        }

        // Only use templateId if it's a valid positive number
        const templateIdNum = Number(config.brevoTemplateId || 0);
        if (templateIdNum > 0) {
          payload.templateId = templateIdNum;
          // If using template, include params
          const itemLines = Array.isArray(order.items)
            ? order.items.map((item: any) => `${item.name || item.sku || 'Item'} x${item.quantity || 1} @ ${Number(item.price || 0).toFixed(2)} = ${((item.price || 0) * (item.quantity || 1)).toFixed(2)}`).join('\n')
            : '';
          payload.params = {
            businessName: businessInfo.name || '',
            businessAddress: businessInfo.address || '',
            businessPhone: businessInfo.phone || '',
            orderId: order.id,
            createdAt: new Date(order.createdAt || Date.now()).toLocaleString(),
            subtotal: Number(order.subtotal || 0).toFixed(2),
            tax: Number(order.vat || 0).toFixed(2),
            total: Number(order.totalAmount || 0).toFixed(2),
            paid: Number(order.amountPaid || 0).toFixed(2),
            paymentMethod: order.paymentMethod || 'Unknown',
            items: itemLines,
          };
        }

        await sendBrevoApiEmail(config.brevoApiKey, payload);
        return res.json({ success: true });
      }

      const transportOptions: any = {};

      if (transportMode === 'direct') {
        transportOptions.direct = true;
        transportOptions.name = os.hostname() || 'localhost';
        transportOptions.tls = { rejectUnauthorized: false };
      } else {
        const host = config.smtpHost || (transportMode === 'brevo' ? 'smtp-relay.brevo.com' : undefined);
        const port = config.smtpPort || (transportMode === 'brevo' ? 587 : undefined);

        if (!host || !port) {
          return res.status(400).json({ error: 'Incomplete email receipt configuration' });
        }

        transportOptions.host = host;
        transportOptions.port = Number(port);
        transportOptions.secure = Boolean(config.smtpSecure);
        transportOptions.tls = { rejectUnauthorized: false };

        if (config.smtpUser && config.smtpPass) {
          transportOptions.auth = {
            user: config.smtpUser,
            pass: config.smtpPass,
          };
        }
      }

      const transporter = nodemailer.createTransport(transportOptions);
      const businessSetting = await db.getSetting('business');
      const businessInfo = businessSetting?.value ? JSON.parse(businessSetting.value) : {};
      const html = buildReceiptHtml(order, businessInfo, config);

      await transporter.sendMail({
        from: config.fromEmail,
        to: customerEmail,
        envelope: {
          from: config.fromEmail,
          to: customerEmail,
        },
        subject: config.subject || 'Your receipt from OmniSync POS',
        html,
      });

      res.json({ success: true });
    } catch (error) {
      console.error('Email receipt error:', error);
      res.status(500).json({ error: (error as Error).message });
    }
  });

  app.post('/api/notifications/owner', async (req: Request, res: Response) => {
    try {
      const { subject, message } = req.body;
      if (!subject || !message) {
        return res.status(400).json({ error: 'Both subject and message are required' });
      }

      await sendOwnerNotification(subject, message);
      res.json({ success: true });
    } catch (error) {
      console.error('Owner notification error:', error);
      res.status(500).json({ error: (error as Error).message });
    }
  });

  app.post('/api/notifications/sms-invoice', async (req: Request, res: Response) => {
    try {
      const { phone, order } = req.body;
      if (!phone) {
        return res.status(400).json({ error: 'Customer phone number is required' });
      }
      if (!order) {
        return res.status(400).json({ error: 'Order information is required' });
      }

      const message = `Invoice ${order.id || ''} issued for Ksh ${Number(order.totalAmount || order.total || 0).toFixed(2)}. Thank you for your business.`;
      await sendCustomerInvoiceSms(phone, message);
      res.json({ success: true });
    } catch (error) {
      console.error('Invoice SMS error:', error);
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

  // === ANALYTICS API ===
  app.get('/api/analytics/hot-products', async (req: Request, res: Response) => {
    try {
      const daysBack = req.query.days ? parseInt(String(req.query.days), 10) : 30;
      const limit = req.query.limit ? parseInt(String(req.query.limit), 10) : 10;
      const products = await db.getHotProducts(daysBack, limit);
      res.json(products);
    } catch (error) {
      res.status(400).json({ error: (error as Error).message });
    }
  });

  app.get('/api/analytics/categories', async (req: Request, res: Response) => {
    try {
      const categories = await db.getProductsByCategory();
      res.json(categories);
    } catch (error) {
      res.status(400).json({ error: (error as Error).message });
    }
  });

  app.get('/api/analytics/financial-position', async (req: Request, res: Response) => {
    try {
      const daysBack = req.query.days ? parseInt(String(req.query.days), 10) : 30;
      const position = await db.getFinancialPosition(daysBack);
      res.json(position);
    } catch (error) {
      res.status(400).json({ error: (error as Error).message });
    }
  });

  app.get('/api/analytics/low-stock', async (req: Request, res: Response) => {
    try {
      const threshold = req.query.threshold ? parseInt(String(req.query.threshold), 10) : 10;
      const products = await db.getLowStockProducts(threshold);
      res.json(products);
    } catch (error) {
      res.status(400).json({ error: (error as Error).message });
    }
  });

  // === STOCK ALERT RULES ===
  app.get('/api/stock-alerts/rules', async (req: Request, res: Response) => {
    try {
      const rules = await db.listStockAlertRules();
      res.json(rules);
    } catch (error) {
      res.status(400).json({ error: (error as Error).message });
    }
  });

  app.post('/api/stock-alerts/rules', async (req: Request, res: Response) => {
    try {
      const rule = await db.createStockAlertRule(req.body);
      res.json(rule);
    } catch (error) {
      res.status(400).json({ error: (error as Error).message });
    }
  });

  app.put('/api/stock-alerts/rules/:id', async (req: Request, res: Response) => {
    try {
      const rule = await db.updateStockAlertRule(req.params.id, req.body);
      res.json(rule);
    } catch (error) {
      res.status(400).json({ error: (error as Error).message });
    }
  });

  app.delete('/api/stock-alerts/rules/:id', async (req: Request, res: Response) => {
    try {
      await db.deleteStockAlertRule(req.params.id);
      res.json({ success: true });
    } catch (error) {
      res.status(400).json({ error: (error as Error).message });
    }
  });

  // Serve React app in production
  if (!isDev) {
    app.get('*', (req: Request, res: Response) => {
      res.sendFile(path.join(__dirname, '../renderer/dist/index.html'));
    });
  }

  return app;
}
