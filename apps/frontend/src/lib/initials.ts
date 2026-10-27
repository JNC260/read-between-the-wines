// "AL" for Ada Lovelace. lastName is optional for test sessions that leave it out.
export const initials = (member: { firstName: string; lastName?: string }) =>
  `${member.firstName.charAt(0)}${member.lastName?.charAt(0) ?? ""}`;
