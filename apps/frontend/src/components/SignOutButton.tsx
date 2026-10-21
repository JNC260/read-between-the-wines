import { useNavigate } from "react-router-dom";
import { useSignOut } from "../hooks";

const SignOutButton = () => {
  const navigate = useNavigate();
  const { mutate, isPending } = useSignOut();

  return (
    <button
      type="button"
      disabled={isPending}
      onClick={() => mutate(undefined, { onSuccess: () => navigate("/") })}
    >
      Sign out
    </button>
  );
};

export default SignOutButton;
