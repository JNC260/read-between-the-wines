export const getUsersList = async () => {
  const url = `/api/users`;
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error("Failed to fetch user list");
  }
  return await response.json();
};
