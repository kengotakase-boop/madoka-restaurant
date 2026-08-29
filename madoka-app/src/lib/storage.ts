export async function uploadDishImage(
  file: File,
  uid: string,
  dishId: string,
): Promise<string> {
  void file;
  void uid;
  void dishId;
  throw new Error("Dish image upload is disabled");
}

export async function getDishImageUrl(imagePath: string): Promise<string> {
  return imagePath;
}
