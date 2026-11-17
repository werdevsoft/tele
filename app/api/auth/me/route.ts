import { route, currentUser } from "@/lib/api";
import { countUsers, publicUser } from "@/lib/users";

export const GET = route(async () => {
  const u = await currentUser();
  return { user: u ? publicUser(u) : null, setup: !u && (await countUsers()) === 0 };
}, { public: true });
