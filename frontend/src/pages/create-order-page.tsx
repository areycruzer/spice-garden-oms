import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useFieldArray, useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { useCreateOrder, useCustomers } from "@/lib/hooks";
import { ApiError } from "@/lib/types";
import { formatINR } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const schema = z.object({
  mode: z.enum(["existing", "new"]),
  customerId: z.string().optional(),
  name: z.string().min(1, "Name is required"),
  email: z.string().email().optional().or(z.literal("")),
  phone: z.string().min(1, "Phone is required"),
  partySize: z.coerce.number().int().min(1).max(20),
  items: z
    .array(
      z.object({
        itemName: z.string().min(1, "Item name required"),
        quantity: z.coerce.number().int().positive(),
        unitPrice: z.coerce.number().nonnegative(),
      }),
    )
    .min(1, "order must contain at least one item"),
});

type FormValues = z.infer<typeof schema>;

export function CreateOrderPage() {
  const navigate = useNavigate();
  const createOrder = useCreateOrder();
  const [customerSearch, setCustomerSearch] = useState("");

  const customersQuery = useCustomers({
    search: customerSearch,
    page: 1,
    size: 8,
  });

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      mode: "new",
      customerId: "",
      name: "",
      email: "",
      phone: "",
      partySize: 2,
      items: [{ itemName: "", quantity: 1, unitPrice: 0 }],
    },
  });

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "items",
  });

  const mode = form.watch("mode");
  const items = form.watch("items");

  const runningTotal = useMemo(
    () =>
      items.reduce(
        (sum, item) =>
          sum + (Number(item.quantity) || 0) * (Number(item.unitPrice) || 0),
        0,
      ),
    [items],
  );

  function selectCustomer(c: {
    id: string;
    name: string;
    email: string | null;
    phone: string;
  }) {
    form.setValue("mode", "existing");
    form.setValue("customerId", c.id);
    form.setValue("name", c.name);
    form.setValue("email", c.email ?? "");
    form.setValue("phone", c.phone);
  }

  async function onSubmit(values: FormValues) {
    try {
      const res = await createOrder.mutateAsync({
        customer: {
          id: values.mode === "existing" && values.customerId
            ? values.customerId
            : null,
          name: values.name,
          email: values.email ? values.email : null,
          phone: values.phone,
        },
        partySize: values.partySize,
        items: values.items.map((item) => ({
          itemName: item.itemName,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
        })),
      });
      toast.success(`Created ${res.data.orderNumber}`);
      navigate(`/orders/${res.data.id}`);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Create failed");
    }
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <Link to="/orders" className="text-sm text-muted hover:text-ink">
          ← Orders
        </Link>
        <h1 className="mt-2 font-display text-3xl font-semibold">
          Create order
        </h1>
        <p className="mt-1 text-muted">
          Attach an existing guest or capture a new customer, then add items.
        </p>
      </div>

      <form className="space-y-6" onSubmit={form.handleSubmit(onSubmit)}>
        <section className="rounded-lg border border-border bg-card p-5 space-y-4">
          <div className="flex gap-2">
            <Button
              type="button"
              size="sm"
              variant={mode === "existing" ? "default" : "outline"}
              onClick={() => form.setValue("mode", "existing")}
            >
              Existing customer
            </Button>
            <Button
              type="button"
              size="sm"
              variant={mode === "new" ? "default" : "outline"}
              onClick={() => {
                form.setValue("mode", "new");
                form.setValue("customerId", "");
              }}
            >
              New customer
            </Button>
          </div>

          {mode === "existing" && (
            <div className="space-y-2">
              <Label>Lookup customer</Label>
              <Input
                placeholder="Search name, email, or phone"
                value={customerSearch}
                onChange={(e) => setCustomerSearch(e.target.value)}
              />
              <ul className="divide-y divide-border rounded-md border border-border">
                {(customersQuery.data?.data ?? []).map((c) => (
                  <li key={c.id}>
                    <button
                      type="button"
                      className="flex w-full flex-col items-start px-3 py-2 text-left hover:bg-brand-muted/50"
                      onClick={() => selectCustomer(c)}
                    >
                      <span className="font-medium">{c.name}</span>
                      <span className="text-xs text-muted">
                        {c.phone}
                        {c.email ? ` · ${c.email}` : ""}
                      </span>
                    </button>
                  </li>
                ))}
                {customerSearch &&
                  (customersQuery.data?.data.length ?? 0) === 0 && (
                    <li className="px-3 py-3 text-sm text-muted">
                      No customers match.
                    </li>
                  )}
              </ul>
            </div>
          )}

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <Label htmlFor="name">Name</Label>
              <Input id="name" {...form.register("name")} />
              {form.formState.errors.name && (
                <p className="mt-1 text-xs text-red-600">
                  {form.formState.errors.name.message}
                </p>
              )}
            </div>
            <div>
              <Label htmlFor="phone">Phone</Label>
              <Input id="phone" {...form.register("phone")} />
              {form.formState.errors.phone && (
                <p className="mt-1 text-xs text-red-600">
                  {form.formState.errors.phone.message}
                </p>
              )}
            </div>
            <div>
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" {...form.register("email")} />
            </div>
            <div>
              <Label htmlFor="partySize">Party size</Label>
              <Input
                id="partySize"
                type="number"
                min={1}
                max={20}
                {...form.register("partySize")}
              />
            </div>
          </div>
        </section>

        <section className="rounded-lg border border-border bg-card p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">
              Items
            </h2>
            <p className="text-sm font-medium">
              Running total: {formatINR(runningTotal)}
            </p>
          </div>

          {fields.map((field, index) => (
            <div
              key={field.id}
              className="grid gap-3 sm:grid-cols-12 items-end"
            >
              <div className="sm:col-span-5">
                <Label>Item</Label>
                <Input
                  {...form.register(`items.${index}.itemName`)}
                  placeholder="Paneer Butter Masala"
                />
              </div>
              <div className="sm:col-span-2">
                <Label>Qty</Label>
                <Input
                  type="number"
                  min={1}
                  {...form.register(`items.${index}.quantity`)}
                />
              </div>
              <div className="sm:col-span-3">
                <Label>Unit price (₹)</Label>
                <Input
                  type="number"
                  min={0}
                  step="0.01"
                  {...form.register(`items.${index}.unitPrice`)}
                />
              </div>
              <div className="sm:col-span-2">
                <Button
                  type="button"
                  variant="ghost"
                  disabled={fields.length === 1}
                  onClick={() => remove(index)}
                >
                  Remove
                </Button>
              </div>
            </div>
          ))}

          {form.formState.errors.items?.root && (
            <p className="text-xs text-red-600">
              {form.formState.errors.items.root.message}
            </p>
          )}
          {typeof form.formState.errors.items?.message === "string" && (
            <p className="text-xs text-red-600">
              {form.formState.errors.items.message}
            </p>
          )}

          <Button
            type="button"
            variant="outline"
            onClick={() =>
              append({ itemName: "", quantity: 1, unitPrice: 0 })
            }
          >
            Add row
          </Button>
        </section>

        <div className="flex gap-3">
          <Button type="submit" disabled={createOrder.isPending}>
            {createOrder.isPending ? "Creating…" : "Create order"}
          </Button>
          <Link
            to="/orders"
            className="inline-flex h-10 items-center rounded-md border border-border bg-card px-4 text-sm hover:bg-brand-muted"
          >
            Cancel
          </Link>
        </div>
      </form>
    </div>
  );
}
