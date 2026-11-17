import { randomBytes } from "crypto";
import { route, HttpError } from "@/lib/api";
import { loadAccounts, putAccount, pub, Account } from "@/lib/store";

export const GET = route(async () => (await loadAccounts()).map(pub));

export const POST = route(async (req) => {
  const b = await req.json();
  const label = String(b.label || "").trim(), hash = String(b.api_hash || "").trim(), apiId = Number(b.api_id);
  if (!label || !hash || !Number.isInteger(apiId) || apiId <= 0) throw new HttpError(400, "Name, api_id and api_hash are required");
  const a: Account = { id: randomBytes(4).toString("hex"), label, apiId, apiHash: hash, session: "" };
  await putAccount(a);
  return pub(a);
});
