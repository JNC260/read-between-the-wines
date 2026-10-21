import { createAuthClient } from "better-auth/react";
import { inferAdditionalFields } from "better-auth/client/plugins";
import { UserStatusSchema } from "shared";

// Talks to /api/auth on this origin, which Vite proxies to the backend.
// Use authClient.useSession() for the signed-in user.
export const authClient = createAuthClient({
  plugins: [
    // Mirrors user.additionalFields in apps/backend/src/lib/auth.ts so
    // session.user and signUp.email() know about them. Keep the two in sync.
    inferAdditionalFields({
      user: {
        firstName: { type: "string", required: true },
        lastName: { type: "string", required: true },
        status: {
          type: [...UserStatusSchema.options],
          required: false,
          input: false,
        },
        isAdmin: { type: "boolean", required: false, input: false },
      },
    }),
  ],
});
