import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { storage } from "./firebase";

export async function uploadFile(
  path: string,
  file: Blob | File,
  contentType?: string,
): Promise<string> {
  const r = ref(storage, path);
  await uploadBytes(r, file, contentType ? { contentType } : undefined);
  return getDownloadURL(r);
}
