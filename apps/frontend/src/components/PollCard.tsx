import { Link } from "react-router-dom";
import { type PollDTO } from "shared";

const closesOn = new Intl.DateTimeFormat(undefined, {
  month: "short",
  day: "numeric",
});

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;

// The open poll's ballot. Counts stay hidden until it closes, so this only
// marks the member's own picks. The button link covers the whole card.
const PollCard = ({ poll }: { poll: PollDTO }) => {
  const voted = poll.myVotes.length > 0;
  return (
    <section className="card poll-card" aria-labelledby="poll-card-title">
      <p className="eyebrow">Open poll · closes {closesOn.format(poll.closesAt)}</p>
      <h2 id="poll-card-title">{poll.theme ?? "What should we read next?"}</h2>
      <ul className="ballot">
        {poll.books.map((book) => {
          const mine = poll.myVotes.includes(book.id);
          return (
            <li key={book.id} className={mine ? "ballot-mine" : undefined}>
              <span className="ballot-title">{book.title}</span>
              <span className="ballot-author">{book.author}</span>
              {mine && <span className="ballot-tag">Your vote</span>}
            </li>
          );
        })}
      </ul>
      <div className="card-foot">
        <span className="muted">
          {plural(poll.voterCount, "member")} voted · {plural(poll.votesPerMember, "vote")}{" "}
          each
        </span>
        <Link to={`/polls/${poll.id}`} className="button-link stretched-link">
          {voted ? "Change your votes" : "Vote now"}
        </Link>
      </div>
    </section>
  );
};

// "Circe", "Circe and Piranesi", "Circe, Piranesi and Beloved"
const joinTitles = (titles: string[]) =>
  titles.length < 2
    ? titles.join("")
    : `${titles.slice(0, -1).join(", ")} and ${titles.at(-1)}`;

// A closed poll's outcome, until its books are on meetings. Admins get a
// nudge to assign the winner; members just see who won.
export const PollResultsCard = ({
  poll,
  isAdmin,
}: {
  poll: PollDTO;
  isAdmin: boolean;
}) => {
  const results = poll.results ?? [];
  const most = Math.max(0, ...results.map((r) => r.votes));
  const winners = poll.books.filter((b) =>
    results.some((r) => r.bookId === b.id && r.votes === most),
  );
  const headline =
    most === 0
      ? "Nobody voted this time."
      : `${joinTitles(winners.map((b) => b.title))} ${
          winners.length === 1 ? "won" : "tied"
        } with ${plural(most, "vote")}.`;

  return (
    <section className="card poll-card" aria-labelledby="poll-card-title">
      <p className="eyebrow">Poll closed · {closesOn.format(poll.closesAt)}</p>
      <h2 id="poll-card-title">{poll.theme ?? "The votes are in"}</h2>
      <p>{headline}</p>
      <div className="card-foot">
        <span className="muted">{plural(poll.voterCount, "member")} voted</span>
        <Link to={`/polls/${poll.id}`} className="button-link stretched-link">
          {isAdmin ? "Assign to a meeting" : "See the results"}
        </Link>
      </div>
    </section>
  );
};

export default PollCard;
