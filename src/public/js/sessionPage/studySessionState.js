// Shared constants and mutable runtime state for the study-session page.
const DEFAULT_SESSION_ID = 2;
const CURRENT_USER_ID = currentUserIdFromAuth();
const urlParams = new URLSearchParams(window.location.search);
const selectedId = Number(urlParams.get('id'));
const sessionId = Number.isInteger(selectedId) && selectedId > 0 ? selectedId : DEFAULT_SESSION_ID;
const apiBase = `/api/sessions/${sessionId}`;
const MEMBER_PREVIEW_LIMIT = 3;
const CHECKLIST_STORAGE_PREFIX = 'workCheckChecklist:';
const INTENTION_STORAGE_PREFIX = 'sessionIntention:';
const SESSION_REFRESH_INTERVAL_MS = 5000;
const FOCUS_STATUS_MIX_REFRESH_INTERVAL_MS = 1000;
const STATUS_BREAKDOWN_ORDER = ['focus', 'break', 'need_help', 'in_consultation'];
const STATUS_BREAKDOWN_META = {
  focus: { label: 'Focusing', color: '#16a34a' },
  break: { label: 'On Break', color: '#f59e0b' },
  need_help: { label: 'Need Help', color: '#ef4444' },
  in_consultation: { label: 'In Consultation', color: '#6366f1' },
};

let sessionData = {
  id: sessionId,
  title: 'Study Session',
  planned_duration_seconds: 0,
  remaining_seconds: 0,
  status: 'loading',
  micro_goal: null,
  queued_micro_goals: [],
  members: [],
};
let timerStartedAt = Date.now();
let timerInterval = null;
let statusTimerInterval = null;
let sessionPollInterval = null;
let focusStatusMixPollInterval = null;
let focusStatusMixData = null;
let focusStatusMixRequestVersion = 0;
let statusUpdateInFlight = false;
let pendingStatusUpdate = null;
let sessionLoadInFlight = false;
let expiryRefreshInFlight = false;
let pausedRemainingSeconds = null;
let activeProgressDrag = null;
let membersExpanded = false;
let pendingConsultationMemberId = null;
let activeConsultation = null;
let whiteboardContext = null;
let whiteboardDrawing = false;
let whiteboardStrokes = [];
let whiteboardCurrentStroke = null;
let workspaceSaveTimer = null;
let workspacePollTimer = null;
let workspaceSaveInFlight = false;
let workspaceRevision = 0;
let savedWorkspaceRevision = 0;
let lastWorkspaceUpdatedAt = null;
let progressUpdateInFlight = false;

function currentUserIdFromAuth() {
  try {
    const user = window.auth ? window.auth.getUser() : null;
    const userId = Number(user?.user_id || user?.id || user?.userId);
    return Number.isInteger(userId) && userId > 0 ? userId : null;
  } catch {
    return null;
  }
}

function requireStudySessionLogin() {
  if (window.auth?.isLoggedIn() && CURRENT_USER_ID) return true;

  window.location.href = 'login.html';
  return false;
}
