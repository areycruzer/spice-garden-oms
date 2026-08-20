import type {
  Customer,
  Order,
  OrderItem,
  OrderStatusEvent,
} from "@spice-garden/database/schema";
import { buildOpsInsight, type OpsInsight } from "./ops-insight.js";
import type { OrderStatus } from "./status.js";

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

export type StatusEventDto = {
  id: string;
  fromStatus: OrderStatus | null;
  toStatus: OrderStatus;
  changedAt: string;
};

export type OrderDetailsDto = {
  id: string;
  orderNumber: string;
  customerId: string;
  status: Order["status"];
  partySize: number;
  totalAmount: number;
  itemCount: number;
  statusChangedAt: string;
  createdAt: string;
  updatedAt: string;
  customer: CustomerDto;
  items: OrderItemDto[];
  statusEvents: StatusEventDto[];
  opsInsight: OpsInsight;
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

export function mapStatusEvent(event: OrderStatusEvent): StatusEventDto {
  return {
    id: event.id,
    fromStatus: event.fromStatus as OrderStatus | null,
    toStatus: event.toStatus as OrderStatus,
    changedAt: toIso(event.changedAt),
  };
}

export function mapOrderDetails(
  order: Order,
  customer: Customer,
  items: OrderItem[],
  statusEvents: OrderStatusEvent[] = [],
  now: Date = new Date(),
): OrderDetailsDto {
  return {
    id: order.id,
    orderNumber: order.orderNumber,
    customerId: order.customerId,
    status: order.status,
    partySize: order.partySize,
    totalAmount: toNumber(order.totalAmount),
    itemCount: order.itemCount,
    statusChangedAt: toIso(order.statusChangedAt),
    createdAt: toIso(order.createdAt),
    updatedAt: toIso(order.updatedAt),
    customer: mapCustomer(customer),
    items: items.map(mapOrderItem),
    statusEvents: statusEvents.map(mapStatusEvent),
    opsInsight: buildOpsInsight(
      order.status as OrderStatus,
      order.itemCount,
      order.statusChangedAt,
      now,
    ),
  };
}
