import React, { useState, useEffect } from 'react';
import { useOrca } from '../context/OrcaContext';
import { safeStorage, safePrint } from '../utils/storage';
import { Employee, PayrollRecord, Currency } from '../types';
import {
  blockNonAmountKeys,
  blockNonIntegerKeys,
  blockNonPhoneKeys,
  sanitizeDecimal,
  sanitizeDigitsOnly,
  sanitizePhone,
} from '../utils/numberSanitizer';
import {
  UserCheck,
  Users,
  DollarSign,
  Plus,
  Edit2,
  Trash2,
  CheckCircle,
  Search,
  Building,
  Phone,
  CreditCard,
  Briefcase,
  FileSpreadsheet,
  Printer,
  Calendar,
  Layers,
  ArrowDownLeft,
  X,
  AlertCircle,
  Check,
} from 'lucide-react';

export const EmployeePayrollView: React.FC = () => {
  const {
    employees,
    payrollRecords,
    branches,
    currentBranch,
    currentUser,
    addEmployee,
    updateEmployee,
    deleteEmployee,
    createPayrollRecord,
    payPayrollRecord,
    formatCurrency,
    formatNumber,
  } = useOrca();

  const [activeTab, setActiveTab] = useState<'employees' | 'payroll'>(() => {
    try {
      const saved = safeStorage.getItem('orca_employee_payroll_tab');
      if (saved) return saved as any;
    } catch {}
    return 'employees';
  });

  useEffect(() => {
    try {
      safeStorage.setItem('orca_employee_payroll_tab', activeTab);
    } catch {}
  }, [activeTab]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedBranch, setSelectedBranch] = useState<string>('all');
  const [selectedMonth, setSelectedMonth] = useState<string>(
    `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`
  );

  // Modals
  const [isEmployeeModalOpen, setIsEmployeeModalOpen] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState<Employee | null>(null);
  const [isGeneratePayrollOpen, setIsGeneratePayrollOpen] = useState(false);
  const [selectedPayrollForPrint, setSelectedPayrollForPrint] = useState<PayrollRecord | null>(null);

  // Employee Form State
  const [employeeFormData, setEmployeeFormData] = useState({
    fullName: '',
    nationalId: '',
    phone: '',
    jobTitle: 'أمين صندوق وصراف',
    role: 'cashier' as any,
    branchId: currentBranch.id,
    hireDate: new Date().toISOString().split('T')[0],
    basicSalary: 0,
    salaryCurrency: 'SYP' as Currency,
    transportAllowance: 0,
    housingAllowance: 0,
    standardDeductions: 0,
    bonusRate: 0,
    bankNameOrIban: '',
    status: 'active' as any,
    notes: '',
  });

  const openAddEmployee = () => {
    setEditingEmployee(null);
    setEmployeeFormData({
      fullName: '',
      nationalId: '',
      phone: '',
      jobTitle: 'أمين صندوق وصراف',
      role: 'cashier',
      branchId: currentBranch.id,
      hireDate: new Date().toISOString().split('T')[0],
      basicSalary: 0,
      salaryCurrency: 'SYP',
      transportAllowance: 0,
      housingAllowance: 0,
      standardDeductions: 0,
      bonusRate: 0,
      bankNameOrIban: '',
      status: 'active',
      notes: '',
    });
    setIsEmployeeModalOpen(true);
  };

  const openEditEmployee = (emp: Employee) => {
    setEditingEmployee(emp);
    setEmployeeFormData({
      fullName: emp.fullName,
      nationalId: emp.nationalId || '',
      phone: emp.phone,
      jobTitle: emp.jobTitle,
      role: emp.role,
      branchId: emp.branchId,
      hireDate: emp.hireDate || '',
      basicSalary: emp.basicSalary,
      salaryCurrency: emp.salaryCurrency || 'SYP',
      transportAllowance: emp.transportAllowance || 0,
      housingAllowance: emp.housingAllowance || 0,
      standardDeductions: emp.standardDeductions || 0,
      bonusRate: emp.bonusRate || 0,
      bankNameOrIban: emp.bankNameOrIban || '',
      status: emp.status,
      notes: emp.notes || '',
    });
    setIsEmployeeModalOpen(true);
  };

  const handleSaveEmployee = (e: React.FormEvent) => {
    e.preventDefault();
    if (!employeeFormData.fullName.trim() || !employeeFormData.phone.trim()) {
      alert('يرجى كتابة اسم الموظف ورقم الهاتف');
      return;
    }

    if (editingEmployee) {
      updateEmployee(editingEmployee.id, employeeFormData);
    } else {
      addEmployee(employeeFormData);
    }
    setIsEmployeeModalOpen(false);
  };

  const handleDeleteEmployee = (id: string, name: string) => {
    if (confirm(`هل أنت متأكد من حذف الموظف [${name}] من الدليل؟`)) {
      deleteEmployee(id);
    }
  };

  // Generate payroll batch for all active employees for the selected month
  const handleGenerateMonthlyPayrollBatch = () => {
    const activeStaff = employees.filter((e) => e.status === 'active');
    let generatedCount = 0;

    activeStaff.forEach((emp) => {
      // Check if already created for this month
      const exists = payrollRecords.some(
        (p) => p.employeeId === emp.id && p.month === selectedMonth
      );
      if (!exists) {
        const allowances = (emp.transportAllowance || 0) + (emp.housingAllowance || 0);
        const deductions = emp.standardDeductions || 0;
        const net = emp.basicSalary + allowances - deductions;

        createPayrollRecord({
          employeeId: emp.id,
          employeeName: emp.fullName,
          branchId: emp.branchId,
          month: selectedMonth,
          basicSalary: emp.basicSalary,
          allowances,
          overtimeAmount: 0,
          bonusAmount: 0,
          deductions,
          advanceDeductions: 0,
          netPayable: net,
          currency: emp.currency,
          status: 'pending',
          createdAt: new Date().toISOString(),
        });
        generatedCount++;
      }
    });

    alert(`تم إصدار كشوفات الرواتب لـ ${generatedCount} موظف لشهر ${selectedMonth}`);
    setIsGeneratePayrollOpen(false);
  };

  const handlePaySalary = (record: PayrollRecord) => {
    const method = confirm('هل ترغب بالصرف نقداً من خزينة الفرع (يخصم من الصندوق)؟\nاضغط [موافق] للصرف من الخزينة، أو [إلغاء] للصرف عبر تحويل بنكي.')
      ? 'cash_box'
      : 'bank_transfer';

    payPayrollRecord(record.id, method);
  };

  const getBranchName = (bId: string) => {
    const b = branches.find((item) => item.id === bId);
    return b ? b.name : bId;
  };

  // Filter employees
  const filteredEmployees = employees.filter((e) => {
    const matchSearch =
      e.fullName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      e.jobTitle.toLowerCase().includes(searchTerm.toLowerCase()) ||
      e.phone.includes(searchTerm) ||
      (e.nationalId && e.nationalId.includes(searchTerm)) ||
      (e.code && e.code.toLowerCase().includes(searchTerm.toLowerCase()));

    const matchBranch = selectedBranch === 'all' || e.branchId === selectedBranch;
    return matchSearch && matchBranch;
  });

  // Filter payroll records
  const filteredPayroll = payrollRecords.filter((p) => {
    const matchMonth = p.month === selectedMonth;
    const matchBranch = selectedBranch === 'all' || p.branchId === selectedBranch;
    const matchSearch =
      p.employeeName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.payrollNumber.toLowerCase().includes(searchTerm.toLowerCase());

    return matchMonth && matchBranch && matchSearch;
  });

  const totalSalariesSyp = employees
    .filter((e) => (e.salaryCurrency || e.currency || 'SYP') === 'SYP' && e.status === 'active')
    .reduce(
      (acc, e) =>
        acc +
        (e.basicSalary || 0) +
        (e.transportAllowance || 0) +
        (e.housingAllowance || 0) -
        (e.standardDeductions || 0),
      0
    );

  const totalPayrollPaidCount = filteredPayroll.filter((p) => p.status === 'paid').length;
  const totalPayrollPendingCount = filteredPayroll.filter((p) => p.status === 'pending').length;

  return (
    <div className="space-y-6">
      {/* Header & Main Tabs */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <UserCheck className="w-6 h-6 text-emerald-400" />
            دليل الموظفين وإدارة الرواتب والأجور
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            سجل الكادر الوظيفي، العقود، البدلات، وإصدار وصرف مسيرات الرواتب الشهرية وربطها بالخزينة
          </p>
        </div>

        <div className="flex items-center gap-2">
          {activeTab === 'employees' ? (
            <button
              type="button"
              onClick={openAddEmployee}
              className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold flex items-center gap-2 transition shadow-lg shadow-emerald-950/50"
            >
              <Plus className="w-4 h-4" />
              إضافة موظف جديد
            </button>
          ) : (
            <button
              type="button"
              onClick={() => setIsGeneratePayrollOpen(true)}
              className="px-4 py-2.5 bg-cyan-600 hover:bg-cyan-500 text-white rounded-xl text-xs font-bold flex items-center gap-2 transition shadow-lg shadow-cyan-950/50"
            >
              <FileSpreadsheet className="w-4 h-4" />
              توليد مسير رواتب الشهر ({selectedMonth})
            </button>
          )}
        </div>
      </div>

      {/* Tabs Switcher */}
      <div className="flex border-b border-slate-800 gap-4">
        <button
          type="button"
          onClick={() => setActiveTab('employees')}
          className={`pb-3 text-sm font-bold flex items-center gap-2 transition border-b-2 ${
            activeTab === 'employees'
              ? 'text-emerald-400 border-emerald-400'
              : 'text-slate-400 border-transparent hover:text-slate-200'
          }`}
        >
          <Users className="w-4 h-4" />
          دليل الكادر والموظفين ({employees.length})
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('payroll')}
          className={`pb-3 text-sm font-bold flex items-center gap-2 transition border-b-2 ${
            activeTab === 'payroll'
              ? 'text-cyan-400 border-cyan-400'
              : 'text-slate-400 border-transparent hover:text-slate-200'
          }`}
        >
          <DollarSign className="w-4 h-4" />
          كشوفات ومسيرات الرواتب الشهرية ({filteredPayroll.length})
        </button>
      </div>

      {/* Stats Summary Bar */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-slate-900/80 border border-slate-800 p-4 rounded-2xl">
          <span className="text-xs text-slate-400 font-medium block mb-1">إجمالي الكادر</span>
          <span className="text-2xl font-bold text-white">{employees.length}</span>
          <span className="text-[10px] text-slate-500 block mt-1">موظف في جميع الفروع</span>
        </div>

        <div className="bg-slate-900/80 border border-slate-800 p-4 rounded-2xl">
          <span className="text-xs text-slate-400 font-medium block mb-1">كتلة الرواتب الشهرية</span>
          <span className="text-xl font-bold text-emerald-400">
            {formatCurrency(totalSalariesSyp, 'SYP')}
          </span>
          <span className="text-[10px] text-emerald-500/80 block mt-1">صافي الرواتب المستحقة</span>
        </div>

        <div className="bg-slate-900/80 border border-slate-800 p-4 rounded-2xl">
          <span className="text-xs text-slate-400 font-medium block mb-1">رواتب مصروفة لشهر {selectedMonth}</span>
          <span className="text-2xl font-bold text-cyan-400">{totalPayrollPaidCount}</span>
          <span className="text-[10px] text-cyan-500/80 block mt-1">تم تسليمها للموظفين</span>
        </div>

        <div className="bg-slate-900/80 border border-slate-800 p-4 rounded-2xl">
          <span className="text-xs text-slate-400 font-medium block mb-1">رواتب قيد الانتظار</span>
          <span className="text-2xl font-bold text-amber-400">{totalPayrollPendingCount}</span>
          <span className="text-[10px] text-amber-500/80 block mt-1">بانتظار الصرف</span>
        </div>
      </div>

      {/* Search and Filters */}
      <div className="bg-slate-900/80 border border-slate-800 p-4 rounded-2xl flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[240px]">
          <Search className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="ابحث بالاسم، المسمى الوظيفي، رقم الهاتف، أو الرقم الوطني..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-slate-950 border border-slate-700 rounded-xl pr-9 pl-4 py-2 text-xs text-white placeholder-slate-500 focus:border-emerald-500 outline-none"
          />
        </div>

        <select
          value={selectedBranch}
          onChange={(e) => setSelectedBranch(e.target.value)}
          className="bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-300 focus:border-emerald-500 outline-none"
        >
          <option value="all">كل الفروع</option>
          {branches.map((b) => (
            <option key={b.id} value={b.id}>
              {b.name}
            </option>
          ))}
        </select>

        {activeTab === 'payroll' && (
          <div className="flex items-center gap-2 bg-slate-950 px-3 py-1.5 rounded-xl border border-slate-700 text-xs">
            <Calendar className="w-4 h-4 text-cyan-400" />
            <span className="text-slate-400">الشهر:</span>
            <input
              type="month"
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              className="bg-transparent text-white outline-none cursor-pointer"
            />
          </div>
        )}
      </div>

      {/* TAB 1: EMPLOYEES DIRECTORY */}
      {activeTab === 'employees' && (
        <div className="bg-slate-900/80 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
          <div className="overflow-x-auto">
            <table className="w-full text-right text-xs">
              <thead className="bg-slate-950/80 text-slate-400 border-b border-slate-800 font-semibold">
                <tr>
                  <th className="p-3.5">الرمز والاسم الكامل</th>
                  <th className="p-3.5">المسمى والفرع</th>
                  <th className="p-3.5">الاتصال والرقم الوطني</th>
                  <th className="p-3.5">الراتب الأساسي</th>
                  <th className="p-3.5">البدلات الشهرية</th>
                  <th className="p-3.5">الاستقطاعات</th>
                  <th className="p-3.5">صافي الراتب المستحق</th>
                  <th className="p-3.5 text-center">الإجراءات</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 text-slate-200">
                {filteredEmployees.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="p-8 text-center text-slate-500">
                      لا يوجد موظفون يطابقون خيارات البحث
                    </td>
                  </tr>
                ) : (
                  filteredEmployees.map((emp) => {
                    const totalAllowances = (emp.transportAllowance || 0) + (emp.housingAllowance || 0);
                    const net = emp.basicSalary + totalAllowances - (emp.standardDeductions || 0);
                    return (
                      <tr key={emp.id} className="hover:bg-slate-800/40 transition">
                        <td className="p-3.5">
                          <div className="flex items-center gap-2.5">
                            <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400 font-bold">
                              {emp.fullName.slice(0, 1)}
                            </div>
                            <div>
                              <span className="font-bold text-white block">{emp.fullName}</span>
                              <span className="text-[10px] text-slate-500 font-mono">{emp.code}</span>
                            </div>
                          </div>
                        </td>

                        <td className="p-3.5">
                          <span className="font-semibold text-cyan-300 block">{emp.jobTitle}</span>
                          <span className="text-[10px] text-slate-400 block">
                            {getBranchName(emp.branchId)}
                          </span>
                        </td>

                        <td className="p-3.5 text-[11px] font-mono">
                          <div className="text-slate-300">{emp.phone}</div>
                          <div className="text-slate-500 text-[10px]">{emp.nationalId || '—'}</div>
                        </td>

                        <td className="p-3.5 font-mono font-bold text-white">
                          {formatCurrency(emp.basicSalary || 0, emp.salaryCurrency || emp.currency || 'SYP')}
                        </td>

                        <td className="p-3.5 font-mono text-emerald-400 text-[11px]">
                          +{formatCurrency(totalAllowances || 0, emp.salaryCurrency || emp.currency || 'SYP')}
                        </td>

                        <td className="p-3.5 font-mono text-rose-400 text-[11px]">
                          -{formatCurrency(emp.standardDeductions || 0, emp.salaryCurrency || emp.currency || 'SYP')}
                        </td>

                        <td className="p-3.5 font-mono font-bold text-emerald-300 text-sm">
                          {formatCurrency(net || 0, emp.salaryCurrency || emp.currency || 'SYP')}
                        </td>

                        <td className="p-3.5 text-center">
                          <div className="flex items-center justify-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => openEditEmployee(emp)}
                              className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-cyan-400 transition"
                              title="تعديل الموظف"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeleteEmployee(emp.id, emp.fullName)}
                              className="p-1.5 rounded-lg bg-slate-800 hover:bg-rose-900/60 text-slate-400 hover:text-rose-300 transition"
                              title="حذف"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 2: PAYROLL RECORDS */}
      {activeTab === 'payroll' && (
        <div className="bg-slate-900/80 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
          <div className="overflow-x-auto">
            <table className="w-full text-right text-xs">
              <thead className="bg-slate-950/80 text-slate-400 border-b border-slate-800 font-semibold">
                <tr>
                  <th className="p-3.5">رقم المسير</th>
                  <th className="p-3.5">اسم الموظف</th>
                  <th className="p-3.5">الفرع</th>
                  <th className="p-3.5">الراتب الأساسي</th>
                  <th className="p-3.5">إجمالي البدلات</th>
                  <th className="p-3.5">الاستقطاعات</th>
                  <th className="p-3.5">الصافي المستحق</th>
                  <th className="p-3.5">حالة الصرف</th>
                  <th className="p-3.5 text-center">الإجراءات</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 text-slate-200">
                {filteredPayroll.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="p-8 text-center text-slate-500">
                      لا توجد كشوفات رواتب صادرة لشهر {selectedMonth}. اضغط "توليد مسير رواتب الشهر" لإصدارها دفعة واحدة.
                    </td>
                  </tr>
                ) : (
                  filteredPayroll.map((record) => (
                    <tr key={record.id} className="hover:bg-slate-800/40 transition">
                      <td className="p-3.5 font-mono text-cyan-400 font-bold">{record.payrollNumber}</td>
                      <td className="p-3.5 font-bold text-white">{record.employeeName}</td>
                      <td className="p-3.5 text-slate-400">{getBranchName(record.branchId)}</td>
                      <td className="p-3.5 font-mono">{formatCurrency(record.basicSalary || 0, record.currency || 'SYP')}</td>
                      <td className="p-3.5 font-mono text-emerald-400">+{formatCurrency(record.allowances || 0, record.currency || 'SYP')}</td>
                      <td className="p-3.5 font-mono text-rose-400">-{formatCurrency(record.deductions || 0, record.currency || 'SYP')}</td>
                      <td className="p-3.5 font-mono font-bold text-emerald-300 text-sm">
                        {formatCurrency(record.netPayable || 0, record.currency || 'SYP')}
                      </td>
                      <td className="p-3.5">
                        <span
                          className={`text-[10px] px-2.5 py-1 rounded-full font-bold border inline-flex items-center gap-1 ${
                            record.status === 'paid'
                              ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
                              : 'bg-amber-500/20 text-amber-300 border-amber-500/30'
                          }`}
                        >
                          {record.status === 'paid' ? (
                            <>
                              <CheckCircle className="w-3 h-3" />
                              تم الصرف (
                              {record.paymentMethod === 'cash_box' ? 'خزينة الفرع' : 'تحويل بنكي'})
                            </>
                          ) : (
                            <>
                              <AlertCircle className="w-3 h-3" />
                              بانتظار الصرف
                            </>
                          )}
                        </span>
                      </td>
                      <td className="p-3.5 text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          {record.status === 'pending' ? (
                            <button
                              type="button"
                              onClick={() => handlePaySalary(record)}
                              className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-semibold flex items-center gap-1 transition shadow-md shadow-emerald-950/40"
                            >
                              <ArrowDownLeft className="w-3.5 h-3.5" />
                              صرف الراتب
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={() => setSelectedPayrollForPrint(record)}
                              className="px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs flex items-center gap-1"
                            >
                              <Printer className="w-3.5 h-3.5" />
                              إيصال القبض
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Add / Edit Employee Modal */}
      {isEmployeeModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="bg-slate-900 border border-slate-700 w-full max-w-3xl rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
            <div className="p-4 bg-gradient-to-r from-slate-800 to-emerald-950/40 border-b border-slate-700 flex items-center justify-between">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <UserCheck className="w-5 h-5 text-emerald-400" />
                {editingEmployee ? 'تعديل بيانات الموظف' : 'تسجيل موظف جديد في الكادر'}
              </h3>
              <button
                type="button"
                onClick={() => setIsEmployeeModalOpen(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveEmployee} className="p-5 overflow-y-auto space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div>
                  <label className="text-xs text-slate-300 font-semibold block mb-1">
                    الاسم الكامل للموظف <span className="text-rose-400">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={employeeFormData.fullName}
                    onChange={(e) => setEmployeeFormData({ ...employeeFormData, fullName: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white focus:border-emerald-500 outline-none"
                  />
                </div>

                <div>
                  <label className="text-xs text-slate-300 font-semibold block mb-1">
                    رقم الهاتف الجوال <span className="text-rose-400">*</span>
                  </label>
                  <input
                    type="tel"
                    required
                    value={employeeFormData.phone}
                    onKeyDown={blockNonPhoneKeys}
                    onChange={(e) => setEmployeeFormData({ ...employeeFormData, phone: sanitizePhone(e.target.value) })}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white focus:border-emerald-500 outline-none font-mono"
                  />
                </div>

                <div>
                  <label className="text-xs text-slate-300 font-semibold block mb-1">
                    الرقم الوطني السوري
                  </label>
                  <input
                    type="text"
                    maxLength={11}
                    value={employeeFormData.nationalId}
                    onKeyDown={blockNonIntegerKeys}
                    onChange={(e) => setEmployeeFormData({ ...employeeFormData, nationalId: sanitizeDigitsOnly(e.target.value) })}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white focus:border-emerald-500 outline-none font-mono"
                  />
                </div>

                <div>
                  <label className="text-xs text-slate-300 font-semibold block mb-1">المسمى الوظيفي</label>
                  <input
                    type="text"
                    value={employeeFormData.jobTitle}
                    onChange={(e) => setEmployeeFormData({ ...employeeFormData, jobTitle: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white focus:border-emerald-500 outline-none"
                  />
                </div>

                <div>
                  <label className="text-xs text-slate-300 font-semibold block mb-1">الفرع التابع له</label>
                  <select
                    value={employeeFormData.branchId}
                    onChange={(e) => setEmployeeFormData({ ...employeeFormData, branchId: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white focus:border-emerald-500 outline-none"
                  >
                    {branches.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-xs text-slate-300 font-semibold block mb-1">تاريخ المباشرة</label>
                  <input
                    type="date"
                    value={employeeFormData.hireDate}
                    onChange={(e) => setEmployeeFormData({ ...employeeFormData, hireDate: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white focus:border-emerald-500 outline-none"
                  />
                </div>
              </div>

              {/* Financial Package */}
              <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-3">
                <h4 className="text-xs font-bold text-emerald-400">حزمة الأجر والبدلات الشهرية</h4>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div>
                    <label className="text-xs text-slate-300 block mb-1">الراتب الأساسي الشهري</label>
                    <input
                      type="number"
                      step="any"
                      required
                      value={employeeFormData.basicSalary === 0 ? '' : employeeFormData.basicSalary}
                      onFocus={(e) => e.target.select()}
                      onKeyDown={blockNonAmountKeys}
                      onChange={(e) => {
                        const clean = sanitizeDecimal(e.target.value);
                        setEmployeeFormData({ ...employeeFormData, basicSalary: clean === '' ? 0 : Number(clean) || 0 });
                      }}
                      placeholder="أدخل الراتب الأساسي"
                      className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white focus:border-emerald-500 outline-none font-mono"
                    />
                  </div>

                  <div>
                    <label className="text-xs text-slate-300 block mb-1">بدل المواصلات والانتقال</label>
                    <input
                      type="number"
                      step="any"
                      value={employeeFormData.transportAllowance === 0 ? '' : employeeFormData.transportAllowance}
                      onFocus={(e) => e.target.select()}
                      onKeyDown={blockNonAmountKeys}
                      onChange={(e) => {
                        const clean = sanitizeDecimal(e.target.value);
                        setEmployeeFormData({ ...employeeFormData, transportAllowance: clean === '' ? 0 : Number(clean) || 0 });
                      }}
                      placeholder="أدخل بدل المواصلات"
                      className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white focus:border-emerald-500 outline-none font-mono"
                    />
                  </div>

                  <div>
                    <label className="text-xs text-slate-300 block mb-1">الاستقطاعات والتأمينات</label>
                    <input
                      type="number"
                      step="any"
                      value={employeeFormData.standardDeductions === 0 ? '' : employeeFormData.standardDeductions}
                      onFocus={(e) => e.target.select()}
                      onKeyDown={blockNonAmountKeys}
                      onChange={(e) => {
                        const clean = sanitizeDecimal(e.target.value);
                        setEmployeeFormData({ ...employeeFormData, standardDeductions: clean === '' ? 0 : Number(clean) || 0 });
                      }}
                      placeholder="أدخل الاستقطاعات"
                      className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white focus:border-emerald-500 outline-none font-mono"
                    />
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsEmployeeModalOpen(false)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-semibold"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 shadow-lg shadow-emerald-950/50"
                >
                  <CheckCircle className="w-4 h-4" />
                  {editingEmployee ? 'حفظ التعديلات' : 'تسجيل الموظف'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Generate Payroll Modal */}
      {isGeneratePayrollOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4">
          <div className="bg-slate-900 border border-slate-700 w-full max-w-md rounded-2xl p-5 shadow-2xl space-y-4">
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <FileSpreadsheet className="w-5 h-5 text-cyan-400" />
              توليد مسير الرواتب لشهر {selectedMonth}
            </h3>
            <p className="text-xs text-slate-300">
              سيقوم النظام بإنشاء كشوفات رواتب تلقائية لكافة الموظفين النشطين في الفروع استناداً إلى الراتب الأساسي والبدلات المسجلة في ملفاتهم.
            </p>

            <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 text-xs text-slate-400 space-y-1">
              <div>عدد الموظفين النشطين: <b className="text-white">{employees.filter((e) => e.status === 'active').length}</b></div>
              <div>شهر الاستحقاق: <b className="text-cyan-400">{selectedMonth}</b></div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setIsGeneratePayrollOpen(false)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-semibold"
              >
                إلغاء
              </button>
              <button
                type="button"
                onClick={handleGenerateMonthlyPayrollBatch}
                className="px-5 py-2 bg-cyan-600 hover:bg-cyan-500 text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 shadow-lg shadow-cyan-950/50"
              >
                <Check className="w-4 h-4" />
                تأكيد وإصدار الكشوفات
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Payroll Print Slip */}
      {selectedPayrollForPrint && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4">
          <div className="bg-white text-slate-900 w-full max-w-md rounded-2xl p-6 shadow-2xl space-y-4 font-sans text-right">
            <div className="flex items-center justify-between border-b pb-3">
              <div>
                <h3 className="text-base font-bold">سند صرف راتب شهري</h3>
                <span className="text-xs text-slate-500 font-mono">{selectedPayrollForPrint.payrollNumber}</span>
              </div>
              <span className="text-xs bg-emerald-100 text-emerald-800 px-2 py-1 rounded font-bold">
                مدفوع ومصروف
              </span>
            </div>

            <div className="text-xs space-y-2">
              <div className="flex justify-between py-1 border-b">
                <span className="text-slate-600">اسم الموظف:</span>
                <span className="font-bold">{selectedPayrollForPrint.employeeName}</span>
              </div>
              <div className="flex justify-between py-1 border-b">
                <span className="text-slate-600">عن شهر:</span>
                <span className="font-bold">{selectedPayrollForPrint.month}</span>
              </div>
              <div className="flex justify-between py-1 border-b">
                <span className="text-slate-600">الراتب الأساسي:</span>
                <span className="font-mono">{formatCurrency(selectedPayrollForPrint.basicSalary || 0, selectedPayrollForPrint.currency || 'SYP')}</span>
              </div>
              <div className="flex justify-between py-1 border-b">
                <span className="text-slate-600">إجمالي البدلات:</span>
                <span className="font-mono text-emerald-700">+{formatCurrency(selectedPayrollForPrint.allowances || 0, selectedPayrollForPrint.currency || 'SYP')}</span>
              </div>
              <div className="flex justify-between py-1 border-b">
                <span className="text-slate-600">الاستقطاعات:</span>
                <span className="font-mono text-rose-700">-{formatCurrency(selectedPayrollForPrint.deductions || 0, selectedPayrollForPrint.currency || 'SYP')}</span>
              </div>
              <div className="flex justify-between py-2 border-t-2 border-slate-900 font-bold text-sm bg-slate-50 px-2 rounded">
                <span>صافي المبلغ المستلم:</span>
                <span className="text-emerald-700 font-mono text-base">
                  {formatCurrency(selectedPayrollForPrint.netPayable || 0, selectedPayrollForPrint.currency || 'SYP')}
                </span>
              </div>
            </div>

            <div className="pt-4 border-t flex justify-between text-[11px] text-slate-500">
              <div>توقيع الموظف المستلم: .....................</div>
              <div>توقيع أمين الصندوق: .....................</div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setSelectedPayrollForPrint(null)}
                className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-800 rounded-xl text-xs font-semibold"
              >
                إغلاق
              </button>
              <button
                type="button"
                onClick={() => safePrint()}
                className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-semibold flex items-center gap-1"
              >
                <Printer className="w-4 h-4" />
                طباعة السند
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
