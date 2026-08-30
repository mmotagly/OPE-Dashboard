import { getTranslations } from "next-intl/server";
import { LoginForm } from "./login-form";

export default async function LoginPage() {
  const t = await getTranslations("auth");

  return (
    <main className="grid min-h-dvh place-items-center px-5">
      <div className="w-full max-w-sm rounded-card bg-surface p-7 rim">
        <div className="mb-6 flex items-center gap-2.5">
          <span className="grid h-7 w-7 place-items-center rounded-lg bg-accent-fill text-[13px] font-bold text-on-accent">
            P
          </span>
          <span className="font-semibold tracking-[-0.01em]">Pyramids Ops</span>
        </div>

        <h1 className="mb-5 text-lg font-semibold">{t("signIn")}</h1>

        <LoginForm
          labels={{
            email: t("email"),
            password: t("password"),
            submit: t("signIn"),
            pending: t("signingIn"),
            failed: t("failed"),
          }}
        />

        <p className="mt-5 text-[12px] text-ink-3">{t("noSignup")}</p>
      </div>
    </main>
  );
}
