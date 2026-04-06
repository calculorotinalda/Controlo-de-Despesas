/**
 * Serviço de Armazenamento Local (Embedded)
 * Este serviço substitui o Firebase por uma base de dados local persistente no dispositivo.
 */

const STORAGE_KEY = 'atelier_financeiro_data';

// --- Types ---

declare global {
  interface Window {
    aistudio?: {
      hasSelectedApiKey: () => Promise<boolean>;
      openSelectKey: () => Promise<void>;
    };
  }
}

export interface Transaction {
  id: string;
  amount: number;
  type: 'income' | 'expense';
  category: string;
  description: string;
  date: string; // ISO String
  createdAt: string;
}

export interface Category {
  id: string;
  name: string;
  type: 'income' | 'expense';
  color?: string;
}

interface AppData {
  transactions: Transaction[];
  categories: Category[];
  userProfile: {
    displayName: string;
    currency: string;
  };
}

const defaultCategories: Category[] = [
  { id: '1', name: 'Salário', type: 'income', color: '#006c4a' },
  { id: '2', name: 'Investimentos', type: 'income', color: '#133057' },
  { id: '3', name: 'Alimentação', type: 'expense', color: '#40000c' },
  { id: '4', name: 'Transporte', type: 'expense', color: '#001b3b' },
  { id: '5', name: 'Lazer', type: 'expense', color: '#ffdad9' },
  { id: '6', name: 'Saúde', type: 'expense', color: '#ba1a1a' },
  { id: '7', name: 'Casa', type: 'expense', color: '#133057' },
];

const initialData: AppData = {
  transactions: [],
  categories: defaultCategories,
  userProfile: {
    displayName: 'Utilizador Local',
    currency: 'EUR'
  }
};

export const storageService = {
  getData: (): AppData => {
    const data = localStorage.getItem(STORAGE_KEY);
    if (!data) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(initialData));
      return initialData;
    }
    const parsed = JSON.parse(data);
    if (!parsed.categories) {
      parsed.categories = defaultCategories;
      localStorage.setItem(STORAGE_KEY, JSON.stringify(parsed));
    }
    return parsed;
  },

  addTransaction: (transaction: Omit<Transaction, 'id' | 'createdAt'>): Transaction => {
    const data = storageService.getData();
    const newTransaction: Transaction = {
      ...transaction,
      id: crypto.randomUUID(),
      createdAt: new Date().toISOString()
    };
    data.transactions.unshift(newTransaction);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    return newTransaction;
  },

  updateTransaction: (id: string, updates: Partial<Transaction>) => {
    const data = storageService.getData();
    data.transactions = data.transactions.map(t => t.id === id ? { ...t, ...updates } : t);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  },

  deleteTransaction: (id: string) => {
    const data = storageService.getData();
    data.transactions = data.transactions.filter(t => t.id !== id);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  },

  addCategory: (category: Omit<Category, 'id'>): Category => {
    const data = storageService.getData();
    const newCategory: Category = {
      ...category,
      id: crypto.randomUUID()
    };
    data.categories.push(newCategory);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    return newCategory;
  },

  updateCategory: (id: string, updates: Partial<Category>) => {
    const data = storageService.getData();
    data.categories = data.categories.map(c => c.id === id ? { ...c, ...updates } : c);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  },

  deleteCategory: (id: string) => {
    const data = storageService.getData();
    data.categories = data.categories.filter(c => c.id !== id);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  },

  updateProfile: (profile: Partial<AppData['userProfile']>) => {
    const data = storageService.getData();
    data.userProfile = { ...data.userProfile, ...profile };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  }
};
