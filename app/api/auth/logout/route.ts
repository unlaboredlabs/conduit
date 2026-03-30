import { deleteSession } from "@/app/lib/session";
import { jsonOk } from "@/app/lib/response";

export async function POST() {
  await deleteSession();
  return jsonOk({});
}
