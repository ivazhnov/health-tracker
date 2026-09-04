import { redirect } from "next/navigation";
import { loginAction } from "./actions";
import { hasSession } from "@/server/auth/session";

type LoginProps = {
  searchParams: Promise<{ error?: string }>;
};

export default async function Login({ searchParams }: LoginProps) {
  if (await hasSession()) {
    redirect("/");
  }

  const { error } = await searchParams;

  return (
    <main className="login-shell">
      <section className="login-card">
        <p className="eyebrow">Семейный архив здоровья</p>
        <h1>Добро пожаловать</h1>
        <p className="lead small">Введите общий семейный пароль.</p>

        {error === "wrong_password" ? (
          <p className="notice error">Пароль не подошёл. Попробуйте ещё раз.</p>
        ) : null}

        <form action={loginAction} className="form-stack">
          <label className="field">
            <span>Пароль</span>
            <input
              autoComplete="current-password"
              autoFocus
              name="password"
              required
              type="password"
            />
          </label>
          <button className="primary-button full-width" type="submit">
            Войти
          </button>
        </form>
      </section>
    </main>
  );
}
