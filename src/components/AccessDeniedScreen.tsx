import React from 'react';
import { useOrca } from '../context/OrcaContext';
import { ShieldAlert, ArrowRight, Lock, CheckCircle2, Home } from 'lucide-react';
import { ROLE_DEFINITIONS } from '../utils/permissionEngine';
import { ActiveModule } from '../types';

interface AccessDeniedScreenProps {
  attemptedModule: ActiveModule;
  onGoToPrimaryModule?: () => void;
  onGoToDesktop?: () => void;
}

export const AccessDeniedScreen: React.FC<AccessDeniedScreenProps> = ({
  attemptedModule,
  onGoToPrimaryModule,
  onGoToDesktop,
}) => {
  const { currentUser, setActiveModule, canAccessModule } = useOrca();

  const roleDef = ROLE_DEFINITIONS[currentUser.role] || {
    title: currentUser.role,
    subtitle: 'دور مستخدم',
    badgeColor: 'bg-slate-800 text-slate-300 border-slate-700',
    allowedModules: ['intake'],
    primaryModule: 'intake' as ActiveModule,
    forbiddenDescription: 'الواجهة غير متاحة لهذا الحساب',
  };

  const handleReturnPrimary = () => {
    if (onGoToPrimaryModule) {
      onGoToPrimaryModule();
    } else {
      setActiveModule(roleDef.primaryModule);
    }
  };

  const getModuleName = (mod: string): string => {
    switch (mod) {
      case 'dashboard':
        return 'لوحة التحكم والعمليات';
      case 'intake':
        return 'تسجيل وإدخال طرود الصادر';
      case 'manifests':
        return 'مانافيست الشاحنات والمغادرة';
      case 'arrivals':
        return 'مستودع الوارد وتفريغ الشاحنات';
      case 'delivery':
        return 'قسم التسليم وتوثيق الهويات';
      case 'cashbox':
        return 'حركة الصناديق والمحاسبة المالية';
      case 'pricing':
        return 'محرك التسعير وحساب المسافات';
      case 'admin_users':
        return 'إدارة المستخدمين والفروع';
      case 'backup_cloud':
        return 'النسخ الاحتياطي واستعادة البيانات';
      case 'master_admin':
        return 'بوابة الإدارة السيادية العليا';
      case 'customers':
        return 'دليل وبطاقات العملاء';
      case 'vehicles':
        return 'أسطول الشاحنات والمركبات';
      case 'employees_payroll':
      case 'payroll':
        return 'سجل الرواتب والموظفين';
      case 'expenses':
        return 'دليل المصاريف التشغيلية';
      case 'fixed_assets':
        return 'إدارة الأصول الثابتة وتجهيزات الفروع';
      default:
        return mod;
    }
  };

  return (
    <div className="min-h-[70vh] flex items-center justify-center p-4">
      <div className="w-full max-w-xl bg-slate-900/95 border border-rose-500/30 rounded-3xl p-6 sm:p-8 shadow-2xl shadow-black/80 backdrop-blur-xl text-slate-100 text-center relative overflow-hidden">
        {/* Glow effect */}
        <div className="absolute -top-24 -left-24 w-48 h-48 bg-rose-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-24 -right-24 w-48 h-48 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />

        {/* Header Icon */}
        <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-rose-500/15 border border-rose-500/30 flex items-center justify-center text-rose-400 shadow-lg shadow-rose-500/10">
          <ShieldAlert className="w-8 h-8" />
        </div>

        {/* Title */}
        <h2 className="text-xl sm:text-2xl font-black text-white mb-2">
          هذه الواجهة محجوبة عن صلاحيات دورك
        </h2>

        {/* Description */}
        <p className="text-xs sm:text-sm text-slate-300 mb-6 leading-relaxed max-w-md mx-auto">
          وفقاً لضبط محرك الصلاحيات الصارم ومنع تداخل الأدوار، لا يملك حسابك حق الوصول إلى واجهة:{' '}
          <span className="font-bold text-rose-300 underline underline-offset-4">
            {getModuleName(attemptedModule)}
          </span>
        </p>

        {/* User Role Card */}
        <div className="bg-slate-950/70 border border-slate-800 rounded-2xl p-4 mb-6 text-right">
          <div className="flex items-center justify-between gap-2 mb-2 pb-2 border-b border-slate-850">
            <span className="text-xs text-slate-400">حسابك الحالي:</span>
            <span className={`px-2.5 py-0.5 rounded-lg text-xs font-bold border ${roleDef.badgeColor}`}>
              {roleDef.title}
            </span>
          </div>

          <p className="text-xs text-slate-400 mb-3">{roleDef.subtitle}</p>

          <div className="pt-2 border-t border-slate-850">
            <span className="text-[11px] font-bold text-slate-400 block mb-2">
              الواجهات المصرح لك بدخولها رسمياً:
            </span>
            <div className="flex flex-wrap gap-1.5">
              {roleDef.allowedModules.map((m) => (
                <button
                  key={m}
                  onClick={() => setActiveModule(m as ActiveModule)}
                  className="px-2.5 py-1 rounded-lg bg-cyan-950/40 hover:bg-cyan-900/60 border border-cyan-800/50 text-cyan-300 text-xs font-bold flex items-center gap-1 transition"
                >
                  <CheckCircle2 className="w-3 h-3 text-cyan-400" />
                  <span>{getModuleName(m)}</span>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
          <button
            onClick={handleReturnPrimary}
            className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white font-bold text-xs shadow-lg shadow-cyan-500/20 flex items-center justify-center gap-2 transition active:scale-95 cursor-pointer"
          >
            <span>الانتقال إلى واجهتي الأساسية ({getModuleName(roleDef.primaryModule)})</span>
            <ArrowRight className="w-4 h-4" />
          </button>

          {onGoToDesktop && (
            <button
              onClick={onGoToDesktop}
              className="w-full sm:w-auto px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-750 border border-slate-700 text-slate-200 font-bold text-xs flex items-center justify-center gap-2 transition active:scale-95 cursor-pointer"
            >
              <Home className="w-3.5 h-3.5" />
              <span>العودة لسطح المكتب</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
