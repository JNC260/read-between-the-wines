// TODO: render with a test user and mock uploadProfileImage and
// removeProfileImage from ../api, like ProfilePage.spec.tsx. Pick a file with
//   fireEvent.change(input, { target: { files: [new File(["x"], "me.png", { type: "image/png" })] } })
describe("ProfileImageField", () => {
  it.todo("shows the current photo, or initials when there isn't one");
  it.todo("uploads a picked file straight away");
  it.todo("shows the new photo once it's saved");
  it.todo("rejects a file of the wrong type without uploading it");
  it.todo("rejects a file over the size limit without uploading it");
  it.todo("removes the photo");
  it.todo("shows the error if the upload fails");
});
