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
const BUILD = { number: "15", date: "2026-09-25" };
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

// Build 12.3: the cover screen shows the same numbers more tightly
const COVER_SCREEN = window.matchMedia("(min-aspect-ratio: 3 / 4) and (min-width: 500px)");
function onCoverScreen() {
  return COVER_SCREEN.matches;
}

// Whole amounts, no decimals: "$1,200 of $2,000" as the design writes them
function formatWhole(amount, currency) {
  const { symbol } = CURRENCIES[currency];
  return symbol + Math.round(amount).toLocaleString("en-US");
}

function formatMoney(amount, currency) {
  const { symbol, decimals } = CURRENCIES[currency];
  return symbol + amount.toLocaleString("en-US", {
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

  const monthDate = new Date(viewYear, viewMonth, 1);
  $("month-label").textContent = onCoverScreen()
    ? `${monthDate.toLocaleDateString("en-US", { month: "short" })} ${viewYear}`   // "Sep 2026"
    : monthDate.toLocaleDateString("en-GB", { month: "long", year: "numeric" });
  $("total").textContent = formatMoney(total, "LAK");

  // Build 12: Need and Want are headings with their own totals, their items underneath
  $("by-category").replaceChildren(
    ...GROUPS.flatMap((g) => {
      const head = el("div", "cat-head");
      head.append(el("span", "", g), el("span", "row-amount", formatMoney(sumWhere((e) => groupOf(e) === g), "LAK")));
      const list = el("ul", "cat-list");
      for (const c of CATEGORIES.filter((c) => c.group === g)) {
        list.append(summaryRow(c.name, sumWhere((e) => e.category === c.name)));
      }
      return [head, list];
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
  if (!$("panel-savings").hidden) {   // Build 12.2: the same + adds a saving on the Savings tab
    openAddSaving();
    return;
  }
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

// ---------- My Skin cycle (the My Skin page itself arrives in Build 7) ----------

const SKIN_CYCLE = ["Exfoliate", "Retinol", "Recovery 1", "Recovery 2"];
const SKIN_LETTERS = ["E", "R", "M", "M"]; // shown in the calendar: E xfoliate, R etinol, M oist
const SKIN_START = { date: "2026-09-15", night: 1 }; // 15 Sep 2026 = Retinol

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
  const n = SKIN_CYCLE.length;
  return ((SKIN_START.night + daysBetween(SKIN_START.date, dateISO)) % n + n) % n;
}

function skinNightFor(dateISO) {
  return SKIN_CYCLE[skinNightIndex(dateISO)];
}

function skinLetterFor(dateISO) {
  return SKIN_LETTERS[skinNightIndex(dateISO)];
}

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

function weekdayShort(iso) {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("en-GB", { weekday: "short" });
}

// One day of the calendar, used by both the month grid and the cover screen's week
function dayCell(dateISO, map, today) {
  const done = map[dateISO] === "done";
  const canTap = dateISO <= today && dateISO >= SKIN_START.date;
  const cell = el("button", "cal-cell");
  cell.type = "button";
  cell.append(
    el("span", "cal-day", String(Number(dateISO.slice(8)))),
    el("span", "cal-letter", skinLetterFor(dateISO)),
    el("span", "cal-mark", done ? "✓" : "")
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
}

// Build 13: the cover screen shows this week only, so the card and the week both fit
function renderSkinWeek(map, today) {
  const start = mondayOf(skinWeekAnchor);
  const end = addDays(start, 6);
  const sameMonth = start.slice(0, 7) === end.slice(0, 7);
  const from = sameMonth
    ? `${weekdayShort(start)} ${Number(start.slice(8))}`
    : `${weekdayShort(start)} ${shortDate(start)}`;
  $("skin-week-label").textContent = `${from} – ${weekdayShort(end)} ${shortDate(end)}`;
  const cells = [];
  for (let i = 0; i < 7; i++) cells.push(dayCell(addDays(start, i), map, today));
  $("skin-calendar").replaceChildren(...cells);
}

function renderSkin() {
  const map = loadSkin();
  const today = todayISO();

  // Tonight card
  $("skin-today").textContent = `Tonight · ${weekdayShort(today)} ${shortDate(today)}`;
  $("skin-tonight").textContent = skinNightFor(today);
  const doneTonight = map[today] === "done";
  $("skin-done-btn").textContent = doneTonight ? "✓ Done" : "Done";
  $("skin-done-btn").classList.toggle("primary", doneTonight);

  // The month on the main screen, this week on the cover screen
  const week = onCoverScreen();
  $("skin-month-nav").hidden = week;
  $("skin-week-nav").hidden = !week;
  if (week) renderSkinWeek(map, today);
  else renderSkinMonth(map, today);
}

function changeSkinMonth(delta) {
  const d = new Date(skinViewYear, skinViewMonth + delta, 1);
  skinViewYear = d.getFullYear();
  skinViewMonth = d.getMonth();
  renderSkin();
}

$("skin-prev-month").addEventListener("click", () => changeSkinMonth(-1));
$("skin-next-month").addEventListener("click", () => changeSkinMonth(1));

function changeSkinWeek(delta) {
  skinWeekAnchor = addDays(mondayOf(skinWeekAnchor), delta * 7);
  renderSkin();
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

const VIEWS = ["home", "money", "skin", "diary", "brain", "habit"];
const SESSION_VIEW_KEY = "myjournal.session-view";
let currentView = "home";

// overlay: "" (a normal page), "settings", or "note" (the diary writing page)
function applyPages(overlay = "") {
  for (const view of VIEWS) $(`${view}-page`).hidden = overlay !== "" || view !== currentView;
  $("settings-page").hidden = overlay !== "settings";
  $("diary-note-page").hidden = overlay !== "note";
  window.scrollTo(0, 0);
}

function renderHome() {
  const today = todayISO();
  $("daily-line").textContent = dailyLineFor(today);
  const done = loadSkin()[today] === "done";
  $("skin-tile-tonight").textContent = `${skinNightFor(today)}${done ? " ✓" : ""}`; // the tile is narrower now, so no "Tonight:" prefix
}

function showView(view, { push = false } = {}) {
  currentView = view;
  // Remembered for this session only: a refresh keeps you here, closing the app forgets it (Build 10.5)
  try {
    sessionStorage.setItem(SESSION_VIEW_KEY, view);
  } catch {}
  if (view === "home") renderHome();
  if (view === "skin") renderSkin();
  if (view === "diary") renderDiary();
  if (view === "brain") renderBrain();
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
$("tile-habit").addEventListener("click", () => showView("habit", { push: true }));
for (const button of document.querySelectorAll(".go-home")) button.addEventListener("click", goHome);

// The skin tile updates after midnight when the app comes back into view
document.addEventListener("visibilitychange", () => {
  if (!document.hidden) renderHome();
});

// ---------- Brain dump (Build 10) ----------

const BRAIN_KEY = "myjournal.braindump";
const brainStore = makeStore(BRAIN_KEY);   // To keep thoughts only. Let go thoughts are never saved.

let brainMode = "keep";                    // "keep", "letgo" or "edit"
let editingThoughtId = null;

function renderBrain() {
  let thoughts = [];
  let loadProblem = false;
  try {
    thoughts = brainStore.load();
  } catch (err) {
    console.error(err);
    loadProblem = true;
  }
  thoughts.sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt))); // newest first; editing never moves one
  $("brain-list").replaceChildren(...thoughts.map(thoughtRow));
  $("brain-count").textContent = thoughts.length ? `TO KEEP · ${thoughts.length}` : "TO KEEP";   // Build 15
  $("brain-empty").textContent = loadProblem ? "Sorry, your thoughts couldn't be loaded." : "Nothing to keep yet.";
  $("brain-empty").hidden = thoughts.length > 0;
}

// Build 10.1: swipe a thought for 📖 To diary and 🗑 Delete, the same swipe as My Diary
function thoughtRow(thought) {
  const li = el("li", "swipe");
  const actions = el("div", "swipe-actions");
  actions.append(
    iconButton("swipe-btn", "Move to My Diary", BOOK_ICON, () => moveThoughtToDiary(thought.id)),
    iconButton("swipe-btn bin", "Delete", BIN_ICON, () => askDeleteThought(thought.id))
  );
  const row = el("button", "log-row brain-row", thought.text);
  row.type = "button";
  addSwipe(li, row, () => openBrainWriter("edit", thought));
  li.append(actions, row);
  return li;
}

let thoughtToDelete = null;

function askDeleteThought(id) {
  thoughtToDelete = id;
  $("brain-delete-dialog").showModal();
}

$("brain-delete-no").addEventListener("click", () => {
  thoughtToDelete = null;
  $("brain-delete-dialog").close();
});

$("brain-delete-yes").addEventListener("click", () => {
  if (thoughtToDelete) {
    try {
      brainStore.remove(thoughtToDelete);
    } catch (err) {
      console.error(err);
    }
  }
  thoughtToDelete = null;
  $("brain-delete-dialog").close();
  closeSwipe();
  renderBrain();
});

// A diary title holds 80 characters: longer thoughts are cut at a word with "…" and kept whole in the note text
function thoughtTitle(text) {
  if (text.length <= 80) return text;
  let cut = text.slice(0, 79);
  const space = cut.lastIndexOf(" ");
  if (space > 50) cut = cut.slice(0, space);
  return `${cut.trimEnd()}…`;
}

function moveThoughtToDiary(id) {
  let thought;
  try {
    thought = brainStore.load().find((t) => t.id === id);
  } catch (err) {
    console.error(err);
  }
  if (!thought) return;
  const long = thought.text.length > 80;
  const noteId = newId();
  try {
    diaryStore.add({
      id: noteId,
      title: thoughtTitle(thought.text),
      text: long ? thought.text : "",
      html: long ? textToHtml(thought.text) : "",
      date: todayISO(),                      // dated the day it's moved, like writing a new note
      createdAt: new Date().toISOString(),
    });
  } catch (err) {
    console.error(err);
    flashOn("brain-page-flash", "Sorry, this thought couldn't be moved.", true);
    return;
  }
  try {
    brainStore.remove(id);
  } catch (err) {
    console.error(err);
    try { diaryStore.remove(noteId); } catch {} // never leave it in both places
    flashOn("brain-page-flash", "Sorry, this thought couldn't be moved.", true);
    return;
  }
  closeSwipe();
  renderBrain();
  renderDiary();
  flashOn("brain-page-flash", "Moved to My Diary ✓");
}

function fitBrainBox() {
  const box = $("brain-text");
  box.style.height = "auto";
  box.style.height = `${box.scrollHeight + 2}px`; // grows with the thought, up to the max-height in style.css
}

function openBrainWriter(mode, thought = null) {
  brainMode = mode;
  editingThoughtId = thought ? thought.id : null;
  $("brain-title").textContent = { keep: "To keep", letgo: "Let go", edit: "Edit thought" }[mode];
  $("brain-text").value = thought ? thought.text : "";
  clearTimeout(flashTimers["brain-flash"]);
  $("brain-flash").hidden = true;
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

function flashBrain(message) {
  flashOn("brain-flash", message);
}

function sendThought() {
  const box = $("brain-text");
  const text = box.value.replace(/[\r\n]+/g, " ").trim();
  $("brain-error").hidden = true;
  if (!text) {                                   // an empty box sends nothing
    box.value = "";
    fitBrainBox();
    box.focus();
    return;
  }
  try {
    if (brainMode === "keep") brainStore.add({ id: newId(), text, createdAt: new Date().toISOString() });
    if (brainMode === "edit") brainStore.update(editingThoughtId, { text });
  } catch (err) {
    console.error(err);
    $("brain-error").textContent = "Sorry, this thought couldn't be saved. Your writing is still here.";
    $("brain-error").hidden = false;
    return;
  }
  renderBrain();
  if (brainMode === "edit") {
    $("brain-dialog").close();
    return;
  }
  box.value = "";                                // Let go: gone, never stored anywhere
  fitBrainBox();
  flashBrain(brainMode === "keep" ? "Kept ✓" : "Let go ✓");
  box.focus();                                   // stays open, keyboard up, for the next thought
}

$("close-brain").addEventListener("click", goHome);
$("brain-keep").addEventListener("click", () => openBrainWriter("keep"));
$("brain-letgo").addEventListener("click", () => openBrainWriter("letgo"));
$("brain-send").addEventListener("pointerdown", (event) => event.preventDefault()); // keep the keyboard up
$("brain-send").addEventListener("click", sendThought);
$("brain-dialog").addEventListener("close", () => ($("brain-text").value = "")); // nothing lingers after closing

// Enter sends. Keyboards report it differently, so it's caught three ways.
$("brain-text").addEventListener("keydown", (event) => {
  if (event.key === "Enter" && !event.isComposing) {
    event.preventDefault();
    sendThought();
  }
});
$("brain-text").addEventListener("beforeinput", (event) => {
  if (event.inputType === "insertLineBreak" || event.inputType === "insertParagraph") {
    event.preventDefault();
    sendThought();
  }
});
$("brain-text").addEventListener("input", () => {
  $("brain-error").hidden = true;
  if (/[\r\n]/.test($("brain-text").value)) { // a line break slipped through, so treat it as Enter
    sendThought();
    return;
  }
  fitBrainBox();
});
// Pasted text arrives on one line
$("brain-text").addEventListener("paste", (event) => {
  event.preventDefault();
  const text = (event.clipboardData || window.clipboardData).getData("text/plain").replace(/\s*[\r\n]+\s*/g, " ");
  const box = $("brain-text");
  box.setRangeText(text, box.selectionStart, box.selectionEnd, "end");
  if (box.value.length > 1000) box.value = box.value.slice(0, 1000);
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

const BOOK_ICON = '<svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><path d="M12 6.5C10 5 7 4.5 4 5v13c3-.5 6 0 8 1.5 2-1.5 5-2 8-1.5V5c-3-.5-6 0-8 1.5zM12 6.5v13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>';
const BIN_ICON = '<svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><path d="M4 7h16M10 4h4M6 7l1 13h10l1-13M10 11v6M14 11v6" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>';
const PIN_ICON = '<svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><path d="M9 3h6l-1 6 4 3v2H6v-2l4-3-1-6zM12 14v7" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>';
const UNPIN_ICON = '<svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><path d="M9 3h6l-1 6 4 3v2H6v-2l4-3-1-6zM12 14v7M4 4l16 16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>';

function iconButton(className, label, icon, onClick) {
  const button = el("button", className);
  button.type = "button";
  button.setAttribute("aria-label", label);
  button.innerHTML = icon; // fixed icons, never anything you typed
  button.addEventListener("click", onClick);
  return button;
}

// Pinned notes sit on top with no heading; a year heading opens each year below them (Build 14)
function diaryListItems(notes) {
  const items = [];
  let lastYear = null;
  for (const note of notes) {
    if (!note.pinned) {
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
    el("span", "note-pin", note.pinned ? "📌" : ""),
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
const DEFAULT_TEXT_HEX = "#222222";            // the normal ink colour
const COLOURS_KEY = "myjournal.colors";
const LAST_BACKUP_KEY = "myjournal.lastbackup";  // Build 11.5: shown in Settings, not part of the backup
const COLOUR_DEFAULTS = {
  text: ["#e53935", "#1e88e5", "#43a047", "#8e24aa", "#fb8c00"],       // red, blue, green, purple, orange
  highlight: ["#fff176", "#a5d6a7", "#f8bbd0", "#90caf9", "#ffcc80"],  // yellow, green, pink, blue, orange
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

function swatchButton(label, colour, className, onPick) {
  const button = el("button", `swatch ${className}`.trim());
  button.type = "button";
  button.setAttribute("aria-label", label);
  if (colour) button.style.background = colour;
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
    ? swatchButton("Normal colour", DEFAULT_TEXT_HEX, "pinned", () => applyColour(kind, null))
    : swatchButton("No highlight", null, "pinned none", () => applyColour(kind, null));
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
    ...row.map((hex) => swatchButton(hex, hex, "", () => applyColour(kind, hex))),
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

const SAVE_ICON = '<svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><path d="M5 3h11l3 3v15H5zM8 3v5h7V3M8 21v-7h8v7" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>';
const SAVED_ICON = '<svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><path d="M5 12.5 10 18 19 6.5" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg>';

function showSaveIcon() {
  $("save-note").innerHTML = SAVE_ICON;
  $("save-note").classList.remove("is-saved");
}

// Build 14.2: saving turns the disk into a tick for a moment, then back
function showSaved() {
  clearTimeout(savedTimer);
  const status = $("diary-saved");
  status.hidden = false;                 // heard by a screen reader, not seen
  $("save-note").innerHTML = SAVED_ICON;
  $("save-note").classList.add("is-saved");
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
function applyCoverWording() {
  const short = onCoverScreen();
  $("rate-USD-label").textContent = short ? "1 USD =" : "1 USD = ? LAK";
  $("rate-THB-label").textContent = short ? "1 THB =" : "1 THB = ? LAK";
  $("backup-heading").textContent = short ? "Backup" : "Backup & Restore";
  const built = `Build ${BUILD.number} · ${shortDate(BUILD.date, true)}`;
  $("build-info").textContent = short ? built : `My Journal · ${built}`;
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
  $("last-backup").textContent = `Last backup: ${shortDate(when.slice(0, 10), true)}, ${time}`;
}

function makeBackup() {
  return {
    format: BACKUP_FORMAT,
    version: 6, // 2 added My Skin, 3 the daily message, 4 the diary notes, 5 formatted notes + colours, 6 brain dump
    build: BUILD.number,
    exportedAt: new Date().toISOString(),
    expenses: expenseStore.load(),
    savings: savingsStore.load(),
    rates: loadRates(),
    skin: loadSkin(),
    daily: loadDaily(),
    diary: diaryStore.load(),
    colors: loadColours(),
    braindump: brainStore.load(),
  };
}

function backupSummary(backup) {
  const count = (n, word) => `${n} ${word}${n === 1 ? "" : "s"}`;
  return `${count(backup.expenses.length, "expense")} · ${count(backup.savings.length, "saving")}`
    + ` · ${count((backup.diary || []).length, "note")}`
    + ` · ${count((backup.braindump || []).length, "thought")}`;
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

  // Build 9.8: the time in the name gives every backup its own file, so Chrome never asks "download again?"
  const now = new Date();
  const time = `${String(now.getHours()).padStart(2, "0")}${String(now.getMinutes()).padStart(2, "0")}`;
  const name = `my-journal-backup-${todayISO()}-${time}`;
  const contents = JSON.stringify(backup, null, 2);
  // Chrome on Android won't share a .json file, but it will share .txt. Same backup inside; Restore accepts both.
  const shareFile = new File([contents], `${name}.txt`, { type: "text/plain" });

  if (navigator.canShare && navigator.canShare({ files: [shareFile] })) {
    try {
      await navigator.share({ files: [shareFile], title: "My Journal backup" });
      rememberBackupTime();
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
  showSettingsStatus("backup-status", `Sharing isn't available here, so the backup was saved to Downloads ✓ (${backupSummary(backup)})`);
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
  // Backups made before Brain dump (version 5 and older) have no "braindump", and those leave To keep untouched
  if (backup.braindump !== undefined && (!Array.isArray(backup.braindump)
    || !backup.braindump.every((t) => t && typeof t.id === "string" && typeof t.text === "string"))) {
    throw new Error("Backup has damaged thoughts");
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
  const keys = [STORAGE_KEY, SAVINGS_KEY, RATES_KEY, SKIN_DATA_KEY, DAILY_KEY, DIARY_KEY, COLOURS_KEY, BRAIN_KEY];
  const before = keys.map((key) => localStorage.getItem(key));
  try {
    expenseStore.save(backup.expenses);
    savingsStore.save(backup.savings);
    if (backup.rates) saveRates({ ...DEFAULT_RATES, ...backup.rates });
    if (backup.skin) saveSkin(backup.skin);
    if (backup.daily) saveDaily(backup.daily);
    if (backup.diary) diaryStore.save(backup.diary.map(convertNote)); // older notes converted, all notes cleaned
    if (backup.colors) saveColours({
      text: validColourRow(backup.colors.text, "text"),
      highlight: validColourRow(backup.colors.highlight, "highlight"),
    });
    if (backup.braindump) brainStore.save(backup.braindump);
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
  renderSkin();
  renderDiary();
  renderBrain();
  renderHome();
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
  $("savings-total").textContent = onCoverScreen() ? formatWhole(total, "USD") : formatMoney(total, "USD");

  // Build 12.2: a jar per goal, filling from the bottom with its percentage inside
  $("goals").replaceChildren(
    ...GOALS.map((g) => {
      const saved = all.filter((s) => s.goal === g.name).reduce((sum, s) => sum + s.amount, 0);
      const percent = Math.min(100, g.target ? Math.round((saved / g.target) * 100) : 0);

      const jar = el("div", "jar");
      jar.setAttribute("role", "progressbar");
      jar.setAttribute("aria-label", `${g.name} progress`);
      jar.setAttribute("aria-valuemin", "0");
      jar.setAttribute("aria-valuemax", String(g.target));
      jar.setAttribute("aria-valuenow", String(Math.min(saved, g.target)));
      const body = el("div", "jar-body");
      const fill = el("div", "jar-fill");
      fill.style.height = `${percent}%`;
      // the number reads white once the fill covers the middle of the jar, dark while it doesn't
      const label = el("div", `jar-percent${percent >= 50 ? " on-fill" : ""}`, `${percent}%`);
      body.append(fill, label);
      jar.append(el("div", "jar-lid"), body);

      const text = el("div", "goal-text");
      text.append(
        el("div", "goal-name", g.name),
        el("div", "goal-amount", `${formatWhole(saved, "USD")} of ${formatWhole(g.target, "USD")}`),
        el("div", "small", goalStatus(saved, g))
      );

      const row = el("div", "goal-row");
      row.append(jar, text);
      return row;
    })
  );

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

function openAddSaving() {
  resetSavingForm();
  setSavingMode(null);
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
  // Build 12.4: redraw on opening, so the wording always suits the screen in use
  if (name === "expenses") renderDashboard();
  else renderSavings();
  applyCoverWording();
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

COVER_SCREEN.addEventListener("change", () => {   // folding the phone changes how much is written
  renderDashboard();
  renderSavings();
  renderSkin();
  applyCoverWording();
});

$("tab-expenses").addEventListener("click", () => showTab("expenses"));
$("tab-savings").addEventListener("click", () => showTab("savings"));

// ---------- Start ----------

fillAddForm();
fillSavingForm();
migrateNotes(); // Build 9.6: notes from before formatting get a formatted copy, words unchanged
renderDashboard();
renderSavings();
applyCoverWording();

// Build 11.1: the screen's own numbers, so a layout question can be answered from the phone
// Build 11.4: after a refresh the app starts at the top, instead of the phone putting back the old scroll position
if ("scrollRestoration" in history) history.scrollRestoration = "manual";
window.addEventListener("pageshow", () => window.scrollTo(0, 0));

let startTab = "expenses";
try {
  if (localStorage.getItem(TAB_KEY) === "savings") startTab = "savings";
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

// Ask Chrome to keep this app's data permanently, so it isn't cleared when the phone is low on space
if (navigator.storage && navigator.storage.persist) {
  navigator.storage.persisted()
    .then((kept) => kept || navigator.storage.persist())
    .catch((err) => console.error(err));
}
