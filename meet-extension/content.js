let isCapturing = false;
let fullTranscript = '';
let lastText = '';
let observer = null;

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'start') {
    if (isCapturing) {
      sendResponse({ status: 'already_started' });
      return true;
    }
    isCapturing = true;
    fullTranscript = '';
    
    // 1. Fallback: Web Speech API (listens to local mic)
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (SpeechRecognition) {
      const recognition = new SpeechRecognition();
      recognition.continuous = true;
      recognition.interimResults = false;
      recognition.onresult = (e) => {
        for (let i = e.resultIndex; i < e.results.length; ++i) {
          if (e.results[i].isFinal) fullTranscript += e.results[i][0].transcript + ' ';
        }
      };
      try {
        recognition.start();
        window.__soltolRecognition = recognition;
      } catch(e) {}
    }

    // 2. Google Meet DOM Observer for Captions
    observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        // We look for text nodes being added to the DOM
        if (mutation.addedNodes && mutation.addedNodes.length > 0) {
          for (let i = 0; i < mutation.addedNodes.length; i++) {
             const node = mutation.addedNodes[i];
             if (node.nodeType === Node.TEXT_NODE || node.nodeType === Node.ELEMENT_NODE) {
               const newText = node.textContent || node.innerText;
               // If it's a reasonably long string and doesn't exactly match the last one
               if (newText && newText.trim().length > 3 && newText !== lastText) {
                 fullTranscript += newText.trim() + ' ';
                 lastText = newText;
               }
             }
          }
        }
      });
    });
    
    // Observe body for changes (captions are added dynamically to the DOM)
    observer.observe(document.body, { childList: true, subtree: true, characterData: true });
    sendResponse({ status: 'started' });

  } else if (request.action === 'stop') {
    isCapturing = false;
    if (observer) {
      observer.disconnect();
      observer = null;
    }
    if (window.__soltolRecognition) {
      try { window.__soltolRecognition.stop(); } catch(e){}
      window.__soltolRecognition = null;
    }
    sendResponse({ transcript: fullTranscript.trim() });
  }
  return true;
});
