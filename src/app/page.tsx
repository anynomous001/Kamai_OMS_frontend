'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Home as HomeIcon, ClipboardList, Users, Calendar as CalendarIcon,
  ShoppingBag, MoreHorizontal, Moon, Sun, ArrowUpRight, Plus,
  ArrowLeft, Search, Bell, Check, X, Shield, Phone, MessageSquare,
  ChevronRight, Sparkles, AlertCircle, FileText, CheckCircle2,
  LogOut, ChevronDown, Percent, CreditCard, Send,
  Settings as SettingsIcon, ShieldCheck, Heart, Info, Wallet
} from 'lucide-react';

// --- INTERFACES ---
interface Order {
  id: string;
  cakeName: string;
  customerName: string;
  phone: string;
  deliveryDate: string;
  deliveryTime: string;
  status: 'In Production' | 'Ready' | 'Delivered' | 'Cancelled';
  advanceAmount: number;
  totalAmount: number;
  type: 'Pickup' | 'Delivery';
}

interface Customer {
  name: string;
  phone: string;
  tag: 'Repeat VIP' | 'Repeat' | '';
  ordersCount: number;
  lastOrderDate: string;
  ltv: number;
}

interface Expense {
  id: string;
  item: string;
  amount: number;
  date: string;
  category: 'Raw Material' | 'Packaging' | 'Decoration' | 'Equipment';
}

const initialOrders: Order[] = [
  { id: 'K-1042', cakeName: '1.5kg Chocolate Truffle', customerName: 'Neha Sharma', phone: '+91 98765 43210', deliveryDate: '2023-10-24', deliveryTime: '4:00 PM', status: 'In Production', advanceAmount: 1000, totalAmount: 1500, type: 'Pickup' },
  { id: 'K-1041', cakeName: '2kg Black Forest', customerName: 'Rohit Verma', phone: '+91 91234 56789', deliveryDate: '2023-10-24', deliveryTime: '6:30 PM', status: 'In Production', advanceAmount: 700, totalAmount: 1000, type: 'Pickup' },
  { id: 'K-1039', cakeName: '1kg Red Velvet', customerName: 'Anjali Mehta', phone: '+91 99887 66554', deliveryDate: '2023-10-25', deliveryTime: '11:00 AM', status: 'In Production', advanceAmount: 500, totalAmount: 1000, type: 'Pickup' },
  { id: 'K-1037', cakeName: '500g Butterscotch Bento', customerName: 'Priya Singh', phone: '+91 88900 11223', deliveryDate: '2023-10-25', deliveryTime: '3:00 PM', status: 'In Production', advanceAmount: 300, totalAmount: 600, type: 'Pickup' }
];

const initialCustomers: Customer[] = [
  { name: 'Neha Sharma', phone: '+91 98765 43210', tag: 'Repeat VIP', ordersCount: 4, lastOrderDate: 'Oct 12, 2023', ltv: 4500 },
  { name: 'Rahul Verma', phone: '+91 91234 56789', tag: 'Repeat', ordersCount: 3, lastOrderDate: 'Oct 08, 2023', ltv: 3200 },
  { name: 'Anita Mehta', phone: '+91 99887 66554', tag: 'Repeat', ordersCount: 2, lastOrderDate: 'Oct 05, 2023', ltv: 2100 },
  { name: 'Priya Singh', phone: '+91 88900 11223', tag: '', ordersCount: 1, lastOrderDate: 'Sep 28, 2023', ltv: 1200 }
];

const initialExpenses: Expense[] = [
  { id: 'E-1', item: '5kg Compound Chocolate', amount: 1200, date: 'Oct 24, 2023', category: 'Raw Material' },
  { id: 'E-2', item: 'Whipping Cream (1L)', amount: 650, date: 'Oct 23, 2023', category: 'Raw Material' },
  { id: 'E-3', item: 'Cake Boxes (10 inch) - 25 pcs', amount: 375, date: 'Oct 22, 2023', category: 'Packaging' },
  { id: 'E-4', item: 'Vanilla Essence (100ml)', amount: 180, date: 'Oct 21, 2023', category: 'Raw Material' },
  { id: 'E-5', item: 'Sprinkles & Decorations', amount: 220, date: 'Oct 20, 2023', category: 'Decoration' }
];

const supplyProducts = [
  { name: '10kg Dark Compound Chocolate', price: 2200, category: 'Chocolates', image: '🍫' },
  { name: '10kg White Compound Chocolate', price: 2200, category: 'Chocolates', image: '🥚' },
  { name: '10kg Milk Compound Chocolate', price: 2050, category: 'Chocolates', image: '🟫' },
  { name: '5kg Cocoa Powder', price: 750, category: 'Chocolates', image: '📇' },
  { name: '5kg Unsalted Butter', price: 1150, category: 'Dairy & Fats', image: '🧈' },
  { name: '50 pcs Cake Boxes (10 inch)', price: 650, category: 'Packaging', image: '📦' }
];

export default function Webapp() {
  // --- BASE APP STATE ---
  const [theme, setTheme] = useState<'light' | 'dark'>('light');
  const [step, setStep] = useState<'login' | 'otp' | 'dashboard'>('login');

  // Phone login fields
  const [phoneNumber, setPhoneNumber] = useState('');
  const [otpFields, setOtpFields] = useState(['', '', '', '']);
  const [otpError, setOtpError] = useState('');
  const [otpTimer, setOtpTimer] = useState(29);

  // Navigation tabs
  // Home, Orders, Customers, Calendar, Supply, Settings, Expenses
  const [activeTab, setActiveTab] = useState<'home' | 'orders' | 'customers' | 'calendar' | 'supply' | 'settings' | 'expenses'>('home');

  // Bottom Sheet/Modal overlays
  const [activeSheet, setActiveSheet] = useState<
    'none' | 'new-order' | 'customer-profile' | 'edit-profile' |
    'manage-upi' | 'subscription-autopay' | 'choose-plan' |
    'subscription-status' | 'help-support' | 'legal-policies'
  >('none');

  // Business state
  const [bakeryName, setBakeryName] = useState('The Sugar Studio');
  const [ownerName, setOwnerName] = useState('Neha Sharma');
  const [upiId, setUpiId] = useState('thesugarstudio@oksbi');
  const [fssaiLicense, setFssaiLicense] = useState('21221008000123');
  const [defaultAdvance, setDefaultAdvance] = useState('50%');
  const [autoSendReceipts, setAutoSendReceipts] = useState(true);
  const [isTrialEnding, setIsTrialEnding] = useState(true);
  const [cartCount, setCartCount] = useState(3);

  // Database records
  const [orders, setOrders] = useState<Order[]>(initialOrders);
  const [customers, setCustomers] = useState<Customer[]>(initialCustomers);
  const [expenses, setExpenses] = useState<Expense[]>(initialExpenses);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);

  // New Order Form state
  const [newOrderForm, setNewOrderForm] = useState({
    customerName: '',
    phone: '',
    cakeCategory: 'Chocolate Truffle',
    weight: '1.5 kg',
    date: '2023-10-24',
    time: '4:00 PM',
    type: 'Pickup' as 'Pickup' | 'Delivery',
    totalAmount: '',
    advanceAmount: ''
  });

  // Expense form state
  const [expenseForm, setExpenseForm] = useState({
    item: '',
    amount: '',
    category: 'Raw Material' as Expense['category']
  });

  // Search and filters
  const [orderSearch, setOrderSearch] = useState('');
  const [orderTab, setOrderTab] = useState<'All' | 'In Production' | 'Ready' | 'Delivered' | 'Cancelled'>('In Production');
  const [customerSearch, setCustomerSearch] = useState('');
  const [customerSort, setCustomerSort] = useState('Highest Spend (LTV)');
  const [supplyTab, setSupplyTab] = useState('Chocolates');
  const [supplySearch, setSupplySearch] = useState('');
  const [selectedDate, setSelectedDate] = useState('24'); // default 24 Oct 2023
  const [activeMonthTab, setActiveMonthTab] = useState('Jul 26');

  // OTP Timer countdown
  useEffect(() => {
    let interval: any = null;
    if (step === 'otp' && otpTimer > 0) {
      interval = setInterval(() => {
        setOtpTimer((prev) => prev - 1);
      }, 1000);
    }
    return () => clearInterval(interval);
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

  const handleGetOtp = () => {
    if (phoneNumber.trim().length >= 10) {
      setStep('otp');
      setOtpTimer(29);
      setOtpError('');
    } else {
      setOtpError('Please enter a valid 10-digit mobile number.');
    }
  };

  const handleVerifyOtp = () => {
    const code = otpFields.join('');
    if (code.length === 4) {
      setStep('dashboard');
      setActiveTab('home');
    } else {
      setOtpError('Invalid code. Please enter 4 digits.');
    }
  };

  const handleLogExpense = (e: React.FormEvent) => {
    e.preventDefault();
    if (!expenseForm.item || !expenseForm.amount) return;

    const newExp: Expense = {
      id: `E-${expenses.length + 1}`,
      item: expenseForm.item,
      amount: parseFloat(expenseForm.amount),
      date: 'Oct 24, 2023',
      category: expenseForm.category
    };

    setExpenses([newExp, ...expenses]);
    setExpenseForm({ item: '', amount: '', category: 'Raw Material' });
  };

  const handleCreateOrder = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newOrderForm.customerName || !newOrderForm.totalAmount) return;

    const total = parseFloat(newOrderForm.totalAmount);
    const advance = parseFloat(newOrderForm.advanceAmount || '0');

    const newOrder: Order = {
      id: `K-${1000 + orders.length + 5}`,
      cakeName: `${newOrderForm.weight} ${newOrderForm.cakeCategory}`,
      customerName: newOrderForm.customerName,
      phone: newOrderForm.phone || '+91 99999 99999',
      deliveryDate: newOrderForm.date,
      deliveryTime: newOrderForm.time,
      status: 'In Production',
      advanceAmount: advance,
      totalAmount: total,
      type: newOrderForm.type
    };

    setOrders([newOrder, ...orders]);

    // Update customer CRM records
    const existingIndex = customers.findIndex(c => c.name.toLowerCase() === newOrderForm.customerName.toLowerCase());
    if (existingIndex > -1) {
      const updated = [...customers];
      updated[existingIndex].ordersCount += 1;
      updated[existingIndex].ltv += total;
      updated[existingIndex].lastOrderDate = 'Oct 24, 2023';
      setCustomers(updated);
    } else {
      setCustomers([
        {
          name: newOrderForm.customerName,
          phone: newOrderForm.phone || '+91 99999 99999',
          tag: '',
          ordersCount: 1,
          lastOrderDate: 'Oct 24, 2023',
          ltv: total
        },
        ...customers
      ]);
    }

    setNewOrderForm({
      customerName: '',
      phone: '',
      cakeCategory: 'Chocolate Truffle',
      weight: '1.5 kg',
      date: '2023-10-24',
      time: '4:00 PM',
      type: 'Pickup',
      totalAmount: '',
      advanceAmount: ''
    });
    setActiveSheet('none');
  };

  const totalCollectedThisMonth = expenses.reduce((sum, e) => sum + e.amount, 0);
  const outstandingBalance = orders
    .filter(o => o.status !== 'Delivered' && o.status !== 'Cancelled')
    .reduce((sum, o) => sum + (o.totalAmount - o.advanceAmount), 0);

  const deliveriesTodayCount = orders.filter(o => o.deliveryDate === '2023-10-24').length;

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

  const monthsList = ['May 26', 'Jun 26', 'Jul 26', 'Aug 26', 'Sept 26', 'Oct 26'];
  const monthData: Record<string, { label: string; delivered: string; estTotal: string; orders: number; startOffset: number; totalDays: number }> = {
    'May 26': { label: 'May 2026', delivered: '₹4,120', estTotal: '₹6,400', orders: 8, startOffset: 5, totalDays: 31 },
    'Jun 26': { label: 'June 2026', delivered: '₹8,450', estTotal: '₹11,200', orders: 16, startOffset: 1, totalDays: 30 },
    'Jul 26': { label: 'July 2026', delivered: '₹10,315', estTotal: '₹12,875', orders: 29, startOffset: 3, totalDays: 31 },
    'Aug 26': { label: 'August 2026', delivered: '₹0', estTotal: '₹950', orders: 1, startOffset: 6, totalDays: 31 },
    'Sept 26': { label: 'September 2026', delivered: '₹0', estTotal: '₹1,200', orders: 1, startOffset: 2, totalDays: 30 },
    'Oct 26': { label: 'October 2026', delivered: '₹0', estTotal: '₹1,500', orders: 1, startOffset: 4, totalDays: 31 },
  };

  const calendarDeliveries: Record<string, Record<number, { customer: string; cake: string; type: 'green' | 'yellow' | 'blue'; moreCount?: number }[]>> = {
    'Jul 26': {
      9: [{ customer: 'Shiuly', cake: 'Birthday cake', type: 'green' }],
      12: [{ customer: 'Jui', cake: 'Bento cake', type: 'green', moreCount: 2 }],
      13: [{ customer: 'Ishani', cake: 'Anniversary ..', type: 'green', moreCount: 2 }],
      14: [{ customer: 'Putul', cake: 'Custom / oth..', type: 'green', moreCount: 2 }],
      15: [{ customer: 'Mitali', cake: 'Tub Cake', type: 'green', moreCount: 1 }],
      16: [{ customer: 'Boumoni', cake: 'Birthday cake', type: 'green' }],
      18: [{ customer: 'Santu', cake: 'Bento cake', type: 'green' }],
      19: [{ customer: 'Maa', cake: 'Custom / oth..', type: 'green' }],
      20: [{ customer: 'Tithi', cake: 'Tub Cake', type: 'green', moreCount: 3 }],
      21: [{ customer: 'Arati', cake: 'Birthday cake', type: 'green', moreCount: 1 }],
      22: [{ customer: 'Anno', cake: 'Bento cake', type: 'green', moreCount: 2 }],
      23: [{ customer: 'Mitali', cake: 'Tub Cake', type: 'green', moreCount: 1 }],
      24: [{ customer: 'Antu', cake: 'Bento cake', type: 'yellow' }],
      28: [{ customer: 'Chayan D...', cake: 'Birthday cake', type: 'blue' }],
      30: [{ customer: 'Jyoti', cake: 'Wedding cake', type: 'blue' }]
    }
  };

  const handlePrevMonth = () => {
    const currentIdx = monthsList.indexOf(activeMonthTab);
    if (currentIdx > 0) {
      const nextTab = monthsList[currentIdx - 1];
      setActiveMonthTab(nextTab);
      setSelectedDate(nextTab === 'Jul 26' ? '24' : '1');
    }
  };

  const handleNextMonth = () => {
    const currentIdx = monthsList.indexOf(activeMonthTab);
    if (currentIdx < monthsList.length - 1) {
      const nextTab = monthsList[currentIdx + 1];
      setActiveMonthTab(nextTab);
      setSelectedDate(nextTab === 'Jul 26' ? '24' : '1');
    }
  };

  return (
    <div className="min-h-screen w-full flex justify-center bg-zinc-100 dark:bg-zinc-950 transition-colors duration-300">
      <div className="noise-bg h-screen max-h-screen w-full max-w-[480px] flex flex-col bg-[var(--background)] shadow-2xl border-x border-[var(--border)] relative overflow-hidden">

        {/* 1. ONBOARDING LOGIN VIEW */}
        {step === 'login' && (
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
                Enter your mobile number to log in<br />or create your bakery's workspace.
              </p>

              <div className="w-full mb-6">
                <div className="flex border border-[var(--border)] rounded-2xl bg-[var(--surface)] overflow-hidden focus-within:border-[var(--accent)] transition-all h-[56px] items-center">
                  <button className="flex items-center gap-1.5 px-4 h-full border-r border-[var(--border)] text-sm font-semibold hover:bg-neutral-50 dark:hover:bg-neutral-900 transition-colors text-[var(--text-primary)]">
                    +91 <ChevronDown size={14} className="text-[var(--text-secondary)]" />
                  </button>
                  <input
                    type="tel"
                    placeholder="Enter 10-digit mobile number"
                    value={phoneNumber}
                    onChange={(e) => setPhoneNumber(e.target.value.replace(/\D/g, '').slice(0, 10))}
                    className="w-full h-full px-4 text-[14.5px] font-medium outline-none bg-transparent text-[var(--text-primary)] placeholder-[var(--text-secondary)]/50"
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
                onClick={handleGetOtp}
                className="w-full bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-white font-bold py-4 rounded-2xl shadow-md transition-all active:scale-[0.99] cursor-pointer text-sm tracking-wide h-[54px] flex items-center justify-center mb-8"
              >
                Get OTP
              </button>

              <p className="text-center text-[11px] leading-relaxed text-[var(--text-secondary)] px-4 max-w-[280px]">
                By continuing, you agree to Kamai's<br />
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
                Verify your number.
              </h1>

              <p className="text-center text-[14.5px] leading-relaxed text-[var(--text-secondary)] mb-8 px-2">
                We've sent a 4-digit secure PIN to<br />
                <span className="font-semibold text-[var(--text-primary)]">+91 {phoneNumber.slice(0, 5) + ' ' + phoneNumber.slice(5)}</span>. <span className="text-[var(--accent)] cursor-pointer hover:underline font-bold ml-1" onClick={() => setStep('login')}>Edit</span>
              </p>

              <div className="flex justify-between gap-3 mb-8 max-w-[290px] mx-auto w-full">
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
                      if (e.target.value && idx < 3) {
                        document.getElementById(`otp-${idx + 1}`)?.focus();
                      }
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Backspace' && !val && idx > 0) {
                        document.getElementById(`otp-${idx - 1}`)?.focus();
                      }
                    }}
                    className="w-16 h-20 text-center text-3xl font-bold rounded-2xl border-2 border-[var(--border)] focus:border-[var(--accent)] outline-none bg-[var(--surface)] transition-all text-[var(--text-primary)] caret-[var(--accent)] shadow-sm"
                  />
                ))}
              </div>

              <p className="text-center text-[13px] font-medium text-[var(--text-secondary)] mb-8">
                Didn't receive the code? {otpTimer > 0 ? (
                  <span>Resend in <span className="text-[var(--accent)] font-semibold">00:{otpTimer < 10 ? `0${otpTimer}` : otpTimer}</span></span>
                ) : (
                  <span className="text-[var(--accent)] font-semibold cursor-pointer hover:underline" onClick={() => setOtpTimer(29)}>Resend Code</span>
                )}
              </p>

              <button
                onClick={handleVerifyOtp}
                className="w-full bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-white font-bold py-4 rounded-2xl shadow-md transition-all active:scale-[0.99] cursor-pointer text-sm tracking-wide h-[54px] flex items-center justify-center"
              >
                Verify & Enter Cockpit
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
                  className="w-10 h-10 rounded-full overflow-hidden cursor-pointer"
                >
                  <img
                    src="https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=100&fit=crop&q=80"
                    alt="Avatar"
                    className="w-full h-full object-cover"
                  />
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
                      Hello, {bakeryName} <span className="inline-block animate-wiggle">👋</span>
                    </h2>
                    <p className="text-xs md:text-sm text-[var(--text-secondary)] mt-1">
                      Here's what's happening with your bakery today.
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
                          <span className="text-3xl font-extrabold tracking-tight">₹{outstandingBalance.toLocaleString('en-IN')}</span>
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
                          <span className="text-3xl font-extrabold tracking-tight">{deliveriesTodayCount} Orders</span>
                          <p className="text-[10px] text-[var(--text-secondary)] mt-1.5 font-medium">Scheduled for delivery today</p>
                        </div>
                      </div>

                    </div>

                    {/* Trial End Warning (if active) */}
                    {isTrialEnding && (
                      <div
                        onClick={() => setActiveSheet('subscription-status')}
                        className="bg-[var(--surface)] p-6 rounded-[24px] border border-[var(--border)] shadow-sm cursor-pointer hover:border-[var(--accent)] transition-all flex items-center gap-4 w-full"
                        style={{ background: 'linear-gradient(to right, var(--surface), rgba(234, 88, 12, 0.04))' }}
                      >
                        <span className="text-4xl flex-shrink-0">🎂</span>
                        <div className="flex-1 min-w-0">
                          <h4 className="font-serif font-bold text-sm text-[var(--text-primary)]">Your free trial is ending soon.</h4>
                          <div className="inline-flex items-center gap-1.5 bg-[#EA580C] text-white px-3 py-1 rounded-full text-[10.5px] font-semibold mt-2">
                            7 Days Remaining
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

                    {/* Stacked vertical list of Priority items */}
                    <div className="flex flex-col gap-4">
                      {orders
                        .filter(o => o.deliveryDate === '2023-10-24')
                        .map((o) => {
                          const isTruffle = o.cakeName.toLowerCase().includes('truffle');
                          const isForest = o.cakeName.toLowerCase().includes('forest');
                          const imgUrl = isTruffle
                            ? 'https://images.unsplash.com/photo-1578985545062-69928b1d9587?w=200&fit=crop&q=80'
                            : isForest
                              ? 'https://images.unsplash.com/photo-1606313564200-e75d5e30476c?w=200&fit=crop&q=80'
                              : 'https://images.unsplash.com/photo-1588195538326-c5b1e9f8011b?w=200&fit=crop&q=80';

                          return (
                            <div
                              key={o.id}
                              className="bg-[var(--surface)] p-4 rounded-[22px] border border-[var(--border)] flex items-center gap-4 shadow-sm hover:shadow-md transition-all cursor-pointer hover:border-[var(--accent)]/30"
                              onClick={() => {
                                setSelectedCustomer(customers.find(c => c.name === o.customerName) || null);
                                setActiveSheet('customer-profile');
                              }}
                            >
                              <div className="w-16 h-16 rounded-2xl overflow-hidden bg-neutral-100 flex-shrink-0 border border-[var(--border)]">
                                <img src={imgUrl} alt={o.cakeName} className="w-full h-full object-cover" />
                              </div>
                              <div className="flex-1 min-w-0">
                                <h4 className="font-serif font-bold text-sm md:text-base text-[var(--text-primary)] truncate">{o.cakeName}</h4>
                                <p className="text-[11.5px] text-[var(--text-secondary)] mt-0.5">
                                  {o.customerName} • <span className="text-[var(--accent)] font-semibold">Due at {o.deliveryTime}</span>
                                </p>
                              </div>
                              <div className="flex-shrink-0">
                                {o.advanceAmount > 0 ? (
                                  <span className="bg-emerald-50 dark:bg-emerald-950/20 text-emerald-700 dark:text-emerald-400 text-[10px] font-bold px-2.5 py-1.5 rounded-full border border-emerald-100">
                                    ₹{o.advanceAmount} Paid
                                  </span>
                                ) : (
                                  <span className="bg-neutral-50 dark:bg-neutral-900 text-neutral-600 dark:text-neutral-400 text-[10px] font-bold px-2.5 py-1.5 rounded-full border border-[var(--border)]">
                                    No Advance
                                  </span>
                                )}
                              </div>
                            </div>
                          );
                        })}
                    </div>
                  </div>

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
                      {['All', 'In Production', 'Ready', 'Delivered', 'Cancelled'].map((tabName) => (
                        <button
                          key={tabName}
                          onClick={() => setOrderTab(tabName as any)}
                          className={`px-4 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-all cursor-pointer ${orderTab === tabName
                            ? 'bg-[var(--accent)] text-white shadow-sm'
                            : 'bg-[var(--surface)] text-[var(--text-secondary)] border border-[var(--border)] hover:bg-neutral-50'
                            }`}
                        >
                          {tabName}
                        </button>
                      ))}
                    </div>

                  </div>

                  {/* Stacked vertical list of order cards */}
                  <div className="flex flex-col gap-4">
                    {orders
                      .filter(o => {
                        const matchesSearch = o.cakeName.toLowerCase().includes(orderSearch.toLowerCase()) ||
                          o.customerName.toLowerCase().includes(orderSearch.toLowerCase()) ||
                          o.id.toLowerCase().includes(orderSearch.toLowerCase());
                        const matchesTab = orderTab === 'All' || o.status === orderTab;
                        return matchesSearch && matchesTab;
                      })
                      .map((o) => (
                        <div
                          key={o.id}
                          onClick={() => {
                            setSelectedCustomer(customers.find(c => c.name === o.customerName) || null);
                            setActiveSheet('customer-profile');
                          }}
                          className="bg-[var(--surface)] p-5 rounded-[24px] border border-[var(--border)] shadow-sm hover:shadow-md transition-all cursor-pointer flex flex-col justify-between min-h-[170px] hover:border-[var(--accent)]/30"
                        >
                          <div>
                            <div className="flex justify-between items-start mb-3">
                              <span className="text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-wider">{o.id}</span>
                              <div className="flex items-center gap-1 text-[11px] text-[var(--text-secondary)] font-medium">
                                <CalendarIcon size={12} />
                                <span>Oct {o.deliveryDate.split('-')[2]}, {o.deliveryTime}</span>
                              </div>
                            </div>

                            <h3 className="font-serif font-bold text-lg text-[var(--text-primary)] mb-1 leading-snug">{o.cakeName}</h3>
                            <p className="text-xs text-[var(--text-secondary)]">Customer: {o.customerName}</p>
                          </div>

                          <div className="flex justify-between items-center pt-4 mt-4 border-t border-[var(--border)]/50">
                            {/* Status Badge */}
                            <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10.5px] font-bold ${o.status === 'In Production' ? 'bg-orange-50 dark:bg-orange-950/20 text-orange-700 dark:text-orange-400 border border-orange-200/50' :
                              o.status === 'Ready' ? 'bg-emerald-50 dark:bg-emerald-950/20 text-emerald-700 dark:text-emerald-400 border border-emerald-200/50' :
                                o.status === 'Delivered' ? 'bg-neutral-50 dark:bg-neutral-900 text-neutral-600 dark:text-neutral-400' :
                                  'bg-red-50 text-red-600'
                              }`}>
                              <span className="w-1.5 h-1.5 bg-current rounded-full"></span>
                              {o.status}
                            </span>

                            <span className="bg-emerald-50 dark:bg-emerald-950/20 text-emerald-700 dark:text-emerald-400 text-[10.5px] font-bold px-2.5 py-1.5 rounded-full border border-emerald-100 flex items-center gap-1">
                              <CheckCircle2 size={12} />
                              ₹{o.advanceAmount} Advance
                            </span>
                          </div>
                        </div>
                      ))}
                  </div>

                </div>
              )}

              {/* TAB 3: CUSTOMERS */}
              {activeTab === 'customers' && (
                <div className="w-full animate-fadeIn">

                  {/* Header Title */}
                  <div className="mb-6 flex justify-between items-center">
                    <h2 className="font-serif text-3xl md:text-4xl font-bold text-[var(--text-primary)]">Customers</h2>
                    <button
                      onClick={() => {
                        setSelectedCustomer(null);
                        setActiveSheet('customer-profile');
                      }}
                      className="bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-white px-5 py-2.5 rounded-2xl text-xs font-bold shadow-md active:scale-95 transition-all flex items-center gap-2 cursor-pointer"
                    >
                      <Plus size={16} strokeWidth={2.5} /> Add Customer
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
                      <span className="text-[11px] text-[var(--text-secondary)] font-semibold">Total Clients: {customers.length}</span>
                    </div>
                  </div>

                  {/* Stacked vertical list of customer cards */}
                  <div className="flex flex-col gap-4">
                    {customers
                      .filter(c => c.name.toLowerCase().includes(customerSearch.toLowerCase()) || c.phone.includes(customerSearch))
                      .map((c) => {
                        const colors = ['bg-amber-100 text-amber-800 border-amber-200', 'bg-orange-100 text-orange-800 border-orange-200', 'bg-orange-100 text-orange-800 border-orange-200', 'bg-neutral-100 text-neutral-800 border-neutral-200'];
                        const initial = c.name.charAt(0);
                        return (
                          <div
                            key={c.phone}
                            onClick={() => {
                              setSelectedCustomer(c);
                              setActiveSheet('customer-profile');
                            }}
                            className="bg-[var(--surface)] p-5 rounded-[24px] border border-[var(--border)] shadow-sm hover:shadow-md transition-all cursor-pointer flex flex-col justify-between min-h-[150px] hover:border-[var(--accent)]/30"
                          >
                            <div className="flex items-start justify-between">
                              <div className="flex items-center gap-3">
                                <div className={`w-12 h-12 rounded-full ${colors[c.name.length % colors.length]} border flex items-center justify-center font-bold text-base`}>
                                  {initial}
                                </div>
                                <div>
                                  <h3 className="font-bold text-sm md:text-base text-[var(--text-primary)] flex items-center gap-1.5 leading-snug">
                                    {c.name}
                                    {c.tag && (
                                      <span className="bg-[#EA580C]/10 text-[#EA580C] text-[9px] font-extrabold px-2 py-0.5 rounded-full border border-[#EA580C]/20">
                                        {c.tag}
                                      </span>
                                    )}
                                  </h3>
                                  <p className="text-[11.5px] text-[var(--text-secondary)] flex items-center gap-1 mt-1">
                                    <Phone size={11} />
                                    {c.phone}
                                  </p>
                                </div>
                              </div>

                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  window.open(`https://wa.me/${c.phone.replace(/\D/g, '')}`, '_blank');
                                }}
                                className="w-10 h-10 rounded-full bg-emerald-50 hover:bg-emerald-100 text-emerald-600 flex items-center justify-center border border-emerald-100 transition-colors"
                              >
                                <MessageSquare size={16} />
                              </button>
                            </div>

                            <div className="flex justify-between items-center mt-5 pt-3.5 border-t border-[var(--border)]/50 text-[11px] text-[var(--text-secondary)] font-medium">
                              <div>
                                <span>Orders: <span className="font-bold text-[var(--text-primary)]">{c.ordersCount}</span></span>
                                <span className="mx-2">•</span>
                                <span>Last: <span className="font-bold text-[var(--text-primary)]">{c.lastOrderDate}</span></span>
                              </div>
                              <span className="font-extrabold text-[var(--text-primary)] text-xs">LTV: ₹{c.ltv.toLocaleString('en-IN')}</span>
                            </div>
                          </div>
                        );
                      })}
                  </div>

                </div>
              )}

              {/* TAB 4: CALENDAR */}
              {activeTab === 'calendar' && (
                <div className="w-full animate-fadeIn">

                  {/* Header Title */}
                  <div className="mb-6 flex justify-between items-center">
                    <h2 className="font-serif text-3xl md:text-4xl font-bold text-[var(--text-primary)]">Schedule</h2>
                    <span
                      onClick={() => setSelectedDate('24')}
                      className="text-xs font-bold text-[var(--accent)] hover:underline cursor-pointer bg-[var(--surface)] py-1.5 px-3.5 rounded-full border border-[var(--border)] shadow-sm"
                    >
                      Today
                    </span>
                  </div>

                  {/* Calendar Layout: stacked vertically for mobile view */}
                  <div className="flex flex-col gap-6 w-full">

                    {/* Custom high-fidelity Calendar Component */}
                    <div className="bg-[var(--surface)] rounded-[28px] border border-[var(--border)] p-5 shadow-sm w-full flex flex-col items-center">
                      
                      {/* Month Swapping Header */}
                      <div className="w-full flex flex-col items-center mb-6">
                        <div className="w-full flex items-center justify-between px-1 mb-2">
                          <button 
                            onClick={handlePrevMonth}
                            className="p-2 rounded-[16px] bg-[var(--background)] hover:bg-neutral-100 text-[var(--text-primary)] transition-all border border-[var(--border)] cursor-pointer"
                          >
                            <ArrowLeft size={16} />
                          </button>
                          
                          <span className="text-base font-extrabold text-[var(--text-primary)] font-serif">
                            {monthData[activeMonthTab]?.label || activeMonthTab}
                          </span>
                          
                          <button 
                            onClick={handleNextMonth}
                            className="p-2 rounded-[16px] bg-[var(--background)] hover:bg-neutral-100 text-[var(--text-primary)] transition-all border border-[var(--border)] cursor-pointer rotate-180"
                          >
                            <ArrowLeft size={16} />
                          </button>
                        </div>
                        
                        <div className="text-[11.5px] font-semibold text-[var(--text-secondary)]">
                          Delivered: <span className="text-emerald-600 dark:text-emerald-400 font-bold">{monthData[activeMonthTab]?.delivered || '₹0'}</span>
                          <span className="mx-2">•</span>
                          Est. Total: <span className="text-amber-800 dark:text-amber-500 font-bold">{monthData[activeMonthTab]?.estTotal || '₹0'}</span>
                        </div>
                      </div>

                      {/* Month Selector Horizontal Scrollbar */}
                      <div className="flex gap-2.5 overflow-x-auto no-scrollbar pb-3 mb-6 w-full border-b border-[var(--border)]/50">
                        {monthsList.map((mTab) => {
                          const data = monthData[mTab];
                          const isActive = activeMonthTab === mTab;
                          return (
                            <div
                              key={mTab}
                              onClick={() => {
                                setActiveMonthTab(mTab);
                                // Default select 24 for July, or 1 for other months
                                setSelectedDate(mTab === 'Jul 26' ? '24' : '1');
                              }}
                              className={`min-w-[84px] h-[54px] rounded-[18px] flex flex-col items-center justify-center border text-center transition-all cursor-pointer select-none ${
                                isActive
                                  ? 'bg-[#2D1F17] dark:bg-neutral-800 border-[#2D1F17] dark:border-neutral-700 text-white'
                                  : 'bg-[var(--surface)] border-[var(--border)] text-[var(--text-secondary)] hover:bg-neutral-50'
                              }`}
                            >
                              <span className={`text-[11px] font-bold ${isActive ? 'text-white' : 'text-[var(--text-primary)]'}`}>
                                {mTab}
                              </span>
                              <span className={`text-[9px] font-semibold mt-0.5 ${isActive ? 'text-neutral-300' : 'text-[var(--text-secondary)]'}`}>
                                {data?.orders} {data?.orders === 1 ? 'order' : 'orders'}
                              </span>
                            </div>
                          );
                        })}
                      </div>

                      {/* Weekdays Headers */}
                      <div className="grid grid-cols-7 text-center text-[10px] font-bold text-[var(--text-secondary)] mb-4 gap-y-1 uppercase tracking-widest w-full font-serif">
                        <div>Sun</div><div>Mon</div><div>Tue</div><div>Wed</div><div>Thu</div><div>Fri</div><div>Sat</div>
                      </div>

                      {/* Days Grid */}
                      <div className="grid grid-cols-7 gap-y-3 gap-x-1.5 w-full">
                        {/* Render offsets */}
                        {Array.from({ length: monthData[activeMonthTab]?.startOffset || 0 }).map((_, idx) => (
                          <div key={`offset-${idx}`} className="py-2.5"></div>
                        ))}
                        
                        {/* Render actual days */}
                        {Array.from({ length: monthData[activeMonthTab]?.totalDays || 30 }).map((_, d) => {
                          const dayInt = d + 1;
                          const dayNum = dayInt.toString();
                          const isSelected = selectedDate === dayNum;
                          const isToday = activeMonthTab === 'Jul 26' && dayNum === '24';
                          
                          const deliveries = calendarDeliveries[activeMonthTab]?.[dayInt];
                          const hasDeliveries = !!deliveries;

                          if (hasDeliveries) {
                            const first = deliveries[0];
                            let bgClass = '';
                            if (first.type === 'green') bgClass = 'bg-[#E6F4EA] text-[#137333] border border-[#CEEAD6]';
                            else if (first.type === 'yellow') bgClass = 'bg-[#FEF7E0] text-[#B06000] border border-[#FEEFC3]';
                            else if (first.type === 'blue') bgClass = 'bg-[#E8F0FE] text-[#1A73E8] border border-[#D2E3FC]';

                            return (
                              <div
                                key={d}
                                onClick={() => setSelectedDate(dayNum)}
                                className={`bg-[var(--surface)] rounded-[18px] border p-1.5 flex flex-col items-center min-h-[92px] justify-between cursor-pointer hover:border-[var(--accent)] transition-all shadow-sm w-full ${
                                  isSelected 
                                    ? 'border-[#2D1F17] dark:border-neutral-300 ring-1 ring-[#2D1F17] dark:ring-neutral-300' 
                                    : 'border-[var(--border)]'
                                }`}
                              >
                                {isToday ? (
                                  <span className="w-5 h-5 rounded-full bg-[var(--accent)] text-white flex items-center justify-center text-[10px] font-extrabold shadow-sm">
                                    {dayNum}
                                  </span>
                                ) : (
                                  <span className="text-xs font-extrabold text-[var(--text-primary)]">
                                    {dayNum}
                                  </span>
                                )}
                                
                                <div className={`w-full rounded-xl py-1 px-1 text-center text-[8.5px] leading-tight font-extrabold ${bgClass} mt-1 truncate`}>
                                  <div className="truncate">{first.customer}</div>
                                  <div className="text-[7px] opacity-80 truncate mt-0.5 font-normal leading-none">{first.cake}</div>
                                </div>
                                
                                {first.moreCount ? (
                                  <span className="text-[8.5px] font-extrabold text-amber-800 dark:text-amber-500 mt-0.5">
                                    +{first.moreCount} more
                                  </span>
                                ) : (
                                  <div className="h-2"></div>
                                )}
                              </div>
                            );
                          }

                          return (
                            <div
                              key={d}
                              onClick={() => setSelectedDate(dayNum)}
                              className="flex flex-col items-center justify-start py-2 relative cursor-pointer w-full min-h-[92px]"
                            >
                              {isToday ? (
                                <span className="w-6 h-6 rounded-full bg-[var(--accent)] text-white flex items-center justify-center text-xs font-extrabold shadow-sm">
                                  {dayNum}
                                </span>
                              ) : (
                                <span className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-all ${
                                  isSelected 
                                    ? 'bg-[#2D1F17] dark:bg-neutral-800 text-white' 
                                    : 'text-[var(--text-secondary)]/70 hover:bg-neutral-100 dark:hover:bg-neutral-900'
                                }`}>
                                  {dayNum}
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
                          <span className="w-3 h-3 rounded-full bg-[var(--surface)] border border-[var(--border)]"></span>
                          <span>Has deliveries</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <span className="w-3 h-3 rounded-full bg-[#2D1F17] dark:bg-neutral-800"></span>
                          <span>Selected</span>
                        </div>
                      </div>

                    </div>

                    {/* Right Column (List of deliveries for selected date) */}
                    <div className="flex flex-col gap-3.5">
                      <h3 className="font-serif text-lg font-bold">Deliveries for {activeMonthTab.split(' ')[0]} {selectedDate}</h3>

                      {orders
                        .filter(o => o.deliveryDate.endsWith(`-${selectedDate.padStart(2, '0')}`))
                        .map((o) => (
                          <div
                            key={o.id}
                            className="bg-[var(--surface)] p-4 rounded-[22px] border border-[var(--border)] shadow-sm flex items-center justify-between hover:shadow-md transition-all cursor-pointer hover:border-[var(--accent)]/30"
                            onClick={() => {
                              setSelectedCustomer(customers.find(c => c.name === o.customerName) || null);
                              setActiveSheet('customer-profile');
                            }}
                          >
                            <div className="flex items-center gap-4">
                              <span className="text-xs font-bold text-[var(--accent)]">{o.deliveryTime}</span>
                              <div>
                                <h4 className="font-serif font-bold text-sm text-[var(--text-primary)]">{o.cakeName}</h4>
                                <p className="text-[10px] text-[var(--text-secondary)] mt-0.5">Customer: {o.customerName}</p>
                              </div>
                            </div>

                            <div className="flex items-center gap-2">
                              <span className="bg-emerald-50 dark:bg-emerald-950/20 text-emerald-700 dark:text-emerald-400 text-[10px] font-bold px-2 py-0.5 rounded-full border border-emerald-100">
                                Paid
                              </span>
                              <ChevronRight size={14} className="text-[var(--text-secondary)]" />
                            </div>
                          </div>
                        ))}

                      {orders.filter(o => o.deliveryDate.endsWith(`-${selectedDate.padStart(2, '0')}`)).length === 0 && (
                        <div className="text-center py-12 bg-[var(--surface)] rounded-[22px] border border-dashed border-[var(--border)]">
                          <span className="text-2xl">🥣</span>
                          <p className="text-xs text-[var(--text-secondary)] mt-2">No deliveries scheduled for this day.</p>
                        </div>
                      )}
                    </div>

                  </div>

                </div>
              )}

              {/* TAB 5: SUPPLY HUB */}
              {activeTab === 'supply' && (
                <div className="w-full animate-fadeIn">

                  {/* Header Title */}
                  <div className="mb-6 flex justify-between items-center">
                    <h2 className="font-serif text-3xl md:text-4xl font-bold text-[var(--text-primary)]">Supply Hub</h2>
                    <button className="relative w-11 h-11 rounded-full border border-[var(--border)] bg-[var(--surface)] flex items-center justify-center cursor-pointer shadow-sm">
                      <ShoppingBag size={18} />
                      <span className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-[#EA580C] text-white text-[9px] font-extrabold rounded-full flex items-center justify-center border border-white">
                        {cartCount}
                      </span>
                    </button>
                  </div>

                  {/* Filter Section */}
                  <div className="flex flex-col gap-3 mb-6">
                    <div className="relative flex items-center border border-[var(--border)] rounded-2xl bg-[var(--surface)] overflow-hidden px-4 focus-within:border-[var(--accent)] transition-colors">
                      <Search size={16} className="text-[var(--text-secondary)]" />
                      <input
                        type="text"
                        placeholder="Search bulk chocolate, boxes, butter..."
                        value={supplySearch}
                        onChange={(e) => setSupplySearch(e.target.value)}
                        className="w-full py-3 px-2 text-xs outline-none bg-transparent"
                      />
                    </div>

                    <div className="flex gap-2 overflow-x-auto no-scrollbar py-1">
                      {['All', 'Chocolates', 'Dairy & Fats', 'Packaging', 'Tools'].map((tabName) => (
                        <button
                          key={tabName}
                          onClick={() => setSupplyTab(tabName)}
                          className={`px-4 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-all cursor-pointer ${supplyTab === tabName
                            ? 'bg-[var(--accent)] text-white shadow-sm'
                            : 'bg-[var(--surface)] text-[var(--text-secondary)] border border-[var(--border)] hover:bg-neutral-50'
                            }`}
                        >
                          {tabName}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Partner Banner & Products Grid layout */}
                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start mb-8">

                    {/* Verified Partner Banner */}
                    <div className="bg-[var(--surface)] p-6 rounded-[24px] border border-[var(--border)] shadow-sm flex flex-col justify-between overflow-hidden relative min-h-[220px]">
                      <div>
                        <span className="text-[9.5px] font-extrabold text-[#EA580C] bg-[#EA580C]/10 border border-[#EA580C]/20 px-3 py-1 rounded-full uppercase tracking-wider">
                          Verified Local Partner
                        </span>
                        <h3 className="font-serif font-bold text-xl text-[var(--text-primary)] mt-3">Gupta Wholesale Mart</h3>
                        <p className="text-[10px] text-[var(--text-secondary)] mt-1">2.4 km away • Fast Flash Pickup Available</p>
                      </div>

                      <div className="flex items-center justify-between mt-4">
                        <div className="inline-flex items-center gap-1 bg-amber-50 dark:bg-amber-950/20 text-[#EA580C] text-[10px] font-bold px-2.5 py-1 rounded-full border border-amber-200/50">
                          🚚 Flash Pickup
                        </div>
                        <span className="text-3xl">🏭</span>
                      </div>
                    </div>

                    {/* Products Grid */}
                    <div className="lg:col-span-2 flex flex-col">
                      <div className="flex justify-between items-center mb-4">
                        <h3 className="font-serif text-lg font-bold">Popular Products</h3>
                        <span className="text-xs text-[var(--text-secondary)]">Showing {supplyProducts.filter(p => supplyTab === 'All' || p.category === supplyTab).length} products</span>
                      </div>

                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                        {supplyProducts
                          .filter(p => supplyTab === 'All' || p.category === supplyTab)
                          .filter(p => p.name.toLowerCase().includes(supplySearch.toLowerCase()))
                          .map((p, idx) => (
                            <div
                              key={idx}
                              className="bg-[var(--surface)] rounded-[22px] border border-[var(--border)] p-3 shadow-sm hover:shadow-md transition-all flex flex-col hover:border-[var(--accent)]/30"
                            >
                              <div className="w-full h-24 sm:h-28 bg-neutral-50 dark:bg-[#1A0C06] rounded-xl flex items-center justify-center text-4xl mb-3 border border-[var(--border)] select-none">
                                {p.image}
                              </div>
                              <h4 className="font-bold text-xs text-[var(--text-primary)] line-clamp-2 leading-tight flex-1">{p.name}</h4>
                              <span className="text-[9.5px] text-[var(--text-secondary)] mt-1">by Gupta Wholesale</span>

                              <div className="flex items-center justify-between mt-3 pt-2.5 border-t border-[var(--border)]/50">
                                <span className="font-bold text-xs sm:text-sm">₹{p.price.toLocaleString('en-IN')}</span>
                                <button className="text-[10px] font-bold text-[var(--accent)] hover:bg-orange-50 px-2.5 py-1 rounded-full border border-[var(--accent)]/30 hover:border-[var(--accent)] transition-all cursor-pointer">
                                  View
                                </button>
                              </div>
                            </div>
                          ))}
                      </div>
                    </div>

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
                      <div className="w-16 h-16 rounded-full overflow-hidden border border-[var(--border)]">
                        <img
                          src="https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=120&fit=crop&q=80"
                          alt="Avatar"
                          className="w-full h-full object-cover"
                        />
                      </div>
                      <div>
                        <h3 className="font-serif font-bold text-lg text-[var(--text-primary)]">{bakeryName}</h3>
                        <p className="text-xs text-[var(--text-secondary)] mt-0.5">+91 {phoneNumber.replace(/(\d{5})(\d{5})/, '$1 $2')}</p>
                      </div>
                    </div>

                    <button
                      onClick={() => setActiveSheet('edit-profile')}
                      className="bg-[var(--background)] hover:bg-[var(--surface)] border border-[var(--border)] text-xs font-bold px-4 py-2 rounded-xl transition-all cursor-pointer text-[var(--accent)]"
                    >
                      Edit Profile &gt;
                    </button>
                  </div>

                  {/* Settings Grid (Stacked for Mobile View) */}
                  <div className="flex flex-col gap-6">

                    {/* Category 1: Business Operations */}
                    <div className="bg-[var(--surface)] rounded-[24px] border border-[var(--border)] p-5 shadow-sm">
                      <h4 className="text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-wider mb-4 flex items-center gap-1.5">
                        🏪 Business Operations
                      </h4>

                      <div className="flex flex-col gap-1.5">
                        <div
                          onClick={() => setActiveSheet('edit-profile')}
                          className="flex items-center justify-between py-2.5 border-b border-[var(--border)]/50 last:border-b-0 cursor-pointer group"
                        >
                          <div className="flex items-center gap-2">
                            <Percent size={15} className="text-[var(--text-secondary)] group-hover:text-[var(--accent)]" />
                            <span className="text-xs font-medium text-[var(--text-primary)]">Default Advance Needed</span>
                          </div>
                          <span className="text-xs font-bold text-[var(--text-secondary)] group-hover:text-[var(--text-primary)] flex items-center gap-1">
                            {defaultAdvance} <ChevronRight size={14} />
                          </span>
                        </div>

                        <div className="flex items-center justify-between py-2.5 border-b border-[var(--border)]/50 last:border-b-0">
                          <div className="flex items-center gap-2">
                            <MessageSquare size={15} className="text-[var(--text-secondary)]" />
                            <span className="text-xs font-medium text-[var(--text-primary)]">Auto-Send Receipts</span>
                          </div>
                          <label className="relative inline-flex items-center cursor-pointer">
                            <input
                              type="checkbox"
                              checked={autoSendReceipts}
                              onChange={() => setAutoSendReceipts(!autoSendReceipts)}
                              className="sr-only peer"
                            />
                            <div className="w-9 h-5 bg-neutral-200 peer-focus:outline-none rounded-full peer dark:bg-neutral-800 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all dark:border-gray-600 peer-checked:bg-[var(--accent)]"></div>
                          </label>
                        </div>

                        <div
                          onClick={() => setActiveSheet('edit-profile')}
                          className="flex items-center justify-between py-2.5 cursor-pointer group"
                        >
                          <div className="flex items-center gap-2">
                            <ShieldCheck size={15} className="text-[var(--text-secondary)] group-hover:text-[var(--accent)]" />
                            <span className="text-xs font-medium text-[var(--text-primary)]">FSSAI License</span>
                          </div>
                          <span className="text-xs font-bold text-[var(--accent)] flex items-center gap-1">
                            {fssaiLicense ? 'Verified' : 'Add Number'} <ChevronRight size={14} />
                          </span>
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
                          onClick={() => setActiveSheet('subscription-autopay')}
                          className="flex items-center justify-between py-2.5 border-b border-[var(--border)]/50 last:border-b-0 cursor-pointer group"
                        >
                          <div className="flex items-center gap-2">
                            <Sparkles size={15} className="text-[var(--text-secondary)] group-hover:text-[var(--accent)]" />
                            <span className="text-xs font-medium text-[var(--text-primary)]">Subscription Plan</span>
                          </div>
                          <span className="text-xs font-bold text-[var(--text-secondary)] group-hover:text-[var(--text-primary)] flex items-center gap-1">
                            Early Adopter Pro <ChevronRight size={14} />
                          </span>
                        </div>

                        <div
                          onClick={() => setActiveSheet('subscription-autopay')}
                          className="flex items-center justify-between py-2.5 cursor-pointer group"
                        >
                          <div className="flex items-center gap-2">
                            <CreditCard size={15} className="text-[var(--text-secondary)] group-hover:text-[var(--accent)]" />
                            <span className="text-xs font-medium text-[var(--text-primary)]">Manage UPI AutoPay</span>
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
                    onClick={() => setStep('login')}
                    className="w-full py-4 text-xs font-bold text-red-600 bg-red-50 dark:bg-red-950/20 hover:bg-red-100 rounded-2xl flex items-center justify-center gap-2 border border-red-200/40 transition-colors mt-6 cursor-pointer"
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
                    <button className="text-xs font-bold text-[var(--accent)] hover:underline flex items-center gap-0.5 cursor-pointer">
                      Download Report <ArrowUpRight size={14} />
                    </button>
                  </div>

                  {/* Monthly Aggregates banner */}
                  <div className="bg-[var(--surface)] p-6 rounded-[24px] border border-[var(--border)] shadow-sm mb-6 flex justify-between items-center max-w-xl">
                    <div>
                      <span className="text-xs text-[var(--text-secondary)] font-semibold">Spent this Month</span>
                      <h3 className="font-serif text-3xl md:text-4xl font-extrabold mt-1 text-[var(--text-primary)]">
                        ₹{totalCollectedThisMonth.toLocaleString('en-IN')}
                      </h3>
                    </div>
                    <div className="w-14 h-14 bg-orange-50 dark:bg-[#1A0C06] rounded-full flex items-center justify-center text-orange-600 border border-orange-100 shadow-inner">
                      <Wallet size={24} />
                    </div>
                  </div>

                  {/* Grid Split: Form on left, recent logs on right */}
                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">

                    {/* Log form (Left Column) */}
                    <form onSubmit={handleLogExpense} className="bg-[var(--surface)] p-5 rounded-[24px] border border-[var(--border)] shadow-sm">
                      <h4 className="font-serif font-bold text-base mb-4">Log New Expense</h4>

                      <div className="flex flex-col gap-3.5">
                        <div>
                          <label className="text-[10px] font-bold text-[var(--text-secondary)] mb-1 block">Item description</label>
                          <div className="flex items-center border border-[var(--border)] rounded-xl bg-[var(--background)] px-3 focus-within:border-[var(--accent)] transition-colors">
                            <Info size={14} className="text-[var(--text-secondary)]" />
                            <input
                              type="text"
                              placeholder="e.g. Flour, Butter, Cocoa"
                              value={expenseForm.item}
                              onChange={(e) => setExpenseForm({ ...expenseForm, item: e.target.value })}
                              className="w-full py-2.5 px-2 text-xs outline-none bg-transparent"
                              required
                            />
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <label className="text-[10px] font-bold text-[var(--text-secondary)] mb-1 block">Amount (₹)</label>
                            <div className="flex items-center border border-[var(--border)] rounded-xl bg-[var(--background)] px-3 focus-within:border-[var(--accent)] transition-colors">
                              <span className="text-[var(--text-secondary)] text-xs font-semibold">₹</span>
                              <input
                                type="number"
                                placeholder="0.00"
                                value={expenseForm.amount}
                                onChange={(e) => setExpenseForm({ ...expenseForm, amount: e.target.value })}
                                className="w-full py-2.5 px-2 text-xs outline-none bg-transparent font-bold"
                                required
                              />
                            </div>
                          </div>

                          <div>
                            <label className="text-[10px] font-bold text-[var(--text-secondary)] mb-1 block">Category</label>
                            <select
                              value={expenseForm.category}
                              onChange={(e: any) => setExpenseForm({ ...expenseForm, category: e.target.value })}
                              className="w-full bg-[var(--background)] border border-[var(--border)] text-xs rounded-xl py-3 px-3 outline-none"
                            >
                              <option value="Raw Material">Raw Material</option>
                              <option value="Packaging">Packaging</option>
                              <option value="Decoration">Decoration</option>
                              <option value="Equipment">Equipment</option>
                            </select>
                          </div>
                        </div>

                        <button
                          type="submit"
                          className="w-full bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-white text-xs font-bold py-3.5 rounded-xl transition-all shadow-sm flex items-center justify-center gap-1.5 active:scale-98 cursor-pointer"
                        >
                          <Plus size={16} strokeWidth={2.5} /> Log Purchase
                        </button>
                      </div>
                    </form>

                    {/* Recent purchases log (Right Column) */}
                    <div className="lg:col-span-2 flex flex-col gap-3.5">
                      <h3 className="font-serif text-lg font-bold">Recent Purchases</h3>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        {expenses.map((e) => (
                          <div
                            key={e.id}
                            className="bg-[var(--surface)] p-4.5 rounded-[22px] border border-[var(--border)] shadow-sm flex justify-between items-center"
                          >
                            <div>
                              <span className="text-[10px] text-[var(--text-secondary)] font-semibold">{e.date}</span>
                              <h4 className="font-bold text-sm text-[var(--text-primary)] mt-1">{e.item}</h4>
                              <span className="inline-flex text-[9px] font-extrabold text-[var(--text-secondary)] bg-neutral-100 dark:bg-neutral-900 border border-[var(--border)] px-2.5 py-0.5 rounded-full mt-2 uppercase tracking-wide">
                                {e.category}
                              </span>
                            </div>

                            <span className="font-extrabold text-base text-red-600">- ₹{e.amount}</span>
                          </div>
                        ))}
                      </div>
                    </div>

                  </div>

                </div>
              )}

            </main>

            {/* --- MOBILE BOTTOM NAVIGATION TAB BAR --- */}
            <div className="absolute bottom-0 left-0 right-0 z-40 bg-[var(--background)] border-t border-[var(--border)] px-6 py-2.5 flex justify-between items-center shadow-lg select-none">

              <button
                onClick={() => setActiveTab('home')}
                className={`flex flex-col items-center gap-1 px-3.5 py-1 rounded-full transition-all cursor-pointer ${activeTab === 'home' ? 'text-[var(--accent)] font-bold scale-105' : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                  }`}
              >
                <HomeIcon size={18} />
                <span className="text-[9px] uppercase tracking-wider font-semibold">Home</span>
              </button>

              <button
                onClick={() => setActiveTab('orders')}
                className={`flex flex-col items-center gap-1 px-3.5 py-1 rounded-full transition-all cursor-pointer ${activeTab === 'orders' ? 'text-[var(--accent)] font-bold scale-105' : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                  }`}
              >
                <ClipboardList size={18} />
                <span className="text-[9px] uppercase tracking-wider font-semibold">Orders</span>
              </button>

              <button
                onClick={() => setActiveTab('customers')}
                className={`flex flex-col items-center gap-1 px-3.5 py-1 rounded-full transition-all cursor-pointer ${activeTab === 'customers' ? 'text-[var(--accent)] font-bold scale-105' : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                  }`}
              >
                <Users size={18} />
                <span className="text-[9px] uppercase tracking-wider font-semibold">Customers</span>
              </button>

              {/* Dynamic tab logic */}
              {activeTab === 'calendar' || activeTab === 'supply' || activeTab === 'expenses' ? (
                <button
                  onClick={() => setActiveTab(activeTab === 'calendar' ? 'calendar' : activeTab === 'supply' ? 'supply' : 'expenses')}
                  className="flex flex-col items-center gap-1 px-3.5 py-1 rounded-full text-[var(--accent)] font-bold scale-105 transition-all cursor-pointer"
                >
                  {activeTab === 'calendar' ? <CalendarIcon size={18} /> : activeTab === 'supply' ? <ShoppingBag size={18} /> : <Wallet size={18} />}
                  <span className="text-[9px] uppercase tracking-wider font-semibold">
                    {activeTab === 'calendar' ? 'Schedule' : activeTab === 'supply' ? 'Supply' : 'Expenses'}
                  </span>
                </button>
              ) : (
                <button
                  onClick={() => setActiveTab('calendar')}
                  className="flex flex-col items-center gap-1 px-3.5 py-1 rounded-full text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-all cursor-pointer"
                >
                  <CalendarIcon size={18} />
                  <span className="text-[9px] uppercase tracking-wider font-semibold">Calendar</span>
                </button>
              )}

              <button
                onClick={() => setActiveTab('settings')}
                className={`flex flex-col items-center gap-1 px-3.5 py-1 rounded-full transition-all cursor-pointer ${activeTab === 'settings' ? 'text-[var(--accent)] font-bold scale-105' : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                  }`}
              >
                <MoreHorizontal size={18} />
                <span className="text-[9px] uppercase tracking-wider font-semibold">Settings</span>
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

                    {/* SHEET: NEW ORDER */}
                    {activeSheet === 'new-order' && (
                      <form onSubmit={handleCreateOrder} className="flex-1 flex flex-col">
                        <div className="flex justify-between items-center mb-6">
                          <button type="button" onClick={() => setActiveSheet('none')} className="p-1.5 text-[var(--text-secondary)] hover:text-[var(--text-primary)] rounded-full hover:bg-neutral-100 dark:hover:bg-neutral-900"><X size={20} /></button>
                          <h3 className="font-serif text-xl md:text-2xl font-bold">New Order</h3>
                          <button type="reset" className="text-xs font-semibold text-[var(--text-secondary)] hover:underline" onClick={() => setNewOrderForm({ customerName: '', phone: '', cakeCategory: 'Chocolate Truffle', weight: '1.5 kg', date: '2023-10-24', time: '4:00 PM', type: 'Pickup', totalAmount: '', advanceAmount: '' })}>Clear</button>
                        </div>

                        <div className="flex flex-col gap-6 overflow-y-auto pb-4">
                          {/* Sec 1: Customer details */}
                          <div>
                            <h4 className="text-xs font-bold text-[var(--text-secondary)] uppercase tracking-wider mb-3 flex items-center gap-1.5">
                              👤 1. Customer Details
                            </h4>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
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
                                placeholder="WhatsApp Number (e.g. +91 98765 43210)"
                                value={newOrderForm.phone}
                                onChange={(e) => setNewOrderForm({ ...newOrderForm, phone: e.target.value })}
                                className="w-full bg-[var(--background)] border border-[var(--border)] rounded-xl py-3 px-4 text-xs outline-none focus:border-[var(--accent)]"
                              />
                            </div>
                          </div>

                          {/* Sec 2: Cake Details */}
                          <div>
                            <h4 className="text-xs font-bold text-[var(--text-secondary)] uppercase tracking-wider mb-3 flex items-center gap-1.5">
                              🎂 2. Cake & Production Details
                            </h4>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                              <select
                                value={newOrderForm.cakeCategory}
                                onChange={(e) => setNewOrderForm({ ...newOrderForm, cakeCategory: e.target.value })}
                                className="w-full bg-[var(--background)] border border-[var(--border)] rounded-xl py-3 px-3 text-xs outline-none"
                              >
                                <option value="Chocolate Truffle">Chocolate Truffle</option>
                                <option value="Black Forest">Black Forest</option>
                                <option value="Red Velvet">Red Velvet</option>
                                <option value="Butterscotch Bento">Butterscotch Bento</option>
                              </select>

                              <select
                                value={newOrderForm.weight}
                                onChange={(e) => setNewOrderForm({ ...newOrderForm, weight: e.target.value })}
                                className="w-full bg-[var(--background)] border border-[var(--border)] rounded-xl py-3 px-3 text-xs outline-none"
                              >
                                <option value="500g">500g</option>
                                <option value="1 kg">1 kg</option>
                                <option value="1.5 kg">1.5 kg</option>
                                <option value="2 kg">2 kg</option>
                              </select>
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
                              />
                              <input
                                type="text"
                                placeholder="Delivery Time (e.g. 4:00 PM)"
                                value={newOrderForm.time}
                                onChange={(e) => setNewOrderForm({ ...newOrderForm, time: e.target.value })}
                                className="w-full bg-[var(--background)] border border-[var(--border)] rounded-xl py-3 px-4 text-xs outline-none focus:border-[var(--accent)]"
                              />
                            </div>

                            <div className="flex gap-3">
                              <button
                                type="button"
                                onClick={() => setNewOrderForm({ ...newOrderForm, type: 'Pickup' })}
                                className={`flex-1 py-3 text-xs font-bold rounded-xl border flex items-center justify-center gap-2 transition-all cursor-pointer ${newOrderForm.type === 'Pickup'
                                  ? 'bg-orange-50 border-[var(--accent)] text-[var(--accent)]'
                                  : 'bg-[var(--background)] border-[var(--border)] text-[var(--text-secondary)]'
                                  }`}
                              >
                                👜 Pickup
                              </button>
                              <button
                                type="button"
                                onClick={() => setNewOrderForm({ ...newOrderForm, type: 'Delivery' })}
                                className={`flex-1 py-3 text-xs font-bold rounded-xl border flex items-center justify-center gap-2 transition-all cursor-pointer ${newOrderForm.type === 'Delivery'
                                  ? 'bg-orange-50 border-[var(--accent)] text-[var(--accent)]'
                                  : 'bg-[var(--background)] border-[var(--border)] text-[var(--text-secondary)]'
                                  }`}
                              >
                                🛵 Delivery
                              </button>
                            </div>
                          </div>

                          {/* Sec 4: Payment Calculator */}
                          <div>
                            <h4 className="text-xs font-bold text-[var(--text-secondary)] uppercase tracking-wider mb-3 flex items-center gap-1.5">
                              ₹ 4. Payment Calculator
                            </h4>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
                              <input
                                type="number"
                                placeholder="Total Amount (₹)"
                                value={newOrderForm.totalAmount}
                                onChange={(e) => setNewOrderForm({ ...newOrderForm, totalAmount: e.target.value })}
                                className="w-full bg-[var(--background)] border border-[var(--border)] rounded-xl py-3 px-4 text-xs outline-none focus:border-[var(--accent)] font-bold"
                                required
                              />
                              <input
                                type="number"
                                placeholder="Advance Received (₹)"
                                value={newOrderForm.advanceAmount}
                                onChange={(e) => setNewOrderForm({ ...newOrderForm, advanceAmount: e.target.value })}
                                className="w-full bg-[var(--background)] border border-[var(--border)] rounded-xl py-3 px-4 text-xs outline-none focus:border-[var(--accent)] font-bold"
                              />
                            </div>

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
                          className="w-full bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-white font-semibold py-4 rounded-2xl shadow-md transition-all active:scale-[0.99] flex items-center justify-center gap-2 mt-4 cursor-pointer"
                        >
                          <MessageSquare size={16} /> Save & Send WhatsApp Receipt
                        </button>
                      </form>
                    )}

                    {/* SHEET: CUSTOMER PROFILE DETAILS */}
                    {activeSheet === 'customer-profile' && selectedCustomer && (
                      <div className="flex-1 flex flex-col animate-fadeIn">
                        <div className="flex justify-between items-center mb-6">
                          <button onClick={() => setActiveSheet('none')} className="p-1.5 text-[var(--text-secondary)] hover:text-[var(--text-primary)] rounded-full hover:bg-neutral-100 dark:hover:bg-neutral-900"><X size={20} /></button>
                          <h3 className="font-serif text-xl md:text-2xl font-bold">Customer Profile</h3>
                          <button className="text-xs font-semibold text-[var(--text-secondary)] hover:underline" onClick={() => setActiveSheet('edit-profile')}>Edit</button>
                        </div>

                        {/* Header Overview Card */}
                        <div className="bg-[var(--background)] p-6 rounded-[24px] border border-[var(--border)] shadow-sm text-center mb-4 flex flex-col items-center">
                          <div className="w-16 h-16 rounded-full bg-amber-100 text-amber-800 border border-amber-200 flex items-center justify-center font-bold text-2xl mb-3 shadow-inner">
                            {selectedCustomer.name.charAt(0)}
                          </div>
                          <h4 className="font-serif font-bold text-xl flex items-center gap-1.5">
                            {selectedCustomer.name}
                            {selectedCustomer.tag && (
                              <span className="bg-[#EA580C]/10 text-[#EA580C] text-[9px] font-extrabold px-2.5 py-0.5 rounded-full border border-[#EA580C]/20">
                                {selectedCustomer.tag}
                              </span>
                            )}
                          </h4>

                          <span className="text-xs text-[var(--text-secondary)] mt-2">Lifetime Value (LTV):</span>
                          <span className="text-3xl font-extrabold text-[var(--text-primary)] mt-1">
                            ₹{selectedCustomer.ltv.toLocaleString('en-IN')}
                          </span>
                        </div>

                        {/* Contact row buttons */}
                        <div className="grid grid-cols-2 gap-3 mb-6">
                          <a
                            href={`https://wa.me/${selectedCustomer.phone.replace(/\D/g, '')}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="py-3 text-xs font-bold rounded-xl border border-[var(--border)] flex items-center justify-center gap-2 hover:bg-neutral-50"
                          >
                            <MessageSquare size={14} className="text-emerald-600" />
                            Message
                          </a>
                          <a
                            href={`tel:${selectedCustomer.phone}`}
                            className="py-3 text-xs font-bold rounded-xl border border-[var(--border)] flex items-center justify-center gap-2 hover:bg-neutral-50"
                          >
                            <Phone size={14} className="text-blue-600" />
                            Call
                          </a>
                        </div>

                        {/* Order History */}
                        <h4 className="font-serif font-bold text-sm mb-3">Order History ({selectedCustomer.ordersCount})</h4>

                        <div className="flex flex-col gap-3 mb-6 overflow-y-auto max-h-52 pr-1">
                          {orders
                            .filter(o => o.customerName.toLowerCase() === selectedCustomer.name.toLowerCase())
                            .map((o) => (
                              <div key={o.id} className="bg-[var(--surface)] p-4 rounded-xl border border-[var(--border)] flex justify-between items-center shadow-sm">
                                <div>
                                  <span className="text-[10px] text-[var(--text-secondary)] font-semibold">{o.deliveryDate}</span>
                                  <h5 className="font-serif font-bold text-sm text-[var(--text-primary)] mt-0.5">{o.cakeName}</h5>
                                  <p className="text-[10px] text-[var(--text-secondary)] mt-1">{o.type} • Order #{o.id}</p>
                                </div>
                                <div className="text-right">
                                  <span className="text-xs font-bold text-[var(--text-primary)]">₹{o.totalAmount}</span>
                                  <div className="mt-2">
                                    <span className="bg-emerald-50 dark:bg-emerald-950/20 text-emerald-700 dark:text-emerald-400 text-[9px] font-extrabold px-2.5 py-0.5 rounded-full border border-emerald-100">
                                      Delivered
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
                              customerName: selectedCustomer.name,
                              phone: selectedCustomer.phone
                            });
                            setActiveSheet('new-order');
                          }}
                          className="w-full bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-white font-semibold py-4 rounded-2xl shadow-md transition-all active:scale-[0.99] flex items-center justify-center gap-2 mt-auto cursor-pointer"
                        >
                          <Plus size={16} /> New Order for {selectedCustomer.name.split(' ')[0]}
                        </button>
                      </div>
                    )}

                    {/* SHEET: EDIT PROFILE & LEGAL */}
                    {activeSheet === 'edit-profile' && (
                      <div className="flex-1 flex flex-col">
                        <div className="flex justify-between items-center mb-6">
                          <button onClick={() => setActiveSheet('none')} className="p-1.5 text-[var(--text-secondary)] hover:text-[var(--text-primary)] rounded-full hover:bg-neutral-100 dark:hover:bg-neutral-900"><X size={20} /></button>
                          <h3 className="font-serif text-xl md:text-2xl font-bold">Edit Profile & Legal</h3>
                          <button onClick={() => setActiveSheet('none')} className="text-xs font-semibold text-[var(--accent)] hover:underline">Save</button>
                        </div>

                        <div className="flex flex-col gap-6 pb-6 overflow-y-auto">

                          {/* Bakery Identity section */}
                          <div>
                            <h4 className="text-xs font-bold text-[var(--text-secondary)] uppercase tracking-wider mb-4 flex items-center gap-1.5">
                              🏪 1. Bakery Brand Identity
                            </h4>

                            <div className="flex flex-col items-center mb-4">
                              <div className="w-20 h-20 rounded-full bg-orange-50 dark:bg-[#1A0C06] border border-orange-100 flex flex-col items-center justify-center text-orange-600 relative cursor-pointer shadow-inner">
                                <span className="text-3xl">🎂</span>
                                <span className="text-[8px] font-extrabold mt-1 tracking-tight">THE SUGAR</span>
                                <div className="absolute -bottom-1 -right-1 w-7 h-7 bg-white dark:bg-[#1F110C] rounded-full border border-[var(--border)] flex items-center justify-center shadow-md">
                                  📷
                                </div>
                              </div>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                              <div>
                                <label className="text-[10px] font-bold text-[var(--text-secondary)] mb-1 block">Business / Bakery Name</label>
                                <input
                                  type="text"
                                  value={bakeryName}
                                  onChange={(e) => setBakeryName(e.target.value)}
                                  className="w-full bg-[var(--background)] border border-[var(--border)] rounded-xl py-3 px-4 text-xs outline-none"
                                />
                              </div>
                              <div>
                                <label className="text-[10px] font-bold text-[var(--text-secondary)] mb-1 block">Owner Full Name</label>
                                <input
                                  type="text"
                                  value={ownerName}
                                  onChange={(e) => setOwnerName(e.target.value)}
                                  className="w-full bg-[var(--background)] border border-[var(--border)] rounded-xl py-3 px-4 text-xs outline-none"
                                />
                              </div>
                            </div>
                          </div>

                          {/* Regulatory Compliance section */}
                          <div>
                            <h4 className="text-xs font-bold text-[var(--text-secondary)] uppercase tracking-wider mb-3 flex items-center gap-1.5">
                              🛡️ 2. Regulatory Compliance
                            </h4>
                            <h5 className="text-xs font-bold text-[var(--text-primary)] mb-1">FSSAI License Verification</h5>
                            <p className="text-[10px] text-[var(--text-secondary)] leading-relaxed mb-3">Mandatory for commercial food operations in India to build buyer trust.</p>

                            <div className="flex gap-2">
                              <input
                                type="text"
                                placeholder="14-Digit FSSAI License Number"
                                value={fssaiLicense}
                                onChange={(e) => setFssaiLicense(e.target.value.replace(/\D/g, '').slice(0, 14))}
                                className="flex-1 bg-[var(--background)] border border-[var(--border)] rounded-xl py-3 px-4 text-xs outline-none focus:border-[var(--accent)]"
                              />
                              <span className="bg-emerald-50 dark:bg-emerald-950/20 text-emerald-700 dark:text-emerald-400 text-xs font-bold px-3.5 py-3 rounded-xl border border-emerald-100 flex items-center justify-center">
                                Verified ✓
                              </span>
                            </div>

                            <div className="flex items-center gap-2 bg-emerald-50/50 dark:bg-emerald-950/10 p-3 rounded-xl border border-emerald-100/50 text-[10px] text-emerald-700 dark:text-emerald-400 mt-2.5">
                              <CheckCircle2 size={14} />
                              <span>Your license details are encrypted and secure with end-to-end protection.</span>
                            </div>
                          </div>

                          {/* Operational Defaults */}
                          <div>
                            <h4 className="text-xs font-bold text-[var(--text-secondary)] uppercase tracking-wider mb-3 flex items-center gap-1.5">
                              ⚙️ 3. Operational Defaults
                            </h4>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                              <div>
                                <label className="text-[10px] font-bold text-[var(--text-secondary)] mb-1.5 block">Default Advance Percentage Required</label>
                                <select
                                  value={defaultAdvance}
                                  onChange={(e) => setDefaultAdvance(e.target.value)}
                                  className="w-full bg-[var(--background)] border border-[var(--border)] rounded-xl py-3 px-3 text-xs outline-none"
                                >
                                  <option value="25%">25%</option>
                                  <option value="50%">50%</option>
                                  <option value="75%">75%</option>
                                  <option value="100%">100%</option>
                                </select>
                              </div>

                              <div className="flex justify-between items-center mt-6">
                                <span className="text-xs font-medium text-[var(--text-primary)]">Auto-generate & attach WhatsApp links</span>
                                <label className="relative inline-flex items-center cursor-pointer">
                                  <input
                                    type="checkbox"
                                    checked={autoSendReceipts}
                                    onChange={() => setAutoSendReceipts(!autoSendReceipts)}
                                    className="sr-only peer"
                                  />
                                  <div className="w-9 h-5 bg-neutral-200 peer-focus:outline-none rounded-full peer dark:bg-neutral-800 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all dark:border-gray-600 peer-checked:bg-[var(--accent)]"></div>
                                </label>
                              </div>
                            </div>
                          </div>

                        </div>

                        <button
                          onClick={() => setActiveSheet('none')}
                          className="w-full bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-white font-semibold py-4 rounded-2xl shadow-md transition-all active:scale-[0.99] flex items-center justify-center gap-2 mt-auto cursor-pointer"
                        >
                          💾 Save Changes
                        </button>
                      </div>
                    )}

                    {/* SHEET: MANAGE UPI COLLECTION */}
                    {activeSheet === 'manage-upi' && (
                      <div className="flex-1 flex flex-col">
                        <div className="flex justify-between items-center mb-6">
                          <button onClick={() => setActiveSheet('none')} className="p-1.5 text-[var(--text-secondary)] hover:text-[var(--text-primary)] rounded-full hover:bg-neutral-100 dark:hover:bg-neutral-900"><X size={20} /></button>
                          <h3 className="font-serif text-xl md:text-2xl font-bold">Manage UPI Collection</h3>
                          <button onClick={() => setActiveSheet('none')} className="text-xs font-semibold text-[var(--accent)] hover:underline">Done</button>
                        </div>

                        <div className="flex flex-col gap-6 pb-6 overflow-y-auto">

                          {/* Sec 1: VPA */}
                          <div>
                            <h4 className="text-xs font-bold text-[var(--text-secondary)] uppercase tracking-wider mb-3 flex items-center gap-1.5">
                              ⚡ 1. Virtual Payment Address (VPA)
                            </h4>
                            <label className="text-[10px] font-bold text-[var(--text-secondary)] mb-1 block">Your UPI ID</label>
                            <div className="flex gap-2">
                              <input
                                type="text"
                                value={upiId}
                                onChange={(e) => setUpiId(e.target.value)}
                                className="flex-1 bg-[var(--background)] border border-[var(--border)] rounded-xl py-3 px-4 text-xs font-bold outline-none"
                              />
                              <span className="bg-emerald-50 text-emerald-700 text-xs font-bold px-3.5 py-3 rounded-xl border border-emerald-100 flex items-center justify-center">
                                Verified ✓
                              </span>
                            </div>
                            <p className="text-[10px] text-[var(--text-secondary)] mt-2">All automated payment links and WhatsApp advance requests will route to this VPA.</p>
                          </div>

                          {/* Sec 2: Dynamic QR Code */}
                          <div className="flex flex-col items-center">
                            <h4 className="text-xs font-bold text-[var(--text-secondary)] uppercase tracking-wider mb-3 self-start flex items-center gap-1.5">
                              📱 2. Dynamic QR Code Preview
                            </h4>

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
                            <p className="text-[10px] text-[var(--text-secondary)] mt-3">Generated automatically on every new order summary.</p>

                            <div className="w-full flex items-center justify-between bg-zinc-50 border border-zinc-100 p-4 rounded-xl mt-4">
                              <div className="flex items-center gap-2">
                                <span className="text-orange-600 bg-orange-100/50 p-1.5 rounded-lg border border-orange-200">🛡️</span>
                                <div>
                                  <h5 className="font-bold text-[10px]">100% Secure UPI Collection</h5>
                                  <p className="text-[9px] text-[var(--text-secondary)] mt-0.5">Powered by Razorpay • PCI DSS Compliant</p>
                                </div>
                              </div>
                              <span className="text-[9px] font-extrabold text-neutral-400">Razorpay</span>
                            </div>
                          </div>

                          {/* Sec 3: Bank Settlment info */}
                          <div>
                            <h4 className="text-xs font-bold text-[var(--text-secondary)] uppercase tracking-wider mb-3 flex items-center gap-1.5">
                              🏦 3. Linked Settlement Bank Account
                            </h4>

                            <div className="bg-[var(--surface)] p-4 rounded-2xl border border-[var(--border)] shadow-sm flex items-center justify-between cursor-pointer group hover:border-[var(--accent)] transition-all">
                              <div className="flex items-center gap-3">
                                <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center font-bold text-blue-800 text-xs">
                                  HDFC
                                </div>
                                <div>
                                  <h5 className="font-bold text-xs">HDFC Bank •••• 4092</h5>
                                  <p className="text-[10px] text-[var(--text-secondary)] mt-0.5">Savings Account</p>
                                </div>
                              </div>

                              <span className="text-[9px] font-extrabold text-emerald-700 bg-emerald-50 border border-emerald-100 px-2.5 py-1 rounded-full uppercase">
                                Primary Settlement
                              </span>
                            </div>
                            <button className="text-xs font-bold text-[var(--accent)] hover:underline mt-3 block text-center mx-auto">Change Bank Account</button>
                          </div>

                        </div>

                        <button
                          onClick={() => setActiveSheet('none')}
                          className="w-full bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-white font-semibold py-4 rounded-2xl shadow-md transition-all active:scale-[0.99] flex items-center justify-center gap-2 mt-auto cursor-pointer"
                        >
                          ✓ Verify & Update UPI Settings
                        </button>
                      </div>
                    )}

                    {/* SHEET: SUBSCRIPTION & AUTOPAY */}
                    {activeSheet === 'subscription-autopay' && (
                      <div className="flex-1 flex flex-col">
                        <div className="flex justify-between items-center mb-6">
                          <button onClick={() => setActiveSheet('none')} className="p-1.5 text-[var(--text-secondary)] hover:text-[var(--text-primary)] rounded-full hover:bg-neutral-100 dark:hover:bg-neutral-900"><X size={20} /></button>
                          <h3 className="font-serif text-xl md:text-2xl font-bold">Subscription & AutoPay</h3>
                          <span className="bg-emerald-50 dark:bg-emerald-950/20 text-emerald-700 dark:text-emerald-400 text-[10px] font-bold px-2.5 py-0.5 rounded-full border border-emerald-100">
                            Active ✓
                          </span>
                        </div>

                        <div className="flex flex-col gap-6 pb-6 overflow-y-auto">

                          {/* 1. Plan status */}
                          <div>
                            <h4 className="text-xs font-bold text-[var(--text-secondary)] uppercase tracking-wider mb-3 flex items-center gap-1.5">
                              👑 1. Plan & Trial Status
                            </h4>

                            <div className="bg-[var(--surface)] p-5 rounded-2xl border border-[var(--border)] shadow-sm">
                              <div className="flex justify-between items-center py-1">
                                <span className="text-xs text-[var(--text-secondary)]">Current Plan</span>
                                <span className="text-xs font-bold">Early Adopter Pro</span>
                              </div>
                              <div className="flex justify-between items-center py-2 border-t border-[var(--border)]/50 mt-2.5">
                                <span className="text-xs text-[var(--text-secondary)]">Billing Cycle</span>
                                <span className="text-xs font-bold">₹149 / month</span>
                              </div>

                              <div className="bg-orange-50/50 dark:bg-[#1A0C06] border border-orange-100/50 p-4 rounded-xl flex items-center gap-3.5 mt-4">
                                <span className="text-3xl">📅</span>
                                <div>
                                  <h5 className="font-bold text-xs text-[var(--accent)]">Trial Active: 72 Days Remaining</h5>
                                  <p className="text-[10px] text-[var(--text-secondary)] mt-0.5">Your trial started on Sep 4, 2026 • Renews on Nov 14, 2026</p>
                                </div>
                              </div>
                            </div>
                          </div>

                          {/* 2. AutoPay mandate details */}
                          <div>
                            <h4 className="text-xs font-bold text-[var(--text-secondary)] uppercase tracking-wider mb-3 flex items-center gap-1.5">
                              🛡️ 2. UPI AutoPay Mandate
                            </h4>

                            <div className="bg-zinc-50 border border-zinc-100 p-4 rounded-2xl flex items-center justify-between">
                              <div className="flex items-center gap-3">
                                <div className="w-10 h-10 bg-white rounded-full border border-[var(--border)] flex items-center justify-center font-bold text-[#EA580C] text-xs shadow-sm">
                                  UPI
                                </div>
                                <div>
                                  <h5 className="font-bold text-xs">Razorpay UPI AutoPay Mandate</h5>
                                  <p className="text-[10px] text-emerald-600 font-bold mt-0.5">Mandate Status: Active ✓</p>
                                  <p className="text-[9.5px] text-[var(--text-secondary)] mt-1">Next auto-debit of ₹149 scheduled on Nov 14, 2026.</p>
                                </div>
                              </div>

                              <span className="text-2xl">🔒</span>
                            </div>

                            <div className="flex justify-between items-center mt-3 px-1 text-[10px] text-[var(--text-secondary)]">
                              <span>Your payments are secured by Razorpay.<br />We never store your UPI PIN or bank details.</span>
                              <span className="font-bold text-[var(--accent)] hover:underline cursor-pointer">Revoke Mandate &gt;</span>
                            </div>
                          </div>

                          {/* 3. Invoices list */}
                          <div>
                            <h4 className="text-xs font-bold text-[var(--text-secondary)] uppercase tracking-wider mb-3 flex items-center gap-1.5">
                              📄 3. Invoices & Billing History
                            </h4>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                              <div className="bg-[var(--surface)] p-4 rounded-xl border border-[var(--border)] flex justify-between items-center shadow-sm">
                                <div>
                                  <h5 className="font-semibold text-xs text-[var(--text-primary)]">Invoice #KMA-2026-001</h5>
                                  <span className="text-[10px] text-[var(--text-secondary)]">Oct 14, 2026 • 11:32 AM</span>
                                </div>
                                <span className="text-[10px] font-bold text-[var(--text-secondary)] bg-neutral-100 border border-[var(--border)] px-2.5 py-1 rounded-full">₹0.00</span>
                              </div>
                              <div className="bg-[var(--surface)] p-4 rounded-xl border border-[var(--border)] flex justify-between items-center shadow-sm">
                                <div>
                                  <h5 className="font-semibold text-xs text-[var(--text-primary)]">Invoice #KMA-2026-002</h5>
                                  <span className="text-[10px] text-[var(--text-secondary)]">Sep 14, 2026 • 10:08 AM</span>
                                </div>
                                <span className="text-[10px] font-bold text-[var(--text-secondary)] bg-neutral-100 border border-[var(--border)] px-2.5 py-1 rounded-full">₹0.00</span>
                              </div>
                            </div>

                            <button
                              type="button"
                              onClick={() => setActiveSheet('choose-plan')}
                              className="text-xs font-bold text-[var(--accent)] hover:underline mt-4 block text-center mx-auto"
                            >
                              View All Invoices &gt;
                            </button>
                          </div>

                        </div>

                        <button
                          onClick={() => setActiveSheet('choose-plan')}
                          className="w-full bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-white font-semibold py-4 rounded-2xl shadow-md transition-all active:scale-[0.99] flex items-center justify-center gap-2 mt-auto cursor-pointer"
                        >
                          🔒 Manage UPI Mandate on Razorpay
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

                        <button
                          onClick={() => setActiveSheet('none')}
                          className="w-full bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-white font-semibold py-4 rounded-2xl shadow-md transition-all active:scale-[0.99] flex items-center justify-center gap-2 mt-auto cursor-pointer"
                        >
                          ✓ Confirm Early Adopter Plan & Setup AutoPay
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
                          <div className="bg-orange-50 border border-orange-100/50 p-4 rounded-2xl flex items-center gap-3.5">
                            <span className="text-3xl">🎂</span>
                            <div>
                              <h4 className="font-bold text-sm text-[var(--text-primary)]">Your free trial is ending soon.</h4>
                              <div className="inline-flex items-center gap-1 bg-[#EA580C] text-white px-2.5 py-0.5 rounded-full text-[10.5px] font-semibold mt-1.5">
                                🕒 7 Days Remaining
                              </div>
                            </div>
                          </div>

                          {/* Early Adopter Pro plan card */}
                          <div className="bg-[var(--surface)] p-5 rounded-2xl border border-[var(--border)] shadow-sm">
                            <div className="flex justify-between items-center">
                              <h4 className="font-serif font-bold text-base flex items-center gap-2">
                                👑 Early Adopter Pro Plan
                              </h4>
                              <span className="bg-orange-50 text-[10px] font-bold text-[#EA580C] px-2.5 py-0.5 rounded-full border border-orange-100">Locked-in Price</span>
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
                            <div className="w-16 h-16 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center text-3xl border border-emerald-100 mb-3 shadow-inner">
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
                          <div className="bg-red-50/50 dark:bg-red-950/10 p-4 rounded-2xl border border-red-200/40 flex items-center justify-between cursor-pointer hover:bg-red-50 transition-colors">
                            <div className="flex items-center gap-3">
                              <span className="text-2xl">🐛</span>
                              <div>
                                <h5 className="font-bold text-xs text-red-800 dark:text-red-400">Report a Technical Bug or Issue</h5>
                                <p className="text-[10px] text-red-600/70 mt-0.5">Let us know and we'll fix it quickly.</p>
                              </div>
                            </div>
                            <ChevronRight size={16} className="text-red-400" />
                          </div>

                          <div className="text-center text-[10px] text-[var(--text-secondary)] mt-4">
                            <p>We're here to help you grow!</p>
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
                              <p className="text-[10px] text-[var(--text-secondary)] mt-0.5">Review Kamai's merchant terms, data protection standards, and refund policies.</p>
                            </div>
                          </div>

                          <div className="flex flex-col gap-2">
                            <h4 className="font-serif font-bold text-sm text-[var(--text-primary)]">1. Merchant Terms of Service</h4>
                            <p className="text-[10.5px] text-[var(--text-secondary)] leading-relaxed">
                              By accessing or using Kamai (the "Platform"), you agree to be bound by these Terms of Service. Kamai is an Order Management System built for independent home bakers to manage orders, customers, invoices, payments, and business insights.
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
                          className="w-full bg-[var(--surface)] text-[var(--accent)] border border-[var(--accent)]/50 hover:bg-orange-50 font-semibold py-4 rounded-2xl transition-all active:scale-[0.99] flex items-center justify-center gap-2 mt-auto cursor-pointer"
                        >
                          📄 Download Terms as PDF
                        </button>
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
