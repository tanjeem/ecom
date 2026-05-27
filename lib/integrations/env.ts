export const requiredWooEnv = [
  "WOOCOMMERCE_URL",
  "WOOCOMMERCE_CONSUMER_KEY",
  "WOOCOMMERCE_CONSUMER_SECRET",
] as const;

export const requiredPathaoEnv = ["PATHAO_CLIENT_ID", "PATHAO_CLIENT_SECRET", "PATHAO_USERNAME", "PATHAO_PASSWORD"] as const;

export const requiredPathaoBookingEnv = [
  "PATHAO_STORE_ID",
  "PATHAO_CITY_ID",
  "PATHAO_ZONE_ID",
  "PATHAO_AREA_ID",
] as const;

export function hasEnv(keys: readonly string[]) {
  return keys.every((key) => Boolean(process.env[key]));
}
