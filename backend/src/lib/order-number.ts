type Sql = ReturnType<typeof import("postgres").default>;

export async function nextOrderNumber(sql: Sql): Promise<string> {
  const rows = await sql<{ n: string }[]>`SELECT nextval('order_number_seq') AS n`;
  return `ORD-${rows[0]!.n}`;
}
