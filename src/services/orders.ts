import { Order, OrderStatus, PaymentStatus } from '../types';
import { api } from './api';

interface BackendOrder {
  order_id: string;
  customer_id: string;
  item: string;
  amount: number;
  status: string;
  order_date: string;
}

function mapBackendOrder(o: BackendOrder): Order {
  return {
    order_id: o.order_id,
    customer_id: o.customer_id,
    status: o.status as OrderStatus,
    amount: o.amount,
    currency: 'INR',
    item: o.item,
    delivery_date: undefined,
    seller: undefined,
    warehouse: undefined,
    payment_status: 'Paid' as PaymentStatus,
    return_window_open: false,
  };
}

export const orderService = {
  async getOrders(customerId?: string): Promise<Order[]> {
    const endpoint = customerId ? `/orders?customer_id=${customerId}` : '/orders';
    const response = await api.get<BackendOrder[]>(endpoint);
    if (response.error) throw new Error(response.error);
    return (response.data || []).map(mapBackendOrder);
  },

  async getOrderById(orderId: string): Promise<Order | null> {
    const response = await api.get<BackendOrder>(`/orders/${orderId}`);
    if (response.error) {
      if (response.status === 404) return null;
      throw new Error(response.error);
    }
    return response.data ? mapBackendOrder(response.data) : null;
  },
};