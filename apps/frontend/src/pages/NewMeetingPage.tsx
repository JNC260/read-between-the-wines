import { useNavigate } from "react-router-dom";
import MeetingForm from "../components/MeetingForm";
import { useCreateMeeting } from "../hooks";

// Admin-only (see the route in app.tsx).
const NewMeetingPage = () => {
  const navigate = useNavigate();
  const { mutate, isPending, error } = useCreateMeeting();

  return (
    <div>
      <h1>New meeting</h1>
      <MeetingForm
        onSubmit={(values) =>
          mutate(values, { onSuccess: () => navigate("/meetings") })
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
