import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { Link } from "@/lib/i18n/routing";
import { canWriteMaster, requireUser } from "@/lib/auth";
import { DetailPage } from "@/components/ui/detail-page";
import { Pill } from "@/components/ui/pill";
import { loadLatestOperation, loadPmSchedule, loadVehicle } from "../queries";
import { VehicleDetailBody } from "../vehicle-drawer";

/**
 * Standalone full-page view — reached by clicking a vehicle's code in the
 * list, as opposed to clicking anywhere else in the row (which still opens
 * the overlay Drawer at /vehicles?id=...). Same detail content
 * (VehicleDetailBody), different chrome (DetailPage vs. Drawer). First
 * module built this way; see CLAUDE.md's row-click-vs-code-link convention
 * for the pattern to repeat across the other modules.
 */
export default async function VehicleDetailPage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { locale, id } = await params;
  const user = await requireUser(locale);
  const canEdit = canWriteMaster(user.role);

  const t = await getTranslations("master");
  const tCommon = await getTranslations("common");

  const vehicle = await loadVehicle(id);
  if (!vehicle) notFound();

  const [schedule, latest] = await Promise.all([
    loadPmSchedule(vehicle.id),
    loadLatestOperation(vehicle.id),
  ]);

  return (
    <div className="font-inter contents">
      <DetailPage
        code={vehicle.vehicleCode}
        sub={`${vehicle.plateNumber}${vehicle.vendorName ? ` · ${vehicle.vendorName}` : ""}`}
        pill={
          vehicle.statusLabel ? (
            <Pill tone={vehicle.statusCode === "active" ? "go" : "idle"}>
              {vehicle.statusLabel}
            </Pill>
          ) : undefined
        }
        backHref="/vehicles"
        backLabel={t("vehiclesTitle")}
        actions={
          canEdit ? (
            <Link
              href={{ pathname: "/vehicles", query: { mode: "edit", id: vehicle.id } }}
              className="rounded-control border border-ink bg-ink px-3.5 py-2 text-[13px] font-medium text-on-ink transition-opacity hover:opacity-90"
            >
              {tCommon("edit")}
            </Link>
          ) : undefined
        }
      >
        <VehicleDetailBody vehicle={vehicle} schedule={schedule} latest={latest} canEdit={canEdit} />
      </DetailPage>
    </div>
  );
}
