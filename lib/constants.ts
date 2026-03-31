export const CARD_VALUES = ["1", "2", "3", "5", "8", "13", "21", "34", "55", "I won't vote"] as const;
export const AVATARS = ["tshirt", "hanger", "jacket", "sneaker", "parcel", "truck", "barcode", "totebag"] as const;
export function avatarEmoji(key: string) {
  const map: Record<string, string> = { tshirt: "👕", hanger: "🪝", jacket: "🧥", sneaker: "👟", parcel: "📦", truck: "🚚", barcode: "🏷️", totebag: "👜" };
  return map[key] || "👕";
}
