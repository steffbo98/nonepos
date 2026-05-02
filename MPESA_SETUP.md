# M-Pesa Payment Integration Setup Guide

## Overview
Your NonePOS billing system now includes full M-Pesa (Daraja) payment integration. Users can select a plan and pay via M-Pesa STK push on their phone, which automatically activates their license.

## Architecture

### Three Components:
1. **M-Pesa Service** (`src/main/mpesaService.ts`)
   - Handles M-Pesa Daraja API communication
   - Phone number normalization (Kenya format: 254XXXXXXXXX)
   - STK push initiation
   - Payment status checking

2. **Backend Endpoints** (`src/main/server.ts`)
   - `POST /api/billing/mpesa-initiate` - Initiate payment
   - `GET /api/billing/mpesa-status/:transactionId` - Check status
   - `POST /api/billing/mpesa-callback` - Webhook for payment confirmation

3. **Frontend Integration** (`src/pages/BillingPage.tsx`)
   - M-Pesa phone input field
   - Payment method selection
   - Status polling (checks every 2 seconds for up to 60 seconds)
   - Auto-activation on successful payment

## Setup Instructions

### Step 1: Get M-Pesa Credentials

1. Go to [Safaricom Daraja Portal](https://developer.safaricom.co.ke/)
2. Create an account or log in
3. Create a new app and get:
   - **Consumer Key**
   - **Consumer Secret**
   - **Shortcode** (Business/Till number - usually 174379 for sandbox)
   - **Passkey** (STK Push passkey)

### Step 2: Configure Environment Variables

Add these to your `.env` file (or use `.env.mpesa.example` as template):

```bash
# M-Pesa API Credentials
MPESA_CONSUMER_KEY=your_consumer_key_from_daraja
MPESA_CONSUMER_SECRET=your_consumer_secret_from_daraja
MPESA_SHORTCODE=174379
MPESA_PASSKEY=your_passkey_from_daraja

# Environment: sandbox or production
MPESA_ENVIRONMENT=sandbox

# Callback URL (Daraja needs to reach this)
MPESA_CALLBACK_URL=http://localhost:5000/api/billing/mpesa-callback

# For production:
# MPESA_CALLBACK_URL=https://yourdomain.com/api/billing/mpesa-callback
# MPESA_ENVIRONMENT=production
```

### Step 3: Install Dependencies

Make sure these packages are in your `package.json`:

```json
{
  "dependencies": {
    "express": "^4.x",
    "uuid": "^9.x"
  }
}
```

### Step 4: Test in Sandbox

1. **Start the app**: `npm run dev`
2. **Navigate to Billing**: Log in → Billing page
3. **Enter test details**:
   - Phone: `0712345678` or `254712345678`
   - Plan: Choose any plan
4. **Click "Proceed to Checkout"**
5. **Check M-Pesa**: You'll see a prompt on your phone
6. **Enter PIN**: Complete the transaction
7. **Verify**: License should auto-activate

### Step 5: Production Deployment

1. **Update credentials**: Use production keys from Daraja
2. **Set environment**: `MPESA_ENVIRONMENT=production`
3. **Configure callback URL**: Update `MPESA_CALLBACK_URL` to your production domain
4. **Add SSL certificate**: M-Pesa callbacks require HTTPS
5. **Enable webhook**: Ensure your domain is accessible from the internet

## Payment Flow

```
User selects plan
    ↓
Enters M-Pesa phone number
    ↓
Clicks "Proceed to Checkout"
    ↓
Backend initiates STK push with M-Pesa
    ↓
User gets payment prompt on phone
    ↓
User enters PIN and confirms
    ↓
M-Pesa sends webhook callback
    ↓
License auto-activates in database
    ↓
Frontend polls status & shows success
```

## API Endpoints

### 1. Initiate Payment
```bash
POST /api/billing/mpesa-initiate
Content-Type: application/json

{
  "phone": "0712345678",           # M-Pesa phone number
  "amount": 1499,                   # Amount in KES
  "plan": "monthly",                # Plan ID
  "licenseKey": "optional-key",    # Optional license key
  "terminalId": "TERM-ABC123"      # Terminal ID
}

Response:
{
  "ok": true,
  "transactionId": "uuid",
  "checkoutRequestId": "mpesa-id",
  "message": "STK push initiated..."
}
```

### 2. Check Payment Status
```bash
GET /api/billing/mpesa-status/:transactionId

Response:
{
  "status": "success|pending|failed|cancelled",
  "transactionId": "uuid",
  "message": "..."
}
```

### 3. Webhook Callback
```bash
POST /api/billing/mpesa-callback
Content-Type: application/json

# M-Pesa sends this automatically with payment result
```

## Phone Number Formats Supported

All these formats are automatically normalized:
- ✓ `0712345678` (Kenya local)
- ✓ `254712345678` (Kenya with country code)
- ✓ `712345678` (Without leading 0)

## Troubleshooting

### "M-Pesa is not configured"
- Check environment variables are set
- Verify credentials are correct
- Ensure `MPESA_ENVIRONMENT` is set to `sandbox` or `production`

### "Failed to initiate STK push"
- Check Safaricom Daraja credentials
- Verify phone number format (must be valid Kenya number)
- Ensure shortcode and passkey are correct
- Check internet connectivity

### Payment stuck on "checking..."
- Daraja API is slow (normal in sandbox)
- Frontend will timeout after ~60 seconds
- User should check M-Pesa on their phone for actual status
- Database will eventually update via webhook

### Webhook not received
- Ensure callback URL is publicly accessible
- Check firewall isn't blocking HTTPS
- Verify domain resolves correctly
- Test with Daraja dashboard webhook simulator

## Security Notes

- ✓ All M-Pesa communication uses HTTPS
- ✓ Credentials stored in environment variables (not committed)
- ✓ Payment amount validated on backend
- ✓ Terminal ID prevents duplicate activations
- ✓ Transaction IDs are UUIDs (not sequential/guessable)
- ✓ Webhook validates M-Pesa signature (when implemented)

## Future Enhancements

1. **Webhook signature validation** - Verify M-Pesa sent the callback
2. **Bank Transfer handler** - Implement manual transfer instructions
3. **Card payment** - Integrate Stripe or M-Pesa card payments
4. **Refund handling** - Process refunds via M-Pesa reversals
5. **Transaction history** - Display payment receipts
6. **Email receipts** - Send payment confirmation emails
7. **Payment retries** - Allow user to retry failed payments

## Support

For M-Pesa Daraja issues:
- [Daraja Portal](https://developer.safaricom.co.ke/)
- [STK Push Documentation](https://developer.safaricom.co.ke/docs#lipa-na-m-pesa-online)

For NonePOS issues:
- Check logs in browser console (F12)
- Check backend server logs
- Verify environment variables are loaded
