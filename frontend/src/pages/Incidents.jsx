import { useState, useEffect, useCallback } from 'react';
import {
  Plus,
  ChevronDown,
  ChevronUp,
  Clock,
  User,
  AlertTriangle,
  Search,
  X,
  MessageSquare,
  Link2,
  Trash2,
  ChevronLeft,
  ChevronRight,
  Loader2,
  ArrowUpCircle,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { incidentService } from '../services/incidentService';
import { alertService } from '../services/alertService';
import { useAuth } from '../context/AuthContext';

const toastStyle = {
  style: {
    background: '#1e1e2e',
    color: '#fff',
    border: '1px solid rgba(255,255,255,0.08)',
  },
};

const statusColors = {
  OPEN: 'bg-red-500/15 text-red-400 border-red-500/30',
  IN_PROGRESS: 'bg-blue-500/15 text-blue-400 border-blue-500/30',
  RESOLVED: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
  CLOSED: 'bg-slate-500/15 text-slate-400 border-slate-500/30',
};

const statusLabels = {
  OPEN: 'Open',
  IN_PROGRESS: 'In Progress',
  RESOLVED: 'Resolved',
  CLOSED: 'Closed',
};

const priorityColors = {
  CRITICAL: 'text-red-400',
  HIGH: 'text-orange-400',
  MEDIUM: 'text-yellow-400',
  LOW: 'text-slate-400',
};

const priorityLabels = {
  CRITICAL: 'Critical',
  HIGH: 'High',
  MEDIUM: 'Medium',
  LOW: 'Low',
};

export default function Incidents() {
  const { user } = useAuth();
  const isPremiumOrExclusive = ['PREMIUM', 'EXCLUSIVE'].includes((user?.tier || 'free').toUpperCase());

  if (!isPremiumOrExclusive) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <AlertTriangle className="w-6 h-6 text-blue-400" />
          <h1 className="text-2xl font-bold text-white">Incidents</h1>
        </div>
        <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-8 text-center">
          <ArrowUpCircle className="w-12 h-12 text-blue-400 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-white mb-2">Upgrade Required</h2>
          <p className="text-slate-400 text-sm mb-6 max-w-md mx-auto">
            Incident management is available on Premium and Exclusive plans.
            Upgrade to create incidents, link alerts, add notes, and track investigations.
          </p>
          <a
            href="/settings"
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-blue-600 text-sm text-white font-medium hover:bg-blue-500 transition-colors"
          >
            <ArrowUpCircle className="w-4 h-4" />
            Upgrade Plan
          </a>
        </div>
      </div>
    );
  }

  const [incidents, setIncidents] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize] = useState(20);
  const [loading, setLoading] = useState(true);

  const [statusFilter, setStatusFilter] = useState('All');
  const [priorityFilter, setPriorityFilter] = useState('All');
  const [searchQuery, setSearchQuery] = useState('');

  const [expandedId, setExpandedId] = useState(null);
  const [expandedDetail, setExpandedDetail] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createForm, setCreateForm] = useState({ title: '', description: '', priority: 'MEDIUM' });
  const [creating, setCreating] = useState(false);

  const [noteText, setNoteText] = useState('');
  const [addingNote, setAddingNote] = useState(false);

  const [linkAlertId, setLinkAlertId] = useState('');
  const [linkingAlert, setLinkingAlert] = useState(false);
  const [availableAlerts, setAvailableAlerts] = useState([]);
  const [linkedAlertIds, setLinkedAlertIds] = useState(new Set());

  const [statusUpdating, setStatusUpdating] = useState(false);

  const fetchIncidents = useCallback(async () => {
    setLoading(true);
    try {
      const data = await incidentService.getIncidents({
        status: statusFilter,
        priority: priorityFilter,
        page,
        pageSize,
      });
      setIncidents(data.incidents || []);
      setTotal(data.total || 0);
    } catch {
      toast.error('Failed to load incidents', toastStyle);
    } finally {
      setLoading(false);
    }
  }, [statusFilter, priorityFilter, page, pageSize]);

  useEffect(() => {
    fetchIncidents();
  }, [fetchIncidents]);

  useEffect(() => {
    setPage(1);
  }, [statusFilter, priorityFilter]);

  const fetchDetail = async (id) => {
    setDetailLoading(true);
    try {
      const [data, linked, allAlerts] = await Promise.all([
        incidentService.getIncident(id),
        incidentService.getLinkedAlerts(id),
        alertService.getAlerts({ pageSize: 100 }),
      ]);
      setExpandedDetail(data);
      setLinkedAlertIds(new Set(linked.map((a) => a.id)));
      setAvailableAlerts(allAlerts.alerts || []);
    } catch {
      toast.error('Failed to load incident details', toastStyle);
    } finally {
      setDetailLoading(false);
    }
  };

  const handleToggleExpand = (id) => {
    if (expandedId === id) {
      setExpandedId(null);
      setExpandedDetail(null);
      setAvailableAlerts([]);
      setLinkedAlertIds(new Set());
    } else {
      setExpandedId(id);
      setNoteText('');
      setLinkAlertId('');
      fetchDetail(id);
    }
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    if (!createForm.title.trim()) {
      toast.error('Title is required', toastStyle);
      return;
    }
    setCreating(true);
    try {
      await incidentService.createIncident(createForm);
      toast.success('Incident created', toastStyle);
      setShowCreateModal(false);
      setCreateForm({ title: '', description: '', priority: 'MEDIUM' });
      fetchIncidents();
    } catch {
      toast.error('Failed to create incident', toastStyle);
    } finally {
      setCreating(false);
    }
  };

  const handleStatusChange = async (id, newStatus) => {
    setStatusUpdating(true);
    try {
      await incidentService.updateIncident(id, { status: newStatus });
      toast.success('Status updated', toastStyle);
      fetchDetail(id);
      fetchIncidents();
    } catch {
      toast.error('Failed to update status', toastStyle);
    } finally {
      setStatusUpdating(false);
    }
  };

  const handleAddNote = async (incidentId) => {
    if (!noteText.trim()) return;
    setAddingNote(true);
    try {
      await incidentService.addNote(incidentId, noteText);
      toast.success('Note added', toastStyle);
      setNoteText('');
      fetchDetail(incidentId);
    } catch {
      toast.error('Failed to add note', toastStyle);
    } finally {
      setAddingNote(false);
    }
  };

  const handleLinkAlert = async (incidentId) => {
    if (!linkAlertId) return;
    setLinkingAlert(true);
    try {
      await incidentService.linkAlert(incidentId, linkAlertId);
      toast.success('Alert linked', toastStyle);
      setLinkAlertId('');
      setLinkedAlertIds((prev) => new Set([...prev, linkAlertId]));
      fetchDetail(incidentId);
    } catch {
      toast.error('Failed to link alert', toastStyle);
    } finally {
      setLinkingAlert(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this incident? This cannot be undone.')) return;
    try {
      await incidentService.deleteIncident(id);
      toast.success('Incident deleted', toastStyle);
      if (expandedId === id) {
        setExpandedId(null);
        setExpandedDetail(null);
      }
      fetchIncidents();
    } catch {
      toast.error('Failed to delete incident', toastStyle);
    }
  };

  const filtered = searchQuery
    ? incidents.filter((inc) =>
        inc.title?.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : incidents;

  const totalPages = Math.ceil(total / pageSize);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-white">Incidents</h1>
        <button
          onClick={() => setShowCreateModal(true)}
          className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium px-4 py-2.5 rounded-lg transition-all shadow-lg shadow-blue-600/20 cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          Create Incident
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="bg-white/[0.04] border border-white/[0.08] rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-blue-500/40 transition-all cursor-pointer appearance-none"
        >
          <option value="All">All Statuses</option>
          <option value="OPEN">Open</option>
          <option value="IN_PROGRESS">In Progress</option>
          <option value="RESOLVED">Resolved</option>
          <option value="CLOSED">Closed</option>
        </select>

        <select
          value={priorityFilter}
          onChange={(e) => setPriorityFilter(e.target.value)}
          className="bg-white/[0.04] border border-white/[0.08] rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-blue-500/40 transition-all cursor-pointer appearance-none"
        >
          <option value="All">All Priorities</option>
          <option value="CRITICAL">Critical</option>
          <option value="HIGH">High</option>
          <option value="MEDIUM">Medium</option>
          <option value="LOW">Low</option>
        </select>

        <div className="relative flex-1 min-w-[200px] max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search incidents..."
            className="w-full bg-white/[0.04] border border-white/[0.08] rounded-lg pl-9 pr-3 py-2 text-sm text-white placeholder-slate-500 outline-none focus:border-blue-500/40 transition-all"
          />
        </div>
      </div>

      {/* Loading */}
      {loading && (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="w-6 h-6 text-slate-500 animate-spin" />
        </div>
      )}

      {/* Incident cards */}
      {!loading && (
        <div className="space-y-3">
          {filtered.map((inc) => {
            const isExpanded = expandedId === inc.id;
            return (
              <div
                key={inc.id}
                className="bg-white/[0.03] border border-white/[0.06] rounded-xl hover:border-white/[0.1] transition-all"
              >
                {/* Card header */}
                <button
                  onClick={() => handleToggleExpand(inc.id)}
                  className="w-full flex items-center justify-between px-5 py-4 cursor-pointer text-left"
                >
                  <div className="flex items-center gap-4 min-w-0">
                    <span className="text-xs font-mono text-slate-500 shrink-0">
                      #{inc.id}
                    </span>
                    <div className="min-w-0">
                      <h3 className="text-sm font-medium text-white truncate">
                        {inc.title}
                      </h3>
                      <div className="flex items-center gap-3 mt-1.5">
                        <span
                          className={`inline-block text-[10px] font-semibold uppercase px-2 py-0.5 rounded border ${statusColors[inc.status] || ''}`}
                        >
                          {statusLabels[inc.status] || inc.status}
                        </span>
                        <span
                          className={`text-xs font-medium ${priorityColors[inc.priority] || ''}`}
                        >
                          {priorityLabels[inc.priority] || inc.priority}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-4 shrink-0">
                    {inc.alert_count > 0 && (
                      <span className="flex items-center gap-1 text-xs text-slate-500">
                        <Link2 className="w-3.5 h-3.5" />
                        {inc.alert_count}
                      </span>
                    )}
                    <div className="flex items-center gap-3 text-xs text-slate-500">
                      {inc.creator_name && (
                        <span className="flex items-center gap-1">
                          <User className="w-3.5 h-3.5" />
                          {inc.creator_name}
                        </span>
                      )}
                      {inc.created_at && (
                        <span className="flex items-center gap-1">
                          <Clock className="w-3.5 h-3.5" />
                          {new Date(inc.created_at).toLocaleDateString()}
                        </span>
                      )}
                    </div>
                    {isExpanded ? (
                      <ChevronUp className="w-4 h-4 text-slate-500" />
                    ) : (
                      <ChevronDown className="w-4 h-4 text-slate-500" />
                    )}
                  </div>
                </button>

                {/* Expanded detail */}
                {isExpanded && (
                  <div className="px-5 pb-5 border-t border-white/[0.06] pt-4 space-y-5">
                    {detailLoading ? (
                      <div className="flex items-center justify-center py-6">
                        <Loader2 className="w-5 h-5 text-slate-500 animate-spin" />
                      </div>
                    ) : expandedDetail ? (
                      <>
                        {/* Description */}
                        {expandedDetail.description && (
                          <p className="text-sm text-slate-400 leading-relaxed">
                            {expandedDetail.description}
                          </p>
                        )}

                        {/* Status + Delete row */}
                        <div className="flex items-center gap-3">
                          <label className="text-xs text-slate-500">Status:</label>
                          <select
                            value={expandedDetail.status}
                            disabled={statusUpdating}
                            onChange={(e) =>
                              handleStatusChange(inc.id, e.target.value)
                            }
                            className="bg-white/[0.04] border border-white/[0.08] rounded-lg px-3 py-1.5 text-sm text-white outline-none focus:border-blue-500/40 transition-all cursor-pointer appearance-none"
                          >
                            <option value="OPEN">Open</option>
                            <option value="IN_PROGRESS">In Progress</option>
                            <option value="RESOLVED">Resolved</option>
                            <option value="CLOSED">Closed</option>
                          </select>
                          <button
                            onClick={() => handleDelete(inc.id)}
                            className="ml-auto flex items-center gap-1.5 text-xs text-red-400 hover:text-red-300 transition-colors cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                            Delete
                          </button>
                        </div>

                        {/* Linked alerts count */}
                        {expandedDetail.alert_count > 0 && (
                          <div className="text-xs text-slate-500 flex items-center gap-1.5">
                            <Link2 className="w-3.5 h-3.5" />
                            {expandedDetail.alert_count} linked alert
                            {expandedDetail.alert_count !== 1 ? 's' : ''}
                          </div>
                        )}

                        {/* Notes timeline */}
                        <div className="space-y-2">
                          <h4 className="text-xs font-medium text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                            <MessageSquare className="w-3.5 h-3.5" />
                            Notes
                          </h4>
                          {expandedDetail.notes && expandedDetail.notes.length > 0 ? (
                            <div className="space-y-2 max-h-48 overflow-y-auto">
                              {expandedDetail.notes.map((note, i) => (
                                <div
                                  key={note.id || i}
                                  className="bg-white/[0.02] border border-white/[0.04] rounded-lg px-3 py-2"
                                >
                                  <p className="text-sm text-slate-300">
                                    {note.content}
                                  </p>
                                  <div className="flex items-center gap-3 mt-1 text-[11px] text-slate-600">
                                    {note.author_name && (
                                      <span>{note.author_name}</span>
                                    )}
                                    {note.created_at && (
                                      <span>
                                        {new Date(
                                          note.created_at
                                        ).toLocaleString()}
                                      </span>
                                    )}
                                  </div>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <p className="text-xs text-slate-600">
                              No notes yet.
                            </p>
                          )}

                          {/* Add note form */}
                          <div className="flex gap-2 mt-2">
                            <textarea
                              value={noteText}
                              onChange={(e) => setNoteText(e.target.value)}
                              placeholder="Add a note..."
                              rows={2}
                              className="flex-1 bg-white/[0.04] border border-white/[0.08] rounded-lg px-3 py-2 text-sm text-white placeholder-slate-500 outline-none focus:border-blue-500/40 transition-all resize-none"
                            />
                            <button
                              onClick={() => handleAddNote(inc.id)}
                              disabled={addingNote || !noteText.trim()}
                              className="self-end bg-blue-600 hover:bg-blue-500 disabled:opacity-40 disabled:cursor-not-allowed text-white text-xs font-medium px-3 py-2 rounded-lg transition-all cursor-pointer"
                            >
                              {addingNote ? 'Adding...' : 'Add'}
                            </button>
                          </div>
                        </div>

                        {/* Link alert */}
                        <div className="space-y-2">
                          <h4 className="text-xs font-medium text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                            <Link2 className="w-3.5 h-3.5" />
                            Link Alert
                          </h4>
                          <div className="flex gap-2">
                            <select
                              value={linkAlertId}
                              onChange={(e) => setLinkAlertId(e.target.value)}
                              className="flex-1 bg-white/[0.04] border border-white/[0.08] rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-blue-500/40 transition-all cursor-pointer appearance-none"
                            >
                              <option value="">Select an alert...</option>
                              {availableAlerts
                                .filter((a) => !linkedAlertIds.has(a.id))
                                .map((a) => (
                                  <option key={a.id} value={a.id}>
                                    {a.severity} · {a.category.replace(/_/g, ' ')} · {a.source_ip} — {new Date(a.detected_at).toLocaleString()}
                                  </option>
                                ))}
                            </select>
                            <button
                              onClick={() => handleLinkAlert(inc.id)}
                              disabled={linkingAlert || !linkAlertId}
                              className="bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 disabled:cursor-not-allowed text-white text-xs font-medium px-3 py-2 rounded-lg transition-all cursor-pointer"
                            >
                              {linkingAlert ? 'Linking...' : 'Link'}
                            </button>
                          </div>
                        </div>
                      </>
                    ) : null}
                  </div>
                )}
              </div>
            );
          })}

          {/* Empty state */}
          {filtered.length === 0 && (
            <div className="text-center py-16">
              <AlertTriangle className="w-10 h-10 text-slate-600 mx-auto mb-3" />
              <p className="text-sm text-slate-500">No incidents found</p>
              <p className="text-xs text-slate-600 mt-1">
                {statusFilter !== 'All' || priorityFilter !== 'All' || searchQuery
                  ? 'Try adjusting your filters.'
                  : 'Incidents will appear here when created.'}
              </p>
            </div>
          )}
        </div>
      )}

      {/* Pagination */}
      {!loading && totalPages > 1 && (
        <div className="flex items-center justify-between pt-2">
          <span className="text-xs text-slate-500">
            Page {page} of {totalPages} ({total} total)
          </span>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1}
              className="p-1.5 rounded-lg bg-white/[0.04] border border-white/[0.08] text-slate-400 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition-all cursor-pointer"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages}
              className="p-1.5 rounded-lg bg-white/[0.04] border border-white/[0.08] text-slate-400 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition-all cursor-pointer"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Create Incident Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="bg-[#12121a] border border-white/[0.08] rounded-2xl w-full max-w-md mx-4 shadow-2xl">
            <div className="flex items-center justify-between px-5 py-4 border-b border-white/[0.06]">
              <h2 className="text-base font-semibold text-white">
                Create Incident
              </h2>
              <button
                onClick={() => setShowCreateModal(false)}
                className="text-slate-500 hover:text-white transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleCreate} className="p-5 space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-slate-400">
                  Title
                </label>
                <input
                  type="text"
                  value={createForm.title}
                  onChange={(e) =>
                    setCreateForm((f) => ({ ...f, title: e.target.value }))
                  }
                  placeholder="Incident title..."
                  className="w-full bg-white/[0.04] border border-white/[0.08] rounded-lg px-3 py-2 text-sm text-white placeholder-slate-500 outline-none focus:border-blue-500/40 transition-all"
                  autoFocus
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-medium text-slate-400">
                  Priority
                </label>
                <select
                  value={createForm.priority}
                  onChange={(e) =>
                    setCreateForm((f) => ({ ...f, priority: e.target.value }))
                  }
                  className="w-full bg-white/[0.04] border border-white/[0.08] rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-blue-500/40 transition-all cursor-pointer appearance-none"
                >
                  <option value="CRITICAL">Critical</option>
                  <option value="HIGH">High</option>
                  <option value="MEDIUM">Medium</option>
                  <option value="LOW">Low</option>
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-medium text-slate-400">
                  Description
                </label>
                <textarea
                  value={createForm.description}
                  onChange={(e) =>
                    setCreateForm((f) => ({
                      ...f,
                      description: e.target.value,
                    }))
                  }
                  placeholder="Describe the incident..."
                  rows={4}
                  className="w-full bg-white/[0.04] border border-white/[0.08] rounded-lg px-3 py-2 text-sm text-white placeholder-slate-500 outline-none focus:border-blue-500/40 transition-all resize-none"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 text-sm text-slate-400 hover:text-white transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={creating}
                  className="bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-sm font-medium px-4 py-2 rounded-lg transition-all shadow-lg shadow-blue-600/20 cursor-pointer"
                >
                  {creating ? 'Creating...' : 'Create'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
