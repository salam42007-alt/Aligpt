/* ═══════════════════════════════════════════════════
   AliGPT — script.js
   Full App Logic: Auth, Chat, History, Settings
═══════════════════════════════════════════════════ */

// ══════════════════════════════════════════
// 1. CONFIG — ضع مفاتيحك هنا
// ══════════════════════════════════════════

const SUPABASE_URL  = 'https://hjhtwurqcectnjpudsxl.supabase.co';
const SUPABASE_KEY  = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhqaHR3dXJxY2VjdG5qcHVkc3hsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ2NDQ4MTEsImV4cCI6MjA5MDIyMDgxMX0.oRMx53sfFb6rAiHTiVT13jOL4YcONsOAm7t_FjPXtmg';
const GEMINI_API_KEY = 'AIzaSyBvnrQtZnWM3jcjMUDnPbXVMmKthxoGQto';
 
const DEMO_MODE = false;
 
// ══════════════════════════════════════════
// 2. APP STATE
// ══════════════════════════════════════════
 
let appState = {
  user: null,          // { id, firstName, lastName, email }
  currentChatId: null,
  chats: {},           // { chatId: { title, messages: [] } }
  darkMode: true,
  captchaVerified: false,
  onboardingData: { source: null, purpose: null }
};
 
// ══════════════════════════════════════════
// 3. INIT
// ══════════════════════════════════════════
 
document.addEventListener('DOMContentLoaded', () => {
  loadFromStorage();
 
  if (appState.user) {
    setupDashboard();
    showPage('page-dashboard');
  } else {
    showPage('page-landing');
  }
 
  applyTheme();
});
 
function loadFromStorage() {
  const saved = localStorage.getItem('aligpt_state');
  if (saved) {
    try {
      const parsed = JSON.parse(saved);
      appState = { ...appState, ...parsed };
    } catch (e) {}
  }
}
 
function saveToStorage() {
  localStorage.setItem('aligpt_state', JSON.stringify({
    user:        appState.user,
    chats:       appState.chats,
    darkMode:    appState.darkMode,
    onboardingData: appState.onboardingData
  }));
}
 
// ══════════════════════════════════════════
// 4. PAGE NAVIGATION
// ══════════════════════════════════════════
 
function showPage(pageId) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  const page = document.getElementById(pageId);
  if (page) page.classList.add('active');
}
 
// ══════════════════════════════════════════
// 5. THEME
// ══════════════════════════════════════════
 
function applyTheme() {
  document.body.classList.toggle('dark-mode',  appState.darkMode);
  document.body.classList.toggle('light-mode', !appState.darkMode);
  const icon = document.getElementById('theme-icon');
  if (icon) icon.textContent = appState.darkMode ? '☀️' : '🌙';
  const toggle = document.getElementById('dark-toggle');
  if (toggle) toggle.checked = appState.darkMode;
}
 
function toggleDarkMode() {
  appState.darkMode = !appState.darkMode;
  applyTheme();
  saveToStorage();
}
 
// ══════════════════════════════════════════
// 6. AUTH — LOGIN
// ══════════════════════════════════════════
 
async function handleLogin() {
  const email = document.getElementById('login-email').value.trim();
  const pass  = document.getElementById('login-pass').value;
  const btnText  = document.getElementById('login-btn-text');
  const spinner  = document.getElementById('login-spinner');
 
  clearError('login-error');
 
  if (!email || !pass) {
    return showError('login-error', 'يرجى ملء جميع الحقول');
  }
  if (!isValidEmail(email)) {
    return showError('login-error', 'البريد الإلكتروني غير صحيح');
  }
 
  btnText.classList.add('hidden');
  spinner.classList.remove('hidden');
 
  try {
    if (DEMO_MODE) {
      await fakeDelay(1000);
      const users = JSON.parse(localStorage.getItem('aligpt_users') || '[]');
      const found = users.find(u => u.email === email && u.password === pass);
      if (!found) throw new Error('البريد الإلكتروني أو كلمة المرور غير صحيحة');
      appState.user = { id: found.id, firstName: found.firstName, lastName: found.lastName, email: found.email };
    } else {
      const { createClient } = supabase;
      const sb = createClient(SUPABASE_URL, SUPABASE_KEY);
      const { data, error } = await sb.auth.signInWithPassword({ email, password: pass });
      if (error) throw new Error(error.message);
      appState.user = {
        id: data.user.id,
        email: data.user.email,
        firstName: data.user.user_metadata?.firstName || 'مستخدم',
        lastName:  data.user.user_metadata?.lastName  || ''
      };
    }
 
    saveToStorage();
    setupDashboard();
    showPage('page-dashboard');
    showToast('مرحباً بعودتك! 👋', 'success');
  } catch (err) {
    showError('login-error', err.message);
  } finally {
    btnText.classList.remove('hidden');
    spinner.classList.add('hidden');
  }
}
 
// ══════════════════════════════════════════
// 7. AUTH — SIGN UP
// ══════════════════════════════════════════
 
async function handleSignup() {
  const fname   = document.getElementById('signup-fname').value.trim();
  const lname   = document.getElementById('signup-lname').value.trim();
  const email   = document.getElementById('signup-email').value.trim();
  const pass    = document.getElementById('signup-pass').value;
  const confirm = document.getElementById('signup-confirm').value;
  const btnText = document.getElementById('signup-btn-text');
  const spinner = document.getElementById('signup-spinner');
 
  clearError('signup-error');
 
  if (!fname || !lname || !email || !pass || !confirm) {
    return showError('signup-error', 'يرجى ملء جميع الحقول');
  }
  if (!isValidEmail(email)) {
    return showError('signup-error', 'البريد الإلكتروني غير صحيح');
  }
  if (pass.length < 6) {
    return showError('signup-error', 'كلمة المرور يجب أن تكون 6 أحرف على الأقل');
  }
  if (pass !== confirm) {
    return showError('signup-error', 'كلمة المرور وتأكيدها غير متطابقتان');
  }
 
  // ✅ التحقق من استجابة جوجل reCAPTCHA الحقيقية
  const captchaResponse = grecaptcha.getResponse();
  if (captchaResponse.length === 0) {
    return showError('signup-error', 'يرجى تأكيد أنك لست روبوتاً بالضغط على المربع');
  }
 
  btnText.classList.add('hidden');
  spinner.classList.remove('hidden');
 
  try {
    if (DEMO_MODE) {
      await fakeDelay(1200);
      const users = JSON.parse(localStorage.getItem('aligpt_users') || '[]');
      if (users.find(u => u.email === email)) {
        throw new Error('هذا البريد الإلكتروني مسجل بالفعل');
      }
      const newUser = { id: genId(), firstName: fname, lastName: lname, email, password: pass };
      users.push(newUser);
      localStorage.setItem('aligpt_users', JSON.stringify(users));
      appState.user = { id: newUser.id, firstName: fname, lastName: lname, email };
    } else {
      const { createClient } = supabase;
      const sb = createClient(SUPABASE_URL, SUPABASE_KEY);
      const { data, error } = await sb.auth.signUp({
        email, password: pass,
        options: { data: { firstName: fname, lastName: lname } }
      });
      if (error) throw new Error(error.message);
      appState.user = { id: data.user.id, firstName: fname, lastName: lname, email };
    }
 
    saveToStorage();
    showPage('page-onboarding');
    initOnboarding();
    showToast('تم إنشاء حسابك بنجاح! 🎉', 'success');
  } catch (err) {
    showError('signup-error', err.message);
  } finally {
    btnText.classList.remove('hidden');
    spinner.classList.add('hidden');
  }
}
 
 
// ══════════════════════════════════════════
// 9. ONBOARDING WIZARD
// ══════════════════════════════════════════
 
let currentStep = 1;
 
function initOnboarding() {
  currentStep = 1;
  document.querySelectorAll('.onboard-step').forEach(s => s.classList.remove('active'));
  document.getElementById('step-1').classList.add('active');
  document.querySelectorAll('.choice-btn').forEach(b => b.classList.remove('selected'));
  updateProgress();
}
 
function selectChoice(btn, type) {
  const parent = btn.closest('.choice-grid');
  parent.querySelectorAll('.choice-btn').forEach(b => b.classList.remove('selected'));
  btn.classList.add('selected');
 
  const label = btn.querySelector('span:last-child').textContent;
  appState.onboardingData[type] = label;
 
  const otherId = type === 'source' ? 'source-other' : 'purpose-other';
  const otherInput = document.getElementById(otherId);
  if (label === 'أخرى') {
    otherInput.classList.remove('hidden');
    otherInput.focus();
  } else {
    otherInput.classList.add('hidden');
  }
}
 
function nextStep() {
  if (currentStep === 1) {
    currentStep = 2;
    document.getElementById('step-1').classList.remove('active');
    document.getElementById('step-2').classList.add('active');
    updateProgress();
  }
}
 
function updateProgress() {
  const fill = document.getElementById('progress-fill');
  const text = document.getElementById('progress-text');
  const pct  = currentStep === 1 ? '50%' : '100%';
  fill.style.width = pct;
  text.textContent = `${currentStep} / 2`;
}
 
function finishOnboarding() {
  const sourceOther  = document.getElementById('source-other').value;
  const purposeOther = document.getElementById('purpose-other').value;
  if (sourceOther)  appState.onboardingData.source  = sourceOther;
  if (purposeOther) appState.onboardingData.purpose = purposeOther;
 
  saveToStorage();
  setupDashboard();
  showPage('page-dashboard');
  showToast('أهلاً بك في AliGPT! 🚀', 'success');
}
 
// ══════════════════════════════════════════
// 10. DASHBOARD SETUP
// ══════════════════════════════════════════
 
function setupDashboard() {
  if (!appState.user) return;
 
  const greeting = document.getElementById('user-greeting');
  if (greeting) greeting.textContent = `أهلاً بك يا ${appState.user.firstName} 👋`;
 
  const settingsName = document.getElementById('settings-name');
  if (settingsName) settingsName.value = `${appState.user.firstName} ${appState.user.lastName}`;
 
  const toggle = document.getElementById('dark-toggle');
  if (toggle) toggle.checked = appState.darkMode;
 
  renderHistory();
 
  if (!appState.currentChatId) newChat();
}
 
// ══════════════════════════════════════════
// 11. CHAT HISTORY
// ══════════════════════════════════════════
 
function renderHistory() {
  const list = document.getElementById('history-list');
  if (!list) return;
  list.innerHTML = '';
 
  const chatIds = Object.keys(appState.chats).reverse();
  if (chatIds.length === 0) {
    list.innerHTML = `<p class="history-empty">لا توجد محادثات بعد<br>ابدأ محادثة جديدة! 💬</p>`;
    return;
  }
 
  chatIds.forEach(id => {
    const chat = appState.chats[id];
    const item = document.createElement('div');
    item.className = 'history-item' + (id === appState.currentChatId ? ' active' : '');
    item.innerHTML = `
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
      </svg>
      <span>${truncate(chat.title, 25)}</span>
      <button class="del-btn" onclick="deleteChat('${id}', event)" title="حذف">✕</button>
    `;
    item.onclick = (e) => {
      if (e.target.classList.contains('del-btn')) return;
      loadChat(id);
    };
    list.appendChild(item);
  });
}
 
function newChat() {
  const id = genId();
  appState.chats[id] = { title: 'محادثة جديدة', messages: [] };
  appState.currentChatId = id;
  saveToStorage();
  renderHistory();
  renderMessages();
}
 
function loadChat(id) {
  appState.currentChatId = id;
  renderHistory();
  renderMessages();
  if (window.innerWidth <= 768) toggleSidebar(true);
}
 
function deleteChat(id, event) {
  event.stopPropagation();
  delete appState.chats[id];
  if (appState.currentChatId === id) {
    const remaining = Object.keys(appState.chats);
    appState.currentChatId = remaining.length > 0 ? remaining[remaining.length - 1] : null;
    if (!appState.currentChatId) newChat();
    else renderMessages();
  }
  saveToStorage();
  renderHistory();
  showToast('تم حذف المحادثة', 'success');
}
 
function renderMessages() {
  const chat = appState.chats[appState.currentChatId];
  const messagesDiv = document.getElementById('chat-messages');
  const welcomeMsg  = document.getElementById('welcome-msg');
 
  if (!chat || !messagesDiv) return;
 
  messagesDiv.innerHTML = '';
 
  if (chat.messages.length === 0) {
    welcomeMsg.classList.remove('hidden');
  } else {
    welcomeMsg.classList.add('hidden');
    chat.messages.forEach(msg => appendMessageToDOM(msg.role, msg.content, msg.time));
  }
}
 
function appendMessageToDOM(role, content, time) {
  const welcomeMsg = document.getElementById('welcome-msg');
  welcomeMsg.classList.add('hidden');
 
  const messagesDiv = document.getElementById('chat-messages');
  const isAI = role === 'ai';
 
  const wrap = document.createElement('div');
  wrap.className = `message ${isAI ? 'ai' : 'user'}`;
 
  wrap.innerHTML = `
    <div class="msg-avatar">
      ${isAI
        ? `<img src="images/logo.png" alt="AliGPT" />`
        : `<span>👤</span>`}
    </div>
    <div>
      <div class="msg-bubble">${formatContent(content)}</div>
      <div class="msg-time">${time || getCurrentTime()}</div>
    </div>
  `;
 
  messagesDiv.appendChild(wrap);
  scrollToBottom();
}
 
function formatContent(text) {
  return text
    .replace(/```([\s\S]*?)```/g, '<pre style="background:var(--bg);padding:1rem;border-radius:8px;overflow-x:auto;margin:.5rem 0;font-family:monospace;font-size:.85rem;border:1px solid var(--border)"><code>$1</code></pre>')
    .replace(/`([^`]+)`/g, '<code style="background:var(--bg2);padding:.15rem .4rem;border-radius:4px;font-family:monospace;font-size:.88rem">$1</code>')
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/\n/g, '<br>');
}
 
// ══════════════════════════════════════════
// 12. SEND MESSAGE & AI CALL
// ══════════════════════════════════════════
 
async function sendMessage() {
  const input = document.getElementById('chat-input');
  const text  = input.value.trim();
  if (!text) return;
 
  input.value = '';
  input.style.height = 'auto';
 
  const time = getCurrentTime();
  const chat = appState.chats[appState.currentChatId];
  if (!chat) return;
 
  if (chat.messages.length === 0) {
    chat.title = truncate(text, 30);
    renderHistory();
  }
 
  chat.messages.push({ role: 'user', content: text, time });
  appendMessageToDOM('user', text, time);
  saveToStorage();
 
  const typing = document.getElementById('typing-indicator');
  typing.classList.remove('hidden');
  scrollToBottom();
 
  const sendBtn = document.getElementById('send-btn');
  sendBtn.disabled = true;
 
  try {
    const reply = await callGemini(chat.messages);
    typing.classList.add('hidden');
    const aiTime = getCurrentTime();
    chat.messages.push({ role: 'ai', content: reply, time: aiTime });
    appendMessageToDOM('ai', reply, aiTime);
    saveToStorage();
  } catch (err) {
    typing.classList.add('hidden');
    const errMsg = '❌ حدث خطأ في الاتصال. تأكد من مفتاح API أو جرب مرة أخرى.';
    chat.messages.push({ role: 'ai', content: errMsg, time: getCurrentTime() });
    appendMessageToDOM('ai', errMsg, getCurrentTime());
  } finally {
    sendBtn.disabled = false;
  }
}
 
async function callGemini(messages) {
  if (DEMO_MODE) {
    await fakeDelay(1500);
    return getDemoResponse(messages[messages.length - 1].content);
  }
 
  const history = messages.map(m => ({
    role: m.role === 'ai' ? 'model' : 'user',
    parts: [{ text: m.content }]
  }));
 
  const systemPrompt = `أنت AliGPT، مساعد ذكاء اصطناعي جزائري ودود وذكي. تتحدث بالعربية الفصحى المبسطة أو الدارجة الجزائرية حسب ما يكتبه المستخدم. أنت مفيد، صريح، وتحب الثقافة الجزائرية.`;
 
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_API_KEY}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        system_instruction: { parts: [{ text: systemPrompt }] },
        contents: history,
        generationConfig: { maxOutputTokens: 2048, temperature: 0.8 }
      })
    }
  );
 
  if (!response.ok) throw new Error('Gemini API error');
  const data = await response.json();
  return data.candidates?.[0]?.content?.parts?.[0]?.text || 'لم أتمكن من الإجابة. حاول مرة أخرى.';
}
 
function getDemoResponse(userMsg) {
  const msg = userMsg.toLowerCase();
  if (msg.includes('اسمك') || msg.includes('من أنت') || msg.includes('مني')) {
    return 'أنا **AliGPT** 🤖 — مساعد الذكاء الاصطناعي الجزائري! صُنعت لأساعدك في البرمجة، الدراسة، أو حتى مجرد دردشة. كيف نقدر نعاونك اليوم؟ 😎';
  }
  if (msg.includes('مرحب') || msg.includes('سلام') || msg.includes('ahla') || msg.includes('hello')) {
    return 'وعليكم السلام! 👋 أهلاً وسهلاً بك في **AliGPT**! أنا هنا لمساعدتك. اسألني أي حاجة تخطر على بالك! 🇩🇿';
  }
  if (msg.includes('برمج') || msg.includes('كود') || msg.includes('python') || msg.includes('javascript')) {
    return 'تمام! أنا شاطر في البرمجة 💻\n\nقولي بالتفصيل شنو تحتاج — لغة البرمجة، المشكلة، أو الكود اللي عندك — وسنحلها سوا!';
  }
  if (msg.includes('شكر') || msg.includes('merci') || msg.includes('thanks')) {
    return 'العفو! يسعدني مساعدتك دائماً 😊 إذا عندك أي سؤال آخر، أنا هنا! 🚀';
  }
  if (msg.includes('جزائر') || msg.includes('algerie') || msg.includes('algeria')) {
    return '🇩🇿 الجزائر — بلد الشموس والأبطال! أنا فخور أنني صُنعت بروح جزائرية. من وهران لعنابة، من تمنراست لالجزائر العاصمة — أنا هنا لخدمة الجميع! 💚🤍❤️';
  }
  return `شكراً على رسالتك! 🙏\n\nللحصول على ردود حقيقية من الذكاء الاصطناعي، أضف **GEMINI_API_KEY** في ملف \`script.js\`.\n\nيمكنك الحصول عليه مجاناً من [Google AI Studio](https://aistudio.google.com) 🔑`;
}
 
function quickPrompt(btn) {
  const text = btn.textContent.replace(/^[^\w\u0600-\u06FF]+/, '').trim();
  document.getElementById('chat-input').value = text;
  sendMessage();
}
 
function handleKey(event) {
  if (event.key === 'Enter' && !event.shiftKey) {
    event.preventDefault();
    sendMessage();
  }
}
 
function autoResize(el) {
  el.style.height = 'auto';
  el.style.height = Math.min(el.scrollHeight, 180) + 'px';
}
 
function scrollToBottom() {
  const area = document.getElementById('messages-area');
  if (area) setTimeout(() => { area.scrollTop = area.scrollHeight; }, 50);
}
 
// ══════════════════════════════════════════
// 13. SETTINGS
// ══════════════════════════════════════════
 
function openSettings() {
  const modal = document.getElementById('settings-modal');
  modal.classList.remove('hidden');
  modal.style.display = 'flex';
}
 
function closeSettings() {
  const modal = document.getElementById('settings-modal');
  modal.classList.add('hidden');
  modal.style.display = '';
}
 
function closeModalOutside(event) {
  if (event.target === document.getElementById('settings-modal')) {
    closeSettings();
  }
}
 
function saveSettings() {
  const name = document.getElementById('settings-name').value.trim();
  const pass = document.getElementById('settings-pass').value;
 
  if (name && appState.user) {
    const parts = name.split(' ');
    appState.user.firstName = parts[0] || appState.user.firstName;
    appState.user.lastName  = parts.slice(1).join(' ') || appState.user.lastName;
    document.getElementById('user-greeting').textContent = `أهلاً بك يا ${appState.user.firstName} 👋`;
  }
 
  if (pass && pass.length >= 6) {
    if (DEMO_MODE && appState.user) {
      const users = JSON.parse(localStorage.getItem('aligpt_users') || '[]');
      const idx = users.findIndex(u => u.email === appState.user.email);
      if (idx !== -1) { users[idx].password = pass; localStorage.setItem('aligpt_users', JSON.stringify(users)); }
    }
    showToast('تم تحديث كلمة المرور', 'success');
  }
 
  saveToStorage();
  closeSettings();
  showToast('تم حفظ التغييرات ✅', 'success');
}
 
function clearAllChats() {
  if (confirm('هل أنت متأكد؟ سيتم حذف جميع المحادثات نهائياً!')) {
    appState.chats = {};
    appState.currentChatId = null;
    saveToStorage();
    newChat();
    renderHistory();
    closeSettings();
    showToast('تم حذف جميع المحادثات 🗑', 'success');
  }
}
 
// ══════════════════════════════════════════
// 14. SIDEBAR
// ══════════════════════════════════════════
 
function toggleSidebar(forceClose = false) {
  const sidebar = document.getElementById('sidebar');
  if (forceClose) {
    sidebar.classList.add('collapsed');
  } else {
    sidebar.classList.toggle('collapsed');
  }
}
 
// ══════════════════════════════════════════
// 15. LOGOUT
// ══════════════════════════════════════════
 
function handleLogout() {
  if (!confirm('هل تريد تسجيل الخروج؟')) return;
  appState.user = null;
  appState.currentChatId = null;
  saveToStorage();
  showPage('page-landing');
  showToast('تم تسجيل الخروج. إلى اللقاء! 👋', 'success');
}
 
// ══════════════════════════════════════════
// 16. HELPERS
// ══════════════════════════════════════════
 
function showError(id, msg) {
  const el = document.getElementById(id);
  if (!el) return;
  el.textContent = msg;
  el.classList.remove('hidden');
}
 
function clearError(id) {
  const el = document.getElementById(id);
  if (el) el.classList.add('hidden');
}
 
function showToast(msg, type = '') {
  const toast = document.getElementById('toast');
  toast.textContent = msg;
  toast.className = `toast ${type} show`;
  setTimeout(() => toast.classList.remove('show'), 3000);
}
 
function togglePass(inputId) {
  const input = document.getElementById(inputId);
  input.type = input.type === 'password' ? 'text' : 'password';
}
 
function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}
 
function genId() {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}
 
function truncate(str, n) {
  return str.length > n ? str.slice(0, n) + '…' : str;
}
 
function getCurrentTime() {
  return new Date().toLocaleTimeString('ar-DZ', { hour: '2-digit', minute: '2-digit' });
}
 
function fakeDelay(ms) {
  return new Promise(res => setTimeout(res, ms));
}
 
