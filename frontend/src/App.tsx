import { Navigate, Route, Routes } from "react-router-dom";
import { AppShell } from "@/components/app-shell";
import { OrdersPage } from "@/pages/orders-page";
import { OrderDetailPage } from "@/pages/order-detail-page";
import { CreateOrderPage } from "@/pages/create-order-page";
import { CustomersPage } from "@/pages/customers-page";
import { FloorPage } from "@/pages/floor-page";

export function App() {
  return (
    <AppShell>
      <Routes>
        <Route path="/" element={<Navigate to="/orders" replace />} />
        <Route path="/orders" element={<OrdersPage />} />
        <Route path="/orders/new" element={<CreateOrderPage />} />
        <Route path="/orders/:id" element={<OrderDetailPage />} />
        <Route path="/floor" element={<FloorPage />} />
        <Route path="/customers" element={<CustomersPage />} />
      </Routes>
    </AppShell>
  );
}
