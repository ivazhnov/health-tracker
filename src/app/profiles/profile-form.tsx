import Link from "next/link";
import type { ProfileDetails } from "@/server/profiles";

type ProfileFormProps = {
  action: (formData: FormData) => void | Promise<void>;
  cancelHref?: string;
  profile?: ProfileDetails;
};

export function ProfileForm({
  action,
  cancelHref = "/",
  profile,
}: ProfileFormProps) {
  return (
    <form action={action} className="profile-form">
      <div className="form-grid">
        <label className="field">
          <span>Имя</span>
          <input
            defaultValue={profile?.firstName}
            maxLength={100}
            name="firstName"
            required
          />
        </label>
        <label className="field">
          <span>Фамилия</span>
          <input
            defaultValue={profile?.lastName}
            maxLength={100}
            name="lastName"
          />
        </label>
        <label className="field">
          <span>Дата рождения</span>
          <input
            defaultValue={profile?.dateOfBirth}
            max={today()}
            name="dateOfBirth"
            required
            type="date"
          />
        </label>
        <label className="field">
          <span>Пол</span>
          <select
            defaultValue={profile?.sexAtBirth ?? ""}
            name="sexAtBirth"
            required
          >
            <option disabled value="">
              Выберите
            </option>
            <option value="female">Женский</option>
            <option value="male">Мужской</option>
          </select>
        </label>
      </div>

      <label className="field">
        <span>Заметка</span>
        <textarea
          defaultValue={profile?.notes}
          maxLength={2000}
          name="notes"
          placeholder="Необязательно"
          rows={3}
        />
      </label>

      <div className="form-actions">
        <Link className="secondary-button" href={cancelHref}>
          Отмена
        </Link>
        <button className="primary-button" type="submit">
          Сохранить
        </button>
      </div>
    </form>
  );
}

function today() {
  return new Date().toISOString().slice(0, 10);
}
