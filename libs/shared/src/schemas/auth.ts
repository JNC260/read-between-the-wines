import * as z from "zod";

// The sign-in, sign-up and password forms. Better Auth checks these again
// on the server; the schemas are here so the forms can say what's wrong
// next to each field, and so the password limits match what the server
// enforces (lib/auth.ts passes them to Better Auth).

export const MIN_PASSWORD_LENGTH = 8;
export const MAX_PASSWORD_LENGTH = 128;

// The messages show next to each field.
const email = z.email("Enter an email address, like you@example.com");

const requiredText = z.string().trim().min(1, "Required");

const newPassword = z
  .string()
  .min(MIN_PASSWORD_LENGTH, `Use at least ${MIN_PASSWORD_LENGTH} characters`)
  .max(MAX_PASSWORD_LENGTH, `Use at most ${MAX_PASSWORD_LENGTH} characters`);

// Shown on the confirm field, the one they'd retype.
const passwordsMatch = {
  check: (values: { password: string; confirm: string }) =>
    values.password === values.confirm,
  params: { message: "Passwords don't match.", path: ["confirm"] },
};

// No length rules: an account made under older rules should still sign in.
export const SignInSchema = z.object({
  email,
  password: z.string().min(1, "Enter your password"),
});

export type SignInDTO = z.output<typeof SignInSchema>;

export const ForgotPasswordSchema = z.object({ email });

export type ForgotPasswordDTO = z.output<typeof ForgotPasswordSchema>;

export const ResetPasswordSchema = z
  .object({ password: newPassword, confirm: z.string() })
  .refine(passwordsMatch.check, passwordsMatch.params);

export type ResetPasswordDTO = z.output<typeof ResetPasswordSchema>;

// The invite page. The token comes from the link, not the form.
export const SignUpSchema = z
  .object({
    email,
    firstName: requiredText,
    lastName: requiredText,
    password: newPassword,
    confirm: z.string(),
  })
  .refine(passwordsMatch.check, passwordsMatch.params);

export type SignUpDTO = z.output<typeof SignUpSchema>;
