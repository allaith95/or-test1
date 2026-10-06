import React, { useState } from 'react';
import {
  X,
  BookOpen,
  Server,
  Database,
  Network,
  Radio,
  CheckCircle2,
  Copy,
  Terminal,
  ShieldCheck,
  Building2,
  Laptop,
  Globe,
  HardDrive,
  Cpu,
  Layers,
  ChevronRight,
  ExternalLink,
  Sparkles,
  Sliders,
  FileCode2,
  KeyRound,
  HelpCircle,
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface DeploymentAndSetupGuideModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const DeploymentAndSetupGuideModal: React.FC<DeploymentAndSetupGuideModalProps> = ({
  isOpen,
  onClose,
}) => {
  const [activeTab, setActiveTab] = useState<
    'template_config' | 'quickstart' | 'server' | 'postgres' | 'branches' | 'sync'
  >('template_config');

  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  // Blank template fields for user configuration with real-time derivation
  const [configFields, setConfigFields] = useState({
    // PostgreSQL options
    pgHost: '',
    pgPort: '',
    pgDatabase: '',
    pgUser: '',
    pgPassword: '',
    // Server options
    serverPort: '',
    serverIp: '',
    serverEnv: '',
    // Branch options
    branchServerUrl: '',
    branchBindingId: '',
    branchDeviceName: '',
    // Firewall options
    firewallRuleName: '',
    firewallPort: '',
  });

  const handleFieldChange = (key: keyof typeof configFields, value: string) => {
    setConfigFields((prev) => ({ ...prev, [key]: value }));
  };

  const handleCopy = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2500);
  };

  // Derived connection string
  const derivedPgUrl = `postgresql://${configFields.pgUser || 'postgres'}:${
    configFields.pgPassword || 'كلمة_المرور'
  }@${configFields.pgHost || 'localhost'}:${configFields.pgPort || '5432'}/${
    configFields.pgDatabase || 'orca_express_db'
  }`;

  // Generated .env content
  const generatedEnvContent = `# ====================================================
# ملف إعدادات ومتغيرات بيئة نظام أوركا اكسبريس (.env)
# يتم وضعه في المجلد الرئيسي بجانب package.json
# ====================================================

# 1. إعدادات السيرفر الرئيسي
PORT=${configFields.serverPort || '3000'}
NODE_ENV=${configFields.serverEnv || 'production'}

# 2. رابط الاتصال الكامل بمحرك PostgreSQL
DATABASE_URL=${derivedPgUrl}

# 3. إعدادات تفصيلية لقاعدة البيانات (اختياري)
PGHOST=${configFields.pgHost || 'localhost'}
PGPORT=${configFields.pgPort || '5432'}
PGDATABASE=${configFields.pgDatabase || 'orca_express_db'}
PGUSER=${configFields.pgUser || 'postgres'}
PGPASSWORD=${configFields.pgPassword || 'كلمة_المرور'}

# 4. إعدادات السيرفر المستهدف لأجهزة الفروع
VPS_SERVER_URL=${
    configFields.branchServerUrl ||
    `http://${configFields.serverIp || '192.168.1.50'}:${configFields.serverPort || '3000'}`
  }
BRANCH_BINDING_ID=${configFields.branchBindingId || ''}
DEVICE_NAME=${configFields.branchDeviceName || ''}
`;

  if (!isOpen) return null;

  return (
    <div
      id="deployment_setup_guide_modal"
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-slate-950/85 backdrop-blur-md overflow-hidden animate-in fade-in"
      dir="rtl"
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.96, y: 15 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.96, y: 15 }}
        className="relative w-full max-w-5xl h-[92vh] max-h-[880px] bg-slate-900 border border-slate-700/80 rounded-3xl shadow-2xl shadow-black flex flex-col overflow-hidden text-slate-100"
      >
        {/* MODAL HEADER */}
        <div className="shrink-0 px-6 py-4 bg-slate-950/90 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-400">
              <BookOpen className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base sm:text-lg font-black text-white">
                  الدليل الشامل للتشغيل والربط بين السيرفر الرئيسي والفروع وقواعد البيانات
                </h2>
                <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 border border-emerald-500/30 text-emerald-300 text-[10px] font-bold">
                  دليل معتمد 📖
                </span>
              </div>
              <p className="text-xs text-slate-400">
                خيارات الإعداد والمتغيرات فارغة مع شرح وافٍ لكل حقل وكيفية ملؤه واستخدامه
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white rounded-xl hover:bg-slate-800 transition cursor-pointer"
            title="إغلاق"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* NAVIGATION TABS */}
        <div className="shrink-0 px-4 sm:px-6 py-2 bg-slate-950/50 border-b border-slate-800/80 flex items-center gap-1.5 overflow-x-auto custom-scrollbar">
          <button
            type="button"
            onClick={() => setActiveTab('template_config')}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 shrink-0 cursor-pointer ${
              activeTab === 'template_config'
                ? 'bg-gradient-to-r from-emerald-600 via-teal-600 to-cyan-600 text-white shadow-md shadow-emerald-500/20'
                : 'text-emerald-300 hover:text-white hover:bg-slate-800/60 border border-emerald-500/30'
            }`}
          >
            <Sliders className="w-4 h-4 text-amber-400" />
            <span>⚙️ استمارة الخيارات ومولد ملف .env (شرح الحقول)</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('quickstart')}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 shrink-0 cursor-pointer ${
              activeTab === 'quickstart'
                ? 'bg-gradient-to-r from-amber-600 to-amber-500 text-white shadow-md shadow-amber-500/20'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
            }`}
          >
            <Terminal className="w-4 h-4" />
            <span>1. تنزيل وبناء المشروع (Quick Start)</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('server')}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 shrink-0 cursor-pointer ${
              activeTab === 'server'
                ? 'bg-gradient-to-r from-emerald-600 to-teal-600 text-white shadow-md shadow-emerald-500/20'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
            }`}
          >
            <Server className="w-4 h-4" />
            <span>2. إعداد السيرفر والجدار الناري</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('postgres')}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 shrink-0 cursor-pointer ${
              activeTab === 'postgres'
                ? 'bg-gradient-to-r from-indigo-600 to-blue-600 text-white shadow-md shadow-indigo-500/20'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
            }`}
          >
            <Database className="w-4 h-4" />
            <span>3. ربط محرك PostgreSQL</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('branches')}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 shrink-0 cursor-pointer ${
              activeTab === 'branches'
                ? 'bg-gradient-to-r from-cyan-600 to-blue-500 text-white shadow-md shadow-cyan-500/20'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
            }`}
          >
            <Building2 className="w-4 h-4" />
            <span>4. ربط ودخول أجهزة الفروع</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('sync')}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 shrink-0 cursor-pointer ${
              activeTab === 'sync'
                ? 'bg-gradient-to-r from-purple-600 to-pink-600 text-white shadow-md shadow-purple-500/20'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
            }`}
          >
            <Radio className="w-4 h-4" />
            <span>5. المزامنة اللحظية والصمود</span>
          </button>
        </div>

        {/* MODAL BODY */}
        <div className="flex-1 overflow-y-auto p-5 sm:p-8 space-y-6 custom-scrollbar text-right leading-relaxed">
          <AnimatePresence mode="wait">
            {/* TAB: TEMPLATE CONFIG & FIELD EXPLANATIONS */}
            {activeTab === 'template_config' && (
              <motion.div
                key="template_config"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="space-y-6"
              >
                {/* Intro Card */}
                <div className="p-4 sm:p-5 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 flex items-start gap-3.5">
                  <Sliders className="w-6 h-6 text-emerald-400 shrink-0 mt-1" />
                  <div>
                    <h3 className="text-sm font-black text-emerald-300">
                      استمارة خيارات النظام ومتغيرات البيئة (.env Builder) مع شرح وافٍ لكل حقل
                    </h3>
                    <p className="text-xs text-emerald-100/90 mt-1">
                      الحقول التالية تم تركها فارغة لتعبئتها بقيمك الخاصة، ويوجد أسفل كل حقل شرح مفصل لوظيفته ومكان الحصول عليه. سيتم توليد كود ملف <code className="text-amber-300 font-mono">.env</code> ورابط الاتصال تلقائياً في الأسفل مع إمكانية النسخ بنقرة واحدة.
                    </p>
                  </div>
                </div>

                {/* SECTION 1: POSTGRESQL CONFIGURATION */}
                <div className="p-5 rounded-3xl bg-slate-950 border border-slate-800 space-y-4">
                  <div className="flex items-center gap-2.5 border-b border-slate-800/80 pb-3">
                    <Database className="w-5 h-5 text-indigo-400" />
                    <h4 className="text-sm font-black text-white">
                      1. خيارات ومحددات قاعدة بيانات PostgreSQL (Database Configuration)
                    </h4>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* PGHOST */}
                    <div className="space-y-1.5">
                      <label className="block text-xs font-bold text-slate-200">
                        عنوان مستضيف قاعدة البيانات (PGHOST):
                      </label>
                      <input
                        type="text"
                        value={configFields.pgHost}
                        onChange={(e) => handleFieldChange('pgHost', e.target.value)}
                        placeholder="مثال: localhost أو 192.168.1.50"
                        className="w-full px-3.5 py-2.5 rounded-xl bg-slate-900 border border-slate-700 text-xs text-white focus:outline-none focus:border-indigo-500 font-mono"
                      />
                      <div className="p-2 rounded-lg bg-slate-900/60 text-[11px] text-slate-400 flex items-start gap-1.5">
                        <HelpCircle className="w-3.5 h-3.5 text-indigo-400 shrink-0 mt-0.5" />
                        <span>
                          <strong>شرح الحقل:</strong> عنوان السيرفر الذي توجد عليه قاعدة بيانات PostgreSQL. إذا كانت مثبتة على نفس جهاز السيرفر الرئيسي اتركه <code className="text-indigo-300 font-mono">localhost</code>، أما إذا كانت على جهاز مستقل ضع عنوان الـ IP الخاص به.
                        </span>
                      </div>
                    </div>

                    {/* PGPORT */}
                    <div className="space-y-1.5">
                      <label className="block text-xs font-bold text-slate-200">
                        منفذ قاعدة البيانات (PGPORT):
                      </label>
                      <input
                        type="text"
                        value={configFields.pgPort}
                        onChange={(e) => handleFieldChange('pgPort', e.target.value)}
                        placeholder="الافتراضي: 5432"
                        className="w-full px-3.5 py-2.5 rounded-xl bg-slate-900 border border-slate-700 text-xs text-white focus:outline-none focus:border-indigo-500 font-mono"
                      />
                      <div className="p-2 rounded-lg bg-slate-900/60 text-[11px] text-slate-400 flex items-start gap-1.5">
                        <HelpCircle className="w-3.5 h-3.5 text-indigo-400 shrink-0 mt-0.5" />
                        <span>
                          <strong>شرح الحقل:</strong> رقم المنفذ الذي تستمع عليه PostgreSQL. المنفذ الافتراضي الرسمي هو <code className="text-indigo-300 font-mono">5432</code> ولا يحتاج لتغيير إلا إذا تم تخصيصه أثناء التثبيت.
                        </span>
                      </div>
                    </div>

                    {/* PGDATABASE */}
                    <div className="space-y-1.5">
                      <label className="block text-xs font-bold text-slate-200">
                        اسم قاعدة البيانات (PGDATABASE):
                      </label>
                      <input
                        type="text"
                        value={configFields.pgDatabase}
                        onChange={(e) => handleFieldChange('pgDatabase', e.target.value)}
                        placeholder="مثال: orca_express_db"
                        className="w-full px-3.5 py-2.5 rounded-xl bg-slate-900 border border-slate-700 text-xs text-white focus:outline-none focus:border-indigo-500 font-mono"
                      />
                      <div className="p-2 rounded-lg bg-slate-900/60 text-[11px] text-slate-400 flex items-start gap-1.5">
                        <HelpCircle className="w-3.5 h-3.5 text-indigo-400 shrink-0 mt-0.5" />
                        <span>
                          <strong>شرح الحقل:</strong> اسم قاعدة البيانات التي أنشأتها عبر أمر <code className="text-cyan-300 font-mono">CREATE DATABASE orca_express_db;</code> في PostgreSQL.
                        </span>
                      </div>
                    </div>

                    {/* PGUSER */}
                    <div className="space-y-1.5">
                      <label className="block text-xs font-bold text-slate-200">
                        اسم مستخدم قاعدة البيانات (PGUSER):
                      </label>
                      <input
                        type="text"
                        value={configFields.pgUser}
                        onChange={(e) => handleFieldChange('pgUser', e.target.value)}
                        placeholder="الافتراضي: postgres"
                        className="w-full px-3.5 py-2.5 rounded-xl bg-slate-900 border border-slate-700 text-xs text-white focus:outline-none focus:border-indigo-500 font-mono"
                      />
                      <div className="p-2 rounded-lg bg-slate-900/60 text-[11px] text-slate-400 flex items-start gap-1.5">
                        <HelpCircle className="w-3.5 h-3.5 text-indigo-400 shrink-0 mt-0.5" />
                        <span>
                          <strong>شرح الحقل:</strong> اسم الحساب المسؤول في PostgreSQL، الحساب الافتراضي هو <code className="text-indigo-300 font-mono">postgres</code>.
                        </span>
                      </div>
                    </div>

                    {/* PGPASSWORD */}
                    <div className="md:col-span-2 space-y-1.5">
                      <label className="block text-xs font-bold text-slate-200">
                        كلمة مرور قاعدة البيانات (PGPASSWORD):
                      </label>
                      <input
                        type="password"
                        value={configFields.pgPassword}
                        onChange={(e) => handleFieldChange('pgPassword', e.target.value)}
                        placeholder="أدخل كلمة المرور التي عينتها أثناء تثبيت PostgreSQL"
                        className="w-full px-3.5 py-2.5 rounded-xl bg-slate-900 border border-slate-700 text-xs text-white focus:outline-none focus:border-indigo-500 font-mono"
                      />
                      <div className="p-2 rounded-lg bg-slate-900/60 text-[11px] text-slate-400 flex items-start gap-1.5">
                        <HelpCircle className="w-3.5 h-3.5 text-indigo-400 shrink-0 mt-0.5" />
                        <span>
                          <strong>شرح الحقل:</strong> كلمة المرور الخاصة بمستخدم قاعدة البيانات والتي قمت بتحديدها عند تثبيت حزمة PostgreSQL على الحاسب.
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Derived Connection String Box */}
                  <div className="p-3.5 rounded-2xl bg-indigo-950/40 border border-indigo-500/30 space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-black text-indigo-300">
                        رابط الاتصال المشتق المباشر (DATABASE_URL):
                      </span>
                      <button
                        type="button"
                        onClick={() => handleCopy(`DATABASE_URL=${derivedPgUrl}`, 'derived_url')}
                        className="text-[11px] text-indigo-300 hover:text-white flex items-center gap-1 font-bold cursor-pointer"
                      >
                        {copiedKey === 'derived_url' ? (
                          <span className="text-emerald-400">تم النسخ! ✓</span>
                        ) : (
                          <>
                            <Copy className="w-3.5 h-3.5" />
                            <span>نسخ الرابط</span>
                          </>
                        )}
                      </button>
                    </div>
                    <div className="p-2.5 rounded-xl bg-slate-950 font-mono text-xs text-cyan-300 break-all select-all font-bold border border-slate-800">
                      DATABASE_URL={derivedPgUrl}
                    </div>
                  </div>
                </div>

                {/* SECTION 2: SERVER HOST CONFIGURATION */}
                <div className="p-5 rounded-3xl bg-slate-950 border border-slate-800 space-y-4">
                  <div className="flex items-center gap-2.5 border-b border-slate-800/80 pb-3">
                    <Server className="w-5 h-5 text-emerald-400" />
                    <h4 className="text-sm font-black text-white">
                      2. خيارات وإعدادات السيرفر الرئيسي (Main Server Settings)
                    </h4>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {/* PORT */}
                    <div className="space-y-1.5">
                      <label className="block text-xs font-bold text-slate-200">
                        منفذ السيرفر (PORT):
                      </label>
                      <input
                        type="text"
                        value={configFields.serverPort}
                        onChange={(e) => handleFieldChange('serverPort', e.target.value)}
                        placeholder="الافتراضي: 3000"
                        className="w-full px-3.5 py-2.5 rounded-xl bg-slate-900 border border-slate-700 text-xs text-white focus:outline-none focus:border-emerald-500 font-mono"
                      />
                      <div className="p-2 rounded-lg bg-slate-900/60 text-[11px] text-slate-400">
                        <strong>شرح:</strong> المنفذ الذي سيستمع عليه السيرفر لاستقبال طلبات الفروع.
                      </div>
                    </div>

                    {/* SERVER IP */}
                    <div className="space-y-1.5">
                      <label className="block text-xs font-bold text-slate-200">
                        عنوان IP الحاسب الرئيسي (SERVER_IP):
                      </label>
                      <input
                        type="text"
                        value={configFields.serverIp}
                        onChange={(e) => handleFieldChange('serverIp', e.target.value)}
                        placeholder="مثال: 192.168.1.50"
                        className="w-full px-3.5 py-2.5 rounded-xl bg-slate-900 border border-slate-700 text-xs text-white focus:outline-none focus:border-emerald-500 font-mono"
                      />
                      <div className="p-2 rounded-lg bg-slate-900/60 text-[11px] text-slate-400">
                        <strong>شرح:</strong> الـ IPv4 المستخرج من أمر <code className="text-emerald-300 font-mono">ipconfig</code>.
                      </div>
                    </div>

                    {/* NODE_ENV */}
                    <div className="space-y-1.5">
                      <label className="block text-xs font-bold text-slate-200">
                        بيئة التشغيل (NODE_ENV):
                      </label>
                      <input
                        type="text"
                        value={configFields.serverEnv}
                        onChange={(e) => handleFieldChange('serverEnv', e.target.value)}
                        placeholder="production أو development"
                        className="w-full px-3.5 py-2.5 rounded-xl bg-slate-900 border border-slate-700 text-xs text-white focus:outline-none focus:border-emerald-500 font-mono"
                      />
                      <div className="p-2 rounded-lg bg-slate-900/60 text-[11px] text-slate-400">
                        <strong>شرح:</strong> نوصي بـ <code className="text-emerald-300 font-mono">production</code> لأعلى استقرار.
                      </div>
                    </div>
                  </div>
                </div>

                {/* SECTION 3: BRANCH DEVICE CONFIGURATION */}
                <div className="p-5 rounded-3xl bg-slate-950 border border-slate-800 space-y-4">
                  <div className="flex items-center gap-2.5 border-b border-slate-800/80 pb-3">
                    <Building2 className="w-5 h-5 text-cyan-400" />
                    <h4 className="text-sm font-black text-white">
                      3. خيارات ربط وتخصيص جهاز الفرع (Branch Device Options)
                    </h4>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {/* VPS_SERVER_URL */}
                    <div className="space-y-1.5">
                      <label className="block text-xs font-bold text-slate-200">
                        رابط السيرفر المستهدف (VPS_SERVER_URL):
                      </label>
                      <input
                        type="text"
                        value={configFields.branchServerUrl}
                        onChange={(e) => handleFieldChange('branchServerUrl', e.target.value)}
                        placeholder="مثال: http://192.168.1.50:3000"
                        className="w-full px-3.5 py-2.5 rounded-xl bg-slate-900 border border-slate-700 text-xs text-white focus:outline-none focus:border-cyan-500 font-mono"
                      />
                      <div className="p-2 rounded-lg bg-slate-900/60 text-[11px] text-slate-400">
                        <strong>شرح:</strong> الرابط الذي يكتبه موظف الفرع في المتصفح للوصول للسيرفر.
                      </div>
                    </div>

                    {/* BRANCH_BINDING_ID */}
                    <div className="space-y-1.5">
                      <label className="block text-xs font-bold text-slate-200">
                        معرف الفرع الافتراضي (BRANCH_BINDING_ID):
                      </label>
                      <input
                        type="text"
                        value={configFields.branchBindingId}
                        onChange={(e) => handleFieldChange('branchBindingId', e.target.value)}
                        placeholder="مثال: damascus_central أو aleppo"
                        className="w-full px-3.5 py-2.5 rounded-xl bg-slate-900 border border-slate-700 text-xs text-white focus:outline-none focus:border-cyan-500 font-mono"
                      />
                      <div className="p-2 rounded-lg bg-slate-900/60 text-[11px] text-slate-400">
                        <strong>شرح:</strong> لربط الجهاز بفرع معين تلقائياً ومنع الخطأ البشري.
                      </div>
                    </div>

                    {/* DEVICE_NAME */}
                    <div className="space-y-1.5">
                      <label className="block text-xs font-bold text-slate-200">
                        اسم الجهاز التعريفي (DEVICE_NAME):
                      </label>
                      <input
                        type="text"
                        value={configFields.branchDeviceName}
                        onChange={(e) => handleFieldChange('branchDeviceName', e.target.value)}
                        placeholder="مثال: كاونتر استقبال طرود دمشق 1"
                        className="w-full px-3.5 py-2.5 rounded-xl bg-slate-900 border border-slate-700 text-xs text-white focus:outline-none focus:border-cyan-500"
                      />
                      <div className="p-2 rounded-lg bg-slate-900/60 text-[11px] text-slate-400">
                        <strong>شرح:</strong> اسم يظهر في سجلات الحركات المالية لمتابعة الجهاز.
                      </div>
                    </div>
                  </div>
                </div>

                {/* SECTION 4: GENERATED .ENV CODE WITH ONE-CLICK COPY */}
                <div className="p-5 rounded-3xl bg-slate-950 border border-amber-500/40 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <FileCode2 className="w-5 h-5 text-amber-400" />
                      <h4 className="text-sm font-black text-amber-300">
                        كود ملف البيئة المولد تلقائياً (.env) - جاهز للنسخ والحفظ
                      </h4>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleCopy(generatedEnvContent, 'generated_env')}
                      className="px-3.5 py-1.5 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 hover:text-white border border-amber-500/40 text-xs font-bold transition flex items-center gap-1.5 cursor-pointer"
                    >
                      {copiedKey === 'generated_env' ? (
                        <>
                          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                          <span className="text-emerald-300">تم نسخ ملف .env بنجاح!</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-4 h-4" />
                          <span>نسخ محتوى ملف .env</span>
                        </>
                      )}
                    </button>
                  </div>

                  <p className="text-xs text-slate-300">
                    انسخ هذا النص وضعه داخل ملف باسم <code className="text-amber-400 font-mono">.env</code> في المجلد الرئيسي للمشروع (بجانب package.json):
                  </p>

                  <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 font-mono text-xs text-slate-200 overflow-x-auto whitespace-pre leading-relaxed custom-scrollbar">
                    {generatedEnvContent}
                  </div>
                </div>
              </motion.div>
            )}

            {/* TAB 1: QUICK START & BUILD */}
            {activeTab === 'quickstart' && (
              <motion.div
                key="quickstart"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="space-y-6"
              >
                {/* Intro Card */}
                <div className="p-4 sm:p-5 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-start gap-3.5">
                  <Sparkles className="w-6 h-6 text-amber-400 shrink-0 mt-1" />
                  <div>
                    <h3 className="text-sm font-black text-amber-300">
                      نظرة عامة على تشغيل النظام في بيئة العمل الحقيقية
                    </h3>
                    <p className="text-xs text-amber-100/90 mt-1">
                      النظام مصمم ليعمل كـ Full-Stack مستقل تماماً. يتم تنصيبه على الحاسب الرئيسي (Server PC) ليعمل كمخدم مركزي يستقبل الطلبات من كافة أجهزة الفروع والشاشات ويوفر مزامنة فورية لكافة الطرود وسندات الصندوق والمنافست.
                    </p>
                  </div>
                </div>

                {/* Step by Step */}
                <div className="space-y-4">
                  <h4 className="text-sm font-black text-white flex items-center gap-2">
                    <span className="w-6 h-6 rounded-full bg-slate-800 border border-slate-700 text-xs flex items-center justify-center font-mono">1</span>
                    تثبيت بيئة التشغيل Node.js
                  </h4>
                  <p className="text-xs text-slate-300 pr-8">
                    تأكد من تنزيل وتثبيت أحدث إصدار مستقر من بيئة <strong>Node.js (LTS v18 أو v20 أو v22)</strong> على الحاسب الرئيسي من الموقع الرسمي:{' '}
                    <a
                      href="https://nodejs.org"
                      target="_blank"
                      rel="noreferrer"
                      className="text-cyan-400 hover:underline inline-flex items-center gap-1 font-mono"
                    >
                      nodejs.org <ExternalLink className="w-3 h-3" />
                    </a>
                  </p>

                  <h4 className="text-sm font-black text-white flex items-center gap-2 pt-2">
                    <span className="w-6 h-6 rounded-full bg-slate-800 border border-slate-700 text-xs flex items-center justify-center font-mono">2</span>
                    تثبيت الحزم وبناء المشروع (Build & Run)
                  </h4>
                  <div className="pr-8 space-y-2">
                    <p className="text-xs text-slate-300">
                      افتح موجه الأوامر (Command Prompt أو PowerShell أو Terminal) داخل مجلد المشروع ونفّذ الأوامر التالية بالترتيب:
                    </p>

                    <div className="relative rounded-2xl bg-slate-950 border border-slate-800 p-4 font-mono text-xs text-slate-200">
                      <button
                        type="button"
                        onClick={() =>
                          handleCopy(
                            `# 1. تثبيت الاعتماديات والحزم\nnpm install\n\n# 2. بناء ملفات الإنتاج السريعة\nnpm run build\n\n# 3. تشغيل السيرفر الموحد على المنفذ 3000\nnpm start`,
                            'build_cmds'
                          )
                        }
                        className="absolute left-3 top-3 px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-[11px] flex items-center gap-1.5 transition cursor-pointer"
                      >
                        {copiedKey === 'build_cmds' ? (
                          <>
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                            <span className="text-emerald-300 font-bold">تم النسخ!</span>
                          </>
                        ) : (
                          <>
                            <Copy className="w-3.5 h-3.5" />
                            <span>نسخ الأوامر</span>
                          </>
                        )}
                      </button>

                      <div className="text-emerald-400 font-bold mb-2">// خطوات التثبيت والتشغيل:</div>
                      <div className="text-slate-400"># 1. تثبيت حزم المشروع</div>
                      <div className="text-cyan-300 font-bold">npm install</div>
                      <div className="text-slate-400 mt-2"># 2. بناء المشروع لبيئة الإنتاج السريعة والمستقرة</div>
                      <div className="text-cyan-300 font-bold">npm run build</div>
                      <div className="text-slate-400 mt-2"># 3. إطلاق السيرفر الرئيسي</div>
                      <div className="text-amber-300 font-bold">npm start</div>
                    </div>
                  </div>

                  <h4 className="text-sm font-black text-white flex items-center gap-2 pt-2">
                    <span className="w-6 h-6 rounded-full bg-slate-800 border border-slate-700 text-xs flex items-center justify-center font-mono">3</span>
                    تشغيل السيرفر كخدمة دائمة في الخلفية مع الويندوز (PM2)
                  </h4>
                  <div className="pr-8 space-y-2">
                    <p className="text-xs text-slate-300">
                      لضمان بقاء السيرفر يعمل حتى لو تم إغلاق موجه الأوامر وإعادة تشغيله تلقائياً عند فتح الحاسب:
                    </p>
                    <div className="relative rounded-2xl bg-slate-950 border border-slate-800 p-4 font-mono text-xs text-slate-200">
                      <button
                        type="button"
                        onClick={() =>
                          handleCopy(
                            `npm install -g pm2\npm2 start dist/server.cjs --name "orca-express-server"\npm2 save\npm2 startup`,
                            'pm2_cmds'
                          )
                        }
                        className="absolute left-3 top-3 px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-[11px] flex items-center gap-1.5 transition cursor-pointer"
                      >
                        {copiedKey === 'pm2_cmds' ? (
                          <>
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                            <span className="text-emerald-300 font-bold">تم النسخ!</span>
                          </>
                        ) : (
                          <>
                            <Copy className="w-3.5 h-3.5" />
                            <span>نسخ الأوامر</span>
                          </>
                        )}
                      </button>
                      <div className="text-slate-400"># تثبيت وتشغيل PM2</div>
                      <div className="text-cyan-300 font-bold">npm install -g pm2</div>
                      <div className="text-cyan-300 font-bold">pm2 start dist/server.cjs --name "orca-express-server"</div>
                      <div className="text-cyan-300 font-bold">pm2 save</div>
                    </div>
                  </div>
                </div>
              </motion.div>
            )}

            {/* TAB 2: SERVER & FIREWALL CONFIG */}
            {activeTab === 'server' && (
              <motion.div
                key="server"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="space-y-6"
              >
                <div className="p-4 sm:p-5 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 flex items-start gap-3.5">
                  <Server className="w-6 h-6 text-emerald-400 shrink-0 mt-1" />
                  <div>
                    <h3 className="text-sm font-black text-emerald-300">
                      تهيئة الحاسب الرئيسي للعمل كخادم شبكة (Server Host)
                    </h3>
                    <p className="text-xs text-emerald-100/90 mt-1">
                      لكي تتمكن أجهزة الفروع والموظفين من فتح النظام عبر الشبكة، يجب معرفة الـ IP الخاص بالسيرفر والسماح للمنفذ (Port 3000) بالمرور عبر جدار الحماية (Windows Firewall).
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Step A */}
                  <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-2">
                    <h4 className="text-xs font-black text-cyan-300 flex items-center gap-2">
                      <Laptop className="w-4 h-4" />
                      <span>أ. معرفة عنوان IP السيرفر (IPv4)</span>
                    </h4>
                    <p className="text-xs text-slate-300">
                      على الحاسب الرئيسي، افتح <strong>cmd</strong> واكتب الأمر:
                    </p>
                    <div className="p-2.5 rounded-xl bg-slate-900 font-mono text-xs text-amber-300 font-bold flex items-center justify-between">
                      <span>ipconfig</span>
                      <button
                        type="button"
                        onClick={() => handleCopy('ipconfig', 'ipconfig_cmd')}
                        className="text-slate-400 hover:text-white"
                      >
                        <Copy className="w-3.5 h-3.5" />
                      </button>
                    </div>
                    <p className="text-[11px] text-slate-400">
                      ابحث عن السطر المسمى <strong>IPv4 Address</strong> (مثال: <code className="text-emerald-400 font-bold font-mono">192.168.1.50</code>).
                    </p>
                  </div>

                  {/* Step B */}
                  <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-2">
                    <h4 className="text-xs font-black text-emerald-300 flex items-center gap-2">
                      <ShieldCheck className="w-4 h-4" />
                      <span>ب. فتح المنفذ 3000 في جدار حماية الويندوز</span>
                    </h4>
                    <p className="text-xs text-slate-300">
                      افتح <strong>PowerShell كمسؤول (Run as Administrator)</strong> ونفّذ هذا الأمر لفتح المنفذ بضغطة واحدة:
                    </p>
                    <div className="p-2.5 rounded-xl bg-slate-900 font-mono text-[11px] text-emerald-300 font-bold flex items-center justify-between">
                      <span className="truncate max-w-[280px]">netsh advfirewall firewall add rule name="Orca 3000" dir=in action=allow protocol=TCP localport=3000</span>
                      <button
                        type="button"
                        onClick={() =>
                          handleCopy(
                            'netsh advfirewall firewall add rule name="Orca 3000" dir=in action=allow protocol=TCP localport=3000',
                            'firewall_cmd'
                          )
                        }
                        className="text-slate-400 hover:text-white shrink-0 ml-2"
                      >
                        <Copy className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>

                {/* Static IP Recommendation */}
                <div className="p-4 rounded-2xl bg-slate-950/80 border border-slate-800 space-y-2">
                  <h4 className="text-xs font-black text-amber-300 flex items-center gap-2">
                    <Layers className="w-4 h-4" />
                    <span>نصيحة هامة: تثبيت الـ IP (Static IP) للحاسب الرئيسي</span>
                  </h4>
                  <p className="text-xs text-slate-300">
                    يُفضل ضبط الـ IP للحاسب الرئيسي على الراوتر كـ <strong>Static IP</strong> أو <strong>DHCP Reservation</strong> بحيث لا يتغير عند إطفاء وتشغيل الراوتر، ليظل رابط الدخول ثابتاً لجميع الفروع دائماً.
                  </p>
                </div>
              </motion.div>
            )}

            {/* TAB 3: POSTGRESQL INTEGRATION */}
            {activeTab === 'postgres' && (
              <motion.div
                key="postgres"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="space-y-6"
              >
                <div className="p-4 sm:p-5 rounded-2xl bg-indigo-500/10 border border-indigo-500/30 flex items-start gap-3.5">
                  <Database className="w-6 h-6 text-indigo-400 shrink-0 mt-1" />
                  <div>
                    <h3 className="text-sm font-black text-indigo-300">
                      ربط محرك قواعد البيانات PostgreSQL (لأعلى كفاءة وسرعة استعلام)
                    </h3>
                    <p className="text-xs text-indigo-100/90 mt-1">
                      يدعم النظام تلقائياً التخزين المدمج فائق السرعة، ويمكنك بكل سهولة ربط محرك <strong>PostgreSQL</strong> ليعمل كقاعدة بيانات علائقية مركزية تحتمل ملايين الطرود والحركات المالية.
                    </p>
                  </div>
                </div>

                <div className="space-y-4">
                  <h4 className="text-xs font-black text-white flex items-center gap-2">
                    <span className="w-5 h-5 rounded-full bg-slate-800 border border-slate-700 text-xs flex items-center justify-center font-mono">1</span>
                    تثبيت PostgreSQL وإنشاء قاعدة البيانات
                  </h4>
                  <p className="text-xs text-slate-300 pr-7">
                    قم بتنزيل PostgreSQL (الإصدار 15 أو 16) من موقعها الرسمي وافتح أداة <strong>pgAdmin</strong> أو <strong>psql</strong> ونفّذ أمر إنشاء قاعدة البيانات:
                  </p>
                  <div className="pr-7">
                    <div className="p-3 rounded-2xl bg-slate-950 border border-slate-800 font-mono text-xs text-cyan-300 font-bold flex items-center justify-between">
                      <span>CREATE DATABASE orca_express_db;</span>
                      <button
                        type="button"
                        onClick={() => handleCopy('CREATE DATABASE orca_express_db;', 'sql_createdb')}
                        className="text-slate-400 hover:text-white"
                      >
                        <Copy className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  <h4 className="text-xs font-black text-white flex items-center gap-2 pt-2">
                    <span className="w-5 h-5 rounded-full bg-slate-800 border border-slate-700 text-xs flex items-center justify-center font-mono">2</span>
                    التهيئة التلقائية للجداول والفهارس (Auto-Migration)
                  </h4>
                  <p className="text-xs text-slate-300 pr-7">
                    بمجرد تشغيل السيرفر بأمر <code className="text-amber-400 font-mono">npm start</code>، يقوم السيرفر تلقائياً بإنشاء وفحص كافة الجداول والفهارس المتقدمة (<code className="text-cyan-300 font-mono">parcels</code>, <code className="text-cyan-300 font-mono">cashbox_transactions</code>, <code className="text-cyan-300 font-mono">branches</code>, <code className="text-cyan-300 font-mono">shift_settlements</code>) بدون الحاجة لكتابة أي كود يدوي.
                  </p>
                </div>
              </motion.div>
            )}

            {/* TAB 4: BRANCH CONNECTIVITY */}
            {activeTab === 'branches' && (
              <motion.div
                key="branches"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="space-y-6"
              >
                <div className="p-4 sm:p-5 rounded-2xl bg-cyan-500/10 border border-cyan-500/30 flex items-start gap-3.5">
                  <Network className="w-6 h-6 text-cyan-400 shrink-0 mt-1" />
                  <div>
                    <h3 className="text-sm font-black text-cyan-300">
                      طريقة دخول وربط أجهزة الفروع مع السيرفر الرئيسي
                    </h3>
                    <p className="text-xs text-cyan-100/90 mt-1">
                      يدعم النظام سيناريوهات العمل المرنة: سواء كانت الفروع متصلة عبر الشبكة المحلية (LAN) بنفس المقر، أو فروع متباعدة جغرافياً في مدن مختلفة عبر الإنترنت أو VPN.
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Scenario 1: LAN */}
                  <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-2.5">
                    <div className="flex items-center justify-between">
                      <h4 className="text-xs font-black text-emerald-300 flex items-center gap-1.5">
                        <Building2 className="w-4 h-4" />
                        <span>السيناريو 1: الفرع في نفس المبنى (شبكة LAN / Wi-Fi)</span>
                      </h4>
                      <span className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 text-[10px] font-bold">
                        محلي
                      </span>
                    </div>
                    <p className="text-xs text-slate-300">
                      من جهاز الموظف في الفرع، افتح متصفح الويب (Google Chrome أو Edge) واكتب في شريط العنوان:
                    </p>
                    <div className="p-2.5 rounded-xl bg-slate-900 font-mono text-xs text-cyan-300 font-bold flex items-center justify-between">
                      <span>http://192.168.1.50:3000</span>
                      <button
                        type="button"
                        onClick={() => handleCopy('http://192.168.1.50:3000', 'lan_url')}
                        className="text-slate-400 hover:text-white"
                      >
                        <Copy className="w-3.5 h-3.5" />
                      </button>
                    </div>
                    <p className="text-[11px] text-slate-400">
                      *(استبدل <code className="text-amber-400 font-mono">192.168.1.50</code> بـ IP السيرفر الحقيقي لديك)*
                    </p>
                  </div>

                  {/* Scenario 2: WAN / VPN */}
                  <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-2.5">
                    <div className="flex items-center justify-between">
                      <h4 className="text-xs font-black text-cyan-300 flex items-center gap-1.5">
                        <Globe className="w-4 h-4" />
                        <span>السيناريو 2: الفروع في مدن مختلفة (عبر VPN أو السيرفر السحابي)</span>
                      </h4>
                      <span className="px-2 py-0.5 rounded bg-cyan-500/20 text-cyan-300 text-[10px] font-bold">
                        عبر المدن
                      </span>
                    </div>
                    <p className="text-xs text-slate-300">
                      استخدم شبكة VPN خاصة مجانية وسريعة جداً مثل <strong>Tailscale</strong> أو <strong>ZeroTier</strong>، وثبّتها على السيرفر وجهاز الفرع:
                    </p>
                    <div className="p-2.5 rounded-xl bg-slate-900 font-mono text-xs text-amber-300 font-bold flex items-center justify-between">
                      <span>http://100.85.20.10:3000</span>
                      <button
                        type="button"
                        onClick={() => handleCopy('http://100.85.20.10:3000', 'vpn_url')}
                        className="text-slate-400 hover:text-white"
                      >
                        <Copy className="w-3.5 h-3.5" />
                      </button>
                    </div>
                    <p className="text-[11px] text-slate-400">
                      يمنحك الـ VPN اتصالاً مشفراً وآمناً ومباشراً مع السيرفر الرئيسي من أي مكان في العالم.
                    </p>
                  </div>
                </div>

                {/* Login & Role Selection on Branch Device */}
                <div className="p-4 rounded-2xl bg-slate-950/80 border border-slate-800 space-y-2">
                  <h4 className="text-xs font-black text-white flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                    <span>خطوات تسجيل دخول موظف الفرع:</span>
                  </h4>
                  <ul className="text-xs text-slate-300 space-y-1.5 list-disc list-inside pr-2">
                    <li>بمجرد فتح الرابط، ستظهر واجهة الدخول الموحدة أمام موظف الفرع.</li>
                    <li>يدخل موظف الفرع اسم المستخدم الخاص به (مثلاً: <code className="text-cyan-300 font-mono">damascus_entry</code> أو <code className="text-cyan-300 font-mono">aleppo_cashier</code>).</li>
                    <li>يقوم النظام فوراً باكتشاف الفرع التابع له وتخصيص الشاشات والصلاحيات (تسليم، استلام، منافست، صندوق الوردية).</li>
                  </ul>
                </div>
              </motion.div>
            )}

            {/* TAB 5: REALTIME SYNC & OFFLINE */}
            {activeTab === 'sync' && (
              <motion.div
                key="sync"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="space-y-6"
              >
                <div className="p-4 sm:p-5 rounded-2xl bg-purple-500/10 border border-purple-500/30 flex items-start gap-3.5">
                  <Radio className="w-6 h-6 text-purple-400 shrink-0 mt-1 animate-pulse" />
                  <div>
                    <h3 className="text-sm font-black text-purple-300">
                      محرك المزامنة اللحظية (vpsSyncEngine) وآلية العمل بدون إنترنت
                    </h3>
                    <p className="text-xs text-purple-100/90 mt-1">
                      تم تصميم النظام بمحرك مزامنة هجين فائق الذكاء، يتيح لجميع الأجهزة العمل المتزامن بدون تعارضات، مع صمود كامل ضد انقطاع الشبكة.
                    </p>
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-2">
                    <h4 className="text-xs font-black text-emerald-300 flex items-center gap-2">
                      <Sparkles className="w-4 h-4" />
                      <span>كيف تظهر التعديلات لحظياً بين السيرفر والفروع؟</span>
                    </h4>
                    <p className="text-xs text-slate-300 leading-relaxed">
                      عند قيام أي موظف في أي فرع بإنشاء طرد جديد، أو تسليم شحنة، أو تحصيل مبلغ COD، أو تسجيل سند ترصيد:
                    </p>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-1 text-center font-bold text-xs">
                      <div className="p-3 rounded-xl bg-slate-900 border border-slate-800 text-slate-200">
                        1. حفظ وتأكيد العملية محلياً بسرعة البرق (0ms)
                      </div>
                      <div className="p-3 rounded-xl bg-slate-900 border border-slate-800 text-cyan-300">
                        2. إرسال وتخزين فوري في PostgreSQL على السيرفر
                      </div>
                      <div className="p-3 rounded-xl bg-slate-900 border border-slate-800 text-emerald-300">
                        3. بث التحديث لكافة أجهزة الفروع والشاشات بدون تحديث الصفحة
                      </div>
                    </div>
                  </div>

                  <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-2">
                    <h4 className="text-xs font-black text-amber-300 flex items-center gap-2">
                      <HardDrive className="w-4 h-4" />
                      <span>ماذا يحدث إذا انقطع الاتصال أو شبكة الإنترنت في الفرع؟ (Offline Resilience)</span>
                    </h4>
                    <p className="text-xs text-slate-300 leading-relaxed">
                      يستمر موظف الفرع في إدخال الشحنات وطباعة الباركود والعمل بشكل طبيعي 100%. يقوم النظام بتخزين العمليات في طابور محلي مشفر (<code className="text-amber-400 font-mono">Offline Queue</code>)، وبمجرد عودة الاتصال يقوم النظام تلقائياً برفع وتحديث كافة السجلات ومطابقتها مع السيرفر الرئيسي دون فقدان أي بيانات نهائياً.
                    </p>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* MODAL FOOTER */}
        <div className="shrink-0 px-6 py-3.5 bg-slate-950 border-t border-slate-800 flex items-center justify-between text-xs text-slate-400">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-slate-300 font-bold">النظام جاهز للتشغيل والتوزيع على شبكة الفروع</span>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-bold transition cursor-pointer"
          >
            إغلاق الدليل
          </button>
        </div>
      </motion.div>
    </div>
  );
};
