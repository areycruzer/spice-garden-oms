import type { Customer, Order, OrderItem } from "@spice-garden/database/schema";

export type CustomerDto = {
  id: string;
  name: string;
  email: string | null;
  phone: string;
  createdAt: string;
  updatedAt: string;
};

export type OrderItemDto = {
  id: string;
  itemName: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
};

export type OrderDetailsDto = {
  id: string;
  orderNumber: string;
  customerId: string;
  status: Order["status"];
  totalAmount: number;
  itemCount: number;
  createdAt: string;
  updatedAt: string;
  customer: CustomerDto;
  items: OrderItemDto[];
};

export function toIso(date: Date): string {
  return date.toISOString();
}

function toNumber(value: string | number): number {
  return typeof value === "number" ? value : Number(value);
}

export function mapCustomer(c: Customer): CustomerDto {
  return {
    id: c.id,
    name: c.name,
    email: c.email,
    phone: c.phone,
    createdAt: toIso(c.createdAt),
    updatedAt: toIso(c.updatedAt),
  };
}

export function mapOrderItem(item: OrderItem): OrderItemDto {
  return {
    id: item.id,
    itemName: item.itemName,
    quantity: item.quantity,
    unitPrice: toNumber(item.unitPrice),
    totalPrice: toNumber(item.totalPrice),
  };
}

export function mapOrderDetails(
  order: Order,
  customer: Customer,
  items: OrderItem[],
): OrderDetailsDto {
  return {
    id: order.id,
    orderNumber: order.orderNumber,
    customerId: order.customerId,
    status: order.status,
    totalAmount: toNumber(order.totalAmount),
    itemCount: order.itemCount,
    createdAt: toIso(order.createdAt),
    updatedAt: toIso(order.updatedAt),
    customer: mapCustomer(customer),
    items: items.map(mapOrderItem),
  };
}
