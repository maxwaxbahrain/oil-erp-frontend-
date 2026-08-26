import { useState, useEffect, useRef } from 'react';
import { 
  FileText, Mic, Square, Loader2, CheckCircle2, Clock, 
  Trash2, ChevronDown, ChevronUp, AlertCircle, FileAudio, Users, Target, Download, X, Video, Share2, Mail, MessageSquare, Smartphone, Sparkles
} from 'lucide-react';
import { useMeetingRecorder, TRANSCRIPT_SAVED_RETRY, type MeetingNote } from '../../hooks/useMeetingRecorder';
import { isStaging } from '../../config/appEnv';
import jsPDF from 'jspdf';
import { getEmployees, type Employee } from '../../services/payrollService';
import { getChannels, sendMessage, type ChatChannel } from '../../services/chatService';
import {
  deleteMeeting,
  getMeeting,
  listMeetings,
  processMeetingTranscript,
  updateMeeting,
  type Meeting,
  type MeetingListItem,
} from '../../services/meetingService';

function formatDuration(seconds: number) {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s < 10 ? '0' : ''}${s}`;
}

function formatDate(isoStr: string) {
  return new Date(isoStr).toLocaleDateString(undefined, { 
    year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' 
  });
}

function buildPulseShareText(note: MeetingNote | MeetingListItem): string {
  const header = `📄 Meeting Notes: ${note.title}\n📅 Date: ${formatDate(note.meeting_date)}\n👥 Attendees: ${note.members?.join(', ') || 'None'}`;
  const decisions = `✅ Decisions:\n${note.decisions?.map(d => '• ' + d.decision).join('\n') || 'None'}`;
  const actions = `🎯 Action Items:\n${note.action_items?.map(a => '• [' + a.owner + '] ' + a.task).join('\n') || 'None'}`;
  if ((note.summary || '').trim()) {
    return `${header}\n\n📝 Summary:\n${note.summary}\n\n${decisions}\n\n${actions}`;
  }
  return `${header}\n\n${decisions}\n\n${actions}`;
}

export default function MeetingNotes() {
  const { status, isSupported, liveTranscript, duration, startRecording, stopRecording, analyzeTranscript, lastNote, error, tabBackgroundWarning } = useMeetingRecorder();
  
  const [title, setTitle] = useState('');
  const [savedNotes, setSavedNotes] = useState<MeetingListItem[]>([]);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [fullMeetings, setFullMeetings] = useState<Record<number, Meeting>>({});
  const [transcriptLoadingId, setTranscriptLoadingId] = useState<number | null>(null);
  const [summarizingId, setSummarizingId] = useState<number | null>(null);
  const [historyError, setHistoryError] = useState<string | null>(null);
  const [transcriptLoadError, setTranscriptLoadError] = useState<Record<number, string>>({});

  // BUG FIX 1: Add Members via Employee Portal Search
  const [memberInput, setMemberInput] = useState('');
  const [members, setMembers] = useState<string[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [filteredEmployees, setFilteredEmployees] = useState<Employee[]>([]);
  const [showEmployeeDropdown, setShowEmployeeDropdown] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Feature 2: Zoom Paste Transcript
  const [pasteMode, setPasteMode] = useState(false);
  const [pastedTranscript, setPastedTranscript] = useState('');

  // Feature 1: Google Meet Modal
  const [showMeetNotice, setShowMeetNotice] = useState(false);

  // Feature 3: Share menu
  const [shareOpenId, setShareOpenId] = useState<number | 'recent' | null>(null);
  const shareMenuRef = useRef<HTMLDivElement>(null);
  const [pulseShareNote, setPulseShareNote] = useState<MeetingNote | MeetingListItem | null>(null);
  const [pulseChannels, setPulseChannels] = useState<ChatChannel[]>([]);
  const [pulseChannelId, setPulseChannelId] = useState<number | null>(null);
  const [pulseShareStatus, setPulseShareStatus] = useState<'idle' | 'loading' | 'posting' | 'success' | 'error'>('idle');
  const [pulseShareMessage, setPulseShareMessage] = useState<string | null>(null);
  const [sharedInSession, setSharedInSession] = useState<Partial<Record<number | 'recent', string>>>({});

  const refreshNotes = async (): Promise<MeetingListItem[]> => {
    try {
      const rows = await listMeetings(50);
      setSavedNotes(rows);
      return rows;
    } catch {
      setSavedNotes([]);
      return [];
    }
  };

  const loadFullMeeting = async (id: number) => {
    setTranscriptLoadingId(id);
    try {
      const full = await getMeeting(id);
      setFullMeetings((prev) => ({ ...prev, [id]: full }));
      setTranscriptLoadError((prev) => {
        const next = { ...prev };
        delete next[id];
        return next;
      });
    } catch {
      setTranscriptLoadError((prev) => ({
        ...prev,
        [id]: 'Could not load this transcript. Try expanding again.',
      }));
    } finally {
      setTranscriptLoadingId(null);
    }
  };

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const rows = await refreshNotes();
      if (cancelled) return;
      if (status === 'error' && error === TRANSCRIPT_SAVED_RETRY && rows[0]) {
        setExpandedId(rows[0].id);
        await loadFullMeeting(rows[0].id);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [status, error]); 

  useEffect(() => {
    getEmployees().then(setEmployees);
  }, []);

  // Close dropdowns on click outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowEmployeeDropdown(false);
      }
      if (shareMenuRef.current && !shareMenuRef.current.contains(event.target as Node)) {
        setShareOpenId(null);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleDelete = async (id: number) => {
    try {
      await deleteMeeting(id);
      setSavedNotes((prev) => prev.filter((n) => n.id !== id));
      setFullMeetings((prev) => {
        const next = { ...prev };
        delete next[id];
        return next;
      });
      if (expandedId === id) setExpandedId(null);
    } catch {
      await refreshNotes();
    }
  };

  const toggleExpand = async (id: number) => {
    if (expandedId === id) {
      setExpandedId(null);
      return;
    }
    setExpandedId(id);
    if (fullMeetings[id]) {
      setTranscriptLoadError((prev) => {
        const next = { ...prev };
        delete next[id];
        return next;
      });
      return;
    }
    await loadFullMeeting(id);
  };

  const handleGenerateSummary = async (id: number) => {
    setHistoryError(null);
    setSummarizingId(id);
    try {
      const full = fullMeetings[id] ?? await getMeeting(id);
      setFullMeetings((prev) => ({ ...prev, [id]: full }));
      const analysis = await processMeetingTranscript(full.transcript, full.title);
      const updated = await updateMeeting(id, {
        summary: analysis.summary,
        decisions: analysis.decisions,
        action_items: analysis.action_items,
        key_topics: analysis.key_topics,
      });
      setFullMeetings((prev) => ({ ...prev, [id]: updated }));
      await refreshNotes();
    } catch {
      setHistoryError('Transcript is saved. Summary could not be generated — try again.');
    } finally {
      setSummarizingId(null);
    }
  };

  const handleMemberInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setMemberInput(val);
    if (val.trim() === '') {
      setShowEmployeeDropdown(false);
    } else {
      const lower = val.toLowerCase();
      setFilteredEmployees(employees.filter(emp => 
        emp.name.toLowerCase().includes(lower) || emp.jobTitle.toLowerCase().includes(lower)
      ));
      setShowEmployeeDropdown(true);
    }
  };

  const handleSelectEmployee = (emp: Employee) => {
    if (!members.includes(emp.name)) {
      setMembers([...members, emp.name]);
    }
    setMemberInput('');
    setShowEmployeeDropdown(false);
  };

  const removeMember = (m: string) => {
    setMembers(members.filter(member => member !== m));
  };

  // Feature 2: PDF Download
  const handleDownloadPDF = (note: {
    title: string;
    meeting_date: string;
    duration_seconds: number;
    members: string[];
    summary: string;
    decisions: MeetingNote['decisions'];
    action_items: MeetingNote['action_items'];
  }) => {
    const doc = new jsPDF();
    let y = 20;
    
    const checkY = (addSpace: number) => {
      if (y + addSpace > 280) {
        doc.addPage();
        y = 20;
      }
    };

    doc.setFontSize(22);
    doc.setTextColor(128, 0, 32); 
    doc.text(`Meeting Notes: ${note.title}`, 20, y);
    y += 10;
    
    doc.setFontSize(11);
    doc.setTextColor(100, 100, 100);
    doc.text(`Date: ${formatDate(note.meeting_date)}`, 20, y);
    y += 6;
    doc.text(`Duration: ${formatDuration(note.duration_seconds)}`, 20, y);
    y += 6;
    if (note.members && note.members.length > 0) {
      doc.text(`Attendees: ${note.members.join(', ')}`, 20, y);
    }
    y += 12;

    doc.setFontSize(16);
    doc.setTextColor(0, 0, 0);
    doc.text('Summary', 20, y);
    y += 8;
    doc.setFontSize(11);
    const summaryLines = doc.splitTextToSize(note.summary, 170);
    doc.text(summaryLines, 20, y);
    y += (summaryLines.length * 5) + 10;
    checkY(20);

    if (note.decisions && note.decisions.length > 0) {
      doc.setFontSize(16);
      doc.setTextColor(0, 0, 0);
      doc.text('Decisions', 20, y);
      y += 8;
      doc.setFontSize(11);
      note.decisions.forEach(d => {
        checkY(15);
        doc.setFont('helvetica', 'bold');
        doc.text(`• ${d.decision}`, 20, y);
        y += 5;
        if (d.context) {
          doc.setFont('helvetica', 'normal');
          doc.setTextColor(100, 100, 100);
          const ctxLines = doc.splitTextToSize(`  Context: ${d.context}`, 170);
          doc.text(ctxLines, 20, y);
          y += (ctxLines.length * 5) + 3;
          doc.setTextColor(0, 0, 0);
        }
      });
      y += 5;
    }
    checkY(20);

    if (note.action_items && note.action_items.length > 0) {
      doc.setFontSize(16);
      doc.setTextColor(0, 0, 0);
      doc.text('Action Items', 20, y);
      y += 8;
      doc.setFontSize(11);
      note.action_items.forEach(a => {
        checkY(10);
        doc.setFont('helvetica', 'bold');
        doc.text(`• [${a.owner}] ${a.task} (Due: ${a.deadline})`, 20, y);
        y += 6;
      });
    }

    doc.save(`Meeting-Notes-${note.meeting_date.split('T')[0]}.pdf`);
  };

  const handleZoomAnalyse = () => {
    if (!pastedTranscript.trim()) return;
    analyzeTranscript(pastedTranscript, title, members);
  };

  // FEATURE 3: Share Options
  const sessionShareKey = (note: MeetingNote | MeetingListItem): number | 'recent' =>
    note.id ?? 'recent';

  const openPulsePicker = async (note: MeetingNote | MeetingListItem) => {
    setShareOpenId(null);
    setPulseShareNote(note);
    setPulseShareStatus('loading');
    setPulseShareMessage(null);
    setPulseChannelId(null);
    try {
      const channels = (await getChannels()).filter((c) => c.type === 'channel');
      setPulseChannels(channels);
      const preferred = channels.find((c) => c.is_default) ?? channels[0];
      setPulseChannelId(preferred ? preferred.id : null);
      if (channels.length === 0) {
        setPulseShareStatus('error');
        setPulseShareMessage('No Pulse channels available.');
      } else {
        setPulseShareStatus('idle');
      }
    } catch {
      setPulseChannels([]);
      setPulseShareStatus('error');
      setPulseShareMessage('Could not load Pulse channels.');
    }
  };

  const closePulsePicker = () => {
    setPulseShareNote(null);
    setPulseChannels([]);
    setPulseChannelId(null);
    setPulseShareStatus('idle');
    setPulseShareMessage(null);
  };

  const confirmPulseShare = async () => {
    if (!pulseShareNote || pulseChannelId == null) return;
    const channel = pulseChannels.find((c) => c.id === pulseChannelId);
    if (!channel) return;
    setPulseShareStatus('posting');
    setPulseShareMessage(null);
    try {
      await sendMessage(channel.id, buildPulseShareText(pulseShareNote), []);
      setPulseShareStatus('success');
      setPulseShareMessage(`Shared to Pulse (${channel.name}) successfully!`);
      setSharedInSession((prev) => ({
        ...prev,
        [sessionShareKey(pulseShareNote)]: channel.name,
      }));
    } catch {
      setPulseShareStatus('error');
      setPulseShareMessage('Failed to share to Pulse.');
    }
  };

  const shareViaEmail = (note: MeetingNote | MeetingListItem) => {
    const summary = `Meeting Notes: ${note.title}\nDate: ${formatDate(note.meeting_date)}\nAttendees: ${note.members?.join(', ') || 'None'}\n\nSummary:\n${note.summary}\n\nDecisions:\n${note.decisions?.map(d => '• ' + d.decision).join('\n') || 'None'}\n\nAction Items:\n${note.action_items?.map(a => '• [' + a.owner + '] ' + a.task).join('\n') || 'None'}`;
    window.open(`mailto:?subject=Meeting Notes — ${formatDate(note.meeting_date)}&body=${encodeURIComponent(summary)}`);
    setShareOpenId(null);
  };

  const shareViaSMS = (note: MeetingNote | MeetingListItem) => {
    const summary = `Meeting: ${note.title}\nDecisions:\n${note.decisions?.map(d => '• ' + d.decision).join('\n') || 'None'}\nAction Items:\n${note.action_items?.map(a => '• [' + a.owner + '] ' + a.task).join('\n') || 'None'}`;
    window.open(`sms:?body=${encodeURIComponent(summary)}`);
    setShareOpenId(null);
  };

  // Removed early return for !isSupported so the rest of the page still renders

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <div className="flex items-center gap-3 mb-8">
        <div className="p-3 bg-purple-100 text-purple-700 rounded-xl">
          <FileText size={28} />
        </div>
        <div>
          <h1 className="text-2xl font-black text-gray-900">Meeting Notes</h1>
          <p className="text-gray-500">Listens through this device&apos;s microphone and summarises with AI</p>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 p-4 rounded-xl flex items-center gap-3">
          <AlertCircle size={20} />
          <p>{error}</p>
        </div>
      )}

      {/* Recording Control Panel */}
      <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm">
        {!isSupported ? (
          <div className="bg-red-50 border border-red-200 text-red-700 p-4 rounded-xl flex items-center gap-3">
            <AlertCircle size={20} />
            <p className="font-bold">Live Audio Recording is not supported in this browser. Please use Google Chrome, or use the Zoom/Meet options below.</p>
          </div>
        ) : status === 'idle' || status === 'done' || status === 'error' ? (
          <div className="space-y-4">
            <div className="flex flex-col md:flex-row items-start gap-4">
              <div className="flex-1 w-full space-y-3">
                <input 
                  type="text" 
                  placeholder="Meeting Title (e.g., Weekly Sync)" 
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 outline-none focus:border-purple-500 font-medium"
                />
                
                {/* BUG FIX 1: Add Members Search Dropdown */}
                <div className="bg-gray-50 border border-gray-200 rounded-xl px-4 py-2 flex flex-wrap items-center gap-2 relative" ref={dropdownRef}>
                  {members.map(m => (
                    <span key={m} className="bg-purple-100 text-purple-800 px-3 py-1 rounded-full text-sm font-bold flex items-center gap-1">
                      {m}
                      <X size={14} className="cursor-pointer hover:text-purple-900" onClick={() => removeMember(m)} />
                    </span>
                  ))}
                  <div className="flex-1 relative min-w-[200px]">
                    <input 
                      type="text"
                      placeholder="Search employee to add..."
                      value={memberInput}
                      onChange={handleMemberInputChange}
                      onFocus={() => { if (memberInput.trim()) setShowEmployeeDropdown(true); }}
                      className="w-full bg-transparent py-1 outline-none text-sm font-medium text-gray-700"
                    />
                    {showEmployeeDropdown && (
                      <div className="absolute top-full left-0 mt-2 w-full max-w-sm bg-white border border-gray-200 rounded-xl shadow-xl z-50 overflow-hidden max-h-60 overflow-y-auto">
                        {filteredEmployees.length === 0 ? (
                          <div className="p-3 text-sm text-gray-500 text-center">No employees found.</div>
                        ) : (
                          filteredEmployees.map(emp => (
                            <div 
                              key={emp.id}
                              onClick={() => handleSelectEmployee(emp)}
                              className="px-4 py-3 hover:bg-gray-50 cursor-pointer border-b border-gray-100 last:border-0"
                            >
                              <div className="font-bold text-gray-900 text-sm">{emp.name}</div>
                              <div className="text-xs text-gray-500">{emp.jobTitle} • {emp.department}</div>
                            </div>
                          ))
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <button 
                onClick={() => startRecording(title, members)}
                className="w-full md:w-auto min-h-[104px] bg-purple-600 hover:bg-purple-700 text-white px-8 py-3 rounded-xl font-bold flex flex-col items-center justify-center gap-2 transition-colors"
              >
                <Mic size={24} /> Start Recording
              </button>
            </div>
            <p className="text-sm text-gray-500">
              Microphone only — best for in-room meetings. Phone or video calls on another device may be picked up poorly.
            </p>
          </div>
        ) : status === 'recording' ? (
          <div className="space-y-4">
            <div className="flex flex-col md:flex-row items-center justify-between gap-4">
              <div className="flex flex-col gap-2">
                <div className="flex items-center gap-4">
                  <div className="w-4 h-4 bg-red-500 rounded-full animate-pulse" />
                  <div className="text-lg font-black text-gray-900">{title || 'Team Meeting'}</div>
                  <div className="text-gray-500 font-mono bg-gray-100 px-3 py-1 rounded-lg">{formatDuration(duration)}</div>
                </div>
                {members.length > 0 && (
                  <div className="text-sm text-gray-500 font-medium">
                    Attendees: {members.join(', ')}
                  </div>
                )}
              </div>
              <button 
                onClick={stopRecording}
                className="w-full md:w-auto bg-red-500 hover:bg-red-600 text-white px-6 py-3 rounded-xl font-bold flex items-center justify-center gap-2 transition-colors"
              >
                <Square size={20} fill="currentColor" /> Stop & Process
              </button>
            </div>
            <p className="text-sm text-gray-500">
              Keep this tab open and in front of you, with your microphone enabled.
            </p>
            {tabBackgroundWarning && (
              <div className="bg-amber-50 border border-amber-200 text-amber-900 p-4 rounded-xl flex items-start gap-3">
                <AlertCircle size={20} className="shrink-0 mt-0.5" />
                <p className="text-sm font-medium">
                  This tab was in the background during recording. Some speech may not have been captured.
                </p>
              </div>
            )}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center gap-3 py-8 text-purple-600 font-bold">
            <Loader2 size={32} className="animate-spin" />
            <p className="text-lg">Saving transcript, then analyzing with AI...</p>
          </div>
        )}

        {status === 'recording' && (
          <div className="mt-6 bg-gray-50 border border-gray-200 rounded-xl p-4 h-64 overflow-y-auto">
            <p className="text-gray-700 whitespace-pre-wrap">{liveTranscript || 'Listening...'}</p>
          </div>
        )}
      </div>

      {/* Feature 3: Google Meet & Zoom Integration */}
      {(status === 'idle' || status === 'done' || status === 'error') && (
        <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm">
          <h2 className="text-lg font-black text-gray-900 mb-4 flex items-center gap-2">
            <Video size={20} className="text-blue-600" />
            Join from Meeting Platform
          </h2>
          <div className="flex flex-col sm:flex-row gap-4 mb-4">
            {isStaging && (
            <button 
              className="flex-1 bg-white border-2 border-blue-100 hover:border-blue-300 text-blue-700 px-4 py-3 rounded-xl font-bold flex items-center justify-center gap-2 transition-all"
              onClick={() => { setShowMeetNotice(true); setPasteMode(false); }}
            >
              <Video size={18} /> Google Meet (via Extension)
            </button>
            )}
            <button 
              className={`flex-1 px-4 py-3 rounded-xl font-bold flex items-center justify-center gap-2 transition-all ${
                pasteMode ? 'bg-blue-600 text-white' : 'bg-white border-2 border-blue-100 hover:border-blue-300 text-blue-700'
              }`}
              onClick={() => { setPasteMode(true); setShowMeetNotice(false); }}
            >
              <FileText size={18} /> Zoom (Paste Transcript)
            </button>
          </div>

          {/* FEATURE 2: Zoom Transcript Instructions */}
          {pasteMode && (
            <div className="space-y-4 animate-in slide-in-from-top-2">
              <div className="bg-blue-50 border border-blue-200 rounded-xl p-5 text-blue-900">
                <h3 className="font-black mb-3">How to use Zoom Transcript:</h3>
                <ol className="list-decimal list-inside space-y-2 text-sm font-medium">
                  <li>In your Zoom meeting click <strong>CC (Closed Captions)</strong> to enable captions.</li>
                  <li>After the meeting, go to <strong>zoom.us/recording</strong> and download the transcript.</li>
                  <li>Copy the transcript text and paste it in the text area below.</li>
                </ol>
              </div>
              <textarea
                className="w-full h-40 bg-gray-50 border border-gray-200 rounded-xl p-4 text-sm font-medium outline-none focus:border-blue-500"
                placeholder="Paste your Zoom transcript text here..."
                value={pastedTranscript}
                onChange={(e) => setPastedTranscript(e.target.value)}
              />
              <button
                onClick={handleZoomAnalyse}
                disabled={!pastedTranscript.trim()}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-xl font-bold disabled:opacity-50"
              >
                Analyse Transcript
              </button>
            </div>
          )}
        </div>
      )}

      {/* Result Card for Just Finished Meeting */}
      {status === 'done' && lastNote && (
        <div className="bg-gradient-to-br from-purple-50 to-white border border-purple-200 rounded-2xl p-6 shadow-sm">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
            <div className="flex items-center gap-2 text-purple-700">
              <CheckCircle2 size={24} />
              <h2 className="text-xl font-black">Analysis Complete</h2>
            </div>
            
            <div className="flex items-center gap-2 relative">
              <button 
                onClick={() => handleDownloadPDF(lastNote)}
                className="bg-white border border-gray-200 hover:border-gray-300 text-gray-700 px-4 py-2 rounded-lg font-bold flex items-center gap-2 transition-colors shadow-sm"
              >
                <Download size={16} /> Download PDF
              </button>
              
              {/* FEATURE 3: Share Dropdown */}
              <div ref={shareMenuRef}>
                <button 
                  onClick={() => setShareOpenId(shareOpenId === 'recent' ? null : 'recent')}
                  className="bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-lg font-bold flex items-center gap-2 transition-colors shadow-sm"
                >
                  <Share2 size={16} /> Share
                </button>
                {shareOpenId === 'recent' && (
                  <div className="absolute right-0 top-full mt-2 w-64 bg-white border border-gray-200 rounded-xl shadow-xl z-50 overflow-hidden">
                    <button onClick={() => void openPulsePicker(lastNote)} className="w-full px-4 py-3 text-left hover:bg-gray-50 flex items-center gap-3 border-b border-gray-100 transition-colors">
                      <MessageSquare size={16} className="text-gray-500" />
                      <div>
                        <div className="text-sm font-bold text-gray-900">Pulse Team Chat</div>
                        <div className="text-xs text-gray-500">
                          {sharedInSession[sessionShareKey(lastNote)]
                            ? `Shared to ${sharedInSession[sessionShareKey(lastNote)]} (this session)`
                            : 'Choose a Pulse channel'}
                        </div>
                      </div>
                    </button>
                    <button onClick={() => shareViaEmail(lastNote)} className="w-full px-4 py-3 text-left hover:bg-gray-50 flex items-center gap-3 border-b border-gray-100 transition-colors">
                      <Mail size={16} className="text-gray-500" />
                      <div>
                        <div className="text-sm font-bold text-gray-900">Email</div>
                        <div className="text-xs text-gray-500">Send via email client</div>
                      </div>
                    </button>
                    <button onClick={() => shareViaSMS(lastNote)} className="w-full px-4 py-3 text-left hover:bg-gray-50 flex items-center gap-3 transition-colors">
                      <Smartphone size={16} className="text-gray-500" />
                      <div>
                        <div className="text-sm font-bold text-gray-900">SMS / Message</div>
                        <div className="text-xs text-gray-500">Send summary text</div>
                      </div>
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
          
          <div className="space-y-6">
            <div>
              <h3 className="text-lg font-black text-gray-900 border-b-2 border-purple-100 pb-2 mb-3">Meeting Summary</h3>
              <p className="text-gray-800 text-base leading-relaxed">{lastNote.summary}</p>
            </div>

            {lastNote.key_topics && lastNote.key_topics.length > 0 && (
              <div>
                <h3 className="text-lg font-black text-gray-900 border-b-2 border-purple-100 pb-2 mb-3">Key Topics</h3>
                <div className="flex flex-wrap gap-2">
                  {lastNote.key_topics.map((t, i) => (
                    <span key={i} className="bg-purple-100 text-purple-800 px-3 py-1 rounded-full text-sm font-bold">
                      {t}
                    </span>
                  ))}
                </div>
              </div>
            )}

            <div className="grid md:grid-cols-2 gap-6 pt-4 border-t border-purple-100">
              <div>
                <h3 className="text-lg font-black text-gray-900 border-b-2 border-blue-100 pb-2 mb-3 flex items-center gap-2">
                  <Target size={18} className="text-blue-600" /> Decisions Made
                </h3>
                <div className="space-y-3">
                  {lastNote.decisions.map((d, i) => (
                    <div key={i} className="bg-blue-50 border border-blue-200 rounded-xl p-4">
                      <p className="font-bold text-blue-900 text-base">{d.decision}</p>
                      {d.context && <p className="text-sm text-blue-700 mt-2 border-t border-blue-200/50 pt-2">{d.context}</p>}
                    </div>
                  ))}
                  {lastNote.decisions.length === 0 && <p className="text-gray-500 text-sm italic">No decisions recorded.</p>}
                </div>
              </div>

              <div>
                <h3 className="text-lg font-black text-gray-900 border-b-2 border-green-100 pb-2 mb-3 flex items-center gap-2">
                  <Users size={18} className="text-green-600" /> Action Items
                </h3>
                <div className="space-y-3">
                  {lastNote.action_items.map((a, i) => (
                    <div key={i} className="bg-green-50 border border-green-200 rounded-xl p-4 flex flex-col gap-3">
                      <p className="font-bold text-green-900 text-base">{a.task}</p>
                      <div className="flex items-center gap-4 text-sm font-bold text-green-700 bg-green-100/50 p-2 rounded-lg">
                        <span className="flex items-center gap-1"><Users size={14}/> {a.owner}</span>
                        <span className="flex items-center gap-1"><Clock size={14}/> {a.deadline}</span>
                      </div>
                    </div>
                  ))}
                  {lastNote.action_items.length === 0 && <p className="text-gray-500 text-sm italic">No action items recorded.</p>}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Past Meetings List */}
      <div className="pt-4">
        <h2 className="text-xl font-black text-gray-900 mb-4">Past Meetings History</h2>
        {historyError && (
          <div className="bg-amber-50 border border-amber-200 text-amber-800 p-3 rounded-xl mb-4 text-sm font-medium">
            {historyError}
          </div>
        )}
        
        {savedNotes.length === 0 ? (
          <div className="text-center py-12 bg-white border border-gray-200 rounded-2xl">
            <FileAudio size={48} className="mx-auto text-gray-300 mb-4" />
            <p className="text-gray-500 font-medium">No meeting notes yet. Start recording above!</p>
          </div>
        ) : (
          <div className="space-y-3">
            {savedNotes.map((note) => (
              <div
                key={note.id}
                className={`bg-white border rounded-2xl overflow-hidden shadow-sm hover:shadow transition-shadow ${
                  expandedId === note.id && error === TRANSCRIPT_SAVED_RETRY
                    ? 'border-purple-400 ring-2 ring-purple-200'
                    : 'border-gray-200'
                }`}
              >
                <div 
                  className="p-5 flex items-center justify-between cursor-pointer hover:bg-gray-50 transition-colors"
                  onClick={() => toggleExpand(note.id)}
                >
                  <div className="flex-1">
                    <h3 className="font-black text-gray-900 text-lg">{note.title}</h3>
                    <div className="flex flex-wrap items-center gap-3 mt-2 text-sm text-gray-500 font-medium">
                      <span>{formatDate(note.meeting_date)}</span>
                      {note.duration_seconds > 0 && (
                        <span className="flex items-center gap-1"><Clock size={14} /> {formatDuration(note.duration_seconds)}</span>
                      )}
                      {note.members && note.members.length > 0 && (
                        <span className="flex items-center gap-1 text-purple-600 bg-purple-50 px-2 py-0.5 rounded">
                          <Users size={14} /> {note.members.length} Members
                        </span>
                      )}
                      <span className="bg-green-100 text-green-800 px-2 py-0.5 rounded text-xs font-bold">
                        {note.action_items?.length || 0} Actions
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    {!note.summary.trim() && (
                      <button
                        onClick={(e) => { e.stopPropagation(); void handleGenerateSummary(note.id); }}
                        disabled={summarizingId === note.id}
                        className="px-3 py-1.5 text-xs font-bold text-purple-700 bg-purple-50 hover:bg-purple-100 rounded-lg transition-colors flex items-center gap-1 disabled:opacity-50"
                      >
                        {summarizingId === note.id ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
                        Generate summary
                      </button>
                    )}
                    <button 
                      onClick={(e) => { e.stopPropagation(); handleDownloadPDF(note); }}
                      className="p-2 text-gray-400 hover:text-purple-600 hover:bg-purple-50 rounded-lg transition-colors"
                      title="Download PDF"
                    >
                      <Download size={18} />
                    </button>
                    <button 
                      onClick={(e) => { e.stopPropagation(); handleDelete(note.id); }}
                      className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                    >
                      <Trash2 size={18} />
                    </button>
                    {expandedId === note.id ? <ChevronUp size={20} className="text-gray-400" /> : <ChevronDown size={20} className="text-gray-400" />}
                  </div>
                </div>

                {expandedId === note.id && (
                  <div className="p-6 bg-gray-50 border-t border-gray-100 space-y-6">
                    <div className="flex items-center justify-between">
                      {note.members && note.members.length > 0 && (
                        <div className="flex-1">
                          <h4 className="text-sm font-black text-gray-900 border-b border-gray-200 pb-2 mb-2">Attendees</h4>
                          <div className="flex flex-wrap gap-2">
                            {note.members.map(m => (
                              <span key={m} className="bg-white border border-gray-200 text-gray-700 px-3 py-1 rounded-full text-xs font-bold">
                                {m}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                      
                      {/* Past Meeting Share Button */}
                      <div className="relative">
                        <button 
                          onClick={() => setShareOpenId(shareOpenId === note.id ? null : note.id)}
                          className="bg-white border border-gray-200 hover:border-gray-300 text-gray-700 px-3 py-1.5 rounded-lg font-bold flex items-center gap-2 transition-colors shadow-sm text-xs"
                        >
                          <Share2 size={14} /> Share
                        </button>
                        {shareOpenId === note.id && (
                          <div className="absolute right-0 top-full mt-2 w-56 bg-white border border-gray-200 rounded-xl shadow-xl z-50 overflow-hidden">
                            <button onClick={() => void openPulsePicker(note)} className="w-full px-4 py-3 text-left hover:bg-gray-50 flex items-center gap-3 border-b border-gray-100 transition-colors">
                              <MessageSquare size={14} className="text-gray-500" />
                              <span className="text-sm font-bold text-gray-900">
                                {sharedInSession[note.id]
                                  ? `Pulse Chat · ${sharedInSession[note.id]} (this session)`
                                  : 'Pulse Chat'}
                              </span>
                            </button>
                            <button onClick={() => shareViaEmail(note)} className="w-full px-4 py-3 text-left hover:bg-gray-50 flex items-center gap-3 border-b border-gray-100 transition-colors">
                              <Mail size={14} className="text-gray-500" />
                              <span className="text-sm font-bold text-gray-900">Email</span>
                            </button>
                            <button onClick={() => shareViaSMS(note)} className="w-full px-4 py-3 text-left hover:bg-gray-50 flex items-center gap-3 transition-colors">
                              <Smartphone size={14} className="text-gray-500" />
                              <span className="text-sm font-bold text-gray-900">SMS</span>
                            </button>
                          </div>
                        )}
                      </div>
                    </div>

                    <div>
                      <h4 className="text-sm font-black text-gray-900 border-b border-gray-200 pb-2 mb-2">Summary</h4>
                      <p className="text-gray-800 text-base">{note.summary}</p>
                    </div>

                    {note.key_topics && note.key_topics.length > 0 && (
                      <div>
                        <h4 className="text-sm font-black text-gray-900 border-b border-gray-200 pb-2 mb-2">Key Topics</h4>
                        <div className="flex flex-wrap gap-2">
                          {note.key_topics.map((t, i) => (
                            <span key={i} className="bg-purple-100 text-purple-800 px-3 py-1 rounded-full text-xs font-bold">
                              {t}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    <div className="grid md:grid-cols-2 gap-4 pt-2">
                      <div className="bg-white border border-blue-100 rounded-xl p-4">
                        <h4 className="text-sm font-black text-blue-900 border-b border-blue-100 pb-2 mb-3">Decisions Made</h4>
                        <div className="space-y-4">
                          {note.decisions?.map((d, i) => (
                            <div key={i}>
                              <p className="font-bold text-gray-900 text-sm">{d.decision}</p>
                              {d.context && <p className="text-xs text-gray-500 mt-1">{d.context}</p>}
                            </div>
                          ))}
                          {(!note.decisions || note.decisions.length === 0) && <p className="text-xs text-gray-400 italic">None</p>}
                        </div>
                      </div>

                      <div className="bg-white border border-green-100 rounded-xl p-4">
                        <h4 className="text-sm font-black text-green-900 border-b border-green-100 pb-2 mb-3">Action Items</h4>
                        <div className="space-y-4">
                          {note.action_items?.map((a, i) => (
                            <div key={i} className="text-sm border-l-2 border-green-400 pl-3">
                              <p className="font-bold text-gray-900">{a.task}</p>
                              <p className="text-xs text-green-700 mt-1 font-bold">{a.owner} • {a.deadline}</p>
                            </div>
                          ))}
                          {(!note.action_items || note.action_items.length === 0) && <p className="text-xs text-gray-400 italic">None</p>}
                        </div>
                      </div>
                    </div>

                    <div>
                      <h4 className="text-sm font-black text-gray-900 border-b border-gray-200 pb-2 mb-2 mt-4">Raw Transcript</h4>
                      <div className={`bg-white border rounded-xl p-4 h-32 overflow-y-auto text-sm ${
                        transcriptLoadError[note.id]
                          ? 'border-red-200 text-red-700'
                          : 'border-gray-200 text-gray-600'
                      }`}>
                        {transcriptLoadError[note.id]
                          ? transcriptLoadError[note.id]
                          : transcriptLoadingId === note.id && !fullMeetings[note.id]
                            ? 'Loading transcript...'
                            : (fullMeetings[note.id]?.transcript || 'Transcript unavailable.')}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Pulse channel picker — session-only "already shared"; API cannot persist shared_message_id */}
      {pulseShareNote && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 animate-in fade-in">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden">
            <div className="bg-purple-600 p-6 flex items-center justify-between text-white">
              <div className="flex items-center gap-3">
                <MessageSquare size={28} />
                <h2 className="text-xl font-black">Share to Pulse</h2>
              </div>
              <button onClick={closePulsePicker} className="text-purple-100 hover:text-white transition-colors">
                <X size={24} />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <p className="text-gray-600 font-medium">
                Choose a channel for “{pulseShareNote.title}”.
              </p>
              {pulseShareStatus === 'loading' ? (
                <div className="flex items-center justify-center gap-2 py-8 text-purple-600 font-bold">
                  <Loader2 size={24} className="animate-spin" />
                  Loading channels...
                </div>
              ) : (
                <div className="border border-gray-200 rounded-xl max-h-64 overflow-y-auto">
                  {pulseChannels.length === 0 ? (
                    <div className="p-4 text-sm text-gray-500 text-center">No channels to share to.</div>
                  ) : (
                    pulseChannels.map((channel) => (
                      <label
                        key={channel.id}
                        className={`flex items-center gap-3 px-4 py-3 cursor-pointer border-b border-gray-100 last:border-0 ${
                          pulseChannelId === channel.id ? 'bg-purple-50' : 'hover:bg-gray-50'
                        }`}
                      >
                        <input
                          type="radio"
                          name="pulse-channel"
                          checked={pulseChannelId === channel.id}
                          onChange={() => setPulseChannelId(channel.id)}
                          disabled={pulseShareStatus === 'posting' || pulseShareStatus === 'success'}
                        />
                        <div>
                          <div className="text-sm font-bold text-gray-900">{channel.name}</div>
                          {channel.is_default && (
                            <div className="text-xs text-purple-600 font-medium">Default channel</div>
                          )}
                        </div>
                      </label>
                    ))
                  )}
                </div>
              )}
              {pulseShareMessage && (
                <div
                  className={`p-3 rounded-xl text-sm font-medium ${
                    pulseShareStatus === 'success'
                      ? 'bg-green-50 border border-green-200 text-green-800'
                      : 'bg-red-50 border border-red-200 text-red-700'
                  }`}
                >
                  {pulseShareMessage}
                </div>
              )}
              <div className="flex items-center gap-3">
                <button
                  onClick={closePulsePicker}
                  className="flex-1 px-4 py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl font-bold transition-colors"
                >
                  {pulseShareStatus === 'success' ? 'Done' : 'Cancel'}
                </button>
                {pulseShareStatus !== 'success' && (
                  <button
                    onClick={() => void confirmPulseShare()}
                    disabled={
                      pulseChannelId == null ||
                      pulseShareStatus === 'loading' ||
                      pulseShareStatus === 'posting' ||
                      pulseChannels.length === 0
                    }
                    className="flex-1 px-4 py-3 bg-purple-600 hover:bg-purple-700 text-white rounded-xl font-bold transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    {pulseShareStatus === 'posting' ? (
                      <>
                        <Loader2 size={16} className="animate-spin" />
                        Sharing...
                      </>
                    ) : (
                      'Share'
                    )}
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* FEATURE 1: Google Meet Extension Modal */}
      {isStaging && showMeetNotice && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 animate-in fade-in">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden">
            <div className="bg-blue-600 p-6 flex items-center justify-between text-white">
              <div className="flex items-center gap-3">
                <Video size={28} />
                <h2 className="text-xl font-black">Google Meet Setup</h2>
              </div>
              <button onClick={() => setShowMeetNotice(false)} className="text-blue-100 hover:text-white transition-colors">
                <X size={24} />
              </button>
            </div>
            
            <div className="p-6">
              <p className="text-gray-600 mb-6 font-medium">To capture live audio from Google Meet, you need to install the Soltol Chrome Extension once.</p>
              
              <ol className="space-y-4 mb-8">
                <li className="flex gap-3 text-sm">
                  <div className="w-6 h-6 rounded-full bg-blue-100 text-blue-700 font-black flex items-center justify-center flex-shrink-0">1</div>
                  <div className="font-medium text-gray-800">Install the Soltol Chrome Extension from the <strong>meet-extension</strong> folder</div>
                </li>
                <li className="flex gap-3 text-sm">
                  <div className="w-6 h-6 rounded-full bg-blue-100 text-blue-700 font-black flex items-center justify-center flex-shrink-0">2</div>
                  <div className="font-medium text-gray-800">Open Google Chrome and go to <strong className="bg-gray-100 px-2 py-0.5 rounded font-mono text-xs">chrome://extensions/</strong></div>
                </li>
                <li className="flex gap-3 text-sm">
                  <div className="w-6 h-6 rounded-full bg-blue-100 text-blue-700 font-black flex items-center justify-center flex-shrink-0">3</div>
                  <div className="font-medium text-gray-800">Turn on <strong>Developer Mode</strong> in the top right corner</div>
                </li>
                <li className="flex gap-3 text-sm">
                  <div className="w-6 h-6 rounded-full bg-blue-100 text-blue-700 font-black flex items-center justify-center flex-shrink-0">4</div>
                  <div className="font-medium text-gray-800">Click <strong>Load Unpacked</strong> and select the meet-extension folder</div>
                </li>
                <li className="flex gap-3 text-sm">
                  <div className="w-6 h-6 rounded-full bg-blue-100 text-blue-700 font-black flex items-center justify-center flex-shrink-0">5</div>
                  <div className="font-medium text-gray-800">Join your Google Meet call and turn on <strong>Captions</strong></div>
                </li>
                <li className="flex gap-3 text-sm">
                  <div className="w-6 h-6 rounded-full bg-blue-100 text-blue-700 font-black flex items-center justify-center flex-shrink-0">6</div>
                  <div className="font-medium text-gray-800">Click the Soltol icon in the Chrome toolbar and press <strong>Start Capturing</strong></div>
                </li>
              </ol>

              <div className="flex items-center gap-3">
                <button 
                  onClick={() => setShowMeetNotice(false)} 
                  className="flex-1 px-4 py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl font-bold transition-colors"
                >
                  Close
                </button>
                <button 
                  onClick={() => {
                    // Browser security prevents window.open for chrome:// URLs but we'll try/fallback or just tell user.
                    // This creates a popup or copy to clipboard
                    try {
                      navigator.clipboard.writeText('chrome://extensions/');
                      alert('Copied chrome://extensions/ to clipboard! Please paste it in a new tab.');
                    } catch(e) {
                      window.open('chrome://extensions/', '_blank');
                    }
                  }} 
                  className="flex-1 px-4 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold transition-colors"
                >
                  Open chrome://extensions/
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
