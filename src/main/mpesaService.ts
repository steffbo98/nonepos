import { Lipana } from '@lipana/sdk';
import { v4 as uuidv4 } from 'uuid';

interface LipanaConfig {
  apiKey: string;
  environment: 'sandbox' | 'production';
}

interface PaymentRequest {
  phone: string;
  amount: number;
  description: string;
  licenseKey?: string;
  terminalId?: string;
}

interface PaymentResponse {
  success: boolean;
  transactionId: string;
  lipanaTransactionId?: string;
  message: string;
  phone?: string;
  amount?: number;
}

interface PaymentStatus {
  status: 'PENDING' | 'SUCCESS' | 'FAILED' | 'CANCELLED';
  transactionId: string;
  amount?: number;
  phone?: string;
}

export class LipanaPaymentService {
  private lipanaClient: Lipana;

  constructor(config: LipanaConfig) {
    if (!config.apiKey) {
      throw new Error('LIPANA_SECRET_KEY is required');
    }

    this.lipanaClient = new Lipana({
      apiKey: config.apiKey,
      environment: config.environment || 'sandbox',
    });
  }

  private normalizePhone(input: string): string {
    if (!input || typeof input !== 'string') {
      throw new Error('Phone number is required');
    }

    let phone = input.replace(/[^0-9]/g, '');

    // Handle Kenya format (254)
    if (phone.length === 10 && phone.startsWith('0')) {
      // 07xxxxxxxxx → 254xxxxxxxxx
      return '254' + phone.slice(1);
    }

    if (phone.length === 12 && phone.startsWith('254')) {
      // Already normalized
      return phone;
    }

    if (phone.length === 9 && (phone.startsWith('7') || phone.startsWith('1'))) {
      // 7xxxxxxxx → 2547xxxxxxxx
      return '254' + phone;
    }

    throw new Error(
      `Invalid phone number. Expected format: 0712345678 or 254712345678`
    );
  }

  private parsePriceValue(amount: number | string): number {
    const num = typeof amount === 'string' 
      ? Number(amount.replace(/[^\d.]/g, ''))
      : Number(amount);
    
    if (!Number.isFinite(num) || num <= 0) {
      throw new Error('Invalid amount for payment');
    }
    return num;
  }

  private convertToCents(amount: number): number {
    // Lipana expects amount in cents
    return Math.round(Number(amount) * 100);
  }

  private withTimeout(promise: Promise<any>, timeoutMs: number, label: string): Promise<any> {
    let timeoutId: any;
    const timeoutPromise = new Promise((_, reject) => {
      timeoutId = setTimeout(
        () => reject(new Error(`${label} timed out after ${timeoutMs}ms`)),
        timeoutMs
      );
    });
    return Promise.race([promise, timeoutPromise]).finally(() => clearTimeout(timeoutId));
  }

  async initiatePayment(request: PaymentRequest): Promise<PaymentResponse> {
    try {
      console.log('[LIPANA] Initiating payment:', {
        phone: request.phone?.slice(0, 5) + '...',
        amount: request.amount,
        description: request.description,
      });

      const normalizedPhone = this.normalizePhone(request.phone);
      const amountInKes = this.parsePriceValue(request.amount);
      const amountInCents = this.convertToCents(amountInKes);

      if (!amountInCents) {
        throw new Error('Invalid payment amount');
      }

      const txId = uuidv4();

      // Initiate STK push with Lipana
      const lipanaResponse = await this.withTimeout(
        this.lipanaClient.transactions.initiateStkPush({
          phone: normalizedPhone,
          amount: amountInCents,
        }),
        20000,
        'Lipana STK push initiation'
      );

      console.log('[LIPANA] STK push initiated:', {
        txId,
        normalizedPhone,
        amount: amountInCents,
        lipanaTransactionId: lipanaResponse?.data?.transactionId || lipanaResponse?.transactionId,
      });

      const lipanaTransactionId = 
        lipanaResponse?.data?.transactionId ||
        lipanaResponse?.transactionId ||
        lipanaResponse?.id;

      return {
        success: true,
        transactionId: txId,
        lipanaTransactionId,
        message: lipanaResponse?.message || 'STK push sent successfully. Check your phone for payment prompt.',
        phone: normalizedPhone,
        amount: amountInKes,
      };
    } catch (error) {
      console.error('[LIPANA] Payment initiation error:', error);
      throw error instanceof Error ? error : new Error(String(error));
    }
  }

  async checkPaymentStatus(lipanaTransactionId: string): Promise<PaymentStatus> {
    try {
      console.log('[LIPANA] Checking payment status:', { lipanaTransactionId });

      const statusResponse = await this.withTimeout(
        this.lipanaClient.transactions.retrieve(lipanaTransactionId),
        10000,
        'Lipana status check'
      );

      const status = statusResponse?.status || 'PENDING';
      const normalizedStatus = String(status).toLowerCase();

      let paymentStatus: PaymentStatus['status'] = 'PENDING';
      if (normalizedStatus === 'success' || normalizedStatus === 'completed') {
        paymentStatus = 'SUCCESS';
      } else if (normalizedStatus === 'failed') {
        paymentStatus = 'FAILED';
      } else if (normalizedStatus === 'cancelled') {
        paymentStatus = 'CANCELLED';
      }

      console.log('[LIPANA] Status check result:', {
        lipanaTransactionId,
        status: paymentStatus,
        amount: statusResponse?.amount,
      });

      return {
        status: paymentStatus,
        transactionId: lipanaTransactionId,
        amount: statusResponse?.amount,
        phone: statusResponse?.phone,
      };
    } catch (error) {
      console.error('[LIPANA] Status check error:', error);
      // Return PENDING on error - webhook will eventually update
      return {
        status: 'PENDING',
        transactionId: lipanaTransactionId,
      };
    }
  }
}

export default LipanaPaymentService;
