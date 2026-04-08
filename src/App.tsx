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
  Key,
  Loader2,
  Trash2,
  Menu,
  Info,
  Settings,
  Edit2,
  PieChart as PieChartIcon,
  List,
  ChevronRight,
  PlusCircle,
  BarChart as BarChartIcon,
  Calendar,
  Filter,
  Facebook
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
  Cell,
  BarChart,
  Bar,
  Legend
} from 'recharts';
import { format, parseISO } from 'date-fns';
import { pt } from 'date-fns/locale';
import { motion, AnimatePresence } from 'motion/react';
import { GoogleGenAI } from "@google/genai";
import Markdown from 'react-markdown';
import { 
  onAuthStateChanged, 
  signInWithPopup, 
  signOut, 
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  User as FirebaseUser 
} from 'firebase/auth';
import { 
  collection, 
  query, 
  where, 
  onSnapshot, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  doc, 
  setDoc, 
  getDoc,
  orderBy,
  Timestamp,
  getDocFromServer
} from 'firebase/firestore';
import { auth, db, googleProvider, facebookProvider } from './lib/firebase';
import { cn } from './lib/utils';
import { storageService, Category, Transaction } from './services/storage';

// --- Constants ---

const LOGO_URL = 'https://img.icons8.com/fluency/512/sales-performance.png';

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
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [isAuthReady, setIsAuthReady] = useState(false);
  const [loading, setLoading] = useState(true);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [userProfile, setUserProfile] = useState<{ displayName: string, currency: string, apiKey?: string }>({ displayName: 'Utilizador', currency: 'EUR' });
  const [activeTab, setActiveTab] = useState<'dashboard' | 'history' | 'stats' | 'ai'>('dashboard');
  const [historyView, setHistoryView] = useState<'list' | 'category'>('list');
  const [statsPeriod, setStatsPeriod] = useState<'monthly' | 'annual'>('monthly');
  const [statsYear, setStatsYear] = useState(new Date().getFullYear());
  const [statsMonth, setStatsMonth] = useState(new Date().getMonth());
  const [showAddModal, setShowAddModal] = useState(false);
  const [showApiKeyModal, setShowApiKeyModal] = useState(false);
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);
  const [showMenu, setShowMenu] = useState(false);
  const [showAbout, setShowAbout] = useState(false);
  const [showFeatures, setShowFeatures] = useState(false);
  const [showCategoryManager, setShowCategoryManager] = useState(false);
  const [aiAdvice, setAiAdvice] = useState<string>('');
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [showSplash, setShowSplash] = useState(true);

  // Auth States
  const [isRegistering, setIsRegistering] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [authError, setAuthError] = useState('');
  const [isAuthLoading, setIsAuthLoading] = useState(false);

  // Operation Type Enum for Error Handling
  const OperationType = {
    CREATE: 'create',
    UPDATE: 'update',
    DELETE: 'delete',
    LIST: 'list',
    GET: 'get',
    WRITE: 'write',
  } as const;

  type OperationType = typeof OperationType[keyof typeof OperationType];

  const handleFirestoreError = (error: unknown, operationType: OperationType, path: string | null) => {
    const errInfo = {
      error: error instanceof Error ? error.message : String(error),
      authInfo: {
        userId: auth.currentUser?.uid,
        email: auth.currentUser?.email,
        emailVerified: auth.currentUser?.emailVerified,
        isAnonymous: auth.currentUser?.isAnonymous,
      },
      operationType,
      path
    };
    console.error('Firestore Error: ', JSON.stringify(errInfo));
  };

  // Auth Listener
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      setIsAuthReady(true);
      
      if (currentUser) {
        // Sync user profile
        const userDocRef = doc(db, 'users', currentUser.uid);
        try {
          const userDoc = await getDoc(userDocRef);
          if (!userDoc.exists()) {
            const newProfile = {
              uid: currentUser.uid,
              displayName: currentUser.displayName || 'Utilizador',
              email: currentUser.email || '',
              currency: 'EUR',
              createdAt: new Date().toISOString()
            };
            await setDoc(userDocRef, newProfile);
            setUserProfile(newProfile);
          } else {
            setUserProfile(userDoc.data() as any);
          }
        } catch (error) {
          handleFirestoreError(error, OperationType.GET, `users/${currentUser.uid}`);
        }
      } else {
        setLoading(false);
      }
    });
    return () => unsubscribe();
  }, []);

  // Data Listeners
  useEffect(() => {
    if (!user || !isAuthReady) return;

    const transactionsQuery = query(
      collection(db, 'transactions'),
      where('uid', '==', user.uid),
      orderBy('date', 'desc')
    );

    const categoriesQuery = query(
      collection(db, 'categories'),
      where('uid', '==', user.uid)
    );

    const unsubTransactions = onSnapshot(transactionsQuery, (snapshot) => {
      const docs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Transaction));
      setTransactions(docs);
      setLoading(false);
    }, (error) => handleFirestoreError(error, OperationType.LIST, 'transactions'));

    const unsubCategories = onSnapshot(categoriesQuery, (snapshot) => {
      const docs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Category));
      setCategories(docs);
    }, (error) => handleFirestoreError(error, OperationType.LIST, 'categories'));

    return () => {
      unsubTransactions();
      unsubCategories();
    };
  }, [user, isAuthReady]);

  // Test Connection
  useEffect(() => {
    async function testConnection() {
      try {
        await getDocFromServer(doc(db, 'test', 'connection'));
      } catch (error) {
        if(error instanceof Error && error.message.includes('the client is offline')) {
          console.error("Please check your Firebase configuration.");
        }
      }
    }
    testConnection();
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      setShowSplash(false);
    }, 2000);
    return () => clearTimeout(timer);
  }, []);

  const handleLogin = async () => {
    setAuthError('');
    setIsAuthLoading(true);
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (error: any) {
      console.error('Erro no login Google:', error);
      setAuthError('Falha ao entrar com o Google.');
    } finally {
      setIsAuthLoading(false);
    }
  };

  const handleFacebookLogin = async () => {
    setAuthError('');
    setIsAuthLoading(true);
    try {
      await signInWithPopup(auth, facebookProvider);
    } catch (error: any) {
      console.error('Erro no login Facebook:', error);
      if (error.code === 'auth/account-exists-with-different-credential') {
        setAuthError('Já existe uma conta com este email associada a outro método de login.');
      } else {
        setAuthError('Falha ao entrar com o Facebook.');
      }
    } finally {
      setIsAuthLoading(false);
    }
  };

  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError('');
    setIsAuthLoading(true);
    try {
      if (isRegistering) {
        await createUserWithEmailAndPassword(auth, email, password);
      } else {
        await signInWithEmailAndPassword(auth, email, password);
      }
    } catch (error: any) {
      console.error('Erro na autenticação por email:', error);
      if (error.code === 'auth/email-already-in-use') {
        setAuthError('Este email já está em utilização.');
      } else if (error.code === 'auth/invalid-credential' || error.code === 'auth/user-not-found' || error.code === 'auth/wrong-password') {
        setAuthError('Email ou palavra-passe incorretos.');
      } else if (error.code === 'auth/weak-password') {
        setAuthError('A palavra-passe deve ter pelo menos 6 caracteres.');
      } else if (error.code === 'auth/operation-not-allowed') {
        setAuthError('O login por email não está ativado na consola do Firebase. Por favor, ative-o em Authentication > Sign-in method.');
      } else if (error.code === 'auth/too-many-requests') {
        setAuthError('Demasiadas tentativas. Tente mais tarde.');
      } else {
        setAuthError(`Erro: ${error.message}`);
      }
    } finally {
      setIsAuthLoading(false);
    }
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
      setTransactions([]);
      setCategories([]);
      setUserProfile({ displayName: 'Utilizador', currency: 'EUR' });
    } catch (error) {
      console.error('Erro no logout:', error);
    }
  };

  const refreshData = () => {
    // No-op with real-time listeners
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'transactions', id));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `transactions/${id}`);
    }
  };

  const handleEdit = (transaction: Transaction) => {
    setEditingTransaction(transaction);
    setShowAddModal(true);
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
    if (transactions.length === 0) {
      setAiAdvice('Adicione algumas transações primeiro para que eu possa analisar os seus hábitos financeiros.');
      return;
    }
    
    setIsAiLoading(true);
    setAiAdvice('');
    
    try {
      // Use the provided key as a fallback if environment variables are missing
      const PROVIDED_KEY = "AIzaSyBumVDztYqo3B9S1jdcld-J5v8Z4_Loj58";
      let apiKey = userProfile.apiKey || process.env.GEMINI_API_KEY || process.env.API_KEY;
      
      // If no environment key is found and no user key, use the provided one
      if (!apiKey || apiKey === 'MY_GEMINI_API_KEY') {
        apiKey = PROVIDED_KEY;
      }

      // Final check - if still no key, try to open the selection dialog
      if (!apiKey && window.aistudio) {
        const hasKey = await window.aistudio.hasSelectedApiKey();
        if (!hasKey) {
          await window.aistudio.openSelectKey();
          apiKey = process.env.API_KEY;
        }
      }

      if (!apiKey) {
        throw new Error('API Key não configurada. Por favor, configure a sua API Key no menu lateral.');
      }

      // Warning for non-standard keys (Gemini keys usually start with AIza)
      if (!apiKey.startsWith('AIza') && apiKey !== PROVIDED_KEY) {
        console.warn('A chave API fornecida não parece ser uma chave padrão do Google Gemini (deve começar por AIza).');
      }

      const ai = new GoogleGenAI({ apiKey });
      const summary = transactions.slice(0, 30).map(t => 
        `${t.type === 'income' ? 'Receita' : 'Despesa'}: ${t.amount}€ | Categoria: ${t.category} | Descrição: ${t.description || 'N/A'} | Data: ${format(parseISO(t.date), 'dd/MM/yyyy')}`
      ).join('\n');
      
      const prompt = `És um consultor financeiro de elite, sofisticado, empático e prático. 
Analisa as minhas transações recentes e o meu saldo atual. 
Dá-me 3 a 4 conselhos financeiros personalizados, curtos e acionáveis em Português de Portugal (PT-PT).
Usa Markdown para formatar a resposta (usa negrito para pontos chave).

Transações Recentes:
${summary}

Saldo Atual: ${stats.balance.toLocaleString('pt-PT', { style: 'currency', currency: 'EUR' })}

Estrutura a tua resposta com uma breve introdução encorajadora, seguida dos pontos de conselho e uma conclusão inspiradora.`;

      // Use a valid model name and correct syntax for @google/genai
      const response = await ai.models.generateContent({
        model: "gemini-1.5-flash",
        contents: [{ role: 'user', parts: [{ text: prompt }] }]
      });

      if (!response.text) {
        throw new Error('O modelo não devolveu nenhuma resposta.');
      }

      setAiAdvice(response.text);
    } catch (err: any) {
      console.error('Erro no Consultor AI:', err);
      let errorMessage = 'Não consegui contactar o consultor financeiro neste momento.';
      
      // Detailed error for 403 on Android
      if (err.message?.includes('403') || String(err).includes('403')) {
        errorMessage = `### Erro 403: Acesso Negado\n\nEste erro no Android indica geralmente que:\n\n1. **API Key Restrita:** Verifique no Google Cloud Console se a sua chave tem restrições de "Android apps" ou "Referrer". Remova-as para testar.\n2. **API não Ativa:** Confirme se a "Generative AI API" está ativa no seu projeto.\n3. **Região não Suportada:** Se estiver a usar dados móveis, tente ligar-se a uma rede Wi-Fi.\n\n**Dica:** Tente criar uma nova chave sem qualquer restrição no Google AI Studio.`;
      } else if (err instanceof Error) {
        errorMessage = `### Ups! Ocorreu um erro\n\n${err.message}\n\nVerifica se a tua ligação à internet está estável e se a chave da API está correta.`;
      }
      
      setAiAdvice(errorMessage);
    } finally {
      setIsAiLoading(false);
    }
  };

  if (loading || showSplash || !isAuthReady) {
    return (
      <div className="h-screen flex flex-col items-center justify-center bg-surface gap-6">
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 0.5 }}
          className="flex flex-col items-center gap-4"
        >
          <img 
            src={LOGO_URL} 
            alt="Logo" 
            className="w-32 h-32 object-contain"
            referrerPolicy="no-referrer"
          />
        </motion.div>
        <Loader2 className="w-8 h-8 animate-spin text-primary/30 mt-8" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-[#f5f2ed] flex flex-col items-center justify-center p-6">
        <motion.div
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          className="max-w-md w-full space-y-8 bg-white p-10 rounded-[32px] shadow-2xl shadow-stone-200 border border-stone-100"
        >
          <div className="text-center space-y-4">
            <div className="relative inline-block">
              <img 
                src={LOGO_URL} 
                alt="Atelier Financeiro" 
                className="w-24 h-24 mx-auto object-contain relative z-10"
                referrerPolicy="no-referrer"
              />
              <div className="absolute inset-0 bg-primary/5 blur-2xl rounded-full -z-0" />
            </div>
            <div className="space-y-1">
              <h1 className="text-3xl font-serif font-light tracking-tight text-stone-900">Atelier Financeiro</h1>
              <p className="text-stone-500 text-sm font-medium uppercase tracking-widest">
                {isRegistering ? 'Criar Conta' : 'Aceder ao Atelier'}
              </p>
            </div>
          </div>
          
          <form onSubmit={handleEmailAuth} className="space-y-5">
            <div className="space-y-2">
              <label className="text-[10px] font-bold text-stone-400 uppercase tracking-[0.2em] ml-1">Endereço de Email</label>
              <input 
                type="email" 
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="exemplo@email.com"
                className="w-full bg-stone-50 rounded-2xl px-5 py-4 outline-none focus:ring-2 ring-primary/10 border border-stone-200 transition-all placeholder:text-stone-300"
                required
                disabled={isAuthLoading}
              />
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-bold text-stone-400 uppercase tracking-[0.2em] ml-1">Palavra-passe</label>
              <input 
                type="password" 
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full bg-stone-50 rounded-2xl px-5 py-4 outline-none focus:ring-2 ring-primary/10 border border-stone-200 transition-all placeholder:text-stone-300"
                required
                disabled={isAuthLoading}
              />
            </div>

            {authError && (
              <motion.div 
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="p-4 bg-error/5 border border-error/10 rounded-xl"
              >
                <p className="text-xs text-error font-medium text-center leading-relaxed">{authError}</p>
              </motion.div>
            )}

            <Button 
              type="submit" 
              className="w-full py-4 rounded-2xl font-bold shadow-lg shadow-primary/10 h-14"
              disabled={isAuthLoading}
            >
              {isAuthLoading ? <Loader2 className="w-6 h-6 animate-spin" /> : (isRegistering ? 'Registar Agora' : 'Entrar no Atelier')}
            </Button>
          </form>

          <div className="relative py-2">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-stone-100"></div>
            </div>
            <div className="relative flex justify-center text-[10px] uppercase tracking-[0.3em]">
              <span className="bg-white px-4 text-stone-300 font-bold">Ou</span>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <button 
              onClick={handleLogin} 
              disabled={isAuthLoading}
              className="w-full py-4 rounded-2xl text-sm font-bold flex items-center justify-center gap-3 border border-stone-200 hover:bg-stone-50 transition-all disabled:opacity-50"
            >
              <img src="https://www.google.com/favicon.ico" className="w-5 h-5" alt="" />
              Google
            </button>

            <button 
              onClick={handleFacebookLogin} 
              disabled={isAuthLoading}
              className="w-full py-4 rounded-2xl text-sm font-bold flex items-center justify-center gap-3 bg-[#1877f2] text-white hover:bg-[#166fe5] transition-all disabled:opacity-50 shadow-lg shadow-blue-500/10"
            >
              <Facebook className="w-5 h-5 fill-current" />
              Facebook
            </button>
          </div>

          <div className="text-center pt-2">
            <button 
              onClick={() => { setIsRegistering(!isRegistering); setAuthError(''); }}
              disabled={isAuthLoading}
              className="text-sm text-primary font-bold hover:underline decoration-2 underline-offset-4"
            >
              {isRegistering ? 'Já tem conta? Entre aqui' : 'Não tem conta? Registe-se'}
            </button>
          </div>
          
          <p className="text-[10px] text-stone-400 text-center pt-6 leading-relaxed">
            Ao aceder, concorda com os nossos <br />
            <span className="underline">Termos de Utilização</span> e <span className="underline">Política de Privacidade</span>.
          </p>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-surface pb-24">
      {/* Header */}
      <header className="p-6 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button onClick={() => setShowMenu(true)} className="p-2 -ml-2 rounded-full hover:bg-surface-container-highest">
            <Menu className="w-6 h-6" />
          </button>
          <img 
            src={LOGO_URL} 
            alt="Atelier Financeiro" 
            className="h-10 sm:h-12 w-auto object-contain"
            referrerPolicy="no-referrer"
          />
        </div>
        <div className="flex items-center gap-3">
          <div className="text-right hidden sm:block">
            <p className="text-sm font-bold">{userProfile.displayName}</p>
          </div>
          <button 
            onClick={handleLogout}
            className="w-10 h-10 rounded-full bg-primary-container flex items-center justify-center text-on-primary hover:bg-error/20 hover:text-error transition-colors group relative"
            title="Sair"
          >
            <UserIcon className="w-6 h-6 group-hover:hidden" />
            <LogOut className="w-5 h-5 hidden group-hover:block" />
          </button>
        </div>
      </header>

      {/* Side Menu Drawer */}
      <AnimatePresence>
        {showMenu && (
          <>
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowMenu(false)}
              className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[100]"
            />
            <motion.div 
              initial={{ x: '-100%' }}
              animate={{ x: 0 }}
              exit={{ x: '-100%' }}
              className="fixed top-0 left-0 bottom-0 w-72 bg-surface z-[101] shadow-2xl p-6 flex flex-col"
            >
              <div className="flex items-center justify-between mb-12">
                <div className="flex items-center gap-3">
                  <img src={LOGO_URL} alt="Logo" className="h-12 w-12 object-contain" referrerPolicy="no-referrer" />
                </div>
                <button onClick={() => setShowMenu(false)} className="p-2">
                  <X className="w-6 h-6" />
                </button>
              </div>

              <nav className="flex-1 space-y-2">
                <MenuOption 
                  icon={<LayoutDashboard />} 
                  label="Dashboard" 
                  active={activeTab === 'dashboard'}
                  onClick={() => { setActiveTab('dashboard'); setShowMenu(false); }} 
                />
                <MenuOption 
                  icon={<History />} 
                  label="Histórico" 
                  active={activeTab === 'history'}
                  onClick={() => { setActiveTab('history'); setShowMenu(false); }} 
                />
                <MenuOption 
                  icon={<BarChartIcon />} 
                  label="Estatísticas" 
                  active={activeTab === 'stats'}
                  onClick={() => { setActiveTab('stats'); setShowMenu(false); }} 
                />
                <MenuOption 
                  icon={<Settings />} 
                  label="Categorias" 
                  onClick={() => { setShowCategoryManager(true); setShowMenu(false); }} 
                />
                <MenuOption 
                  icon={<Key />} 
                  label="Inserir API Key Manual" 
                  onClick={() => { setShowApiKeyModal(true); setShowMenu(false); }} 
                />
                <hr className="my-4 border-outline-variant/30" />
                <MenuOption 
                  icon={<Info />} 
                  label="Sobre" 
                  onClick={() => { setShowAbout(true); setShowMenu(false); }} 
                />
                <MenuOption 
                  icon={<Sparkles />} 
                  label="Funcionalidades" 
                  onClick={() => { setShowFeatures(true); setShowMenu(false); }} 
                />
              </nav>

              <button 
                onClick={handleLogout}
                className="flex items-center gap-4 p-4 text-tertiary hover:bg-tertiary-container/20 rounded-xl transition-colors mt-auto"
              >
                <LogOut className="w-5 h-5" />
                <span className="font-bold">Sair</span>
              </button>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      <main className="px-6 space-y-8">
        <AnimatePresence mode="wait">
          {activeTab === 'dashboard' && (
            <motion.div 
              key="dashboard"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              className="space-y-8 relative"
            >
              {/* Background Logo */}
              <div className="fixed inset-0 -z-10 opacity-[0.03] pointer-events-none flex items-center justify-center overflow-hidden">
                <img src={LOGO_URL} className="w-[120%] h-auto max-w-none grayscale" alt="" />
              </div>

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

          {activeTab === 'stats' && (
            <motion.div 
              key="stats"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              className="space-y-8"
            >
              <div className="flex justify-center py-4">
                <img src={LOGO_URL} alt="Logo" className="w-20 h-20 object-contain" referrerPolicy="no-referrer" />
              </div>
              
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <h2 className="text-2xl">Estatísticas</h2>
                <div className="flex bg-surface-container-low p-1 rounded-xl">
                  <button 
                    onClick={() => setStatsPeriod('monthly')}
                    className={cn("px-4 py-2 rounded-lg text-sm font-bold transition-all", statsPeriod === 'monthly' ? "bg-surface shadow-sm text-primary" : "text-on-surface-variant")}
                  >
                    Mensal
                  </button>
                  <button 
                    onClick={() => setStatsPeriod('annual')}
                    className={cn("px-4 py-2 rounded-lg text-sm font-bold transition-all", statsPeriod === 'annual' ? "bg-surface shadow-sm text-primary" : "text-on-surface-variant")}
                  >
                    Anual
                  </button>
                </div>
              </div>

              {/* Filters */}
              <div className="flex flex-wrap gap-3">
                <div className="flex items-center gap-2 bg-surface-container-low px-4 py-2 rounded-xl">
                  <Calendar className="w-4 h-4 text-primary" />
                  <select 
                    value={statsYear} 
                    onChange={(e) => setStatsYear(parseInt(e.target.value))}
                    className="bg-transparent text-sm font-bold outline-none"
                  >
                    {Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - i).map(y => (
                      <option key={y} value={y}>{y}</option>
                    ))}
                  </select>
                </div>
                {statsPeriod === 'monthly' && (
                  <div className="flex items-center gap-2 bg-surface-container-low px-4 py-2 rounded-xl">
                    <Filter className="w-4 h-4 text-primary" />
                    <select 
                      value={statsMonth} 
                      onChange={(e) => setStatsMonth(parseInt(e.target.value))}
                      className="bg-transparent text-sm font-bold outline-none"
                    >
                      {Array.from({ length: 12 }, (_, i) => (
                        <option key={i} value={i}>
                          {format(new Date(2000, i, 1), 'MMMM', { locale: pt })}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
              </div>

              {/* Stats Summary */}
              {(() => {
                const filtered = transactions.filter(t => {
                  const d = parseISO(t.date);
                  if (statsPeriod === 'monthly') {
                    return d.getFullYear() === statsYear && d.getMonth() === statsMonth;
                  }
                  return d.getFullYear() === statsYear;
                });

                const income = filtered.filter(t => t.type === 'income').reduce((acc, t) => acc + t.amount, 0);
                const expenses = filtered.filter(t => t.type === 'expense').reduce((acc, t) => acc + t.amount, 0);
                const balance = income - expenses;

                const expensesByCategory = filtered
                  .filter(t => t.type === 'expense')
                  .reduce((acc, t) => {
                    acc[t.category] = (acc[t.category] || 0) + t.amount;
                    return acc;
                  }, {} as Record<string, number>);

                const pieData = Object.entries(expensesByCategory).map(([name, value]) => ({ name, value }));

                // Monthly breakdown for annual view
                const monthlyData = Array.from({ length: 12 }, (_, i) => {
                  const monthTransactions = filtered.filter(t => parseISO(t.date).getMonth() === i);
                  return {
                    name: format(new Date(2000, i, 1), 'MMM', { locale: pt }),
                    receitas: monthTransactions.filter(t => t.type === 'income').reduce((acc, t) => acc + t.amount, 0),
                    despesas: monthTransactions.filter(t => t.type === 'expense').reduce((acc, t) => acc + t.amount, 0),
                  };
                });

                return (
                  <div className="space-y-8">
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                      <Card className="bg-secondary-container/20 border border-secondary/10">
                        <p className="text-[10px] uppercase font-bold text-secondary tracking-widest mb-1">Total Receitas</p>
                        <p className="text-2xl font-display font-bold text-secondary">
                          {income.toLocaleString('pt-PT', { style: 'currency', currency: 'EUR' })}
                        </p>
                      </Card>
                      <Card className="bg-tertiary-container/20 border border-tertiary/10">
                        <p className="text-[10px] uppercase font-bold text-tertiary tracking-widest mb-1">Total Despesas</p>
                        <p className="text-2xl font-display font-bold text-tertiary">
                          {expenses.toLocaleString('pt-PT', { style: 'currency', currency: 'EUR' })}
                        </p>
                      </Card>
                      <Card className={cn("border", balance >= 0 ? "bg-primary/5 border-primary/10" : "bg-error/5 border-error/10")}>
                        <p className="text-[10px] uppercase font-bold opacity-60 tracking-widest mb-1">Balanço do Período</p>
                        <p className={cn("text-2xl font-display font-bold", balance >= 0 ? "text-primary" : "text-error")}>
                          {balance.toLocaleString('pt-PT', { style: 'currency', currency: 'EUR' })}
                        </p>
                      </Card>
                    </div>

                    {statsPeriod === 'annual' && (
                      <section className="space-y-4">
                        <h3 className="text-lg font-bold">Evolução Mensal ({statsYear})</h3>
                        <div className="h-72 w-full bg-surface-container-lowest p-4 rounded-3xl border border-outline-variant/10">
                          <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={monthlyData}>
                              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                              <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 10 }} />
                              <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10 }} />
                              <Tooltip 
                                cursor={{ fill: 'transparent' }}
                                contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 25px rgba(0,0,0,0.1)' }}
                              />
                              <Legend />
                              <Bar dataKey="receitas" fill="#006c4a" radius={[4, 4, 0, 0]} />
                              <Bar dataKey="despesas" fill="#ba1a1a" radius={[4, 4, 0, 0]} />
                            </BarChart>
                          </ResponsiveContainer>
                        </div>
                      </section>
                    )}

                    <section className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                      <div className="space-y-4">
                        <h3 className="text-lg font-bold">Gastos por Categoria</h3>
                        {pieData.length > 0 ? (
                          <div className="h-64 w-full flex items-center justify-center bg-surface-container-lowest rounded-3xl border border-outline-variant/10">
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
                        ) : (
                          <div className="h-64 flex items-center justify-center bg-surface-container-lowest rounded-3xl border border-outline-variant/10 text-on-surface-variant text-sm italic">
                            Sem despesas neste período.
                          </div>
                        )}
                      </div>

                      <div className="space-y-4">
                        <h3 className="text-lg font-bold">Top Categorias</h3>
                        <div className="space-y-3">
                          {pieData.sort((a, b) => b.value - a.value).slice(0, 5).map((item) => (
                            <div key={item.name} className="p-4 bg-surface-container-lowest rounded-2xl border border-outline-variant/10 flex justify-between items-center">
                              <div className="flex items-center gap-3">
                                <div className="w-3 h-3 rounded-full" style={{ backgroundColor: CATEGORY_COLORS[item.name] || '#ccc' }} />
                                <span className="font-medium text-sm">{item.name}</span>
                              </div>
                              <div className="text-right">
                                <p className="font-display font-bold text-sm">
                                  {item.value.toLocaleString('pt-PT', { style: 'currency', currency: 'EUR' })}
                                </p>
                                <p className="text-[10px] text-on-surface-variant opacity-60">
                                  {((item.value / expenses) * 100).toFixed(1)}% do total
                                </p>
                              </div>
                            </div>
                          ))}
                          {pieData.length === 0 && (
                            <p className="text-center py-12 text-on-surface-variant text-sm italic">Nenhum dado disponível.</p>
                          )}
                        </div>
                      </div>
                    </section>
                  </div>
                );
              })()}
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
              <div className="flex justify-center py-4">
                <img src={LOGO_URL} alt="Logo" className="w-20 h-20 object-contain" referrerPolicy="no-referrer" />
              </div>
              <div className="flex items-center justify-between">
                <h2 className="text-2xl">Histórico</h2>
                <div className="flex bg-surface-container-low p-1 rounded-lg">
                  <button 
                    onClick={() => setHistoryView('list')}
                    className={cn("p-2 rounded-md transition-all", historyView === 'list' ? "bg-surface shadow-sm text-primary" : "text-on-surface-variant")}
                  >
                    <List className="w-4 h-4" />
                  </button>
                  <button 
                    onClick={() => setHistoryView('category')}
                    className={cn("p-2 rounded-md transition-all", historyView === 'category' ? "bg-surface shadow-sm text-primary" : "text-on-surface-variant")}
                  >
                    <PieChartIcon className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {historyView === 'list' ? (
                <div className="space-y-4">
                  <AnimatePresence mode="popLayout">
                    {transactions.length === 0 ? (
                      <motion.p 
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        className="text-center text-on-surface-variant py-12"
                      >
                        Nenhuma transação encontrada.
                      </motion.p>
                    ) : (
                      transactions.map((t) => (
                        <motion.div 
                          layout
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, scale: 0.95 }}
                          key={t.id} 
                          className="group flex flex-col sm:flex-row sm:items-center justify-between p-4 bg-surface-container-low rounded-xl hover:bg-surface-container-highest transition-colors gap-4"
                        >
                          <div className="flex items-center gap-4">
                            <div className={cn(
                              "w-12 h-12 rounded-full flex items-center justify-center shrink-0",
                              t.type === 'income' ? "bg-secondary-container text-secondary" : "bg-tertiary-container text-tertiary"
                            )}>
                              {t.type === 'income' ? <TrendingUp className="w-6 h-6" /> : <TrendingDown className="w-6 h-6" />}
                            </div>
                            <div className="min-w-0">
                              <p className="font-semibold truncate">{t.category}</p>
                              <p className="text-xs text-on-surface-variant truncate">{t.description || 'Sem descrição'}</p>
                              <p className="text-[10px] text-on-surface-variant/70 uppercase tracking-tighter">
                                {format(parseISO(t.date), "d 'de' MMMM", { locale: pt })}
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center justify-between sm:justify-end gap-4 w-full sm:w-auto border-t sm:border-t-0 pt-3 sm:pt-0 border-outline-variant/10">
                            <p className={cn(
                              "font-display font-bold text-lg",
                              t.type === 'income' ? "text-secondary" : "text-tertiary"
                            )}>
                              {t.type === 'income' ? '+' : '-'}{t.amount.toLocaleString('pt-PT', { style: 'currency', currency: 'EUR' })}
                            </p>
                            <div className="flex gap-1">
                              <button 
                                onClick={() => handleEdit(t)}
                                className="p-3 text-primary hover:bg-primary/10 rounded-full"
                              >
                                <Edit2 className="w-5 h-5" />
                              </button>
                              <button 
                                onClick={() => handleDelete(t.id)}
                                className="p-3 text-tertiary hover:bg-tertiary/10 rounded-full"
                              >
                                <Trash2 className="w-5 h-5" />
                              </button>
                            </div>
                          </div>
                        </motion.div>
                      ))
                    )}
                  </AnimatePresence>
                </div>
              ) : (
                <div className="space-y-8">
                  {['income', 'expense'].map((type) => {
                    const filtered = transactions.filter(t => t.type === type);
                    const byCat = filtered.reduce((acc, t) => {
                      acc[t.category] = (acc[t.category] || 0) + t.amount;
                      return acc;
                    }, {} as Record<string, number>);

                    return Object.keys(byCat).length > 0 && (
                      <div key={type} className="space-y-4">
                        <h3 className={cn("text-sm font-bold uppercase tracking-widest", type === 'income' ? "text-secondary" : "text-tertiary")}>
                          {type === 'income' ? 'Rendimentos por Categoria' : 'Despesas por Categoria'}
                        </h3>
                        <div className="space-y-3">
                          {Object.entries(byCat).map(([cat, val]) => (
                            <div key={cat} className="p-4 bg-surface-container-low rounded-xl flex justify-between items-center">
                              <div className="flex items-center gap-3">
                                <div className="w-2 h-8 rounded-full" style={{ backgroundColor: categories.find(c => c.name === cat)?.color || '#ccc' }} />
                                <span className="font-medium">{cat}</span>
                              </div>
                              <span className="font-display font-bold">
                                {val.toLocaleString('pt-PT', { style: 'currency', currency: 'EUR' })}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
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
              <div className="flex justify-center py-4">
                <img src={LOGO_URL} alt="Logo" className="w-24 h-24 object-contain" referrerPolicy="no-referrer" />
              </div>
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
                <Card className="prose prose-sm max-w-none bg-surface-container-low border border-outline-variant/30">
                  <div className="leading-relaxed text-on-surface-variant markdown-body">
                    <Markdown>{aiAdvice}</Markdown>
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
          active={activeTab === 'stats'} 
          onClick={() => setActiveTab('stats')}
          icon={<BarChartIcon />}
          label="Stats"
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
              className="bg-surface w-full max-w-lg rounded-t-3xl sm:rounded-3xl p-6 sm:p-8 space-y-4 sm:space-y-6 shadow-2xl"
            >
              <div className="flex justify-center py-2">
                <img src={LOGO_URL} alt="Logo" className="w-12 h-12 object-contain" referrerPolicy="no-referrer" />
              </div>
              <div className="flex items-center justify-between">
                <h2 className="text-2xl">{editingTransaction ? 'Editar Transação' : 'Nova Transação'}</h2>
                <button onClick={() => { setShowAddModal(false); setEditingTransaction(null); }} className="p-2">
                  <X className="w-6 h-6" />
                </button>
              </div>
              
              <AddTransactionForm 
                editingTransaction={editingTransaction}
                categories={categories}
                onSuccess={() => {
                  setShowAddModal(false);
                  setEditingTransaction(null);
                  refreshData();
                }} 
              />
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Category Manager Modal */}
      <Modal show={showCategoryManager} onClose={() => setShowCategoryManager(false)} title="Gerir Categorias">
        <div className="flex justify-center py-2 mb-4">
          <img src={LOGO_URL} alt="Logo" className="w-16 h-16 object-contain" referrerPolicy="no-referrer" />
        </div>
        <CategoryManager categories={categories} onUpdate={refreshData} />
      </Modal>

      {/* API Key Modal */}
      <Modal show={showApiKeyModal} onClose={() => setShowApiKeyModal(false)} title="Configurar API Key">
        <div className="space-y-6">
          <div className="flex justify-center py-2">
            <Key className="w-12 h-12 text-primary" />
          </div>
          <p className="text-sm text-on-surface-variant text-center">
            Insira a sua chave da API do Google Gemini para obter conselhos personalizados.
          </p>
          <div className="space-y-2">
            <label className="text-xs font-bold text-on-surface-variant uppercase tracking-widest">Chave da API</label>
            <input 
              type="password" 
              value={userProfile.apiKey || ''}
              onChange={(e) => {
                const newKey = e.target.value;
                setUserProfile(prev => ({ ...prev, apiKey: newKey }));
                storageService.updateProfile({ apiKey: newKey });
              }}
              placeholder="AIza..."
              className="w-full bg-surface-container-low rounded-xl px-4 py-3 outline-none focus:ring-2 ring-primary/20"
            />
          </div>
          <Button onClick={() => setShowApiKeyModal(false)} className="w-full py-4">
            Guardar e Fechar
          </Button>
          <p className="text-[10px] text-on-surface-variant/60 text-center">
            A sua chave é guardada apenas localmente no seu dispositivo.
          </p>
        </div>
      </Modal>

      {/* About Modal */}
      <Modal show={showAbout} onClose={() => setShowAbout(false)} title="Sobre o Atelier">
        <div className="space-y-6 text-on-surface-variant leading-relaxed">
          <div className="flex justify-center py-4">
            <img src={LOGO_URL} alt="Logo" className="w-24 h-24 object-contain" referrerPolicy="no-referrer" />
          </div>
          <p>O <strong>Atelier Financeiro</strong> é uma ferramenta de gestão pessoal desenhada para trazer clareza e elegância às suas finanças.</p>
          <p>Inspirado na precisão de um atelier, cada detalhe foi pensado para que a sua jornada financeira seja tratada com o cuidado que merece.</p>
          <div className="pt-4 border-t border-outline-variant/30">
            <p className="text-xs">Versão 2.0.0 (Embedded)</p>
            <p className="text-xs">Desenvolvido para calculorotina.com</p>
          </div>
        </div>
      </Modal>

      {/* Features Modal */}
      <Modal show={showFeatures} onClose={() => setShowFeatures(false)} title="Funcionalidades">
        <div className="space-y-6">
          <div className="flex justify-center py-4">
            <img src={LOGO_URL} alt="Logo" className="w-20 h-20 object-contain" referrerPolicy="no-referrer" />
          </div>
          <FeatureItem icon={<Wallet />} title="Gestão Offline" desc="Os seus dados nunca saem do seu dispositivo." />
          <FeatureItem icon={<Settings />} title="Categorias Dinâmicas" desc="Crie e edite as suas próprias categorias de gastos." />
          <FeatureItem icon={<PieChart />} title="Análise Visual" desc="Gráficos intuitivos para entender onde gasta o seu dinheiro." />
          <FeatureItem icon={<Sparkles />} title="Consultor AI" desc="Inteligência Artificial para dar conselhos personalizados." />
        </div>
      </Modal>
    </div>
  );
}

function Modal({ show, onClose, title, children }: { show: boolean, onClose: () => void, title: string, children: React.ReactNode }) {
  return (
    <AnimatePresence>
      {show && (
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[150] flex items-center justify-center p-6"
        >
          <motion.div 
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.9, opacity: 0 }}
            className="bg-surface w-full max-w-md rounded-3xl p-6 sm:p-8 shadow-2xl space-y-6"
          >
            <div className="flex items-center justify-between">
              <h2 className="text-2xl">{title}</h2>
              <button onClick={onClose} className="p-2">
                <X className="w-6 h-6" />
              </button>
            </div>
            {children}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function FeatureItem({ icon, title, desc }: { icon: React.ReactNode, title: string, desc: string }) {
  return (
    <div className="flex gap-4">
      <div className="w-10 h-10 rounded-xl bg-primary-container flex items-center justify-center text-on-primary shrink-0">
        {icon}
      </div>
      <div>
        <p className="font-bold">{title}</p>
        <p className="text-sm text-on-surface-variant">{desc}</p>
      </div>
    </div>
  );
}

function MenuOption({ icon, label, active, onClick }: { icon: React.ReactNode, label: string, active?: boolean, onClick: () => void }) {
  return (
    <button 
      onClick={onClick}
      className={cn(
        "w-full flex items-center gap-4 p-4 rounded-xl transition-all",
        active ? "bg-primary text-on-primary shadow-lg" : "text-on-surface-variant hover:bg-surface-container-highest"
      )}
    >
      {React.isValidElement(icon) ? React.cloneElement(icon as React.ReactElement<any>, { className: "w-5 h-5" }) : icon}
      <span className="font-semibold">{label}</span>
      {active && <ChevronRight className="w-4 h-4 ml-auto" />}
    </button>
  );
}

function CategoryManager({ categories, onUpdate }: { categories: Category[], onUpdate: () => void }) {
  const [newCatName, setNewCatName] = useState('');
  const [newCatType, setNewCatType] = useState<'income' | 'expense'>('expense');

  const handleAdd = async () => {
    if (!newCatName || !auth.currentUser) return;
    try {
      await addDoc(collection(db, 'categories'), {
        uid: auth.currentUser.uid,
        name: newCatName,
        type: newCatType,
        color: '#' + Math.floor(Math.random()*16777215).toString(16)
      });
      setNewCatName('');
    } catch (error) {
      console.error('Erro ao adicionar categoria:', error);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'categories', id));
    } catch (error) {
      console.error('Erro ao eliminar categoria:', error);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:gap-2">
        <input 
          value={newCatName}
          onChange={(e) => setNewCatName(e.target.value)}
          placeholder="Nova categoria..."
          className="w-full sm:flex-1 bg-surface-container-low rounded-xl px-4 py-3 sm:py-2 outline-none"
        />
        <div className="flex gap-2">
          <select 
            value={newCatType}
            onChange={(e) => setNewCatType(e.target.value as any)}
            className="flex-1 sm:w-auto bg-surface-container-low rounded-xl px-4 sm:px-2 outline-none text-xs font-bold h-12 sm:h-auto"
          >
            <option value="expense">Despesa</option>
            <option value="income">Receita</option>
          </select>
          <button onClick={handleAdd} className="p-3 sm:p-2 bg-primary text-on-primary rounded-xl flex items-center justify-center">
            <PlusCircle className="w-6 h-6" />
          </button>
        </div>
      </div>

      <div className="max-h-64 overflow-y-auto space-y-2 pr-2">
        {categories.map(cat => (
          <div key={cat.id} className="flex flex-col sm:flex-row sm:items-center justify-between p-3 bg-surface-container-low rounded-xl gap-2">
            <div className="flex items-center gap-3">
              <div className="w-3 h-3 rounded-full" style={{ backgroundColor: cat.color }} />
              <span className="text-sm font-medium">{cat.name}</span>
              <span className="text-[10px] uppercase font-bold opacity-50">{cat.type === 'income' ? 'Rec' : 'Des'}</span>
            </div>
            <button onClick={() => handleDelete(cat.id)} className="p-3 text-tertiary hover:bg-tertiary/10 rounded-full self-end sm:self-auto">
              <Trash2 className="w-5 h-5" />
            </button>
          </div>
        ))}
      </div>
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

function AddTransactionForm({ editingTransaction, categories, onSuccess }: { editingTransaction?: Transaction | null, categories: Category[], onSuccess: () => void }) {
  const [type, setType] = useState<'income' | 'expense'>('expense');
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState('');
  const [description, setDescription] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (editingTransaction) {
      setType(editingTransaction.type);
      setAmount(editingTransaction.amount.toString());
      setCategory(editingTransaction.category);
      setDescription(editingTransaction.description);
    }
  }, [editingTransaction]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!amount || !category || !auth.currentUser) return;
    
    setIsSubmitting(true);
    try {
      if (editingTransaction) {
        await updateDoc(doc(db, 'transactions', editingTransaction.id), {
          amount: parseFloat(amount),
          type,
          category,
          description,
          date: editingTransaction.date // Keep original date or update if needed
        });
      } else {
        await addDoc(collection(db, 'transactions'), {
          uid: auth.currentUser.uid,
          amount: parseFloat(amount),
          type,
          category,
          description,
          date: new Date().toISOString(),
          createdAt: new Date().toISOString()
        });
      }
      onSuccess();
    } catch (error) {
      console.error('Erro ao guardar transação:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const filteredCategories = categories.filter(c => c.type === type);

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="flex p-1 bg-surface-container-low rounded-xl">
        <button 
          type="button"
          onClick={() => { setType('expense'); setCategory(''); }}
          className={cn(
            "flex-1 py-2 rounded-lg text-sm font-bold transition-all",
            type === 'expense' ? "bg-tertiary text-on-tertiary shadow-lg" : "text-on-surface-variant"
          )}
        >
          Despesa
        </button>
        <button 
          type="button"
          onClick={() => { setType('income'); setCategory(''); }}
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
          {filteredCategories.map(cat => (
            <button
              key={cat.id}
              type="button"
              onClick={() => setCategory(cat.name)}
              className={cn(
                "px-4 py-2 rounded-full text-sm font-medium transition-all",
                category === cat.name 
                  ? "bg-primary text-on-primary shadow-md" 
                  : "bg-surface-container-low text-on-surface-variant hover:bg-surface-container-highest"
              )}
            >
              {cat.name}
            </button>
          ))}
          {filteredCategories.length === 0 && <p className="text-xs text-on-surface-variant">Crie categorias no menu lateral.</p>}
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
        {isSubmitting ? <Loader2 className="w-6 h-6 animate-spin" /> : (editingTransaction ? 'Atualizar' : 'Guardar')}
      </Button>
    </form>
  );
}
