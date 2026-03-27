import React, { useState, useMemo, useEffect } from 'react';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, Legend, ResponsiveContainer, 
  LineChart, Line, AreaChart, Area, ComposedChart, PieChart, Pie, Cell 
} from 'recharts';
import { 
  Home, Briefcase, BarChart2, Maximize, Search, Bell, Mail, 
  ChevronDown, MoreVertical, Plus, ArrowUpRight, ArrowDownRight, Trash2, SlidersHorizontal
} from 'lucide-react';
import { format, subMonths, isSameMonth, isSameQuarter, isSameYear, parseISO, startOfMonth, endOfMonth, differenceInDays } from 'date-fns';
import { es } from 'date-fns/locale';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { supabase } from './lib/supabase';

// --- UTILITIES ---
function cn(...inputs) {
  return twMerge(clsx(inputs));
}

// --- INITIAL DATA ---
const CATEGORIAS_GASTO = ["Restaurantes", "Ropa", "Viajes", "Coche", "Inversión", "Ocio", "Suscripciones", "Otros"];
const CATEGORIAS_INGRESO = ["Nómina", "Bonus", "Venta", "Otros Ingresos"];

// Solo tú (lydiavlopezg) empiezas con este balance inicial. El resto empezará en 0.
const getUserBaseSavings = (email) => {
  if (email === 'lydiavlopezg@hotmail.com') return 24824.89;
  return 0;
};

// --- PRE-BUILT UI COMPONENTS ---
const Card = ({ className, gradient, ...props }) => (
  <div className={cn("rounded-xl border bg-card text-card-foreground shadow", gradient && "card-gradient", className)} {...props} />
);
const CardHeader = ({ className, ...props }) => (
  <div className={cn("flex flex-col space-y-1.5 p-6", className)} {...props} />
);
const CardTitle = ({ className, ...props }) => (
  <h3 className={cn("font-semibold leading-none tracking-tight", className)} {...props} />
);
const CardContent = ({ className, ...props }) => (
  <div className={cn("p-6 pt-0", className)} {...props} />
);

const Button = ({ className, variant = "default", size = "default", ...props }) => {
  const variants = {
    default: "bg-primary text-primary-foreground hover:bg-primary/90",
    destructive: "bg-destructive text-destructive-foreground hover:bg-destructive/90",
    outline: "border border-input bg-transparent hover:bg-accent hover:text-accent-foreground",
    ghost: "hover:bg-accent hover:text-accent-foreground",
    link: "text-primary underline-offset-4 hover:underline",
  };
  const sizes = {
    default: "h-9 px-4 py-2",
    sm: "h-8 rounded-md px-3 text-xs",
    lg: "h-10 rounded-md px-8",
    icon: "h-9 w-9",
  };
  return (
    <button className={cn("inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50", variants[variant], sizes[size], className)} {...props} />
  );
};

const Input = ({ className, type, ...props }) => (
  <input
    type={type}
    className={cn(
      "flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50",
      className
    )}
    {...props}
  />
);

export default function App() {
  const [session, setSession] = useState(null);
  const [authForm, setAuthForm] = useState({ email: '', password: '', isLogin: true });
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState("mes"); // mes, trimestre, año
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [targetDateStr, setTargetDateStr] = useState(format(new Date(), 'yyyy-MM'));
  
  // Table state
  const [searchTerm, setSearchTerm] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("Todas");
  const [tableMonthFilter, setTableMonthFilter] = useState(""); 
  const [visibleCount, setVisibleCount] = useState(15);
  const [sortConfig, setSortConfig] = useState({ key: 'date', direction: 'desc' });

  // Add Transaction Form State
  const [addForm, setAddForm] = useState({
    date: format(new Date(), 'yyyy-MM-dd'),
    concept: '',
    category: CATEGORIAS_GASTO[0],
    amount: '',
    type: 'gasto'
  });

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });

    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    async function fetchTxs() {
      if (!session) {
        setLoading(false);
        return;
      }
      
      const { data, error } = await supabase
        .from('transactions')
        .select('*')
        .order('date', { ascending: false });
        
      if (!error && data) {
        setTransactions(data.map(t => ({...t, amount: parseFloat(t.amount)})));
      } else if (error && error.code !== 'PGRST116') {
        console.error("Supabase Error:", error);
      }
      setLoading(false);
    }
    fetchTxs();
  }, [session]);

  const handleAuth = async (e) => {
    e.preventDefault();
    setLoading(true);
    let error;
    if (authForm.isLogin) {
      const { error: err } = await supabase.auth.signInWithPassword({
        email: authForm.email,
        password: authForm.password,
      });
      error = err;
    } else {
      const { error: err } = await supabase.auth.signUp({
        email: authForm.email,
        password: authForm.password,
      });
      error = err;
    }
    if (error) {
      alert(error.message);
      setLoading(false);
    }
  };

  // Calculate metrics based on period
  const filterByPeriod = (txs, targetDate, prd) => {
    return txs.filter(tx => {
      const d = parseISO(tx.date);
      if (prd === "mes") return isSameMonth(d, targetDate);
      if (prd === "trimestre") return isSameQuarter(d, targetDate);
      if (prd === "año") return isSameYear(d, targetDate);
      return true;
    });
  };

  const targetDate = parseISO(`${targetDateStr}-01`);
  const currentTxs = filterByPeriod(transactions, targetDate, period);
  
  const prevDate = period === "mes" ? subMonths(targetDate, 1) : period === "trimestre" ? subMonths(targetDate, 3) : subMonths(targetDate, 12);
  const prevTxs = filterByPeriod(transactions, prevDate, period);

  const calcMetrics = (txs) => {
    const income = txs.filter(t => t.type === 'ingreso').reduce((a, b) => a + b.amount, 0);
    const expenses = txs.filter(t => t.type === 'gasto').reduce((a, b) => a + b.amount, 0);
    const savings = income - expenses;
    const savingsRate = income > 0 ? (savings / income) * 100 : 0;
    return { income, expenses, savings, savingsRate };
  };

  const currentMetrics = calcMetrics(currentTxs);
  const prevMetrics = calcMetrics(prevTxs);

  const getVar = (curr, prev) => {
    if (prev === 0) return { val: 100, isPositive: curr >= 0 };
    const v = ((curr - prev) / Math.abs(prev)) * 100;
    return { val: v, isPositive: v >= 0 };
  };

  const incomeVar = getVar(currentMetrics.income, prevMetrics.income);
  const expenseVar = getVar(currentMetrics.expenses, prevMetrics.expenses); // For expenses, negative var is "good" -> wait, we just show color intuitively
  const savingsVar = getVar(currentMetrics.savings, prevMetrics.savings);

  // --- CHART DATA PREPARATION ---
  const monthlyData = useMemo(() => {
    const year = targetDate.getFullYear();
    const validTxs = transactions.filter(tx => tx.date.startsWith(`${year}-`));

    const grouped = {};
    for (let i = 1; i <= 12; i++) {
        const m = `${year}-${i.toString().padStart(2, '0')}`;
        grouped[m] = { name: m, income: 0, expenses: 0 };
    }
    
    validTxs.forEach(tx => {
      const m = tx.date.substring(0, 7);
      if (grouped[m]) {
        if (tx.type === 'ingreso') grouped[m].income += tx.amount;
        else grouped[m].expenses += tx.amount;
      }
    });

    let accumulatedSavings = 0;
    
    return Object.keys(grouped).sort().map(m => {
      const monthSave = grouped[m].income - grouped[m].expenses;
      accumulatedSavings += monthSave;
      return {
        name: m,
        Ingresos: grouped[m].income,
        Gastos: grouped[m].expenses,
        Ahorro: accumulatedSavings
      };
    });
  }, [transactions, targetDate]);

  // CATEGORY COLORS (rosas, morados, azules, verdes)
  const COLORS = ["#ec4899", "#8b5cf6", "#3b82f6", "#10b981", "#f472b6", "#c084fc", "#60a5fa", "#34d399"];

  // PIE CHART DATA (Gastos del mes seleccionado)
  const categoryData = useMemo(() => {
    const monthTxs = transactions.filter(tx => tx.date.startsWith(targetDateStr) && tx.type === 'gasto');
    const catMap = {};
    CATEGORIAS_GASTO.forEach(c => catMap[c] = 0);
    monthTxs.forEach(tx => catMap[tx.category] += tx.amount);
    
    return CATEGORIAS_GASTO.map((cat, idx) => ({
      name: cat,
      value: catMap[cat],
      color: COLORS[idx % COLORS.length]
    })).filter(d => d.value > 0).sort((a,b)=>b.value-a.value);
  }, [transactions, targetDateStr]);

  const getCatColor = (catName) => {
    const idx = CATEGORIAS_GASTO.indexOf(catName);
    if (idx !== -1) return COLORS[idx % COLORS.length];
    return "#888";
  };

  // Table filtering and sorting
  const filteredTxs = transactions.filter(tx => {
    const matchesSearch = tx.concept.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCat = categoryFilter === "Todas" || tx.category === categoryFilter;
    const matchesMonth = tableMonthFilter === "" || tx.date.startsWith(tableMonthFilter);
    return matchesSearch && matchesCat && matchesMonth;
  }).sort((a, b) => {
    if (a[sortConfig.key] < b[sortConfig.key]) return sortConfig.direction === 'asc' ? -1 : 1;
    if (a[sortConfig.key] > b[sortConfig.key]) return sortConfig.direction === 'asc' ? 1 : -1;
    return 0;
  });

  const handleSort = (key) => {
    let direction = 'asc';
    if (sortConfig.key === key && sortConfig.direction === 'asc') direction = 'desc';
    setSortConfig({ key, direction });
  };

  const handleDelete = async (id) => {
    if (import.meta.env.VITE_SUPABASE_URL) {
      const { error } = await supabase.from('transactions').delete().eq('id', id);
      if (!error) {
        setTransactions(transactions.filter(t => t.id !== id));
      } else {
        console.error("Delete Error", error);
      }
    } else {
      setTransactions(transactions.filter(t => t.id !== id));
    }
  };

  const handleAddSubmit = async (e) => {
    e.preventDefault();
    if (!addForm.concept || !addForm.amount) return;
    
    const newTxParams = {
      date: addForm.date,
      concept: addForm.concept,
      category: addForm.category,
      amount: parseFloat(addForm.amount),
      type: addForm.type
    };

    if (import.meta.env.VITE_SUPABASE_URL) {
      const { data, error } = await supabase
        .from('transactions')
        .insert([newTxParams])
        .select();
      
      if (!error && data && data.length > 0) {
        setTransactions([{...data[0], amount: parseFloat(data[0].amount)}, ...transactions].sort((a,b) => new Date(b.date) - new Date(a.date)));
      } else {
        console.error("Insert Error", error);
      }
    } else {
       setTransactions([{id: crypto.randomUUID(), ...newTxParams}, ...transactions].sort((a,b) => new Date(b.date) - new Date(a.date)));
    }

    const txMonth = addForm.date.substring(0, 7);
    if (txMonth !== targetDateStr) {
      setTargetDateStr(txMonth);
    }
    setTableMonthFilter("");
    setCategoryFilter("Todas");
    setSearchTerm("");
    setIsAddModalOpen(false);
    setAddForm({ ...addForm, concept: '', amount: '' }); // reset some fields
  };

  if (loading && !session) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-background">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!session) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-background p-4 bg-[url('https://www.transparenttextures.com/patterns/dark-matter.png')]">
        <Card className="w-full max-w-md border-border/50 bg-card/40 backdrop-blur-xl shadow-2xl p-8 border">
          <div className="text-center space-y-2 mb-8">
            <div className="mx-auto w-16 h-16 bg-primary/10 rounded-2xl flex items-center justify-center mb-4">
              <Briefcase className="h-8 w-8 text-primary" />
            </div>
            <CardTitle className="text-2xl font-bold tracking-tighter">Acceso al Dashboard</CardTitle>
            <p className="text-sm text-muted-foreground">Introduce tus credenciales para continuar</p>
          </div>
          
          <form onSubmit={handleAuth} className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Email</label>
              <Input 
                type="email" 
                required 
                placeholder="tu@email.com"
                value={authForm.email}
                onChange={(e) => setAuthForm({...authForm, email: e.target.value})}
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Contraseña</label>
              <Input 
                type="password" 
                required 
                placeholder="••••••••"
                value={authForm.password}
                onChange={(e) => setAuthForm({...authForm, password: e.target.value})}
              />
            </div>
            
            <Button type="submit" className="w-full h-11 bg-primary hover:bg-primary/90 mt-2">
              {authForm.isLogin ? 'Iniciar Sesión' : 'Registrarse'}
            </Button>
            
            <div className="text-center pt-4 border-t border-border/50 mt-6">
              <button 
                type="button"
                className="text-sm text-muted-foreground hover:text-primary transition-colors"
                onClick={() => setAuthForm({...authForm, isLogin: !authForm.isLogin})}
              >
                {authForm.isLogin ? '¿No tienes cuenta? Regístrate' : '¿Ya tienes cuenta? Inicia sesión'}
              </button>
            </div>
          </form>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex h-screen w-full overflow-hidden bg-background text-foreground tracking-tight">
      
      {/* MAIN CONTENT */}
      <main className="flex-1 flex flex-col overflow-y-auto w-full">
        <header className="flex flex-col md:flex-row items-start md:items-center justify-between p-4 md:p-8 pb-4 gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-3">
              <h2 className="text-2xl md:text-3xl font-bold tracking-tight">Resumen General</h2>
              <span className="text-xs bg-muted px-2 py-0.5 rounded-full text-muted-foreground border border-border/50">Privado</span>
            </div>
            <p className="text-muted-foreground capitalize">{format(targetDate, "MMMM 'de' yyyy", { locale: es })}</p>
          </div>
          <div className="flex items-center gap-4 flex-wrap justify-end">
            <div className="flex items-center gap-2">
              <input 
                type="month" 
                value={targetDateStr}
                onChange={(e) => setTargetDateStr(e.target.value)}
                className="h-9 rounded-md border border-input bg-card px-3 text-sm focus-visible:ring-1 focus-visible:ring-ring text-foreground"
              />
            </div>
            <div className="relative flex items-center bg-muted/50 rounded-lg p-1 border border-border">
              {['mes', 'trimestre', 'año'].map(p => (
                <button 
                  key={p} 
                  onClick={() => setPeriod(p)}
                  className={cn("px-4 py-1.5 text-sm font-medium rounded-md capitalize transition-colors", period === p ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground")}
                >
                  {p}
                </button>
              ))}
            </div>
            <div className="flex items-center gap-3 w-full sm:w-auto sm:ml-4">
              <Button variant="ghost" size="icon" className="rounded-full bg-muted/40" onClick={() => supabase.auth.signOut()} title="Cerrar sesión">
                <Home className="h-4 w-4" /> {/* Reusing icon for logout shortcut or swap to LogOut if available in lucide-react */}
              </Button>
              <Button onClick={() => setIsAddModalOpen(true)} className="flex-1 sm:flex-none rounded-full shadow-lg shadow-primary/20 bg-gradient-to-r from-primary to-accent gap-2 px-6">
                <Plus className="h-4 w-4" /> Añadir movimiento
              </Button>
            </div>
          </div>
        </header>

        <div className="p-4 md:p-8 pt-4 space-y-6 md:space-y-8 flex-1">
          {/* KPI ROW */}
          <div className="grid gap-4 md:gap-6 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
            <Card gradient className="border-t-4 border-t-emerald-400 relative overflow-hidden">
              <CardHeader className="pb-2 flex flex-row items-center justify-between space-y-0">
                <CardTitle className="text-sm font-medium text-muted-foreground">Ingresos del {period}</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold">{currentMetrics.income.toLocaleString('es-ES', {minimumFractionDigits:0, maximumFractionDigits:0})} €</div>
                <p className="text-xs flex items-center gap-1 mt-2">
                  <span className={cn("flex items-center gap-0.5", incomeVar.isPositive ? "text-emerald-400" : "text-destructive")}>
                    {incomeVar.isPositive ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
                    {Math.abs(incomeVar.val).toFixed(1)}%
                  </span>
                  <span className="text-muted-foreground">vs periodo ant.</span>
                </p>
                {/* Visual donut ring placeholder */}
                <div className="absolute top-6 right-6 h-12 w-12 rounded-full border-[6px] border-emerald-400/20 border-t-emerald-400 opacity-60"></div>
              </CardContent>
            </Card>

            <Card gradient className="border-t-4 border-t-rose-400 relative overflow-hidden">
              <CardHeader className="pb-2 flex flex-row items-center justify-between space-y-0">
                <CardTitle className="text-sm font-medium text-muted-foreground">Gastos Totales</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold">{currentMetrics.expenses.toLocaleString('es-ES', {minimumFractionDigits:0, maximumFractionDigits:0})} €</div>
                <p className="text-xs flex items-center gap-1 mt-2">
                  <span className={cn("flex items-center gap-0.5", expenseVar.isPositive ? "text-rose-400" : "text-emerald-400")}>
                    {expenseVar.isPositive ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
                    {Math.abs(expenseVar.val).toFixed(1)}%
                  </span>
                  <span className="text-muted-foreground">vs periodo ant.</span>
                </p>
                <div className="absolute top-6 right-6 h-12 w-12 rounded-full border-[6px] border-rose-400/20 border-t-rose-400 opacity-60"></div>
              </CardContent>
            </Card>

            <Card gradient className="border-t-4 border-t-blue-400 relative overflow-hidden">
              <CardHeader className="pb-2 flex flex-row items-center justify-between space-y-0">
                <CardTitle className="text-sm font-medium text-muted-foreground">Ahorro del {period}</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold">{currentMetrics.savings.toLocaleString('es-ES', {minimumFractionDigits:0, maximumFractionDigits:0})} €</div>
                <p className="text-xs flex items-center gap-1 mt-2">
                  <span className={cn("flex items-center gap-0.5", savingsVar.isPositive ? "text-emerald-400" : "text-destructive")}>
                    {savingsVar.isPositive ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
                    {Math.abs(savingsVar.val).toFixed(1)}%
                  </span>
                  <span className="text-muted-foreground">vs periodo ant.</span>
                </p>
                <div className="absolute top-6 right-6 h-12 w-12 rounded-full border-[6px] border-blue-400/20 border-t-blue-400 opacity-60"></div>
              </CardContent>
            </Card>

            <Card className="balance-card-gradient text-white border-none shadow-xl shadow-purple-900/20 relative overflow-hidden">
              <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')] opacity-10 mix-blend-overlay"></div>
              <CardHeader className="pb-2 flex flex-row items-center justify-between space-y-0 relative z-10">
                <CardTitle className="text-sm font-medium text-purple-100">Ahorro Total Acumulado</CardTitle>
              </CardHeader>
              <CardContent className="relative z-10">
                <div className="text-4xl font-black mt-1">{(getUserBaseSavings(session?.user?.email) + transactions.reduce((acc, tx) => acc + (tx.type === 'ingreso' ? tx.amount : -tx.amount), 0)).toLocaleString('es-ES', {minimumFractionDigits:2, maximumFractionDigits:2})} €</div>
                <p className="text-xs text-purple-200 mt-2 font-medium">Patrimonio actual</p>
                <div className="absolute bottom-4 right-6 flex items-center gap-2 opacity-50">
                  <div className="h-6 w-6 rounded-full bg-white/40"></div>
                  <div className="h-6 w-6 rounded-full bg-white/20 -ml-4 backdrop-blur-sm"></div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* CHARTS ROW */}
          <div className="grid gap-6 grid-cols-1 lg:grid-cols-5">
            <Card gradient className="col-span-1 lg:col-span-3">
              <CardHeader className="pb-0 p-4 md:p-6">
                <CardTitle className="text-lg md:text-xl">Ingresos vs Gastos</CardTitle>
                <p className="text-xs md:text-sm text-muted-foreground mt-1 tracking-wide">Visión financiera global de los últimos 12 meses</p>
              </CardHeader>
              <CardContent className="h-[280px] md:h-[350px] pt-4 md:pt-6 p-2 md:p-6">
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={monthlyData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                    <defs>
                      <linearGradient id="colorInc" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#10b981" stopOpacity={0.8}/>
                        <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                      </linearGradient>
                      <linearGradient id="colorExp" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#f43f5e" stopOpacity={0.8}/>
                        <stop offset="95%" stopColor="#f43f5e" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#2a2a35" />
                    <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: '#888', fontSize: 12}} dy={10} />
                    <YAxis yAxisId="left" axisLine={false} tickLine={false} tick={{fill: '#888', fontSize: 12}} dx={-10} tickFormatter={(v)=>`${v/1000}k €`} />
                    <YAxis yAxisId="right" orientation="right" axisLine={false} tickLine={false} tick={{fill: '#a78bfa', fontSize: 12}} dx={10} tickFormatter={(v)=>`${v/1000}k €`} />
                    <RechartsTooltip 
                      contentStyle={{ backgroundColor: '#1e1e24', border: '1px solid #333', borderRadius: '8px', color: '#fff' }}
                      itemStyle={{ color: '#fff' }}
                    />
                    <Legend iconType="circle" wrapperStyle={{ fontSize: '12px', paddingTop: '10px' }} />
                    <Area yAxisId="left" type="monotone" dataKey="Ingresos" stroke="#10b981" fillOpacity={1} fill="url(#colorInc)" strokeWidth={2} />
                    <Area yAxisId="left" type="monotone" dataKey="Gastos" stroke="#f43f5e" fillOpacity={1} fill="url(#colorExp)" strokeWidth={2} />
                    <Line yAxisId="right" type="monotone" dataKey="Ahorro" stroke="#a78bfa" strokeWidth={3} dot={{r:4, fill:'#1e1e24', strokeWidth: 2}} activeDot={{r: 6}} />
                  </ComposedChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card gradient className="col-span-1 lg:col-span-2">
              <CardHeader className="pb-0 p-4 md:p-6">
                <CardTitle className="text-lg md:text-xl">Gastos por Categoría</CardTitle>
                <p className="text-xs md:text-sm text-muted-foreground mt-1">Gasto total en {format(targetDate, "MMMM yyyy", { locale: es })}</p>
              </CardHeader>
              <CardContent className="h-[280px] md:h-[350px] pt-4 md:pt-6 relative p-2 md:p-6">
                {categoryData.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={categoryData}
                        cx="50%"
                        cy="50%"
                        innerRadius={80}
                        outerRadius={120}
                        paddingAngle={5}
                        dataKey="value"
                      >
                        {categoryData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <RechartsTooltip 
                        contentStyle={{ backgroundColor: '#1e1e24', border: '1px solid #333', borderRadius: '8px', color: '#fff' }}
                        formatter={(value) => `${value.toLocaleString('es-ES', {minimumFractionDigits:2})} €`}
                      />
                      <Legend iconType="circle" />
                    </PieChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="flex items-center justify-center h-full text-muted-foreground">Sin gastos este mes.</div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* TRANSACTIONS TABLE */}
          <Card gradient>
            <CardHeader className="flex flex-col md:flex-row items-start md:items-center justify-between space-y-4 md:space-y-0">
              <div>
                <CardTitle>Últimos Movimientos</CardTitle>
                <p className="text-sm text-muted-foreground mt-1">Listado completo de tus transacciones</p>
              </div>
              <div className="flex flex-col sm:flex-row gap-3 w-full md:w-auto">
                <div className="relative w-full sm:w-48">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input 
                    placeholder="Buscar..." 
                    className="pl-9 bg-background/50 border-border/50 focus-visible:ring-primary/50" 
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                  />
                </div>
                <input 
                  type="month" 
                  className="flex h-9 w-full sm:w-40 rounded-md border border-input bg-background/50 px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary/50 text-foreground"
                  value={tableMonthFilter}
                  onChange={(e) => setTableMonthFilter(e.target.value)}
                />
                <select 
                  className="flex h-9 w-full sm:w-40 rounded-md border border-input bg-background/50 px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary/50 text-foreground"
                  value={categoryFilter}
                  onChange={(e) => setCategoryFilter(e.target.value)}
                >
                  <option value="Todas">Todas las categorías</option>
                  <optgroup label="Gastos">
                    {CATEGORIAS_GASTO.map(c => <option key={c} value={c}>{c}</option>)}
                  </optgroup>
                  <optgroup label="Ingresos">
                    {CATEGORIAS_INGRESO.map(c => <option key={c} value={c}>{c}</option>)}
                  </optgroup>
                </select>
              </div>
            </CardHeader>
            <CardContent className="p-4 md:p-6">
              <div className="rounded-md border border-border/50 overflow-x-auto">
                <table className="w-full text-sm text-left text-muted-foreground">
                  <thead className="text-xs uppercase bg-muted/20 text-foreground">
                    <tr>
                      <th className="px-6 py-4 cursor-pointer hover:bg-muted/30 transition-colors" onClick={() => handleSort('date')}>Fecha {sortConfig.key === 'date' && (sortConfig.direction === 'asc' ? '↑' : '↓')}</th>
                      <th className="px-6 py-4 cursor-pointer hover:bg-muted/30 transition-colors" onClick={() => handleSort('concept')}>Concepto {sortConfig.key === 'concept' && (sortConfig.direction === 'asc' ? '↑' : '↓')}</th>
                      <th className="px-6 py-4">Categoría</th>
                      <th className="px-6 py-4 cursor-pointer hover:bg-muted/30 transition-colors" onClick={() => handleSort('amount')}>Importe {sortConfig.key === 'amount' && (sortConfig.direction === 'asc' ? '↑' : '↓')}</th>
                      <th className="px-6 py-4 text-center">Acción</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredTxs.slice(0, visibleCount).map((tx, idx) => (
                      <tr key={tx.id} className={cn("border-b border-border/50 hover:bg-muted/10 transition-colors", idx%2===0 ? "bg-card" : "bg-card/50")}>
                        <td className="px-6 py-4 whitespace-nowrap font-medium text-foreground">{tx.date}</td>
                        <td className="px-6 py-4 text-foreground/80">{tx.concept}</td>
                        <td className="px-6 py-4">
                          <span 
                            className="px-2.5 py-1 rounded-full text-xs font-medium border"
                            style={{ 
                              color: getCatColor(tx.category), 
                              borderColor: `${getCatColor(tx.category)}40`,
                              backgroundColor: `${getCatColor(tx.category)}15`
                            }}
                          >
                            {tx.category}
                          </span>
                        </td>
                        <td className={cn("px-6 py-4 font-bold", tx.type === 'ingreso' ? "text-emerald-400" : "text-rose-400")}>
                          {tx.type === 'ingreso' ? '+' : '-'}{tx.amount.toLocaleString('es-ES', {minimumFractionDigits:2, maximumFractionDigits:2})} €
                        </td>
                        <td className="px-6 py-4 text-center">
                          <Button variant="ghost" size="icon" onClick={() => handleDelete(tx.id)} className="h-8 w-8 text-muted-foreground hover:text-destructive hover:bg-destructive/10">
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {filteredTxs.length === 0 && (
                  <div className="text-center py-10">No se encontraron movimientos.</div>
                )}
                {filteredTxs.length > visibleCount && (
                  <div className="text-center py-4 bg-muted/5 border-t border-border/50">
                    <Button variant="outline" onClick={() => setVisibleCount(v => v + 15)}>Ver más ({filteredTxs.length - visibleCount} restantes)</Button>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </main>

      {/* ADD TRANSACTION MODAL */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
          <Card className="w-full max-w-md shadow-2xl shadow-primary/10 border-border animate-in zoom-in-95 duration-200">
            <CardHeader>
              <CardTitle>Añadir Movimiento</CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleAddSubmit} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Tipo</label>
                    <div className="flex p-1 bg-muted rounded-md border border-border">
                      <button 
                        type="button" 
                        className={cn("flex-1 text-sm py-1.5 rounded-sm transition-colors", addForm.type === 'gasto' ? "bg-background shadow-sm text-foreground font-medium" : "text-muted-foreground")}
                        onClick={() => setAddForm({...addForm, type: 'gasto', category: CATEGORIAS_GASTO[0]})}
                      >
                        Gasto
                      </button>
                      <button 
                        type="button" 
                        className={cn("flex-1 text-sm py-1.5 rounded-sm transition-colors", addForm.type === 'ingreso' ? "bg-background shadow-sm text-foreground font-medium" : "text-muted-foreground")}
                        onClick={() => setAddForm({...addForm, type: 'ingreso', category: CATEGORIAS_INGRESO[0]})}
                      >
                        Ingreso
                      </button>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Fecha</label>
                    <Input 
                      type="date" 
                      required 
                      value={addForm.date} 
                      onChange={(e) => setAddForm({...addForm, date: e.target.value})} 
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">Concepto</label>
                  <Input 
                    placeholder="Descripción rápida..." 
                    required 
                    value={addForm.concept} 
                    onChange={(e) => setAddForm({...addForm, concept: e.target.value})} 
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Categoría</label>
                    <select 
                      className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring text-foreground"
                      value={addForm.category}
                      onChange={(e) => setAddForm({...addForm, category: e.target.value})}
                    >
                      {(addForm.type === 'gasto' ? CATEGORIAS_GASTO : CATEGORIAS_INGRESO).map(c => (
                        <option key={c} value={c} className="bg-card text-foreground">{c}</option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Importe (€)</label>
                    <Input 
                      type="number" 
                      min="0.01" 
                      step="0.01" 
                      required 
                      placeholder="0.00"
                      value={addForm.amount} 
                      onChange={(e) => setAddForm({...addForm, amount: e.target.value})} 
                    />
                  </div>
                </div>
                
                <div className="flex justify-end gap-3 pt-4 border-t border-border mt-6">
                  <Button type="button" variant="ghost" onClick={() => setIsAddModalOpen(false)}>Cancelar</Button>
                  <Button type="submit">Guardar Movimiento</Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
