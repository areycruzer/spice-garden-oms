export const ORDER_STATUSES = [
  "CONFIRMED",
  "PREPARING",
  "READY",
  "COMPLETED",
  "CANCELLED",
] as const;

export type OrderStatus = (typeof ORDER_STATUSES)[number];

export const STATUS_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  CONFIRMED: ["PREPARING", "CANCELLED"],
  PREPARING: ["READY", "CANCELLED"],
  READY: ["COMPLETED", "CANCELLED"],
  COMPLETED: [],
  CANCELLED: [],
};

export function canMutateItems(status: OrderStatus): boolean {
  return status === "CONFIRMED" || status === "PREPARING";
}

export type Customer = {
  id: string;
  name: string;
  email: string | null;
  phone: string;
  createdAt: string;
  updatedAt: string;
};

export type OrderItem = {
  id: string;
  itemName: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
};

export type DiningPhase =
  | "queued"
  | "cooking"
  | "plated"
  | "done"
  | "cancelled";

export type OpsInsight = {
  diningPhase: DiningPhase;
  dwellMinutes: number;
  quotedReadyMinutes: number | null;
  suggestedAction: string;
};

export type StatusEvent = {
  id: string;
  fromStatus: OrderStatus | null;
  toStatus: OrderStatus;
  changedAt: string;
};

export type OrderDetails = {
  id: string;
  orderNumber: string;
  customerId: string;
  status: OrderStatus;
  partySize: number;
  totalAmount: number;
  itemCount: number;
  statusChangedAt: string;
  createdAt: string;
  updatedAt: string;
  customer: Customer;
  items: OrderItem[];
  statusEvents: StatusEvent[];
  opsInsight: OpsInsight;
};

export type FloorAssignment = {
  id: string;
  orderId: string;
  orderNumber: string;
  partySize: number;
  source: "AI" | "HOST";
  customerName: string;
  orderStatus: OrderStatus;
  createdAt: string;
};

export type FloorTable = {
  id: string;
  label: string;
  capacity: number;
  status: "FREE" | "OCCUPIED" | "TURNING";
  assignment: FloorAssignment | null;
};

export type UnseatedOrder = {
  id: string;
  orderNumber: string;
  status: OrderStatus;
  partySize: number;
  itemCount: number;
  customerName: string;
  createdAt: string;
};

export type FloorState = {
  tables: FloorTable[];
  unseatedOrders: UnseatedOrder[];
};

export type SuggestResult = {
  orderId: string;
  partySize: number;
  table: { id: string; label: string; capacity: number } | null;
  reason: string;
};

export type PaginationMeta = {
  page: number;
  size: number;
  total: number;
  totalPages: number;
};

export type ApiResponse<T> = {
  data: T;
  meta?: { pagination: PaginationMeta };
};

export type ApiErrorBody = {
  error: { code: string; message: string };
};

export class ApiError extends Error {
  code: string;
  status: number;

  constructor(code: string, message: string, status: number) {
    super(message);
    this.name = "ApiError";
    this.code = code;
    this.status = status;
  }
}
