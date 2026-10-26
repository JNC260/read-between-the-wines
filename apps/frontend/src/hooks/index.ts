import { useEffect, useState } from "react";
import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { type MeetingListQuery, type VenueDTO } from "shared";
import {
  createBookSuggestion,
  createInvite,
  createMeeting,
  createVenue,
  getBookSuggestions,
  getMeeting,
  getMeetings,
  getReadBooks,
  getVenue,
  getVenues,
  getInvite,
  getUsersList,
  reactivateAccount,
  requestPasswordReset,
  resetPassword,
  searchBooks,
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

export const useCreateInvite = () => {
  return useMutation({ mutationFn: createInvite });
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

// A meeting's book moves it from the suggestions list to the read list, so
// book lists go stale too.
export const useCreateMeeting = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: createMeeting,
    onSuccess: () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: ["meetings"] }),
        queryClient.invalidateQueries({ queryKey: ["books"] }),
      ]),
  });
};

export const useUpdateMeeting = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: updateMeeting,
    onSuccess: () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: ["meetings"] }),
        queryClient.invalidateQueries({ queryKey: ["books"] }),
      ]),
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

// Adds the new venue to the cached list straight away, so a dropdown can
// select it before the refetch lands. Sorted by name like the API's list.
export const useCreateVenue = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: createVenue,
    onSuccess: (venue) => {
      queryClient.setQueryData<VenueDTO[]>(["venues"], (venues) =>
        venues
          ? [...venues, venue].sort((a, b) => a.name.localeCompare(b.name))
          : venues,
      );
      return queryClient.invalidateQueries({ queryKey: ["venues"] });
    },
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

// The value, once it has stopped changing for `ms`. For search-as-you-type,
// so each keystroke doesn't send a request.
export const useDebouncedValue = <T>(value: T, ms: number): T => {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), ms);
    return () => clearTimeout(timer);
  }, [value, ms]);
  return debounced;
};

// Pass "" to search for nothing. Keeps showing the previous results while
// the next search loads, so the list doesn't flash empty between keystrokes.
export const useBookSearch = (q: string) => {
  return useQuery({
    queryKey: ["books", "search", q],
    queryFn: () => searchBooks(q),
    enabled: q !== "",
    placeholderData: keepPreviousData,
  });
};

export const useBookSuggestions = () => {
  return useQuery({
    queryKey: ["books", "suggestions"],
    queryFn: getBookSuggestions,
  });
};

export const useReadBooks = () => {
  return useQuery({
    queryKey: ["books", "read"],
    queryFn: getReadBooks,
  });
};

// Refreshes the suggestions list, and searches, which carry "already
// suggested" flags.
export const useCreateBookSuggestion = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: createBookSuggestion,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["books"] }),
  });
};
