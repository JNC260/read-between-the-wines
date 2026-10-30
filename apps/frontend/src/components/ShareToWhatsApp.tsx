import { useState } from "react";

// Opens WhatsApp (the app on a phone, WhatsApp Web or Desktop on a
// computer) with the message already written, so an admin picks the group
// chat and sends it. WhatsApp has no way for a site like this to post into
// an existing group by itself. WhatsApp Desktop sometimes drops the text and
// keeps only the link, so the message can be copied too.
const ShareToWhatsApp = ({ text, label = "Share to WhatsApp" }: { text: string; label?: string }) => {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <>
      <a
        href={`https://wa.me/?text=${encodeURIComponent(text)}`}
        target="_blank"
        rel="noreferrer"
        className="button-link button-quiet"
      >
        {label}
      </a>
      <button type="button" className="button-quiet" onClick={copy}>
        <span aria-live="polite">{copied ? "Copied!" : "Copy message"}</span>
      </button>
    </>
  );
};

export default ShareToWhatsApp;
