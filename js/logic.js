/**
 * Regras de negócio do dashboard de finanças.
 * Não acessa o DOM: pode ser usado no navegador e testado no Node.
 */
var FinanceLogic = (function () {
  'use strict';

  var STORAGE_KEY = 'financas:transacoes';
  var TYPES = ['income', 'expense'];

  function generateId() {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
      return crypto.randomUUID();
    }
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 10);
  }

  /**
   * Converte valores digitados no padrão brasileiro em número:
   * "1.234,56" -> 1234.56, "10,5" -> 10.5, "1.450" -> 1450, "12.5" -> 12.5.
   * Retorna NaN se inválido.
   */
  function parseAmount(value) {
    if (typeof value === 'number') return value;
    if (typeof value !== 'string') return NaN;
    var clean = value.trim().replace(/\s|R\$/g, '');
    if (clean === '') return NaN;
    if (clean.indexOf(',') !== -1) {
      clean = clean.replace(/\./g, '').replace(',', '.');
    } else if (/^-?\d{1,3}(\.\d{3})+$/.test(clean)) {
      // Sem vírgula e com grupos de 3 dígitos: os pontos são separadores de milhar.
      clean = clean.replace(/\./g, '');
    }
    return /^-?\d+(\.\d+)?$/.test(clean) ? Number(clean) : NaN;
  }

  /**
   * Valida os dados do formulário e cria uma transação.
   * Lança Error com mensagem amigável quando algo está errado.
   */
  function createTransaction(input, now) {
    var description = String((input && input.description) || '').trim();
    var amount = parseAmount(input && input.amount);
    var type = input && input.type;

    if (!description) throw new Error('Informe uma descrição.');
    if (description.length > 80) throw new Error('A descrição deve ter no máximo 80 caracteres.');
    if (!isFinite(amount) || amount <= 0) throw new Error('Informe um valor maior que zero.');
    if (TYPES.indexOf(type) === -1) throw new Error('Escolha se é uma entrada ou uma saída.');

    return {
      id: generateId(),
      description: description,
      amount: Math.round(amount * 100) / 100,
      type: type,
      date: (now || new Date()).toISOString()
    };
  }

  function isValidTransaction(t) {
    return !!t && typeof t.id === 'string' && typeof t.description === 'string' &&
      typeof t.amount === 'number' && isFinite(t.amount) && t.amount > 0 &&
      TYPES.indexOf(t.type) !== -1;
  }

  /** Soma em centavos para evitar erros de ponto flutuante (0.1 + 0.2). */
  function calcSummary(transactions) {
    var incomeCents = 0;
    var expenseCents = 0;
    (transactions || []).forEach(function (t) {
      var cents = Math.round(t.amount * 100);
      if (t.type === 'income') incomeCents += cents;
      else if (t.type === 'expense') expenseCents += cents;
    });
    return {
      income: incomeCents / 100,
      expense: expenseCents / 100,
      balance: (incomeCents - expenseCents) / 100
    };
  }

  var currencyFormatter = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });

  function formatCurrency(value) {
    return currencyFormatter.format(value);
  }

  function formatDate(iso) {
    var d = new Date(iso);
    if (isNaN(d.getTime())) return '';
    return d.toLocaleDateString('pt-BR');
  }

  function removeTransaction(transactions, id) {
    return transactions.filter(function (t) { return t.id !== id; });
  }

  /** Lê do storage; dados corrompidos são ignorados em vez de quebrar a página. */
  function loadTransactions(storage) {
    try {
      var raw = storage.getItem(STORAGE_KEY);
      if (!raw) return [];
      var parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed.filter(isValidTransaction) : [];
    } catch (e) {
      return [];
    }
  }

  function saveTransactions(storage, transactions) {
    try {
      storage.setItem(STORAGE_KEY, JSON.stringify(transactions));
      return true;
    } catch (e) {
      return false;
    }
  }

  return {
    STORAGE_KEY: STORAGE_KEY,
    parseAmount: parseAmount,
    createTransaction: createTransaction,
    isValidTransaction: isValidTransaction,
    calcSummary: calcSummary,
    formatCurrency: formatCurrency,
    formatDate: formatDate,
    removeTransaction: removeTransaction,
    loadTransactions: loadTransactions,
    saveTransactions: saveTransactions
  };
})();

if (typeof module !== 'undefined' && module.exports) {
  module.exports = FinanceLogic;
}
