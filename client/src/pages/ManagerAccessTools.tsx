import { useState } from "react";
import { KeyRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import { useLanguage } from "../contexts/LanguageContext";

export function ManagerAccessTools() {
  const { t } = useLanguage();
  const [email, setEmail] = useState("");
  const reset = trpc.manager.sendPasswordReset.useMutation();
  return <Card className="mb-8 border-cyan-400/15 bg-cyan-400/[.03]"><CardHeader><CardTitle className="flex items-center gap-2 text-lg"><KeyRound size={18} className="text-cyan-300"/>{t("Account access", "وصول الحسابات")}</CardTitle><p className="text-sm text-slate-400">{t("Send a secure reset link to a separate user account. Never share Manager passwords.", "أرسل رابط إعادة تعيين آمناً لحساب مستخدم منفصل. لا تشارك كلمة مرور المدير أبداً.")}</p></CardHeader><CardContent><form className="flex flex-col gap-3 sm:flex-row" onSubmit={async event => { event.preventDefault(); try { await reset.mutateAsync({ email }); setEmail(""); toast.success(t("If the account exists, a reset email was sent.", "إذا كان الحساب موجوداً، تم إرسال رسالة إعادة التعيين.")); } catch (error) { toast.error(error instanceof Error ? error.message : t("Unable to send reset link", "تعذر إرسال رابط إعادة التعيين")); } }}><Input required type="email" value={email} onChange={event => setEmail(event.target.value)} placeholder={t("User email address", "البريد الإلكتروني للمستخدم")} className="border-white/10 bg-white/[.03]"/><Button type="submit" disabled={reset.isPending} className="bg-cyan-400 text-black hover:bg-cyan-300">{reset.isPending ? t("Sending...", "جارٍ الإرسال...") : t("Send reset link", "إرسال رابط إعادة التعيين")}</Button></form></CardContent></Card>;
}
