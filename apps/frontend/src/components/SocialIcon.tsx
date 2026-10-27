import { useId } from "react";
import {
  type SimpleIcon,
  siFacebook,
  siGoodreads,
  siInstagram,
  siTiktok,
  siVenmo,
  siX,
} from "simple-icons";

export type SocialSite =
  | "instagram"
  | "tiktok"
  | "x"
  | "facebook"
  | "goodreads"
  | "venmo";

// The brands' own marks, from Simple Icons (CC0). One color: they take the
// text color, so they follow the theme instead of each brand's palette.
const ICONS: Record<SocialSite, SimpleIcon> = {
  instagram: siInstagram,
  tiktok: siTiktok,
  x: siX,
  facebook: siFacebook,
  goodreads: siGoodreads,
  venmo: siVenmo,
};

// Venmo's mark is a bare "V", which looks thin next to the others, so it
// sits cut out of a filled circle instead. The mask id is per instance, since
// two on one page would otherwise share the first one's mask.
const VenmoMark = () => {
  const mask = useId();
  return (
    <>
      <mask id={mask}>
        <circle cx="12" cy="12" r="12" fill="white" />
        <path
          d={siVenmo.path}
          fill="black"
          transform="translate(5.5 5.5) scale(0.54)"
        />
      </mask>
      <circle cx="12" cy="12" r="12" mask={`url(#${mask})`} />
    </>
  );
};

// Pass a label when the icon is the only thing naming the link.
const SocialIcon = ({ site, label }: { site: SocialSite; label?: string }) => (
  <svg
    className="social-icon"
    viewBox="0 0 24 24"
    {...(label
      ? { role: "img", "aria-label": label }
      : { "aria-hidden": true })}
  >
    {site === "venmo" ? <VenmoMark /> : <path d={ICONS[site].path} />}
  </svg>
);

export default SocialIcon;
