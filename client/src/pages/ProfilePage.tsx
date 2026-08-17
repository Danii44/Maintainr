import { useEffect, useState } from "react";
import { Link } from "wouter";
import { KeyRound, Save, Settings2, UserCircle } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { useLanguage } from "../contexts/LanguageContext";

export function ProfilePage() {
  const { user } = useAuth();
  const { t } = useLanguage();
  const [name, setName] = useState(user?.name ?? "");
  const [phone, setPhone] = useState(user?.phone ?? "");
  const [avatarUrl, setAvatarUrl] = useState(user?.avatarUrl ?? "");
  const [currentPassword, setCurrentPassword] = useState("");
  const [nextPassword, setNextPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const utils = trpc.useUtils();
  const updateProfile = trpc.auth.updateProfile.useMutation();
  const changePassword = trpc.auth.changePassword.useMutation();

  useEffect(() => {
    setName(user?.name ?? "");
    setPhone(user?.phone ?? "");
    setAvatarUrl(user?.avatarUrl ?? "");
  }, [user]);

  const saveProfile = async () => {
    try {
      await updateProfile.mutateAsync({ name, phone, avatarUrl });
      await utils.auth.me.invalidate();
      toast.success(t("Profile updated", "تم تحديث الملف الشخصي"));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("Unable to update profile", "تعذر تحديث الملف الشخصي"));
    }
  };

  const savePassword = async () => {
    if (nextPassword !== confirmPassword) {
      toast.error(t("Passwords do not match", "كلمتا المرور غير متطابقتين"));
      return;
    }
    try {
      await changePassword.mutateAsync({ currentPassword, nextPassword });
      setCurrentPassword(""); setNextPassword(""); setConfirmPassword("");
      toast.success(t("Password changed", "تم تغيير كلمة المرور"));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("Unable to change password", "تعذر تغيير كلمة المرور"));
    }
  };

  return <div className="space-y-6">
    <div><div className="text-xs font-semibold uppercase tracking-[.25em] text-violet-400">{t("Account", "الحساب")}</div><h1 className="mt-2 text-3xl font-semibold text-white">{t("Profile and security", "الملف الشخصي والأمان")}</h1><p className="mt-2 text-sm text-slate-500">{t("Manage the details and security settings for your own account.", "أدر تفاصيل وإعدادات الأمان الخاصة بحسابك.")}</p></div>
    <div className="grid gap-6 xl:grid-cols-2">
      <Card className="border-white/[.07] bg-[#101521]"><CardHeader><CardTitle className="flex items-center gap-2"><UserCircle size={18} className="text-cyan-300"/>{t("Personal details", "البيانات الشخصية")}</CardTitle></CardHeader><CardContent className="space-y-4"><div className="flex items-center gap-4"><div className="grid size-16 shrink-0 place-items-center overflow-hidden rounded-2xl bg-gradient-to-br from-violet-400 to-cyan-400 text-xl font-bold text-[#080b12]">{avatarUrl ? <img src={avatarUrl} alt={name || "Profile"} className="size-full object-cover"/> : (name || user?.email || "U").slice(0, 1).toUpperCase()}</div><div className="text-xs text-slate-500">{t("Use a secure HTTPS image URL for your profile picture.", "استخدم رابط صورة HTTPS آمناً لصورة ملفك الشخصي.")}</div></div><Input value={name} onChange={event => setName(event.target.value)} placeholder={t("Full name", "الاسم الكامل")} /><Input value={user?.email ?? ""} readOnly className="cursor-not-allowed opacity-70" /><Input value={phone} onChange={event => setPhone(event.target.value)} placeholder={t("Phone number (optional)", "رقم الهاتف (اختياري)")} /><Input value={avatarUrl} onChange={event => setAvatarUrl(event.target.value)} placeholder={t("Profile image URL (optional)", "رابط صورة الملف (اختياري)")} type="url" /><Button onClick={saveProfile} disabled={updateProfile.isPending || name.trim().length < 2} className="w-full bg-violet-500 hover:bg-violet-400"><Save size={16}/>{updateProfile.isPending ? t("Saving...", "جارٍ الحفظ...") : t("Save profile", "حفظ الملف الشخصي")}</Button></CardContent></Card>
      <Card className="border-white/[.07] bg-[#101521]"><CardHeader><CardTitle className="flex items-center gap-2"><KeyRound size={18} className="text-amber-300"/>{t("Change password", "تغيير كلمة المرور")}</CardTitle></CardHeader><CardContent className="space-y-4"><Input value={currentPassword} onChange={event => setCurrentPassword(event.target.value)} placeholder={t("Current password", "كلمة المرور الحالية")} type="password" autoComplete="current-password"/><Input value={nextPassword} onChange={event => setNextPassword(event.target.value)} placeholder={t("New password (8+ characters)", "كلمة المرور الجديدة (8 أحرف فأكثر)")} type="password" autoComplete="new-password" minLength={8}/><Input value={confirmPassword} onChange={event => setConfirmPassword(event.target.value)} placeholder={t("Confirm new password", "تأكيد كلمة المرور الجديدة")} type="password" autoComplete="new-password" minLength={8}/><Button onClick={savePassword} disabled={changePassword.isPending || currentPassword.length < 8 || nextPassword.length < 8 || confirmPassword.length < 8} className="w-full bg-amber-400 text-black hover:bg-amber-300">{changePassword.isPending ? t("Changing...", "جارٍ التغيير...") : t("Change password", "تغيير كلمة المرور")}</Button><p className="text-xs leading-5 text-slate-500">{t("Other active sessions are signed out when your password changes.", "سيتم تسجيل الخروج من الجلسات الأخرى عند تغيير كلمة المرور.")}</p></CardContent></Card>
    </div>
    {user?.role === "PROPERTY_MANAGER" && <Card className="border-violet-400/20 bg-violet-400/[.04]"><CardContent className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between"><div><div className="font-medium">{t("Workspace branding and notifications", "هوية مساحة العمل والإشعارات")}</div><p className="mt-1 text-sm text-slate-500">{t("Change the organization name, logo, colors, and delivery switches in the separate developer area.", "غيّر اسم المؤسسة والشعار والألوان ومفاتيح الإرسال في منطقة المطور المنفصلة.")}</p></div><Link href="/settings"><Button variant="outline" className="border-white/10 bg-transparent"><Settings2 size={16}/>{t("Open developer settings", "فتح إعدادات المطور")}</Button></Link></CardContent></Card>}
  </div>;
}
