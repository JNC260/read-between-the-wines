// What stands at the end of each shelf on the read books page. Purely
// decorative, so hidden from screen readers.
export const BOOKEND_KINDS = ["red-wine", "plant", "white-wine", "candle"] as const;

export type BookendKind = (typeof BOOKEND_KINDS)[number];

const Bookend = ({ kind }: { kind: BookendKind }) => {
  switch (kind) {
    case "red-wine":
      return (
        <svg className="bookend" width="38" height="128" viewBox="0 0 38 128" aria-hidden="true">
          <path
            d="M14 0h10v32c0 7 12 11 12 24v64a8 8 0 0 1-8 8H10a8 8 0 0 1-8-8V56c0-13 12-17 12-24z"
            fill="#6B2D5C"
          />
          <rect x="6" y="70" width="26" height="30" rx="3" fill="#F3E3C3" />
          <rect x="11" y="78" width="16" height="3" rx="1.5" fill="#C81D6B" />
          <rect x="13" y="0" width="12" height="8" rx="2" fill="#C81D6B" />
        </svg>
      );
    case "plant":
      return (
        <svg className="bookend" width="72" height="116" viewBox="0 0 72 116" aria-hidden="true">
          <path d="M36 70V30" stroke="#2E5E4E" strokeWidth="3" />
          <ellipse cx="36" cy="26" rx="8" ry="24" fill="#2E5E4E" />
          <ellipse cx="21" cy="44" rx="7" ry="20" transform="rotate(-34 21 44)" fill="#3F7A64" />
          <ellipse cx="51" cy="44" rx="7" ry="20" transform="rotate(34 51 44)" fill="#3F7A64" />
          <ellipse cx="14" cy="62" rx="5" ry="13" transform="rotate(-62 14 62)" fill="#2E5E4E" />
          <ellipse cx="58" cy="62" rx="5" ry="13" transform="rotate(62 58 62)" fill="#2E5E4E" />
          <rect x="12" y="70" width="48" height="10" rx="3" fill="#C65A3A" />
          <path d="M16 80h40l-6 36H22z" fill="#B24E30" />
          <path d="M24 92h24" stroke="#F29E38" strokeWidth="3" strokeLinecap="round" />
        </svg>
      );
    case "white-wine":
      return (
        <svg className="bookend" width="74" height="140" viewBox="0 0 74 140" aria-hidden="true">
          <path
            d="M12 0h8v40c0 8 9 14 9 26v66a8 8 0 0 1-8 8H11a8 8 0 0 1-8-8V66c0-12 9-18 9-26z"
            fill="#E7D38E"
            stroke="#B9A35A"
            strokeWidth="1.5"
          />
          <rect x="6" y="84" width="20" height="26" rx="3" fill="#FFF6F7" />
          <rect x="11" y="0" width="10" height="10" rx="2" fill="#34507A" />
          <path
            d="M42 86h28c0 15-6 24-14 24s-14-9-14-24z"
            fill="#FFFFFF"
            stroke="#C9B9C6"
            strokeWidth="1.5"
          />
          <path d="M43.5 96h25c-1.5 8-6 12.5-12.5 12.5S45 104 43.5 96z" fill="#E7D38E" />
          <rect x="54.5" y="110" width="3" height="24" fill="#C9B9C6" />
          <ellipse cx="56" cy="136" rx="11" ry="3.5" fill="#C9B9C6" />
        </svg>
      );
    case "candle":
      return (
        <svg className="bookend" width="92" height="110" viewBox="0 0 92 110" aria-hidden="true">
          <rect x="2" y="86" width="88" height="24" rx="3" fill="#34507A" />
          <rect x="2" y="95" width="88" height="3" fill="#F3E3C3" />
          <rect x="8" y="66" width="76" height="20" rx="3" fill="#C81D6B" />
          <rect x="8" y="74" width="76" height="3" fill="#FFD3E2" />
          <rect x="34" y="30" width="22" height="36" rx="3" fill="#F3E3C3" />
          <path d="M45 30v-6" stroke="#241B3A" strokeWidth="2" />
          <path d="M45 4c6 8 7 13 0 19c-7-6-6-11 0-19z" fill="#F29E38" />
          <path d="M45 12c3 4 3 7 0 10c-3-3-3-6 0-10z" fill="#FFF6F7" />
        </svg>
      );
  }
};

export default Bookend;
