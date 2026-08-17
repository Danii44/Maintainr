import { useState } from "react";
import { Link, useLocation } from "wouter";
import { ArrowRight, Building2, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { trpc } from "@/lib/trpc";
import { useLanguage } from "../contexts/LanguageContext";

const categories = ["MULTI_FAMILY", "RESIDENTIAL", "COMMERCIAL", "MIXED_USE", "OTHER"] as const;
const sizes = ["1-10", "11-50", "51-250", "251-1000", "1000+"] as const;

export function WorkspaceSignupPage() {
  const { t } = useLanguage();
  const [, navigate] = useLocation();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [organizationName, setOrganizationName] = useState("");
  const [organizationNameArabic, setOrganizationNameArabic] = useState("");
  const [portfolioCategory, setPortfolioCategory] = useState<(typeof categories)[number]>("MULTI_FAMILY");
  const [portfolioSizeRange, setPortfolioSizeRange] = useState<(typeof sizes)[number]>("1-10");
  const [firstPropertyName, setFirstPropertyName] = useState("");
  const [firstPropertyAddress, setFirstPropertyAddress] = useState("");
  const createWorkspace = trpc.auth.createWorkspace.useMutation();

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (password !== confirmPassword) {
      toast.error(t("Passwords do not match", "كلمتا المرور غير متطابقتين"));
      return;
    }
    try {
      const user = await createWorkspace.mutateAsync({ name, email, password, organizationName, organizationNameArabic: organizationNameArabic || undefined, portfolioCategory, portfolioSizeRange, firstPropertyName: firstPropertyName || undefined, firstPropertyAddress: firstPropertyAddress || undefined });
      toast.success(t("Workspace created. Welcome to Maintainr.", "تم إنشاء مساحة العمل. أهلاً بك في مينتينر."));
      navigate(user.role === "PROPERTY_MANAGER" ? "/manager" : "/");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("Unable to create workspace", "تعذر إنشاء مساحة العمل"));
    }
  };

  const categoryLabel = (category: (typeof categories)[number]) => ({
    MULTI_FAMILY: t("Multi-family / apartments", "مبانٍ سكنية وشقق"),
    RESIDENTIAL: t("Residential community", "مجمع سكني"),
    COMMERCIAL: t("Commercial property", "عقار تجاري"),
    MIXED_USE: t("Mixed-use portfolio", "مجمع متعدد الاستخدامات"),
    OTHER: t("Other", "أخرى"),
  }[category]);

  return <div className="min-h-screen bg-[#080b12] px-4 py-8 text-white sm:px-6 lg:py-12"><div className="mx-auto grid max-w-6xl gap-8 lg:grid-cols-[.9fr_1.1fr] lg:items-start"><section className="pt-4 lg:sticky lg:top-10"><Link href="/" className="text-sm text-slate-400 transition hover:text-white">{t("← Back to Maintainr", "العودة إلى مينتينر ←")}</Link><div className="mt-10 grid size-14 place-items-center rounded-2xl bg-violet-400/10 text-violet-300"><Building2 size={26}/></div><p className="mt-7 text-xs font-semibold uppercase tracking-[.24em] text-cyan-300">{t("Self-service workspace", "مساحة عمل ذاتية" )}</p><h1 className="mt-3 max-w-xl text-4xl font-semibold leading-tight sm:text-5xl">{t("Create your property operations workspace", "أنشئ مساحة عمليات عقاراتك")}</h1><p className="mt-5 max-w-xl text-base leading-7 text-slate-400">{t("Start with one secure Manager account. Your organization, people, requests, branding, and records stay isolated from every other workspace.", "ابدأ بحساب مدير آمن واحد. تظل مؤسستك ومستخدموك وطلباتك وهويتك وسجلاتك معزولة عن كل مساحات العمل الأخرى.")}</p><div className="mt-8 space-y-4 text-sm text-slate-300"><div className="flex gap-3"><CheckCircle2 className="mt-0.5 shrink-0 text-cyan-300" size={18}/><span>{t("Create an isolated real-estate organization", "أنشئ مؤسسة عقارية معزولة")}</span></div><div className="flex gap-3"><CheckCircle2 className="mt-0.5 shrink-0 text-cyan-300" size={18}/><span>{t("Set your name, logo, colors, properties, and units once", "اضبط الاسم والشعار والألوان والعقارات والوحدات مرة واحدة")}</span></div><div className="flex gap-3"><CheckCircle2 className="mt-0.5 shrink-0 text-cyan-300" size={18}/><span>{t("Invite tenants, technicians, and owners with private accounts", "ادعُ المستأجرين والفنيين والملاك بحسابات خاصة")}</span></div></div></section><Card className="border-white/[.1] bg-[#101521] shadow-2xl shadow-black/30"><CardHeader className="border-b border-white/[.07]"><CardTitle className="text-2xl">{t("Set up your workspace", "إعداد مساحة العمل")}</CardTitle><p className="text-sm leading-6 text-slate-400">{t("Complete this once as the first Property Manager. You can finish branding and operational setup after entering your dashboard.", "أكمل هذا مرة واحدة كمدير العقار الأول. يمكنك إتمام الهوية والإعداد التشغيلي بعد دخول لوحة التحكم.")}</p></CardHeader><CardContent className="p-5 sm:p-7"><form onSubmit={submit} className="space-y-6"><section className="space-y-3"><h2 className="text-sm font-semibold text-white">{t("Your Manager account", "حساب المدير الخاص بك")}</h2><div className="grid gap-3 sm:grid-cols-2"><Input required minLength={2} value={name} onChange={event => setName(event.target.value)} placeholder={t("Full name", "الاسم الكامل")}/><Input required type="email" value={email} onChange={event => setEmail(event.target.value)} placeholder={t("Work email", "بريد العمل")}/></div><div className="grid gap-3 sm:grid-cols-2"><Input required minLength={8} type="password" value={password} onChange={event => setPassword(event.target.value)} placeholder={t("Password (8+ characters)", "كلمة المرور (8 أحرف فأكثر)")}/><Input required minLength={8} type="password" value={confirmPassword} onChange={event => setConfirmPassword(event.target.value)} placeholder={t("Confirm password", "تأكيد كلمة المرور")}/></div></section><section className="space-y-3 border-t border-white/[.07] pt-6"><h2 className="text-sm font-semibold text-white">{t("Organization and portfolio", "المؤسسة والمحفظة")}</h2><div className="grid gap-3 sm:grid-cols-2"><Input required minLength={2} value={organizationName} onChange={event => setOrganizationName(event.target.value)} placeholder={t("Real-estate company name", "اسم شركة العقارات")}/><Input value={organizationNameArabic} onChange={event => setOrganizationNameArabic(event.target.value)} placeholder={t("Arabic company name (optional)", "اسم الشركة بالعربية (اختياري)")}/></div><div className="grid gap-3 sm:grid-cols-2"><label className="space-y-2 text-sm text-slate-400"><span>{t("Property category", "فئة العقار")}</span><select value={portfolioCategory} onChange={event => setPortfolioCategory(event.target.value as (typeof categories)[number])} className="h-10 w-full rounded-md border border-white/10 bg-white/[.04] px-3 text-sm text-white outline-none ring-offset-[#101521] focus:ring-2 focus:ring-violet-400">{categories.map(category => <option key={category} value={category} className="bg-[#101521]">{categoryLabel(category)}</option>)}</select></label><label className="space-y-2 text-sm text-slate-400"><span>{t("Number of properties", "عدد العقارات")}</span><select value={portfolioSizeRange} onChange={event => setPortfolioSizeRange(event.target.value as (typeof sizes)[number])} className="h-10 w-full rounded-md border border-white/10 bg-white/[.04] px-3 text-sm text-white outline-none ring-offset-[#101521] focus:ring-2 focus:ring-violet-400">{sizes.map(size => <option key={size} value={size} className="bg-[#101521]">{size}</option>)}</select></label></div></section><section className="space-y-3 border-t border-white/[.07] pt-6"><div><h2 className="text-sm font-semibold text-white">{t("First property", "العقار الأول")}</h2><p className="mt-1 text-xs leading-5 text-slate-500">{t("Optional. Add it now or use the workspace checklist later.", "اختياري. أضفه الآن أو استخدم قائمة إعداد مساحة العمل لاحقاً.")}</p></div><div className="grid gap-3 sm:grid-cols-2"><Input value={firstPropertyName} onChange={event => setFirstPropertyName(event.target.value)} placeholder={t("Property name", "اسم العقار")}/><Input value={firstPropertyAddress} onChange={event => setFirstPropertyAddress(event.target.value)} placeholder={t("Property address", "عنوان العقار")}/></div></section><Button type="submit" disabled={createWorkspace.isPending} className="h-12 w-full rounded-xl bg-violet-500 text-white hover:bg-violet-400">{createWorkspace.isPending ? t("Creating secure workspace...", "جارٍ إنشاء مساحة عمل آمنة...") : t("Create workspace", "إنشاء مساحة العمل")}<ArrowRight size={16}/></Button><p className="text-center text-xs leading-5 text-slate-500">{t("By continuing, you create a private organization workspace. Tenant, technician, and owner accounts are added through invitations or approved access requests.", "بالمتابعة، تنشئ مساحة مؤسسة خاصة. تتم إضافة حسابات المستأجرين والفنيين والملاك عبر الدعوات أو طلبات الوصول المعتمدة.")}</p><Link href="/sign-in" className="block text-center text-sm text-cyan-300 hover:text-cyan-200">{t("Already have an account? Sign in", "لديك حساب بالفعل؟ سجل الدخول")}</Link></form></CardContent></Card></div></div>;
}
