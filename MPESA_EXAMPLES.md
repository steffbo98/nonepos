# M-Pesa Integration Code Examples & Usage

## Overview
This document shows how the M-Pesa integration works with practical code examples.

---

## 1. Frontend: Initiating Payment

### Billing Page Component Flow

```typescript
// User selects plan and enters phone number
const handleMpesaCheckout = async () => {
  // Step 1: Validate inputs
  if (!selectedPlan) return setMessage('Select a plan');
  if (!mpesaPhone.trim()) return setMessage('Enter phone number');

  // Step 2: Show loading state
  setWorking(true);
  setMessage('Initiating M-Pesa payment...');
  setPaymentInProgress(true);

  try {
    // Step 3: Get plan details and price
    const planDetails = PLANS.find(p => p.id === selectedPlan);
    const priceAmount = Number(planDetails.price.replace(/[^0-9]/g, ''));

    // Step 4: Call backend to initiate payment
    const response = await dataService.initiateMpesaPayment(
      mpesaPhone.trim(),              // User's phone: "0712345678"
      priceAmount,                     // Amount in KES: 1499
      licenseKey.trim(),              // Optional license key
      terminalId,                     // Terminal ID from localStorage
      selectedPlan                    // Plan ID: "monthly"
    );

    // Step 5: Store transaction ID for status polling
    setCurrentTransactionId(response.transactionId);

    // Step 6: Start polling for payment status
    pollPaymentStatus(response.transactionId, 30); // Poll for 60 seconds

  } catch (error) {
    setMessage(error.message || 'Payment failed');
    setPaymentInProgress(false);
  }
};
```

### Status Polling

```typescript
const pollPaymentStatus = async (transactionId, maxAttempts) => {
  let attempts = 0;
  
  // Poll every 2 seconds
  const pollInterval = setInterval(async () => {
    attempts++;

    // Stop after max attempts
    if (attempts > maxAttempts) {
      clearInterval(pollInterval);
      setMessage('Payment timed out. Check M-Pesa app.');
      setPaymentInProgress(false);
      return;
    }

    try {
      // Check payment status
      const status = await dataService.checkMpesaPaymentStatus(transactionId);

      if (status.status === 'success') {
        // ✓ Payment successful!
        clearInterval(pollInterval);
        setMessage('✓ Payment successful! License activated.');
        setPaymentInProgress(false);
        
        // Refresh license status
        await refreshBilling();
        
        // Clear form
        setMpesaPhone('');
        setSelectedPlan(null);
        
      } else if (status.status === 'failed' || status.status === 'cancelled') {
        // ✗ Payment failed
        clearInterval(pollInterval);
        setMessage(`Payment ${status.status}. Try again.`);
        setPaymentInProgress(false);
        
      } else {
        // Still waiting...
        setMessage(`${status.message}... (${attempts}/${maxAttempts})`);
      }
    } catch (error) {
      // Continue polling even if API error
      console.log('Status check error (will retry)', error);
    }
  }, 2000); // 2 second interval
};
```

---

## 2. Backend: Payment Endpoints

### Initiate Payment Endpoint

```typescript
// POST /api/billing/mpesa-initiate
app.post('/api/billing/mpesa-initiate', async (req, res) => {
  const { phone, amount, licenseKey, terminalId, plan } = req.body;

  // Validate required fields
  if (!phone || !amount || !plan) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  // Get M-Pesa config from environment
  const mpesaConfig = {
    consumerKey: process.env.MPESA_CONSUMER_KEY,
    consumerSecret: process.env.MPESA_CONSUMER_SECRET,
    shortcode: process.env.MPESA_SHORTCODE || '174379',
    passkey: process.env.MPESA_PASSKEY,
    environment: process.env.MPESA_ENVIRONMENT || 'sandbox',
  };

  // Create M-Pesa service instance
  const mpesaService = new MpesaService(mpesaConfig);

  try {
    // Initiate STK push with M-Pesa
    const paymentResponse = await mpesaService.initiatePayment({
      phone,
      amount,
      description: `NonePOS ${plan} Plan Activation`,
      licenseKey,
      terminalId,
    });

    // Store payment transaction in database
    const paymentRecord = {
      id: paymentResponse.transactionId,
      checkoutRequestId: paymentResponse.checkoutRequestId,
      phone: paymentResponse.phone,
      amount: paymentResponse.amount,
      plan,
      licenseKey,
      terminalId,
      status: 'PENDING',
      createdAt: new Date().toISOString(),
    };

    await db.setSetting(`mpesa_payment_${paymentResponse.transactionId}`, paymentRecord);

    // Return transaction ID to frontend
    return res.json({
      ok: true,
      transactionId: paymentResponse.transactionId,
      checkoutRequestId: paymentResponse.checkoutRequestId,
      message: paymentResponse.message,
    });

  } catch (error) {
    console.error('[MPESA] Payment initiation error:', error);
    return res.status(500).json({ 
      error: error.message || 'Failed to initiate M-Pesa payment' 
    });
  }
});
```

### Status Check Endpoint

```typescript
// GET /api/billing/mpesa-status/:transactionId
app.get('/api/billing/mpesa-status/:transactionId', async (req, res) => {
  const { transactionId } = req.params;

  // Get payment record from database
  const paymentRecord = await db.getSetting(`mpesa_payment_${transactionId}`);
  if (!paymentRecord?.value) {
    return res.status(404).json({ error: 'Transaction not found' });
  }

  const payment = JSON.parse(paymentRecord.value);
  
  // If already completed, return immediately
  if (payment.status === 'COMPLETED') {
    return res.json({ 
      status: 'success', 
      message: 'Payment completed' 
    });
  }

  // Query M-Pesa API for current status
  const mpesaService = new MpesaService(mpesaConfig);
  const statusResponse = await mpesaService.checkPaymentStatus(
    payment.checkoutRequestId
  );

  // If payment successful, activate license
  if (statusResponse.status === 'SUCCESS') {
    payment.status = 'COMPLETED';
    payment.completedAt = new Date().toISOString();

    // Auto-activate license
    const billingData = {
      active: true,
      plan: payment.plan,
      licenseKey: payment.licenseKey,
      terminalId: payment.terminalId,
      expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
      lastChecked: new Date().toISOString(),
      paymentStatus: 'COMPLETED',
      mpesaTransactionId: transactionId,
    };
    
    await db.setSetting('billing', billingData);
    await db.setSetting(`mpesa_payment_${transactionId}`, payment);
  }

  return res.json({
    status: statusResponse.status.toLowerCase(),
    transactionId,
    message: statusResponse.status === 'SUCCESS' 
      ? 'Payment successful! License activated.'
      : `Payment ${statusResponse.status.toLowerCase()}`,
  });
});
```

### Webhook Callback Endpoint

```typescript
// POST /api/billing/mpesa-callback
// Called by M-Pesa when payment completes
app.post('/api/billing/mpesa-callback', async (req, res) => {
  const callbackData = req.body;
  console.log('[MPESA] Webhook received:', callbackData);

  try {
    // Extract payment result from M-Pesa callback
    const resultCode = callbackData.Body?.stkCallback?.ResultCode;
    const checkoutRequestID = callbackData.Body?.stkCallback?.CheckoutRequestID;
    const callbackMetadata = callbackData.Body?.stkCallback?.CallbackMetadata?.Item || [];

    // Extract amount and phone from callback
    const amountObj = callbackMetadata.find(item => item.Name === 'Amount');
    const phoneObj = callbackMetadata.find(item => item.Name === 'PhoneNumber');

    if (resultCode === 0) {
      // ✓ Payment successful
      console.log('[MPESA] Payment successful:', {
        checkoutRequestID,
        amount: amountObj?.Value,
        phone: phoneObj?.Value,
      });

      // Update license as active
      const billingSettings = await db.getSetting('billing');
      if (billingSettings?.value) {
        const billing = JSON.parse(billingSettings.value);
        billing.active = true;
        billing.paymentStatus = 'COMPLETED';
        billing.mpesaCallbackData = {
          amount: amountObj?.Value,
          phone: phoneObj?.Value,
          timestamp: new Date().toISOString(),
        };
        await db.setSetting('billing', billing);
      }
    } else {
      // ✗ Payment failed
      console.log('[MPESA] Payment failed:', { checkoutRequestID, resultCode });
    }

    // Acknowledge receipt to M-Pesa
    return res.json({ 
      ResultCode: 0, 
      ResultDesc: 'Received' 
    });

  } catch (error) {
    console.error('[MPESA] Webhook error:', error);
    return res.json({ 
      ResultCode: 1, 
      ResultDesc: 'Error processing callback' 
    });
  }
});
```

---

## 3. M-Pesa Service: Core Implementation

### Phone Number Normalization

```typescript
private normalizePhone(phone: string): string {
  // Remove all non-digits
  let cleaned = phone.replace(/[^0-9]/g, '');
  
  // Handle Kenya local format (07xxxxxxxxx)
  if (cleaned.length === 10 && cleaned.startsWith('0')) {
    return '254' + cleaned.slice(1);  // 07xxxxxxxxx → 254 7xxxxxxxxx
  }
  
  // Already normalized
  if (cleaned.length === 12 && cleaned.startsWith('254')) {
    return cleaned;  // 254xxxxxxxxx → no change
  }
  
  // Handle 9-digit format
  if (cleaned.length === 9 && (cleaned.startsWith('7') || cleaned.startsWith('1'))) {
    return '254' + cleaned;  // 7xxxxxxxxx → 2547xxxxxxxxx
  }
  
  throw new Error(`Invalid phone number: ${phone}`);
}
```

### STK Push Initiation

```typescript
async initiatePayment(request: PaymentRequest): Promise<PaymentResponse> {
  // Get access token from M-Pesa
  const token = await this.getAccessToken();
  
  // Normalize phone number
  const normalizedPhone = this.normalizePhone(request.phone);
  
  // Create timestamp for password
  const timestamp = new Date().toISOString()
    .replace(/[^0-9]/g, '')
    .slice(0, 14);
  
  // Create password: base64(shortcode + passkey + timestamp)
  const password = Buffer.from(
    `${this.config.shortcode}${this.config.passkey}${timestamp}`
  ).toString('base64');

  // Build payment request
  const paymentData = {
    BusinessShortCode: this.config.shortcode,
    Password: password,
    Timestamp: timestamp,
    TransactionType: 'CustomerPayBillOnline',
    Amount: Math.round(request.amount),
    PartyA: normalizedPhone,
    PartyB: this.config.shortcode,
    PhoneNumber: normalizedPhone,
    CallBackURL: process.env.MPESA_CALLBACK_URL,
    AccountReference: request.licenseKey || 'NonePOS',
    TransactionDesc: request.description,
  };

  // Call M-Pesa STK push API
  const response = await https.request({
    hostname: this.config.environment === 'sandbox' 
      ? 'sandbox.safaricom.co.ke' 
      : 'api.safaricom.co.ke',
    path: '/mpesa/stkpush/v1/processrequest',
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
  }, paymentData);

  // Handle response
  if (response.ResponseCode === '0') {
    return {
      success: true,
      transactionId: uuidv4(),
      checkoutRequestId: response.CheckoutRequestID,
      message: response.ResponseDescription,
      phone: normalizedPhone,
      amount: request.amount,
    };
  }

  throw new Error(response.ResponseDescription || 'STK push failed');
}
```

---

## 4. Frontend Integration: dataService

### API Methods

```typescript
// dataService.ts

async initiateMpesaPayment(
  phone: string,
  amount: number,
  licenseKey: string,
  terminalId: string,
  plan: string
) {
  return this.request('POST', '/billing/mpesa-initiate', {
    phone,
    amount,
    licenseKey,
    terminalId,
    plan,
  });
}

async checkMpesaPaymentStatus(transactionId: string) {
  return this.request('GET', `/billing/mpesa-status/${transactionId}`);
}

async refreshBillingStatus() {
  return this.getSetting('billing');
}
```

---

## 5. Complete Usage Example

### Full Payment Flow

```typescript
// 1. User selects plan and enters phone
const plan = 'monthly';
const phone = '0712345678';
const amount = 1499;

// 2. Initiate payment
const { transactionId, message } = await dataService.initiateMpesaPayment(
  phone,
  amount,
  'LICENSE-KEY-123',
  'TERM-ABC123',
  plan
);
console.log('Payment initiated:', transactionId);
// Output: "Payment initiated: 550e8400-e29b-41d4-a716-446655440000"

// 3. Poll for status
let paymentStatus = 'pending';
for (let i = 0; i < 30; i++) {
  await sleep(2000); // Wait 2 seconds
  
  const status = await dataService.checkMpesaPaymentStatus(transactionId);
  console.log(`Attempt ${i + 1}: ${status.status}`);
  
  if (status.status === 'success') {
    console.log('✓ Payment successful!');
    paymentStatus = 'success';
    break;
  } else if (status.status === 'failed') {
    console.log('✗ Payment failed');
    paymentStatus = 'failed';
    break;
  }
}

// 4. Refresh license if successful
if (paymentStatus === 'success') {
  const billing = await dataService.refreshBillingStatus();
  console.log('License:', billing);
  // Output: { active: true, plan: 'monthly', expiresAt: '2025-01-01T...' }
}
```

---

## 6. Environment Setup

### .env File

```bash
# From Safaricom Daraja Portal
MPESA_CONSUMER_KEY=your_consumer_key_here
MPESA_CONSUMER_SECRET=your_consumer_secret_here
MPESA_SHORTCODE=174379
MPESA_PASSKEY=your_passkey_here

# Configuration
MPESA_ENVIRONMENT=sandbox
MPESA_CALLBACK_URL=http://localhost:5000/api/billing/mpesa-callback
```

### package.json Dependencies

Ensure these are installed:

```json
{
  "dependencies": {
    "express": "^4.18.2",
    "uuid": "^9.0.0",
    "cors": "^2.8.5",
    "nodemailer": "^6.9.1"
  },
  "devDependencies": {
    "typescript": "^5.0.0",
    "@types/express": "^4.17.17",
    "@types/node": "^20.0.0"
  }
}
```

---

## 7. Error Handling

### Common Errors

```typescript
// Error: Missing configuration
if (!config.consumerKey || !config.consumerSecret) {
  throw new Error('M-Pesa is not configured. Please contact support.');
}

// Error: Invalid phone format
try {
  const normalized = normalizePhone(phone);
} catch (error) {
  // Handle: "Invalid phone number: 123"
  return res.status(400).json({ error: error.message });
}

// Error: API timeout
const response = await withTimeout(
  getLipanaClient().transactions.initiateStkPush(),
  20000,  // 20 second timeout
  'M-Pesa payment initiation'
);

// Error: Payment already processed
if (transaction.status !== 'PENDING') {
  return res.json({ 
    error: 'Transaction already processed',
    status: transaction.status 
  });
}
```

---

## 8. Debugging

### Check Logs

```bash
# Terminal logs during payment
[MPESA] /initiate === START REQUEST ====
[MPESA] /initiate Received request: { ... }
[MPESA] /initiate Phone normalized: '0712345678' → '254712345678'
[MPESA] /initiate Transaction created: { txId, status: PENDING, ... }
[MPESA] /initiate Initiating real STK push with M-Pesa...
[MPESA] /initiate === SUCCESS === (1234ms)

# Browser console
Initiated M-Pesa payment. Transaction ID: 550e8400-e29b-41d4-a716-446655440000
Attempt 1: pending... (1/30)
Attempt 2: pending... (2/30)
Attempt 3: success
✓ Payment successful! License activated.
```

### Database Query

```typescript
// Check payment record
const record = await db.getSetting('mpesa_payment_550e8400-e29b-41d4-a716-446655440000');
console.log(JSON.parse(record.value));
// Output: { id, checkoutRequestId, phone, amount, plan, status, createdAt }

// Check license status
const billing = await db.getSetting('billing');
console.log(JSON.parse(billing.value));
// Output: { active, plan, expiresAt, paymentStatus, mpesaTransactionId }
```

---

## Next Steps

1. **Add webhook signature validation** - Verify M-Pesa authenticity
2. **Add transaction history** - Show user all past payments
3. **Implement refunds** - Handle M-Pesa reversals
4. **Email receipts** - Send payment confirmation
5. **Bank/Card payments** - Add alternative payment methods
6. **Retry logic** - Auto-retry failed transactions
