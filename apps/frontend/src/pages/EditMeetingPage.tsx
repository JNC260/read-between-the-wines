import { useNavigate, useParams } from "react-router-dom";
import MeetingForm from "../components/MeetingForm";
import { useMeeting, useUpdateMeeting } from "../hooks";

// Admin-only (see the route in app.tsx). Linked from each meeting on /meetings.
const EditMeetingPage = () => {
  const { id = "" } = useParams();
  const navigate = useNavigate();
  const meeting = useMeeting(id);
  const { mutate, isPending, error } = useUpdateMeeting();

  if (meeting.isPending) {
    return <p>Loading...</p>;
  }
  if (meeting.isError) {
    return <p role="alert">{meeting.error.message}</p>;
  }

  return (
    <div>
      <h1>Edit meeting</h1>
      <MeetingForm
        meeting={meeting.data}
        onSubmit={(values) =>
          mutate({ id, ...values }, { onSuccess: () => navigate("/meetings") })
        }
        isPending={isPending}
        error={error}
        submitLabel="Save changes"
        pendingLabel="Saving..."
      />
    </div>
  );
};

export default EditMeetingPage;
