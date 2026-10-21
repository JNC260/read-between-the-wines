import { useNavigate } from "react-router-dom";
import EventForm from "../components/EventForm";
import { useCreateMeeting } from "../hooks";

// Admin-only (see the route in app.tsx). Events are meetings in the API.
const NewEventPage = () => {
  const navigate = useNavigate();
  const { mutate, isPending, error } = useCreateMeeting();

  return (
    <div>
      <h1>New event</h1>
      <EventForm
        onSubmit={(values) =>
          mutate(values, { onSuccess: () => navigate("/events") })
        }
        isPending={isPending}
        error={error}
        submitLabel="Create event"
        pendingLabel="Creating..."
      />
    </div>
  );
};

export default NewEventPage;
