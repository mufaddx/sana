// The assessment itself: career fields, the questions per stream and the
// answer options. Kept out of App.tsx so the admin workspace can render a
// student's answers next to the question that was actually asked, instead of
// showing the stored answer on its own.
import { BriefcaseBusiness, Cpu, FlaskConical, Globe2 } from 'lucide-react';

export type CareerField = {
  id: string;
  title: string;
  description: string;
  careers: string[];
  interests: string[];
  icon: typeof FlaskConical;
};

export const careerFields: CareerField[] = [
  { id: 'science', title: 'Science & Healthcare', description: 'For students drawn to evidence, living systems and the questions that make the world healthier.', careers: ['Forensic Science', 'Medicine & Pathology', 'Biotechnology & Research'], interests: ['Scientific evidence', 'Diagnosis', 'Laboratory work', 'Research'], icon: FlaskConical },
  { id: 'technology', title: 'Engineering & Technology', description: 'For curious builders who want to understand systems, create solutions and shape what comes next.', careers: ['AI & Robotics Engineering', 'Architecture & Spatial Design', 'Physical Research & Engineering'], interests: ['Algorithms', 'Design', 'Sensors', 'Energy'], icon: Cpu },
  { id: 'commerce', title: 'Commerce & Business', description: 'For analytical and enterprising minds interested in decisions, value and how ideas become real ventures.', careers: ['Chartered Accountancy', 'Business & Entrepreneurship', 'Financial Analytics'], interests: ['Financial markets', 'Leadership', 'Risk', 'Modelling'], icon: BriefcaseBusiness },
  { id: 'humanities', title: 'Humanities & Social Sciences', description: 'For people who notice patterns in society, ask thoughtful questions and care about how communities work.', careers: ['Psychology & Behavioral Science', 'IAS & Public Policy', 'Political Science & Geography'], interests: ['Human behaviour', 'Government', 'GIS', 'Social issues'], icon: Globe2 },
];

export type Stream = 'PCB' | 'PCM' | 'Commerce' | 'Humanities';
export type Option = { text: string; career: string };
export type Question = { prompt: string; options: Option[] };

export const streamDetails: Record<Stream, { description: string; icon: typeof FlaskConical; field: CareerField }> = {
  PCB: { description: 'Life sciences, health and scientific discovery', icon: FlaskConical, field: careerFields[0] },
  PCM: { description: 'Mathematics, systems and inventive problem-solving', icon: Cpu, field: careerFields[1] },
  Commerce: { description: 'Business, numbers and decisions with real-world impact', icon: BriefcaseBusiness, field: careerFields[2] },
  Humanities: { description: 'People, society, policy and the places we share', icon: Globe2, field: careerFields[3] },
};

export const streamPrompts: Record<Stream, string[]> = {
  PCB: ['A mystery needs careful scientific evidence. Which part would you want to lead?', 'Which kind of problem feels most rewarding to untangle?', 'In a laboratory, what would you be happiest to learn?', 'Which moment in healthcare or science catches your attention?', 'What would you rather investigate deeply?', 'Which tool or setting sounds most interesting?', 'When evidence is incomplete, what is your instinct?', 'What kind of research question would you keep returning to?', 'Which subject would you happily spend extra time with?', 'What does a good diagnosis require most?', 'Which contribution to a team feels natural to you?', 'What makes scientific work meaningful?', 'Which discovery would you like to understand better?', 'What do you value when handling sensitive information?', 'Which project would you choose for a school showcase?', 'What kind of progress excites you?', 'Which skill would you like to strengthen?', 'Where would you feel most at home?', 'What future possibility feels worth exploring?'],
  PCM: ['A machine has a problem. Which part would you want to solve first?', 'Which technology would you enjoy understanding from the inside?', 'What kind of making feels most satisfying?', 'Which space would you like to design or improve?', 'When a system behaves unexpectedly, what do you do?', 'Which subject connection feels most exciting?', 'What would you build with a kit of sensors?', 'Which kind of research would hold your attention?', 'What is your favorite part of a technical project?', 'Which question about energy interests you most?', 'How do you prefer to approach a complex challenge?', 'Which project would you take to a showcase?', 'What makes a design feel successful?', 'What kind of work would you do for hours?', 'Which tool feels most natural to you?', 'What would you like to understand more clearly?', 'What type of team role suits you?', 'Which change would you like technology to make?', 'Where would you like your curiosity to lead?'],
  Commerce: ['A new venture needs its first strong decision. Where would you begin?', 'Which numbers would you enjoy making sense of?', 'What kind of business question makes you curious?', 'Which part of a company would you want to understand?', 'When a decision carries risk, what helps you move forward?', 'What makes a business idea worth exploring?', 'Which task sounds most satisfying?', 'What would you like to learn about markets?', 'Which school project would you choose?', 'What does responsible finance require?', 'Which kind of impact would you like your work to have?', 'What makes a leader trustworthy?', 'Which pattern would you look for in a business?', 'What would you rather improve?', 'Which subject would you happily go deeper into?', 'How do you prefer to work with a team?', 'Which future possibility sounds most like you?', 'What does good planning make possible?', 'Where would you like your curiosity to lead?'],
  Humanities: ['A community question needs careful listening. Where would you start?', 'Which part of human behaviour would you enjoy understanding?', 'What kind of public question holds your attention?', 'Which place or map would you want to explore?', 'When people disagree, what would you want to understand first?', 'What makes a policy thoughtful?', 'Which subject would you choose for deeper study?', 'What kind of social change interests you?', 'Which project would you take to a showcase?', 'What helps communities work better?', 'Which role in a team feels most natural?', 'What would you like to make clearer for others?', 'Which global topic would you follow?', 'What makes research about people responsible?', 'Which setting sounds most meaningful?', 'What kind of problem would you like to help solve?', 'Which skill would you like to strengthen?', 'What does a fair decision require?', 'Where would you like your curiosity to lead?'],
};

export const streamOptions: Record<Stream, string[][]> = {
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

export function buildQuestions(stream: Stream): Question[] {
  const careers = streamDetails[stream].field.careers;
  return streamPrompts[stream].map((prompt, index) => {
    const set = streamOptions[stream][index % streamOptions[stream].length];
    return { prompt, options: careers.map((career, careerIndex) => ({ career, text: set[careerIndex] })) };
  });
}

// Question 0 asks the student to pick a direction; the rest come from the
// stream's prompt list. Mirrors the order the assessment presents them in.
export const STREAM_CHOICE_PROMPT = 'Which broad direction would you like to explore?';

export function questionPrompt(stream: Stream, answerIndex: number) {
  if (answerIndex === 0) return STREAM_CHOICE_PROMPT;
  return streamPrompts[stream][answerIndex - 1] ?? `Question ${answerIndex + 1}`;
}
