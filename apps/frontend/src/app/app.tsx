// Uncomment this line to use CSS modules
// import styles from './app.module.css';

import { Suspense } from "react";
import { Navigate, Route, Routes, useLocation } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ApiError } from "../api";
import RequireAuth from "../components/RequireAuth";
import PageErrorBoundary from "../components/PageErrorBoundary";
import SiteHeader from "../components/SiteHeader";
import { lazyPage } from "../lib/lazy-page";
import LandingPage from "../pages/LandingPage";
import LoginPage from "../pages/LoginPage";

// Every page but the two a visitor lands on first is fetched when it's
// first opened, so the site's first load stays small. lazyPage copes with a
// deploy happening while a tab is open.
const EditBookPage = lazyPage(() => import("../pages/EditBookPage"));
const EditMeetingPage = lazyPage(() => import("../pages/EditMeetingPage"));
const EditPollPage = lazyPage(() => import("../pages/EditPollPage"));
const MeetingsPage = lazyPage(() => import("../pages/MeetingsPage"));
const ForgotPasswordPage = lazyPage(
  () => import("../pages/ForgotPasswordPage"),
);
const InviteMemberPage = lazyPage(() => import("../pages/InviteMemberPage"));
const InvitePage = lazyPage(() => import("../pages/InvitePage"));
const LegacyMembersPage = lazyPage(() => import("../pages/LegacyMembersPage"));
const ManageMembersPage = lazyPage(() => import("../pages/ManageMembersPage"));
const MeetingPage = lazyPage(() => import("../pages/MeetingPage"));
const MembersPage = lazyPage(() => import("../pages/MembersPage"));
const NewMeetingPage = lazyPage(() => import("../pages/NewMeetingPage"));
const NewPollPage = lazyPage(() => import("../pages/NewPollPage"));
const PollPage = lazyPage(() => import("../pages/PollPage"));
const ProfilePage = lazyPage(() => import("../pages/ProfilePage"));
const ReactivatePage = lazyPage(() => import("../pages/ReactivatePage"));
const ReadBooksPage = lazyPage(() => import("../pages/ReadBooksPage"));
const ResetPasswordPage = lazyPage(() => import("../pages/ResetPasswordPage"));
const SuggestBookPage = lazyPage(() => import("../pages/SuggestBookPage"));
const SuggestionsPage = lazyPage(() => import("../pages/SuggestionsPage"));
const UnsubscribePage = lazyPage(() => import("../pages/UnsubscribePage"));

// A 4xx (not found, signed out, forbidden) won't change on a retry, so show
// it right away. Server and network errors still get React Query's default
// three retries.
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: (failureCount, error) =>
        !(error instanceof ApiError && error.status < 500) && failureCount < 3,
    },
  },
});

// Meetings used to live at /events. Old links (bookmarks, texts) still land
// on the same page.
const OldEventsLink = () => {
  const { pathname, search } = useLocation();
  return (
    <Navigate
      to={pathname.replace(/^\/events/, "/meetings") + search}
      replace
    />
  );
};

export function App() {
  const { pathname } = useLocation();
  return (
    <QueryClientProvider client={queryClient}>
      <SiteHeader />
      <main className="page">
        <PageErrorBoundary resetKey={pathname}>
          <Suspense fallback={<p className="muted">Loading...</p>}>
            <Routes>
              <Route path="/" element={<LandingPage />} />
              <Route path="/login" element={<LoginPage />} />
              <Route path="/forgot-password" element={<ForgotPasswordPage />} />
              <Route path="/reset-password" element={<ResetPasswordPage />} />
              <Route path="/invite/:token" element={<InvitePage />} />
              <Route path="/reactivate" element={<ReactivatePage />} />
              {/* Public: the link in an email works signed out. */}
              <Route path="/unsubscribe" element={<UnsubscribePage />} />
              <Route
                path="/members"
                element={
                  <RequireAuth>
                    <MembersPage />
                  </RequireAuth>
                }
              />
              <Route
                path="/members/manage"
                element={
                  <RequireAuth admin>
                    <ManageMembersPage />
                  </RequireAuth>
                }
              />
              <Route
                path="/members/legacy"
                element={
                  <RequireAuth admin>
                    <LegacyMembersPage />
                  </RequireAuth>
                }
              />
              <Route
                path="/profile"
                element={
                  <RequireAuth>
                    <ProfilePage />
                  </RequireAuth>
                }
              />
              <Route
                path="/invite-member"
                element={
                  <RequireAuth>
                    <InviteMemberPage />
                  </RequireAuth>
                }
              />
              <Route path="/events/*" element={<OldEventsLink />} />
              <Route
                path="/meetings"
                element={
                  <RequireAuth>
                    <MeetingsPage />
                  </RequireAuth>
                }
              />
              <Route
                path="/meetings/new"
                element={
                  <RequireAuth admin>
                    <NewMeetingPage />
                  </RequireAuth>
                }
              />
              <Route
                path="/meetings/:id"
                element={
                  <RequireAuth>
                    <MeetingPage />
                  </RequireAuth>
                }
              />
              <Route
                path="/meetings/:id/edit"
                element={
                  <RequireAuth admin>
                    <EditMeetingPage />
                  </RequireAuth>
                }
              />
              <Route
                path="/books/suggest"
                element={
                  <RequireAuth>
                    <SuggestBookPage />
                  </RequireAuth>
                }
              />
              <Route
                path="/books/suggestions"
                element={
                  <RequireAuth>
                    <SuggestionsPage />
                  </RequireAuth>
                }
              />
              <Route
                path="/polls/new"
                element={
                  <RequireAuth admin>
                    <NewPollPage />
                  </RequireAuth>
                }
              />
              <Route
                path="/polls/:id/edit"
                element={
                  <RequireAuth admin>
                    <EditPollPage />
                  </RequireAuth>
                }
              />
              <Route
                path="/polls/:id"
                element={
                  <RequireAuth>
                    <PollPage />
                  </RequireAuth>
                }
              />
              <Route
                path="/books/read"
                element={
                  <RequireAuth>
                    <ReadBooksPage />
                  </RequireAuth>
                }
              />
              {/* Not admin-only: suggesters can edit their own. The page and
              the API check which books. */}
              <Route
                path="/books/:id/edit"
                element={
                  <RequireAuth>
                    <EditBookPage />
                  </RequireAuth>
                }
              />
            </Routes>
          </Suspense>
        </PageErrorBoundary>
      </main>
    </QueryClientProvider>
  );
}

export default App;
