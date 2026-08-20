import {
  ApiError,
  type ApiErrorBody,
  type ApiResponse,
  type Customer,
  type FloorState,
  type OrderDetails,
  type OrderStatus,
  type SuggestResult,
} from "./types";

const BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:3000";

async function request<T>(
  path: string,
  init?: RequestInit,
): Promise<ApiResponse<T>> {
  const res = await fetch(`${BASE_URL}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });

  if (res.status === 204) {
    return { data: undefined as T };
  }

  const body = (await res.json()) as ApiResponse<T> | ApiErrorBody;

  if (!res.ok) {
    const err = body as ApiErrorBody;
    throw new ApiError(
      err.error?.code ?? "UNKNOWN",
      err.error?.message ?? "Request failed",
      res.status,
    );
  }

  return body as ApiResponse<T>;
}

export type ListParams = {
  search?: string;
  page?: number;
  size?: number;
};

export type OrderListParams = ListParams & {
  status?: OrderStatus | "";
  customerId?: string;
};

function toQuery(params: Record<string, string | number | undefined>) {
  const q = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== "") {
      q.set(key, String(value));
    }
  }
  const s = q.toString();
  return s ? `?${s}` : "";
}

export const api = {
  listCustomers(params: ListParams = {}) {
    return request<Customer[]>(
      `/customers${toQuery({
        search: params.search,
        page: params.page ?? 1,
        size: params.size ?? 10,
      })}`,
    );
  },

  listOrders(params: OrderListParams = {}) {
    return request<OrderDetails[]>(
      `/orders${toQuery({
        search: params.search,
        status: params.status,
        customerId: params.customerId,
        page: params.page ?? 1,
        size: params.size ?? 10,
      })}`,
    );
  },

  getOrder(id: string) {
    return request<OrderDetails>(`/orders/${id}`);
  },

  createOrder(body: {
    customer: {
      id: string | null;
      name: string;
      email: string | null;
      phone: string;
    };
    partySize?: number;
    items: { itemName: string; quantity: number; unitPrice: number }[];
  }) {
    return request<OrderDetails>("/orders", {
      method: "POST",
      body: JSON.stringify(body),
    });
  },

  updateOrderStatus(id: string, status: OrderStatus) {
    return request<OrderDetails>(`/orders/${id}/status`, {
      method: "PATCH",
      body: JSON.stringify({ status }),
    });
  },

  addOrderItem(
    id: string,
    item: { itemName: string; quantity: number; unitPrice: number },
  ) {
    return request<OrderDetails>(`/orders/${id}/items`, {
      method: "POST",
      body: JSON.stringify(item),
    });
  },

  removeOrderItem(orderId: string, itemId: string) {
    return request<OrderDetails>(`/orders/${orderId}/items/${itemId}`, {
      method: "DELETE",
    });
  },

  getFloor() {
    return request<FloorState>("/ops/floor");
  },

  suggestSeat(orderId: string) {
    return request<SuggestResult>("/ops/floor/suggest", {
      method: "POST",
      body: JSON.stringify({ orderId }),
    });
  },

  assignSeat(body: {
    orderId: string;
    tableId: string;
    source: "AI" | "HOST";
  }) {
    return request<FloorState>("/ops/floor/assign", {
      method: "POST",
      body: JSON.stringify(body),
    });
  },

  clearSeat(orderId: string) {
    return request<FloorState>("/ops/floor/clear", {
      method: "POST",
      body: JSON.stringify({ orderId }),
    });
  },
};
