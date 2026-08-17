import { useState } from "react";
import { Check, UserRound, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import { useLanguage } from "../contexts/LanguageContext";
import { WorkspaceSetupChecklist } from "../components/WorkspaceSetupChecklist";

export function ManagerApplicationsPanel() {
  const { t } = useLanguage();
  const applications = trpc.manager.applications.useQuery(undefined, { retry: false });
  const approve = trpc.manager.approveApplication.useMutation({ onSuccess: () => applications.refetch() });
  const reject = trpc.manager.rejectApplication.useMutation({ onSuccess: () => applications.refetch() });
  const [unitIds, setUnitIds] = useState<Record<number, string>>({});
  const pending = applications.data?.filter(application => application.status === "PENDING") ?? [];
  if (applications.isLoading || pending.length === 0) return <WorkspaceSetupChecklist/>;
  return <Card className="mb-8 border-violet-400/20 bg-violet-400/[.04]"><CardHeader><CardTitle className="flex items-center gap-2 text-lg"><UserRound size={18} className="text-violet-300"/>{t("Access applications", "طلبات الوصول")}</CardTitle><p className="text-sm text-slate-400">{t("Review applicants and send secure invitations. Applicants create their own passwords.", "راجع الطلبات وأرسل دعوات آمنة. ينشئ المتقدمون كلمات مرورهم بأنفسهم.")}</p></CardHeader><CardContent className="space-y-3">{pending.map(application => <div key={application.id} className="rounded-2xl border border-white/[.08] bg-black/10 p-4"><div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between"><div><div className="font-medium">{application.name} · {application.requestedRole === "TENANT" ? t("Tenant", "مستأجر") : t("Technician", "فني")}</div><div className="mt-1 text-xs text-slate-400">{application.email}{application.phone ? ` · ${application.phone}` : ""}</div>{application.message && <p className="mt-2 text-sm text-slate-500">{application.message}</p>}</div><div className="flex flex-wrap items-center gap-2">{application.requestedRole === "TENANT" && <Input className="w-28 border-white/10 bg-white/[.03]" type="number" min={1} placeholder={t("Unit ID", "رقم الوحدة")} value={unitIds[application.id] ?? ""} onChange={event => setUnitIds(current => ({ ...current, [application.id]: event.target.value }))}/>}<Button size="sm" className="bg-emerald-400 text-black hover:bg-emerald-300" disabled={approve.isPending || (application.requestedRole === "TENANT" && !unitIds[application.id])} onClick={async () => { try { await approve.mutateAsync({ applicationId: application.id, unitId: unitIds[application.id] ? Number(unitIds[application.id]) : undefined }); toast.success(t("Invitation sent", "تم إرسال الدعوة")); } catch (error) { toast.error(error instanceof Error ? error.message : t("Unable to approve application", "تعذر قبول الطلب")); } }}><Check size={15}/>{t("Approve", "موافقة")}</Button><Button size="sm" variant="outline" className="border-rose-400/20 bg-transparent text-rose-300" disabled={reject.isPending} onClick={async () => { try { await reject.mutateAsync({ applicationId: application.id }); toast.success(t("Application rejected", "تم رفض الطلب")); } catch (error) { toast.error(error instanceof Error ? error.message : t("Unable to reject application", "تعذر رفض الطلب")); } }}><X size={15}/>{t("Reject", "رفض")}</Button></div></div></div>)}</CardContent></Card>;
}
