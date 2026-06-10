const CONFIG = {
  API_URL: 'https://bettano-erp-backend.onrender.com',
  STAGING_API_URL: 'https://bettano-erp-backend-staging.onrender.com',
  IS_STAGING: false
};

const API_BASE = CONFIG.IS_STAGING ? CONFIG.STAGING_API_URL : CONFIG.API_URL;

const STORAGE_KEYS = {
  access_token: 'access_token',
  username: 'username'
};

const authStatusEl = document.getElementById('auth-status');
const loginFieldsEl = document.getElementById('login-fields');
const loginBtnEl = document.getElementById('login');
const logoutBtnEl = document.getElementById('logout');
const loginErrorEl = document.getElementById('login-error');
const usernameInputEl = document.getElementById('username');
const passwordInputEl = document.getElementById('password');
const startBtnEl = document.getElementById('start');
const stopBtnEl = document.getElementById('stop');
const statusEl = document.getElementById('status');

function getStoredAuth() {
  return new Promise((resolve) => {
    chrome.storage.local.get([STORAGE_KEYS.access_token, STORAGE_KEYS.username], (result) => {
      resolve({
        token: result[STORAGE_KEYS.access_token] || null,
        username: result[STORAGE_KEYS.username] || null
      });
    });
  });
}

function saveAuth(token, username) {
  return new Promise((resolve) => {
    chrome.storage.local.set(
      { [STORAGE_KEYS.access_token]: token, [STORAGE_KEYS.username]: username },
      resolve
    );
  });
}

function clearAuth() {
  return new Promise((resolve) => {
    chrome.storage.local.remove([STORAGE_KEYS.access_token, STORAGE_KEYS.username], resolve);
  });
}

function setLoggedInUI(username) {
  authStatusEl.textContent = `Logged in as ${username}`;
  loginFieldsEl.style.display = 'none';
  logoutBtnEl.style.display = 'block';
  loginErrorEl.textContent = '';
  startBtnEl.disabled = false;
}

function setLoggedOutUI(message) {
  authStatusEl.textContent = 'Not logged in';
  loginFieldsEl.style.display = 'block';
  logoutBtnEl.style.display = 'none';
  startBtnEl.disabled = true;
  if (message) {
    loginErrorEl.textContent = message;
  } else {
    loginErrorEl.textContent = '';
  }
}

async function initAuthUI() {
  const { token, username } = await getStoredAuth();
  if (token && username) {
    setLoggedInUI(username);
  } else {
    setLoggedOutUI();
  }
}

async function handleSessionExpired() {
  await clearAuth();
  usernameInputEl.value = '';
  passwordInputEl.value = '';
  setLoggedOutUI('Your session expired. Please log in again.');
}

loginBtnEl.addEventListener('click', async () => {
  const username = usernameInputEl.value.trim();
  const password = passwordInputEl.value;

  if (!username || !password) {
    loginErrorEl.textContent = 'Enter username and password.';
    return;
  }

  loginBtnEl.disabled = true;
  loginErrorEl.textContent = '';

  try {
    const res = await fetch(`${API_BASE}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password })
    });

    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      const message = data.detail || data.message || 'Login failed.';
      loginErrorEl.textContent = typeof message === 'string' ? message : 'Login failed.';
      return;
    }

    if (!data.access_token) {
      loginErrorEl.textContent = 'Login succeeded but no token was returned.';
      return;
    }

    await saveAuth(data.access_token, data.username || username);
    passwordInputEl.value = '';
    setLoggedInUI(data.username || username);
  } catch (err) {
    loginErrorEl.textContent = err.message || 'Login failed.';
  } finally {
    loginBtnEl.disabled = false;
  }
});

logoutBtnEl.addEventListener('click', async () => {
  await clearAuth();
  usernameInputEl.value = '';
  passwordInputEl.value = '';
  setLoggedOutUI();
});

startBtnEl.addEventListener('click', async () => {
  const { token } = await getStoredAuth();
  if (!token) {
    setLoggedOutUI('Please log in to capture meetings.');
    return;
  }

  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab.url.includes('meet.google.com')) {
    alert('Please navigate to a Google Meet tab first.');
    return;
  }

  chrome.scripting.executeScript({
    target: { tabId: tab.id },
    files: ['content.js']
  }, () => {
    chrome.tabs.sendMessage(tab.id, { action: 'start' });
    startBtnEl.style.display = 'none';
    stopBtnEl.style.display = 'block';
    statusEl.innerText = 'Status: Capturing live transcript...';
  });
});

stopBtnEl.addEventListener('click', async () => {
  const { token } = await getStoredAuth();
  if (!token) {
    setLoggedOutUI('Please log in to process meetings.');
    return;
  }

  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  statusEl.innerText = 'Status: Processing with AI...';

  chrome.tabs.sendMessage(tab.id, { action: 'stop' }, async (response) => {
    if (response && response.transcript) {
      try {
        const res = await fetch(`${API_BASE}/api/ai/meeting/process`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`
          },
          body: JSON.stringify({
            transcript: response.transcript,
            meeting_title: 'Google Meet Sync'
          })
        });

        if (res.status === 401) {
          await handleSessionExpired();
          alert('Your session expired. Please log in again.');
          return;
        }

        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          const message = errData.detail || errData.message || `Request failed (${res.status})`;
          throw new Error(typeof message === 'string' ? message : `Request failed (${res.status})`);
        }

        const data = await res.json();

        chrome.tabs.create({ url: 'http://localhost:5174/pulse/notes' }, (newTab) => {
          chrome.scripting.executeScript({
            target: { tabId: newTab.id },
            func: (noteData) => {
              const note = {
                id: crypto.randomUUID(),
                title: 'Google Meet Sync',
                date: new Date().toISOString(),
                duration: 0,
                transcript: noteData.transcript,
                summary: noteData.data.summary || '',
                decisions: noteData.data.decisions || [],
                action_items: noteData.data.action_items || [],
                key_topics: noteData.data.key_topics || [],
                members: []
              };
              const existing = JSON.parse(localStorage.getItem('soltol_meeting_notes') || '[]');
              localStorage.setItem('soltol_meeting_notes', JSON.stringify([note, ...existing]));
              window.location.reload();
            },
            args: [{ transcript: response.transcript, data }]
          });
        });
      } catch (err) {
        alert('Error processing: ' + err.message);
      }
    } else {
      alert('No transcript captured. Make sure Google Meet Captions are turned on or you spoke out loud.');
    }

    startBtnEl.style.display = 'block';
    stopBtnEl.style.display = 'none';
    statusEl.innerText = 'Status: Idle';
  });
});

void initAuthUI();
