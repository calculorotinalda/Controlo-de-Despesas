/**
 * Serviço de Armazenamento Local (Embedded)
 * Este serviço substitui o Firebase por uma base de dados local persistente no dispositivo.
 */

const STORAGE_KEY = 'atelier_financeiro_data';

interface Transaction {
  id: string;
  amount: number;
  type: 'income' | 'expense';
  category: string;
  description: string;
  date: string; // ISO String
  createdAt: string;
}

interface AppData {
  transactions: Transaction[];
  userProfile: {
    displayName: string;
    currency: string;
  };
}

const initialData: AppData = {
  transactions: [],
  userProfile: {
    displayName: 'Utilizador Local',
    currency: 'EUR'
  }
};

export const storageService = {
  // Inicializar ou obter dados
  getData: (): AppData => {
    const data = localStorage.getItem(STORAGE_KEY);
    if (!data) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(initialData));
      return initialData;
    }
    return JSON.parse(data);
  },

  // Guardar uma nova transação
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

  // Obter todas as transações
  getTransactions: (): Transaction[] => {
    return storageService.getData().transactions;
  },

  // Eliminar uma transação
  deleteTransaction: (id: string) => {
    const data = storageService.getData();
    data.transactions = data.transactions.filter(t => t.id !== id);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  },

  // Atualizar perfil
  updateProfile: (profile: Partial<AppData['userProfile']>) => {
    const data = storageService.getData();
    data.userProfile = { ...data.userProfile, ...profile };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  }
};
