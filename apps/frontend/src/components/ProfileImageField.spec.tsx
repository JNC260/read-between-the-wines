import { fireEvent, screen } from "@testing-library/react";
import { MAX_PROFILE_IMAGE_BYTES, type UserDTO } from "shared";
import { getUsersList, removeProfileImage, uploadProfileImage } from "../api";
import { useMembers } from "../hooks";
import { mockSession, renderRoutes, Route, testUser } from "../test-utils";
import ProfileImageField from "./ProfileImageField";

vi.mock("../lib/auth-client", () => ({ authClient: { useSession: vi.fn() } }));
vi.mock("../api", () => ({
  getUsersList: vi.fn(),
  uploadProfileImage: vi.fn(),
  removeProfileImage: vi.fn(),
}));

const ada: UserDTO = {
  id: testUser().id,
  email: "ada@example.com",
  name: "Ada Reader",
  firstName: "Ada",
  lastName: "Reader",
  image: null,
  phone: null,
  facebookUrl: null,
  goodreadsUrl: null,
  instagram: null,
  tiktok: null,
  x: null,
  venmo: null,
  memberSince: null,
  status: "ACTIVE",
  createdAt: new Date("2026-10-01T00:00:00Z"),
  updatedAt: new Date("2026-10-01T00:00:00Z"),
};

const SAVED = "/api/uploads/00000000-0000-4000-8000-000000000001.webp";

// jsdom has no object URLs, so previews get a stand-in.
const createObjectURL = vi.fn(() => "blob:preview");
const revokeObjectURL = vi.fn();

beforeEach(() => {
  mockSession(testUser());
  Object.assign(URL, { createObjectURL, revokeObjectURL });
});

const renderField = (user: UserDTO = ada) =>
  renderRoutes("/", <Route path="/" element={<ProfileImageField user={user} />} />);

const photo = (type = "image/png", bytes = 100) =>
  new File([new Uint8Array(bytes)], "me.png", { type });

const pick = (file: File) =>
  fireEvent.change(screen.getByLabelText(/^(Add a|Change) photo$/), {
    target: { files: [file] },
  });

const shownImage = () =>
  document.querySelector("img.avatar")?.getAttribute("src") ?? null;

describe("ProfileImageField", () => {
  it("shows the current photo, or initials when there isn't one", () => {
    const { unmount } = renderField();
    expect(shownImage()).toBeNull();
    expect(screen.getByText("AR")).toBeTruthy();
    expect(screen.getByLabelText("Add a photo")).toBeTruthy();
    unmount();

    renderField({ ...ada, image: SAVED });
    expect(shownImage()).toBe(SAVED);
    expect(screen.getByLabelText("Change photo")).toBeTruthy();
  });

  it("only offers the types the server takes", () => {
    renderField();
    expect(screen.getByLabelText("Add a photo").getAttribute("accept")).toBe(
      "image/jpeg,image/png,image/webp",
    );
  });

  it("uploads a picked file straight away, previewing it meanwhile", async () => {
    // Held open, to look at the page mid-upload.
    let finish!: (user: UserDTO) => void;
    vi.mocked(uploadProfileImage).mockReturnValue(
      new Promise((resolve) => (finish = resolve)),
    );
    renderField();
    const file = photo();
    pick(file);
    await vi.waitFor(() =>
      expect(vi.mocked(uploadProfileImage).mock.calls[0][0]).toBe(file),
    );
    expect(shownImage()).toBe("blob:preview");
    expect(screen.getByRole("status").textContent).toBe("Uploading...");
    expect((screen.getByLabelText("Add a photo") as HTMLInputElement).disabled).toBe(
      true,
    );

    finish({ ...ada, image: SAVED });
    expect(await screen.findByText("Photo saved.")).toBeTruthy();
  });

  // Like the profile page: the member comes from the cached member list,
  // which the upload updates with the saved member.
  it("shows the new photo once it's saved", async () => {
    const saved = { ...ada, image: SAVED };
    vi.mocked(getUsersList).mockResolvedValueOnce([ada]).mockResolvedValue([saved]);
    vi.mocked(uploadProfileImage).mockResolvedValue(saved);
    const Host = () => {
      const { data } = useMembers();
      return data ? <ProfileImageField user={data[0]} /> : null;
    };
    renderRoutes("/", <Route path="/" element={<Host />} />);
    await screen.findByText("AR");

    pick(photo());
    await screen.findByText("Photo saved.");
    expect(shownImage()).toBe(SAVED);
    expect(revokeObjectURL).toHaveBeenCalledWith("blob:preview");
  });

  it("rejects a file of the wrong type without uploading it", () => {
    renderField();
    pick(photo("image/gif"));
    expect(screen.getByRole("alert").textContent).toBe(
      "Photos have to be JPEG, PNG or WebP",
    );
    expect(uploadProfileImage).not.toHaveBeenCalled();
  });

  it("rejects a file over the size limit without uploading it", () => {
    renderField();
    pick(photo("image/jpeg", MAX_PROFILE_IMAGE_BYTES + 1));
    expect(screen.getByRole("alert").textContent).toBe("Photos can be up to 10 MB");
    expect(uploadProfileImage).not.toHaveBeenCalled();
  });

  it("removes the photo", async () => {
    vi.mocked(removeProfileImage).mockResolvedValue(ada);
    renderField({ ...ada, image: SAVED });
    fireEvent.click(screen.getByRole("button", { name: "Remove photo" }));
    expect(await screen.findByText("Photo removed.")).toBeTruthy();
    expect(removeProfileImage).toHaveBeenCalledOnce();
  });

  it("doesn't offer to remove a photo that isn't there", () => {
    renderField();
    expect(screen.queryByRole("button", { name: "Remove photo" })).toBeNull();
  });

  it("shows the error if the upload fails, and goes back to the old photo", async () => {
    vi.mocked(uploadProfileImage).mockRejectedValue(
      new Error("That file isn't an image we can read"),
    );
    renderField({ ...ada, image: SAVED });
    pick(photo());
    expect((await screen.findByRole("alert")).textContent).toBe(
      "That file isn't an image we can read",
    );
    expect(shownImage()).toBe(SAVED);
  });
});
