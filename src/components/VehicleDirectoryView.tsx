import React, { useState } from 'react';
import { useOrca } from '../context/OrcaContext';
import { Vehicle } from '../types';
import {
  blockNonAmountKeys,
  blockNonIntegerKeys,
  blockNonPhoneKeys,
  sanitizeDecimal,
  sanitizeDigitsOnly,
  sanitizePhone,
} from '../utils/numberSanitizer';
import {
  Truck,
  Search,
  Plus,
  Edit2,
  Trash2,
  CheckCircle,
  AlertTriangle,
  MapPin,
  Phone,
  User,
  Gauge,
  Calendar,
  Fuel,
  Shield,
  Activity,
  X,
  Building,
} from 'lucide-react';

export const VehicleDirectoryView: React.FC = () => {
  const { vehicles, addVehicle, updateVehicle, deleteVehicle, branches, currentBranch, formatNumber } = useOrca();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedBranch, setSelectedBranch] = useState<string>('all');
  const [selectedStatus, setSelectedStatus] = useState<string>('all');
  const [selectedType, setSelectedType] = useState<string>('all');

  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingVehicle, setEditingVehicle] = useState<Vehicle | null>(null);

  // Form State
  const [formData, setFormData] = useState({
    plateNumber: '',
    type: 'شاحنة مغلقة (صندوقية)' as any,
    model: '',
    year: new Date().getFullYear(),
    maxWeightKg: 0,
    maxVolumeCbm: 0,
    fuelTankLiters: 0,
    assignedBranchId: currentBranch.id,
    driverName: '',
    driverPhone: '',
    driverNationalId: '',
    driverLicenseNumber: '',
    status: 'active' as any,
    insuranceExpiryDate: '',
    licenseExpiryDate: '',
    currentOdometerKm: 0,
    nextMaintenanceKm: 0,
    notes: '',
  });

  const openAddModal = () => {
    setEditingVehicle(null);
    setFormData({
      plateNumber: '',
      type: 'شاحنة مغلقة (صندوقية)',
      model: '',
      year: new Date().getFullYear(),
      maxWeightKg: 0,
      maxVolumeCbm: 0,
      fuelTankLiters: 0,
      assignedBranchId: '',
      driverName: '',
      driverPhone: '',
      driverNationalId: '',
      driverLicenseNumber: '',
      status: 'active',
      insuranceExpiryDate: '',
      licenseExpiryDate: '',
      currentOdometerKm: 0,
      nextMaintenanceKm: 0,
      notes: '',
    });
    setIsAddModalOpen(true);
  };

  const openEditModal = (v: Vehicle) => {
    setEditingVehicle(v);
    setFormData({
      plateNumber: v.plateNumber,
      type: v.type,
      model: v.model,
      year: v.year || new Date().getFullYear(),
      maxWeightKg: v.maxWeightKg,
      maxVolumeCbm: v.maxVolumeCbm || 30,
      fuelTankLiters: v.fuelTankLiters || 200,
      assignedBranchId: v.assignedBranchId || '',
      driverName: v.driverName || '',
      driverPhone: v.driverPhone || '',
      driverNationalId: v.driverNationalId || '',
      driverLicenseNumber: v.driverLicenseNumber || '',
      status: v.status,
      insuranceExpiryDate: v.insuranceExpiryDate || '',
      licenseExpiryDate: v.licenseExpiryDate || '',
      currentOdometerKm: v.currentOdometerKm || 0,
      nextMaintenanceKm: v.nextMaintenanceKm || 0,
      notes: v.notes || '',
    });
    setIsAddModalOpen(true);
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.plateNumber.trim() || !formData.model.trim()) {
      alert('يرجى إدخال رقم اللوحة وموديل المركبة');
      return;
    }

    if (editingVehicle) {
      updateVehicle(editingVehicle.id, formData);
    } else {
      addVehicle(formData);
    }
    setIsAddModalOpen(false);
  };

  const handleDelete = (id: string, plate: string) => {
    if (confirm(`هل أنت متأكد من حذف المركبة ذات اللوحة [${plate}] من دليل الأسطول؟`)) {
      deleteVehicle(id);
    }
  };

  // Filtered vehicles
  const filteredVehicles = vehicles.filter((v) => {
    const matchSearch =
      v.plateNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
      v.model.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (v.driverName && v.driverName.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (v.driverPhone && v.driverPhone.includes(searchTerm)) ||
      (v.code && v.code.toLowerCase().includes(searchTerm.toLowerCase()));

    const matchBranch =
      selectedBranch === 'all' ||
      !v.assignedBranchId ||
      v.assignedBranchId === '' ||
      v.assignedBranchId === 'all' ||
      v.assignedBranchId === selectedBranch;
    const matchStatus = selectedStatus === 'all' || v.status === selectedStatus;
    const matchType = selectedType === 'all' || v.type === selectedType;

    return matchSearch && matchBranch && matchStatus && matchType;
  });

  // Fleet Stats
  const totalFleet = vehicles.length;
  const activeFleet = vehicles.filter((v) => v.status === 'active').length;
  const inTransitFleet = vehicles.filter((v) => v.status === 'in_transit').length;
  const maintenanceFleet = vehicles.filter((v) => v.status === 'maintenance').length;
  const totalPayloadCapKg = vehicles.reduce((acc, v) => acc + (v.maxWeightKg || 0), 0);

  const getBranchName = (bId?: string) => {
    if (!bId || bId === '' || bId === 'all') return '(بدون) - متاح لكامل الفروع';
    const found = branches.find((b) => b.id === bId);
    return found ? found.name : bId;
  };

  return (
    <div className="space-y-6">
      {/* Header & Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <Truck className="w-6 h-6 text-amber-400" />
            دليل الشاحنات والمركبات (إدارة أسطول النقل)
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            إدارة حركة الشاحنات، السائقين المعتمدين، الحمولات القصوى، وجداول الصيانة الدورية والتراخيص
          </p>
        </div>

        <button
          type="button"
          onClick={openAddModal}
          className="px-4 py-2.5 bg-amber-600 hover:bg-amber-500 text-white rounded-xl text-xs font-bold flex items-center gap-2 transition shadow-lg shadow-amber-950/50 self-start sm:self-auto"
        >
          <Plus className="w-4 h-4" />
          إضافة شاحنة / مركبة جديدة
        </button>
      </div>

      {/* Fleet Stats Overview */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-slate-900/80 border border-slate-800 p-4 rounded-2xl">
          <span className="text-xs text-slate-400 font-medium block mb-1">إجمالي الأسطول</span>
          <span className="text-2xl font-bold text-white">{totalFleet}</span>
          <span className="text-[10px] text-slate-500 block mt-1">مركبة وشاحنة مسجلة</span>
        </div>

        <div className="bg-slate-900/80 border border-slate-800 p-4 rounded-2xl">
          <span className="text-xs text-slate-400 font-medium block mb-1">جاهزة للتحميل</span>
          <span className="text-2xl font-bold text-emerald-400">{activeFleet}</span>
          <span className="text-[10px] text-emerald-500/80 block mt-1">شاحنة في المراكز</span>
        </div>

        <div className="bg-slate-900/80 border border-slate-800 p-4 rounded-2xl">
          <span className="text-xs text-slate-400 font-medium block mb-1">في الطريق بين المحافظات</span>
          <span className="text-2xl font-bold text-cyan-400">{inTransitFleet}</span>
          <span className="text-[10px] text-cyan-500/80 block mt-1">رحلات شحن نشطة</span>
        </div>

        <div className="bg-slate-900/80 border border-slate-800 p-4 rounded-2xl">
          <span className="text-xs text-slate-400 font-medium block mb-1">قيد الصيانة والفحص</span>
          <span className="text-2xl font-bold text-rose-400">{maintenanceFleet}</span>
          <span className="text-[10px] text-rose-500/80 block mt-1">خارج الخدمة مؤقتاً</span>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-slate-900/80 border border-slate-800 p-4 rounded-2xl flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[240px]">
          <Search className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="ابحث برقم اللوحة، اسم السائق، الموديل، أو هاتف السائق..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-slate-950 border border-slate-700 rounded-xl pr-9 pl-4 py-2 text-xs text-white placeholder-slate-500 focus:border-amber-500 outline-none"
          />
        </div>

        <select
          value={selectedBranch}
          onChange={(e) => setSelectedBranch(e.target.value)}
          className="bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-300 focus:border-amber-500 outline-none"
        >
          <option value="all">كل الفروع والمراكز</option>
          {branches.map((b) => (
            <option key={b.id} value={b.id}>
              {b.name}
            </option>
          ))}
        </select>

        <select
          value={selectedStatus}
          onChange={(e) => setSelectedStatus(e.target.value)}
          className="bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-300 focus:border-amber-500 outline-none"
        >
          <option value="all">كل الحالات التشغيلية</option>
          <option value="active">جاهزة للتحميل (نشطة)</option>
          <option value="in_transit">في الطريق (سفر)</option>
          <option value="maintenance">في الصيانة</option>
          <option value="inactive">معطلة / متوقفة</option>
        </select>

        <select
          value={selectedType}
          onChange={(e) => setSelectedType(e.target.value)}
          className="bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-300 focus:border-amber-500 outline-none"
        >
          <option value="all">كل أنواع المركبات</option>
          <option value="شاحنة مغلقة (صندوقية)">شاحنة مغلقة (صندوقية)</option>
          <option value="شاحنة براد مبرد">شاحنة براد مبرد</option>
          <option value="قاطرة ومقطورة">قاطرة ومقطورة</option>
          <option value="فان توزيع سريع">فان توزيع سريع</option>
          <option value="بيك آب متوسط">بيك آب متوسط</option>
        </select>
      </div>

      {/* Vehicles Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredVehicles.length === 0 ? (
          <div className="col-span-full py-12 text-center text-slate-500 bg-slate-900/40 rounded-2xl border border-slate-800">
            <Truck className="w-12 h-12 mx-auto text-slate-600 mb-2" />
            <p className="text-sm font-semibold text-slate-400">لا توجد مركبات تطابق شروط البحث</p>
          </div>
        ) : (
          filteredVehicles.map((v) => (
            <div
              key={v.id}
              className="bg-slate-900/80 border border-slate-800 hover:border-amber-500/50 rounded-2xl p-4 transition shadow-lg flex flex-col justify-between"
            >
              <div>
                {/* Top header */}
                <div className="flex items-start justify-between gap-2 mb-3">
                  <div>
                    <span className="text-[10px] text-slate-400 font-mono block">{v.code}</span>
                    <h3 className="text-base font-bold text-white flex items-center gap-2">
                      {v.plateNumber}
                    </h3>
                    <span className="text-xs text-amber-400 font-semibold">{v.model} ({v.year || '—'})</span>
                  </div>

                  <span
                    className={`text-[10px] px-2.5 py-1 rounded-full font-bold border ${
                      v.status === 'active'
                        ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
                        : v.status === 'in_transit'
                        ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/30 animate-pulse'
                        : v.status === 'maintenance'
                        ? 'bg-rose-500/20 text-rose-300 border-rose-500/30'
                        : 'bg-slate-700 text-slate-300 border-slate-600'
                    }`}
                  >
                    {v.status === 'active'
                      ? '✓ جاهزة'
                      : v.status === 'in_transit'
                      ? '🚀 في الطريق'
                      : v.status === 'maintenance'
                      ? '⚙ في الصيانة'
                      : 'متوقفة'}
                  </span>
                </div>

                {/* Specs Grid */}
                <div className="grid grid-cols-2 gap-2 text-xs bg-slate-950/80 p-3 rounded-xl border border-slate-800/80 mb-3">
                  <div>
                    <span className="text-[10px] text-slate-500 block">نوع المركبة</span>
                    <span className="font-semibold text-slate-200">{v.type}</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-500 block">الفرع التابع</span>
                    {!v.assignedBranchId || v.assignedBranchId === '' || v.assignedBranchId === 'all' ? (
                      <span className="text-emerald-400 font-bold bg-emerald-950/60 border border-emerald-500/30 px-1.5 py-0.5 rounded text-[10px] inline-block truncate max-w-full">
                        (بدون) لكامل الفروع
                      </span>
                    ) : (
                      <span className="text-cyan-400 font-medium truncate block">
                        {getBranchName(v.assignedBranchId)}
                      </span>
                    )}
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-500 block">الحمولة القصوى</span>
                    <span className="font-mono text-emerald-400 font-bold">
                      {(((v.maxWeightKg || 0)) / 1000).toFixed(1)} طن ({formatNumber(v.maxWeightKg || 0)} كغ)
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-500 block">السعة الحجمية</span>
                    <span className="font-mono text-purple-400 font-bold">
                      {v.maxVolumeCbm || 35} م³ (CBM)
                    </span>
                  </div>
                </div>

                {/* Driver Info */}
                <div className="bg-slate-950/40 p-2.5 rounded-xl border border-slate-800/60 mb-3 text-xs space-y-1">
                  <div className="flex items-center gap-1.5 text-slate-300">
                    <User className="w-3.5 h-3.5 text-amber-400" />
                    <span className="font-semibold">السائق:</span>
                    <span>{v.driverName || 'غير معين حالياً'}</span>
                  </div>
                  {v.driverPhone && (
                    <div className="flex items-center gap-1.5 text-slate-400 font-mono text-[11px]">
                      <Phone className="w-3 h-3 text-cyan-400" />
                      <span>{v.driverPhone}</span>
                    </div>
                  )}
                </div>

                {/* Maintenance & Odometer */}
                <div className="flex items-center justify-between text-[11px] text-slate-400 pt-1 border-t border-slate-800/80">
                  <span className="flex items-center gap-1">
                    <Gauge className="w-3.5 h-3.5 text-slate-500" />
                    العداد: <b className="text-slate-300 font-mono">{formatNumber(v.currentOdometerKm || 0)} كم</b>
                  </span>
                  {v.nextMaintenanceKm != null && (
                    <span className="text-slate-500 font-mono text-[10px]">
                      الصيانة القادمة: {formatNumber(v.nextMaintenanceKm || 0)} كم
                    </span>
                  )}
                </div>
              </div>

              {/* Actions Footer */}
              <div className="flex items-center justify-end gap-2 pt-3 mt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => openEditModal(v)}
                  className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-amber-300 rounded-lg text-xs font-semibold flex items-center gap-1 transition"
                >
                  <Edit2 className="w-3.5 h-3.5" />
                  تعديل
                </button>
                <button
                  type="button"
                  onClick={() => handleDelete(v.id, v.plateNumber)}
                  className="px-2.5 py-1.5 bg-slate-800 hover:bg-rose-900/60 text-slate-400 hover:text-rose-300 rounded-lg text-xs transition"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Add / Edit Vehicle Modal */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="bg-slate-900 border border-slate-700 w-full max-w-5xl xl:max-w-6xl rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
            <div className="p-4 bg-gradient-to-r from-slate-800 via-slate-850 to-amber-950/40 border-b border-slate-700 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-amber-500/20 text-amber-400 rounded-xl border border-amber-500/30">
                  <Truck className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">
                    {editingVehicle ? 'تعديل بيانات المركبة' : 'إضافة شاحنة / مركبة جديدة للأسطول'}
                  </h3>
                  <p className="text-[11px] text-slate-400">
                    أدخل تفاصيل الشاحنة، الحمولة، السائق المعتمد، وتبعية الفرع عبر الشبكة
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsAddModalOpen(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSave} className="p-5 overflow-y-auto space-y-4 text-xs">
              {/* Technical & Fleet Specs - 4 Column Layout */}
              <div className="bg-slate-950/70 p-4 rounded-xl border border-slate-800 space-y-3">
                <div className="flex items-center justify-between border-b border-slate-800/80 pb-2">
                  <h4 className="text-xs font-bold text-amber-400 flex items-center gap-1.5">
                    <Truck className="w-4 h-4 text-amber-400" />
                    <span>البيانات الأساسية والمواصفات الفنية للمركبة</span>
                  </h4>
                  <span className="text-[11px] text-slate-400">الحقول المميزة بـ (*) إلزامية</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
                  <div>
                    <label className="text-xs text-slate-300 font-semibold block mb-1">
                      رقم اللوحة والمحافظة <span className="text-rose-400">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="مثال: دمشق 829103"
                      value={formData.plateNumber}
                      onChange={(e) => setFormData({ ...formData, plateNumber: e.target.value })}
                      className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white focus:border-amber-500 outline-none"
                    />
                  </div>

                  <div>
                    <label className="text-xs text-slate-300 font-semibold block mb-1">
                      موديل وطراز المركبة <span className="text-rose-400">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="مرسيدس أكتروس 1840"
                      value={formData.model}
                      onChange={(e) => setFormData({ ...formData, model: e.target.value })}
                      className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white focus:border-amber-500 outline-none"
                    />
                  </div>

                  <div>
                    <label className="text-xs text-slate-300 font-semibold block mb-1">سنة الصنع</label>
                    <input
                      type="number"
                      value={formData.year === 0 ? '' : formData.year}
                      onFocus={(e) => e.target.select()}
                      onKeyDown={blockNonIntegerKeys}
                      onChange={(e) => {
                        const clean = sanitizeDigitsOnly(e.target.value);
                        setFormData({ ...formData, year: clean === '' ? 0 : Number(clean) });
                      }}
                      placeholder="سنة الصنع (مثال: 2023)"
                      className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white focus:border-amber-500 outline-none font-mono"
                    />
                  </div>

                  <div>
                    <label className="text-xs text-slate-300 font-semibold block mb-1">نوع الشاحنة / الهيكل</label>
                    <select
                      value={formData.type}
                      onChange={(e) => setFormData({ ...formData, type: e.target.value as any })}
                      className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white focus:border-amber-500 outline-none"
                    >
                      <option value="شاحنة مغلقة (صندوقية)">شاحنة مغلقة (صندوقية)</option>
                      <option value="شاحنة براد مبرد">شاحنة براد مبرد</option>
                      <option value="قاطرة ومقطورة">قاطرة ومقطورة</option>
                      <option value="فان توزيع سريع">فان توزيع سريع</option>
                      <option value="بيك آب متوسط">بيك آب متوسط</option>
                    </select>
                  </div>

                  <div>
                    <label className="text-xs text-slate-300 font-semibold block mb-1">
                      الفرع / المركز التابع له
                    </label>
                    <select
                      value={formData.assignedBranchId}
                      onChange={(e) => setFormData({ ...formData, assignedBranchId: e.target.value })}
                      className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white focus:border-amber-500 outline-none font-medium"
                    >
                      <option value="">(بدون) - متاح ويظهر لكامل الفروع</option>
                      {branches.map((b) => (
                        <option key={b.id} value={b.id}>
                          {b.name} ({b.governorate})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="text-xs text-slate-300 font-semibold block mb-1">الحالة التشغيلية</label>
                    <select
                      value={formData.status}
                      onChange={(e) => setFormData({ ...formData, status: e.target.value as any })}
                      className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white focus:border-amber-500 outline-none"
                    >
                      <option value="active">جاهزة للتحميل (نشطة)</option>
                      <option value="in_transit">في الطريق (سفر)</option>
                      <option value="maintenance">في الصيانة والفحص</option>
                      <option value="inactive">معطلة / متوقفة</option>
                    </select>
                  </div>

                  <div>
                    <label className="text-xs text-slate-300 font-semibold block mb-1">
                      أقصى حمولة وزنية (كغ)
                    </label>
                    <input
                      type="number"
                      step="any"
                      value={formData.maxWeightKg === 0 ? '' : formData.maxWeightKg}
                      onFocus={(e) => e.target.select()}
                      onKeyDown={blockNonAmountKeys}
                      onChange={(e) => {
                        const clean = sanitizeDecimal(e.target.value);
                        setFormData({ ...formData, maxWeightKg: clean === '' ? 0 : Number(clean) });
                      }}
                      placeholder="أدخل أقصى حمولة بالكغ"
                      className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white focus:border-amber-500 outline-none font-mono"
                    />
                  </div>

                  <div>
                    <label className="text-xs text-slate-300 font-semibold block mb-1">
                      السعة الحجمية (متر مكعب CBM)
                    </label>
                    <input
                      type="number"
                      step="any"
                      value={formData.maxVolumeCbm === 0 ? '' : formData.maxVolumeCbm}
                      onFocus={(e) => e.target.select()}
                      onKeyDown={blockNonAmountKeys}
                      onChange={(e) => {
                        const clean = sanitizeDecimal(e.target.value);
                        setFormData({ ...formData, maxVolumeCbm: clean === '' ? 0 : Number(clean) });
                      }}
                      placeholder="أدخل السعة بالمتر المكعب"
                      className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white focus:border-amber-500 outline-none font-mono"
                    />
                  </div>

                  <div>
                    <label className="text-xs text-slate-300 font-semibold block mb-1">سعة خزان الوقود (لتر)</label>
                    <input
                      type="number"
                      step="any"
                      value={formData.fuelTankLiters === 0 ? '' : formData.fuelTankLiters}
                      onFocus={(e) => e.target.select()}
                      onKeyDown={blockNonAmountKeys}
                      onChange={(e) => {
                        const clean = sanitizeDecimal(e.target.value);
                        setFormData({ ...formData, fuelTankLiters: clean === '' ? 0 : Number(clean) });
                      }}
                      placeholder="أدخل سعة الخزان باللتر"
                      className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white focus:border-amber-500 outline-none font-mono"
                    />
                  </div>

                  <div className="sm:col-span-2 lg:col-span-3">
                    <label className="text-xs text-slate-300 font-semibold block mb-1">ملاحظات عامة حول المركبة</label>
                    <input
                      type="text"
                      value={formData.notes}
                      onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                      placeholder="أي ملاحظات خاصة بالتجهيزات، التأمين، أو خطوط السير المفضلة"
                      className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white focus:border-amber-500 outline-none"
                    />
                  </div>
                </div>
              </div>

              {/* Driver and Maintenance - 4 Column Layout */}
              <div className="bg-slate-950/70 p-4 rounded-xl border border-slate-800 space-y-3">
                <div className="flex items-center justify-between border-b border-slate-800/80 pb-2">
                  <h4 className="text-xs font-bold text-cyan-400 flex items-center gap-1.5">
                    <User className="w-4 h-4 text-cyan-400" />
                    <span>بيانات السائق المعتمد والتراخيص والصيانة</span>
                  </h4>
                  <span className="text-[11px] text-slate-400">تساعد في التعيين التلقائي للمانافيست</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
                  <div>
                    <label className="text-xs text-slate-300 block mb-1">اسم السائق الأساسي</label>
                    <input
                      type="text"
                      placeholder="عمر خالد الدالاتي"
                      value={formData.driverName}
                      onChange={(e) => setFormData({ ...formData, driverName: e.target.value })}
                      className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white focus:border-cyan-500 outline-none"
                    />
                  </div>

                  <div>
                    <label className="text-xs text-slate-300 block mb-1">رقم هاتف السائق</label>
                    <input
                      type="tel"
                      placeholder="0933556677"
                      value={formData.driverPhone}
                      onKeyDown={blockNonPhoneKeys}
                      onChange={(e) => setFormData({ ...formData, driverPhone: sanitizePhone(e.target.value) })}
                      className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white focus:border-cyan-500 outline-none font-mono"
                    />
                  </div>

                  <div>
                    <label className="text-xs text-slate-300 block mb-1">الرقم الوطني للسائق</label>
                    <input
                      type="text"
                      placeholder="01080034912"
                      value={formData.driverNationalId}
                      onKeyDown={blockNonIntegerKeys}
                      onChange={(e) => setFormData({ ...formData, driverNationalId: sanitizeDigitsOnly(e.target.value) })}
                      className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white focus:border-cyan-500 outline-none font-mono"
                    />
                  </div>

                  <div>
                    <label className="text-xs text-slate-300 block mb-1">رقم رخصة القيادة</label>
                    <input
                      type="text"
                      placeholder="رقم شهادة السوق / الفئة"
                      value={formData.driverLicenseNumber}
                      onChange={(e) => setFormData({ ...formData, driverLicenseNumber: e.target.value })}
                      className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white focus:border-cyan-500 outline-none font-mono"
                    />
                  </div>

                  <div>
                    <label className="text-xs text-slate-300 block mb-1">قراءة العداد الحالية (كم)</label>
                    <input
                      type="number"
                      value={formData.currentOdometerKm === 0 ? '' : formData.currentOdometerKm}
                      onFocus={(e) => e.target.select()}
                      onKeyDown={blockNonIntegerKeys}
                      onChange={(e) => {
                        const clean = sanitizeDigitsOnly(e.target.value);
                        setFormData({ ...formData, currentOdometerKm: clean === '' ? 0 : Number(clean) });
                      }}
                      placeholder="أدخل قراءة العداد بالكم"
                      className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white focus:border-cyan-500 outline-none font-mono"
                    />
                  </div>

                  <div>
                    <label className="text-xs text-slate-300 block mb-1">المسافة حتى الصيانة القادمة (كم)</label>
                    <input
                      type="number"
                      value={formData.nextMaintenanceKm === 0 ? '' : formData.nextMaintenanceKm}
                      onFocus={(e) => e.target.select()}
                      onKeyDown={blockNonIntegerKeys}
                      onChange={(e) => {
                        const clean = sanitizeDigitsOnly(e.target.value);
                        setFormData({ ...formData, nextMaintenanceKm: clean === '' ? 0 : Number(clean) });
                      }}
                      placeholder="مثال: 50000 كم"
                      className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white focus:border-cyan-500 outline-none font-mono"
                    />
                  </div>

                  <div>
                    <label className="text-xs text-slate-300 block mb-1">تاريخ انتهاء التأمين</label>
                    <input
                      type="date"
                      value={formData.insuranceExpiryDate}
                      onChange={(e) => setFormData({ ...formData, insuranceExpiryDate: e.target.value })}
                      className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white focus:border-cyan-500 outline-none"
                    />
                  </div>

                  <div>
                    <label className="text-xs text-slate-300 block mb-1">تاريخ انتهاء رخصة السير</label>
                    <input
                      type="date"
                      value={formData.licenseExpiryDate}
                      onChange={(e) => setFormData({ ...formData, licenseExpiryDate: e.target.value })}
                      className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white focus:border-cyan-500 outline-none"
                    />
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-between pt-2 border-t border-slate-800">
                <div className="text-[11px] text-slate-400">
                  {formData.assignedBranchId ? (
                    <span>المركبة مخصصة لفرع: <b className="text-cyan-400">{getBranchName(formData.assignedBranchId)}</b></span>
                  ) : (
                    <span className="text-emerald-400 font-bold">✓ المركبة عامة وتظهر لكافة فروع الشركة وخطوط النقل</span>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setIsAddModalOpen(false)}
                    className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-semibold cursor-pointer"
                  >
                    إلغاء
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2 bg-amber-600 hover:bg-amber-500 text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 shadow-lg shadow-amber-950/50 cursor-pointer"
                  >
                    <CheckCircle className="w-4 h-4" />
                    {editingVehicle ? 'حفظ التعديلات' : 'تسجيل المركبة بالأسطول'}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
