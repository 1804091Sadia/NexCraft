

// Draft -> Pending Approval -> Active (or Rejected) -> Closed
const LISTING_STATUS = {
    DRAFT: "draft",
    PENDING: "pending_approval",
    ACTIVE: "active",
    REJECTED: "rejected",
    CLOSED: "closed"
};

const STATUS_LABELS = {
    draft: "Draft",
    pending_approval: "Pending Approval",
    active: "Active",
    rejected: "Rejected",
    closed: "Closed"
};

// FR-13 application workflow, in order
const APPLICATION_FLOW = [
    "Received",
    "Under Review",
    "Shortlisted",
    "Interview Scheduled",
    "Outcome Pending",
    "Placed"
];

const APPLICATION_TERMINAL = ["Placed", "Not Progressed", "Withdrawn"];

const JOB_TYPES = ["Full-time", "Part-time", "Internship", "Contract"];

const PROGRAM_LEVELS = ["Beginner", "Intermediate", "Advanced"];

function escapeRegex(text) {
    return String(text).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function str(value, maxLength = 500) {
    return typeof value === "string" ? value.trim().slice(0, maxLength) : "";
}

module.exports = {
    LISTING_STATUS,
    STATUS_LABELS,
    APPLICATION_FLOW,
    APPLICATION_TERMINAL,
    JOB_TYPES,
    PROGRAM_LEVELS,
    escapeRegex,
    str
};
