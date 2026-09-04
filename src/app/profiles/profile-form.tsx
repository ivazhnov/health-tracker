import Link from "next/link";
import type { ProfileDetails } from "@/server/profiles";

type ProfileFormProps = {
  action: (formData: FormData) => void | Promise<void>;
  profile?: ProfileDetails;
};

export function ProfileForm({ action, profile }: ProfileFormProps) {
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
          <span>Пол при рождении</span>
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

      <fieldset className="measurement-fieldset">
        <legend>{profile ? "Новое измерение" : "Рост и вес"}</legend>
        <p>
          {profile
            ? "Заполните, только если хотите добавить или обновить измерение."
            : "Можно заполнить сейчас или добавить позже."}
        </p>
        <div className="form-grid three-columns">
          <label className="field">
            <span>Дата</span>
            <input defaultValue={today()} max={today()} name="measuredAt" type="date" />
          </label>
          <label className="field">
            <span>Рост, см</span>
            <input min="0.1" name="heightCm" step="0.1" type="number" />
          </label>
          <label className="field">
            <span>Вес, кг</span>
            <input min="0.1" name="weightKg" step="0.1" type="number" />
          </label>
        </div>
      </fieldset>

      <div className="form-actions">
        <Link className="secondary-button" href="/">
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
