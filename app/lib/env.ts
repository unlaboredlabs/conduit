const required = (name: string) => {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
};

export const env = {
  convexUrl: () => required("NEXT_PUBLIC_CONVEX_URL"),
  convexAdminKey: () => required("CONVEX_ADMIN_KEY"),
  sessionSecret: () => required("SESSION_SECRET"),
  adminUsername: () => required("CONDUIT_ADMIN_USERNAME"),
  adminPassword: () => required("CONDUIT_ADMIN_PASSWORD"),
  adminApiToken: () => required("CONDUIT_ADMIN_API_TOKEN"),
  vultrApiKey: () => required("VULTR_API_KEY"),
  frpsImage: () =>
    process.env.CONDUIT_FRPS_IMAGE ?? "ghcr.io/fatedier/frps:v0.65.0",
};
