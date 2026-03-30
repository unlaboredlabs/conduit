import { ConvexHttpClient } from "convex/browser";
import type { FunctionReference, FunctionReturnType } from "convex/server";
import { env } from "@/app/lib/env";

const createClient = () => {
  const client = new ConvexHttpClient(env.convexUrl(), { logger: false });
  (
    client as ConvexHttpClient & {
      setAdminAuth: (token: string) => void;
    }
  ).setAdminAuth(env.convexAdminKey());
  return client;
};

export const convexQuery = async <
  T extends FunctionReference<"query", "public" | "internal">,
>(
  fn: T,
  args: T["_args"],
): Promise<FunctionReturnType<T>> => {
  const client = createClient();
  return client.query(
    fn as FunctionReference<"query">,
    args as FunctionReference<"query">["_args"],
  ) as Promise<FunctionReturnType<T>>;
};

export const convexMutation = async <
  T extends FunctionReference<"mutation", "public" | "internal">,
>(
  fn: T,
  args: T["_args"],
): Promise<FunctionReturnType<T>> => {
  const client = createClient();
  return client.mutation(
    fn as FunctionReference<"mutation">,
    args as FunctionReference<"mutation">["_args"],
  ) as Promise<FunctionReturnType<T>>;
};
