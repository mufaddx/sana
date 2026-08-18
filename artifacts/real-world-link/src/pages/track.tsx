import { type FormEvent, useCallback, useEffect, useState } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  Award,
  Check,
  CheckCircle2,
  Home,
  MessageSquare,
  Package,
  PhoneCall,
  Send,
  Truck,
} from 'lucide-react';
import { Link } from 'wouter';
import {
  type BoxStatus,
  boxStatusLabels,
  boxStepIndex,
  boxSteps,
  careerProfiles,
  formatDate,
} from '@/data/career-profiles';

const STORAGE_KEY = 'rwl_tracking_code';

type Dashboard = {
  name: string;
  stream: string;
  result: string | null;
  trackingCode: string;
  box: {
    status: BoxStatus;
    dispatchedAt: string | null;
    expectedDeliveryOn: string | null;
    deliveredAt: string | null;
  };
  address: { line: string; city: string; state: string; pincode: string; phone: string };
  mentor: { name: string; phone: string };
  challenge: { notes: string | null; submittedAt: string | null; feedback: string | null; feedbackAt: string | null };
};

const stepIcons = [Check, Package, Truck, Home];

function Brand() {
  return (
    <span className="brand-mark">
      <span className="brand-word">REAL WORLD LINK</span>
      <span className="brand-sub">IN SHORTS BY AAFIYA &amp; SANA</span>
    </span>
  );
}

function digitsOnly(value: string) {
  return value.replace(/[^\d]/g, '');
}

export default function TrackPage() {
  const [code, setCode] = useState('');
  const [data, setData] = useState<Dashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');

  const load = useCallback(async (value: string, { remember = true } = {}) => {
    setLoading(true);
    setError('');
    try {
      const response = await fetch(`/api/public/track/${encodeURIComponent(value)}`);
      const body = await response.json().catch(() => null);
      if (!response.ok) throw new Error(typeof body?.message === 'string' ? body.message : 'That code could not be opened.');
      setData(body as Dashboard);
      setNotes((body as Dashboard).challenge.notes ?? '');
      if (remember) window.localStorage.setItem(STORAGE_KEY, value);
    } catch (caught) {
      setData(null);
      setError(caught instanceof Error ? caught.message : 'That code could not be opened.');
      window.localStorage.removeItem(STORAGE_KEY);
    } finally {
      setLoading(false);
    }
  }, []);

  // A code can arrive from the email link (?code=…) or from a previous visit.
  useEffect(() => {
    const fromUrl = new URLSearchParams(window.location.search).get('code');
    const saved = window.localStorage.getItem(STORAGE_KEY);
    const initial = fromUrl || saved;
    if (!initial) {
      setLoading(false);
      return;
    }
    setCode(initial);
    void load(initial);
  }, [load]);

  const openCode = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const trimmed = code.trim();
    if (!trimmed) return setError('Enter the tracking code from your email.');
    void load(trimmed);
  };

  const submitChallenge = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!data) return;
    setSubmitting(true);
    setSubmitError('');
    try {
      const response = await fetch(`/api/public/track/${encodeURIComponent(data.trackingCode)}/challenge`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ notes }),
      });
      const body = await response.json().catch(() => null);
      if (!response.ok) throw new Error(typeof body?.message === 'string' ? body.message : 'Your notes could not be saved.');
      await load(data.trackingCode);
    } catch (caught) {
      setSubmitError(caught instanceof Error ? caught.message : 'Your notes could not be saved.');
    } finally {
      setSubmitting(false);
    }
  };

  const signOut = () => {
    window.localStorage.removeItem(STORAGE_KEY);
    window.history.replaceState(null, '', window.location.pathname);
    setData(null);
    setCode('');
    setError('');
  };

  return (
    <div className="assessment-shell">
      <header className="assessment-header">
        <div className="container-rwl assessment-header-inner">
          <Link href="/" data-testid="link-track-brand"><Brand /></Link>
          {data ? (
            <button className="button-secondary" onClick={signOut} data-testid="button-track-signout">Sign out</button>
          ) : (
            <Link href="/" className="button-secondary" data-testid="link-track-home"><ArrowLeft size={15} /> Back to home</Link>
          )}
        </div>
      </header>
      <main className="assessment-main">
        {loading && <div className="assessment-intro"><h1>Opening your dashboard…</h1></div>}

        {!loading && !data && (
          <div className="assessment-page reveal">
            <div className="eyebrow">Your Linking Box</div>
            <h1>Track your box.</h1>
            <p>Enter the tracking code we emailed you after your assessment. It opens your personal dashboard.</p>
            <form className="info-form" onSubmit={openCode}>
              <div className="field">
                <label htmlFor="tracking-code">Tracking code</label>
                <input
                  id="tracking-code"
                  value={code}
                  onChange={(event) => setCode(event.target.value)}
                  placeholder="Paste your code here"
                  autoComplete="off"
                  data-testid="input-tracking-code"
                />
              </div>
              {error && <div className="error-text" role="alert" data-testid="text-track-error">{error}</div>}
              <div className="assessment-actions">
                <Link href="/" className="button-secondary" data-testid="link-track-cancel">Cancel</Link>
                <button className="button-primary" type="submit" data-testid="button-open-dashboard">Open dashboard <ArrowRight size={16} /></button>
              </div>
            </form>
          </div>
        )}

        {!loading && data && <DashboardView data={data} notes={notes} setNotes={setNotes} onSubmit={submitChallenge} submitting={submitting} submitError={submitError} />}
      </main>
    </div>
  );
}

function DashboardView({
  data,
  notes,
  setNotes,
  onSubmit,
  submitting,
  submitError,
}: {
  data: Dashboard;
  notes: string;
  setNotes: (value: string) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  submitting: boolean;
  submitError: string;
}) {
  const profile = data.result ? careerProfiles[data.result] : undefined;
  const activeIndex = boxStepIndex(data.box.status);
  const expected = formatDate(data.box.expectedDeliveryOn);
  const dispatched = formatDate(data.box.dispatchedAt);
  const delivered = formatDate(data.box.deliveredAt);
  const mentorName = data.mentor.name || 'Aafiya & Sana';
  const mentorPhone = data.mentor.phone;
  const firstName = data.name.split(' ')[0] || 'student';
  const submittedOn = formatDate(data.challenge.submittedAt);

  return (
    <div className="dashboard reveal">
      <div className="eyebrow">Your Linking Box</div>
      <h1>Welcome back, {firstName}.</h1>
      <p>Track your box, read your challenge and turn in what you find.</p>

      {/* Career profile */}
      <section className="dash-card">
        <h2 className="dash-card-title">Your career field</h2>
        {data.result ? (
          <>
            <div className="dash-result">{data.result}</div>
            {profile && <blockquote className="dash-quote">{profile.profile}</blockquote>}
          </>
        ) : (
          <p className="dash-muted">Your result is being recorded.</p>
        )}
        <div className="dash-meta"><span>Stream</span><strong>{data.stream}</strong></div>
      </section>

      {/* Delivery tracker */}
      <section className="dash-card">
        <div className="dash-card-head">
          <h2 className="dash-card-title">Linking Box delivery</h2>
          <span className={`box-pill box-${data.box.status}`}>{boxStatusLabels[data.box.status]}</span>
        </div>
        <ol className="box-tracker">
          {boxSteps.map((step, index) => {
            const Icon = stepIcons[index];
            const state = index < activeIndex ? 'done' : index === activeIndex ? 'current' : 'todo';
            return (
              <li className={`box-step ${state}`} key={step.key}>
                <span className="box-node"><Icon size={16} /></span>
                <span className="box-label">{step.label}</span>
              </li>
            );
          })}
        </ol>
        <p className="dash-muted">{boxSteps[activeIndex].copy}</p>
        <div className="dash-facts">
          {dispatched && <div className="dash-fact"><span>Dispatched on</span><strong>{dispatched}</strong></div>}
          {expected && data.box.status !== 'delivered' && (
            <div className="dash-fact"><span>Expected delivery</span><strong>{expected}</strong></div>
          )}
          {delivered && <div className="dash-fact"><span>Delivered on</span><strong>{delivered}</strong></div>}
          {!dispatched && !expected && <div className="dash-fact"><span>Expected delivery</span><strong>Shared once your box is packed</strong></div>}
        </div>
        <div className="dash-address">
          <span>Delivering to</span>
          <strong>{[data.address.line, data.address.city, data.address.state, data.address.pincode].filter(Boolean).join(', ')}</strong>
          {data.address.phone && <span className="dash-muted">Phone: {data.address.phone}</span>}
        </div>
      </section>

      {/* Assigned mentor */}
      <section className="dash-card mentor-card">
        <h2 className="dash-card-title">Your assigned mentor</h2>
        <div className="mentor-name">{mentorName}</div>
        <div className="dash-muted">Real World Link mentor team</div>
        {mentorPhone ? (
          <div className="mentor-actions">
            <a className="button-primary" href={`tel:${digitsOnly(mentorPhone)}`} data-testid="link-mentor-call">
              <PhoneCall size={15} /> Call {mentorPhone}
            </a>
            <a className="button-secondary" href={`https://wa.me/${digitsOnly(mentorPhone)}`} target="_blank" rel="noreferrer" data-testid="link-mentor-whatsapp">
              <MessageSquare size={15} /> WhatsApp
            </a>
          </div>
        ) : (
          <p className="dash-muted">Your mentor&rsquo;s contact details will appear here once they are assigned.</p>
        )}
      </section>

      {/* Practical challenge */}
      {profile && (
        <section className="dash-card">
          <div className="dash-card-head">
            <h2 className="dash-card-title">Your practical challenge</h2>
            <span className="domain-tag">{profile.domainTag}</span>
          </div>
          <h3 className="challenge-title">{profile.challengeTitle}</h3>
          <p>{profile.challengeDescription}</p>

          {data.box.status === 'delivered' ? (
            <form className="challenge-form" onSubmit={onSubmit}>
              <div className="field">
                <label htmlFor="challenge-notes">Observations &amp; reflection notes</label>
                <textarea
                  id="challenge-notes"
                  value={notes}
                  onChange={(event) => setNotes(event.target.value)}
                  rows={5}
                  required
                  placeholder="What did you try, what did you notice, and what surprised you?"
                  data-testid="input-challenge-notes"
                />
              </div>
              {submitError && <div className="error-text" role="alert" data-testid="text-challenge-error">{submitError}</div>}
              <button className="button-primary" type="submit" disabled={submitting} data-testid="button-submit-challenge">
                <Send size={15} /> {submitting ? 'Saving…' : submittedOn ? 'Update my notes' : 'Turn in challenge'}
              </button>
              {submittedOn && (
                <p className="dash-muted challenge-submitted">
                  <CheckCircle2 size={14} /> Turned in on {submittedOn}
                </p>
              )}
            </form>
          ) : (
            <p className="dash-muted challenge-locked">
              You can turn in your notes once your Linking Box has been delivered.
            </p>
          )}
        </section>
      )}

      {/* Skill badges */}
      {profile && (
        <section className="dash-card">
          <h2 className="dash-card-title">Skill badges</h2>
          <p className="dash-muted">Earned when your mentor reviews your challenge.</p>
          <div className="badge-row">
            {profile.badges.map((badge) => (
              <div className={`badge ${data.challenge.feedback ? 'earned' : ''}`} key={badge}>
                <Award size={19} />
                <span>{badge}</span>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Mentor feedback */}
      <section className="dash-card">
        <h2 className="dash-card-title">Mentor feedback</h2>
        {data.challenge.feedback ? (
          <>
            <blockquote className="dash-quote">{data.challenge.feedback}</blockquote>
            {formatDate(data.challenge.feedbackAt) && (
              <div className="dash-muted">Shared on {formatDate(data.challenge.feedbackAt)}</div>
            )}
          </>
        ) : (
          <p className="dash-muted">No feedback yet. Your mentor will reply here after you turn in your challenge.</p>
        )}
      </section>

      <div className="dash-code">
        <span>Your tracking code</span>
        <code data-testid="text-tracking-code">{data.trackingCode}</code>
        <span className="dash-muted">Keep this private — anyone with this code can open your dashboard.</span>
      </div>
    </div>
  );
}
