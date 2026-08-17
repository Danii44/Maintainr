import { useState } from "react";
import { Link, useLocation } from "wouter";
import { ArrowRight, Mail, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { useLanguage } from "../contexts/LanguageContext";
import { trpc } from "@/lib/trpc";

export function RoleApplicationPage() {
  const { t } = useLanguage();
  const [role, setRole] = useState<"TENANT" | "TECHNICIAN">("TENANT");
  const [name, setName] = useState("");
  const [managerEmail, setManagerEmail] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [message, setMessage] = useState("");
  const application = trpc.applications.submit.useMutation();
  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    try {
      await application.mutateAsync({ requestedRole: role, name, managerEmail, email, phone: phone || undefined, message: message || undefined });
      toast.success(t("Application sent. Your property manager will review it.", "تم إرسال الطلب. سيراجعه مدير العقار."));
      setName(""); setManagerEmail(""); setEmail(""); setPhone(""); setMessage("");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("Unable to send application", "تعذر إرسال الطلب"));
    }
  };
  return <div className="grid min-h-screen place-items-center bg-[#080b12] p-6 text-white"><Card className="w-full max-w-xl rounded-3xl border-white/[.1] bg-[#101521] p-3"><CardHeader><Link href="/" className="mb-8 text-sm text-slate-500 hover:text-white">{t("← Back to Maintainr", "← العودة إلى Maintainr")}</Link><div className="grid size-12 place-items-center rounded-2xl bg-cyan-400/10 text-cyan-300"><Mail/></div><CardTitle className="mt-5 text-3xl">{t("Apply for access", "طلب الوصول")}</CardTitle><p className="text-slate-400">{t("Send your details to the property manager. If approved, you will receive a secure invitation to create your own password.", "أرسل بياناتك إلى مدير العقار. عند الموافقة ستتلقى دعوة آمنة لإنشاء كلمة مرورك الخاصة.")}</p></CardHeader><CardContent><form onSubmit={submit} className="space-y-4"><Select value={role} onValueChange={value => setRole(value as "TENANT" | "TECHNICIAN")}><SelectTrigger><SelectValue placeholder={t("Requested role", "الدور المطلوب")}/></SelectTrigger><SelectContent><SelectItem value="TENANT">{t("Tenant", "مستأجر")}</SelectItem><SelectItem value="TECHNICIAN">{t("Technician", "فني")}</SelectItem></SelectContent></Select><Input required minLength={2} value={name} onChange={e => setName(e.target.value)} placeholder={t("Full name", "الاسم الكامل")}/><Input required type="email" value={managerEmail} onChange={e => setManagerEmail(e.target.value)} placeholder={t("Property manager email", "بريد مدير العقار")}/><Input required type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder={t("Your email", "بريدك الإلكتروني")}/><Input value={phone} onChange={e => setPhone(e.target.value)} placeholder={t("Phone (optional)", "الهاتف (اختياري")}/><Textarea value={message} onChange={e => setMessage(e.target.value)} placeholder={t("Message (optional)", "رسالة (اختياري)")}/><Button type="submit" disabled={application.isPending} className="h-12 w-full bg-violet-500 hover:bg-violet-400">{application.isPending ? t("Sending...", "جارٍ الإرسال...") : t("Send application", "إرسال الطلب")} <ArrowRight size={16}/></Button></form><div className="mt-5 flex gap-2 rounded-2xl border border-white/[.08] bg-white/[.03] p-3 text-xs text-slate-400"><ShieldCheck size={16} className="shrink-0 text-emerald-300"/>{t("Never share a manager password. Approved users create their own password from a single-use invitation.", "لا تشارك كلمة مرور المدير. ينشئ المستخدمون المعتمدون كلمة مرورهم من دعوة تستخدم مرة واحدة.")}</div></CardContent></Card></div>;
}

export function InvitationPage() {
  const { t } = useLanguage();
  const [, navigate] = useLocation();
  const token = new URLSearchParams(window.location.search).get("token") || "";
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const accept = trpc.auth.acceptInvitation.useMutation();
  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (password !== confirm) return toast.error(t("Passwords do not match", "كلمتا المرور غير متطابقتين"));
    try { await accept.mutateAsync({ token, password }); toast.success(t("Account activated", "تم تفعيل الحساب")); navigate("/"); }
    catch (error) { toast.error(error instanceof Error ? error.message : t("Invitation is invalid or expired", "الدعوة غير صالحة أو منتهية")); }
  };
  return <div className="grid min-h-screen place-items-center bg-[#080b12] p-6 text-white"><Card className="w-full max-w-md rounded-3xl border-white/[.1] bg-[#101521] p-3"><CardHeader><Link href="/" className="mb-8 text-sm text-slate-500 hover:text-white">{t("← Back to Maintainr", "← العودة إلى Maintainr")}</Link><CardTitle className="text-3xl">{t("Activate your account", "تفعيل حسابك")}</CardTitle><p className="text-slate-400">{t("Choose a private password for your new role account.", "اختر كلمة مرور خاصة لحساب دورك الجديد.")}</p></CardHeader><CardContent><form onSubmit={submit} className="space-y-4"><Input required minLength={8} type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder={t("Password (8+ characters)", "كلمة المرور (8 أحرف فأكثر)")}/><Input required minLength={8} type="password" value={confirm} onChange={e => setConfirm(e.target.value)} placeholder={t("Confirm password", "تأكيد كلمة المرور")}/><Button type="submit" disabled={accept.isPending || token.length < 20} className="h-12 w-full bg-violet-500 hover:bg-violet-400">{accept.isPending ? t("Activating...", "جارٍ التفعيل...") : t("Activate account", "تفعيل الحساب")}</Button></form></CardContent></Card></div>;
}
