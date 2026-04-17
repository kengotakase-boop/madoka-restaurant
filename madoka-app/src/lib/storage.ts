import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { storage } from "@/lib/firebase";

export async function uploadDishImage(
  file: File,
  uid: string,
  dishId: string,
): Promise<string> {
  const timestamp = Date.now();
  const path = `dishes/${uid}/${dishId}/${timestamp}.jpg`;
  const storageRef = ref(storage, path);
  await uploadBytes(storageRef, file, { contentType: file.type || "image/jpeg" });
  return path;
}

export async function getDishImageUrl(imagePath: string): Promise<string> {
  const storageRef = ref(storage, imagePath);
  return getDownloadURL(storageRef);
}
