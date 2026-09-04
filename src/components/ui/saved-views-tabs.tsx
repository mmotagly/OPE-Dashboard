"use client";

import { useActionState, useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/lib/i18n/routing";
import { EMPTY_FORM_STATE } from "@/lib/forms";
import { isFilterStateEmpty, sameFilterState, writeFilterState, type FilterState,
  type QueryParams,
} from "@/lib/filters";
import {
  deleteView,
  renameView,
  saveView,
  setDefaultView,
} from "@/lib/saved-filters-actions";
import type { SavedView } from "@/lib/saved-filters";

/**
 * Saved views as tabs along the top of the table. A view carries the whole
 * composition — which fields, which operators, which values — so opening one
 * rebuilds the bar exactly as it was saved.
 *
 * The active tab is whichever view matches the current composition, so editing
 * a filter simply drops the highlight rather than silently mutating the view.
 */
export function SavedViewsTabs({
  module,
  pathname,
  views,
  state,
  baseQuery = {},
}: {
  module: string;
  pathname: string;
  views: SavedView[];
  state: FilterState;
  baseQuery?: QueryParams;
}) {
  const t = useTranslations("filters");
  const router = useRouter();

  const [menuFor, setMenuFor] = useState<string | null>(null);
  const [renaming, setRenaming] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [saving, setSaving] = useState(false);
  const [name, setName] = useState("");

  const [saveState, saveAction, savePending] = useActionState(saveView, EMPTY_FORM_STATE);
  const [renameState, renameAction] = useActionState(renameView, EMPTY_FORM_STATE);
  const [, deleteAction] = useActionState(deleteView, EMPTY_FORM_STATE);
  const [, defaultAction] = useActionState(setDefaultView, EMPTY_FORM_STATE);

  const open = (view: SavedView) => {
    setMenuFor(null);
    router.replace({
      pathname,
      query: { ...baseQuery, ...writeFilterState(view.state) },
    });
  };

  // `clear` stops a default view from immediately reapplying — same target
  // FilterBar's own "Clear all" uses.
  const clear = () => {
    setMenuFor(null);
    router.replace({ pathname, query: { ...baseQuery, clear: "1" } });
  };

  const activeId = views.find((v) => sameFilterState(v.state, state))?.id ?? null;

  /** Clicking the already-active tab again turns the view off rather than
   * re-applying it — the only way to clear a saved view's filters without
   * navigating elsewhere. */
  const toggle = (view: SavedView) => (view.id === activeId ? clear() : open(view));
  const serialised = JSON.stringify(state);

  // With no views and nothing composed there is nothing to show and nothing
  // worth saving, so the strip stays out of the way entirely.
  if (views.length === 0 && isFilterStateEmpty(state)) return null;

  const tab =
    "flex items-center gap-1.5 rounded-t-[9px] border border-b-0 px-3 py-1.5 text-[12.5px] whitespace-nowrap transition-colors";

  return (
    <div className="flex flex-wrap items-end gap-1 border-b border-hairline px-4 pt-2.5">
      {views.map((view) => {
        const isActive = view.id === activeId;

        return (
          <div key={view.id} className="relative">
            {renaming === view.id ? (
              <form
                action={renameAction}
                onSubmit={() => setRenaming(null)}
                className={`${tab} border-hairline bg-surface`}
              >
                <input type="hidden" name="module" value={module} />
                <input type="hidden" name="id" value={view.id} />
                <input
                  name="name"
                  value={renameValue}
                  onChange={(e) => setRenameValue(e.target.value)}
                  aria-label={t("viewName")}
                  className="w-28 rounded-[6px] border border-hairline bg-canvas px-1.5 py-0.5 text-[12.5px] text-ink"
                />
                <button type="submit" className="text-[11.5px] text-ink-2 hover:text-ink">
                  {t("save")}
                </button>
              </form>
            ) : (
              <div
                className={`${tab} ${
                  isActive
                    ? "border-hairline bg-surface text-ink"
                    : "border-transparent text-ink-2 hover:bg-raise"
                }`}
              >
                <button type="button" onClick={() => toggle(view)} className="max-w-[160px] truncate">
                  {view.name}
                </button>
                {view.isDefault && (
                  <span aria-label={t("default")} title={t("default")} className="text-[10px] text-ink-3">
                    ★
                  </span>
                )}
                <button
                  type="button"
                  onClick={() => setMenuFor(menuFor === view.id ? null : view.id)}
                  aria-label={t("viewOptions")}
                  className="text-[11px] text-ink-3 hover:text-ink"
                >
                  ⋯
                </button>
              </div>
            )}

            {menuFor === view.id && (
              <>
                <button
                  type="button"
                  aria-hidden
                  tabIndex={-1}
                  onClick={() => setMenuFor(null)}
                  className="fixed bottom-0 start-0 end-0 top-0 z-20 cursor-default"
                />
                <div className="absolute start-0 top-full z-30 mt-1 w-44 rounded-[10px] border border-hairline bg-surface p-1 shadow-[0_18px_44px_rgb(0_0_0/0.55)]">
                  <button
                    type="button"
                    onClick={() => {
                      setRenaming(view.id);
                      setRenameValue(view.name);
                      setMenuFor(null);
                    }}
                    className="w-full rounded-[7px] px-2.5 py-1.5 text-start text-[12.5px] text-ink-2 hover:bg-raise hover:text-ink"
                  >
                    {t("rename")}
                  </button>

                  <form action={defaultAction} onSubmit={() => setMenuFor(null)}>
                    <input type="hidden" name="module" value={module} />
                    <input type="hidden" name="id" value={view.id} />
                    <input
                      type="hidden"
                      name="makeDefault"
                      value={view.isDefault ? "false" : "true"}
                    />
                    <button
                      type="submit"
                      className="w-full rounded-[7px] px-2.5 py-1.5 text-start text-[12.5px] text-ink-2 hover:bg-raise hover:text-ink"
                    >
                      {view.isDefault ? t("unsetDefault") : t("setDefault")}
                    </button>
                  </form>

                  <form action={deleteAction} onSubmit={() => setMenuFor(null)}>
                    <input type="hidden" name="module" value={module} />
                    <input type="hidden" name="id" value={view.id} />
                    <button
                      type="submit"
                      className="w-full rounded-[7px] px-2.5 py-1.5 text-start text-[12.5px] text-stop-text hover:bg-stop-soft"
                    >
                      {t("delete")}
                    </button>
                  </form>
                </div>
              </>
            )}
          </div>
        );
      })}

      <div className="relative">
        <button
          type="button"
          onClick={() => setSaving((s) => !s)}
          className={`${tab} border-transparent text-ink-3 hover:bg-raise hover:text-ink`}
        >
          <span aria-hidden>+</span>
          {t("saveAsView")}
        </button>

        {saving && (
          <>
            <button
              type="button"
              aria-hidden
              tabIndex={-1}
              onClick={() => setSaving(false)}
              className="fixed bottom-0 start-0 end-0 top-0 z-20 cursor-default"
            />
            <form
              action={saveAction}
              className="absolute start-0 top-full z-30 mt-1 grid w-[min(280px,90vw)] gap-2 rounded-[10px] border border-hairline bg-surface p-3 shadow-[0_18px_44px_rgb(0_0_0/0.55)]"
            >
              <input type="hidden" name="module" value={module} />
              <input type="hidden" name="state" value={serialised} />

              <label className="grid gap-1">
                <span className="text-[11px] text-ink-3">{t("saveAsView")}</span>
                <input
                  name="name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder={t("viewName")}
                  className="w-full rounded-[8px] border border-hairline bg-canvas px-2.5 py-1.5 text-[13px] text-ink"
                />
              </label>

              {(saveState.fieldErrors.name || renameState.fieldErrors.name) && (
                <p role="alert" className="text-[12px] text-stop-text">
                  {t(`error.${saveState.fieldErrors.name ?? renameState.fieldErrors.name}`)}
                </p>
              )}

              <button
                type="submit"
                disabled={savePending || name.trim() === ""}
                className="rounded-[8px] border border-ink bg-ink px-3 py-1.5 text-[12.5px] font-medium text-on-ink transition-opacity hover:opacity-90 disabled:opacity-50"
              >
                {savePending ? t("saving") : t("save")}
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  );
}
