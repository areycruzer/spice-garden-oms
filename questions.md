# Clarifying questions (assumptions)

These are the product/contract assumptions used while building Spice Garden OMS. Each is phrased as a clarifying question that would typically be asked of the hiring team.

## Assignment contract

1. **Status transitions**  
   Should order status follow a strict kitchen workflow where `CONFIRMED → PREPARING → READY → COMPLETED`, with `CANCELLED` allowed from non-terminal states only (`CONFIRMED`, `PREPARING`, `READY`), and no transitions out of `COMPLETED` / `CANCELLED`?

2. **Item mutability window**  
   May line items be added or removed only while an order is `CONFIRMED` or `PREPARING` (i.e. before it becomes `READY`)?

3. **Duplicate phone on order create**  
   When `POST /orders` is called with `customer.id = null` and the phone already belongs to another customer, should the API return `RESOURCE_ALREADY_EXISTS` (409) rather than silently attaching to that customer?

4. **itemCount semantics**  
   Should `itemCount` be the sum of line-item quantities (not the count of distinct line rows)?

5. **Deleting customers with orders**  
   Should deleting a customer who still has orders be blocked via `ON DELETE RESTRICT` on `orders.customer_id`?

6. **Search field semantics**  
   For customers, should `search` match case-insensitively against name, email, and phone? For orders, should it match order number and the embedded customer name?

7. **Pagination defaults and max**  
   Should list endpoints default to `page=1`, `size=10`, reject `size > 100`, and return `INVALID_FILTER` for invalid pagination params?

8. **Currency**  
   Is the restaurant currency INR (₹), including seed prices and UI formatting?

9. **orderNumber format**  
   Should order numbers be generated as `ORD-####` from a sequence starting at 1001, allowing gaps if numbers are consumed without a committed order?

10. **totalAmount ownership**  
    Is `totalAmount` always server-computed from line items (`sum(quantity * unit_price)`) and never trusted from the client?

11. **Timestamps and display timezone**  
    Should timestamps be stored as UTC `timestamptz` and displayed in the UI using `Asia/Kolkata`?

12. **Order item `id` in API responses**  
    The shared `OrderDetails.items[]` schema in the brief omits `id`, but `DELETE /orders/{order_id}/items/{item_id}` requires an item identifier. Should each line item include `id` in responses so clients can delete items?

13. **Money JSON types**  
    Should `totalAmount`, `unitPrice`, and `totalPrice` be serialized as JSON numbers (not strings), matching the `<number>` markers in the contract?

## Atithie-aware (additive Floor Ops)

14. **Quoted waits visibility**  
    Should deterministic quoted-ready times be visible to hosts on the kitchen/order detail surface only, or also surfaced at the door as guest-facing wait estimates?

15. **AI seating forever suggestion-only?**  
    Should AI table allocation remain suggestion-only with mandatory human accept/override (Atithie “governed by your team”), or should quiet periods allow auto-seat with audit log?

16. **Party size source of truth**  
    When creating an order, is `partySize` an explicit host input (default 2), or should it be inferred later from reservations / covers?

17. **Terminal status and floor**  
    When an order becomes `COMPLETED` or `CANCELLED`, should any active seating assignment clear automatically so the table returns to `FREE` without a separate host action?
