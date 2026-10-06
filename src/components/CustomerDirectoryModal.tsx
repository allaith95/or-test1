import React, { useState, useMemo } from 'react';
import { useOrca } from '../context/OrcaContext';
import { Customer, Governorate, IdDocumentType } from '../types';
import { DEFAULT_ID_DOCUMENT_TYPES } from '../data/initialData';
import { normalizeCustomerNames } from '../utils/nameUtils';
import { formatLatinDate, toLatinDigits } from '../utils/numberFormatter';
import { BirthDateField } from './BirthDateField';
import {
  blockNonIntegerKeys,
  blockNonPhoneKeys,
  sanitizeDigitsOnly,
  sanitizePhone,
} from '../utils/numberSanitizer';
import {
  Users,
  Search,
  Plus,
  UserCheck,
  Phone,
  CreditCard,
  Building,
  MapPin,
  CheckCircle,
  X,
  AlertTriangle,
  Upload,
  Image as ImageIcon,
  ExternalLink,
  Shield,
  Briefcase,
  Trash2,
  Edit2,
  Package,
  ArrowUpRight,
  ArrowDownLeft,
  Calendar,
  DollarSign,
  CheckCircle2,
  Clock,
  ShieldAlert,
  FileText,
  Filter,
} from 'lucide-react';
import { PhotoFromIndexedDB } from './PhotoFromIndexedDB';

interface CustomerDirectoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectCustomer?: (customer: Customer) => void;
  mode?: 'picker' | 'manage';
}

export const CustomerDirectoryModal: React.FC<CustomerDirectoryModalProps> = ({
  isOpen,
  onClose,
  onSelectCustomer,
  mode = 'picker',
}) => {
  const {
    customers,
    parcels,
    addCustomer,
    updateCustomer,
    deleteCustomer,
    currentBranch,
    brandingSettings,
    formatCurrency,
    ensureServerConnected,
  } = useOrca();

  const idDocumentTypes: string[] =
    brandingSettings?.idDocumentTypes && brandingSettings.idDocumentTypes.length > 0
      ? brandingSettings.idDocumentTypes
      : DEFAULT_ID_DOCUMENT_TYPES;

  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCity, setSelectedCity] = useState<string>('all');
  const [selectedType, setSelectedType] = useState<string>('all');

  // Form Modal / Inline State
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [editingCustomerInModal, setEditingCustomerInModal] = useState<Customer | null>(null);

  // View Customer Details Modal
  const [selectedCustomerForView, setSelectedCustomerForView] = useState<Customer | null>(null);
  const [historySearchTerm, setHistorySearchTerm] = useState('');
  const [historyDirectionFilter, setHistoryDirectionFilter] = useState<'all' | 'sent' | 'received'>('all');
  const [historyStatusFilter, setHistoryStatusFilter] = useState<string>('all');

  // Deletion modals state
  const [customerToDelete, setCustomerToDelete] = useState<{ id: string; name: string } | null>(null);
  const [blockedDeleteAlert, setBlockedDeleteAlert] = useState<{
    customer: Customer;
    sentCount: number;
    receivedCount: number;
    total: number;
  } | null>(null);

  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  // Helper to calculate total customer operations across all parcels (sent + received)
  const getCustomerOperations = (c: Customer) => {
    if (!parcels) return { sentCount: 0, receivedCount: 0, total: 0, sentList: [], receivedList: [] };
    const cPhone = (c.phone || '').trim().toLowerCase();
    const cNatId = (c.nationalId || '').trim().toLowerCase();
    const cName = (c.fullName || '').trim().toLowerCase();
    const cId = c.id;

    const sentList = parcels.filter((p) => {
      const sPhone = (p.sender?.phone || '').trim().toLowerCase();
      const sNatId = (p.sender?.nationalId || '').trim().toLowerCase();
      const sName = (p.sender?.name || '').trim().toLowerCase();
      const sCustId = p.sender?.customerId;

      if (cId && sCustId === cId) return true;
      if (cPhone && sPhone && (sPhone === cPhone || sPhone.includes(cPhone) || cPhone.includes(sPhone))) return true;
      if (cNatId && sNatId && sNatId === cNatId) return true;
      if (cName && sName && sName === cName) return true;
      return false;
    });

    const receivedList = parcels.filter((p) => {
      const rPhone = (p.receiver?.phone || '').trim().toLowerCase();
      const rNatId = (p.receiver?.nationalId || '').trim().toLowerCase();
      const rName = (p.receiver?.name || '').trim().toLowerCase();
      const rCustId = p.receiver?.customerId;

      if (cId && rCustId === cId) return true;
      if (cPhone && rPhone && (rPhone === cPhone || rPhone.includes(cPhone) || cPhone.includes(rPhone))) return true;
      if (cNatId && rNatId && rNatId === cNatId) return true;
      if (cName && rName && rName === cName) return true;
      return false;
    });

    return {
      sentCount: sentList.length,
      receivedCount: receivedList.length,
      total: sentList.length + receivedList.length,
      sentList,
      receivedList,
    };
  };

  // Guarded delete check
  const requestDeleteCustomer = (c: Customer) => {
    const ops = getCustomerOperations(c);
    if (ops.total > 0) {
      setBlockedDeleteAlert({
        customer: c,
        sentCount: ops.sentCount,
        receivedCount: ops.receivedCount,
        total: ops.total,
      });
    } else {
      setCustomerToDelete({ id: c.id, name: c.fullName });
    }
  };

  const handleConfirmDeleteSingle = () => {
    if (customerToDelete) {
      deleteCustomer(customerToDelete.id);
      showToast(`✓ تم حذف بطاقة العميل [${customerToDelete.name}] نهائياً بنجاح`);
      if (selectedCustomerForView && selectedCustomerForView.id === customerToDelete.id) {
        setSelectedCustomerForView(null);
      }
      setCustomerToDelete(null);
    }
  };

  // New & Edit Customer Form State
  const [formData, setFormData] = useState({
    fullName: '',
    firstName: '',
    fatherName: '',
    lastName: '',
    motherName: '',
    birthDate: '',
    nationalId: '',
    idType: 'syrian' as IdDocumentType,
    phone: '',
    secondaryPhone: '',
    city: currentBranch.governorate as Governorate,
    address: '',
    companyName: '',
    customerType: 'individual' as 'individual' | 'merchant' | 'corporate',
    idPhotoFront: '',
    idPhotoBack: '',
    notes: '',
  });

  const [idFrontPreview, setIdFrontPreview] = useState<string>('');
  const [idBackPreview, setIdBackPreview] = useState<string>('');

  const openAddForm = () => {
    setEditingCustomerInModal(null);
    setFormData({
      fullName: '',
      firstName: '',
      fatherName: '',
      lastName: '',
      motherName: '',
      birthDate: '',
      nationalId: '',
      idType: 'syrian',
      phone: '',
      secondaryPhone: '',
      city: currentBranch.governorate as Governorate,
      address: '',
      companyName: '',
      customerType: 'individual',
      idPhotoFront: '',
      idPhotoBack: '',
      notes: '',
    });
    setIdFrontPreview('');
    setIdBackPreview('');
    setIsAddOpen(true);
  };

  const openEditForm = (customer: Customer) => {
    setEditingCustomerInModal(customer);
    const norm = normalizeCustomerNames({
      fullName: customer.fullName || '',
      firstName: customer.firstName || '',
      fatherName: customer.fatherName || '',
      lastName: customer.lastName || '',
    });

    setFormData({
      fullName: norm.fullName,
      firstName: norm.firstName,
      fatherName: norm.fatherName,
      lastName: norm.lastName,
      motherName: customer.motherName || '',
      birthDate: customer.birthDate || '',
      nationalId: customer.nationalId || '',
      idType: customer.idType || 'syrian',
      phone: customer.phone || '',
      secondaryPhone: customer.secondaryPhone || '',
      city: customer.city || (currentBranch.governorate as Governorate),
      address: customer.address || '',
      companyName: customer.companyName || '',
      customerType: customer.customerType || 'individual',
      idPhotoFront: customer.idPhotoFront || '',
      idPhotoBack: customer.idPhotoBack || '',
      notes: customer.notes || '',
    });
    setIdFrontPreview(customer.idPhotoFront || '');
    setIdBackPreview(customer.idPhotoBack || '');
    setIsAddOpen(true);
  };

  // Activity calculation for viewing customer
  const viewingCustomerActivity = useMemo(() => {
    if (!selectedCustomerForView || !parcels) {
      return {
        sentList: [],
        receivedList: [],
        allList: [],
        stats: { totalSent: 0, totalReceived: 0, totalCod: 0, totalShipping: 0 },
      };
    }
    const ops = getCustomerOperations(selectedCustomerForView);
    const sent = ops.sentList.map((p) => ({ ...p, _direction: 'sent' as const }));
    const received = ops.receivedList.map((p) => ({ ...p, _direction: 'received' as const }));

    const combined = [...sent, ...received];
    const uniqueList = combined.filter(
      (p, index, self) => self.findIndex((t) => t.id === p.id && t._direction === p._direction) === index
    );

    const allList = [...uniqueList].sort(
      (a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime()
    );

    const totalCod = sent.reduce((acc, curr) => acc + (curr.codAmount || 0), 0);
    const totalShipping = uniqueList.reduce((acc, curr) => acc + (curr.shippingCost || 0), 0);

    return {
      sentList: sent,
      receivedList: received,
      allList,
      stats: {
        totalSent: sent.length,
        totalReceived: received.length,
        totalCod,
        totalShipping,
      },
    };
  }, [selectedCustomerForView, parcels]);

  const filteredCustomerActivityList = useMemo(() => {
    if (!selectedCustomerForView) return [];
    let list = viewingCustomerActivity.allList;

    if (historyDirectionFilter === 'sent') {
      list = viewingCustomerActivity.sentList;
    } else if (historyDirectionFilter === 'received') {
      list = viewingCustomerActivity.receivedList;
    }

    if (historyStatusFilter !== 'all') {
      if (historyStatusFilter === 'delivered') {
        list = list.filter((p) => p.handlingStatus === 'delivered');
      } else if (historyStatusFilter === 'returned') {
        list = list.filter((p) => p.handlingStatus === 'returned');
      } else if (historyStatusFilter === 'in_transit') {
        list = list.filter(
          (p) =>
            p.handlingStatus === 'in_transit' ||
            p.handlingStatus === 'loaded_in_truck' ||
            p.handlingStatus === 'out_for_delivery'
        );
      } else if (historyStatusFilter === 'pending') {
        list = list.filter(
          (p) =>
            p.handlingStatus === 'received_at_hub' ||
            p.handlingStatus === 'received_at_origin_hub' ||
            p.handlingStatus === 'received_at_dest'
        );
      }
    }

    if (historySearchTerm.trim()) {
      const q = historySearchTerm.trim().toLowerCase();
      list = list.filter((p) => {
        return (
          (p.trackingNumber || '').toLowerCase().includes(q) ||
          (p.paperReceiptNumber || '').toLowerCase().includes(q) ||
          (p.receiver?.name || '').toLowerCase().includes(q) ||
          (p.receiver?.phone || '').includes(q) ||
          (p.sender?.name || '').toLowerCase().includes(q) ||
          (p.sender?.phone || '').includes(q) ||
          (p.sender?.city || '').toLowerCase().includes(q) ||
          (p.receiver?.city || '').toLowerCase().includes(q) ||
          (p.contentDescription || '').toLowerCase().includes(q)
        );
      });
    }

    return list;
  }, [selectedCustomerForView, viewingCustomerActivity, historyDirectionFilter, historyStatusFilter, historySearchTerm]);

  if (!isOpen) return null;

  // Filter customers list
  const filteredCustomers = customers.filter((c) => {
    const matchSearch =
      c.fullName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (c.phone && c.phone.includes(searchTerm)) ||
      (c.nationalId && c.nationalId.includes(searchTerm)) ||
      (c.companyName && c.companyName.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (c.code && c.code.toLowerCase().includes(searchTerm.toLowerCase()));

    const matchCity = selectedCity === 'all' || c.city === selectedCity;
    const matchType = selectedType === 'all' || c.customerType === selectedType;

    return matchSearch && matchCity && matchType;
  });

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>, side: 'front' | 'back') => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      if (side === 'front') {
        setIdFrontPreview(result);
        setFormData((prev) => ({ ...prev, idPhotoFront: result }));
      } else {
        setIdBackPreview(result);
        setFormData((prev) => ({ ...prev, idPhotoBack: result }));
      }
    };
    reader.readAsDataURL(file);
  };

  const handleSaveCustomer = async (e: React.FormEvent) => {
    e.preventDefault();

    const ok = await ensureServerConnected();
    if (!ok) return;

    const derivedFullName = [formData.firstName.trim(), formData.fatherName.trim(), formData.lastName.trim()].filter(Boolean).join(' ');
    const finalFullName = formData.fullName.trim() || derivedFullName;

    if (!finalFullName.trim() || !formData.phone.trim()) {
      alert('يرجى كتابة اسم العميل ورقم الهاتف على الأقل');
      return;
    }

    // Check duplicate national ID if entered
    if (formData.nationalId.trim()) {
      const exists = customers.some(
        (c) => c.nationalId === formData.nationalId.trim() && (!editingCustomerInModal || c.id !== editingCustomerInModal.id)
      );
      if (exists) {
        if (!confirm('الرقم الوطني هذا مسجل مسبقاً لعميل آخر. هل ترغب بالاستمرار والحفظ؟')) {
          return;
        }
      }
    }

    const norm = normalizeCustomerNames({
      fullName: finalFullName,
      firstName: formData.firstName.trim(),
      fatherName: formData.fatherName.trim(),
      lastName: formData.lastName.trim(),
    });

    if (editingCustomerInModal) {
      // Update existing customer
      updateCustomer(editingCustomerInModal.id, {
        ...formData,
        fullName: norm.fullName,
        firstName: norm.firstName,
        fatherName: norm.fatherName,
        lastName: norm.lastName,
        motherName: formData.motherName.trim(),
        birthDate: formData.birthDate.trim(),
        nationalId: formData.nationalId.trim(),
        phone: formData.phone.trim(),
        idPhotoFront: idFrontPreview,
        idPhotoBack: idBackPreview,
      });

      // Update active view if open
      if (selectedCustomerForView && selectedCustomerForView.id === editingCustomerInModal.id) {
        setSelectedCustomerForView({
          ...selectedCustomerForView,
          ...formData,
          fullName: norm.fullName,
          firstName: norm.firstName,
          fatherName: norm.fatherName,
          lastName: norm.lastName,
          idPhotoFront: idFrontPreview,
          idPhotoBack: idBackPreview,
        });
      }

      showToast(`✓ تم تحديث بيانات العميل [${norm.fullName}] بنجاح`);
      setIsAddOpen(false);
      setEditingCustomerInModal(null);
    } else {
      // Create new customer
      const created = addCustomer({
        ...formData,
        fullName: norm.fullName,
        firstName: norm.firstName,
        fatherName: norm.fatherName,
        lastName: norm.lastName,
        motherName: formData.motherName.trim(),
        birthDate: formData.birthDate.trim(),
        nationalId: formData.nationalId.trim(),
        phone: formData.phone.trim(),
        idPhotoFront: idFrontPreview,
        idPhotoBack: idBackPreview,
        isBlacklisted: false,
        branchId: currentBranch.id,
      });

      showToast(`✓ تم تسجيل العميل الجديد [${norm.fullName}] في الدليل`);
      setIsAddOpen(false);

      if (onSelectCustomer) {
        onSelectCustomer(created);
        onClose();
      }
    }
  };

  const selectAndClose = (customer: Customer) => {
    if (onSelectCustomer) {
      onSelectCustomer(customer);
      onClose();
    }
  };

  const openViewCustomer = (c: Customer) => {
    setSelectedCustomerForView(c);
    setHistorySearchTerm('');
    setHistoryDirectionFilter('all');
    setHistoryStatusFilter('all');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-3 sm:p-4 overflow-y-auto">
      <div className="bg-slate-900 border border-slate-700/90 w-full max-w-5xl rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="p-4 sm:p-5 bg-gradient-to-r from-slate-800 to-cyan-950/40 border-b border-slate-700/80 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-cyan-500/20 border border-cyan-500/40 flex items-center justify-center text-cyan-400 shadow-inner">
              <Users className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base sm:text-lg font-bold text-white flex items-center gap-2">
                دليل العملاء والزبائن المعتمدين
                <span className="text-xs bg-cyan-500/20 text-cyan-300 px-2.5 py-0.5 rounded-full border border-cyan-500/30 font-semibold">
                  {customers.length} عميل مسجل
                </span>
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                {mode === 'picker'
                  ? 'اختر العميل للتحميل الفوري لبياناته وصور هويته في بوليصة الشحن دون الحاجة لإعادة المسح'
                  : 'إدارة وتصفح وتعديل بيانات العملاء وسجلات الحركات والوثائق الرسمية'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {!isAddOpen && (
              <button
                type="button"
                onClick={openAddForm}
                className="px-3.5 py-2 bg-gradient-to-r from-cyan-600 to-cyan-500 hover:from-cyan-500 hover:to-cyan-400 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition shadow-lg shadow-cyan-950/40 cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>إضافة عميل جديد</span>
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Add / Edit Customer Inline Form */}
        {isAddOpen ? (
          <form onSubmit={handleSaveCustomer} className="p-4 sm:p-6 overflow-y-auto space-y-4 bg-slate-950/60 custom-scrollbar flex-1">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h4 className="text-sm font-bold text-cyan-400 flex items-center gap-2">
                {editingCustomerInModal ? (
                  <>
                    <Edit2 className="w-4 h-4 text-amber-400" />
                    <span>تعديل بيانات العميل: {editingCustomerInModal.fullName}</span>
                  </>
                ) : (
                  <>
                    <Plus className="w-4 h-4 text-cyan-400" />
                    <span>تسجيل ملف عميل جديد في الدليل العام</span>
                  </>
                )}
              </h4>
              <button
                type="button"
                onClick={() => {
                  setIsAddOpen(false);
                  setEditingCustomerInModal(null);
                }}
                className="text-xs text-slate-400 hover:text-slate-200 px-3 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 transition"
              >
                إلغاء والعودة للقائمة
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div>
                <label className="text-xs text-slate-300 font-semibold block mb-1">
                  الاسم الأول <span className="text-rose-400">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="محمد"
                  value={formData.firstName}
                  onChange={(e) => {
                    const fName = e.target.value;
                    const combined = [fName, formData.fatherName, formData.lastName].filter(Boolean).join(' ');
                    setFormData({ ...formData, firstName: fName, fullName: combined });
                  }}
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white focus:border-cyan-500 outline-none"
                />
              </div>

              <div>
                <label className="text-xs text-slate-300 font-semibold block mb-1">اسم الأب</label>
                <input
                  type="text"
                  placeholder="نادر"
                  value={formData.fatherName}
                  onChange={(e) => {
                    const father = e.target.value;
                    const combined = [formData.firstName, father, formData.lastName].filter(Boolean).join(' ');
                    setFormData({ ...formData, fatherName: father, fullName: combined });
                  }}
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white focus:border-cyan-500 outline-none"
                />
              </div>

              <div>
                <label className="text-xs text-slate-300 font-semibold block mb-1">
                  الكنية / العائلة <span className="text-rose-400">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="الدمشقي"
                  value={formData.lastName}
                  onChange={(e) => {
                    const lName = e.target.value;
                    const combined = [formData.firstName, formData.fatherName, lName].filter(Boolean).join(' ');
                    setFormData({ ...formData, lastName: lName, fullName: combined });
                  }}
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white focus:border-cyan-500 outline-none"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div>
                <label className="text-xs text-slate-300 font-semibold block mb-1">اسم الأم</label>
                <input
                  type="text"
                  placeholder="فاطمة"
                  value={formData.motherName}
                  onChange={(e) => setFormData({ ...formData, motherName: e.target.value })}
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white focus:border-cyan-500 outline-none"
                />
              </div>

              <div>
                <label className="text-xs text-slate-300 font-semibold block mb-1">تاريخ الميلاد (أرقام فقط)</label>
                <BirthDateField
                  id="modal_customer_birth_date"
                  value={formData.birthDate}
                  onChange={(iso, dmy) => setFormData({ ...formData, birthDate: iso || dmy })}
                  placeholder="DD/MM/YYYY (أرقام فقط)"
                />
              </div>

              <div>
                <label className="text-xs text-slate-300 font-semibold block mb-1">نوع الوثيقة الوطنية</label>
                <select
                  value={formData.idType}
                  onChange={(e) => setFormData({ ...formData, idType: e.target.value as IdDocumentType })}
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white focus:border-cyan-500 outline-none"
                >
                  <option value="syrian">هوية وطنية سورية</option>
                  <option value="palestinian">وثيقة لاجئ فلسطيني</option>
                  <option value="passport">جواز سفر</option>
                  <option value="driving_license">شهادة قيادة</option>
                  <option value="military_card">بطاقة نقابية / عسكرية</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div>
                <label className="text-xs text-slate-300 font-semibold block mb-1">
                  الرقم الوطني (11 رقماً)
                </label>
                <input
                  type="text"
                  inputMode="numeric"
                  maxLength={11}
                  onKeyDown={blockNonIntegerKeys}
                  placeholder="01010012345"
                  value={formData.nationalId}
                  onChange={(e) => setFormData({ ...formData, nationalId: sanitizeDigitsOnly(e.target.value).slice(0, 11) })}
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white font-mono focus:border-cyan-500 outline-none"
                />
              </div>

              <div>
                <label className="text-xs text-slate-300 font-semibold block mb-1">
                  رقم الهاتف الأساسي <span className="text-rose-400">*</span>
                </label>
                <input
                  type="tel"
                  required
                  inputMode="tel"
                  onKeyDown={blockNonPhoneKeys}
                  placeholder="0912345678"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: sanitizePhone(e.target.value) })}
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white font-mono focus:border-cyan-500 outline-none"
                />
              </div>

              <div>
                <label className="text-xs text-slate-300 font-semibold block mb-1">رقم هاتف إضافي (اختياري)</label>
                <input
                  type="tel"
                  inputMode="tel"
                  onKeyDown={blockNonPhoneKeys}
                  placeholder="0987654321"
                  value={formData.secondaryPhone}
                  onChange={(e) => setFormData({ ...formData, secondaryPhone: sanitizePhone(e.target.value) })}
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white font-mono focus:border-cyan-500 outline-none"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div>
                <label className="text-xs text-slate-300 font-semibold block mb-1">المحافظة</label>
                <select
                  value={formData.city}
                  onChange={(e) => setFormData({ ...formData, city: e.target.value as Governorate })}
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white focus:border-cyan-500 outline-none"
                >
                  <option value="دمشق">دمشق</option>
                  <option value="ريف دمشق">ريف دمشق</option>
                  <option value="حلب">حلب</option>
                  <option value="حمص">حمص</option>
                  <option value="حماة">حماة</option>
                  <option value="اللاذقية">اللاذقية</option>
                  <option value="طرطوس">طرطوس</option>
                  <option value="إدلب">إدلب</option>
                  <option value="درعا">درعا</option>
                  <option value="السويداء">السويداء</option>
                  <option value="القنيطرة">القنيطرة</option>
                  <option value="دير الزور">دير الزور</option>
                  <option value="الحسكة">الحسكة</option>
                  <option value="الرقة">الرقة</option>
                </select>
              </div>

              <div>
                <label className="text-xs text-slate-300 font-semibold block mb-1">تصنيف العميل</label>
                <select
                  value={formData.customerType}
                  onChange={(e) => setFormData({ ...formData, customerType: e.target.value as 'individual' | 'merchant' | 'corporate' })}
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white focus:border-cyan-500 outline-none"
                >
                  <option value="individual">عميل أفراد (شخصي)</option>
                  <option value="merchant">تاجر / متجر إلكتروني</option>
                  <option value="corporate">شركة / مؤسسة</option>
                </select>
              </div>

              <div>
                <label className="text-xs text-slate-300 font-semibold block mb-1">اسم المؤسسة / المتجر (إن وجد)</label>
                <input
                  type="text"
                  placeholder="شركة الأمان للتجارة"
                  value={formData.companyName}
                  onChange={(e) => setFormData({ ...formData, companyName: e.target.value })}
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white focus:border-cyan-500 outline-none"
                />
              </div>
            </div>

            <div>
              <label className="text-xs text-slate-300 font-semibold block mb-1">العنوان التفصيلي</label>
              <input
                type="text"
                placeholder="الشارع، الحي، بجانب معلم معروف..."
                value={formData.address}
                onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white focus:border-cyan-500 outline-none"
              />
            </div>

            {/* ID Photos Section */}
            <div className="pt-2 border-t border-slate-800">
              <h5 className="text-xs font-bold text-slate-300 mb-2 flex items-center gap-1.5">
                <CreditCard className="w-4 h-4 text-cyan-400" />
                صور وثيقة الهوية الشخصية (وجهين)
              </h5>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* Front Side */}
                <div className="border border-dashed border-slate-700 rounded-2xl p-3 bg-slate-950 text-center flex flex-col items-center justify-center">
                  <span className="text-xs font-semibold text-slate-300 mb-2">الوجه الأمامي للهوية (الصورة والاسم)</span>
                  {idFrontPreview ? (
                    <div className="relative w-full h-32 rounded-xl overflow-hidden border border-slate-700 mb-2">
                      <PhotoFromIndexedDB
                        photoKey={idFrontPreview}
                        alt="ID Front"
                        className="w-full h-full object-cover"
                      />
                      <button
                        type="button"
                        onClick={() => {
                          setIdFrontPreview('');
                          setFormData((p) => ({ ...p, idPhotoFront: '' }));
                        }}
                        className="absolute top-1.5 right-1.5 bg-rose-600 hover:bg-rose-500 text-white p-1 rounded-lg text-[10px] cursor-pointer"
                      >
                        حذف الصورة
                      </button>
                    </div>
                  ) : (
                    <label className="w-full py-6 flex flex-col items-center justify-center cursor-pointer hover:bg-slate-900 rounded-xl transition">
                      <Upload className="w-6 h-6 text-cyan-400 mb-1" />
                      <span className="text-xs text-cyan-400 font-medium">رفع صورة الوجه الأمامي</span>
                      <span className="text-[10px] text-slate-500">JPG, PNG, WebP</span>
                      <input
                        type="file"
                        accept="image/*"
                        onChange={(e) => handleFileUpload(e, 'front')}
                        className="hidden"
                      />
                    </label>
                  )}
                </div>

                {/* Back Side */}
                <div className="border border-dashed border-slate-700 rounded-2xl p-3 bg-slate-950 text-center flex flex-col items-center justify-center">
                  <span className="text-xs font-semibold text-slate-300 mb-2">الوجه الخلفي للهوية (الباركود والرقم الوطني)</span>
                  {idBackPreview ? (
                    <div className="relative w-full h-32 rounded-xl overflow-hidden border border-slate-700 mb-2">
                      <PhotoFromIndexedDB
                        photoKey={idBackPreview}
                        alt="ID Back"
                        className="w-full h-full object-cover"
                      />
                      <button
                        type="button"
                        onClick={() => {
                          setIdBackPreview('');
                          setFormData((p) => ({ ...p, idPhotoBack: '' }));
                        }}
                        className="absolute top-1.5 right-1.5 bg-rose-600 hover:bg-rose-500 text-white p-1 rounded-lg text-[10px] cursor-pointer"
                      >
                        حذف الصورة
                      </button>
                    </div>
                  ) : (
                    <label className="w-full py-6 flex flex-col items-center justify-center cursor-pointer hover:bg-slate-900 rounded-xl transition">
                      <Upload className="w-6 h-6 text-cyan-400 mb-1" />
                      <span className="text-xs text-cyan-400 font-medium">رفع صورة الوجه الخلفي</span>
                      <span className="text-[10px] text-slate-500">JPG, PNG, WebP</span>
                      <input
                        type="file"
                        accept="image/*"
                        onChange={(e) => handleFileUpload(e, 'back')}
                        className="hidden"
                      />
                    </label>
                  )}
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-800">
              <button
                type="button"
                onClick={() => {
                  setIsAddOpen(false);
                  setEditingCustomerInModal(null);
                }}
                className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-semibold cursor-pointer"
              >
                إلغاء
              </button>
              <button
                type="submit"
                className="px-6 py-2.5 bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-500 hover:to-emerald-400 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-lg shadow-emerald-950/50 cursor-pointer"
              >
                <CheckCircle className="w-4 h-4" />
                <span>{editingCustomerInModal ? 'حفظ التعديلات على بطاقة العميل' : 'حفظ العميل واختياره'}</span>
              </button>
            </div>
          </form>
        ) : (
          <>
            {/* Search & Filter Bar */}
            <div className="p-4 bg-slate-900/90 border-b border-slate-800 flex flex-wrap gap-3 items-center">
              <div className="relative flex-1 min-w-[240px]">
                <Search className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="ابحث بالاسم الكامل، الرقم الوطني، رقم الهاتف، أو اسم المؤسسة..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl pr-9 pl-4 py-2 text-xs text-white placeholder-slate-500 focus:border-cyan-500 outline-none"
                />
              </div>

              <select
                value={selectedCity}
                onChange={(e) => setSelectedCity(e.target.value)}
                className="bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-300 focus:border-cyan-500 outline-none"
              >
                <option value="all">كافة المحافظات</option>
                <option value="دمشق">دمشق</option>
                <option value="ريف دمشق">ريف دمشق</option>
                <option value="حلب">حلب</option>
                <option value="حمص">حمص</option>
                <option value="حماة">حماة</option>
                <option value="اللاذقية">اللاذقية</option>
                <option value="طرطوس">طرطوس</option>
                <option value="إدلب">إدلب</option>
                <option value="درعا">درعا</option>
                <option value="السويداء">السويداء</option>
                <option value="القنيطرة">القنيطرة</option>
                <option value="دير الزور">دير الزور</option>
                <option value="الحسكة">الحسكة</option>
                <option value="الرقة">الرقة</option>
              </select>

              <select
                value={selectedType}
                onChange={(e) => setSelectedType(e.target.value)}
                className="bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-300 focus:border-cyan-500 outline-none"
              >
                <option value="all">كافة الأنواع</option>
                <option value="individual">أفراد</option>
                <option value="merchant">تجار</option>
                <option value="corporate">شركات</option>
              </select>
            </div>

            {/* Customers Grid */}
            <div className="p-4 overflow-y-auto flex-1 max-h-[60vh] custom-scrollbar">
              {filteredCustomers.length === 0 ? (
                <div className="text-center py-12 text-slate-500 space-y-3">
                  <Users className="w-12 h-12 mx-auto text-slate-600" />
                  <p className="text-sm font-medium">لم يتم العثور على عملاء مطابقين للبحث</p>
                  <button
                    type="button"
                    onClick={openAddForm}
                    className="px-4 py-2 bg-cyan-600 hover:bg-cyan-500 text-white rounded-xl text-xs font-bold inline-flex items-center gap-1.5 transition cursor-pointer shadow-lg shadow-cyan-950/40"
                  >
                    <Plus className="w-4 h-4" />
                    <span>إضافة عميل جديد الآن</span>
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                  {filteredCustomers.map((cst) => {
                    const ops = getCustomerOperations(cst);
                    return (
                      <div
                        key={cst.id}
                        className="bg-slate-950/80 border border-slate-800 hover:border-cyan-500/50 rounded-2xl p-4 transition duration-150 flex flex-col justify-between group"
                      >
                        <div>
                          <div className="flex items-start justify-between gap-2 mb-2">
                            <div className="flex items-center gap-2">
                              <div className="w-8 h-8 rounded-xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-300 font-bold text-xs">
                                {cst.fullName.slice(0, 1)}
                              </div>
                              <div>
                                <h4 className="text-xs font-bold text-white group-hover:text-cyan-300 transition line-clamp-1">
                                  {cst.fullName}
                                </h4>
                                <span className="text-[10px] text-slate-500 font-mono">
                                  {cst.code || 'NO-CODE'}
                                </span>
                              </div>
                            </div>
                            <span
                              className={`text-[9px] px-2 py-0.5 rounded-full font-semibold border ${
                                cst.customerType === 'merchant'
                                  ? 'bg-amber-500/10 text-amber-300 border-amber-500/30'
                                  : cst.customerType === 'corporate'
                                  ? 'bg-purple-500/10 text-purple-300 border-purple-500/30'
                                  : 'bg-slate-800 text-slate-300 border-slate-700'
                              }`}
                            >
                              {cst.customerType === 'merchant'
                                ? 'تاجر'
                                : cst.customerType === 'corporate'
                                ? 'شركة'
                                : 'أفراد'}
                            </span>
                          </div>

                          <div className="space-y-1 text-[11px] text-slate-400 mt-2">
                            <div className="flex items-center gap-1.5 font-mono">
                              <Phone className="w-3 h-3 text-emerald-400" />
                              <span className="text-slate-300">{cst.phone}</span>
                            </div>
                            {cst.nationalId && (
                              <div className="flex items-center gap-1.5 font-mono text-[10px]">
                                <CreditCard className="w-3 h-3 text-cyan-400" />
                                <span>{cst.nationalId}</span>
                              </div>
                            )}
                            <div className="flex items-center gap-1.5 text-[10px]">
                              <MapPin className="w-3 h-3 text-slate-500" />
                              <span className="text-slate-400 truncate">
                                {cst.city} {cst.address ? `- ${cst.address}` : ''}
                              </span>
                            </div>
                          </div>

                          {/* ID photos & activity indicator */}
                          <div className="flex items-center justify-between gap-2 mt-2 pt-2 border-t border-slate-800/80 text-[10px] text-slate-400">
                            <span className="flex items-center gap-1 text-slate-300">
                              <ImageIcon className="w-3.5 h-3.5 text-cyan-400" />
                              {cst.idPhotoFront || cst.idPhotoBack ? (
                                <span className="text-emerald-400 font-medium">الهوية مرفقة</span>
                              ) : (
                                <span className="text-slate-500">لا توجد هوية</span>
                              )}
                            </span>
                            <span className="text-cyan-400 font-mono font-bold">
                              {ops.total} عملية مسجلة
                            </span>
                          </div>
                        </div>

                        <div className="flex items-center justify-between gap-1.5 mt-3 pt-2 border-t border-slate-800/80">
                          <div className="flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() => openEditForm(cst)}
                              title="تعديل بيانات العميل"
                              className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-amber-400 transition cursor-pointer"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => requestDeleteCustomer(cst)}
                              title="حذف بطاقة العميل"
                              className="p-1.5 rounded-lg bg-slate-800 hover:bg-rose-950 text-slate-400 hover:text-rose-300 transition cursor-pointer"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>

                          <div className="flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => openViewCustomer(cst)}
                              className="px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-semibold transition cursor-pointer"
                            >
                              عرض التفاصيل
                            </button>
                            {mode === 'picker' && (
                              <button
                                type="button"
                                onClick={() => selectAndClose(cst)}
                                className="px-3 py-1.5 bg-cyan-600 hover:bg-cyan-500 text-white rounded-xl text-xs font-bold flex items-center gap-1 transition shadow-md shadow-cyan-950/40 cursor-pointer"
                              >
                                <UserCheck className="w-3.5 h-3.5" />
                                <span>اختيار</span>
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </>
        )}

        {/* Customer Detail & Full Transaction Ledger Modal */}
        {selectedCustomerForView && (
          <div className="fixed inset-0 z-60 flex items-center justify-center bg-black/85 backdrop-blur-md p-2 sm:p-4 overflow-y-auto">
            <div className="bg-slate-900 border border-slate-700 w-full max-w-4xl rounded-3xl p-4 sm:p-6 shadow-2xl space-y-4 my-auto max-h-[92vh] flex flex-col overflow-hidden">
              {/* Header */}
              <div className="flex items-center justify-between border-b border-slate-800 pb-3 shrink-0">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-cyan-500/20 border border-cyan-500/40 flex items-center justify-center text-cyan-300 font-bold text-sm">
                    {selectedCustomerForView.fullName.slice(0, 1)}
                  </div>
                  <div>
                    <h4 className="text-base font-bold text-white flex items-center gap-2">
                      {selectedCustomerForView.fullName}
                      {selectedCustomerForView.isBlacklisted && (
                        <span className="text-[10px] bg-rose-500/20 text-rose-300 border border-rose-500/30 px-2 py-0.5 rounded-full font-semibold">
                          محظور
                        </span>
                      )}
                    </h4>
                    <div className="flex items-center gap-2 text-xs text-slate-400 font-mono mt-0.5">
                      <span className="text-cyan-400 font-bold">الكود: {selectedCustomerForView.code}</span>
                      <span>•</span>
                      <span>{selectedCustomerForView.city}</span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      const c = selectedCustomerForView;
                      setSelectedCustomerForView(null);
                      openEditForm(c);
                    }}
                    className="px-3 py-1.5 bg-amber-600/30 hover:bg-amber-600/50 border border-amber-500/40 text-amber-200 rounded-xl text-xs font-bold flex items-center gap-1.5 transition cursor-pointer"
                  >
                    <Edit2 className="w-3.5 h-3.5 text-amber-300" />
                    <span>تعديل بيانات العميل</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => requestDeleteCustomer(selectedCustomerForView)}
                    className="px-3 py-1.5 bg-rose-600/20 hover:bg-rose-600/40 border border-rose-500/40 text-rose-300 rounded-xl text-xs font-bold flex items-center gap-1.5 transition cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5 text-rose-400" />
                    <span>حذف بطاقة العميل</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setSelectedCustomerForView(null)}
                    className="p-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
              </div>

              {/* Modal Body */}
              <div className="flex-1 overflow-y-auto space-y-4 pr-1 custom-scrollbar">
                {/* 1. Customer Master Information */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 bg-slate-950 p-4 rounded-2xl border border-slate-800 text-xs">
                  <div>
                    <span className="text-slate-500 block text-[10px]">الاسم الكامل</span>
                    <span className="font-bold text-white">{selectedCustomerForView.fullName}</span>
                  </div>
                  <div>
                    <span className="text-slate-500 block text-[10px]">اسم الأم</span>
                    <span className="text-slate-300">{selectedCustomerForView.motherName || '—'}</span>
                  </div>
                  <div>
                    <span className="text-slate-500 block text-[10px]">تاريخ الميلاد</span>
                    <span className="text-slate-300 font-mono">{selectedCustomerForView.birthDate || '—'}</span>
                  </div>
                  <div>
                    <span className="text-slate-500 block text-[10px]">نوع وتصنيف العميل</span>
                    <span className="text-cyan-300 font-semibold">
                      {selectedCustomerForView.customerType === 'merchant'
                        ? 'تاجر'
                        : selectedCustomerForView.customerType === 'corporate'
                        ? 'شركة'
                        : 'أفراد'}
                    </span>
                  </div>

                  <div>
                    <span className="text-slate-500 block text-[10px]">الرقم الوطني / الوثيقة</span>
                    <span className="font-mono font-bold text-emerald-400">{selectedCustomerForView.nationalId || '—'}</span>
                  </div>
                  <div>
                    <span className="text-slate-500 block text-[10px]">رقم الهاتف الأساسي</span>
                    <span className="font-mono text-cyan-300">{selectedCustomerForView.phone}</span>
                  </div>
                  <div>
                    <span className="text-slate-500 block text-[10px]">المحافظة والعنوان</span>
                    <span className="text-slate-300">{selectedCustomerForView.city} - {selectedCustomerForView.address || 'الفرع'}</span>
                  </div>
                  <div>
                    <span className="text-slate-500 block text-[10px]">المؤسسة / المتجر</span>
                    <span className="text-slate-300">{selectedCustomerForView.companyName || '—'}</span>
                  </div>
                </div>

                {/* 2. ID Document Cards */}
                <div>
                  <h5 className="text-xs font-bold text-slate-300 mb-2 flex items-center gap-1.5">
                    <CreditCard className="w-3.5 h-3.5 text-cyan-400" />
                    وثائق الهوية الشخصية المسجلة
                  </h5>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="bg-slate-950 p-2.5 rounded-2xl border border-slate-800 text-center">
                      <span className="text-[10px] text-slate-400 block mb-1">الوجه الأمامي</span>
                      <PhotoFromIndexedDB
                        photoKey={selectedCustomerForView.idPhotoFront}
                        alt="Front"
                        className="w-full h-28 object-cover rounded-xl border border-slate-800"
                        fallback={
                          <div className="w-full h-28 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-center text-[10px] text-slate-600">
                            لا توجد صورة
                          </div>
                        }
                      />
                    </div>

                    <div className="bg-slate-950 p-2.5 rounded-2xl border border-slate-800 text-center">
                      <span className="text-[10px] text-slate-400 block mb-1">الوجه الخلفي</span>
                      <PhotoFromIndexedDB
                        photoKey={selectedCustomerForView.idPhotoBack}
                        alt="Back"
                        className="w-full h-28 object-cover rounded-xl border border-slate-800"
                        fallback={
                          <div className="w-full h-28 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-center text-[10px] text-slate-600">
                            لا توجد صورة
                          </div>
                        }
                      />
                    </div>
                  </div>
                </div>

                {/* 3. Transaction Summary & Quick Ledger */}
                <div className="space-y-2.5">
                  <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 pb-2">
                    <h5 className="text-xs font-bold text-cyan-400 flex items-center gap-1.5">
                      <Package className="w-4 h-4 text-cyan-400" />
                      سجل سريع لجميع تعاملات العميل (الصادر والوارد)
                    </h5>

                    {/* Quick Filters */}
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => setHistoryDirectionFilter('all')}
                        className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition cursor-pointer ${
                          historyDirectionFilter === 'all'
                            ? 'bg-cyan-600 text-white'
                            : 'bg-slate-800 text-slate-400 hover:text-slate-200'
                        }`}
                      >
                        الكل ({viewingCustomerActivity.allList.length})
                      </button>
                      <button
                        type="button"
                        onClick={() => setHistoryDirectionFilter('sent')}
                        className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition cursor-pointer ${
                          historyDirectionFilter === 'sent'
                            ? 'bg-emerald-600 text-white'
                            : 'bg-slate-800 text-slate-400 hover:text-slate-200'
                        }`}
                      >
                        صادر ({viewingCustomerActivity.stats.totalSent})
                      </button>
                      <button
                        type="button"
                        onClick={() => setHistoryDirectionFilter('received')}
                        className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition cursor-pointer ${
                          historyDirectionFilter === 'received'
                            ? 'bg-purple-600 text-white'
                            : 'bg-slate-800 text-slate-400 hover:text-slate-200'
                        }`}
                      >
                        وارد ({viewingCustomerActivity.stats.totalReceived})
                      </button>
                    </div>
                  </div>

                  {/* Activity Table */}
                  <div className="bg-slate-950 rounded-2xl border border-slate-800 overflow-hidden">
                    <table className="w-full text-right text-xs">
                      <thead className="bg-slate-900/90 text-slate-400 text-[10px] font-semibold border-b border-slate-800">
                        <tr>
                          <th className="p-2.5">رقم التتبع</th>
                          <th className="p-2.5">الاتجاه</th>
                          <th className="p-2.5">الطرف المقابل</th>
                          <th className="p-2.5">المسار</th>
                          <th className="p-2.5">الحالة</th>
                          <th className="p-2.5">قيمة التحصيل COD</th>
                          <th className="p-2.5">التاريخ</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800/60 text-slate-300">
                        {filteredCustomerActivityList.length === 0 ? (
                          <tr>
                            <td colSpan={7} className="p-6 text-center text-slate-500">
                              لا توجد حركات شحن مسجلة لهذا العميل حتى الآن
                            </td>
                          </tr>
                        ) : (
                          filteredCustomerActivityList.map((p) => {
                            const isSent = p._direction === 'sent';
                            const counterpart = isSent ? p.receiver?.name : p.sender?.name;
                            const counterpartPhone = isSent ? p.receiver?.phone : p.sender?.phone;
                            const originCity = p.sender?.city || '—';
                            const destCity = p.receiver?.city || '—';
                            return (
                              <tr key={`${p.id}_${p._direction}`} className="hover:bg-slate-900/40">
                                <td className="p-2.5 font-mono font-bold text-cyan-400">{p.trackingNumber}</td>
                                <td className="p-2.5">
                                  <span
                                    className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                      isSent
                                        ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                                        : 'bg-purple-500/20 text-purple-300 border border-purple-500/30'
                                    }`}
                                  >
                                    {isSent ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownLeft className="w-3 h-3" />}
                                    {isSent ? 'مرسل (صادر)' : 'مستلم (وارد)'}
                                  </span>
                                </td>
                                <td className="p-2.5">
                                  <div className="font-semibold text-white">{counterpart || '—'}</div>
                                  <div className="text-[10px] text-slate-500 font-mono">{counterpartPhone}</div>
                                </td>
                                <td className="p-2.5 text-[11px] text-slate-300">
                                  {originCity} ➔ {destCity}
                                </td>
                                <td className="p-2.5">
                                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 border border-slate-700 font-medium">
                                    {p.handlingStatus}
                                  </span>
                                </td>
                                <td className="p-2.5 font-mono font-bold text-amber-300">
                                  {p.codAmount ? formatCurrency(p.codAmount, 'SYP') : '—'}
                                </td>
                                <td className="p-2.5 text-[10px] font-mono text-slate-400">
                                  {p.createdAt ? formatLatinDate(p.createdAt) : '—'}
                                </td>
                              </tr>
                            );
                          })
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>

              {/* Footer */}
              <div className="flex items-center justify-between gap-2 pt-3 border-t border-slate-800 shrink-0">
                <div className="text-xs text-slate-400 font-mono">
                  إجمالي العمليات: <span className="text-cyan-400 font-bold">{viewingCustomerActivity.allList.length}</span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      const c = selectedCustomerForView;
                      setSelectedCustomerForView(null);
                      openEditForm(c);
                    }}
                    className="px-4 py-2 bg-gradient-to-r from-amber-600 to-amber-500 hover:from-amber-500 hover:to-amber-400 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-md shadow-amber-950/40 transition cursor-pointer"
                  >
                    <Edit2 className="w-3.5 h-3.5" />
                    <span>تعديل بيانات العميل</span>
                  </button>
                  {mode === 'picker' && (
                    <button
                      type="button"
                      onClick={() => {
                        selectAndClose(selectedCustomerForView);
                        setSelectedCustomerForView(null);
                      }}
                      className="px-4 py-2 bg-cyan-600 hover:bg-cyan-500 text-white rounded-xl text-xs font-bold flex items-center gap-1 transition shadow-md shadow-cyan-950/40 cursor-pointer"
                    >
                      <UserCheck className="w-3.5 h-3.5" />
                      <span>تحميل بيانات العميل للبوليصة</span>
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => setSelectedCustomerForView(null)}
                    className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-bold cursor-pointer"
                  >
                    إغلاق
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Blocked Customer Delete Alert Modal (When Customer has Associated Operations/Parcels) */}
        {blockedDeleteAlert && (
          <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/85 backdrop-blur-md p-4 animate-in fade-in">
            <div className="bg-slate-900 border border-amber-500/60 w-full max-w-lg rounded-3xl p-6 shadow-2xl space-y-4 text-right">
              <div className="flex items-start gap-3.5">
                <div className="w-12 h-12 rounded-2xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400 shrink-0">
                  <AlertTriangle className="w-6 h-6 text-amber-400" />
                </div>
                <div className="flex-1">
                  <h3 className="text-base font-bold text-white mb-1">
                    تنبيه: لا يمكن حذف بطاقة العميل
                  </h3>
                  <p className="text-xs text-amber-300 font-semibold">
                    العميل مرتبط بعمليات وشحنات فعلية مسجلة في النظام
                  </p>
                </div>
              </div>

              <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800 space-y-2.5 text-xs">
                <div className="text-slate-300 leading-relaxed">
                  لا يمكن حذف بطاقة العميل <strong className="text-cyan-300 font-bold underline">[{blockedDeleteAlert.customer.fullName}]</strong> نهائياً لأن لديه <strong className="text-amber-300 font-bold">{blockedDeleteAlert.total} عملية شحن</strong> مسجلة:
                </div>
                <div className="grid grid-cols-2 gap-2 text-[11px] pt-1">
                  <div className="bg-slate-900 p-2.5 rounded-xl border border-emerald-500/30 flex items-center justify-between text-emerald-300 font-bold">
                    <span>الطرود الصادرة (إرسال):</span>
                    <span className="font-mono text-sm">{blockedDeleteAlert.sentCount}</span>
                  </div>
                  <div className="bg-slate-900 p-2.5 rounded-xl border border-purple-500/30 flex items-center justify-between text-purple-300 font-bold">
                    <span>الطرود الواردة (استلام):</span>
                    <span className="font-mono text-sm">{blockedDeleteAlert.receivedCount}</span>
                  </div>
                </div>
                <p className="text-[11px] text-slate-400 leading-relaxed pt-1 border-t border-slate-800/80">
                  ⚠️ للحفاظ على سلامة القيود المحاسبية، ومبالغ الـ COD، وسجلات الأرشيف والتتبع التاريخي، يمنع النظام حذف بطاقات العملاء التي تحتوي على حركات سابقة. يمكنك تعديل بيانات العميل أو حظر بطاقته إذا لزم الأمر.
                </p>
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setBlockedDeleteAlert(null)}
                  className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-bold transition cursor-pointer"
                >
                  إغلاق التنبيه
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const c = blockedDeleteAlert.customer;
                    setBlockedDeleteAlert(null);
                    if (selectedCustomerForView) setSelectedCustomerForView(null);
                    openEditForm(c);
                  }}
                  className="px-5 py-2.5 bg-gradient-to-r from-amber-600 to-amber-500 hover:from-amber-500 hover:to-amber-400 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-lg shadow-amber-950/50 transition cursor-pointer"
                >
                  <Edit2 className="w-4 h-4" />
                  <span>تعديل بيانات العميل بدلاً من الحذف</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Single Customer Delete Confirmation Modal */}
        {customerToDelete && (
          <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/85 backdrop-blur-md p-4 animate-in fade-in">
            <div
              id="modal_confirm_delete_single_customer_picker"
              className="bg-slate-900 border border-rose-700/80 w-full max-w-md rounded-3xl p-6 shadow-2xl space-y-4 text-right"
            >
              <div className="flex items-start gap-3.5">
                <div className="w-12 h-12 rounded-2xl bg-rose-500/20 border border-rose-500/40 flex items-center justify-center text-rose-400 shrink-0">
                  <Trash2 className="w-6 h-6 text-rose-400" />
                </div>
                <div className="flex-1">
                  <h3 className="text-base font-bold text-white mb-1">
                    تأكيد حذف بطاقة العميل نهائياً
                  </h3>
                  <p className="text-xs text-slate-300 leading-relaxed">
                    هل أنت متأكد من رغبتك في حذف بطاقة العميل <strong className="text-cyan-300 font-bold">[{customerToDelete.name}]</strong> نهائياً من دليل العملاء؟
                  </p>
                </div>
              </div>

              <div className="bg-slate-950/90 p-3.5 rounded-2xl border border-slate-800 text-xs space-y-1.5">
                <p className="text-emerald-400 font-semibold flex items-center gap-1 text-[11px]">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  تم التحقق: لا توجد أي عمليات أو طرود سابقة مسجلة بهذا العميل.
                </p>
                <p className="text-[11px] text-rose-400 leading-relaxed">
                  ⚠️ سيتم مسح بيانات العميل وكافة وثائقه وصور الهوية الشخصية نهائياً من قاعدة البيانات. لا يمكن التراجع بعد التأكيد.
                </p>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setCustomerToDelete(null)}
                  className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-bold transition cursor-pointer"
                >
                  إلغاء
                </button>
                <button
                  type="button"
                  onClick={handleConfirmDeleteSingle}
                  className="px-5 py-2.5 bg-rose-600 hover:bg-rose-500 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition shadow-lg shadow-rose-950/50 cursor-pointer"
                >
                  <Trash2 className="w-4 h-4" />
                  <span>تأكيد الحذف نهائياً</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Floating Toast Notification */}
        {toastMessage && (
          <div className="fixed bottom-6 left-6 z-80 bg-slate-900 border border-emerald-500/60 text-emerald-300 px-4 py-3 rounded-2xl shadow-2xl shadow-emerald-950/60 flex items-center gap-2.5 text-xs font-bold">
            <CheckCircle className="w-4 h-4 text-emerald-400" />
            <span>{toastMessage}</span>
          </div>
        )}
      </div>
    </div>
  );
};
