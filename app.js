// ---------- Settings (easy to change later) ----------

// Expense categories from MyMoney_Simple2026.xlsx (Settings sheet)
const CATEGORIES = [
  { name: "Car loan", group: "Need" },
  { name: "Family", group: "Need" },
  { name: "Tata's rent", group: "Need" },
  { name: "Personal want", group: "Want" },
  { name: "Travel & Tourism", group: "Want" },
];
const GROUPS = ["Need", "Want"];

const CURRENCIES = {
  LAK: { symbol: "₭", decimals: 0 },
  THB: { symbol: "฿", decimals: 2 },
  USD: { symbol: "$", decimals: 2 },
};
const DEFAULT_CURRENCY = "LAK";

const STORAGE_KEY = "myjournal.expenses";
const RATES_KEY = "myjournal.rates";
const DEFAULT_RATES = { USD: 22500, THB: 690 }; // LAK per 1 unit

// Savings goals from MyMoney_Simple2026.xlsx (Goals sheet), in USD
const GOALS = [
  { name: "Family spare fund", target: 2000, monthly: 50 },
  { name: "Retirement", target: 1200, monthly: 100 },
  { name: "Home Office", target: 10000, monthly: 400 },
];
const SAVINGS_KEY = "myjournal.savings";
const TAB_KEY = "myjournal.tab";

// Shown in Settings → Build info. Update with every build.
const BUILD = { number: 5, date: "2026-09-15" };
const BACKUP_FORMAT = "my-journal-backup";

// ---------- Saving on this device ----------

// One list of entries under one storage key (used for expenses and savings)
function makeStore(key) {
  const load = () => {
    const raw = localStorage.getItem(key);
    if (!raw) return [];
    const list = JSON.parse(raw); // throws if the saved data is damaged, so we never overwrite it
    if (!Array.isArray(list)) throw new Error(`Saved data in ${key} is not a list`);
    return list;
  };
  const save = (list) => localStorage.setItem(key, JSON.stringify(list));
  return {
    load,
    save,
    add(entry) {
      const list = load();
      list.push(entry);
      save(list);
    },
    update(id, changes) {
      const list = load();
      const index = list.findIndex((e) => e.id === id);
      if (index === -1) throw new Error("Entry not found");
      list[index] = { ...list[index], ...changes, updatedAt: new Date().toISOString() };
      save(list);
    },
    remove(id) {
      save(load().filter((e) => e.id !== id));
    },
  };
}

const expenseStore = makeStore(STORAGE_KEY);
const savingsStore = makeStore(SAVINGS_KEY);

const loadExpenses = expenseStore.load;
const addExpense = expenseStore.add;
const updateExpense = expenseStore.update;
const deleteExpense = expenseStore.remove;

function loadRates() {
  try {
    return { ...DEFAULT_RATES, ...JSON.parse(localStorage.getItem(RATES_KEY) || "{}") };
  } catch {
    return { ...DEFAULT_RATES };
  }
}

function saveRates(rates) {
  localStorage.setItem(RATES_KEY, JSON.stringify(rates));
}

// ---------- Helpers ----------

function todayISO() {
  const now = new Date();
  return new Date(now.getTime() - now.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
}

function newId() {
  if (window.crypto && crypto.randomUUID) return crypto.randomUUID();
  return Date.now().toString(36) + Math.random().toString(36).slice(2);
}

function formatMoney(amount, currency) {
  const { symbol, decimals } = CURRENCIES[currency];
  return symbol + " " + amount.toLocaleString("en-US", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

// Adds thousand separators while typing: 25000 -> 25,000
function formatWhileTyping(text, decimals) {
  let s = text.replace(/[^\d.]/g, "");
  if (decimals === 0) s = s.replace(/\./g, "");
  const [intPart, ...rest] = s.split(".");
  const grouped = intPart.replace(/^0+(?=\d)/, "").replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  if (rest.length === 0) return grouped;
  return grouped + "." + rest.join("").slice(0, decimals);
}

function readAmount(text, decimals) {
  const n = Number(text.replace(/,/g, ""));
  if (!Number.isFinite(n)) return NaN;
  const factor = 10 ** decimals;
  return Math.round(n * factor) / factor;
}

function rateFor(currency, rates) {
  return currency === DEFAULT_CURRENCY ? 1 : rates[currency];
}

// Saved entries keep the rate from the day they were added.
// Entries from before rates existed fall back to today's rate.
function lakAmountOf(expense, rates) {
  if (typeof expense.lakAmount === "number") return expense.lakAmount;
  const rate = rateFor(expense.currency, rates);
  return rate ? Math.round(expense.amount * rate) : 0;
}

function groupOf(expense) {
  if (expense.group) return expense.group;
  const found = CATEGORIES.find((c) => c.name === expense.category);
  return found ? found.group : "";
}

function shortDate(iso, withYear = false) {
  const [y, m, d] = iso.split("-").map(Number);
  const options = { day: "numeric", month: "short" };
  if (withYear) options.year = "numeric";
  return new Date(y, m - 1, d).toLocaleDateString("en-GB", options);
}

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text != null) node.textContent = text;
  return node;
}

// A big tap button that works like a radio button
function choiceButton(name, value) {
  const label = el("label", "item-btn");
  const input = document.createElement("input");
  input.type = "radio";
  input.name = name;
  input.value = value;
  label.append(input, el("span", "", value));
  return label;
}

// In-app delete confirmation: the browser's own confirm() box is blocked in some browsers
function toggleConfirm(confirmId, actionsId, show) {
  $(confirmId).hidden = !show;
  $(actionsId).hidden = show;
}

// ---------- Dashboard ----------

const $ = (id) => document.getElementById(id);

const now = new Date();
let viewYear = now.getFullYear();
let viewMonth = now.getMonth(); // 0 = January

function monthKey(year, month) {
  return `${year}-${String(month + 1).padStart(2, "0")}`;
}

function summaryRow(label, amount) {
  const li = el("li", "row");
  li.append(el("span", "", label), el("span", "row-amount", formatMoney(amount, "LAK")));
  return li;
}

function renderDashboard() {
  const rates = loadRates();
  let all = [];
  let loadProblem = false;
  try {
    all = loadExpenses();
  } catch (err) {
    console.error(err);
    loadProblem = true;
  }

  const key = monthKey(viewYear, viewMonth);
  const items = all
    .filter((e) => typeof e.date === "string" && e.date.startsWith(key))
    .map((e) => ({ ...e, lak: lakAmountOf(e, rates) }))
    .sort((a, b) => b.date.localeCompare(a.date) || (b.createdAt || "").localeCompare(a.createdAt || ""));
  const total = items.reduce((sum, e) => sum + e.lak, 0);
  const sumWhere = (test) => items.filter(test).reduce((sum, e) => sum + e.lak, 0);

  $("month-label").textContent = new Date(viewYear, viewMonth, 1)
    .toLocaleDateString("en-GB", { month: "long", year: "numeric" });
  $("total").textContent = formatMoney(total, "LAK");

  $("by-group").replaceChildren(
    ...GROUPS.map((g) => summaryRow(g, sumWhere((e) => groupOf(e) === g)))
  );

  $("by-item").replaceChildren(
    ...GROUPS.flatMap((g) => {
      const list = el("ul");
      for (const c of CATEGORIES.filter((c) => c.group === g)) {
        list.append(summaryRow(c.name, sumWhere((e) => e.category === c.name)));
      }
      return [el("h4", "", g), list];
    })
  );

  $("log").replaceChildren(
    ...items.map((e) => {
      const row = el("button", "log-row");
      row.type = "button";
      const item = el("span", "log-item");
      item.append(el("span", "", e.category));
      if (e.note) item.append(el("span", "small", e.note));
      const amount = el("span", "log-amount");
      amount.append(el("span", "", formatMoney(e.lak, "LAK")));
      if (e.currency !== DEFAULT_CURRENCY) amount.append(el("span", "small", formatMoney(e.amount, e.currency)));
      row.append(el("span", "log-date", shortDate(e.date)), item, amount);
      row.addEventListener("click", () => openEdit(e.id));
      const li = el("li");
      li.append(row);
      return li;
    })
  );
  $("log-empty").textContent = loadProblem
    ? "Your saved transactions couldn't be read."
    : "No transactions this month.";
  $("log-empty").hidden = items.length > 0;
}

function changeMonth(delta) {
  const d = new Date(viewYear, viewMonth + delta, 1);
  viewYear = d.getFullYear();
  viewMonth = d.getMonth();
  renderDashboard();
}

$("prev-month").addEventListener("click", () => changeMonth(-1));
$("next-month").addEventListener("click", () => changeMonth(1));

// ---------- Pop-ups ----------

for (const button of document.querySelectorAll("[data-close]")) {
  button.addEventListener("click", () => button.closest("dialog").close());
}

// ---------- Add transaction pop-up ----------

const addDialog = $("add-dialog");
const addForm = $("add-form");
const amountEl = $("amount");
const currencyEl = $("currency");
const dateEl = $("date");
const noteEl = $("note");

function fillAddForm() {
  for (const [code, { symbol }] of Object.entries(CURRENCIES)) {
    currencyEl.add(new Option(`${symbol} ${code}`, code));
  }
  for (const g of GROUPS) {
    const group = el("div", "item-group");
    const buttons = el("div", "item-buttons");
    for (const c of CATEGORIES.filter((c) => c.group === g)) {
      buttons.append(choiceButton("item", c.name));
    }
    group.append(el("span", "item-group-label", g), buttons);
    $("item-choices").append(group);
  }
}

function hideAddErrors() {
  for (const id of ["item-error", "amount-error", "rate-error", "add-error"]) $(id).hidden = true;
}

function resetAddForm() {
  addForm.reset();
  currencyEl.value = DEFAULT_CURRENCY;
  dateEl.value = todayISO();
  hideAddErrors();
}

let editingId = null; // null = adding a new transaction

function setMode(id) {
  editingId = id;
  $("add-title").textContent = id ? "Edit transaction" : "Add transaction";
  $("delete-transaction").hidden = !id;
  toggleConfirm("delete-confirm", "form-actions", false);
}

$("open-add").addEventListener("click", () => {
  resetAddForm();
  setMode(null);
  addDialog.showModal();
});

function openEdit(id) {
  let expense;
  try {
    expense = loadExpenses().find((e) => e.id === id);
  } catch (err) {
    console.error(err);
  }
  if (!expense) return;

  resetAddForm();
  setMode(id);
  const radio = addForm.querySelector(`input[name="item"][value="${CSS.escape(expense.category)}"]`);
  if (radio) radio.checked = true;
  currencyEl.value = expense.currency;
  amountEl.value = formatWhileTyping(String(expense.amount), CURRENCIES[expense.currency].decimals);
  dateEl.value = expense.date;
  noteEl.value = expense.note || "";
  addDialog.showModal();
}

$("delete-transaction").addEventListener("click", () => {
  toggleConfirm("delete-confirm", "form-actions", true);
  $("delete-no").focus();
});

$("delete-no").addEventListener("click", () => {
  toggleConfirm("delete-confirm", "form-actions", false);
  $("delete-transaction").focus();
});

$("delete-yes").addEventListener("click", () => {
  if (!editingId) return;
  try {
    deleteExpense(editingId);
  } catch (err) {
    console.error(err);
    $("add-error").hidden = false;
    return;
  }
  addDialog.close();
  renderDashboard();
});

$("item-choices").addEventListener("change", () => ($("item-error").hidden = true));

amountEl.addEventListener("input", () => {
  amountEl.value = formatWhileTyping(amountEl.value, CURRENCIES[currencyEl.value].decimals);
  $("amount-error").hidden = true;
});

currencyEl.addEventListener("change", () => {
  amountEl.value = formatWhileTyping(amountEl.value, CURRENCIES[currencyEl.value].decimals);
  $("rate-error").hidden = true;
});

addForm.addEventListener("submit", (event) => {
  event.preventDefault();

  const checked = addForm.querySelector('input[name="item"]:checked');
  const currency = currencyEl.value;
  const amount = readAmount(amountEl.value, CURRENCIES[currency].decimals);

  let original = null;
  if (editingId) {
    try {
      original = loadExpenses().find((e) => e.id === editingId) || null;
    } catch (err) {
      console.error(err);
    }
    if (!original) {
      $("add-error").hidden = false;
      return;
    }
  }
  // An edit keeps its original rate unless the amount or currency changed
  const keepRate = original && original.rate && original.currency === currency && original.amount === amount;
  const rate = keepRate ? original.rate : rateFor(currency, loadRates());

  $("item-error").hidden = Boolean(checked);
  $("amount-error").hidden = amount > 0;
  $("rate-error-text").textContent = `No ${currency} rate yet. Set it in Settings.`;
  $("rate-error").hidden = Boolean(rate);
  $("add-error").hidden = true;
  if (!checked || !(amount > 0) || !rate) return;

  const category = CATEGORIES.find((c) => c.name === checked.value);
  const expense = {
    amount,
    currency,
    rate,
    lakAmount: Math.round(amount * rate),
    date: dateEl.value || todayISO(),
    category: category.name,
    group: category.group,
    note: noteEl.value.trim(),
  };

  try {
    if (original) {
      updateExpense(original.id, expense);
    } else {
      addExpense({ id: newId(), ...expense, createdAt: new Date().toISOString() });
    }
  } catch (err) {
    console.error(err);
    $("add-error").hidden = false;
    return;
  }

  addDialog.close();
  const [y, m] = expense.date.split("-").map(Number);
  viewYear = y;
  viewMonth = m - 1;
  renderDashboard();
});

// ---------- Settings page ----------

const rateInputs = { USD: $("rate-USD"), THB: $("rate-THB") };
let pendingRestore = null; // a checked backup waiting for "Yes, restore"

function showSettingsStatus(id, message, isProblem = false) {
  $(id).textContent = message;
  $(id).classList.toggle("is-problem", isProblem);
  $(id).hidden = false;
}

function showSettings(show) {
  $("settings-page").hidden = !show;
  $("main-page").hidden = show;
  $("tabbar").hidden = show;
  window.scrollTo(0, 0);
}

function fillRateInputs() {
  const rates = loadRates();
  for (const [code, input] of Object.entries(rateInputs)) {
    input.value = rates[code] ? formatWhileTyping(String(rates[code]), 2) : "";
  }
}

function openSettings() {
  fillRateInputs();
  for (const id of ["rates-error", "rates-status", "backup-status"]) $(id).hidden = true;
  cancelRestore();
  showSettings(true);
  history.pushState({ settings: true }, ""); // so the phone's Back gesture closes Settings
}

$("open-settings").addEventListener("click", openSettings);
$("close-settings").addEventListener("click", () => history.back());
window.addEventListener("popstate", () => {
  if ($("settings-page").hidden) return;
  showSettings(false);
  $("open-settings").focus();
});

// Exchange rates

for (const input of Object.values(rateInputs)) {
  input.addEventListener("input", () => {
    input.value = formatWhileTyping(input.value, 2);
    $("rates-error").hidden = true;
    $("rates-status").hidden = true;
  });
}

$("rates-form").addEventListener("submit", (event) => {
  event.preventDefault();
  const rates = {};
  for (const [code, input] of Object.entries(rateInputs)) {
    const value = readAmount(input.value, 2);
    if (!(value > 0)) {
      $("rates-error").hidden = false;
      $("rates-status").hidden = true;
      return;
    }
    rates[code] = value;
  }
  saveRates(rates);
  showSettingsStatus("rates-status", "Rates saved ✓");
  renderDashboard();
});

// Backup: one file with everything, shared through the phone's Share menu (or downloaded)

function makeBackup() {
  return {
    format: BACKUP_FORMAT,
    version: 1,
    build: BUILD.number,
    exportedAt: new Date().toISOString(),
    expenses: expenseStore.load(),
    savings: savingsStore.load(),
    rates: loadRates(),
  };
}

function backupSummary(backup) {
  const count = (n, word) => `${n} ${word}${n === 1 ? "" : "s"}`;
  return `${count(backup.expenses.length, "expense")} · ${count(backup.savings.length, "saving")}`;
}

$("backup-btn").addEventListener("click", async () => {
  $("backup-status").hidden = true;
  let backup;
  try {
    backup = makeBackup();
  } catch (err) {
    console.error(err);
    showSettingsStatus("backup-status", "Your saved data couldn't be read, so no backup was made.", true);
    return;
  }

  const name = `my-journal-backup-${todayISO()}.json`;
  const file = new File([JSON.stringify(backup, null, 2)], name, { type: "application/json" });

  if (navigator.canShare && navigator.canShare({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: "My Journal backup" });
      showSettingsStatus("backup-status", `Backup shared ✓ (${backupSummary(backup)})`);
      return;
    } catch (err) {
      if (err.name === "AbortError") {
        showSettingsStatus("backup-status", "Backup cancelled.");
        return;
      }
      console.error(err); // sharing failed: fall back to saving the file
    }
  }

  const url = URL.createObjectURL(file);
  const link = el("a");
  link.href = url;
  link.download = name;
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
  showSettingsStatus("backup-status", `Backup saved to Downloads ✓ (${backupSummary(backup)})`);
});

// Restore: check the file, show what's in it, then replace everything after "Yes, restore"

function checkBackup(backup) {
  if (!backup || backup.format !== BACKUP_FORMAT || !Array.isArray(backup.expenses) || !Array.isArray(backup.savings)) {
    throw new Error("Not a My Journal backup");
  }
  const isEntry = (e) => e && typeof e.id === "string" && typeof e.amount === "number" && typeof e.date === "string";
  if (!backup.expenses.every(isEntry) || !backup.savings.every(isEntry)) {
    throw new Error("Backup has damaged entries");
  }
  return backup;
}

function cancelRestore() {
  pendingRestore = null;
  toggleConfirm("restore-confirm", "backup-actions", false);
}

$("restore-btn").addEventListener("click", () => {
  $("restore-file").value = "";
  $("restore-file").click();
});

$("restore-file").addEventListener("change", async () => {
  const file = $("restore-file").files[0];
  if (!file) return;
  $("backup-status").hidden = true;
  try {
    pendingRestore = checkBackup(JSON.parse(await file.text()));
  } catch (err) {
    console.error(err);
    cancelRestore();
    showSettingsStatus("backup-status", "This file isn't a My Journal backup, so nothing was changed.", true);
    return;
  }
  const when = pendingRestore.exportedAt ? shortDate(pendingRestore.exportedAt.slice(0, 10), true) : "an unknown date";
  $("restore-summary").textContent = `Restore the backup from ${when}?`;
  toggleConfirm("restore-confirm", "backup-actions", true);
  $("restore-no").focus();
});

$("restore-no").addEventListener("click", () => {
  cancelRestore();
  $("restore-btn").focus();
});

$("restore-yes").addEventListener("click", () => {
  if (!pendingRestore) return;
  const backup = pendingRestore;
  const keys = [STORAGE_KEY, SAVINGS_KEY, RATES_KEY];
  const before = keys.map((key) => localStorage.getItem(key));
  try {
    expenseStore.save(backup.expenses);
    savingsStore.save(backup.savings);
    if (backup.rates) saveRates({ ...DEFAULT_RATES, ...backup.rates });
  } catch (err) {
    console.error(err);
    // Put everything back the way it was
    keys.forEach((key, i) => (before[i] === null ? localStorage.removeItem(key) : localStorage.setItem(key, before[i])));
    cancelRestore();
    showSettingsStatus("backup-status", "Restore failed, so your data wasn't changed.", true);
    return;
  }
  cancelRestore();
  renderDashboard();
  renderSavings();
  fillRateInputs();
  showSettingsStatus("backup-status", `Restored ✓ (${backupSummary(backup)})`);
});

// ---------- Savings tab ----------

function renderSavings() {
  let all = [];
  let loadProblem = false;
  try {
    all = savingsStore.load();
  } catch (err) {
    console.error(err);
    loadProblem = true;
  }

  const total = all.reduce((sum, s) => sum + s.amount, 0);
  $("savings-total").textContent = formatMoney(total, "USD");

  $("goals").replaceChildren(
    ...GOALS.map((g) => {
      const saved = all.filter((s) => s.goal === g.name).reduce((sum, s) => sum + s.amount, 0);
      const card = el("div", "goal");
      card.append(
        el("div", "goal-name", g.name),
        el("div", "", `${formatMoney(saved, "USD")} / ${formatMoney(g.target, "USD")}`)
      );
      const bar = el("div", "bar");
      bar.setAttribute("role", "progressbar");
      bar.setAttribute("aria-label", `${g.name} progress`);
      bar.setAttribute("aria-valuemin", "0");
      bar.setAttribute("aria-valuemax", String(g.target));
      bar.setAttribute("aria-valuenow", String(Math.min(saved, g.target)));
      const fill = el("div", "bar-fill");
      fill.style.width = `${Math.min(100, g.target ? (saved / g.target) * 100 : 0)}%`;
      bar.append(fill);
      card.append(bar, el("div", "small", `${formatMoney(g.monthly, "USD")} a month`));
      return card;
    })
  );

  sortedSavings = [...all].sort((a, b) => b.date.localeCompare(a.date) || (b.createdAt || "").localeCompare(a.createdAt || ""));
  $("saving-log").replaceChildren(...sortedSavings.slice(0, RECENT_LOG_COUNT).map(savingRow));
  $("open-saving-log").hidden = sortedSavings.length <= RECENT_LOG_COUNT;
  $("saving-log-empty").textContent = loadProblem ? "Your saved savings couldn't be read." : "No savings yet.";
  $("saving-log-empty").hidden = sortedSavings.length > 0;
  renderFullSavingLog();
}

function savingRow(s) {
  const row = el("button", "log-row with-year");
  row.type = "button";
  const goal = el("span", "log-item");
  goal.append(el("span", "", s.goal));
  if (s.note) goal.append(el("span", "small", s.note));
  row.append(el("span", "log-date", shortDate(s.date, true)), goal, el("span", "log-amount", formatMoney(s.amount, "USD")));
  row.addEventListener("click", () => openSavingEdit(s.id));
  const li = el("li");
  li.append(row);
  return li;
}

// ---------- Full saving log pop-up (10 per page, fits the phone screen without scrolling) ----------

const RECENT_LOG_COUNT = 5;
const LOG_PAGE_SIZE = 10;
let sortedSavings = [];
let logPage = 0; // 0 = first page

function renderFullSavingLog() {
  const count = sortedSavings.length;
  const pages = Math.max(1, Math.ceil(count / LOG_PAGE_SIZE));
  logPage = Math.min(Math.max(logPage, 0), pages - 1);
  const start = logPage * LOG_PAGE_SIZE;
  const pageRows = sortedSavings.slice(start, start + LOG_PAGE_SIZE);

  $("saving-log-full").replaceChildren(...pageRows.map(savingRow));
  $("saving-log-range").textContent = count
    ? `${start + 1}–${start + pageRows.length} of ${count}`
    : "No savings yet.";
  $("log-page-label").textContent = `Page ${logPage + 1} of ${pages}`;
  $("log-prev").disabled = logPage === 0;
  $("log-next").disabled = logPage >= pages - 1;
}

function changeLogPage(delta) {
  logPage += delta;
  renderFullSavingLog();
  $("saving-log-dialog").scrollTop = 0;
}

$("open-saving-log").addEventListener("click", () => {
  logPage = 0;
  renderFullSavingLog();
  $("saving-log-dialog").showModal();
  $("saving-log-dialog").scrollTop = 0;
});
$("log-prev").addEventListener("click", () => changeLogPage(-1));
$("log-next").addEventListener("click", () => changeLogPage(1));

// ---------- Add / Edit saving pop-up ----------

const savingDialog = $("saving-dialog");
const savingForm = $("saving-form");
const savingAmountEl = $("saving-amount");
const savingDateEl = $("saving-date");
const savingNoteEl = $("saving-note");

let editingSavingId = null; // null = adding a new saving

function fillSavingForm() {
  for (const g of GOALS) $("goal-choices").append(choiceButton("goal", g.name));
}

function resetSavingForm() {
  savingForm.reset();
  savingDateEl.value = todayISO();
  for (const id of ["goal-error", "saving-amount-error", "saving-error"]) $(id).hidden = true;
}

function setSavingMode(id) {
  editingSavingId = id;
  $("saving-title").textContent = id ? "Edit saving" : "Add saving";
  $("delete-saving").hidden = !id;
  toggleConfirm("saving-delete-confirm", "saving-form-actions", false);
}

$("open-saving").addEventListener("click", () => {
  resetSavingForm();
  setSavingMode(null);
  savingDialog.showModal();
});

function openSavingEdit(id) {
  let saving;
  try {
    saving = savingsStore.load().find((s) => s.id === id);
  } catch (err) {
    console.error(err);
  }
  if (!saving) return;

  resetSavingForm();
  setSavingMode(id);
  const radio = savingForm.querySelector(`input[name="goal"][value="${CSS.escape(saving.goal)}"]`);
  if (radio) radio.checked = true;
  savingAmountEl.value = formatWhileTyping(String(saving.amount), 2);
  savingDateEl.value = saving.date;
  savingNoteEl.value = saving.note || "";
  savingDialog.showModal();
}

$("delete-saving").addEventListener("click", () => {
  toggleConfirm("saving-delete-confirm", "saving-form-actions", true);
  $("saving-delete-no").focus();
});

$("saving-delete-no").addEventListener("click", () => {
  toggleConfirm("saving-delete-confirm", "saving-form-actions", false);
  $("delete-saving").focus();
});

$("saving-delete-yes").addEventListener("click", () => {
  if (!editingSavingId) return;
  try {
    savingsStore.remove(editingSavingId);
  } catch (err) {
    console.error(err);
    $("saving-error").hidden = false;
    return;
  }
  savingDialog.close();
  renderSavings();
});

$("goal-choices").addEventListener("change", () => ($("goal-error").hidden = true));

savingAmountEl.addEventListener("input", () => {
  savingAmountEl.value = formatWhileTyping(savingAmountEl.value, 2);
  $("saving-amount-error").hidden = true;
});

savingForm.addEventListener("submit", (event) => {
  event.preventDefault();

  const checked = savingForm.querySelector('input[name="goal"]:checked');
  const amount = readAmount(savingAmountEl.value, 2);
  $("goal-error").hidden = Boolean(checked);
  $("saving-amount-error").hidden = amount > 0;
  $("saving-error").hidden = true;
  if (!checked || !(amount > 0)) return;

  const saving = {
    goal: checked.value,
    amount,
    date: savingDateEl.value || todayISO(),
    note: savingNoteEl.value.trim(),
  };

  try {
    if (editingSavingId) {
      savingsStore.update(editingSavingId, saving);
    } else {
      savingsStore.add({ id: newId(), ...saving, createdAt: new Date().toISOString() });
    }
  } catch (err) {
    console.error(err);
    $("saving-error").hidden = false;
    return;
  }

  savingDialog.close();
  renderSavings();
});

// ---------- Tabs ----------

function showTab(name) {
  for (const tab of ["expenses", "savings"]) {
    const selected = tab === name;
    $(`tab-${tab}`).setAttribute("aria-selected", String(selected));
    $(`panel-${tab}`).hidden = !selected;
  }
  try {
    localStorage.setItem(TAB_KEY, name);
  } catch {}
  window.scrollTo(0, 0);
}

$("tab-expenses").addEventListener("click", () => showTab("expenses"));
$("tab-savings").addEventListener("click", () => showTab("savings"));

// ---------- Start ----------

fillAddForm();
fillSavingForm();
renderDashboard();
renderSavings();
$("build-info").textContent = `My Journal · Build ${BUILD.number} · ${shortDate(BUILD.date, true)}`;

let startTab = "expenses";
try {
  if (localStorage.getItem(TAB_KEY) === "savings") startTab = "savings";
} catch {}
showTab(startTab);

// Lets the app open without internet once it's been added to the home screen
if ("serviceWorker" in navigator && location.protocol !== "file:") {
  navigator.serviceWorker.register("sw.js");
}
