import { type FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  Check,
  CheckCircle2,
  ChevronRight,
  ClipboardList,
  Clock3,
  Eye,
  LayoutDashboard,
  LogOut,
  Mail,
  MessageSquare,
  RefreshCw,
  Save,
  Search,
  ShieldCheck,
  SlidersHorizontal,
  Package,
  PhoneCall,
  Truck,
  UserRound,
  X,
} from 'lucide-react';
import { type BoxStatus, boxStatusLabels, boxSteps } from '@/data/career-profiles';
import { questionPrompt } from '@/data/assessment';

type ContactStatus = 'new' | 'in_progress' | 'resolved';
type AssessmentStatus = 'new' | 'reviewed' | 'contacted';
type WorkspaceTab = 'dashboard' | 'students' | 'contacts';

type ContactSubmission = {
  id: number;
  name: string;
  email: string;
  subject: string;
  message: string;
  status: ContactStatus;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

type AssessmentSubmission = {
  id: number;
  name: string;
  email: string;
  grade: string;
  city: string;
  school: string;
  stream: 'PCB' | 'PCM' | 'Commerce' | 'Humanities';
  result: string | null;
  answers: Record<string, unknown>;
  status: AssessmentStatus;
  notes: string | null;
  // Linking Box delivery
  phone: string;
  address_line: string;
  state: string;
  pincode: string;
  tracking_code: string | null;
  box_status: BoxStatus;
  dispatched_at: string | null;
  expected_delivery_on: string | null;
  delivered_at: string | null;
  mentor_name: string;
  mentor_phone: string;
  challenge_notes: string | null;
  challenge_submitted_at: string | null;
  mentor_feedback: string | null;
  mentor_feedback_at: string | null;
  created_at: string;
  updated_at: string;
};

type SubmissionsResponse = {
  contacts: ContactSubmission[];
  assessments: AssessmentSubmission[];
};

type SessionResponse = {
  authenticated: boolean;
  admin?: { email: string };
};

type SettingsResponse = {
  settings: Record<string, string>;
};

type AdminRecord =
  | { kind: 'contact'; item: ContactSubmission }
  | { kind: 'assessment'; item: AssessmentSubmission };

type ApiOptions = Omit<RequestInit, 'body'> & { body?: unknown };

class ApiError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

async function requestJson<T>(path: string, options: ApiOptions = {}): Promise<T> {
  const { body, headers, ...requestOptions } = options;
  const response = await fetch(path, {
    ...requestOptions,
    credentials: 'include',
    headers: {
      Accept: 'application/json',
      ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
      ...headers,
    },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });
  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    const message = payload && typeof payload.message === 'string' ? payload.message : 'Something went wrong. Please try again.';
    throw new ApiError(message, response.status);
  }
  return payload as T;
}

const api = {
  get: <T,>(path: string) => requestJson<T>(path),
  post: <T,>(path: string, body: unknown) => requestJson<T>(path, { method: 'POST', body }),
  patch: <T,>(path: string, body: unknown) => requestJson<T>(path, { method: 'PATCH', body }),
  put: <T,>(path: string, body: unknown) => requestJson<T>(path, { method: 'PUT', body }),
};

const ADMIN_STYLES = `
  .rwl-admin { min-height: 100dvh; background: #f4f5f0; color: #203238; font-family: var(--app-font-sans, Inter, ui-sans-serif, system-ui, sans-serif); }
  .rwl-admin *, .rwl-admin *::before, .rwl-admin *::after { box-sizing: border-box; }
  .rwl-admin button, .rwl-admin input, .rwl-admin textarea, .rwl-admin select { font: inherit; }
  .rwl-admin button { cursor: pointer; }
  .rwl-admin-shell { min-height: 100dvh; display: grid; grid-template-columns: 244px minmax(0, 1fr); align-items: start; }
  /* The rail and the page header stay put; only the content scrolls. */
  .rwl-admin-sidebar { position: sticky; top: 0; height: 100dvh; background: #20383a; color: #eff4ed; padding: 28px 18px 22px; display: flex; flex-direction: column; }
  .rwl-admin-brand { padding: 0 12px 36px; }
  .rwl-admin-brand-word { display: block; font-size: .84rem; font-weight: 800; letter-spacing: .14em; }
  .rwl-admin-brand-sub { display: block; color: #a7beb5; font-size: .51rem; font-weight: 700; letter-spacing: .12em; margin-top: 8px; }
  .rwl-admin-rail-label { color: #8daaa0; font-size: .62rem; font-weight: 800; letter-spacing: .15em; text-transform: uppercase; padding: 0 12px 10px; }
  .rwl-admin-nav { display: grid; gap: 5px; }
  .rwl-admin-nav-button { display: flex; align-items: center; gap: 11px; width: 100%; border: 0; border-radius: 12px; padding: 12px; background: transparent; color: #afc3bb; text-align: left; font-size: .77rem; font-weight: 700; transition: background .2s ease, color .2s ease, transform .2s ease; }
  .rwl-admin-nav-button:hover { color: #fff; background: #2d4a4b; transform: translateX(2px); }
  .rwl-admin-nav-button.active { color: #203238; background: #e7c982; }
  .rwl-admin-sidebar-foot { margin-top: auto; padding: 16px 12px 0; border-top: 1px solid rgba(231, 241, 233, .14); }
  .rwl-admin-sidebar-foot small { display: block; color: #8daaa0; font-size: .62rem; line-height: 1.6; }
  .rwl-admin-sidebar-foot strong { display: block; margin-top: 5px; color: #edf4ed; font-size: .72rem; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .rwl-admin-main { min-width: 0; }
  .rwl-admin-topbar { position: sticky; top: 0; z-index: 20; min-height: 78px; padding: 18px clamp(22px, 4vw, 58px); border-bottom: 1px solid #dce2db; background: rgba(250, 251, 247, .94); backdrop-filter: blur(10px); display: flex; align-items: center; justify-content: space-between; gap: 18px; }
  .rwl-admin-topbar-kicker { color: #628177; font-size: .62rem; font-weight: 800; letter-spacing: .16em; text-transform: uppercase; }
  .rwl-admin-topbar-title { margin: 5px 0 0; font-size: 1.25rem; letter-spacing: -.04em; }
  .rwl-admin-topbar-actions { display: flex; align-items: center; gap: 10px; }
  .rwl-admin-icon-button { width: 37px; height: 37px; display: grid; place-items: center; border: 1px solid #dce2db; border-radius: 10px; background: #fbfcf8; color: #52756c; transition: border-color .2s ease, transform .2s ease, background .2s ease; }
  .rwl-admin-icon-button:hover { border-color: #88a89d; background: #eef4ed; transform: translateY(-1px); }
  .rwl-admin-logout { display: inline-flex; align-items: center; gap: 7px; min-height: 37px; padding: 0 12px; border: 1px solid #dce2db; border-radius: 10px; background: #fbfcf8; color: #52756c; font-size: .7rem; font-weight: 800; }
  .rwl-admin-logout:hover { border-color: #88a89d; color: #203238; }
  .rwl-admin-content { width: min(1380px, calc(100% - 44px)); margin: 0 auto; padding: 34px 0 58px; }
  .rwl-admin-overview { display: flex; align-items: end; justify-content: space-between; gap: 24px; margin-bottom: 28px; }
  .rwl-admin-overview h1 { margin: 0; color: #203238; font-size: clamp(1.8rem, 3vw, 2.7rem); letter-spacing: -.065em; line-height: 1; }
  .rwl-admin-overview p { color: #6b8179; max-width: 530px; margin: 11px 0 0; font-size: .82rem; line-height: 1.65; }
  .rwl-admin-overview-note { display: flex; align-items: center; gap: 8px; color: #52756c; font-size: .68rem; font-weight: 800; white-space: nowrap; }
  .rwl-admin-overview-note svg { color: #c39135; }
  .rwl-admin-stat-grid { display: grid; grid-template-columns: 1.15fr 1fr 1fr 1fr; gap: 12px; margin-bottom: 28px; }
  .rwl-admin-stat { min-height: 108px; padding: 18px; border: 1px solid #dce2db; border-radius: 15px; background: #fbfcf8; }
  .rwl-admin-stat.primary { background: #dfeee8; border-color: #c8dfd7; }
  .rwl-admin-stat-label { display: flex; align-items: center; gap: 7px; color: #71877e; font-size: .66rem; font-weight: 800; }
  .rwl-admin-stat-label svg { color: #5b8478; }
  .rwl-admin-stat-value { display: block; margin-top: 15px; color: #203238; font-size: 1.65rem; letter-spacing: -.06em; }
  /* The list is now the whole workspace; details open in a popup. */
  .rwl-admin-workspace { min-width: 0; display: grid; grid-template-columns: minmax(0, 1fr); gap: 15px; }
  .rwl-admin-panel { min-width: 0; border: 1px solid #dce2db; border-radius: 17px; background: #fbfcf8; box-shadow: 0 9px 24px rgba(47, 73, 67, .035); }
  .rwl-admin-panel-head { min-height: 64px; padding: 17px 19px; display: flex; align-items: center; justify-content: space-between; gap: 15px; border-bottom: 1px solid #e4e8e2; }
  .rwl-admin-panel-head h2 { margin: 0; font-size: .92rem; letter-spacing: -.02em; }
  .rwl-admin-panel-head p { color: #83948d; margin: 4px 0 0; font-size: .68rem; }
  .rwl-admin-filter-bar { display: flex; align-items: center; gap: 5px; padding: 13px 15px; border-bottom: 1px solid #e4e8e2; }
  .rwl-admin-filter { border: 0; border-radius: 8px; background: transparent; color: #7a8f87; padding: 8px 10px; font-size: .68rem; font-weight: 800; }
  .rwl-admin-filter:hover { color: #203238; background: #eef3ed; }
  .rwl-admin-filter.active { color: #315e55; background: #e2efe9; }
  .rwl-admin-record-list { min-height: 430px; max-height: 620px; overflow: auto; padding: 7px; }
  .rwl-admin-record { width: 100%; display: flex; align-items: flex-start; gap: 12px; border: 1px solid transparent; border-radius: 12px; padding: 13px 11px; background: transparent; color: #203238; text-align: left; transition: background .2s ease, border-color .2s ease, transform .2s ease; }
  .rwl-admin-record:hover { border-color: #d6e3dc; background: #f1f6f0; transform: translateX(2px); }
  .rwl-admin-record.selected { border-color: #b7d3c8; background: #e7f1eb; }
  .rwl-admin-record-avatar { width: 34px; height: 34px; flex: 0 0 auto; display: grid; place-items: center; border-radius: 10px; background: #dfe9f1; color: #4a687b; font-size: .72rem; font-weight: 800; }
  .rwl-admin-record-avatar.assessment { background: #f0e7cf; color: #9a6a2d; }
  .rwl-admin-record-copy { min-width: 0; flex: 1; }
  .rwl-admin-record-line { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
  .rwl-admin-record-name { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: .76rem; font-weight: 800; }
  .rwl-admin-record-date { color: #8a9a93; font-size: .59rem; white-space: nowrap; }
  .rwl-admin-record-meta { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; color: #71847c; margin-top: 5px; font-size: .66rem; }
  .rwl-admin-status { display: inline-flex; align-items: center; width: fit-content; margin-top: 8px; padding: 4px 7px; border-radius: 5px; font-size: .57rem; font-weight: 800; letter-spacing: .02em; }
  .rwl-admin-status.new { background: #f5e6c2; color: #946b2e; }
  .rwl-admin-status.in_progress, .rwl-admin-status.reviewed { background: #e0e8f5; color: #52709a; }
  .rwl-admin-status.resolved, .rwl-admin-status.contacted { background: #dcefe6; color: #39705a; }
  .rwl-admin-detail { min-height: 500px; }
  .rwl-admin-detail-body { padding: 25px 25px 28px; }
  .rwl-admin-detail-identity { display: flex; align-items: flex-start; justify-content: space-between; gap: 20px; padding-bottom: 22px; border-bottom: 1px solid #e4e8e2; }
  .rwl-admin-detail-title { display: flex; align-items: center; gap: 12px; }
  .rwl-admin-detail-title h2 { margin: 0; font-size: 1.3rem; letter-spacing: -.05em; }
  .rwl-admin-detail-title p { color: #71847c; margin: 5px 0 0; font-size: .73rem; }
  .rwl-admin-detail-icon { width: 43px; height: 43px; display: grid; place-items: center; border-radius: 13px; background: #dfeee8; color: #4e7d6d; }
  .rwl-admin-detail-icon.assessment { background: #f0e7cf; color: #9a6a2d; }
  .rwl-admin-detail-date { color: #87968f; font-size: .62rem; text-align: right; line-height: 1.5; }
  .rwl-admin-detail-date strong { display: block; color: #607a70; font-size: .68rem; }
  .rwl-admin-detail-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 18px; margin-top: 22px; }
  .rwl-admin-detail-section { min-width: 0; }
  .rwl-admin-detail-section.full { grid-column: 1 / -1; }
  .rwl-admin-detail-label { display: block; color: #789087; margin-bottom: 8px; font-size: .61rem; font-weight: 800; letter-spacing: .1em; text-transform: uppercase; }
  .rwl-admin-detail-value { color: #33494b; font-size: .79rem; line-height: 1.7; white-space: pre-wrap; overflow-wrap: anywhere; }
  .rwl-admin-detail-value a { color: #3c7567; font-weight: 800; }
  .rwl-admin-answer-list { display: grid; gap: 7px; }
  .rwl-admin-answer { display: flex; align-items: flex-start; justify-content: space-between; gap: 12px; padding: 9px 11px; border-radius: 9px; background: #f1f4ef; color: #647970; font-size: .68rem; }
  .rwl-admin-answer strong { color: #33494b; font-weight: 800; }
  .rwl-admin-edit { margin-top: 23px; padding-top: 21px; border-top: 1px solid #e4e8e2; }
  .rwl-admin-form-field { display: grid; gap: 7px; }
  .rwl-admin-form-field label { color: #789087; font-size: .61rem; font-weight: 800; letter-spacing: .1em; text-transform: uppercase; }
  .rwl-admin-form-field select, .rwl-admin-form-field textarea, .rwl-admin-setting-input { width: 100%; border: 1px solid #d4dfd7; border-radius: 9px; outline: none; background: #f8faf6; color: #33494b; padding: 10px 11px; font-size: .75rem; transition: border-color .2s ease, box-shadow .2s ease; }
  .rwl-admin-form-field select:focus, .rwl-admin-form-field textarea:focus, .rwl-admin-setting-input:focus { border-color: #79a694; box-shadow: 0 0 0 3px rgba(121, 166, 148, .13); }
  .rwl-admin-form-field textarea { min-height: 100px; resize: vertical; line-height: 1.6; }
  .rwl-admin-edit-row { display: grid; grid-template-columns: 170px minmax(0, 1fr) auto; align-items: end; gap: 12px; }
  /* Search + filters above the list */
  .rwl-admin-list-controls { display: grid; gap: 10px; padding: 14px 19px; border-bottom: 1px solid #e4e8e2; }
  .rwl-admin-search { display: flex; align-items: center; gap: 9px; padding: 0 12px; border: 1px solid #d4dfd7; border-radius: 10px; background: #f8faf6; color: #789087; }
  .rwl-admin-search:focus-within { border-color: #79a694; box-shadow: 0 0 0 3px rgba(121, 166, 148, .13); }
  .rwl-admin-search input { flex: 1; min-width: 0; border: 0; outline: none; background: transparent; color: #33494b; font-size: .78rem; padding: 11px 0; }
  .rwl-admin-search input::-webkit-search-cancel-button { display: none; }
  .rwl-admin-search button { display: grid; place-items: center; border: 0; background: transparent; color: #8a9a95; cursor: pointer; padding: 3px; border-radius: 6px; }
  .rwl-admin-search button:hover { background: #e6ede8; color: #33494b; }
  /* View button on each row */
  .rwl-admin-record { align-items: center; }
  .rwl-admin-view-button { flex: 0 0 auto; display: inline-flex; align-items: center; gap: 6px; padding: 8px 14px; border: 1px solid #cfe0d5; border-radius: 9px; background: #fff; color: #2c6a58; font-size: .72rem; font-weight: 800; cursor: pointer; transition: background .18s ease, border-color .18s ease; }
  .rwl-admin-view-button:hover { background: #eaf3ed; border-color: #79a694; }
  /* Detail popup */
  .rwl-admin-modal-backdrop { position: fixed; inset: 0; z-index: 60; background: rgba(20, 38, 33, .55); backdrop-filter: blur(3px); display: flex; align-items: center; justify-content: center; padding: 26px; animation: rwlAdminFade .18s ease both; }
  @keyframes rwlAdminFade { from { opacity: 0; } to { opacity: 1; } }
  .rwl-admin-modal { width: min(100%, 860px); max-height: min(90dvh, 900px); display: flex; flex-direction: column; background: #fbfdfa; border: 1px solid #dfe7e0; border-radius: 18px; box-shadow: 0 26px 70px rgba(20, 38, 33, .28); overflow: hidden; animation: rwlAdminRise .22s ease both; }
  @keyframes rwlAdminRise { from { opacity: 0; transform: translateY(12px) scale(.985); } to { opacity: 1; transform: none; } }
  .rwl-admin-modal-head { display: flex; align-items: flex-start; justify-content: space-between; gap: 16px; padding: 19px; border-bottom: 1px solid #e4e8e2; background: #fff; }
  .rwl-admin-modal-head-right { display: flex; align-items: flex-start; gap: 12px; }
  .rwl-admin-modal-close { display: grid; place-items: center; width: 34px; height: 34px; border: 1px solid #dfe7e0; border-radius: 9px; background: #fff; color: #5c7168; cursor: pointer; }
  .rwl-admin-modal-close:hover { background: #eef3ee; color: #26483c; }
  /* One section at a time */
  .rwl-admin-section-tabs { display: flex; gap: 8px; padding: 13px 19px; border-bottom: 1px solid #e4e8e2; background: #fff; }
  .rwl-admin-section-tab { display: inline-flex; align-items: center; gap: 7px; padding: 9px 15px; border: 1px solid #dfe7e0; border-radius: 999px; background: #fff; color: #5c7168; font-size: .74rem; font-weight: 800; cursor: pointer; transition: all .18s ease; }
  .rwl-admin-section-tab:hover { border-color: #79a694; color: #2c6a58; }
  .rwl-admin-section-tab.active { background: #2c6a58; border-color: #2c6a58; color: #fff; }
  .rwl-admin-modal-body { flex: 1; overflow-y: auto; padding: 19px; }
  .rwl-admin-modal-foot { display: grid; grid-template-columns: 170px minmax(0, 1fr) auto; align-items: end; gap: 12px; padding: 16px 19px; border-top: 1px solid #e4e8e2; background: #fff; }
  .rwl-admin-modal-foot textarea { min-height: 62px; }
  .rwl-admin-modal-foot .rwl-admin-inline-feedback { grid-column: 1 / -1; }
  /* Student summary strip */
  .rwl-admin-summary-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 11px; margin-bottom: 18px; }
  .rwl-admin-summary-grid > div { padding: 11px 13px; border: 1px solid #e4ece6; border-radius: 11px; background: #fff; }
  .rwl-admin-summary-grid span { display: block; font-size: .6rem; font-weight: 800; letter-spacing: .09em; text-transform: uppercase; color: #789087; }
  .rwl-admin-summary-grid strong { display: block; margin-top: 4px; font-size: .78rem; color: #33494b; }
  /* Question and answer transcript */
  .rwl-admin-qa-list { display: grid; gap: 9px; }
  .rwl-admin-qa { display: flex; gap: 12px; padding: 13px 15px; border: 1px solid #e4ece6; border-radius: 12px; background: #fff; }
  .rwl-admin-qa-number { flex: 0 0 26px; height: 26px; display: grid; place-items: center; border-radius: 50%; background: #eef3ee; color: #5c7168; font-size: .68rem; font-weight: 800; }
  .rwl-admin-qa-body { min-width: 0; }
  .rwl-admin-qa-question { font-size: .72rem; font-weight: 700; color: #789087; line-height: 1.55; }
  .rwl-admin-qa-answer { margin-top: 5px; font-size: .84rem; font-weight: 700; color: #26483c; line-height: 1.5; }
  .rwl-admin-qa-career { margin-top: 4px; font-size: .66rem; font-weight: 700; color: #8a9a95; }
  /* Count badge next to a sidebar item */
  .rwl-admin-nav-count { margin-left: auto; padding: 2px 8px; border-radius: 999px; background: rgba(231, 241, 233, .16); color: #dbe8e1; font-size: .62rem; font-weight: 800; font-style: normal; }
  .rwl-admin-nav-button.active .rwl-admin-nav-count { background: rgba(32, 50, 56, .16); color: #203238; }
  /* Dashboard */
  .rwl-admin-dash-panel { margin-top: 15px; }
  .rwl-admin-dash-boxes { display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 11px; padding: 17px 19px; }
  .rwl-admin-dash-box { padding: 15px; border: 1px solid #e4ece6; border-left: 3px solid #cfd9d3; border-radius: 12px; background: #fff; }
  .rwl-admin-dash-box.designed { border-left-color: #8b74d0; }
  .rwl-admin-dash-box.dispatched { border-left-color: #d99a2b; }
  .rwl-admin-dash-box.delivered { border-left-color: #2c6a58; }
  .rwl-admin-dash-box span { display: block; font-size: .64rem; font-weight: 800; letter-spacing: .07em; text-transform: uppercase; color: #789087; }
  .rwl-admin-dash-box strong { display: block; margin-top: 7px; font-size: 1.6rem; font-weight: 800; letter-spacing: -.04em; color: #26483c; }
  .rwl-admin-dash-todo { display: grid; grid-template-columns: repeat(auto-fit, minmax(190px, 1fr)); gap: 11px; padding: 17px 19px 0; }
  .rwl-admin-dash-todo > div { display: flex; align-items: baseline; justify-content: space-between; gap: 11px; padding: 13px 15px; border: 1px solid #e4ece6; border-radius: 11px; background: #fff; }
  .rwl-admin-dash-todo span { font-size: .72rem; font-weight: 700; color: #5c7168; }
  .rwl-admin-dash-todo strong { font-size: 1.05rem; font-weight: 800; color: #26483c; }
  .rwl-admin-dash-todo > div.flag { border-color: #e8d3a6; background: #fdf8ec; }
  .rwl-admin-dash-todo > div.flag strong { color: #8a6d1f; }
  .rwl-admin-dash-foot { padding: 17px 19px; }
  /* Unsaved-changes prompt inside the popup */
  .rwl-admin-confirm { position: absolute; inset: 0; z-index: 5; display: grid; place-items: center; padding: 22px; background: rgba(32, 56, 48, .45); }
  .rwl-admin-confirm-card { width: min(100%, 380px); display: grid; justify-items: center; gap: 7px; text-align: center; padding: 24px 22px; border-radius: 15px; background: #fff; color: #b4892a; box-shadow: 0 18px 44px rgba(20, 38, 33, .26); }
  .rwl-admin-confirm-card h3 { margin: 5px 0 0; font-size: .95rem; color: #203238; }
  .rwl-admin-confirm-card p { margin: 0; font-size: .75rem; color: #5c7168; line-height: 1.6; }
  .rwl-admin-confirm-actions { display: flex; flex-wrap: wrap; justify-content: center; gap: 8px; margin-top: 13px; }
  .rwl-admin-ghost-button { padding: 10px 15px; border: 1px solid #dfe7e0; border-radius: 10px; background: #fff; color: #5c7168; font-size: .74rem; font-weight: 800; cursor: pointer; }
  .rwl-admin-ghost-button:hover { border-color: #79a694; color: #26483c; }
  .rwl-admin-modal { position: relative; }
  .rwl-admin-form-field input { width: 100%; border: 1px solid #d4dfd7; border-radius: 9px; outline: none; background: #f8faf6; color: #33494b; padding: 10px 11px; font-size: .75rem; transition: border-color .2s ease, box-shadow .2s ease; }
  .rwl-admin-form-field input:focus { border-color: #79a694; box-shadow: 0 0 0 3px rgba(121, 166, 148, .13); }
  .rwl-admin-form-field label { display: flex; align-items: center; gap: 5px; }
  .rwl-admin-hint { display: flex; align-items: center; gap: 5px; font-size: .64rem; font-weight: 700; color: #8a6d1f; }
  /* Linking Box panel */
  .rwl-admin-box { margin-top: 6px; padding: 18px; border: 1px solid #d9e5db; border-radius: 14px; background: #f6faf7; }
  .rwl-admin-box .rwl-admin-edit-row { grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); align-items: start; margin-top: 16px; }
  .rwl-admin-box .rwl-admin-form-field.full { grid-column: 1 / -1; }
  .rwl-admin-box .rwl-admin-button { grid-column: 1 / -1; justify-self: start; }
  .rwl-admin-box-track { display: flex; flex-wrap: wrap; gap: 6px; margin: 12px 0 14px; }
  .rwl-admin-box-step { padding: 5px 11px; border-radius: 50px; font-size: .64rem; font-weight: 800; letter-spacing: .04em; background: #eceff0; color: #8a9a95; }
  .rwl-admin-box-step.done { background: #d9ece3; color: #2c6a58; }
  .rwl-admin-box-step.current { background: #2c6a58; color: #fff; }
  .rwl-admin-box-facts { display: grid; grid-template-columns: repeat(auto-fit, minmax(190px, 1fr)); gap: 11px; }
  .rwl-admin-box-facts > div { padding: 10px 12px; border-radius: 10px; background: #fff; border: 1px solid #e4ece6; }
  .rwl-admin-box-facts span { display: block; font-size: .6rem; font-weight: 800; letter-spacing: .09em; text-transform: uppercase; color: #789087; }
  .rwl-admin-box-facts strong { display: block; margin-top: 3px; font-size: .74rem; font-weight: 700; color: #33494b; word-break: break-word; }
  .rwl-admin-box-facts code { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: .69rem; }
  .rwl-admin-box-notes { margin-top: 13px; padding: 12px 14px; border-radius: 10px; background: #fff; border: 1px solid #e4ece6; }
  .rwl-admin-box-notes .rwl-admin-detail-value { margin-top: 6px; white-space: pre-wrap; }
  .rwl-admin-button { min-height: 39px; display: inline-flex; align-items: center; justify-content: center; gap: 7px; border: 0; border-radius: 9px; padding: 0 14px; background: #3f7468; color: #f7fbf7; font-size: .69rem; font-weight: 800; transition: background .2s ease, transform .2s ease, opacity .2s ease; }
  .rwl-admin-button:hover { background: #315e55; transform: translateY(-1px); }
  .rwl-admin-button:disabled { cursor: wait; opacity: .58; transform: none; }
  .rwl-admin-button.secondary { border: 1px solid #d4dfd7; background: #f8faf6; color: #52756c; }
  .rwl-admin-button.secondary:hover { border-color: #8db2a2; background: #eef4ed; }
  .rwl-admin-button.danger { color: #a15d58; background: #f9ece8; }
  .rwl-admin-inline-feedback { display: flex; align-items: center; gap: 7px; margin-top: 11px; color: #477962; font-size: .68rem; font-weight: 700; }
  .rwl-admin-inline-feedback.error { color: #a15d58; }
  .rwl-admin-empty, .rwl-admin-error { min-height: 390px; display: grid; place-items: center; padding: 30px; text-align: center; }
  .rwl-admin-empty-icon, .rwl-admin-error-icon { width: 44px; height: 44px; display: grid; place-items: center; margin: 0 auto 14px; border-radius: 13px; background: #e7efe9; color: #5c8577; }
  .rwl-admin-error-icon { background: #f8e9e4; color: #aa625c; }
  .rwl-admin-empty h3, .rwl-admin-error h3 { margin: 0; font-size: .88rem; }
  .rwl-admin-empty p, .rwl-admin-error p { max-width: 300px; color: #7c8f87; margin: 8px auto 17px; font-size: .71rem; line-height: 1.6; }
  .rwl-admin-empty .rwl-admin-button, .rwl-admin-error .rwl-admin-button { margin: 0 auto; }
  .rwl-admin-skeleton-list { display: grid; gap: 8px; padding: 15px; }
  .rwl-admin-skeleton { height: 72px; border-radius: 12px; background: linear-gradient(90deg, #edf1ec 25%, #f6f8f3 40%, #edf1ec 65%); background-size: 300% 100%; animation: rwl-admin-shimmer 1.4s ease infinite; }
  .rwl-admin-detail-skeleton { min-height: 430px; margin: 15px; border-radius: 12px; background: linear-gradient(90deg, #edf1ec 25%, #f6f8f3 40%, #edf1ec 65%); background-size: 300% 100%; animation: rwl-admin-shimmer 1.4s ease infinite; }
  .rwl-admin-settings { padding: 24px; }
  .rwl-admin-settings-intro { display: flex; justify-content: space-between; align-items: start; gap: 20px; margin-bottom: 26px; }
  .rwl-admin-settings-intro h2 { margin: 0; font-size: 1.3rem; letter-spacing: -.05em; }
  .rwl-admin-settings-intro p { max-width: 530px; color: #758a82; margin: 7px 0 0; font-size: .75rem; line-height: 1.6; }
  .rwl-admin-setting-list { display: grid; gap: 10px; }
  .rwl-admin-setting-row { display: grid; grid-template-columns: minmax(130px, .55fr) minmax(0, 1fr) 38px; gap: 10px; align-items: center; }
  .rwl-admin-setting-key { color: #54766c; padding: 10px 11px; border-radius: 9px; background: #eaf1eb; font-family: var(--app-font-mono, monospace); font-size: .69rem; overflow-wrap: anywhere; }
  .rwl-admin-setting-input { min-height: 39px; }
  .rwl-admin-settings-actions { display: flex; flex-wrap: wrap; justify-content: space-between; gap: 12px; margin-top: 20px; padding-top: 20px; border-top: 1px solid #e4e8e2; }
  .rwl-admin-login { min-height: 100dvh; display: grid; grid-template-columns: minmax(0, 1.1fr) minmax(360px, .9fr); background: #f4f5f0; }
  .rwl-admin-login-story { position: relative; overflow: hidden; display: flex; flex-direction: column; justify-content: space-between; padding: clamp(28px, 6vw, 78px); background: #20383a; color: #eef4ed; }
  .rwl-admin-login-story::before { content: ""; position: absolute; width: 420px; height: 420px; right: -170px; top: 16%; border: 1px solid rgba(220, 238, 227, .18); border-radius: 50%; box-shadow: -32px 22px 0 -1px rgba(220, 238, 227, .11), -64px 44px 0 -1px rgba(220, 238, 227, .08); }
  .rwl-admin-login-story > * { position: relative; z-index: 1; }
  .rwl-admin-login-brand { font-size: .9rem; font-weight: 800; letter-spacing: .14em; }
  .rwl-admin-login-brand small { display: block; color: #9cb6aa; margin-top: 9px; font-size: .51rem; letter-spacing: .12em; }
  .rwl-admin-login-copy { max-width: 560px; margin: auto 0; padding: 70px 0; }
  .rwl-admin-login-copy .eyebrow { color: #e7c982; font-size: .65rem; font-weight: 800; letter-spacing: .16em; text-transform: uppercase; }
  .rwl-admin-login-copy h1 { max-width: 600px; margin: 19px 0 16px; font-size: clamp(2.65rem, 6vw, 5.6rem); letter-spacing: -.08em; line-height: .94; }
  .rwl-admin-login-copy p { max-width: 420px; color: #b5cbc0; margin: 0; font-size: .86rem; line-height: 1.75; }
  .rwl-admin-login-foot { color: #8fa99e; font-size: .65rem; }
  .rwl-admin-login-card-wrap { display: grid; place-items: center; padding: 30px; background: #f4f5f0; }
  .rwl-admin-login-card { width: min(430px, 100%); padding: clamp(25px, 5vw, 44px); border: 1px solid #dce2db; border-radius: 21px; background: #fbfcf8; box-shadow: 0 22px 60px rgba(46, 68, 62, .08); }
  .rwl-admin-login-card-icon { width: 47px; height: 47px; display: grid; place-items: center; margin-bottom: 23px; border-radius: 14px; background: #e1eee7; color: #4d7f6e; }
  .rwl-admin-login-card h2 { margin: 0; font-size: 1.65rem; letter-spacing: -.06em; }
  .rwl-admin-login-card > p { color: #758a82; margin: 9px 0 26px; font-size: .76rem; line-height: 1.65; }
  .rwl-admin-login-form { display: grid; gap: 14px; }
  .rwl-admin-login-field { display: grid; gap: 7px; }
  .rwl-admin-login-field label { color: #52756c; font-size: .65rem; font-weight: 800; letter-spacing: .08em; text-transform: uppercase; }
  .rwl-admin-login-field input { width: 100%; min-height: 47px; border: 1px solid #d4dfd7; border-radius: 10px; outline: none; background: #f8faf6; color: #33494b; padding: 0 13px; font-size: .8rem; }
  .rwl-admin-login-field input:focus { border-color: #79a694; box-shadow: 0 0 0 3px rgba(121, 166, 148, .13); }
  .rwl-admin-login-submit { width: 100%; min-height: 46px; margin-top: 3px; }
  .rwl-admin-login-notice { display: flex; align-items: flex-start; gap: 8px; padding: 11px 12px; border-radius: 9px; background: #edf5ef; color: #477962; font-size: .69rem; line-height: 1.5; }
  .rwl-admin-login-error { display: flex; align-items: flex-start; gap: 8px; padding: 11px 12px; border-radius: 9px; background: #f9ece8; color: #a15d58; font-size: .69rem; line-height: 1.5; }
  .rwl-admin-back-link { display: inline-flex; align-items: center; gap: 6px; border: 0; background: transparent; color: #628177; padding: 0; font-size: .68rem; font-weight: 800; }
  .rwl-admin-back-link:hover { color: #315e55; }
  @keyframes rwl-admin-shimmer { from { background-position: 100% 0; } to { background-position: -100% 0; } }
  @media (max-width: 980px) {
    .rwl-admin-shell { grid-template-columns: 72px minmax(0, 1fr); }
    .rwl-admin-sidebar { padding-inline: 11px; }
    .rwl-admin-brand, .rwl-admin-rail-label, .rwl-admin-sidebar-foot { display: none; }
    .rwl-admin-nav-button { justify-content: center; padding: 13px 8px; }
    .rwl-admin-nav-button span { display: none; }
    .rwl-admin-stat-grid { grid-template-columns: repeat(2, 1fr); }
  }
  @media (max-width: 760px) {
    .rwl-admin-shell { display: block; }
    .rwl-admin-sidebar { min-height: 62px; height: 62px; padding: 8px 14px; flex-direction: row; align-items: center; justify-content: center; }
    .rwl-admin-nav { display: flex; gap: 5px; }
    .rwl-admin-nav-button { width: 44px; height: 44px; }
    .rwl-admin-content { width: min(100% - 28px, 620px); padding-top: 24px; }
    .rwl-admin-topbar { padding-inline: 16px; }
    .rwl-admin-topbar-kicker { display: none; }
    .rwl-admin-topbar-title { margin: 0; font-size: 1rem; }
    .rwl-admin-logout span { display: none; }
    .rwl-admin-overview { display: block; }
    .rwl-admin-overview-note { margin-top: 17px; }
    .rwl-admin-stat-grid { gap: 8px; }
    .rwl-admin-stat { min-height: 92px; padding: 13px; }
    .rwl-admin-stat-value { margin-top: 11px; font-size: 1.4rem; }
    .rwl-admin-workspace { grid-template-columns: 1fr; }
    .rwl-admin-record-list { max-height: 380px; min-height: 0; }
    .rwl-admin-detail { min-height: 0; }
    .rwl-admin-detail-grid { grid-template-columns: 1fr; }
    .rwl-admin-detail-section.full { grid-column: auto; }
    .rwl-admin-edit-row { grid-template-columns: 1fr; }
    .rwl-admin-edit-row .rwl-admin-button { width: 100%; }
    .rwl-admin-box .rwl-admin-edit-row { grid-template-columns: 1fr; }
    .rwl-admin-box .rwl-admin-button { justify-self: stretch; }
    .rwl-admin-box-facts { grid-template-columns: 1fr; }
    .rwl-admin-modal-backdrop { padding: 0; align-items: stretch; }
    .rwl-admin-modal { width: 100%; max-height: 100dvh; border-radius: 0; border: 0; }
    .rwl-admin-modal-head { flex-direction: column; gap: 12px; }
    .rwl-admin-modal-head-right { width: 100%; justify-content: space-between; }
    .rwl-admin-modal-foot { grid-template-columns: 1fr; }
    .rwl-admin-record { flex-wrap: wrap; }
    .rwl-admin-view-button { width: 100%; justify-content: center; }
    .rwl-admin-settings-intro { display: block; }
    .rwl-admin-setting-row { grid-template-columns: 1fr 38px; }
    .rwl-admin-setting-key { grid-column: 1 / -1; }
    .rwl-admin-login { display: block; }
    .rwl-admin-login-story { min-height: 43dvh; padding: 27px 24px; }
    .rwl-admin-login-copy { padding: 42px 0 10px; margin: 0; }
    .rwl-admin-login-copy h1 { font-size: clamp(2.8rem, 13vw, 4.5rem); }
    .rwl-admin-login-foot { display: none; }
    .rwl-admin-login-card-wrap { min-height: 57dvh; padding: 24px 16px 38px; }
  }
`;

function formatDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Date unavailable';
  return new Intl.DateTimeFormat(undefined, { day: 'numeric', month: 'short', year: 'numeric' }).format(date);
}

function formatStatus(status: string) {
  return status.replace('_', ' ');
}

function getInitials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('');
}

function renderAnswer(value: unknown) {
  if (value === null || value === undefined) return 'Not provided';
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') return String(value);
  try {
    return JSON.stringify(value);
  } catch {
    return 'Not available';
  }
}

function LoadingList() {
  return (
    <div className="rwl-admin-skeleton-list" aria-label="Loading submissions">
      <div className="rwl-admin-skeleton" />
      <div className="rwl-admin-skeleton" />
      <div className="rwl-admin-skeleton" />
      <div className="rwl-admin-skeleton" />
    </div>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="rwl-admin-empty">
      <div>
        <div className="rwl-admin-empty-icon"><ClipboardList size={20} /></div>
        <h3>Nothing here yet</h3>
        <p>{message}</p>
      </div>
    </div>
  );
}

function AdminLogin({
  email,
  setEmail,
  code,
  setCode,
  step,
  busy,
  error,
  notice,
  onRequestOtp,
  onVerifyOtp,
  onBack,
}: {
  email: string;
  setEmail: (value: string) => void;
  code: string;
  setCode: (value: string) => void;
  step: 'email' | 'otp';
  busy: boolean;
  error: string;
  notice: string;
  onRequestOtp: (event: FormEvent<HTMLFormElement>) => void;
  onVerifyOtp: (event: FormEvent<HTMLFormElement>) => void;
  onBack: () => void;
}) {
  return (
    <div className="rwl-admin-login">
      <section className="rwl-admin-login-story">
        <div className="rwl-admin-login-brand">REAL WORLD LINK<small>IN SHORTS BY AAFIYA &amp; SANA</small></div>
        <div className="rwl-admin-login-copy">
          <div className="eyebrow">Admin workspace</div>
          <h1>A calm place to keep the human part in view.</h1>
          <p>Review student reflections, respond to thoughtful questions and keep every next step considered.</p>
        </div>
        <div className="rwl-admin-login-foot">For Aafiya &amp; Sana · Private workspace</div>
      </section>
      <section className="rwl-admin-login-card-wrap">
        <div className="rwl-admin-login-card">
          <div className="rwl-admin-login-card-icon"><ShieldCheck size={22} /></div>
          <h2>{step === 'email' ? 'Welcome back.' : 'Check your inbox.'}</h2>
          <p>{step === 'email' ? 'Use your admin email to receive a one-time passcode.' : `We sent a passcode to ${email}. Enter it below to continue.`}</p>
          {error && <div className="rwl-admin-login-error"><AlertCircle size={15} /> <span>{error}</span></div>}
          {notice && !error && <div className="rwl-admin-login-notice"><CheckCircle2 size={15} /> <span>{notice}</span></div>}
          {step === 'email' ? (
            <form className="rwl-admin-login-form" onSubmit={onRequestOtp}>
              <div className="rwl-admin-login-field">
                <label htmlFor="admin-email">Admin email</label>
                <input id="admin-email" type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="you@example.com" required />
              </div>
              <button className="rwl-admin-button rwl-admin-login-submit" disabled={busy} type="submit">
                {busy ? 'Sending passcode…' : 'Send passcode'} <ChevronRight size={15} />
              </button>
            </form>
          ) : (
            <form className="rwl-admin-login-form" onSubmit={onVerifyOtp}>
              <div className="rwl-admin-login-field">
                <label htmlFor="admin-code">One-time passcode</label>
                <input id="admin-code" inputMode="numeric" autoComplete="one-time-code" value={code} onChange={(event) => setCode(event.target.value)} placeholder="Enter your code" required />
              </div>
              <button className="rwl-admin-button rwl-admin-login-submit" disabled={busy} type="submit">
                {busy ? 'Verifying…' : 'Enter workspace'} <ChevronRight size={15} />
              </button>
              <button className="rwl-admin-back-link" type="button" onClick={onBack}><X size={14} /> Use a different email</button>
            </form>
          )}
        </div>
      </section>
    </div>
  );
}

function RecordList({
  records,
  selectedKey,
  onSelect,
}: {
  records: AdminRecord[];
  selectedKey: string | null;
  onSelect: (record: AdminRecord) => void;
}) {
  if (records.length === 0) return <EmptyState message="New contact messages and completed assessments will appear here." />;
  return (
    <div className="rwl-admin-record-list">
      {records.map((record) => {
        const item = record.item;
        const title = record.kind === 'contact' ? (item as ContactSubmission).subject : `${(item as AssessmentSubmission).stream} assessment`;
        const meta = record.kind === 'contact' ? item.email : `${(item as AssessmentSubmission).grade} · ${(item as AssessmentSubmission).city} · ${(item as AssessmentSubmission).school}`;
        const key = `${record.kind}-${item.id}`;
        return (
          <div className={`rwl-admin-record ${selectedKey === key ? 'selected' : ''}`} key={key}>
            <span className={`rwl-admin-record-avatar ${record.kind}`}>{record.kind === 'contact' ? <MessageSquare size={16} /> : getInitials(item.name)}</span>
            <span className="rwl-admin-record-copy">
              <span className="rwl-admin-record-line"><span className="rwl-admin-record-name">{item.name}</span><span className="rwl-admin-record-date">{formatDate(item.created_at)}</span></span>
              <span className="rwl-admin-record-meta">{title} · {meta}</span>
              <span className={`rwl-admin-status ${item.status}`}>{formatStatus(item.status)}</span>
            </span>
            <button className="rwl-admin-view-button" type="button" onClick={() => onSelect(record)} data-testid={`button-view-${key}`}>
              <Eye size={14} /> View
            </button>
          </div>
        );
      })}
    </div>
  );
}

// Everything worth knowing at a glance: how many students came through, where
// their boxes are, and what is still waiting on someone here.
function DashboardPanel({
  contacts,
  assessments,
  loading,
  onOpenStudents,
}: {
  contacts: ContactSubmission[];
  assessments: AssessmentSubmission[];
  loading: boolean;
  onOpenStudents: () => void;
}) {
  const boxCounts = boxSteps.map((step) => ({
    ...step,
    count: assessments.filter((item) => item.box_status === step.key).length,
  }));
  const value = (input: number) => (loading ? '—' : String(input));
  const newAssessments = assessments.filter((item) => item.status === 'new').length;
  const newContacts = contacts.filter((item) => item.status === 'new').length;
  const challengesIn = assessments.filter((item) => item.challenge_submitted_at).length;
  const awaitingFeedback = assessments.filter((item) => item.challenge_submitted_at && !item.mentor_feedback).length;
  const noMentor = assessments.filter((item) => !item.mentor_name).length;
  const noDeliveryDate = assessments.filter((item) => item.box_status !== 'delivered' && !item.expected_delivery_on).length;

  return (
    <>
      <section className="rwl-admin-stat-grid" aria-label="Overview">
        <div className="rwl-admin-stat primary"><span className="rwl-admin-stat-label"><UserRound size={14} /> Students</span><strong className="rwl-admin-stat-value">{value(assessments.length)}</strong></div>
        <div className="rwl-admin-stat"><span className="rwl-admin-stat-label"><ClipboardList size={14} /> New assessments</span><strong className="rwl-admin-stat-value">{value(newAssessments)}</strong></div>
        <div className="rwl-admin-stat"><span className="rwl-admin-stat-label"><Mail size={14} /> Contact messages</span><strong className="rwl-admin-stat-value">{value(contacts.length)}</strong></div>
        <div className="rwl-admin-stat"><span className="rwl-admin-stat-label"><AlertCircle size={14} /> Unread messages</span><strong className="rwl-admin-stat-value">{value(newContacts)}</strong></div>
      </section>

      <section className="rwl-admin-panel rwl-admin-dash-panel">
        <div className="rwl-admin-panel-head">
          <div><h2>Linking Box delivery</h2><p>Where every student&rsquo;s box currently sits</p></div>
          <Truck size={18} color="#739287" />
        </div>
        <div className="rwl-admin-dash-boxes">
          {boxCounts.map((step) => (
            <div className={`rwl-admin-dash-box ${step.key}`} key={step.key}>
              <span>{boxStatusLabels[step.key]}</span>
              <strong>{value(step.count)}</strong>
            </div>
          ))}
        </div>
      </section>

      <section className="rwl-admin-panel rwl-admin-dash-panel">
        <div className="rwl-admin-panel-head">
          <div><h2>Needs your attention</h2><p>Open items, not a queue</p></div>
          <Clock3 size={18} color="#739287" />
        </div>
        <div className="rwl-admin-dash-todo">
          <div><span>Challenges turned in</span><strong>{value(challengesIn)}</strong></div>
          <div className={awaitingFeedback > 0 ? 'flag' : ''}><span>Awaiting mentor feedback</span><strong>{value(awaitingFeedback)}</strong></div>
          <div className={noMentor > 0 ? 'flag' : ''}><span>No mentor assigned</span><strong>{value(noMentor)}</strong></div>
          <div className={noDeliveryDate > 0 ? 'flag' : ''}><span>No delivery date set</span><strong>{value(noDeliveryDate)}</strong></div>
        </div>
        <div className="rwl-admin-dash-foot">
          <button className="rwl-admin-button" type="button" onClick={onOpenStudents} data-testid="button-open-students">
            <UserRound size={14} /> Open students
          </button>
        </div>
      </section>
    </>
  );
}

// Full record shown in a popup. An assessment has two sections - the answers
// and the Linking Box - and only one is open at a time so neither buries the
// other. Contacts have a single message, so they show no section switcher.
function SubmissionModal({
  record,
  status,
  notes,
  setStatus,
  setNotes,
  saving,
  saveError,
  saved,
  onSave,
  onBoxUpdated,
  onClose,
  isDirty,
}: {
  record: AdminRecord;
  status: ContactStatus | AssessmentStatus;
  notes: string;
  setStatus: (value: ContactStatus | AssessmentStatus) => void;
  setNotes: (value: string) => void;
  saving: boolean;
  saveError: string;
  saved: boolean;
  onSave: () => Promise<boolean>;
  onBoxUpdated: (assessment: AssessmentSubmission) => void;
  onClose: () => void;
  isDirty: boolean;
}) {
  const isContact = record.kind === 'contact';
  const [section, setSection] = useState<'answers' | 'delivery'>('answers');
  // Only shown when closing would throw away edits.
  const [confirmingClose, setConfirmingClose] = useState(false);

  // Closing is free when nothing was touched; otherwise ask first.
  const requestClose = useCallback(() => {
    if (isDirty) setConfirmingClose(true);
    else onClose();
  }, [isDirty, onClose]);
  const item = record.item;
  const contact = item as ContactSubmission;
  const assessment = item as AssessmentSubmission;
  const statusOptions = isContact ? (['new', 'in_progress', 'resolved'] as ContactStatus[]) : (['new', 'reviewed', 'contacted'] as AssessmentStatus[]);

  // Reset to the first section when a different record is opened.
  useEffect(() => { setSection('answers'); }, [record.kind, item.id]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => { if (event.key === 'Escape') requestClose(); };
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => { document.removeEventListener('keydown', onKey); document.body.style.overflow = ''; };
  }, [requestClose]);

  return (
    <div className="rwl-admin-modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) requestClose(); }}>
      <div className="rwl-admin-modal" role="dialog" aria-modal="true" aria-labelledby="rwl-admin-modal-title">
        <div className="rwl-admin-modal-head">
          <div className="rwl-admin-detail-title">
            <div className={`rwl-admin-detail-icon ${record.kind}`}><span>{isContact ? <MessageSquare size={19} /> : <ClipboardList size={19} />}</span></div>
            <div>
              <h2 id="rwl-admin-modal-title">{item.name}</h2>
              <p>{item.email}{!isContact && assessment.phone ? ' · ' + assessment.phone : ''}</p>
            </div>
          </div>
          <div className="rwl-admin-modal-head-right">
            <div className="rwl-admin-detail-date">
              <strong>{isContact ? contact.subject : `${assessment.stream} assessment`}</strong>
              {formatDate(item.created_at)}
            </div>
            <button className="rwl-admin-modal-close" type="button" onClick={requestClose} aria-label="Close" data-testid="button-close-modal"><X size={17} /></button>
          </div>
        </div>

        {!isContact && (
          <div className="rwl-admin-section-tabs">
            <button className={`rwl-admin-section-tab ${section === 'answers' ? 'active' : ''}`} type="button" onClick={() => setSection('answers')} data-testid="tab-answers">
              <ClipboardList size={15} /> Questions &amp; answers
            </button>
            <button className={`rwl-admin-section-tab ${section === 'delivery' ? 'active' : ''}`} type="button" onClick={() => setSection('delivery')} data-testid="tab-delivery">
              <Package size={15} /> Delivery
            </button>
          </div>
        )}

        <div className="rwl-admin-modal-body">
          {isContact && (
            <div className="rwl-admin-detail-section full"><span className="rwl-admin-detail-label">Message</span><div className="rwl-admin-detail-value">{contact.message}</div></div>
          )}

          {!isContact && section === 'answers' && (
            <>
              <div className="rwl-admin-summary-grid">
                <div><span>Class</span><strong>{assessment.grade || 'Not given'}</strong></div>
                <div><span>City</span><strong>{assessment.city || 'Not given'}</strong></div>
                <div><span>School</span><strong>{assessment.school || 'Not given'}</strong></div>
                <div><span>Result</span><strong>{assessment.result || 'No result recorded'}</strong></div>
              </div>
              <AnswerSheet assessment={assessment} />
            </>
          )}

          {!isContact && section === 'delivery' && <LinkingBoxPanel assessment={assessment} onUpdated={onBoxUpdated} />}
        </div>

        <div className="rwl-admin-modal-foot">
          <div className="rwl-admin-form-field">
            <label htmlFor="submission-status">Status</label>
            <select id="submission-status" value={status} onChange={(event) => setStatus(event.target.value as ContactStatus | AssessmentStatus)}>
              {statusOptions.map((option) => <option key={option} value={option}>{formatStatus(option)}</option>)}
            </select>
          </div>
          <div className="rwl-admin-form-field">
            <label htmlFor="submission-notes">Private notes</label>
            <textarea id="submission-notes" value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="Add a note for your team..." />
          </div>
          <button className="rwl-admin-button" type="button" disabled={saving || !isDirty} onClick={() => void onSave()} data-testid="button-save-record">
            <Save size={14} /> {saving ? 'Saving...' : isDirty ? 'Save changes' : 'Saved'}
          </button>
          {saveError && <div className="rwl-admin-inline-feedback error"><AlertCircle size={14} /> {saveError}</div>}
          {saved && !saveError && <div className="rwl-admin-inline-feedback"><CheckCircle2 size={14} /> Changes saved for your team.</div>}
        </div>

        {confirmingClose && (
          <div className="rwl-admin-confirm" role="alertdialog" aria-label="Unsaved changes">
            <div className="rwl-admin-confirm-card">
              <AlertCircle size={19} />
              <h3>Save your changes?</h3>
              <p>You changed this submission but have not saved it yet.</p>
              <div className="rwl-admin-confirm-actions">
                <button
                  className="rwl-admin-button"
                  type="button"
                  disabled={saving}
                  onClick={() => { void onSave().then((ok) => { if (ok) onClose(); else setConfirmingClose(false); }); }}
                  data-testid="button-confirm-save-close"
                >
                  <Save size={14} /> {saving ? 'Saving...' : 'Save and close'}
                </button>
                <button className="rwl-admin-ghost-button" type="button" onClick={onClose} data-testid="button-discard-close">Discard</button>
                <button className="rwl-admin-ghost-button" type="button" onClick={() => setConfirmingClose(false)} data-testid="button-cancel-close">Keep editing</button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// Pairs each stored answer with the question the student was actually asked,
// so the workspace reads as a transcript rather than as stored data.
function AnswerSheet({ assessment }: { assessment: AssessmentSubmission }) {
  const entries = Object.entries(assessment.answers)
    .map(([key, value]) => ({ index: Number(key), value }))
    .filter((entry) => Number.isFinite(entry.index))
    .sort((a, b) => a.index - b.index);

  if (entries.length === 0) {
    return <div className="rwl-admin-detail-value">No answers recorded.</div>;
  }

  return (
    <div className="rwl-admin-qa-list">
      <span className="rwl-admin-detail-label">{entries.length} answers</span>
      {entries.map(({ index, value }) => {
        const answer = value as { text?: unknown; career?: unknown } | null;
        const answerText = typeof answer?.text === 'string' ? answer.text : renderAnswer(value);
        const career = typeof answer?.career === 'string' ? answer.career : '';
        return (
          <div className="rwl-admin-qa" key={index}>
            <div className="rwl-admin-qa-number">{index + 1}</div>
            <div className="rwl-admin-qa-body">
              <div className="rwl-admin-qa-question">{questionPrompt(assessment.stream, index)}</div>
              <div className="rwl-admin-qa-answer">{answerText}</div>
              {career && career !== answerText && <div className="rwl-admin-qa-career">Points to: {career}</div>}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// Turns a DATE/DATETIME coming back from MySQL into the yyyy-mm-dd value an
// <input type="date"> expects.
function dateInputValue(value: string | null) {
  if (!value) return '';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '' : date.toISOString().slice(0, 10);
}

function LinkingBoxPanel({
  assessment,
  onUpdated,
}: {
  assessment: AssessmentSubmission;
  onUpdated: (assessment: AssessmentSubmission) => void;
}) {
  const [boxStatus, setBoxStatus] = useState<BoxStatus>(assessment.box_status);
  const [expectedDeliveryOn, setExpectedDeliveryOn] = useState(dateInputValue(assessment.expected_delivery_on));
  const [dispatchedOn, setDispatchedOn] = useState(dateInputValue(assessment.dispatched_at));
  const [mentorName, setMentorName] = useState(assessment.mentor_name ?? '');
  const [mentorPhone, setMentorPhone] = useState(assessment.mentor_phone ?? '');
  const [mentorFeedback, setMentorFeedback] = useState(assessment.mentor_feedback ?? '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  // Reset the form whenever a different student is selected.
  useEffect(() => {
    setBoxStatus(assessment.box_status);
    setExpectedDeliveryOn(dateInputValue(assessment.expected_delivery_on));
    setDispatchedOn(dateInputValue(assessment.dispatched_at));
    setMentorName(assessment.mentor_name ?? '');
    setMentorPhone(assessment.mentor_phone ?? '');
    setMentorFeedback(assessment.mentor_feedback ?? '');
    setError('');
    setNotice('');
  }, [assessment.id, assessment.box_status, assessment.expected_delivery_on, assessment.dispatched_at, assessment.mentor_name, assessment.mentor_phone, assessment.mentor_feedback]);

  const statusChanged = boxStatus !== assessment.box_status;

  const save = async () => {
    setSaving(true);
    setError('');
    setNotice('');
    try {
      const payload = await requestJson<{ assessment: AssessmentSubmission | null; emailQueued: boolean }>(
        `/api/admin/box/${assessment.id}`,
        {
          method: 'PATCH',
          body: {
            boxStatus,
            expectedDeliveryOn: expectedDeliveryOn || null,
            dispatchedOn: dispatchedOn || null,
            mentorName,
            mentorPhone,
            mentorFeedback,
          },
        },
      );
      if (payload.assessment) onUpdated(payload.assessment);
      setNotice(payload.emailQueued ? 'Saved. A status email has been sent to the student.' : 'Linking Box details saved.');
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Linking Box changes could not be saved.');
    } finally {
      setSaving(false);
    }
  };

  const address = [assessment.address_line, assessment.city, assessment.state, assessment.pincode].filter(Boolean).join(', ');

  return (
    <div className="rwl-admin-detail-section full rwl-admin-box">
      <span className="rwl-admin-detail-label"><Package size={13} /> Linking Box</span>

      <div className="rwl-admin-box-track">
        {boxSteps.map((step, index) => {
          const currentIndex = boxSteps.findIndex((entry) => entry.key === assessment.box_status);
          const state = index < currentIndex ? 'done' : index === currentIndex ? 'current' : 'todo';
          return <span className={`rwl-admin-box-step ${state}`} key={step.key}>{step.label}</span>;
        })}
      </div>

      <div className="rwl-admin-box-facts">
        <div><span>Deliver to</span><strong>{address || 'No address recorded'}</strong></div>
        <div><span>Phone</span><strong>{assessment.phone || 'Not provided'}</strong></div>
        <div>
          <span>Tracking code</span>
          <strong>{assessment.tracking_code ? <code>{assessment.tracking_code}</code> : 'Not issued'}</strong>
        </div>
        {assessment.challenge_submitted_at && (
          <div><span>Challenge turned in</span><strong>{formatDate(assessment.challenge_submitted_at)}</strong></div>
        )}
      </div>

      {assessment.challenge_notes && (
        <div className="rwl-admin-box-notes">
          <span className="rwl-admin-detail-label">Student&rsquo;s challenge notes</span>
          <div className="rwl-admin-detail-value">{assessment.challenge_notes}</div>
        </div>
      )}

      <div className="rwl-admin-edit-row">
        <div className="rwl-admin-form-field">
          <label htmlFor={`box-status-${assessment.id}`}><Truck size={13} /> Delivery status</label>
          <select id={`box-status-${assessment.id}`} value={boxStatus} onChange={(event) => setBoxStatus(event.target.value as BoxStatus)}>
            {boxSteps.map((step) => <option key={step.key} value={step.key}>{boxStatusLabels[step.key]}</option>)}
          </select>
          {statusChanged && <span className="rwl-admin-hint"><Mail size={12} /> Saving will email the student.</span>}
        </div>
        <div className="rwl-admin-form-field">
          <label htmlFor={`box-dispatched-${assessment.id}`}>Dispatch date</label>
          <input id={`box-dispatched-${assessment.id}`} type="date" value={dispatchedOn} onChange={(event) => setDispatchedOn(event.target.value)} />
        </div>
        <div className="rwl-admin-form-field">
          <label htmlFor={`box-expected-${assessment.id}`}>Expected delivery date</label>
          <input id={`box-expected-${assessment.id}`} type="date" value={expectedDeliveryOn} onChange={(event) => setExpectedDeliveryOn(event.target.value)} />
        </div>
        <div className="rwl-admin-form-field">
          <label htmlFor={`mentor-name-${assessment.id}`}><UserRound size={13} /> Assigned mentor</label>
          <input id={`mentor-name-${assessment.id}`} value={mentorName} onChange={(event) => setMentorName(event.target.value)} placeholder="Aafiya &amp; Sana" />
        </div>
        <div className="rwl-admin-form-field">
          <label htmlFor={`mentor-phone-${assessment.id}`}><PhoneCall size={13} /> Mentor phone</label>
          <input id={`mentor-phone-${assessment.id}`} value={mentorPhone} onChange={(event) => setMentorPhone(event.target.value)} placeholder="+91 …" />
        </div>
        <div className="rwl-admin-form-field full">
          <label htmlFor={`mentor-feedback-${assessment.id}`}>Feedback for the student</label>
          <textarea id={`mentor-feedback-${assessment.id}`} value={mentorFeedback} onChange={(event) => setMentorFeedback(event.target.value)} placeholder="This appears on the student's dashboard and unlocks their skill badges…" />
        </div>
        <button className="rwl-admin-button" type="button" disabled={saving} onClick={() => void save()} data-testid="button-save-box">
          <Save size={14} /> {saving ? 'Saving…' : 'Save Linking Box'}
        </button>
      </div>
      {error && <div className="rwl-admin-inline-feedback error"><AlertCircle size={14} /> {error}</div>}
      {notice && !error && <div className="rwl-admin-inline-feedback"><CheckCircle2 size={14} /> {notice}</div>}
    </div>
  );
}

function AdminWorkspace({ adminEmail, onLogout }: { adminEmail: string; onLogout: () => void }) {
  const [tab, setTab] = useState<WorkspaceTab>('dashboard');
  const [contacts, setContacts] = useState<ContactSubmission[]>([]);
  const [assessments, setAssessments] = useState<AssessmentSubmission[]>([]);
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [boxFilter, setBoxFilter] = useState<'all' | BoxStatus>('all');
  // What the record looked like when it was opened, so closing can tell
  // whether anything actually changed.
  const [baseline, setBaseline] = useState({ status: '' as string, notes: '' });
  const [status, setStatus] = useState<ContactStatus | AssessmentStatus>('new');
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [saved, setSaved] = useState(false);
  // The sidebar decides which kind of record is on screen; the search box and
  // the delivery filter narrow it from there.
  const allRecords = useMemo<AdminRecord[]>(() => {
    const source: AdminRecord[] = tab === 'contacts'
      ? contacts.map((item) => ({ kind: 'contact' as const, item }))
      : assessments
        .filter((item) => boxFilter === 'all' || item.box_status === boxFilter)
        .map((item) => ({ kind: 'assessment' as const, item }));
    return source.sort((a, b) => new Date(b.item.created_at).getTime() - new Date(a.item.created_at).getTime());
  }, [tab, contacts, assessments, boxFilter]);
  // Free-text search across the fields an admin would actually recall:
  // who they are, how to reach them, where they are and what came back.
  const records = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return allRecords;
    return allRecords.filter(({ kind, item }) => {
      const assessment = item as AssessmentSubmission;
      const haystack = kind === 'contact'
        ? [item.name, item.email, (item as ContactSubmission).subject, (item as ContactSubmission).message]
        : [item.name, item.email, assessment.city, assessment.school, assessment.grade, assessment.stream, assessment.result, assessment.phone, assessment.pincode, assessment.tracking_code];
      return haystack.filter(Boolean).some((value) => String(value).toLowerCase().includes(term));
    });
  }, [allRecords, search]);
  const selectedRecord = useMemo(() => allRecords.find((record) => `${record.kind}-${record.item.id}` === selectedKey) ?? null, [allRecords, selectedKey]);

  const loadSubmissions = useCallback(async () => {
    setLoading(true);
    setLoadError('');
    try {
      // Always fetch both kinds: the dashboard counts them together and the
      // sidebar switches between them without another round trip.
      const response = await api.get<SubmissionsResponse>('/api/admin/submissions?type=all');
      setContacts(response.contacts ?? []);
      setAssessments(response.assessments ?? []);
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : 'Submissions could not load.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void loadSubmissions(); }, [loadSubmissions]);
  // Load the selected record into the editable fields. Nothing is selected on
  // arrival: the popup opens only when someone presses View, so landing on the
  // workspace never puts a dialog in the way.
  useEffect(() => {
    if (!selectedRecord) return;
    const nextStatus = selectedRecord.item.status;
    const nextNotes = selectedRecord.item.notes ?? '';
    setStatus(nextStatus);
    setNotes(nextNotes);
    setBaseline({ status: nextStatus, notes: nextNotes });
    setSaveError('');
    setSaved(false);
  }, [selectedRecord]);

  // Returns whether the save succeeded so "Save and close" knows not to close
  // on failure and lose what was typed.
  const saveRecord = async () => {
    if (!selectedRecord) return false;
    setSaving(true);
    setSaveError('');
    setSaved(false);
    try {
      const path = selectedRecord.kind === 'contact' ? `/api/admin/submissions/contact/${selectedRecord.item.id}` : `/api/admin/submissions/assessment/${selectedRecord.item.id}`;
      await api.patch<{ ok: true }>(path, { status, notes });
      if (selectedRecord.kind === 'contact') {
        setContacts((current) => current.map((item) => item.id === selectedRecord.item.id ? { ...item, status: status as ContactStatus, notes } : item));
      } else {
        setAssessments((current) => current.map((item) => item.id === selectedRecord.item.id ? { ...item, status: status as AssessmentStatus, notes } : item));
      }
      setBaseline({ status, notes });
      setSaved(true);
      return true;
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : 'Changes could not be saved.');
      return false;
    } finally {
      setSaving(false);
    }
  };

  const total = contacts.length + assessments.length;
  const newCount = [...contacts, ...assessments].filter((item) => item.status === 'new').length;
  return (
    <div className="rwl-admin-shell">
      <aside className="rwl-admin-sidebar">
        <div className="rwl-admin-brand"><span className="rwl-admin-brand-word">REAL WORLD LINK</span><span className="rwl-admin-brand-sub">IN SHORTS BY AAFIYA &amp; SANA</span></div>
        <div className="rwl-admin-rail-label">Control room</div>
        <nav className="rwl-admin-nav" aria-label="Admin sections">
          <button className={`rwl-admin-nav-button ${tab === 'dashboard' ? 'active' : ''}`} type="button" onClick={() => setTab('dashboard')} data-testid="nav-dashboard"><LayoutDashboard size={17} /><span>Dashboard</span></button>
          <button className={`rwl-admin-nav-button ${tab === 'students' ? 'active' : ''}`} type="button" onClick={() => setTab('students')} data-testid="nav-students"><UserRound size={17} /><span>Students</span></button>
          <button className={`rwl-admin-nav-button ${tab === 'contacts' ? 'active' : ''}`} type="button" onClick={() => setTab('contacts')} data-testid="nav-contacts"><Mail size={17} /><span>Contacts</span>{contacts.length > 0 && <em className="rwl-admin-nav-count">{contacts.length}</em>}</button>
        </nav>
        <div className="rwl-admin-sidebar-foot"><small>Signed in as</small><strong>{adminEmail}</strong></div>
      </aside>
      <div className="rwl-admin-main">
        <header className="rwl-admin-topbar">
          <div><div className="rwl-admin-topbar-kicker">Real World Link · Private workspace</div><div className="rwl-admin-topbar-title">{tab === 'dashboard' ? 'Dashboard' : tab === 'students' ? 'Students' : 'Contact messages'}</div></div>
          <div className="rwl-admin-topbar-actions">
            <button className="rwl-admin-icon-button" type="button" aria-label="Refresh" onClick={() => void loadSubmissions()}><RefreshCw size={15} /></button>
            <button className="rwl-admin-logout" type="button" onClick={onLogout}><LogOut size={14} /><span>Sign out</span></button>
          </div>
        </header>
        <main className="rwl-admin-content">
          {tab === 'dashboard' && <DashboardPanel contacts={contacts} assessments={assessments} loading={loading} onOpenStudents={() => setTab('students')} />}

          {tab !== 'dashboard' && (
            <section className="rwl-admin-workspace">
              <div className="rwl-admin-panel">
                <div className="rwl-admin-panel-head">
                  <div>
                    <h2>{tab === 'students' ? 'Students' : 'Contact messages'}</h2>
                    <p>{loading ? 'Gathering the latest entries...' : `${records.length} of ${allRecords.length} shown`}</p>
                  </div>
                  {tab === 'students' ? <UserRound size={18} color="#739287" /> : <Mail size={18} color="#739287" />}
                </div>
                <div className="rwl-admin-list-controls">
                  <div className="rwl-admin-search">
                    <Search size={15} />
                    <input
                      type="search"
                      value={search}
                      onChange={(event) => setSearch(event.target.value)}
                      placeholder={tab === 'students' ? 'Search by name, email, city, school, phone or result' : 'Search by name, email or subject'}
                      aria-label="Search submissions"
                      data-testid="input-admin-search"
                    />
                    {search && <button type="button" onClick={() => setSearch('')} aria-label="Clear search"><X size={14} /></button>}
                  </div>
                  {tab === 'students' && (
                    <div className="rwl-admin-filter-bar" aria-label="Delivery status filter">
                      {(['all', ...boxSteps.map((step) => step.key)] as ('all' | BoxStatus)[]).map((option) => (
                        <button
                          className={`rwl-admin-filter ${boxFilter === option ? 'active' : ''}`}
                          key={option}
                          type="button"
                          onClick={() => setBoxFilter(option)}
                        >
                          {option === 'all' ? 'All' : boxStatusLabels[option]}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                {loading ? <LoadingList />
                  : loadError ? <div className="rwl-admin-error"><div><div className="rwl-admin-error-icon"><AlertCircle size={20} /></div><h3>Submissions could not load</h3><p>{loadError}</p><button className="rwl-admin-button" type="button" onClick={() => void loadSubmissions()}><RefreshCw size={14} /> Try again</button></div></div>
                  : records.length === 0 ? <EmptyState message={search || boxFilter !== 'all' ? 'Nothing matches this search or filter yet.' : tab === 'students' ? 'Completed assessments will appear here.' : 'Contact messages will appear here.'} />
                  : <RecordList records={records} selectedKey={selectedKey} onSelect={(record) => setSelectedKey(`${record.kind}-${record.item.id}`)} />}
              </div>
            </section>
          )}

          {selectedRecord && (
            <SubmissionModal
              record={selectedRecord}
              status={status}
              notes={notes}
              setStatus={setStatus}
              setNotes={setNotes}
              saving={saving}
              saveError={saveError}
              saved={saved}
              onSave={saveRecord}
              isDirty={status !== baseline.status || notes !== baseline.notes}
              onBoxUpdated={(updated) => setAssessments((current) => current.map((entry) => entry.id === updated.id ? updated : entry))}
              onClose={() => setSelectedKey(null)}
            />
          )}
        </main>
      </div>
    </div>
  );
}

export default function AdminPage() {
  const [authState, setAuthState] = useState<'checking' | 'login' | 'workspace'>('checking');
  const [loginStep, setLoginStep] = useState<'email' | 'otp'>('email');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [adminEmail, setAdminEmail] = useState('');
  const [authBusy, setAuthBusy] = useState(false);
  const [authError, setAuthError] = useState('');
  const [authNotice, setAuthNotice] = useState('');
  const [sessionError, setSessionError] = useState('');

  const checkSession = useCallback(async () => {
    setAuthState('checking');
    setSessionError('');
    try {
      const response = await api.get<SessionResponse>('/api/admin/session');
      if (response.authenticated && response.admin?.email) {
        setAdminEmail(response.admin.email);
        setAuthState('workspace');
      } else {
        setAuthState('login');
      }
    } catch (error) {
      setSessionError(error instanceof Error ? error.message : 'The admin session could not be checked.');
      setAuthState('login');
    }
  }, []);

  useEffect(() => {
    document.title = 'Admin · Real World Link';
    void checkSession();
  }, [checkSession]);

  const requestOtp = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setAuthBusy(true);
    setAuthError('');
    setAuthNotice('');
    try {
      const response = await api.post<{ message: string }>('/api/admin/request-otp', { email });
      setLoginStep('otp');
      setAuthNotice(response.message);
    } catch (error) {
      setAuthError(error instanceof Error ? error.message : 'The passcode could not be requested.');
    } finally {
      setAuthBusy(false);
    }
  };

  const verifyOtp = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setAuthBusy(true);
    setAuthError('');
    try {
      const response = await api.post<{ admin: { email: string } }>('/api/admin/verify-otp', { email, code });
      setAdminEmail(response.admin.email);
      setAuthState('workspace');
      setAuthNotice('');
    } catch (error) {
      setAuthError(error instanceof Error ? error.message : 'That passcode could not be verified.');
    } finally {
      setAuthBusy(false);
    }
  };

  const logout = async () => {
    setAuthBusy(true);
    try {
      await api.post<{ ok: true }>('/api/admin/logout', {});
    } finally {
      setAuthBusy(false);
      setAuthState('login');
      setLoginStep('email');
      setCode('');
      setAuthError('');
      setAuthNotice('');
    }
  };

  if (authState === 'checking') {
    return <div className="rwl-admin"><style>{ADMIN_STYLES}</style><div className="rwl-admin-login-card-wrap"><div className="rwl-admin-login-card"><div className="rwl-admin-skeleton" style={{ height: 180 }} /></div></div></div>;
  }
  if (authState === 'login') {
    return <div className="rwl-admin"><style>{ADMIN_STYLES}</style><AdminLogin email={email} setEmail={setEmail} code={code} setCode={setCode} step={loginStep} busy={authBusy} error={authError || sessionError} notice={authNotice} onRequestOtp={(event) => void requestOtp(event)} onVerifyOtp={(event) => void verifyOtp(event)} onBack={() => { setLoginStep('email'); setCode(''); setAuthError(''); setAuthNotice(''); }} /></div>;
  }
  return <div className="rwl-admin"><style>{ADMIN_STYLES}</style><AdminWorkspace adminEmail={adminEmail} onLogout={() => void logout()} /></div>;
}