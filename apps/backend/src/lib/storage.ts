// Where uploaded files live. Services call these and store the returned URL
// (User.image), so nothing else needs to know whether files are on local
// disk or in a bucket.

export type UploadedImage = {
  buffer: Buffer;
  // One of PROFILE_IMAGE_TYPES from shared, e.g. "image/jpeg"
  contentType: string;
};

// Saves the image under a new random name and returns the URL the browser
// loads it from.
export const saveImage = async (_image: UploadedImage): Promise<string> => {
  // TODO: decide where files go:
  //   - local disk (e.g. apps/backend/uploads, gitignored), served by
  //     express.static in app.ts. Simplest; fine while there's one server.
  //   - an S3-compatible bucket (S3, R2, MinIO in docker-compose locally).
  //     Survives redeploys and multiple servers; needs credentials in .env.
  // Name files with randomUUID() plus an extension from contentType, never
  // the uploader's filename.
  throw new Error("TODO: saveImage");
};

// Removes a file saveImage returned. Ignores URLs it didn't create, so
// clearing an old image never fails the request.
export const deleteImage = async (_url: string): Promise<void> => {
  // TODO
  throw new Error("TODO: deleteImage");
};
