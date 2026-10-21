import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { type MeetingListQuery } from "shared";
import {
  createMeeting,
  createVenue,
  getMeeting,
  getMeetings,
  getVenue,
  getVenues,
  getInvite,
  getUsersList,
  reactivateAccount,
  requestPasswordReset,
  resetPassword,
  signIn,
  signOut,
  signUpWithInvite,
  updateMeeting,
  updateVenue,
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

// Keys start with "meetings" or "venues" so invalidating that one word
// refetches every list and detail under it.
export const useMeetings = (when?: MeetingListQuery["when"]) => {
  return useQuery({
    queryKey: ["meetings", { when }],
    queryFn: () => getMeetings(when),
  });
};

export const useMeeting = (id: string) => {
  return useQuery({
    queryKey: ["meetings", id],
    queryFn: () => getMeeting(id),
  });
};

export const useCreateMeeting = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: createMeeting,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["meetings"] }),
  });
};

export const useUpdateMeeting = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: updateMeeting,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["meetings"] }),
  });
};

export const useVenues = () => {
  return useQuery({
    queryKey: ["venues"],
    queryFn: getVenues,
  });
};

export const useVenue = (id: string) => {
  return useQuery({
    queryKey: ["venues", id],
    queryFn: () => getVenue(id),
  });
};

export const useCreateVenue = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: createVenue,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["venues"] }),
  });
};

// Meetings include their venue, so those go stale too.
export const useUpdateVenue = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: updateVenue,
    onSuccess: () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: ["venues"] }),
        queryClient.invalidateQueries({ queryKey: ["meetings"] }),
      ]),
  });
};
