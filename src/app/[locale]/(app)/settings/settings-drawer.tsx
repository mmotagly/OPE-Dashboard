import { getTranslations } from "next-intl/server";
import { Link } from "@/lib/i18n/routing";
import { Drawer, type CloseHref } from "@/components/ui/drawer";
import { Section } from "@/components/ui/panel";
import { KeyValue, Row } from "@/components/ui/key-value";
import { Pill } from "@/components/ui/pill";
import { Empty } from "@/components/ui/empty";
import {
  loadLookup,
  loadLookupCategories,
  loadUser,
  type SettingsEntity,
} from "./queries";
import { LookupForm, UserForm } from "./settings-forms";
import { DeleteLookupButton } from "./delete-lookup-button";

const editButton =
  "rounded-[10px] border border-ink bg-ink px-3.5 py-2 text-[13px] font-medium text-on-ink transition-opacity hover:opacity-90";

export async function SettingsDrawer({
  entity,
  mode,
  id,
  category,
  closeHref,
}: {
  entity: SettingsEntity;
  mode: "view" | "new" | "edit";
  id?: string;
  category: string;
  closeHref: CloseHref;
}) {
  const t = await getTranslations("settings");
  const tCommon = await getTranslations("common");

  /* ---- lookups ---- */

  if (entity === "lookups") {
    const [categories, lookup] = await Promise.all([
      loadLookupCategories(),
      mode !== "new" && id ? loadLookup(id) : null,
    ]);

    if (mode === "new" || mode === "edit") {
      if (mode === "edit" && !lookup) {
        return (
          <Drawer code={t("editLookup")} closeHref={closeHref} closeLabel={tCommon("cancel")}>
            <Empty title={t("notFound")} hint={t("notFoundHint")} />
          </Drawer>
        );
      }

      return (
        <Drawer
          code={lookup ? `${t("editLookup")} · ${lookup.code}` : t("newLookup")}
          sub={lookup?.categoryLabel}
          closeHref={closeHref}
          closeLabel={tCommon("cancel")}
        >
          <LookupForm
            mode={lookup ? "edit" : "create"}
            lookup={lookup ?? undefined}
            categories={categories}
            defaultCategory={category}
            backTo={closeHref.query}
          />
        </Drawer>
      );
    }

    if (!lookup) {
      return (
        <Drawer code={t("noSelection")} closeHref={closeHref} closeLabel={tCommon("cancel")}>
          <Empty title={t("noSelection")} hint={t("noSelectionHint")} />
        </Drawer>
      );
    }

    return (
      <Drawer
        code={lookup.code}
        sub={`${lookup.categoryLabel} · ${lookup.labelEn}`}
        pill={
          <Pill tone={lookup.isActive ? "go" : "idle"}>
            {lookup.isActive ? t("active") : t("inactive")}
          </Pill>
        }
        closeHref={closeHref}
        closeLabel={tCommon("cancel")}
        footer={
          <>
            <Link
              href={{
                pathname: "/settings",
                query: {
                  entity: "lookups",
                  category: lookup.category,
                  mode: "edit",
                  id: lookup.id,
                },
              }}
              className={editButton}
            >
              {tCommon("edit")}
            </Link>
            <DeleteLookupButton id={lookup.id} category={lookup.category} />
          </>
        }
      >
        <Section title={t("record")}>
          <KeyValue>
            <Row label={t("field.category")}>{lookup.categoryLabel}</Row>
            <Row label={t("field.code")}>
              <span className="tnum">{lookup.code}</span>
            </Row>
            <Row label={t("field.labelEn")}>{lookup.labelEn}</Row>
            <Row label={t("field.labelAr")} muted>
              {lookup.labelAr ?? "—"}
            </Row>
            <Row label={t("field.sortOrder")} muted>
              <span className="tnum">{lookup.sortOrder}</span>
            </Row>
          </KeyValue>
          <p className="mt-3 text-[10.5px] text-ink-3">{t("deactivateHint")}</p>
        </Section>
      </Drawer>
    );
  }

  /* ---- users ---- */

  const user = id ? await loadUser(id) : null;

  if (!user) {
    return (
      <Drawer code={t("noSelection")} closeHref={closeHref} closeLabel={tCommon("cancel")}>
        <Empty title={t("noSelection")} hint={t("noSelectionHint")} />
      </Drawer>
    );
  }

  if (mode === "edit") {
    return (
      <Drawer
        code={`${tCommon("edit")} · ${user.fullName}`}
        sub={user.jobTitle ?? undefined}
        closeHref={closeHref}
        closeLabel={tCommon("cancel")}
      >
        <UserForm user={user} backTo={closeHref.query} />
      </Drawer>
    );
  }

  return (
    <Drawer
      code={user.fullName}
      sub={user.jobTitle ?? undefined}
      pill={
        <Pill tone={user.isActive ? "go" : "idle"}>
          {user.isActive ? t("active") : t("inactive")}
        </Pill>
      }
      closeHref={closeHref}
      closeLabel={tCommon("cancel")}
      footer={
        <Link
          href={{ pathname: "/settings", query: { mode: "edit", id: user.id } }}
          className={editButton}
        >
          {tCommon("edit")}
        </Link>
      }
    >
      <Section title={t("record")}>
        <KeyValue>
          <Row label={t("field.fullName")}>{user.fullName}</Row>
          <Row label={t("field.jobTitle")} muted>
            {user.jobTitle ?? "—"}
          </Row>
          <Row label={t("field.role")}>{t(`role.${user.role}`)}</Row>
          <Row label={t("field.isEngineer")}>
            {user.isEngineer ? t("yes") : t("no")}
          </Row>
          <Row label={t("field.isActive")}>{user.isActive ? t("yes") : t("no")}</Row>
        </KeyValue>
        <p className="mt-3 text-[10.5px] text-ink-3">{t("noAccountCreation")}</p>
      </Section>
    </Drawer>
  );
}
