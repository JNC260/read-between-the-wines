import { Link, useSearchParams } from "react-router-dom";
import { NOTIFICATION_LABELS, UnsubscribeQuerySchema } from "shared";
import { useUnsubscribe } from "../hooks";

// Where an email's "Stop emails about…" link lands. Works signed out. It
// asks for a click rather than unsubscribing on load, because mail security
// scanners open links in emails before people do.
const UnsubscribePage = () => {
  const [searchParams] = useSearchParams();
  const query = UnsubscribeQuerySchema.safeParse(Object.fromEntries(searchParams));
  const { mutate, isPending, isSuccess, error } = useUnsubscribe();

  if (!query.success) {
    return (
      <div className="unsubscribe-page">
        <h1>Unsubscribe</h1>
        <p role="alert">This unsubscribe link isn't complete. Try the link in the email again.</p>
      </div>
    );
  }

  const what =
    query.data.k === "ALL"
      ? "any notification emails"
      : `emails for “${NOTIFICATION_LABELS[query.data.k]}”`;

  return (
    <div className="unsubscribe-page">
      <h1>Unsubscribe</h1>
      {isSuccess ? (
        <>
          <p role="status">Done. You won't get {what} anymore.</p>
          <p>
            You can turn them back on any time in your{" "}
            <Link to="/profile">email settings</Link>.
          </p>
        </>
      ) : (
        <>
          <p>Stop getting {what} from Read Between the Wines?</p>
          {error && <p role="alert">{error.message}</p>}
          <button
            type="button"
            className="button-primary"
            disabled={isPending}
            onClick={() => mutate(query.data)}
          >
            {isPending ? "Unsubscribing..." : "Unsubscribe"}
          </button>
          <p className="muted">
            Or choose exactly which emails you get in your{" "}
            <Link to="/profile">email settings</Link>.
          </p>
        </>
      )}
    </div>
  );
};

export default UnsubscribePage;
