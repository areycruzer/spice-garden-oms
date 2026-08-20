#!/usr/bin/env bash
# Spice Garden API — curl / REST examples
# Prerequisites: API running at http://localhost:3000
set -euo pipefail

BASE="${API_BASE_URL:-http://localhost:3000}"

echo "== Health =="
curl -sS "$BASE/health" | jq .

echo
echo "== Create customer =="
CUSTOMER=$(curl -sS -X POST "$BASE/customers" \
  -H 'Content-Type: application/json' \
  -d '{"name":"Demo Customer","email":"demo@spicegarden.test","phone":"+919911122233"}')
echo "$CUSTOMER" | jq .
CUSTOMER_ID=$(echo "$CUSTOMER" | jq -r .data.id)

echo
echo "== Duplicate phone -> RESOURCE_ALREADY_EXISTS =="
curl -sS -X POST "$BASE/customers" \
  -H 'Content-Type: application/json' \
  -d '{"name":"Other","email":null,"phone":"+919911122233"}' | jq .

echo
echo "== List customers (paginated) =="
curl -sS "$BASE/customers?search=Demo&page=1&size=10" | jq .

echo
echo "== Invalid pagination -> INVALID_FILTER =="
curl -sS "$BASE/customers?page=0&size=10" | jq .

echo
echo "== Create order (new customer) =="
ORDER=$(curl -sS -X POST "$BASE/orders" \
  -H 'Content-Type: application/json' \
  -d '{
    "customer": {"id": null, "name": "Walk-in Guest", "email": null, "phone": "+919922233344"},
    "items": [
      {"itemName": "Chicken Biryani", "quantity": 1, "unitPrice": 380},
      {"itemName": "Mango Lassi", "quantity": 2, "unitPrice": 140}
    ]
  }')
echo "$ORDER" | jq .
ORDER_ID=$(echo "$ORDER" | jq -r .data.id)
ITEM_ID=$(echo "$ORDER" | jq -r '.data.items[0].id')

echo
echo "== Create order with existing customer =="
curl -sS -X POST "$BASE/orders" \
  -H 'Content-Type: application/json' \
  -d "{\"customer\":{\"id\":\"$CUSTOMER_ID\",\"name\":\"Demo Customer\",\"email\":\"demo@spicegarden.test\",\"phone\":\"+919911122233\"},\"items\":[{\"itemName\":\"Butter Naan\",\"quantity\":3,\"unitPrice\":60}]}" | jq .

echo
echo "== Empty items -> VALIDATION_FAILED =="
curl -sS -X POST "$BASE/orders" \
  -H 'Content-Type: application/json' \
  -d "{\"customer\":{\"id\":\"$CUSTOMER_ID\",\"name\":\"Demo\",\"email\":null,\"phone\":\"+919911122233\"},\"items\":[]}" | jq .

echo
echo "== List orders =="
curl -sS "$BASE/orders?status=CONFIRMED&page=1&size=10" | jq .

echo
echo "== Get order =="
curl -sS "$BASE/orders/$ORDER_ID" | jq .

echo
echo "== Invalid status transition =="
curl -sS -X PATCH "$BASE/orders/$ORDER_ID/status" \
  -H 'Content-Type: application/json' \
  -d '{"status":"COMPLETED"}' | jq .

echo
echo "== Valid status transition CONFIRMED -> PREPARING =="
curl -sS -X PATCH "$BASE/orders/$ORDER_ID/status" \
  -H 'Content-Type: application/json' \
  -d '{"status":"PREPARING"}' | jq .

echo
echo "== Add item =="
curl -sS -X POST "$BASE/orders/$ORDER_ID/items" \
  -H 'Content-Type: application/json' \
  -d '{"itemName":"Gulab Jamun","quantity":2,"unitPrice":120}' | jq .

echo
echo "== Remove item =="
curl -sS -X DELETE "$BASE/orders/$ORDER_ID/items/$ITEM_ID" | jq .

echo
echo "== Floor Ops snapshot =="
curl -sS "$BASE/ops/floor" | jq '{tables: (.data.tables|length), unseated: (.data.unseatedOrders|length)}'

echo
echo "== Suggest seating for order =="
SUGGEST=$(curl -sS -X POST "$BASE/ops/floor/suggest" \
  -H 'Content-Type: application/json' \
  -d "{\"orderId\":\"$ORDER_ID\"}")
echo "$SUGGEST" | jq .
TABLE_ID=$(echo "$SUGGEST" | jq -r '.data.table.id // empty')

if [[ -n "$TABLE_ID" && "$TABLE_ID" != "null" ]]; then
  echo
  echo "== Assign seat (AI accept) =="
  curl -sS -X POST "$BASE/ops/floor/assign" \
    -H 'Content-Type: application/json' \
    -d "{\"orderId\":\"$ORDER_ID\",\"tableId\":\"$TABLE_ID\",\"source\":\"AI\"}" | jq '.data.tables[] | select(.assignment != null) | {label, assignment}'
fi

echo
echo "== Patch customer =="
curl -sS -X PATCH "$BASE/customers/$CUSTOMER_ID" \
  -H 'Content-Type: application/json' \
  -d '{"name":"Demo Customer Updated"}' | jq .

echo
echo "== Delete customer without orders (create disposable) =="
DISP=$(curl -sS -X POST "$BASE/customers" \
  -H 'Content-Type: application/json' \
  -d '{"name":"Disposable","email":null,"phone":"+919933344455"}')
DISP_ID=$(echo "$DISP" | jq -r .data.id)
curl -sS -o /dev/null -w "HTTP %{http_code}\n" -X DELETE "$BASE/customers/$DISP_ID"

echo
echo "Done."
