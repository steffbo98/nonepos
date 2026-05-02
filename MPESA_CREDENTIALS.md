# Getting M-Pesa Credentials from Safaricom Daraja

## Quick Start
1. Go to https://developer.safaricom.co.ke/
2. Sign up for free developer account
3. Create app → Get Consumer Key & Secret
4. Add callback URL in your app settings
5. Copy credentials to `.env` file
6. Done! Start using M-Pesa payments

---

## Step-by-Step Guide

### Step 1: Sign Up on Daraja Portal

1. Visit [https://developer.safaricom.co.ke/](https://developer.safaricom.co.ke/)
2. Click **Sign Up**
3. Fill in:
   - **Email**: Your email address
   - **Password**: Create a strong password
   - **Full Name**: Your name or company
4. Click **Create Account**
5. Check your email for verification link
6. Verify your account

### Step 2: Log In and Create App

1. Log in to [https://developer.safaricom.co.ke/](https://developer.safaricom.co.ke/)
2. Click **My Apps** in the sidebar
3. Click **Create App** button
4. Fill in app details:
   - **App Name**: `NonePOS` (or your app name)
   - **Description**: `POS System with M-Pesa Billing`
5. Click **Create**

### Step 3: Get Your Credentials

After creating your app, you'll see:

```
Consumer Key:     xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
Consumer Secret:  xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

**Save these values!** You'll need them for `.env`

### Step 4: Get Shortcode & Passkey

For **STK Push** (payment prompt on phone):

1. In your Daraja app dashboard, look for **Lipa Na M-Pesa Online**
2. **Shortcode** is usually: `174379` (for sandbox)
3. **Passkey** will be provided - copy it

If not visible, click **Add STK Push Product**

### Step 5: Add Callback URL

1. In app dashboard, find **Settings** or **Configuration**
2. Look for **Callback URL** or **Webhook URL**
3. Enter your callback URL:
   - **Sandbox**: `http://localhost:5000/api/billing/mpesa-callback`
   - **Production**: `https://yourdomain.com/api/billing/mpesa-callback`
4. Save changes

### Step 6: Configure Your .env File

Create `.env` in your NonePOS root directory:

```bash
# Copy these from Daraja portal
MPESA_CONSUMER_KEY=paste_consumer_key_here
MPESA_CONSUMER_SECRET=paste_consumer_secret_here
MPESA_SHORTCODE=174379
MPESA_PASSKEY=paste_passkey_here

# Configuration
MPESA_ENVIRONMENT=sandbox
MPESA_CALLBACK_URL=http://localhost:5000/api/billing/mpesa-callback
```

Example with real values (sanitized):
```bash
MPESA_CONSUMER_KEY=a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6
MPESA_CONSUMER_SECRET=z9y8x7w6v5u4t3s2r1q0p9o8n7m6l5k4
MPESA_SHORTCODE=174379
MPESA_PASSKEY=bfb279f9aa9bdbcf158e97dd71a467cd2e0c893059b10f78e6b72ada1ed2c919
MPESA_ENVIRONMENT=sandbox
MPESA_CALLBACK_URL=http://localhost:5000/api/billing/mpesa-callback
```

---

## Testing with Sandbox

### Sandbox Test Credentials
- **Shortcode**: `174379`
- **Test Phone**: Use any Kenya phone number starting with:
  - `07` (e.g., `0712345678`)
  - `254` (e.g., `254712345678`)

### What Happens in Sandbox
✓ No real money transferred
✓ Instant mock payment confirmations
✓ Full API testing capability
✓ Simulated M-Pesa prompts

### Test Payment Flow
1. Start NonePOS: `npm run dev`
2. Go to Billing page
3. Select a plan
4. Enter test phone: `0712345678`
5. Click "Proceed to Checkout"
6. In Daraja dashboard, you can:
   - See transaction appear
   - Simulate payment success/failure
   - Test callback delivery

---

## Switching to Production

Once testing is complete:

### 1. Get Production Credentials
- Create a **Production App** in Daraja
- Complete business verification
- Get production Consumer Key/Secret
- Get real Shortcode from your business account

### 2. Update .env
```bash
MPESA_CONSUMER_KEY=your_production_key
MPESA_CONSUMER_SECRET=your_production_secret
MPESA_SHORTCODE=your_real_shortcode
MPESA_PASSKEY=your_real_passkey
MPESA_ENVIRONMENT=production
MPESA_CALLBACK_URL=https://yourdomain.com/api/billing/mpesa-callback
```

### 3. Prerequisites
- ✓ Valid SSL certificate (HTTPS required)
- ✓ Public domain name
- ✓ Firewall allows HTTPS (port 443)
- ✓ Callback URL publicly accessible
- ✓ Business verification complete

### 4. Deploy
```bash
npm run build
npm run start:prod
```

---

## Troubleshooting

### "Invalid Consumer Key/Secret"
**Solution**: 
- Double-check copy/paste (no extra spaces)
- Verify app is in correct environment
- Try regenerating credentials in Daraja

### "Shortcode not accepted"
**Solution**:
- Use `174379` for sandbox
- Use your actual business shortcode for production
- Check Daraja app settings for correct shortcode

### "Callback URL not working"
**Solution**:
- Ensure URL is publicly accessible
- Check DNS resolution
- Verify firewall allows port 443
- Enable HTTPS
- Test with curl: `curl https://yourdomain.com/api/billing/mpesa-callback`

### "Payment times out"
**Solution**:
- Daraja API is slow in sandbox (normal)
- Frontend polls for 60 seconds automatically
- Check M-Pesa on phone manually
- Check database for payment record
- Webhook will eventually update status

---

## Environment Variables Reference

| Variable | Example | Description |
|----------|---------|-------------|
| `MPESA_CONSUMER_KEY` | `a1b2c3...` | From Daraja app |
| `MPESA_CONSUMER_SECRET` | `z9y8x7...` | From Daraja app |
| `MPESA_SHORTCODE` | `174379` | Business till/code |
| `MPESA_PASSKEY` | `bfb279...` | STK Push passkey |
| `MPESA_ENVIRONMENT` | `sandbox` or `production` | API environment |
| `MPESA_CALLBACK_URL` | `http://localhost:5000/...` | Webhook endpoint |

---

## Important Notes

⚠️ **Never commit `.env` to version control!**
- Add `.env` to `.gitignore`
- Use `.env.mpesa.example` as template
- Each deployment gets its own `.env`

⚠️ **Keep credentials secret!**
- Don't share with anyone
- Don't post in public repos
- Rotate if compromised

✓ **Store securely in production**
- Use environment variables
- Use secrets management (AWS Secrets, etc.)
- Use managed app platforms (Heroku, Vercel)

---

## Need Help?

- **Daraja Docs**: https://developer.safaricom.co.ke/docs
- **STK Push Guide**: https://developer.safaricom.co.ke/docs#lipa-na-m-pesa-online
- **Test Credentials**: https://developer.safaricom.co.ke/test-credentials
- **Status Codes**: https://developer.safaricom.co.ke/error-responses

---

## Verification Checklist

After setup, verify everything works:

- [ ] `.env` file created with all variables
- [ ] Variables not committed to git
- [ ] App starts: `npm run dev`
- [ ] Billing page accessible
- [ ] Plan selection works
- [ ] M-Pesa phone input available
- [ ] Can click "Proceed to Checkout"
- [ ] No errors in browser console
- [ ] No errors in server logs
- [ ] Test transaction initiated successfully
- [ ] Daraja dashboard shows transaction
- [ ] Payment status updates in app
- [ ] License activates after payment
