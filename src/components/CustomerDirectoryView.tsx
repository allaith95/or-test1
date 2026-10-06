import React, { useState, useMemo } from 'react';
import { useOrca } from '../context/OrcaContext';
import { Customer, Governorate, Parcel } from '../types';
import { normalizeCustomerNames, getCanonicalCustomerKey } from '../utils/nameUtils';
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
  Phone,
  CreditCard,
  Building,
  MapPin,
  CheckCircle,
  CheckCircle2,
  AlertTriangle,
  Upload,
  Image as ImageIcon,
  Edit2,
  Trash2,
  ShieldAlert,
  ShieldCheck,
  Download,
  Filter,
  Eye,
  X,
  Package,
  DollarSign,
  UserCheck,
  Inbox,
  Send,
  Clock,
  Truck,
  Copy,
  Lock,
  Unlock,
  KeyRound,
  ExternalLink,
  MessageSquare,
  RefreshCw,
  Smartphone,
  Share2,
} from 'lucide-react';
import { PhotoFromIndexedDB } from './PhotoFromIndexedDB';
import { searchCustomers, useCustomerDirectory } from '../shared/useCustomerDirectory';

export const CustomerDirectoryView: React.FC = () => {
  const {
    customers,
    parcels,
    addCustomer,
    updateCustomer,
    deleteCustomer,
    updateCustomerPortalCredentials,
    loginCustomer,
    setActiveModule,
    currentBranch,
    branches,
    formatCurrency,
    currentUser,
    brandingSettings,
    ensureServerConnected,
  } = useOrca();

  // صلاحية ربط الزبائن بتطبيق الزبون محصورة بمدير التطبيق حصراً
  const isSuperAdmin = currentUser?.role === 'super_admin';

  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCity, setSelectedCity] = useState<string>('all');
  const [selectedType, setSelectedType] = useState<string>('all');
  const [selectedVerification, setSelectedVerification] = useState<string>('all');
  const [selectedBlacklist, setSelectedBlacklist] = useState<string>('all');

  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
  const [viewingCustomer, setViewingCustomer] = useState<Customer | null>(null);

  // Customer Transaction History Filter & Search State
  const [historySearchTerm, setHistorySearchTerm] = useState('');
  const [historyDirectionFilter, setHistoryDirectionFilter] = useState<'all' | 'sent' | 'received'>('all');
  const [historyStatusFilter, setHistoryStatusFilter] = useState<string>('all');
  const [activeCustomerModalTab, setActiveCustomerModalTab] = useState<'all' | 'info' | 'history'>('all');

  const openViewCustomerModal = (c: Customer) => {
    setViewingCustomer(c);
    setHistorySearchTerm('');
    setHistoryDirectionFilter('all');
    setHistoryStatusFilter('all');
    setActiveCustomerModalTab('all');
  };

  const [customerToDelete, setCustomerToDelete] = useState<{ id: string; name: string } | null>(null);
  const [blockedDeleteAlert, setBlockedDeleteAlert] = useState<{
    customer: Customer;
    sentCount: number;
    receivedCount: number;
    total: number;
  } | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Helper to calculate total customer operations across all parcels (sent + received)
  const getCustomerOperations = (c: Customer) => {
    if (!parcels) return { sentCount: 0, receivedCount: 0, total: 0 };
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
    };
  };

  // Guarded delete request checking for existing operations
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

  // Calculate customer parcel history and filter logic
  const customerParcelActivity = useMemo(() => {
    if (!viewingCustomer || !parcels) {
      return {
        sentList: [],
        receivedList: [],
        filteredList: [],
        totalSentCount: 0,
        totalReceivedCount: 0,
        totalCodAmount: 0,
        totalShippingAmount: 0,
      };
    }

    const cPhone = (viewingCustomer.phone || '').trim().toLowerCase();
    const cNatId = (viewingCustomer.nationalId || '').trim().toLowerCase();
    const cName = (viewingCustomer.fullName || '').trim().toLowerCase();
    const cId = viewingCustomer.id;

    // Filter sent parcels (الطرود الصادرة)
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

    // Filter received parcels (الطرود الواردة)
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

    // Combine tagged with direction
    const combined = [
      ...sentList.map((p) => ({ ...p, _direction: 'sent' as const })),
      ...receivedList.map((p) => ({ ...p, _direction: 'received' as const })),
    ];

    // Remove duplicates
    const uniqueList = combined.filter(
      (p, index, self) => self.findIndex((t) => t.id === p.id && t._direction === p._direction) === index
    );

    // Apply direction filter (الفرز بين الصادرة والواردة)
    let filtered = uniqueList;
    if (historyDirectionFilter === 'sent') {
      filtered = filtered.filter((p) => p._direction === 'sent');
    } else if (historyDirectionFilter === 'received') {
      filtered = filtered.filter((p) => p._direction === 'received');
    }

    // Apply status filter
    if (historyStatusFilter !== 'all') {
      if (historyStatusFilter === 'delivered') {
        filtered = filtered.filter((p) => p.handlingStatus === 'delivered');
      } else if (historyStatusFilter === 'returned') {
        filtered = filtered.filter((p) => p.handlingStatus === 'returned');
      } else if (historyStatusFilter === 'in_transit') {
        filtered = filtered.filter(
          (p) => p.handlingStatus === 'in_transit' || p.handlingStatus === 'loaded_in_truck' || p.handlingStatus === 'out_for_delivery'
        );
      } else if (historyStatusFilter === 'pending') {
        filtered = filtered.filter(
          (p) => p.handlingStatus === 'received_at_hub' || p.handlingStatus === 'received_at_origin_hub' || p.handlingStatus === 'received_at_dest'
        );
      }
    }

    // Apply search filter
    if (historySearchTerm.trim()) {
      const term = historySearchTerm.trim().toLowerCase();
      filtered = filtered.filter((p) => {
        const trk = (p.trackingNumber || '').toLowerCase();
        const paper = (p.paperReceiptNumber || '').toLowerCase();
        const sName = (p.sender?.name || '').toLowerCase();
        const rName = (p.receiver?.name || '').toLowerCase();
        const sPhone = (p.sender?.phone || '').toLowerCase();
        const rPhone = (p.receiver?.phone || '').toLowerCase();
        const sCity = (p.sender?.city || '').toLowerCase();
        const rCity = (p.receiver?.city || '').toLowerCase();
        const desc = (p.contentDescription || '').toLowerCase();

        return (
          trk.includes(term) ||
          paper.includes(term) ||
          sName.includes(term) ||
          rName.includes(term) ||
          sPhone.includes(term) ||
          rPhone.includes(term) ||
          sCity.includes(term) ||
          rCity.includes(term) ||
          desc.includes(term)
        );
      });
    }

    const totalSentCount = sentList.length;
    const totalReceivedCount = receivedList.length;
    const totalCodAmount = sentList.reduce((acc, curr) => acc + (curr.codAmount || 0), 0);
    const totalShippingAmount = uniqueList.reduce((acc, curr) => acc + (curr.shippingCost || 0), 0);

    return {
      sentList,
      receivedList,
      filteredList: filtered,
      totalSentCount,
      totalReceivedCount,
      totalCodAmount,
      totalShippingAmount,
    };
  }, [viewingCustomer, parcels, historyDirectionFilter, historyStatusFilter, historySearchTerm]);

  // Dedicated Portal Management Modal State
  const [managingPortalCustomer, setManagingPortalCustomer] = useState<Customer | null>(null);
  const [portalModalUsername, setPortalModalUsername] = useState('');
  const [portalModalPassword, setPortalModalPassword] = useState('');
  const [portalModalAccess, setPortalModalAccess] = useState(true);
  const [showPasswordInModal, setShowPasswordInModal] = useState(false);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 4000);
  };

  const openPortalModal = (c: Customer) => {
    if (!isSuperAdmin) {
      alert('صلاحية ربط وتفعيل تطبيق الزبون محصورة بمدير التطبيق حصراً.');
      return;
    }
    setManagingPortalCustomer(c);
    setPortalModalUsername(c.portalUsername || c.phone || c.code);
    const suggestedPin = c.portalPassword || (c.phone ? (c.phone.replace(/\D/g, '').slice(-4) || '12345') : '12345');
    setPortalModalPassword(suggestedPin);
    // إذا كان مرتبطاً مسبقاً نتركه مفعل، وإذا لم يكن مرتبطاً بعد نجهزه للتفعيل والربط
    setPortalModalAccess(c.portalAccessEnabled === true ? true : true);
    setShowPasswordInModal(false);
  };

  const handleSharePortalWhatsApp = (c: Customer, username: string, pass: string) => {
    const rawPhone = c.phone.replace(/\D/g, '');
    const phone = rawPhone.startsWith('0') ? '963' + rawPhone.substring(1) : rawPhone;
    const portalUrl = `${window.location.origin}/?portal=CST-SC`;
    const company = brandingSettings.companyName || 'أوركا إكسبريس';
    const msg = `مرحباً بك أستاذ ${c.fullName} 🌸\nيسر إدارة [${company}] تزويدكم برابط الدخول الرسمي لتطبيق الزبائن لمتابعة شحناتكم:\n\n🔗 رابط تطبيق الزبون:\n${portalUrl}\n\n👤 اسم المستخدم (أو رقم الهاتف): ${username}\n🔑 كلمة المرور: ${pass}\n\nيمكنكم من خلال التطبيق:\n• تتبع مسار كافة الطرود الصادرة والواردة لحظة بلحظة.\n• متابعة تحصيل وصرف مبالغ الـ COD وتحديثات الأرصدة المالية فوراً.\n• استعراض وتحميل الفواتير والكشوفات المالية.\n\nنتشرف بخدمتكم دائماً.`;
    const url = `https://api.whatsapp.com/send?phone=${phone}&text=${encodeURIComponent(msg)}`;
    window.open(url, '_blank');
  };

  const handleSavePortalCredentials = async (e?: React.FormEvent, sendWhatsAppAfterSave: boolean = false) => {
    if (e) e.preventDefault();
    if (!managingPortalCustomer) return;
    const ok = await ensureServerConnected();
    if (!ok) return;
    if (!isSuperAdmin) {
      alert('صلاحية ربط وتفعيل تطبيق الزبون محصورة بمدير التطبيق حصراً.');
      return;
    }
    const finalUsername = portalModalUsername.trim() || managingPortalCustomer.phone || managingPortalCustomer.code;
    const finalPassword = portalModalPassword.trim() || '12345';
    updateCustomerPortalCredentials(managingPortalCustomer.id, {
      portalUsername: finalUsername,
      portalPassword: finalPassword,
      portalAccessEnabled: portalModalAccess,
    });
    if (viewingCustomer && viewingCustomer.id === managingPortalCustomer.id) {
      setViewingCustomer((prev) =>
        prev
          ? {
              ...prev,
              portalUsername: finalUsername,
              portalPassword: finalPassword,
              portalAccessEnabled: portalModalAccess,
            }
          : null
      );
    }

    if (sendWhatsAppAfterSave) {
      handleSharePortalWhatsApp(managingPortalCustomer, finalUsername, finalPassword);
      showToast(
        portalModalAccess
          ? `✓ تم ربط العميل [${managingPortalCustomer.fullName}] بتطبيق الزبون وفتح تطبيق واتساب لإرسال البيانات`
          : `✓ تم حفظ بيانات العميل`
      );
    } else {
      showToast(
        portalModalAccess
          ? `✓ تم ربط وتفعيل تطبيق الزبون للعميل [${managingPortalCustomer.fullName}] بنجاح`
          : `✓ تم إلغاء ربط العميل بتطبيق الزبون بنجاح`
      );
    }
    setManagingPortalCustomer(null);
  };

  const handleTestCustomerLogin = (c: Customer) => {
    const res = loginCustomer(c.portalUsername || c.phone, c.portalPassword || '12345');
    if (res.success) {
      setActiveModule('customer_portal');
      showToast(`✓ تم تسجيل الدخول الفوري كـ [${c.fullName}] وفتح بوابة الزبائن بنجاح`);
      setManagingPortalCustomer(null);
      setViewingCustomer(null);
    } else {
      alert(res.message || 'تعذر تسجيل الدخول للبوابة');
    }
  };

  // Receiver parcels modal
  const [viewingReceiverParcels, setViewingReceiverParcels] = useState<{
    name: string;
    phone: string;
    city: string;
    address: string;
    nationalId?: string;
    parcels: Parcel[];
  } | null>(null);

  // Form State
  const [formData, setFormData] = useState({
    fullName: '',
    firstName: '',
    fatherName: '',
    lastName: '',
    motherName: '',
    birthDate: '',
    nationalId: '',
    phone: '',
    secondaryPhone: '',
    city: currentBranch.governorate as Governorate,
    address: '',
    companyName: '',
    customerType: 'individual' as 'individual' | 'merchant' | 'corporate',
    idPhotoFront: '',
    idPhotoBack: '',
    notes: '',
    portalUsername: '',
    portalPassword: '',
    portalAccessEnabled: false, // لا يعتبر افتراضياً أنه له دور تطبيق الزبون (حصراً يربطه مدير التطبيق)
  });

  const [idFrontPreview, setIdFrontPreview] = useState<string>('');
  const [idBackPreview, setIdBackPreview] = useState<string>('');

  const openAddModal = () => {
    setEditingCustomer(null);
    setFormData({
      fullName: '',
      firstName: '',
      fatherName: '',
      lastName: '',
      motherName: '',
      birthDate: '',
      nationalId: '',
      phone: '',
      secondaryPhone: '',
      city: currentBranch.governorate as Governorate,
      address: '',
      companyName: '',
      customerType: 'individual',
      idPhotoFront: '',
      idPhotoBack: '',
      notes: '',
      portalUsername: '',
      portalPassword: '12345',
      portalAccessEnabled: false, // لا يعتبر افتراضياً أنه له دور تطبيق الزبون (حصراً يربطه مدير التطبيق)
    });
    setIdFrontPreview('');
    setIdBackPreview('');
    setIsAddModalOpen(true);
  };

  const openEditModal = (c: Customer) => {
    setEditingCustomer(c);
    setFormData({
      fullName: c.fullName,
      firstName: c.firstName || '',
      fatherName: c.fatherName || '',
      lastName: c.lastName || '',
      motherName: c.motherName || '',
      birthDate: c.birthDate || '',
      nationalId: c.nationalId || '',
      phone: c.phone || '',
      secondaryPhone: c.secondaryPhone || '',
      city: c.city,
      address: c.address || '',
      companyName: c.companyName || '',
      customerType: c.customerType || 'individual',
      idPhotoFront: c.idPhotoFront || '',
      idPhotoBack: c.idPhotoBack || '',
      notes: c.notes || '',
      portalUsername: c.portalUsername || c.phone || '',
      portalPassword: c.portalPassword || '12345',
      portalAccessEnabled: c.portalAccessEnabled === true,
    });
    setIdFrontPreview(c.idPhotoFront || '');
    setIdBackPreview(c.idPhotoBack || '');
    setIsAddModalOpen(true);
  };

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

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    const ok = await ensureServerConnected();
    if (!ok) return;

    const derivedFullName = [formData.firstName.trim(), formData.fatherName.trim(), formData.lastName.trim()].filter(Boolean).join(' ');
    const finalFullName = formData.fullName.trim() || derivedFullName;

    if (!finalFullName.trim() || !formData.phone.trim()) {
      alert('يرجى ملء اسم العميل ورقم الهاتف');
      return;
    }

    const norm = normalizeCustomerNames({
      fullName: finalFullName,
      firstName: formData.firstName.trim(),
      fatherName: formData.fatherName.trim(),
      lastName: formData.lastName.trim(),
    });

    if (editingCustomer) {
      updateCustomer(editingCustomer.id, {
        ...formData,
        fullName: norm.fullName,
        firstName: norm.firstName,
        fatherName: norm.fatherName,
        lastName: norm.lastName,
        idPhotoFront: idFrontPreview,
        idPhotoBack: idBackPreview,
      });
      updateCustomerPortalCredentials(editingCustomer.id, {
        portalUsername: formData.portalUsername.trim() || formData.phone,
        portalPassword: formData.portalPassword.trim() || '12345',
        portalAccessEnabled: formData.portalAccessEnabled,
      });
    } else {
      addCustomer({
        ...formData,
        fullName: norm.fullName,
        firstName: norm.firstName,
        fatherName: norm.fatherName,
        lastName: norm.lastName,
        idPhotoFront: idFrontPreview,
        idPhotoBack: idBackPreview,
        isBlacklisted: false,
        branchId: currentBranch.id,
        portalUsername: formData.portalUsername.trim() || formData.phone,
        portalPassword: formData.portalPassword.trim() || '12345',
        portalAccessEnabled: formData.portalAccessEnabled,
      });
    }

    setIsAddModalOpen(false);
    showToast(editingCustomer ? '✓ تم تحديث بيانات العميل وحساب البوابة' : '✓ تم حفظ العميل وتفعيل بيانات الدخول');
  };

  const handleConfirmDeleteSingle = () => {
    if (customerToDelete) {
      deleteCustomer(customerToDelete.id);
      showToast(`✓ تم حذف بطاقة العميل [${customerToDelete.name}] نهائياً بنجاح`);
      if (viewingCustomer && viewingCustomer.id === customerToDelete.id) {
        setViewingCustomer(null);
      }
      setCustomerToDelete(null);
    }
  };

  const handleDelete = (c: Customer) => {
    requestDeleteCustomer(c);
  };

  const toggleBlacklist = (c: Customer) => {
    updateCustomer(c.id, { isBlacklisted: !c.isBlacklisted });
  };

  // Single Unified Customer Directory (كافة العملاء الموثقين بالهوية والمرسلين والمستلمين والتجار)
  const unifiedCustomers = useMemo(() => {
    const map = new Map<string, Customer>();
    for (const c of customers) {
      if (!c) continue;
      const key = getCanonicalCustomerKey(c);
      if (!map.has(key)) {
        map.set(key, c);
      } else {
        const existing = map.get(key)!;
        map.set(key, {
          ...existing,
          ...c,
          id: existing.id || c.id,
          totalShipmentsSent: Math.max(existing.totalShipmentsSent || 0, c.totalShipmentsSent || 0),
          totalShipmentsReceived: Math.max(existing.totalShipmentsReceived || 0, c.totalShipmentsReceived || 0),
          totalSpentSyp: Math.max(existing.totalSpentSyp || 0, c.totalSpentSyp || 0),
          totalSpentUsd: Math.max(existing.totalSpentUsd || 0, c.totalSpentUsd || 0),
        });
      }
    }
    return Array.from(map.values());
  }, [customers]);

  const filteredCustomers = useMemo(() => {
    return unifiedCustomers.filter((c) => {
      const q = searchTerm.trim().toLowerCase();
      const matchSearch =
        !q ||
        c.fullName.toLowerCase().includes(q) ||
        (c.phone && c.phone.includes(q)) ||
        (c.secondaryPhone && c.secondaryPhone.includes(q)) ||
        (c.nationalId && c.nationalId.includes(q)) ||
        (c.companyName && c.companyName.toLowerCase().includes(q)) ||
        (c.code && c.code.toLowerCase().includes(q)) ||
        (c.address && c.address.toLowerCase().includes(q));

      const matchCity = selectedCity === 'all' || c.city === selectedCity;
      const matchType = selectedType === 'all' || c.customerType === selectedType;
      const matchBlacklist =
        selectedBlacklist === 'all' ||
        (selectedBlacklist === 'blacklisted' ? c.isBlacklisted : !c.isBlacklisted);

      const isVer = Boolean(c.isVerified || (c.nationalId && c.nationalId.trim().length >= 8));
      const matchVerification =
        selectedVerification === 'all' ||
        (selectedVerification === 'verified' ? isVer : !isVer);

      return matchSearch && matchCity && matchType && matchBlacklist && matchVerification;
    });
  }, [unifiedCustomers, searchTerm, selectedCity, selectedType, selectedBlacklist, selectedVerification]);

  // Calculate unified stats
  const totalCustomers = unifiedCustomers.length;
  const totalVerified = unifiedCustomers.filter(
    (c) => c.isVerified || (c.nationalId && c.nationalId.trim().length >= 8)
  ).length;
  const totalMerchants = unifiedCustomers.filter(
    (c) => c.customerType === 'merchant' || c.customerType === 'corporate'
  ).length;
  const totalSentShipments = unifiedCustomers.reduce((acc, c) => acc + (c.totalShipmentsSent || 0), 0);
  const totalReceivedShipments = unifiedCustomers.reduce((acc, c) => acc + (c.totalShipmentsReceived || 0), 0);
  const totalBlacklisted = unifiedCustomers.filter((c) => c.isBlacklisted).length;

  return (
    <div className="space-y-6">
      {/* Top Header & Quick Action Bar */}
      <div className="bg-slate-900/90 border border-slate-800 p-4 rounded-2xl flex flex-wrap items-center justify-between gap-3 shadow-xl">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-cyan-600/20 border border-cyan-500/40 flex items-center justify-center text-cyan-400 font-bold shadow-inner">
            <Users className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-sm md:text-base font-black text-white">دليل العملاء الموحد</h2>
              <span className="bg-cyan-500/15 border border-cyan-500/30 px-2.5 py-0.5 rounded-full text-[11px] text-cyan-300 font-mono font-bold">
                {totalCustomers} عميل معتمد
              </span>
            </div>
            <p className="text-[11px] text-slate-400 mt-0.5">
              السجل المركزي الشامل لكافة المرسلين والمستلمين والتجار والشركات المعتمدة في المنظومة
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={openAddModal}
            className="px-4 py-2.5 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white rounded-xl text-xs font-bold flex items-center gap-2 transition shadow-lg shadow-cyan-950/50 cursor-pointer active:scale-95"
          >
            <Plus className="w-4 h-4" />
            <span>إضافة عميل جديد للدليل</span>
          </button>
        </div>
      </div>

      {/* Header & Stats Cards for Unified Directory */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-slate-900/80 border border-slate-800 p-4 rounded-2xl">
          <span className="text-xs text-slate-400 font-medium block mb-1">إجمالي العملاء المسجلين</span>
          <span className="text-2xl font-bold text-white">{totalCustomers}</span>
          <span className="text-[10px] text-slate-500 block mt-1">الدليل العام الموحد</span>
        </div>

        <div className="bg-slate-900/80 border border-slate-800 p-4 rounded-2xl">
          <span className="text-xs text-slate-400 font-medium block mb-1">الموثقين بالهوية المدنية</span>
          <span className="text-2xl font-bold text-emerald-400 flex items-center gap-1.5">
            <CheckCircle2 className="w-5 h-5" />
            <span>{totalVerified}</span>
          </span>
          <span className="text-[10px] text-emerald-500/80 block mt-1">بيانات وهوية مكتملة 100%</span>
        </div>

        <div className="bg-slate-900/80 border border-slate-800 p-4 rounded-2xl">
          <span className="text-xs text-slate-400 font-medium block mb-1">التجار والشركات</span>
          <span className="text-2xl font-bold text-cyan-400">{totalMerchants}</span>
          <span className="text-[10px] text-cyan-500/80 block mt-1">حسابات تجارية</span>
        </div>

        <div className="bg-slate-900/80 border border-slate-800 p-4 rounded-2xl">
          <span className="text-xs text-slate-400 font-medium block mb-1">إجمالي حركة الطرود</span>
          <div className="flex items-center gap-2">
            <span className="text-lg font-bold text-cyan-300 font-mono">{totalSentShipments} صادر</span>
            <span className="text-slate-600">/</span>
            <span className="text-lg font-bold text-purple-300 font-mono">{totalReceivedShipments} وارد</span>
          </div>
          <span className="text-[10px] text-slate-400 block mt-1">شحنات مسجلة بالدليل</span>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-slate-900/80 border border-slate-800 p-4 rounded-2xl flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[240px]">
          <Search className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="ابحث بالاسم، الرقم الوطني (11 خانة)، الهاتف، العنوان، أو اسم المتجر..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-slate-950 border border-slate-700 rounded-xl pr-9 pl-4 py-2 text-xs text-white placeholder-slate-500 focus:border-cyan-500 outline-none"
          />
        </div>

        <select
          value={selectedCity}
          onChange={(e) => setSelectedCity(e.target.value)}
          className="bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-300 focus:border-cyan-500 outline-none cursor-pointer"
        >
          <option value="all">كل المحافظات</option>
          <option value="دمشق">دمشق</option>
          <option value="ريف دمشق">ريف دمشق</option>
          <option value="حلب">حلب</option>
          <option value="حمص">حمص</option>
          <option value="حماة">حماة</option>
          <option value="اللاذقية">اللاذقية</option>
          <option value="طرطوس">طرطوس</option>
          <option value="السويداء">السويداء</option>
          <option value="درعا">درعا</option>
          <option value="دير الزور">دير الزور</option>
          <option value="الحسكة">الحسكة</option>
          <option value="الرقة">الرقة</option>
          <option value="إدلب">إدلب</option>
          <option value="القنيطرة">القنيطرة</option>
        </select>

        <select
          value={selectedType}
          onChange={(e) => setSelectedType(e.target.value)}
          className="bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-300 focus:border-cyan-500 outline-none cursor-pointer"
        >
          <option value="all">كل التصنيفات</option>
          <option value="individual">أفراد (مرسل / مستلم)</option>
          <option value="merchant">تجار</option>
          <option value="corporate">شركات ومؤسسات</option>
        </select>

        <select
          value={selectedVerification}
          onChange={(e) => setSelectedVerification(e.target.value)}
          className="bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-300 focus:border-cyan-500 outline-none cursor-pointer"
        >
          <option value="all">كل حالات التوثيق</option>
          <option value="verified">موثق بالهوية الوطنية (بيانات مكتملة)</option>
          <option value="unverified">بانتظار استكمال الهوية</option>
        </select>

        <select
          value={selectedBlacklist}
          onChange={(e) => setSelectedBlacklist(e.target.value)}
          className="bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-300 focus:border-cyan-500 outline-none cursor-pointer"
        >
          <option value="all">كل الحالات</option>
          <option value="active">سجل نظامي (غير محظور)</option>
          <option value="blacklisted">قائمة الحظر فقط</option>
        </select>
      </div>

      {/* Customers Table */}
      <div className="bg-slate-900/80 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
        <div className="p-4 bg-slate-950/80 border-b border-slate-800 flex items-center justify-between">
          <h3 className="text-xs font-bold text-cyan-300 flex items-center gap-2">
            <Users className="w-4 h-4 text-cyan-400" />
            <span>قائمة العملاء المعتمدة في المنظومة</span>
          </h3>
          <span className="text-[11px] text-slate-400">
            عدد العملاء المطابقين: <strong className="text-white">{filteredCustomers.length}</strong>
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-right text-xs">
            <thead className="bg-slate-950/90 text-slate-400 border-b border-slate-800 font-semibold">
              <tr>
                <th className="p-3.5">الرمز والاسم</th>
                <th className="p-3.5">الرقم الوطني وحالة التوثيق</th>
                <th className="p-3.5">رقم الهاتف</th>
                <th className="p-3.5">المحافظة / العنوان</th>
                <th className="p-3.5">التصنيف</th>
                <th className="p-3.5">وثيقة الهوية</th>
                <th className="p-3.5 text-center">تطبيق الزبون</th>
                <th className="p-3.5">إحصائيات الشحن (صادر / وارد)</th>
                <th className="p-3.5 text-center">الإجراءات</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 text-slate-200">
              {filteredCustomers.length === 0 ? (
                <tr>
                  <td colSpan={9} className="p-8 text-center text-slate-500">
                    لا يوجد عملاء يطابقون خيارات البحث والتصفية
                  </td>
                </tr>
              ) : (
                filteredCustomers.map((c) => {
                  const isVerifiedCustomer = Boolean(c.isVerified || (c.nationalId && c.nationalId.trim().length >= 8));
                  return (
                    <tr
                      key={c.id}
                      className={`hover:bg-slate-800/40 transition ${
                        c.isBlacklisted ? 'bg-rose-950/10' : ''
                      }`}
                    >
                      <td className="p-3.5">
                        <div className="flex items-center gap-2.5">
                          <div className="w-8 h-8 rounded-lg bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400 font-bold">
                            {c.fullName.slice(0, 1)}
                          </div>
                          <div>
                            <span className="font-bold text-white block">{c.fullName}</span>
                            <span className="text-[10px] text-slate-500 font-mono">{c.code}</span>
                            {c.companyName && (
                              <span className="text-[10px] text-purple-400 block font-medium">
                                {c.companyName}
                              </span>
                            )}
                          </div>
                        </div>
                      </td>

                      <td className="p-3.5 font-mono">
                        {c.nationalId ? (
                          <div>
                            <span className="text-white bg-slate-950 px-2 py-0.5 rounded border border-slate-800 font-bold block w-fit">
                              {c.nationalId}
                            </span>
                            {isVerifiedCustomer && (
                              <span className="inline-flex items-center gap-1 text-[10px] text-emerald-400 font-bold mt-0.5">
                                <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                                <span>موثق بالهوية</span>
                              </span>
                            )}
                          </div>
                        ) : (
                          <span className="text-amber-400/80 bg-amber-500/10 px-2 py-0.5 rounded text-[10px] font-bold border border-amber-500/20">
                            بانتظار استكمال الهوية
                          </span>
                        )}
                      </td>

                      <td className="p-3.5 font-mono text-cyan-300">
                        {c.phone}
                        {c.secondaryPhone && (
                          <span className="block text-[10px] text-slate-500">{c.secondaryPhone}</span>
                        )}
                      </td>

                      <td className="p-3.5">
                        <span className="font-semibold text-white block">{c.city}</span>
                        <span className="text-[10px] text-slate-400 truncate max-w-[160px] block">
                          {c.address || 'مركز المدينة'}
                        </span>
                      </td>

                      <td className="p-3.5">
                        <span
                          className={`text-[10px] px-2 py-0.5 rounded-full font-semibold border ${
                            c.customerType === 'corporate'
                              ? 'bg-purple-500/20 text-purple-300 border-purple-500/30'
                              : c.customerType === 'merchant'
                              ? 'bg-amber-500/20 text-amber-300 border-amber-500/30'
                              : 'bg-blue-500/20 text-blue-300 border-blue-500/30'
                          }`}
                        >
                          {c.customerType === 'corporate'
                            ? 'شركة'
                            : c.customerType === 'merchant'
                            ? 'تاجر'
                            : 'أفراد'}
                        </span>
                      </td>

                      <td className="p-3.5">
                        {c.idPhotoFront || c.idPhotoBack ? (
                          <span className="inline-flex items-center gap-1 text-[11px] text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/30">
                            <ImageIcon className="w-3 h-3" />
                            متوفرة
                          </span>
                        ) : (
                          <span className="text-slate-500 text-[11px]">غير مرفقة</span>
                        )}
                      </td>

                      <td className="p-3.5 text-center">
                        {c.portalAccessEnabled === true ? (
                          <div className="flex flex-col items-center gap-1">
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-bold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 shadow-sm">
                              <Smartphone className="w-3.5 h-3.5 text-emerald-400" />
                              <span>مرتبط بالتطبيق</span>
                            </span>
                            {isSuperAdmin ? (
                              <button
                                type="button"
                                onClick={() => openPortalModal(c)}
                                className="text-[10px] text-amber-400 hover:text-amber-300 font-bold transition flex items-center gap-1 cursor-pointer pt-0.5"
                                title="إدارة بيانات الدخول وإرسال رابط التطبيق عبر واتساب"
                              >
                                <MessageSquare className="w-3 h-3 text-emerald-400" />
                                <span>إرسال واتساب / إدارة</span>
                              </button>
                            ) : (
                              <span className="text-[10px] font-mono text-slate-400 dir-ltr block max-w-[120px] truncate" title={c.portalUsername || c.phone}>
                                {c.portalUsername || c.phone}
                              </span>
                            )}
                          </div>
                        ) : (
                          <div className="flex flex-col items-center gap-1">
                            {isSuperAdmin ? (
                              <button
                                type="button"
                                onClick={() => openPortalModal(c)}
                                className="px-2.5 py-1.5 rounded-xl text-xs font-bold bg-gradient-to-r from-amber-500/20 to-yellow-500/20 hover:from-amber-500/30 hover:to-yellow-500/30 text-amber-300 border border-amber-500/40 hover:border-amber-400 flex items-center gap-1.5 transition cursor-pointer shadow-sm active:scale-95"
                                title="ربط هذا العميل بتطبيق الزبون وتوليد بيانات الدخول وإرسالها عبر واتساب"
                              >
                                <Smartphone className="w-3.5 h-3.5 text-amber-400" />
                                <span>ربط بتطبيق الزبون</span>
                              </button>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[10px] text-slate-500 bg-slate-900/60 border border-slate-800" title="ربط الزبائن بتطبيق الزبون محصور بمدير التطبيق حصراً">
                                <Lock className="w-3 h-3 text-slate-500" />
                                <span>غير مرتبط</span>
                              </span>
                            )}
                          </div>
                        )}
                      </td>

                      <td className="p-3.5">
                        <div className="flex items-center gap-2 text-[11px]">
                          <span className="text-cyan-300 font-bold">{c.totalShipmentsSent || 0} صادر</span>
                          <span className="text-slate-600">|</span>
                          <span className="text-purple-300 font-bold">{c.totalShipmentsReceived || 0} وارد</span>
                        </div>
                        <div className="text-[10px] text-slate-400 font-mono mt-0.5">
                          {formatCurrency(c.totalSpentSyp || 0, 'SYP')}
                        </div>
                        {c.returnDebtBalance && c.returnDebtBalance > 0 ? (
                          <div className="mt-1">
                            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9.5px] font-bold bg-rose-500/20 text-rose-300 border border-rose-500/40">
                              ⚠️ ذمة مرتجع: {formatCurrency(c.returnDebtBalance, 'SYP')}
                            </span>
                          </div>
                        ) : null}
                      </td>

                      <td className="p-3.5 text-center">
                        <div className="flex items-center justify-center gap-1">
                          {isSuperAdmin && (
                            <button
                              type="button"
                              onClick={() => openPortalModal(c)}
                              title={c.portalAccessEnabled === true ? 'إدارة تطبيق الزبون وإرسال واتساب' : 'ربط العميل بتطبيق الزبون وإرسال واتساب'}
                              className={`p-1.5 rounded-lg border transition cursor-pointer ${
                                c.portalAccessEnabled === true
                                  ? 'bg-emerald-950/80 hover:bg-emerald-800 text-emerald-300 border-emerald-500/30'
                                  : 'bg-amber-950/80 hover:bg-amber-800 text-amber-300 border-amber-500/30'
                              }`}
                            >
                              <Smartphone className="w-3.5 h-3.5" />
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => openViewCustomerModal(c)}
                            title="عرض ملف العميل وسجل طروده الصادرة والواردة"
                            className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition cursor-pointer"
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => openEditModal(c)}
                            title="تعديل بيانات العميل"
                            className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-cyan-400 transition cursor-pointer"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => toggleBlacklist(c)}
                            title={c.isBlacklisted ? 'إلغاء الحظر' : 'حظر العميل'}
                            className={`p-1.5 rounded-lg transition cursor-pointer ${
                              c.isBlacklisted
                                ? 'bg-rose-600 text-white'
                                : 'bg-slate-800 hover:bg-rose-950 text-slate-400 hover:text-rose-300'
                            }`}
                          >
                            {c.isBlacklisted ? (
                              <ShieldAlert className="w-3.5 h-3.5" />
                            ) : (
                              <ShieldCheck className="w-3.5 h-3.5" />
                            )}
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDelete(c)}
                            title="حذف بطاقة العميل"
                            className="p-1.5 rounded-lg bg-slate-800 hover:bg-rose-900/60 text-slate-400 hover:text-rose-300 transition cursor-pointer"
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

      {/* Add / Edit Customer Modal (Full Page Wide Horizontal Layout) */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 flex flex-col bg-slate-950/95 backdrop-blur-md overflow-hidden animate-in fade-in duration-200">
          {/* Top Header Bar */}
          <div className="px-6 py-4 bg-gradient-to-r from-slate-900 via-slate-900 to-cyan-950/50 border-b border-slate-800 flex items-center justify-between shrink-0 shadow-lg">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-2xl bg-cyan-600/20 border border-cyan-500/40 flex items-center justify-center text-cyan-400 font-bold shadow-inner">
                <Users className="w-6 h-6" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-base md:text-lg font-bold text-white">
                    {editingCustomer ? 'تعديل بيانات العميل في الدليل العام' : 'إضافة عميل جديد إلى الدليل العام'}
                  </h3>
                  <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">
                    واجهة عرضية كاملة
                  </span>
                  {editingCustomer && (
                    <span className="px-2.5 py-0.5 rounded-full text-[11px] font-mono font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                      كود: {editingCustomer.code}
                    </span>
                  )}
                </div>
                <p className="text-xs text-slate-400">
                  فرع التسجيل: <span className="text-slate-200 font-semibold">{currentBranch.name}</span> | يرجى تعبئة الحقول الأساسية لضمان دقة السجلات وربط الشحنات وبوابة التتبع
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setIsAddModalOpen(false)}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer"
              >
                <X className="w-4 h-4" />
                <span>إلغاء</span>
              </button>
              <button
                type="submit"
                form="customer-form"
                className="px-6 py-2 bg-gradient-to-r from-cyan-600 to-emerald-600 hover:from-cyan-500 hover:to-emerald-500 text-white rounded-xl text-xs font-bold flex items-center gap-2 shadow-lg shadow-cyan-950/60 cursor-pointer transition transform active:scale-95"
              >
                <CheckCircle className="w-4 h-4" />
                <span>{editingCustomer ? 'حفظ التعديلات' : 'تسجيل العميل في الدليل'}</span>
              </button>
            </div>
          </div>

          {/* Form Content - Horizontal Multi-Column Layout Across Full Width */}
          <form id="customer-form" onSubmit={handleSave} className="flex-1 flex flex-col overflow-hidden">
            <div className="flex-1 overflow-y-auto p-4 md:p-6 lg:p-8">
              <div className="max-w-[1700px] mx-auto space-y-6">
                
                {/* 3 Column Grid */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                
                {/* Column 1: البيانات الشخصية والأساسية */}
                <div className="bg-slate-900/90 rounded-2xl border border-slate-800 p-5 space-y-4 shadow-xl flex flex-col">
                  <div className="flex items-center justify-between pb-3 border-b border-slate-800/80">
                    <h4 className="text-sm font-bold text-white flex items-center gap-2">
                      <UserCheck className="w-4 h-4 text-cyan-400" />
                      <span>1. البيانات الشخصية والهوية</span>
                    </h4>
                    <span className="text-[10px] text-slate-400 font-medium">القسم الأساسي</span>
                  </div>

                  {/* الاسم الأول والأب والكنية */}
                  <div className="grid grid-cols-3 gap-2.5">
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
                        className="w-full bg-slate-950 border border-slate-700/80 rounded-xl px-3 py-2.5 text-sm text-white focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 outline-none transition"
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
                        className="w-full bg-slate-950 border border-slate-700/80 rounded-xl px-3 py-2.5 text-sm text-white focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 outline-none transition"
                      />
                    </div>

                    <div>
                      <label className="text-xs text-slate-300 font-semibold block mb-1">
                        الكنية / العائلة <span className="text-rose-400">*</span>
                      </label>
                      <input
                        type="text"
                        required
                        placeholder="قباني"
                        value={formData.lastName}
                        onChange={(e) => {
                          const lName = e.target.value;
                          const combined = [formData.firstName, formData.fatherName, lName].filter(Boolean).join(' ');
                          setFormData({ ...formData, lastName: lName, fullName: combined });
                        }}
                        className="w-full bg-slate-950 border border-slate-700/80 rounded-xl px-3 py-2.5 text-sm text-white focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 outline-none transition"
                      />
                    </div>
                  </div>

                  {/* الاسم الكامل التلقائي */}
                  <div>
                    <label className="text-xs text-slate-300 font-semibold block mb-1">
                      الاسم الكامل / الشهرة المعتمدة
                    </label>
                    <input
                      type="text"
                      placeholder="محمد نادر قباني"
                      value={formData.fullName}
                      onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
                      className="w-full bg-slate-950 border border-slate-700/80 rounded-xl px-3 py-2.5 text-sm text-cyan-200 focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 outline-none font-semibold transition"
                    />
                    <span className="text-[10px] text-slate-500 mt-1 block">
                      يتم تجميعه تلقائياً مع إمكانية التعديل اليدوي إن رغبت
                    </span>
                  </div>

                  {/* اسم الأم والرقم الوطني */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs text-slate-300 font-semibold block mb-1">اسم الأم</label>
                      <input
                        type="text"
                        placeholder="هدى"
                        value={formData.motherName}
                        onChange={(e) => setFormData({ ...formData, motherName: e.target.value })}
                        className="w-full bg-slate-950 border border-slate-700/80 rounded-xl px-3 py-2.5 text-sm text-white focus:border-cyan-500 outline-none transition"
                      />
                    </div>

                    <div>
                      <label className="text-xs text-slate-300 font-semibold block mb-1">
                        الرقم الوطني (11 خانة)
                      </label>
                      <input
                        type="text"
                        inputMode="numeric"
                        maxLength={11}
                        placeholder="01234567890"
                        value={formData.nationalId}
                        onKeyDown={blockNonIntegerKeys}
                        onChange={(e) => setFormData({ ...formData, nationalId: sanitizeDigitsOnly(e.target.value).slice(0, 11) })}
                        className="w-full bg-slate-950 border border-slate-700/80 rounded-xl px-3 py-2.5 text-sm text-amber-200 focus:border-cyan-500 outline-none font-mono transition"
                      />
                    </div>
                  </div>

                  {/* تاريخ الميلاد */}
                  <div>
                    <label className="text-xs text-slate-300 font-semibold block mb-1">تاريخ الميلاد (أرقام فقط)</label>
                    <BirthDateField
                      id="input_customer_birth_date"
                      value={formData.birthDate}
                      onChange={(iso, dmy) => setFormData({ ...formData, birthDate: iso || dmy })}
                      placeholder="DD/MM/YYYY (أرقام فقط)"
                    />
                  </div>

                  {/* مساحة تأكيدية */}
                  <div className="mt-auto bg-slate-950/60 p-3 rounded-xl border border-slate-800/60 text-[11px] text-slate-400 flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                    <span>يتم توليد كود تعريف فريد لكل عميل تلقائياً في النظام فور الحفظ.</span>
                  </div>
                </div>

                {/* Column 2: بيانات الاتصال والموقع والنشاط التجاري */}
                <div className="bg-slate-900/90 rounded-2xl border border-slate-800 p-5 space-y-4 shadow-xl flex flex-col">
                  <div className="flex items-center justify-between pb-3 border-b border-slate-800/80">
                    <h4 className="text-sm font-bold text-white flex items-center gap-2">
                      <Building className="w-4 h-4 text-emerald-400" />
                      <span>2. بيانات الاتصال والعنوان والنشاط</span>
                    </h4>
                    <span className="text-[10px] text-slate-400 font-medium">معلومات الشحن</span>
                  </div>

                  {/* رقم الهاتف والمحافظة */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs text-slate-300 font-semibold block mb-1">
                        رقم الهاتف الجوال <span className="text-rose-400">*</span>
                      </label>
                      <input
                        type="tel"
                        required
                        placeholder="0987654321"
                        value={formData.phone}
                        onKeyDown={blockNonPhoneKeys}
                        onChange={(e) => setFormData({ ...formData, phone: sanitizePhone(e.target.value) })}
                        className="w-full bg-slate-950 border border-slate-700/80 rounded-xl px-3 py-2.5 text-sm text-white focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 outline-none font-mono transition"
                      />
                    </div>

                    <div>
                      <label className="text-xs text-slate-300 font-semibold block mb-1">المحافظة المعتمدة</label>
                      <select
                        value={formData.city}
                        onChange={(e) => setFormData({ ...formData, city: e.target.value as Governorate })}
                        className="w-full bg-slate-950 border border-slate-700/80 rounded-xl px-3 py-2.5 text-sm text-white focus:border-emerald-500 outline-none transition cursor-pointer"
                      >
                        <option value="دمشق">دمشق</option>
                        <option value="ريف دمشق">ريف دمشق</option>
                        <option value="حلب">حلب</option>
                        <option value="حمص">حمص</option>
                        <option value="حماة">حماة</option>
                        <option value="اللاذقية">اللاذقية</option>
                        <option value="طرطوس">طرطوس</option>
                        <option value="السويداء">السويداء</option>
                        <option value="درعا">درعا</option>
                        <option value="دير الزور">دير الزور</option>
                        <option value="الحسكة">الحسكة</option>
                        <option value="الرقة">الرقة</option>
                        <option value="إدلب">إدلب</option>
                        <option value="القنيطرة">القنيطرة</option>
                      </select>
                    </div>
                  </div>

                  {/* تصنيف العميل واسم المؤسسة */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs text-slate-300 font-semibold block mb-1">تصنيف العميل</label>
                      <select
                        value={formData.customerType}
                        onChange={(e) => setFormData({ ...formData, customerType: e.target.value as any })}
                        className="w-full bg-slate-950 border border-slate-700/80 rounded-xl px-3 py-2.5 text-sm text-white focus:border-emerald-500 outline-none transition cursor-pointer"
                      >
                        <option value="individual">عميل أفراد (مستلم / مرسل عادي)</option>
                        <option value="merchant">تاجر / متجر إلكتروني</option>
                        <option value="corporate">شركة أو مؤسسة تجارية معتمدة</option>
                      </select>
                    </div>

                    <div>
                      <label className="text-xs text-slate-300 font-semibold block mb-1">اسم المؤسسة / المتجر</label>
                      <input
                        type="text"
                        placeholder="مثال: شركة النور أو متجر الأناقة"
                        value={formData.companyName}
                        onChange={(e) => setFormData({ ...formData, companyName: e.target.value })}
                        className="w-full bg-slate-950 border border-slate-700/80 rounded-xl px-3 py-2.5 text-sm text-white focus:border-emerald-500 outline-none transition"
                      />
                    </div>
                  </div>

                  {/* العنوان التفصيلي */}
                  <div>
                    <label className="text-xs text-slate-300 font-semibold block mb-1">العنوان التفصيلي الدقيق</label>
                    <input
                      type="text"
                      placeholder="المنطقة، الشارع، البناء، رقم الطابق، أقرب نقطة دالة"
                      value={formData.address}
                      onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                      className="w-full bg-slate-950 border border-slate-700/80 rounded-xl px-3 py-2.5 text-sm text-white focus:border-emerald-500 outline-none transition"
                    />
                  </div>

                  {/* ملاحظات خاصة */}
                  <div>
                    <label className="text-xs text-slate-300 font-semibold block mb-1">ملاحظات خاصة وتعليمات</label>
                    <textarea
                      rows={3}
                      placeholder="أي ملاحظات تتعلق بأوقات التسليم، شروط الشحن، أو الاتفاقيات الخاصة بالعميل..."
                      value={formData.notes}
                      onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                      className="w-full bg-slate-950 border border-slate-700/80 rounded-xl px-3 py-2 text-sm text-slate-200 focus:border-emerald-500 outline-none resize-none transition"
                    />
                  </div>
                </div>

                {/* Column 3: وثائق الهوية وبوابة تتبع الزبائن */}
                <div className="space-y-6 flex flex-col">
                  {/* وثائق الهوية الشخصية */}
                  <div className="bg-slate-900/90 rounded-2xl border border-slate-800 p-5 shadow-xl space-y-3">
                    <div className="flex items-center justify-between pb-2 border-b border-slate-800/80">
                      <h4 className="text-sm font-bold text-white flex items-center gap-2">
                        <CreditCard className="w-4 h-4 text-cyan-400" />
                        <span>3. وثائق الهوية الشخصية</span>
                      </h4>
                      <span className="text-[10px] text-slate-400">اختياري / أمان</span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {/* Front Side */}
                      <div className="border border-dashed border-slate-700/80 rounded-xl p-2.5 bg-slate-950 text-center flex flex-col items-center justify-center min-h-[140px]">
                        <span className="text-[11px] font-semibold text-slate-300 mb-1.5">الوجه الأمامي</span>
                        {idFrontPreview ? (
                          <div className="relative w-full h-24 rounded-lg overflow-hidden border border-slate-700">
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
                              className="absolute top-1 right-1 bg-rose-600 hover:bg-rose-500 text-white px-1.5 py-0.5 rounded text-[10px] font-bold cursor-pointer"
                            >
                              حذف
                            </button>
                          </div>
                        ) : (
                          <label className="w-full py-4 flex flex-col items-center justify-center cursor-pointer hover:bg-slate-900 rounded-lg transition">
                            <Upload className="w-5 h-5 text-cyan-400 mb-1" />
                            <span className="text-[11px] text-cyan-400 font-medium">رفع صورة أمامية</span>
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
                      <div className="border border-dashed border-slate-700/80 rounded-xl p-2.5 bg-slate-950 text-center flex flex-col items-center justify-center min-h-[140px]">
                        <span className="text-[11px] font-semibold text-slate-300 mb-1.5">الوجه الخلفي</span>
                        {idBackPreview ? (
                          <div className="relative w-full h-24 rounded-lg overflow-hidden border border-slate-700">
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
                              className="absolute top-1 right-1 bg-rose-600 hover:bg-rose-500 text-white px-1.5 py-0.5 rounded text-[10px] font-bold cursor-pointer"
                            >
                              حذف
                            </button>
                          </div>
                        ) : (
                          <label className="w-full py-4 flex flex-col items-center justify-center cursor-pointer hover:bg-slate-900 rounded-lg transition">
                            <Upload className="w-5 h-5 text-cyan-400 mb-1" />
                            <span className="text-[11px] text-cyan-400 font-medium">رفع صورة خلفية</span>
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

                  {/* تطبيق الزبون */}
                  <div className="bg-gradient-to-br from-indigo-950/50 via-slate-900 to-indigo-950/30 rounded-2xl border border-indigo-500/40 p-5 shadow-xl space-y-3.5 flex-1">
                    <div className="flex items-center justify-between pb-2 border-b border-indigo-500/20">
                      <h4 className="text-sm font-bold text-white flex items-center gap-2">
                        <Smartphone className="w-4 h-4 text-amber-400" />
                        <span>4. تطبيق الزبون (ربط الحساب)</span>
                      </h4>
                      {isSuperAdmin ? (
                        <label className="flex items-center gap-2 cursor-pointer bg-slate-950 px-2.5 py-1 rounded-lg border border-indigo-500/30">
                          <input
                            type="checkbox"
                            checked={formData.portalAccessEnabled}
                            onChange={(e) => setFormData({ ...formData, portalAccessEnabled: e.target.checked })}
                            className="rounded text-indigo-600 focus:ring-indigo-500 w-4 h-4 cursor-pointer"
                          />
                          <span className={`text-[11px] font-bold ${formData.portalAccessEnabled ? 'text-emerald-400' : 'text-slate-400'}`}>
                            {formData.portalAccessEnabled ? 'مرتبط بالتطبيق' : 'غير مرتبط'}
                          </span>
                        </label>
                      ) : (
                        <span className="text-[10px] text-slate-400 bg-slate-950 px-2.5 py-1 rounded-lg border border-slate-800 flex items-center gap-1">
                          <Lock className="w-3 h-3 text-slate-500" />
                          محصور بمدير التطبيق
                        </span>
                      )}
                    </div>

                    {!isSuperAdmin ? (
                      <div className="p-3.5 rounded-xl bg-slate-950/80 border border-slate-800 text-xs text-slate-400 leading-relaxed space-y-2">
                        <div className="flex items-center gap-1.5 text-amber-400 font-bold">
                          <Lock className="w-3.5 h-3.5" />
                          <span>صلاحية حصرية لمدير التطبيق</span>
                        </div>
                        <p className="text-[11px] text-slate-300">
                          العميل الجديد غير مرتبط بتطبيق الزبون افتراضياً. يقوم مدير التطبيق حصراً بربط العملاء المحددين بالتطبيق لاحقاً عبر دليل العملاء وإرسال رابط التطبيق وبيانات الدخول عبر واتساب.
                        </p>
                      </div>
                    ) : (
                      <>
                        <div className="text-[11px] text-slate-300 bg-slate-950/60 p-2.5 rounded-xl border border-slate-800">
                          {formData.portalAccessEnabled ? (
                            <span className="text-emerald-400 font-semibold flex items-center gap-1">
                              <CheckCircle className="w-3.5 h-3.5" />
                              العميل سيتم ربطه بالتطبيق ويمكنه تسجيل الدخول فوراً
                            </span>
                          ) : (
                            <span className="text-slate-400">
                              غير مرتبط افتراضياً. يمكنك ربطه الآن أو لاحقاً من دليل العملاء بضغطة زر وإرسال بيانات الدخول عبر واتساب.
                            </span>
                          )}
                        </div>

                        {formData.portalAccessEnabled && (
                          <div className="space-y-3 pt-1">
                            <div>
                              <div className="flex items-center justify-between mb-1">
                                <label className="text-xs text-slate-300 font-semibold">اسم المستخدم للدخول</label>
                                <button
                                  type="button"
                                  onClick={() => setFormData({ ...formData, portalUsername: formData.phone })}
                                  className="text-[10px] text-indigo-300 hover:text-indigo-200 transition"
                                >
                                  استخدام رقم الهاتف
                                </button>
                              </div>
                              <input
                                type="text"
                                placeholder={formData.phone || 'مثال: 0987654321 أو اسم مخصص'}
                                value={formData.portalUsername}
                                onChange={(e) => setFormData({ ...formData, portalUsername: e.target.value })}
                                className="w-full bg-slate-950 border border-slate-700/80 rounded-xl px-3 py-2 text-sm text-indigo-200 focus:border-indigo-500 outline-none font-mono"
                              />
                            </div>

                            <div>
                              <div className="flex items-center justify-between mb-1">
                                <label className="text-xs text-slate-300 font-semibold">كلمة المرور</label>
                                <div className="flex items-center gap-1.5 text-[10px]">
                                  <button
                                    type="button"
                                    onClick={() => setFormData({ ...formData, portalPassword: Math.floor(100000 + Math.random() * 900000).toString() })}
                                    className="text-amber-400 hover:text-amber-300 flex items-center gap-1"
                                  >
                                    <RefreshCw className="w-3 h-3" />
                                    توليد 6 أرقام
                                  </button>
                                  <span className="text-slate-600">|</span>
                                  <button
                                    type="button"
                                    onClick={() => setFormData({ ...formData, portalPassword: '12345' })}
                                    className="text-slate-400 hover:text-slate-200"
                                  >
                                    12345
                                  </button>
                                </div>
                              </div>
                              <input
                                type="text"
                                placeholder="12345"
                                value={formData.portalPassword}
                                onChange={(e) => setFormData({ ...formData, portalPassword: e.target.value })}
                                className="w-full bg-slate-950 border border-slate-700/80 rounded-xl px-3 py-2 text-sm text-amber-200 focus:border-indigo-500 outline-none font-mono"
                              />
                            </div>
                          </div>
                        )}
                      </>
                    )}
                  </div>
                </div>
                {/* End Column 3 */}

              </div>
              {/* End 3-Column Grid */}

              {/* Inline Action Bar directly under the design cards */}
              <div className="bg-slate-900/95 border border-slate-800 rounded-2xl p-4 md:p-5 flex flex-wrap items-center justify-between gap-4 shadow-xl">
                <div className="flex items-center gap-2 text-xs text-slate-400">
                  <span className="text-rose-400 font-bold text-sm">*</span>
                  <span>الحقول الإلزامية المطلوبة: <strong className="text-slate-200">الاسم الأول</strong>، <strong className="text-slate-200">الكنية</strong>، و<strong className="text-slate-200">رقم الهاتف الجوال</strong>.</span>
                </div>

                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => setIsAddModalOpen(false)}
                    className="px-6 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-semibold cursor-pointer transition border border-slate-700"
                  >
                    إلغاء التغييرات
                  </button>
                  <button
                    type="submit"
                    className="px-8 py-2.5 bg-gradient-to-r from-cyan-600 via-teal-600 to-emerald-600 hover:from-cyan-500 hover:to-emerald-500 text-white rounded-xl text-xs font-bold flex items-center gap-2 shadow-lg shadow-cyan-950/60 cursor-pointer transition transform active:scale-95"
                  >
                    <CheckCircle className="w-4 h-4" />
                    <span>{editingCustomer ? 'حفظ وتحديث بيانات العميل' : 'تسجيل وتثبيت العميل في الدليل العام'}</span>
                  </button>
                </div>
              </div>

            </div>
          </div>
        </form>
      </div>
    )}

      {/* Dedicated Portal Credentials & WhatsApp Linking Manager Modal (حصري لمدير التطبيق) */}
      {managingPortalCustomer && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-md p-3 sm:p-4 overflow-y-auto">
          <div className="bg-slate-900 border border-amber-500/40 w-full max-w-lg rounded-3xl p-5 sm:p-6 shadow-2xl space-y-4 my-auto">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-2xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400 font-bold shadow-inner">
                  <Smartphone className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white flex items-center gap-1.5">
                    <span>ربط العميل بتطبيق الزبون:</span>
                    <span className="text-amber-300 font-black">{managingPortalCustomer.fullName}</span>
                  </h3>
                  <p className="text-[11px] text-slate-400 font-mono mt-0.5">
                    الكود: <span className="text-cyan-400 font-bold">{managingPortalCustomer.code}</span> | الهاتف: <span className="text-slate-300 font-bold">{managingPortalCustomer.phone}</span>
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setManagingPortalCustomer(null)}
                className="p-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Admin Exclusive Badge */}
            <div className="bg-amber-950/30 border border-amber-500/30 rounded-xl p-2.5 flex items-center gap-2 text-xs text-amber-200">
              <Lock className="w-4 h-4 text-amber-400 shrink-0" />
              <span>
                <strong>صلاحية مدير التطبيق:</strong> يمكنك تفعيل ربط هذا العميل بتطبيق الزبون وتزويده ببيانات الدخول ورابط التطبيق عبر واتساب مباشرة.
              </span>
            </div>

            <form onSubmit={(e) => handleSavePortalCredentials(e, false)} className="space-y-4">
              {/* Access Status Toggle */}
              <div className="bg-slate-950 p-3.5 rounded-2xl border border-slate-800 flex items-center justify-between">
                <div>
                  <span className="text-xs font-bold text-white block">حالة ربط حساب الزبون</span>
                  <span className="text-[11px] text-slate-400">
                    {portalModalAccess
                      ? 'العميل مرتبط ومفعل بتطبيق الزبون ويمكنه تسجيل الدخول'
                      : 'العميل غير مرتبط بالتطبيق حالياً (لا يملك صلاحية الدخول)'}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setPortalModalAccess(!portalModalAccess)}
                  className={`px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition cursor-pointer border shadow-sm ${
                    portalModalAccess
                      ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40 hover:bg-emerald-500/30'
                      : 'bg-rose-500/20 text-rose-300 border-rose-500/40 hover:bg-rose-500/30'
                  }`}
                >
                  {portalModalAccess ? <Unlock className="w-4 h-4" /> : <Lock className="w-4 h-4" />}
                  <span>{portalModalAccess ? 'مرتبط ومفعل' : 'غير مرتبط'}</span>
                </button>
              </div>

              {/* Username Input */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs text-slate-300 font-semibold">اسم المستخدم للدخول</label>
                  <button
                    type="button"
                    onClick={() => setPortalModalUsername(managingPortalCustomer.phone)}
                    className="text-[11px] text-cyan-400 hover:text-cyan-300 font-bold transition"
                  >
                    استخدام رقم الهاتف
                  </button>
                </div>
                <input
                  type="text"
                  value={portalModalUsername}
                  onChange={(e) => setPortalModalUsername(e.target.value)}
                  placeholder={managingPortalCustomer.phone}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2.5 text-sm text-cyan-200 focus:border-amber-500 outline-none font-mono"
                  required
                />
              </div>

              {/* Password Input */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs text-slate-300 font-semibold">كلمة المرور</label>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setPortalModalPassword(Math.floor(100000 + Math.random() * 900000).toString())}
                      className="text-[11px] text-amber-400 hover:text-amber-300 flex items-center gap-1 transition font-bold"
                    >
                      <RefreshCw className="w-3 h-3" />
                      توليد كلمة سر عشوائية
                    </button>
                    <span className="text-slate-600">|</span>
                    <button
                      type="button"
                      onClick={() => {
                        const pin = managingPortalCustomer.phone
                          ? managingPortalCustomer.phone.replace(/\D/g, '').slice(-4) || '12345'
                          : '12345';
                        setPortalModalPassword(pin);
                      }}
                      className="text-[11px] text-slate-400 hover:text-slate-300 transition"
                    >
                      آخر 4 أرقام
                    </button>
                  </div>
                </div>
                <div className="relative">
                  <input
                    type={showPasswordInModal ? 'text' : 'password'}
                    value={portalModalPassword}
                    onChange={(e) => setPortalModalPassword(e.target.value)}
                    placeholder="12345"
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2.5 text-sm text-amber-200 focus:border-amber-500 outline-none font-mono"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPasswordInModal(!showPasswordInModal)}
                    className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200 text-xs font-semibold"
                  >
                    {showPasswordInModal ? 'إخفاء' : 'إظهار'}
                  </button>
                </div>
              </div>

              {/* Official App Link Suffix Info */}
              <div className="bg-slate-950/80 p-2.5 rounded-xl border border-slate-800 text-xs flex items-center justify-between">
                <div>
                  <span className="text-[11px] text-slate-400 block">رابط تطبيق الزبون المعتمد:</span>
                  <span className="text-cyan-400 font-mono font-bold text-[11px] dir-ltr inline-block">
                    {window.location.origin}/?portal=CST-SC
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    navigator.clipboard.writeText(`${window.location.origin}/?portal=CST-SC`);
                    showToast('✓ تم نسخ رابط تطبيق الزبون');
                  }}
                  className="px-2 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded text-[11px] font-semibold flex items-center gap-1 cursor-pointer"
                >
                  <Copy className="w-3 h-3" />
                  <span>نسخ الرابط</span>
                </button>
              </div>

              {/* Direct WhatsApp Action Button (Primary Feature requested by user) */}
              <div className="bg-gradient-to-br from-emerald-950/40 to-slate-900 p-3.5 rounded-2xl border border-emerald-500/40 space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-emerald-300 flex items-center gap-1.5">
                    <MessageSquare className="w-4 h-4 text-emerald-400" />
                    <span>إرسال بيانات الدخول والرابط عبر واتساب</span>
                  </span>
                  <span className="text-[10px] text-slate-400">إرسال فوري ومباشر</span>
                </div>
                <p className="text-[11px] text-slate-300 leading-relaxed">
                  يقوم بحفظ وتفعيل ربط العميل بالتطبيق فوراً، وفتح تطبيق واتساب برسالة جاهزة تحتوي رابط التطبيق المعزول <span className="font-mono text-cyan-300">CST-SC</span> واسم المستخدم وكلمة المرور.
                </p>
                <div className="flex items-center gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => {
                      // Save and open WhatsApp
                      handleSavePortalCredentials(undefined, true);
                    }}
                    className="flex-1 py-2.5 px-4 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white rounded-xl text-xs font-black flex items-center justify-center gap-2 shadow-lg shadow-emerald-950/60 cursor-pointer transition transform active:scale-95"
                  >
                    <MessageSquare className="w-4 h-4" />
                    <span>إرسال رسالة واتساب للعميل</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const usr = portalModalUsername.trim() || managingPortalCustomer.phone;
                      const pwd = portalModalPassword.trim() || '12345';
                      const portalUrl = `${window.location.origin}/?portal=CST-SC`;
                      const company = brandingSettings.companyName || 'أوركا إكسبريس';
                      const msg = `مرحباً بك أستاذ ${managingPortalCustomer.fullName} 🌸\nيسر إدارة [${company}] تزويدكم برابط الدخول الرسمي لتطبيق الزبائن لمتابعة شحناتكم:\n\n🔗 رابط تطبيق الزبون:\n${portalUrl}\n\n👤 اسم المستخدم (أو رقم الهاتف): ${usr}\n🔑 كلمة المرور الخاصة بك: ${pwd}\n\nيمكنكم من خلال التطبيق:\n• تتبع مسار كافة الطرود الصادرة والواردة لحظة بلحظة.\n• متابعة تحصيل وصرف مبالغ الـ COD وتحديثات الأرصدة المالية فوراً.\n• استعراض وتحميل الفواتير والكشوفات المالية.\n\nنتشرف بخدمتكم دائماً.`;
                      navigator.clipboard.writeText(msg);
                      showToast('✓ تم نسخ نص رسالة الواتساب وبيانات الدخول للحافظة');
                    }}
                    className="py-2.5 px-3 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition cursor-pointer border border-slate-700"
                    title="نسخ نص الرسالة بالكامل"
                  >
                    <Copy className="w-4 h-4" />
                    <span>نسخ النص</span>
                  </button>
                </div>
              </div>

              {/* Direct Login Test Button */}
              <div className="bg-indigo-950/30 p-3 rounded-2xl border border-indigo-500/20 flex items-center justify-between">
                <div>
                  <span className="text-xs font-bold text-indigo-200 block">تجربة التطبيق كزبون</span>
                  <span className="text-[10px] text-slate-400">تسجيل الدخول الفوري وتجربة الواجهة بحساب هذا العميل</span>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    updateCustomerPortalCredentials(managingPortalCustomer.id, {
                      portalUsername: portalModalUsername.trim() || managingPortalCustomer.phone,
                      portalPassword: portalModalPassword.trim() || '12345',
                      portalAccessEnabled: portalModalAccess,
                    });
                    handleTestCustomerLogin({
                      ...managingPortalCustomer,
                      portalUsername: portalModalUsername.trim() || managingPortalCustomer.phone,
                      portalPassword: portalModalPassword.trim() || '12345',
                      portalAccessEnabled: portalModalAccess,
                    });
                  }}
                  className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-md shadow-indigo-950/50 cursor-pointer transition"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  <span>دخول تجريبي</span>
                </button>
              </div>

              {/* Footer Buttons */}
              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setManagingPortalCustomer(null)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-semibold cursor-pointer"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-amber-600 hover:bg-amber-500 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-lg shadow-amber-950/50 cursor-pointer"
                >
                  <CheckCircle className="w-4 h-4" />
                  <span>حفظ وتثبيت الربط</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* View Customer Details & Full Transaction History Modal */}
      {viewingCustomer && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-md p-2 sm:p-4 overflow-y-auto">
          <div className="bg-slate-900 border border-slate-700/80 w-full max-w-5xl lg:max-w-6xl rounded-3xl p-4 sm:p-6 shadow-2xl space-y-5 my-auto max-h-[94vh] flex flex-col overflow-hidden">
            
            {/* Header */}
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 pb-4 shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-cyan-500/20 border border-cyan-500/40 flex items-center justify-center text-cyan-300 font-bold text-lg shadow-inner">
                  {viewingCustomer.fullName.slice(0, 1)}
                </div>
                <div>
                  <h3 className="text-lg font-bold text-white flex items-center gap-2">
                    {viewingCustomer.fullName}
                    {viewingCustomer.isBlacklisted && (
                      <span className="text-xs bg-rose-500/20 text-rose-300 border border-rose-500/30 px-2.5 py-0.5 rounded-full font-semibold">
                        محظور في القائمة السوداء
                      </span>
                    )}
                  </h3>
                  <div className="flex flex-wrap items-center gap-2 text-xs text-slate-400 font-mono mt-0.5">
                    <span className="text-cyan-400 font-bold">الكود: {viewingCustomer.code}</span>
                    <span>•</span>
                    <span className="text-slate-300">
                      {viewingCustomer.customerType === 'merchant'
                        ? 'حساب تجاري (تاجر)'
                        : viewingCustomer.customerType === 'corporate'
                        ? 'شركة / مؤسسة'
                        : 'عميل فردي'}
                    </span>
                    <span>•</span>
                    <span className="text-emerald-400 font-bold">{viewingCustomer.city}</span>
                  </div>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => openPortalModal(viewingCustomer)}
                  className="px-3.5 py-1.5 bg-indigo-600/30 hover:bg-indigo-600/50 border border-indigo-500/40 text-indigo-200 rounded-xl text-xs font-bold flex items-center gap-1.5 transition cursor-pointer shadow-sm"
                >
                  <KeyRound className="w-3.5 h-3.5 text-indigo-300" />
                  <span>بيانات البوابة</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const c = viewingCustomer;
                    setViewingCustomer(null);
                    openEditModal(c);
                  }}
                  className="px-3.5 py-1.5 bg-amber-600/30 hover:bg-amber-600/50 border border-amber-500/40 text-amber-200 rounded-xl text-xs font-bold flex items-center gap-1.5 transition cursor-pointer shadow-sm"
                >
                  <Edit2 className="w-3.5 h-3.5 text-amber-300" />
                  <span>تعديل بيانات العميل</span>
                </button>
                <button
                  type="button"
                  onClick={() => requestDeleteCustomer(viewingCustomer)}
                  className="px-3.5 py-1.5 bg-rose-600/20 hover:bg-rose-600/40 border border-rose-500/40 text-rose-300 rounded-xl text-xs font-bold flex items-center gap-1.5 transition cursor-pointer shadow-sm"
                  title="حذف بطاقة العميل"
                >
                  <Trash2 className="w-3.5 h-3.5 text-rose-400" />
                  <span>حذف بطاقة العميل</span>
                </button>
                <button
                  type="button"
                  onClick={() => setViewingCustomer(null)}
                  className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Modal Body Container with Smooth Internal Scroll */}
            <div className="flex-1 overflow-y-auto space-y-6 pr-1 custom-scrollbar">

              {/* 1. SECTION: Customer Master Information & ID Documents */}
              <div className="bg-slate-950/80 p-4 sm:p-5 rounded-2xl border border-slate-800 space-y-4">
                <div className="flex items-center justify-between border-b border-slate-800/80 pb-2.5">
                  <h4 className="text-xs font-bold text-cyan-400 flex items-center gap-2">
                    <Users className="w-4 h-4 text-cyan-400" />
                    بيانات بطاقة العميل والوثائق الشخصية
                  </h4>
                  <span className="text-[11px] text-slate-400 font-mono">
                    تاريخ التسجيل: {viewingCustomer.createdAt ? new Date(viewingCustomer.createdAt).toLocaleDateString('ar-SY') : '—'}
                  </span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 text-xs">
                  <div className="bg-slate-900/90 p-2.5 rounded-xl border border-slate-800/80">
                    <span className="text-slate-500 block text-[10px]">الاسم الكامل</span>
                    <span className="font-bold text-white text-xs">{viewingCustomer.fullName}</span>
                  </div>
                  <div className="bg-slate-900/90 p-2.5 rounded-xl border border-slate-800/80">
                    <span className="text-slate-500 block text-[10px]">الاسم المفرز (أول / أب / كنية)</span>
                    <span className="text-slate-300 font-medium text-xs">
                      {[viewingCustomer.firstName, viewingCustomer.fatherName, viewingCustomer.lastName]
                        .filter(Boolean)
                        .join(' - ') || '—'}
                    </span>
                  </div>
                  <div className="bg-slate-900/90 p-2.5 rounded-xl border border-slate-800/80">
                    <span className="text-slate-500 block text-[10px]">رقم الوثيقة / الرقم الوطني</span>
                    <span className="font-mono font-bold text-white text-xs">{viewingCustomer.nationalId || 'غير مدخل'}</span>
                  </div>
                  <div className="bg-slate-900/90 p-2.5 rounded-xl border border-slate-800/80">
                    <span className="text-slate-500 block text-[10px]">نوع الوثيقة الشخصية</span>
                    <span className="text-cyan-300 font-semibold text-xs">
                      {viewingCustomer.idType || 'هوية شخصية سورية'}
                    </span>
                  </div>
                  <div className="bg-slate-900/90 p-2.5 rounded-xl border border-slate-800/80">
                    <span className="text-slate-500 block text-[10px]">رقم الهاتف الرئيسي</span>
                    <span className="font-mono text-cyan-400 font-bold dir-ltr text-right block text-xs">{viewingCustomer.phone}</span>
                  </div>
                  <div className="bg-slate-900/90 p-2.5 rounded-xl border border-slate-800/80">
                    <span className="text-slate-500 block text-[10px]">الهاتف الإضافي / الواتساب</span>
                    <span className="font-mono text-slate-300 dir-ltr text-right block text-xs">
                      {viewingCustomer.secondaryPhone || 'غير مدخل'}
                    </span>
                  </div>
                  <div className="bg-slate-900/90 p-2.5 rounded-xl border border-slate-800/80">
                    <span className="text-slate-500 block text-[10px]">اسم الأم وتاريخ الميلاد</span>
                    <span className="text-slate-200 font-medium text-xs">
                      {viewingCustomer.motherName || '—'} {viewingCustomer.birthDate ? `(${viewingCustomer.birthDate})` : ''}
                    </span>
                  </div>
                  <div className="bg-slate-900/90 p-2.5 rounded-xl border border-slate-800/80">
                    <span className="text-slate-500 block text-[10px]">المحافظة والعنوان</span>
                    <span className="text-white font-bold text-xs">{viewingCustomer.city} - {viewingCustomer.address || 'مركز الفرع'}</span>
                  </div>
                  <div className="bg-slate-900/90 p-2.5 rounded-xl border border-slate-800/80">
                    <span className="text-slate-500 block text-[10px]">اسم المتجر / الشركة</span>
                    <span className="text-purple-300 font-bold text-xs">{viewingCustomer.companyName || '—'}</span>
                  </div>
                  <div className="bg-slate-900/90 p-2.5 rounded-xl border border-slate-800/80">
                    <span className="text-slate-500 block text-[10px]">إجمالي الطرود الصادرة</span>
                    <span className="text-emerald-400 font-bold text-xs">{customerParcelActivity.totalSentCount} طرد</span>
                  </div>
                  <div className="bg-slate-900/90 p-2.5 rounded-xl border border-slate-800/80">
                    <span className="text-slate-500 block text-[10px]">إجمالي الطرود الواردة</span>
                    <span className="text-purple-400 font-bold text-xs">{customerParcelActivity.totalReceivedCount} طرد</span>
                  </div>
                  <div className="bg-slate-900/90 p-2.5 rounded-xl border border-slate-800/80">
                    <span className="text-slate-500 block text-[10px]">تطبيق الزبون</span>
                    <span className={`font-bold text-xs ${viewingCustomer.portalAccessEnabled === true ? 'text-emerald-400' : 'text-slate-400'}`}>
                      {viewingCustomer.portalAccessEnabled === true ? 'مرتبط بالتطبيق' : 'غير مرتبط'}
                    </span>
                  </div>
                  <div className="bg-slate-900/90 p-2.5 rounded-xl border border-slate-800/80">
                    <span className="text-slate-500 block text-[10px]">ذمم الشحن العكسي المعلقة</span>
                    <span className={`font-bold text-xs font-mono ${(viewingCustomer.returnDebtBalance || 0) > 0 ? 'text-rose-400' : 'text-emerald-400'}`}>
                      {(viewingCustomer.returnDebtBalance || 0) > 0 ? formatCurrency(viewingCustomer.returnDebtBalance || 0, 'SYP') : 'لا توجد ذمم معلقة'}
                    </span>
                  </div>
                </div>

                {/* Customer App Status Bar for Super Admin */}
                <div className="bg-gradient-to-r from-slate-950 via-slate-900 to-amber-950/20 p-3.5 rounded-2xl border border-amber-500/20 flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-400 shrink-0">
                      <Smartphone className="w-5 h-5" />
                    </div>
                    <div>
                      <span className="text-xs font-bold text-white block">حالة ربط تطبيق الزبون</span>
                      <span className="text-[11px] text-slate-400">
                        {viewingCustomer.portalAccessEnabled === true
                          ? `العميل مرتبط ومفعل - اسم المستخدم: [${viewingCustomer.portalUsername || viewingCustomer.phone}]`
                          : 'العميل غير مرتبط بتطبيق الزبون حالياً (الربط محصور بمدير التطبيق)'}
                      </span>
                    </div>
                  </div>
                  {isSuperAdmin && (
                    <button
                      type="button"
                      onClick={() => openPortalModal(viewingCustomer)}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition cursor-pointer border shadow-sm ${
                        viewingCustomer.portalAccessEnabled === true
                          ? 'bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 border-emerald-500/40'
                          : 'bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border-amber-500/40'
                      }`}
                    >
                      <Smartphone className="w-3.5 h-3.5" />
                      <span>{viewingCustomer.portalAccessEnabled === true ? 'إدارة الربط وإرسال واتساب' : 'ربط بتطبيق الزبون وإرسال واتساب'}</span>
                    </button>
                  )}
                </div>

                {/* ID Card Document Images */}
                <div className="pt-2">
                  <span className="text-xs font-bold text-slate-300 mb-2 flex items-center gap-1.5">
                    <CreditCard className="w-3.5 h-3.5 text-cyan-400" />
                    صور وثيقة الهوية المسجلة بالدليل
                  </span>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="bg-slate-900/90 p-2.5 rounded-xl border border-slate-800 text-center">
                      <span className="text-[10px] text-slate-400 block mb-1 font-semibold">الوجه الأمامي</span>
                      <PhotoFromIndexedDB
                        photoKey={viewingCustomer.idPhotoFront}
                        alt="Front"
                        className="w-full h-32 object-cover rounded-lg border border-slate-700"
                        fallback={
                          <div className="w-full h-28 rounded-lg bg-slate-950 border border-slate-800 flex items-center justify-center text-xs text-slate-600">
                            لا توجد صورة للوجه الأمامي
                          </div>
                        }
                      />
                    </div>
                    <div className="bg-slate-900/90 p-2.5 rounded-xl border border-slate-800 text-center">
                      <span className="text-[10px] text-slate-400 block mb-1 font-semibold">الوجه الخلفي</span>
                      <PhotoFromIndexedDB
                        photoKey={viewingCustomer.idPhotoBack}
                        alt="Back"
                        className="w-full h-32 object-cover rounded-lg border border-slate-700"
                        fallback={
                          <div className="w-full h-28 rounded-lg bg-slate-950 border border-slate-800 flex items-center justify-center text-xs text-slate-600">
                            لا توجد صورة للوجه الخلفي
                          </div>
                        }
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* 2. SECTION: Customer Shipment & Transaction Activity Ledger (سجل الحركات مع الفرز والبحث) */}
              <div className="bg-slate-950/80 p-4 sm:p-5 rounded-2xl border border-slate-800 space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800/80 pb-3">
                  <div className="flex items-center gap-2">
                    <Package className="w-5 h-5 text-cyan-400" />
                    <h4 className="text-sm font-bold text-white">
                      سجل الحركات الشامل والطرود المرتبطة بالعميل
                    </h4>
                  </div>

                  {/* Summary Metric Pills */}
                  <div className="flex flex-wrap items-center gap-2 text-xs">
                    <span className="bg-emerald-950/80 text-emerald-300 border border-emerald-500/30 px-3 py-1 rounded-xl font-bold flex items-center gap-1">
                      <Send className="w-3.5 h-3.5 text-emerald-400" />
                      صادرة: {customerParcelActivity.totalSentCount}
                    </span>
                    <span className="bg-purple-950/80 text-purple-300 border border-purple-500/30 px-3 py-1 rounded-xl font-bold flex items-center gap-1">
                      <Inbox className="w-3.5 h-3.5 text-purple-400" />
                      واردة: {customerParcelActivity.totalReceivedCount}
                    </span>
                    <span className="bg-cyan-950/80 text-cyan-300 border border-cyan-500/30 px-3 py-1 rounded-xl font-mono font-bold">
                      تحصيل COD: {formatCurrency(customerParcelActivity.totalCodAmount, 'SYP')}
                    </span>
                  </div>
                </div>

                {/* Search & Direction Filtering Toolbar */}
                <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3 bg-slate-900/90 p-3 rounded-2xl border border-slate-800">
                  
                  {/* Search Bar (خيار بحث) */}
                  <div className="relative flex-1">
                    <Search className="w-4 h-4 text-slate-400 absolute right-3.5 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      value={historySearchTerm}
                      onChange={(e) => setHistorySearchTerm(e.target.value)}
                      placeholder="ابحث برقم البوليصة، اسم المستلم/المرسل المقابل، رقم الهاتف، المحافظة، الوصف..."
                      className="w-full bg-slate-950 border border-slate-700/80 focus:border-cyan-500 rounded-xl pr-10 pl-3 py-2 text-xs text-white placeholder-slate-500 outline-none transition"
                    />
                    {historySearchTerm && (
                      <button
                        type="button"
                        onClick={() => setHistorySearchTerm('')}
                        className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>

                  {/* Direction Sorting (فرز حالات الإستلام عن حالات الإرسال) */}
                  <div className="flex flex-wrap items-center gap-1 bg-slate-950 p-1 rounded-xl border border-slate-800 shrink-0">
                    <button
                      type="button"
                      onClick={() => setHistoryDirectionFilter('all')}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
                        historyDirectionFilter === 'all'
                          ? 'bg-cyan-600 text-white shadow-md'
                          : 'text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      <span>الكل ({customerParcelActivity.totalSentCount + customerParcelActivity.totalReceivedCount})</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setHistoryDirectionFilter('sent')}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
                        historyDirectionFilter === 'sent'
                          ? 'bg-emerald-600 text-white shadow-md'
                          : 'text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      <Send className="w-3.5 h-3.5 text-emerald-200" />
                      <span>حالات الإرسال (الصادرة) ({customerParcelActivity.totalSentCount})</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setHistoryDirectionFilter('received')}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
                        historyDirectionFilter === 'received'
                          ? 'bg-purple-600 text-white shadow-md'
                          : 'text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      <Inbox className="w-3.5 h-3.5 text-purple-200" />
                      <span>حالات الاستلام (الواردة) ({customerParcelActivity.totalReceivedCount})</span>
                    </button>
                  </div>

                  {/* Status Filter */}
                  <select
                    value={historyStatusFilter}
                    onChange={(e) => setHistoryStatusFilter(e.target.value)}
                    className="bg-slate-950 border border-slate-700/80 rounded-xl px-3 py-2 text-xs text-slate-200 focus:border-cyan-500 outline-none cursor-pointer shrink-0"
                  >
                    <option value="all">جميع الحالات</option>
                    <option value="pending">قيد التجهيز / المعالجة</option>
                    <option value="accepted">مقبولة بالفرع</option>
                    <option value="in_transit">في الطريق</option>
                    <option value="delivered">تم التسليم 🟢</option>
                    <option value="returned">راجعة / مرجعة 🔴</option>
                  </select>
                </div>

                {/* Transactions Table */}
                <div className="bg-slate-900/90 border border-slate-800 rounded-2xl overflow-hidden shadow-inner">
                  <div className="overflow-x-auto max-h-[360px] overflow-y-auto custom-scrollbar">
                    <table className="w-full text-right text-xs">
                      <thead className="bg-slate-950/90 text-slate-400 border-b border-slate-800 font-semibold sticky top-0 z-10">
                        <tr>
                          <th className="p-3">نوع الحركة</th>
                          <th className="p-3">رقم البوليصة / الكود الورقي</th>
                          <th className="p-3">الطرف المقابل (العميل الآخر)</th>
                          <th className="p-3">مسار الشحنة (من - إلى)</th>
                          <th className="p-3">حالة الشحنة</th>
                          <th className="p-3">القيم المالية والـ COD</th>
                          <th className="p-3">تاريخ الحركة</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800/60 text-slate-200">
                        {customerParcelActivity.filteredList.length === 0 ? (
                          <tr>
                            <td colSpan={7} className="p-10 text-center text-slate-500">
                              <Package className="w-8 h-8 text-slate-600 mx-auto mb-2 opacity-50" />
                              <p className="text-xs font-medium">لا توجد حركات شحن أو طرود تطابق خيارات البحث والفرز للعميل</p>
                            </td>
                          </tr>
                        ) : (
                          customerParcelActivity.filteredList.map((p) => {
                            const isSent = p._direction === 'sent';
                            const otherPartyName = isSent ? p.receiver?.name : p.sender?.name;
                            const otherPartyPhone = isSent ? p.receiver?.phone : p.sender?.phone;
                            const otherPartyCity = isSent ? p.receiver?.city : p.sender?.city;

                            return (
                              <tr key={`${p.id}-${p._direction}`} className="hover:bg-slate-800/40 transition">
                                <td className="p-3">
                                  {isSent ? (
                                    <span className="px-2.5 py-1 rounded-xl bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 font-bold flex items-center gap-1.5 w-fit text-[11px]">
                                      <Send className="w-3.5 h-3.5 text-emerald-400" />
                                      صادرة (إرسال)
                                    </span>
                                  ) : (
                                    <span className="px-2.5 py-1 rounded-xl bg-purple-500/20 text-purple-300 border border-purple-500/30 font-bold flex items-center gap-1.5 w-fit text-[11px]">
                                      <Inbox className="w-3.5 h-3.5 text-purple-400" />
                                      واردة (استلام)
                                    </span>
                                  )}
                                </td>

                                <td className="p-3 font-mono">
                                  <div className="flex items-center gap-1">
                                    <span className="font-bold text-white text-xs">{p.trackingNumber}</span>
                                    <button
                                      type="button"
                                      onClick={() => {
                                        navigator.clipboard.writeText(p.trackingNumber);
                                        showToast(`✓ تم نسخ البوليصة ${p.trackingNumber}`);
                                      }}
                                      title="نسخ البوليصة"
                                      className="text-slate-500 hover:text-cyan-400 transition cursor-pointer"
                                    >
                                      <Copy className="w-3 h-3" />
                                    </button>
                                  </div>
                                  {p.paperReceiptNumber && (
                                    <span className="text-[10px] text-slate-400 block">ورقي: {p.paperReceiptNumber}</span>
                                  )}
                                </td>

                                <td className="p-3">
                                  <span className="font-bold text-slate-100 block">{otherPartyName || 'غير مدخل'}</span>
                                  <span className="font-mono text-[10px] text-cyan-400 block dir-ltr text-right">{otherPartyPhone}</span>
                                  <span className="text-[10px] text-slate-400">{otherPartyCity}</span>
                                </td>

                                <td className="p-3">
                                  <div className="text-[11px] text-slate-300 flex items-center gap-1 font-medium">
                                    <span className="text-slate-400">{p.sender?.city || 'المصدر'}</span>
                                    <span className="text-cyan-400 font-bold">←</span>
                                    <span className="text-white font-bold">{p.receiver?.city || 'الوجهة'}</span>
                                  </div>
                                  {p.contentDescription && (
                                    <span className="text-[10px] text-slate-500 truncate max-w-[140px] block">
                                      {p.contentDescription}
                                    </span>
                                  )}
                                </td>

                                <td className="p-3">
                                  <span
                                    className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${
                                      p.handlingStatus === 'delivered'
                                        ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
                                        : p.handlingStatus === 'in_transit' || p.handlingStatus === 'loaded_in_truck' || p.handlingStatus === 'out_for_delivery'
                                        ? 'bg-amber-500/20 text-amber-300 border-amber-500/30'
                                        : p.handlingStatus === 'returned'
                                        ? 'bg-rose-500/20 text-rose-300 border-rose-500/30'
                                        : 'bg-blue-500/20 text-blue-300 border-blue-500/30'
                                    }`}
                                  >
                                    {p.handlingStatus === 'delivered'
                                      ? 'تم التسليم 🟢'
                                      : p.handlingStatus === 'in_transit' || p.handlingStatus === 'loaded_in_truck' || p.handlingStatus === 'out_for_delivery'
                                      ? 'في الطريق 🟡'
                                      : p.handlingStatus === 'returned'
                                      ? 'راجعة 🔴'
                                      : 'قيد المعالجة 🔵'}
                                  </span>
                                </td>

                                <td className="p-3 font-mono text-xs">
                                  {p.codAmount > 0 && (
                                    <div className="text-amber-300 font-bold">
                                      COD: {formatCurrency(p.codAmount, p.codCurrency || 'SYP')}
                                    </div>
                                  )}
                                  <div className="text-slate-400 text-[10px]">
                                    أجور: {formatCurrency(p.shippingCost || 0, p.shippingCurrency || 'SYP')}
                                  </div>
                                </td>

                                <td className="p-3 font-mono text-[11px] text-slate-400">
                                  {p.createdAt ? new Date(p.createdAt).toLocaleDateString('ar-SY') : '—'}
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

            </div>

            {/* Bottom Action Footer */}
            <div className="flex items-center justify-between gap-2 pt-3 border-t border-slate-800 shrink-0">
              <div className="text-xs text-slate-400 font-mono">
                كود العميل: <span className="text-cyan-400 font-bold">{viewingCustomer.code}</span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => requestDeleteCustomer(viewingCustomer)}
                  className="px-3.5 py-2 bg-rose-600/20 hover:bg-rose-600/40 border border-rose-500/40 text-rose-300 rounded-xl text-xs font-bold flex items-center gap-1.5 transition cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5 text-rose-400" />
                  <span>حذف بطاقة العميل</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const c = viewingCustomer;
                    setViewingCustomer(null);
                    openEditModal(c);
                  }}
                  className="px-4 py-2 bg-gradient-to-r from-amber-600 to-amber-500 hover:from-amber-500 hover:to-amber-400 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-md shadow-amber-950/40 transition cursor-pointer"
                >
                  <Edit2 className="w-3.5 h-3.5" />
                  <span>تعديل بيانات العميل</span>
                </button>
                <button
                  type="button"
                  onClick={() => setViewingCustomer(null)}
                  className="px-5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-bold transition cursor-pointer"
                >
                  إغلاق
                </button>
              </div>
            </div>

          </div>
        </div>
      )}

      {/* Receiver Parcels Details Modal */}
      {viewingReceiverParcels && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-md p-4 overflow-y-auto">
          <div className="bg-slate-900 border border-purple-500/40 w-full max-w-4xl rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
            <div className="p-4 bg-slate-950 border-b border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-purple-600/30 border border-purple-400/40 flex items-center justify-center text-purple-300 font-bold">
                  <Inbox className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white flex items-center gap-2">
                    <span>سجل الطرود الموجهة للمستلم:</span>
                    <span className="text-purple-300">{viewingReceiverParcels.name}</span>
                  </h3>
                  <p className="text-[11px] text-slate-400 font-mono dir-ltr text-right">
                    الهاتف: {viewingReceiverParcels.phone} | المحافظة: {viewingReceiverParcels.city}
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setViewingReceiverParcels(null)}
                className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 overflow-y-auto space-y-4">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs bg-slate-950 p-3.5 rounded-2xl border border-slate-800">
                <div>
                  <span className="text-slate-500 block text-[10px]">إجمالي الطرود</span>
                  <span className="font-bold text-purple-300 text-sm">
                    {viewingReceiverParcels.parcels.length} طرد
                  </span>
                </div>
                <div>
                  <span className="text-slate-500 block text-[10px]">العنوان المعتمد</span>
                  <span className="text-slate-200 font-medium truncate block">
                    {viewingReceiverParcels.address || 'مركز المدينة'}
                  </span>
                </div>
                <div>
                  <span className="text-slate-500 block text-[10px]">الرقم الوطني السوري</span>
                  <span className="text-slate-200 font-mono">
                    {viewingReceiverParcels.nationalId || 'غير مسجل'}
                  </span>
                </div>
                <div>
                  <span className="text-slate-500 block text-[10px]">إجمالي تحصيل COD المسلم</span>
                  <span className="text-emerald-400 font-bold font-mono">
                    {formatCurrency(
                      viewingReceiverParcels.parcels.reduce((acc, p) => acc + (p.codAmount || 0), 0),
                      'SYP'
                    )}
                  </span>
                </div>
              </div>

              <div className="bg-slate-950/80 rounded-2xl border border-slate-800 overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-right text-xs">
                    <thead className="bg-slate-900 text-slate-400 border-b border-slate-800 font-semibold">
                      <tr>
                        <th className="p-3">رقم التتبع / الكود</th>
                        <th className="p-3">التاريخ</th>
                        <th className="p-3">المرسل والفرع المنشئ</th>
                        <th className="p-3">محتوى الطرد</th>
                        <th className="p-3">مبلغ التحصيل (COD)</th>
                        <th className="p-3 text-center">حالة التسليم</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60 text-slate-200">
                      {viewingReceiverParcels.parcels.map((p) => (
                        <tr key={p.id} className="hover:bg-slate-900/40">
                          <td className="p-3 font-mono font-bold text-cyan-300">
                            {p.trackingNumber || p.id}
                          </td>
                          <td className="p-3 font-mono text-[11px] text-slate-400">
                            {p.createdAt ? new Date(p.createdAt).toLocaleDateString('ar-SY') : '—'}
                          </td>
                          <td className="p-3">
                            <span className="font-bold text-white block">{p.sender?.name || 'مرسل عام'}</span>
                            <span className="text-[10px] text-slate-400 block">{p.originHubId}</span>
                          </td>
                          <td className="p-3">
                            <span className="text-slate-300 font-medium block">{p.packageType || 'طرد عادي'}</span>
                            <span className="text-[10px] text-slate-500 font-mono">{p.weightKg || 1} كغ</span>
                          </td>
                          <td className="p-3 font-mono font-bold text-amber-300">
                            {p.codAmount ? formatCurrency(p.codAmount, p.currency || 'SYP') : 'بدون تحصيل'}
                          </td>
                          <td className="p-3 text-center">
                            <span
                              className={`px-2.5 py-1 rounded-full text-[10px] font-bold border ${
                                p.handlingStatus === 'delivered'
                                  ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
                                  : 'bg-amber-500/20 text-amber-300 border-amber-500/30'
                              }`}
                            >
                              {p.handlingStatus === 'delivered' ? 'تم التسليم' : 'قيد التوصيل'}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            <div className="p-4 bg-slate-950 border-t border-slate-800 flex justify-end">
              <button
                type="button"
                onClick={() => setViewingReceiverParcels(null)}
                className="px-5 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl font-bold text-xs cursor-pointer"
              >
                إغلاق
              </button>
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
                  if (viewingCustomer) setViewingCustomer(null);
                  openEditModal(c);
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

      {/* Single Customer Delete Confirmation Modal (Only for Customers with 0 Operations) */}
      {customerToDelete && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/85 backdrop-blur-md p-4 animate-in fade-in">
          <div
            id="modal_confirm_delete_single_customer"
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
        <div className="fixed bottom-6 left-6 z-50 bg-slate-900 border border-emerald-500/60 text-emerald-300 px-4 py-3 rounded-2xl shadow-2xl shadow-emerald-950/60 flex items-center gap-2.5 text-xs font-bold animate-in slide-in-from-bottom-5">
          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          <span>{toastMessage}</span>
        </div>
      )}
    </div>
  );
};
