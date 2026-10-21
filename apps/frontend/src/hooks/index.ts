import { useMutation, useQuery } from "@tanstack/react-query";
import { getUsersList, resetPassword } from "../api";

export const useGetAllUsers = () => {
  return useQuery({
    queryKey: ["users"],
    queryFn: getUsersList,
  });
};

export const useResetPassword = () => {
  return useMutation({ mutationFn: resetPassword });
};
