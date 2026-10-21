import { useNavigate, useParams } from "react-router-dom";
import EventForm from "../components/EventForm";
import { useMeeting, useUpdateMeeting } from "../hooks";

// Admin-only (see the route in app.tsx). Linked from each event on /events.
const EditEventPage = () => {
  const { id = "" } = useParams();
  const navigate = useNavigate();
  const event = useMeeting(id);
  const { mutate, isPending, error } = useUpdateMeeting();

  if (event.isPending) {
    return <p>Loading...</p>;
  }
  if (event.isError) {
    return <p role="alert">{event.error.message}</p>;
  }

  return (
    <div>
      <h1>Edit event</h1>
      <EventForm
        event={event.data}
        onSubmit={(values) =>
          mutate({ id, ...values }, { onSuccess: () => navigate("/events") })
        }
        isPending={isPending}
        error={error}
        submitLabel="Save changes"
        pendingLabel="Saving..."
      />
    </div>
  );
};

export default EditEventPage;
