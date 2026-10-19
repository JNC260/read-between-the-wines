import { useQuery } from "@tanstack/react-query";
import { getUsersList } from "../api";

export const useGetAllUsers = () => {
  return useQuery({
    queryKey: ["users"],
    queryFn: getUsersList,
  });
};
