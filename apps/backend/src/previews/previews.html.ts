// Link preview cards (WhatsApp, iMessage, Slack) come from Open Graph tags in
// the page's HTML, and previewers don't run JavaScript. The site is one
// index.html for every address, so for meeting and poll links the server
// swaps that file's general tags for ones about the meeting or poll.

export type Preview = {
  title: string;
  description: string;
  url: string;
  // Absolute. Leave it out to keep the site's own card image.
  image?: string;
  imageAlt?: string;
};

const attr = (text: string) =>
  text
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");

// Replaces the content="…" of one <meta> tag, found by its property or name.
// Tags the page doesn't have are left alone.
const setMeta = (html: string, key: string, value: string) =>
  html.replace(
    new RegExp(`(<meta\\s+(?:property|name)="${key}"\\s+content=")[^"]*(")`),
    `$1${attr(value)}$2`,
  );

export const withPreview = (html: string, p: Preview) => {
  let out = html.replace(/<title>[^<]*<\/title>/, `<title>${attr(p.title)}</title>`);
  for (const key of ["og:title", "twitter:title"]) {
    out = setMeta(out, key, p.title);
  }
  for (const key of ["description", "og:description", "twitter:description"]) {
    out = setMeta(out, key, p.description);
  }
  out = setMeta(out, "og:url", p.url);
  if (p.image) {
    for (const key of ["og:image", "twitter:image"]) {
      out = setMeta(out, key, p.image);
    }
    for (const key of ["og:image:alt", "twitter:image:alt"]) {
      out = setMeta(out, key, p.imageAlt ?? p.title);
    }
    // The site's own image is 1200x630 PNG; a book cover isn't.
    out = out.replace(/\s*<meta\s+property="og:image:(?:width|height|type)"\s+content="[^"]*"\s*\/?>/g, "");
  }
  return out;
};
