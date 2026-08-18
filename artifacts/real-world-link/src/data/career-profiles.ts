// One profile summary and one hands-on Linking Box challenge per career.
// Keys match the career names listed in the four career fields in App.tsx.
export type CareerProfile = {
  profile: string;
  challengeTitle: string;
  challengeDescription: string;
  domainTag: string;
  badges: string[];
};

export const careerProfiles: Record<string, CareerProfile> = {
  'Forensic Science': {
    profile:
      'You lean towards investigation and evidence. You are drawn to detail, patience and the discipline of letting the facts lead you to the answer.',
    challengeTitle: 'Latent fingerprint and trace analysis',
    challengeDescription:
      'Using the dusting powder, brush and lifting tape in your box, raise a latent fingerprint from a smooth surface. Record what you see and how the surface changed the result.',
    domainTag: 'Forensics & Criminology',
    badges: ['Observer', 'Analyst', 'Investigator'],
  },
  'Medicine & Pathology': {
    profile:
      'You lean towards diagnosis and care. You enjoy reading signals from a living system and working out what they mean together.',
    challengeTitle: 'Diagnostic reasoning simulation',
    challengeDescription:
      'Work through the case cards in your box. For each set of symptoms, note the possible explanations you considered and the evidence that made you rule one in or out.',
    domainTag: 'Medicine & Pathology',
    badges: ['Observer', 'Diagnostician', 'Communicator'],
  },
  'Biotechnology & Research': {
    profile:
      'You lean towards experiments and discovery. You enjoy controlled tests, careful notes and questions that take more than one attempt to answer.',
    challengeTitle: 'DNA extraction and reaction rate',
    challengeDescription:
      'Extract visible DNA strands from the sample provided, then run the enzyme reaction twice at different temperatures. Record both results and what the difference suggests.',
    domainTag: 'Biotech & Research',
    badges: ['Observer', 'Experimenter', 'Researcher'],
  },
  'AI & Robotics Engineering': {
    profile:
      'You lean towards systems and logic. You like understanding how something works from the inside and then making it work better.',
    challengeTitle: 'Sensor circuit and control logic',
    challengeDescription:
      'Assemble the sensor circuit on the breadboard in your box, then write the control rule for how it should respond to light and temperature. Note what you changed to make it reliable.',
    domainTag: 'AI & Engineering',
    badges: ['Builder', 'Analyst', 'Problem Solver'],
  },
  'Architecture & Spatial Design': {
    profile:
      'You lean towards space and structure. You notice how people move through places and what makes a design feel considered.',
    challengeTitle: 'Structural blueprint and scale model',
    challengeDescription:
      'Use the drafting grid and modelling materials to design a small load-bearing structure. Sketch the plan first, build it, then note where your plan and the build disagreed.',
    domainTag: 'Architecture & Design',
    badges: ['Designer', 'Planner', 'Builder'],
  },
  'Physical Research & Engineering': {
    profile:
      'You lean towards measurement and principle. You want to know why a result behaves the way it does, not only that it did.',
    challengeTitle: 'Energy conversion and efficiency',
    challengeDescription:
      'Build the photovoltaic circuit in your box and use the multimeter to measure output under two different light conditions. Calculate the efficiency and explain the gap.',
    domainTag: 'Physics & Engineering',
    badges: ['Observer', 'Analyst', 'Experimenter'],
  },
  'Chartered Accountancy': {
    profile:
      'You lean towards accuracy and accountability. You are comfortable with detail and you notice when the numbers do not agree.',
    challengeTitle: 'Balance sheet review',
    challengeDescription:
      'Examine the mock balance sheet in your box. Find the entries that do not reconcile, correct them and write a short note explaining what each error would have hidden.',
    domainTag: 'Accountancy & Audit',
    badges: ['Analyst', 'Auditor', 'Detail Keeper'],
  },
  'Business & Entrepreneurship': {
    profile:
      'You lean towards initiative and strategy. You enjoy turning a rough idea into a plan someone else can act on.',
    challengeTitle: 'Go-to-market and pricing plan',
    challengeDescription:
      'Use the case pack in your box to define one customer, one price and one first channel. Show the unit economics and explain the assumption you are least sure about.',
    domainTag: 'Business & Strategy',
    badges: ['Strategist', 'Communicator', 'Planner'],
  },
  'Financial Analytics': {
    profile:
      'You lean towards patterns and risk. You like comparing options with evidence and planning for more than one outcome.',
    challengeTitle: 'Portfolio risk model',
    challengeDescription:
      'Using the market data cards in your box, build a small portfolio and estimate its risk. Then change one assumption and record how much the outcome moved.',
    domainTag: 'Finance & Analytics',
    badges: ['Analyst', 'Strategist', 'Modeller'],
  },
  'Psychology & Behavioral Science': {
    profile:
      'You lean towards people and patterns in behaviour. You listen carefully and you are curious about what sits underneath a choice.',
    challengeTitle: 'Reaction time and bias study',
    challengeDescription:
      'Run the reaction-time task in your box with three willing volunteers. Record the results, note what varied between people and what you would control next time.',
    domainTag: 'Psychology & Behaviour',
    badges: ['Observer', 'Listener', 'Researcher'],
  },
  'IAS & Public Policy': {
    profile:
      'You lean towards public problems and fair decisions. You think about who is affected and how a plan actually reaches them.',
    challengeTitle: 'District resource allocation',
    challengeDescription:
      'Review the water shortage dossier in your box. Propose a distribution plan within the given budget and explain which trade-off you accepted and why.',
    domainTag: 'Public Policy',
    badges: ['Planner', 'Strategist', 'Communicator'],
  },
  'Political Science & Geography': {
    profile:
      'You lean towards places, systems and perspective. You enjoy seeing how geography, history and policy shape one another.',
    challengeTitle: 'Resource mapping and policy brief',
    challengeDescription:
      'Map the resource distribution shown in your box materials, then write a one-page brief proposing how two regions could trade. Name the risk in your own proposal.',
    domainTag: 'Political Science & Geography',
    badges: ['Observer', 'Analyst', 'Communicator'],
  },
};

export const boxSteps = [
  { key: 'preparing', label: 'Assessed', copy: 'Your responses are in and your career field is set.' },
  { key: 'designed', label: 'Designed', copy: 'Your Linking Box has been packed for your career field.' },
  { key: 'dispatched', label: 'Dispatched', copy: 'Your box has left our workshop and is on its way.' },
  { key: 'delivered', label: 'Delivered', copy: 'Your box has arrived. Your practical challenge is ready.' },
] as const;

export type BoxStatus = (typeof boxSteps)[number]['key'];

export const boxStatusLabels: Record<BoxStatus, string> = {
  preparing: 'Preparing box',
  designed: 'Packed & ready',
  dispatched: 'Dispatched',
  delivered: 'Delivered',
};

export function boxStepIndex(status: string) {
  const index = boxSteps.findIndex((step) => step.key === status);
  return index === -1 ? 0 : index;
}

export function formatDate(value: string | null | undefined) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}
