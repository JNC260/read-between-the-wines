import { NOTIFICATION_KINDS, NOTIFICATION_LABELS, type NotificationKind } from "shared";
import { useEmailSettings, useUpdateEmailSettings } from "../hooks";

// One switch per kind of notification email. Each change saves straight
// away; password and invite emails always send, so they aren't listed.
const EmailSettings = () => {
  const settings = useEmailSettings();
  const save = useUpdateEmailSettings();
  // While a change saves, show it as already made.
  const optOuts = save.isPending ? save.variables.emailOptOuts : settings.data?.emailOptOuts;

  const toggle = (kind: NotificationKind, on: boolean) => {
    const current = optOuts ?? [];
    save.mutate({
      emailOptOuts: on ? current.filter((k) => k !== kind) : [...current, kind],
    });
  };

  return (
    <section className="card email-settings" aria-labelledby="email-settings-title">
      <h2 id="email-settings-title">Email me when</h2>
      {settings.isPending && <p>Loading...</p>}
      {settings.error && <p role="alert">{settings.error.message}</p>}
      {optOuts && (
        <ul>
          {NOTIFICATION_KINDS.map((kind) => (
            <li key={kind}>
              <label>
                <input
                  type="checkbox"
                  checked={!optOuts.includes(kind)}
                  disabled={save.isPending}
                  onChange={(e) => toggle(kind, e.target.checked)}
                />
                {NOTIFICATION_LABELS[kind]}
              </label>
            </li>
          ))}
        </ul>
      )}
      {save.error && <p role="alert">{save.error.message}</p>}
      <p className="muted" aria-live="polite">
        {save.isSuccess ? "Saved." : "Changes save as you go."}
      </p>
    </section>
  );
};

export default EmailSettings;
