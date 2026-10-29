// An open book with a ribbon bookmark. Colors come from the theme, so it
// follows dark mode.
export const LogoMark = () => (
  <svg className="logo-mark" viewBox="0 0 32 32" aria-hidden="true">
    <path
      className="logo-mark-left"
      d="M3 8.5c4.5-2.4 8.8-2.2 12.5.8v17.2c-3.7-2.8-8-3-12.5-.9z"
    />
    <path
      className="logo-mark-right"
      d="M29 8.5c-4.5-2.4-8.8-2.2-12.5.8v17.2c3.7-2.8 8-3 12.5-.9z"
    />
    <path
      className="logo-mark-ribbon"
      d="M20.5 7.6v9.2l2.2-1.7 2.2 1.7V6.9c-1.5-.1-3 .1-4.4.7z"
    />
  </svg>
);

const Logo = () => (
  <span className="logo">
    <LogoMark />
    <span className="logo-word">
      Read Between <em>the</em> Wines
    </span>
  </span>
);

export default Logo;
