import { type ComponentType, lazy } from "react";

const RELOADED_KEY = "reloaded-for-new-version";

// React.lazy for pages, for the one way they fail in practice: the site was
// deployed while this tab was open, so the page's old file is gone. The fix
// is to load the new version, so this reloads once. If the reload doesn't
// help either, the error goes on to the PageErrorBoundary.
export const lazyPage = <T extends ComponentType>(load: () => Promise<{ default: T }>) =>
  lazy(async () => {
    try {
      const page = await load();
      sessionStorage.removeItem(RELOADED_KEY);
      return page;
    } catch (error) {
      if (!sessionStorage.getItem(RELOADED_KEY)) {
        sessionStorage.setItem(RELOADED_KEY, "1");
        window.location.reload();
        // Never resolves: the page is going away.
        return new Promise<{ default: T }>(() => undefined);
      }
      throw error;
    }
  });
