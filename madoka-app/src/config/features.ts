// Code-level kill switch only. Server credentials + a private bucket must also
// pass /api/images/status; missing Storage must never block dish CRUD.
export const IMAGES_ENABLED = true;
