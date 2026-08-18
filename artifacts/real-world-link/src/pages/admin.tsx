import { type FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  Check,
  CheckCircle2,
  ChevronRight,
  ClipboardList,
  Clock3,
  FileText,
  LayoutDashboard,
  LogOut,
  Mail,
  MessageSquare,
  Plus,
  RefreshCw,
  Save,
  Search,
  Settings,
  ShieldCheck,
  SlidersHorizontal,
  Trash2,
  UserRound,
  X,
} from 'lucide-react';

type ContactStatus = 'new' | 'in_progress' | 'resolved';
type AssessmentStatus = 'new' | 'reviewed' | 'contacted';
type SubmissionFilter = 'all' | 'contact' | 'assessment';
type WorkspaceTab = 'submissions' | 'settings';

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
  .rwl-admin { min-height: 100dvh; background: #f4f5f0; color: #203238; font-family: var(--app-font-sans, Manrope, sans-serif); }
  .rwl-admin *, .rwl-admin *::before, .rwl-admin *::after { box-sizing: border-box; }
  .rwl-admin button, .rwl-admin input, .rwl-admin textarea, .rwl-admin select { font: inherit; }
  .rwl-admin button { cursor: pointer; }
  .rwl-admin-shell { min-height: 100dvh; display: grid; grid-template-columns: 244px minmax(0, 1fr); }
  .rwl-admin-sidebar { background: #20383a; color: #eff4ed; padding: 28px 18px 22px; display: flex; flex-direction: column; }
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
  .rwl-admin-topbar { min-height: 78px; padding: 18px clamp(22px, 4vw, 58px); border-bottom: 1px solid #dce2db; background: rgba(250, 251, 247, .82); display: flex; align-items: center; justify-content: space-between; gap: 18px; }
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
  .rwl-admin-workspace { min-width: 0; display: grid; grid-template-columns: minmax(350px, .8fr) minmax(0, 1.2fr); gap: 15px; }
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
          <button className={`rwl-admin-record ${selectedKey === key ? 'selected' : ''}`} key={key} type="button" onClick={() => onSelect(record)}>
            <span className={`rwl-admin-record-avatar ${record.kind}`}>{record.kind === 'contact' ? <MessageSquare size={16} /> : getInitials(item.name)}</span>
            <span className="rwl-admin-record-copy">
              <span className="rwl-admin-record-line"><span className="rwl-admin-record-name">{item.name}</span><span className="rwl-admin-record-date">{formatDate(item.created_at)}</span></span>
              <span className="rwl-admin-record-meta">{title} · {meta}</span>
              <span className={`rwl-admin-status ${item.status}`}>{formatStatus(item.status)}</span>
            </span>
          </button>
        );
      })}
    </div>
  );
}

function RecordDetail({
  record,
  status,
  notes,
  setStatus,
  setNotes,
  saving,
  saveError,
  saved,
  onSave,
}: {
  record: AdminRecord | null;
  status: ContactStatus | AssessmentStatus;
  notes: string;
  setStatus: (value: ContactStatus | AssessmentStatus) => void;
  setNotes: (value: string) => void;
  saving: boolean;
  saveError: string;
  saved: boolean;
  onSave: () => void;
}) {
  if (!record) {
    return (
      <div className="rwl-admin-empty">
        <div>
          <div className="rwl-admin-empty-icon"><Search size={20} /></div>
          <h3>Select a submission</h3>
          <p>Choose a message or assessment from the list to read the full details.</p>
        </div>
      </div>
    );
  }
  const item = record.item;
  const isContact = record.kind === 'contact';
  const contact = item as ContactSubmission;
  const assessment = item as AssessmentSubmission;
  const statusOptions = isContact ? (['new', 'in_progress', 'resolved'] as ContactStatus[]) : (['new', 'reviewed', 'contacted'] as AssessmentStatus[]);
  return (
    <div className="rwl-admin-detail-body">
      <div className="rwl-admin-detail-identity">
        <div className="rwl-admin-detail-title">
          <div className={`rwl-admin-detail-icon ${record.kind}`}><span>{isContact ? <MessageSquare size={19} /> : <ClipboardList size={19} />}</span></div>
          <div><h2>{item.name}</h2><p>{item.email}</p></div>
        </div>
        <div className="rwl-admin-detail-date"><strong>{isContact ? contact.subject : `${assessment.stream} assessment`}</strong>{formatDate(item.created_at)}</div>
      </div>
      <div className="rwl-admin-detail-grid">
        {isContact ? (
          <div className="rwl-admin-detail-section full"><span className="rwl-admin-detail-label">Message</span><div className="rwl-admin-detail-value">{contact.message}</div></div>
        ) : (
          <>
            <div className="rwl-admin-detail-section"><span className="rwl-admin-detail-label">Student details</span><div className="rwl-admin-detail-value">{assessment.grade} · {assessment.city}<br />{assessment.school}</div></div>
            <div className="rwl-admin-detail-section"><span className="rwl-admin-detail-label">Assessment result</span><div className="rwl-admin-detail-value">{assessment.result || 'No result recorded'}</div></div>
            <div className="rwl-admin-detail-section full"><span className="rwl-admin-detail-label">Answers</span><div className="rwl-admin-answer-list">{Object.keys(assessment.answers).length === 0 ? <div className="rwl-admin-detail-value">No answers recorded.</div> : Object.entries(assessment.answers).map(([key, value]) => <div className="rwl-admin-answer" key={key}><span>{key}</span><strong>{renderAnswer(value)}</strong></div>)}</div></div>
          </>
        )}
        <div className="rwl-admin-detail-section full rwl-admin-edit">
          <div className="rwl-admin-edit-row">
            <div className="rwl-admin-form-field">
              <label htmlFor="submission-status">Status</label>
              <select id="submission-status" value={status} onChange={(event) => setStatus(event.target.value as ContactStatus | AssessmentStatus)}>
                {statusOptions.map((option) => <option key={option} value={option}>{formatStatus(option)}</option>)}
              </select>
            </div>
            <div className="rwl-admin-form-field">
              <label htmlFor="submission-notes">Private notes</label>
              <textarea id="submission-notes" value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="Add a note for your team…" />
            </div>
            <button className="rwl-admin-button" type="button" disabled={saving} onClick={onSave}><Save size={14} /> {saving ? 'Saving…' : 'Save changes'}</button>
          </div>
          {saveError && <div className="rwl-admin-inline-feedback error"><AlertCircle size={14} /> {saveError}</div>}
          {saved && !saveError && <div className="rwl-admin-inline-feedback"><CheckCircle2 size={14} /> Changes saved for your team.</div>}
        </div>
      </div>
    </div>
  );
}

type SettingEntry = { id: string; key: string; value: string };

function SettingsPanel({
  entries,
  setEntries,
  loading,
  saving,
  error,
  saved,
  onSave,
  onRetry,
}: {
  entries: SettingEntry[];
  setEntries: (entries: SettingEntry[]) => void;
  loading: boolean;
  saving: boolean;
  error: string;
  saved: boolean;
  onSave: () => void;
  onRetry: () => void;
}) {
  if (loading) return <div className="rwl-admin-detail-skeleton" aria-label="Loading settings" />;
  if (error) {
    return <div className="rwl-admin-error"><div><div className="rwl-admin-error-icon"><AlertCircle size={20} /></div><h3>Settings could not load</h3><p>{error}</p><button className="rwl-admin-button" type="button" onClick={onRetry}><RefreshCw size={14} /> Try again</button></div></div>;
  }
  return (
    <div className="rwl-admin-settings">
      <div className="rwl-admin-settings-intro">
        <div><h2>Workspace settings</h2><p>Keep the small operational details in one place. Changes apply to the public experience wherever these settings are used.</p></div>
        <SlidersHorizontal size={21} color="#6e8d80" />
      </div>
      {entries.length === 0 ? (
        <div className="rwl-admin-empty" style={{ minHeight: 220, padding: 0 }}><div><div className="rwl-admin-empty-icon"><Settings size={20} /></div><h3>No settings returned</h3><p>There are no editable settings available yet.</p></div></div>
      ) : (
        <div className="rwl-admin-setting-list">
          {entries.map((entry) => (
            <div className="rwl-admin-setting-row" key={entry.id}>
              <div className="rwl-admin-setting-key">{entry.key || 'new_setting'}</div>
              <input className="rwl-admin-setting-input" aria-label={`Value for ${entry.key || 'new setting'}`} value={entry.value} onChange={(event) => setEntries(entries.map((current) => current.id === entry.id ? { ...current, value: event.target.value } : current))} />
              <button className="rwl-admin-icon-button" type="button" aria-label={`Remove ${entry.key || 'setting'}`} onClick={() => setEntries(entries.filter((current) => current.id !== entry.id))}><Trash2 size={14} /></button>
            </div>
          ))}
        </div>
      )}
      <div className="rwl-admin-settings-actions">
        <button className="rwl-admin-button secondary" type="button" onClick={() => setEntries([...entries, { id: `new-${Date.now()}`, key: '', value: '' }])}><Plus size={14} /> Add setting</button>
        <button className="rwl-admin-button" type="button" disabled={saving || entries.length === 0} onClick={onSave}><Save size={14} /> {saving ? 'Saving…' : 'Save settings'}</button>
      </div>
      {error && <div className="rwl-admin-inline-feedback error"><AlertCircle size={14} /> {error}</div>}
      {saved && !error && <div className="rwl-admin-inline-feedback"><Check size={14} /> Settings saved.</div>}
    </div>
  );
}

function AdminWorkspace({ adminEmail, onLogout }: { adminEmail: string; onLogout: () => void }) {
  const [tab, setTab] = useState<WorkspaceTab>('submissions');
  const [filter, setFilter] = useState<SubmissionFilter>('all');
  const [contacts, setContacts] = useState<ContactSubmission[]>([]);
  const [assessments, setAssessments] = useState<AssessmentSubmission[]>([]);
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [status, setStatus] = useState<ContactStatus | AssessmentStatus>('new');
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [saved, setSaved] = useState(false);
  const [settingsEntries, setSettingsEntries] = useState<SettingEntry[]>([]);
  const [settingsLoading, setSettingsLoading] = useState(true);
  const [settingsSaving, setSettingsSaving] = useState(false);
  const [settingsError, setSettingsError] = useState('');
  const [settingsSaved, setSettingsSaved] = useState(false);

  const records = useMemo<AdminRecord[]>(() => [
    ...contacts.map((item) => ({ kind: 'contact' as const, item })),
    ...assessments.map((item) => ({ kind: 'assessment' as const, item })),
  ].sort((a, b) => new Date(b.item.created_at).getTime() - new Date(a.item.created_at).getTime()), [contacts, assessments]);
  const selectedRecord = useMemo(() => records.find((record) => `${record.kind}-${record.item.id}` === selectedKey) ?? null, [records, selectedKey]);

  const loadSubmissions = useCallback(async () => {
    setLoading(true);
    setLoadError('');
    try {
      const response = await api.get<SubmissionsResponse>(`/api/admin/submissions?type=${filter}`);
      setContacts(response.contacts ?? []);
      setAssessments(response.assessments ?? []);
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : 'Submissions could not load.');
    } finally {
      setLoading(false);
    }
  }, [filter]);

  const loadSettings = useCallback(async () => {
    setSettingsLoading(true);
    setSettingsError('');
    try {
      const response = await api.get<SettingsResponse>('/api/admin/settings');
      setSettingsEntries(Object.entries(response.settings ?? {}).map(([key, value]) => ({ id: key, key, value })));
    } catch (error) {
      setSettingsError(error instanceof Error ? error.message : 'Settings could not load.');
    } finally {
      setSettingsLoading(false);
    }
  }, []);

  useEffect(() => { void loadSubmissions(); }, [loadSubmissions]);
  useEffect(() => { void loadSettings(); }, [loadSettings]);
  useEffect(() => {
    if (selectedRecord) {
      setStatus(selectedRecord.item.status);
      setNotes(selectedRecord.item.notes ?? '');
      setSaveError('');
      setSaved(false);
    } else if (records.length > 0) {
      const first = records[0];
      setSelectedKey(`${first.kind}-${first.item.id}`);
    }
  }, [records, selectedRecord]);

  const saveRecord = async () => {
    if (!selectedRecord) return;
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
      setSaved(true);
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : 'Changes could not be saved.');
    } finally {
      setSaving(false);
    }
  };

  const saveSettings = async () => {
    const settings: Record<string, string> = {};
    settingsEntries.forEach((entry) => {
      const key = entry.key.trim();
      if (key) settings[key] = entry.value;
    });
    setSettingsSaving(true);
    setSettingsError('');
    setSettingsSaved(false);
    try {
      const response = await api.put<SettingsResponse>('/api/admin/settings', { settings });
      setSettingsEntries(Object.entries(response.settings ?? settings).map(([key, value]) => ({ id: key, key, value })));
      setSettingsSaved(true);
    } catch (error) {
      setSettingsError(error instanceof Error ? error.message : 'Settings could not be saved.');
    } finally {
      setSettingsSaving(false);
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
          <button className={`rwl-admin-nav-button ${tab === 'submissions' ? 'active' : ''}`} type="button" onClick={() => setTab('submissions')}><LayoutDashboard size={17} /><span>Submissions</span></button>
          <button className={`rwl-admin-nav-button ${tab === 'settings' ? 'active' : ''}`} type="button" onClick={() => setTab('settings')}><Settings size={17} /><span>Settings</span></button>
        </nav>
        <div className="rwl-admin-sidebar-foot"><small>Signed in as</small><strong>{adminEmail}</strong></div>
      </aside>
      <div className="rwl-admin-main">
        <header className="rwl-admin-topbar">
          <div><div className="rwl-admin-topbar-kicker">Real World Link · Private workspace</div><div className="rwl-admin-topbar-title">{tab === 'submissions' ? 'Submission desk' : 'Workspace settings'}</div></div>
          <div className="rwl-admin-topbar-actions">
            {tab === 'submissions' && <button className="rwl-admin-icon-button" type="button" aria-label="Refresh submissions" onClick={() => void loadSubmissions()}><RefreshCw size={15} /></button>}
            <button className="rwl-admin-logout" type="button" onClick={onLogout}><LogOut size={14} /><span>Sign out</span></button>
          </div>
        </header>
        <main className="rwl-admin-content">
          {tab === 'submissions' ? (
            <>
              <section className="rwl-admin-overview">
                <div><h1>Keep curiosity moving.</h1><p>Review what students are asking, notice where they may need a little more context and give every message the attention it deserves.</p></div>
                <div className="rwl-admin-overview-note"><Clock3 size={15} /> A human inbox, not a queue.</div>
              </section>
              <section className="rwl-admin-stat-grid" aria-label="Submission summary">
                <div className="rwl-admin-stat primary"><span className="rwl-admin-stat-label"><ClipboardList size={14} /> All submissions</span><strong className="rwl-admin-stat-value">{loading ? '—' : total}</strong></div>
                <div className="rwl-admin-stat"><span className="rwl-admin-stat-label"><Mail size={14} /> Contact messages</span><strong className="rwl-admin-stat-value">{loading ? '—' : contacts.length}</strong></div>
                <div className="rwl-admin-stat"><span className="rwl-admin-stat-label"><FileText size={14} /> Assessments</span><strong className="rwl-admin-stat-value">{loading ? '—' : assessments.length}</strong></div>
                <div className="rwl-admin-stat"><span className="rwl-admin-stat-label"><AlertCircle size={14} /> Need attention</span><strong className="rwl-admin-stat-value">{loading ? '—' : newCount}</strong></div>
              </section>
              <section className="rwl-admin-workspace">
                <div className="rwl-admin-panel">
                  <div className="rwl-admin-panel-head"><div><h2>Recent submissions</h2><p>{loading ? 'Gathering the latest entries…' : `${records.length} shown in this view`}</p></div><UserRound size={18} color="#739287" /></div>
                  <div className="rwl-admin-filter-bar" aria-label="Submission filters">
                    {(['all', 'contact', 'assessment'] as SubmissionFilter[]).map((option) => <button className={`rwl-admin-filter ${filter === option ? 'active' : ''}`} key={option} type="button" onClick={() => setFilter(option)}>{option === 'all' ? 'All' : option === 'contact' ? 'Contacts' : 'Assessments'}</button>)}
                  </div>
                  {loading ? <LoadingList /> : loadError ? <div className="rwl-admin-error"><div><div className="rwl-admin-error-icon"><AlertCircle size={20} /></div><h3>Submissions could not load</h3><p>{loadError}</p><button className="rwl-admin-button" type="button" onClick={() => void loadSubmissions()}><RefreshCw size={14} /> Try again</button></div></div> : <RecordList records={records} selectedKey={selectedKey} onSelect={(record) => setSelectedKey(`${record.kind}-${record.item.id}`)} />}
                </div>
                <div className="rwl-admin-panel rwl-admin-detail">
                  <div className="rwl-admin-panel-head"><div><h2>Submission details</h2><p>Read closely, then leave a useful next step.</p></div><FileText size={18} color="#739287" /></div>
                  {loading ? <div className="rwl-admin-detail-skeleton" /> : <RecordDetail record={selectedRecord} status={status} notes={notes} setStatus={setStatus} setNotes={setNotes} saving={saving} saveError={saveError} saved={saved} onSave={() => void saveRecord()} />}
                </div>
              </section>
            </>
          ) : (
            <section className="rwl-admin-panel"><SettingsPanel entries={settingsEntries} setEntries={setSettingsEntries} loading={settingsLoading} saving={settingsSaving} error={settingsError} saved={settingsSaved} onSave={() => void saveSettings()} onRetry={() => void loadSettings()} /></section>
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