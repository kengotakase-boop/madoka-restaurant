import { genreLabel, type GenreId } from "../constants/genre";
import type { Dish } from "../types/dish";

export type RegistrationOrder = "newest" | "oldest";

// Missing/invalid registration dates stay last in either direction. Never use
// cookedAt or updatedAt: cooking dates and photo edits are not registration.
export function sortDishesByRegistration<T extends Pick<Dish, "id"> & Partial<Pick<Dish, "createdAt">>>(
  dishes: readonly T[], order: RegistrationOrder = "newest",
): T[] {
  const registeredAt = (dish: T) => {
    const time = dish.createdAt?.toDate().getTime();
    return time !== undefined && Number.isFinite(time) ? time : null;
  };
  return [...dishes].sort((a, b) => {
    const aTime = registeredAt(a);
    const bTime = registeredAt(b);
    if (aTime === null && bTime !== null) return 1;
    if (aTime !== null && bTime === null) return -1;
    if (aTime !== null && bTime !== null && aTime !== bTime) {
      return order === "oldest" ? aTime - bTime : bTime - aTime;
    }
    return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
  });
}

// Keep the existing name/note/Japanese-label substring search and list order.
// Genre buttons add a separate AND condition, never a new genre taxonomy.
export function filterDishes<T extends Pick<Dish, "name" | "note" | "genre">>(
  dishes: readonly T[], query: string, genre: GenreId | "all" = "all",
): T[] {
  const q = query.trim().toLowerCase();
  return dishes.filter((dish) =>
    (genre === "all" || dish.genre === genre) &&
    (!q || [dish.name, dish.note, genreLabel(dish.genre)]
      .some((text) => text.toLowerCase().includes(q))),
  );
}
