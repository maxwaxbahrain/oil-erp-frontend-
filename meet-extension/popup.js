let isRecording = false;

document.getElementById('start').addEventListener('click', async () => {
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
    document.getElementById('start').style.display = 'none';
    document.getElementById('stop').style.display = 'block';
    document.getElementById('status').innerText = 'Status: Capturing live transcript...';
  });
});

document.getElementById('stop').addEventListener('click', async () => {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  document.getElementById('status').innerText = 'Status: Processing with AI...';
  
  chrome.tabs.sendMessage(tab.id, { action: 'stop' }, async (response) => {
    if (response && response.transcript) {
      try {
        const res = await fetch('https://bettano-erp-backend.onrender.com/api/ai/meeting/process', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            transcript: response.transcript,
            meeting_title: 'Google Meet Sync'
          })
        });
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
               // Reload page to reflect changes
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
    
    document.getElementById('start').style.display = 'block';
    document.getElementById('stop').style.display = 'none';
    document.getElementById('status').innerText = 'Status: Idle';
  });
});
