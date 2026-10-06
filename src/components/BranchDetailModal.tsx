import React, { useState } from 'react';
import { useOrca } from '../context/OrcaContext';
import { Branch } from '../types';
import {
  X,
  Building,
  MapPin,
  Phone,
  UserCheck,
  Coins,
  Package,
  Truck,
  Users,
  Receipt,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
  MessageSquare,
  Printer,
  ArrowUpRight,
  ArrowDownLeft,
  Calendar,
  Shield,
  Layers,
} from 'lucide-react';
import { AdminDirectivesModal } from './AdminDirectivesModal';

interface BranchDetailModalProps {
  branch: Branch | null;
  isOpen: boolean;
  onClose: () => void;
}

export const BranchDetailModal: React.FC<BranchDetailModalProps> = ({
  branch,
  isOpen,
  onClose,
}) => {
  const {
    branches,
    currentBranch,
    parcels,
    truckManifests,
    employees,
    expenses,
    transactions,
    currentUser,
    setActiveModule,
    formatCurrency,
    formatQuantity,
    calculateBranchLiveBalance,
  } = useOrca();

  const [activeTab, setActiveTab] = useState<'overview' | 'parcels' | 'trucks' | 'employees' | 'expenses'>('overview');
  const [isDirectivesOpen, setIsDirectivesOpen] = useState(false);

  if (!isOpen || !branch) return null;

  const isCurrentActive = currentBranch.id === branch.id;

  // Filtered data for this specific branch
  const branchOutboundParcels = parcels.filter((p) => p.originHubId === branch.id);
  const branchInboundParcels = parcels.filter((p) => p.destinationHubId === branch.id);
  
  const branchTrucks = truckManifests.filter(
    (m) => m.originHubId === branch.id || m.destinationHubId === branch.id
  );

  const branchEmployees = employees.filter((e) => e.branchId === branch.id);
  const branchExpenses = expenses.filter((e) => e.branchId === branch.id);
  const branchTransactions = transactions.filter((t) => t.branchId === branch.id);

  const totalExpensesSyp = branchExpenses
    .filter((e) => e.currency === 'SYP' && e.status === 'approved')
    .reduce((acc, e) => acc + e.amount, 0);

  const totalExpensesUsd = branchExpenses
    .filter((e) => e.currency === 'USD' && e.status === 'approved')
    .reduce((acc, e) => acc + e.amount, 0);

  return (
    <>
      <div className="fixed inset-0 z-50 overflow-y-auto bg-black/85 backdrop-blur-md flex items-center justify-center p-3 sm:p-5">
        <div className="bg-slate-900 border border-slate-700/80 rounded-2xl w-full max-w-5xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh] text-slate-100">
          
          {/* Header */}
          <div className="p-4 sm:p-5 bg-gradient-to-r from-slate-900 via-slate-850 to-cyan-950 border-b border-slate-800 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-cyan-600/20 border border-cyan-500/40 flex items-center justify-center text-cyan-400 shadow-inner">
                <Building className="w-6 h-6" />
              </div>
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="text-base sm:text-lg font-black text-white">
                    بطاقة وسجل الفرع: {branch.name}
                  </h2>
                  <span
                    className={`text-[11px] px-2.5 py-0.5 rounded-full font-bold border ${
                      branch.type === 'main_hub'
                        ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                        : 'bg-indigo-500/20 text-indigo-300 border-indigo-500/40'
                    }`}
                  >
                    {branch.type === 'main_hub'
                      ? 'رئيسي'
                      : `فرعي${
                          branch.parentHubId
                            ? ` (تابع لـ: ${branches.find((p) => p.id === branch.parentHubId)?.name || 'الرئيسي'})`
                            : ''
                        }`}
                  </span>
                  <span className="text-xs text-slate-400 font-mono bg-slate-800 px-2 py-0.5 rounded border border-slate-700">
                    كود: {branch.code}
                  </span>
                </div>
                <p className="text-xs text-slate-400 mt-0.5 flex items-center gap-2">
                  <MapPin className="w-3.5 h-3.5 text-rose-400" />
                  <span>محافظة {branch.governorate} • {branch.address || 'العنوان الرئيسي'}</span>
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {isCurrentActive && (
                <span className="px-3 py-1.5 rounded-xl text-xs font-bold bg-emerald-950/80 border border-emerald-700/80 text-emerald-300 flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>الفرع النشط حالياً للجلسة</span>
                </span>
              )}

              <button
                onClick={onClose}
                className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-all"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Quick Metrics Bar */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 p-3.5 bg-slate-950/80 border-b border-slate-800 text-xs">
            <div className="p-2.5 bg-slate-900 rounded-xl border border-slate-800">
              <span className="text-[10px] text-slate-400 block mb-0.5">رصيد الصندوق (ل.س)</span>
              <span className="text-base font-black font-mono text-emerald-400">
                {formatCurrency(calculateBranchLiveBalance(branch.id, 'SYP'), 'SYP')}
              </span>
            </div>

            <div className="p-2.5 bg-slate-900 rounded-xl border border-slate-800">
              <span className="text-[10px] text-slate-400 block mb-0.5">رصيد الدولار ($)</span>
              <span className="text-base font-black font-mono text-cyan-300">
                {formatCurrency(calculateBranchLiveBalance(branch.id, 'USD'), 'USD')}
              </span>
            </div>

            <div className="p-2.5 bg-slate-900 rounded-xl border border-slate-800">
              <span className="text-[10px] text-slate-400 block mb-0.5">الطرود المسجلة</span>
              <div className="flex items-center gap-2 font-mono font-bold">
                <span className="text-cyan-400">{formatQuantity(branchOutboundParcels.length, 'صادر')}</span>
                <span className="text-slate-600">/</span>
                <span className="text-amber-400">{formatQuantity(branchInboundParcels.length, 'وارد')}</span>
              </div>
            </div>

            <div className="p-2.5 bg-slate-900 rounded-xl border border-slate-800">
              <span className="text-[10px] text-slate-400 block mb-0.5">الكادر والمصاريف</span>
              <div className="flex items-center justify-between font-mono">
                <span className="text-white font-bold">{branchEmployees.length} موظف</span>
                <span className="text-rose-400 font-bold">{formatCurrency(totalExpensesSyp || 0, 'SYP')}</span>
              </div>
            </div>
          </div>

          {/* Tab Navigation */}
          <div className="flex items-center gap-1.5 px-4 pt-3 border-b border-slate-800 bg-slate-900/60 text-xs">
            <button
              onClick={() => setActiveTab('overview')}
              className={`px-3.5 py-2 rounded-t-xl font-bold transition-all ${
                activeTab === 'overview'
                  ? 'bg-slate-800 text-cyan-300 border-b-2 border-cyan-400'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              نظرة عامة والبيانات الرسمية
            </button>
            <button
              onClick={() => setActiveTab('parcels')}
              className={`px-3.5 py-2 rounded-t-xl font-bold transition-all ${
                activeTab === 'parcels'
                  ? 'bg-slate-800 text-cyan-300 border-b-2 border-cyan-400'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              طرود الفرع ({branchOutboundParcels.length + branchInboundParcels.length})
            </button>
            <button
              onClick={() => setActiveTab('trucks')}
              className={`px-3.5 py-2 rounded-t-xl font-bold transition-all ${
                activeTab === 'trucks'
                  ? 'bg-slate-800 text-cyan-300 border-b-2 border-cyan-400'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              شاحنات الترحيل ({branchTrucks.length})
            </button>
            <button
              onClick={() => setActiveTab('employees')}
              className={`px-3.5 py-2 rounded-t-xl font-bold transition-all ${
                activeTab === 'employees'
                  ? 'bg-slate-800 text-cyan-300 border-b-2 border-cyan-400'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              كادر الموظفين ({branchEmployees.length})
            </button>
            <button
              onClick={() => setActiveTab('expenses')}
              className={`px-3.5 py-2 rounded-t-xl font-bold transition-all ${
                activeTab === 'expenses'
                  ? 'bg-slate-800 text-cyan-300 border-b-2 border-cyan-400'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              سجل المصاريف ({branchExpenses.length})
            </button>
          </div>

          {/* Scrollable Tab Content */}
          <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4 text-xs">
            {activeTab === 'overview' && (
              <div className="space-y-4">
                {/* Official Contact & Manager Card */}
                <div className="bg-slate-950/80 border border-slate-800 rounded-2xl p-4">
                  <h3 className="text-xs font-bold text-white mb-3 flex items-center gap-2">
                    <UserCheck className="w-4 h-4 text-cyan-400" />
                    بيانات الاتصال والإدارة المسؤولة
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div className="p-3 bg-slate-900 rounded-xl border border-slate-800">
                      <span className="text-slate-400 block text-[11px]">مدير الفرع المعتمد:</span>
                      <strong className="text-white text-sm">{branch.managerName || 'غير محدد'}</strong>
                    </div>
                    <div className="p-3 bg-slate-900 rounded-xl border border-slate-800">
                      <span className="text-slate-400 block text-[11px]">هاتف الفرع:</span>
                      <strong className="text-cyan-300 font-mono text-sm">{branch.phone || 'غير مسجل'}</strong>
                    </div>
                    <div className="p-3 bg-slate-900 rounded-xl border border-slate-800">
                      <span className="text-slate-400 block text-[11px]">نسبة عمولة الشحن:</span>
                      <strong className="text-amber-300 font-mono text-sm">{branch.commissionRateShipping || 15}%</strong>
                    </div>
                  </div>
                </div>

                {/* Quick Directive / Action Section */}
                <div className="bg-gradient-to-r from-amber-950/30 to-orange-950/30 border border-amber-500/30 rounded-2xl p-4 flex flex-col sm:flex-row items-center justify-between gap-3">
                  <div>
                    <h4 className="font-bold text-amber-300 text-xs flex items-center gap-1.5">
                      <MessageSquare className="w-4 h-4" />
                      توجيه إداري مباشر لفرع {branch.name}
                    </h4>
                    <p className="text-[11px] text-slate-300 mt-0.5">
                      إرسال تعميم إداري أو توجيه خاص يصل لكادر الفرع ومديره فوراً مع إشعار عاجل.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setIsDirectivesOpen(true)}
                    className="px-4 py-2 bg-amber-600 hover:bg-amber-500 text-white rounded-xl font-bold text-xs shadow-md transition whitespace-nowrap"
                  >
                    فتح نافذة التوجيهات
                  </button>
                </div>
              </div>
            )}

            {activeTab === 'parcels' && (
              <div className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Outbound */}
                  <div className="bg-slate-950/80 border border-slate-800 rounded-2xl p-4">
                    <h4 className="font-bold text-cyan-300 text-xs mb-3 flex items-center gap-2">
                      <ArrowUpRight className="w-4 h-4 text-cyan-400" />
                      الطرود الصادرة من هذا الفرع ({branchOutboundParcels.length})
                    </h4>
                    {branchOutboundParcels.length === 0 ? (
                      <div className="text-center py-6 text-slate-500">لا توجد طرود صادرة مسجلة</div>
                    ) : (
                      <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                        {branchOutboundParcels.slice(0, 10).map((p) => (
                          <div key={p.id} className="p-2 bg-slate-900 rounded-lg border border-slate-800 flex items-center justify-between text-[11px]">
                            <div>
                              <span className="font-mono font-bold text-white">{p.trackingNumber}</span>
                              <span className="text-slate-400 block">{p.senderName} ➔ {p.receiverName}</span>
                            </div>
                            <span className="font-mono font-bold text-cyan-400">
                              {formatCurrency(p.priceSyp || 0, 'SYP')}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Inbound */}
                  <div className="bg-slate-950/80 border border-slate-800 rounded-2xl p-4">
                    <h4 className="font-bold text-amber-300 text-xs mb-3 flex items-center gap-2">
                      <ArrowDownLeft className="w-4 h-4 text-amber-400" />
                      الطرود الواردة إلى هذا الفرع ({branchInboundParcels.length})
                    </h4>
                    {branchInboundParcels.length === 0 ? (
                      <div className="text-center py-6 text-slate-500">لا توجد طرود واردة مسجلة</div>
                    ) : (
                      <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                        {branchInboundParcels.slice(0, 10).map((p) => (
                          <div key={p.id} className="p-2 bg-slate-900 rounded-lg border border-slate-800 flex items-center justify-between text-[11px]">
                            <div>
                              <span className="font-mono font-bold text-white">{p.trackingNumber}</span>
                              <span className="text-slate-400 block">{p.senderName} ➔ {p.receiverName}</span>
                            </div>
                            <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                              p.handlingStatus === 'delivered' ? 'bg-emerald-950 text-emerald-300' : 'bg-amber-950 text-amber-300'
                            }`}>
                              {p.handlingStatus === 'delivered' ? 'تم التسليم' : 'قيد المعالجة'}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'trucks' && (
              <div className="space-y-3">
                {branchTrucks.length === 0 ? (
                  <div className="text-center py-10 text-slate-500">لا توجد شاحنات مرتبطة بهذا الفرع حالياً</div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {branchTrucks.map((t) => (
                      <div key={t.id} className="bg-slate-950 p-3.5 rounded-xl border border-slate-800">
                        <div className="flex items-center justify-between mb-2">
                          <span className="font-bold text-white">{t.manifestNumber}</span>
                          <span className="text-amber-300 font-mono text-[11px] bg-slate-900 px-2 py-0.5 rounded border border-slate-800">
                            {t.truckPlate}
                          </span>
                        </div>
                        <div className="text-slate-400 text-[11px] space-y-1">
                          <div>السائق: <strong className="text-white">{t.driverName}</strong> ({t.driverPhone})</div>
                          <div>عدد الطرود: <strong className="text-cyan-400 font-mono">{formatQuantity(t.parcelsCount || t.parcelIds?.length || 0, 'طرد')}</strong></div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {activeTab === 'employees' && (
              <div className="space-y-3">
                {branchEmployees.length === 0 ? (
                  <div className="text-center py-10 text-slate-500">لا يوجد موظفون مسجلون بهذا الفرع بعد</div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {branchEmployees.map((emp) => (
                      <div key={emp.id} className="bg-slate-950 p-3.5 rounded-xl border border-slate-800 flex items-center justify-between">
                        <div>
                          <span className="font-bold text-white block">{emp.fullName}</span>
                          <span className="text-slate-400 text-[11px]">{emp.jobTitle} • {emp.phone}</span>
                        </div>
                        <span className="font-mono text-emerald-400 font-bold text-xs">
                          {formatCurrency(emp.basicSalary || 0, emp.salaryCurrency || 'SYP')}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {activeTab === 'expenses' && (
              <div className="space-y-3">
                {branchExpenses.length === 0 ? (
                  <div className="text-center py-10 text-slate-500">لا توجد مصاريف مسجلة لهذا الفرع</div>
                ) : (
                  <div className="space-y-2">
                    {branchExpenses.map((exp) => (
                      <div key={exp.id} className="bg-slate-950 p-3 rounded-xl border border-slate-800 flex items-center justify-between">
                        <div>
                          <span className="font-bold text-white">{exp.title}</span>
                          <span className="text-slate-400 text-[11px] block">{exp.category} • {exp.date}</span>
                        </div>
                        <div className="text-left font-mono">
                          <span className="font-bold text-rose-400">
                            {formatCurrency(exp.amount || 0, exp.currency || 'SYP')}
                          </span>
                          <span className={`block text-[10px] font-bold ${
                            exp.status === 'approved' ? 'text-emerald-400' : 'text-amber-400'
                          }`}>
                            {exp.status === 'approved' ? 'معتمد' : 'قيد الموافقة'}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="p-4 bg-slate-950 border-t border-slate-800 flex items-center justify-between">
            <span className="text-[11px] text-slate-500 font-mono">
              معرف الفرع: {branch.id}
            </span>
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-xs font-bold transition"
            >
              إغلاق النافذة
            </button>
          </div>
        </div>
      </div>

      {/* Directives Modal */}
      <AdminDirectivesModal
        isOpen={isDirectivesOpen}
        onClose={() => setIsDirectivesOpen(false)}
        defaultRecipientBranchId={branch.id}
      />
    </>
  );
};
