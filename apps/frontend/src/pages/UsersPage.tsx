import { useGetAllUsers } from "../hooks";
const UsersPage = () => {
  const { data: users, isLoading } = useGetAllUsers();
  return (
    <div>
      {isLoading && <p>Loading...</p>}
      {!isLoading && (
        <div>
          {users?.map((user) => (
            <li key={user.id}>{user.email}</li>
          ))}
        </div>
      )}
    </div>
  );
};

export default UsersPage;
