import { type FormEvent, useEffect, useState } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ArrowLeft, ArrowRight, ArrowUp, Brain, BriefcaseBusiness, Check, CheckCircle2, ChevronDown, CircleHelp, ClipboardCheck, Cpu, FlaskConical, Gauge, Globe2, GraduationCap, Lightbulb, Mail, Menu, Radar, Scale, Search, Send, ShieldCheck, Sparkles, Target, Users, X, Zap } from 'lucide-react';
import { Link, Route, Switch, Router as WouterRouter, useLocation } from 'wouter';
import { ErrorBoundary } from '@/components/error-boundary';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import studentPhoto from '@assets/ChatGPT_Image_Aug_16,_2026,_11_58_09_PM_1786916532910.png';

const queryClient = new QueryClient();

type CareerField = {
  id: string;
  title: string;
  description: string;
  careers: string[];
  interests: string[];
  icon: typeof FlaskConical;
};

const careerFields: CareerField[] = [
  { id: 'science', title: 'Science & Healthcare', description: 'For students drawn to evidence, living systems and the questions that make the world healthier.', careers: ['Forensic Science', 'Medicine & Pathology', 'Biotechnology & Research'], interests: ['Scientific evidence', 'Diagnosis', 'Laboratory work', 'Research'], icon: FlaskConical },
  { id: 'technology', title: 'Engineering & Technology', description: 'For curious builders who want to understand systems, create solutions and shape what comes next.', careers: ['AI & Robotics Engineering', 'Architecture & Spatial Design', 'Physical Research & Engineering'], interests: ['Algorithms', 'Design', 'Sensors', 'Energy'], icon: Cpu },
  { id: 'commerce', title: 'Commerce & Business', description: 'For analytical and enterprising minds interested in decisions, value and how ideas become real ventures.', careers: ['Chartered Accountancy', 'Business & Entrepreneurship', 'Financial Analytics'], interests: ['Financial markets', 'Leadership', 'Risk', 'Modelling'], icon: BriefcaseBusiness },
  { id: 'humanities', title: 'Humanities & Social Sciences', description: 'For people who notice patterns in society, ask thoughtful questions and care about how communities work.', careers: ['Psychology & Behavioral Science', 'IAS & Public Policy', 'Political Science & Geography'], interests: ['Human behaviour', 'Government', 'GIS', 'Social issues'], icon: Globe2 },
];

type Stream = 'PCB' | 'PCM' | 'Commerce' | 'Humanities';
type Option = { text: string; career: string };
type Question = { prompt: string; options: Option[] };
type StudentInfo = { name: string; email: string; grade: string; city: string; school: string; consent: boolean };

const streamDetails: Record<Stream, { description: string; icon: typeof FlaskConical; field: CareerField }> = {
  PCB: { description: 'Life sciences, health and scientific discovery', icon: FlaskConical, field: careerFields[0] },
  PCM: { description: 'Mathematics, systems and inventive problem-solving', icon: Cpu, field: careerFields[1] },
  Commerce: { description: 'Business, numbers and decisions with real-world impact', icon: BriefcaseBusiness, field: careerFields[2] },
  Humanities: { description: 'People, society, policy and the places we share', icon: Globe2, field: careerFields[3] },
};

const streamPrompts: Record<Stream, string[]> = {
  PCB: ['A mystery needs careful scientific evidence. Which part would you want to lead?', 'Which kind of problem feels most rewarding to untangle?', 'In a laboratory, what would you be happiest to learn?', 'Which moment in healthcare or science catches your attention?', 'What would you rather investigate deeply?', 'Which tool or setting sounds most interesting?', 'When evidence is incomplete, what is your instinct?', 'What kind of research question would you keep returning to?', 'Which subject would you happily spend extra time with?', 'What does a good diagnosis require most?', 'Which contribution to a team feels natural to you?', 'What makes scientific work meaningful?', 'Which discovery would you like to understand better?', 'What do you value when handling sensitive information?', 'Which project would you choose for a school showcase?', 'What kind of progress excites you?', 'Which skill would you like to strengthen?', 'Where would you feel most at home?', 'What future possibility feels worth exploring?'],
  PCM: ['A machine has a problem. Which part would you want to solve first?', 'Which technology would you enjoy understanding from the inside?', 'What kind of making feels most satisfying?', 'Which space would you like to design or improve?', 'When a system behaves unexpectedly, what do you do?', 'Which subject connection feels most exciting?', 'What would you build with a kit of sensors?', 'Which kind of research would hold your attention?', 'What is your favorite part of a technical project?', 'Which question about energy interests you most?', 'How do you prefer to approach a complex challenge?', 'Which project would you take to a showcase?', 'What makes a design feel successful?', 'What kind of work would you do for hours?', 'Which tool feels most natural to you?', 'What would you like to understand more clearly?', 'What type of team role suits you?', 'Which change would you like technology to make?', 'Where would you like your curiosity to lead?'],
  Commerce: ['A new venture needs its first strong decision. Where would you begin?', 'Which numbers would you enjoy making sense of?', 'What kind of business question makes you curious?', 'Which part of a company would you want to understand?', 'When a decision carries risk, what helps you move forward?', 'What makes a business idea worth exploring?', 'Which task sounds most satisfying?', 'What would you like to learn about markets?', 'Which school project would you choose?', 'What does responsible finance require?', 'Which kind of impact would you like your work to have?', 'What makes a leader trustworthy?', 'Which pattern would you look for in a business?', 'What would you rather improve?', 'Which subject would you happily go deeper into?', 'How do you prefer to work with a team?', 'Which future possibility sounds most like you?', 'What does good planning make possible?', 'Where would you like your curiosity to lead?'],
  Humanities: ['A community question needs careful listening. Where would you start?', 'Which part of human behaviour would you enjoy understanding?', 'What kind of public question holds your attention?', 'Which place or map would you want to explore?', 'When people disagree, what would you want to understand first?', 'What makes a policy thoughtful?', 'Which subject would you choose for deeper study?', 'What kind of social change interests you?', 'Which project would you take to a showcase?', 'What helps communities work better?', 'Which role in a team feels most natural?', 'What would you like to make clearer for others?', 'Which global topic would you follow?', 'What makes research about people responsible?', 'Which setting sounds most meaningful?', 'What kind of problem would you like to help solve?', 'Which skill would you like to strengthen?', 'What does a fair decision require?', 'Where would you like your curiosity to lead?'],
};

const streamOptions: Record<Stream, string[][]> = {
  PCB: [
    ['Reconstruct the story from scientific evidence', 'Understand symptoms and possible diagnoses', 'Explore the biology behind what happened', 'Run careful tests in the laboratory'],
    ['Finding the clue others missed', 'Understanding a patient’s condition', 'Exploring cells and living systems', 'Testing a clear scientific hypothesis'],
    ['Forensic instruments and evidence', 'Diagnostic tools and medical imaging', 'Microscopes and biological samples', 'Precise lab equipment and protocols'],
    ['How evidence can reveal truth', 'How medicine can improve a life', 'How biology can solve a problem', 'How research can open a new door'],
    ['A complex investigation', 'A challenging medical case', 'A new biotech question', 'A careful research study'],
  ],
  PCM: [
    ['Trace the logic in the algorithm', 'Prototype a robot that responds to its world', 'Design a space people would love to use', 'Understand the physics behind the system'],
    ['Machine learning and AI', 'Robotics and microcontrollers', 'Architecture and spatial design', 'Physics, energy and engineering'],
    ['Writing and refining a model', 'Connecting sensors and mechanisms', 'Sketching, testing and shaping', 'Measuring, calculating and explaining'],
    ['What the system is trying to do', 'How the machine senses its environment', 'How people move through a space', 'Why the physical result behaves that way'],
    ['A technical puzzle', 'A working prototype', 'A thoughtful blueprint', 'An experiment with a clear principle'],
  ],
  Commerce: [
    ['Make the accounts clear and reliable', 'Shape the idea into a viable venture', 'Study the numbers behind a decision', 'Understand the risk before acting'],
    ['Accounting and audit', 'Entrepreneurship and leadership', 'Markets and financial modelling', 'Investment and risk'],
    ['Spotting a pattern in a ledger', 'Turning an idea into a plan', 'Comparing options with evidence', 'Planning for different outcomes'],
    ['How value moves through a business', 'Why customers choose an idea', 'How markets respond to change', 'How responsible choices manage risk'],
    ['An audit trail', 'A business pitch', 'A financial model', 'An investment case'],
  ],
  Humanities: [
    ['Understand the person behind the behaviour', 'Study a policy and its consequences', 'Explore how government decisions are made', 'Map the place and people involved'],
    ['Psychology and human behaviour', 'IAS and public administration', 'Political science and government', 'Geography, GIS and place'],
    ['Listening for the pattern in a story', 'Reading a public problem carefully', 'Comparing perspectives and institutions', 'Layering information on a map'],
    ['What shapes a person’s choices', 'What makes a policy fair', 'How public institutions work', 'How a place changes over time'],
    ['A behaviour study', 'A policy brief', 'A civic research project', 'A map-based investigation'],
  ],
};

function buildQuestions(stream: Stream): Question[] {
  const careers = streamDetails[stream].field.careers;
  return streamPrompts[stream].map((prompt, index) => {
    const set = streamOptions[stream][index % streamOptions[stream].length];
    return { prompt, options: careers.map((career, careerIndex) => ({ career, text: set[careerIndex] })) };
  });
}

function Brand({ inverse = false }: { inverse?: boolean }) {
  return <span className={`brand-mark ${inverse ? 'brand-inverse' : ''}`}><span className="brand-word">REAL WORLD LINK</span><span className="brand-sub">IN SHORTS BY AAFIYA &amp; SANA</span></span>;
}

function Header() {
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [, setLocation] = useLocation();
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12);
    window.addEventListener('scroll', onScroll);
    return () => window.removeEventListener('scroll', onScroll);
  }, []);
  useEffect(() => {
    document.body.style.overflow = menuOpen ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [menuOpen]);
  const goAssessment = () => { setMenuOpen(false); setLocation('/assessment'); window.scrollTo({ top: 0, behavior: 'smooth' }); };
  const links = [['How It Works', '#how-it-works'], ['Career Fields', '#career-fields'], ['About', '#about'], ['FAQ', '#faq'], ['Contact', '#contact']];
  return <header className={`topbar ${scrolled ? 'scrolled' : ''}`}><div className="container-rwl nav-inner">
    <a href="#top" className="brand-mark" data-testid="link-brand"><Brand /></a>
    <nav className="nav-links" aria-label="Primary navigation">{links.map(([label, href]) => <a className="nav-link" href={href} key={href} data-testid={`link-${label.toLowerCase().replaceAll(' ', '-')}`}>{label}</a>)}</nav>
    <button className="nav-cta" onClick={goAssessment} data-testid="button-nav-assessment">Start Assessment <ArrowRight size={16} /></button>
    <button className="menu-toggle" onClick={() => setMenuOpen((value) => !value)} aria-label={menuOpen ? 'Close menu' : 'Open menu'} data-testid="button-mobile-menu">{menuOpen ? <X size={20} /> : <Menu size={20} />}</button>
  </div>
  {menuOpen && <><div className="mobile-menu-backdrop" onClick={() => setMenuOpen(false)} aria-hidden="true" /><nav className="mobile-menu" aria-label="Mobile navigation">{links.map(([label, href]) => <a href={href} onClick={() => setMenuOpen(false)} key={href} data-testid={`mobile-link-${label.toLowerCase().replaceAll(' ', '-')}`}>{label}</a>)}<button className="mobile-menu-cta" onClick={goAssessment} data-testid="button-mobile-assessment">Start Assessment <ArrowRight size={16} /></button></nav></>}
  </header>;
}

function Home() {
  const [intro, setIntro] = useState(true);
  const [selectedField, setSelectedField] = useState<CareerField | null>(null);
  const [faqOpen, setFaqOpen] = useState<number | null>(0);
  const [contactSent, setContactSent] = useState(false);
  const [showTop, setShowTop] = useState(false);
  useEffect(() => {
    const timer = window.setTimeout(() => setIntro(false), 1300);
    const onScroll = () => setShowTop(window.scrollY > 600);
    window.addEventListener('scroll', onScroll);
    return () => { window.clearTimeout(timer); window.removeEventListener('scroll', onScroll); };
  }, []);
  const handleContact = (event: FormEvent<HTMLFormElement>) => { event.preventDefault(); setContactSent(true); };
  const faqs = [
    ['What is Real World Link?', 'Real World Link is a student-friendly career-discovery space from In Shorts by Aafiya & Sana. It helps you connect what interests you with possible career directions.'],
    ['Who can take the assessment?', 'Students exploring their next academic or career direction can take it. You do not need to have a final answer before you begin.'],
    ['How long does the assessment take?', 'Most students can move through the 20-question experience in around 5–8 minutes.'],
    ['How does the assessment work?', 'You choose a broad stream, answer questions about the kind of work and ideas that interest you, then receive a best-fit career field to explore.'],
    ['How is the best-fit field selected?', 'Your responses are connected to the career examples within your selected stream. The result reflects patterns in your answers, not a fixed prediction.'],
    ['Is the result guaranteed?', 'No. It is a starting point for career exploration, not a guarantee, diagnosis or final decision about your future.'],
    ['What happens after submission?', 'You can read your result and possible directions, then decide what to research, discuss or try next.'],
    ['Is my information safe?', 'We only ask for the details needed for this public experience. Read our Privacy Policy for how information is treated.'],
  ];
  if (intro) return <div className="intro-screen"><div className="intro-content"><div className="intro-rule" /><p>REAL WORLD LINK</p><span>IN SHORTS BY AAFIYA &amp; SANA</span><strong>Discover Your Potential.<br />Find Your Path.</strong></div></div>;
  return <div className="site-shell" id="top"><Header />
    <main>
       <section className="hero"><div className="container-rwl hero-grid"><div className="reveal"><h1>Discover your potential.<br /><em>Find your path.</em></h1><p className="hero-copy">Explore your interests, understand your strengths and discover career fields that may be a strong fit for you.</p><div className="hero-actions"><Link href="/assessment" className="button-primary" data-testid="link-hero-assessment">Start Your Assessment <ArrowRight size={16} /></Link><a href="#career-fields" className="button-secondary" data-testid="link-hero-fields">Explore Career Fields</a></div><div className="hero-note"><ShieldCheck size={15} /> A thoughtful starting point, never a promise about your future.</div></div><div className="hero-visual reveal"><div className="visual-main photo-main"><img src={studentPhoto} alt="Student exploring her future path" className="hero-student-photo" /></div><div className="visual-card top"><span className="card-label">Your next question</span><strong>What makes you curious?</strong></div><div className="visual-card bottom"><span className="card-label">Career discovery</span><strong>Based on your interests</strong><div className="mini-path"><i /><i /><i /></div></div></div></div></section>
      <section className="value-strip"><div className="container-rwl value-grid">{[[GraduationCap, 'Student-focused'], [Search, 'Career exploration'], [ClipboardCheck, 'Simple assessment'], [Radar, 'Future-oriented']].map(([Icon, label], index) => <div className="value-item" key={label as string} data-testid={`value-${index}`}><Icon size={17} /><span>{label as string}</span></div>)}</div></section>
      <section className="section" id="about"><div className="container-rwl split-grid"><div className="about-visual"><div className="about-panel"><div className="about-panel-line" /><div className="about-panel-line short" /><div className="about-panel-pill"><Target size={14} /> Your direction starts here</div></div></div><div className="about-copy"><div className="eyebrow section-kicker">A clearer beginning</div><h2 className="section-title">What is Real World Link?</h2><blockquote>Choosing a career starts with understanding yourself.</blockquote><p className="section-copy">We connect interests, strengths and subjects with real-world possibilities — so your next step feels more considered, not more pressured.</p><div className="about-points">{['Interests', 'Strengths', 'Subjects', 'Career fields'].map((point) => <span className="point-tag" key={point}>{point}</span>)}</div></div></div></section>
      <section className="section section-tint" id="how-it-works"><div className="container-rwl"><div className="section-head"><div><div className="eyebrow section-kicker">A simple four-step journey</div><h2 className="section-title">Make room for<br />a better question.</h2></div><p className="section-copy">There is no pressure to have everything figured out. Just start with what catches your attention.</p></div><div className="steps-grid">{[['01', Lightbulb, 'Discover yourself', 'Notice the subjects, ideas and problems that keep your curiosity alive.'], ['02', ClipboardCheck, 'Take the assessment', 'Answer simple career-discovery questions, one at a time.'], ['03', Target, 'Explore your fit', 'See the career fields that may align with your responses.'], ['04', Users, 'Connect with our team', 'Use your result as a conversation starter for what comes next.']].map(([number, Icon, title, copy]) => <div className="step" key={number as string}><div className="step-number">{number as string}</div><h3>{title as string}</h3><p>{copy as string}</p></div>)}</div></div></section>
      <section className="section" id="career-fields"><div className="container-rwl"><div className="section-head"><div><div className="eyebrow section-kicker">Four places to begin</div><h2 className="section-title">Possible paths,<br />not fixed labels.</h2></div><p className="section-copy">Explore the fields, then let your questions lead the way. Every field holds more than one kind of future.</p></div><div className="career-grid">{careerFields.map((field) => <button className={`career-card career-${field.id}`} onClick={() => setSelectedField(field)} key={field.id} data-testid={`button-career-${field.id}`}><span className="career-icon"><field.icon size={22} /></span><span className="career-arrow"><ArrowUp size={17} style={{ transform: 'rotate(45deg)' }} /></span><h3>{field.title}</h3><p>{field.description}</p><div className="tag-row">{field.careers.map((career) => <span className="tag" key={career}>{career}</span>)}</div></button>)}</div></div></section>
      <section className="section section-lilac"><div className="container-rwl why-grid"><div><div className="eyebrow section-kicker">A thoughtful first step</div><h2 className="section-title">Why start<br />with yourself?</h2><p className="section-copy">Because a useful direction is easier to find when it begins with what feels like you — not what sounds impressive on paper.</p><div className="journey">{['Curiosity', 'Assessment', 'Discovery', 'Direction', 'Next step'].map((item, index) => <div className="journey-item" key={item}><span className="journey-dot">{index + 1}</span><strong>{item}</strong></div>)}</div></div><div className="why-list">{[[Brain, 'Understand your interests', 'Put language around what draws your attention.'], [Globe2, 'Explore career possibilities', 'Meet fields you may not have considered yet.'], [Scale, 'Make better-informed choices', 'Move from outside pressure to useful context.'], [Zap, 'Discover new directions', 'Let a surprising answer become a new question.']].map(([Icon, title, copy]) => <div className="why-card" key={title as string}><Icon size={21} /><h3>{title as string}</h3><p>{copy as string}</p></div>)}</div></div></section>
      <section className="cta-band"><div className="container-rwl cta-inner"><div><div className="eyebrow">Your next step can be small</div><h2 className="section-title">Not sure where your interests can take you?</h2><p>Take a few minutes to explore which career field may align with your interests.</p></div><Link href="/assessment" className="button-primary" data-testid="link-cta-assessment">Start My Assessment <ArrowRight size={16} /></Link></div></section>
      <section className="section" id="about-team"><div className="container-rwl"><div className="eyebrow section-kicker">In Shorts by Aafiya &amp; Sana</div><h2 className="section-title">Meet the team behind<br />Real World Link.</h2><div className="team-grid"><div className="team-card"><div className="team-avatar">A</div><div><h3>Aafiya</h3><div className="team-role">Lead Mentor</div><p>Helping students turn curiosity into a clearer conversation about what could come next.</p></div></div><div className="team-card"><div className="team-avatar">S</div><div><h3>Sana</h3><div className="team-role">Lead Mentor</div><p>Creating thoughtful spaces for students to explore strengths, questions and possibilities.</p></div></div></div></div></section>
      <section className="section section-tint" id="faq"><div className="container-rwl faq-grid"><div><div className="eyebrow section-kicker">Questions, answered</div><h2 className="section-title">Start with<br />confidence.</h2><p className="section-copy">A few clear answers before you begin.</p></div><div className="faq-list">{faqs.map(([question, answer], index) => <div className="faq-item" key={question}><button className="faq-button" aria-expanded={faqOpen === index} onClick={() => setFaqOpen(faqOpen === index ? null : index)} data-testid={`button-faq-${index}`}><span>{question}</span><ChevronDown size={18} /></button><div className={`faq-answer ${faqOpen === index ? 'open' : ''}`}><p>{answer}</p></div></div>)}</div></div></section>
      <section className="section" id="contact"><div className="container-rwl contact-grid"><div><div className="eyebrow section-kicker">We are listening</div><h2 className="section-title">Have a question?</h2><p className="section-copy">Tell us what is on your mind. We will keep the conversation clear and student-friendly.</p><div className="about-points"><span className="point-tag"><Mail size={14} /> No OTPs</span><span className="point-tag"><ShieldCheck size={14} /> No pressure</span></div></div><div className="contact-card">{contactSent ? <div className="success-state"><div className="success-icon"><Check size={29} /></div><h3>Thank you. Your message has been received.</h3><p>We appreciate you reaching out to Real World Link.</p><button className="button-secondary contact-submit" onClick={() => setContactSent(false)} data-testid="button-send-another">Send another message</button></div> : <form onSubmit={handleContact}><div className="form-grid"><div className="field"><label htmlFor="contact-name">Name</label><input id="contact-name" name="name" required placeholder="Your name" data-testid="input-contact-name" /></div><div className="field"><label htmlFor="contact-email">Email</label><input id="contact-email" name="email" type="email" required placeholder="you@example.com" data-testid="input-contact-email" /></div><div className="field full"><label htmlFor="contact-subject">Subject</label><input id="contact-subject" name="subject" required placeholder="How can we help?" data-testid="input-contact-subject" /></div><div className="field full"><label htmlFor="contact-message">Message</label><textarea id="contact-message" name="message" required placeholder="Write your message here..." data-testid="input-contact-message" /></div></div><button type="submit" className="button-primary contact-submit" data-testid="button-send-message"><Send size={16} /> Send Message</button></form>}</div></div></section>
    </main>
    <footer className="footer"><div className="container-rwl footer-grid"><div><Brand inverse /><p>A thoughtful space for students to understand their interests and explore possible career directions.</p></div><div><h4>Explore</h4><div className="footer-links"><a href="#how-it-works">How It Works</a><a href="#career-fields">Career Fields</a><a href="#faq">FAQ</a><a href="#contact">Contact</a></div></div><div><h4>Read</h4><div className="footer-links"><Link href="/privacy">Privacy Policy</Link><Link href="/terms">Terms &amp; Conditions</Link><Link href="/assessment">Start Assessment</Link></div></div></div><div className="container-rwl footer-bottom"><span>© {new Date().getFullYear()} Real World Link</span><span>In Shorts by Aafiya &amp; Sana</span></div></footer>
    <Link href="/assessment" className="floating-cta" data-testid="link-floating-assessment">Start Assessment <ArrowRight size={16} /></Link><button className={`back-top ${showTop ? '' : 'hidden'}`} onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })} aria-label="Back to top" data-testid="button-back-top"><ArrowUp size={17} /></button>
    {selectedField && <CareerModal field={selectedField} onClose={() => setSelectedField(null)} />}
  </div>;
}

function CareerModal({ field, onClose }: { field: CareerField; onClose: () => void }) {
  return <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}><div className="career-modal" role="dialog" aria-modal="true" aria-labelledby="career-modal-title"><button className="modal-close" onClick={onClose} aria-label="Close career field details" data-testid="button-close-career-modal"><X size={18} /></button><div className="modal-icon"><field.icon size={25} /></div><div className="eyebrow section-kicker">{field.title}</div><h2 id="career-modal-title">A field for your kind of curiosity.</h2><p>{field.description} Explore the examples below as possible directions, not as labels you have to grow into.</p><div className="modal-label">Career examples</div><ul className="modal-list">{field.careers.map((career) => <li key={career}>{career}</li>)}</ul><div className="modal-label">Potential interests</div><div className="tag-row">{field.interests.map((interest) => <span className="point-tag" key={interest}>{interest}</span>)}</div><Link href="/assessment" className="button-primary" style={{ marginTop: 25 }} onClick={onClose} data-testid="link-modal-assessment">Take the Assessment <ArrowRight size={16} /></Link></div></div>;
}

function AssessmentHeader() {
  return <header className="assessment-header"><div className="container-rwl assessment-header-inner"><Link href="/" data-testid="link-assessment-brand"><Brand /></Link><Link href="/" className="button-secondary" data-testid="link-assessment-home"><ArrowLeft size={15} /> Back to home</Link></div></header>;
}

function AssessmentPage() {
  const [stage, setStage] = useState<'intro' | 'info' | 'questions' | 'review' | 'analysis' | 'result' | 'thankyou'>('intro');
  const [stream, setStream] = useState<Stream | null>(null);
  const [student, setStudent] = useState<StudentInfo>({ name: '', email: '', grade: '', city: '', school: '', consent: false });
  const [infoError, setInfoError] = useState('');
  const [questionIndex, setQuestionIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<number, Option>>({});
  const [result, setResult] = useState<{ primary: string; secondary: string } | null>(null);
  const [direction, setDirection] = useState<'next' | 'previous'>('next');
  const questions = stream ? buildQuestions(stream) : [];

  const chooseAnswer = (option: Option) => setAnswers((current) => ({ ...current, [questionIndex]: option }));
  const continueInfo = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!stream) return setInfoError('Choose a stream to continue.');
    if (!student.name || !student.email || !student.grade || !student.city || !student.consent) return setInfoError('Please complete the required details and confirm the exploration note.');
    setInfoError('');
    setStage('questions');
  };
  const finish = () => {
    if (!stream) return;
    const scores: Record<string, number> = {};
    Object.values(answers).forEach((answer) => { scores[answer.career] = (scores[answer.career] || 0) + 1; });
    const ranked = Object.entries(scores).sort(([, a], [, b]) => b - a);
    const field = streamDetails[stream].field;
    setResult({ primary: ranked[0]?.[0] || field.careers[0], secondary: ranked[1]?.[0] || field.careers[1] });
    setStage('analysis');
    window.setTimeout(() => setStage('result'), 1900);
  };
  const updateStudent = (key: keyof StudentInfo, value: string | boolean) => setStudent((current) => ({ ...current, [key]: value }));
  return <div className="assessment-shell"><AssessmentHeader /><main className="assessment-main">
    {stage === 'intro' && <div className="assessment-intro reveal"><div className="eyebrow">Career discovery assessment</div><h1>Welcome, student.</h1><p>Let’s discover what interests you. There are no perfect answers — only useful clues about what might fit.</p><div className="assessment-meta"><span className="meta-pill"><ClipboardCheck size={15} /> 20 questions</span><span className="meta-pill"><Gauge size={15} /> 5–8 minutes</span><span className="meta-pill"><CircleHelp size={15} /> Multiple choice</span></div><Link href="/assessment?step=info" className="button-primary" onClick={(event) => { event.preventDefault(); setStage('info'); }} data-testid="button-start-assessment">Start Assessment <ArrowRight size={16} /></Link></div>}
    {stage === 'info' && <div className="assessment-page reveal"><div className="eyebrow">Step 1 of 3 · Your starting point</div><h1>Tell us where your curiosity is today.</h1><p>Choose the stream you want to explore, then share a few details so we can keep your result connected to you.</p><div className="stream-grid">{(Object.keys(streamDetails) as Stream[]).map((item) => { const details = streamDetails[item]; return <button className={`choice-card ${stream === item ? 'selected' : ''}`} onClick={() => setStream(item)} key={item} data-testid={`button-stream-${item.toLowerCase()}`}><span className="choice-icon"><details.icon size={18} /></span><span><strong>{item}</strong><span>{details.description}</span></span>{stream === item && <Check className="answer-check" size={18} />}</button>; })}</div><form className="info-form" onSubmit={continueInfo}><div className="form-grid"><div className="field"><label htmlFor="student-name">Full Name *</label><input id="student-name" value={student.name} onChange={(event) => updateStudent('name', event.target.value)} required placeholder="Your name" data-testid="input-student-name" /></div><div className="field"><label htmlFor="student-email">Email Address *</label><input id="student-email" type="email" value={student.email} onChange={(event) => updateStudent('email', event.target.value)} required placeholder="you@example.com" data-testid="input-student-email" /></div><div className="field"><label htmlFor="student-grade">Class / Grade *</label><input id="student-grade" value={student.grade} onChange={(event) => updateStudent('grade', event.target.value)} required placeholder="For example, Grade 11" data-testid="input-student-grade" /></div><div className="field"><label htmlFor="student-city">City *</label><input id="student-city" value={student.city} onChange={(event) => updateStudent('city', event.target.value)} required placeholder="Your city" data-testid="input-student-city" /></div><div className="field full"><label htmlFor="student-school">School / Institution</label><input id="student-school" value={student.school} onChange={(event) => updateStudent('school', event.target.value)} placeholder="Optional" data-testid="input-student-school" /></div></div><label className="check-row"><input type="checkbox" checked={student.consent} onChange={(event) => updateStudent('consent', event.target.checked)} data-testid="input-student-consent" /><span>I understand that this assessment is for career exploration and does not guarantee a specific career outcome.</span></label>{infoError && <div className="error-text" role="alert" data-testid="text-info-error">{infoError}</div>}<div className="assessment-actions"><Link href="/" className="button-secondary" data-testid="link-info-cancel">Cancel</Link><button className="button-primary" type="submit" data-testid="button-continue-info">Continue <ArrowRight size={16} /></button></div></form></div>}
    {stage === 'questions' && stream && <div className="assessment-page reveal" key={questionIndex}><div className="question-kicker">Career discovery assessment · {stream}</div><div className="progress-wrap"><div className="progress-label"><span>Question {questionIndex + 1} of 20</span><span>{Math.round(((questionIndex + 1) / 20) * 100)}% complete</span></div><div className="progress-track"><div className="progress-fill" style={{ width: `${((questionIndex + 1) / 20) * 100}%` }} /></div></div><div className="question-title">{questionIndex === 0 ? 'Which broad direction would you like to explore?' : questions[questionIndex - 1].prompt}</div><div className="answer-grid">{(questionIndex === 0 ? streamDetails[stream].field.careers.map((career) => ({ career, text: career })) : questions[questionIndex - 1].options).map((option, index) => <button className={`choice-card answer-card ${answers[questionIndex]?.career === option.career ? 'selected' : ''}`} onClick={() => chooseAnswer(option)} key={`${option.career}-${index}`} data-testid={`button-answer-${questionIndex}-${index}`}><span className="choice-icon">{index === 0 ? <Target size={17} /> : index === 1 ? <Lightbulb size={17} /> : index === 2 ? <Search size={17} /> : <Sparkles size={17} />}</span><strong>{option.text}</strong>{answers[questionIndex]?.career === option.career && <Check className="answer-check" size={18} />}</button>)}</div><div className="assessment-actions"><button className="button-secondary" disabled={questionIndex === 0} onClick={() => { setDirection('previous'); setQuestionIndex((index) => Math.max(0, index - 1)); }} data-testid="button-previous-question"><ArrowLeft size={16} /> Previous</button><button className="button-primary" disabled={!answers[questionIndex]} onClick={() => { if (questionIndex === 19) setStage('review'); else { setDirection('next'); setQuestionIndex((index) => index + 1); } }} data-testid="button-next-question">{questionIndex === 19 ? 'Review & Submit' : 'Next'} <ArrowRight size={16} /></button></div><span className="sr-only">{direction}</span></div>}
    {stage === 'review' && stream && <div className="assessment-page reveal"><div className="eyebrow">Step 3 of 3 · Ready when you are</div><h1>Review &amp; submit.</h1><p>Your answers are saved. Take a breath, check the details below and submit when it feels right.</p><div className="review-card"><div className="review-row"><span>Status</span><strong><CheckCircle2 size={15} style={{ verticalAlign: 'middle', color: 'hsl(169 48% 35%)' }} /> Assessment complete</strong></div><div className="review-row"><span>Questions answered</span><strong>20 / 20</strong></div><div className="review-row"><span>Student name</span><strong>{student.name}</strong></div><div className="review-row"><span>Email</span><strong>{student.email}</strong></div><div className="review-row"><span>Selected stream</span><strong>{stream}</strong></div></div><div className="assessment-actions"><button className="button-secondary" onClick={() => { setQuestionIndex(0); setStage('questions'); }} data-testid="button-review-answers"><ArrowLeft size={16} /> Review Answers</button><button className="button-primary" onClick={finish} data-testid="button-submit-assessment">Submit Assessment <ArrowRight size={16} /></button></div></div>}
    {stage === 'analysis' && <div className="assessment-intro reveal"><div className="eyebrow">One moment</div><h1>Reading your responses.</h1><p>We are grouping your interests into possible career directions.</p><div className="analysis-list"><div className="analysis-item"><CheckCircle2 size={18} /> Analyzing your responses</div><div className="analysis-item"><CheckCircle2 size={18} /> Understanding your interests</div><div className="analysis-item"><CheckCircle2 size={18} /> Finding your best-fit career field</div></div></div>}
    {stage === 'result' && result && <div className="assessment-page reveal"><div className="eyebrow">Based on your responses</div><h1>Your best-fit career field.</h1><p>This is a possible direction to explore — a starting point for your next conversation, not a guarantee about your future.</p><div className="result-card"><span className="result-badge">Best-fit career field</span><h2>{result.primary}</h2><p>{stream && streamDetails[stream].field.description} Your answers suggest that this kind of work may be worth learning more about.</p><div className="secondary-result">Another possible direction to explore: <strong>{result.secondary}</strong></div></div><div className="assessment-actions"><Link href="/" className="button-secondary" data-testid="link-result-home">Return to home</Link><button className="button-primary" onClick={() => setStage('thankyou')} data-testid="button-result-next">See your next step <ArrowRight size={16} /></button></div></div>}
    {stage === 'thankyou' && <div className="assessment-intro reveal"><div className="thankyou-mark"><Check size={36} /></div><div className="eyebrow">You made a meaningful start</div><h1>Thank you, {student.name.split(' ')[0] || 'student'}.</h1><p>Your responses have been received. Keep your result close, ask questions and let your next step be guided by curiosity.</p><div className="assessment-actions" style={{ justifyContent: 'center' }}><Link href="/" className="button-primary" data-testid="link-thankyou-home">Explore Real World Link <ArrowRight size={16} /></Link></div></div>}
  </main></div>;
}

function LegalPage({ kind }: { kind: 'privacy' | 'terms' }) {
  const privacy = kind === 'privacy';
  return <div className="legal-page"><div className="container-rwl"><Link href="/" data-testid="link-legal-brand"><Brand /></Link></div><div className="legal-content"><div className="eyebrow" style={{ marginTop: 58 }}>Real World Link</div><h1>{privacy ? 'Privacy Policy' : 'Terms & Conditions'}</h1><p className="lead">{privacy ? 'A clear note on how this public student experience handles information.' : 'A simple agreement for using this career-discovery website thoughtfully.'}</p><h2>{privacy ? 'What we collect' : 'Using the assessment'}</h2><p>{privacy ? 'When you choose to send a message or take the assessment, you may share details such as your name, email address, class or grade, city and school. We ask only for information that supports the public experience.' : 'Real World Link is for career exploration and reflection. The assessment provides possible career directions based on your responses; it does not guarantee a specific career, admission, job or future outcome.'}</p><h2>{privacy ? 'How it is used' : 'Your responsibility'}</h2><p>{privacy ? 'Information may be used to provide the experience, respond to messages and understand how to make the website more useful. We do not ask for phone verification, documents, uploads or OTPs.' : 'Please answer thoughtfully and use the result as one input among many. Discuss important academic and career decisions with trusted people and use additional research before acting.'}</p><h2>{privacy ? 'Your choices' : 'Content and availability'}</h2><p>{privacy ? 'You can choose not to continue, and you can contact the team with questions about information shared through the website.' : 'We aim to keep the website useful and accurate, but content may change as Real World Link develops. The website is provided as a public informational experience.'}</p><h2>Questions</h2><p>For questions about this page or the public experience, please use the contact form on the home page.</p><Link href="/" className="button-secondary" style={{ marginTop: 20 }} data-testid="link-legal-home"><ArrowLeft size={15} /> Back to home</Link></div></div>;
}

function NotFound() {
  return <div className="not-found"><div><Brand /><h1>404</h1><p>This page took a different path.</p><Link href="/" className="button-primary" data-testid="link-not-found-home">Return home <ArrowRight size={16} /></Link></div></div>;
}

function Router() {
  const [location] = useLocation();
  return <ErrorBoundary resetKey={location}><Switch><Route path="/" component={Home} /><Route path="/assessment" component={AssessmentPage} /><Route path="/privacy" component={() => <LegalPage kind="privacy" />} /><Route path="/terms" component={() => <LegalPage kind="terms" />} /><Route component={NotFound} /></Switch></ErrorBoundary>;
}

function App() {
  return <QueryClientProvider client={queryClient}><TooltipProvider><WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, '')}><Router /></WouterRouter><Toaster /></TooltipProvider></QueryClientProvider>;
}

export default App;