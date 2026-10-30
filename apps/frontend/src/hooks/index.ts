import { useEffect, useState } from "react";
import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import {
  type MeetingListQuery,
  type MeetingRsvpsDTO,
  type PollDTO,
  type UserDTO,
  type VenueDTO,
} from "shared";
import {
  castVotes,
  closePoll,
  createBookSuggestion,
  createManualBookSuggestion,
  createPoll,
  createInvite,
  createMeeting,
  createVenue,
  getBook,
  getBookSuggestions,
  getCurrentPoll,
  getLatestPoll,
  getMeeting,
  getMeetingRsvps,
  getMeetings,
  getPlaceholders,
  getPoll,
  getReadBooks,
  rateBook,
  getVenue,
  getVenues,
  getInvite,
  getUsersList,
  mergePlaceholder,
  reactivateAccount,
  requestPasswordReset,
  resetPassword,
  searchBooks,
  setRsvp,
  signIn,
  signOut,
  signUpWithInvite,
  removeProfileImage,
  updateBook,
  updateMeeting,
  updatePoll,
  updateProfile,
  updateVenue,
  uploadProfileImage,
} from "../api";
import { authClient } from "../lib/auth-client";

// Active members only, sorted by name.
export const useMembers = () => {
  return useQuery({
    queryKey: ["users"],
    queryFn: getUsersList,
  });
};

export const useUpdateProfile = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: updateProfile,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["users"] }),
  });
};

// The members page shows each photo, so the member list goes stale. The
// saved member goes straight into the cached list, so the new photo shows
// at once instead of after the refetch, and the session (which has its own
// copy of user.image) is refreshed too.
const usePhotoMutation = <T>(mutationFn: (input: T) => Promise<UserDTO>) => {
  const queryClient = useQueryClient();
  const { refetch } = authClient.useSession();
  return useMutation({
    mutationFn,
    onSuccess: (saved) => {
      queryClient.setQueryData<UserDTO[]>(["users"], (list) =>
        list?.map((u) => (u.id === saved.id ? saved : u)),
      );
      return Promise.all([
        queryClient.invalidateQueries({ queryKey: ["users"] }),
        refetch(),
      ]);
    },
  });
};

export const useUploadProfileImage = () => usePhotoMutation(uploadProfileImage);

export const useRemoveProfileImage = () =>
  usePhotoMutation((_: void) => removeProfileImage());

export const usePlaceholders = () => {
  return useQuery({
    queryKey: ["placeholders"],
    queryFn: getPlaceholders,
  });
};

// Books and meetings show who suggested, rated and RSVPed, so they change too.
export const useMergePlaceholder = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: mergePlaceholder,
    onSuccess: () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: ["placeholders"] }),
        queryClient.invalidateQueries({ queryKey: ["books"] }),
        queryClient.invalidateQueries({ queryKey: ["meetings"] }),
      ]),
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
    // Polls too: a new meeting can take a book from a poll's results.
    onSuccess: () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: ["meetings"] }),
        queryClient.invalidateQueries({ queryKey: ["books"] }),
        queryClient.invalidateQueries({ queryKey: ["polls"] }),
      ]),
  });
};

export const useUpdateMeeting = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: updateMeeting,
    // Polls too: their books say which meeting each one is on.
    onSuccess: () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: ["meetings"] }),
        queryClient.invalidateQueries({ queryKey: ["books"] }),
        queryClient.invalidateQueries({ queryKey: ["polls"] }),
      ]),
  });
};

// Under "meetings" too, so invalidating meetings refreshes RSVPs.
export const useMeetingRsvps = (meetingId: string) => {
  return useQuery({
    queryKey: ["meetings", meetingId, "rsvps"],
    queryFn: () => getMeetingRsvps(meetingId),
  });
};

// The response is the updated list, so it goes straight into the cache.
export const useSetRsvp = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: setRsvp,
    onSuccess: (rsvps, { meetingId }) =>
      queryClient.setQueryData<MeetingRsvpsDTO>(
        ["meetings", meetingId, "rsvps"],
        rsvps,
      ),
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

export const useBook = (id: string) => {
  return useQuery({
    queryKey: ["books", id],
    queryFn: () => getBook(id),
  });
};

// Books also show up inside meetings and poll ballots, so those refetch too.
export const useUpdateBook = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: updateBook,
    onSuccess: () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: ["books"] }),
        queryClient.invalidateQueries({ queryKey: ["meetings"] }),
        queryClient.invalidateQueries({ queryKey: ["polls"] }),
      ]),
  });
};

// The read list carries the averages, so it refetches after each rating.
export const useRateBook = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: rateBook,
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ["books", "read"] }),
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

// For a book the search can't find. Refreshes the same lists as above.
export const useCreateManualBookSuggestion = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: createManualBookSuggestion,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["books"] }),
  });
};

// Keys start with "polls": ["polls", "current"] and ["polls", id].
// Pass enabled: false while signed out, since the API would only say 401.
export const useCurrentPoll = ({ enabled = true } = {}) => {
  return useQuery({
    queryKey: ["polls", "current"],
    queryFn: getCurrentPoll,
    enabled,
  });
};

export const usePoll = (id: string, { enabled = true } = {}) => {
  return useQuery({
    queryKey: ["polls", id],
    queryFn: () => getPoll(id),
    enabled,
  });
};

export const useCreatePoll = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: createPoll,
    onSuccess: (poll) => {
      queryClient.setQueryData<PollDTO>(["polls", poll.id], poll);
      return queryClient.invalidateQueries({ queryKey: ["polls", "current"] });
    },
  });
};

// The landing page's poll: the ballot while it's open, the results after.
export const useLatestPoll = ({ enabled = true } = {}) => {
  return useQuery({
    queryKey: ["polls", "latest"],
    queryFn: getLatestPoll,
    enabled,
  });
};

// Editing or closing a poll changes what the landing and suggestions pages
// show, so every poll query refreshes; the poll page gets the response.
const usePollChange = <T,>(mutationFn: (input: T) => Promise<PollDTO>) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn,
    onSuccess: (poll) => {
      queryClient.setQueryData<PollDTO>(["polls", poll.id], poll);
      return queryClient.invalidateQueries({
        queryKey: ["polls"],
        predicate: (q) => q.queryKey[1] !== poll.id,
      });
    },
  });
};

export const useUpdatePoll = () => usePollChange(updatePoll);
export const useClosePoll = () => usePollChange(closePoll);

// The response is the updated poll, so the poll page updates without a
// refetch. The landing page's "you've voted" message reads the current poll.
export const useCastVotes = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: castVotes,
    onSuccess: (poll) => {
      queryClient.setQueryData<PollDTO>(["polls", poll.id], poll);
      return queryClient.invalidateQueries({ queryKey: ["polls", "current"] });
    },
  });
};
