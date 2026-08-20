import { Link, NavLink } from "react-router-dom";
import { cn } from "@/lib/utils";

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen">
      <header className="border-b border-border/80 bg-card/80 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4 sm:px-6">
          <Link to="/orders" className="group">
            <p className="font-display text-2xl font-semibold tracking-tight text-brand">
              Spice Garden
            </p>
            <p className="text-xs text-muted group-hover:text-ink">Kitchen &amp; Floor</p>
          </Link>
          <nav className="flex items-center gap-2 text-sm">
            <NavLink
              to="/orders"
              className={({ isActive }) =>
                cn(
                  "rounded-md px-3 py-1.5 hover:bg-brand-muted hover:text-ink",
                  isActive ? "bg-brand-muted font-medium text-ink" : "text-muted",
                )
              }
            >
              Order Ops
            </NavLink>
            <NavLink
              to="/floor"
              className={({ isActive }) =>
                cn(
                  "rounded-md px-3 py-1.5 hover:bg-brand-muted hover:text-ink",
                  isActive ? "bg-brand-muted font-medium text-ink" : "text-muted",
                )
              }
            >
              Floor Ops
            </NavLink>
            <NavLink
              to="/customers"
              className={({ isActive }) =>
                cn(
                  "rounded-md px-3 py-1.5 hover:bg-brand-muted hover:text-ink",
                  isActive ? "bg-brand-muted font-medium text-ink" : "text-muted",
                )
              }
            >
              Customers
            </NavLink>
            <Link
              to="/orders/new"
              className="rounded-md bg-brand px-3 py-1.5 font-medium text-white hover:bg-brand-dark"
            >
              New order
            </Link>
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6">{children}</main>
      <footer className="mx-auto max-w-6xl px-4 pb-8 text-xs text-muted sm:px-6">
        Internal ops tool · v1
      </footer>
    </div>
  );
}
