// ---------- Settings (easy to change later) ----------

// Expense categories from MyMoney_Simple2026.xlsx (Settings sheet)
const CATEGORIES = [
  { name: "Car loan", group: "Need" },
  { name: "Family", group: "Need" },
  { name: "Family rent", group: "Need" },
  { name: "Personal want", group: "Want" },
  { name: "Travel & Tourism", group: "Want" },
];
const GROUPS = ["Need", "Want"];

// Build 23: income. Both lists live here, like the expense items — changed by asking for a build.
// An entry stores the NAMES, as an expense stores its item: safe because a code-only list can only
// be renamed in a build, where the rename and its data are handled together. If these are ever made
// editable in the app, entries must move to ids FIRST — that is the mistake Build 21 had to undo for
// savings, which pointed at goals by name and needed a migration.
// The sources are deliberately not employers: the repository is public, so real names would say
// where you work. "Full-time / Part-time" carries the same meaning without that.
// Build 25.1: "Bonus" removed at your request — you had never used it. An entry saved under a
// category that later leaves this list still gets its own row (see renderIncome), so removing one
// can no longer hide money.
const INCOME_CATEGORIES = ["Salary", "Side job", "Per diem", "Other"];
const INCOME_SOURCES = ["Full-time", "Part-time", "Other"];

const CURRENCIES = {
  LAK: { symbol: "₭", decimals: 0 },
  THB: { symbol: "฿", decimals: 2 },
  USD: { symbol: "$", decimals: 2 },
};
const DEFAULT_CURRENCY = "LAK";

const STORAGE_KEY = "myjournal.expenses";
const RATES_KEY = "myjournal.rates";
const DEFAULT_RATES = { USD: 22500, THB: 690 }; // LAK per 1 unit

// Build 21: your goals now live in storage and you edit them in the app. This list is only the
// seed used the very first time, and the names it carries are matched to existing savings once.
// Build 23.1: the names and amounts are deliberately generic placeholders — the repository is
// public, so your real goals and the money behind them would be readable by anyone. You rename
// them in the app on first run; your own goals live in storage and in your backups, never here.
const SEED_GOALS = [
  { name: "Goal one", target: 1000, monthly: 50 },
  { name: "Goal two", target: 2000, monthly: 100 },
  { name: "Goal three", target: 5000, monthly: 200 },
];
const SAVINGS_KEY = "myjournal.savings";
const GOALS_KEY = "myjournal.goals";
const BOOKS_KEY = "myjournal.books";
const INCOME_KEY = "myjournal.income";
// Build 23.4: the edit history. Written only by update() and remove() on the three money
// stores, plus one entry by a restore. Nothing in the app shows it — you read it in the backup.
const CHANGES_KEY = "myjournal.changes";
const DEBT_KEY = "myjournal.debt";
const TAB_KEY = "myjournal.tab";

// Shown in Settings → Build info. Update with every build.
// Build 23.5: version.json on the site must say the same number — that is how the app knows a new
// build is live. The publish script writes both together, so never change one of them by hand.
const BUILD = { number: "27.3", date: "2026-11-14" };
const BACKUP_FORMAT = "my-journal-backup";

// Daily message lines from your Daily quotes.docx (encouragements, reminders, questions)
const DAILY_LINES = [
  "Start the day with a cup of coffee.",
  "Don’t forget to love yourself.",
  "It’s OK not to be OK.",
  "Be kind to myself.",
  "Thanks to myself for coming this far.",
  "Progress, not perfection.",
  "Be healthy, be happy!",
  "Make today an adventure quest!",
  "Just don’t give a damn sometimes.",
  "Stay strong and focus on this moment.",
  "I’m cute and I know it!",
  "Keep calm, the day is starting!",
  "Coffee first, work later.",
  "Go to bed early today!",
  "Be active, no more resting!",
  "Beware of doomscrolling!",
  "It’s stretching day!",
  "No-sugar day!",
  "What do I need to give myself more of today?",
  "What can I let go of today?",
  "What matters most to me right now?",
  "Am I happy with how I’m spending my time?",
  "What is taking up too much of my energy?",
  "What am I avoiding?",
  "What am I worried about?",
  "What am I proud of?",
  "What have I learned recently?",
  "What do I want more of in my life?",
  "What do I want less of?",
  "What kind of person do I want to become?",
  "I’m only human",
  "Watching for the bump",
  "Bankai! Senbonzakura Kageyoshi~",
  "Gomu Gomu no Jet Pistol",
  "Brace yourself, winter is coming",
  "You know nothing, Jon Snow",
  "Oops, I did it again",
  "One more episode, really?",
  "Work hard, meow harder!",
  "Relax, it’s resting time",
  "Stay away from dehydration",
  "You too can become a hero",
  "I’m gonna be the Pirate King!",
  "Time to write something",
  "Get ready and GO!",
  "I love my JOB!",
  "More water pleaseee",
  "Stay tuned, reading time!",
  "What’s on my mind today?",
  "That’s my ninja way!",
];
const DAILY_KEY = "myjournal.daily";


// ---------- Saving on this device ----------

// Build 23.4: the fields YOU typed that actually changed, as { field: [before, after] }, or null
// when none did. Derived values (rate, lakAmount, group) and updatedAt are never in `fields`,
// so an amount edit records the amount alone and not the arithmetic that followed it.
function typedChanges(before, changes, fields) {
  const diff = {};
  let any = false;
  for (const field of fields) {
    if (!(field in changes) || changes[field] === before[field]) continue;
    diff[field] = [before[field], changes[field]];
    any = true;
  }
  return any ? diff : null;
}

// One list of entries under one storage key (used for expenses and savings)
// Build 23.4: `log` is optional. With it, update() and remove() record to the edit history;
// without it the store behaves exactly as it did before. save() never logs, so a restore and
// the Build 21 goal migration stay silent.
function makeStore(key, log) {
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
      const before = list[index];
      list[index] = { ...before, ...changes, updatedAt: new Date().toISOString() };
      save(list);
      // After the save, never before: a log that fails must not cost you the edit.
      if (log) {
        const diff = typedChanges(before, changes, log.fields);
        if (diff) {
          appendChange({ at: new Date().toISOString(), list: log.list, item: id,
            what: "edit", label: log.label(before), changes: diff });
        }
      }
    },
    remove(id) {
      const list = load();
      const record = list.find((e) => e.id === id);
      save(list.filter((e) => e.id !== id));
      // The whole record, not a diff: a deletion has no "after" to compare against.
      if (log && record) {
        appendChange({ at: new Date().toISOString(), list: log.list, item: id,
          what: "delete", label: log.label(record), was: record });
      }
    },
  };
}

// Build 23.4: the edit history list. Unlike a money store this NEVER throws — a damaged log is
// not your data, so it must not take a page down with it.
function loadChanges() {
  try {
    const list = JSON.parse(localStorage.getItem(CHANGES_KEY) || "[]");
    return Array.isArray(list) ? list : [];
  } catch {
    return [];
  }
}

// A failed log is swallowed on purpose: the save it describes has already happened, and must
// never be undone because the history couldn't be written.
function appendChange(entry) {
  try {
    const list = loadChanges();
    list.push(entry);
    localStorage.setItem(CHANGES_KEY, JSON.stringify(list));
  } catch (err) {
    console.error(err);
  }
}

// Build 23.4: only these three log. The label is what the entry WAS at the time of the change,
// so the history reads on its own even after the entry is edited again or deleted.
const expenseStore = makeStore(STORAGE_KEY, {
  list: "expenses",
  fields: ["amount", "currency", "date", "category", "note"],
  label: (e) => `${e.category || "(no item)"} ${formatMoney(e.lakAmount || 0, "LAK")}`,
});
const savingsStore = makeStore(SAVINGS_KEY, {
  list: "savings",
  fields: ["goalId", "amount", "date", "note"],
  label: (e) => `${goalName(e.goalId) || "(no goal)"} ${formatMoney(e.amount || 0, "USD")}`,
});
const goalStore = makeStore(GOALS_KEY);
const bookStore = makeStore(BOOKS_KEY);
const incomeStore = makeStore(INCOME_KEY, {
  list: "income",
  fields: ["category", "source", "amount", "currency", "date", "note"],
  label: (e) => `${e.category || "(no kind)"} ${formatMoney(e.amount || 0, e.currency || "LAK")}`,
});

// Build 22: a book is { id, title, status, page, total, finishedAt, addedAt }.
// status is "want" | "reading" | "read". page and total are 0 when unknown — a book with no
// total still reads fine, it just shows no numbers and no bar.
const BOOK_STATUSES = [
  { value: "want", label: "Want" },
  { value: "reading", label: "Reading" },
  { value: "read", label: "Read" },
];
function loadBooks() {
  try {
    return bookStore.load();
  } catch (err) {
    console.error(err);
    return null;   // null means "couldn't be read", which the page says out loud
  }
}

// Build 21: a goal is { id, name, target, monthly, hidden }. Savings point at the id, never the
// name, so renaming a goal can't orphan the money saved under it.
function loadGoals() {
  try {
    return goalStore.load();
  } catch (err) {
    console.error(err);
    return [];
  }
}
function visibleGoals() {
  return loadGoals().filter((g) => !g.hidden);
}
function goalById(id) {
  return loadGoals().find((g) => g.id === id);
}
function goalName(id) {
  const g = goalById(id);
  return g ? g.name : "";
}
function savedForGoal(id, savings) {
  return savings.filter((s) => s.goalId === id).reduce((sum, s) => sum + s.amount, 0);
}

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

// ---------- The Car loan bar (Build 27) ----------
// How far through paying off the car loan you are, under the Car loan row on the Expenses tab.
//
// NOTHING ABOUT THIS DEBT IS IN THE CODE. The repository is public, and the size of your car loan
// is exactly the kind of personal fact Builds 23.1 and 26.1 took out of it. You type the target in;
// the app only ever reads it from your own data, and it rides in the backup like your goals do.
const DEBT_ITEM = "Car loan";     // the expense item the bar follows — one of CATEGORIES

function loadDebt() {
  try {
    const d = JSON.parse(localStorage.getItem(DEBT_KEY) || "{}");
    return {
      target: Number(d.target) || 0,
      paidBefore: Number(d.paidBefore) || 0,
    };
  } catch {
    return { target: 0, paidBefore: 0 };
  }
}

function saveDebt(debt) {
  localStorage.setItem(DEBT_KEY, JSON.stringify(debt));
}

// The row under Car loan. It is built from ALL expenses, never from the month on screen: a debt is
// cumulative, and a bar fed the month's own list would drop back to nothing every 1st of the month
// and climb again — the exact opposite of what it is for.
function debtBar(allExpenses, rates) {
  const { target } = loadDebt();
  const li = el("li", "debt");
  const btn = el("button", "debt-btn");
  btn.type = "button";

  if (!target) {
    // Nothing is set yet, so there is no bar to draw — but there still has to be something to tap.
    btn.append(el("span", "debt-set", "Set a target"));
    btn.setAttribute("aria-label", "Set a car loan target");
  } else {
    const paid = debtPaid(allExpenses, rates);
    const pct = Math.round((paid / target) * 100);
    const bar = el("span", "debt-bar");
    const fill = el("span", "");
    fill.style.width = `${Math.min(100, Math.max(0, pct))}%`;   // the bar stops at full; the number doesn't
    bar.append(fill);
    const line = el("span", "debt-line");
    line.append(bar);
    btn.append(
      line,
      el("span", "debt-pct", `${pct}%`),
      el("span", "debt-sub", `${formatWhole(paid, "USD")} of ${formatWhole(target, "USD")}`)
    );
    btn.setAttribute("aria-label", `Car loan, ${pct} percent paid. Edit.`);
  }

  btn.addEventListener("click", openDebt);
  li.append(btn);
  return li;
}

// What you have paid, in dollars, from EVERY Car loan payment ever — not just this month.
// A payment entered in dollars counts at face value. One entered in kip or baht is converted at
// today’s dollar rate, because an expense freezes its rate against KIP, not against USD, so there
// is no frozen dollar figure to use. Those payments will drift a little as the rate moves.
function debtPaid(allExpenses, rates) {
  const usdRate = rateFor("USD", rates);
  let paid = loadDebt().paidBefore;
  for (const e of allExpenses) {
    if (e.category !== DEBT_ITEM) continue;
    if (e.currency === "USD") paid += Number(e.amount) || 0;
    else if (usdRate) paid += lakAmountOf(e, rates) / usdRate;
  }
  return paid;
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

// Build 12.3: the cover screen shows the same numbers more tightly
const COVER_SCREEN = window.matchMedia("(min-aspect-ratio: 3 / 4) and (min-width: 500px)");
function onCoverScreen() {
  return COVER_SCREEN.matches;
}

// Build 23.1: a currency the app doesn't know (a hand-edited backup, or one it no longer carries)
// used to stop the screen drawing. It now falls back to the normal currency instead.
function currencyInfo(currency) {
  return CURRENCIES[currency] || CURRENCIES[DEFAULT_CURRENCY];
}

// Whole amounts, no decimals: "$1,200 of $2,000" as the design writes them
// Build 27.1: the minus goes BEFORE the symbol — "-$200", not "$-200". Nothing in the app could
// be negative until savings could be taken out, so this had never shown up.
function formatWhole(amount, currency) {
  const { symbol } = currencyInfo(currency);
  const sign = amount < 0 ? "-" : "";
  return sign + symbol + Math.round(Math.abs(amount)).toLocaleString("en-US");
}

// Build 16.4: cents only when there are cents, so savings read $50 but $50.75 keeps its pennies
function formatMoney(amount, currency) {
  const { symbol, decimals } = currencyInfo(currency);
  const places = Number.isInteger(amount) ? 0 : decimals;
  const sign = amount < 0 ? "-" : "";          // Build 27.1: "-$200", not "$-200"
  return sign + symbol + Math.abs(amount).toLocaleString("en-US", {
    minimumFractionDigits: places,
    maximumFractionDigits: places,
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
function choiceButton(name, value, text = value) {
  const label = el("label", "item-btn");
  const input = document.createElement("input");
  input.type = "radio";
  input.name = name;
  input.value = value;
  label.append(input, el("span", "", text));
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
  const li = el("li", amount ? "row" : "row is-zero");   // Build 16: nothing spent this month reads quieter
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

  const monthDate = new Date(viewYear, viewMonth, 1);
  $("month-label").textContent = onCoverScreen()
    ? `${monthDate.toLocaleDateString("en-US", { month: "short" })} ${viewYear}`   // "Sep 2026"
    : monthDate.toLocaleDateString("en-GB", { month: "long", year: "numeric" });
  $("total").textContent = formatMoney(total, "LAK");

  // Build 12: Need and Want are headings with their own totals, their items underneath
  // Build 23.3: an item the app doesn't recognise belongs to no group, so before this it dropped
  // out of the breakdown entirely while still counting in the month total — the money was there but
  // invisible. It can arrive from a backup made before an item was renamed. Each unknown name now
  // gets its own row under "Other", so Need + Want + Other always equals the total on screen.
  const unknownNames = [...new Set(
    items.filter((e) => !CATEGORIES.some((c) => c.name === e.category)).map((e) => e.category)
  )];

  $("by-category").replaceChildren(
    ...GROUPS.flatMap((g) => {
      const head = el("div", "cat-head");
      head.append(el("span", `cat-name is-${g.toLowerCase()}`, g), el("span", "row-amount", formatMoney(sumWhere((e) => groupOf(e) === g), "LAK")));
      const list = el("ul", "cat-list");
      for (const c of CATEGORIES.filter((c) => c.group === g)) {
        const row = summaryRow(c.name, sumWhere((e) => e.category === c.name));
        list.append(row);
        // Build 27: the debt bar hangs under its own row. `all`, not `items` — see debtBar.
        if (c.name === DEBT_ITEM) {
          row.classList.add("has-debt");
          list.append(debtBar(all, rates));
        }
      }
      return [head, list];
    }),
    ...(unknownNames.length ? (() => {          // only ever appears when there is such money
      const head = el("div", "cat-head");
      head.append(
        el("span", "cat-name is-other", "Other"),
        el("span", "row-amount", formatMoney(sumWhere((e) => unknownNames.includes(e.category)), "LAK"))
      );
      const list = el("ul", "cat-list");
      for (const name of unknownNames) {
        list.append(summaryRow(name || "(no item)", sumWhere((e) => e.category === name)));
      }
      return [head, list];
    })() : [])
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
  renderIncome();   // Build 23: Expenses and Income share the month, so both follow the arrows
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

// ---------- Build 16.3: the ×1000 chip ----------
// LAK amounts are long, so the chip adds the three zeros for you. Nothing is multiplied unless
// it is lit, and the result is shown beside it before you save.

const THOUSANDS_KEY = "myjournal.x1000";   // kept on the phone only, never in a backup
let thousandsRemembered = localStorage.getItem(THOUSANDS_KEY) === "on";   // what you last chose
let thousandsOn = thousandsRemembered;                                    // the sheet that is open now

function thousandsApplies() {
  return currencyEl.value === DEFAULT_CURRENCY;   // LAK only
}

function showThousandsChip() {
  const chip = $("amount-x1000");
  const preview = $("amount-preview");
  const applies = thousandsApplies();
  chip.hidden = !applies;
  chip.setAttribute("aria-pressed", String(thousandsOn));
  const typed = readAmount(amountEl.value, 0);
  const show = applies && thousandsOn && typed > 0;
  preview.hidden = !show;
  if (show) preview.textContent = `= ${formatMoney(typed * 1000, DEFAULT_CURRENCY)}`;
}

$("amount-x1000").addEventListener("click", () => {
  thousandsOn = !thousandsOn;
  thousandsRemembered = thousandsOn;                                      // remembered for the next one
  localStorage.setItem(THOUSANDS_KEY, thousandsOn ? "on" : "off");
  showThousandsChip();
  amountEl.focus();
});

function resetAddForm() {
  addForm.reset();
  currencyEl.value = DEFAULT_CURRENCY;
  dateEl.value = todayISO();
  hideAddErrors();
  thousandsOn = thousandsRemembered;      // a new transaction starts the way you left it
  showThousandsChip();
}

let editingId = null; // null = adding a new transaction

function setMode(id) {
  editingId = id;
  $("add-title").textContent = id ? "Edit transaction" : "Add transaction";
  $("delete-transaction").hidden = !id;
  toggleConfirm("delete-confirm", "form-actions", false);
}

// Build 16: the + slides away while you scroll down the log, so it never covers an amount,
// and comes back as soon as you stop or scroll up.
let lastScrollY = 0;
let fabTimer;

function watchScrollForFab(fab) {
  const y = Math.max(0, window.scrollY);
  const goingDown = y > lastScrollY + 4;
  const goingUp = y < lastScrollY - 4;
  if (goingDown && y > 24) fab.classList.add("is-away");
  else if (goingUp || y <= 24) fab.classList.remove("is-away");
  lastScrollY = y;
  clearTimeout(fabTimer);
  fabTimer = setTimeout(() => fab.classList.remove("is-away"), 600);   // stopped scrolling: bring it back
}

// Build 16.7: My Diary's ✎ does the same, so both floating buttons behave alike
window.addEventListener("scroll", () => {
  const fab = !$("money-page").hidden ? $("open-add")
            : !$("diary-page").hidden ? $("diary-new")
            : null;
  if (fab) watchScrollForFab(fab);
}, { passive: true });

$("open-add").addEventListener("click", () => {
  if (!$("panel-savings").hidden) {   // Build 12.2: the same + adds a saving on the Savings tab
    openAddSaving();
    return;
  }
  if (!$("panel-income").hidden) {    // Build 23: and an income on the Income tab
    openAddIncome();
    return;
  }
  resetAddForm();
  setMode(null);
  applyDateControls();
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
  amountEl.value = formatWhileTyping(String(expense.amount), currencyInfo(expense.currency).decimals);
  dateEl.value = expense.date;
  noteEl.value = expense.note || "";
  thousandsOn = false;              // an edit shows the amount as saved, so it can never multiply twice
  showThousandsChip();               // and this doesn't disturb what you last chose for new ones
  applyDateControls();
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

$("item-choices").addEventListener("change", () => {
  $("item-error").hidden = true;
  // Build 16.2: item, then amount — the order you always use, so the cursor goes there for you
  if ($("add-dialog").open) $("amount").focus();
});

amountEl.addEventListener("input", () => {
  amountEl.value = formatWhileTyping(amountEl.value, currencyInfo(currencyEl.value).decimals);
  $("amount-error").hidden = true;
  showThousandsChip();
});

currencyEl.addEventListener("change", () => {
  amountEl.value = formatWhileTyping(amountEl.value, currencyInfo(currencyEl.value).decimals);
  $("rate-error").hidden = true;
  showThousandsChip();
});

addForm.addEventListener("submit", (event) => {
  event.preventDefault();

  const checked = addForm.querySelector('input[name="item"]:checked');
  const currency = currencyEl.value;
  const typed = readAmount(amountEl.value, currencyInfo(currency).decimals);
  const amount = thousandsOn && currency === DEFAULT_CURRENCY ? typed * 1000 : typed;   // Build 16.3

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

// ---------- My Skin cycle (the My Skin page itself arrives in Build 7) ----------

// Build 24.10: the jar fills. All six are palette colours the app already carries, and ink
// reads 4.89:1 or better on every one of them, so the percentage inside stays ink throughout.
let jarClipSeq = 0;   // Build 26.1: one unique clipPath id per jar drawn
const JAR_FILLS = ["var(--swipe)", "var(--sand)", "var(--need)", "var(--want)", "var(--wisteria)", "var(--rosewood)"];

// Build 25: the routine changed, and the history is NOT rewritten. A done night stores only its
// date, so the night's name is worked out from the date every time — without a start date, changing
// the cycle would silently relabel every night you have already marked. So there are two eras, and
// a date is read against whichever one it falls in. Same principle as a transaction keeping the
// rate it was saved with.
const SKIN_ERAS = [
  {
    // Up to 31 Oct 2026. Kept exactly as it was, so September and October still say what you did.
    from: "0000-01-01",
    cycle: ["Exfoliate", "Retinol", "Recovery 1", "Recovery 2"],
    letters: ["E", "R", "M", "M"],
    anchor: { date: "2026-09-15", night: 1 },   // 15 Sep 2026 = Retinol
    products: [[], [], [], []],                 // the old era never had products
  },
  {
    // From 1 Nov 2026. No exfoliation; Hydration takes night 2.
    from: "2026-11-01",
    cycle: ["Retinol", "Hydration", "Recovery 1", "Recovery 2"],
    letters: ["R", "H", "M", "M"],
    anchor: { date: "2026-11-01", night: 0 },   // 1 Nov 2026 = Retinol, night 1 of the cycle
    // No cleanser anywhere, your decision: you wash your face every night, so this lists only
    // what changes. Recovery 1 and 2 share one product and keep their numbers — the number says
    // where you are in the cycle, not what you put on.
    products: [
      ["CeraVe Resurfacing Retinol", "Srichand Barrier Boost Serum"],
      ["The Ordinary Hyaluronic Acid", "Clear Nose Gel Cream"],
      ["Clear Nose Gel Cream"],
      ["Clear Nose Gel Cream"],
    ],
  },
];

// The first day the routine was tracked at all — the calendar refuses taps before it.
const SKIN_TRACKED_FROM = SKIN_ERAS[0].anchor.date;

function skinEraFor(dateISO) {
  let era = SKIN_ERAS[0];
  for (const e of SKIN_ERAS) if (dateISO >= e.from) era = e;
  return era;
}

// Build 24.2: a drawing per night, four nights and three drawings, because Recovery 1 and 2 are
// the same jar on two nights. The tonight card shows WHAT TONIGHT IS before the word does. No
// decoration on any of the three: the tape on the Home sticky note is the app's only ornament.
// Build 25: the drawings are indexed by SLOT, and the two eras use the slots differently — the
// old exfoliant bottle is reused for Hydration (your choice over drawing a new dropper), so the
// same three drawings cover both routines.
const SKIN_BOTTLES = [
  // Bottle — wide overlapping cap, a drop, a label. Exfoliate in the old era, Hydration in the new.
  '<rect x="10" y="2" width="16" height="9" rx="1.6"/><path d="M10 6.4h16"/>' +
  '<path d="M14.6 11v2M21.4 11v2"/><rect x="7" y="13" width="22" height="40" rx="2.4"/>' +
  '<path d="M18 17c1.7 1.9 2.5 3.1 2.5 4.1a2.5 2.5 0 0 1-5 0c0-1 .8-2.2 2.5-4.1z"/>' +
  '<path d="M11 27h14M11 32h14M11 37h14"/><path d="M11 44h6"/>',
  // Retinol — a pump bottle: head, collar, full-height label
  '<rect x="14" y="2" width="8" height="5" rx="1.6"/><path d="M18 2.8v3.4"/>' +
  '<rect x="16" y="7" width="4" height="3"/><rect x="12.5" y="10" width="11" height="5" rx="1.2"/>' +
  '<rect x="8.5" y="15" width="19" height="38" rx="2.6"/><rect x="11.5" y="20" width="13" height="25" rx="1.6"/>' +
  '<path d="M11.5 48.5h13"/>',
  // Moisturiser — a closed jar, lid overhanging the body. Both recovery nights.
  '<rect x="2.5" y="14" width="31" height="8" rx="2"/>' +
  '<path d="M4.5 22h27v20a5 5 0 0 1-5 5H9.5a5 5 0 0 1-5-5z"/>' +
  '<rect x="10" y="28" width="16" height="9" rx="2"/>',
];
SKIN_BOTTLES.push(SKIN_BOTTLES[2]);   // Recovery 2 shares Recovery 1's jar

// Which drawing each night of each era uses. Old: bottle, pump, jar, jar. New: pump, bottle, jar, jar.
const SKIN_DRAWING_SLOTS = {
  "Exfoliate": 0, "Hydration": 0,     // the bottle
  "Retinol": 1,                       // the pump
  "Recovery 1": 2, "Recovery 2": 3,   // the jar, twice
};

function skinBottleFor(dateISO) {
  const slot = SKIN_DRAWING_SLOTS[skinNightFor(dateISO)] ?? 2;
  return `<svg viewBox="0 0 36 56" width="38" height="58" aria-hidden="true" fill="none"
    stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">${
    SKIN_BOTTLES[slot]}</svg>`;
}

// Build 16.6: how far the calendar arrows may travel — back to January 2026, forward to the end
// of next calendar year. Worked out fresh each time, so it moves on by itself as the years pass.
const SKIN_FIRST_MONTH = 2026 * 12 + 0;
function skinLastMonth() {
  return (new Date().getFullYear() + 1) * 12 + 11;
}
function clampSkinMonth(index) {
  return Math.min(Math.max(index, SKIN_FIRST_MONTH), skinLastMonth());
}

function daysBetween(fromISO, toISO) {
  const [y1, m1, d1] = fromISO.split("-").map(Number);
  const [y2, m2, d2] = toISO.split("-").map(Number);
  return Math.round((Date.UTC(y2, m2 - 1, d2) - Date.UTC(y1, m1 - 1, d1)) / 86400000);
}

function addDays(iso, days) {
  const [y, m, d] = iso.split("-").map(Number);
  const moved = new Date(y, m - 1, d + days);
  return isoDate(moved.getFullYear(), moved.getMonth(), moved.getDate());
}

// Weeks start on Monday here, the same as the calendar header
function mondayOf(iso) {
  const [y, m, d] = iso.split("-").map(Number);
  return addDays(iso, -((new Date(y, m - 1, d).getDay() + 6) % 7));
}

// The cycle follows the calendar, and "tonight" ends at midnight (local date)
function skinNightIndex(dateISO) {
  const era = skinEraFor(dateISO);
  const n = era.cycle.length;
  return ((era.anchor.night + daysBetween(era.anchor.date, dateISO)) % n + n) % n;
}

function skinNightFor(dateISO) {
  return skinEraFor(dateISO).cycle[skinNightIndex(dateISO)];
}

function skinLetterFor(dateISO) {
  return skinEraFor(dateISO).letters[skinNightIndex(dateISO)];
}

// Build 25: what to put on tonight. Empty for any night before the new routine started.
function skinProductsFor(dateISO) {
  return skinEraFor(dateISO).products[skinNightIndex(dateISO)] || [];
}

// Build 25: tapping the drawing shows what to put on TONIGHT — never a past night. Nothing stores
// which products were used on a given date, so a past night would be answered from today's list;
// showing tonight only is what keeps that from ever being wrong. If products are ever wanted on a
// past day, they have to be stored per night first.
$("skin-products-btn").addEventListener("click", () => {
  const today = todayISO();
  const products = skinProductsFor(today);
  $("skin-products-title").textContent = skinNightFor(today);
  // Numbered only when there is an order to follow; one product reads as a plain line.
  const many = products.length > 1;
  $("skin-product-list").replaceChildren(...products.map((name, i) => {
    const li = el("li", many ? "" : "plain");
    if (many) li.append(el("span", "product-step", String(i + 1)));
    li.append(el("span", "", name));
    return li;
  }));
  $("skin-products-none").hidden = products.length > 0;
  $("skin-products-dialog").showModal();
});

// ---------- My Skin page ----------
// Only the nights you marked Done are stored, keyed by date: { "YYYY-MM-DD": "done" }

const SKIN_DATA_KEY = "myjournal.skin";

function loadSkin() {
  try {
    const map = JSON.parse(localStorage.getItem(SKIN_DATA_KEY) || "{}");
    return map && typeof map === "object" && !Array.isArray(map) ? map : {};
  } catch {
    return {};
  }
}

function saveSkin(map) {
  localStorage.setItem(SKIN_DATA_KEY, JSON.stringify(map));
}

function setSkinDay(dateISO, done) {
  const map = loadSkin();
  if (done) map[dateISO] = "done";
  else delete map[dateISO];
  saveSkin(map);
  renderSkin();
  renderHome();
}

let skinViewYear = now.getFullYear();
let skinViewMonth = now.getMonth();
let skinWeekAnchor = todayISO();   // which week the cover screen is showing

function isoDate(year, month, day) {
  return `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

// ---------- Date steppers (Build 22.3) ----------
// Android's own date picker uses its landscape layout on the cover screen (598 x 530, wider than
// it is tall) and is then too wide for the window: Cancel is clipped and OK is off-screen, so a
// date can be opened but never confirmed. It is an OS dialog, so no CSS of ours can reach it.
// On the cover screen the native field is hidden and these arrows take its place; the main screen,
// where the portrait picker works, is unchanged.
const DATE_STEPPERS = [
  { input: "date", step: "date-step", label: "date-step-label" },
  { input: "saving-date", step: "saving-date-step", label: "saving-date-step-label" },
  { input: "income-date", step: "income-date-step", label: "income-date-step-label" },
];

function shiftISO(iso, days) {
  const [y, m, d] = iso.split("-").map(Number);
  const date = new Date(y, m - 1, d + days);
  return isoDate(date.getFullYear(), date.getMonth(), date.getDate());
}

function applyDateControls() {
  const cover = onCoverScreen();
  const today = todayISO();
  for (const s of DATE_STEPPERS) {
    $(s.step).hidden = !cover;      // arrows on the cover screen …
    $(s.input).hidden = cover;      // … the native field everywhere else
    $(s.input).max = today;         // so both screens stop at today, not just the arrows
  }
  refreshDateSteppers();
}

function refreshDateSteppers() {
  const today = todayISO();
  for (const s of DATE_STEPPERS) {
    const value = $(s.input).value || today;
    $(s.label).textContent = `${weekdayShort(value)} ${shortDate(value)}`;
    // you can't spend money on a day that hasn't happened, so today is the end of the road
    $(s.step).querySelector('[data-step="1"]').disabled = value >= today;
  }
}

for (const s of DATE_STEPPERS) {
  $(s.step).addEventListener("click", (event) => {
    const button = event.target.closest("[data-step]");
    if (!button || button.disabled) return;
    const today = todayISO();
    const next = shiftISO($(s.input).value || today, Number(button.dataset.step));
    $(s.input).value = next > today ? today : next;
    refreshDateSteppers();
  });
  $(s.input).addEventListener("change", refreshDateSteppers);
}

function weekdayShort(iso) {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("en-GB", { weekday: "short" });
}

// One day of the calendar, used by both the month grid and the cover screen's week
function dayCell(dateISO, map, today) {
  const done = map[dateISO] === "done";
  const canTap = dateISO <= today && dateISO >= SKIN_TRACKED_FROM;
  const cell = el("button", "cal-cell");
  cell.type = "button";
  // Build 24.2: two marks a day, not three. "Done" is the number coloured in (see .is-done
  // in style.css), so the ✓ column is gone — it was a tick in a box, and there is no box now.
  cell.append(
    el("span", "cal-day", String(Number(dateISO.slice(8)))),
    el("span", "cal-letter", skinLetterFor(dateISO))
  );
  if (dateISO === today) cell.classList.add("is-today");
  if (done) cell.classList.add("is-done");
  if (canTap) cell.addEventListener("click", () => openSkinDay(dateISO));
  else {
    cell.classList.add("is-off");
    cell.disabled = true;
  }
  cell.setAttribute("aria-label", `${shortDate(dateISO, true)}, ${skinNightFor(dateISO)}${done ? ", done" : ""}`);
  return cell;
}

function renderSkinMonth(map, today) {
  $("skin-month-label").textContent = new Date(skinViewYear, skinViewMonth, 1)
    .toLocaleDateString("en-GB", { month: "long", year: "numeric" });
  const daysInMonth = new Date(skinViewYear, skinViewMonth + 1, 0).getDate();
  const blanks = (new Date(skinViewYear, skinViewMonth, 1).getDay() + 6) % 7; // weeks start on Monday
  const cells = [];
  for (let i = 0; i < blanks; i++) cells.push(el("span", "cal-cell cal-blank"));
  for (let day = 1; day <= daysInMonth; day++) {
    cells.push(dayCell(isoDate(skinViewYear, skinViewMonth, day), map, today));
  }
  $("skin-calendar").replaceChildren(...cells);

  const index = skinViewYear * 12 + skinViewMonth;   // Build 16.6: grey out at each end
  $("skin-prev-month").disabled = index <= SKIN_FIRST_MONTH;
  $("skin-next-month").disabled = index >= skinLastMonth();
}

// Build 13: the cover screen shows this week only, so the card and the week both fit
function renderSkinWeek(map, today) {
  const start = mondayOf(skinWeekAnchor);
  const end = addDays(start, 6);
  // Build 24.2: the weekday names go. Mo Tu We sits directly under this label, so "Mon" and
  // "Sun" were saying twice what the header already says, and the extra words pushed the
  // longest label close to the arrows. The month is written once when the week stays inside
  // it — "5 – 11 Oct" — and twice only across a boundary — "26 Oct – 1 Nov".
  const sameMonth = start.slice(0, 7) === end.slice(0, 7);
  const from = sameMonth ? String(Number(start.slice(8))) : shortDate(start);
  $("skin-week-label").textContent = `${from} – ${shortDate(end)}`;
  const cells = [];
  for (let i = 0; i < 7; i++) cells.push(dayCell(addDays(start, i), map, today));
  $("skin-calendar").replaceChildren(...cells);

  $("skin-prev-week").disabled = start <= skinWeekFirst();   // Build 16.6
  $("skin-next-week").disabled = start >= skinWeekLast();
}

function renderSkin() {
  const map = loadSkin();
  const today = todayISO();

  // Tonight card
  $("skin-today").textContent = `Tonight · ${weekdayShort(today)} ${shortDate(today)}`;
  $("skin-tonight").textContent = skinNightFor(today);
  document.querySelector(".tonight-icon").innerHTML = skinBottleFor(today);   // fixed drawings, never anything typed
  const doneTonight = map[today] === "done";
  $("skin-done-btn").textContent = "Done";
  // Build 24.2: the button takes the colour of what TAPPING it does, which is the rule
  // everywhere else — teal to do a thing, Terracotta to take it back. It was the other way
  // round: filled once already done, so the loudest state was the one needing no action.
  $("skin-done-btn").classList.toggle("primary", !doneTonight);
  $("skin-done-btn").classList.toggle("undo", doneTonight);

  // The month on the main screen, this week on the cover screen
  const week = onCoverScreen();
  $("skin-month-nav").hidden = week;
  $("skin-week-nav").hidden = !week;
  if (week) renderSkinWeek(map, today);
  else renderSkinMonth(map, today);
}

// Build 16.6: opening the page always starts at today, wherever you browsed to last time.
// Read from a fresh date, not the `now` captured at load, so it stays right overnight.
function resetSkinView() {
  const today = new Date();
  skinViewYear = today.getFullYear();
  skinViewMonth = today.getMonth();
  skinWeekAnchor = todayISO();
}

function changeSkinMonth(delta) {
  const index = clampSkinMonth(skinViewYear * 12 + skinViewMonth + delta);
  skinViewYear = Math.floor(index / 12);
  skinViewMonth = index % 12;
  renderSkin();
}

$("skin-prev-month").addEventListener("click", () => changeSkinMonth(-1));
$("skin-next-month").addEventListener("click", () => changeSkinMonth(1));

function changeSkinWeek(delta) {
  const moved = addDays(mondayOf(skinWeekAnchor), delta * 7);
  if (moved < skinWeekFirst() || moved > skinWeekLast()) return;   // Build 16.6: the same range as the months
  skinWeekAnchor = moved;
  renderSkin();
}

// The weeks holding the first and last allowed days
function skinWeekFirst() {
  return mondayOf("2026-01-01");
}
function skinWeekLast() {
  return mondayOf(`${new Date().getFullYear() + 1}-12-31`);
}

$("skin-prev-week").addEventListener("click", () => changeSkinWeek(-1));
$("skin-next-week").addEventListener("click", () => changeSkinWeek(1));

// Tonight's Done button toggles: tap again and the question opens as a pop-up (Build 13.1)
$("skin-done-btn").addEventListener("click", () => {
  const today = todayISO();
  if (loadSkin()[today] === "done") {
    $("skin-undo-state").textContent = `${weekdayShort(today)} ${shortDate(today)} · ${skinNightFor(today)}`;
    $("skin-undo-dialog").showModal();
  } else {
    setSkinDay(today, true);
  }
});

$("skin-undo-yes").addEventListener("click", () => {
  setSkinDay(todayISO(), false);
  $("skin-undo-dialog").close();
});

// Fixing one day from the calendar
let skinDayDate = null;

function openSkinDay(dateISO) {
  skinDayDate = dateISO;
  const done = loadSkin()[dateISO] === "done";
  $("skin-day-title").textContent = `${shortDate(dateISO, true)} · ${skinNightFor(dateISO)}`;
  $("skin-day-state").textContent = done ? "Marked done" : "Not marked yet";
  $("skin-day-done").hidden = done;
  $("skin-day-not-done").hidden = !done;
  $("skin-day-dialog").showModal();
}

$("skin-day-done").addEventListener("click", () => {
  setSkinDay(skinDayDate, true);
  $("skin-day-dialog").close();
});

$("skin-day-not-done").addEventListener("click", () => {
  setSkinDay(skinDayDate, false);
  $("skin-day-dialog").close();
});

// ---------- Daily message ----------
// One line a day, picked at midnight. Random, but no repeats until every line has been shown.

function loadDaily() {
  try {
    const saved = JSON.parse(localStorage.getItem(DAILY_KEY) || "{}");
    if (!saved || typeof saved !== "object" || Array.isArray(saved)) return {};
    return saved;
  } catch {
    return {};
  }
}

function saveDaily(state) {
  localStorage.setItem(DAILY_KEY, JSON.stringify(state));
}

function dailyLineFor(dateISO) {
  const saved = loadDaily();
  if (saved.date === dateISO && DAILY_LINES[saved.index]) return DAILY_LINES[saved.index];

  let shown = Array.isArray(saved.shown) ? saved.shown.filter((i) => Number.isInteger(i) && DAILY_LINES[i]) : [];
  let left = DAILY_LINES.map((_, i) => i).filter((i) => !shown.includes(i));
  if (left.length === 0) { // every line has been shown: start the rotation again
    shown = [];
    left = DAILY_LINES.map((_, i) => i);
  }
  const index = left[Math.floor(Math.random() * left.length)];
  shown.push(index);
  try {
    saveDaily({ date: dateISO, index, shown });
  } catch (err) {
    console.error(err);
  }
  return DAILY_LINES[index];
}

// ---------- Pages: Home, My Money, My Skin (Settings opens on top) ----------

const VIEWS = ["home", "money", "skin", "diary", "brain", "books", "habit"];
const SESSION_VIEW_KEY = "myjournal.session-view";
let currentView = "home";

// overlay: "" (a normal page), "settings", or "note" (the diary writing page)
function applyPages(overlay = "") {
  for (const view of VIEWS) $(`${view}-page`).hidden = overlay !== "" || view !== currentView;
  $("settings-page").hidden = overlay !== "settings";
  $("diary-note-page").hidden = overlay !== "note";
  window.scrollTo(0, 0);
  // Build 16.7: leaving a page part-way down must not leave its + or ✎ hidden when you come back
  for (const id of ["open-add", "diary-new"]) $(id).classList.remove("is-away");
  lastScrollY = 0;
}

function renderHome() {
  const today = todayISO();
  $("daily-line").textContent = dailyLineFor(today);
  const done = loadSkin()[today] === "done";
  // Build 24.10: on the cover the tile is one row, and "Recovery 2" wrapped onto a second
  // line, so the four tiles stopped matching. The cover shows the cycle LETTER instead — the
  // same letter the calendar uses, so it is one you already read every night.
  $("skin-tile-tonight").textContent = onCoverScreen()
    ? skinLetterFor(today)
    : skinNightFor(today);
  renderBackupNudge();
}

// Build 27.2: the monthly nudge. It is here and nowhere else on purpose \u2014 Home is the page you
// open daily, and it is MAIN SCREEN ONLY: the cover screen is for capturing something in seconds,
// not for a chore. There is no dismiss, by your decision: a Later button is a laziness button.
function renderBackupNudge() {
  const btn = $("home-backup");
  const due = !onCoverScreen() && backupIsDue();
  btn.hidden = !due;
  if (!due) return;
  const last = localStorage.getItem(LAST_BACKUP_KEY);
  btn.disabled = false;
  btn.textContent = last
    ? `Back up now \u00b7 last backup ${backupAge(last)}`
    : "Back up now \u00b7 you haven't yet";
}

$("home-backup").addEventListener("click", async () => {
  const btn = $("home-backup");
  btn.disabled = true;
  const ok = await runBackup("backup-status");
  if (!ok) {                       // cancelled or failed: the nudge stays, as it should
    renderBackupNudge();
    return;
  }
  // Say it worked before going. A cancelled share also makes the button stay, so silence would
  // leave "it worked" and "I cancelled" looking the same.
  btn.textContent = "Backed up \u2713";
  setTimeout(() => { renderHome(); showLastBackup(); }, 1600);
});

function showView(view, { push = false } = {}) {
  currentView = view;
  // Remembered for this session only: a refresh keeps you here, closing the app forgets it (Build 10.5)
  try {
    sessionStorage.setItem(SESSION_VIEW_KEY, view);
  } catch {}
  if (view === "home") renderHome();
  if (view === "skin") { resetSkinView(); renderSkin(); }   // Build 16.6: opening starts at today
  if (view === "diary") renderDiary();
  if (view === "books") renderBooks();
  if (view !== "brain" && $("brain-dialog").open) $("brain-dialog").close(); // Back left the page with the pop-up open
  applyPages();
  if (push) history.pushState({ view, fromHome: true }, ""); // so the phone's Back gesture returns Home
}

function goHome() {
  if (history.state && history.state.fromHome) {
    history.back(); // same as the phone's Back gesture
  } else {
    showView("home");
    history.replaceState({ view: "home" }, "");
  }
}

// From Home, My Money always starts on the Expenses tab
$("tile-money").addEventListener("click", () => {
  showTab("expenses");
  showView("money", { push: true });
});
$("tile-skin").addEventListener("click", () => showView("skin", { push: true }));
$("tile-diary").addEventListener("click", () => showView("diary", { push: true }));
$("tile-brain").addEventListener("click", () => showView("brain", { push: true }));
$("tile-book").addEventListener("click", () => showView("books", { push: true }));   // Build 22
// Build 16.10: #tile-heart has no handler on purpose — the ❤️ page isn't planned yet, so the icon
// is drawn but inert until it has somewhere to go. 📖 became My Books in Build 22.
$("tile-habit").addEventListener("click", () => showView("habit", { push: true }));
for (const button of document.querySelectorAll(".go-home")) button.addEventListener("click", goHome);

// The skin tile updates after midnight when the app comes back into view
document.addEventListener("visibilitychange", () => {
  if (!document.hidden) renderHome();
});

// ---------- Brain dump (Build 19: letting go) ----------
// This section stores nothing. A thought is written, it appears in a list inside the pop-up so you
// can see it went, and closing the pop-up forgets it. Build 10's To keep list, the ten-thought cap
// (16.8), the swipes and editing are all gone — anything worth keeping belongs in My Diary.

const BRAIN_KEY = "myjournal.braindump";   // only still named here so the one-time move can find it

// The thoughts dumped since the pop-up was opened. In memory only, never written anywhere.
let sessionThoughts = [];

// A diary title holds 80 characters: longer thoughts are cut at a word with "…" and kept whole in the note text
function thoughtTitle(text) {
  if (text.length <= 80) return text;
  let cut = text.slice(0, 79);
  const space = cut.lastIndexOf(" ");
  if (space > 50) cut = cut.slice(0, space);
  return `${cut.trimEnd()}…`;
}

// Build 19, once only: whatever is still in To keep becomes its own diary note, then the key goes.
// No flag is needed — an absent key means there is nothing to move, and restore no longer writes
// one back. Quiet by your choice: no message, however many are moved.
function moveKeptThoughtsToDiary() {
  let thoughts;
  try {
    const raw = localStorage.getItem(BRAIN_KEY);
    if (!raw) return;
    thoughts = JSON.parse(raw);
    if (!Array.isArray(thoughts) || thoughts.length === 0) {
      localStorage.removeItem(BRAIN_KEY);
      return;
    }
  } catch (err) {
    console.error(err);
    return;                                  // unreadable: leave it alone rather than lose it
  }
  try {
    // oldest first, so the newest thought ends up newest in the diary
    const ordered = [...thoughts].sort((a, b) => String(a.createdAt).localeCompare(String(b.createdAt)));
    for (const thought of ordered) {
      const text = String(thought && thought.text ? thought.text : "").trim();
      if (!text) continue;
      const long = text.length > 80;
      diaryStore.add({
        id: newId(),
        title: thoughtTitle(text),
        text: long ? text : "",
        html: long ? textToHtml(text) : "",
        date: todayISO(),
        createdAt: new Date().toISOString(),
      });
    }
  } catch (err) {
    console.error(err);
    return;                                  // keep the thoughts where they are and try again next time
  }
  try {
    localStorage.removeItem(BRAIN_KEY);       // Brain dump stores nothing from here on
  } catch (err) {
    console.error(err);
  }
}

function fitBrainBox() {
  const box = $("brain-text");
  box.style.height = "auto";
  box.style.height = `${box.scrollHeight + 2}px`; // grows with the thought, up to the max-height in style.css
}

// Build 21, runs once: put the seed goals into storage, then point every saving at a goal id
// instead of the goal's name. A saving whose name matches nothing keeps its text, so nothing is lost.
function seedAndLinkGoals() {
  let goals;
  try {
    goals = goalStore.load();
  } catch (err) {
    console.error(err); // damaged goal data is left alone rather than overwritten
    return;
  }
  if (goals.length) return; // already done, or you have goals of your own

  goals = SEED_GOALS.map((g) => ({ id: newId(), name: g.name, target: g.target, monthly: g.monthly, hidden: false }));
  const byName = new Map(goals.map((g) => [g.name, g.id]));

  let savings;
  try {
    savings = savingsStore.load();
  } catch (err) {
    console.error(err);
    return; // don't seed goals we then can't link
  }

  const linked = savings.map((s) => {
    if (s.goalId) return s;                       // already linked
    const id = byName.get(s.goal);
    if (!id) return s;                            // name we don't recognise: leave its text alone
    const { goal, ...rest } = s;
    return { ...rest, goalId: id };
  });

  goalStore.save(goals);
  savingsStore.save(linked);
}

// Build 21: savings from a version 6 or older backup still carry their goal's name. Match them to
// the goals you have now; one that matches nothing keeps its text rather than being dropped.
function linkSavingsByName(savings) {
  const byName = new Map(loadGoals().map((g) => [g.name, g.id]));
  return savings.map((s) => {
    if (s.goalId) return s;
    const id = byName.get(s.goal);
    if (!id) return s;
    const { goal, ...rest } = s;
    return { ...rest, goalId: id };
  });
}

function renderSessionThoughts() {
  $("brain-session").replaceChildren(
    ...sessionThoughts.map((text) => el("li", "session-thought", text))   // read-only: no tap, no swipe
  );
}

function openBrainWriter() {
  sessionThoughts = [];
  renderSessionThoughts();
  $("brain-text").value = "";
  $("brain-error").hidden = true;
  $("brain-dialog").showModal();
  fitBrainBox();
  $("brain-text").focus();
}

// A brief green message that fades (red for a problem). Used in the pop-up and on the Brain dump page.
const flashTimers = {};
function flashOn(id, message, problem = false) {
  clearTimeout(flashTimers[id]);
  const flash = $(id);
  flash.textContent = message;
  flash.classList.toggle("is-problem", problem);
  flash.classList.remove("is-fading");
  flash.hidden = false;
  flashTimers[id] = setTimeout(() => {
    flash.classList.add("is-fading");
    flashTimers[id] = setTimeout(() => (flash.hidden = true), 400);
  }, problem ? 3000 : 1500);
}

function sendThought() {
  const box = $("brain-text");
  const text = box.value.trim();              // Build 19: line breaks are kept, so a pasted one survives
  $("brain-error").hidden = true;
  if (!text) {                                // an empty box sends nothing
    box.value = "";
    fitBrainBox();
    box.focus();
    return;
  }
  sessionThoughts.unshift(text);              // newest at the top
  renderSessionThoughts();                    // the line appearing is the confirmation — no flash
  box.value = "";
  fitBrainBox();
  box.focus();                                // stays open, keyboard up, for the next thought
}

$("close-brain").addEventListener("click", goHome);
$("brain-dump").addEventListener("click", openBrainWriter);
$("brain-send").addEventListener("pointerdown", (event) => event.preventDefault()); // keep the keyboard up
$("brain-send").addEventListener("click", sendThought);
// Build 19: closing forgets everything. Enter is a new line now, so only ➤ sends.
$("brain-dialog").addEventListener("close", () => {
  $("brain-text").value = "";
  sessionThoughts = [];
  renderSessionThoughts();
});
$("brain-text").addEventListener("input", () => {
  $("brain-error").hidden = true;
  fitBrainBox();
});

// ---------- My Diary ----------

const DIARY_KEY = "myjournal.diary";
const diaryStore = makeStore(DIARY_KEY);

const RECENT_NOTE_COUNT = 20;          // shown on the diary page
const NOTE_PAGE_SIZE = 10;             // shown per page in the View more pop-up
let sortedNotes = [];
let notePage = 0;                      // 0 = first page

let editingNoteId = null;              // null = writing a new note
let noteOpenedWith = { title: "", html: "" };
let leavingNote = false;               // true while a save, delete or discard closes the page
let savingNote = false;                // guards a double tap on Save

function renderDiary() {
  let notes = [];
  let loadProblem = false;
  try {
    notes = diaryStore.load();
  } catch (err) {
    console.error(err);
    loadProblem = true;
  }
  // Pinned first, then newest. Sorting on date and createdAt only, so editing a note never moves it.
  closeSwipe();
  sortedNotes = [...notes].sort(
    (a, b) =>
      Number(Boolean(b.pinned)) - Number(Boolean(a.pinned)) ||
      (b.date || "").localeCompare(a.date || "") ||
      (b.createdAt || "").localeCompare(a.createdAt || "")
  );
  $("diary-log").replaceChildren(...diaryListItems(sortedNotes.slice(0, RECENT_NOTE_COUNT)));
  $("open-diary-log").hidden = sortedNotes.length <= RECENT_NOTE_COUNT;
  $("diary-empty").textContent = loadProblem ? "Your saved notes couldn't be read." : "No notes yet.";
  $("diary-empty").hidden = sortedNotes.length > 0;
  renderFullDiaryLog();
}

// ---------- The full note list (10 per page) ----------

function renderFullDiaryLog() {
  const count = sortedNotes.length;
  const pages = Math.max(1, Math.ceil(count / NOTE_PAGE_SIZE));
  notePage = Math.min(Math.max(notePage, 0), pages - 1);
  const start = notePage * NOTE_PAGE_SIZE;
  const pageRows = sortedNotes.slice(start, start + NOTE_PAGE_SIZE);

  $("diary-log-full").replaceChildren(...pageRows.map((note) => noteRow(note, true)));
  $("diary-log-range").textContent = count ? `${start + 1}\u2013${start + pageRows.length} of ${count}` : "No notes yet.";
  $("diary-page-label").textContent = `Page ${notePage + 1} of ${pages}`;
  $("diary-page-prev").disabled = notePage === 0;
  $("diary-page-next").disabled = notePage >= pages - 1;
}

function changeDiaryPage(delta) {
  notePage += delta;
  renderFullDiaryLog();
  $("diary-log-dialog").scrollTop = 0;
}

$("open-diary-log").addEventListener("click", () => {
  notePage = 0;
  renderFullDiaryLog();
  $("diary-log-dialog").showModal();
  $("diary-log-dialog").scrollTop = 0;
});
$("diary-page-prev").addEventListener("click", () => changeDiaryPage(-1));
$("diary-page-next").addEventListener("click", () => changeDiaryPage(1));

const BOOK_ICON = '<svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><path d="M12 6.5C10 5 7 4.5 4 5v13c3-.5 6 0 8 1.5 2-1.5 5-2 8-1.5V5c-3-.5-6 0-8 1.5zM12 6.5v13" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/></svg>';
const BIN_ICON = '<svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><path d="M4 7h16M10 4h4M6 7l1 13h10l1-13M10 11v6M14 11v6" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/></svg>';
const PIN_ICON = '<svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><path d="M9 3h6l-1 6 4 3v2H6v-2l4-3-1-6zM12 14v7" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/></svg>';
const UNPIN_ICON = '<svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><path d="M9 3h6l-1 6 4 3v2H6v-2l4-3-1-6zM12 14v7M4 4l16 16" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/></svg>';

function iconButton(className, label, icon, onClick) {
  const button = el("button", className);
  button.type = "button";
  button.setAttribute("aria-label", label);
  button.innerHTML = icon; // fixed icons, never anything you typed
  button.addEventListener("click", onClick);
  return button;
}

// Pinned notes sit on top with no heading; a year heading opens each year below them (Build 14)
// Build 24.3: pinned notes get a heading of their own. They used to sit on top with NO heading,
// marked by a Ὄc on every row — and once the year headings became swiped labels, a group with no
// heading above groups that have one read as a mistake. The heading says it once instead of each
// row saying it again, and the title gets that column's width back.
function diaryListItems(notes) {
  const items = [];
  let lastYear = null;
  let pinnedHeadDone = false;
  for (const note of notes) {
    if (note.pinned) {
      if (!pinnedHeadDone) {
        items.push(el("li", "year-head", "Pinned"));
        pinnedHeadDone = true;
      }
    } else {
      const year = (note.date || "").slice(0, 4) || String(now.getFullYear());
      if (year !== lastYear) {
        items.push(el("li", "year-head", year));
        lastYear = year;
      }
    }
    items.push(noteRow(note));
  }
  return items;
}

function noteRow(note, withYear = false) {
  const li = el("li", "swipe");

  const actions = el("div", "swipe-actions");
  actions.append(
    iconButton("swipe-btn", note.pinned ? "Unpin" : "Pin", note.pinned ? UNPIN_ICON : PIN_ICON, () => togglePin(note.id)),
    iconButton("swipe-btn bin", "Delete", BIN_ICON, () => askDeleteNote(note.id))
  );

  const row = el("button", "log-row note-row");
  row.type = "button";
  row.append(
    el("span", "log-date", note.date ? shortDate(note.date, withYear) : ""),
    el("span", "log-item", note.title || "(untitled)")
  );
  addSwipe(li, row, () => openNote(note.id));

  li.append(actions, row);
  return li;
}

// ---------- Swipe a row to reveal Pin and Delete ----------

const SWIPE_WIDTH = 112;        // the two buttons side by side
let openSwipeRow = null;

function closeSwipe() {
  if (!openSwipeRow) return;
  openSwipeRow.classList.remove("is-open");
  openSwipeRow = null;
}

function addSwipe(li, row, onTap) {
  let startX = 0, startY = 0, dragging = false, decided = false, offset = 0;
  let dragged = false; // per row, so a swipe here never swallows a tap on another row

  row.addEventListener("click", () => {
    if (dragged) {
      dragged = false;
      return;
    }
    if (li.classList.contains("is-open")) {
      closeSwipe();
      return;
    }
    onTap();
  });

  row.addEventListener("touchstart", (event) => {
    const touch = event.touches[0];
    startX = touch.clientX;
    startY = touch.clientY;
    dragging = true;
    decided = false;
    dragged = false;
    offset = li.classList.contains("is-open") ? -SWIPE_WIDTH : 0;
  }, { passive: true });

  row.addEventListener("touchmove", (event) => {
    if (!dragging) return;
    const touch = event.touches[0];
    const dx = touch.clientX - startX;
    const dy = touch.clientY - startY;
    if (!decided) {
      if (Math.abs(dx) < 8 && Math.abs(dy) < 8) return;
      decided = true;
      if (Math.abs(dy) > Math.abs(dx)) { dragging = false; return; } // a scroll, not a swipe
    }
    dragged = true;
    const start = li.classList.contains("is-open") ? -SWIPE_WIDTH : 0;
    offset = Math.max(-SWIPE_WIDTH, Math.min(0, start + dx));
    row.style.transform = `translateX(${offset}px)`;
  }, { passive: true });

  row.addEventListener("touchend", () => {
    if (!dragging) return;
    dragging = false;
    row.style.transform = "";
    if (offset <= -SWIPE_WIDTH / 2) {
      if (openSwipeRow && openSwipeRow !== li) closeSwipe();
      li.classList.add("is-open");
      openSwipeRow = li;
    } else {
      li.classList.remove("is-open");
      if (openSwipeRow === li) openSwipeRow = null;
    }
  });
}

// Tapping anywhere else, or scrolling, closes the open row
document.addEventListener("click", (event) => {
  if (openSwipeRow && !openSwipeRow.contains(event.target)) closeSwipe();
}, true);
window.addEventListener("scroll", closeSwipe, { passive: true });

function togglePin(id) {
  try {
    const list = diaryStore.load();
    const note = list.find((n) => n.id === id);
    if (!note) return;
    if (note.pinned) delete note.pinned;
    else note.pinned = true;
    diaryStore.save(list); // written directly, so pinning never marks the note edited
  } catch (err) {
    console.error(err);
    return;
  }
  closeSwipe();
  renderDiary();
}

let noteToDelete = null;

function askDeleteNote(id) {
  noteToDelete = id;
  // Build 20: say which note. It opens from the list and from the note page, so the row may be off screen.
  let note;
  try {
    note = diaryStore.load().find((n) => n.id === id);
  } catch (err) {
    console.error(err);
  }
  $("note-delete-which").textContent = note ? note.title || "(untitled)" : "";
  $("note-delete-which").hidden = !note;
  $("note-delete-dialog").showModal();
}

$("note-delete-no").addEventListener("click", () => {
  noteToDelete = null;
  $("note-delete-dialog").close();
});

$("note-delete-yes").addEventListener("click", () => {
  const wasOpenNote = noteToDelete && noteToDelete === editingNoteId && !$("diary-note-page").hidden;
  if (noteToDelete) {
    try {
      diaryStore.remove(noteToDelete);
    } catch (err) {
      console.error(err);
    }
  }
  noteToDelete = null;
  $("note-delete-dialog").close();
  closeSwipe();
  renderDiary();
  if (wasOpenNote) {          // deleting the note you are writing also leaves the page (Build 14.2)
    leavingNote = true;
    history.back();
  }
});

// ---------- Formatting (Build 9.6) ----------

const NOTE_MAX_CHARS = 10000;
const DEFAULT_TEXT_HEX = "#443D35";            // the normal ink colour (Espresso)
const COLOURS_KEY = "myjournal.colors";
const LAST_BACKUP_KEY = "myjournal.lastbackup";  // Build 11.5: shown in Settings, not part of the backup

// ---------- The spare copies (Build 27.2) ----------
// One snapshot a day, kept for a week, plus one taken a moment before any restore.
//
// WHY A DAY AND NOT EVERY CHANGE: a copy that updates the instant you change something would
// copy your mistake too. You would have a perfect spare of the damage. A spare is only worth
// having if it is OLDER than the mistake, so these are taken once a day and seven are kept.
//
// WHAT THEY DO NOT DO: they live in the same storage as your data. Clearing the browser or
// uninstalling takes both. They are for mistakes, never for a lost phone — that is the backup file.
const SNAPSHOT_KEY = "myjournal.snapshots";
const SNAPSHOT_KEEP = 7;
const FIRST_RUN_KEY = "myjournal.firstrun";   // day zero, so a phone that has never backed up can be counted from

function loadSnapshots() {
  try {
    const list = JSON.parse(localStorage.getItem(SNAPSHOT_KEY) || "[]");
    return Array.isArray(list) ? list : [];
  } catch {
    return [];        // a damaged list is not your data: never let it take a page down
  }
}

// A failed snapshot is swallowed, like the edit history: the save it is shadowing has already
// happened, and must never be undone because its spare copy could not be written.
function takeSnapshot(reason) {
  let list;
  try {
    list = loadSnapshots();
    list.push({ at: new Date().toISOString(), reason, data: makeBackup() });
  } catch (err) {
    console.error(err);
    return;
  }
  while (list.length > SNAPSHOT_KEEP) list.shift();
  // If storage is full, drop the oldest and try again until it fits or there is nothing left.
  while (list.length) {
    try {
      localStorage.setItem(SNAPSHOT_KEY, JSON.stringify(list));
      return;
    } catch (err) {
      console.error(err);
      list.shift();
    }
  }
}

function snapshotTodayIfNeeded() {
  const today = todayISO();
  if (loadSnapshots().some((s) => s.reason === "daily" && String(s.at).slice(0, 10) === today)) return;
  takeSnapshot("daily");
}

function firstRunDate() {
  let when = localStorage.getItem(FIRST_RUN_KEY);
  if (!when) {
    when = new Date().toISOString();
    try { localStorage.setItem(FIRST_RUN_KEY, when); } catch (err) { console.error(err); }
  }
  return when;
}

// Build 27.2: the monthly nudge. Rolling from your last real backup — a fixed date would nag
// on the 1st even if you backed up on the 29th. A phone that has never backed up counts from
// first run, so nothing appears on day one, before there is anything worth losing.
//
// 30, not 90. Quarterly was chosen while the file-pile problem looked like a frequency problem;
// it wasn't — it was one file per TAP, which the nudge fixes by itself. So the real trade was
// 8 extra files a year against two extra months of data to lose if the phone dies. The spare
// copies die with the phone, so this file is the only thing that would be left.
const BACKUP_DUE_DAYS = 30;

function daysSinceBackup() {
  const last = localStorage.getItem(LAST_BACKUP_KEY) || firstRunDate();
  return daysBetween(String(last).slice(0, 10), todayISO());
}

function backupIsDue() {
  return daysSinceBackup() >= BACKUP_DUE_DAYS;
}
// Build 24.3: the warm rows. Every text colour clears 4.5:1 on both papers; every highlight
// is a fill the palette already carries, with ink at 4.89 or better on it. Only Indigo and
// Plum are new — the palette had no blue-violet or purple dark enough to write with.
const COLOUR_DEFAULTS = {
  text: ["#96503C", "#4C6F77", "#626D5E", "#5761A2", "#924F7E"],       // terracotta, teal, sage, indigo, plum
  highlight: ["#D4B684", "#C2D3BB", "#D2A4A8", "#DBCAD0", "#D4BCAA"],  // sand, green, pink, wisteria, swipe
};
const DROP_TAGS = new Set(["SCRIPT", "STYLE", "TEMPLATE", "IFRAME", "OBJECT", "EMBED", "SVG", "MATH",
  "VIDEO", "AUDIO", "CANVAS", "NOSCRIPT", "TEXTAREA", "SELECT", "BUTTON", "INPUT", "IMG"]);

const colourReader = document.createElement("canvas").getContext("2d");

// Any colour ("red", "#f00", "rgb(…)") in one standard form, or "" when it's invalid
function standardColour(value) {
  if (typeof value !== "string" || !value.trim()) return "";
  const results = ["#000000", "#ffffff"].map((start) => { // an invalid colour leaves the starting one in place
    colourReader.fillStyle = start;
    colourReader.fillStyle = value;
    return colourReader.fillStyle;
  });
  return results[0] === results[1] ? results[0] : "";
}

// A colour worth keeping, or "" when it's invalid, see-through, the normal ink, or no highlight
function cleanColour(value, kind) {
  const colour = standardColour(value);
  if (!colour || colour.startsWith("rgba")) return ""; // "rgba" here always means partly or fully see-through
  if (kind === "text" && colour === standardColour(DEFAULT_TEXT_HEX)) return "";
  return colour;
}

// The only formatting a note may keep: bold, italic, underline, strikethrough, colour, highlight
function allowedStyle(node, tag) {
  const style = node.style;
  const parts = [];
  if (tag === "B" || tag === "STRONG" || style.fontWeight === "bold" || Number(style.fontWeight) >= 600) parts.push("font-weight: bold");
  if (tag === "I" || tag === "EM" || style.fontStyle === "italic") parts.push("font-style: italic");
  const decoration = `${style.textDecoration} ${style.textDecorationLine}`;
  const lines = [];
  if (tag === "U" || decoration.includes("underline")) lines.push("underline");
  if (tag === "S" || tag === "STRIKE" || tag === "DEL" || decoration.includes("line-through")) lines.push("line-through");
  if (lines.length) parts.push(`text-decoration-line: ${lines.join(" ")}`);
  const colour = cleanColour(tag === "FONT" ? node.getAttribute("color") || style.color : style.color, "text");
  if (colour) parts.push(`color: ${colour}`);
  const highlight = cleanColour(style.backgroundColor, "highlight");
  if (highlight) parts.push(`background-color: ${highlight}`);
  return parts.join("; ");
}

function appendClean(source, target) {
  for (const node of source.childNodes) {
    if (node.nodeType === Node.TEXT_NODE) {
      target.append(node.textContent);
      continue;
    }
    if (node.nodeType !== Node.ELEMENT_NODE) continue;
    const tag = node.tagName.toUpperCase();
    if (DROP_TAGS.has(tag)) continue;
    if (tag === "BR") {
      target.append(document.createElement("br"));
      continue;
    }
    let container = target;
    if (tag === "DIV" || tag === "P") {
      const block = document.createElement("div");
      container.append(block);
      container = block;
    }
    const css = allowedStyle(node, tag);
    if (css) {
      const span = document.createElement("span");
      span.setAttribute("style", css);
      container.append(span);
      container = span;
    }
    appendClean(node, container);
    while (container !== target && !container.hasChildNodes()) { // tidy away empty wrappers
      const parent = container.parentNode;
      container.remove();
      container = parent;
    }
  }
}

// Keeps only the formatting the toolbar makes. A <template> is inert, so nothing in it can run or load.
function cleanNoteHtml(html) {
  const template = document.createElement("template");
  template.innerHTML = typeof html === "string" ? html : "";
  const out = document.createElement("div");
  appendClean(template.content, out);
  return out.innerHTML;
}

function textToHtml(text) {
  return String(text || "").split("\n").map((line) => {
    const block = document.createElement("div");
    if (line) block.textContent = line;
    else block.append(document.createElement("br"));
    return block.outerHTML;
  }).join("");
}

// Plain text of a note, one line per line break, worked out without needing the page on screen
function htmlToText(html) {
  const template = document.createElement("template");
  template.innerHTML = html || "";
  const lines = [""];
  const walk = (parent, inBlock) => {
    for (const child of parent.childNodes) {
      if (child.nodeType === Node.TEXT_NODE) {
        lines[lines.length - 1] += child.textContent;
        continue;
      }
      if (child.nodeType !== Node.ELEMENT_NODE) continue;
      const tag = child.tagName.toUpperCase();
      if (tag === "BR") {
        if (!(inBlock && child === parent.lastChild)) lines.push(""); // a trailing <br> in a line adds no new line
        continue;
      }
      const block = tag === "DIV" || tag === "P";
      if (block && lines[lines.length - 1] !== "") lines.push("");
      walk(child, block || inBlock);
      if (block) lines.push("");
    }
  };
  walk(template.content, false);
  return lines.join("\n").replace(/ /g, " ").trim();
}

// Gives every note a clean formatted copy. Old plain notes keep their exact words.
function convertNote(note) {
  if (typeof note.html === "string") {
    const html = cleanNoteHtml(note.html);
    return { ...note, html, text: htmlToText(html) };
  }
  const text = typeof note.text === "string" ? note.text : "";
  return { ...note, text, html: textToHtml(text) };
}

// Run once at start-up: written directly, so no note is marked edited
function migrateNotes() {
  let list;
  try {
    list = diaryStore.load();
  } catch (err) {
    console.error(err);
    return;
  }
  const converted = list.map(convertNote);
  if (JSON.stringify(converted) === JSON.stringify(list)) return;
  try {
    diaryStore.save(converted);
  } catch (err) {
    console.error(err);
  }
}

// ---------- Colour memory ----------

function validColourRow(row, kind) {
  const ok = Array.isArray(row) ? row.filter((c) => typeof c === "string" && /^#[0-9a-f]{6}$/i.test(c)) : [];
  return ok.length === 5 ? ok.map((c) => c.toLowerCase()) : [...COLOUR_DEFAULTS[kind]];
}

function loadColours() {
  try {
    const saved = JSON.parse(localStorage.getItem(COLOURS_KEY) || "{}");
    return { text: validColourRow(saved.text, "text"), highlight: validColourRow(saved.highlight, "highlight") };
  } catch {
    return { text: [...COLOUR_DEFAULTS.text], highlight: [...COLOUR_DEFAULTS.highlight] };
  }
}

function saveColours(colours) {
  localStorage.setItem(COLOURS_KEY, JSON.stringify(colours));
}

// A new colour joins at the front and pushes out the oldest. One already in the row stays where it is.
function rememberColour(kind, hex) {
  const colours = loadColours();
  const value = hex.toLowerCase();
  if (colours[kind].includes(value)) return;
  colours[kind] = [value, ...colours[kind]].slice(0, 5);
  try {
    saveColours(colours);
  } catch (err) {
    console.error(err);
  }
}

// ---------- The toolbar ----------

let savedRange = null;
let openPalette = null; // "text", "highlight" or null

function rememberSelection() {
  const editor = $("diary-text");
  const selection = document.getSelection();
  if (editor && selection.rangeCount && editor.contains(selection.getRangeAt(0).commonAncestorContainer)) {
    savedRange = selection.getRangeAt(0).cloneRange();
  }
}

function restoreSelection() {
  const editor = $("diary-text");
  const selection = document.getSelection();
  // The cursor is still in the writing box: use where it is now, never an older spot
  if (document.activeElement === editor && selection.rangeCount && editor.contains(selection.anchorNode)) return;
  editor.focus();
  if (savedRange && editor.contains(savedRange.commonAncestorContainer)) {
    const selection = document.getSelection();
    selection.removeAllRanges();
    selection.addRange(savedRange);
  }
}

function updateToolbarState() {
  const editor = $("diary-text");
  const selection = document.getSelection();
  const inEditor = Boolean(editor && selection.rangeCount && editor.contains(selection.anchorNode));
  for (const button of $("diary-toolbar").querySelectorAll("[data-cmd]")) {
    const command = button.dataset.cmd;
    if (command === "undo" || command === "redo") continue;
    let on = false;
    try {
      on = inEditor && document.queryCommandState(command);
    } catch {}
    button.setAttribute("aria-pressed", String(on));
  }
  let text = "", highlight = "";
  if (inEditor) {
    try {
      text = document.queryCommandValue("foreColor");
      highlight = document.queryCommandValue("hiliteColor") || document.queryCommandValue("backColor");
    } catch {}
  }
  $("text-colour-bar").style.background = inEditor ? cleanColour(text, "text") || DEFAULT_TEXT_HEX : "transparent";
  $("highlight-colour-bar").style.background = cleanColour(highlight, "highlight") || "transparent";
}

function runFormat(command, value) {
  restoreSelection();
  document.execCommand("styleWithCSS", false, true);
  document.execCommand(command, false, value);
  rememberSelection();
  updateToolbarState();
  $("diary-error").hidden = true;
}

// Build 24.3: a swatch is the thing it does — an A in that colour for the pen, a swipe of
// the colour for the highlighter — instead of a round chip of pure hue. kind is "text" or
// "highlight"; the old circles broke three rules at once (circles, 2px borders, 38px targets).
function swatchButton(label, colour, className, onPick, kind) {
  const button = el("button", `swatch ${className}`.trim());
  button.type = "button";
  button.setAttribute("aria-label", label);
  if (kind === "text") {
    const a = el("span", "swatch-a", "A");
    if (colour) a.style.color = colour;
    button.append(a);
  } else if (kind === "highlight") {
    const mark = el("span", "swatch-mark");
    if (colour) mark.style.background = colour;
    button.append(mark);
  } else if (colour) {
    button.style.background = colour;
  }
  button.addEventListener("pointerdown", (event) => event.preventDefault()); // keep the text selected
  button.addEventListener("click", onPick);
  return button;
}

function closeColourStrip() {
  openPalette = null;
  $("colour-strip").hidden = true;
  for (const button of $("diary-toolbar").querySelectorAll("[data-palette]")) button.setAttribute("aria-expanded", "false");
  makeRoomForToolbar();
}

function applyColour(kind, hex) {
  if (kind === "text") runFormat("foreColor", hex || DEFAULT_TEXT_HEX);
  else runFormat("hiliteColor", hex || "transparent");
  closeColourStrip();
}

function openColourStrip(kind) {
  if (openPalette === kind) {
    closeColourStrip();
    return;
  }
  openPalette = kind;
  const row = loadColours()[kind];
  const pinned = kind === "text"
    ? swatchButton("Normal colour", DEFAULT_TEXT_HEX, "pinned", () => applyColour(kind, null), "text")
    : swatchButton("No highlight", null, "pinned none", () => applyColour(kind, null), "highlight");
  const plus = swatchButton("More colours", null, "plus", () => {
    rememberSelection();
    const picker = $("colour-picker");
    picker.dataset.kind = kind;
    picker.value = row[0];
    picker.click(); // opens Android's own colour picker
  });
  plus.textContent = "＋";
  $("colour-strip").replaceChildren(
    pinned,
    ...row.map((hex) => swatchButton(hex, hex, "", () => applyColour(kind, hex), kind)),
    plus
  );
  $("colour-strip").hidden = false;
  makeRoomForToolbar();
  for (const button of $("diary-toolbar").querySelectorAll("[data-palette]")) {
    button.setAttribute("aria-expanded", String(button.dataset.palette === kind));
  }
}

$("colour-picker").addEventListener("change", () => {
  const picker = $("colour-picker");
  const kind = picker.dataset.kind;
  if (!kind) return;
  rememberColour(kind, picker.value);
  applyColour(kind, picker.value);
});

for (const button of $("diary-toolbar").querySelectorAll("button")) {
  button.addEventListener("pointerdown", (event) => event.preventDefault()); // keep the text selected
  button.addEventListener("click", () => {
    if (button.dataset.palette) openColourStrip(button.dataset.palette);
    else runFormat(button.dataset.cmd);
  });
}

document.addEventListener("selectionchange", () => {
  const editor = $("diary-text");
  const selection = document.getSelection();
  if (editor && selection.rangeCount && editor.contains(selection.anchorNode)) {
    rememberSelection();
    updateToolbarState();
    keepCaretAboveToolbar();
  }
});

// ---------- Toolbar at the bottom (Build 9.7) ----------

// Room at the end of the note page, so the toolbar never covers the bin and save buttons
function makeRoomForToolbar() {
  const page = $("diary-note-page");
  if (page.hidden) return;
  page.style.paddingBottom = `${$("diary-toolbar-wrap").offsetHeight + 8}px`;
}

// Normally Chrome shrinks the page above the keyboard (the viewport setting in index.html).
// If a phone ignores that, lift the toolbar by the height the keyboard covers.
function liftToolbarAboveKeyboard() {
  const wrap = $("diary-toolbar-wrap");
  const view = window.visualViewport;
  if (!view || $("diary-note-page").hidden || view.scale > 1.01) { // zoomed in: leave it alone
    wrap.style.transform = "";
    return;
  }
  const covered = Math.round(window.innerHeight - view.height - view.offsetTop);
  wrap.style.transform = covered > 0 ? `translateY(${-covered}px)` : "";
}

// While typing near the bottom, scroll so the line being typed stays above the toolbar
function keepCaretAboveToolbar() {
  const selection = document.getSelection();
  if ($("diary-note-page").hidden || !selection.rangeCount) return;
  let spot = selection.getRangeAt(0).getBoundingClientRect();
  if (!spot.height) { // an empty line has no size, so measure the line itself
    const node = selection.focusNode;
    const line = node && (node.nodeType === Node.ELEMENT_NODE ? node : node.parentElement);
    if (!line) return;
    spot = line.getBoundingClientRect();
  }
  const toolbarTop = $("diary-toolbar-wrap").getBoundingClientRect().top;
  const writing = $("diary-text");
  const floor = Math.min(toolbarTop, writing.getBoundingClientRect().bottom);
  const overlap = spot.bottom - (floor - 8);
  if (overlap > 0) writing.scrollTop += overlap;   // Build 14.4: the writing scrolls, not the page
}

// Build 14.4: on the cover screen the title row steps aside while the keyboard is up and you are
// writing the note itself. It comes back when the keyboard closes, or as soon as you tap the title.
const COVER_KEYBOARD_HEIGHT = 430;   // the cover window is 530 tall; a keyboard takes it well below this

function setWritingMode() {
  const tight = onCoverScreen() && window.innerHeight < COVER_KEYBOARD_HEIGHT;
  const writing = document.activeElement === $("diary-text");
  $("diary-note-page").classList.toggle("is-writing", tight && writing);
}

for (const id of ["diary-text", "diary-title"]) {
  $(id).addEventListener("focusin", setWritingMode);
  $(id).addEventListener("focusout", setWritingMode);
}
window.addEventListener("resize", setWritingMode);          // the keyboard opening and closing
if (window.visualViewport) window.visualViewport.addEventListener("resize", setWritingMode);

if (window.ResizeObserver) new ResizeObserver(makeRoomForToolbar).observe($("diary-toolbar-wrap"));
if (window.visualViewport) {
  window.visualViewport.addEventListener("resize", liftToolbarAboveKeyboard);
  window.visualViewport.addEventListener("scroll", liftToolbarAboveKeyboard);
}

function wireEditor(editor) {
  editor.addEventListener("input", () => {
    $("diary-error").hidden = true;
    setWritingMode();        // settles the title row even if no resize event arrived
    keepCaretAboveToolbar();
  });
  editor.addEventListener("paste", (event) => { // pasted text always arrives plain
    event.preventDefault();
    const text = (event.clipboardData || window.clipboardData).getData("text/plain");
    document.execCommand("insertText", false, text);
  });
}

// A fresh editor element each time a note opens, so undo history starts clean for every note
function resetEditor(html) {
  const old = $("diary-text");
  const fresh = old.cloneNode(false);
  old.replaceWith(fresh);
  fresh.innerHTML = cleanNoteHtml(html);
  wireEditor(fresh);
  savedRange = null;
  closeColourStrip();
  updateToolbarState();
}

function noteHtmlOf(note) {
  return typeof note.html === "string" ? note.html : textToHtml(note.text || "");
}

wireEditor($("diary-text"));

// Build 14.3: the bar says when the note was last saved — "Last saved: 25 Sept 2026, 11:08"
function noteWhen(note) {
  const saved = note.updatedAt || note.createdAt || `${note.date}T00:00:00`;
  const when = new Date(saved);
  const day = shortDate(saved.slice(0, 10), true);   // written as everywhere else in the app
  const time = when.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
  return `Last saved: ${day}, ${time}`;
}

function noteFields() {
  const html = cleanNoteHtml($("diary-text").innerHTML);
  return { title: $("diary-title").value.trim(), html, text: htmlToText(html) };
}

function noteIsDirty() {
  const now = noteFields();
  return now.title !== noteOpenedWith.title || now.html !== noteOpenedWith.html; // formatting-only changes count
}

function showNoteError(message) {
  $("diary-error").textContent = message;
  $("diary-error").hidden = false;
}

function openNoteEditor(note) {
  editingNoteId = note ? note.id : null;
  $("diary-title").value = note ? note.title || "" : "";
  resetEditor(note ? noteHtmlOf(note) : "");
  // Build 14.2: the bar holds the date; a note that has never been saved shows nothing there
  $("diary-when").textContent = note ? noteWhen(note) : "";
  $("diary-when").hidden = !note;
  closeNoteMenu();            // Build 14.4: ⋯ is always in the bar; its items wake up once the note is saved
  $("diary-error").hidden = true;
  clearTimeout(savedTimer);
  $("diary-saved").hidden = true;
  showSaveIcon();
  noteOpenedWith = noteFields();
  leavingNote = false;
  savingNote = false;
  applyPages("note");
  makeRoomForToolbar();
  liftToolbarAboveKeyboard();
  history.pushState({ view: currentView, note: true }, ""); // so Back closes the writing page
  // On the cover screen a new note starts in the writing: there is no room for the title with the
  // keyboard up, and the keyboard's own suggestion row only appears for a text field.
  const startInWriting = Boolean(note) || onCoverScreen();
  (startInWriting ? $("diary-text") : $("diary-title")).focus();
  setWritingMode();
}

function openNote(id) {
  let note;
  try {
    note = diaryStore.load().find((n) => n.id === id);
  } catch (err) {
    console.error(err);
  }
  if (!note) return;
  if ($("diary-log-dialog").open) $("diary-log-dialog").close(); // the writing page is a full page, not a pop-up
  openNoteEditor(note);
}

$("diary-new").addEventListener("click", () => openNoteEditor(null));
$("close-note").addEventListener("click", () => history.back());

$("diary-title").addEventListener("input", () => ($("diary-error").hidden = true));

// Used by the Save button and by Back. Returns "saved", "nothing" or "failed".
function saveNoteNow() {
  if (savingNote) return "nothing";
  const { title, text, html } = noteFields();
  // Nothing worth saving: an empty new note, or an existing note whose boxes were cleared (left as it was)
  if (!title && !text) return "nothing";
  if (text.length > NOTE_MAX_CHARS) {
    showNoteError(`This note is too long to save (${NOTE_MAX_CHARS.toLocaleString("en-US")} characters max). Your writing is still here.`);
    return "failed";
  }
  savingNote = true;
  const finalTitle = title || text.split("\n")[0].slice(0, 60);
  try {
    if (editingNoteId) {
      diaryStore.update(editingNoteId, { title: finalTitle, text, html });
    } else {
      const id = newId();
      diaryStore.add({ id, title: finalTitle, text, html, date: todayISO(), createdAt: new Date().toISOString() });
      editingNoteId = id; // later saves update this note instead of adding another
    }
  } catch (err) {
    console.error(err);
    savingNote = false;
    showNoteError("Sorry, this note couldn't be saved. Your writing is still here.");
    return "failed";
  }
  savingNote = false;
  renderDiary();
  return "saved";
}

// After a save the page stays open: it now edits that note, and nothing counts as unsaved
function markNoteSaved() {
  let note;
  try {
    note = diaryStore.load().find((n) => n.id === editingNoteId);
  } catch (err) {
    console.error(err);
  }
  if (note) {
    $("diary-when").textContent = noteWhen(note);
    $("diary-when").hidden = false;
  }
  noteOpenedWith = noteFields();
}

let savedTimer;

// Build 24.3: Save is a PAIR, not one icon. The arrow asks and the tick answers — three marks
// become one, and the colour goes to Deep Sage. A floppy disk was the one object in this app
// with no counterpart on paper. No animation: the swap happens on the next paint.
const SAVE_ICON = '<svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><path d="M12 3.5v11M7.4 10.2 12 14.8l4.6-4.6M4.5 19.5h15" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>';
const SAVED_ICON = '<svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><path d="M4.5 12.8 9.6 18 19.5 6.6" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>';

function showSaveIcon() {
  $("save-note").innerHTML = SAVE_ICON;
  $("save-note").classList.remove("is-saved");
  $("save-note").setAttribute("aria-label", "Save");
}

// Build 14.2: saving turns the disk into a tick for a moment, then back
function showSaved() {
  clearTimeout(savedTimer);
  const status = $("diary-saved");
  status.hidden = false;                 // heard by a screen reader, not seen
  $("save-note").innerHTML = SAVED_ICON;
  $("save-note").classList.add("is-saved");
  $("save-note").setAttribute("aria-label", "Saved");
  savedTimer = setTimeout(() => {
    showSaveIcon();
    status.hidden = true;
  }, 2000);
}

$("save-note").addEventListener("click", () => {
  $("diary-error").hidden = true;
  if (editingNoteId && !noteIsDirty()) {
    showSaved(); // nothing new to save
    return;
  }
  const result = saveNoteNow();
  if (result === "failed") return;
  if (result === "nothing") {
    showNoteError("Write something first.");
    return;
  }
  markNoteSaved();
  showSaved();
});

// ---------- The ⋯ menu on the note page (Build 14.2): pin and delete ----------

function noteIsPinned() {
  try {
    return Boolean(diaryStore.load().find((n) => n.id === editingNoteId)?.pinned);
  } catch (err) {
    console.error(err);
    return false;
  }
}

function closeNoteMenu() {
  $("note-menu").hidden = true;
  $("note-menu-btn").setAttribute("aria-expanded", "false");
}

function openNoteMenu() {
  const saved = Boolean(editingNoteId);      // pinning and deleting need a note that exists
  const pinned = saved && noteIsPinned();
  $("note-pin-item").innerHTML = pinned ? UNPIN_ICON : PIN_ICON;   // the same icons the list swipe shows
  $("note-pin-item").setAttribute("aria-label", pinned ? "Unpin" : "Pin");
  $("note-delete-item").innerHTML = BIN_ICON;
  for (const item of [$("note-pin-item"), $("note-delete-item")]) {
    item.setAttribute("aria-disabled", saved ? "false" : "true");
    item.disabled = !saved;
  }
  $("note-menu").hidden = false;
  $("note-menu-btn").setAttribute("aria-expanded", "true");
}

$("note-menu-btn").addEventListener("click", (event) => {
  event.stopPropagation();
  if ($("note-menu").hidden) openNoteMenu();
  else closeNoteMenu();
});

document.addEventListener("click", (event) => {   // a tap anywhere else closes it
  if (!$("note-menu").hidden && !$("note-menu").contains(event.target)) closeNoteMenu();
});

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && !$("note-menu").hidden) closeNoteMenu();
});

$("note-pin-item").addEventListener("click", () => {
  if (!editingNoteId) return;
  togglePin(editingNoteId);
  closeNoteMenu();
});

$("note-delete-item").addEventListener("click", () => {
  if (!editingNoteId) return;
  closeNoteMenu();
  askDeleteNote(editingNoteId);
});

// Build 14.6: pulling down no longer refreshes, so the build line reloads the app instead
$("build-info").addEventListener("click", () => window.location.reload());

// ---------- Keeping the field you type in above the sheet's buttons (Build 14.5) ----------
// The Cancel / Save row is pinned to the bottom of the sheet, and on the cover screen the keyboard
// leaves so little room that a focused field can end up behind it.

function keepFieldAboveActions(sheet, field) {
  // the sheet's own Cancel / Save row, not the delete question's buttons hidden inside it
  const actions = sheet.querySelector("#form-actions, #saving-form-actions");
  if (!actions || !actions.offsetHeight) return;
  const overlap = field.getBoundingClientRect().bottom - (actions.getBoundingClientRect().top - 8);
  if (overlap > 0) sheet.scrollTop += overlap;
}

for (const id of ["add-dialog", "saving-dialog"]) {
  const sheet = $(id);
  sheet.addEventListener("focusin", (event) => {
    const field = event.target.closest(".field, .amount-row, .sheet-pair") || event.target;
    // twice: once now, and again after the keyboard has had time to shrink the sheet
    keepFieldAboveActions(sheet, field);
    setTimeout(() => keepFieldAboveActions(sheet, field), 250);
  });
}

if (window.visualViewport) {
  window.visualViewport.addEventListener("resize", () => {   // the keyboard opening mid-typing
    const active = document.activeElement;
    const sheet = active && active.closest ? active.closest("dialog.sheet") : null;
    if (sheet) keepFieldAboveActions(sheet, active.closest(".field, .amount-row, .sheet-pair") || active);
  });
}

// ---------- Settings page ----------

const rateInputs = { USD: $("rate-USD"), THB: $("rate-THB") };
let pendingRestore = null; // a checked backup waiting for "Yes, restore"

function showSettingsStatus(id, message, isProblem = false) {
  $(id).textContent = message;
  $(id).classList.toggle("is-problem", isProblem);
  $(id).hidden = false;
}

function fillRateInputs() {
  const rates = loadRates();
  for (const [code, input] of Object.entries(rateInputs)) {
    input.value = rates[code] ? formatWhileTyping(String(rates[code]), 2) : "";
  }
}

// Build 12.4: the cover screen uses the wireframe's shorter labels

// ---------- Build 24.6: Settings folds on the cover screen ----------
// The cover has 269px of usable height against 379 of content, and scrolling put the cut
// 31px into the Backup / Restore button row — half a button, which reads as broken rather
// than as "more below". So on the cover the two sections become rows that open a sheet.
// The SECTIONS THEMSELVES move in and out, so there is exactly one copy of every field and
// every listener keeps working; cloning would have left two #rate-USD inputs on the page.
function applySettingsLayout() {
  const short = onCoverScreen();
  const page = $("settings-page");
  $("settings-rows").hidden = !short;

  for (const [section, slot] of [["rates-section", "rates-slot"], ["backup-section", "backup-slot"],
    ["export-section", "export-slot"]]) {
    const node = $(section);
    const home = short ? $(slot) : page;
    if (node.parentElement === home) continue;
    if (short) home.append(node);
    else page.insertBefore(node, page.querySelector(".build-foot"));   // back above the build line,
    // in loop order — inserting both at the same anchor put the second one ABOVE the first,
    // so Settings came back from the cover screen with Backup before Exchange rates.
    node.hidden = false;
  }
  // a heading inside its own sheet repeats the sheet's title, so it steps aside there
  $("rates-section").querySelector(".section-label").hidden = short;
  $("backup-section").querySelector(".section-label").hidden = short;
  $("export-section").querySelector(".section-label").hidden = short;
  if (!short) {
    for (const id of ["rates-sheet", "backup-sheet", "export-sheet"]) if ($(id).open) $(id).close();
  }
}

$("open-rates-sheet").addEventListener("click", () => { cancelRestore(); $("rates-sheet").showModal(); });
$("open-export-sheet").addEventListener("click", () => { cancelRestore(); $("export-sheet").showModal(); });
$("open-backup-sheet").addEventListener("click", () => { cancelRestore(); $("backup-sheet").showModal(); });

function applyCoverWording() {
  const short = onCoverScreen();
  // Build 16.9: the rate labels read "1 USD =" on both screens now, so they stay in the HTML
  // Build 24.5: write the WORD, not the whole heading — textContent here wiped the drawing
  // and the swipe the markup carries. Sentence case: one capital.
  $("backup-heading").querySelector("span").textContent = short ? "Backup" : "Backup & restore";
  const built = `Build ${BUILD.number} · ${shortDate(BUILD.date, true)}`;
  $("build-info").textContent = short ? built : `My Journal · ${built}`;
  applySettingsLayout();
}

function openSettings() {
  fillRateInputs();
  showLastBackup();
  applyCoverWording();
  for (const id of ["rates-error", "rates-status", "backup-status"]) $(id).hidden = true;
  cancelRestore();
  applyPages("settings");
  history.pushState({ view: currentView, settings: true }, ""); // so the phone's Back gesture closes Settings
}

for (const button of document.querySelectorAll(".open-settings")) button.addEventListener("click", openSettings);
$("close-settings").addEventListener("click", () => history.back());

// Back / forward (← Back, ⌂ and the phone's Back gesture) all land here
window.addEventListener("popstate", (event) => {
  const state = event.state || { view: "home" };
  if (state.settings) {
    fillRateInputs();
    applyPages("settings");
    return;
  }
  if (state.note) {
    applyPages("note");
    return;
  }
  // Back with unsaved writing saves it, exactly like tapping Save
  if (!$("diary-note-page").hidden && !leavingNote && noteIsDirty()) {
    if (saveNoteNow() === "failed") {
      history.pushState({ view: currentView, note: true }, ""); // saving failed, so stay on the page
      return;
    }
  }
  const noteWasOpen = !$("diary-note-page").hidden;
  leavingNote = false;
  const settingsWasOpen = !$("settings-page").hidden;
  showView(VIEWS.includes(state.view) ? state.view : "home");
  if (settingsWasOpen) document.querySelector(`#${currentView}-page .open-settings`).focus();
  if (noteWasOpen) $("diary-new").focus();
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

function rememberBackupTime() {
  try {
    localStorage.setItem(LAST_BACKUP_KEY, new Date().toISOString());
  } catch (err) {
    console.error(err);
  }
  showLastBackup();
}

function showLastBackup() {
  let when = null;
  try {
    when = localStorage.getItem(LAST_BACKUP_KEY);
  } catch (err) {
    console.error(err);
  }
  if (!when) {
    $("last-backup").textContent = "No backup yet";
    return;
  }
  const made = new Date(when);
  const time = made.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
  $("last-backup").textContent = `Last backup: ${shortDate(when.slice(0, 10), true)}, ${time} · ${backupAge(when)}`;
}

// Build 16.9: your data lives on this phone only, so Settings says how long ago the last backup was.
// Counted in calendar days, not 24-hour blocks, so a backup at 23:00 last night reads "yesterday".
function backupAge(iso) {
  const startOfDay = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const days = Math.round((startOfDay(new Date()) - startOfDay(new Date(iso))) / 86400000);
  if (days <= 0) return "today";                 // <= 0 also covers a clock set backwards
  if (days === 1) return "yesterday";
  return `${days} days ago`;
}

function makeBackup() {
  return {
    format: BACKUP_FORMAT,
    version: 11, // 2 added My Skin, 3 the daily message, 4 the diary notes, 5 formatted notes + colours, 6 brain dump, 7 savings goals, 8 My Books, 9 income, 10 the edit history, 11 the car loan
    build: BUILD.number,
    exportedAt: new Date().toISOString(),
    expenses: expenseStore.load(),
    savings: savingsStore.load(),
    goals: goalStore.load(),
    books: bookStore.load(),
    income: incomeStore.load(),
    rates: loadRates(),
    skin: loadSkin(),
    daily: loadDaily(),
    diary: diaryStore.load(),
    colors: loadColours(),
    changes: loadChanges(),
    debt: loadDebt(),
  };
}

function backupSummary(backup) {
  const count = (n, word) => `${n} ${word}${n === 1 ? "" : "s"}`;
  // Build 19: thoughts are no longer counted. Brain dump stores nothing, and an older backup's
  // thoughts are ignored on restore — saying "1 thought" would claim something that didn't happen.
  // Build 23.3: income is counted too. Build 23 added it to the backup and to restore but not to
  // this sentence, which is the only confirmation you get that a restore worked.
  return `${count(backup.expenses.length, "expense")} · ${count((backup.income || []).length, "income")}`
    + ` · ${count(backup.savings.length, "saving")} · ${count((backup.diary || []).length, "note")}`;
}

// Build 27.2: the backup itself, lifted out of the Settings button so the Home nudge can run it
// too. Same code, two callers. Returns true only when a file really left — a cancelled share
// does NOT count, which is what keeps "it has been 90 days" honest.
async function runBackup(statusId) {
  $(statusId).hidden = true;
  let backup;
  try {
    backup = makeBackup();
  } catch (err) {
    console.error(err);
    showSettingsStatus(statusId, "Your saved data couldn't be read, so no backup was made.", true);
    return false;
  }

  // Build 9.8 put the TIME in the name so Chrome never asked "download again?". Build 27.2 takes
  // it out again: it meant every tap made a keeper, and ten taps in a month left ten files in
  // OneDrive forever. Date only, so a second backup the same day lands as "(1)" — visibly a
  // repeat rather than another thing to keep.
  const name = `my-journal-backup-${todayISO()}`;
  const contents = JSON.stringify(backup, null, 2);
  // Chrome on Android won't share a .json file, but it will share .txt. Same backup inside; Restore accepts both.
  const shareFile = new File([contents], `${name}.txt`, { type: "text/plain" });

  if (navigator.canShare && navigator.canShare({ files: [shareFile] })) {
    try {
      await navigator.share({ files: [shareFile], title: "My Journal backup" });
      rememberBackupTime();
      showSettingsStatus(statusId, `Backup shared \u2713 (${backupSummary(backup)})`);
      return true;
    } catch (err) {
      if (err.name === "AbortError") {
        showSettingsStatus(statusId, "Backup cancelled.");
        return false;
      }
      console.error(err); // sharing failed: fall back to saving the file
    }
  }

  const file = new File([contents], `${name}.json`, { type: "application/json" });
  const url = URL.createObjectURL(file);
  const link = el("a");
  link.href = url;
  link.download = file.name;
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
  rememberBackupTime();
  showSettingsStatus(statusId, `Sharing isn't available here, so the backup was saved to Downloads \u2713 (${backupSummary(backup)})`);
  return true;
}

$("backup-btn").addEventListener("click", async () => {
  await runBackup("backup-status");
  renderHome();      // the Home nudge may have just become unnecessary
});

// Restore: check the file, show what's in it, then replace everything after "Yes, restore"

function checkBackup(backup) {
  if (!backup || backup.format !== BACKUP_FORMAT || !Array.isArray(backup.expenses) || !Array.isArray(backup.savings)) {
    throw new Error("Not a My Journal backup");
  }
  // Build 23.1: a currency must be one the app knows. Savings have never carried one — they're
  // always shown in USD — so a missing currency stays fine; only a named unknown one is refused.
  const knownCurrency = (c) => c === undefined || CURRENCIES[c] !== undefined;
  const isEntry = (e) => e && typeof e.id === "string" && typeof e.amount === "number" && typeof e.date === "string"
    && knownCurrency(e.currency);
  if (!backup.expenses.every(isEntry) || !backup.savings.every(isEntry)) {
    throw new Error("Backup has damaged entries");
  }
  // Backups made before My Skin existed (version 1) have no "skin", and those leave My Skin untouched
  if (backup.skin !== undefined && (typeof backup.skin !== "object" || backup.skin === null || Array.isArray(backup.skin))) {
    throw new Error("Backup has damaged skin days");
  }
  if (backup.daily !== undefined && (typeof backup.daily !== "object" || backup.daily === null || Array.isArray(backup.daily))) {
    throw new Error("Backup has a damaged daily message");
  }
  // Backups made before My Diary existed (version 3 and older) have no "diary", and those leave notes untouched
  if (backup.diary !== undefined && (!Array.isArray(backup.diary)
    || !backup.diary.every((n) => n && typeof n.id === "string" && (n.html === undefined || typeof n.html === "string")))) {
    throw new Error("Backup has damaged notes");
  }
  // Backups made before Build 9.6 (version 4 and older) have no "colors", and those leave your colours untouched
  if (backup.colors !== undefined && (typeof backup.colors !== "object" || backup.colors === null || Array.isArray(backup.colors))) {
    throw new Error("Backup has damaged colours");
  }
  // Backups made before Build 23 (version 8 and older) have no "income", and those leave Income untouched
  if (backup.income !== undefined && (!Array.isArray(backup.income)
    || !backup.income.every(isEntry))) {
    throw new Error("Backup has damaged income");
  }
  // Backups made before Build 27 (version 10 and older) have no "debt", and those leave the car loan untouched
  if (backup.debt !== undefined && (typeof backup.debt !== "object" || backup.debt === null
    || Array.isArray(backup.debt)
    || !["target", "paidBefore"].every((k) => backup.debt[k] === undefined || typeof backup.debt[k] === "number"))) {
    throw new Error("Backup has a damaged car loan");
  }
  // Backups made before Build 22 (version 7 and older) have no "books", and those leave My Books untouched
  if (backup.books !== undefined && (!Array.isArray(backup.books)
    || !backup.books.every((b) => b && typeof b.id === "string" && typeof b.title === "string"))) {
    throw new Error("Backup has damaged books");
  }
  // Backups made before Build 21 (version 6 and older) have no "goals", and those leave your goals untouched
  // Build 26.1: an id must look like one. Every id the app makes is a UUID or letters and digits,
  // so this refuses nothing real — but it stops a hand-made backup smuggling markup in as an id.
  const plainId = (v) => typeof v === "string" && /^[A-Za-z0-9_-]{1,64}$/.test(v);
  if (backup.goals !== undefined && (!Array.isArray(backup.goals)
    || !backup.goals.every((g) => g && plainId(g.id) && typeof g.name === "string"))) {
    throw new Error("Backup has damaged goals");
  }
  // Backups made before Brain dump (version 5 and older) have no "braindump", and those leave To keep untouched
  if (backup.braindump !== undefined && (!Array.isArray(backup.braindump)
    || !backup.braindump.every((t) => t && typeof t.id === "string" && typeof t.text === "string"))) {
    throw new Error("Backup has damaged thoughts");
  }
  // Backups made before Build 23.4 (version 9 and older) have no "changes", and those leave the edit history untouched
  if (backup.changes !== undefined && (!Array.isArray(backup.changes)
    || !backup.changes.every((c) => c && typeof c.at === "string" && typeof c.what === "string"))) {
    throw new Error("Backup has a damaged edit history");
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

// Every screen drawn again from storage, after a restore puts new data there
function redrawEverything() {
  renderDashboard();
  renderIncome();
  renderSavings();
  renderSkin();
  renderDiary();
  renderBooks();
  renderHome();
  fillRateInputs();
}

// ---------- The spare copies on screen (Build 27.2) ----------

let pendingSnapshot = null;      // a spare copy waiting for "Yes"

function snapshotLabel(s) {
  const day = shortDate(String(s.at).slice(0, 10), true);
  const time = new Date(s.at).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
  return s.reason === "before restore"
    ? `${day}, ${time} \u00b7 before a restore`
    : `${day}, ${time}`;
}

function cancelSnapshotRestore() {
  pendingSnapshot = null;
  toggleConfirm("snapshot-confirm", "snapshot-list", false);
}

function renderSnapshots() {
  const list = loadSnapshots().slice().reverse();    // newest first
  $("snapshot-none").hidden = list.length > 0;
  $("snapshot-list").replaceChildren(...list.map((snap) => {
    const li = el("li", "snap-row");
    const btn = el("button", "snap-btn");
    btn.type = "button";
    btn.append(el("span", "", snapshotLabel(snap)), el("span", "snap-go", "Restore"));
    btn.addEventListener("click", () => {
      pendingSnapshot = snap;
      $("snapshot-summary").textContent = `Go back to ${snapshotLabel(snap)}?`;
      $("snapshot-status").hidden = true;
      toggleConfirm("snapshot-confirm", "snapshot-list", true);
    });
    li.append(btn);
    return li;
  }));
}

$("snapshot-no").addEventListener("click", cancelSnapshotRestore);

$("snapshot-yes").addEventListener("click", () => {
  if (!pendingSnapshot) return;
  const snap = pendingSnapshot;
  // Going back is itself a restore, so it gets its own spare copy first \u2014 otherwise picking the
  // wrong day would be the one move in the app with no way back.
  takeSnapshot("before restore");
  cancelSnapshotRestore();
  if (applyBackup(snap.data, "snapshot-status", `Spare copy from ${snapshotLabel(snap)}`)) {
    showSettingsStatus("snapshot-status", `Went back to ${snapshotLabel(snap)} \u2713`);
  }
  renderSnapshots();
});

// Build 27.2: the restore itself, lifted out of the button so a spare copy can use the same path.
// Every guard stays: the rollback, the redraw inside the safety net, and the history entry.
function applyBackup(backup, statusId, sourceLabel) {
  const keys = [STORAGE_KEY, SAVINGS_KEY, RATES_KEY, SKIN_DATA_KEY, DAILY_KEY, DIARY_KEY, COLOURS_KEY, BRAIN_KEY, GOALS_KEY, BOOKS_KEY, INCOME_KEY, CHANGES_KEY, DEBT_KEY];
  const before = keys.map((key) => localStorage.getItem(key));
  try {
    expenseStore.save(backup.expenses);
    // Build 21: version 7 carries your goals. An older backup has none, so your goals are left
    // alone (the usual rule) and its savings — which still name their goal — are linked by name.
    if (backup.goals) goalStore.save(backup.goals);
    if (backup.books) bookStore.save(backup.books);   // an older backup has none, so My Books is left alone
    if (backup.income) incomeStore.save(backup.income);  // likewise Income
    savingsStore.save(backup.goals ? backup.savings : linkSavingsByName(backup.savings));
    if (backup.rates) saveRates({ ...DEFAULT_RATES, ...backup.rates });
    if (backup.skin) saveSkin(backup.skin);
    if (backup.daily) saveDaily(backup.daily);
    if (backup.diary) diaryStore.save(backup.diary.map(convertNote)); // older notes converted, all notes cleaned
    if (backup.colors) saveColours({
      text: validColourRow(backup.colors.text, "text"),
      highlight: validColourRow(backup.colors.highlight, "highlight"),
    });
    // Build 23.4: version 10 carries the edit history. An older backup has none, so yours is left
    // alone — the same rule every other section follows.
    if (backup.changes) localStorage.setItem(CHANGES_KEY, JSON.stringify(backup.changes));
    // Build 27: version 11 carries the car loan. An older backup has none, so yours is left alone.
    if (backup.debt) saveDebt({ target: Number(backup.debt.target) || 0, paidBefore: Number(backup.debt.paidBefore) || 0 });
    // Build 19: an older backup's "braindump" is ignored on purpose — Brain dump stores nothing now
  } catch (err) {
    console.error(err);
    // Put everything back the way it was
    keys.forEach((key, i) => (before[i] === null ? localStorage.removeItem(key) : localStorage.setItem(key, before[i])));
    showSettingsStatus(statusId, "Restore failed, so your data wasn't changed.", true);
    return false;
  }
  // Build 23.1: drawing used to sit outside the safety net, so a backup that saved but wouldn't
  // draw left the bad data in place and broke the app on every open. Now drawing is covered too.
  try {
    redrawEverything();
  } catch (err) {
    console.error(err);
    keys.forEach((key, i) => (before[i] === null ? localStorage.removeItem(key) : localStorage.setItem(key, before[i])));
    try {
      redrawEverything();   // back to what was on screen before
    } catch (err2) {
      console.error(err2);
    }
    showSettingsStatus(statusId, "Restore failed, so your data wasn't changed.", true);
    return false;
  }
  // Build 23.4: one entry for the restore itself, written LAST so the incoming history can't
  // overwrite it. It is the boundary marking where everything changed at once.
  appendChange({ at: new Date().toISOString(), what: "restore", label: sourceLabel });
  return true;
}

$("restore-yes").addEventListener("click", () => {
  if (!pendingRestore) return;
  const backup = pendingRestore;
  // Build 27.2: a spare copy taken a second before the most dangerous button in the app, so a
  // restore you regret can be undone. Taken BEFORE cancelRestore so nothing can clear it first.
  takeSnapshot("before restore");
  cancelRestore();
  const label = `Backup from ${backup.exportedAt ? shortDate(backup.exportedAt.slice(0, 10), true) : "an unknown date"}`;
  if (applyBackup(backup, "backup-status", label)) {
    showSettingsStatus("backup-status", `Restored \u2713 (${backupSummary(backup)})`);
    renderSnapshots();
  }
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
  $("savings-total").textContent = onCoverScreen() ? formatWhole(total, "USD") : formatMoney(total, "USD");

  // Build 12.2: a jar per goal, filling from the bottom with its percentage inside
  const everyGoal = loadGoals();
  const shown = everyGoal.filter((g) => !g.hidden);
  const hiddenCount = everyGoal.length - shown.length;

  $("goals").replaceChildren(
    ...shown.map((g) => {
      const saved = savedForGoal(g.id, all);
      // Build 16.4: rounds down, so 100% only means reached.
      // Build 27.1: clamped at 0 too — take out more than you put in and the fill would otherwise
      // be given a negative height.
      const percent = Math.max(0, Math.min(100, g.target ? Math.floor((saved / g.target) * 100) : 0));

      const jar = el("div", "jar");
      jar.setAttribute("role", "progressbar");
      jar.setAttribute("aria-label", `${g.name} progress`);
      jar.setAttribute("aria-valuemin", "0");
      jar.setAttribute("aria-valuemax", String(g.target));
      jar.setAttribute("aria-valuenow", String(Math.max(0, Math.min(saved, g.target))));   // Build 27.1: aria-valuemin is 0, so a withdrawn-below-zero jar must not report less
      // Build 24.1: a drawn mason jar — shoulders, neck and screw band — filling with the marker
      // colour. One clipPath per jar, so the fill rises inside the outline instead of in a box.
      // The percentage is ink on the fill at 5.89:1 and ink on the paper at 8.87:1, so unlike
      // Build 18's jar it never has to flip to white halfway up.
      // Build 26.1: the id is a counter, not the goal's own id. A restored backup can carry any
      // string as an id, and this one is written straight into innerHTML below — so a crafted
      // backup could put its own markup on the page. The colour below still hashes the real id,
      // which only ever reads it. See checkBackup, which now refuses an id that isn't plain.
      const clipId = `jar-clip-${++jarClipSeq}`;
      // Build 24.10, your request: a colour per goal, chosen for you. It is picked from the
      // goal's OWN id, not at random each render — a jar that changed colour every time the
      // page drew would be worse than one colour for all of them. Same id, same colour, always.
      let hash = 0;
      for (const ch of String(g.id)) hash = (hash * 131 + ch.charCodeAt(0)) >>> 0;
      const fill = JAR_FILLS[hash % JAR_FILLS.length];
      const shape = "M9 34c0-7 5-11 9-15V13h26v6c4 4 9 8 9 15v46a7 7 0 0 1-7 7H16a7 7 0 0 1-7-7Z";
      jar.innerHTML = `<svg viewBox="0 0 62 93" width="62" height="93" aria-hidden="true">
          <defs><clipPath id="${clipId}"><path d="${shape}"/></clipPath></defs>
          <rect x="0" y="${93 - (93 * percent) / 100}" width="62" height="${(93 * percent) / 100}"
                fill="${fill}" clip-path="url(#${clipId})"/>
          <path d="${shape}" fill="none" stroke="var(--ink)" stroke-width="1.6"/>
          <rect x="16" y="1" width="30" height="12" rx="2.5" fill="none" stroke="var(--ink)" stroke-width="1.6"/>
          <path d="M16 5.5h30M16 9h30" stroke="var(--ink)" stroke-width="1" opacity=".55"/>
          <text x="31" y="62" text-anchor="middle" fill="var(--ink)" font-size="16">${percent}%</text>
        </svg>`;

      const text = el("div", "goal-text");
      text.append(
        el("div", "goal-name", g.name),
        el("div", "goal-amount", `${formatWhole(saved, "USD")} of ${formatWhole(g.target, "USD")}`),
        el("div", "small", goalStatus(saved, g))
      );

      const row = el("button", "goal-row");       // Build 21: tap a goal to edit it
      row.type = "button";
      row.append(jar, text);
      row.addEventListener("click", () => openGoalEdit(g.id));
      return row;
    })
  );

  // Build 21: the hidden line appears only once something is hidden, so until then nothing changes
  $("show-hidden-goals").hidden = hiddenCount === 0;
  $("show-hidden-goals").textContent = `Show hidden (${hiddenCount})`;

  sortedSavings = [...all].sort((a, b) => b.date.localeCompare(a.date) || (b.createdAt || "").localeCompare(a.createdAt || ""));
  $("saving-log").replaceChildren(...sortedSavings.slice(0, RECENT_LOG_COUNT).map(savingRow));
  $("open-saving-log").hidden = sortedSavings.length <= RECENT_LOG_COUNT;
  $("saving-log-empty").textContent = loadProblem ? "Your saved savings couldn't be read." : "No savings yet.";
  $("saving-log-empty").hidden = sortedSavings.length > 0;
  renderFullSavingLog();
}

// Same as the spreadsheet: months left = still needed ÷ monthly (rounded up), finish = this month + months left
function goalStatus(saved, goal) {
  const remaining = Math.round((goal.target - saved) * 100) / 100;
  if (remaining <= 0) return "Goal reached ✓";
  if (!(goal.monthly > 0)) return "";
  const months = Math.ceil(remaining / goal.monthly);
  const today = new Date();
  const finish = new Date(today.getFullYear(), today.getMonth() + months, 1)
    .toLocaleDateString("en-US", { month: "short", year: "numeric" });
  if (onCoverScreen()) return `${months} mo left`;   // the cover screen keeps it short
  return `${months} ${months === 1 ? "month" : "months"} left · about ${finish}`;
}

function savingRow(s) {
  const row = el("button", "log-row with-year");
  row.type = "button";
  const goal = el("span", "log-item");
  goal.append(el("span", "", s.goalId ? goalName(s.goalId) : s.goal || ""));
  // Build 27.1: a withdrawal says so under the goal's name, and the amount carries the minus —
  // the sign keeps the column addable, the word stops it reading as a typo. A note you wrote wins
  // that line: the minus sign already says which way the money went, so nothing is lost.
  if (s.note) goal.append(el("span", "small", s.note));
  else if (s.amount < 0) goal.append(el("span", "small", "Took out"));
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

function fillSavingForm(keepGoalId = null) {
  // Build 21: chips come from your goals. A hidden goal is left out, unless you're editing a
  // saving that belongs to it — then its chip stays so the saving is still editable.
  const list = loadGoals().filter((g) => !g.hidden || g.id === keepGoalId);
  $("goal-choices").replaceChildren(...list.map((g) => choiceButton("goal", g.id, g.name)));
}

function resetSavingForm() {
  savingForm.reset();          // form.reset() restores the checked="" default, i.e. Put in
  savingDateEl.value = todayISO();
  for (const id of ["goal-error", "saving-amount-error", "saving-error", "saving-too-much"]) $(id).hidden = true;
}

// Build 27.1: taking money out is a saving with a NEGATIVE amount. The jar, the savings total and
// the goal lines all just add up `amount`, so none of them needed changing — a withdrawal reduces
// them by itself. You type a positive number and choose the direction; the sign is added on save.
// Build 27.1: you cannot take out more than the jar holds — so a jar at $0 cannot be taken from
// at all. The entry BEING EDITED is left out of the balance: a $1,000 withdrawal that already
// emptied its jar must still be editable, and counting it against itself would refuse its own value.
function goalBalanceExcluding(goalId, excludeId) {
  try {
    return savingsStore.load()
      .filter((sv) => sv.goalId === goalId && sv.id !== excludeId)
      .reduce((sum, sv) => sum + sv.amount, 0);
  } catch (err) {
    console.error(err);
    return 0;      // can't read the savings: treat the jar as empty rather than allow a blind withdrawal
  }
}

function savingDirection() {
  const checked = savingForm.querySelector('input[name="dir"]:checked');
  return checked && checked.value === "out" ? "out" : "in";
}

function setSavingDirection(dir) {
  const radio = savingForm.querySelector(`input[name="dir"][value="${dir}"]`);
  if (radio) radio.checked = true;
  updateSavingTitle();
}

function updateSavingTitle() {
  const out = savingDirection() === "out";
  $("saving-title").textContent = editingSavingId
    ? (out ? "Edit withdrawal" : "Edit saving")
    : (out ? "Take out" : "Add saving");
}

function setSavingMode(id) {
  editingSavingId = id;
  updateSavingTitle();
  $("delete-saving").hidden = !id;
  toggleConfirm("saving-delete-confirm", "saving-form-actions", false);
}

function openAddSaving() {
  fillSavingForm();
  resetSavingForm();
  setSavingDirection("in");
  setSavingMode(null);
  applyDateControls();
  savingDialog.showModal();
}

function openSavingEdit(id) {
  let saving;
  try {
    saving = savingsStore.load().find((s) => s.id === id);
  } catch (err) {
    console.error(err);
  }
  if (!saving) return;

  fillSavingForm(saving.goalId);
  resetSavingForm();
  setSavingMode(id);
  const radio = savingForm.querySelector(`input[name="goal"][value="${CSS.escape(saving.goalId || "")}"]`);
  if (radio) radio.checked = true;
  // Build 27.1: the sign lives on the chips, not in the box — so the box shows what you typed.
  setSavingDirection(saving.amount < 0 ? "out" : "in");
  savingAmountEl.value = formatWhileTyping(String(Math.abs(saving.amount)), 2);
  savingDateEl.value = saving.date;
  savingNoteEl.value = saving.note || "";
  applyDateControls();
  savingDialog.showModal();
}

// ---------- Spreadsheet export (Build 26) ----------
// Your money as a real Excel workbook with three tabs, for analysing outside the app.
// Written by hand on purpose: an .xlsx is a ZIP of XML, and adding a library would end the
// "no third-party code at all" property the Build 23.1 security review called out. Nothing here
// is clever — a ZIP with STORED (uncompressed) entries needs only a CRC32, which is below.

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[i] = c >>> 0;
  }
  return table;
})();

function crc32(bytes) {
  let c = 0xffffffff;
  for (let i = 0; i < bytes.length; i++) c = CRC_TABLE[(c ^ bytes[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

// A ZIP of stored entries. No compression, so there is no deflate to get wrong.
function zipStored(files) {
  const enc = new TextEncoder();
  const parts = [];
  const central = [];
  let offset = 0;

  const u16 = (n) => [n & 0xff, (n >>> 8) & 0xff];
  const u32 = (n) => [n & 0xff, (n >>> 8) & 0xff, (n >>> 16) & 0xff, (n >>> 24) & 0xff];

  for (const { name, text } of files) {
    const nameBytes = enc.encode(name);
    const data = enc.encode(text);
    const sum = crc32(data);
    const local = [
      ...u32(0x04034b50), ...u16(20), ...u16(0), ...u16(0), ...u16(0), ...u16(0),
      ...u32(sum), ...u32(data.length), ...u32(data.length),
      ...u16(nameBytes.length), ...u16(0),
    ];
    parts.push(new Uint8Array(local), nameBytes, data);
    central.push({ name: nameBytes, sum, size: data.length, offset });
    offset += local.length + nameBytes.length + data.length;
  }

  const dir = [];
  for (const e of central) {
    dir.push(...u32(0x02014b50), ...u16(20), ...u16(20), ...u16(0), ...u16(0), ...u16(0), ...u16(0),
      ...u32(e.sum), ...u32(e.size), ...u32(e.size),
      ...u16(e.name.length), ...u16(0), ...u16(0), ...u16(0), ...u16(0), ...u32(0), ...u32(e.offset));
    dir.push(...e.name);
  }
  const dirBytes = new Uint8Array(dir);
  const end = new Uint8Array([
    ...u32(0x06054b50), ...u16(0), ...u16(0),
    ...u16(central.length), ...u16(central.length),
    ...u32(dirBytes.length), ...u32(offset), ...u16(0),
  ]);
  return new Blob([...parts, dirBytes, end], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
}

// Build 26.1: XML forbids most control characters outright — escaping them isn't enough, and one
// stray character in one note made the whole workbook unopenable. Tab, newline and return are the
// three it allows, so they stay; the rest are dropped.
const xmlEscape = (v) => String(v)
  .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "")
  .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
  .replace(/"/g, "&quot;").replace(/'/g, "&apos;");

// Excel counts days from 30 Dec 1899. A real date, not text, so you can pivot by month.
function excelSerial(iso) {
  const [y, m, d] = String(iso).split("-").map(Number);
  if (!y || !m || !d) return null;
  return Math.round((Date.UTC(y, m - 1, d) - Date.UTC(1899, 11, 30)) / 86400000);
}

function sheetXml(rows) {
  const colLetter = (i) => {
    let s = "", n = i;
    do { s = String.fromCharCode(65 + (n % 26)) + s; n = Math.floor(n / 26) - 1; } while (n >= 0);
    return s;
  };
  const body = rows.map((row, r) => {
    const cells = row.map((value, c) => {
      const ref = `${colLetter(c)}${r + 1}`;
      if (value && typeof value === "object" && value.date) {
        const serial = excelSerial(value.date);
        return serial === null
          ? `<c r="${ref}" t="inlineStr"><is><t>${xmlEscape(value.date)}</t></is></c>`
          : `<c r="${ref}" s="1"><v>${serial}</v></c>`;
      }
      if (typeof value === "number" && Number.isFinite(value)) return `<c r="${ref}"><v>${value}</v></c>`;
      if (value === "" || value === null || value === undefined) return `<c r="${ref}"/>`;
      return `<c r="${ref}" t="inlineStr"><is><t>${xmlEscape(value)}</t></is></c>`;
    }).join("");
    return `<row r="${r + 1}">${cells}</row>`;
  }).join("");
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>`
    + `<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">`
    + `<sheetData>${body}</sheetData></worksheet>`;
}

function buildWorkbook(sheets) {
  const files = [
    { name: "[Content_Types].xml", text: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>`
      + `<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">`
      + `<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>`
      + `<Default Extension="xml" ContentType="application/xml"/>`
      + `<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>`
      + `<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>`
      + sheets.map((_, i) => `<Override PartName="/xl/worksheets/sheet${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join("")
      + `</Types>` },
    { name: "_rels/.rels", text: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>`
      + `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">`
      + `<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>`
      + `</Relationships>` },
    { name: "xl/workbook.xml", text: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>`
      + `<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>`
      + sheets.map((s, i) => `<sheet name="${xmlEscape(s.name)}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`).join("")
      + `</sheets></workbook>` },
    { name: "xl/_rels/workbook.xml.rels", text: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>`
      + `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">`
      + sheets.map((_, i) => `<Relationship Id="rId${i + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i + 1}.xml"/>`).join("")
      + `<Relationship Id="rId${sheets.length + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>`
      + `</Relationships>` },
    // One style beyond the default: cell format 1 is a date (numFmtId 14), so dates read as dates.
    { name: "xl/styles.xml", text: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>`
      + `<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">`
      + `<numFmts count="1"><numFmt numFmtId="164" formatCode="yyyy-mm-dd"/></numFmts>`
      + `<fonts count="1"><font><sz val="11"/><name val="Calibri"/></font></fonts>`
      + `<fills count="1"><fill><patternFill patternType="none"/></fill></fills>`
      + `<borders count="1"><border/></borders>`
      + `<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>`
      + `<cellXfs count="2"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>`
      + `<xf numFmtId="164" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/></cellXfs>`
      + `<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>`
      + `</styleSheet>` },
  ];
  sheets.forEach((s, i) => files.push({ name: `xl/worksheets/sheet${i + 1}.xml`, text: sheetXml(s.rows) }));
  return zipStored(files);
}

// The three tabs. Column names say where each kip figure comes from, because they do not all
// come from the same place: a transaction freezes its rate, income and savings do not.
function moneySheets() {
  const rates = loadRates();
  // A goal can be deleted while its savings stay, so say which rows lost their goal.
  const goalName = (id) => { const g = goalById(id); return g ? g.name : "(goal removed)"; };
  const byDate = (a, b) => String(a.date).localeCompare(String(b.date));

  const expenses = [["Date", "Item", "Group", "Amount", "Currency", "Rate (frozen)", "Kip", "Note"]];
  for (const e of [...expenseStore.load()].sort(byDate)) {
    // Only a truly frozen rate goes in this column. The oldest entries pre-date rates and have
    // none; blank says so, rather than passing today's rate off as the one that was used.
    const frozen = typeof e.rate === "number" ? e.rate : "";
    expenses.push([{ date: e.date }, e.category || "", e.group || "", e.amount, e.currency || "",
      frozen, lakAmountOf(e, rates), e.note || ""]);
  }

  const income = [["Date", "Category", "Source", "Amount", "Currency", "Rate (today’s)", "Kip", "Note"]];
  for (const e of [...incomeStore.load()].sort(byDate)) {
    income.push([{ date: e.date }, e.category || "", e.source || "", e.amount, e.currency || "",
      rateFor(e.currency, rates) || "", lakAmountOf(e, rates), e.note || ""]);
  }

  const savings = [["Date", "Goal", "Amount", "Currency", "Rate (today’s)", "Kip", "Note"]];
  for (const e of [...savingsStore.load()].sort(byDate)) {
    savings.push([{ date: e.date }, goalName(e.goalId), e.amount, "USD",
      rateFor("USD", rates) || "", lakAmountOf({ ...e, currency: "USD" }, rates), e.note || ""]);
  }

  return [
    { name: "Expenses", rows: expenses },
    { name: "Income", rows: income },
    { name: "Savings", rows: savings },
  ];
}

$("export-btn").addEventListener("click", async () => {
  $("export-status").hidden = true;
  let sheets, blob;
  try {
    sheets = moneySheets();
    blob = buildWorkbook(sheets);
  } catch (err) {
    console.error(err);
    showSettingsStatus("export-status", "Your saved money data couldn’t be read, so nothing was exported.", true);
    return;
  }

  const counts = sheets.map((s) => `${s.rows.length - 1} ${s.name.toLowerCase()}`).join(" · ");
  const name = `my-money-${todayISO()}.xlsx`;
  const file = new File([blob], name, { type: blob.type });

  // Share first, as the backup does — and fall back to a download if Chrome refuses the type.
  if (navigator.canShare && navigator.canShare({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: "My Money" });
      showSettingsStatus("export-status", `Spreadsheet shared ✓ (${counts})`);
      return;
    } catch (err) {
      if (err.name === "AbortError") {
        showSettingsStatus("export-status", "Export cancelled.");
        return;
      }
      console.error(err);
    }
  }

  // Same pattern as the backup: the link has to be in the document to click, and the blob URL
  // must outlive the click — revoking it straight away cancels the download.
  const url = URL.createObjectURL(file);
  const link = document.createElement("a");
  link.href = url;
  link.download = name;
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
  showSettingsStatus("export-status", `Sharing isn’t available here, so the spreadsheet was saved to Downloads ✓ (${counts})`);
});

// ---------- Income (Build 23) ----------
// Mirrors the Expenses tab: the same month state, the same month card, a total per category and a
// log below. An entry is shaped like an expense plus a `source`. "Just a record of what came in" —
// deliberately NO balance against spending, because that is one step from budgets, which stay dropped.

const incomeCurrencyEl = $("income-currency");
const incomeAmountEl = $("income-amount");
const incomeDateEl = $("income-date");
const incomeNoteEl = $("income-note");
const incomeDialog = $("income-dialog");
let editingIncomeId = null;
let incomeThousandsOn = thousandsRemembered;

function fillIncomeForm() {
  for (const [code, { symbol }] of Object.entries(CURRENCIES)) {
    incomeCurrencyEl.add(new Option(`${symbol} ${code}`, code));
  }
  $("income-cat-choices").replaceChildren(...INCOME_CATEGORIES.map((c) => choiceButton("income-cat", c)));
  $("income-src-choices").replaceChildren(...INCOME_SOURCES.map((x) => choiceButton("income-src", x)));
}

function incomeThousandsApplies() {
  return incomeCurrencyEl.value === DEFAULT_CURRENCY;   // LAK only, as the Add transaction sheet
}

function showIncomeChip() {
  const chip = $("income-x1000");
  const preview = $("income-amount-preview");
  const applies = incomeThousandsApplies();
  chip.hidden = !applies;
  chip.setAttribute("aria-pressed", String(incomeThousandsOn));
  const typed = readAmount(incomeAmountEl.value, 0);
  const show = applies && incomeThousandsOn && typed > 0;
  preview.hidden = !show;
  if (show) preview.textContent = `= ${formatMoney(typed * 1000, DEFAULT_CURRENCY)}`;
}

$("income-x1000").addEventListener("click", () => {
  incomeThousandsOn = !incomeThousandsOn;
  thousandsRemembered = incomeThousandsOn;
  try {
    localStorage.setItem(THOUSANDS_KEY, incomeThousandsOn ? "on" : "off");
  } catch {}
  showIncomeChip();
  incomeAmountEl.focus();
});

incomeCurrencyEl.addEventListener("change", showIncomeChip);
incomeAmountEl.addEventListener("input", () => {
  incomeAmountEl.value = formatWhileTyping(incomeAmountEl.value, currencyInfo(incomeCurrencyEl.value).decimals);
  showIncomeChip();
});

function renderIncome() {
  const rates = loadRates();
  let all = [];
  let loadProblem = false;
  try {
    all = incomeStore.load();
  } catch (err) {
    console.error(err);
    loadProblem = true;
  }

  const key = monthKey(viewYear, viewMonth);   // the same month as the Expenses tab, on purpose
  const items = all
    .filter((e) => typeof e.date === "string" && e.date.startsWith(key))
    .map((e) => ({ ...e, lak: lakAmountOf(e, rates) }))
    .sort((a, b) => b.date.localeCompare(a.date) || (b.createdAt || "").localeCompare(a.createdAt || ""));
  const total = items.reduce((sum, e) => sum + e.lak, 0);

  const monthDate = new Date(viewYear, viewMonth, 1);
  $("income-month-label").textContent = onCoverScreen()
    ? `${monthDate.toLocaleDateString("en-US", { month: "short" })} ${viewYear}`
    : monthDate.toLocaleDateString("en-GB", { month: "long", year: "numeric" });
  $("income-total").textContent = formatMoney(total, "LAK");

  // Build 25.1: a category the list no longer carries still gets a row. Before this, income
  // whose category had been removed dropped out of the breakdown while still counting in the
  // month total — the money was there and nowhere, measured at ₭3,000,000 hidden. Build 23.3
  // fixed exactly this for expenses and never reached here. The rows must always sum to the total.
  const unknownCategories = [...new Set(
    items.filter((e) => !INCOME_CATEGORIES.includes(e.category)).map((e) => e.category)
  )];

  $("income-by-category").replaceChildren(
    ...INCOME_CATEGORIES.map((c) =>
      summaryRow(c, items.filter((e) => e.category === c).reduce((sum, e) => sum + e.lak, 0))),
    ...unknownCategories.map((c) =>
      summaryRow(c || "(no category)", items.filter((e) => e.category === c).reduce((sum, e) => sum + e.lak, 0)))
  );

  $("income-log").replaceChildren(...items.map(incomeRow));
  $("income-log-empty").textContent = loadProblem
    ? "Your saved income couldn\u2019t be read."
    : "No income this month.";
  $("income-log-empty").hidden = items.length > 0 && !loadProblem;
}

function incomeRow(e) {
  const row = el("button", "log-row");
  row.type = "button";
  const item = el("span", "log-item");
  item.append(el("span", "", e.category));
  // the source sits where an expense puts its note; a note of your own follows it
  const under = [e.source, e.note].filter(Boolean).join(" \u00b7 ");
  if (under) item.append(el("span", "small", under));
  row.append(el("span", "log-date", shortDate(e.date)), item, el("span", "log-amount", formatMoney(e.lak, "LAK")));
  row.addEventListener("click", () => openIncomeEdit(e.id));
  const li = el("li");
  li.append(row);
  return li;
}

function resetIncomeForm() {
  $("income-form").reset();
  incomeCurrencyEl.value = DEFAULT_CURRENCY;
  incomeDateEl.value = todayISO();
  for (const id of ["income-cat-error", "income-src-error", "income-amount-error", "income-error"]) $(id).hidden = true;
  toggleConfirm("income-delete-confirm", "income-form-actions", false);
  incomeThousandsOn = thousandsRemembered;
  showIncomeChip();
}

function openAddIncome() {
  editingIncomeId = null;
  $("income-title").textContent = "Add income";
  resetIncomeForm();
  $("delete-income").hidden = true;
  applyDateControls();
  incomeDialog.showModal();
}

function openIncomeEdit(id) {
  let entry;
  try {
    entry = incomeStore.load().find((e) => e.id === id);
  } catch (err) {
    console.error(err);
  }
  if (!entry) return;

  editingIncomeId = id;
  $("income-title").textContent = "Edit income";
  resetIncomeForm();
  const cat = $("income-form").querySelector(`input[name="income-cat"][value="${CSS.escape(entry.category)}"]`);
  if (cat) cat.checked = true;
  const src = $("income-form").querySelector(`input[name="income-src"][value="${CSS.escape(entry.source || "")}"]`);
  if (src) src.checked = true;
  incomeCurrencyEl.value = entry.currency;
  incomeAmountEl.value = formatWhileTyping(String(entry.amount), currencyInfo(entry.currency).decimals);
  incomeDateEl.value = entry.date;
  incomeNoteEl.value = entry.note || "";
  incomeThousandsOn = false;    // an edit shows the amount as saved, so it can never multiply twice
  showIncomeChip();
  $("delete-income").hidden = false;
  applyDateControls();
  incomeDialog.showModal();
}

$("income-form").addEventListener("submit", (event) => {
  event.preventDefault();
  const cat = $("income-form").querySelector('input[name="income-cat"]:checked');
  const src = $("income-form").querySelector('input[name="income-src"]:checked');
  const decimals = currencyInfo(incomeCurrencyEl.value).decimals;
  let amount = readAmount(incomeAmountEl.value, decimals);
  if (incomeThousandsApplies() && incomeThousandsOn) amount *= 1000;

  $("income-cat-error").hidden = Boolean(cat);
  $("income-src-error").hidden = Boolean(src);
  $("income-amount-error").hidden = amount > 0;
  $("income-error").hidden = true;
  if (!cat || !src || !(amount > 0)) return;

  const entry = {
    category: cat.value,
    source: src.value,
    amount,
    currency: incomeCurrencyEl.value,
    date: incomeDateEl.value || todayISO(),
    note: incomeNoteEl.value.trim(),
  };

  try {
    if (editingIncomeId) incomeStore.update(editingIncomeId, entry);
    else incomeStore.add({ id: newId(), ...entry, createdAt: new Date().toISOString() });
  } catch (err) {
    console.error(err);
    $("income-error").hidden = false;
    return;
  }

  incomeDialog.close();
  renderIncome();
});

$("delete-income").addEventListener("click", () => {
  toggleConfirm("income-delete-confirm", "income-form-actions", true);
  $("income-delete-no").focus();
});
$("income-delete-no").addEventListener("click", () => {
  toggleConfirm("income-delete-confirm", "income-form-actions", false);
});
$("income-delete-yes").addEventListener("click", () => {
  if (!editingIncomeId) return;
  try {
    incomeStore.remove(editingIncomeId);
  } catch (err) {
    console.error(err);
    toggleConfirm("income-delete-confirm", "income-form-actions", false);
    $("income-error").hidden = false;
    return;
  }
  incomeDialog.close();
  renderIncome();
});

$("income-prev-month").addEventListener("click", () => changeMonth(-1));
$("income-next-month").addEventListener("click", () => changeMonth(1));

// ---------- My Books (Build 22) ----------

const BOOKS_LOG_PAGE = 10;
let readBooksSorted = [];
let booksLogPage = 0;

function bookRow(b) {
  const row = el("button", "book-row");
  row.type = "button";
  row.append(el("span", "book-title", b.title));

  if (b.status === "reading") {
    const total = Number(b.total) || 0;
    const page = Math.min(Number(b.page) || 0, total || Infinity);
    if (total > 0) {
      row.append(el("span", "book-count", `${page} / ${total}`));
      const bar = el("span", "book-bar");
      const fill = el("span", "");
      fill.style.width = `${Math.min(100, Math.round((page / total) * 100))}%`;
      bar.append(fill);
      row.append(bar);
    } else {
      row.append(el("span", "book-count", "Reading"));   // no total: never blocked, just no numbers
    }
  } else if (b.status === "read" && b.finishedAt) {
    row.append(el("span", "book-count", monthLabel(b.finishedAt)));
  }

  row.addEventListener("click", () => openBookEdit(b.id));
  const li = el("li");
  li.append(row);
  return li;
}

function monthLabel(iso) {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "" : d.toLocaleDateString("en-US", { month: "short", year: "numeric" });
}

function renderBooks() {
  const all = loadBooks();
  const failed = all === null;
  const books = all || [];

  const reading = books.filter((b) => b.status === "reading")
    .sort((a, b) => (b.updatedAt || b.addedAt || "").localeCompare(a.updatedAt || a.addedAt || ""));
  const want = books.filter((b) => b.status === "want")
    .sort((a, b) => (b.addedAt || "").localeCompare(a.addedAt || ""));
  readBooksSorted = books.filter((b) => b.status === "read")
    .sort((a, b) => (b.finishedAt || "").localeCompare(a.finishedAt || ""));

  $("books-reading").replaceChildren(...reading.map(bookRow));
  $("books-want").replaceChildren(...want.map(bookRow));
  // only the most recently finished book is shown; the rest live behind View more
  $("books-read").replaceChildren(...readBooksSorted.slice(0, 1).map(bookRow));

  $("books-reading-group").hidden = reading.length === 0;
  $("books-want-group").hidden = want.length === 0;
  $("books-read-group").hidden = readBooksSorted.length === 0;
  $("books-read-head").textContent = String(readBooksSorted.length);   // Build 24.4: the total sits beside the heading, not inside it
  $("open-books-log").hidden = readBooksSorted.length <= 1;

  $("books-empty").textContent = failed ? "Your saved books couldn\u2019t be read." : "No books yet.";
  $("books-empty").hidden = books.length > 0 && !failed;
}

// ----- the one pop-up, for both adding and editing -----

const bookDialog = $("book-dialog");
let editingBookId = null;

function fillBookStatuses() {
  $("book-status-choices").replaceChildren(
    ...BOOK_STATUSES.map((s) => choiceButton("book-status", s.value, s.label))
  );
}

function chosenStatus() {
  const checked = $("book-form").querySelector('input[name="book-status"]:checked');
  return checked ? checked.value : "want";
}

function setStatus(value) {
  const radio = $("book-form").querySelector(`input[name="book-status"][value="${value}"]`);
  if (radio) radio.checked = true;
  applyStatusToForm();
}

// The page field only means anything while a book is being read
function applyStatusToForm() {
  const reading = chosenStatus() === "reading";
  $("book-page-field").hidden = !reading;
  const total = readWhole($("book-total").value);
  $("book-of-total").textContent = total > 0 ? `of ${total}` : "of \u2014";
  const page = readWhole($("book-page").value);
  // "Finished? Mark as read" appears only once you are at the last page
  $("book-finish-line").hidden = !(reading && total > 0 && page >= total);
}

function readWhole(text) {
  const n = parseInt(String(text).replace(/[^0-9]/g, ""), 10);
  return Number.isFinite(n) && n > 0 ? n : 0;
}

function resetBookForm() {
  for (const id of ["book-name", "book-page", "book-total"]) $(id).value = "";
  for (const id of ["book-name-error", "book-save-error"]) $(id).hidden = true;
  $("book-finish-line").hidden = true;
  toggleConfirm("book-delete-confirm", "book-form-actions", false);
}

function openAddBook() {
  editingBookId = null;
  $("book-title").textContent = "Add a book";
  resetBookForm();
  setStatus("want");
  $("delete-book").hidden = true;
  bookDialog.showModal();
  $("book-name").focus();
}

function openBookEdit(id) {
  const books = loadBooks();
  const book = books && books.find((b) => b.id === id);
  if (!book) return;
  editingBookId = id;

  $("book-title").textContent = book.title;
  resetBookForm();
  $("book-name").value = book.title;
  $("book-total").value = book.total ? String(book.total) : "";
  $("book-page").value = book.page ? String(book.page) : "";
  setStatus(book.status);
  $("delete-book").hidden = false;
  bookDialog.showModal();
  // the page is what you came to change, so it gets the cursor. Focus alone doesn't scroll the
  // pop-up's own scrolling middle, so it is asked explicitly — this is what makes the field
  // reachable with the keyboard up on the cover screen.
  if (book.status === "reading") {
    $("book-page").focus();
    $("book-page").scrollIntoView({ block: "nearest" });
  }
}

$("book-new").addEventListener("click", openAddBook);
$("book-status-choices").addEventListener("change", applyStatusToForm);
for (const id of ["book-page", "book-total"]) {
  $(id).addEventListener("input", (event) => {
    event.target.value = event.target.value.replace(/[^0-9]/g, "");
    applyStatusToForm();
  });
}

// Marking a book read while it sits on page 148 quietly sets it to its total
$("book-mark-read").addEventListener("click", () => {
  const total = readWhole($("book-total").value);
  if (total > 0) $("book-page").value = String(total);
  setStatus("read");
});

$("book-form").addEventListener("submit", (event) => {
  event.preventDefault();
  const title = $("book-name").value.trim();
  $("book-name-error").hidden = Boolean(title);
  $("book-save-error").hidden = true;
  if (!title) return;

  const status = chosenStatus();
  const total = readWhole($("book-total").value);
  let page = readWhole($("book-page").value);
  if (status === "read" && total > 0) page = total;   // read means finished, whatever the field said
  if (status === "want") page = 0;

  const now = new Date().toISOString();
  const changes = { title, status, page, total, updatedAt: now };

  try {
    if (editingBookId) {
      const before = (loadBooks() || []).find((b) => b.id === editingBookId);
      // the finish date is recorded the first time a book becomes read, and kept after that
      if (status === "read") changes.finishedAt = (before && before.finishedAt) || now;
      else changes.finishedAt = "";
      bookStore.update(editingBookId, changes);
    } else {
      bookStore.add({
        id: newId(), ...changes, addedAt: now,
        finishedAt: status === "read" ? now : "",
      });
    }
  } catch (err) {
    console.error(err);
    $("book-save-error").hidden = false;
    return;
  }

  bookDialog.close();
  renderBooks();
});

$("delete-book").addEventListener("click", () => {
  toggleConfirm("book-delete-confirm", "book-form-actions", true);
  $("book-delete-no").focus();
});
$("book-delete-no").addEventListener("click", () => {
  toggleConfirm("book-delete-confirm", "book-form-actions", false);
});
$("book-delete-yes").addEventListener("click", () => {
  if (!editingBookId) return;
  try {
    bookStore.remove(editingBookId);
  } catch (err) {
    console.error(err);
    toggleConfirm("book-delete-confirm", "book-form-actions", false);
    $("book-save-error").hidden = false;
    return;
  }
  bookDialog.close();
  renderBooks();
});

// ----- the Read pop-up, 10 a page, the app's usual pager -----

function renderBooksLog() {
  const pages = Math.max(1, Math.ceil(readBooksSorted.length / BOOKS_LOG_PAGE));
  booksLogPage = Math.min(booksLogPage, pages - 1);
  const start = booksLogPage * BOOKS_LOG_PAGE;
  $("books-log-full").replaceChildren(
    ...readBooksSorted.slice(start, start + BOOKS_LOG_PAGE).map(bookRow)
  );
  $("books-log-label").textContent = `${booksLogPage + 1} of ${pages}`;
  $("books-log-prev").disabled = booksLogPage === 0;
  $("books-log-next").disabled = booksLogPage >= pages - 1;
}

$("open-books-log").addEventListener("click", () => {
  booksLogPage = 0;
  renderBooksLog();
  $("books-log-dialog").showModal();
});
$("books-log-prev").addEventListener("click", () => { booksLogPage--; renderBooksLog(); });
$("books-log-next").addEventListener("click", () => { booksLogPage++; renderBooksLog(); });

// ---------- Goals: add, edit, hide (Build 21) ----------

const goalDialog = $("goal-dialog");
let editingGoalId = null; // null = adding a new goal

function goalSavedCount(id) {
  try {
    return savingsStore.load().filter((s) => s.goalId === id).length;
  } catch (err) {
    console.error(err);
    return 0; // if we can't read the savings, treat the goal as holding money and offer Hide only
  }
}

function openGoalEdit(id) {
  const goal = goalById(id);
  if (!goal) return;
  editingGoalId = id;

  $("goal-title").textContent = "Edit goal";
  $("goal-name").value = goal.name;
  $("goal-target").value = goal.target ? formatWhileTyping(String(goal.target), 2) : "";
  $("goal-monthly").value = goal.monthly ? formatWhileTyping(String(goal.monthly), 2) : "";

  // Nothing holding money can be deleted: a goal with savings can only be hidden
  let saved = 0;
  try {
    saved = savedForGoal(id, savingsStore.load());
  } catch (err) {
    console.error(err);
  }
  const count = goalSavedCount(id);
  $("goal-saved-line").textContent = count
    ? `${formatMoney(saved, "USD")} saved so far · ${count} ${count === 1 ? "entry" : "entries"}`
    : "Nothing saved to this goal yet";
  $("delete-goal").hidden = count > 0 || goal.hidden;
  $("hide-goal").hidden = count === 0 || goal.hidden;
  $("unhide-goal").hidden = !goal.hidden;

  resetGoalErrors();
  toggleConfirm("goal-delete-confirm", "goal-form-actions", false);
  goalDialog.showModal();
}

function openNewGoal() {
  editingGoalId = null;
  $("goal-title").textContent = "New goal";
  for (const id of ["goal-name", "goal-target", "goal-monthly"]) $(id).value = "";
  $("goal-saved-line").textContent = "";
  for (const id of ["delete-goal", "hide-goal", "unhide-goal"]) $(id).hidden = true;
  resetGoalErrors();
  toggleConfirm("goal-delete-confirm", "goal-form-actions", false);
  goalDialog.showModal();
  $("goal-name").focus();
}

function resetGoalErrors() {
  for (const id of ["goal-name-error", "goal-target-error", "goal-save-error"]) $(id).hidden = true;
}

$("new-goal").addEventListener("click", openNewGoal);

// ---------- The Car loan sheet (Build 27) ----------

const debtDialog = $("debt-dialog");

function openDebt() {
  const { target, paidBefore } = loadDebt();
  $("debt-target").value = target ? formatWhileTyping(String(target), 2) : "";
  $("debt-before").value = paidBefore ? formatWhileTyping(String(paidBefore), 2) : "";
  $("debt-target-error").hidden = true;
  $("debt-save-error").hidden = true;
  debtDialog.showModal();
}

for (const id of ["debt-target", "debt-before"]) {
  $(id).addEventListener("input", () => {
    $(id).value = formatWhileTyping($(id).value, 2);
    $("debt-target-error").hidden = true;
    $("debt-save-error").hidden = true;
  });
}

$("debt-form").addEventListener("submit", (event) => {
  event.preventDefault();
  const target = readAmount($("debt-target").value, 2);
  const paidBefore = readAmount($("debt-before").value, 2) || 0;

  $("debt-target-error").hidden = target > 0;
  $("debt-save-error").hidden = true;
  if (!(target > 0)) return;

  try {
    saveDebt({ target, paidBefore });
  } catch (err) {
    console.error(err);
    $("debt-save-error").hidden = false;
    return;
  }

  debtDialog.close();
  renderDashboard();
});

$("goal-form").addEventListener("submit", (event) => {
  event.preventDefault();
  const name = $("goal-name").value.trim();
  const target = readAmount($("goal-target").value, 2);
  const monthly = readAmount($("goal-monthly").value, 2);

  $("goal-name-error").hidden = Boolean(name);
  $("goal-target-error").hidden = target > 0;
  $("goal-save-error").hidden = true;
  if (!name || !(target > 0)) return;

  try {
    if (editingGoalId) {
      goalStore.update(editingGoalId, { name, target, monthly });
    } else {
      goalStore.add({ id: newId(), name, target, monthly, hidden: false });
    }
  } catch (err) {
    console.error(err);
    $("goal-save-error").hidden = false;
    return;
  }

  goalDialog.close();
  fillSavingForm();
  renderSavings();
});

$("hide-goal").addEventListener("click", () => setGoalHidden(editingGoalId, true));
$("unhide-goal").addEventListener("click", () => setGoalHidden(editingGoalId, false));

function setGoalHidden(id, hidden) {
  if (!id) return;
  try {
    goalStore.update(id, { hidden });
  } catch (err) {
    console.error(err);
    $("goal-save-error").hidden = false;
    return;
  }
  goalDialog.close();
  fillSavingForm();
  renderSavings();
}

$("delete-goal").addEventListener("click", () => {
  toggleConfirm("goal-delete-confirm", "goal-form-actions", true);
  $("goal-delete-no").focus();
});
$("goal-delete-no").addEventListener("click", () => {
  toggleConfirm("goal-delete-confirm", "goal-form-actions", false);
});
$("goal-delete-yes").addEventListener("click", () => {
  if (!editingGoalId) return;
  // Only reachable while the goal holds no savings, so nothing can be orphaned
  try {
    goalStore.remove(editingGoalId);
  } catch (err) {
    console.error(err);
    toggleConfirm("goal-delete-confirm", "goal-form-actions", false);
    $("goal-save-error").hidden = false;
    return;
  }
  goalDialog.close();
  fillSavingForm();
  renderSavings();
});

for (const id of ["goal-target", "goal-monthly"]) {
  $(id).addEventListener("input", (event) => {
    event.target.value = formatWhileTyping(event.target.value, 2);
  });
}

// The hidden list: the only way back for a goal you've put away
$("show-hidden-goals").addEventListener("click", () => {
  const hidden = loadGoals().filter((g) => g.hidden);
  $("hidden-goals-list").replaceChildren(
    ...hidden.map((g) => {
      const row = el("button", "log-row");
      row.type = "button";
      row.append(el("span", "log-item", g.name), el("span", "log-amount", "Unhide"));
      row.addEventListener("click", () => {
        $("hidden-goals-dialog").close();
        setGoalHidden(g.id, false);
      });
      const li = el("li");
      li.append(row);
      return li;
    })
  );
  $("hidden-goals-dialog").showModal();
});

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

$("goal-choices").addEventListener("change", () => {
  $("goal-error").hidden = true;
  // Build 16.5: goal, then amount — the same order as a transaction (Build 16.2)
  if ($("saving-dialog").open) $("saving-amount").focus();
});

for (const radio of savingForm.querySelectorAll('input[name="dir"]')) {
  radio.addEventListener("change", () => {
    updateSavingTitle();
    $("saving-too-much").hidden = true;
  });
}

savingAmountEl.addEventListener("input", () => {
  savingAmountEl.value = formatWhileTyping(savingAmountEl.value, 2);
  $("saving-amount-error").hidden = true;
  $("saving-too-much").hidden = true;
});

savingForm.addEventListener("submit", (event) => {
  event.preventDefault();

  const checked = savingForm.querySelector('input[name="goal"]:checked');
  const amount = readAmount(savingAmountEl.value, 2);
  $("goal-error").hidden = Boolean(checked);
  $("saving-amount-error").hidden = amount > 0;
  $("saving-error").hidden = true;
  $("saving-too-much").hidden = true;
  if (!checked || !(amount > 0)) return;

  // Build 27.1, your decision: an empty jar can't be taken from, and no withdrawal may exceed
  // what the jar holds. Said with the figure, so the message is useful rather than just a refusal.
  if (savingDirection() === "out") {
    const available = goalBalanceExcluding(checked.value, editingSavingId);
    if (amount > available) {
      $("saving-too-much").textContent = available > 0
        ? `There's only ${formatMoney(available, "USD")} in this jar.`
        : "This jar is empty — there's nothing to take out.";
      $("saving-too-much").hidden = false;
      return;
    }
  }

  const saving = {
    goalId: checked.value,
    amount: savingDirection() === "out" ? -amount : amount,
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
  // Build 12.4: redraw on opening, so the wording always suits the screen in use
  if (name === "expenses") renderDashboard();
  else if (name === "income") renderIncome();
  else renderSavings();
  applyCoverWording();
  for (const tab of ["expenses", "income", "savings"]) {
    const selected = tab === name;
    $(`tab-${tab}`).setAttribute("aria-selected", String(selected));
    $(`panel-${tab}`).hidden = !selected;
  }
  // Build 16.4: the same + opens a different sheet on each tab, so it says which
  const addLabel = { savings: "Add saving", income: "Add income" }[name] || "Add transaction";
  $("open-add").setAttribute("aria-label", addLabel);
  try {
    localStorage.setItem(TAB_KEY, name);
  } catch {}
  window.scrollTo(0, 0);
}

// Build 27.3: redrawing everything that reads differently on the two screens.
//
// This used to hang off the media query's "change" event alone, and that is not enough. Folding
// the phone does not always arrive as a resize: Android can hide the app on one screen and show
// it again on the other, so the app resumes with the layout it had before the fold. The symptom
// you saw was the Home skin tile keeping its long name ("Hydration") where the cover screen
// wants the letter ("H") — Build 24.10 made that swap so the four tiles stay aligned.
//
// So it now runs on BOTH the media query AND on becoming visible again, and it compares against
// the last state it drew, so whichever arrives first does the work and the other does nothing.
let lastDrawnCover = onCoverScreen();

function syncScreenState() {
  const now = onCoverScreen();
  if (now === lastDrawnCover) return;      // nothing changed: do no work at all
  lastDrawnCover = now;
  applyDateControls();
  renderHome();            // Build 27.2: the skin tile and the backup nudge both live here
  renderDashboard();
  renderIncome();
  renderSavings();
  renderSkin();
  applyCoverWording();
}

COVER_SCREEN.addEventListener("change", syncScreenState);

$("tab-expenses").addEventListener("click", () => showTab("expenses"));
$("tab-income").addEventListener("click", () => showTab("income"));
$("tab-savings").addEventListener("click", () => showTab("savings"));

// ---------- Start ----------

fillAddForm();
fillSavingForm();
fillBookStatuses();
fillIncomeForm();
migrateNotes(); // Build 9.6: notes from before formatting get a formatted copy, words unchanged
moveKeptThoughtsToDiary(); // Build 19, once only: whatever was still in To keep becomes diary notes
seedAndLinkGoals(); // Build 21, once only: goals move into storage and savings point at their ids
renderDashboard();
renderIncome();
renderSavings();
applyCoverWording();

// Build 11.1: the screen's own numbers, so a layout question can be answered from the phone
// Build 11.4: after a refresh the app starts at the top, instead of the phone putting back the old scroll position
if ("scrollRestoration" in history) history.scrollRestoration = "manual";
window.addEventListener("pageshow", () => window.scrollTo(0, 0));

let startTab = "expenses";
try {
  const remembered = localStorage.getItem(TAB_KEY);
  if (remembered === "savings" || remembered === "income") startTab = remembered;   // Build 23
} catch {}
showTab(startTab);

// A fresh start (the app fully closed and reopened) always opens on Home (Build 9.5).
// A refresh keeps you on the page you were on, because the session is still alive (Build 10.5).
let startView = "home";
try {
  const sameSession = sessionStorage.getItem(SESSION_VIEW_KEY);
  if (VIEWS.includes(sameSession)) startView = sameSession;
} catch {}
history.replaceState({ view: "home" }, "");
if (startView === "home") {
  showView("home");
} else {
  showView(startView, { push: true }); // so Back still goes Home after a refresh
}

// Lets the app open without internet once it's been added to the home screen
if ("serviceWorker" in navigator && location.protocol !== "file:") {
  navigator.serviceWorker.register("sw.js");
}

// ---------- Build 23.5: the app brings in a new build on its own ----------
// Before this, a new build could sit unseen for days. Chrome keeps the app frozen in the background
// when you switch away, so opening it again showed the same page it had last time and nothing ever
// asked the site for the new files. Now the app asks which build is live, and if it isn't the one
// running, it sends sw.js for the new files and reloads itself. No notice and nothing to tap.
const UPDATE_GAP_MS = 60 * 1000;   // at most one check a minute, however often you switch apps
let lastUpdateCheck = 0;

// Reloading throws away whatever is half-typed, so it waits for a better moment. The check runs
// again the next time the app comes back into view, so a new build is only delayed, never missed.
function midSomething() {
  const here = document.activeElement;
  if (here && (here.tagName === "TEXTAREA" || here.tagName === "INPUT" || here.isContentEditable)) return true;
  return !!document.querySelector("dialog[open]");
}

async function checkForNewBuild() {
  if (location.protocol === "file:") return;   // opened straight off the disk: there's no site to ask
  if (Date.now() - lastUpdateCheck < UPDATE_GAP_MS) return;
  lastUpdateCheck = Date.now();

  let live;
  try {
    const answer = await fetch("version.json", { cache: "no-store" });
    if (!answer.ok) return;
    live = (await answer.json()).build;
  } catch {
    return;                                    // no connection, or the file isn't on the site yet
  }
  if (!live || live === BUILD.number) return;  // already running the live build: nothing to do
  if (midSomething()) return;

  // GitHub can keep serving the old page for a minute or two after an upload. If the reload comes
  // back still on the old build, stop — without this the app would reload over and over. Opening
  // the app again starts a new session, which clears this and lets it try once more.
  try {
    if (sessionStorage.getItem("myjournal.updating") === live) return;
    sessionStorage.setItem("myjournal.updating", live);
  } catch {}

  // sw.js does the throwing away, not this. Asking it to update fetches the new sw.js, whose new
  // cache name makes it save all eight files again and delete the old ones. Clearing the saved
  // copies here instead left a half-filled cache — only the two or three files the page happened to
  // ask for — and the app would have opened without its icons the next time you were offline.
  // Your notes live in storage, which none of this touches.
  try {
    const worker = await navigator.serviceWorker.getRegistration();
    if (worker) await worker.update();
  } catch {}
  location.reload();
}

// Build 27.2: one spare copy a day, taken on the first open of the day, and the list drawn.
// After the stores are loaded, so a snapshot is of real data rather than of nothing.
firstRunDate();          // records day zero the very first time the app is opened
snapshotTodayIfNeeded();
renderSnapshots();

checkForNewBuild();
document.addEventListener("visibilitychange", () => {
  if (document.hidden) return;
  syncScreenState();       // Build 27.3: a fold can arrive as hide-then-show rather than a resize
  checkForNewBuild();
});

// Ask Chrome to keep this app's data permanently, so it isn't cleared when the phone is low on space
if (navigator.storage && navigator.storage.persist) {
  navigator.storage.persisted()
    .then((kept) => kept || navigator.storage.persist())
    .catch((err) => console.error(err));
}
