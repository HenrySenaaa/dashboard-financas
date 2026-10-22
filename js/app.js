/**
 * Camada de interface: liga o formulário, a tabela e os cards ao estado.
 * Todo render parte do array `transactions`, que é a única fonte da verdade.
 */
(function () {
  'use strict';

  var L = FinanceLogic;
  var storage = window.localStorage;

  var state = {
    transactions: L.loadTransactions(storage),
    filter: 'all'
  };

  var els = {
    balance: document.getElementById('balance'),
    income: document.getElementById('income'),
    expense: document.getElementById('expense'),
    balanceCard: document.getElementById('balance-card'),
    form: document.getElementById('transaction-form'),
    description: document.getElementById('description'),
    amount: document.getElementById('amount'),
    error: document.getElementById('form-error'),
    tbody: document.getElementById('transactions-body'),
    empty: document.getElementById('empty-state'),
    count: document.getElementById('transactions-count'),
    filters: document.querySelectorAll('[data-filter]'),
    clearAll: document.getElementById('clear-all')
  };

  function setState(patch) {
    Object.keys(patch).forEach(function (k) { state[k] = patch[k]; });
    L.saveTransactions(storage, state.transactions);
    render();
  }

  function renderSummary() {
    var s = L.calcSummary(state.transactions);
    els.balance.textContent = L.formatCurrency(s.balance);
    els.income.textContent = L.formatCurrency(s.income);
    els.expense.textContent = L.formatCurrency(s.expense);
    els.balanceCard.classList.toggle('is-negative', s.balance < 0);
  }

  function buildRow(t) {
    var tr = document.createElement('tr');
    tr.dataset.id = t.id;

    var desc = document.createElement('td');
    desc.textContent = t.description;
    desc.className = 'cell-desc';

    var type = document.createElement('td');
    var badge = document.createElement('span');
    badge.className = 'badge badge--' + t.type;
    badge.textContent = t.type === 'income' ? 'Entrada' : 'Saída';
    type.appendChild(badge);

    var amount = document.createElement('td');
    amount.className = 'amount amount--' + t.type;
    amount.textContent = (t.type === 'income' ? '+ ' : '- ') + L.formatCurrency(t.amount);

    var date = document.createElement('td');
    date.className = 'cell-date';
    date.textContent = L.formatDate(t.date);

    var actions = document.createElement('td');
    var remove = document.createElement('button');
    remove.type = 'button';
    remove.className = 'btn-remove';
    remove.dataset.action = 'remove';
    remove.setAttribute('aria-label', 'Remover ' + t.description);
    remove.title = 'Remover';
    remove.textContent = '✕';
    actions.appendChild(remove);

    tr.append(desc, type, amount, date, actions);
    return tr;
  }

  function renderTable() {
    var visible = state.transactions
      .filter(function (t) { return state.filter === 'all' || t.type === state.filter; })
      .slice()
      .sort(function (a, b) { return b.date.localeCompare(a.date); });

    var fragment = document.createDocumentFragment();
    visible.forEach(function (t) { fragment.appendChild(buildRow(t)); });
    els.tbody.replaceChildren(fragment);

    els.empty.hidden = visible.length > 0;
    els.count.textContent = visible.length + (visible.length === 1 ? ' transação' : ' transações');
    els.clearAll.hidden = state.transactions.length === 0;

    els.filters.forEach(function (btn) {
      btn.setAttribute('aria-pressed', String(btn.dataset.filter === state.filter));
    });
  }

  function render() {
    renderSummary();
    renderTable();
  }

  function showError(message) {
    els.error.textContent = message;
    els.error.hidden = !message;
  }

  els.form.addEventListener('submit', function (event) {
    event.preventDefault();
    var data = new FormData(els.form);
    try {
      var transaction = L.createTransaction({
        description: data.get('description'),
        amount: data.get('amount'),
        type: data.get('type')
      });
      showError('');
      setState({ transactions: state.transactions.concat(transaction) });
      els.description.value = '';
      els.amount.value = '';
      els.description.focus();
    } catch (err) {
      showError(err.message);
    }
  });

  els.tbody.addEventListener('click', function (event) {
    var btn = event.target.closest('[data-action="remove"]');
    if (!btn) return;
    var id = btn.closest('tr').dataset.id;
    setState({ transactions: L.removeTransaction(state.transactions, id) });
  });

  els.filters.forEach(function (btn) {
    btn.addEventListener('click', function () {
      setState({ filter: btn.dataset.filter });
    });
  });

  els.clearAll.addEventListener('click', function () {
    if (window.confirm('Apagar todas as transações? Essa ação não pode ser desfeita.')) {
      setState({ transactions: [] });
    }
  });

  // Mantém abas abertas em sincronia quando outra aba altera os dados.
  window.addEventListener('storage', function (event) {
    if (event.key === L.STORAGE_KEY) {
      state.transactions = L.loadTransactions(storage);
      render();
    }
  });

  render();
})();
