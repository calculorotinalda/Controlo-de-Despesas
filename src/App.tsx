/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo } from 'react';
import { 
  Plus, 
  TrendingUp, 
  TrendingDown, 
  LayoutDashboard, 
  History, 
  Sparkles, 
  User as UserIcon,
  LogOut,
  Wallet,
  X,
  Loader2,
  Trash2
} from 'lucide-react';
import { 
  AreaChart, 
  Area, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell
} from 'recharts';
import { format, parseISO } from 'date-fns';
import { pt } from 'date-fns/locale';
import { motion, AnimatePresence } from 'motion/react';
import { GoogleGenAI } from "@google/genai";
import { cn } from './lib/utils';
import { storageService } from './services/storage';

// --- Types ---

interface Transaction {
  id: string;
  amount: number;
  type: 'income' | 'expense';
  category: string;
  description: string;
  date: string;
  createdAt: string;
}

// --- Constants ---

const CATEGORIES = {
  income: ['Salário', 'Investimentos', 'Presente', 'Venda', 'Outros'],
  expense: ['Alimentação', 'Transporte', 'Lazer', 'Saúde', 'Educação', 'Casa', 'Outros']
};

const CATEGORY_COLORS: Record<string, string> = {
  'Salário': '#006c4a',
  'Investimentos': '#133057',
  'Alimentação': '#40000c',
  'Transporte': '#001b3b',
  'Lazer': '#ffdad9',
  'Saúde': '#ba1a1a',
  'Educação': '#006c4a',
  'Casa': '#133057',
  'Outros': '#454652'
};

// --- Components ---

const Button = ({ 
  children, 
  className, 
  variant = 'primary', 
  size = 'md', 
  ...props 
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'secondary' | 'tertiary' | 'ghost', size?: 'sm' | 'md' | 'lg' }) => {
  const variants = {
    primary: 'bg-primary text-on-primary hover:bg-primary-container transition-colors',
    secondary: 'bg-secondary text-on-secondary hover:bg-secondary/90',
    tertiary: 'bg-tertiary text-on-tertiary hover:bg-tertiary/90',
    ghost: 'bg-transparent text-on-surface hover:bg-surface-container-highest'
  };
  
  const sizes = {
    sm: 'px-3 py-1.5 text-sm',
    md: 'px-4 py-2',
    lg: 'px-6 py-3 text-lg font-semibold'
  };

  return (
    <button 
      className={cn(
        'rounded-lg flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed',
        variants[variant],
        sizes[size],
        className
      )}
      {...props}
    >
      {children}
    </button>
  );
};

const Card = ({ children, className }: { children: React.ReactNode, className?: string }) => (
  <div className={cn('bg-surface-container-lowest rounded-xl p-6 shadow-sm', className)}>
    {children}
  </div>
);

// --- Main App ---

export default function App() {
  const [loading, setLoading] = useState(true);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [userProfile, setUserProfile] = useState({ displayName: 'Utilizador', currency: 'EUR' });
  const [activeTab, setActiveTab] = useState<'dashboard' | 'history' | 'ai'>('dashboard');
  const [showAddModal, setShowAddModal] = useState(false);
  const [aiAdvice, setAiAdvice] = useState<string>('');
  const [isAiLoading, setIsAiLoading] = useState(false);

  // Load Data from Local Storage
  useEffect(() => {
    const data = storageService.getData();
    setTransactions(data.transactions);
    setUserProfile(data.userProfile);
    setLoading(false);
  }, []);

  const refreshData = () => {
    const data = storageService.getData();
    setTransactions(data.transactions);
  };

  const handleDelete = (id: string) => {
    if (window.confirm("Deseja eliminar esta transação?")) {
      storageService.deleteTransaction(id);
      refreshData();
    }
  };

  // Calculations
  const stats = useMemo(() => {
    const income = transactions
      .filter(t => t.type === 'income')
      .reduce((acc, t) => acc + t.amount, 0);
    const expenses = transactions
      .filter(t => t.type === 'expense')
      .reduce((acc, t) => acc + t.amount, 0);
    const balance = income - expenses;
    
    return { income, expenses, balance };
  }, [transactions]);

  const chartData = useMemo(() => {
    const days = Array.from({ length: 7 }, (_, i) => {
      const d = new Date();
      d.setDate(d.getDate() - i);
      return d.toISOString().split('T')[0];
    }).reverse();

    return days.map(day => {
      const dayTransactions = transactions.filter(t => 
        t.date.split('T')[0] === day
      );
      const dayBalance = dayTransactions.reduce((acc, t) => 
        t.type === 'income' ? acc + t.amount : acc - t.amount, 0
      );
      return {
        name: format(new Date(day), 'EEE', { locale: pt }),
        valor: dayBalance
      };
    });
  }, [transactions]);

  const pieData = useMemo(() => {
    const categories: Record<string, number> = {};
    transactions.filter(t => t.type === 'expense').forEach(t => {
      categories[t.category] = (categories[t.category] || 0) + t.amount;
    });
    return Object.entries(categories).map(([name, value]) => ({ name, value }));
  }, [transactions]);

  const getAiAdvice = async () => {
    if (transactions.length === 0) return;
    setIsAiLoading(true);
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });
      const summary = transactions.slice(0, 20).map(t => 
        `${t.type === 'income' ? '+' : '-'}${t.amount}€ em ${t.category} (${t.description})`
      ).join('\n');
      
      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: `Analisa as minhas transações recentes e dá-me 3 conselhos financeiros práticos em PT-PT. Sê sofisticado e encorajador.
        Transações:
        ${summary}
        Saldo atual: ${stats.balance}€`,
      });
      setAiAdvice(response.text || 'Não consegui gerar conselhos agora.');
    } catch (err) {
      console.error(err);
      setAiAdvice('Erro ao contactar o consultor financeiro.');
    } finally {
      setIsAiLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="h-screen flex items-center justify-center bg-surface">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-surface pb-24">
      {/* Header */}
      <header className="p-6 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-primary-container flex items-center justify-center text-on-primary">
            <UserIcon className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs text-on-surface-variant">Bem-vindo,</p>
            <p className="font-semibold">{userProfile.displayName}</p>
          </div>
        </div>
        <div className="text-[10px] bg-secondary-container text-secondary px-2 py-1 rounded-full font-bold uppercase tracking-tighter">
          Modo Offline
        </div>
      </header>

      <main className="px-6 space-y-8">
        <AnimatePresence mode="wait">
          {activeTab === 'dashboard' && (
            <motion.div 
              key="dashboard"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              className="space-y-8"
            >
              {/* Balance Hero */}
              <div className={cn(
                "balance-halo p-8 rounded-3xl text-center space-y-2",
                stats.balance < 0 && "balance-halo-deficit"
              )}>
                <p className="text-sm font-medium text-on-surface-variant uppercase tracking-widest">Saldo Total</p>
                <h2 className="text-5xl font-display font-extrabold tracking-tighter">
                  {stats.balance.toLocaleString('pt-PT', { style: 'currency', currency: 'EUR' })}
                </h2>
              </div>

              {/* Quick Stats */}
              <div className="grid grid-cols-2 gap-4">
                <Card className="bg-secondary-container/30">
                  <div className="flex items-center gap-2 mb-2">
                    <TrendingUp className="w-4 h-4 text-secondary" />
                    <span className="text-xs font-medium text-secondary">Rendimentos</span>
                  </div>
                  <p className="text-xl font-display font-bold">
                    {stats.income.toLocaleString('pt-PT', { style: 'currency', currency: 'EUR' })}
                  </p>
                </Card>
                <Card className="bg-tertiary-container/30">
                  <div className="flex items-center gap-2 mb-2">
                    <TrendingDown className="w-4 h-4 text-tertiary" />
                    <span className="text-xs font-medium text-tertiary">Despesas</span>
                  </div>
                  <p className="text-xl font-display font-bold">
                    {stats.expenses.toLocaleString('pt-PT', { style: 'currency', currency: 'EUR' })}
                  </p>
                </Card>
              </div>

              {/* Chart */}
              <section className="space-y-4">
                <h3 className="text-lg">Atividade Recente</h3>
                <div className="h-64 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={chartData}>
                      <defs>
                        <linearGradient id="colorVal" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#006c4a" stopOpacity={0.3}/>
                          <stop offset="95%" stopColor="#006c4a" stopOpacity={0}/>
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e1e2ec" />
                      <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#454652' }} />
                      <YAxis hide />
                      <Tooltip 
                        contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                      />
                      <Area type="monotone" dataKey="valor" stroke="#006c4a" fillOpacity={1} fill="url(#colorVal)" strokeWidth={3} />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </section>

              {/* Pie Chart */}
              {pieData.length > 0 && (
                <section className="space-y-4">
                  <h3 className="text-lg">Distribuição de Gastos</h3>
                  <div className="h-64 w-full flex items-center justify-center">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={pieData}
                          cx="50%"
                          cy="50%"
                          innerRadius={60}
                          outerRadius={80}
                          paddingAngle={5}
                          dataKey="value"
                        >
                          {pieData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={CATEGORY_COLORS[entry.name] || '#454652'} />
                          ))}
                        </Pie>
                        <Tooltip />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                </section>
              )}
            </motion.div>
          )}

          {activeTab === 'history' && (
            <motion.div 
              key="history"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              className="space-y-6"
            >
              <h2 className="text-2xl">Histórico</h2>
              <div className="space-y-4">
                {transactions.length === 0 ? (
                  <p className="text-center text-on-surface-variant py-12">Nenhuma transação encontrada.</p>
                ) : (
                  transactions.map((t) => (
                    <div key={t.id} className="group flex items-center justify-between p-4 bg-surface-container-low rounded-xl">
                      <div className="flex items-center gap-4">
                        <div className={cn(
                          "w-12 h-12 rounded-full flex items-center justify-center",
                          t.type === 'income' ? "bg-secondary-container text-secondary" : "bg-tertiary-container text-tertiary"
                        )}>
                          {t.type === 'income' ? <TrendingUp className="w-6 h-6" /> : <TrendingDown className="w-6 h-6" />}
                        </div>
                        <div>
                          <p className="font-semibold">{t.category}</p>
                          <p className="text-xs text-on-surface-variant">{t.description || 'Sem descrição'}</p>
                          <p className="text-[10px] text-on-surface-variant/70 uppercase tracking-tighter">
                            {format(parseISO(t.date), "d 'de' MMMM", { locale: pt })}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                        <p className={cn(
                          "font-display font-bold text-lg",
                          t.type === 'income' ? "text-secondary" : "text-tertiary"
                        )}>
                          {t.type === 'income' ? '+' : '-'}{t.amount.toLocaleString('pt-PT', { style: 'currency', currency: 'EUR' })}
                        </p>
                        <button 
                          onClick={() => handleDelete(t.id)}
                          className="p-2 text-tertiary opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </motion.div>
          )}

          {activeTab === 'ai' && (
            <motion.div 
              key="ai"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              className="space-y-8"
            >
              <div className="bg-primary p-8 rounded-3xl text-on-primary space-y-4">
                <div className="flex items-center gap-3">
                  <Sparkles className="w-6 h-6" />
                  <h2 className="text-2xl">Consultor AI</h2>
                </div>
                <p className="text-on-primary/80">
                  Obtenha insights inteligentes baseados nos seus padrões de consumo. (Requer Internet)
                </p>
                <Button 
                  onClick={getAiAdvice} 
                  variant="secondary" 
                  className="w-full"
                  disabled={isAiLoading}
                >
                  {isAiLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Gerar Conselhos'}
                </Button>
              </div>

              {aiAdvice && (
                <Card className="prose prose-sm max-w-none">
                  <div className="whitespace-pre-wrap leading-relaxed text-on-surface-variant">
                    {aiAdvice}
                  </div>
                </Card>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* FAB */}
      <button 
        onClick={() => setShowAddModal(true)}
        className="fixed bottom-28 right-6 w-16 h-16 bg-primary text-on-primary rounded-2xl shadow-2xl flex items-center justify-center hover:scale-110 transition-transform z-40"
      >
        <Plus className="w-8 h-8" />
      </button>

      {/* Navigation */}
      <nav className="fixed bottom-0 left-0 right-0 glass border-t border-outline-variant/10 px-8 py-4 flex justify-between items-center z-50">
        <NavButton 
          active={activeTab === 'dashboard'} 
          onClick={() => setActiveTab('dashboard')}
          icon={<LayoutDashboard />}
          label="Início"
        />
        <NavButton 
          active={activeTab === 'history'} 
          onClick={() => setActiveTab('history')}
          icon={<History />}
          label="Histórico"
        />
        <NavButton 
          active={activeTab === 'ai'} 
          onClick={() => setActiveTab('ai')}
          icon={<Sparkles />}
          label="AI"
        />
      </nav>

      {/* Add Transaction Modal */}
      <AnimatePresence>
        {showAddModal && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-primary/20 backdrop-blur-sm z-[60] flex items-end sm:items-center justify-center"
          >
            <motion.div 
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              className="bg-surface w-full max-w-lg rounded-t-3xl sm:rounded-3xl p-8 space-y-6 shadow-2xl"
            >
              <div className="flex items-center justify-between">
                <h2 className="text-2xl">Nova Transação</h2>
                <button onClick={() => setShowAddModal(false)} className="p-2">
                  <X className="w-6 h-6" />
                </button>
              </div>
              
              <AddTransactionForm 
                onSuccess={() => {
                  setShowAddModal(false);
                  refreshData();
                }} 
              />
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function NavButton({ active, onClick, icon, label }: { active: boolean, onClick: () => void, icon: React.ReactNode, label: string }) {
  return (
    <button 
      onClick={onClick}
      className={cn(
        "flex flex-col items-center gap-1 transition-all",
        active ? "text-primary scale-110" : "text-on-surface-variant opacity-60"
      )}
    >
      {React.isValidElement(icon) ? React.cloneElement(icon as React.ReactElement<any>, { className: "w-6 h-6" }) : icon}
      <span className="text-[10px] font-bold uppercase tracking-tighter">{label}</span>
    </button>
  );
}

function AddTransactionForm({ onSuccess }: { onSuccess: () => void }) {
  const [type, setType] = useState<'income' | 'expense'>('expense');
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState('');
  const [description, setDescription] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!amount || !category) return;
    
    setIsSubmitting(true);
    storageService.addTransaction({
      amount: parseFloat(amount),
      type,
      category,
      description,
      date: new Date().toISOString()
    });
    setIsSubmitting(false);
    onSuccess();
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="flex p-1 bg-surface-container-low rounded-xl">
        <button 
          type="button"
          onClick={() => setType('expense')}
          className={cn(
            "flex-1 py-2 rounded-lg text-sm font-bold transition-all",
            type === 'expense' ? "bg-tertiary text-on-tertiary shadow-lg" : "text-on-surface-variant"
          )}
        >
          Despesa
        </button>
        <button 
          type="button"
          onClick={() => setType('income')}
          className={cn(
            "flex-1 py-2 rounded-lg text-sm font-bold transition-all",
            type === 'income' ? "bg-secondary text-on-secondary shadow-lg" : "text-on-surface-variant"
          )}
        >
          Rendimento
        </button>
      </div>

      <div className="space-y-2">
        <label className="text-xs font-bold text-on-surface-variant uppercase tracking-widest">Valor (€)</label>
        <input 
          type="number" 
          step="0.01"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          placeholder="0.00"
          className="w-full text-4xl font-display font-bold bg-transparent border-b-2 border-outline-variant focus:border-primary outline-none py-2"
          required
        />
      </div>

      <div className="space-y-2">
        <label className="text-xs font-bold text-on-surface-variant uppercase tracking-widest">Categoria</label>
        <div className="flex flex-wrap gap-2">
          {CATEGORIES[type].map(cat => (
            <button
              key={cat}
              type="button"
              onClick={() => setCategory(cat)}
              className={cn(
                "px-4 py-2 rounded-full text-sm font-medium transition-all",
                category === cat 
                  ? "bg-primary text-on-primary shadow-md" 
                  : "bg-surface-container-low text-on-surface-variant hover:bg-surface-container-highest"
              )}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-2">
        <label className="text-xs font-bold text-on-surface-variant uppercase tracking-widest">Descrição (Opcional)</label>
        <input 
          type="text" 
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Ex: Almoço com amigos"
          className="w-full bg-surface-container-low rounded-xl px-4 py-3 outline-none focus:ring-2 ring-primary/20"
        />
      </div>

      <Button type="submit" className="w-full py-4" disabled={isSubmitting}>
        {isSubmitting ? <Loader2 className="w-6 h-6 animate-spin" /> : 'Guardar Transação'}
      </Button>
    </form>
  );
}
