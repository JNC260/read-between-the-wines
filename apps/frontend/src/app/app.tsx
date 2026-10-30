// Uncomment this line to use CSS modules
// import styles from './app.module.css';

import { Navigate, Route, Routes, useLocation } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ApiError } from "../api";
import RequireAuth from "../components/RequireAuth";
import SiteHeader from "../components/SiteHeader";
import EditBookPage from "../pages/EditBookPage";
import EditMeetingPage from "../pages/EditMeetingPage";
import MeetingsPage from "../pages/MeetingsPage";
import ForgotPasswordPage from "../pages/ForgotPasswordPage";
import InviteMemberPage from "../pages/InviteMemberPage";
import InvitePage from "../pages/InvitePage";
import LandingPage from "../pages/LandingPage";
import LegacyMembersPage from "../pages/LegacyMembersPage";
import LoginPage from "../pages/LoginPage";
import MeetingPage from "../pages/MeetingPage";
import MembersPage from "../pages/MembersPage";
import NewMeetingPage from "../pages/NewMeetingPage";
import NewPollPage from "../pages/NewPollPage";
import PollPage from "../pages/PollPage";
import ProfilePage from "../pages/ProfilePage";
import ReactivatePage from "../pages/ReactivatePage";
import ReadBooksPage from "../pages/ReadBooksPage";
import ResetPasswordPage from "../pages/ResetPasswordPage";
import SuggestBookPage from "../pages/SuggestBookPage";
import SuggestionsPage from "../pages/SuggestionsPage";

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
  return <Navigate to={pathname.replace(/^\/events/, "/meetings") + search} replace />;
};

export function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <SiteHeader />
      <main className="page">
        <Routes>
          <Route path="/" element={<LandingPage />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/forgot-password" element={<ForgotPasswordPage />} />
          <Route path="/reset-password" element={<ResetPasswordPage />} />
          <Route path="/invite/:token" element={<InvitePage />} />
          <Route path="/reactivate" element={<ReactivatePage />} />
          <Route
            path="/members"
            element={
              <RequireAuth>
                <MembersPage />
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
      </main>
    </QueryClientProvider>
  );
}

export default App;
