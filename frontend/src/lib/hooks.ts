import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, type ListParams, type OrderListParams } from "./api";
import type { OrderStatus } from "./types";

export const queryKeys = {
  customers: (params: ListParams) => ["customers", params] as const,
  orders: (params: OrderListParams) => ["orders", params] as const,
  order: (id: string) => ["orders", id] as const,
  floor: ["ops", "floor"] as const,
};

export function useCustomers(params: ListParams) {
  return useQuery({
    queryKey: queryKeys.customers(params),
    queryFn: () => api.listCustomers(params),
  });
}

export function useOrders(params: OrderListParams) {
  return useQuery({
    queryKey: queryKeys.orders(params),
    queryFn: () => api.listOrders(params),
  });
}

export function useOrder(id: string) {
  return useQuery({
    queryKey: queryKeys.order(id),
    queryFn: () => api.getOrder(id),
    enabled: Boolean(id),
  });
}

export function useFloor() {
  return useQuery({
    queryKey: queryKeys.floor,
    queryFn: () => api.getFloor(),
    refetchInterval: 8_000,
  });
}

export function useCreateOrder() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: api.createOrder,
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["orders"] });
      void qc.invalidateQueries({ queryKey: ["customers"] });
      void qc.invalidateQueries({ queryKey: queryKeys.floor });
    },
  });
}

export function useUpdateOrderStatus(orderId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (status: OrderStatus) => api.updateOrderStatus(orderId, status),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["orders"] });
      void qc.invalidateQueries({ queryKey: queryKeys.order(orderId) });
      void qc.invalidateQueries({ queryKey: queryKeys.floor });
    },
  });
}

export function useAddOrderItem(orderId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (item: {
      itemName: string;
      quantity: number;
      unitPrice: number;
    }) => api.addOrderItem(orderId, item),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["orders"] });
      void qc.invalidateQueries({ queryKey: queryKeys.order(orderId) });
    },
  });
}

export function useRemoveOrderItem(orderId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (itemId: string) => api.removeOrderItem(orderId, itemId),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["orders"] });
      void qc.invalidateQueries({ queryKey: queryKeys.order(orderId) });
    },
  });
}

export function useSuggestSeat() {
  return useMutation({
    mutationFn: (orderId: string) => api.suggestSeat(orderId),
  });
}

export function useAssignSeat() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: {
      orderId: string;
      tableId: string;
      source: "AI" | "HOST";
    }) => api.assignSeat(body),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: queryKeys.floor });
      void qc.invalidateQueries({ queryKey: ["orders"] });
    },
  });
}

export function useClearSeat() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (orderId: string) => api.clearSeat(orderId),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: queryKeys.floor });
      void qc.invalidateQueries({ queryKey: ["orders"] });
    },
  });
}
