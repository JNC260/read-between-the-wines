import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  getInvite,
  getUsersList,
  reactivateAccount,
  requestPasswordReset,
  resetPassword,
  signIn,
  signOut,
  signUpWithInvite,
} from "../api";

export const useGetAllUsers = () => {
  return useQuery({
    queryKey: ["users"],
    queryFn: getUsersList,
  });
};

export const useInvite = (token: string) => {
  return useQuery({
    queryKey: ["invite", token],
    queryFn: () => getInvite(token),
  });
};

export const useSignIn = () => {
  return useMutation({ mutationFn: signIn });
};

export const useSignOut = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: signOut,
    // Drop the previous member's cached data so the next one can't see it.
    onSuccess: () => queryClient.clear(),
  });
};

export const useSignUpWithInvite = () => {
  return useMutation({ mutationFn: signUpWithInvite });
};

export const useRequestPasswordReset = () => {
  return useMutation({ mutationFn: requestPasswordReset });
};

export const useResetPassword = () => {
  return useMutation({ mutationFn: resetPassword });
};

export const useReactivateAccount = () => {
  return useMutation({ mutationFn: reactivateAccount });
};
