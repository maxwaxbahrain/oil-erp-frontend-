import React, { useState, useEffect } from 'react';
import { 
  FileText, Mic, Square, Loader2, CheckCircle2, Clock, 
  Trash2, ChevronDown, ChevronUp, AlertCircle, FileAudio, Users, Target
} from 'lucide-react';
import { useMeetingRecorder, getSavedNotes, deleteNote, MeetingNote } from '../../hooks/useMeetingRecorder';

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

export default function MeetingNotes() {
  const { status, isSupported, liveTranscript, duration, startRecording, stopRecording, lastNote, error } = useMeetingRecorder();
  const [title, setTitle] = useState('');
  const [savedNotes, setSavedNotes] = useState<MeetingNote[]>([]);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useEffect(() => {
    setSavedNotes(getSavedNotes());
  }, [status]); // Reload notes when status changes (e.g., when a new note is saved)

  const handleDelete = (id: string) => {
    deleteNote(id);
    setSavedNotes(getSavedNotes());
    if (expandedId === id) setExpandedId(null);
  };

  const toggleExpand = (id: string) => {
    setExpandedId(prev => prev === id ? null : id);
  };

  if (!isSupported) {
    return (
      <div className="p-6 max-w-4xl mx-auto">
        <div className="bg-red-50 border border-red-200 text-red-700 p-4 rounded-xl flex items-center gap-3">
          <AlertCircle size={24} />
          <p className="font-bold">Web Speech API is not supported in this browser. Please use Google Chrome.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <div className="flex items-center gap-3 mb-8">
        <div className="p-3 bg-purple-100 text-purple-700 rounded-xl">
          <FileText size={28} />
        </div>
        <div>
          <h1 className="text-2xl font-black text-gray-900">Meeting Notes</h1>
          <p className="text-gray-500">Live AI transcription & action item extraction</p>
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
        {status === 'idle' || status === 'done' || status === 'error' ? (
          <div className="flex flex-col md:flex-row items-center gap-4">
            <input 
              type="text" 
              placeholder="Meeting Title (e.g., Weekly Sync)" 
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="flex-1 bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 outline-none focus:border-purple-500 font-medium"
            />
            <button 
              onClick={() => startRecording(title)}
              className="w-full md:w-auto bg-purple-600 hover:bg-purple-700 text-white px-6 py-3 rounded-xl font-bold flex items-center justify-center gap-2 transition-colors"
            >
              <Mic size={20} /> Start Recording
            </button>
          </div>
        ) : status === 'recording' ? (
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="w-4 h-4 bg-red-500 rounded-full animate-pulse" />
              <div className="text-lg font-black text-gray-900">{title || 'Team Meeting'}</div>
              <div className="text-gray-500 font-mono bg-gray-100 px-3 py-1 rounded-lg">{formatDuration(duration)}</div>
            </div>
            <button 
              onClick={stopRecording}
              className="w-full md:w-auto bg-red-500 hover:bg-red-600 text-white px-6 py-3 rounded-xl font-bold flex items-center justify-center gap-2 transition-colors"
            >
              <Square size={20} fill="currentColor" /> Stop & Process
            </button>
          </div>
        ) : (
          <div className="flex items-center justify-center gap-3 py-4 text-purple-600 font-bold">
            <Loader2 size={24} className="animate-spin" />
            <p>Processing transcript with AI...</p>
          </div>
        )}

        {status === 'recording' && (
          <div className="mt-6 bg-gray-50 border border-gray-200 rounded-xl p-4 h-64 overflow-y-auto">
            <p className="text-gray-700 whitespace-pre-wrap">{liveTranscript || 'Listening...'}</p>
          </div>
        )}
      </div>

      {/* Result Card for Just Finished Meeting */}
      {status === 'done' && lastNote && (
        <div className="bg-gradient-to-br from-purple-50 to-white border border-purple-200 rounded-2xl p-6 shadow-sm">
          <div className="flex items-center gap-2 text-purple-700 mb-4">
            <CheckCircle2 size={24} />
            <h2 className="text-xl font-black">Analysis Complete</h2>
          </div>
          
          <div className="space-y-6">
            <div>
              <h3 className="text-sm font-black text-gray-500 uppercase tracking-wider mb-2">Summary</h3>
              <p className="text-gray-800 text-lg leading-relaxed">{lastNote.summary}</p>
            </div>

            {lastNote.key_topics && lastNote.key_topics.length > 0 && (
              <div>
                <h3 className="text-sm font-black text-gray-500 uppercase tracking-wider mb-2">Key Topics</h3>
                <div className="flex flex-wrap gap-2">
                  {lastNote.key_topics.map((t, i) => (
                    <span key={i} className="bg-purple-100 text-purple-800 px-3 py-1 rounded-full text-sm font-bold">
                      {t}
                    </span>
                  ))}
                </div>
              </div>
            )}

            <div className="grid md:grid-cols-2 gap-6">
              <div>
                <h3 className="text-sm font-black text-gray-500 uppercase tracking-wider mb-3 flex items-center gap-2">
                  <Target size={16} /> Decisions
                </h3>
                <div className="space-y-3">
                  {lastNote.decisions.map((d, i) => (
                    <div key={i} className="bg-blue-50 border border-blue-200 rounded-xl p-4">
                      <p className="font-bold text-blue-900">{d.decision}</p>
                      {d.context && <p className="text-sm text-blue-700 mt-1">{d.context}</p>}
                    </div>
                  ))}
                  {lastNote.decisions.length === 0 && <p className="text-gray-500 text-sm">No decisions recorded.</p>}
                </div>
              </div>

              <div>
                <h3 className="text-sm font-black text-gray-500 uppercase tracking-wider mb-3 flex items-center gap-2">
                  <Users size={16} /> Action Items
                </h3>
                <div className="space-y-3">
                  {lastNote.action_items.map((a, i) => (
                    <div key={i} className="bg-green-50 border border-green-200 rounded-xl p-4 flex flex-col gap-2">
                      <p className="font-bold text-green-900">{a.task}</p>
                      <div className="flex items-center gap-4 text-sm font-medium text-green-700">
                        <span className="flex items-center gap-1"><Users size={14}/> {a.owner}</span>
                        <span className="flex items-center gap-1"><Clock size={14}/> {a.deadline}</span>
                      </div>
                    </div>
                  ))}
                  {lastNote.action_items.length === 0 && <p className="text-gray-500 text-sm">No action items recorded.</p>}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Past Meetings List */}
      <div>
        <h2 className="text-xl font-black text-gray-900 mb-4">Past Meetings</h2>
        
        {savedNotes.length === 0 ? (
          <div className="text-center py-12 bg-white border border-gray-200 rounded-2xl">
            <FileAudio size={48} className="mx-auto text-gray-300 mb-4" />
            <p className="text-gray-500 font-medium">No meeting notes yet. Start recording above!</p>
          </div>
        ) : (
          <div className="space-y-3">
            {savedNotes.map((note) => (
              <div key={note.id} className="bg-white border border-gray-200 rounded-2xl overflow-hidden shadow-sm hover:shadow transition-shadow">
                <div 
                  className="p-5 flex items-center justify-between cursor-pointer hover:bg-gray-50 transition-colors"
                  onClick={() => toggleExpand(note.id)}
                >
                  <div className="flex-1">
                    <h3 className="font-black text-gray-900 text-lg">{note.title}</h3>
                    <div className="flex items-center gap-4 mt-1 text-sm text-gray-500 font-medium">
                      <span>{formatDate(note.date)}</span>
                      <span className="flex items-center gap-1"><Clock size={14} /> {formatDuration(note.duration)}</span>
                      <span className="bg-green-100 text-green-800 px-2 py-0.5 rounded text-xs font-bold">
                        {note.action_items?.length || 0} Actions
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
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
                    <div>
                      <h4 className="text-xs font-black text-gray-500 uppercase tracking-wider mb-2">Summary</h4>
                      <p className="text-gray-800">{note.summary}</p>
                    </div>

                    {note.key_topics && note.key_topics.length > 0 && (
                      <div>
                        <h4 className="text-xs font-black text-gray-500 uppercase tracking-wider mb-2">Key Topics</h4>
                        <div className="flex flex-wrap gap-2">
                          {note.key_topics.map((t, i) => (
                            <span key={i} className="bg-white border border-gray-200 text-gray-700 px-3 py-1 rounded-full text-xs font-bold">
                              {t}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    <div className="grid md:grid-cols-2 gap-4">
                      <div className="bg-white border border-blue-100 rounded-xl p-4">
                        <h4 className="text-xs font-black text-blue-600 uppercase tracking-wider mb-3">Decisions</h4>
                        <div className="space-y-3">
                          {note.decisions?.map((d, i) => (
                            <div key={i}>
                              <p className="font-bold text-gray-900 text-sm">{d.decision}</p>
                              {d.context && <p className="text-xs text-gray-500 mt-1">{d.context}</p>}
                            </div>
                          ))}
                          {(!note.decisions || note.decisions.length === 0) && <p className="text-xs text-gray-400">None</p>}
                        </div>
                      </div>

                      <div className="bg-white border border-green-100 rounded-xl p-4">
                        <h4 className="text-xs font-black text-green-600 uppercase tracking-wider mb-3">Action Items</h4>
                        <div className="space-y-3">
                          {note.action_items?.map((a, i) => (
                            <div key={i} className="text-sm">
                              <p className="font-bold text-gray-900">{a.task}</p>
                              <p className="text-xs text-gray-500 mt-1 font-medium">{a.owner} • {a.deadline}</p>
                            </div>
                          ))}
                          {(!note.action_items || note.action_items.length === 0) && <p className="text-xs text-gray-400">None</p>}
                        </div>
                      </div>
                    </div>

                    <div>
                      <h4 className="text-xs font-black text-gray-500 uppercase tracking-wider mb-2">Raw Transcript</h4>
                      <div className="bg-white border border-gray-200 rounded-xl p-4 h-32 overflow-y-auto text-sm text-gray-600">
                        {note.transcript}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
