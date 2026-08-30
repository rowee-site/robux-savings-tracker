// =========================================================
// ROBUX SAVINGS QUEST — app.js
// Uses Firebase modular v10 SDK via CDN (no build step, works on GitHub Pages)
// =========================================================

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {
  getFirestore,
  collection,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  onSnapshot,
  query,
  orderBy,
  where,
  getDocs,
  serverTimestamp,
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import {
  getAuth,
  signInWithEmailAndPassword,
  onAuthStateChanged,
  signOut,
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

// ---------------------------------------------------------
// 1. FIREBASE CONFIG
// Replace every value below with the config from YOUR Firebase
// project (Project settings → General → Your apps → SDK setup).
// See the setup guide for exactly where to find this.
// ---------------------------------------------------------
const firebaseConfig = {
  apiKey: "AIzaSyCVnlbYcWXJq0hPybFOraDIsOJTuKNzUb4",
  authDomain: "robux-savings-tracker-79daa.firebaseapp.com",
  projectId: "robux-savings-tracker-79daa",
  storageBucket: "robux-savings-tracker-79daa.firebasestorage.app",
  messagingSenderId: "620831938360",
  appId: "1:620831938360:web:e4ec4b529ef9df5705d3cd",
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

// ---------------------------------------------------------
// 2. CONSTANTS
// ---------------------------------------------------------
const MEMBERS = ["AJ", "PI", "John2x", "Owner"];
const GOAL_PER_PERSON = 345;
const GROUP_GOAL = GOAL_PER_PERSON * MEMBERS.length; // 1,380
const ROBUX_PER_PERSON = 1000;

const ACCENTS = {
  AJ: "var(--blue)",
  PI: "var(--purple)",
  John2x: "var(--cyan)",
  Owner: "var(--gold)",
};

const MILESTONES = [
  { pct: 100, emoji: "🎉", text: (n) => `${n} REACHED THE GOAL!`, cls: "toast-gold" },
  { pct: 75, emoji: "⚡", text: (n) => `${n} is almost there!`, cls: "toast-purple" },
  { pct: 50, emoji: "🚀", text: (n) => `${n} is halfway there!`, cls: "toast-cyan" },
  { pct: 25, emoji: "🔥", text: (n) => `${n} reached 25%!`, cls: "toast-cyan" },
];

// ---------------------------------------------------------
// 3. STATE
// ---------------------------------------------------------
let contributions = []; // full list from Firestore, newest first
let previousPercents = {}; // memberName -> last known percent, for milestone detection
let isFirstSnapshot = true;
let currentUser = null;

// ---------------------------------------------------------
// 4. DOM REFS
// ---------------------------------------------------------
const playersGrid = document.getElementById("playersGrid");
const activityFeed = document.getElementById("activityFeed");
const groupCurrent = document.getElementById("groupCurrent");
const groupProgressFill = document.getElementById("groupProgressFill");
const groupPercentLabel = document.getElementById("groupPercentLabel");
const groupRemainingLabel = document.getElementById("groupRemainingLabel");
const goalsCompleteLabel = document.getElementById("goalsCompleteLabel");
const toastStack = document.getElementById("toastStack");

// ---------------------------------------------------------
// 5. HELPERS
// ---------------------------------------------------------
function formatCurrency(n) {
  const rounded = Math.round(n * 100) / 100;
  return "₱" + rounded.toLocaleString("en-PH", { minimumFractionDigits: 0, maximumFractionDigits: 2 });
}

function formatDate(tsField) {
  if (!tsField) return "just now";
  const date = tsField.toDate ? tsField.toDate() : new Date(tsField);
  const now = new Date();
  const isToday = date.toDateString() === now.toDateString();
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  const isYesterday = date.toDateString() === yesterday.toDateString();

  const time = date.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
  if (isToday) return `Today, ${time}`;
  if (isYesterday) return `Yesterday, ${time}`;
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" }) + `, ${time}`;
}

function aggregateByMember() {
  const agg = {};
  MEMBERS.forEach((m) => {
    agg[m] = { total: 0, count: 0, lastDate: null };
  });
  contributions.forEach((c) => {
    if (!agg[c.memberName]) return;
    agg[c.memberName].total += Number(c.amount) || 0;
    agg[c.memberName].count += 1;
    const cDate = c.createdAt && c.createdAt.toDate ? c.createdAt.toDate() : null;
    if (cDate && (!agg[c.memberName].lastDate || cDate > agg[c.memberName].lastDate)) {
      agg[c.memberName].lastDate = cDate;
    }
  });
  return agg;
}

// ---------------------------------------------------------
// 6. RENDER: PLAYER CARDS
// ---------------------------------------------------------
function renderPlayers() {
  const agg = aggregateByMember();
  let groupTotal = 0;
  let goalsCompleted = 0;

  MEMBERS.forEach((member) => {
    const data = agg[member];
    groupTotal += data.total;
    const pct = Math.min(100, (data.total / GOAL_PER_PERSON) * 100);
    const isComplete = data.total >= GOAL_PER_PERSON;
    const isExceeded = data.total > GOAL_PER_PERSON;
    if (isComplete) goalsCompleted += 1;

    checkMilestone(member, pct, data.total);

    let card = document.getElementById(`card-${member}`);
    const isNew = !card;
    if (isNew) {
      card = document.createElement("article");
      card.id = `card-${member}`;
      card.className = "player-card";
      card.style.setProperty("--accent", ACCENTS[member] || "var(--blue)");
      playersGrid.appendChild(card);
    }

    card.classList.toggle("is-complete", isComplete);

    const remainingText = isExceeded
      ? `Goal exceeded by ${formatCurrency(data.total - GOAL_PER_PERSON)}`
      : isComplete
      ? "Goal reached!"
      : `${formatCurrency(GOAL_PER_PERSON - data.total)} remaining`;

    const remainingClass = isExceeded ? "text-gold" : isComplete ? "text-success" : "";

    const badge = isExceeded
      ? `<span class="player-badge badge-exceeded">🏆 Exceeded</span>`
      : isComplete
      ? `<span class="player-badge badge-complete">✅ Complete</span>`
      : `<span class="player-badge">In progress</span>`;

    const lastContribText = data.lastDate ? formatDate(data.lastDate) : "No contributions yet";

    card.innerHTML = `
      <div class="player-card-head">
        <div class="player-card-headrow">
          <div class="player-avatar">${member.slice(0, 2).toUpperCase()}</div>
          <div class="player-name-block">
            <span class="player-name">${member}</span>
            <span class="player-meta-item">${data.count} contribution${data.count === 1 ? "" : "s"}</span>
          </div>
        </div>
        ${badge}
      </div>
      <div class="player-amount-row">
        <span class="player-amount-current">${formatCurrency(data.total)}</span>
        <span class="player-amount-target">of ${formatCurrency(GOAL_PER_PERSON)}</span>
      </div>
      <div class="player-remaining ${remainingClass}">${remainingText}</div>
      <div class="player-progress-row">
        <div class="progress-track">
          <div class="progress-fill" style="width:${pct}%"><span class="progress-glint"></span></div>
        </div>
        <span class="player-percent">${pct.toFixed(1)}%</span>
      </div>
      <div class="player-card-footer">
        <span class="robux-pill">🎮 ${ROBUX_PER_PERSON.toLocaleString()} ROBUX</span>
        <span>${lastContribText}</span>
      </div>
      ${isComplete ? `<div class="goal-complete-banner">🎉 GOAL COMPLETE! · ${ROBUX_PER_PERSON.toLocaleString()} ROBUX READY!</div>` : ""}
    `;

    if (!isFirstSnapshot && !isNew) {
      card.classList.remove("just-updated");
      void card.offsetWidth; // restart animation
      card.classList.add("just-updated");
    }
  });

  renderGroupProgress(groupTotal, goalsCompleted);
}

function renderGroupProgress(groupTotal, goalsCompleted) {
  const pct = Math.min(100, (groupTotal / GROUP_GOAL) * 100);
  groupCurrent.textContent = formatCurrency(groupTotal);
  groupProgressFill.style.width = pct + "%";
  groupPercentLabel.textContent = pct.toFixed(1) + "%";
  const remaining = Math.max(0, GROUP_GOAL - groupTotal);
  groupRemainingLabel.textContent =
    groupTotal >= GROUP_GOAL ? "Group goal reached! 🎉" : `${formatCurrency(remaining)} remaining`;
  goalsCompleteLabel.textContent = `${goalsCompleted} / ${MEMBERS.length} goals complete`;
}

// ---------------------------------------------------------
// 7. MILESTONE TOASTS
// ---------------------------------------------------------
function checkMilestone(member, pct, total) {
  const prev = previousPercents[member] ?? 0;
  if (!isFirstSnapshot && total > 0) {
    for (const m of MILESTONES) {
      if (pct >= m.pct && prev < m.pct) {
        showToast(`${m.emoji} ${m.text(member)}`, m.cls);
        break; // only show the highest newly-crossed milestone
      }
    }
  }
  previousPercents[member] = pct;
}

function showToast(message, cls) {
  const el = document.createElement("div");
  el.className = `toast ${cls || ""}`;
  el.textContent = message;
  toastStack.appendChild(el);
  setTimeout(() => el.remove(), 4200);
}

// ---------------------------------------------------------
// 8. RENDER: ACTIVITY FEED
// ---------------------------------------------------------
function renderActivityFeed() {
  if (contributions.length === 0) {
    activityFeed.innerHTML = `
      <div class="empty-state">
        <span class="empty-icon">🌙</span>
        <p>No contributions yet. The quest begins with the first deposit.</p>
      </div>`;
    return;
  }

  const recent = contributions.slice(0, 15);
  activityFeed.innerHTML = recent
    .map(
      (c) => `
      <div class="activity-row">
        <div class="activity-icon">💰</div>
        <div class="activity-text">
          <strong>${escapeHtml(c.memberName)}</strong> added ${formatCurrency(c.amount)}
          ${c.note ? `<span class="activity-note">${escapeHtml(c.note)}</span>` : ""}
        </div>
        <span class="activity-time">${formatDate(c.createdAt)}</span>
      </div>`
    )
    .join("");
}

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str ?? "";
  return div.innerHTML;
}

// ---------------------------------------------------------
// 9. FIRESTORE REAL-TIME LISTENER (public read)
// ---------------------------------------------------------
const contributionsQuery = query(collection(db, "contributions"), orderBy("createdAt", "desc"));

onSnapshot(
  contributionsQuery,
  (snapshot) => {
    contributions = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
    renderPlayers();
    renderActivityFeed();
    renderAdminTable();
    isFirstSnapshot = false;
  },
  (err) => {
    console.error("Firestore listener error:", err);
  }
);

// ---------------------------------------------------------
// 10. SECRET ADMIN ACCESS
// Shortcut: press Ctrl+Shift+A (Cmd+Shift+A on Mac) anywhere on the page.
// The public dashboard shows no visible admin button.
// ---------------------------------------------------------
const adminLoginOverlay = document.getElementById("adminLoginOverlay");
const adminPanelOverlay = document.getElementById("adminPanelOverlay");

document.addEventListener("keydown", (e) => {
  const key = e.key.toLowerCase();
  if ((e.ctrlKey || e.metaKey) && e.shiftKey && key === "a") {
    e.preventDefault();
    openAdminEntry();
  }
});

function openAdminEntry() {
  if (currentUser) {
    openModal(adminPanelOverlay);
  } else {
    openModal(adminLoginOverlay);
  }
}

// ---------------------------------------------------------
// 11. MODAL HELPERS
// ---------------------------------------------------------
function openModal(overlay) {
  overlay.hidden = false;
}
function closeModal(overlay) {
  overlay.hidden = true;
}

document.getElementById("closeLoginModal").addEventListener("click", () => closeModal(adminLoginOverlay));
document.getElementById("closePanelModal").addEventListener("click", () => closeModal(adminPanelOverlay));
[adminLoginOverlay, adminPanelOverlay].forEach((overlay) => {
  overlay.addEventListener("click", (e) => {
    if (e.target === overlay) closeModal(overlay);
  });
});

// ---------------------------------------------------------
// 12. AUTH
// ---------------------------------------------------------
const adminLoginForm = document.getElementById("adminLoginForm");
const loginError = document.getElementById("loginError");

adminLoginForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  loginError.hidden = true;
  const email = document.getElementById("adminEmail").value.trim();
  const password = document.getElementById("adminPassword").value;
  try {
    await signInWithEmailAndPassword(auth, email, password);
    adminLoginForm.reset();
    closeModal(adminLoginOverlay);
    openModal(adminPanelOverlay);
  } catch (err) {
    loginError.textContent = "Sign-in failed. Check the email and password and try again.";
    loginError.hidden = false;
  }
});

document.getElementById("signOutBtn").addEventListener("click", async () => {
  await signOut(auth);
  closeModal(adminPanelOverlay);
});

onAuthStateChanged(auth, (user) => {
  currentUser = user;
});

// ---------------------------------------------------------
// 13. ADD CONTRIBUTION
// ---------------------------------------------------------
const addForm = document.getElementById("addContributionForm");
const addSuccess = document.getElementById("addSuccess");
const addError = document.getElementById("addError");

addForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  addSuccess.hidden = true;
  addError.hidden = true;

  if (!currentUser) {
    addError.textContent = "You must be signed in as Admin.";
    addError.hidden = false;
    return;
  }

  const memberName = document.getElementById("contribMember").value;
  const amount = Number(document.getElementById("contribAmount").value);
  const note = document.getElementById("contribNote").value.trim();

  if (!amount || amount <= 0) {
    addError.textContent = "Enter an amount greater than 0.";
    addError.hidden = false;
    return;
  }

  try {
    await addDoc(collection(db, "contributions"), {
      memberId: memberName,
      memberName,
      amount,
      note: note || "",
      createdAt: serverTimestamp(),
      createdBy: currentUser.uid,
    });
    addForm.reset();
    addSuccess.hidden = false;
    setTimeout(() => (addSuccess.hidden = true), 2500);
  } catch (err) {
    console.error(err);
    addError.textContent = "Could not add contribution. Check your connection and permissions.";
    addError.hidden = false;
  }
});

// ---------------------------------------------------------
// 14. ADMIN TABLE (edit / delete)
// ---------------------------------------------------------
const adminTableBody = document.getElementById("adminTableBody");

function renderAdminTable() {
  if (contributions.length === 0) {
    adminTableBody.innerHTML = `<tr><td colspan="5" style="text-align:center; color:var(--text-faint); padding:20px;">No contributions yet.</td></tr>`;
    return;
  }
  adminTableBody.innerHTML = contributions
    .map(
      (c) => `
      <tr>
        <td>${escapeHtml(c.memberName)}</td>
        <td class="amount-cell">${formatCurrency(c.amount)}</td>
        <td>${escapeHtml(c.note || "—")}</td>
        <td>${formatDate(c.createdAt)}</td>
        <td>
          <div class="admin-row-actions">
            <button class="icon-btn" title="Edit" data-edit="${c.id}">✏️</button>
            <button class="icon-btn icon-danger" title="Delete" data-delete="${c.id}">🗑️</button>
          </div>
        </td>
      </tr>`
    )
    .join("");

  adminTableBody.querySelectorAll("[data-edit]").forEach((btn) => {
    btn.addEventListener("click", () => openEditModal(btn.getAttribute("data-edit")));
  });
  adminTableBody.querySelectorAll("[data-delete]").forEach((btn) => {
    btn.addEventListener("click", () => confirmDeleteContribution(btn.getAttribute("data-delete")));
  });
}

// ---------------------------------------------------------
// 15. EDIT CONTRIBUTION
// ---------------------------------------------------------
const editOverlay = document.getElementById("editOverlay");
const editForm = document.getElementById("editContributionForm");
const editError = document.getElementById("editError");

function openEditModal(id) {
  const c = contributions.find((x) => x.id === id);
  if (!c) return;
  document.getElementById("editId").value = c.id;
  document.getElementById("editMember").value = c.memberName;
  document.getElementById("editAmount").value = c.amount;
  document.getElementById("editNote").value = c.note || "";
  editError.hidden = true;
  openModal(editOverlay);
}

document.getElementById("closeEditModal").addEventListener("click", () => closeModal(editOverlay));
editOverlay.addEventListener("click", (e) => {
  if (e.target === editOverlay) closeModal(editOverlay);
});

editForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  editError.hidden = true;
  if (!currentUser) return;

  const id = document.getElementById("editId").value;
  const memberName = document.getElementById("editMember").value;
  const amount = Number(document.getElementById("editAmount").value);
  const note = document.getElementById("editNote").value.trim();

  if (!amount || amount <= 0) {
    editError.textContent = "Enter an amount greater than 0.";
    editError.hidden = false;
    return;
  }

  try {
    await updateDoc(doc(db, "contributions", id), {
      memberId: memberName,
      memberName,
      amount,
      note: note || "",
    });
    closeModal(editOverlay);
  } catch (err) {
    console.error(err);
    editError.textContent = "Could not save changes.";
    editError.hidden = false;
  }
});

// ---------------------------------------------------------
// 16. DELETE CONTRIBUTION (with confirm dialog)
// ---------------------------------------------------------
const confirmOverlay = document.getElementById("confirmOverlay");
const confirmTitle = document.getElementById("confirmTitle");
const confirmBody = document.getElementById("confirmBody");
const confirmOk = document.getElementById("confirmOk");
const confirmCancel = document.getElementById("confirmCancel");

let pendingConfirmAction = null;

function askConfirm(title, body, onConfirm) {
  confirmTitle.textContent = title;
  confirmBody.textContent = body;
  pendingConfirmAction = onConfirm;
  openModal(confirmOverlay);
}

confirmCancel.addEventListener("click", () => {
  pendingConfirmAction = null;
  closeModal(confirmOverlay);
});
confirmOk.addEventListener("click", async () => {
  const action = pendingConfirmAction;
  pendingConfirmAction = null;
  closeModal(confirmOverlay);
  if (action) await action();
});

function confirmDeleteContribution(id) {
  const c = contributions.find((x) => x.id === id);
  if (!c) return;
  askConfirm(
    "Delete this contribution?",
    `This will permanently remove ${c.memberName}'s ${formatCurrency(c.amount)} entry. This cannot be undone.`,
    async () => {
      try {
        await deleteDoc(doc(db, "contributions", id));
      } catch (err) {
        console.error(err);
        alert("Could not delete this contribution.");
      }
    }
  );
}

// ---------------------------------------------------------
// 17. RESET A PLAYER'S PROGRESS
// ---------------------------------------------------------
document.getElementById("resetBtn").addEventListener("click", () => {
  const member = document.getElementById("resetMember").value;
  askConfirm(
    `Reset ${member}'s progress?`,
    `This will permanently delete ALL of ${member}'s contributions and reset their savings to ₱0. This cannot be undone.`,
    async () => {
      try {
        const q = query(collection(db, "contributions"), where("memberName", "==", member));
        const snap = await getDocs(q);
        await Promise.all(snap.docs.map((d) => deleteDoc(doc(db, "contributions", d.id))));
      } catch (err) {
        console.error(err);
        alert("Could not reset this player. Check your connection and permissions.");
      }
    }
  );
});

// ---------------------------------------------------------
// 18. INITIAL PLACEHOLDER CARDS (before first snapshot arrives)
// ---------------------------------------------------------
function renderPlaceholders() {
  MEMBERS.forEach((member) => {
    const card = document.createElement("article");
    card.id = `card-${member}`;
    card.className = "player-card";
    card.style.setProperty("--accent", ACCENTS[member] || "var(--blue)");
    card.innerHTML = `
      <div class="player-card-head">
        <div class="player-card-headrow">
          <div class="player-avatar">${member.slice(0, 2).toUpperCase()}</div>
          <div class="player-name-block">
            <span class="player-name">${member}</span>
            <span class="player-meta-item">0 contributions</span>
          </div>
        </div>
        <span class="player-badge">In progress</span>
      </div>
      <div class="player-amount-row">
        <span class="player-amount-current">${formatCurrency(0)}</span>
        <span class="player-amount-target">of ${formatCurrency(GOAL_PER_PERSON)}</span>
      </div>
      <div class="player-remaining">${formatCurrency(GOAL_PER_PERSON)} remaining</div>
      <div class="player-progress-row">
        <div class="progress-track"><div class="progress-fill" style="width:0%"></div></div>
        <span class="player-percent">0.0%</span>
      </div>
      <div class="player-card-footer">
        <span class="robux-pill">🎮 ${ROBUX_PER_PERSON.toLocaleString()} ROBUX</span>
        <span>No contributions yet</span>
      </div>`;
    playersGrid.appendChild(card);
  });
  renderGroupProgress(0, 0);
}

renderPlaceholders();
