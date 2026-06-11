import { SignUp } from "@clerk/nextjs";

export const metadata = { title: "Sign up · APD" };

export default function SignUpPage() {
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
      <SignUp />
    </main>
  );
}
