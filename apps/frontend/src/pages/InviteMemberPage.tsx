import { useState } from "react";
import { useCreateInvite } from "../hooks";

// Opens the native share sheet where there is one (mostly phones), and
// copies the link everywhere else.
const ShareLinkButton = ({ url }: { url: string }) => {
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
    } catch {
      setError("Couldn't copy the link. Select it above and copy it instead.");
    }
  };

  const handleClick = async () => {
    setError(null);
    if (typeof navigator.share === "function") {
      try {
        await navigator.share({
          title: "Read Between the Wines",
          text: "You're invited to join our book club!",
          url,
        });
        return;
      } catch (err) {
        // AbortError means they closed the share sheet; nothing to do.
        if (err instanceof DOMException && err.name === "AbortError") {
          return;
        }
        // Sharing can be blocked (e.g. some desktop browsers), so copy instead.
      }
    }
    await copy();
  };

  return (
    <>
      <button type="button" onClick={handleClick}>
        {copied ? "Copied!" : "Share"}
      </button>
      {error && <p role="alert">{error}</p>}
    </>
  );
};

const InviteMemberPage = () => {
  const { mutate, isPending, data: invite, error, reset } = useCreateInvite();

  if (invite) {
    return (
      <div>
        <h1>Your invite link</h1>
        <p>
          Send this to the person you're inviting. It works once and expires in
          7 days, so don't post it anywhere public.
        </p>
        <div>
          <label htmlFor="invite-link">Invite link</label>
          <input
            id="invite-link"
            readOnly
            value={invite.url}
            onFocus={(e) => e.target.select()}
          />
        </div>
        <ShareLinkButton url={invite.url} />
        <button type="button" onClick={() => reset()}>
          Invite someone else
        </button>
      </div>
    );
  }

  return (
    <div>
      <h1>Invite a member</h1>
      <p>
        Make a link to text or send to someone. They'll use it to create an
        account with their own email.
      </p>
      {error && <p role="alert">{error.message}</p>}
      <button type="button" disabled={isPending} onClick={() => mutate()}>
        {isPending ? "Creating..." : "Create invite link"}
      </button>
    </div>
  );
};

export default InviteMemberPage;
