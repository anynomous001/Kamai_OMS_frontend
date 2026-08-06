'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Home as HomeIcon, ClipboardList, Users, Calendar as CalendarIcon,
  ShoppingBag, MoreHorizontal, Moon, Sun, ArrowUpRight, Plus,
  ArrowLeft, Search, Bell, Check, X, Shield, Phone, MessageSquare,
  ChevronRight, Sparkles, AlertCircle, FileText, CheckCircle2,
  LogOut, ChevronDown, Percent, CreditCard, Send, Mail,
  Settings as SettingsIcon, ShieldCheck, Heart, Info, Wallet,
  UtensilsCrossed, Trash2, Pencil, ArrowUp, ArrowDown, Link2, Copy,
  Share2, Download, Store, Truck, Clock,
  ArrowUpDown, ShoppingCart, Minus, MapPin, RotateCcw
} from 'lucide-react';
import { sendEmailOtp, verifyEmailOtp, checkSession, logout as logoutRequest } from '@/lib/auth';
import { api } from '@/lib/api';
import {
  fetchWholesalers, fetchCatalogue, fetchPolicies,
  fetchCart, getDefaultVariant, getDisplayPrice, getDisplayUnitLabel, getCartSubtotal,
  updateCartItemQuantity, removeCartItem, placeOrder, fetchOrderStatus, fetchBakerOrders,
  haversineDistanceKm,
} from '@/lib/marketplace/client';
import { useAddToCart } from '@/lib/marketplace/useAddToCart';
import type {
  Wholesaler, WholesaleProduct, WholesalerPolicies, WholesaleCart,
  PlaceOrderResponse, OrderStatusResponse, BakerOrderListItem, FulfilmentMode, OrderItem,
} from '@/lib/marketplace/types';

// --- REAL API RESPONSE SHAPES (per verified backend contract) ---
interface DashboardTodayOrder {
  id: string;
  bakerId: string;
  orderNumber: string;
  deliveryDate: string;
  status: string;
  totalPrice: number;
  balanceDue: number;
  createdAt: string;
  updatedAt: string;
}

interface DashboardUpcomingOrder {
  id: string;
  orderNumber: string;
  customerName: string;
  cakeCategory: string;
  deliveryDate: string;
  deliveryTime: string | null;
  status: string;
  totalPrice: number;
  balanceDue: number;
}

interface DashboardSummary {
  todayDeliveries: number;
  activeOrders: number;
  outstandingBalance: number;
  totalRevenue: number;
  todayOrders: DashboardTodayOrder[];
  // Optional: absent if the backend serving this response predates the
  // Upcoming Lookahead feature (e.g. a stale dev server not yet restarted
  // after this field was added) — guarded with ?. wherever it's read.
  upcomingOrders?: {
    month: string | null;
    orders: DashboardUpcomingOrder[];
  };
}

// Real order-list status vocabulary (Pending/Confirmed/In Progress/Ready/
// Delivered/Cancelled) — distinct from the mock Order['status'] type still
// used elsewhere until those screens are wired.
type RealOrderStatus = 'Pending' | 'Confirmed' | 'In Progress' | 'Ready' | 'Delivered' | 'Cancelled';
type RealOrderTab = 'All' | RealOrderStatus;

interface RealOrderListItem {
  orderId: string;
  orderNumber: string;
  customerName: string;
  phone: string | null;
  deliveryDate: string;
  status: RealOrderStatus;
  totalPrice: number;
  balanceDue: number;
}

// paymentStatus isn't present on the orders-list/dashboard endpoints (only
// GET /api/orders/:orderNumber includes payment.paymentStatus) — derived
// client-side using the same advancePaid-vs-totalPrice thresholds the
// backend itself uses (orders.service.ts derivePaymentState), so no
// backend change or extra per-card fetch is needed.
type PaymentStatusValue = 'Unpaid' | 'Partially Paid' | 'Paid';
function derivePaymentStatus(totalPrice: number, balanceDue: number): PaymentStatusValue {
  if (balanceDue <= 0) return 'Paid';
  if (balanceDue >= totalPrice) return 'Unpaid';
  return 'Partially Paid';
}

interface OrdersPagination {
  page: number;
  limit: number;
  totalItems: number;
  totalPages: number;
  hasNext: boolean;
  hasPrevious: boolean;
}

interface RealCustomerListItem {
  customerId: string;
  displayId: string;
  name: string;
  phone: string | null;
  address: string | null;
  totalOrders: number;
  lifetimeValue: number;
  outstandingBalance: number;
  lastOrderDate: string | null;
}

interface RealCustomerProfileOrder {
  orderId: string;
  orderNumber: string;
  deliveryDate: string;
  status: string;
  totalPrice: number;
  balanceDue: number;
  paymentStatus: string;
}

// Real investment categories (per confirmed backend contract) — distinct
// from the mock Expense['category'] vocab ('Raw Material'/'Packaging'/
// 'Decoration'/'Equipment'), which doesn't match.
const REAL_INVESTMENT_CATEGORIES = ['ingredients', 'packaging', 'delivery', 'utilities', 'equipment'] as const;
type RealInvestmentCategory = typeof REAL_INVESTMENT_CATEGORIES[number];

interface RealInvestmentEntry {
  id: string;
  displayId: string;
  category: string;
  description: string | null;
  materialName: string;
  quantity: number;
  unit: string;
  pricePerUnit: number;
  totalCost: number;
  supplierName: string | null;
  purchaseDate: string;
}

// Real menu-item unit vocab (per confirmed backend contract, Action 26).
const MENU_ITEM_UNITS = ['per_kg', 'per_piece', 'per_box', 'per_dozen'] as const;
type MenuItemUnit = typeof MENU_ITEM_UNITS[number];
const MENU_ITEM_UNIT_LABELS: Record<MenuItemUnit, string> = {
  per_kg: 'per kg',
  per_piece: 'per piece',
  per_box: 'per box',
  per_dozen: 'per dozen',
};

// Same hardcoded-prod-fallback + env-override convention as API_BASE_URL in
// lib/api.ts — this is the public-facing app origin, not the API origin.
const PUBLIC_MENU_BASE_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://app.getkamai.online';

interface RealMenuItem {
  id: string;
  name: string;
  category: string | null;
  price: number;
  unit: MenuItemUnit;
  description: string | null;
  photoUrl: string | null;
  isAvailable: boolean;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

interface RealBakerProfile {
  id: string;
  business: {
    businessName: string | null;
    ownerName: string | null;
    phone: string;
    email: string | null;
    logoUrl: string | null;
    accountVerified: boolean;
  };
  menu: {
    menuSlug: string | null;
    menuSlugEditable: boolean;
    whatsappNumber: string | null;
  };
  verification: {
    fssaiNumber: string | null;
    fssaiVerified: boolean;
    fssaiDocumentUrl: string | null;
  };
  payment: {
    upiId: string | null;
    merchantName: string | null;
    defaultCollectionMethod: string;
    dynamicQrEnabled: boolean;
    whatsappReceiptEnabled: boolean;
    defaultAdvancePercentage: number | null;
  };
  subscription: {
    plan: string | null;
    status: string;
    trialEndsOn: string | null;
    trialDaysRemaining: number;
    nextBillingDate: string | null;
  };
}

interface RealCalendarDay {
  date: string;
  totalOrders: number;
  pending: number;
  confirmed: number;
  inProgress: number;
  ready: number;
  delivered: number;
  outstandingBalance: number;
}

interface RealCalendarData {
  view: string;
  startDate: string;
  endDate: string;
  days: RealCalendarDay[];
}

interface RealBillingStatus {
  plan: string | null;
  subscriptionStatus: string;
  trialDaysRemaining: number;
  trialEndDate: string | null;
  nextBillingDate: string | null;
  autoRenew: boolean;
}

interface RealCustomerProfile {
  customerId: string;
  displayId: string;
  name: string;
  phone: string | null;
  address: string | null;
  notes: string | null;
  preferredDeliveryTime: string | null;
  summary: {
    totalOrders: number;
    lifetimeValue: number;
    outstandingBalance: number;
    lastOrderDate: string | null;
  };
  orders: RealCustomerProfileOrder[];
}

// --- INTERFACES ---
interface Expense {
  id: string;
  item: string;
  amount: number;
  date: string;
  category: 'Raw Material' | 'Packaging' | 'Decoration' | 'Equipment';
}

const initialExpenses: Expense[] = [
  { id: 'E-1', item: '5kg Compound Chocolate', amount: 1200, date: 'Oct 24, 2023', category: 'Raw Material' },
  { id: 'E-2', item: 'Whipping Cream (1L)', amount: 650, date: 'Oct 23, 2023', category: 'Raw Material' },
  { id: 'E-3', item: 'Cake Boxes (10 inch) - 25 pcs', amount: 375, date: 'Oct 22, 2023', category: 'Packaging' },
  { id: 'E-4', item: 'Vanilla Essence (100ml)', amount: 180, date: 'Oct 21, 2023', category: 'Raw Material' },
  { id: 'E-5', item: 'Sprinkles & Decorations', amount: 220, date: 'Oct 20, 2023', category: 'Decoration' }
];

export default function Webapp() {
  // --- BASE APP STATE ---
  const [theme, setTheme] = useState<'light' | 'dark'>('light');
  const [step, setStep] = useState<'login' | 'otp' | 'dashboard'>('login');
  const [isCheckingSession, setIsCheckingSession] = useState(true);

  // Real dashboard data (GET /api/dashboard/summary)
  const [dashboardSummary, setDashboardSummary] = useState<DashboardSummary | null>(null);
  const [dashboardLoading, setDashboardLoading] = useState(false);
  const [dashboardError, setDashboardError] = useState<string | null>(null);

  // Email login fields
  const [email, setEmail] = useState('');
  const [otpFields, setOtpFields] = useState(['', '', '', '', '', '']);
  const [otpError, setOtpError] = useState('');
  const [otpTimer, setOtpTimer] = useState(29);
  const [isVerifying, setIsVerifying] = useState(false);

  // Navigation tabs
  // Home, Orders, Customers, Calendar, Supply, Settings, Expenses
  const [activeTab, setActiveTab] = useState<'home' | 'orders' | 'customers' | 'calendar' | 'supply' | 'settings' | 'expenses'>('home');

  // Bottom Sheet/Modal overlays
  const [activeSheet, setActiveSheet] = useState<
    'none' | 'new-order' | 'edit-order' | 'customer-profile' | 'edit-profile' |
    'manage-upi' | 'subscription-autopay' | 'choose-plan' |
    'subscription-status' | 'help-support' | 'legal-policies' |
    'my-menu' | 'add-edit-menu-item' | 'share-menu' | 'supply-catalogue' | 'supply-cart' | 'supply-orders'
  >('none');

  // Business state — bakeryName/ownerName/phoneNumber/upiId/fssaiLicense/
  // defaultAdvance/autoSendReceipts mock state removed; all now sourced
  // from real bakerProfile (GET /api/baker/profile) and upiForm.
  // Marketplace cart badge — real count, derived from the local cart
  // (src/lib/marketplace/client.ts — there is no server-side cart in the
  // wholesale API), refreshed after every add-to-cart.
  const [cart, setCart] = useState<WholesaleCart | null>(null);
  const cartCount = cart?.items.reduce((sum, item) => sum + item.quantity, 0) ?? 0;
  const refreshCart = useCallback(() => {
    return fetchCart().then(setCart);
  }, []);

  // Database records
  const [expenses, setExpenses] = useState<Expense[]>(initialExpenses);

  // Real single-order detail (GET /api/orders/:orderNumber) — shown inside
  // the existing "customer-profile" sheet slot per explicit decision not to
  // add a new screen. Distinct from the real per-customer profile+order-
  // history data (wired next, for the Customers screen) since the two
  // backend endpoints return genuinely different shapes.
  const [selectedOrderDetail, setSelectedOrderDetail] = useState<any | null>(null);
  const [orderDetailLoading, setOrderDetailLoading] = useState(false);
  const [orderDetailError, setOrderDetailError] = useState<string | null>(null);

  // Branded receipt-image share (Order Detail screen) — two sequential
  // backend calls (caption text via the existing /notifications/whatsapp
  // endpoint keyed by the order's UUID `id`, then the branded PNG via the
  // new /receipt-image endpoint keyed by the display `orderId`) followed
  // by a fetch of the resulting signed image URL. navigator.share's file
  // support is device/browser-dependent — can only be truly verified on a
  // real phone in real WhatsApp, not in a desktop browser — so this always
  // has a manual download + wa.me fallback for when it's unavailable.
  //
  // navigator.share() must run synchronously inside a live user-gesture —
  // confirmed live (desktop Chrome) that calling it after the two awaited
  // network round-trips above throws "Must be handling a user gesture",
  // because that async work (image generation alone ran ~2.5s) outlasts
  // the browser's activation window. So this is a two-tap flow: the first
  // tap fetches everything and stores it in receiptSharePayload; a second,
  // fresh tap calls navigator.share() with no awaits before it.
  const [receiptSharing, setReceiptSharing] = useState(false);
  const [receiptShareError, setReceiptShareError] = useState<string | null>(null);
  const [receiptShareFallback, setReceiptShareFallback] = useState(false);
  const [receiptSharePayload, setReceiptSharePayload] = useState<{ file: File; text: string } | null>(null);

  const openCustomerProfile = useCallback((customerId: string) => {
    setSelectedOrderDetail(null);
    setSelectedCustomerProfile(null);
    setCustomerProfileError(null);
    setActiveSheet('customer-profile');
    setCustomerProfileLoading(true);
    api
      .get<{ success: boolean; data: RealCustomerProfile }>(`/api/customers/${customerId}`)
      .then((res) => setSelectedCustomerProfile(res.data))
      .catch((err: any) => setCustomerProfileError(err.message || 'Failed to load customer profile.'))
      .finally(() => setCustomerProfileLoading(false));
  }, []);

  const openOrderDetail = useCallback((orderNumber: string) => {
    setSelectedOrderDetail(null);
    setSelectedCustomerProfile(null);
    setOrderDetailError(null);
    setReceiptShareError(null);
    setReceiptShareFallback(false);
    setReceiptSharePayload(null);
    setActiveSheet('customer-profile');
    setOrderDetailLoading(true);
    api
      .get<{ success: boolean; data: any }>(`/api/orders/${orderNumber}`)
      .then((res) => setSelectedOrderDetail(res.data))
      .catch((err: any) => setOrderDetailError(err.message || 'Failed to load order details.'))
      .finally(() => setOrderDetailLoading(false));
  }, []);

  const prepareReceiptShare = useCallback(async (order: { id: string; orderId: string }) => {
    setReceiptShareError(null);
    setReceiptShareFallback(false);
    setReceiptSharePayload(null);
    setReceiptSharing(true);
    try {
      const notifRes = await api.post<{ success: boolean; data: { whatsappUrl: string } }>(
        '/api/notifications/whatsapp',
        { orderId: order.id, template: 'RECEIPT' }
      );
      const text = new URL(notifRes.data.whatsappUrl).searchParams.get('text') || '';

      const imageRes = await api.post<{ success: boolean; data: { imageUrl: string } }>(
        `/api/orders/${order.orderId}/receipt-image`,
        {}
      );

      const imgRes = await fetch(imageRes.data.imageUrl);
      if (!imgRes.ok) throw new Error('Could not download the receipt image. Please try again.');
      const blob = await imgRes.blob();
      const file = new File([blob], `receipt-${order.orderId}.png`, { type: 'image/png' });

      if (typeof navigator.canShare === 'function' && navigator.canShare({ files: [file] })) {
        // Can't call navigator.share() here — see the comment on
        // receiptSharePayload above. Stash the prepared file/text; the
        // "Tap to Send via WhatsApp" button's own click handler calls
        // navigator.share() synchronously with no awaits before it.
        setReceiptSharePayload({ file, text });
      } else {
        const downloadUrl = URL.createObjectURL(file);
        const a = document.createElement('a');
        a.href = downloadUrl;
        a.download = file.name;
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(downloadUrl);
        window.open(notifRes.data.whatsappUrl, '_blank');
        setReceiptShareFallback(true);
      }
    } catch (err: any) {
      if (err?.errorCode === 'WHATSAPP_RECEIPT_DISABLED') {
        setReceiptShareError('WhatsApp receipts are turned off for your account.');
      } else {
        setReceiptShareError(err.message || 'Could not share the receipt. Please try again.');
      }
    } finally {
      setReceiptSharing(false);
    }
  }, []);

  const confirmReceiptShare = useCallback(() => {
    if (!receiptSharePayload) return;
    const { file, text } = receiptSharePayload;
    navigator
      .share({ files: [file], text })
      .then(() => setReceiptSharePayload(null))
      .catch((err: any) => {
        // The user dismissing the native share sheet themselves throws
        // AbortError — not a real failure. Keep the prepared payload so
        // they can just tap "Tap to Send" again without re-fetching.
        if (err?.name !== 'AbortError') {
          setReceiptShareError(err.message || 'Could not share the receipt. Please try again.');
        }
      });
  }, [receiptSharePayload]);

  // Payment-reminder quick action (POST /api/notifications/whatsapp,
  // template: 'PAYMENT_REMINDER') — keyed by orderId so multiple cards can
  // be in-flight/erroring independently. On success, opens the returned
  // whatsappUrl the same way every other WhatsApp deep link in this app is
  // opened (window.open(..., '_blank')).
  const [sendingReminderId, setSendingReminderId] = useState<string | null>(null);
  const [reminderErrors, setReminderErrors] = useState<Record<string, string>>({});

  const sendPaymentReminder = useCallback((orderId: string) => {
    setReminderErrors((prev) => {
      if (!(orderId in prev)) return prev;
      const next = { ...prev };
      delete next[orderId];
      return next;
    });
    setSendingReminderId(orderId);
    api
      .post<{ success: boolean; data: { whatsappUrl: string } }>('/api/notifications/whatsapp', {
        orderId,
        template: 'PAYMENT_REMINDER',
      })
      .then((res) => {
        window.open(res.data.whatsappUrl, '_blank');
      })
      .catch((err: any) => {
        setReminderErrors((prev) => ({ ...prev, [orderId]: err.message || 'Could not send reminder. Please try again.' }));
      })
      .finally(() => setSendingReminderId(null));
  }, []);

  // New Order Form state — real POST /api/orders payload shape:
  // customer{name,phone,address}, cake{category,flavour,weightInPounds,
  // quantity}, occasion, delivery{type,date,time,charge},
  // payment{totalPrice,advancePaid,paymentMethod,forceConfirm}. Weight is
  // always in pounds (weightInPounds on the backend) — a lb preset or a
  // free custom numeric entry, never kg/g.
  const WEIGHT_PRESETS_LB = ['0.5', '1', '2', '3'] as const;
  const CAKE_CATEGORIES = [
    'Chocolate Truffle', 'Red Velvet', 'Butterscotch', 'Black Forest', 'Pineapple', 'Vanilla',
    'Fresh Fruit', 'Rainbow', 'Photo Cake', 'Cheesecake', 'Fondant', 'Designer',
  ];
  const CAKE_FLAVOURS = [
    'Chocolate', 'Vanilla', 'Butterscotch', 'Red Velvet', 'Pineapple', 'Mango', 'Strawberry',
    'Coffee', 'Black Forest', 'Nutella', 'Blueberry', 'Caramel',
  ];
  const PAYMENT_METHODS = ['CASH', 'UPI', 'CARD', 'BANK_TRANSFER'] as const;

  function getDefaultNewOrderForm() {
    return {
      customerName: '',
      phone: '',
      address: '',
      cakeCategory: 'Chocolate Truffle',
      flavour: 'Chocolate',
      weightPreset: '1' as (typeof WEIGHT_PRESETS_LB)[number] | 'custom',
      weightCustom: '',
      quantity: '',
      occasion: '',
      deliveryType: 'Pickup' as 'Pickup' | 'Delivery',
      date: new Date().toISOString().slice(0, 10),
      time: '',
      deliveryCharge: '',
      totalAmount: '',
      advanceAmount: '',
      paymentMethod: 'CASH' as (typeof PAYMENT_METHODS)[number],
    };
  }

  function getDefaultMenuItemForm() {
    return {
      name: '',
      category: '',
      price: '',
      unit: 'per_piece' as MenuItemUnit,
      description: '',
      photoPath: '', // staged storage path from the signed-upload flow, empty until a new photo is chosen
      photoPreviewUrl: '', // existing item's photoUrl (edit mode) or a local object URL for a freshly-chosen file
    };
  }

  const [newOrderForm, setNewOrderForm] = useState(getDefaultNewOrderForm());
  const [newOrderSubmitting, setNewOrderSubmitting] = useState(false);
  const [newOrderError, setNewOrderError] = useState<string | null>(null);
  // Tracks whether the baker has manually typed an advance amount, so the
  // defaultAdvancePercentage-based suggestion (below) only pre-fills the
  // field and never clobbers a value the baker deliberately entered.
  const [newOrderAdvanceTouched, setNewOrderAdvanceTouched] = useState(false);

  // Edit Order form — reuses the New Order Form's field shape/UI, pre-filled
  // from the currently open Order Detail (GET /api/orders/:orderNumber)
  // instead of blank. PUT /api/orders/:orderNumber's UpdateOrderBodySchema
  // is NOT identical to CreateOrderPayloadSchema: notably `customer.phone`
  // requires a strict 10-digit Indian mobile format on update (Create only
  // requires a non-empty string), and Update has no paymentMethod/
  // forceConfirm fields at all — so the "Advance Collected Via" selector
  // from New Order is intentionally omitted here rather than kept as a
  // control that would silently do nothing. referencePhotoUrl/internalNotes/
  // customInstructions/customFields aren't exposed by the New Order Form's
  // fields either, but PUT is a full-replacement — these are carried
  // forward unchanged from the loaded order rather than wiped.
  const [editOrderForm, setEditOrderForm] = useState(getDefaultNewOrderForm());
  const [editOrderNumber, setEditOrderNumber] = useState<string | null>(null);
  const [editOrderPassthrough, setEditOrderPassthrough] = useState<{
    referencePhotoUrl: string | null;
    internalNotes: string;
    customInstructions: string;
    customFields: { label: string; value: string }[];
  }>({ referencePhotoUrl: null, internalNotes: '', customInstructions: '', customFields: [] });
  const [editOrderSubmitting, setEditOrderSubmitting] = useState(false);
  const [editOrderError, setEditOrderError] = useState<string | null>(null);

  const openEditOrder = useCallback(() => {
    const d = selectedOrderDetail;
    if (!d) return;
    const weight = d.cake.weightInPounds;
    const weightStr = weight !== null && weight !== undefined ? String(weight) : '';
    const matchesPreset = (WEIGHT_PRESETS_LB as readonly string[]).includes(weightStr);
    setEditOrderForm({
      customerName: d.customer.name || '',
      phone: d.customer.phone || '',
      address: d.customer.address || '',
      cakeCategory: d.cake.category || CAKE_CATEGORIES[0],
      flavour: d.cake.flavour || CAKE_FLAVOURS[0],
      weightPreset: matchesPreset ? (weightStr as (typeof WEIGHT_PRESETS_LB)[number]) : 'custom',
      weightCustom: matchesPreset ? '' : weightStr,
      quantity: d.cake.quantity !== null && d.cake.quantity !== undefined ? String(d.cake.quantity) : '',
      occasion: d.occasion || '',
      deliveryType: d.delivery.type === 'delivery' ? 'Delivery' : 'Pickup',
      date: d.delivery.date || new Date().toISOString().slice(0, 10),
      time: d.delivery.time || '',
      deliveryCharge: d.delivery.charge ? String(d.delivery.charge) : '',
      totalAmount: d.payment.totalPrice != null ? String(d.payment.totalPrice) : '',
      advanceAmount: d.payment.advancePaid != null ? String(d.payment.advancePaid) : '',
      paymentMethod: 'CASH',
    });
    setEditOrderNumber(d.orderId);
    setEditOrderPassthrough({
      referencePhotoUrl: d.referencePhotoUrl ?? null,
      internalNotes: d.internalNotes ?? '',
      customInstructions: d.customInstructions ?? '',
      customFields: d.customFields ?? [],
    });
    setEditOrderError(null);
    setActiveSheet('edit-order');
  }, [selectedOrderDetail, CAKE_CATEGORIES, CAKE_FLAVOURS, WEIGHT_PRESETS_LB]);

  const handleUpdateOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    setEditOrderError(null);

    if (!editOrderNumber) return;

    if (!editOrderForm.customerName.trim()) {
      setEditOrderError('Customer name is required.');
      return;
    }
    const trimmedPhone = editOrderForm.phone.trim();
    // UpdateOrderBodySchema requires customer.phone to match
    // /^[6-9]\d{9}$/ when present — stricter than Create's plain
    // non-empty-string check, so this can't reuse handleCreateOrder's
    // validation as-is.
    if (trimmedPhone && !/^[6-9]\d{9}$/.test(trimmedPhone)) {
      setEditOrderError('Phone number must be a valid 10-digit Indian mobile number (e.g. 9876543210).');
      return;
    }
    const total = parseFloat(editOrderForm.totalAmount);
    if (!total || total <= 0) {
      setEditOrderError('Total amount must be greater than ₹0.');
      return;
    }
    const advance = parseFloat(editOrderForm.advanceAmount || '0');
    if (advance > total) {
      setEditOrderError('Advance received cannot exceed the total amount.');
      return;
    }
    if (!editOrderForm.date) {
      setEditOrderError('Delivery date is required.');
      return;
    }

    let weightInPounds: number | undefined;
    if (editOrderForm.weightPreset === 'custom') {
      const w = parseFloat(editOrderForm.weightCustom);
      if (!w || w <= 0) {
        setEditOrderError('Enter a valid custom weight in pounds.');
        return;
      }
      weightInPounds = w;
    } else {
      weightInPounds = parseFloat(editOrderForm.weightPreset);
    }

    setEditOrderSubmitting(true);
    try {
      await api.put<{ success: boolean; data: { balanceDue: number; paymentStatus: string } }>(
        `/api/orders/${editOrderNumber}`,
        {
          customer: {
            name: editOrderForm.customerName.trim(),
            phone: trimmedPhone || null,
            address: editOrderForm.address.trim() || undefined,
          },
          cake: {
            category: editOrderForm.cakeCategory,
            flavour: editOrderForm.flavour,
            weightInPounds,
            quantity: editOrderForm.quantity ? Number(editOrderForm.quantity) : undefined,
          },
          occasion: editOrderForm.occasion.trim() || undefined,
          customInstructions: editOrderPassthrough.customInstructions || undefined,
          delivery: {
            type: editOrderForm.deliveryType === 'Delivery' ? 'delivery' : 'pickup',
            date: editOrderForm.date,
            time: editOrderForm.time || undefined,
            charge:
              editOrderForm.deliveryType === 'Delivery' && editOrderForm.deliveryCharge
                ? Number(editOrderForm.deliveryCharge)
                : undefined,
          },
          payment: {
            totalPrice: total,
            advancePaid: advance,
          },
          referencePhotoUrl: editOrderPassthrough.referencePhotoUrl,
          internalNotes: editOrderPassthrough.internalNotes || undefined,
          customFields: editOrderPassthrough.customFields.length > 0 ? editOrderPassthrough.customFields : undefined,
        },
      );

      // Refresh every screen that reads this order's data — mirrors
      // handleCreateOrder's explicit refresh of both the dashboard and
      // orders list (rather than only the screen the sheet was opened
      // from), the same pattern used to fix Share My Menu's staleness bug.
      // openOrderDetail re-fetches the full detail (the PUT response only
      // returns a partial shape) and re-opens the sheet with fresh data.
      fetchDashboardSummary();
      fetchOrdersList();
      openOrderDetail(editOrderNumber);
    } catch (err: any) {
      setEditOrderError(err.message || 'Failed to update order.');
    } finally {
      setEditOrderSubmitting(false);
    }
  };

  // Expense form state
  // Real investment/expense-ledger form fields — shape genuinely differs
  // from the mock (quantity x pricePerUnit -> server-computed totalCost,
  // not a flat "amount"; real category vocab; purchaseDate is required by
  // the API and wasn't in the mock form at all).
  const [expenseForm, setExpenseForm] = useState({
    materialName: '',
    category: 'ingredients' as RealInvestmentCategory,
    quantity: '',
    unit: '',
    pricePerUnit: '',
    purchaseDate: new Date().toISOString().slice(0, 10),
    supplierName: '',
  });
  const [investmentsList, setInvestmentsList] = useState<RealInvestmentEntry[]>([]);
  const [investmentsPagination, setInvestmentsPagination] = useState<OrdersPagination | null>(null);
  const [investmentsPage, setInvestmentsPage] = useState(1);
  const [investmentsLoading, setInvestmentsLoading] = useState(false);
  const [investmentsError, setInvestmentsError] = useState<string | null>(null);
  const [monthlySpend, setMonthlySpend] = useState<number | null>(null);
  const [logExpenseSubmitting, setLogExpenseSubmitting] = useState(false);
  const [logExpenseError, setLogExpenseError] = useState<string | null>(null);

  // Real menu items (GET /api/menu-items) — backs the "My Menu" sheet.
  const [menuItemsList, setMenuItemsList] = useState<RealMenuItem[]>([]);
  const [menuItemsLoading, setMenuItemsLoading] = useState(false);
  const [menuItemsError, setMenuItemsError] = useState<string | null>(null);
  const [menuItemReordering, setMenuItemReordering] = useState(false);
  const [menuItemDeletingId, setMenuItemDeletingId] = useState<string | null>(null);

  // Add/Edit Menu Item form (activeSheet 'add-edit-menu-item')
  const [menuItemFormMode, setMenuItemFormMode] = useState<'add' | 'edit'>('add');
  const [editingMenuItemId, setEditingMenuItemId] = useState<string | null>(null);
  const [menuItemForm, setMenuItemForm] = useState(getDefaultMenuItemForm());
  const [menuItemFormError, setMenuItemFormError] = useState<string | null>(null);
  const [menuItemSubmitting, setMenuItemSubmitting] = useState(false);
  const [menuItemPhotoUploading, setMenuItemPhotoUploading] = useState(false);
  const [menuItemPhotoUploadError, setMenuItemPhotoUploadError] = useState<string | null>(null);

  // Share My Menu panel (activeSheet 'share-menu')
  const [menuLinkCopied, setMenuLinkCopied] = useState(false);
  const [menuSlugEditing, setMenuSlugEditing] = useState(false);
  const [menuSlugInput, setMenuSlugInput] = useState('');
  const [menuSlugSubmitting, setMenuSlugSubmitting] = useState(false);
  const [menuSlugError, setMenuSlugError] = useState<string | null>(null);

  // Real baker profile (GET /api/baker/profile) — backs Settings tab,
  // Edit Profile & Legal, Manage UPI, and pre-fills the UPI form.
  const [bakerProfile, setBakerProfile] = useState<RealBakerProfile | null>(null);
  const [bakerProfileLoading, setBakerProfileLoading] = useState(false);
  const [bakerProfileError, setBakerProfileError] = useState<string | null>(null);

  // Real UPI settings form (PUT /api/baker/upi-settings) — the only
  // profile field that actually has a write endpoint.
  const [upiForm, setUpiForm] = useState({ upiId: '', merchantName: '', defaultCollectionMethod: 'UPI', generateDynamicQR: true });
  const [upiSubmitting, setUpiSubmitting] = useState(false);
  const [upiError, setUpiError] = useState<string | null>(null);
  const [upiSuccess, setUpiSuccess] = useState(false);

  // Real profile edit form (PATCH /api/baker/profile) — owner name, phone,
  // and default advance percentage. Profile picture goes through the
  // separate existing upload flow (POST /api/uploads/signed-url + confirm).
  const [editProfileForm, setEditProfileForm] = useState({ ownerName: '', phone: '', defaultAdvancePercentage: '' });
  const [editProfileSubmitting, setEditProfileSubmitting] = useState(false);
  const [editProfileError, setEditProfileError] = useState<string | null>(null);
  const [editProfileSuccess, setEditProfileSuccess] = useState(false);
  const [logoUploading, setLogoUploading] = useState(false);
  const [logoUploadError, setLogoUploadError] = useState<string | null>(null);

  // Real billing status (GET /api/billing/status)
  const [billingStatus, setBillingStatus] = useState<RealBillingStatus | null>(null);
  const [billingLoading, setBillingLoading] = useState(false);
  const [billingError, setBillingError] = useState<string | null>(null);
  const [subscriptionSubmitting, setSubscriptionSubmitting] = useState(false);
  const [subscriptionError, setSubscriptionError] = useState<string | null>(null);

  // POST /api/billing/create-subscription — a real Razorpay subscription
  // creation call. This environment's RAZORPAY_KEY_ID is a LIVE key
  // (rzp_live_...), not a test key, so this was wired but deliberately
  // NOT click-tested during verification — see the report for why.
  const handleConfirmSubscription = async () => {
    setSubscriptionSubmitting(true);
    setSubscriptionError(null);
    try {
      await api.post('/api/billing/create-subscription', { plan: 'EARLY_ADOPTER' });
      setActiveSheet('none');
      fetchBillingStatus();
    } catch (err: any) {
      setSubscriptionError(err.message || 'Failed to start subscription.');
    } finally {
      setSubscriptionSubmitting(false);
    }
  };

  // Search and filters
  const [orderSearch, setOrderSearch] = useState('');
  const [orderTab, setOrderTab] = useState<RealOrderTab>('All');
  const [ordersList, setOrdersList] = useState<RealOrderListItem[]>([]);
  const [ordersPagination, setOrdersPagination] = useState<OrdersPagination | null>(null);
  const [ordersPage, setOrdersPage] = useState(1);
  const [ordersLoading, setOrdersLoading] = useState(false);
  const [ordersError, setOrdersError] = useState<string | null>(null);
  const [customerSearch, setCustomerSearch] = useState('');
  const [customerSort, setCustomerSort] = useState('Highest Spend (LTV)');
  const [customersList, setCustomersList] = useState<RealCustomerListItem[]>([]);
  const [customersPagination, setCustomersPagination] = useState<OrdersPagination | null>(null);
  const [customersPage, setCustomersPage] = useState(1);
  const [customersLoading, setCustomersLoading] = useState(false);
  const [customersError, setCustomersError] = useState<string | null>(null);

  const [selectedCustomerProfile, setSelectedCustomerProfile] = useState<RealCustomerProfile | null>(null);
  const [customerProfileLoading, setCustomerProfileLoading] = useState(false);
  const [customerProfileError, setCustomerProfileError] = useState<string | null>(null);
  // Supply Hub: supplier discovery (Screen 1). Reads through
  // src/lib/marketplace/client.ts, which calls the real wholesale API
  // via src/app/api/marketplace/* proxy routes.
  const [wholesalers, setWholesalers] = useState<Wholesaler[]>([]);
  const [wholesalersLoading, setWholesalersLoading] = useState(false);
  const [wholesalersError, setWholesalersError] = useState<string | null>(null);
  const [supplySearch, setSupplySearch] = useState('');
  // Device geolocation, passed to GET /wholesalers for server-side
  // nearest-first sort. Both null if permission is denied/unavailable —
  // the endpoint degrades gracefully to default order in that case, so
  // there's no error state here, just an absence.
  const [bakerLocation, setBakerLocation] = useState<{ lat: number; lng: number } | null>(null);
  // Set when a baker taps "View Catalogue"; opens the 'supply-catalogue' sheet.
  const [selectedWholesalerId, setSelectedWholesalerId] = useState<string | null>(null);

  useEffect(() => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      (position) => setBakerLocation({ lat: position.coords.latitude, lng: position.coords.longitude }),
      () => setBakerLocation(null),
      { timeout: 8000 }
    );
  }, []);

  const fetchSupplyWholesalers = useCallback(() => {
    setWholesalersLoading(true);
    setWholesalersError(null);
    fetchWholesalers(bakerLocation ? { lat: bakerLocation.lat, lng: bakerLocation.lng } : undefined)
      .then(setWholesalers)
      .catch((err: any) => setWholesalersError(err.message || 'Failed to load suppliers.'))
      .finally(() => setWholesalersLoading(false));
  }, [bakerLocation]);

  // Supply Hub: supplier catalogue (Screen 2), rendered in the
  // 'supply-catalogue' sheet, scoped to selectedWholesalerId. search/
  // category/sort/inStockOnly are sent to the API as query params (the
  // API filters/sorts server-side) rather than filtered client-side.
  const [catalogueProducts, setCatalogueProducts] = useState<WholesaleProduct[]>([]);
  // Unfiltered baseline, fetched once per wholesaler-open, used only to
  // derive the full set of category chips (see catalogueCategories) -
  // catalogueProducts itself is already server-filtered and would lose
  // categories as soon as one is selected.
  const [catalogueAllProducts, setCatalogueAllProducts] = useState<WholesaleProduct[]>([]);
  const [catalogueLoading, setCatalogueLoading] = useState(false);
  const [catalogueError, setCatalogueError] = useState<string | null>(null);
  const [catalogueSearch, setCatalogueSearch] = useState('');
  const [catalogueCategory, setCatalogueCategory] = useState<string>('All');
  // Only ascending-by-price sort exists server-side (no descending, no
  // "top rated" — see bakery-api-reference.md endpoint 2).
  const [catalogueSort, setCatalogueSort] = useState<'Recommended' | 'Price: Low to High'>('Recommended');
  const [catalogueInStockOnly, setCatalogueInStockOnly] = useState(false);
  // Per-card add-to-cart feedback, independent of useAddToCart's single
  // isAdding flag, so only the tapped card shows a spinner/checkmark.
  const [addingProductId, setAddingProductId] = useState<string | null>(null);
  const [justAddedProductId, setJustAddedProductId] = useState<string | null>(null);
  const { addToCart: addProductToCart, reorder: reorderFromOrder } = useAddToCart();

  const fetchSupplyCatalogue = useCallback(() => {
    if (!selectedWholesalerId) return;
    setCatalogueLoading(true);
    setCatalogueError(null);
    fetchCatalogue(selectedWholesalerId, {
      search: catalogueSearch.trim() || undefined,
      category: catalogueCategory !== 'All' ? catalogueCategory : undefined,
      sort: catalogueSort === 'Price: Low to High' ? 'price' : undefined,
      inStockOnly: catalogueInStockOnly,
    })
      .then(setCatalogueProducts)
      .catch((err: any) => setCatalogueError(err.message || 'Failed to load catalogue.'))
      .finally(() => setCatalogueLoading(false));
  }, [selectedWholesalerId, catalogueSearch, catalogueCategory, catalogueSort, catalogueInStockOnly]);

  useEffect(() => {
    if (activeSheet !== 'supply-catalogue' || !selectedWholesalerId) return;
    const handle = setTimeout(fetchSupplyCatalogue, catalogueSearch ? 300 : 0);
    return () => clearTimeout(handle);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeSheet, selectedWholesalerId, catalogueSearch, catalogueCategory, catalogueSort, catalogueInStockOnly]);

  // Reset per-open, so a previous wholesaler's search/filters don't leak in.
  // Also fetches the unfiltered category baseline once here.
  useEffect(() => {
    if (activeSheet === 'supply-catalogue' && selectedWholesalerId) {
      setCatalogueSearch('');
      setCatalogueCategory('All');
      setCatalogueSort('Recommended');
      setCatalogueInStockOnly(false);
      setSelectedProductId(null);
      fetchCatalogue(selectedWholesalerId).then(setCatalogueAllProducts).catch(() => setCatalogueAllProducts([]));
    }
  }, [activeSheet, selectedWholesalerId]);

  // Supply Hub: product detail (Screen 3), a sub-view within the same
  // 'supply-catalogue' sheet rather than its own activeSheet - non-null
  // selectedProductId shows it in place of the catalogue list, with the
  // header's close button stepping back to the list instead of exiting
  // the sheet. Keeps everything inside one bottom-sheet container instead
  // of stacking a second sheet on top, which nothing else in this app does.
  const [selectedProductId, setSelectedProductId] = useState<string | null>(null);
  const [selectedVariantId, setSelectedVariantId] = useState<string | null>(null);
  const [productDetailQuantity, setProductDetailQuantity] = useState(1);
  const [productDetailAdded, setProductDetailAdded] = useState(false);
  const [selectedProductPolicies, setSelectedProductPolicies] = useState<WholesalerPolicies | null>(null);
  const [selectedProductPoliciesLoading, setSelectedProductPoliciesLoading] = useState(false);

  // Reset the size selection + quantity stepper whenever a different
  // product is opened, defaulting to its cheapest variant (if any), and
  // fetch that wholesaler's policies for the delivery/bulk-notice boxes.
  useEffect(() => {
    if (!selectedProductId) return;
    const product = catalogueProducts.find((p) => p.id === selectedProductId);
    setSelectedVariantId(product ? getDefaultVariant(product)?.id ?? null : null);
    setProductDetailQuantity(1);
    setProductDetailAdded(false);

    if (product) {
      setSelectedProductPoliciesLoading(true);
      fetchPolicies(product.wholesalerId)
        .then(setSelectedProductPolicies)
        .catch(() => setSelectedProductPolicies(null))
        .finally(() => setSelectedProductPoliciesLoading(false));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedProductId]);

  // Supply Hub: cart (Screen 4), its own top-level sheet since it's
  // opened from the tab header's cart icon, not nested inside a
  // wholesaler's catalogue like product detail is.
  const [cartUpdatingKey, setCartUpdatingKey] = useState<string | null>(null);
  const [cartPolicies, setCartPolicies] = useState<WholesalerPolicies | null>(null);
  const [cartPoliciesLoading, setCartPoliciesLoading] = useState(false);

  const handleCartQuantityChange = async (productId: string, variantId: string | null, quantity: number) => {
    const key = `${productId}:${variantId ?? ''}`;
    setCartUpdatingKey(key);
    await updateCartItemQuantity(productId, variantId, quantity);
    await refreshCart();
    setCartUpdatingKey(null);
  };

  const handleCartRemoveItem = async (productId: string, variantId: string | null) => {
    const key = `${productId}:${variantId ?? ''}`;
    setCartUpdatingKey(key);
    await removeCartItem(productId, variantId);
    await refreshCart();
    setCartUpdatingKey(null);
  };

  // Policies (min order amount, delivery charge) are wholesaler-specific
  // and not part of the cart itself - fetch whenever the cart sheet opens
  // with items in it, or the cart's wholesaler changes (e.g. after a
  // forced switch).
  useEffect(() => {
    if (activeSheet !== 'supply-cart' || !cart?.wholesalerId) {
      setCartPolicies(null);
      return;
    }
    setCartPoliciesLoading(true);
    fetchPolicies(cart.wholesalerId)
      .then(setCartPolicies)
      .catch(() => setCartPolicies(null))
      .finally(() => setCartPoliciesLoading(false));
  }, [activeSheet, cart?.wholesalerId]);

  // Supply Hub: checkout (Screen 5), a sub-view within the 'supply-cart'
  // sheet - same technique as product detail nesting inside the
  // catalogue sheet, for the same reason: "back" from checkout should
  // return to reviewing the cart, not exit the whole flow. A third
  // sub-view (placedOrder set) shows a minimal order-placed confirmation,
  // since there's no dedicated Order Confirmation/Orders-list screen for
  // the baker to otherwise see that their order went through.
  const [showCheckout, setShowCheckout] = useState(false);
  const [checkoutFulfillment, setCheckoutFulfillment] = useState<'Delivery' | 'Pickup'>('Delivery');
  const [checkoutAddress, setCheckoutAddress] = useState('');
  const [checkoutInstructions, setCheckoutInstructions] = useState('');
  const [checkoutSubmitting, setCheckoutSubmitting] = useState(false);
  const [checkoutError, setCheckoutError] = useState<string | null>(null);
  const [placedOrder, setPlacedOrder] = useState<PlaceOrderResponse | null>(null);
  // POST /orders' response has no wholesaler name/fulfilment/delivery-eta
  // fields (see bakery-api-reference.md endpoint 4) - captured here from
  // what's already in scope right before the cart clears, rather than
  // invented after the fact.
  const [placedOrderContext, setPlacedOrderContext] = useState<{
    wholesalerName: string;
    expectedDeliveryTime: string;
    fulfilmentMode: FulfilmentMode;
  } | null>(null);

  const handlePlaceOrder = async () => {
    if (!cart || !cart.wholesalerId || !bakerProfile) return;
    if (checkoutFulfillment === 'Delivery' && !checkoutAddress.trim()) {
      setCheckoutError('Enter a delivery address.');
      return;
    }
    setCheckoutSubmitting(true);
    setCheckoutError(null);
    try {
      const order = await placeOrder({
        wholesalerId: cart.wholesalerId,
        bakerId: bakerProfile.id,
        buyerName: bakerProfile.business.businessName || bakerProfile.business.ownerName || 'Baker',
        buyerContact: bakerProfile.business.phone || undefined,
        fulfilmentMode: checkoutFulfillment === 'Delivery' ? 'DELIVERY' : 'PICKUP',
        notes:
          checkoutInstructions.trim() ||
          (checkoutFulfillment === 'Delivery' ? checkoutAddress.trim() : undefined) ||
          undefined,
        items: cart.items.map((item) => ({
          productId: item.product.id,
          variantId: item.variant?.id,
          quantity: item.quantity,
        })),
      });
      setPlacedOrderContext({
        wholesalerName: cartWholesaler?.businessName ?? 'the wholesaler',
        expectedDeliveryTime: cartWholesaler?.expectedDeliveryTime ?? 'To be confirmed',
        fulfilmentMode: checkoutFulfillment === 'Delivery' ? 'DELIVERY' : 'PICKUP',
      });
      setPlacedOrder(order);
      refreshCart();
    } catch (err: any) {
      setCheckoutError(err.message || 'Could not place order.');
    } finally {
      setCheckoutSubmitting(false);
    }
  };


  const resetCheckoutState = () => {
    setShowCheckout(false);
    setCheckoutAddress('');
    setCheckoutInstructions('');
    setCheckoutError(null);
    setPlacedOrder(null);
    setPlacedOrderContext(null);
    setCheckoutFulfillment('Delivery');
  };

  const closeCartSheet = () => {
    resetCheckoutState();
    setCartUnavailableNotice(null);
    setActiveSheet('none');
  };

  // Supply Hub: orders list (Screen 7). Global across wholesalers - a
  // top-level sheet like Cart, reached from the Supply Hub header and
  // from "View Order" on the order-success screen. Deliberately titled
  // "My Wholesale Orders" rather than "Orders" to avoid colliding with
  // the app's existing Orders tab, which is a different domain entirely
  // (the baker's own customer sales orders, not purchases from wholesalers).
  const [supplyOrders, setSupplyOrders] = useState<BakerOrderListItem[]>([]);
  const [supplyOrdersLoading, setSupplyOrdersLoading] = useState(false);
  const [supplyOrdersError, setSupplyOrdersError] = useState<string | null>(null);
  const [supplyOrdersTab, setSupplyOrdersTab] = useState<'All' | 'Active' | 'Cancelled'>('All');
  // Order Detail (Screen 8) - a sub-view within this same sheet, same
  // reasoning as product-detail-in-catalogue and checkout-in-cart: "back"
  // should return to the order list, not exit the whole sheet.
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
  const [selectedOrderStatus, setSelectedOrderStatus] = useState<OrderStatusResponse | null>(null);
  const [selectedOrderStatusLoading, setSelectedOrderStatusLoading] = useState(false);
  const [selectedOrderStatusError, setSelectedOrderStatusError] = useState<string | null>(null);

  const fetchSupplyOrders = useCallback(() => {
    if (!bakerProfile) return;
    setSupplyOrdersLoading(true);
    setSupplyOrdersError(null);
    fetchBakerOrders(bakerProfile.id)
      .then(setSupplyOrders)
      .catch((err: any) => setSupplyOrdersError(err.message || 'Failed to load orders.'))
      .finally(() => setSupplyOrdersLoading(false));
  }, [bakerProfile]);

  useEffect(() => {
    if (activeSheet === 'supply-orders') {
      fetchSupplyOrders();
      setSelectedOrderId(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeSheet]);

  const fetchSelectedOrderStatus = useCallback(() => {
    if (!selectedOrderId) return;
    setSelectedOrderStatusLoading(true);
    setSelectedOrderStatusError(null);
    fetchOrderStatus(selectedOrderId)
      .then(setSelectedOrderStatus)
      .catch((err: any) => setSelectedOrderStatusError(err.message || 'Failed to load order status.'))
      .finally(() => setSelectedOrderStatusLoading(false));
  }, [selectedOrderId]);

  useEffect(() => {
    if (selectedOrderId) fetchSelectedOrderStatus();
    else setSelectedOrderStatus(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedOrderId]);

  // Policies aren't part of any order response - fetched here only for
  // real pickupLocation text on Pickup orders, using the wholesalerId
  // already available from the orders list.
  const [selectedOrderPolicies, setSelectedOrderPolicies] = useState<WholesalerPolicies | null>(null);

  useEffect(() => {
    const wholesalerId = supplyOrders.find((o) => o.id === selectedOrderId)?.wholesalerId;
    if (!wholesalerId) {
      setSelectedOrderPolicies(null);
      return;
    }
    fetchPolicies(wholesalerId).then(setSelectedOrderPolicies).catch(() => setSelectedOrderPolicies(null));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedOrderId]);

  // Reorder (My Orders + Order Detail): rebuilds the cart from a past
  // order's items against the current catalogue via useAddToCart's
  // shared conflict-confirm flow, then always lands on Cart (never
  // Checkout) so the baker reviews current prices/availability before
  // confirming - see reorderItems in client.ts for the matching logic.
  const [reorderingOrderId, setReorderingOrderId] = useState<string | null>(null);
  // Shown on the Cart screen itself, not on the My Orders/Order Detail
  // screen the Reorder button was tapped from - handleReorder navigates
  // straight to Cart on any successful reorder, which would unmount a
  // notice rendered on the originating screen before the baker ever saw
  // it. Cleared on cart close (closeCartSheet) and at the start of every
  // new reorder attempt.
  const [cartUnavailableNotice, setCartUnavailableNotice] = useState<string[] | null>(null);

  const handleReorder = async (orderId: string, wholesalerId: string, items: OrderItem[]) => {
    setReorderingOrderId(orderId);
    setCartUnavailableNotice(null);
    const result = await reorderFromOrder(wholesalerId, items);
    setReorderingOrderId(null);
    if (!result) return;
    refreshCart();
    // Navigate to Cart whenever the reorder actually did something -
    // including the all-unavailable case, so the notice below has
    // somewhere to be seen instead of silently going nowhere.
    setActiveSheet('supply-cart');
    if (result.unavailable.length > 0) {
      setCartUnavailableNotice(result.unavailable);
    }
  };

  // Real calendar data (GET /api/dashboard/calendar). calendarMonth is
  // YYYY-MM; selectedCalendarDate is YYYY-MM-DD, both real ISO forms —
  // replacing the mock's "Jul 26" style labels entirely.
  const todayForCalendar = new Date();
  const [calendarMonth, setCalendarMonth] = useState(
    `${todayForCalendar.getFullYear()}-${String(todayForCalendar.getMonth() + 1).padStart(2, '0')}`,
  );
  const [selectedCalendarDate, setSelectedCalendarDate] = useState(
    todayForCalendar.toISOString().slice(0, 10),
  );
  const [calendarData, setCalendarData] = useState<RealCalendarData | null>(null);
  const [calendarLoading, setCalendarLoading] = useState(false);
  const [calendarError, setCalendarError] = useState<string | null>(null);

  // Whole month's orders (not just the selected date) so the list below
  // the grid can show every date's group at once — clicking a calendar
  // cell scrolls to that date's group via dateGroupRefs instead of
  // re-fetching/re-filtering a single-date list.
  const [calendarMonthOrders, setCalendarMonthOrders] = useState<RealOrderListItem[]>([]);
  const [calendarMonthOrdersLoading, setCalendarMonthOrdersLoading] = useState(false);
  const [calendarMonthOrdersError, setCalendarMonthOrdersError] = useState<string | null>(null);
  const dateGroupRefs = useRef<Record<string, HTMLDivElement | null>>({});

  // Bootstrap: the session lives in an httpOnly cookie the browser already
  // holds after a successful login, so on load we ask the backend whether
  // it's still valid rather than defaulting to the login screen every time.
  useEffect(() => {
    let cancelled = false;
    checkSession().then((isAuthenticated) => {
      if (cancelled) return;
      if (isAuthenticated) {
        setStep('dashboard');
      }
      setIsCheckingSession(false);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  // Fetch real dashboard summary once authenticated
  const fetchDashboardSummary = useCallback(() => {
    setDashboardLoading(true);
    setDashboardError(null);
    api
      .get<{ success: boolean; data: DashboardSummary }>('/api/dashboard/summary')
      .then((res) => setDashboardSummary(res.data))
      .catch((err: any) => setDashboardError(err.message || 'Failed to load dashboard.'))
      .finally(() => setDashboardLoading(false));
  }, []);

  useEffect(() => {
    if (step === 'dashboard') {
      fetchDashboardSummary();
    }
  }, [step, fetchDashboardSummary]);

  // Fetch real orders list. Extracted as a stable callback (not just inline
  // in the effect below) so it can also be called directly right after
  // creating a new order — the tab/page/filter values often won't have
  // changed in that moment, so the effect's own dependencies wouldn't
  // otherwise fire a refetch. "All" omits the status param, which per the
  // real backend contract defaults to excluding Cancelled orders (not
  // literally "every order") — matching the documented endpoint behavior
  // rather than the mock's assumption that "All" means everything.
  const fetchOrdersList = useCallback(() => {
    setOrdersLoading(true);
    setOrdersError(null);

    const params = new URLSearchParams();
    params.set('page', String(ordersPage));
    params.set('limit', '10');
    if (orderTab !== 'All') params.set('status', orderTab);
    if (orderSearch.trim()) params.set('search', orderSearch.trim());

    api
      .get<{ success: boolean; data: { orders: RealOrderListItem[]; pagination: OrdersPagination } }>(
        `/api/orders?${params.toString()}`,
      )
      .then((res) => {
        setOrdersList(res.data.orders);
        setOrdersPagination(res.data.pagination);
      })
      .catch((err: any) => setOrdersError(err.message || 'Failed to load orders.'))
      .finally(() => setOrdersLoading(false));
  }, [ordersPage, orderTab, orderSearch]);

  // Debounced on search, immediate on tab/page changes.
  useEffect(() => {
    if (step !== 'dashboard' || activeTab !== 'orders') return;
    const handle = setTimeout(fetchOrdersList, orderSearch ? 300 : 0);
    return () => clearTimeout(handle);
  }, [step, activeTab, fetchOrdersList]);

  // Reset to page 1 whenever the filter/search changes
  useEffect(() => {
    setOrdersPage(1);
  }, [orderTab, orderSearch]);

  // Fetch real customers list. The "Sort by" control in the mock is
  // display-only (no dropdown wired, never was) — kept that way, but the
  // displayed label ("Highest Spend (LTV)") now matches what's actually
  // requested from the API rather than being purely cosmetic.
  useEffect(() => {
    if (step !== 'dashboard' || activeTab !== 'customers') return;

    const handle = setTimeout(() => {
      setCustomersLoading(true);
      setCustomersError(null);

      const params = new URLSearchParams();
      params.set('page', String(customersPage));
      params.set('limit', '10');
      params.set('sort', 'lifetimeValue');
      params.set('order', 'desc');
      if (customerSearch.trim()) params.set('search', customerSearch.trim());

      api
        .get<{ success: boolean; data: { customers: RealCustomerListItem[]; pagination: OrdersPagination } }>(
          `/api/customers?${params.toString()}`,
        )
        .then((res) => {
          setCustomersList(res.data.customers);
          setCustomersPagination(res.data.pagination);
        })
        .catch((err: any) => setCustomersError(err.message || 'Failed to load customers.'))
        .finally(() => setCustomersLoading(false));
    }, customerSearch ? 300 : 0);

    return () => clearTimeout(handle);
  }, [step, activeTab, customerSearch, customersPage]);

  useEffect(() => {
    setCustomersPage(1);
  }, [customerSearch]);

  // Real investments/expense ledger (GET /api/investments)
  const fetchInvestments = useCallback(() => {
    setInvestmentsLoading(true);
    setInvestmentsError(null);
    const params = new URLSearchParams();
    params.set('page', String(investmentsPage));
    params.set('limit', '10');
    api
      .get<{ success: boolean; data: { entries: RealInvestmentEntry[]; pagination: OrdersPagination } }>(
        `/api/investments?${params.toString()}`,
      )
      .then((res) => {
        setInvestmentsList(res.data.entries);
        setInvestmentsPagination(res.data.pagination);
      })
      .catch((err: any) => setInvestmentsError(err.message || 'Failed to load expenses.'))
      .finally(() => setInvestmentsLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [investmentsPage]);

  // "Spent this Month" — a separate lightweight query scoped to the
  // current calendar month (from/to), since the main list above is
  // intentionally unscoped/paginated across all-time entries.
  const fetchMonthlySpend = useCallback(() => {
    const now = new Date();
    const from = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
    const to = now.toISOString().slice(0, 10);
    api
      .get<{ success: boolean; data: { summary: { totalExpense: number } } }>(
        `/api/investments?from=${from}&to=${to}&limit=1`,
      )
      .then((res) => setMonthlySpend(res.data.summary.totalExpense))
      .catch(() => setMonthlySpend(null));
  }, []);

  useEffect(() => {
    if (step === 'dashboard' && activeTab === 'expenses') {
      fetchInvestments();
      fetchMonthlySpend();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, activeTab, investmentsPage]);

  useEffect(() => {
    if (step === 'dashboard' && activeTab === 'supply') {
      fetchSupplyWholesalers();
      refreshCart();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, activeTab, bakerLocation]);

  // Cycles the sort control on tap — no dropdown/menu component exists
  // elsewhere in this app to reuse, so this stays a single button like
  // the other Supply Hub toolbar controls rather than introducing one.
  // Only two states now: the API has no descending-price or "top rated"
  // sort (see bakery-api-reference.md endpoint 2).
  const cycleCatalogueSort = () => {
    setCatalogueSort((current) => (current === 'Recommended' ? 'Price: Low to High' : 'Recommended'));
  };

  const handleAddProductToCart = async (product: WholesaleProduct) => {
    setAddingProductId(product.id);
    const result = await addProductToCart(product, getDefaultVariant(product), 1);
    setAddingProductId(null);
    if (result) {
      refreshCart();
      setJustAddedProductId(product.id);
      setTimeout(() => setJustAddedProductId((id) => (id === product.id ? null : id)), 1200);
    }
  };

  // Real menu items (GET /api/menu-items) — fetched whenever the "My Menu"
  // sheet opens, same trigger pattern as the Expenses tab above.
  const fetchMenuItems = useCallback(() => {
    setMenuItemsLoading(true);
    setMenuItemsError(null);
    api
      .get<{ success: boolean; data: { items: RealMenuItem[] } }>('/api/menu-items')
      .then((res) => setMenuItemsList(res.data.items))
      .catch((err: any) => setMenuItemsError(err.message || 'Failed to load menu items.'))
      .finally(() => setMenuItemsLoading(false));
  }, []);

  useEffect(() => {
    // Share My Menu's empty-state check depends on live item count (see
    // handleSaveMenuSlug/the share-menu sheet below), so it needs the same
    // fresh-on-open refetch as My Menu itself, not just whichever sheet the
    // baker happened to open first.
    if (step === 'dashboard' && (activeSheet === 'my-menu' || activeSheet === 'share-menu')) {
      fetchMenuItems();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, activeSheet]);

  function openAddMenuItem() {
    setMenuItemFormMode('add');
    setEditingMenuItemId(null);
    setMenuItemForm(getDefaultMenuItemForm());
    setMenuItemFormError(null);
    setMenuItemPhotoUploadError(null);
    setActiveSheet('add-edit-menu-item');
  }

  function openEditMenuItem(item: RealMenuItem) {
    setMenuItemFormMode('edit');
    setEditingMenuItemId(item.id);
    setMenuItemForm({
      name: item.name,
      category: item.category || '',
      price: String(item.price),
      unit: item.unit,
      description: item.description || '',
      photoPath: '',
      photoPreviewUrl: item.photoUrl || '',
    });
    setMenuItemFormError(null);
    setMenuItemPhotoUploadError(null);
    setActiveSheet('add-edit-menu-item');
  }

  // Mirrors handleProfilePictureUpload's signed-upload + direct-PUT flow,
  // but deliberately skips /api/uploads/confirm — MENU_ITEM_PHOTO is
  // confirmed as a side effect of creating/updating the menu item itself
  // (the backend verifies the object exists when photoPath is submitted),
  // unlike BUSINESS_LOGO which writes straight onto the Baker row.
  const handleMenuItemPhotoUpload = async (file: File) => {
    setMenuItemPhotoUploading(true);
    setMenuItemPhotoUploadError(null);
    try {
      const { data } = await api.post<{ success: boolean; data: { uploadUrl: string; filePath: string } }>(
        '/api/uploads/signed-url',
        { contentType: file.type, category: 'MENU_ITEM_PHOTO', originalFilename: file.name },
      );

      const uploadRes = await fetch(data.uploadUrl, {
        method: 'PUT',
        headers: { 'Content-Type': file.type },
        body: file,
      });
      if (!uploadRes.ok) {
        throw new Error('Upload to storage failed. Please try again.');
      }

      setMenuItemForm((f) => ({ ...f, photoPath: data.filePath, photoPreviewUrl: URL.createObjectURL(file) }));
    } catch (err: any) {
      setMenuItemPhotoUploadError(err.message || 'Failed to upload photo.');
    } finally {
      setMenuItemPhotoUploading(false);
    }
  };

  const handleSaveMenuItem = async (e: React.FormEvent) => {
    e.preventDefault();
    setMenuItemFormError(null);

    // Client-side validation mirrors the backend's rules exactly (see
    // menu-items.schemas.ts): name non-empty, price > 0, unit must be a
    // valid option — so errors surface before the API call, not after.
    const name = menuItemForm.name.trim();
    if (!name) {
      setMenuItemFormError('Item name is required.');
      return;
    }
    const price = parseFloat(menuItemForm.price);
    if (!price || price <= 0) {
      setMenuItemFormError('Price must be greater than ₹0.');
      return;
    }
    if (!MENU_ITEM_UNITS.includes(menuItemForm.unit)) {
      setMenuItemFormError('Choose a valid unit.');
      return;
    }

    setMenuItemSubmitting(true);
    try {
      const payload = {
        name,
        category: menuItemForm.category.trim() || undefined,
        price,
        unit: menuItemForm.unit,
        description: menuItemForm.description.trim() || undefined,
        ...(menuItemForm.photoPath ? { photoPath: menuItemForm.photoPath } : {}),
      };

      if (menuItemFormMode === 'edit' && editingMenuItemId) {
        await api.put(`/api/menu-items/${editingMenuItemId}`, payload);
      } else {
        await api.post('/api/menu-items', payload);
      }

      setActiveSheet('none');
      fetchMenuItems();
      // A baker's first-ever item lazily assigns bakerProfile.menu.menuSlug
      // server-side (see ensureMenuSlug in menu-items.service.ts) — refresh
      // the profile too so Share My Menu reflects that immediately instead
      // of only after a full reload, same as handleCreateOrder refreshing
      // both the dashboard and orders list rather than just the screen the
      // sheet happened to be opened from.
      fetchBakerProfile();
    } catch (err: any) {
      setMenuItemFormError(err.message || 'Failed to save menu item.');
    } finally {
      setMenuItemSubmitting(false);
    }
  };

  const handleDeleteMenuItem = async (item: RealMenuItem) => {
    if (!window.confirm(`Delete "${item.name}" from your menu? This can't be undone.`)) return;
    setMenuItemDeletingId(item.id);
    setMenuItemsError(null);
    try {
      await api.delete(`/api/menu-items/${item.id}`);
      setMenuItemsList((list) => list.filter((i) => i.id !== item.id));
    } catch (err: any) {
      setMenuItemsError(err.message || 'Failed to delete item.');
    } finally {
      setMenuItemDeletingId(null);
    }
  };

  const handleToggleMenuItemAvailability = async (item: RealMenuItem) => {
    const nextAvailable = !item.isAvailable;
    setMenuItemsList((list) => list.map((i) => (i.id === item.id ? { ...i, isAvailable: nextAvailable } : i)));
    try {
      await api.put(`/api/menu-items/${item.id}`, { isAvailable: nextAvailable });
    } catch (err: any) {
      setMenuItemsList((list) => list.map((i) => (i.id === item.id ? { ...i, isAvailable: item.isAvailable } : i)));
      setMenuItemsError(err.message || 'Failed to update availability.');
    }
  };

  const handleMoveMenuItem = async (index: number, direction: -1 | 1) => {
    const newIndex = index + direction;
    if (newIndex < 0 || newIndex >= menuItemsList.length) return;

    const reordered = [...menuItemsList];
    [reordered[index], reordered[newIndex]] = [reordered[newIndex], reordered[index]];
    setMenuItemsList(reordered);
    setMenuItemReordering(true);
    setMenuItemsError(null);
    try {
      await api.put('/api/menu-items/reorder', { menuItemIds: reordered.map((i) => i.id) });
    } catch (err: any) {
      setMenuItemsError(err.message || 'Failed to reorder items.');
      fetchMenuItems(); // resync from server on failure
    } finally {
      setMenuItemReordering(false);
    }
  };

  const handleCopyMenuLink = (menuSlug: string) => {
    navigator.clipboard.writeText(`${PUBLIC_MENU_BASE_URL}/m/${menuSlug}`).then(() => {
      setMenuLinkCopied(true);
      setTimeout(() => setMenuLinkCopied(false), 2000);
    });
  };

  const handleSaveMenuSlug = async () => {
    const slug = menuSlugInput.trim();
    if (!slug) {
      setMenuSlugError('Enter a menu link.');
      return;
    }
    // One-time edit per the backend — the UI must be explicit about this
    // before the baker confirms, since it can't be undone from here.
    if (!window.confirm('You can only do this once. Your old link will stop working. Continue?')) {
      return;
    }

    setMenuSlugSubmitting(true);
    setMenuSlugError(null);
    try {
      await api.patch('/api/baker/menu-slug', { menuSlug: slug });
      setMenuSlugEditing(false);
      fetchBakerProfile();
    } catch (err: any) {
      setMenuSlugError(err.message || 'Failed to update menu link.');
    } finally {
      setMenuSlugSubmitting(false);
    }
  };

  // Real baker profile — fetched once entering the app and refetched after
  // any successful UPI-settings save so the Settings tab reflects it.
  const fetchBakerProfile = useCallback(() => {
    setBakerProfileLoading(true);
    setBakerProfileError(null);
    api
      .get<{ success: boolean; data: RealBakerProfile }>('/api/baker/profile')
      .then((res) => {
        setBakerProfile(res.data);
        setUpiForm({
          upiId: res.data.payment.upiId || '',
          merchantName: res.data.payment.merchantName || '',
          defaultCollectionMethod: res.data.payment.defaultCollectionMethod,
          generateDynamicQR: res.data.payment.dynamicQrEnabled,
        });
        setEditProfileForm({
          ownerName: res.data.business.ownerName || '',
          phone: res.data.business.phone || '',
          defaultAdvancePercentage:
            res.data.payment.defaultAdvancePercentage !== null ? String(res.data.payment.defaultAdvancePercentage) : '',
        });
      })
      .catch((err: any) => setBakerProfileError(err.message || 'Failed to load profile.'))
      .finally(() => setBakerProfileLoading(false));
  }, []);

  useEffect(() => {
    if (step === 'dashboard') {
      fetchBakerProfile();
    }
  }, [step, fetchBakerProfile]);

  const handleSaveUpiSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setUpiSubmitting(true);
    setUpiError(null);
    setUpiSuccess(false);
    try {
      await api.put('/api/baker/upi-settings', upiForm);
      setUpiSuccess(true);
      fetchBakerProfile();
    } catch (err: any) {
      setUpiError(err.message || 'Failed to update UPI settings.');
    } finally {
      setUpiSubmitting(false);
    }
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setEditProfileSubmitting(true);
    setEditProfileError(null);
    setEditProfileSuccess(false);
    try {
      const body: Record<string, unknown> = {};
      if (editProfileForm.ownerName.trim()) body.ownerName = editProfileForm.ownerName.trim();
      if (editProfileForm.phone.trim()) body.phone = editProfileForm.phone.trim();
      if (editProfileForm.defaultAdvancePercentage !== '') {
        body.defaultAdvancePercentage = Number(editProfileForm.defaultAdvancePercentage);
      }
      const res = await api.patch<{
        success: boolean;
        data: { ownerName: string | null; phone: string | null; defaultAdvancePercentage: number | null; updatedAt: string };
      }>('/api/baker/profile', body);
      // Update the already-loaded profile in place from the save response
      // — no refetch, so no loading flash and no lost scroll position.
      setBakerProfile((prev) =>
        prev
          ? {
              ...prev,
              business: { ...prev.business, ownerName: res.data.ownerName, phone: res.data.phone || prev.business.phone },
              payment: { ...prev.payment, defaultAdvancePercentage: res.data.defaultAdvancePercentage },
            }
          : prev,
      );
      setEditProfileSuccess(true);
    } catch (err: any) {
      setEditProfileError(err.message || 'Failed to update profile.');
    } finally {
      setEditProfileSubmitting(false);
    }
  };

  // Profile picture upload — reuses the existing generic private-bucket
  // signed-upload flow (POST /api/uploads/signed-url + /confirm), the same
  // one already built for logoPath (BUSINESS_LOGO category). The client
  // uploads the file directly to the returned signed URL (a plain PUT —
  // Supabase's signed-upload URL embeds its own auth token, no additional
  // headers/keys needed), then confirms so the backend persists logoPath.
  const handleProfilePictureUpload = async (file: File) => {
    setLogoUploading(true);
    setLogoUploadError(null);
    try {
      const { data } = await api.post<{ success: boolean; data: { uploadUrl: string; filePath: string } }>(
        '/api/uploads/signed-url',
        { contentType: file.type, category: 'BUSINESS_LOGO', originalFilename: file.name },
      );

      const uploadRes = await fetch(data.uploadUrl, {
        method: 'PUT',
        headers: { 'Content-Type': file.type },
        body: file,
      });
      if (!uploadRes.ok) {
        throw new Error('Upload to storage failed. Please try again.');
      }

      await api.post('/api/uploads/confirm', { filePath: data.filePath, category: 'BUSINESS_LOGO' });
      fetchBakerProfile();
    } catch (err: any) {
      setLogoUploadError(err.message || 'Failed to upload profile picture.');
    } finally {
      setLogoUploading(false);
    }
  };

  // Real billing status — fetched when the Subscription & AutoPay sheet opens.
  const fetchBillingStatus = useCallback(() => {
    setBillingLoading(true);
    setBillingError(null);
    api
      .get<{ success: boolean; data: RealBillingStatus }>('/api/billing/status')
      .then((res) => setBillingStatus(res.data))
      .catch((err: any) => setBillingError(err.message || 'Failed to load billing status.'))
      .finally(() => setBillingLoading(false));
  }, []);

  // Real calendar month aggregation (GET /api/dashboard/calendar)
  useEffect(() => {
    if (step !== 'dashboard' || activeTab !== 'calendar') return;
    setCalendarLoading(true);
    setCalendarError(null);
    api
      .get<{ success: boolean; data: RealCalendarData }>(`/api/dashboard/calendar?view=month&month=${calendarMonth}`)
      .then((res) => setCalendarData(res.data))
      .catch((err: any) => setCalendarError(err.message || 'Failed to load calendar.'))
      .finally(() => setCalendarLoading(false));
  }, [step, activeTab, calendarMonth]);

  // Real whole-month order list (GET /api/orders?from=&to=), grouped by
  // date for rendering below the calendar grid. limit=100 covers realistic
  // monthly volume for a home bakery; a busier baker exceeding that in a
  // single month would need pagination here, not handled yet.
  useEffect(() => {
    if (step !== 'dashboard' || activeTab !== 'calendar') return;
    setCalendarMonthOrdersLoading(true);
    setCalendarMonthOrdersError(null);
    const [y, m] = calendarMonth.split('-').map(Number);
    const monthStart = `${calendarMonth}-01`;
    const monthEnd = `${calendarMonth}-${String(new Date(y, m, 0).getDate()).padStart(2, '0')}`;
    api
      .get<{ success: boolean; data: { orders: RealOrderListItem[] } }>(
        `/api/orders?from=${monthStart}&to=${monthEnd}&limit=100&sort=deliveryDate&order=asc`,
      )
      .then((res) => setCalendarMonthOrders(res.data.orders))
      .catch((err: any) => setCalendarMonthOrdersError(err.message || 'Failed to load deliveries.'))
      .finally(() => setCalendarMonthOrdersLoading(false));
  }, [step, activeTab, calendarMonth]);

  // OTP Timer countdown
  useEffect(() => {
    let interval: ReturnType<typeof setInterval> | null = null;
    if (step === 'otp' && otpTimer > 0) {
      interval = setInterval(() => {
        setOtpTimer((prev) => prev - 1);
      }, 1000);
    }
    return () => {
      if (interval) {
        clearInterval(interval);
      }
    };
  }, [step, otpTimer]);

  // Handle document level dark mode sync
  useEffect(() => {
    const root = window.document.documentElement;
    if (theme === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
  }, [theme]);

  const toggleTheme = () => {
    setTheme((prev) => (prev === 'light' ? 'dark' : 'light'));
  };

  const validateEmail = (emailStr: string) => {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailStr.trim());
  };

  const handleSendOtp = async () => {
    if (isVerifying) return;

    const trimmedEmail = email.trim();
    if (!trimmedEmail) {
      setOtpError('Please enter your email address.');
      return;
    }

    if (!validateEmail(trimmedEmail)) {
      setOtpError('Please enter a valid email address.');
      return;
    }

    setIsVerifying(true);
    setOtpError('');

    try {
      await sendEmailOtp(trimmedEmail);
      setStep('otp');
      setOtpTimer(29);
      setOtpFields(['', '', '', '', '', '']);
    } catch (err: any) {
      setOtpError(err.message || 'Failed to send verification code. Please try again.');
    } finally {
      setIsVerifying(false);
    }
  };

  const handleVerifyOtp = async () => {
    if (isVerifying) return;

    const code = otpFields.join('');
    if (code.length !== 6) {
      setOtpError('Invalid code. Please enter the 6-digit PIN.');
      return;
    }

    setIsVerifying(true);
    setOtpError('');

    try {
      await verifyEmailOtp(email.trim(), code);
      // Session lives in the httpOnly cookie the backend just set on this
      // response — nothing to store client-side.
      setStep('dashboard');
    } catch (err: any) {
      setOtpError(err.message || 'Invalid verification code. Please try again.');
    } finally {
      setIsVerifying(false);
    }
  };

  const handleLogExpense = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!expenseForm.materialName || !expenseForm.quantity || !expenseForm.unit || !expenseForm.pricePerUnit) return;

    setLogExpenseSubmitting(true);
    setLogExpenseError(null);
    try {
      await api.post('/api/investments', {
        category: expenseForm.category,
        materialName: expenseForm.materialName,
        quantity: Number(expenseForm.quantity),
        unit: expenseForm.unit,
        pricePerUnit: Number(expenseForm.pricePerUnit),
        purchaseDate: expenseForm.purchaseDate,
        supplierName: expenseForm.supplierName || undefined,
      });
      setExpenseForm({
        materialName: '',
        category: 'ingredients',
        quantity: '',
        unit: '',
        pricePerUnit: '',
        purchaseDate: new Date().toISOString().slice(0, 10),
        supplierName: '',
      });
      fetchInvestments();
      fetchMonthlySpend();
    } catch (err: any) {
      setLogExpenseError(err.message || 'Failed to log expense.');
    } finally {
      setLogExpenseSubmitting(false);
    }
  };

  const handleCreateOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    setNewOrderError(null);

    if (!newOrderForm.customerName.trim()) {
      setNewOrderError('Customer name is required.');
      return;
    }
    const total = parseFloat(newOrderForm.totalAmount);
    if (!total || total <= 0) {
      setNewOrderError('Total amount must be greater than ₹0.');
      return;
    }
    const advance = parseFloat(newOrderForm.advanceAmount || '0');
    if (advance > total) {
      setNewOrderError('Advance received cannot exceed the total amount.');
      return;
    }
    if (!newOrderForm.date) {
      setNewOrderError('Delivery date is required.');
      return;
    }

    let weightInPounds: number | undefined;
    if (newOrderForm.weightPreset === 'custom') {
      const w = parseFloat(newOrderForm.weightCustom);
      if (!w || w <= 0) {
        setNewOrderError('Enter a valid custom weight in pounds.');
        return;
      }
      weightInPounds = w;
    } else {
      weightInPounds = parseFloat(newOrderForm.weightPreset);
    }

    setNewOrderSubmitting(true);
    try {
      await api.post<{ success: boolean; data: { orderId: string; orderNumber: string; balanceDue: number; status: string } }>(
        '/api/orders',
        {
          customer: {
            name: newOrderForm.customerName.trim(),
            phone: newOrderForm.phone.trim() || null,
            address: newOrderForm.address.trim() || undefined,
          },
          cake: {
            category: newOrderForm.cakeCategory,
            flavour: newOrderForm.flavour,
            weightInPounds,
            quantity: newOrderForm.quantity ? Number(newOrderForm.quantity) : undefined,
          },
          occasion: newOrderForm.occasion.trim() || undefined,
          delivery: {
            type: newOrderForm.deliveryType === 'Delivery' ? 'delivery' : 'pickup',
            date: newOrderForm.date,
            time: newOrderForm.time || undefined,
            charge:
              newOrderForm.deliveryType === 'Delivery' && newOrderForm.deliveryCharge
                ? Number(newOrderForm.deliveryCharge)
                : undefined,
          },
          payment: {
            totalPrice: total,
            advancePaid: advance,
            paymentMethod: newOrderForm.paymentMethod,
          },
        },
      );

      setNewOrderForm(getDefaultNewOrderForm());
      setNewOrderAdvanceTouched(false);
      setActiveSheet('none');

      // Real order now exists server-side — refresh every screen that
      // reads real order data so it's reflected immediately rather than
      // only on next navigation. Calendar/Orders-tab effects already
      // refetch on their own whenever the user navigates into them, but
      // Dashboard (and Orders, if that's the tab the sheet was opened
      // from) won't re-run their effects just because a sheet closed.
      fetchDashboardSummary();
      fetchOrdersList();
    } catch (err: any) {
      setNewOrderError(err.message || 'Failed to create order.');
    } finally {
      setNewOrderSubmitting(false);
    }
  };

  const totalCollectedThisMonth = expenses.reduce((sum, e) => sum + e.amount, 0);

  // Search is client-side (the wholesaler-list endpoint takes no search
  // param - only lat/lng). Sort/order is left exactly as the API
  // returned it: nearest-first when bakerLocation was available at fetch
  // time, default order otherwise - see bakery-api-reference.md endpoint
  // 1. distanceKm is computed here purely for display (Haversine against
  // two real coordinate pairs); the API doesn't return a distance value.
  const filteredWholesalers = wholesalers
    .filter((w) => w.businessName.toLowerCase().includes(supplySearch.toLowerCase()))
    .map((w) => ({
      ...w,
      distanceKm:
        bakerLocation && w.latitude != null && w.longitude != null
          ? haversineDistanceKm(bakerLocation.lat, bakerLocation.lng, w.latitude, w.longitude)
          : null,
    }));

  const selectedWholesaler = wholesalers.find((w) => w.id === selectedWholesalerId) ?? null;

  // Categories offered as chips are derived from this wholesaler's full,
  // unfiltered catalogue (catalogueAllProducts) — not from catalogueProducts,
  // which is already server-filtered to the selected category and would
  // otherwise make every other category chip disappear the moment one is
  // picked. Different wholesalers use their own free-text category values
  // (see bakery-api-reference.md endpoint 2), so this is always derived, never hardcoded.
  const catalogueCategories = Array.from(new Set(catalogueAllProducts.map((p) => p.category)));

  // search/category/sort/inStockOnly are already applied server-side by
  // fetchSupplyCatalogue's query params - catalogueProducts IS the
  // filtered result, nothing left to do client-side.
  const filteredCatalogueProducts = catalogueProducts;

  const selectedProduct = catalogueProducts.find((p) => p.id === selectedProductId) ?? null;
  const selectedVariant = selectedProduct?.variants.find((v) => v.id === selectedVariantId) ?? null;

  const handleAddSelectedProductToCart = async () => {
    if (!selectedProduct) return;
    setProductDetailAdded(false);
    const result = await addProductToCart(selectedProduct, selectedVariant, productDetailQuantity);
    if (result) {
      refreshCart();
      setProductDetailAdded(true);
      setTimeout(() => setProductDetailAdded(false), 1500);
    }
  };

  const cartWholesaler = cart?.wholesalerId ? wholesalers.find((w) => w.id === cart.wholesalerId) ?? null : null;
  const cartSubtotal = cart ? getCartSubtotal(cart) : 0;
  const cartMeetsMinimum = !cart || cart.items.length === 0 || !cartPolicies || cartSubtotal >= cartPolicies.minOrderAmount;

  // Estimate only, for display before placing - the server computes the
  // real charge at order time (see bakery-api-reference.md endpoint 4).
  // Free-delivery threshold, if the wholesaler has one, waives the charge.
  // deliveryCharge/freeDeliveryThreshold are nullable on the backend
  // (unset for a wholesaler that's never configured delivery) even though
  // WholesalerPolicies types them as plain numbers - `?? 0` guards against
  // that mismatch rather than trusting the type.
  const checkoutDeliveryFee =
    checkoutFulfillment === 'Delivery' && cartPolicies
      ? (cartPolicies.freeDeliveryThreshold ?? 0) > 0 && cartSubtotal >= (cartPolicies.freeDeliveryThreshold ?? 0)
        ? 0
        : (cartPolicies.deliveryCharge ?? 0)
      : 0;

  // Only RECEIVED and CANCELLED are confirmed values so far (see
  // bakery-api-reference.md endpoint 5's "Open items to confirm" note) -
  // any other status string, known or not-yet-seen, gets the same
  // neutral fallback treatment rather than assuming a color/meaning for
  // a value we haven't verified.
  const supplyOrderStatusClass = (status: string) => {
    switch (status) {
      case 'RECEIVED': return 'bg-blue-50 dark:bg-blue-950/20 text-blue-700 dark:text-blue-400 border border-blue-200/50';
      case 'CANCELLED': return 'bg-red-50 dark:bg-red-950/20 text-red-600 dark:text-red-400';
      default: return 'bg-neutral-50 dark:bg-neutral-900 text-neutral-600 dark:text-neutral-400 border border-[var(--border)]';
    }
  };

  // Tabs are framed around what we actually know (only CANCELLED is a
  // confirmed terminal status) rather than assuming a "Delivered"/
  // "Completed" value exists yet - "Active" is everything not cancelled,
  // which stays correct even as new status values show up.
  const filteredSupplyOrders = supplyOrders.filter((o) => {
    if (supplyOrdersTab === 'Active') return o.status !== 'CANCELLED';
    if (supplyOrdersTab === 'Cancelled') return o.status === 'CANCELLED';
    return true;
  });

  const selectedOrderListItem = supplyOrders.find((o) => o.id === selectedOrderId) ?? null;
  const selectedOrderWholesaler = selectedOrderListItem
    ? wholesalers.find((w) => w.id === selectedOrderListItem.wholesalerId) ?? null
    : null;

  // Navigation config array for desktop/sidebar layout
  const navigationItems = [
    { id: 'home', label: 'Home', icon: HomeIcon },
    { id: 'orders', label: 'Orders', icon: ClipboardList },
    { id: 'customers', label: 'Customers', icon: Users },
    { id: 'calendar', label: 'Schedule', icon: CalendarIcon },
    { id: 'supply', label: 'Supply Hub', icon: ShoppingBag },
    { id: 'expenses', label: 'Expenses', icon: Wallet },
    { id: 'settings', label: 'Settings', icon: SettingsIcon },
  ] as const;

  const orderTabs: RealOrderTab[] = ['All', 'Pending', 'Confirmed', 'In Progress', 'Ready', 'Delivered', 'Cancelled'];
  const expenseCategories = REAL_INVESTMENT_CATEGORIES;

  // Derived, real calendar-month bookkeeping (replacing the mock's fixed
  // "Jul 26"-labelled objects). calendarMonth is always YYYY-MM.
  const [calendarMonthYear, calendarMonthNum] = calendarMonth.split('-').map(Number);
  const calendarMonthLabel = new Date(calendarMonthYear, calendarMonthNum - 1, 1).toLocaleDateString('en-US', {
    month: 'long',
    year: 'numeric',
  });
  const calendarDaysInMonth = new Date(calendarMonthYear, calendarMonthNum, 0).getDate();
  const calendarStartOffset = new Date(calendarMonthYear, calendarMonthNum - 1, 1).getDay();
  const calendarMonthTotals = (calendarData?.days ?? []).reduce(
    (acc, d) => ({
      totalOrders: acc.totalOrders + d.totalOrders,
      outstandingBalance: acc.outstandingBalance + d.outstandingBalance,
    }),
    { totalOrders: 0, outstandingBalance: 0 },
  );

  const shiftCalendarMonth = (delta: number) => {
    const d = new Date(calendarMonthYear, calendarMonthNum - 1 + delta, 1);
    setCalendarMonth(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
  };
  const handlePrevMonth = () => shiftCalendarMonth(-1);
  const handleNextMonth = () => shiftCalendarMonth(1);

  return (
    <div className="min-h-screen w-full flex justify-center bg-zinc-100 dark:bg-zinc-950 transition-colors duration-300">
      <div className="noise-bg h-screen max-h-screen w-full max-w-[480px] flex flex-col bg-[var(--background)] shadow-2xl border-x border-[var(--border)] relative overflow-hidden">

            {/* SESSION BOOTSTRAP CHECK — avoids flashing the login screen while we ask the backend if the httpOnly cookie is still valid */}
            {isCheckingSession && (
              <div className="flex-1 flex items-center justify-center">
                <div className="w-8 h-8 border-2 border-[var(--border)] border-t-[var(--accent)] rounded-full animate-spin" />
              </div>
            )}

            {/* 1. ONBOARDING LOGIN VIEW */}
            {!isCheckingSession && step === 'login' && (
              <div className="flex-1 flex flex-col items-center justify-start pt-20 pb-12 px-6">
                <div className="w-full max-w-sm flex flex-col items-center">

                  <div className="w-56 h-18 mb-6 relative select-none flex items-center justify-center">
                    <img
                      src={theme === 'dark' ? "/dark-bg-logo.png" : "/light-bg-logo.png"}
                      alt="Kamai Logo"
                      className="w-full h-full object-contain"
                    />
                  </div>

                  <h1 className="font-serif text-[36px] font-bold text-center leading-[1.1] text-[var(--text-primary)] mb-4">
                    Turn Baking<br />Chaos Into Profit.
                  </h1>

                  <p className="text-center text-[14.5px] leading-relaxed text-[var(--text-secondary)] mb-10 max-w-xs">
                    Enter your email address to log in<br />or create your bakery&apos;s workspace.
                  </p>

                  <div className="w-full mb-6">
                    <div className="flex border border-[var(--border)] rounded-2xl bg-[var(--surface)] overflow-hidden focus-within:border-[var(--accent)] transition-all h-[56px] items-center px-4 gap-3">
                      <Mail size={18} className="text-[var(--text-secondary)] shrink-0" />
                      <input
                        type="email"
                        placeholder="Enter your email address"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') handleSendOtp();
                        }}
                        className="w-full h-full text-[14.5px] font-medium outline-none bg-transparent text-[var(--text-primary)] placeholder-[var(--text-secondary)]/50"
                      />
                    </div>

                    {otpError && (
                      <div className="flex items-center gap-1.5 text-red-600 text-xs px-1 mt-2">
                        <AlertCircle size={14} />
                        <span>{otpError}</span>
                      </div>
                    )}
                  </div>

                  <button
                    onClick={handleSendOtp}
                    disabled={isVerifying}
                    className="w-full bg-[var(--accent)] hover:bg-[var(--accent-hover)] disabled:bg-neutral-400 text-white font-bold py-4 rounded-2xl shadow-md transition-all active:scale-[0.99] cursor-pointer text-sm tracking-wide h-[54px] flex items-center justify-center mb-8"
                  >
                    {isVerifying ? 'Sending Code...' : 'Send Verification Code'}
                  </button>

                  <p className="text-center text-[11px] leading-relaxed text-[var(--text-secondary)] px-4 max-w-[280px]">
                    By continuing, you agree to Kamai&apos;s<br />
                    <span className="text-[var(--accent)] cursor-pointer hover:underline font-medium">Terms of Service</span> and <span className="text-[var(--accent)] cursor-pointer hover:underline font-medium">Privacy Policy</span>.
                  </p>
                </div>
              </div>
            )}

            {/* 2. ONBOARDING OTP VIEW */}
            {step === 'otp' && (
              <div className="flex-1 flex flex-col items-center justify-start pt-20 pb-12 px-6">
                <div className="w-full max-w-sm flex flex-col items-stretch">

                  <div className="w-56 h-18 mb-6 self-center relative select-none flex items-center justify-center">
                    <img
                      src={theme === 'dark' ? "/dark-bg-logo.png" : "/light-bg-logo.png"}
                      alt="Kamai Logo"
                      className="w-full h-full object-contain"
                    />
                  </div>

                  <h1 className="font-serif text-[32px] font-bold text-center leading-[1.1] text-[var(--text-primary)] mb-4">
                    Verify your email.
                  </h1>

                  <p className="text-center text-[14.5px] leading-relaxed text-[var(--text-secondary)] mb-8 px-2">
                    We&apos;ve sent a 6-digit secure PIN to<br />
                    <span className="font-semibold text-[var(--text-primary)]">{email}</span>. <span className="text-[var(--accent)] cursor-pointer hover:underline font-bold ml-1" onClick={() => setStep('login')}>Edit</span>
                  </p>

                  <div className="flex justify-between gap-2 mb-8 max-w-[340px] mx-auto w-full">
                    {otpFields.map((val, idx) => (
                      <input
                        key={idx}
                        id={`otp-${idx}`}
                        type="text"
                        pattern="\d*"
                        maxLength={1}
                        value={val}
                        onChange={(e) => {
                          const newVals = [...otpFields];
                          newVals[idx] = e.target.value.replace(/\D/g, '');
                          setOtpFields(newVals);
                          if (e.target.value && idx < 5) {
                            document.getElementById(`otp-${idx + 1}`)?.focus();
                          }
                        }}
                        onKeyDown={(e) => {
                          if (e.key === 'Backspace' && !val && idx > 0) {
                            document.getElementById(`otp-${idx - 1}`)?.focus();
                          }
                        }}
                        className="w-11 h-14 text-center text-2xl font-bold rounded-2xl border-2 border-[var(--border)] focus:border-[var(--accent)] outline-none bg-[var(--surface)] transition-all text-[var(--text-primary)] caret-[var(--accent)] shadow-sm"
                      />
                    ))}
                  </div>

                  {otpError && (
                    <div className="flex items-center gap-1.5 text-red-600 text-xs px-1 mb-4 justify-center">
                      <AlertCircle size={14} />
                      <span>{otpError}</span>
                    </div>
                  )}

                  <p className="text-center text-[13px] font-medium text-[var(--text-secondary)] mb-8">
                    Didn&apos;t receive the code? {otpTimer > 0 ? (
                      <span>Resend in <span className="text-[var(--accent)] font-semibold">00:{otpTimer < 10 ? `0${otpTimer}` : otpTimer}</span></span>
                    ) : (
                      <span className="text-[var(--accent)] font-semibold cursor-pointer hover:underline" onClick={() => { setOtpTimer(29); handleSendOtp(); }}>Resend Code</span>
                    )}
                  </p>

                  <button
                    onClick={handleVerifyOtp}
                    disabled={isVerifying}
                    className="w-full bg-[var(--accent)] hover:bg-[var(--accent-hover)] disabled:bg-neutral-400 text-white font-bold py-4 rounded-2xl shadow-md transition-all active:scale-[0.99] cursor-pointer text-sm tracking-wide h-[54px] flex items-center justify-center"
                  >
                    {isVerifying ? 'Verifying...' : 'Verify & Enter Cockpit'}
                  </button>
                </div>
              </div>
            )}

        {/* 3. MAIN DASHBOARD VIEW - MOBILE ONLY */}
        {step === 'dashboard' && (
          <div className="flex-1 flex flex-col h-full relative overflow-hidden">

            {/* --- MOBILE NAVIGATION BAR & HEADER --- */}
            <div className="w-full flex items-center justify-between px-6 py-3 border-b border-[var(--border)] bg-[var(--background)] sticky top-0 z-30">
              <div className="flex items-center select-none">
                <img
                  src={theme === 'dark' ? "/dark-bg-logo.png" : "/light-bg-logo.png"}
                  alt="Kamai Logo"
                  className="h-9 object-contain"
                />
              </div>

              <div className="flex items-center gap-3">
                <button
                  onClick={toggleTheme}
                  className="p-1.5 rounded-full hover:bg-[var(--surface)] transition-all cursor-pointer"
                  aria-label="Toggle Theme"
                >
                  {theme === 'light' ? <Moon size={20} /> : <Sun size={20} className="text-yellow-500" />}
                </button>

                <button className="relative p-1.5 rounded-full hover:bg-[var(--surface)] transition-all cursor-pointer">
                  <Bell size={20} />
                  <span className="absolute top-1 right-1.5 w-2 h-2 bg-[var(--accent)] rounded-full"></span>
                </button>

                <div
                  onClick={() => setActiveTab('settings')}
                  className="w-10 h-10 rounded-full overflow-hidden border border-[var(--border)] flex items-center justify-center bg-[var(--surface)] text-sm font-bold text-[var(--text-secondary)] cursor-pointer"
                >
                  {bakerProfile?.business.logoUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={bakerProfile.business.logoUrl}
                      alt="Avatar"
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    (bakerProfile?.business.ownerName || bakerProfile?.business.businessName || '?').charAt(0)
                  )}
                </div>
              </div>
            </div>

            {/* --- MAIN PAGE CONTENT WINDOW --- */}
            <main className="flex-1 flex flex-col px-4 py-6 pb-24 overflow-y-auto no-scrollbar w-full">

              {/* TAB 1: HOME */}
              {activeTab === 'home' && (
                <div className="w-full animate-fadeIn">

                  {/* Header Welcome Title */}
                  <div className="mb-8">
                    <h2 className="font-serif text-3xl md:text-4xl font-semibold leading-tight text-[var(--text-primary)]">
                      Hello, {bakerProfile?.business.businessName || 'there'} <span className="inline-block animate-wiggle">👋</span>
                    </h2>
                    <p className="text-xs md:text-sm text-[var(--text-secondary)] mt-1">
                      Here&apos;s what&apos;s happening with your bakery today.
                    </p>
                  </div>

                  {/* Dashboard Responsive Grid */}
                  <div className="flex flex-col gap-4 mb-8">

                    {/* KPI Cards section */}
                    <div className="grid grid-cols-2 gap-4">

                      {/* To Collect Card */}
                      <div
                        onClick={() => setActiveSheet('manage-upi')}
                        className="bg-[var(--surface)] p-6 rounded-[24px] border border-[var(--border)] shadow-sm cursor-pointer hover:border-[var(--accent)] transition-all hover:shadow-md flex flex-col justify-between min-h-[140px]"
                      >
                        <div className="flex items-center justify-between text-[var(--text-secondary)] text-xs font-semibold">
                          <span>To Collect</span>
                          <AlertCircle size={16} className="text-[var(--accent)]" />
                        </div>
                        <div className="mt-4">
                          {dashboardLoading ? (
                            <div className="h-8 w-24 bg-[var(--text-primary)]/8 rounded-lg animate-pulse" />
                          ) : (
                            <span className="text-3xl font-extrabold tracking-tight">₹{(dashboardSummary?.outstandingBalance ?? 0).toLocaleString('en-IN')}</span>
                          )}
                          <p className="text-[10px] text-[var(--text-secondary)] mt-1.5 font-medium">Outstanding balance to recover</p>
                        </div>
                      </div>

                      {/* Deliveries Today Card */}
                      <div
                        onClick={() => setActiveTab('calendar')}
                        className="bg-[var(--surface)] p-6 rounded-[24px] border border-[var(--border)] shadow-sm cursor-pointer hover:border-[var(--accent)] transition-all hover:shadow-md flex flex-col justify-between min-h-[140px]"
                      >
                        <div className="flex items-center justify-between text-[var(--text-secondary)] text-xs font-semibold">
                          <span>Deliveries Today</span>
                          <ShoppingBag size={16} className="text-[var(--accent)]" />
                        </div>
                        <div className="mt-4">
                          {dashboardLoading ? (
                            <div className="h-8 w-24 bg-[var(--text-primary)]/8 rounded-lg animate-pulse" />
                          ) : (
                            <span className="text-3xl font-extrabold tracking-tight">{dashboardSummary?.todayDeliveries ?? 0} Orders</span>
                          )}
                          <p className="text-[10px] text-[var(--text-secondary)] mt-1.5 font-medium">Scheduled for delivery today</p>
                        </div>
                      </div>

                    </div>

                    {dashboardError && (
                      <div className="bg-red-50 dark:bg-red-950/20 border border-red-200/50 text-red-700 dark:text-red-400 p-4 rounded-2xl text-xs font-medium flex items-center justify-between gap-3">
                        <span className="flex items-center gap-2"><AlertCircle size={14} /> {dashboardError}</span>
                        <button onClick={fetchDashboardSummary} className="font-bold underline shrink-0 cursor-pointer">Retry</button>
                      </div>
                    )}

                    {/* Trial End Warning — real bakerProfile.subscription data */}
                    {bakerProfile?.subscription.status === 'TRIAL' && (
                      <div
                        onClick={() => setActiveSheet('subscription-status')}
                        className="bg-[var(--surface)] p-6 rounded-[24px] border border-[var(--border)] shadow-sm cursor-pointer hover:border-[var(--accent)] transition-all flex items-center gap-4 w-full"
                        style={{ background: 'linear-gradient(to right, var(--surface), rgba(234, 88, 12, 0.04))' }}
                      >
                        <span className="text-4xl flex-shrink-0">🎂</span>
                        <div className="flex-1 min-w-0">
                          <h4 className="font-serif font-bold text-sm text-[var(--text-primary)]">Your free trial is ending soon.</h4>
                          <div className="inline-flex items-center gap-1.5 bg-[var(--accent)] text-white px-3 py-1 rounded-full text-[10.5px] font-semibold mt-2">
                            {bakerProfile.subscription.trialDaysRemaining} Days Remaining
                          </div>
                        </div>
                        <ChevronRight size={18} className="text-[var(--text-secondary)] flex-shrink-0" />
                      </div>
                    )}

                  </div>

                  {/* Priority Baking Section */}
                  <div className="w-full">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="font-serif text-xl font-bold">Priority: Bake Today</h3>
                      <span
                        onClick={() => setActiveTab('orders')}
                        className="text-xs font-semibold text-[var(--accent)] cursor-pointer flex items-center gap-0.5 hover:underline"
                      >
                        View all <ChevronRight size={14} />
                      </span>
                    </div>

                    {/* Stacked vertical list of Priority items — sourced from
                        dashboardSummary.todayOrders, which only carries
                        orderNumber/status/totalPrice/balanceDue/deliveryDate.
                        No cake name/photo/customer name/time here (the mock
                        UI assumed those existed at this level; the real
                        dashboard endpoint doesn't provide them — that detail
                        only exists on the single order-details endpoint).
                        Flagging this as a real UX reduction vs. the mock. */}
                    <div className="flex flex-col gap-4">
                      {dashboardLoading && (
                        <div className="flex flex-col gap-4">
                          {[0, 1].map((i) => (
                            <div key={i} className="h-20 bg-[var(--text-primary)]/8 rounded-[22px] animate-pulse" />
                          ))}
                        </div>
                      )}

                      {!dashboardLoading && !dashboardError && dashboardSummary?.todayOrders.length === 0 && (
                        <p className="text-xs text-[var(--text-secondary)] text-center py-8">No deliveries scheduled for today.</p>
                      )}

                      {!dashboardLoading &&
                        dashboardSummary?.todayOrders.map((o) => {
                          const paymentStatus = derivePaymentStatus(o.totalPrice, o.balanceDue);
                          return (
                            <div key={o.id} className="flex flex-col gap-2">
                              <div
                                className="bg-[var(--surface)] p-4 rounded-[22px] border border-[var(--border)] flex items-center gap-4 shadow-sm hover:shadow-md transition-all cursor-pointer hover:border-[var(--accent)]/30"
                                onClick={() => openOrderDetail(o.orderNumber)}
                              >
                                <div className="w-16 h-16 rounded-2xl overflow-hidden bg-neutral-100 dark:bg-neutral-900 flex-shrink-0 border border-[var(--border)] flex items-center justify-center text-3xl">
                                  🎂
                                </div>
                                <div className="flex-1 min-w-0">
                                  <h4 className="font-serif font-bold text-sm md:text-base text-[var(--text-primary)] truncate">{o.orderNumber}</h4>
                                  <p className="text-[11.5px] text-[var(--text-secondary)] mt-0.5">
                                    <span className="text-[var(--accent)] font-semibold">{o.status}</span> • ₹{o.totalPrice.toLocaleString('en-IN')}
                                  </p>
                                </div>
                                <div className="flex-shrink-0 flex flex-col items-end gap-1.5">
                                  {paymentStatus === 'Paid' ? (
                                    <span className="bg-emerald-50 dark:bg-emerald-950/20 text-emerald-700 dark:text-emerald-400 text-[10px] font-bold px-2.5 py-1.5 rounded-full border border-emerald-100">
                                      Fully Paid
                                    </span>
                                  ) : (
                                    <>
                                      <span className={`text-[10px] font-bold px-2.5 py-1.5 rounded-full border whitespace-nowrap ${paymentStatus === 'Unpaid'
                                        ? 'bg-red-50 dark:bg-red-950/20 text-red-600 dark:text-red-400 border-red-200/50'
                                        : 'bg-orange-50 dark:bg-orange-950/20 text-orange-700 dark:text-orange-400 border-orange-200/50'
                                        }`}>
                                        {paymentStatus} • ₹{o.balanceDue.toLocaleString('en-IN')}
                                      </span>
                                      <button
                                        onClick={(e) => { e.stopPropagation(); sendPaymentReminder(o.id); }}
                                        disabled={sendingReminderId === o.id}
                                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold border border-emerald-200/50 bg-emerald-50 dark:bg-emerald-950/20 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-100 dark:hover:bg-emerald-950/40 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer whitespace-nowrap"
                                      >
                                        <Send size={11} />
                                        {sendingReminderId === o.id ? 'Sending…' : 'Remind'}
                                      </button>
                                    </>
                                  )}
                                </div>
                              </div>
                              {reminderErrors[o.id] && (
                                <div className="bg-red-50 dark:bg-red-950/20 border border-red-200/50 text-red-700 dark:text-red-400 px-3 py-2 rounded-xl text-[11px] font-medium flex items-center gap-2">
                                  <AlertCircle size={12} /> {reminderErrors[o.id]}
                                </div>
                              )}
                            </div>
                          );
                        })}
                    </div>
                  </div>

                  {/* Upcoming Lookahead — rest of this month's orders, or
                      the nearest future month with orders if none remain
                      this month (see backend getDashboardSummary). Hidden
                      entirely when there's genuinely no upcoming order at
                      all, rather than rendering an empty section. */}
                  {!dashboardLoading && !dashboardError && dashboardSummary?.upcomingOrders && dashboardSummary.upcomingOrders.orders.length > 0 && (
                    <div className="w-full mt-8">
                      <div className="flex items-center justify-between mb-4">
                        <h3 className="font-serif text-xl font-bold">
                          {dashboardSummary.upcomingOrders.month === calendarMonth
                            ? 'Upcoming This Month'
                            : `Upcoming — ${new Date(`${dashboardSummary.upcomingOrders.month}-01T00:00:00`).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}`}
                        </h3>
                        <span
                          onClick={() => setActiveTab('calendar')}
                          className="text-xs font-semibold text-[var(--accent)] cursor-pointer flex items-center gap-0.5 hover:underline"
                        >
                          View calendar <ChevronRight size={14} />
                        </span>
                      </div>

                      <div className="flex flex-col gap-4">
                        {dashboardSummary.upcomingOrders.orders.map((o) => {
                          const paymentStatus = derivePaymentStatus(o.totalPrice, o.balanceDue);
                          return (
                            <div key={o.id} className="flex flex-col gap-2">
                              <div
                                className="bg-[var(--surface)] p-4 rounded-[22px] border border-[var(--border)] flex items-center gap-4 shadow-sm hover:shadow-md transition-all cursor-pointer hover:border-[var(--accent)]/30"
                                onClick={() => openOrderDetail(o.orderNumber)}
                              >
                                <div className="w-16 h-16 rounded-2xl overflow-hidden bg-neutral-100 dark:bg-neutral-900 flex-shrink-0 border border-[var(--border)] flex items-center justify-center text-3xl">
                                  🎂
                                </div>
                                <div className="flex-1 min-w-0">
                                  <h4 className="font-serif font-bold text-sm md:text-base text-[var(--text-primary)] truncate">{o.customerName} — {o.cakeCategory}</h4>
                                  <p className="text-[11.5px] text-[var(--text-secondary)] mt-0.5">
                                    {new Date(`${o.deliveryDate}T00:00:00`).toLocaleDateString('en-US', { day: 'numeric', month: 'short' })}
                                    {o.deliveryTime ? ` • ${o.deliveryTime}` : ''} • <span className="text-[var(--accent)] font-semibold">{o.status}</span>
                                  </p>
                                </div>
                                <div className="flex-shrink-0 flex flex-col items-end gap-1.5">
                                  {paymentStatus === 'Paid' ? (
                                    <span className="bg-emerald-50 dark:bg-emerald-950/20 text-emerald-700 dark:text-emerald-400 text-[10px] font-bold px-2.5 py-1.5 rounded-full border border-emerald-100">
                                      Fully Paid
                                    </span>
                                  ) : (
                                    <>
                                      <span className={`text-[10px] font-bold px-2.5 py-1.5 rounded-full border whitespace-nowrap ${paymentStatus === 'Unpaid'
                                        ? 'bg-red-50 dark:bg-red-950/20 text-red-600 dark:text-red-400 border-red-200/50'
                                        : 'bg-orange-50 dark:bg-orange-950/20 text-orange-700 dark:text-orange-400 border-orange-200/50'
                                        }`}>
                                        {paymentStatus} • ₹{o.balanceDue.toLocaleString('en-IN')}
                                      </span>
                                      <button
                                        onClick={(e) => { e.stopPropagation(); sendPaymentReminder(o.id); }}
                                        disabled={sendingReminderId === o.id}
                                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold border border-emerald-200/50 bg-emerald-50 dark:bg-emerald-950/20 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-100 dark:hover:bg-emerald-950/40 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer whitespace-nowrap"
                                      >
                                        <Send size={11} />
                                        {sendingReminderId === o.id ? 'Sending…' : 'Remind'}
                                      </button>
                                    </>
                                  )}
                                </div>
                              </div>
                              {reminderErrors[o.id] && (
                                <div className="bg-red-50 dark:bg-red-950/20 border border-red-200/50 text-red-700 dark:text-red-400 px-3 py-2 rounded-xl text-[11px] font-medium flex items-center gap-2">
                                  <AlertCircle size={12} /> {reminderErrors[o.id]}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Floating Action Button (FAB) */}
                  <button
                    onClick={() => setActiveSheet('new-order')}
                    className="absolute bottom-20 right-6 w-14 h-14 rounded-full bg-[var(--accent)] text-white shadow-xl flex items-center justify-center hover:scale-105 active:scale-95 z-40 cursor-pointer"
                  >
                    <Plus size={24} strokeWidth={2.5} />
                  </button>

                </div>
              )}

              {/* TAB 2: ORDERS */}
              {activeTab === 'orders' && (
                <div className="w-full animate-fadeIn">

                  {/* Header Title */}
                  <div className="mb-6 flex justify-between items-center">
                    <h2 className="font-serif text-3xl md:text-4xl font-bold text-[var(--text-primary)]">Orders</h2>
                    <button
                      onClick={() => setActiveSheet('new-order')}
                      className="bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-white px-5 py-2.5 rounded-2xl text-xs font-bold shadow-md active:scale-95 transition-all flex items-center gap-2 cursor-pointer"
                    >
                      <Plus size={16} strokeWidth={2.5} /> New Order
                    </button>
                  </div>

                  {/* Search & Tabs Filtering */}
                  <div className="flex flex-col gap-3 mb-6">

                    {/* Search Bar */}
                    <div className="relative flex items-center border border-[var(--border)] rounded-2xl bg-[var(--surface)] overflow-hidden px-4 focus-within:border-[var(--accent)] transition-colors">
                      <Search size={16} className="text-[var(--text-secondary)]" />
                      <input
                        type="text"
                        placeholder="Search by customer, cake, or date..."
                        value={orderSearch}
                        onChange={(e) => setOrderSearch(e.target.value)}
                        className="w-full py-3 px-2 text-xs outline-none bg-transparent"
                      />
                    </div>

                    {/* Horizontal Scrollable Tabs */}
                    <div className="flex gap-2 overflow-x-auto no-scrollbar py-1">
                      {orderTabs.map((tabName) => (
                        <button
                          key={tabName}
                          onClick={() => setOrderTab(tabName)}
                          className={`px-4 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-all cursor-pointer ${orderTab === tabName
                            ? 'bg-[var(--accent)] text-white shadow-sm'
                            : 'bg-[var(--surface)] text-[var(--text-secondary)] border border-[var(--border)] hover:bg-neutral-50 dark:hover:bg-neutral-900'
                            }`}
                        >
                          {tabName}
                        </button>
                      ))}
                    </div>

                  </div>

                  {/* Real orders list (GET /api/orders) */}
                  {ordersError && (
                    <div className="bg-red-50 dark:bg-red-950/20 border border-red-200/50 text-red-700 dark:text-red-400 p-4 rounded-2xl text-xs font-medium flex items-center justify-between gap-3 mb-4">
                      <span className="flex items-center gap-2"><AlertCircle size={14} /> {ordersError}</span>
                      <button onClick={() => setOrdersPage((p) => p)} className="font-bold underline shrink-0 cursor-pointer">Retry</button>
                    </div>
                  )}

                  <div className="flex flex-col gap-4">
                    {ordersLoading &&
                      [0, 1, 2].map((i) => (
                        <div key={i} className="h-[170px] bg-[var(--text-primary)]/8 rounded-[24px] animate-pulse" />
                      ))}

                    {!ordersLoading && !ordersError && ordersList.length === 0 && (
                      <p className="text-xs text-[var(--text-secondary)] text-center py-12">No orders match this filter.</p>
                    )}

                    {!ordersLoading &&
                      ordersList.map((o) => {
                        const paymentStatus = derivePaymentStatus(o.totalPrice, o.balanceDue);
                        return (
                          <div key={o.orderId} className="flex flex-col gap-2">
                            <div
                              onClick={() => openOrderDetail(o.orderNumber)}
                              className="bg-[var(--surface)] p-5 rounded-[24px] border border-[var(--border)] shadow-sm hover:shadow-md transition-all cursor-pointer flex flex-col justify-between min-h-[170px] hover:border-[var(--accent)]/30"
                            >
                              <div>
                                <div className="flex justify-between items-start mb-3">
                                  <span className="text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-wider">{o.orderNumber}</span>
                                  <div className="flex items-center gap-1 text-[11px] text-[var(--text-secondary)] font-medium">
                                    <CalendarIcon size={12} />
                                    <span>{o.deliveryDate}</span>
                                  </div>
                                </div>

                                <h3 className="font-serif font-bold text-lg text-[var(--text-primary)] mb-1 leading-snug">{o.customerName}</h3>
                                <p className="text-xs text-[var(--text-secondary)]">{o.phone || 'No phone on file'}</p>
                              </div>

                              <div className="flex justify-between items-center pt-4 mt-4 border-t border-[var(--border)]/50 gap-2 flex-wrap">
                                <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10.5px] font-bold ${o.status === 'Pending' ? 'bg-neutral-50 dark:bg-neutral-900 text-neutral-600 dark:text-neutral-400 border border-[var(--border)]' :
                                  o.status === 'Confirmed' ? 'bg-blue-50 dark:bg-blue-950/20 text-blue-700 dark:text-blue-400 border border-blue-200/50' :
                                    o.status === 'In Progress' ? 'bg-orange-50 dark:bg-orange-950/20 text-orange-700 dark:text-orange-400 border border-orange-200/50' :
                                      o.status === 'Ready' ? 'bg-emerald-50 dark:bg-emerald-950/20 text-emerald-700 dark:text-emerald-400 border border-emerald-200/50' :
                                        o.status === 'Delivered' ? 'bg-neutral-50 dark:bg-neutral-900 text-neutral-600 dark:text-neutral-400' :
                                          'bg-red-50 dark:bg-red-950/20 text-red-600 dark:text-red-400'
                                  }`}>
                                  <span className="w-1.5 h-1.5 bg-current rounded-full"></span>
                                  {o.status}
                                </span>

                                <div className="flex items-center gap-2">
                                  {paymentStatus !== 'Paid' && (
                                    <button
                                      onClick={(e) => { e.stopPropagation(); sendPaymentReminder(o.orderId); }}
                                      disabled={sendingReminderId === o.orderId}
                                      className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-full text-[10.5px] font-bold border border-emerald-200/50 bg-emerald-50 dark:bg-emerald-950/20 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-100 dark:hover:bg-emerald-950/40 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer whitespace-nowrap"
                                    >
                                      <Send size={12} />
                                      {sendingReminderId === o.orderId ? 'Sending…' : 'Remind'}
                                    </button>
                                  )}

                                  {paymentStatus === 'Paid' ? (
                                    <span className="bg-emerald-50 dark:bg-emerald-950/20 text-emerald-700 dark:text-emerald-400 text-[10.5px] font-bold px-2.5 py-1.5 rounded-full border border-emerald-100 flex items-center gap-1">
                                      <CheckCircle2 size={12} />
                                      Fully Paid
                                    </span>
                                  ) : (
                                    <span className={`text-[10.5px] font-bold px-2.5 py-1.5 rounded-full border flex items-center gap-1 whitespace-nowrap ${paymentStatus === 'Unpaid'
                                      ? 'bg-red-50 dark:bg-red-950/20 text-red-600 dark:text-red-400 border-red-200/50'
                                      : 'bg-orange-50 dark:bg-orange-950/20 text-orange-700 dark:text-orange-400 border-orange-200/50'
                                      }`}>
                                      {paymentStatus} • ₹{o.balanceDue.toLocaleString('en-IN')}
                                    </span>
                                  )}
                                </div>
                              </div>
                            </div>
                            {reminderErrors[o.orderId] && (
                              <div className="bg-red-50 dark:bg-red-950/20 border border-red-200/50 text-red-700 dark:text-red-400 px-3 py-2 rounded-xl text-[11px] font-medium flex items-center gap-2">
                                <AlertCircle size={12} /> {reminderErrors[o.orderId]}
                              </div>
                            )}
                          </div>
                        );
                      })}
                  </div>

                  {/* Pagination — added since real data isn't bounded like the mock array was */}
                  {ordersPagination && ordersPagination.totalPages > 1 && (
                    <div className="flex items-center justify-between mt-6">
                      <button
                        disabled={!ordersPagination.hasPrevious}
                        onClick={() => setOrdersPage((p) => Math.max(1, p - 1))}
                        className="text-xs font-bold px-4 py-2 rounded-xl border border-[var(--border)] disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                      >
                        Previous
                      </button>
                      <span className="text-xs text-[var(--text-secondary)]">
                        Page {ordersPagination.page} of {ordersPagination.totalPages} ({ordersPagination.totalItems} orders)
                      </span>
                      <button
                        disabled={!ordersPagination.hasNext}
                        onClick={() => setOrdersPage((p) => p + 1)}
                        className="text-xs font-bold px-4 py-2 rounded-xl border border-[var(--border)] disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                      >
                        Next
                      </button>
                    </div>
                  )}

                </div>
              )}

              {/* TAB 3: CUSTOMERS */}
              {activeTab === 'customers' && (
                <div className="w-full animate-fadeIn">

                  {/* Header Title */}
                  <div className="mb-6 flex justify-between items-center">
                    <h2 className="font-serif text-3xl md:text-4xl font-bold text-[var(--text-primary)]">Customers</h2>
                    {/* There is no POST /api/customers endpoint — customers are only
                        ever created implicitly via order creation (upsert-by-phone).
                        "Add Customer" now routes to New Order, the real way this
                        happens, instead of opening a form with nowhere to submit. */}
                    <button
                      onClick={() => setActiveSheet('new-order')}
                      className="bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-white px-5 py-2.5 rounded-2xl text-xs font-bold shadow-md active:scale-95 transition-all flex items-center gap-2 cursor-pointer"
                    >
                      <Plus size={16} strokeWidth={2.5} /> New Order
                    </button>
                  </div>

                  {/* Filter / Search section */}
                  <div className="flex flex-col gap-3 mb-6">
                    {/* Search Bar */}
                    <div className="relative flex items-center border border-[var(--border)] rounded-2xl bg-[var(--surface)] overflow-hidden px-4 focus-within:border-[var(--accent)] transition-colors">
                      <Search size={16} className="text-[var(--text-secondary)]" />
                      <input
                        type="text"
                        placeholder="Search by name or number..."
                        value={customerSearch}
                        onChange={(e) => setCustomerSearch(e.target.value)}
                        className="w-full py-3 px-2 text-xs outline-none bg-transparent"
                      />
                    </div>

                    <div className="flex justify-between items-center">
                      <div className="flex items-center gap-1.5">
                        <span className="text-[11px] text-[var(--text-secondary)]">Sort by:</span>
                        <button className="text-[11px] font-bold text-[var(--accent)] flex items-center gap-0.5 hover:underline bg-[var(--surface)] py-1.5 px-3.5 rounded-full border border-[var(--border)] cursor-pointer">
                          {customerSort} <ChevronDown size={12} />
                        </button>
                      </div>
                      <span className="text-[11px] text-[var(--text-secondary)] font-semibold">Total Clients: {customersPagination?.totalItems ?? 0}</span>
                    </div>
                  </div>

                  {customersError && (
                    <div className="bg-red-50 dark:bg-red-950/20 border border-red-200/50 text-red-700 dark:text-red-400 p-4 rounded-2xl text-xs font-medium flex items-center justify-between gap-3 mb-4">
                      <span className="flex items-center gap-2"><AlertCircle size={14} /> {customersError}</span>
                      <button onClick={() => setCustomersPage((p) => p)} className="font-bold underline shrink-0 cursor-pointer">Retry</button>
                    </div>
                  )}

                  {/* Stacked vertical list of customer cards */}
                  <div className="flex flex-col gap-4">
                    {customersLoading &&
                      [0, 1, 2].map((i) => (
                        <div key={i} className="h-[150px] bg-[var(--text-primary)]/8 rounded-[24px] animate-pulse" />
                      ))}

                    {!customersLoading && !customersError && customersList.length === 0 && (
                      <p className="text-xs text-[var(--text-secondary)] text-center py-12">No customers match this search.</p>
                    )}

                    {!customersLoading &&
                      customersList.map((c) => {
                        const colors = ['bg-amber-100 dark:bg-amber-950/30 text-amber-800 dark:text-amber-400 border-amber-200 dark:border-amber-900', 'bg-orange-100 dark:bg-orange-950/30 text-orange-800 dark:text-orange-400 border-orange-200 dark:border-orange-900', 'bg-orange-100 dark:bg-orange-950/30 text-orange-800 dark:text-orange-400 border-orange-200 dark:border-orange-900', 'bg-neutral-100 dark:bg-neutral-800 text-neutral-800 dark:text-neutral-300 border-neutral-200 dark:border-neutral-700'];
                        const initial = c.name.charAt(0);
                        return (
                          <div
                            key={c.customerId}
                            onClick={() => openCustomerProfile(c.customerId)}
                            className="bg-[var(--surface)] p-5 rounded-[24px] border border-[var(--border)] shadow-sm hover:shadow-md transition-all cursor-pointer flex flex-col justify-between min-h-[150px] hover:border-[var(--accent)]/30"
                          >
                            <div className="flex items-start justify-between">
                              <div className="flex items-center gap-3">
                                <div className={`w-12 h-12 rounded-full ${colors[c.name.length % colors.length]} border flex items-center justify-center font-bold text-base`}>
                                  {initial}
                                </div>
                                <div>
                                  {/* No VIP/Repeat "tag" field exists on the real customer
                                      record — the mock's tag was purely fabricated, dropped. */}
                                  <h3 className="font-bold text-sm md:text-base text-[var(--text-primary)] flex items-center gap-1.5 leading-snug">
                                    {c.name}
                                  </h3>
                                  <p className="text-[11.5px] text-[var(--text-secondary)] flex items-center gap-1 mt-1">
                                    <Phone size={11} />
                                    {c.phone || 'No phone on file'}
                                  </p>
                                </div>
                              </div>

                              {c.phone && (
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    window.open(`https://wa.me/${c.phone!.replace(/\D/g, '')}`, '_blank');
                                  }}
                                  className="w-10 h-10 rounded-full bg-emerald-50 dark:bg-emerald-950/20 hover:bg-emerald-100 dark:hover:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 flex items-center justify-center border border-emerald-100 dark:border-emerald-900 transition-colors"
                                >
                                  <MessageSquare size={16} />
                                </button>
                              )}
                            </div>

                            <div className="flex justify-between items-center mt-5 pt-3.5 border-t border-[var(--border)]/50 text-[11px] text-[var(--text-secondary)] font-medium">
                              <div>
                                <span>Orders: <span className="font-bold text-[var(--text-primary)]">{c.totalOrders}</span></span>
                                <span className="mx-2">•</span>
                                <span>Last: <span className="font-bold text-[var(--text-primary)]">{c.lastOrderDate || '—'}</span></span>
                              </div>
                              <span className="font-extrabold text-[var(--text-primary)] text-xs">LTV: ₹{c.lifetimeValue.toLocaleString('en-IN')}</span>
                            </div>
                          </div>
                        );
                      })}
                  </div>

                  {customersPagination && customersPagination.totalPages > 1 && (
                    <div className="flex items-center justify-between mt-6">
                      <button
                        disabled={!customersPagination.hasPrevious}
                        onClick={() => setCustomersPage((p) => Math.max(1, p - 1))}
                        className="text-xs font-bold px-4 py-2 rounded-xl border border-[var(--border)] disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                      >
                        Previous
                      </button>
                      <span className="text-xs text-[var(--text-secondary)]">
                        Page {customersPagination.page} of {customersPagination.totalPages} ({customersPagination.totalItems} customers)
                      </span>
                      <button
                        disabled={!customersPagination.hasNext}
                        onClick={() => setCustomersPage((p) => p + 1)}
                        className="text-xs font-bold px-4 py-2 rounded-xl border border-[var(--border)] disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                      >
                        Next
                      </button>
                    </div>
                  )}

                </div>
              )}

              {/* TAB 4: CALENDAR */}
              {activeTab === 'calendar' && (
                <div className="w-full animate-fadeIn">

                  {/* Header Title */}
                  <div className="mb-6 flex justify-between items-center">
                    <h2 className="font-serif text-3xl md:text-4xl font-bold text-[var(--text-primary)]">Schedule</h2>
                    <span
                      onClick={() => {
                        const t = new Date();
                        const todayStr = t.toISOString().slice(0, 10);
                        setCalendarMonth(`${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, '0')}`);
                        setSelectedCalendarDate(todayStr);
                        // Only scrolls if today's group is already rendered
                        // (i.e. we were already viewing this month) — a
                        // month switch triggers a refetch and the list
                        // naturally lands at the top.
                        dateGroupRefs.current[todayStr]?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                      }}
                      className="text-xs font-bold text-[var(--accent)] hover:underline cursor-pointer bg-[var(--surface)] py-1.5 px-3.5 rounded-full border border-[var(--border)] shadow-sm"
                    >
                      Today
                    </span>
                  </div>

                  {calendarError && (
                    <div className="bg-red-50 dark:bg-red-950/20 border border-red-200/50 text-red-700 dark:text-red-400 p-4 rounded-2xl text-xs font-medium flex items-center gap-2 mb-4">
                      <AlertCircle size={14} /> {calendarError}
                    </div>
                  )}

                  {/* Calendar Layout: stacked vertically for mobile view */}
                  <div className="flex flex-col gap-6 w-full">

                    {/* Custom high-fidelity Calendar Component — real GET
                        /api/dashboard/calendar. Cells show per-day order
                        counts/status, not customer names (that endpoint
                        doesn't return per-order detail — only Orders-list
                        style endpoints do, which is what the day's
                        delivery list below uses). */}
                    <div className="bg-[var(--surface)] rounded-[28px] border border-[var(--border)] p-5 shadow-sm w-full flex flex-col items-center">

                      {/* Month Swapping Header */}
                      <div className="w-full flex flex-col items-center mb-6">
                        <div className="w-full flex items-center justify-between px-1 mb-2">
                          <button
                            onClick={handlePrevMonth}
                            className="p-2 rounded-[16px] bg-[var(--background)] hover:bg-neutral-100 dark:hover:bg-neutral-900 text-[var(--text-primary)] transition-all border border-[var(--border)] cursor-pointer"
                          >
                            <ArrowLeft size={16} />
                          </button>

                          <span className="text-base font-extrabold text-[var(--text-primary)] font-serif">
                            {calendarMonthLabel}
                          </span>

                          <button
                            onClick={handleNextMonth}
                            className="p-2 rounded-[16px] bg-[var(--background)] hover:bg-neutral-100 text-[var(--text-primary)] transition-all border border-[var(--border)] cursor-pointer rotate-180"
                          >
                            <ArrowLeft size={16} />
                          </button>
                        </div>

                        <div className="text-[11.5px] font-semibold text-[var(--text-secondary)]">
                          {calendarLoading ? (
                            <span>Loading…</span>
                          ) : (
                            <>
                              Orders this month: <span className="text-emerald-600 dark:text-emerald-400 font-bold">{calendarMonthTotals.totalOrders}</span>
                              <span className="mx-2">•</span>
                              Outstanding: <span className="text-amber-800 dark:text-amber-500 font-bold">₹{calendarMonthTotals.outstandingBalance.toLocaleString('en-IN')}</span>
                            </>
                          )}
                        </div>
                      </div>

                      {/* Weekdays Headers */}
                      <div className="grid grid-cols-7 text-center text-[10px] font-bold text-[var(--text-secondary)] mb-4 gap-y-1 uppercase tracking-widest w-full font-serif">
                        <div>Sun</div><div>Mon</div><div>Tue</div><div>Wed</div><div>Thu</div><div>Fri</div><div>Sat</div>
                      </div>

                      {/* Days Grid */}
                      <div className="grid grid-cols-7 gap-y-3 gap-x-1.5 w-full">
                        {/* Render offsets */}
                        {Array.from({ length: calendarStartOffset }).map((_, idx) => (
                          <div key={`offset-${idx}`} className="py-2.5"></div>
                        ))}

                        {/* Render actual days */}
                        {Array.from({ length: calendarDaysInMonth }).map((_, d) => {
                          const dayInt = d + 1;
                          const dateStr = `${calendarMonth}-${String(dayInt).padStart(2, '0')}`;
                          const isSelected = selectedCalendarDate === dateStr;
                          const isToday = dateStr === new Date().toISOString().slice(0, 10);
                          const dayData = calendarData?.days.find((dd) => dd.date === dateStr);
                          const hasOrders = !!dayData && dayData.totalOrders > 0;

                          return (
                            <div
                              key={d}
                              onClick={() => {
                                setSelectedCalendarDate(dateStr);
                                dateGroupRefs.current[dateStr]?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                              }}
                              className={`rounded-[18px] border p-1.5 flex flex-col items-center min-h-[72px] justify-center gap-1 cursor-pointer transition-all shadow-sm w-full ${
                                isSelected
                                  ? 'border-[var(--text-primary)] ring-1 ring-[var(--text-primary)] bg-[var(--surface)]'
                                  : hasOrders
                                    ? 'bg-[#E6F4EA] dark:bg-emerald-950/20 border-[#CEEAD6] dark:border-emerald-900 hover:border-[var(--accent)]'
                                    : 'bg-transparent border-transparent hover:border-[var(--border)]'
                              }`}
                            >
                              {isToday ? (
                                <span className="w-5 h-5 rounded-full bg-[var(--accent)] text-white flex items-center justify-center text-[10px] font-extrabold shadow-sm">
                                  {dayInt}
                                </span>
                              ) : (
                                <span className="text-xs font-extrabold text-[var(--text-primary)]">{dayInt}</span>
                              )}
                              {hasOrders && (
                                <span className="text-[8.5px] font-extrabold text-[#137333] dark:text-emerald-400">
                                  {dayData!.totalOrders} {dayData!.totalOrders === 1 ? 'order' : 'orders'}
                                </span>
                              )}
                            </div>
                          );
                        })}
                      </div>

                      {/* Legend Footer */}
                      <div className="w-full flex justify-center items-center gap-6 mt-6 pt-4 border-t border-[var(--border)]/50 text-[10.5px] text-[var(--text-secondary)] font-bold">
                        <div className="flex items-center gap-1.5">
                          <span className="w-3 h-3 rounded-full bg-[var(--accent)]"></span>
                          <span>Today</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <span className="w-3 h-3 rounded-full bg-[#E6F4EA] border border-[#CEEAD6]"></span>
                          <span>Has orders</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <span className="w-3 h-3 rounded-full bg-[var(--text-primary)]"></span>
                          <span>Selected</span>
                        </div>
                      </div>

                    </div>

                    {/* Right Column — whole month's orders, grouped by
                        date. Calendar day-cell clicks (above) scroll to
                        the matching group via dateGroupRefs rather than
                        re-fetching/re-filtering a single-date list. */}
                    <div className="flex flex-col gap-5">
                      <h3 className="font-serif text-lg font-bold">Deliveries this month</h3>

                      {calendarMonthOrdersError && (
                        <div className="bg-red-50 dark:bg-red-950/20 border border-red-200/50 text-red-700 dark:text-red-400 p-4 rounded-2xl text-xs font-medium flex items-center gap-2">
                          <AlertCircle size={14} /> {calendarMonthOrdersError}
                        </div>
                      )}

                      {calendarMonthOrdersLoading &&
                        [0, 1, 2].map((i) => (
                          <div key={i} className="h-20 bg-[var(--text-primary)]/8 rounded-[22px] animate-pulse" />
                        ))}

                      {!calendarMonthOrdersLoading && !calendarMonthOrdersError && calendarMonthOrders.length === 0 && (
                        <div className="text-center py-12 bg-[var(--surface)] rounded-[22px] border border-dashed border-[var(--border)]">
                          <span className="text-2xl">🥣</span>
                          <p className="text-xs text-[var(--text-secondary)] mt-2">No deliveries scheduled this month.</p>
                        </div>
                      )}

                      {!calendarMonthOrdersLoading &&
                        (() => {
                          const ordersByDate: Record<string, RealOrderListItem[]> = {};
                          for (const o of calendarMonthOrders) {
                            (ordersByDate[o.deliveryDate] ||= []).push(o);
                          }
                          const sortedDates = Object.keys(ordersByDate).sort();

                          return sortedDates.map((dateKey) => {
                            const isSelectedGroup = selectedCalendarDate === dateKey;
                            const dateLabel = new Date(`${dateKey}T00:00:00`).toLocaleDateString('en-US', {
                              weekday: 'short',
                              day: 'numeric',
                              month: 'short',
                            });
                            return (
                              <div
                                key={dateKey}
                                ref={(el) => { dateGroupRefs.current[dateKey] = el; }}
                                className="flex flex-col gap-3"
                              >
                                <h4 className={`text-xs font-bold uppercase tracking-wider ${isSelectedGroup ? 'text-[var(--accent)]' : 'text-[var(--text-secondary)]'}`}>
                                  {dateLabel}
                                </h4>
                                {ordersByDate[dateKey].map((o) => (
                                  <div
                                    key={o.orderId}
                                    className="bg-[var(--surface)] p-4 rounded-[22px] border border-[var(--border)] shadow-sm flex items-center justify-between hover:shadow-md transition-all cursor-pointer hover:border-[var(--accent)]/30"
                                    onClick={() => openOrderDetail(o.orderNumber)}
                                  >
                                    <div className="flex items-center gap-4">
                                      <span className="text-xs font-bold text-[var(--accent)]">{o.orderNumber}</span>
                                      <div>
                                        <h4 className="font-serif font-bold text-sm text-[var(--text-primary)]">{o.customerName}</h4>
                                        <p className="text-[10px] text-[var(--text-secondary)] mt-0.5">{o.status} • ₹{o.totalPrice.toLocaleString('en-IN')}</p>
                                      </div>
                                    </div>

                                    <div className="flex items-center gap-2">
                                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${o.balanceDue > 0 ? 'bg-neutral-50 dark:bg-neutral-900 text-neutral-600 dark:text-neutral-400 border-[var(--border)]' : 'bg-emerald-50 dark:bg-emerald-950/20 text-emerald-700 dark:text-emerald-400 border-emerald-100'}`}>
                                        {o.balanceDue > 0 ? `₹${o.balanceDue.toLocaleString('en-IN')} Due` : 'Paid'}
                                      </span>
                                      <ChevronRight size={14} className="text-[var(--text-secondary)]" />
                                    </div>
                                  </div>
                                ))}
                              </div>
                            );
                          });
                        })()}
                    </div>

                  </div>

                </div>
              )}

              {/* TAB 5: SUPPLY HUB — Screen 1: Browse Suppliers */}
              {activeTab === 'supply' && (
                <div className="w-full animate-fadeIn">

                  {/* Header Title */}
                  <div className="mb-6 flex justify-between items-center">
                    <h2 className="font-serif text-3xl md:text-4xl font-bold text-[var(--text-primary)]">Supply Hub</h2>
                    <div className="flex items-center gap-2.5">
                      <button
                        onClick={() => setActiveSheet('supply-orders')}
                        className="w-11 h-11 rounded-full border border-[var(--border)] bg-[var(--surface)] flex items-center justify-center cursor-pointer shadow-sm"
                      >
                        <ClipboardList size={18} />
                      </button>
                      <button
                        onClick={() => { refreshCart(); setActiveSheet('supply-cart'); }}
                        className="relative w-11 h-11 rounded-full border border-[var(--border)] bg-[var(--surface)] flex items-center justify-center cursor-pointer shadow-sm"
                      >
                        <ShoppingBag size={18} />
                        <span className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-[var(--accent)] text-white text-[9px] font-extrabold rounded-full flex items-center justify-center border border-[var(--surface)]">
                          {cartCount}
                        </span>
                      </button>
                    </div>
                  </div>

                  {/* Search. Sort chips removed: "Top Rated" and "Organic" had no
                      backing data in the real API (no ratings, no tags/certifications
                      concept - see bakery-api-reference.md's cross-cutting notes) and
                      "Nearest" is no longer a toggle since GET /wholesalers already
                      returns nearest-first server-side whenever device location is
                      available - there's nothing left to choose between. */}
                  <div className="flex flex-col gap-2 mb-6">
                    <div className="relative flex items-center border border-[var(--border)] rounded-2xl bg-[var(--surface)] overflow-hidden px-4 focus-within:border-[var(--accent)] transition-colors">
                      <Search size={16} className="text-[var(--text-secondary)]" />
                      <input
                        type="text"
                        placeholder="Search for suppliers..."
                        value={supplySearch}
                        onChange={(e) => setSupplySearch(e.target.value)}
                        className="w-full py-3 px-2 text-xs outline-none bg-transparent"
                      />
                    </div>
                    {/* Required attribution for OSM/Nominatim-derived coordinates —
                        see bakery-api-reference.md endpoint 1's attribution requirement.
                        Shown once here since distance appears on every card below. */}
                    <p className="text-[9.5px] text-[var(--text-secondary)]/70 px-1">
                      Distances © OpenStreetMap contributors
                    </p>
                  </div>

                  {wholesalersError && (
                    <div className="bg-red-50 dark:bg-red-950/20 border border-red-200/50 text-red-700 dark:text-red-400 p-4 rounded-2xl text-xs font-medium flex items-center justify-between gap-3 mb-6">
                      <span className="flex items-center gap-2"><AlertCircle size={14} /> {wholesalersError}</span>
                      <button onClick={fetchSupplyWholesalers} className="font-bold underline shrink-0 cursor-pointer">Retry</button>
                    </div>
                  )}

                  {/* Supplier List */}
                  <div className="flex flex-col gap-4">
                    {wholesalersLoading &&
                      [0, 1, 2].map((i) => (
                        <div key={i} className="h-40 bg-[var(--text-primary)]/8 rounded-[24px] animate-pulse" />
                      ))}

                    {!wholesalersLoading && !wholesalersError && filteredWholesalers.length === 0 && (
                      <p className="text-xs text-[var(--text-secondary)] text-center py-8">No suppliers found.</p>
                    )}

                    {!wholesalersLoading &&
                      filteredWholesalers.map((w) => (
                        <div
                          key={w.id}
                          className="bg-[var(--surface)] rounded-[24px] border border-[var(--border)] shadow-sm hover:shadow-md hover:border-[var(--accent)]/30 transition-all overflow-hidden flex flex-col"
                        >
                          {/* Banner — Store icon on an accent-tinted block; no product photography in this app's design system today, see logoUrl on Wholesaler for a future real-photo swap. */}
                          <div
                            className="w-full h-28 bg-[var(--accent)]/[0.06] border-b border-[var(--border)] flex items-center justify-center relative select-none"
                          >
                            {w.logoUrl ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img src={w.logoUrl} alt={w.businessName} className="w-full h-full object-cover" />
                            ) : (
                              <Store size={32} className="text-[var(--accent)]/50" />
                            )}
                          </div>

                          <div className="p-5 flex flex-col flex-1 justify-between">
                            <div>
                              <div className="flex justify-between items-start gap-2 mb-1.5">
                                <h3 className="font-serif font-bold text-lg text-[var(--text-primary)] leading-tight">{w.businessName}</h3>
                                {w.distanceKm != null && (
                                  <span className="text-[10px] font-semibold text-[var(--text-secondary)] bg-[var(--text-primary)]/5 px-2 py-1 rounded-md shrink-0">
                                    {w.distanceKm.toFixed(1)} km
                                  </span>
                                )}
                              </div>
                              <p className="text-[11px] text-[var(--text-secondary)] mb-3 line-clamp-2">{w.businessType} · {w.address}</p>
                              <div className="flex gap-3 mb-1">
                                {w.deliveryEnabled && (
                                  <div className="flex items-center gap-1 text-[var(--text-secondary)] text-[10.5px] font-semibold">
                                    <Truck size={14} /> Delivery
                                  </div>
                                )}
                                {w.pickupEnabled && (
                                  <div className="flex items-center gap-1 text-[var(--text-secondary)] text-[10.5px] font-semibold">
                                    <Store size={14} /> Pickup
                                  </div>
                                )}
                              </div>
                            </div>

                            <div className="pt-3 mt-3 border-t border-[var(--border)] flex justify-between items-center gap-2">
                              <span className="text-[10.5px] font-semibold text-[var(--accent)] flex items-center gap-1 min-w-0 flex-1">
                                <Clock size={13} className="shrink-0" />
                                <span className="truncate min-w-0">{w.expectedDeliveryTime}</span>
                              </span>
                              <button
                                onClick={() => { setSelectedWholesalerId(w.id); setActiveSheet('supply-catalogue'); }}
                                className="text-xs font-bold text-[var(--accent)] hover:underline shrink-0 cursor-pointer"
                              >
                                View Catalogue
                              </button>
                            </div>
                          </div>
                        </div>
                      ))}
                  </div>

                </div>
              )}

              {/* TAB 6: SETTINGS (MORE) - Desktop layouts render these settings cards directly */}
              {activeTab === 'settings' && (
                <div className="w-full animate-fadeIn">

                  {/* Header Title */}
                  <h2 className="font-serif text-3xl md:text-4xl font-bold text-[var(--text-primary)] mb-6">Settings</h2>

                  {/* Profile Overview Banner */}
                  <div className="bg-[var(--surface)] p-5 rounded-[24px] border border-[var(--border)] shadow-sm mb-6 flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className="w-16 h-16 rounded-full overflow-hidden border border-[var(--border)] flex items-center justify-center bg-[var(--background)] text-xl font-bold text-[var(--text-secondary)]">
                        {bakerProfile?.business.logoUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={bakerProfile.business.logoUrl}
                            alt="Avatar"
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          (bakerProfile?.business.ownerName || bakerProfile?.business.businessName || '?').charAt(0)
                        )}
                      </div>
                      <div>
                        {bakerProfileLoading && !bakerProfile ? (
                          <div className="h-5 w-32 bg-[var(--text-primary)]/8 rounded animate-pulse" />
                        ) : (
                          <h3 className="font-serif font-bold text-lg text-[var(--text-primary)]">{bakerProfile?.business.businessName || 'Unnamed Bakery'}</h3>
                        )}
                        <p className="text-xs text-[var(--text-secondary)] mt-0.5">{bakerProfile?.business.phone || ''}</p>
                      </div>
                    </div>

                    <button
                      onClick={() => setActiveSheet('edit-profile')}
                      className="bg-[var(--background)] hover:bg-[var(--surface)] border border-[var(--border)] text-xs font-bold px-4 py-2 rounded-xl transition-all cursor-pointer text-[var(--accent)]"
                    >
                      View Profile &gt;
                    </button>
                  </div>

                  {bakerProfileError && (
                    <div className="bg-red-50 dark:bg-red-950/20 border border-red-200/50 text-red-700 dark:text-red-400 p-4 rounded-2xl text-xs font-medium flex items-center gap-2 mb-6">
                      <AlertCircle size={14} /> {bakerProfileError}
                    </div>
                  )}

                  {/* Settings Grid (Stacked for Mobile View) */}
                  <div className="flex flex-col gap-6">

                    {/* Category 1: Business Operations
                        businessName/fssaiNumber/whatsappReceiptEnabled
                        still have no write endpoint beyond UPI settings, so
                        those stay read-only here. ownerName/phone/
                        defaultAdvancePercentage are now editable — see the
                        "Profile & Legal" sheet (PATCH /api/baker/profile). */}
                    <div className="bg-[var(--surface)] rounded-[24px] border border-[var(--border)] p-5 shadow-sm">
                      <h4 className="text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-wider mb-4 flex items-center gap-1.5">
                        🏪 Business Operations
                      </h4>

                      <div className="flex flex-col gap-1.5">
                        <div className="flex items-center justify-between py-2.5 border-b border-[var(--border)]/50 last:border-b-0">
                          <div className="flex items-center gap-2">
                            <Percent size={15} className="text-[var(--text-secondary)]" />
                            <span className="text-xs font-medium text-[var(--text-primary)]">Default Advance Needed</span>
                          </div>
                          <span className="text-xs font-bold text-[var(--text-secondary)]">
                            {bakerProfile?.payment.defaultAdvancePercentage != null ? `${bakerProfile.payment.defaultAdvancePercentage}%` : 'Not set'}
                          </span>
                        </div>

                        <div className="flex items-center justify-between py-2.5 border-b border-[var(--border)]/50 last:border-b-0">
                          <div className="flex items-center gap-2">
                            <MessageSquare size={15} className="text-[var(--text-secondary)]" />
                            <span className="text-xs font-medium text-[var(--text-primary)]">Auto-Send Receipts</span>
                          </div>
                          <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full border ${bakerProfile?.payment.whatsappReceiptEnabled ? 'bg-emerald-50 dark:bg-emerald-950/20 text-emerald-700 dark:text-emerald-400 border-emerald-100' : 'bg-neutral-50 dark:bg-neutral-900 text-neutral-600 dark:text-neutral-400 border-[var(--border)]'}`}>
                            {bakerProfile?.payment.whatsappReceiptEnabled ? 'On' : 'Off'} (read-only)
                          </span>
                        </div>

                        <div className="flex items-center justify-between py-2.5">
                          <div className="flex items-center gap-2">
                            <ShieldCheck size={15} className="text-[var(--text-secondary)]" />
                            <span className="text-xs font-medium text-[var(--text-primary)]">FSSAI License</span>
                          </div>
                          <span className="text-xs font-bold text-[var(--text-secondary)]">
                            {bakerProfile?.verification.fssaiNumber ? (bakerProfile.verification.fssaiVerified ? 'Verified' : 'Pending verification') : 'Not on file'}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Category 1a: Financial Tools — Expenses moved here from
                        the bottom nav to make room for Marketplace; same
                        tab/screen/data, just relocated to its own section. */}
                    <div className="bg-[var(--surface)] rounded-[24px] border border-[var(--border)] p-5 shadow-sm">
                      <h4 className="text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-wider mb-4 flex items-center gap-1.5">
                        💰 Financial Tools
                      </h4>

                      <div className="flex flex-col gap-1.5">
                        <div
                          onClick={() => setActiveTab('expenses')}
                          className="flex items-center justify-between py-2.5 cursor-pointer group"
                        >
                          <div className="flex items-center gap-2">
                            <Wallet size={15} className="text-[var(--text-secondary)] group-hover:text-[var(--accent)]" />
                            <span className="text-xs font-medium text-[var(--text-primary)]">Expenses</span>
                          </div>
                          <ChevronRight size={14} className="text-[var(--text-secondary)]" />
                        </div>
                      </div>
                    </div>

                    {/* Category 1b: Public Menu (Action 26 — Shareable Menu Link) */}
                    <div className="bg-[var(--surface)] rounded-[24px] border border-[var(--border)] p-5 shadow-sm">
                      <h4 className="text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-wider mb-4 flex items-center gap-1.5">
                        🍰 Public Menu
                      </h4>

                      <div className="flex flex-col gap-1.5">
                        <div
                          onClick={() => setActiveSheet('my-menu')}
                          className="flex items-center justify-between py-2.5 cursor-pointer group"
                        >
                          <div className="flex items-center gap-2">
                            <UtensilsCrossed size={15} className="text-[var(--text-secondary)] group-hover:text-[var(--accent)]" />
                            <span className="text-xs font-medium text-[var(--text-primary)]">My Menu</span>
                          </div>
                          <ChevronRight size={14} className="text-[var(--text-secondary)]" />
                        </div>

                        <div
                          onClick={() => {
                            setMenuSlugEditing(false);
                            setMenuSlugInput(bakerProfile?.menu.menuSlug || '');
                            setMenuSlugError(null);
                            setActiveSheet('share-menu');
                          }}
                          className="flex items-center justify-between py-2.5 border-t border-[var(--border)]/50 cursor-pointer group"
                        >
                          <div className="flex items-center gap-2">
                            <Link2 size={15} className="text-[var(--text-secondary)] group-hover:text-[var(--accent)]" />
                            <span className="text-xs font-medium text-[var(--text-primary)]">Share My Menu</span>
                          </div>
                          <ChevronRight size={14} className="text-[var(--text-secondary)]" />
                        </div>
                      </div>
                    </div>

                    {/* Category 2: Account & Billing */}
                    <div className="bg-[var(--surface)] rounded-[24px] border border-[var(--border)] p-5 shadow-sm">
                      <h4 className="text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-wider mb-4 flex items-center gap-1.5">
                        💳 Account & Billing
                      </h4>

                      <div className="flex flex-col gap-1.5">
                        <div
                          onClick={() => { setActiveSheet('subscription-autopay'); fetchBillingStatus(); }}
                          className="flex items-center justify-between py-2.5 border-b border-[var(--border)]/50 last:border-b-0 cursor-pointer group"
                        >
                          <div className="flex items-center gap-2">
                            <Sparkles size={15} className="text-[var(--text-secondary)] group-hover:text-[var(--accent)]" />
                            <span className="text-xs font-medium text-[var(--text-primary)]">Subscription Plan</span>
                          </div>
                          <span className="text-xs font-bold text-[var(--text-secondary)] group-hover:text-[var(--text-primary)] flex items-center gap-1">
                            {bakerProfile?.subscription.plan || bakerProfile?.subscription.status || '—'} <ChevronRight size={14} />
                          </span>
                        </div>

                        <div
                          onClick={() => setActiveSheet('manage-upi')}
                          className="flex items-center justify-between py-2.5 cursor-pointer group"
                        >
                          <div className="flex items-center gap-2">
                            <CreditCard size={15} className="text-[var(--text-secondary)] group-hover:text-[var(--accent)]" />
                            <span className="text-xs font-medium text-[var(--text-primary)]">Manage UPI Collection</span>
                          </div>
                          <ChevronRight size={14} className="text-[var(--text-secondary)]" />
                        </div>
                      </div>
                    </div>

                    {/* Category 3: Support */}
                    <div className="bg-[var(--surface)] rounded-[24px] border border-[var(--border)] p-5 shadow-sm">
                      <h4 className="text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-wider mb-4 flex items-center gap-1.5">
                        🎧 Support
                      </h4>

                      <div className="flex flex-col gap-1.5">
                        <div
                          onClick={() => setActiveSheet('help-support')}
                          className="flex items-center justify-between py-2.5 border-b border-[var(--border)]/50 last:border-b-0 cursor-pointer group"
                        >
                          <div className="flex items-center gap-2">
                            <MessageSquare size={15} className="text-[var(--text-secondary)] group-hover:text-[var(--accent)]" />
                            <span className="text-xs font-medium text-[var(--text-primary)]">Chat with Support</span>
                          </div>
                          <ChevronRight size={14} className="text-[var(--text-secondary)]" />
                        </div>

                        <div
                          onClick={() => setActiveSheet('legal-policies')}
                          className="flex items-center justify-between py-2.5 cursor-pointer group"
                        >
                          <div className="flex items-center gap-2">
                            <Shield size={15} className="text-[var(--text-secondary)] group-hover:text-[var(--accent)]" />
                            <span className="text-xs font-medium text-[var(--text-primary)]">Privacy Policy & Terms</span>
                          </div>
                          <ChevronRight size={14} className="text-[var(--text-secondary)]" />
                        </div>
                      </div>
                    </div>

                  </div>

                  {/* Log out */}
                  <button
                    onClick={async () => {
                      await logoutRequest();
                      setStep('login');
                    }}
                    className="w-full py-4 text-xs font-bold text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/20 hover:bg-red-100 dark:hover:bg-red-950/40 rounded-2xl flex items-center justify-center gap-2 border border-red-200/40 dark:border-red-900 transition-colors mt-6 cursor-pointer"
                  >
                    <LogOut size={14} />
                    Log Out
                  </button>

                </div>
              )}

              {/* TAB 7: EXPENSES */}
              {activeTab === 'expenses' && (
                <div className="w-full animate-fadeIn">

                  {/* Header Title */}
                  <div className="mb-6 flex justify-between items-center">
                    <h2 className="font-serif text-3xl md:text-4xl font-bold text-[var(--text-primary)]">Expenses</h2>
                  </div>

                  {/* Monthly Aggregates banner — real GET /api/investments?from=<1st of month>&to=<today> */}
                  <div className="bg-[var(--surface)] p-6 rounded-[24px] border border-[var(--border)] shadow-sm mb-6 flex justify-between items-center max-w-xl">
                    <div>
                      <span className="text-xs text-[var(--text-secondary)] font-semibold">Spent this Month</span>
                      {monthlySpend === null ? (
                        <div className="h-9 w-28 bg-[var(--text-primary)]/8 rounded-lg animate-pulse mt-1" />
                      ) : (
                        <h3 className="font-serif text-3xl md:text-4xl font-extrabold mt-1 text-[var(--text-primary)]">
                          ₹{monthlySpend.toLocaleString('en-IN')}
                        </h3>
                      )}
                    </div>
                    <div className="w-14 h-14 bg-orange-50 dark:bg-[#1A0C06] rounded-full flex items-center justify-center text-orange-600 border border-orange-100 shadow-inner">
                      <Wallet size={24} />
                    </div>
                  </div>

                  {/* Grid Split: Form on left, recent logs on right */}
                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">

                    {/* Log form (Left Column) — real fields: quantity x
                        pricePerUnit (server computes totalCost), not a flat
                        "amount"; real category vocab; purchaseDate required. */}
                    <form onSubmit={handleLogExpense} className="bg-[var(--surface)] p-5 rounded-[24px] border border-[var(--border)] shadow-sm">
                      <h4 className="font-serif font-bold text-base mb-4">Log New Expense</h4>

                      {logExpenseError && (
                        <div className="bg-red-50 dark:bg-red-950/20 border border-red-200/50 text-red-700 dark:text-red-400 p-3 rounded-xl text-[11px] font-medium mb-3 flex items-center gap-2">
                          <AlertCircle size={13} /> {logExpenseError}
                        </div>
                      )}

                      <div className="flex flex-col gap-3.5">
                        <div>
                          <label className="text-[10px] font-bold text-[var(--text-secondary)] mb-1 block">Material / item</label>
                          <div className="flex items-center border border-[var(--border)] rounded-xl bg-[var(--background)] px-3 focus-within:border-[var(--accent)] transition-colors">
                            <Info size={14} className="text-[var(--text-secondary)]" />
                            <input
                              type="text"
                              placeholder="e.g. Flour, Butter, Cocoa"
                              value={expenseForm.materialName}
                              onChange={(e) => setExpenseForm({ ...expenseForm, materialName: e.target.value })}
                              className="w-full py-2.5 px-2 text-xs outline-none bg-transparent"
                              required
                            />
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <label className="text-[10px] font-bold text-[var(--text-secondary)] mb-1 block">Quantity</label>
                            <input
                              type="number"
                              placeholder="0"
                              value={expenseForm.quantity}
                              onChange={(e) => setExpenseForm({ ...expenseForm, quantity: e.target.value })}
                              className="w-full bg-[var(--background)] border border-[var(--border)] rounded-xl py-2.5 px-3 text-xs outline-none font-bold"
                              required
                            />
                          </div>
                          <div>
                            <label className="text-[10px] font-bold text-[var(--text-secondary)] mb-1 block">Unit</label>
                            <input
                              type="text"
                              placeholder="kg, litre, piece..."
                              value={expenseForm.unit}
                              onChange={(e) => setExpenseForm({ ...expenseForm, unit: e.target.value })}
                              className="w-full bg-[var(--background)] border border-[var(--border)] rounded-xl py-2.5 px-3 text-xs outline-none"
                              required
                            />
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <label className="text-[10px] font-bold text-[var(--text-secondary)] mb-1 block">Price / unit (₹)</label>
                            <div className="flex items-center border border-[var(--border)] rounded-xl bg-[var(--background)] px-3 focus-within:border-[var(--accent)] transition-colors">
                              <span className="text-[var(--text-secondary)] text-xs font-semibold">₹</span>
                              <input
                                type="number"
                                placeholder="0.00"
                                value={expenseForm.pricePerUnit}
                                onChange={(e) => setExpenseForm({ ...expenseForm, pricePerUnit: e.target.value })}
                                className="w-full py-2.5 px-2 text-xs outline-none bg-transparent font-bold"
                                required
                              />
                            </div>
                          </div>

                          <div>
                            <label className="text-[10px] font-bold text-[var(--text-secondary)] mb-1 block">Category</label>
                            <select
                              value={expenseForm.category}
                              onChange={(e) => setExpenseForm({ ...expenseForm, category: e.target.value as RealInvestmentCategory })}
                              className="w-full bg-[var(--background)] border border-[var(--border)] text-xs rounded-xl py-3 px-3 outline-none"
                            >
                              {expenseCategories.map((category) => (
                                <option key={category} value={category}>{category}</option>
                              ))}
                            </select>
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <label className="text-[10px] font-bold text-[var(--text-secondary)] mb-1 block">Purchase date</label>
                            <input
                              type="date"
                              value={expenseForm.purchaseDate}
                              onChange={(e) => setExpenseForm({ ...expenseForm, purchaseDate: e.target.value })}
                              className="w-full bg-[var(--background)] border border-[var(--border)] rounded-xl py-2.5 px-3 text-xs outline-none"
                              required
                            />
                          </div>
                          <div>
                            <label className="text-[10px] font-bold text-[var(--text-secondary)] mb-1 block">Supplier (optional)</label>
                            <input
                              type="text"
                              placeholder="e.g. Amul distributor"
                              value={expenseForm.supplierName}
                              onChange={(e) => setExpenseForm({ ...expenseForm, supplierName: e.target.value })}
                              className="w-full bg-[var(--background)] border border-[var(--border)] rounded-xl py-2.5 px-3 text-xs outline-none"
                            />
                          </div>
                        </div>

                        <button
                          type="submit"
                          disabled={logExpenseSubmitting}
                          className="w-full bg-[var(--accent)] hover:bg-[var(--accent-hover)] disabled:opacity-60 text-white text-xs font-bold py-3.5 rounded-xl transition-all shadow-sm flex items-center justify-center gap-1.5 active:scale-98 cursor-pointer"
                        >
                          <Plus size={16} strokeWidth={2.5} /> {logExpenseSubmitting ? 'Logging...' : 'Log Purchase'}
                        </button>
                      </div>
                    </form>

                    {/* Recent purchases log (Right Column) — real GET /api/investments */}
                    <div className="lg:col-span-2 flex flex-col gap-3.5">
                      <h3 className="font-serif text-lg font-bold">Recent Purchases</h3>

                      {investmentsError && (
                        <div className="bg-red-50 dark:bg-red-950/20 border border-red-200/50 text-red-700 dark:text-red-400 p-4 rounded-2xl text-xs font-medium flex items-center justify-between gap-3">
                          <span className="flex items-center gap-2"><AlertCircle size={14} /> {investmentsError}</span>
                          <button onClick={() => setInvestmentsPage((p) => p)} className="font-bold underline shrink-0 cursor-pointer">Retry</button>
                        </div>
                      )}

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        {investmentsLoading &&
                          [0, 1, 2, 3].map((i) => (
                            <div key={i} className="h-24 bg-[var(--text-primary)]/8 rounded-[22px] animate-pulse" />
                          ))}

                        {!investmentsLoading && !investmentsError && investmentsList.length === 0 && (
                          <p className="text-xs text-[var(--text-secondary)] text-center py-8 sm:col-span-2">No expenses logged yet.</p>
                        )}

                        {!investmentsLoading &&
                          investmentsList.map((entry) => (
                            <div
                              key={entry.id}
                              className="bg-[var(--surface)] p-4.5 rounded-[22px] border border-[var(--border)] shadow-sm flex justify-between items-center"
                            >
                              <div>
                                <span className="text-[10px] text-[var(--text-secondary)] font-semibold">{entry.purchaseDate}</span>
                                <h4 className="font-bold text-sm text-[var(--text-primary)] mt-1">{entry.materialName}</h4>
                                <p className="text-[10px] text-[var(--text-secondary)] mt-0.5">{entry.quantity} {entry.unit} × ₹{entry.pricePerUnit}</p>
                                <span className="inline-flex text-[9px] font-extrabold text-[var(--text-secondary)] bg-neutral-100 dark:bg-neutral-900 border border-[var(--border)] px-2.5 py-0.5 rounded-full mt-2 uppercase tracking-wide">
                                  {entry.category}
                                </span>
                              </div>

                              <span className="font-extrabold text-base text-red-600">- ₹{entry.totalCost.toLocaleString('en-IN')}</span>
                            </div>
                          ))}
                      </div>

                      {investmentsPagination && investmentsPagination.totalPages > 1 && (
                        <div className="flex items-center justify-between mt-2">
                          <button
                            disabled={!investmentsPagination.hasPrevious}
                            onClick={() => setInvestmentsPage((p) => Math.max(1, p - 1))}
                            className="text-xs font-bold px-4 py-2 rounded-xl border border-[var(--border)] disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                          >
                            Previous
                          </button>
                          <span className="text-xs text-[var(--text-secondary)]">
                            Page {investmentsPagination.page} of {investmentsPagination.totalPages}
                          </span>
                          <button
                            disabled={!investmentsPagination.hasNext}
                            onClick={() => setInvestmentsPage((p) => p + 1)}
                            className="text-xs font-bold px-4 py-2 rounded-xl border border-[var(--border)] disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                          >
                            Next
                          </button>
                        </div>
                      )}
                    </div>

                  </div>

                </div>
              )}

            </main>

            {/* --- MOBILE BOTTOM NAVIGATION TAB BAR ---
                6 tabs: Home, Orders, Customers, Marketplace, Calendar,
                Settings — px-3.5 per-button + px-6 container padding was
                sized for 5 tabs and overflowed the nav bar horizontally
                below ~430px (buttons got clipped/hidden on real phone
                widths). Padding is tightened on the smallest screens and
                restored from sm: up. */}
            <div className="absolute bottom-0 left-0 right-0 z-40 bg-[var(--background)] border-t border-[var(--border)] px-1 sm:px-6 py-2.5 flex justify-between items-center shadow-lg select-none">

              <button
                onClick={() => setActiveTab('home')}
                className={`flex flex-col items-center gap-1 px-1.5 sm:px-3.5 py-1 rounded-full transition-all cursor-pointer ${activeTab === 'home' ? 'text-[var(--accent)] font-bold scale-105' : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                  }`}
              >
                <HomeIcon size={18} />
                <span className="text-[8.5px] sm:text-[9px] uppercase tracking-wider font-semibold">Home</span>
              </button>

              <button
                onClick={() => setActiveTab('orders')}
                className={`flex flex-col items-center gap-1 px-1.5 sm:px-3.5 py-1 rounded-full transition-all cursor-pointer ${activeTab === 'orders' ? 'text-[var(--accent)] font-bold scale-105' : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                  }`}
              >
                <ClipboardList size={18} />
                <span className="text-[8.5px] sm:text-[9px] uppercase tracking-wider font-semibold">Orders</span>
              </button>

              <button
                onClick={() => setActiveTab('customers')}
                className={`flex flex-col items-center gap-1 px-1.5 sm:px-3.5 py-1 rounded-full transition-all cursor-pointer ${activeTab === 'customers' ? 'text-[var(--accent)] font-bold scale-105' : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                  }`}
              >
                <Users size={18} />
                <span className="text-[8.5px] sm:text-[9px] uppercase tracking-wider font-semibold">Customers</span>
              </button>

              {/* Marketplace (Supply Hub) - entry point to Browse Suppliers.
                  Expenses moved into Settings (see the Settings tab body)
                  to free up this always-visible slot; its screens/data are
                  unchanged, just relocated. */}
              <button
                onClick={() => setActiveTab('supply')}
                className={`flex flex-col items-center gap-1 px-1.5 sm:px-3.5 py-1 rounded-full transition-all cursor-pointer ${activeTab === 'supply' ? 'text-[var(--accent)] font-bold scale-105' : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                  }`}
              >
                <ShoppingBag size={18} />
                <span className="text-[8.5px] sm:text-[9px] uppercase tracking-wider font-semibold">Marketplace</span>
              </button>

              <button
                onClick={() => setActiveTab('calendar')}
                className={`flex flex-col items-center gap-1 px-1.5 sm:px-3.5 py-1 rounded-full transition-all cursor-pointer ${activeTab === 'calendar' ? 'text-[var(--accent)] font-bold scale-105' : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                  }`}
              >
                <CalendarIcon size={18} />
                <span className="text-[8.5px] sm:text-[9px] uppercase tracking-wider font-semibold">Calendar</span>
              </button>

              <button
                onClick={() => setActiveTab('settings')}
                className={`flex flex-col items-center gap-1 px-1.5 sm:px-3.5 py-1 rounded-full transition-all cursor-pointer ${activeTab === 'settings' ? 'text-[var(--accent)] font-bold scale-105' : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                  }`}
              >
                <MoreHorizontal size={18} />
                <span className="text-[8.5px] sm:text-[9px] uppercase tracking-wider font-semibold">Settings</span>
              </button>
            </div>

            {/* --- BOTTOM SHEETS / CENTRED DIALOG MODALS OVERLAYS --- */}
            <AnimatePresence>
              {activeSheet !== 'none' && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-0 md:p-6 bg-black/45 backdrop-blur-sm">

                  {/* Backdrop Click closes overlay */}
                  <div className="absolute inset-0" onClick={() => setActiveSheet('none')} />

                  {/* Responsive Container: Bottom Sheet on Mobile, Centered Card on Desktop */}
                  <motion.div
                    initial={{ y: '100%', opacity: 0.8 }}
                    animate={{ y: 0, opacity: 1 }}
                    exit={{ y: '100%', opacity: 0.8 }}
                    transition={{ type: 'spring', damping: 28, stiffness: 240 }}
                    className="bg-[var(--surface)] w-full max-w-[480px] mx-auto max-h-[88%] overflow-y-auto no-scrollbar border-t border-x border-[var(--border)] shadow-2xl relative z-10 p-6 flex flex-col rounded-t-[32px] self-end"
                  >
                    {/* Top drag handle indicator */}
                    <div className="w-12 h-1 bg-neutral-200 dark:bg-neutral-800 rounded-full mx-auto mb-5"></div>

                    {/* SHEET: NEW ORDER — real POST /api/orders, see
                        handleCreateOrder. Replaces the previous mock form
                        that only wrote to a local, never-rendered array. */}
                    {activeSheet === 'new-order' && (
                      <form onSubmit={handleCreateOrder} className="flex-1 flex flex-col">
                        <div className="flex justify-between items-center mb-6">
                          <button type="button" onClick={() => setActiveSheet('none')} className="p-1.5 text-[var(--text-secondary)] hover:text-[var(--text-primary)] rounded-full hover:bg-neutral-100 dark:hover:bg-neutral-900"><X size={20} /></button>
                          <h3 className="font-serif text-xl md:text-2xl font-bold">New Order</h3>
                          <button type="reset" className="text-xs font-semibold text-[var(--text-secondary)] hover:underline cursor-pointer" onClick={() => { setNewOrderForm(getDefaultNewOrderForm()); setNewOrderAdvanceTouched(false); setNewOrderError(null); }}>Clear</button>
                        </div>

                        <div className="flex flex-col gap-6 overflow-y-auto pb-4">
                          {newOrderError && (
                            <div className="bg-red-50 dark:bg-red-950/20 border border-red-200/50 text-red-700 dark:text-red-400 p-3 rounded-xl text-[11px] font-medium flex items-center gap-2">
                              <AlertCircle size={13} /> {newOrderError}
                            </div>
                          )}

                          {/* Sec 1: Customer details */}
                          <div>
                            <h4 className="text-xs font-bold text-[var(--text-secondary)] uppercase tracking-wider mb-3 flex items-center gap-1.5">
                              👤 1. Customer Details
                            </h4>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
                              <input
                                type="text"
                                placeholder="Customer Name"
                                value={newOrderForm.customerName}
                                onChange={(e) => setNewOrderForm({ ...newOrderForm, customerName: e.target.value })}
                                className="w-full bg-[var(--background)] border border-[var(--border)] rounded-xl py-3 px-4 text-xs outline-none focus:border-[var(--accent)]"
                                required
                              />
                              <input
                                type="tel"
                                placeholder="WhatsApp Number (e.g. 98765 43210)"
                                value={newOrderForm.phone}
                                onChange={(e) => setNewOrderForm({ ...newOrderForm, phone: e.target.value })}
                                className="w-full bg-[var(--background)] border border-[var(--border)] rounded-xl py-3 px-4 text-xs outline-none focus:border-[var(--accent)]"
                              />
                            </div>
                            <input
                              type="text"
                              placeholder="Delivery Address (optional)"
                              value={newOrderForm.address}
                              onChange={(e) => setNewOrderForm({ ...newOrderForm, address: e.target.value })}
                              className="w-full bg-[var(--background)] border border-[var(--border)] rounded-xl py-3 px-4 text-xs outline-none focus:border-[var(--accent)]"
                            />
                          </div>

                          {/* Sec 2: Cake Details */}
                          <div>
                            <h4 className="text-xs font-bold text-[var(--text-secondary)] uppercase tracking-wider mb-3 flex items-center gap-1.5">
                              🎂 2. Cake & Production Details
                            </h4>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
                              <select
                                value={newOrderForm.cakeCategory}
                                onChange={(e) => setNewOrderForm({ ...newOrderForm, cakeCategory: e.target.value })}
                                className="w-full bg-[var(--background)] border border-[var(--border)] rounded-xl py-3 px-3 text-xs outline-none"
                              >
                                {CAKE_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
                              </select>

                              <select
                                value={newOrderForm.flavour}
                                onChange={(e) => setNewOrderForm({ ...newOrderForm, flavour: e.target.value })}
                                className="w-full bg-[var(--background)] border border-[var(--border)] rounded-xl py-3 px-3 text-xs outline-none"
                              >
                                {CAKE_FLAVOURS.map((f) => <option key={f} value={f}>{f}</option>)}
                              </select>
                            </div>

                            <label className="text-[10px] font-bold text-[var(--text-secondary)] mb-1.5 block">Weight (lb)</label>
                            <div className="flex gap-2 mb-2 flex-wrap">
                              {WEIGHT_PRESETS_LB.map((w) => (
                                <button
                                  key={w}
                                  type="button"
                                  onClick={() => setNewOrderForm({ ...newOrderForm, weightPreset: w })}
                                  className={`px-3.5 py-2 text-xs font-bold rounded-xl border transition-all cursor-pointer ${newOrderForm.weightPreset === w
                                    ? 'bg-orange-50 dark:bg-orange-950/20 border-[var(--accent)] text-[var(--accent)]'
                                    : 'bg-[var(--background)] border-[var(--border)] text-[var(--text-secondary)]'
                                    }`}
                                >
                                  {w} lb
                                </button>
                              ))}
                              <button
                                type="button"
                                onClick={() => setNewOrderForm({ ...newOrderForm, weightPreset: 'custom' })}
                                className={`px-3.5 py-2 text-xs font-bold rounded-xl border transition-all cursor-pointer ${newOrderForm.weightPreset === 'custom'
                                  ? 'bg-orange-50 dark:bg-orange-950/20 border-[var(--accent)] text-[var(--accent)]'
                                  : 'bg-[var(--background)] border-[var(--border)] text-[var(--text-secondary)]'
                                  }`}
                              >
                                Custom
                              </button>
                            </div>
                            {newOrderForm.weightPreset === 'custom' && (
                              <input
                                type="number"
                                step="0.1"
                                min="0"
                                placeholder="Custom weight (lb)"
                                value={newOrderForm.weightCustom}
                                onChange={(e) => setNewOrderForm({ ...newOrderForm, weightCustom: e.target.value })}
                                className="w-full bg-[var(--background)] border border-[var(--border)] rounded-xl py-3 px-4 text-xs outline-none focus:border-[var(--accent)] font-bold mb-3"
                                required
                              />
                            )}

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-3">
                              <input
                                type="text"
                                placeholder="Occasion (e.g. Birthday, optional)"
                                value={newOrderForm.occasion}
                                onChange={(e) => setNewOrderForm({ ...newOrderForm, occasion: e.target.value })}
                                className="w-full bg-[var(--background)] border border-[var(--border)] rounded-xl py-3 px-4 text-xs outline-none focus:border-[var(--accent)]"
                              />
                              <input
                                type="number"
                                min="0"
                                placeholder="Quantity (optional, e.g. 12)"
                                value={newOrderForm.quantity}
                                onChange={(e) => setNewOrderForm({ ...newOrderForm, quantity: e.target.value })}
                                className="w-full bg-[var(--background)] border border-[var(--border)] rounded-xl py-3 px-4 text-xs outline-none focus:border-[var(--accent)]"
                              />
                            </div>
                          </div>

                          {/* Sec 3: Schedule */}
                          <div>
                            <h4 className="text-xs font-bold text-[var(--text-secondary)] uppercase tracking-wider mb-3 flex items-center gap-1.5">
                              📅 3. Delivery Schedule
                            </h4>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
                              <input
                                type="date"
                                value={newOrderForm.date}
                                onChange={(e) => setNewOrderForm({ ...newOrderForm, date: e.target.value })}
                                className="w-full bg-[var(--background)] border border-[var(--border)] rounded-xl py-3 px-4 text-xs outline-none"
                                required
                              />
                              <input
                                type="time"
                                value={newOrderForm.time}
                                onChange={(e) => setNewOrderForm({ ...newOrderForm, time: e.target.value })}
                                className="w-full bg-[var(--background)] border border-[var(--border)] rounded-xl py-3 px-4 text-xs outline-none focus:border-[var(--accent)]"
                              />
                            </div>

                            <div className="flex gap-3">
                              <button
                                type="button"
                                onClick={() => setNewOrderForm({ ...newOrderForm, deliveryType: 'Pickup' })}
                                className={`flex-1 py-3 text-xs font-bold rounded-xl border flex items-center justify-center gap-2 transition-all cursor-pointer ${newOrderForm.deliveryType === 'Pickup'
                                  ? 'bg-orange-50 dark:bg-orange-950/20 border-[var(--accent)] text-[var(--accent)]'
                                  : 'bg-[var(--background)] border-[var(--border)] text-[var(--text-secondary)]'
                                  }`}
                              >
                                👜 Pickup
                              </button>
                              <button
                                type="button"
                                onClick={() => setNewOrderForm({ ...newOrderForm, deliveryType: 'Delivery' })}
                                className={`flex-1 py-3 text-xs font-bold rounded-xl border flex items-center justify-center gap-2 transition-all cursor-pointer ${newOrderForm.deliveryType === 'Delivery'
                                  ? 'bg-orange-50 dark:bg-orange-950/20 border-[var(--accent)] text-[var(--accent)]'
                                  : 'bg-[var(--background)] border-[var(--border)] text-[var(--text-secondary)]'
                                  }`}
                              >
                                🛵 Delivery
                              </button>
                            </div>
                            {newOrderForm.deliveryType === 'Delivery' && (
                              <input
                                type="number"
                                min="0"
                                placeholder="Delivery Charge (₹, optional)"
                                value={newOrderForm.deliveryCharge}
                                onChange={(e) => setNewOrderForm({ ...newOrderForm, deliveryCharge: e.target.value })}
                                className="w-full bg-[var(--background)] border border-[var(--border)] rounded-xl py-3 px-4 text-xs outline-none focus:border-[var(--accent)] mt-3"
                              />
                            )}
                          </div>

                          {/* Sec 4: Payment */}
                          <div>
                            <h4 className="text-xs font-bold text-[var(--text-secondary)] uppercase tracking-wider mb-3 flex items-center gap-1.5">
                              ₹ 4. Payment
                            </h4>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
                              <input
                                type="number"
                                placeholder="Total Amount (₹)"
                                value={newOrderForm.totalAmount}
                                onChange={(e) => {
                                  const total = e.target.value;
                                  const pct = bakerProfile?.payment.defaultAdvancePercentage;
                                  const suggestedAdvance =
                                    !newOrderAdvanceTouched && pct && total
                                      ? String(Math.round((Number(total) * pct) / 100))
                                      : newOrderForm.advanceAmount;
                                  setNewOrderForm({ ...newOrderForm, totalAmount: total, advanceAmount: suggestedAdvance });
                                }}
                                className="w-full bg-[var(--background)] border border-[var(--border)] rounded-xl py-3 px-4 text-xs outline-none focus:border-[var(--accent)] font-bold"
                                required
                              />
                              <input
                                type="number"
                                placeholder="Advance Received (₹)"
                                value={newOrderForm.advanceAmount}
                                onChange={(e) => {
                                  setNewOrderAdvanceTouched(true);
                                  setNewOrderForm({ ...newOrderForm, advanceAmount: e.target.value });
                                }}
                                className="w-full bg-[var(--background)] border border-[var(--border)] rounded-xl py-3 px-4 text-xs outline-none focus:border-[var(--accent)] font-bold"
                              />
                            </div>
                            {bakerProfile?.payment.defaultAdvancePercentage ? (
                              <p className="text-[10px] text-[var(--text-secondary)] -mt-1.5 mb-3">
                                Suggested advance: {bakerProfile.payment.defaultAdvancePercentage}% of total (your default, editable in Settings).
                              </p>
                            ) : null}

                            <label className="text-[10px] font-bold text-[var(--text-secondary)] mb-1.5 block">Advance Collected Via</label>
                            <select
                              value={newOrderForm.paymentMethod}
                              onChange={(e) => setNewOrderForm({ ...newOrderForm, paymentMethod: e.target.value as typeof newOrderForm.paymentMethod })}
                              className="w-full bg-[var(--background)] border border-[var(--border)] rounded-xl py-3 px-3 text-xs outline-none mb-3"
                            >
                              {PAYMENT_METHODS.map((m) => <option key={m} value={m}>{m.replace('_', ' ')}</option>)}
                            </select>

                            <div className="flex justify-between items-center bg-[var(--background)] p-4 rounded-xl border border-[var(--border)] text-xs font-bold">
                              <span>Balance to Collect:</span>
                              <span className="text-base text-[var(--accent)]">
                                ₹{(parseFloat(newOrderForm.totalAmount || '0') - parseFloat(newOrderForm.advanceAmount || '0')).toLocaleString('en-IN')}
                              </span>
                            </div>
                          </div>

                        </div>

                        <button
                          type="submit"
                          disabled={newOrderSubmitting}
                          className="w-full bg-[var(--accent)] hover:bg-[var(--accent-hover)] disabled:opacity-60 text-white font-semibold py-4 rounded-2xl shadow-md transition-all active:scale-[0.99] flex items-center justify-center gap-2 mt-4 cursor-pointer"
                        >
                          {newOrderSubmitting ? (
                            <>
                              <span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                              Creating Order...
                            </>
                          ) : (
                            <>
                              <Check size={16} /> Create Order
                            </>
                          )}
                        </button>
                      </form>
                    )}

                    {/* SHEET: EDIT ORDER — real PUT /api/orders/:orderNumber, see
                        handleUpdateOrder. Reuses New Order Form's field layout,
                        pre-filled via openEditOrder from the currently open
                        Order Detail. No "Advance Collected Via" selector here —
                        UpdateOrderBodySchema has no paymentMethod field at all,
                        so keeping that control would silently do nothing. */}
                    {activeSheet === 'edit-order' && (
                      <form onSubmit={handleUpdateOrder} className="flex-1 flex flex-col">
                        <div className="flex justify-between items-center mb-6">
                          <button type="button" onClick={() => setActiveSheet('customer-profile')} className="p-1.5 text-[var(--text-secondary)] hover:text-[var(--text-primary)] rounded-full hover:bg-neutral-100 dark:hover:bg-neutral-900"><X size={20} /></button>
                          <h3 className="font-serif text-xl md:text-2xl font-bold">Edit Order</h3>
                          <span className="w-8" />
                        </div>

                        <div className="flex flex-col gap-6 overflow-y-auto pb-4">
                          {editOrderError && (
                            <div className="bg-red-50 dark:bg-red-950/20 border border-red-200/50 text-red-700 dark:text-red-400 p-3 rounded-xl text-[11px] font-medium flex items-center gap-2">
                              <AlertCircle size={13} /> {editOrderError}
                            </div>
                          )}

                          {/* Sec 1: Customer details */}
                          <div>
                            <h4 className="text-xs font-bold text-[var(--text-secondary)] uppercase tracking-wider mb-3 flex items-center gap-1.5">
                              👤 1. Customer Details
                            </h4>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
                              <input
                                type="text"
                                placeholder="Customer Name"
                                value={editOrderForm.customerName}
                                onChange={(e) => setEditOrderForm({ ...editOrderForm, customerName: e.target.value })}
                                className="w-full bg-[var(--background)] border border-[var(--border)] rounded-xl py-3 px-4 text-xs outline-none focus:border-[var(--accent)]"
                                required
                              />
                              <input
                                type="tel"
                                placeholder="WhatsApp Number (e.g. 98765 43210)"
                                value={editOrderForm.phone}
                                onChange={(e) => setEditOrderForm({ ...editOrderForm, phone: e.target.value })}
                                className="w-full bg-[var(--background)] border border-[var(--border)] rounded-xl py-3 px-4 text-xs outline-none focus:border-[var(--accent)]"
                              />
                            </div>
                            <input
                              type="text"
                              placeholder="Delivery Address (optional)"
                              value={editOrderForm.address}
                              onChange={(e) => setEditOrderForm({ ...editOrderForm, address: e.target.value })}
                              className="w-full bg-[var(--background)] border border-[var(--border)] rounded-xl py-3 px-4 text-xs outline-none focus:border-[var(--accent)]"
                            />
                          </div>

                          {/* Sec 2: Cake Details */}
                          <div>
                            <h4 className="text-xs font-bold text-[var(--text-secondary)] uppercase tracking-wider mb-3 flex items-center gap-1.5">
                              🎂 2. Cake & Production Details
                            </h4>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
                              <select
                                value={editOrderForm.cakeCategory}
                                onChange={(e) => setEditOrderForm({ ...editOrderForm, cakeCategory: e.target.value })}
                                className="w-full bg-[var(--background)] border border-[var(--border)] rounded-xl py-3 px-3 text-xs outline-none"
                              >
                                {/* The order's existing category may not be one of
                                    the preset options (freeform on the backend) —
                                    include it explicitly so the select doesn't
                                    silently mismatch and submit the wrong value. */}
                                {(CAKE_CATEGORIES.includes(editOrderForm.cakeCategory) ? CAKE_CATEGORIES : [editOrderForm.cakeCategory, ...CAKE_CATEGORIES]).map((c) => <option key={c} value={c}>{c}</option>)}
                              </select>

                              <select
                                value={editOrderForm.flavour}
                                onChange={(e) => setEditOrderForm({ ...editOrderForm, flavour: e.target.value })}
                                className="w-full bg-[var(--background)] border border-[var(--border)] rounded-xl py-3 px-3 text-xs outline-none"
                              >
                                {(CAKE_FLAVOURS.includes(editOrderForm.flavour) ? CAKE_FLAVOURS : [editOrderForm.flavour, ...CAKE_FLAVOURS]).map((f) => <option key={f} value={f}>{f}</option>)}
                              </select>
                            </div>

                            <label className="text-[10px] font-bold text-[var(--text-secondary)] mb-1.5 block">Weight (lb)</label>
                            <div className="flex gap-2 mb-2 flex-wrap">
                              {WEIGHT_PRESETS_LB.map((w) => (
                                <button
                                  key={w}
                                  type="button"
                                  onClick={() => setEditOrderForm({ ...editOrderForm, weightPreset: w })}
                                  className={`px-3.5 py-2 text-xs font-bold rounded-xl border transition-all cursor-pointer ${editOrderForm.weightPreset === w
                                    ? 'bg-orange-50 dark:bg-orange-950/20 border-[var(--accent)] text-[var(--accent)]'
                                    : 'bg-[var(--background)] border-[var(--border)] text-[var(--text-secondary)]'
                                    }`}
                                >
                                  {w} lb
                                </button>
                              ))}
                              <button
                                type="button"
                                onClick={() => setEditOrderForm({ ...editOrderForm, weightPreset: 'custom' })}
                                className={`px-3.5 py-2 text-xs font-bold rounded-xl border transition-all cursor-pointer ${editOrderForm.weightPreset === 'custom'
                                  ? 'bg-orange-50 dark:bg-orange-950/20 border-[var(--accent)] text-[var(--accent)]'
                                  : 'bg-[var(--background)] border-[var(--border)] text-[var(--text-secondary)]'
                                  }`}
                              >
                                Custom
                              </button>
                            </div>
                            {editOrderForm.weightPreset === 'custom' && (
                              <input
                                type="number"
                                step="0.1"
                                min="0"
                                placeholder="Custom weight (lb)"
                                value={editOrderForm.weightCustom}
                                onChange={(e) => setEditOrderForm({ ...editOrderForm, weightCustom: e.target.value })}
                                className="w-full bg-[var(--background)] border border-[var(--border)] rounded-xl py-3 px-4 text-xs outline-none focus:border-[var(--accent)] font-bold mb-3"
                                required
                              />
                            )}

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-3">
                              <input
                                type="text"
                                placeholder="Occasion (e.g. Birthday, optional)"
                                value={editOrderForm.occasion}
                                onChange={(e) => setEditOrderForm({ ...editOrderForm, occasion: e.target.value })}
                                className="w-full bg-[var(--background)] border border-[var(--border)] rounded-xl py-3 px-4 text-xs outline-none focus:border-[var(--accent)]"
                              />
                              <input
                                type="number"
                                min="0"
                                placeholder="Quantity (optional, e.g. 12)"
                                value={editOrderForm.quantity}
                                onChange={(e) => setEditOrderForm({ ...editOrderForm, quantity: e.target.value })}
                                className="w-full bg-[var(--background)] border border-[var(--border)] rounded-xl py-3 px-4 text-xs outline-none focus:border-[var(--accent)]"
                              />
                            </div>
                          </div>

                          {/* Sec 3: Schedule */}
                          <div>
                            <h4 className="text-xs font-bold text-[var(--text-secondary)] uppercase tracking-wider mb-3 flex items-center gap-1.5">
                              📅 3. Delivery Schedule
                            </h4>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
                              <input
                                type="date"
                                value={editOrderForm.date}
                                onChange={(e) => setEditOrderForm({ ...editOrderForm, date: e.target.value })}
                                className="w-full bg-[var(--background)] border border-[var(--border)] rounded-xl py-3 px-4 text-xs outline-none"
                                required
                              />
                              <input
                                type="time"
                                value={editOrderForm.time}
                                onChange={(e) => setEditOrderForm({ ...editOrderForm, time: e.target.value })}
                                className="w-full bg-[var(--background)] border border-[var(--border)] rounded-xl py-3 px-4 text-xs outline-none focus:border-[var(--accent)]"
                              />
                            </div>

                            <div className="flex gap-3">
                              <button
                                type="button"
                                onClick={() => setEditOrderForm({ ...editOrderForm, deliveryType: 'Pickup' })}
                                className={`flex-1 py-3 text-xs font-bold rounded-xl border flex items-center justify-center gap-2 transition-all cursor-pointer ${editOrderForm.deliveryType === 'Pickup'
                                  ? 'bg-orange-50 dark:bg-orange-950/20 border-[var(--accent)] text-[var(--accent)]'
                                  : 'bg-[var(--background)] border-[var(--border)] text-[var(--text-secondary)]'
                                  }`}
                              >
                                👜 Pickup
                              </button>
                              <button
                                type="button"
                                onClick={() => setEditOrderForm({ ...editOrderForm, deliveryType: 'Delivery' })}
                                className={`flex-1 py-3 text-xs font-bold rounded-xl border flex items-center justify-center gap-2 transition-all cursor-pointer ${editOrderForm.deliveryType === 'Delivery'
                                  ? 'bg-orange-50 dark:bg-orange-950/20 border-[var(--accent)] text-[var(--accent)]'
                                  : 'bg-[var(--background)] border-[var(--border)] text-[var(--text-secondary)]'
                                  }`}
                              >
                                🛵 Delivery
                              </button>
                            </div>
                            {editOrderForm.deliveryType === 'Delivery' && (
                              <input
                                type="number"
                                min="0"
                                placeholder="Delivery Charge (₹, optional)"
                                value={editOrderForm.deliveryCharge}
                                onChange={(e) => setEditOrderForm({ ...editOrderForm, deliveryCharge: e.target.value })}
                                className="w-full bg-[var(--background)] border border-[var(--border)] rounded-xl py-3 px-4 text-xs outline-none focus:border-[var(--accent)] mt-3"
                              />
                            )}
                          </div>

                          {/* Sec 4: Payment */}
                          <div>
                            <h4 className="text-xs font-bold text-[var(--text-secondary)] uppercase tracking-wider mb-3 flex items-center gap-1.5">
                              ₹ 4. Payment
                            </h4>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
                              <input
                                type="number"
                                placeholder="Total Amount (₹)"
                                value={editOrderForm.totalAmount}
                                onChange={(e) => setEditOrderForm({ ...editOrderForm, totalAmount: e.target.value })}
                                className="w-full bg-[var(--background)] border border-[var(--border)] rounded-xl py-3 px-4 text-xs outline-none focus:border-[var(--accent)] font-bold"
                                required
                              />
                              <input
                                type="number"
                                placeholder="Advance Received (₹)"
                                value={editOrderForm.advanceAmount}
                                onChange={(e) => setEditOrderForm({ ...editOrderForm, advanceAmount: e.target.value })}
                                className="w-full bg-[var(--background)] border border-[var(--border)] rounded-xl py-3 px-4 text-xs outline-none focus:border-[var(--accent)] font-bold"
                              />
                            </div>

                            <div className="flex justify-between items-center bg-[var(--background)] p-4 rounded-xl border border-[var(--border)] text-xs font-bold">
                              <span>Balance to Collect:</span>
                              <span className="text-base text-[var(--accent)]">
                                ₹{(parseFloat(editOrderForm.totalAmount || '0') - parseFloat(editOrderForm.advanceAmount || '0')).toLocaleString('en-IN')}
                              </span>
                            </div>
                          </div>

                        </div>

                        <button
                          type="submit"
                          disabled={editOrderSubmitting}
                          className="w-full bg-[var(--accent)] hover:bg-[var(--accent-hover)] disabled:opacity-60 text-white font-semibold py-4 rounded-2xl shadow-md transition-all active:scale-[0.99] flex items-center justify-center gap-2 mt-4 cursor-pointer"
                        >
                          {editOrderSubmitting ? (
                            <>
                              <span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                              Saving...
                            </>
                          ) : (
                            <>
                              <Check size={16} /> Save Changes
                            </>
                          )}
                        </button>
                      </form>
                    )}

                    {/* SHEET: ORDER DETAIL (real data, GET /api/orders/:orderNumber) —
                        reuses the same sheet slot as Customer Profile per
                        explicit decision, rather than a new screen. This is
                        read-only: there are no per-order action buttons here
                        (status update / WhatsApp send) in the current design —
                        flagged as a real functional gap, not something I'm
                        inventing UI for. */}
                    {activeSheet === 'customer-profile' && (orderDetailLoading || orderDetailError || selectedOrderDetail) && (
                      <div className="flex-1 flex flex-col animate-fadeIn">
                        <div className="flex justify-between items-center mb-6">
                          <button
                            onClick={() => {
                              setActiveSheet('none');
                              setSelectedOrderDetail(null);
                              setReceiptShareError(null);
                              setReceiptShareFallback(false);
                              setReceiptSharePayload(null);
                            }}
                            className="p-1.5 text-[var(--text-secondary)] hover:text-[var(--text-primary)] rounded-full hover:bg-neutral-100 dark:hover:bg-neutral-900"
                          >
                            <X size={20} />
                          </button>
                          <h3 className="font-serif text-xl md:text-2xl font-bold">Order Detail</h3>
                          <span className="w-8" />
                        </div>

                        {orderDetailLoading && (
                          <div className="flex flex-col gap-4">
                            <div className="h-24 bg-[var(--text-primary)]/8 rounded-2xl animate-pulse" />
                            <div className="h-40 bg-[var(--text-primary)]/8 rounded-2xl animate-pulse" />
                          </div>
                        )}

                        {orderDetailError && (
                          <div className="bg-red-50 dark:bg-red-950/20 border border-red-200/50 text-red-700 dark:text-red-400 p-4 rounded-2xl text-xs font-medium flex items-center gap-2">
                            <AlertCircle size={14} /> {orderDetailError}
                          </div>
                        )}

                        {!orderDetailLoading && !orderDetailError && selectedOrderDetail && (
                          <div className="flex flex-col gap-4 overflow-y-auto">
                            <div className="bg-[var(--background)] p-5 rounded-[24px] border border-[var(--border)] shadow-sm">
                              <div className="flex justify-between items-start mb-3">
                                <span className="text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-wider">{selectedOrderDetail.orderId}</span>
                                <span className="text-[10.5px] font-bold px-3 py-1 rounded-full bg-orange-50 dark:bg-orange-950/20 text-orange-700 dark:text-orange-400 border border-orange-200/50">
                                  {selectedOrderDetail.status}
                                </span>
                              </div>
                              <h4 className="font-serif font-bold text-xl">{selectedOrderDetail.cake.category} — {selectedOrderDetail.cake.flavour}</h4>
                              <p className="text-xs text-[var(--text-secondary)] mt-1">
                                {selectedOrderDetail.cake.weightInPounds ? `${selectedOrderDetail.cake.weightInPounds} lb` : ''}
                                {selectedOrderDetail.cake.quantity ? ` • Qty ${selectedOrderDetail.cake.quantity}` : ''}
                                {selectedOrderDetail.occasion ? ` • ${selectedOrderDetail.occasion}` : ''}
                              </p>
                            </div>

                            {/* Edit Order — hidden/disabled once the order is
                                Delivered or Cancelled, mirroring the backend's
                                own edit-lock (PUT /api/orders/:orderNumber
                                returns 409 in that case) so the baker never
                                fills out a whole form only to hit a conflict
                                error on submit. */}
                            {selectedOrderDetail.status === 'Delivered' || selectedOrderDetail.status === 'Cancelled' ? (
                              <div className="flex flex-col gap-1">
                                <button
                                  type="button"
                                  disabled
                                  className="w-full inline-flex items-center justify-center gap-2 py-3 rounded-2xl text-xs font-bold border border-[var(--border)] bg-neutral-50 dark:bg-neutral-900 text-[var(--text-secondary)] opacity-60 cursor-not-allowed"
                                >
                                  <Pencil size={14} /> Edit Order
                                </button>
                                <p className="text-[10.5px] text-[var(--text-secondary)] text-center">
                                  {selectedOrderDetail.status} orders can no longer be edited.
                                </p>
                              </div>
                            ) : (
                              <button
                                type="button"
                                onClick={openEditOrder}
                                className="w-full inline-flex items-center justify-center gap-2 py-3 rounded-2xl text-xs font-bold border border-[var(--border)] hover:bg-neutral-50 dark:hover:bg-neutral-900 cursor-pointer"
                              >
                                <Pencil size={14} /> Edit Order
                              </button>
                            )}

                            <div className="bg-[var(--surface)] p-4 rounded-2xl border border-[var(--border)]">
                              <h5 className="text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-wider mb-2">Customer</h5>
                              <p className="text-sm font-bold">{selectedOrderDetail.customer.name}</p>
                              <p className="text-xs text-[var(--text-secondary)] mt-0.5">{selectedOrderDetail.customer.phone || 'No phone on file'}</p>
                              {selectedOrderDetail.customer.address && (
                                <p className="text-xs text-[var(--text-secondary)] mt-0.5">{selectedOrderDetail.customer.address}</p>
                              )}
                              <div className="grid grid-cols-2 gap-3 mt-3">
                                {selectedOrderDetail.customer.phone && (
                                  <a
                                    href={`https://wa.me/${selectedOrderDetail.customer.phone.replace(/\D/g, '')}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="py-2.5 text-xs font-bold rounded-xl border border-[var(--border)] flex items-center justify-center gap-2 hover:bg-neutral-50 dark:hover:bg-neutral-900"
                                  >
                                    <MessageSquare size={14} className="text-emerald-600" /> Message
                                  </a>
                                )}
                                {selectedOrderDetail.customer.phone && (
                                  <a
                                    href={`tel:${selectedOrderDetail.customer.phone}`}
                                    className="py-2.5 text-xs font-bold rounded-xl border border-[var(--border)] flex items-center justify-center gap-2 hover:bg-neutral-50 dark:hover:bg-neutral-900"
                                  >
                                    <Phone size={14} className="text-blue-600" /> Call
                                  </a>
                                )}
                              </div>
                            </div>

                            <div className="bg-[var(--surface)] p-4 rounded-2xl border border-[var(--border)]">
                              <h5 className="text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-wider mb-2">Delivery</h5>
                              <p className="text-xs">
                                {selectedOrderDetail.delivery.type === 'pickup' ? 'Pickup' : 'Delivery'} • {selectedOrderDetail.delivery.date}
                                {selectedOrderDetail.delivery.time ? ` at ${selectedOrderDetail.delivery.time}` : ''}
                              </p>
                              {selectedOrderDetail.delivery.charge > 0 && (
                                <p className="text-xs text-[var(--text-secondary)] mt-1">Delivery charge: ₹{selectedOrderDetail.delivery.charge}</p>
                              )}
                            </div>

                            <div className="bg-[var(--surface)] p-4 rounded-2xl border border-[var(--border)]">
                              <h5 className="text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-wider mb-2">Payment</h5>
                              <div className="flex justify-between text-xs py-1"><span className="text-[var(--text-secondary)]">Total</span><span className="font-bold">₹{selectedOrderDetail.payment.totalPrice.toLocaleString('en-IN')}</span></div>
                              <div className="flex justify-between text-xs py-1"><span className="text-[var(--text-secondary)]">Advance Paid</span><span className="font-bold">₹{selectedOrderDetail.payment.advancePaid.toLocaleString('en-IN')}</span></div>
                              <div className="flex justify-between text-xs py-1 border-t border-[var(--border)]/50 mt-1 pt-2"><span className="text-[var(--text-secondary)]">Balance Due</span><span className="font-bold text-[var(--accent)]">₹{selectedOrderDetail.payment.balanceDue.toLocaleString('en-IN')}</span></div>
                              <span className="inline-block mt-2 text-[10px] font-bold px-2.5 py-1 rounded-full bg-neutral-50 dark:bg-neutral-900 border border-[var(--border)]">{selectedOrderDetail.payment.paymentStatus}</span>
                            </div>

                            {/* Share Receipt — only shown when the baker has
                                whatsappReceiptEnabled on their profile; the
                                403 WHATSAPP_RECEIPT_DISABLED the backend
                                would otherwise return is a backstop, not the
                                primary gate. */}
                            {bakerProfile?.payment.whatsappReceiptEnabled && (
                              <div className="flex flex-col gap-2">
                                {receiptSharePayload ? (
                                  <button
                                    onClick={confirmReceiptShare}
                                    className="w-full inline-flex items-center justify-center gap-2 py-3 rounded-2xl text-xs font-bold border border-emerald-600 bg-emerald-600 text-white hover:bg-emerald-700 cursor-pointer animate-pulse"
                                  >
                                    <Send size={14} /> Tap to Send via WhatsApp
                                  </button>
                                ) : (
                                  <button
                                    onClick={() => prepareReceiptShare({ id: selectedOrderDetail.id, orderId: selectedOrderDetail.orderId })}
                                    disabled={receiptSharing}
                                    className="w-full inline-flex items-center justify-center gap-2 py-3 rounded-2xl text-xs font-bold border border-emerald-200/50 bg-emerald-50 dark:bg-emerald-950/20 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-100 dark:hover:bg-emerald-950/40 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                                  >
                                    {receiptSharing ? (
                                      <>
                                        <span className="w-3.5 h-3.5 border-2 border-emerald-700/30 dark:border-emerald-400/30 border-t-emerald-700 dark:border-t-emerald-400 rounded-full animate-spin" />
                                        Preparing Receipt…
                                      </>
                                    ) : (
                                      <>
                                        <Share2 size={14} /> Share Receipt
                                      </>
                                    )}
                                  </button>
                                )}
                                {receiptShareFallback && (
                                  <div className="bg-blue-50 dark:bg-blue-950/20 border border-blue-200/50 text-blue-700 dark:text-blue-400 px-3 py-2 rounded-xl text-[11px] font-medium flex items-center gap-2">
                                    <Download size={12} /> Image downloaded — attach it in WhatsApp to send.
                                  </div>
                                )}
                                {receiptShareError && (
                                  <div className="bg-red-50 dark:bg-red-950/20 border border-red-200/50 text-red-700 dark:text-red-400 px-3 py-2 rounded-xl text-[11px] font-medium flex items-center gap-2">
                                    <AlertCircle size={12} /> {receiptShareError}
                                  </div>
                                )}
                              </div>
                            )}

                            {selectedOrderDetail.customFields && selectedOrderDetail.customFields.length > 0 && (
                              <div className="bg-[var(--surface)] p-4 rounded-2xl border border-[var(--border)]">
                                <h5 className="text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-wider mb-2">Additional Details</h5>
                                {selectedOrderDetail.customFields.map((f: { label: string; value: string }, i: number) => (
                                  <div key={i} className="flex justify-between text-xs py-1">
                                    <span className="text-[var(--text-secondary)]">{f.label}</span>
                                    <span className="font-medium text-right">{f.value}</span>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    )}

                    {/* SHEET: CUSTOMER PROFILE DETAILS (real data, GET /api/customers/:id) */}
                    {activeSheet === 'customer-profile' && (customerProfileLoading || customerProfileError || selectedCustomerProfile) && (
                      <div className="flex-1 flex flex-col animate-fadeIn">
                        <div className="flex justify-between items-center mb-6">
                          <button
                            onClick={() => { setActiveSheet('none'); setSelectedCustomerProfile(null); }}
                            className="p-1.5 text-[var(--text-secondary)] hover:text-[var(--text-primary)] rounded-full hover:bg-neutral-100 dark:hover:bg-neutral-900"
                          >
                            <X size={20} />
                          </button>
                          <h3 className="font-serif text-xl md:text-2xl font-bold">Customer Profile</h3>
                          <span className="w-8" />
                        </div>

                        {customerProfileLoading && (
                          <div className="flex flex-col gap-4">
                            <div className="h-40 bg-[var(--text-primary)]/8 rounded-2xl animate-pulse" />
                            <div className="h-24 bg-[var(--text-primary)]/8 rounded-2xl animate-pulse" />
                          </div>
                        )}

                        {customerProfileError && (
                          <div className="bg-red-50 dark:bg-red-950/20 border border-red-200/50 text-red-700 dark:text-red-400 p-4 rounded-2xl text-xs font-medium flex items-center gap-2">
                            <AlertCircle size={14} /> {customerProfileError}
                          </div>
                        )}

                        {!customerProfileLoading && !customerProfileError && selectedCustomerProfile && (
                          <>
                            {/* Header Overview Card */}
                            <div className="bg-[var(--background)] p-6 rounded-[24px] border border-[var(--border)] shadow-sm text-center mb-4 flex flex-col items-center">
                              <div className="w-16 h-16 rounded-full bg-amber-100 dark:bg-amber-950/30 text-amber-800 dark:text-amber-400 border border-amber-200 dark:border-amber-900 flex items-center justify-center font-bold text-2xl mb-3 shadow-inner">
                                {selectedCustomerProfile.name.charAt(0)}
                              </div>
                              <h4 className="font-serif font-bold text-xl flex items-center gap-1.5">
                                {selectedCustomerProfile.name}
                              </h4>

                              <span className="text-xs text-[var(--text-secondary)] mt-2">Lifetime Value (LTV):</span>
                              <span className="text-3xl font-extrabold text-[var(--text-primary)] mt-1">
                                ₹{selectedCustomerProfile.summary.lifetimeValue.toLocaleString('en-IN')}
                              </span>
                              {selectedCustomerProfile.summary.outstandingBalance > 0 && (
                                <span className="text-[10px] font-bold text-[var(--accent)] mt-1">
                                  ₹{selectedCustomerProfile.summary.outstandingBalance.toLocaleString('en-IN')} outstanding
                                </span>
                              )}
                            </div>

                            {/* Contact row buttons */}
                            {selectedCustomerProfile.phone && (
                              <div className="grid grid-cols-2 gap-3 mb-6">
                                <a
                                  href={`https://wa.me/${selectedCustomerProfile.phone.replace(/\D/g, '')}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="py-3 text-xs font-bold rounded-xl border border-[var(--border)] flex items-center justify-center gap-2 hover:bg-neutral-50 dark:hover:bg-neutral-900"
                                >
                                  <MessageSquare size={14} className="text-emerald-600" />
                                  Message
                                </a>
                                <a
                                  href={`tel:${selectedCustomerProfile.phone}`}
                                  className="py-3 text-xs font-bold rounded-xl border border-[var(--border)] flex items-center justify-center gap-2 hover:bg-neutral-50 dark:hover:bg-neutral-900"
                                >
                                  <Phone size={14} className="text-blue-600" />
                                  Call
                                </a>
                              </div>
                            )}

                            {/* Order History — no cake name available at this level
                                (only order/status/amount fields), same limitation as
                                Orders list/Dashboard. Rows link into the real
                                order-detail view already built. */}
                            <h4 className="font-serif font-bold text-sm mb-3">Order History ({selectedCustomerProfile.summary.totalOrders})</h4>

                            <div className="flex flex-col gap-3 mb-6 overflow-y-auto max-h-52 pr-1">
                              {selectedCustomerProfile.orders.length === 0 && (
                                <p className="text-xs text-[var(--text-secondary)] text-center py-4">No orders yet.</p>
                              )}
                              {selectedCustomerProfile.orders.map((o) => (
                                <div
                                  key={o.orderId}
                                  onClick={() => openOrderDetail(o.orderNumber)}
                                  className="bg-[var(--surface)] p-4 rounded-xl border border-[var(--border)] flex justify-between items-center shadow-sm cursor-pointer hover:border-[var(--accent)]/30"
                                >
                                  <div>
                                    <span className="text-[10px] text-[var(--text-secondary)] font-semibold">{o.deliveryDate}</span>
                                    <h5 className="font-serif font-bold text-sm text-[var(--text-primary)] mt-0.5">{o.orderNumber}</h5>
                                    <p className="text-[10px] text-[var(--text-secondary)] mt-1">{o.status}</p>
                                  </div>
                                  <div className="text-right">
                                    <span className="text-xs font-bold text-[var(--text-primary)]">₹{o.totalPrice.toLocaleString('en-IN')}</span>
                                    <div className="mt-2">
                                      <span className={`text-[9px] font-extrabold px-2.5 py-0.5 rounded-full border ${o.balanceDue > 0 ? 'bg-neutral-50 dark:bg-neutral-900 text-neutral-600 dark:text-neutral-400 border-[var(--border)]' : 'bg-emerald-50 dark:bg-emerald-950/20 text-emerald-700 dark:text-emerald-400 border-emerald-100'}`}>
                                        {o.paymentStatus}
                                      </span>
                                    </div>
                                  </div>
                                </div>
                              ))}
                            </div>

                            <button
                              onClick={() => {
                                setNewOrderForm({
                                  ...newOrderForm,
                                  customerName: selectedCustomerProfile.name,
                                  phone: selectedCustomerProfile.phone || '',
                                });
                                setActiveSheet('new-order');
                              }}
                              className="w-full bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-white font-semibold py-4 rounded-2xl shadow-md transition-all active:scale-[0.99] flex items-center justify-center gap-2 mt-auto cursor-pointer"
                            >
                              <Plus size={16} /> New Order for {selectedCustomerProfile.name.split(' ')[0]}
                            </button>
                          </>
                        )}
                      </div>
                    )}

                    {/* SHEET: PROFILE & LEGAL (real data, read-only) —
                        renamed from "Edit Profile & Legal": there is no
                        PUT endpoint for businessName/ownerName/fssaiNumber/
                        whatsappReceiptEnabled, only for UPI settings. A save
                        button here would silently do nothing real, so this
                        is now a real-data viewer, not an editor. Flagging
                        this clearly — if profile editing is expected to
                        work, the backend needs a new endpoint first. */}
                    {activeSheet === 'edit-profile' && (
                      <div className="flex-1 flex flex-col">
                        <div className="flex justify-between items-center mb-6">
                          <button onClick={() => setActiveSheet('none')} className="p-1.5 text-[var(--text-secondary)] hover:text-[var(--text-primary)] rounded-full hover:bg-neutral-100 dark:hover:bg-neutral-900"><X size={20} /></button>
                          <h3 className="font-serif text-xl md:text-2xl font-bold">Profile & Legal</h3>
                          <span className="w-8" />
                        </div>

                        {/* Skeleton/error only gate the TRUE first load (no
                            cached profile yet). Once bakerProfile exists,
                            the form stays mounted through any background
                            refetch (e.g. after Save, or after a photo
                            upload) — fetchBakerProfile briefly flips
                            bakerProfileLoading back to true, which
                            previously unmounted this whole form via this
                            same condition, causing a full skeleton flash
                            and lost scroll position on every save. */}
                        {bakerProfileLoading && !bakerProfile && (
                          <div className="flex flex-col gap-4">
                            <div className="h-24 bg-[var(--text-primary)]/8 rounded-2xl animate-pulse" />
                            <div className="h-24 bg-[var(--text-primary)]/8 rounded-2xl animate-pulse" />
                          </div>
                        )}

                        {bakerProfileError && !bakerProfile && (
                          <div className="bg-red-50 dark:bg-red-950/20 border border-red-200/50 text-red-700 dark:text-red-400 p-4 rounded-2xl text-xs font-medium flex items-center gap-2">
                            <AlertCircle size={14} /> {bakerProfileError}
                          </div>
                        )}

                        {bakerProfile && (
                          <form onSubmit={handleSaveProfile} className="flex flex-col gap-6 pb-6 overflow-y-auto">

                            {editProfileError && (
                              <div className="bg-red-50 dark:bg-red-950/20 border border-red-200/50 text-red-700 dark:text-red-400 p-3 rounded-xl text-[11px] font-medium flex items-center gap-2">
                                <AlertCircle size={13} /> {editProfileError}
                              </div>
                            )}
                            {editProfileSuccess && (
                              <div className="bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200/50 text-emerald-700 dark:text-emerald-400 p-3 rounded-xl text-[11px] font-medium flex items-center gap-2">
                                <CheckCircle2 size={13} /> Profile updated.
                              </div>
                            )}
                            {logoUploadError && (
                              <div className="bg-red-50 dark:bg-red-950/20 border border-red-200/50 text-red-700 dark:text-red-400 p-3 rounded-xl text-[11px] font-medium flex items-center gap-2">
                                <AlertCircle size={13} /> {logoUploadError}
                              </div>
                            )}

                            {/* Profile picture — POST /api/uploads/signed-url + /confirm */}
                            <div className="flex flex-col items-center gap-3">
                              <div className="w-20 h-20 rounded-full overflow-hidden bg-[var(--background)] border border-[var(--border)] flex items-center justify-center text-2xl font-bold text-[var(--text-secondary)]">
                                {bakerProfile.business.logoUrl ? (
                                  // eslint-disable-next-line @next/next/no-img-element
                                  <img src={bakerProfile.business.logoUrl} alt="Profile" className="w-full h-full object-cover" />
                                ) : (
                                  (bakerProfile.business.ownerName || bakerProfile.business.businessName || '?').charAt(0)
                                )}
                              </div>
                              <label className="text-xs font-bold text-[var(--accent)] cursor-pointer hover:underline">
                                {logoUploading ? 'Uploading...' : 'Change Photo'}
                                <input
                                  type="file"
                                  accept="image/png,image/jpeg,image/webp"
                                  className="hidden"
                                  disabled={logoUploading}
                                  onChange={(e) => {
                                    const file = e.target.files?.[0];
                                    if (file) handleProfilePictureUpload(file);
                                    e.target.value = '';
                                  }}
                                />
                              </label>
                            </div>

                            <div>
                              <h4 className="text-xs font-bold text-[var(--text-secondary)] uppercase tracking-wider mb-4 flex items-center gap-1.5">
                                🏪 Bakery Brand Identity
                              </h4>
                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                <div>
                                  <label className="text-[10px] font-bold text-[var(--text-secondary)] mb-1 block">Business / Bakery Name</label>
                                  <div className="w-full bg-[var(--background)] border border-[var(--border)] rounded-xl py-3 px-4 text-xs">{bakerProfile.business.businessName || '—'}</div>
                                </div>
                                <div>
                                  <label className="text-[10px] font-bold text-[var(--text-secondary)] mb-1 block">Owner Full Name</label>
                                  <input
                                    type="text"
                                    value={editProfileForm.ownerName}
                                    onChange={(e) => setEditProfileForm({ ...editProfileForm, ownerName: e.target.value })}
                                    className="w-full bg-[var(--background)] border border-[var(--border)] rounded-xl py-3 px-4 text-xs outline-none focus:border-[var(--accent)]"
                                  />
                                </div>
                              </div>
                              <div className="mt-3">
                                <label className="text-[10px] font-bold text-[var(--text-secondary)] mb-1 block">Phone Number</label>
                                <input
                                  type="tel"
                                  placeholder="10-digit mobile number"
                                  value={editProfileForm.phone}
                                  onChange={(e) => setEditProfileForm({ ...editProfileForm, phone: e.target.value })}
                                  className="w-full bg-[var(--background)] border border-[var(--border)] rounded-xl py-3 px-4 text-xs outline-none focus:border-[var(--accent)]"
                                />
                                <p className="text-[10px] text-[var(--text-secondary)] mt-1">Contact info only — login is by email, this number isn't used to sign in.</p>
                              </div>
                            </div>

                            <div>
                              <h4 className="text-xs font-bold text-[var(--text-secondary)] uppercase tracking-wider mb-3 flex items-center gap-1.5">
                                % Payment Defaults
                              </h4>
                              <label className="text-[10px] font-bold text-[var(--text-secondary)] mb-1 block">Default Advance Percentage</label>
                              <input
                                type="number"
                                min="0"
                                max="100"
                                placeholder="e.g. 50"
                                value={editProfileForm.defaultAdvancePercentage}
                                onChange={(e) => setEditProfileForm({ ...editProfileForm, defaultAdvancePercentage: e.target.value })}
                                className="w-full bg-[var(--background)] border border-[var(--border)] rounded-xl py-3 px-4 text-xs outline-none focus:border-[var(--accent)] font-bold"
                              />
                              <p className="text-[10px] text-[var(--text-secondary)] mt-1">Suggests an advance amount when logging a New Order — doesn't block orders with a different advance.</p>
                            </div>

                            <div>
                              <h4 className="text-xs font-bold text-[var(--text-secondary)] uppercase tracking-wider mb-3 flex items-center gap-1.5">
                                🛡️ Regulatory Compliance
                              </h4>
                              <h5 className="text-xs font-bold text-[var(--text-primary)] mb-1">FSSAI License</h5>
                              <div className="flex gap-2">
                                <div className="flex-1 bg-[var(--background)] border border-[var(--border)] rounded-xl py-3 px-4 text-xs">{bakerProfile.verification.fssaiNumber || 'Not on file'}</div>
                                {bakerProfile.verification.fssaiNumber && (
                                  <span className={`text-xs font-bold px-3.5 py-3 rounded-xl border flex items-center justify-center ${bakerProfile.verification.fssaiVerified ? 'bg-emerald-50 dark:bg-emerald-950/20 text-emerald-700 dark:text-emerald-400 border-emerald-100' : 'bg-neutral-50 dark:bg-neutral-900 text-neutral-600 dark:text-neutral-400 border-[var(--border)]'}`}>
                                    {bakerProfile.verification.fssaiVerified ? 'Verified ✓' : 'Pending'}
                                  </span>
                                )}
                              </div>
                            </div>

                            <div>
                              <h4 className="text-xs font-bold text-[var(--text-secondary)] uppercase tracking-wider mb-3 flex items-center gap-1.5">
                                ⚙️ Notification Preference
                              </h4>
                              <div className="flex justify-between items-center">
                                <span className="text-xs font-medium text-[var(--text-primary)]">WhatsApp receipts suggested by default</span>
                                <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full border ${bakerProfile.payment.whatsappReceiptEnabled ? 'bg-emerald-50 dark:bg-emerald-950/20 text-emerald-700 dark:text-emerald-400 border-emerald-100' : 'bg-neutral-50 dark:bg-neutral-900 text-neutral-600 dark:text-neutral-400 border-[var(--border)]'}`}>
                                  {bakerProfile.payment.whatsappReceiptEnabled ? 'On' : 'Off'}
                                </span>
                              </div>
                            </div>

                            <button
                              type="submit"
                              disabled={editProfileSubmitting}
                              className="w-full bg-[var(--accent)] hover:bg-[var(--accent-hover)] disabled:opacity-60 text-white font-semibold py-4 rounded-2xl shadow-md transition-all active:scale-[0.99] flex items-center justify-center gap-2 mt-2 cursor-pointer"
                            >
                              {editProfileSubmitting ? (
                                <>
                                  <span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                                  Saving...
                                </>
                              ) : (
                                <>
                                  <Check size={16} /> Save Changes
                                </>
                              )}
                            </button>

                          </form>
                        )}
                      </div>
                    )}

                    {/* SHEET: MANAGE UPI COLLECTION (real, functional — the
                        only profile field with an actual PUT endpoint) */}
                    {activeSheet === 'manage-upi' && (
                      <form onSubmit={handleSaveUpiSettings} className="flex-1 flex flex-col">
                        <div className="flex justify-between items-center mb-6">
                          <button type="button" onClick={() => setActiveSheet('none')} className="p-1.5 text-[var(--text-secondary)] hover:text-[var(--text-primary)] rounded-full hover:bg-neutral-100 dark:hover:bg-neutral-900"><X size={20} /></button>
                          <h3 className="font-serif text-xl md:text-2xl font-bold">Manage UPI Collection</h3>
                          <span className="w-8" />
                        </div>

                        <div className="flex flex-col gap-6 pb-6 overflow-y-auto">

                          {upiError && (
                            <div className="bg-red-50 dark:bg-red-950/20 border border-red-200/50 text-red-700 dark:text-red-400 p-3 rounded-xl text-[11px] font-medium flex items-center gap-2">
                              <AlertCircle size={13} /> {upiError}
                            </div>
                          )}
                          {upiSuccess && (
                            <div className="bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200/50 text-emerald-700 dark:text-emerald-400 p-3 rounded-xl text-[11px] font-medium flex items-center gap-2">
                              <CheckCircle2 size={13} /> UPI settings updated.
                            </div>
                          )}

                          {/* Sec 1: VPA */}
                          <div>
                            <h4 className="text-xs font-bold text-[var(--text-secondary)] uppercase tracking-wider mb-3 flex items-center gap-1.5">
                              ⚡ 1. Virtual Payment Address (VPA)
                            </h4>
                            <label className="text-[10px] font-bold text-[var(--text-secondary)] mb-1 block">Your UPI ID</label>
                            <input
                              type="text"
                              value={upiForm.upiId}
                              onChange={(e) => setUpiForm({ ...upiForm, upiId: e.target.value })}
                              placeholder="yourname@okaxis"
                              className="w-full bg-[var(--background)] border border-[var(--border)] rounded-xl py-3 px-4 text-xs font-bold outline-none"
                              required
                            />
                            <p className="text-[10px] text-[var(--text-secondary)] mt-2">All automated payment links and WhatsApp advance requests will route to this VPA.</p>
                          </div>

                          <div>
                            <label className="text-[10px] font-bold text-[var(--text-secondary)] mb-1 block">Merchant display name (optional)</label>
                            <input
                              type="text"
                              value={upiForm.merchantName}
                              onChange={(e) => setUpiForm({ ...upiForm, merchantName: e.target.value })}
                              className="w-full bg-[var(--background)] border border-[var(--border)] rounded-xl py-3 px-4 text-xs outline-none"
                            />
                          </div>

                          <div className="flex justify-between items-center">
                            <span className="text-xs font-medium text-[var(--text-primary)]">Enable dynamic QR</span>
                            <label className="relative inline-flex items-center cursor-pointer">
                              <input
                                type="checkbox"
                                checked={upiForm.generateDynamicQR}
                                onChange={() => setUpiForm({ ...upiForm, generateDynamicQR: !upiForm.generateDynamicQR })}
                                className="sr-only peer"
                              />
                              <div className="w-9 h-5 bg-neutral-200 peer-focus:outline-none rounded-full peer dark:bg-neutral-800 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all dark:border-gray-600 peer-checked:bg-[var(--accent)]"></div>
                            </label>
                          </div>

                          {/* Dynamic QR preview kept as decoration — not backed
                              by a real generated QR; no bank-settlement
                              endpoint exists, so the mock's fabricated
                              "HDFC Bank •••• 4092" account card was removed
                              rather than shown as if it were real. */}
                          {upiForm.generateDynamicQR && (
                            <div className="flex flex-col items-center">
                              <div className="w-48 h-48 bg-white rounded-3xl border border-[var(--border)] shadow-sm flex flex-col items-center justify-center p-5 relative select-none">
                                <div className="w-full h-full border-4 border-dashed border-neutral-100 rounded-2xl flex items-center justify-center relative">
                                  <div className="grid grid-cols-5 gap-2.5 w-32 h-32 opacity-80">
                                    {Array.from({ length: 25 }).map((_, i) => {
                                      const fill = [0, 4, 6, 8, 12, 14, 16, 18, 20, 24].includes(i);
                                      return (
                                        <div key={i} className={`rounded-sm ${fill ? 'bg-[#2D1B14]' : 'bg-neutral-100'}`} />
                                      );
                                    })}
                                  </div>
                                  <div className="absolute w-10 h-10 bg-white rounded-full shadow-md border border-[var(--border)] flex items-center justify-center z-10">
                                    <div className="w-5 h-5 bg-[#2D1B14] rounded-full flex items-center justify-center">
                                      <span className="text-[9px] font-bold text-white">k</span>
                                    </div>
                                  </div>
                                </div>
                              </div>
                              <p className="text-[10px] text-[var(--text-secondary)] mt-3">Illustrative preview only.</p>
                            </div>
                          )}

                        </div>

                        <button
                          type="submit"
                          disabled={upiSubmitting}
                          className="w-full bg-[var(--accent)] hover:bg-[var(--accent-hover)] disabled:opacity-60 text-white font-semibold py-4 rounded-2xl shadow-md transition-all active:scale-[0.99] flex items-center justify-center gap-2 mt-auto cursor-pointer"
                        >
                          {upiSubmitting ? 'Saving...' : '✓ Update UPI Settings'}
                        </button>
                      </form>
                    )}

                    {/* SHEET: SUBSCRIPTION & AUTOPAY (real data, GET /api/billing/status).
                        The mandate section and invoices list had no backing
                        endpoint at all (no list-invoices API, no mandate
                        detail beyond autoRenew) — replaced with what's real. */}
                    {activeSheet === 'subscription-autopay' && (
                      <div className="flex-1 flex flex-col">
                        <div className="flex justify-between items-center mb-6">
                          <button onClick={() => setActiveSheet('none')} className="p-1.5 text-[var(--text-secondary)] hover:text-[var(--text-primary)] rounded-full hover:bg-neutral-100 dark:hover:bg-neutral-900"><X size={20} /></button>
                          <h3 className="font-serif text-xl md:text-2xl font-bold">Subscription & AutoPay</h3>
                          {billingStatus && (
                            <span className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full border ${billingStatus.subscriptionStatus === 'ACTIVE' ? 'bg-emerald-50 dark:bg-emerald-950/20 text-emerald-700 dark:text-emerald-400 border-emerald-100' : 'bg-neutral-50 dark:bg-neutral-900 text-neutral-600 dark:text-neutral-400 border-[var(--border)]'}`}>
                              {billingStatus.subscriptionStatus}
                            </span>
                          )}
                        </div>

                        {billingLoading && (
                          <div className="h-40 bg-[var(--text-primary)]/8 rounded-2xl animate-pulse" />
                        )}

                        {billingError && (
                          <div className="bg-red-50 dark:bg-red-950/20 border border-red-200/50 text-red-700 dark:text-red-400 p-4 rounded-2xl text-xs font-medium flex items-center gap-2">
                            <AlertCircle size={14} /> {billingError}
                          </div>
                        )}

                        {!billingLoading && !billingError && billingStatus && (
                          <div className="flex flex-col gap-6 pb-6 overflow-y-auto">

                            <div>
                              <h4 className="text-xs font-bold text-[var(--text-secondary)] uppercase tracking-wider mb-3 flex items-center gap-1.5">
                                👑 Plan & Trial Status
                              </h4>

                              <div className="bg-[var(--surface)] p-5 rounded-2xl border border-[var(--border)] shadow-sm">
                                <div className="flex justify-between items-center py-1">
                                  <span className="text-xs text-[var(--text-secondary)]">Current Plan</span>
                                  <span className="text-xs font-bold">{billingStatus.plan || '—'}</span>
                                </div>
                                <div className="flex justify-between items-center py-2 border-t border-[var(--border)]/50 mt-2.5">
                                  <span className="text-xs text-[var(--text-secondary)]">Auto-renew</span>
                                  <span className="text-xs font-bold">{billingStatus.autoRenew ? 'On' : 'Off'}</span>
                                </div>
                                {billingStatus.nextBillingDate && (
                                  <div className="flex justify-between items-center py-2 border-t border-[var(--border)]/50 mt-2.5">
                                    <span className="text-xs text-[var(--text-secondary)]">Next billing date</span>
                                    <span className="text-xs font-bold">{billingStatus.nextBillingDate}</span>
                                  </div>
                                )}

                                {billingStatus.subscriptionStatus === 'TRIAL' && (
                                  <div className="bg-orange-50/50 dark:bg-[#1A0C06] border border-orange-100/50 p-4 rounded-xl flex items-center gap-3.5 mt-4">
                                    <span className="text-3xl">📅</span>
                                    <div>
                                      <h5 className="font-bold text-xs text-[var(--accent)]">Trial Active: {billingStatus.trialDaysRemaining} Days Remaining</h5>
                                      {billingStatus.trialEndDate && (
                                        <p className="text-[10px] text-[var(--text-secondary)] mt-0.5">Ends {billingStatus.trialEndDate}</p>
                                      )}
                                    </div>
                                  </div>
                                )}
                              </div>
                            </div>

                            <div className="bg-orange-50/50 dark:bg-[#1A0C06] border border-orange-100/50 p-3 rounded-xl text-[10px] text-[var(--text-secondary)] flex items-center gap-2">
                              <Info size={13} /> Invoice/billing history isn't available via the API yet.
                            </div>

                          </div>
                        )}

                        <button
                          onClick={() => setActiveSheet('choose-plan')}
                          className="w-full bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-white font-semibold py-4 rounded-2xl shadow-md transition-all active:scale-[0.99] flex items-center justify-center gap-2 mt-auto cursor-pointer"
                        >
                          🔒 Manage Plan on Razorpay
                        </button>
                      </div>
                    )}

                    {/* SHEET: CHOOSE YOUR PLAN */}
                    {activeSheet === 'choose-plan' && (
                      <div className="flex-1 flex flex-col animate-fadeIn">
                        <div className="flex justify-between items-center mb-6">
                          <button onClick={() => setActiveSheet('none')} className="p-1.5 text-[var(--text-secondary)] hover:text-[var(--text-primary)] rounded-full hover:bg-neutral-100 dark:hover:bg-neutral-900"><X size={20} /></button>
                          <h3 className="font-serif text-xl md:text-2xl font-bold">Choose Your Plan</h3>
                          <div className="w-6"></div>
                        </div>

                        <div className="flex flex-col gap-6 pb-6 overflow-y-auto">
                          <div className="text-center flex flex-col items-center">
                            <span className="text-3xl">🛡️</span>
                            <p className="text-xs text-[var(--text-secondary)] mt-2 max-w-sm leading-relaxed">Unlock full workflow automation and digital escrow protection.</p>
                          </div>

                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            {/* Plan 1 (Selected) */}
                            <div className="bg-[var(--surface)] p-5 rounded-2xl border-2 border-[var(--accent)] shadow-sm relative cursor-pointer flex flex-col justify-between">
                              <div>
                                <div className="flex justify-between items-center">
                                  <span className="inline-flex text-[9px] font-extrabold text-white bg-[var(--accent)] px-2 py-0.5 rounded-full uppercase tracking-wider">
                                    3 Months Free • Most Popular
                                  </span>
                                  <span className="w-4 h-4 rounded-full bg-[var(--accent)] flex items-center justify-center text-white text-[9px]">✓</span>
                                </div>

                                <h4 className="font-serif font-bold text-base text-[var(--text-primary)] mt-3">Early Adopter Pro</h4>
                                <span className="text-xl font-extrabold mt-1 block">₹149 <span className="text-xs text-[var(--text-secondary)] font-normal">/ month</span></span>
                              </div>

                              <ul className="mt-4 flex flex-col gap-2 text-xs text-[var(--text-secondary)] font-medium pt-3 border-t border-[var(--border)]/50">
                                <li className="flex items-center gap-2 text-[var(--text-primary)]">
                                  <span className="text-orange-600">✓</span> Unlimited Orders
                                </li>
                                <li className="flex items-center gap-2 text-[var(--text-primary)]">
                                  <span className="text-orange-600">✓</span> WhatsApp Receipts
                                </li>
                                <li className="flex items-center gap-2 text-[var(--text-primary)]">
                                  <span className="text-orange-600">✓</span> Margin Tracking
                                </li>
                              </ul>
                            </div>

                            {/* Plan 2 */}
                            <div className="bg-[var(--surface)] p-5 rounded-2xl border border-[var(--border)] shadow-sm relative opacity-60 flex flex-col justify-between">
                              <div>
                                <span className="inline-flex text-[9px] font-extrabold text-[var(--text-secondary)] bg-neutral-100 px-2 py-0.5 rounded-full uppercase tracking-wider">
                                  Coming Soon
                                </span>

                                <h4 className="font-serif font-bold text-base text-[var(--text-primary)] mt-3">Growth Pro</h4>
                                <span className="text-xl font-extrabold mt-1 block">₹299 <span className="text-xs text-[var(--text-secondary)] font-normal">/ month</span></span>
                              </div>

                              <ul className="mt-4 flex flex-col gap-2 text-xs text-[var(--text-secondary)] pt-3 border-t border-[var(--border)]/50">
                                <li className="flex items-center gap-2">
                                  <span>✓</span> Multi-staff access
                                </li>
                                <li className="flex items-center gap-2">
                                  <span>✓</span> Advanced analytics
                                </li>
                                <li className="flex items-center gap-2">
                                  <span>✓</span> Supply routing
                                </li>
                              </ul>
                            </div>
                          </div>

                          <div className="bg-neutral-50 p-4 rounded-xl flex items-center justify-between border border-neutral-100">
                            <div className="flex items-center gap-3 text-xs">
                              <span>🔒</span>
                              <div>
                                <h5 className="font-bold text-[10px]">Secure recurring billing via Razorpay UPI AutoPay</h5>
                                <p className="text-[9px] text-[var(--text-secondary)] mt-0.5">Cancel anytime. No hidden fees.</p>
                              </div>
                            </div>
                          </div>

                        </div>

                        {subscriptionError && (
                          <div className="bg-red-50 dark:bg-red-950/20 border border-red-200/50 text-red-700 dark:text-red-400 p-3 rounded-xl text-[11px] font-medium flex items-center gap-2 mb-3">
                            <AlertCircle size={13} /> {subscriptionError}
                          </div>
                        )}
                        <button
                          onClick={handleConfirmSubscription}
                          disabled={subscriptionSubmitting}
                          className="w-full bg-[var(--accent)] hover:bg-[var(--accent-hover)] disabled:opacity-60 text-white font-semibold py-4 rounded-2xl shadow-md transition-all active:scale-[0.99] flex items-center justify-center gap-2 mt-auto cursor-pointer"
                        >
                          {subscriptionSubmitting ? 'Starting...' : '✓ Confirm Early Adopter Plan & Setup AutoPay'}
                        </button>
                      </div>
                    )}

                    {/* SHEET: SUBSCRIPTION WARNING */}
                    {activeSheet === 'subscription-status' && (
                      <div className="flex-1 flex flex-col">
                        <div className="flex justify-between items-center mb-6">
                          <button onClick={() => setActiveSheet('none')} className="p-1.5 text-[var(--text-secondary)] hover:text-[var(--text-primary)] rounded-full hover:bg-neutral-100 dark:hover:bg-neutral-900"><X size={20} /></button>
                          <h3 className="font-serif text-xl md:text-2xl font-bold">Subscription</h3>
                          <div className="w-6"></div>
                        </div>

                        <div className="flex flex-col gap-6 pb-6 overflow-y-auto">

                          {/* Trial alert */}
                          <div className="bg-orange-50 dark:bg-amber-950/20 border border-orange-100/50 dark:border-amber-900 p-4 rounded-2xl flex items-center gap-3.5">
                            <span className="text-3xl">🎂</span>
                            <div>
                              <h4 className="font-bold text-sm text-[var(--text-primary)]">Your free trial is ending soon.</h4>
                              <div className="inline-flex items-center gap-1 bg-[var(--accent)] text-white px-2.5 py-0.5 rounded-full text-[10.5px] font-semibold mt-1.5">
                                🕒 {bakerProfile?.subscription.trialDaysRemaining ?? '—'} Days Remaining
                              </div>
                            </div>
                          </div>

                          {/* Early Adopter Pro plan card */}
                          <div className="bg-[var(--surface)] p-5 rounded-2xl border border-[var(--border)] shadow-sm">
                            <div className="flex justify-between items-center">
                              <h4 className="font-serif font-bold text-base flex items-center gap-2">
                                👑 Early Adopter Pro Plan
                              </h4>
                              <span className="bg-orange-50 dark:bg-amber-950/20 text-[10px] font-bold text-[var(--accent)] px-2.5 py-0.5 rounded-full border border-orange-100 dark:border-amber-900">Locked-in Price</span>
                            </div>

                            <span className="text-3xl font-extrabold block mt-3 text-[var(--text-primary)]">
                              ₹149 <span className="text-xs text-[var(--text-secondary)] font-normal">/ month</span>
                            </span>

                            <ul className="mt-4 flex flex-col gap-2.5 text-xs text-[var(--text-secondary)] font-semibold border-t border-[var(--border)]/50 pt-3.5">
                              <li className="flex items-center gap-2 text-[var(--text-primary)]">
                                <span className="text-orange-600">✓</span> Unlimited Orders & CRM
                              </li>
                              <li className="flex items-center gap-2 text-[var(--text-primary)]">
                                <span className="text-orange-600">✓</span> Automated WhatsApp Receipts
                              </li>
                              <li className="flex items-center gap-2 text-[var(--text-primary)]">
                                <span className="text-orange-600">✓</span> Margin Tracking Dashboard
                              </li>
                            </ul>
                          </div>

                          <div className="flex flex-col gap-3">
                            <div className="flex items-center gap-2.5 font-serif font-bold text-sm px-1">
                              <span>🔒</span>
                              <h5>Setup AutoPay to keep your cockpit running.</h5>
                            </div>

                            <div className="flex items-center gap-2 bg-emerald-50 dark:bg-emerald-950/20 p-3.5 rounded-xl border border-emerald-100/50 text-[10.5px] text-emerald-800 dark:text-emerald-400">
                              <CheckCircle2 size={16} className="flex-shrink-0" />
                              <span><strong>100% Secure & RBI Compliant</strong><br />Your payments are protected with bank-level security. We never store your UPI details.</span>
                            </div>
                          </div>

                        </div>

                        <button
                          onClick={() => setActiveSheet('subscription-autopay')}
                          className="w-full bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-white font-semibold py-4 rounded-2xl shadow-md transition-all active:scale-[0.99] flex items-center justify-center gap-2 mt-auto cursor-pointer"
                        >
                          🔒 Set Up UPI AutoPay
                        </button>
                      </div>
                    )}

                    {/* SHEET: HELP & SUPPORT */}
                    {activeSheet === 'help-support' && (
                      <div className="flex-1 flex flex-col">
                        <div className="flex justify-between items-center mb-6">
                          <button onClick={() => setActiveSheet('none')} className="p-1.5 text-[var(--text-secondary)] hover:text-[var(--text-primary)] rounded-full hover:bg-neutral-100 dark:hover:bg-neutral-900"><X size={20} /></button>
                          <h3 className="font-serif text-xl md:text-2xl font-bold">Help & Support</h3>
                          <div className="w-6"></div>
                        </div>

                        <div className="flex flex-col gap-6 pb-6 overflow-y-auto">

                          {/* WhatsApp support callout */}
                          <div className="bg-[var(--surface)] p-5 rounded-2xl border border-[var(--border)] shadow-sm flex flex-col items-center text-center">
                            <div className="w-16 h-16 rounded-full bg-emerald-50 dark:bg-emerald-950/20 text-emerald-600 dark:text-emerald-400 flex items-center justify-center text-3xl border border-emerald-100 dark:border-emerald-900 mb-3 shadow-inner">
                              💬
                            </div>
                            <h4 className="font-serif font-bold text-lg text-[var(--text-primary)]">Chat with Kamai Support</h4>
                            <p className="text-xs text-[var(--text-secondary)] mt-1 max-w-sm leading-relaxed">Got an issue with an order or UPI payout? We reply in under 10 minutes.</p>

                            <button
                              type="button"
                              onClick={() => window.open('https://wa.me/919876543210', '_blank')}
                              className="w-full bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-white font-semibold py-3.5 rounded-xl shadow-md transition-all active:scale-[0.98] flex items-center justify-center gap-2 mt-4 text-xs cursor-pointer"
                            >
                              <Send size={14} className="rotate-45" /> Open WhatsApp Chat
                            </button>

                            <span className="text-[9.5px] text-[var(--text-secondary)] mt-2 font-medium">✓ 100% Safe & Secure • We never ask for your OTP or PIN</span>
                          </div>

                          {/* Frequently Asked Questions */}
                          <div className="bg-[var(--surface)] rounded-2xl border border-[var(--border)] p-5 shadow-sm">
                            <h4 className="font-serif font-bold text-sm mb-4">Frequently Asked Questions</h4>

                            <div className="flex flex-col gap-3">
                              <div className="border-b border-[var(--border)]/50 pb-2.5">
                                <h5 className="font-bold text-xs text-[var(--text-primary)] flex items-center justify-between cursor-pointer">
                                  1. How do I secure 100% upfront UPI payments?
                                  <ChevronDown size={14} />
                                </h5>
                              </div>
                              <div className="border-b border-[var(--border)]/50 pb-2.5">
                                <h5 className="font-bold text-xs text-[var(--text-primary)] flex items-center justify-between cursor-pointer">
                                  2. How does the raw material cost calculator work?
                                  <ChevronDown size={14} />
                                </h5>
                              </div>
                              <div className="pb-1">
                                <h5 className="font-bold text-xs text-[var(--text-primary)] flex items-center justify-between cursor-pointer">
                                  3. What happens after my 90-day free trial?
                                  <ChevronDown size={14} />
                                </h5>
                              </div>
                            </div>
                          </div>

                          {/* Issue reporting */}
                          <div className="bg-red-50/50 dark:bg-red-950/10 p-4 rounded-2xl border border-red-200/40 dark:border-red-900 flex items-center justify-between cursor-pointer hover:bg-red-50 dark:hover:bg-red-950/20 transition-colors">
                            <div className="flex items-center gap-3">
                              <span className="text-2xl">🐛</span>
                              <div>
                                <h5 className="font-bold text-xs text-red-800 dark:text-red-400">Report a Technical Bug or Issue</h5>
                                <p className="text-[10px] text-red-600/70 dark:text-red-400/70 mt-0.5">Let us know and we&apos;ll fix it quickly.</p>
                              </div>
                            </div>
                            <ChevronRight size={16} className="text-red-400 dark:text-red-500" />
                          </div>

                          <div className="text-center text-[10px] text-[var(--text-secondary)] mt-4">
                            <p>We&apos;re here to help you grow!</p>
                            <p className="font-semibold text-[var(--text-primary)] mt-1">Your success is our success.</p>
                            <p className="mt-4 border-t border-[var(--border)]/50 pt-3.5">Kamai OMS • Built for Independent Indian Bakers v1.0</p>
                          </div>

                        </div>
                      </div>
                    )}

                    {/* SHEET: LEGAL & POLICIES */}
                    {activeSheet === 'legal-policies' && (
                      <div className="flex-1 flex flex-col">
                        <div className="flex justify-between items-center mb-6">
                          <button onClick={() => setActiveSheet('none')} className="p-1.5 text-[var(--text-secondary)] hover:text-[var(--text-primary)] rounded-full hover:bg-neutral-100 dark:hover:bg-neutral-900"><X size={20} /></button>
                          <h3 className="font-serif text-xl md:text-2xl font-bold">Legal & Policies</h3>
                          <div className="w-6"></div>
                        </div>

                        <div className="flex flex-col gap-6 pb-6 overflow-y-auto">

                          <div className="bg-orange-50/50 dark:bg-[#1A0C06] p-4 rounded-2xl border border-orange-100/50 flex items-center gap-3">
                            <span className="text-2xl">🛡️</span>
                            <div>
                              <h4 className="font-bold text-xs text-[var(--text-primary)]">Last updated: October 2026</h4>
                              <p className="text-[10px] text-[var(--text-secondary)] mt-0.5">Review Kamai&apos;s merchant terms, data protection standards, and refund policies.</p>
                            </div>
                          </div>

                          <div className="flex flex-col gap-2">
                            <h4 className="font-serif font-bold text-sm text-[var(--text-primary)]">1. Merchant Terms of Service</h4>
                            <p className="text-[10.5px] text-[var(--text-secondary)] leading-relaxed">
                              By accessing or using Kamai (the &quot;Platform&quot;), you agree to be bound by these Terms of Service. Kamai is an Order Management System built for independent home bakers to manage orders, customers, invoices, payments, and business insights.
                            </p>
                            <p className="text-[10.5px] text-[var(--text-secondary)] leading-relaxed">
                              You are responsible for maintaining the accuracy of your business information, fulfilling orders on time, and complying with all applicable laws and food safety regulations in India.
                            </p>
                          </div>

                          <div className="flex flex-col gap-2">
                            <h4 className="font-serif font-bold text-sm text-[var(--text-primary)]">2. Data Protection & Privacy Policy</h4>
                            <p className="text-[10.5px] text-[var(--text-secondary)] leading-relaxed">
                              We take your privacy seriously. Kamai securely stores your data on Supabase, a globally trusted and secure database infrastructure. We collect and store only the data necessary to operate the Platform, including customer phone numbers, order details, payment history, and business metrics.
                            </p>
                          </div>

                          <div className="flex flex-col gap-2 mb-6">
                            <h4 className="font-serif font-bold text-sm text-[var(--text-primary)]">3. Subscription & Cancellation Policy</h4>
                            <p className="text-[10.5px] text-[var(--text-secondary)] leading-relaxed">
                              Kamai offers a 90-day free trial for all new bakers. After the trial, you will be charged ₹149 per month via Razorpay UPI AutoPay. You may cancel your subscription at any time.
                            </p>
                          </div>

                        </div>

                        <button
                          type="button"
                          className="w-full bg-[var(--surface)] text-[var(--accent)] border border-[var(--accent)]/50 hover:bg-orange-50 dark:hover:bg-orange-950/20 font-semibold py-4 rounded-2xl transition-all active:scale-[0.99] flex items-center justify-center gap-2 mt-auto cursor-pointer"
                        >
                          📄 Download Terms as PDF
                        </button>
                      </div>
                    )}

                    {/* SHEET: MY MENU (Action 26 — Shareable Menu Link,
                        Screen A) — real GET /api/menu-items. Card styling
                        mirrors the Expenses/Investment Ledger list; the
                        sheet chrome (header/close/backdrop) mirrors
                        Edit Profile & Manage UPI. */}
                    {activeSheet === 'my-menu' && (
                      <div className="flex-1 flex flex-col">
                        <div className="flex justify-between items-center mb-6">
                          <button onClick={() => setActiveSheet('none')} className="p-1.5 text-[var(--text-secondary)] hover:text-[var(--text-primary)] rounded-full hover:bg-neutral-100 dark:hover:bg-neutral-900"><X size={20} /></button>
                          <h3 className="font-serif text-xl md:text-2xl font-bold">My Menu</h3>
                          <button
                            type="button"
                            onClick={openAddMenuItem}
                            className="p-1.5 text-[var(--accent)] hover:bg-orange-50 dark:hover:bg-orange-950/20 rounded-full transition-colors cursor-pointer"
                            aria-label="Add menu item"
                          >
                            <Plus size={20} strokeWidth={2.5} />
                          </button>
                        </div>

                        <div className="flex flex-col gap-3.5 overflow-y-auto pb-2">
                          {menuItemsError && (
                            <div className="bg-red-50 dark:bg-red-950/20 border border-red-200/50 text-red-700 dark:text-red-400 p-3 rounded-xl text-[11px] font-medium flex items-center gap-2">
                              <AlertCircle size={13} /> {menuItemsError}
                            </div>
                          )}

                          {menuItemsLoading &&
                            [0, 1, 2].map((i) => (
                              <div key={i} className="h-24 bg-[var(--text-primary)]/8 rounded-[22px] animate-pulse" />
                            ))}

                          {!menuItemsLoading && !menuItemsError && menuItemsList.length === 0 && (
                            <div className="text-center py-10 flex flex-col items-center gap-3">
                              <p className="text-xs text-[var(--text-secondary)] max-w-[280px]">
                                No items yet. Customers can view this menu without installing Kamai — add your first item to get started.
                              </p>
                              <button
                                type="button"
                                onClick={openAddMenuItem}
                                className="bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-white px-5 py-2.5 rounded-2xl text-xs font-bold shadow-md active:scale-95 transition-all flex items-center gap-2 cursor-pointer"
                              >
                                <Plus size={16} strokeWidth={2.5} /> Add Item
                              </button>
                            </div>
                          )}

                          {!menuItemsLoading &&
                            menuItemsList.map((item, index) => (
                              <div
                                key={item.id}
                                className="bg-[var(--surface)] p-4 rounded-[22px] border border-[var(--border)] shadow-sm flex items-center gap-3.5"
                              >
                                <div className="w-14 h-14 shrink-0 rounded-2xl overflow-hidden bg-[var(--background)] border border-[var(--border)] flex items-center justify-center text-[var(--text-secondary)]">
                                  {item.photoUrl ? (
                                    // eslint-disable-next-line @next/next/no-img-element
                                    <img src={item.photoUrl} alt={item.name} className="w-full h-full object-cover" />
                                  ) : (
                                    <UtensilsCrossed size={18} />
                                  )}
                                </div>

                                <div className="flex-1 min-w-0">
                                  <h4 className="font-bold text-sm text-[var(--text-primary)] truncate">{item.name}</h4>
                                  <p className="text-[11px] text-[var(--text-secondary)] mt-0.5">
                                    ₹{item.price.toLocaleString('en-IN')} <span className="text-[var(--text-secondary)]/80">{MENU_ITEM_UNIT_LABELS[item.unit]}</span>
                                  </p>
                                  {item.category && (
                                    <span className="inline-flex text-[9px] font-extrabold text-[var(--text-secondary)] bg-neutral-100 dark:bg-neutral-900 border border-[var(--border)] px-2.5 py-0.5 rounded-full mt-1.5 uppercase tracking-wide">
                                      {item.category}
                                    </span>
                                  )}
                                </div>

                                <div className="flex flex-col items-end gap-2 shrink-0">
                                  <button
                                    type="button"
                                    onClick={() => handleToggleMenuItemAvailability(item)}
                                    className={`text-[10px] font-bold px-2.5 py-1 rounded-full border transition-colors cursor-pointer ${item.isAvailable
                                      ? 'bg-emerald-50 dark:bg-emerald-950/20 text-emerald-700 dark:text-emerald-400 border-emerald-100'
                                      : 'bg-neutral-50 dark:bg-neutral-900 text-neutral-600 dark:text-neutral-400 border-[var(--border)]'
                                      }`}
                                  >
                                    {item.isAvailable ? 'Available' : 'Sold Out'}
                                  </button>

                                  <div className="flex items-center gap-0.5">
                                    <button
                                      type="button"
                                      disabled={index === 0 || menuItemReordering}
                                      onClick={() => handleMoveMenuItem(index, -1)}
                                      className="p-1 text-[var(--text-secondary)] hover:text-[var(--text-primary)] disabled:opacity-30 disabled:cursor-not-allowed rounded-full hover:bg-neutral-100 dark:hover:bg-neutral-900 cursor-pointer"
                                      aria-label="Move up"
                                    >
                                      <ArrowUp size={13} />
                                    </button>
                                    <button
                                      type="button"
                                      disabled={index === menuItemsList.length - 1 || menuItemReordering}
                                      onClick={() => handleMoveMenuItem(index, 1)}
                                      className="p-1 text-[var(--text-secondary)] hover:text-[var(--text-primary)] disabled:opacity-30 disabled:cursor-not-allowed rounded-full hover:bg-neutral-100 dark:hover:bg-neutral-900 cursor-pointer"
                                      aria-label="Move down"
                                    >
                                      <ArrowDown size={13} />
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => openEditMenuItem(item)}
                                      className="p-1 text-[var(--text-secondary)] hover:text-[var(--accent)] rounded-full hover:bg-neutral-100 dark:hover:bg-neutral-900 cursor-pointer"
                                      aria-label="Edit item"
                                    >
                                      <Pencil size={13} />
                                    </button>
                                    <button
                                      type="button"
                                      disabled={menuItemDeletingId === item.id}
                                      onClick={() => handleDeleteMenuItem(item)}
                                      className="p-1 text-[var(--text-secondary)] hover:text-red-600 disabled:opacity-40 rounded-full hover:bg-neutral-100 dark:hover:bg-neutral-900 cursor-pointer"
                                      aria-label="Delete item"
                                    >
                                      <Trash2 size={13} />
                                    </button>
                                  </div>
                                </div>
                              </div>
                            ))}
                        </div>
                      </div>
                    )}

                    {/* SHEET: ADD/EDIT MENU ITEM (Action 26, Screen B) —
                        real POST/PUT /api/menu-items[/:id]. Form shell
                        mirrors New Order exactly (header/section/input/
                        submit-button styling); photo upload mirrors the
                        Profile & Legal "Change Photo" flow. */}
                    {activeSheet === 'add-edit-menu-item' && (
                      <form onSubmit={handleSaveMenuItem} className="flex-1 flex flex-col">
                        <div className="flex justify-between items-center mb-6">
                          <button type="button" onClick={() => setActiveSheet('none')} className="p-1.5 text-[var(--text-secondary)] hover:text-[var(--text-primary)] rounded-full hover:bg-neutral-100 dark:hover:bg-neutral-900"><X size={20} /></button>
                          <h3 className="font-serif text-xl md:text-2xl font-bold">{menuItemFormMode === 'edit' ? 'Edit Item' : 'Add Menu Item'}</h3>
                          <span className="w-8" />
                        </div>

                        <div className="flex flex-col gap-6 overflow-y-auto pb-4">
                          {menuItemFormError && (
                            <div className="bg-red-50 dark:bg-red-950/20 border border-red-200/50 text-red-700 dark:text-red-400 p-3 rounded-xl text-[11px] font-medium flex items-center gap-2">
                              <AlertCircle size={13} /> {menuItemFormError}
                            </div>
                          )}
                          {menuItemPhotoUploadError && (
                            <div className="bg-red-50 dark:bg-red-950/20 border border-red-200/50 text-red-700 dark:text-red-400 p-3 rounded-xl text-[11px] font-medium flex items-center gap-2">
                              <AlertCircle size={13} /> {menuItemPhotoUploadError}
                            </div>
                          )}

                          {/* Photo — POST /api/uploads/signed-url (category=MENU_ITEM_PHOTO) */}
                          <div className="flex flex-col items-center gap-3">
                            <div className="w-20 h-20 rounded-2xl overflow-hidden bg-[var(--background)] border border-[var(--border)] flex items-center justify-center text-[var(--text-secondary)]">
                              {menuItemForm.photoPreviewUrl ? (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img src={menuItemForm.photoPreviewUrl} alt="Item" className="w-full h-full object-cover" />
                              ) : (
                                <UtensilsCrossed size={24} />
                              )}
                            </div>
                            <label className="text-xs font-bold text-[var(--accent)] cursor-pointer hover:underline">
                              {menuItemPhotoUploading ? 'Uploading...' : menuItemForm.photoPreviewUrl ? 'Change Photo' : 'Add Photo'}
                              <input
                                type="file"
                                accept="image/png,image/jpeg,image/webp"
                                className="hidden"
                                disabled={menuItemPhotoUploading}
                                onChange={(e) => {
                                  const file = e.target.files?.[0];
                                  if (file) handleMenuItemPhotoUpload(file);
                                  e.target.value = '';
                                }}
                              />
                            </label>
                          </div>

                          <div>
                            <h4 className="text-xs font-bold text-[var(--text-secondary)] uppercase tracking-wider mb-3 flex items-center gap-1.5">
                              🎂 Item Details
                            </h4>
                            <div className="flex flex-col gap-3">
                              <input
                                type="text"
                                placeholder="Item Name (e.g. Chocolate Truffle Cake)"
                                value={menuItemForm.name}
                                onChange={(e) => setMenuItemForm({ ...menuItemForm, name: e.target.value })}
                                className="w-full bg-[var(--background)] border border-[var(--border)] rounded-xl py-3 px-4 text-xs outline-none focus:border-[var(--accent)]"
                                required
                              />
                              <input
                                type="text"
                                list="menu-item-category-options"
                                placeholder="Category (optional, e.g. Cakes)"
                                value={menuItemForm.category}
                                onChange={(e) => setMenuItemForm({ ...menuItemForm, category: e.target.value })}
                                className="w-full bg-[var(--background)] border border-[var(--border)] rounded-xl py-3 px-4 text-xs outline-none focus:border-[var(--accent)]"
                              />
                              <datalist id="menu-item-category-options">
                                {CAKE_CATEGORIES.map((c) => <option key={c} value={c} />)}
                              </datalist>

                              <div className="grid grid-cols-2 gap-3">
                                <div className="flex items-center border border-[var(--border)] rounded-xl bg-[var(--background)] px-3 focus-within:border-[var(--accent)] transition-colors">
                                  <span className="text-[var(--text-secondary)] text-xs font-semibold">₹</span>
                                  <input
                                    type="number"
                                    step="0.01"
                                    min="0"
                                    placeholder="Price"
                                    value={menuItemForm.price}
                                    onChange={(e) => setMenuItemForm({ ...menuItemForm, price: e.target.value })}
                                    className="w-full py-3 px-2 text-xs outline-none bg-transparent font-bold"
                                    required
                                  />
                                </div>
                                <select
                                  value={menuItemForm.unit}
                                  onChange={(e) => setMenuItemForm({ ...menuItemForm, unit: e.target.value as MenuItemUnit })}
                                  className="w-full bg-[var(--background)] border border-[var(--border)] rounded-xl py-3 px-3 text-xs outline-none"
                                >
                                  {MENU_ITEM_UNITS.map((u) => (
                                    <option key={u} value={u}>{MENU_ITEM_UNIT_LABELS[u]}</option>
                                  ))}
                                </select>
                              </div>

                              <textarea
                                placeholder="Description (optional)"
                                value={menuItemForm.description}
                                onChange={(e) => setMenuItemForm({ ...menuItemForm, description: e.target.value })}
                                rows={3}
                                className="w-full bg-[var(--background)] border border-[var(--border)] rounded-xl py-3 px-4 text-xs outline-none focus:border-[var(--accent)] resize-none"
                              />
                            </div>
                          </div>
                        </div>

                        <button
                          type="submit"
                          disabled={menuItemSubmitting || menuItemPhotoUploading}
                          className="w-full bg-[var(--accent)] hover:bg-[var(--accent-hover)] disabled:opacity-60 text-white font-semibold py-4 rounded-2xl shadow-md transition-all active:scale-[0.99] flex items-center justify-center gap-2 mt-4 cursor-pointer"
                        >
                          {menuItemSubmitting ? (
                            <>
                              <span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                              Saving...
                            </>
                          ) : (
                            <>
                              <Check size={16} /> {menuItemFormMode === 'edit' ? 'Save Changes' : 'Add Item'}
                            </>
                          )}
                        </button>
                      </form>
                    )}

                    {/* SHEET: SHARE MY MENU (Action 26, Settings addition) —
                        URL built from GET /api/baker/profile's menu.menuSlug;
                        one-time edit via PATCH /api/baker/menu-slug. */}
                    {activeSheet === 'share-menu' && (
                      <div className="flex-1 flex flex-col">
                        <div className="flex justify-between items-center mb-6">
                          <button onClick={() => setActiveSheet('none')} className="p-1.5 text-[var(--text-secondary)] hover:text-[var(--text-primary)] rounded-full hover:bg-neutral-100 dark:hover:bg-neutral-900"><X size={20} /></button>
                          <h3 className="font-serif text-xl md:text-2xl font-bold">Share My Menu</h3>
                          <span className="w-8" />
                        </div>

                        {menuItemsLoading ? (
                          <div className="flex flex-col gap-4">
                            <div className="h-24 bg-[var(--text-primary)]/8 rounded-2xl animate-pulse" />
                          </div>
                        ) : menuItemsList.length === 0 ? (
                          // Gated on live item count, not menuSlug presence — the
                          // backend never clears menuSlug once assigned (a baker's
                          // link stays reserved even if they delete every item), so
                          // checking menuSlug alone would never show this state
                          // again after the first item was ever added.
                          <div className="text-center py-10 px-2">
                            <p className="text-xs text-[var(--text-secondary)] max-w-[280px] mx-auto">
                              You don&apos;t have a published menu link yet — add your first item in My Menu to get one.
                            </p>
                            <button
                              type="button"
                              onClick={() => setActiveSheet('my-menu')}
                              className="mt-4 bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-white px-5 py-2.5 rounded-2xl text-xs font-bold shadow-md active:scale-95 transition-all cursor-pointer"
                            >
                              Go to My Menu
                            </button>
                          </div>
                        ) : !bakerProfile?.menu.menuSlug ? (
                          // Items exist but the profile fetch racing the menu-items
                          // fetch hasn't landed yet — momentary, resolves itself
                          // once fetchBakerProfile's response arrives.
                          <div className="h-24 bg-[var(--text-primary)]/8 rounded-2xl animate-pulse" />
                        ) : (
                          <div className="flex flex-col gap-6 overflow-y-auto pb-4">
                            <p className="text-xs text-[var(--text-secondary)] -mt-2">
                              Share this link anywhere — Instagram bio, WhatsApp status — so customers can view your menu without installing Kamai.
                            </p>

                            <div>
                              <label className="text-[10px] font-bold text-[var(--text-secondary)] mb-1.5 block">Your menu link</label>
                              <div className="flex items-center gap-2">
                                <div className="flex-1 bg-[var(--background)] border border-[var(--border)] rounded-xl py-3 px-4 text-xs truncate">
                                  {PUBLIC_MENU_BASE_URL.replace(/^https?:\/\//, '')}/m/{bakerProfile.menu.menuSlug}
                                </div>
                                <button
                                  type="button"
                                  onClick={() => handleCopyMenuLink(bakerProfile.menu.menuSlug!)}
                                  className="shrink-0 bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-white p-3 rounded-xl transition-all cursor-pointer"
                                  aria-label="Copy menu link"
                                >
                                  {menuLinkCopied ? <Check size={16} /> : <Copy size={16} />}
                                </button>
                              </div>
                              {menuLinkCopied && <p className="text-[10px] text-emerald-600 dark:text-emerald-400 mt-1.5 font-semibold">Copied!</p>}
                            </div>

                            {/* QR code — no new dependency: a plain <img> against a
                                public QR image endpoint, consistent with this app
                                already loading product images from a third-party
                                URL (see Supply Hub). The menu URL is public data
                                anyway, nothing sensitive crosses to that service. */}
                            <div className="flex flex-col items-center gap-2">
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img
                                src={`https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(`${PUBLIC_MENU_BASE_URL}/m/${bakerProfile.menu.menuSlug}`)}`}
                                alt="QR code linking to your menu"
                                className="w-[140px] h-[140px] rounded-2xl border border-[var(--border)]"
                                width={140}
                                height={140}
                              />
                              <p className="text-[10px] text-[var(--text-secondary)]">Scan to open your menu</p>
                            </div>

                            <div className="border-t border-[var(--border)] pt-5">
                              {menuSlugError && (
                                <div className="bg-red-50 dark:bg-red-950/20 border border-red-200/50 text-red-700 dark:text-red-400 p-3 rounded-xl text-[11px] font-medium flex items-center gap-2 mb-3">
                                  <AlertCircle size={13} /> {menuSlugError}
                                </div>
                              )}

                              {!bakerProfile.menu.menuSlugEditable ? (
                                <p className="text-[10px] text-[var(--text-secondary)]">
                                  Your menu link has already been changed once and can&apos;t be changed again.
                                </p>
                              ) : !menuSlugEditing ? (
                                <button
                                  type="button"
                                  onClick={() => setMenuSlugEditing(true)}
                                  className="text-xs font-bold text-[var(--accent)] hover:underline cursor-pointer"
                                >
                                  Change link
                                </button>
                              ) : (
                                <div className="flex flex-col gap-2.5">
                                  <label className="text-[10px] font-bold text-[var(--text-secondary)] block">
                                    New menu link — you can only do this once. Your old link will stop working.
                                  </label>
                                  <input
                                    type="text"
                                    value={menuSlugInput}
                                    onChange={(e) => setMenuSlugInput(e.target.value)}
                                    className="w-full bg-[var(--background)] border border-[var(--border)] rounded-xl py-3 px-4 text-xs outline-none focus:border-[var(--accent)]"
                                  />
                                  <div className="flex gap-2">
                                    <button
                                      type="button"
                                      onClick={() => { setMenuSlugEditing(false); setMenuSlugError(null); }}
                                      className="flex-1 py-3 text-xs font-bold rounded-xl border border-[var(--border)] cursor-pointer"
                                    >
                                      Cancel
                                    </button>
                                    <button
                                      type="button"
                                      disabled={menuSlugSubmitting}
                                      onClick={handleSaveMenuSlug}
                                      className="flex-1 bg-[var(--accent)] hover:bg-[var(--accent-hover)] disabled:opacity-60 text-white text-xs font-bold py-3 rounded-xl transition-all cursor-pointer"
                                    >
                                      {menuSlugSubmitting ? 'Saving...' : 'Save New Link'}
                                    </button>
                                  </div>
                                </div>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    )}

                    {/* SHEET: SUPPLY CATALOGUE — Screen 2. Reads through
                        src/lib/marketplace/client.ts (mock today), scoped
                        to selectedWholesalerId set from the supplier list. */}
                    {activeSheet === 'supply-catalogue' && selectedWholesaler && (
                      <div className="flex-1 flex flex-col">
                        <div className="flex justify-between items-center mb-1">
                          <button
                            onClick={() => (selectedProduct ? setSelectedProductId(null) : setActiveSheet('none'))}
                            className="p-1.5 text-[var(--text-secondary)] hover:text-[var(--text-primary)] rounded-full hover:bg-neutral-100 dark:hover:bg-neutral-900"
                          >
                            <X size={20} />
                          </button>
                          <h3 className="font-serif text-xl md:text-2xl font-bold text-center px-2 truncate">
                            {selectedProduct ? selectedProduct.name : selectedWholesaler.businessName}
                          </h3>
                          <span className="w-8" />
                        </div>

                        {selectedProduct && (
                          <div className="flex-1 flex flex-col overflow-y-auto">
                            <div className="w-full h-56 rounded-[24px] bg-neutral-50 dark:bg-[#1A0C06] border border-[var(--border)] flex items-center justify-center select-none relative mb-5 shrink-0 overflow-hidden">
                              {selectedProduct.imageUrl ? (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img src={selectedProduct.imageUrl} alt={selectedProduct.name} className="w-full h-full object-cover" />
                              ) : (
                                <Store size={48} className="text-[var(--text-secondary)]/30" />
                              )}
                              <span
                                className={`absolute top-4 left-4 text-[10px] font-bold px-3 py-1.5 rounded-full shadow-sm flex items-center gap-1.5 ${selectedProduct.stockStatus === 'In Stock'
                                  ? 'bg-[var(--surface)] text-[var(--accent)]'
                                  : selectedProduct.stockStatus === 'Low Stock'
                                    ? 'bg-amber-50 dark:bg-amber-950/20 text-amber-700 dark:text-amber-400 border border-amber-200/50'
                                    : 'bg-[var(--surface)] text-red-600 dark:text-red-400'
                                  }`}
                              >
                                <span className={`w-1.5 h-1.5 rounded-full ${selectedProduct.stockStatus === 'In Stock' ? 'bg-[var(--accent)]' : selectedProduct.stockStatus === 'Low Stock' ? 'bg-amber-500' : 'bg-red-500'}`} />
                                {selectedProduct.stockStatus}
                              </span>
                            </div>

                            {selectedProduct.brand && (
                              <p className="text-[10.5px] font-semibold text-[var(--text-secondary)] uppercase tracking-wider mb-4 -mt-2">{selectedProduct.brand}</p>
                            )}

                            {selectedProduct.variants.length > 1 && (
                              <div className="mb-6">
                                <h4 className="text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-wider mb-3">Select Size</h4>
                                <div className="flex gap-2 flex-wrap">
                                  {selectedProduct.variants.map((v) => (
                                    <button
                                      key={v.id}
                                      onClick={() => setSelectedVariantId(v.id)}
                                      className={`px-4 py-2.5 rounded-xl border text-xs font-bold transition-all min-w-[90px] text-center cursor-pointer ${v.id === selectedVariantId
                                        ? 'bg-[var(--accent)] border-[var(--accent)] text-white shadow-sm'
                                        : 'bg-[var(--background)] border-[var(--border)] text-[var(--text-secondary)] hover:border-[var(--accent)]/40'
                                        }`}
                                    >
                                      {v.label}
                                    </button>
                                  ))}
                                </div>
                              </div>
                            )}

                            {selectedProductPolicies?.deliveryEnabled && (
                              <div className="bg-[var(--background)] rounded-xl p-4 border border-[var(--border)] flex gap-4 items-start mb-4">
                                <div className="w-10 h-10 rounded-full bg-[var(--accent)]/10 text-[var(--accent)] flex items-center justify-center shrink-0">
                                  <Truck size={18} />
                                </div>
                                <div>
                                  <h5 className="text-xs font-bold text-[var(--text-primary)] mb-0.5">{selectedProductPolicies.expectedDeliveryTime}</h5>
                                  <p className="text-[11px] text-[var(--text-secondary)]">via {selectedWholesaler.businessName}</p>
                                </div>
                              </div>
                            )}

                            {/* Bulk-order notice — only shown when the wholesaler has
                                actually configured a free-delivery threshold; no
                                placeholder box when that policy data is absent. */}
                            {!!selectedProductPolicies?.freeDeliveryThreshold && (
                              <div className="bg-[var(--background)] rounded-xl p-4 border border-[var(--border)] flex gap-4 items-start mb-6">
                                <div className="w-10 h-10 rounded-full bg-[var(--accent)]/10 text-[var(--accent)] flex items-center justify-center shrink-0">
                                  <FileText size={18} />
                                </div>
                                <div>
                                  <h5 className="text-xs font-bold text-[var(--text-primary)] mb-0.5">
                                    Free delivery over ₹{selectedProductPolicies.freeDeliveryThreshold.toLocaleString('en-IN')}
                                  </h5>
                                  {selectedProductPolicies.minOrderAmount > 0 && (
                                    <p className="text-[11px] text-[var(--text-secondary)]">Min. order ₹{selectedProductPolicies.minOrderAmount.toLocaleString('en-IN')}</p>
                                  )}
                                </div>
                              </div>
                            )}
                            {selectedProductPoliciesLoading && (
                              <div className="h-16 bg-[var(--text-primary)]/8 rounded-xl animate-pulse mb-6" />
                            )}

                            <div className="mt-auto pt-4 flex items-center gap-3">
                              <div className="flex items-center bg-[var(--background)] rounded-xl border border-[var(--border)] h-[54px] px-1 shrink-0">
                                <button
                                  onClick={() => setProductDetailQuantity((q) => Math.max(1, q - 1))}
                                  className="w-10 h-10 rounded-lg flex items-center justify-center text-[var(--accent)] hover:bg-[var(--accent)]/10 transition-colors cursor-pointer"
                                >
                                  <Minus size={16} />
                                </button>
                                <span className="w-8 text-center text-sm font-bold text-[var(--text-primary)]">{productDetailQuantity}</span>
                                <button
                                  onClick={() => setProductDetailQuantity((q) => q + 1)}
                                  className="w-10 h-10 rounded-lg flex items-center justify-center text-[var(--accent)] hover:bg-[var(--accent)]/10 transition-colors cursor-pointer"
                                >
                                  <Plus size={16} />
                                </button>
                              </div>
                              <button
                                onClick={handleAddSelectedProductToCart}
                                disabled={selectedProduct.stockStatus === 'Out of Stock'}
                                className="flex-1 bg-[var(--accent)] hover:bg-[var(--accent-hover)] disabled:bg-neutral-400 disabled:cursor-not-allowed text-white h-[54px] rounded-xl font-bold text-sm flex items-center justify-center gap-2 active:scale-[0.98] transition-all shadow-md cursor-pointer"
                              >
                                {productDetailAdded ? (
                                  <><Check size={18} /> Added to Cart</>
                                ) : (
                                  <><ShoppingCart size={18} /> Add to Cart – ₹{(getDisplayPrice(selectedProduct, selectedVariant) * productDetailQuantity).toLocaleString('en-IN')}</>
                                )}
                              </button>
                            </div>
                          </div>
                        )}

                        {!selectedProduct && (
                        <>
                        <p className="text-[11px] text-[var(--text-secondary)] text-center mb-5">
                          {bakerLocation && selectedWholesaler.latitude != null && selectedWholesaler.longitude != null
                            ? `${haversineDistanceKm(bakerLocation.lat, bakerLocation.lng, selectedWholesaler.latitude, selectedWholesaler.longitude).toFixed(1)} km • `
                            : ''}
                          {[selectedWholesaler.deliveryEnabled && 'Delivery', selectedWholesaler.pickupEnabled && 'Pickup'].filter(Boolean).join(' & ')}
                        </p>

                        <div className="relative flex items-center border border-[var(--border)] rounded-2xl bg-[var(--background)] overflow-hidden px-4 mb-4 focus-within:border-[var(--accent)] transition-colors">
                          <Search size={16} className="text-[var(--text-secondary)]" />
                          <input
                            type="text"
                            placeholder="Search for products..."
                            value={catalogueSearch}
                            onChange={(e) => setCatalogueSearch(e.target.value)}
                            className="w-full py-3 px-2 text-xs outline-none bg-transparent"
                          />
                        </div>

                        <div className="flex gap-2 overflow-x-auto no-scrollbar py-1 mb-4">
                          {(['All', ...catalogueCategories]).map((cat) => (
                            <button
                              key={cat}
                              onClick={() => setCatalogueCategory(cat)}
                              className={`px-4 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-all cursor-pointer ${catalogueCategory === cat
                                ? 'bg-[var(--accent)] text-white shadow-sm'
                                : 'bg-[var(--background)] text-[var(--text-secondary)] border border-[var(--border)] hover:bg-neutral-50 dark:hover:bg-neutral-900'
                                }`}
                            >
                              {cat}
                            </button>
                          ))}
                        </div>

                        <div className="flex justify-between items-center mb-5">
                          <button
                            onClick={cycleCatalogueSort}
                            className="flex items-center gap-1 text-[11px] font-semibold text-[var(--text-secondary)] hover:text-[var(--accent)] transition-colors cursor-pointer"
                          >
                            <ArrowUpDown size={13} /> {catalogueSort}
                          </button>
                          <label className="flex items-center gap-2 cursor-pointer text-[11px] font-semibold text-[var(--text-secondary)]">
                            <span>In Stock Only</span>
                            <div className="relative">
                              <input
                                type="checkbox"
                                checked={catalogueInStockOnly}
                                onChange={() => setCatalogueInStockOnly((v) => !v)}
                                className="sr-only peer"
                              />
                              <div className="w-9 h-5 bg-neutral-200 peer-focus:outline-none rounded-full peer dark:bg-neutral-800 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all dark:border-gray-600 peer-checked:bg-[var(--accent)]"></div>
                            </div>
                          </label>
                        </div>

                        {catalogueError && (
                          <div className="bg-red-50 dark:bg-red-950/20 border border-red-200/50 text-red-700 dark:text-red-400 p-4 rounded-2xl text-xs font-medium flex items-center justify-between gap-3 mb-4">
                            <span className="flex items-center gap-2"><AlertCircle size={14} /> {catalogueError}</span>
                            <button onClick={fetchSupplyCatalogue} className="font-bold underline shrink-0 cursor-pointer">Retry</button>
                          </div>
                        )}

                        <div className="flex flex-col gap-4 overflow-y-auto pb-4">
                          {catalogueLoading &&
                            [0, 1, 2].map((i) => (
                              <div key={i} className="h-40 bg-[var(--text-primary)]/8 rounded-[24px] animate-pulse" />
                            ))}

                          {!catalogueLoading && !catalogueError && filteredCatalogueProducts.length === 0 && (
                            <p className="text-xs text-[var(--text-secondary)] text-center py-8">No products found.</p>
                          )}

                          {!catalogueLoading &&
                            filteredCatalogueProducts.map((p) => {
                              const stockStatus = p.stockStatus;
                              const displayPrice = getDisplayPrice(p);
                              const displayUnit = getDisplayUnitLabel(p);
                              const priceRange = p.variants.length > 1 && new Set(p.variants.map((v) => v.price)).size > 1;
                              return (
                                <div
                                  key={p.id}
                                  onClick={() => setSelectedProductId(p.id)}
                                  className={`bg-[var(--surface)] rounded-[24px] border border-[var(--border)] shadow-sm overflow-hidden flex flex-col cursor-pointer hover:border-[var(--accent)]/30 transition-all ${stockStatus === 'Out of Stock' ? 'opacity-60 grayscale-[50%]' : ''
                                    }`}
                                >
                                  <div className="w-full h-32 bg-neutral-50 dark:bg-[#1A0C06] border-b border-[var(--border)] flex items-center justify-center select-none relative overflow-hidden">
                                    {p.imageUrl ? (
                                      // eslint-disable-next-line @next/next/no-img-element
                                      <img src={p.imageUrl} alt={p.name} className="w-full h-full object-cover" />
                                    ) : (
                                      <Store size={28} className="text-[var(--text-secondary)]/30" />
                                    )}
                                    <span
                                      className={`absolute top-3 left-3 text-[9px] font-bold px-2.5 py-1 rounded-full shadow-sm flex items-center gap-1 ${stockStatus === 'In Stock'
                                        ? 'bg-[var(--surface)] text-[var(--accent)]'
                                        : stockStatus === 'Low Stock'
                                          ? 'bg-amber-50 dark:bg-amber-950/20 text-amber-700 dark:text-amber-400 border border-amber-200/50'
                                          : 'bg-[var(--surface)] text-red-600 dark:text-red-400'
                                        }`}
                                    >
                                      <span className={`w-1.5 h-1.5 rounded-full ${stockStatus === 'In Stock' ? 'bg-[var(--accent)]' : stockStatus === 'Low Stock' ? 'bg-amber-500' : 'bg-red-500'}`} />
                                      {stockStatus}
                                    </span>
                                  </div>

                                  <div className="p-4 flex flex-col flex-1">
                                    <h4 className="font-serif font-bold text-sm text-[var(--text-primary)] mb-1">{p.name}</h4>
                                    {p.brand && (
                                      <p className="text-[10px] text-[var(--text-secondary)] mb-3 line-clamp-2 flex-1">{p.brand}</p>
                                    )}

                                    <div className="flex items-end justify-between mt-auto pt-1">
                                      <div>
                                        <p className="text-[9.5px] text-[var(--text-secondary)] mb-0.5">Wholesale Price</p>
                                        <p className="text-sm font-bold text-[var(--text-primary)]">
                                          {priceRange ? 'From ' : ''}₹{displayPrice.toLocaleString('en-IN')} <span className="text-[10px] text-[var(--text-secondary)] font-normal">/ {displayUnit}</span>
                                        </p>
                                      </div>
                                      <button
                                        onClick={(e) => { e.stopPropagation(); handleAddProductToCart(p); }}
                                        disabled={stockStatus === 'Out of Stock' || addingProductId === p.id}
                                        className={`w-10 h-10 rounded-full flex items-center justify-center transition-all shrink-0 ${stockStatus === 'Out of Stock'
                                          ? 'bg-neutral-200 dark:bg-neutral-800 text-[var(--text-secondary)] cursor-not-allowed'
                                          : 'bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-white shadow-md active:scale-95 cursor-pointer disabled:opacity-70'
                                          }`}
                                      >
                                        {justAddedProductId === p.id ? (
                                          <Check size={17} />
                                        ) : (
                                          <ShoppingCart size={17} />
                                        )}
                                      </button>
                                    </div>
                                  </div>
                                </div>
                              );
                            })}
                        </div>
                        </>
                        )}
                      </div>
                    )}

                    {/* SHEET: SUPPLY CART — Screen 4. Own top-level sheet
                        (not nested like product detail) since it's opened
                        from the Supply Hub tab's header cart icon, not
                        from within a specific wholesaler's catalogue. */}
                    {activeSheet === 'supply-cart' && (
                      <div className="flex-1 flex flex-col">
                        {/* Order-success (Screen 6) has no header chrome by design —
                            a clean, non-navigable confirmation moment, same reasoning
                            as hiding the X here before this screen existed. */}
                        {!placedOrder && (
                          <div className="flex justify-between items-center mb-6">
                            <button
                              onClick={() => (showCheckout ? (setShowCheckout(false), setCheckoutError(null)) : closeCartSheet())}
                              className="p-1.5 text-[var(--text-secondary)] hover:text-[var(--text-primary)] rounded-full hover:bg-neutral-100 dark:hover:bg-neutral-900"
                            >
                              <X size={20} />
                            </button>
                            <h3 className="font-serif text-xl md:text-2xl font-bold text-center px-2 truncate">
                              {showCheckout ? 'Checkout' : `Cart${cartWholesaler ? ` • ${cartWholesaler.businessName}` : ''}`}
                            </h3>
                            <span className="w-8" />
                          </div>
                        )}

                        {placedOrder && placedOrderContext ? (
                          <div className="flex-1 flex flex-col items-center text-center gap-5 py-4 overflow-y-auto">
                            <div className="relative w-32 h-32 rounded-full bg-[var(--accent)]/10 flex items-center justify-center shrink-0 mt-2">
                              <div className="absolute -top-3 -right-3 w-14 h-14 bg-[var(--accent)]/20 rounded-full blur-2xl pointer-events-none" />
                              <CheckCircle2 size={52} className="text-[var(--accent)] relative" />
                            </div>

                            <div>
                              <h4 className="font-serif text-2xl font-bold text-[var(--text-primary)] mb-2">Order Placed!</h4>
                              <p className="text-sm text-[var(--text-secondary)] px-2">
                                Thank you for your order. {placedOrderContext.wholesalerName} has been notified.
                              </p>
                            </div>

                            <div className="w-full bg-[var(--background)] rounded-2xl border border-[var(--border)] p-4 flex flex-col gap-3 text-left">
                              <div className="flex justify-between items-center pb-3 border-b border-[var(--border)]">
                                <span className="text-xs font-semibold text-[var(--text-secondary)]">Order Number</span>
                                <span className="text-sm font-bold text-[var(--text-primary)]">#{placedOrder.id}</span>
                              </div>
                              <div className="flex justify-between items-center pb-3 border-b border-[var(--border)]">
                                <span className="text-xs font-semibold text-[var(--text-secondary)]">Total</span>
                                <span className="text-sm font-bold text-[var(--accent)]">₹{placedOrder.totalAmount.toLocaleString('en-IN')}</span>
                              </div>
                              <div className="flex justify-between items-center gap-3">
                                <div className="flex items-center gap-2 text-[var(--accent)] shrink-0">
                                  {placedOrderContext.fulfilmentMode === 'PICKUP' ? <Store size={16} /> : <Truck size={16} />}
                                  <span className="text-xs font-semibold whitespace-nowrap">
                                    {placedOrderContext.fulfilmentMode === 'PICKUP' ? 'Pickup Location' : 'Expected Delivery'}
                                  </span>
                                </div>
                                <span className="text-xs text-[var(--text-primary)] text-right">
                                  {placedOrderContext.fulfilmentMode === 'PICKUP' ? placedOrderContext.wholesalerName : placedOrderContext.expectedDeliveryTime}
                                </span>
                              </div>
                            </div>

                            <div className="w-full flex flex-col gap-2.5 mt-auto pt-2 shrink-0">
                              <button
                                onClick={() => { resetCheckoutState(); setActiveSheet('supply-orders'); }}
                                className="w-full h-[52px] bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-white rounded-2xl font-bold text-sm flex items-center justify-center shadow-md active:scale-[0.98] transition-all cursor-pointer"
                              >
                                View Order
                              </button>
                              <button
                                onClick={closeCartSheet}
                                className="w-full h-[52px] bg-transparent border-2 border-[var(--border)] text-[var(--text-primary)] rounded-2xl font-bold text-sm flex items-center justify-center hover:bg-neutral-50 dark:hover:bg-neutral-900 transition-colors cursor-pointer"
                              >
                                Back to Suppliers
                              </button>
                            </div>
                          </div>
                        ) : showCheckout && cart ? (
                          <div className="flex-1 flex flex-col overflow-y-auto">
                            <div className="text-center mb-6">
                              <p className="text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-widest mb-1">Order For</p>
                              <h4 className="font-serif text-2xl font-bold text-[var(--accent)]">{cartWholesaler?.businessName}</h4>
                            </div>

                            {cartWholesaler && cartWholesaler.deliveryEnabled && cartWholesaler.pickupEnabled && (
                              <div className="bg-[var(--background)] rounded-xl p-1 flex border border-[var(--border)] mb-5">
                                {(['Delivery', 'Pickup'] as const).map((option) => (
                                  <button
                                    key={option}
                                    onClick={() => setCheckoutFulfillment(option)}
                                    className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${checkoutFulfillment === option
                                      ? 'bg-[var(--accent)] text-white shadow-sm'
                                      : 'text-[var(--text-secondary)] hover:bg-[var(--surface)]'
                                      }`}
                                  >
                                    {option}
                                  </button>
                                ))}
                              </div>
                            )}

                            <div className="bg-[var(--background)] rounded-2xl border border-[var(--border)] divide-y divide-[var(--border)] mb-5">
                              {checkoutFulfillment === 'Delivery' ? (
                                <div className="p-4 flex gap-3 items-start">
                                  <div className="w-9 h-9 rounded-full bg-[var(--surface)] border border-[var(--border)] flex items-center justify-center text-[var(--accent)] shrink-0">
                                    <MapPin size={16} />
                                  </div>
                                  <div className="flex-1 min-w-0">
                                    <p className="text-[9.5px] font-bold text-[var(--text-secondary)] uppercase tracking-wider mb-1.5">Delivery Address</p>
                                    {bakerProfile?.business.businessName && (
                                      <p className="text-xs font-bold text-[var(--text-primary)] mb-1.5">{bakerProfile.business.businessName}</p>
                                    )}
                                    <textarea
                                      value={checkoutAddress}
                                      onChange={(e) => setCheckoutAddress(e.target.value)}
                                      placeholder="Full delivery address"
                                      rows={2}
                                      className="w-full bg-[var(--surface)] border border-[var(--border)] rounded-xl py-2.5 px-3 text-xs outline-none focus:border-[var(--accent)] resize-none"
                                    />
                                  </div>
                                </div>
                              ) : (
                                <div className="p-4 flex gap-3 items-start">
                                  <div className="w-9 h-9 rounded-full bg-[var(--surface)] border border-[var(--border)] flex items-center justify-center text-[var(--accent)] shrink-0">
                                    <Store size={16} />
                                  </div>
                                  <div>
                                    <p className="text-[9.5px] font-bold text-[var(--text-secondary)] uppercase tracking-wider mb-1">Pickup From</p>
                                    <p className="text-xs text-[var(--text-primary)]">{cartPolicies?.pickupLocation || cartWholesaler?.address}</p>
                                  </div>
                                </div>
                              )}

                              <div className="p-4 flex gap-3 items-start">
                                <div className="w-9 h-9 rounded-full bg-[var(--surface)] border border-[var(--border)] flex items-center justify-center text-[var(--accent)] shrink-0">
                                  <CreditCard size={16} />
                                </div>
                                <div>
                                  <p className="text-[9.5px] font-bold text-[var(--text-secondary)] uppercase tracking-wider mb-1">Payment</p>
                                  {/* No free-text payment-terms field exists in this API - only
                                      advancePercentage + whether it's configured at all. See
                                      bakery-api-reference.md endpoint 3. */}
                                  <p className="text-xs text-[var(--text-primary)]">
                                    {cartPoliciesLoading
                                      ? 'Loading...'
                                      : cartPolicies?.paymentPolicyConfigured
                                        ? `Advance payment: ${cartPolicies.advancePercentage}% required`
                                        : 'Payment terms not set up by this wholesaler yet'}
                                  </p>
                                </div>
                              </div>

                              <div className="p-4 flex gap-3 items-start">
                                <div className="w-9 h-9 rounded-full bg-[var(--surface)] border border-[var(--border)] flex items-center justify-center text-[var(--accent)] shrink-0">
                                  <FileText size={16} />
                                </div>
                                <div className="flex-1 min-w-0">
                                  <p className="text-[9.5px] font-bold text-[var(--text-secondary)] uppercase tracking-wider mb-1.5">Notes (optional)</p>
                                  <textarea
                                    value={checkoutInstructions}
                                    onChange={(e) => setCheckoutInstructions(e.target.value)}
                                    placeholder="e.g. Call on arrival, use back entrance"
                                    rows={2}
                                    className="w-full bg-[var(--surface)] border border-[var(--border)] rounded-xl py-2.5 px-3 text-xs outline-none focus:border-[var(--accent)] resize-none"
                                  />
                                </div>
                              </div>
                            </div>

                            <h5 className="font-serif text-base font-bold text-[var(--text-primary)] mb-3">Order Summary</h5>
                            <div className="bg-[var(--background)] rounded-2xl border border-[var(--border)] divide-y divide-[var(--border)] mb-5">
                              {cart.items.map((item) => (
                                <div key={`${item.product.id}:${item.variant?.id ?? ''}`} className="p-3.5 flex items-center gap-3">
                                  <div className="w-11 h-11 rounded-lg bg-[var(--surface)] border border-[var(--border)] flex items-center justify-center shrink-0 select-none overflow-hidden">
                                    {item.product.imageUrl ? (
                                      // eslint-disable-next-line @next/next/no-img-element
                                      <img src={item.product.imageUrl} alt={item.product.name} className="w-full h-full object-cover" />
                                    ) : (
                                      <Store size={18} className="text-[var(--text-secondary)]/30" />
                                    )}
                                  </div>
                                  <div className="flex-1 min-w-0">
                                    <p className="text-xs font-bold text-[var(--text-primary)] truncate">{item.product.name}</p>
                                    <p className="text-[10px] text-[var(--text-secondary)]">{getDisplayUnitLabel(item.product, item.variant)}</p>
                                  </div>
                                  <div className="text-right shrink-0">
                                    <p className="text-[10.5px] text-[var(--text-secondary)]">x {item.quantity}</p>
                                    <p className="text-xs font-bold text-[var(--text-primary)]">₹{(getDisplayPrice(item.product, item.variant) * item.quantity).toLocaleString('en-IN')}</p>
                                  </div>
                                </div>
                              ))}

                              <div className="p-4 flex flex-col gap-2">
                                <div className="flex justify-between items-center">
                                  <span className="text-xs text-[var(--text-secondary)]">Subtotal</span>
                                  <span className="text-sm text-[var(--text-primary)]">₹{cartSubtotal.toLocaleString('en-IN')}</span>
                                </div>
                                <div className="flex justify-between items-center">
                                  <span className="text-xs text-[var(--text-secondary)]">Delivery Fee</span>
                                  <span className="text-sm text-[var(--text-primary)]">₹{checkoutDeliveryFee.toLocaleString('en-IN')}</span>
                                </div>
                                <div className="border-t border-[var(--border)] my-1" />
                                <div className="flex justify-between items-center">
                                  <span className="text-xs font-bold text-[var(--text-primary)]">Estimated Total</span>
                                  <span className="font-serif text-xl font-bold text-[var(--accent)]">
                                    ₹{(cartSubtotal + checkoutDeliveryFee).toLocaleString('en-IN')}
                                  </span>
                                </div>
                                {/* Server computes the real total at order time and may differ
                                    slightly from this estimate - see bakery-api-reference.md
                                    endpoint 4's pricing note. */}
                                <p className="text-[9.5px] text-[var(--text-secondary)] text-center pt-1">
                                  Final total is confirmed by {cartWholesaler?.businessName ?? 'the wholesaler'} when the order is placed.
                                </p>
                              </div>
                            </div>

                            {checkoutError && (
                              <div className="bg-red-50 dark:bg-red-950/20 border border-red-200/50 text-red-700 dark:text-red-400 p-3.5 rounded-xl text-xs font-medium flex items-center gap-2 mb-5">
                                <AlertCircle size={14} /> {checkoutError}
                              </div>
                            )}

                            <button
                              onClick={handlePlaceOrder}
                              disabled={checkoutSubmitting}
                              className="w-full bg-[var(--accent)] hover:bg-[var(--accent-hover)] disabled:opacity-60 disabled:cursor-not-allowed text-white h-[54px] rounded-2xl font-bold text-sm shrink-0 active:scale-[0.98] transition-all shadow-md cursor-pointer flex items-center justify-center gap-2"
                            >
                              <CheckCircle2 size={18} /> {checkoutSubmitting ? 'Placing Order...' : 'Place Order'}
                            </button>
                          </div>
                        ) : (!cart || cart.items.length === 0) ? (
                          <div className="flex-1 flex flex-col items-center justify-center gap-3 py-12">
                            {cartUnavailableNotice && (
                              <div className="w-full bg-amber-50 dark:bg-amber-950/20 border border-amber-200/50 text-amber-700 dark:text-amber-400 px-3 py-2.5 rounded-xl text-[11px] font-medium flex items-start gap-2 mb-2">
                                <AlertCircle size={13} className="mt-0.5 shrink-0" />
                                <span>Couldn&apos;t re-add (no longer available): {cartUnavailableNotice.join(', ')}</span>
                              </div>
                            )}
                            <ShoppingCart size={32} className="text-[var(--text-secondary)]" />
                            <p className="text-xs text-[var(--text-secondary)] text-center">Your cart is empty.</p>
                            <button
                              onClick={closeCartSheet}
                              className="text-xs font-bold text-[var(--accent)] hover:underline cursor-pointer"
                            >
                              Browse Suppliers
                            </button>
                          </div>
                        ) : (
                          <div className="flex-1 flex flex-col overflow-y-auto">
                            {cartUnavailableNotice && (
                              <div className="bg-amber-50 dark:bg-amber-950/20 border border-amber-200/50 text-amber-700 dark:text-amber-400 px-3 py-2.5 rounded-xl text-[11px] font-medium flex items-start gap-2 mb-4">
                                <AlertCircle size={13} className="mt-0.5 shrink-0" />
                                <span>Couldn&apos;t re-add (no longer available): {cartUnavailableNotice.join(', ')}</span>
                              </div>
                            )}
                            <div className="flex flex-col gap-3 mb-5">
                              {cart.items.map((item) => {
                                const lineKey = `${item.product.id}:${item.variant?.id ?? ''}`;
                                const updating = cartUpdatingKey === lineKey;
                                const variantId = item.variant?.id ?? null;
                                return (
                                  <div key={lineKey} className="flex gap-3 bg-[var(--background)] rounded-2xl border border-[var(--border)] p-3">
                                    <div className="w-16 h-16 rounded-xl bg-neutral-50 dark:bg-[#1A0C06] border border-[var(--border)] flex items-center justify-center shrink-0 select-none overflow-hidden">
                                      {item.product.imageUrl ? (
                                        // eslint-disable-next-line @next/next/no-img-element
                                        <img src={item.product.imageUrl} alt={item.product.name} className="w-full h-full object-cover" />
                                      ) : (
                                        <Store size={24} className="text-[var(--text-secondary)]/30" />
                                      )}
                                    </div>
                                    <div className="flex-1 min-w-0 flex flex-col justify-between">
                                      <div className="flex justify-between items-start gap-2">
                                        <div className="min-w-0">
                                          <h4 className="text-xs font-bold text-[var(--text-primary)] truncate">{item.product.name}</h4>
                                          <p className="text-[10.5px] text-[var(--text-secondary)]">{getDisplayUnitLabel(item.product, item.variant)}</p>
                                        </div>
                                        <button
                                          onClick={() => handleCartRemoveItem(item.product.id, variantId)}
                                          disabled={updating}
                                          className="p-1 text-[var(--text-secondary)] hover:text-red-600 dark:hover:text-red-400 transition-colors shrink-0 cursor-pointer disabled:opacity-50"
                                        >
                                          <Trash2 size={15} />
                                        </button>
                                      </div>
                                      <div className="flex justify-between items-end mt-1">
                                        <span className="text-xs font-bold text-[var(--text-primary)]">
                                          ₹{(getDisplayPrice(item.product, item.variant) * item.quantity).toLocaleString('en-IN')}
                                        </span>
                                        <div className="flex items-center bg-[var(--surface)] rounded-xl border border-[var(--border)] h-9 px-0.5">
                                          <button
                                            onClick={() => handleCartQuantityChange(item.product.id, variantId, item.quantity - 1)}
                                            disabled={updating}
                                            className="w-7 h-7 rounded-lg flex items-center justify-center text-[var(--accent)] hover:bg-[var(--accent)]/10 transition-colors cursor-pointer disabled:opacity-50"
                                          >
                                            <Minus size={13} />
                                          </button>
                                          <span className="w-6 text-center text-[11px] font-bold text-[var(--text-primary)]">{item.quantity}</span>
                                          <button
                                            onClick={() => handleCartQuantityChange(item.product.id, variantId, item.quantity + 1)}
                                            disabled={updating}
                                            className="w-7 h-7 rounded-lg flex items-center justify-center text-[var(--accent)] hover:bg-[var(--accent)]/10 transition-colors cursor-pointer disabled:opacity-50"
                                          >
                                            <Plus size={13} />
                                          </button>
                                        </div>
                                      </div>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>

                            {cartPolicies && !cartMeetsMinimum && (
                              <div className="bg-amber-50 dark:bg-amber-950/20 border border-amber-200/50 rounded-xl p-3.5 flex gap-2.5 items-start mb-5">
                                <AlertCircle size={15} className="text-amber-700 dark:text-amber-400 shrink-0 mt-0.5" />
                                <p className="text-[11px] text-amber-700 dark:text-amber-400 leading-snug">
                                  Min. order is ₹{cartPolicies.minOrderAmount.toLocaleString('en-IN')}. Add ₹{(cartPolicies.minOrderAmount - cartSubtotal).toLocaleString('en-IN')} more to qualify.
                                </p>
                              </div>
                            )}

                            <div className="bg-[var(--background)] rounded-2xl border border-[var(--border)] p-5 flex flex-col gap-2 mt-auto">
                              <div className="flex justify-between items-center">
                                <span className="text-xs font-bold text-[var(--text-primary)]">Subtotal</span>
                                <span className="font-serif text-xl font-bold text-[var(--accent)]">₹{cartSubtotal.toLocaleString('en-IN')}</span>
                              </div>
                              <p className="text-[9.5px] text-[var(--text-secondary)]">Delivery fee and final total are shown at checkout.</p>
                            </div>

                            <button
                              onClick={() => {
                                // Set together, synchronously, so the very
                                // first Checkout render already reflects the
                                // right mode - splitting this into a
                                // useEffect that runs after showCheckout
                                // flips true left one render where
                                // checkoutFulfillment was still its stale
                                // 'Delivery' default even for a pickup-only
                                // wholesaler, which crashed checkoutDeliveryFee
                                // against that wholesaler's null deliveryCharge.
                                setCheckoutFulfillment(cartWholesaler?.deliveryEnabled ? 'Delivery' : 'Pickup');
                                setShowCheckout(true);
                              }}
                              disabled={!cartMeetsMinimum || cartPoliciesLoading}
                              className="w-full bg-[var(--accent)] hover:bg-[var(--accent-hover)] disabled:bg-neutral-400 disabled:cursor-not-allowed text-white h-[54px] rounded-2xl font-bold text-sm mt-5 shrink-0 active:scale-[0.98] transition-all shadow-md cursor-pointer"
                            >
                              Proceed to Checkout
                            </button>
                          </div>
                        )}
                      </div>
                    )}

                    {/* SHEET: SUPPLY ORDERS — Screen 7. Global order history
                        across wholesalers, own top-level sheet like Cart
                        (reached from the Supply Hub header and from
                        "View Order" on the order-success screen). */}
                    {activeSheet === 'supply-orders' && (
                      <div className="flex-1 flex flex-col">
                        <div className="flex justify-between items-center mb-6">
                          <button
                            onClick={() => (selectedOrderListItem ? setSelectedOrderId(null) : setActiveSheet('none'))}
                            className="p-1.5 text-[var(--text-secondary)] hover:text-[var(--text-primary)] rounded-full hover:bg-neutral-100 dark:hover:bg-neutral-900"
                          >
                            <X size={20} />
                          </button>
                          <h3 className="font-serif text-xl md:text-2xl font-bold text-center px-2 truncate">
                            {selectedOrderListItem ? `Order #${selectedOrderListItem.id}` : 'My Wholesale Orders'}
                          </h3>
                          <span className="w-8" />
                        </div>

                        {selectedOrderListItem ? (
                          <div className="flex-1 flex flex-col gap-5 overflow-y-auto">
                            {/* Supplier card. No tagline/phone shown - neither exists in
                                the wholesaler API response (see bakery-api-reference.md). */}
                            <div className="bg-[var(--surface)] rounded-2xl border border-[var(--border)] shadow-sm p-4 flex items-center gap-3">
                              <div className="w-11 h-11 rounded-full bg-[var(--background)] border border-[var(--border)] flex items-center justify-center shrink-0">
                                <Store size={18} className="text-[var(--accent)]" />
                              </div>
                              <h4 className="text-sm font-bold text-[var(--text-primary)] truncate">{selectedOrderListItem.wholesalerBusinessName}</h4>
                            </div>

                            {/* Status: a single defensive badge, not a fixed step
                                sequence — the full status enum isn't confirmed yet
                                (only RECEIVED/CANCELLED verified, see
                                bakery-api-reference.md endpoint 5), so any value,
                                known or not, renders the same way rather than
                                assuming a step order that might not exist. */}
                            <div className="bg-[var(--surface)] rounded-2xl border border-[var(--border)] shadow-sm p-4">
                              <h5 className="text-xs font-bold text-[var(--text-primary)] mb-3">Order Status</h5>

                              {selectedOrderStatusLoading && (
                                <div className="h-16 bg-[var(--text-primary)]/8 rounded-xl animate-pulse" />
                              )}

                              {selectedOrderStatusError && (
                                <div className="bg-red-50 dark:bg-red-950/20 border border-red-200/50 text-red-700 dark:text-red-400 p-3 rounded-xl text-xs font-medium flex items-center justify-between gap-3">
                                  <span className="flex items-center gap-2"><AlertCircle size={13} /> {selectedOrderStatusError}</span>
                                  <button onClick={fetchSelectedOrderStatus} className="font-bold underline shrink-0 cursor-pointer">Retry</button>
                                </div>
                              )}

                              {!selectedOrderStatusLoading && !selectedOrderStatusError && (
                                <div className="flex flex-col gap-3">
                                  <span className={`self-start inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold ${supplyOrderStatusClass(selectedOrderStatus?.status ?? selectedOrderListItem.status)}`}>
                                    <span className="w-1.5 h-1.5 bg-current rounded-full" />
                                    {selectedOrderStatus?.status ?? selectedOrderListItem.status}
                                  </span>
                                  {selectedOrderStatus?.advanceStatus && (
                                    <p className="text-xs text-[var(--text-secondary)]">Advance payment: {selectedOrderStatus.advanceStatus}</p>
                                  )}
                                  {selectedOrderStatus?.readyTime && (
                                    <p className="text-xs text-[var(--text-secondary)]">Ready: {selectedOrderStatus.readyTime}</p>
                                  )}
                                  {selectedOrderStatus?.updatedAt && (
                                    <p className="text-[10.5px] text-[var(--text-secondary)]">
                                      Last updated {new Date(selectedOrderStatus.updatedAt).toLocaleString('en-IN', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}
                                    </p>
                                  )}
                                </div>
                              )}
                            </div>

                            {/* Delivery/pickup info */}
                            <div className="bg-[var(--accent)]/5 border border-[var(--accent)]/20 rounded-2xl p-4 flex gap-3 items-start">
                              {selectedOrderListItem.fulfilmentMode === 'PICKUP' ? <Store size={17} className="text-[var(--accent)] mt-0.5 shrink-0" /> : <Truck size={17} className="text-[var(--accent)] mt-0.5 shrink-0" />}
                              <div>
                                <h5 className="text-xs font-bold text-[var(--text-primary)] mb-0.5">
                                  {selectedOrderListItem.fulfilmentMode === 'PICKUP' ? 'Pickup Location' : 'Delivery'}
                                </h5>
                                <p className="text-xs text-[var(--text-secondary)]">
                                  {selectedOrderListItem.fulfilmentMode === 'PICKUP'
                                    ? selectedOrderPolicies?.pickupLocation || selectedOrderWholesaler?.address || 'To be confirmed'
                                    : selectedOrderPolicies?.expectedDeliveryTime ?? 'To be confirmed'}
                                </p>
                              </div>
                            </div>

                            {/* Itemized breakdown - items[] from GET /orders/:id/status.
                                productName/variantLabel are resolved live (current
                                catalogue state), not a snapshot from order time.
                                variantLabel is null if that variant was since
                                deleted - that line is simply omitted. */}
                            {selectedOrderStatus && selectedOrderStatus.items.length > 0 && (
                              <div className="bg-[var(--surface)] rounded-2xl border border-[var(--border)] shadow-sm p-4 flex flex-col gap-3">
                                <h5 className="text-xs font-bold text-[var(--text-primary)]">Items</h5>
                                <div className="flex flex-col gap-3">
                                  {selectedOrderStatus.items.map((item, idx) => (
                                    <div key={`${item.productId}-${item.variantId ?? idx}`} className="flex justify-between items-start gap-3">
                                      <div className="min-w-0">
                                        <p className="text-xs font-semibold text-[var(--text-primary)] truncate">{item.productName}</p>
                                        {item.variantLabel && (
                                          <p className="text-[10.5px] text-[var(--text-secondary)] truncate">{item.variantLabel}</p>
                                        )}
                                        <p className="text-[10.5px] text-[var(--text-secondary)]">
                                          {item.quantity} × ₹{item.unitPrice.toLocaleString('en-IN')}
                                        </p>
                                      </div>
                                      <span className="text-xs font-bold text-[var(--text-primary)] shrink-0">
                                        ₹{item.lineTotal.toLocaleString('en-IN')}
                                      </span>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}

                            <div className="bg-[var(--surface)] rounded-2xl border border-[var(--border)] shadow-sm p-4 flex flex-col gap-2">
                              <div className="flex justify-between items-center">
                                <span className="text-xs text-[var(--text-secondary)]">Items</span>
                                <span className="text-sm text-[var(--text-primary)]">{selectedOrderListItem.itemCount}</span>
                              </div>
                              <div className="border-t border-[var(--border)] my-1" />
                              <div className="flex justify-between items-center">
                                <span className="text-xs font-bold text-[var(--text-primary)]">Total</span>
                                <span className="font-serif text-xl font-bold text-[var(--accent)]">
                                  ₹{(selectedOrderStatus?.totalAmount ?? selectedOrderListItem.totalAmount).toLocaleString('en-IN')}
                                </span>
                              </div>
                            </div>

                            <button
                              onClick={() => selectedOrderStatus && handleReorder(selectedOrderListItem.id, selectedOrderListItem.wholesalerId, selectedOrderStatus.items)}
                              disabled={!selectedOrderStatus || selectedOrderStatus.items.length === 0 || reorderingOrderId === selectedOrderListItem.id}
                              className="w-full inline-flex items-center justify-center gap-2 py-3.5 rounded-2xl text-xs font-bold border border-[var(--border)] bg-[var(--surface)] text-[var(--text-primary)] hover:bg-neutral-50 dark:hover:bg-neutral-900 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                            >
                              {reorderingOrderId === selectedOrderListItem.id ? (
                                <>
                                  <span className="w-3.5 h-3.5 border-2 border-[var(--text-primary)]/30 border-t-[var(--text-primary)] rounded-full animate-spin" />
                                  Reordering…
                                </>
                              ) : (
                                <>
                                  <RotateCcw size={14} /> Reorder
                                </>
                              )}
                            </button>
                          </div>
                        ) : (
                          <>
                            <div className="flex gap-2 overflow-x-auto no-scrollbar py-1 mb-5">
                              {(['All', 'Active', 'Cancelled'] as const).map((tabName) => (
                                <button
                                  key={tabName}
                                  onClick={() => setSupplyOrdersTab(tabName)}
                                  className={`px-4 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-all cursor-pointer ${supplyOrdersTab === tabName
                                    ? 'bg-[var(--accent)] text-white shadow-sm'
                                    : 'bg-[var(--surface)] text-[var(--text-secondary)] border border-[var(--border)] hover:bg-neutral-50 dark:hover:bg-neutral-900'
                                    }`}
                                >
                                  {tabName}
                                </button>
                              ))}
                            </div>

                            {supplyOrdersError && (
                              <div className="bg-red-50 dark:bg-red-950/20 border border-red-200/50 text-red-700 dark:text-red-400 p-4 rounded-2xl text-xs font-medium flex items-center justify-between gap-3 mb-5">
                                <span className="flex items-center gap-2"><AlertCircle size={14} /> {supplyOrdersError}</span>
                                <button onClick={fetchSupplyOrders} className="font-bold underline shrink-0 cursor-pointer">Retry</button>
                              </div>
                            )}

                            <div className="flex-1 flex flex-col gap-3 overflow-y-auto">
                              {supplyOrdersLoading &&
                                [0, 1, 2].map((i) => (
                                  <div key={i} className="h-28 bg-[var(--text-primary)]/8 rounded-[24px] animate-pulse" />
                                ))}

                              {!supplyOrdersLoading && !supplyOrdersError && filteredSupplyOrders.length === 0 && (
                                <p className="text-xs text-[var(--text-secondary)] text-center py-12">No orders yet.</p>
                              )}

                              {!supplyOrdersLoading &&
                                filteredSupplyOrders.map((o) => (
                                  <div
                                    key={o.id}
                                    onClick={() => setSelectedOrderId(o.id)}
                                    className="bg-[var(--surface)] rounded-[24px] border border-[var(--border)] shadow-sm p-4 flex flex-col gap-3 cursor-pointer hover:border-[var(--accent)]/30 transition-all"
                                  >
                                    <div className="flex justify-between items-start gap-2">
                                      <div className="min-w-0">
                                        <p className="text-[10px] text-[var(--text-secondary)] mb-0.5">Order #{o.id}</p>
                                        <h4 className="font-serif font-bold text-base text-[var(--text-primary)] truncate">{o.wholesalerBusinessName}</h4>
                                      </div>
                                      <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10.5px] font-bold shrink-0 ${supplyOrderStatusClass(o.status)}`}>
                                        <span className="w-1.5 h-1.5 bg-current rounded-full" />
                                        {o.status}
                                      </span>
                                    </div>

                                    <div className="flex items-center gap-2 text-[11px] text-[var(--text-secondary)]">
                                      <span className="flex items-center gap-1">
                                        <CalendarIcon size={12} />
                                        {new Date(o.createdAt).toLocaleDateString('en-IN', { month: 'short', day: 'numeric', year: 'numeric' })}
                                      </span>
                                      <span className="w-1 h-1 rounded-full bg-[var(--border)]" />
                                      <span>{o.itemCount} item{o.itemCount !== 1 ? 's' : ''}</span>
                                    </div>

                                    <div className="pt-3 border-t border-[var(--border)] flex justify-between items-center">
                                      <span className="text-sm font-bold text-[var(--text-primary)]">₹{o.totalAmount.toLocaleString('en-IN')}</span>
                                      <div className="flex items-center gap-4">
                                        <button
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            handleReorder(o.id, o.wholesalerId, o.items);
                                          }}
                                          disabled={reorderingOrderId === o.id || o.items.length === 0}
                                          className="text-[var(--text-secondary)] hover:text-[var(--text-primary)] text-xs font-bold flex items-center gap-1 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                                        >
                                          {reorderingOrderId === o.id ? (
                                            <span className="w-3 h-3 border-2 border-[var(--text-secondary)]/30 border-t-[var(--text-secondary)] rounded-full animate-spin" />
                                          ) : (
                                            <RotateCcw size={13} />
                                          )}
                                          Reorder
                                        </button>
                                        <span className="text-[var(--accent)] text-xs font-bold flex items-center gap-1">
                                          View Details <ChevronRight size={13} />
                                        </span>
                                      </div>
                                    </div>
                                  </div>
                                ))}
                            </div>
                          </>
                        )}
                      </div>
                    )}

                  </motion.div>
                </div>
              )}
            </AnimatePresence>

          </div>
        )}

      </div>
    </div>
  );
}
