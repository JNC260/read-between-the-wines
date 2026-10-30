import { render, screen } from "@testing-library/react";
import { Suspense } from "react";
import PageErrorBoundary from "../components/PageErrorBoundary";
import { lazyPage } from "./lazy-page";

const reload = vi.fn();

beforeEach(() => {
  sessionStorage.clear();
  reload.mockReset();
  vi.spyOn(console, "error").mockImplementation(() => undefined);
  Object.defineProperty(window, "location", {
    configurable: true,
    value: { ...window.location, reload },
  });
});

const show = (Page: ReturnType<typeof lazyPage>) =>
  render(
    <PageErrorBoundary resetKey="/somewhere">
      <Suspense fallback={<p>Loading...</p>}>
        <Page />
      </Suspense>
    </PageErrorBoundary>,
  );

const gone = () => Promise.reject(new TypeError("Failed to fetch dynamically imported module"));

describe("lazyPage", () => {
  it("loads the page as usual", async () => {
    show(lazyPage(async () => ({ default: () => <h1>Members</h1> })));
    expect(await screen.findByRole("heading", { name: "Members" })).toBeTruthy();
    expect(reload).not.toHaveBeenCalled();
  });

  it("reloads once when the page's file is gone after a deploy", async () => {
    show(lazyPage(gone));
    await vi.waitFor(() => expect(reload).toHaveBeenCalledOnce());
    // Still loading, not an error, while the reload happens.
    expect(screen.getByText("Loading...")).toBeTruthy();
  });

  it("shows a way forward if reloading didn't help", async () => {
    sessionStorage.setItem("reloaded-for-new-version", "1");
    show(lazyPage(gone));
    expect((await screen.findByRole("alert")).textContent).toMatch(/This page didn't load/);
    expect(screen.getByRole("button", { name: "Reload" })).toBeTruthy();
    expect(reload).not.toHaveBeenCalled();
  });
});
