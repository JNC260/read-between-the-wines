import { fireEvent, render } from "@testing-library/react";
import { avatarColor } from "../lib/avatar-color";
import Avatar from "./Avatar";

const ada = {
  id: "00000000-0000-4000-8000-000000000001",
  firstName: "Ada",
  lastName: "Lovelace",
  image: null,
};
const PHOTO = "/api/uploads/00000000-0000-4000-8000-000000000002.webp";

const shown = (ui: React.ReactElement) => render(ui).container.firstElementChild as Element;

describe("Avatar", () => {
  it("shows initials on the member's own color without a photo", () => {
    const circle = shown(<Avatar member={ada} />);
    expect(circle.textContent).toBe("AL");
    expect(circle.className).toBe(`avatar avatar-color-${avatarColor(ada.id)}`);
  });

  it("keeps a member's color at every size", () => {
    const color = `avatar-color-${avatarColor(ada.id)}`;
    for (const size of ["small", "medium", "large"] as const) {
      expect(shown(<Avatar member={ada} size={size} />).classList).toContain(color);
    }
  });

  it("shows the photo when there is one, even in the small circles", () => {
    const circle = shown(<Avatar member={{ ...ada, image: PHOTO }} size="small" />);
    expect(circle.tagName).toBe("IMG");
    expect(circle.getAttribute("src")).toBe(PHOTO);
    expect(circle.className).toBe("face");
  });

  it("prefers src over the saved photo, for previews", () => {
    const circle = shown(
      <Avatar member={{ ...ada, image: PHOTO }} size="large" src="blob:preview" />,
    );
    expect(circle.getAttribute("src")).toBe("blob:preview");
    expect(circle.className).toBe("avatar avatar-large");
  });

  it("adds extra classes, like the header's", () => {
    const circle = shown(<Avatar member={ada} size="small" className="face-me" />);
    expect(circle.classList).toContain("face-me");
  });

  it("falls back to initials when the photo won't load", () => {
    const { container } = render(
      <Avatar member={{ id: "00000000-0000-4000-8000-000000000001", firstName: "Ada", lastName: "Lovelace", image: "/api/uploads/gone.webp" }} />,
    );
    fireEvent.error(container.querySelector("img") as HTMLImageElement);
    expect(container.querySelector("img")).toBeNull();
    expect(container.textContent).toBe("AL");
  });
});
