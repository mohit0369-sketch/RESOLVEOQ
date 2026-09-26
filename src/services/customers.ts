import { Customer } from '../types';
import { api } from './api';

interface BackendCustomer {
  customer_id: string;
  name: string;
  email: string | null;
  phone: string | null;
}

function mapBackendCustomer(c: BackendCustomer): Customer {
  return {
    customer_id: c.customer_id,
    name: c.name,
    email: c.email || '',
    segment: 'Standard',
    language: 'en',
    created_at: new Date().toISOString(),
    previous_orders_count: 0,
    lifetime_complaints_count: 0,
  };
}

export const customerService = {
  async getCustomers(): Promise<Customer[]> {
    const response = await api.get<BackendCustomer[]>('/customers');
    if (response.error) throw new Error(response.error);
    return (response.data || []).map(mapBackendCustomer);
  },

  async getCustomerById(customerId: string): Promise<Customer | null> {
    const response = await api.get<BackendCustomer>(`/customers/${customerId}`);
    if (response.error) {
      if (response.status === 404) return null;
      throw new Error(response.error);
    }
    return response.data ? mapBackendCustomer(response.data) : null;
  },
};