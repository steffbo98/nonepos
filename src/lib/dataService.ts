/**
 * Data Service - Communicates with Express API running in Electron main process
 * All data operations go through HTTP to the backend database
 */

const API_BASE = (import.meta as any).env?.VITE_API_BASE || 'http://localhost:5000/api';

export class DataService {
  // Helper method to make HTTP requests
  private async request(method: string, endpoint: string, body?: any): Promise<any> {
    const options: RequestInit = {
      method,
      headers: {
        'Content-Type': 'application/json'
      }
    };

    if (body) {
      options.body = JSON.stringify(body);
    }

    try {
      const response = await fetch(`${API_BASE}${endpoint}`, options);

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || `HTTP ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      const enhancedMessage = message.includes('Failed to fetch')
        ? `Unable to reach backend API at ${API_BASE}${endpoint}. Is the server running? ${message}`
        : message;
      console.error(`API Error [${method} ${endpoint}]:`, error);
      throw new Error(`API Error [${method} ${endpoint}]: ${enhancedMessage}`);
    }
  }

  // === AUTH ===
  async registerUser(userData: { fullName: string; email: string; password: string }) {
    return this.request('POST', '/auth/register', userData);
  }

  async loginUser(credentials: { email: string; password: string }) {
    return this.request('POST', '/auth/login', credentials);
  }

  async requestPasswordReset(email: string) {
    return this.request('POST', '/auth/request-reset', { email });
  }

  async resetPassword(data: { email: string; token: string; newPassword: string }) {
    return this.request('POST', '/auth/reset-password', data);
  }

  async registerBiometricCredential(email: string, credentialId: string) {
    return this.request('POST', '/auth/biometric/register', { email, credentialId });
  }

  async getBiometricCredential(email: string) {
    return this.request('GET', `/auth/biometric/credential?email=${encodeURIComponent(email)}`);
  }

  async loginWithBiometric(email: string, credentialId: string) {
    return this.request('POST', '/auth/biometric/login', { email, credentialId });
  }

  async listUsers() {
    return this.request('GET', '/users');
  }

  async updateUser(id: string, userData: any) {
    return this.request('PUT', `/users/${id}`, userData);
  }

  // === PRODUCTS ===
  async listProducts(options?: { category?: string; search?: string }) {
    const params = new URLSearchParams();
    if (options?.category) params.append('category', options.category);
    if (options?.search) params.append('search', options.search);

    const queryString = params.toString();
    return this.request('GET', `/products${queryString ? `?${queryString}` : ''}`);
  }

  async getProduct(id: string) {
    return this.request('GET', `/products/${id}`);
  }

  async createProduct(productData: any) {
    return this.request('POST', '/products', productData);
  }

  async updateProduct(id: string, productData: any) {
    return this.request('PUT', `/products/${id}`, productData);
  }

  async deleteProduct(id: string) {
    return this.request('DELETE', `/products/${id}`);
  }

  async listStockMovements(productId: string) {
    return this.request('GET', `/products/${productId}/movements`);
  }

  async recordStockMovement(productId: string, movementData: any) {
    return this.request('POST', `/products/${productId}/movements`, movementData);
  }

  // === ORDERS ===
  async listOrders(options?: { staffId?: string; limit?: number }) {
    const params = new URLSearchParams();
    if (options?.staffId) params.append('staffId', options.staffId);
    if (options?.limit) params.append('limit', options.limit.toString());

    const queryString = params.toString();
    return this.request('GET', `/orders${queryString ? `?${queryString}` : ''}`);
  }

  async createOrder(orderData: any) {
    return this.request('POST', '/orders', orderData);
  }

  async updateOrder(id: string, orderData: any) {
    return this.request('PUT', `/orders/${id}`, orderData);
  }

  // === CUSTOMERS ===
  async listCustomers(options?: { search?: string }) {
    const params = new URLSearchParams();
    if (options?.search) params.append('search', options.search);

    const queryString = params.toString();
    return this.request('GET', `/customers${queryString ? `?${queryString}` : ''}`);
  }

  async getCustomer(id: string) {
    // Fetch single customer by searching
    const customers = await this.listCustomers();
    return customers.find((c: any) => c.id === id) || null;
  }

  async createCustomer(customerData: any) {
    return this.request('POST', '/customers', customerData);
  }

  async updateCustomer(id: string, customerData: any) {
    return this.request('PUT', `/customers/${id}`, customerData);
  }

  async deleteCustomer(id: string) {
    return this.request('DELETE', `/customers/${id}`);
  }

  async listCustomerLedger(customerId: string) {
    return this.request('GET', `/customers/${customerId}/ledger`);
  }

  async recordCustomerDebt(customerId: string, data: { amount: number; orderId?: string; note?: string; type?: string }) {
    return this.request('POST', `/customers/${customerId}/debt`, data);
  }

  async recordCustomerPayment(customerId: string, data: { amount: number; note?: string }) {
    return this.request('POST', `/customers/${customerId}/payments`, data);
  }

  // === EXPENSES ===
  async listExpenses(options?: { search?: string; limit?: number }) {
    const params = new URLSearchParams();
    if (options?.search) params.append('search', options.search);
    if (options?.limit) params.append('limit', options.limit.toString());

    const queryString = params.toString();
    return this.request('GET', `/expenses${queryString ? `?${queryString}` : ''}`);
  }

  async createExpense(expenseData: any) {
    return this.request('POST', '/expenses', expenseData);
  }

  async deleteExpense(id: string) {
    return this.request('DELETE', `/expenses/${id}`);
  }

  // === SUPPLIERS / PURCHASES ===
  async listSuppliers() {
    return this.request('GET', '/suppliers');
  }

  async createSupplier(supplierData: any) {
    return this.request('POST', '/suppliers', supplierData);
  }

  async listPurchases(options?: { limit?: number }) {
    const params = new URLSearchParams();
    if (options?.limit) params.append('limit', options.limit.toString());

    const queryString = params.toString();
    return this.request('GET', `/purchases${queryString ? `?${queryString}` : ''}`);
  }

  async receivePurchase(purchaseData: any) {
    return this.request('POST', '/purchases/receive', purchaseData);
  }

  // === SETTINGS ===
  async getSetting(key: string) {
    return this.request('GET', `/settings/${key}`);
  }

  async setSetting(key: string, value: any) {
    return this.request('POST', `/settings/${key}`, { value });
  }

  // === SYNC ===
  async listSyncQueue(limit = 100) {
    return this.request('GET', `/sync/queue?limit=${limit}`);
  }

  async markSyncQueueComplete(id: string) {
    return this.request('POST', `/sync/queue/${id}/complete`);
  }

  async markSyncQueueFailed(id: string, error: string) {
    return this.request('POST', `/sync/queue/${id}/fail`, { error });
  }

  async applyRemoteChange(collection: string, item: any, operation: 'create' | 'update' | 'delete' = 'update') {
    return this.request('POST', '/sync/apply', { collection, item, operation });
  }

  // === Z-REPORTS ===
  async listZReports(options?: { limit?: number }) {
    const params = new URLSearchParams();
    if (options?.limit) params.append('limit', options.limit.toString());

    const query = params.toString();
    return this.request('GET', `/zreports${query ? `?${query}` : ''}`);
  }

  async createZReport(input: { createdBy?: string; rangeStart?: string; rangeEnd?: string; notes?: string }) {
    return this.request('POST', `/zreports`, input);
  }

  // === BACKUP / RESTORE ===
  async listBackups() {
    return this.request('GET', '/backups');
  }

  async createBackup() {
    return this.request('POST', '/backups/create');
  }

  async restoreBackup(backupId: string) {
    if (!backupId) throw new Error('backupId is required');
    return this.request('POST', '/backups/restore', { backupId });
  }

  // === SUBSCRIPTIONS (for real-time updates in future) ===
  subscribeToProducts(callback: (products: any[]) => void) {
    // For now, just load once
    // In the future, could use WebSockets or polling
    this.listProducts().then(callback).catch(console.error);
    return () => {};
  }

  subscribeToOrders(callback: (orders: any[]) => void) {
    this.listOrders().then(callback).catch(console.error);
    return () => {};
  }

  subscribeToCustomers(callback: (customers: any[]) => void) {
    this.listCustomers().then(callback).catch(console.error);
    return () => {};
  }

  // === SYNC STATUS ===
  getSyncStatus() {
    return {
      lastSync: new Date(),
      pendingChanges: 0,
      isOnline: true,
      mode: 'local',
      conflicts: []
    };
  }

  onSyncStatusChange(callback: (status: any) => void) {
    // Not applicable for desktop app with local database
    return () => {};
  }

  async forceSync() {
    // Not applicable for desktop app
    return;
  }
}

// Singleton instance
let dataServiceInstance: DataService | null = null;

export function getDataService(): DataService {
  if (!dataServiceInstance) {
    dataServiceInstance = new DataService();
  }
  return dataServiceInstance;
}
