const page = {};

function bindPage() {
  page.editMissionButton = byId('editMissionButton');
  page.endExpiredSessionButton = byId('endExpiredSessionButton');
  page.exitExtendedSessionButton = byId('exitExtendedSessionButton');
  page.exitModal = byId('exitModal');
  page.extendMinutesSelect = byId('extendMinutesSelect');
  page.extendSessionForm = byId('extendSessionForm');
  page.intentionForm = byId('intentionForm');
  page.intentionInput = byId('intentionInput');
  page.intentionModal = byId('intentionModal');
  page.completionAiFeedback = byId('completionAiFeedback');

  page.completionForm = byId('completionEvidenceForm');

  page.completionModal = byId('completionModal');

  page.consultationContext = byId('consultationContext');

  page.consultationDirectionModal = byId('consultationDirectionModal');

  page.consultationDirectionText = byId('consultationDirectionText');

  page.consultationModal = byId('consultationModal');

  page.consultationMemberName = byId('consultationMemberName');
  page.openConsultationChatButton = byId('openConsultationChatButton');
  page.openPendingConsultationChatButton = byId('openPendingConsultationChatButton');
  page.consultationReviewForm = byId('consultationReviewForm');
  page.consultationReviewModal = byId('consultationReviewModal');

  page.consultationReviewPrompt = byId('consultationReviewPrompt');

  page.consultationWorkspaceModal = byId('consultationWorkspaceModal');

  page.consultationWorkspaceStatus = byId('consultationWorkspaceStatus');

  page.consultationWorkspaceTitle = byId('consultationWorkspaceTitle');

  page.consultationWhiteboard = byId('consultationWhiteboard');
  page.consultationScratchpad = byId('consultationScratchpad');
  page.clearWhiteboardButton = byId('clearWhiteboardButton');

  page.closeDiscussionButton = byId('closeDiscussionButton');
  page.discussionButton = byId('discussionButton');
  page.discussionContentInput = byId('discussionContentInput');
  page.discussionFileInput = byId('discussionFileInput');
  page.discussionForm = byId('discussionForm');
  page.discussionList = byId('discussionList');
  page.discussionPanel = byId('discussionPanel');
  page.discussionStatus = byId('discussionStatus');
  page.discussionTitleInput = byId('discussionTitleInput');
  page.discussionTypeInput = byId('discussionTypeInput');
  page.goalDescription = byId('currentGoalDescription');
  page.goalForm = byId('microGoalForm');

  page.goalInput = byId('microGoalTitleInput');

  page.goalModal = byId('microGoalModal');

  page.goalQuestionInput = byId('microGoalQuestionInput');

  page.goalTitle = byId('currentGoalTitle');

  page.memberGoalsModal = byId('memberGoalsModal');

  page.memberGoalsModalContent = byId('memberGoalsModalContent');

  page.memberGoalsModalTitle = byId('memberGoalsModalTitle');

  page.membersList = byId('membersList');

  page.membersToggle = byId('membersToggleButton');

  page.message = byId('sessionMessage');

  page.missionStrip = byId('sessionMissionStrip');

  page.missionText = byId('sessionMissionText');

  page.nextQueuedGoal = byId('nextQueuedGoal');

  page.queueModal = byId('queueModal');

  page.queuedGoalCount = byId('queuedGoalCount');

  page.queuedGoalsList = byId('queuedGoalsList');

  page.rejoinConsultationButton = byId('rejoinConsultationButton');

  page.timer = byId('countdownTimer');

  page.title = byId('sessionTitle');

  page.toastContainer = byId('sessionToastContainer');

  page.statusControls = Array.from(document.querySelectorAll('.status-control'));

  page.statusProgressBar = byId('statusProgressBar');

  page.statusProgressFill = byId('statusProgressFill');

  page.statusProgressHint = byId('statusProgressHint');

  page.statusProgressText = byId('statusProgressText');
  page.stayExitPanel = byId('stayExitPanel');
  page.stayExtendedSessionButton = byId('stayExtendedSessionButton');
  page.timeExpiryModal = byId('timeExpiryModal');
  page.timeExpiryText = byId('timeExpiryText');
  page.timeExpiryTitle = byId('timeExpiryTitle');

  page.statusMixChart = byId('statusMixChart');
  page.statusMixLegend = byId('statusMixLegend');
  page.statusMixSummary = byId('statusMixSummary');
}

function byId(id) {
  return document.getElementById(id);
}
