import { useNavigate, useSearchParams } from "react-router-dom";
import { type PollDTO } from "shared";
import MeetingForm from "../components/MeetingForm";
import { useCreateMeeting, usePoll } from "../hooks";

// A closed poll's books that aren't on a meeting yet, most votes first.
const unassignedResults = (poll: PollDTO) => {
  const byId = new Map(poll.books.map((b) => [b.id, b]));
  return (poll.results ?? []).flatMap(({ bookId }) => {
    const book = byId.get(bookId);
    return book && book.meetingId === null ? [book] : [];
  });
};

// Admin-only (see the route in app.tsx). Opened from a poll's results with
// ?poll=<id>&book=<id>, the book choices are that poll's results, and saving
// goes back to the poll.
const NewMeetingPage = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const pollId = searchParams.get("poll");
  const poll = usePoll(pollId ?? "", { enabled: !!pollId });
  const { mutate, isPending, error } = useCreateMeeting();

  if (pollId && poll.isPending) {
    return <p>Loading...</p>;
  }
  // A poll that won't load (deleted, or a bad link) just means the usual
  // choice of every suggestion.
  const fromPoll = pollId && poll.data && !poll.data.isOpen ? poll.data : null;
  const choices = fromPoll ? unassignedResults(fromPoll) : undefined;
  const wanted = searchParams.get("book");
  const initialBookId = choices?.find((b) => b.id === wanted)?.id ?? choices?.[0]?.id;

  return (
    <div>
      <h1>New meeting</h1>
      <MeetingForm
        bookChoices={choices}
        initialBookId={initialBookId}
        onSubmit={(values) =>
          mutate(values, {
            onSuccess: () => navigate(fromPoll ? `/polls/${fromPoll.id}` : "/meetings"),
          })
        }
        isPending={isPending}
        error={error}
        submitLabel="Create meeting"
        pendingLabel="Creating..."
      />
    </div>
  );
};

export default NewMeetingPage;
