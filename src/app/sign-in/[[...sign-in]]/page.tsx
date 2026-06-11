import { SignIn } from "@clerk/nextjs";

export const metadata = { title: "Sign in · APD" };

export default function SignInPage() {
  return (
    <main
      style={{
        minHeight: "100dvh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "40px 20px",
        background: "var(--paper)",
      }}
    >
      <SignIn />
    </main>
  );
}
