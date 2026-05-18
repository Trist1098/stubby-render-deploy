const { Pool } = require('pg');
const bcrypt = require('bcrypt');


const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

// const persons = [
//   { email: 'alice@example.com', name: 'Alice' },
//   { email: 'bob@example.com', name: 'Bob' },
//   { email: 'carol@example.com', name: 'Carol' },
//   { email: 'dave@example.com', name: 'Dave' },
//   { email: 'eve@example.com', name: 'Eve' },
//   { email: 'frank@example.com', name: 'Frank' },
//   { email: 'grace@example.com', name: 'Grace' },
//   { email: 'heidi@example.com', name: 'Heidi' },
//   { email: 'ivan@example.com', name: 'Ivan' },
//   { email: 'judy@example.com', name: 'Judy' },
//   { email: 'mallory@example.com', name: 'Mallory' },
//   { email: 'oscar@example.com', name: 'Oscar' },
//   { email: 'peggy@example.com', name: 'Peggy' },
//   { email: 'trent@example.com', name: 'Trent' },
//   { email: 'victor@example.com', name: 'Victor' },
//   { email: 'walter@example.com', name: 'Walter' },
//   { email: 'xavier@example.com', name: 'Xavier' },
//   { email: 'yvonne@example.com', name: 'Yvonne' },
//   { email: 'zara@example.com', name: 'Zara' },
//   { email: 'leo@example.com', name: 'Leo' },
// ];

// const somethings = [{ name: 'Seed 1' }, { name: 'Seed 2' }];

// async function seed() {
//   console.log('Seeding data...');

//   // Insert persons (batch)
//   if (persons.length > 0) {
//     const personPlaceholders = persons.map((_, i) => `($${i * 2 + 1}, $${i * 2 + 2})`);
//     const personValues = persons.flatMap((p) => [p.email, p.name]);
//     await pool.query(
//       `INSERT INTO "Person" ("email", "name") VALUES ${personPlaceholders.join(', ')}`,
//       personValues,
//     );
//   }
//   console.log(`Inserted ${persons.length} persons.`);

//   // Insert somethings (batch)
//   if (somethings.length > 0) {
//     const somethingPlaceholders = somethings.map((_, i) => `($${i + 1})`);
//     const somethingValues = somethings.map((s) => s.name);
//     await pool.query(
//       `INSERT INTO "Something" ("name") VALUES ${somethingPlaceholders.join(', ')}`,
//       somethingValues,
//     );
//   }
//   console.log(`Inserted ${somethings.length} somethings.`);

//   console.log('Seed data inserted successfully.');
// }


// ##############################################################
// 1. DATA DEFINITIONS
// ##############################################################

const countries = [
  { name: 'Singapore', code: 'SG' }, 
  { name: 'Malaysia', code: 'MY' }, 
  { name: 'Indonesia', code: 'ID' }, 
  { name: 'Thailand', code: 'TH' },
  { name: 'Vietnam', code: 'VN' },
  { name: 'Philippines', code: 'PH' },
  { name: 'Cambodia', code: 'KH' },
  { name: 'Laos', code: 'LA' },
  { name: 'Myanmar', code: 'MM' },
  { name: 'Brunei', code: 'BN' },
  { name: 'Timor-Leste', code: 'TL' },
  { name: 'United States', code: 'US' }, 
  { name: 'United Kingdom', code: 'UK' }
];

const institutions = [
  { name: 'Singapore Polytechnic', location: '500 Dover Road, Singapore 139651', country_id: 1, website: 'https://www.sp.edu.sg' },
  { name: 'Nanyang Polytechnic', location: '10 Ang Mo Kio Drive, Singapore 569899', country_id: 1, website: 'https://www.nyp.edu.sg' },
  { name: 'Ngee Ann Polytechnic', location: '535 Clementi Rd, Singapore 599489', country_id: 1, website: 'https://www.np.edu.sg' },
  { name: 'Republic Polytechnic', location: '9 Woodlands Ave 9, Singapore 738995', country_id: 1, website: 'https://www.rp.edu.sg' },
  { name: 'Temasek Polytechnic', location: '21 Tampines Ave 1, Singapore 529757', country_id: 1, website: 'https://www.tp.edu.sg' },
  { name: 'Lasalle College of the Arts', location: '1 McNally St, Singapore 187944', country_id: 1, website: 'https://www.lasalle.edu.sg' },
  { name: 'Nanyang Technological University', location: '50 Nanyang Ave, Singapore 639798', country_id: 1, website: 'https://www.ntu.edu.sg' },
  { name: 'National University of Singapore', location: '11 Kent Ridge Rd, Singapore 119224', country_id: 1, website: 'https://www.nus.edu.sg' },
  { name: 'Singapore Institute of Management', location: '463 Clementi Rd, Singapore 599494', country_id: 1, website: 'https://www.sim.edu.sg' },
  { name: 'Singapore Management University', location: '81 Victoria St, Singapore 187996', country_id: 1, website: 'https://www.smu.edu.sg' }
];

const diplomas = [
  { institution_id: 1, name: 'Diploma in Information Technology', code: 'DIT' },
  { institution_id: 1, name: 'Diploma in Business Administration', code: 'DBA' },
  { institution_id: 1, name: 'Diploma in Computer Engineering', code: 'DCN' },
  { institution_id: 4, name: 'Bachelor of Engineering (Computer Science)', code: 'BEng CS' },
];

const modules = [
  { diploma_id: 1, name: 'Fundamentals of Programming 2', code: 'FOP2', description: 'Intermediate programming concepts in JS' },
  { diploma_id: 1, name: 'Back-End Development', code: 'BED', description: 'Server-side programming with Node.js and Express' },
  { diploma_id: 1, name: 'Programming for Data Science', code: 'PDS', description: 'Python for data analysis' },
  { diploma_id: 1, name: 'Data Fluency', code: 'DF', description: 'Data-driven business decision making' },
  { diploma_id: 1, name: 'CI/CD Pipeline', code: 'CI/CD', description: 'Continuous Integration/Continuous Delivery' },
  { diploma_id: 1, name: 'Front-End Development', code: 'FED', description: 'Front-end development with HTML, CSS, and JavaScript' },
  { diploma_id: 1, name: 'Fundamentals of Programming', code: 'FOP', description: 'Basic coding concepts' },
  { diploma_id: 1, name: 'Software Engineering', code: 'SE', description: 'Software engineering with React and Angular' },
  { diploma_id: 1, name: 'Project Management', code: 'PM', description: 'Project management with Agile and Waterfall' },
  { diploma_id: 2, name: 'Business Analytics', code: 'BA', description: 'Data-driven business decision making' },
  { diploma_id: 3, name: 'Network Security', code: 'NS', description: 'Securing enterprise networks' }
];

const languages = [
  { name: 'English', code: 'en' }, 
  { name: 'Mandarin', code: 'zh' }, 
  { name: 'Malay', code: 'ms' }, 
  { name: 'Tamil', code: 'ta' },
  { name: 'Vietnamese', code: 'vi' }, 
  { name: 'Indonesian', code: 'id' }, 
  { name: 'Thai', code: 'th' }, 
  { name: 'Tagalog', code: 'tl' },
  { name: 'Burmese', code: 'my' }, 
  { name: 'Khmer', code: 'km' }, 
  { name: 'Lao', code: 'lo' }, 
  { name: 'Russian', code: 'ru' }, 
  { name: 'Arabic', code: 'ar' }, 
  { name: 'Japanese', code: 'ja' }, 
  { name: 'Korean', code: 'ko' }, 
  { name: 'Spanish', code: 'es' },
  { name: 'French', code: 'fr' }, 
  { name: 'German', code: 'de' }, 
  { name: 'Italian', code: 'it' }, 
  { name: 'Portuguese', code: 'pt' }
];

const interests = [
  { name: 'STEM' }, 
  { name: 'Business' }, 
  { name: 'Arts' }, 
  { name: 'Health' }, 
  { name: 'Sports' },
  { name: 'Music' },
  { name: 'Photography' },
  { name: 'Travel' },
  { name: 'Cooking' },
  { name: 'Reading' },
  { name: 'Fashion' },
  { name: 'Gaming' },
  { name: 'Technology' },
  { name: 'Humanities' },
  { name: 'Social' },
  { name: 'AI' },
  { name: 'Blockchain' },
  { name: 'IoT' },
  { name: 'Cybersecurity' },
  { name: 'Cloud Computing' },
  { name: 'Big Data' },
  { name: 'Machine Learning' },
  { name: 'Deep Learning' },
  { name: 'Robotics' },
  { name: 'AR/VR' }
];

const users = [
  { username: 'admin', email: 'admin@admin.com', name: 'Admin', inst: 1, dip: 1, year: 1, bio: 'Site Administrator.', is_online: true, has_completed_quiz: true },
  { username: 'james', email: 'james@ichat.sp.edu.sg', name: 'James Lee', inst: 1, dip: 1, year: 2, bio: 'Bio:\\nPassionate about software development and AI.', is_online: true, has_completed_quiz: true },
  { username: 'sarah', email: 'sarah@ichat.sp.edu.sg', name: 'Sarah Lim', inst: 1, dip: 1, year: 2, bio: 'Loves front-end development and UI design.', is_online: false, has_completed_quiz: true },
  { username: 'marcus', email: 'marcus@ichat.sp.edu.sg', name: 'Marcus Tan', inst: 1, dip: 1, year: 2, bio: 'Backend enthusiast. Enjoys databases and APIs.', is_online: false, has_completed_quiz: true },
  { username: 'emily', email: 'emily@ichat.sp.edu.sg', name: 'Emily Wong', inst: 1, dip: 1, year: 2, bio: 'Full-stack developer in training.', is_online: false, has_completed_quiz: true },
  { username: 'daniel', email: 'daniel@ichat.sp.edu.sg', name: 'Daniel Ng', inst: 1, dip: 2, year: 2, bio: 'Interested in data analytics.', is_online: true, has_completed_quiz: true },
  { username: 'alicia', email: 'alicia@ichat.sp.edu.sg', name: 'Alicia Goh', inst: 1, dip: 1, year: 1, bio: 'Year 1 student eager to learn programming.', is_online: true, has_completed_quiz: true },
  { username: 'jason', email: 'jason@ichat.sp.edu.sg', name: 'Jason Lim', inst: 1, dip: 3, year: 3, bio: 'Networking student. Loves cybersecurity.', is_online: false, has_completed_quiz: true },
  { username: 'zara', email: 'zara@ichat.sp.edu.sg', name: 'Zara Teo', inst: 1, dip: 1, year: 2, bio: 'Creative coder who loves design thinking.', is_online: false, has_completed_quiz: true },
  { username: 'ryan', email: 'ryan@ichat.sp.edu.sg', name: 'Ryan Koh', inst: 1, dip: 1, year: 1, bio: 'Aspiring game developer.', is_online: false, has_completed_quiz: true },
  { username: 'kimberly', email: 'kimberly@ichat.sp.edu.sg', name: 'Kimberly Chen', inst: 1, dip: 2, year: 2, bio: 'Passionate about fintech and startups.', is_online: true, has_completed_quiz: false },
  { username: 'alex', email: 'alex@globaltech.edu', name: 'Alex Rivet', inst: 4, dip: 4, year: 3, bio: 'Year 3 student eager to learn programming.', is_online: false, has_completed_quiz: true },
  { username: 'sophia', email: 'sophia@globaltech.edu', name: 'Sophia Chen', inst: 6, dip: 4, year: 2, bio: 'Interested in game development.', is_online: false, has_completed_quiz: true },
  { username: 'liam', email: 'liam@nus.edu.sg', name: 'Liam Tan', inst: 8, dip: 4, year: 1, bio: 'NUS Computer Science freshman.', is_online: false, has_completed_quiz: true },
  { username: 'olivia', email: 'olivia@ntu.edu.sg', name: 'Olivia Lim', inst: 7, dip: 4, year: 2, bio: 'Interested in AI and machine learning.', is_online: true, has_completed_quiz: false },
  { username: 'noah', email: 'noah@ichat.sp.edu.sg', name: 'Noah Wong', inst: 1, dip: 1, year: 1, bio: 'DIT student looking for study partners.', is_online: false, has_completed_quiz: false },
  { username: 'isabella', email: 'isabella@ichat.sp.edu.sg', name: 'Isabella Ng', inst: 1, dip: 1, year: 2, bio: 'Loves coding and group discussions.', is_online: false, has_completed_quiz: false },
  { username: 'ethan', email: 'ethan@nyp.edu.sg', name: 'Ethan Koh', inst: 2, dip: 1, year: 2, bio: 'NYP student passionate about web dev.', is_online: false, has_completed_quiz: false },
  { username: 'ava', email: 'ava@np.edu.sg', name: 'Ava Low', inst: 3, dip: 1, year: 3, bio: 'NP final year student.', is_online: false, has_completed_quiz: false },
  { username: 'lucas', email: 'lucas@rp.edu.sg', name: 'Lucas Teo', inst: 4, dip: 1, year: 1, bio: 'RP student learning back-end.', is_online: false, has_completed_quiz: false },
  { username: 'mia', email: 'mia@tp.edu.sg', name: 'Mia Lim', inst: 5, dip: 1, year: 2, bio: 'TP student interested in UI/UX.', is_online: false, has_completed_quiz: false },
  { username: 'sam', email: 'sam@ichat.sp.edu.sg', name: 'Sam', inst: 1, dip: 1, year: 2, bio: 'Study session member taking a short break.', is_online: true, has_completed_quiz: true }
];

const matchRequests = [
  { s: 2, r: 4, m: 2, t: '16/05/2026 15:00', l: 'Online (Zoom)', ty: 'one-on-one', st: 'Accepted', msg: 'Hey Marcus! Want to work on the BED project together?', tp: 'BED Project Assignment' },
  { s: 2, r: 5, m: 1, t: '17/05/2026 10:00', l: 'Library Level 6', ty: 'one-on-one', st: 'Pending', msg: 'Hi Emily, would you like to prep for the FOP2 mock test?', tp: 'FOP2 Mock Test Prep' },
  { s: 9, r: 2, m: 4, t: '18/05/2026 14:00', l: 'Campus Lab 3', ty: 'one-on-one', st: 'Pending', msg: 'Hi James! I need help with DF assignments.', tp: 'Digital Forensics Help' },
  { s: 3, r: 5, m: 1, t: '19/05/2026 11:00', l: 'Library Level 3', ty: 'group', st: 'Accepted', msg: 'Group study for FOP2 exam prep!', tp: 'FOP2 Group Study' }
];

const badges = [
  { name: '10 Hours', desc: 'Completed 10 hours', cat: 'commitment' },
  { name: '20 Hours', desc: 'Completed 20 hours', cat: 'commitment' },
  { name: '30 Hours', desc: 'Completed 30 hours', cat: 'commitment' },
  { name: '50 Hours', desc: 'Completed 50 hours', cat: 'commitment' },
  { name: '75 Hours', desc: 'Completed 75 hours', cat: 'commitment' },
  { name: '100 Hours', desc: 'Completed 100 hours', cat: 'commitment' },
  { name: 'Daily Champion', desc: 'Completed a daily study challenge', cat: 'periodic' },
  { name: 'Weekly Champion', desc: 'Studied every day for a week', cat: 'periodic' },
  { name: 'Monthly Champion', desc: 'Studied every week for a month', cat: 'periodic' },
  { name: 'Yearly Champion', desc: 'Maintained study streak for a year', cat: 'periodic' },
  { name: 'Grand Champion', desc: 'Reached elite study level', cat: 'elite' },
  { name: 'Royal Champion', desc: 'Achieved royal study status', cat: 'elite' },
  { name: 'Super Champion', desc: 'Super study achievement unlocked', cat: 'elite' },
  { name: 'Ultimate Champion', desc: 'Ultimate study mastery achieved', cat: 'elite' },
  { name: 'Very Helpful', desc: 'Received 5 helpful ratings from peers', cat: 'contribution' },
  { name: 'Super Resourceful', desc: 'Shared 10 study resources with community', cat: 'contribution' },
  { name: 'Lifesaver', desc: 'Helped 20 students during study sessions', cat: 'contribution' },
  { name: 'Celebrity', desc: 'Most popular study partner of the month', cat: 'contribution' },
  { name: 'First Session', desc: 'Completed first study session', cat: 'first' },
  { name: 'First Match', desc: 'Matched with another user', cat: 'first' },
  { name: 'First Request', desc: 'Sent first match request', cat: 'first' },
  { name: 'First Comment', desc: 'Left first comment', cat: 'first' }
];

const userBadges = [
  { u: 2, b: 1, s: true, awarded_at: '2026-05-13, 13:00' }, 
  { u: 2, b: 2, s: true, awarded_at: '2026-05-14, 12:00' }, 
  { u: 2, b: 7, s: true, awarded_at: '2026-05-15, 16:00' }, 
  { u: 2, b: 15, s: false, awarded_at: '2026-05-16, 11:00' }, 
  { u: 3, b: 1, s: true, awarded_at: '2026-05-17, 14:00' }, 
  { u: 3, b: 7, s: true, awarded_at: '2026-05-18, 18:00' }, 
  { u: 4, b: 1, s: true, awarded_at: '2026-05-12, 09:00' }, 
  { u: 4, b: 2, s: true, awarded_at: '2026-05-12, 11:00' }, 
  { u: 4, b: 8, s: false, awarded_at: '2026-05-12, 17:00' }
];

const friendships = [
  { u: 2, f: 3 }, { u: 2, f: 4 }, { u: 2, f: 5 },
  { u: 3, f: 2 }, { u: 3, f: 4 }, { u: 3, f: 5 },
  { u: 4, f: 2 }, { u: 4, f: 3 }, { u: 4, f: 5 },
  { u: 5, f: 2 }, { u: 5, f: 3 }, { u: 5, f: 4 },
  { u: 12, f: 8 }, { u: 12, f: 20 },
];

const friendRequests = [
  { sender: 6, receiver: 2 },
  { sender: 7, receiver: 2 },
  { sender: 8, receiver: 3 },
  { sender: 9, receiver: 4 },
  { sender: 10, receiver: 2 },
  { sender: 11, receiver: 5 },
  { sender: 2, receiver: 13 },
  { sender: 3, receiver: 14 },
  { sender: 15, receiver: 6 },
  { sender: 16, receiver: 7 },
  { sender: 17, receiver: 8 },
  { sender: 18, receiver: 9 }
];

const userModules = [
  {u: 2, m: 1}, {u: 2, m: 2}, {u: 3, m: 2}, {u: 4, m: 1}, {u: 5, m: 2}, 
  {u: 6, m: 5}, {u: 7, m: 2}, {u: 8, m: 1}, {u: 9, m: 5}, {u: 10, m: 2}, 
  {u: 11, m: 4}, {u: 12, m: 4}, {u: 13, m: 4}, {u: 14, m: 4}, {u: 15, m: 1},
  {u: 17, m: 1}, {u: 18, m: 1}, {u: 20, m: 1}, {u: 20, m: 3}
];

const userLanguages = [
  {u: 2, l: 1}, {u: 2, l: 2}, {u: 2, l: 5}, {u: 3, l: 1}, {u: 3, l: 4},
  {u: 4, l: 1}, {u: 4, l: 5}, {u: 5, l: 1}, {u: 6, l: 1}, {u: 7, l: 1},
  {u: 8, l: 1}, {u: 9, l: 1}, {u: 10, l: 1}, {u: 11, l: 1}, {u: 11, l: 13}, 
  {u: 12, l: 1}, {u: 12, l: 13}, {u: 13, l: 1}, {u: 17, l: 5}, {u: 18, l: 7}, 
  {u: 20, l: 1}, {u: 20, l: 8}, {u: 20, l: 5}
];  

const userInterests = [
  {u: 2, i: 1}, {u: 2, i: 8}, {u: 2, i: 11}, {u: 3, i: 2}, {u: 4, i: 1}, 
  {u: 4, i: 7}, {u: 4, i: 10}, {u: 4, i: 11}, {u: 5, i: 2}, {u: 6, i: 1}, 
  {u: 7, i: 2}, {u: 8, i: 3}, {u: 10, i: 2}, {u: 12, i: 4}, {u: 13, i: 1}, 
  {u: 15, i: 1}, {u: 16, i: 5}, {u: 18, i: 9}, {u: 19, i: 13}, {u: 20, i: 3}
];

const matchPrefs = [
  {u:2, mods:'[1, 2, 3]', sched:true, auto:false, days:'["mon", "wed", "fri"]', modes:'["online", "campus"]', times:'["morning", "afternoon"]', st:'09:00', en:'17:00', rate:'High', style:'collaborative', langs:'[1, 3]', dur:60, pri:1, gen:'any', lvl:'same'},
  {u:3, mods:'[1, 2]', sched:true, auto:false, days:'["tue", "thu"]', modes:'["campus"]', times:'["afternoon"]', st:'13:00', en:'18:00', rate:'Medium', style:'discussion', langs:'[1]', dur:45, pri:1, gen:'any', lvl:'same'},
  {u:4, mods:'[2, 3]', sched:true, auto:true, days:'["mon", "tue", "wed"]', modes:'["online"]', times:'["morning"]', st:'08:00', en:'12:00', rate:'High', style:'quiet', langs:'[1]', dur:90, pri:2, gen:'any', lvl:'higher'}
];

const conversations = [
  {name: null, type: 'friend'},
  {name: 'DIT - FOP2', type: 'group'},
  {name: 'BED Project Team', type: 'group'},
  {name: 'SP IT Community', type: 'community'}
];

const convMembers = [
  {c: 1, u: 2}, {c: 1, u: 3},
  {c: 2, u: 2}, {c: 2, u: 3}, {c: 2, u: 4}, {c: 2, u: 5}, {c: 2, u: 6},
  {c: 3, u: 2}, {c: 3, u: 3}, {c: 3, u: 4}, {c: 3, u: 5},
  {c: 4, u: 2}, {c: 4, u: 3}, {c: 4, u: 4}, {c: 4, u: 5}, {c: 4, u: 6}, {c: 4, u: 7}, {c: 4, u: 8}, {c: 4, u: 9}, {c: 4, u: 10}, {c: 4, u: 11}
];

const messages = [
  {c: 1, s: 3, t:'Hey James! Ready for the study session tomorrow?', a: false, ca: '2026-05-14 10:00:00'},
  {c: 1, s: 2, t:'Yes! I have been reviewing the BED notes. See you at 3pm!', a: false, ca: '2026-05-14 10:05:00'},
  {c: 2, s: 4, t:'James, did you finish the PDS assignment?', a: false, ca: '2026-05-14 11:00:00'},
  {c: 2, s: 2, t:'Almost done! Need help with Question 5 though', a: false, ca: '2026-05-14 11:02:00'},
  {c: 2, s: 3, t:'Sure, let me take a look and get back to you', a: false, ca: '2026-05-14 11:10:00'},
  {c: 3, s: 2, t:'Team, let us divide the BED project tasks', a: false, ca: '2026-05-14 12:00:00'},
  {c: 3, s: 3, t:'I can handle the front-end part', a: false, ca: '2026-05-14 12:05:00'},
  {c: 3, s: 4, t:'I will do the API endpoints', a: false, ca: '2026-05-14 12:06:00'},
  {c: 3, s: 5, t:'I will work on the database schema', a: false, ca: '2026-05-14 12:10:00'},
  {c: 4, s: 5, t:'Welcome to the SP IT Community! Introduce yourselves here.', a: true, ca: '2026-05-14 09:00:00'},
  {c: 4, s: 2, t:'Hi everyone! Year 2 DIT student here', a: false, ca: '2026-05-14 09:05:00'},
  {c: 4, s: 7, t:'Hello! Year 1 DIT, excited to be here!', a:false, ca: '2026-05-14 09:10:00'}
];

const sessions = [
  {h: 2, title:'BED Project Sprint', goal:'Finish Tutorial Q1-Q3', dur:3600, focus:2700, brk:900, status:'completed'},
  {h: 2, title:'FOP2 Exam Prep', goal:'Review Chapter 5-7', dur:5400, focus:4500, brk:900, status:'active'}
];

const sessMembers = [
  { sid: 2, u: 2, st: 'focus', timer: 1080, prog: 60 },
  { sid: 2, u: 12, st: 'need_help', timer: 230, prog: 75 },
  { sid: 2, u: 22, st: 'break', timer: 360, prog: 45 }
];

const microGoals = [
  { sid: 2, u: 2, title: 'Finish Tutorial Q1-Q3', desc: 'Complete the active FOP2 revision target.', pos: 1, st: 'active' }
];

const microGoalProgress = [
  { goal: 1, u: 2, progress: 60, completed: false },
  { goal: 1, u: 12, progress: 75, completed: false },
  { goal: 1, u: 22, progress: 45, completed: false }
];

const events = [
  {cr: 2, name: 'Marcus Tan', topic: 'BED Project Discussion', loc: 'Online (Zoom)', date: '2025-11-14', time: '3:00 PM - 5:00 PM', type: 'Study Session'},
  {cr: 2, name: 'Emily Wong', topic: 'FOP2 Mock Test Prep', loc: 'Library Level 6', date: '2025-11-18', time: '10:00 AM - 12:00 PM', type: 'Exam Prep'},
  {cr: 2, name: 'Sarah Lim', topic: 'DF Design Review', loc: 'Campus Lab 2', date: '2025-11-20', time: '2:00 PM - 4:00 PM', type: 'Study Session'},
  {cr: 3, name: 'James Lee', topic: 'PDS Group Consultation', loc: 'Online (Teams)', date: '2025-11-22', time: '9:00 AM - 10:30 AM', type: 'Consultation'}
];

const eventParts = [
  {e: 1, u: 3}, {e: 1, u: 2}, {e: 2, u: 3}, {e: 2, u: 4},
  {e: 3, u: 3}, {e: 3, u: 2}, {e: 4, u: 3}, {e: 4, u: 2}, {e: 4, u: 4}
];

const eventComments = [
  {e: 1, u: 3, t: 'I will prepare the API documentation beforehand.'},
  {e: 1, u: 2, t: 'Great! I will review the ERD diagram.'},
  {e: 2, u: 4, t: 'Should we bring printed notes?'}
];

const notifications = [
  {u: 2, title: 'New Match Request', msg: 'Zara Teo sent you a study request', type: 'info', read: false, nav: 'request-detail'},
  {u: 2, title: 'Session Reminder', msg: 'BED Project Sprint starts in 30 minutes', type: 'warning', read: false, nav: 'study-session'},
  {u: 2, title: 'Badge Earned!', msg: 'You earned the "20 Hours" badge!', type: 'success', read: true, nav: 'profile'},
  {u: 2, title: 'Match Accepted', msg: 'Marcus Tan accepted your study request', type: 'success', read: true, nav: 'match-status'},
  {u: 3, title: 'New Match Request', msg: 'James Lee sent you a study request', type: 'info', read: true, nav: 'request-detail'},
  {u: 4, title: 'New Match Request', msg: 'James Lee sent you a study request for FOP2', type: 'info', read: false, nav: 'request-detail'}
];

async function seed() {
  console.log('Seeding data...');

  const hash = await bcrypt.hash('password123', 10);

  // 1. Countries
  if (countries.length > 0) {
    const placeholders = countries.map((_, i) => `($${i * 2 + 1}, $${i * 2 + 2})`).join(', ');
    const values = countries.flatMap(c => [c.name, c.code]);
    await pool.query(`INSERT INTO Country ("name", "code") VALUES ${placeholders} ON CONFLICT DO NOTHING`, values);
  }

  // 2. Institutions
  if (institutions.length > 0) {
    const placeholders = institutions.map((_, i) => `($${i * 4 + 1}, $${i * 4 + 2}, $${i * 4 + 3}, $${i * 4 + 4})`).join(', ');
    const values = institutions.flatMap(i => [i.name, i.location, i.country_id, i.website]);
    await pool.query(`INSERT INTO Institution ("name", "location", "country_id", "website") VALUES ${placeholders} ON CONFLICT DO NOTHING`, values);
  }

  // 3. Diplomas
  if (diplomas.length > 0) {
    const placeholders = diplomas.map((_, i) => `($${i * 3 + 1}, $${i * 3 + 2}, $${i * 3 + 3})`).join(', ');
    const values = diplomas.flatMap(d => [d.institution_id, d.name, d.code]);
    await pool.query(`INSERT INTO Diploma ("institution_id", "name", "code") VALUES ${placeholders} ON CONFLICT DO NOTHING`, values);
  }

  // 4. Modules
  if (modules.length > 0) {
    const placeholders = modules.map((_, i) => `($${i * 4 + 1}, $${i * 4 + 2}, $${i * 4 + 3}, $${i * 4 + 4})`).join(', ');
    const values = modules.flatMap(m => [m.diploma_id, m.name, m.code, m.description]);
    await pool.query(`INSERT INTO Module ("diploma_id", "name", "code", "description") VALUES ${placeholders} ON CONFLICT DO NOTHING`, values);
  }

  // 5. Languages
  if (languages.length > 0) {
    const placeholders = languages.map((_, i) => `($${i * 2 + 1}, $${i * 2 + 2})`).join(', ');
    const values = languages.flatMap(l => [l.name, l.code]);
    await pool.query(`INSERT INTO Language ("name", "code") VALUES ${placeholders} ON CONFLICT DO NOTHING`, values);
  }

  // 6. Interests
  if (interests.length > 0) {
    const placeholders = interests.map((_, i) => `($${i + 1})`).join(', ');
    const values = interests.map(i => i.name);
    await pool.query(`INSERT INTO Interest ("name") VALUES ${placeholders} ON CONFLICT DO NOTHING`, values);
  }

  // 7. Users
  if (users.length > 0) {
    const placeholders = users.map((_, i) => `($${i * 10 + 1}, $${i * 10 + 2}, $${i * 10 + 3}, $${i * 10 + 4}, $${i * 10 + 5}, $${i * 10 + 6}, $${i * 10 + 7}, $${i * 10 + 8}, $${i * 10 + 9}, $${i * 10 + 10})`).join(', ');
    const values = users.flatMap(u => [u.username, u.email, hash, u.name, u.inst, u.dip, u.year, u.bio, u.is_online, u.has_completed_quiz]);
    await pool.query(`INSERT INTO "User" ("username", "email", "password", "name", "institution_id", "diploma_id", "year", "profile_text", "is_online", "has_completed_quiz") VALUES ${placeholders} ON CONFLICT DO NOTHING`, values);
  }

  // 8. Match Requests
  if (matchRequests.length > 0) {
    const placeholders = matchRequests.map((_, i) => `($${i * 9 + 1}, $${i * 9 + 2}, $${i * 9 + 3}, $${i * 9 + 4}, $${i * 9 + 5}, $${i * 9 + 6}, $${i * 9 + 7}, $${i * 9 + 8}, $${i * 9 + 9})`).join(', ');
    const values = matchRequests.flatMap(r => [r.s, r.r, r.m, r.tp, r.t, r.l, r.ty, r.st, r.msg]);
    await pool.query(`INSERT INTO MatchRequest ("sender_id", "receiver_id", "module_id", "topic", "time_slot", "location", "type", "status", "message") VALUES ${placeholders} ON CONFLICT DO NOTHING`, values);
  }

  // 9. Badges
  if (badges.length > 0) {
    const placeholders = badges.map((_, i) => `($${i * 3 + 1}, $${i * 3 + 2}, $${i * 3 + 3})`).join(', ');
    const values = badges.flatMap(b => [b.name, b.desc, b.cat]);
    await pool.query(`INSERT INTO Badge ("name", "description", "category") VALUES ${placeholders} ON CONFLICT DO NOTHING`, values);
  }

  // 10. User Badges
  if (userBadges.length > 0) {
    const placeholders = userBadges.map((_, i) => `($${i * 4 + 1}, $${i * 4 + 2}, $${i * 4 + 3}, $${i * 4 + 4})`).join(', ');
    const values = userBadges.flatMap(ub => [ub.u, ub.b, ub.s, ub.awarded_at]);
    await pool.query(`INSERT INTO UserBadge ("user_id", "badge_id", "is_selected", "awarded_at") VALUES ${placeholders} ON CONFLICT DO NOTHING`, values);
  }

  // 11. Friendships
  if (friendships.length > 0) {
    const placeholders = friendships.map((_, i) => `($${i * 2 + 1}, $${i * 2 + 2})`).join(', ');
    const values = friendships.flatMap(f => [f.u, f.f]);
    await pool.query(`INSERT INTO Friendship ("user_id", "friend_id") VALUES ${placeholders} ON CONFLICT DO NOTHING`, values);
  }

  // 11.5. FriendRequest
  if (friendRequests.length > 0) {
    const placeholders = friendRequests.map((_, i) => `($${i * 2 + 1}, $${i * 2 + 2})`).join(', ');
    const values = friendRequests.flatMap(fr => [fr.sender, fr.receiver]);
    await pool.query(`INSERT INTO FriendRequest ("sender_id", "receiver_id") VALUES ${placeholders} ON CONFLICT DO NOTHING`, values);
  }

  // 12. UserModule
  if (userModules.length > 0) {
    const placeholders = userModules.map((_, i) => `($${i * 2 + 1}, $${i * 2 + 2})`).join(', ');
    const values = userModules.flatMap(um => [um.u, um.m]);
    await pool.query(`INSERT INTO UserModule ("user_id", "module_id") VALUES ${placeholders} ON CONFLICT DO NOTHING`, values);
  }

  // 13. UserLanguage
  if (userLanguages.length > 0) {
    const placeholders = userLanguages.map((_, i) => `($${i * 2 + 1}, $${i * 2 + 2})`).join(', ');
    const values = userLanguages.flatMap(ul => [ul.u, ul.l]);
    await pool.query(`INSERT INTO UserLanguage ("user_id", "language_id") VALUES ${placeholders} ON CONFLICT DO NOTHING`, values);
  }

  // 14. UserInterest
  if (userInterests.length > 0) {
    const placeholders = userInterests.map((_, i) => `($${i * 2 + 1}, $${i * 2 + 2})`).join(', ');
    const values = userInterests.flatMap(ui => [ui.u, ui.i]);
    await pool.query(`INSERT INTO UserInterest ("user_id", "interest_id") VALUES ${placeholders} ON CONFLICT DO NOTHING`, values);
  }

  // 15. MatchPreference
  if (matchPrefs.length > 0) {
    const placeholders = matchPrefs.map((_, i) => `($${i * 16 + 1}, $${i * 16 + 2}, $${i * 16 + 3}, $${i * 16 + 4}, $${i * 16 + 5}, $${i * 16 + 6}, $${i * 16 + 7}, $${i * 16 + 8}, $${i * 16 + 9}, $${i * 16 + 10}, $${i * 16 + 11}, $${i * 16 + 12}, $${i * 16 + 13}, $${i * 16 + 14}, $${i * 16 + 15}, $${i * 16 + 16})`).join(', ');
    const values = matchPrefs.flatMap(p => [p.u, p.mods, p.sched, p.auto, p.days, p.modes, p.times, p.st, p.en, p.rate, p.style, p.langs, p.dur, p.pri, p.gen, p.lvl]);
    await pool.query(`INSERT INTO MatchPreference ("user_id", "selected_modules", "schedule_set", "auto_match_enabled", "availability_days", "selected_modes", "selected_times", "start_time", "end_time", "match_rate", "style", "selected_languages", "duration", "priority", "gender_pref", "partner_level") VALUES ${placeholders} ON CONFLICT DO NOTHING`, values);
  }

  // 16. ChatConversation
  if (conversations.length > 0) {
    const placeholders = conversations.map((_, i) => `($${i * 2 + 1}, $${i * 2 + 2})`).join(', ');
    const values = conversations.flatMap(c => [c.name, c.type]);
    await pool.query(`INSERT INTO ChatConversation ("name", "type") VALUES ${placeholders} ON CONFLICT DO NOTHING`, values);
  }

  // 17. ConversationMember
  if (convMembers.length > 0) {
    const placeholders = convMembers.map((_, i) => `($${i * 2 + 1}, $${i * 2 + 2})`).join(', ');
    const values = convMembers.flatMap(cm => [cm.c, cm.u]);
    await pool.query(`INSERT INTO ConversationMember ("conversation_id", "user_id") VALUES ${placeholders} ON CONFLICT DO NOTHING`, values);
  }

  // 18. ChatMessage
  if (messages.length > 0) {
    const placeholders = messages.map((_, i) => `($${i * 5 + 1},$${i * 5 + 2},$${i * 5 + 3},$${i * 5 + 4},$${i * 5 + 5})`).join(', ');
    const values = messages.flatMap(m => [m.c, m.s, m.t, m.a, m.ca]);
    await pool.query(`INSERT INTO ChatMessage ("conversation_id","sender_id","text","is_announcement","created_at") VALUES ${placeholders} ON CONFLICT DO NOTHING`, values);
  }

  // 19. StudySession
  if (sessions.length > 0) {
    const placeholders = sessions.map((_, i) => `($${i*7+1},$${i*7+2},$${i*7+3},$${i*7+4},$${i*7+5},$${i*7+6},$${i*7+7})`).join(', ');
    const values = sessions.flatMap(s => [s.h, s.title, s.goal, s.dur, s.focus, s.brk, s.status]);
    await pool.query(`INSERT INTO StudySession ("host_id","title","micro_goal","duration","focus_duration","break_duration","status") VALUES ${placeholders} ON CONFLICT DO NOTHING`, values);
  }

  // 20. SessionMember
  if (sessMembers.length > 0) {
    const placeholders = sessMembers.map((_, i) => `($${i*5+1},$${i*5+2},$${i*5+3},$${i*5+4},$${i*5+5})`).join(', ');
    const values = sessMembers.flatMap(sm => [sm.sid, sm.u, sm.st, sm.timer, sm.prog]);
    await pool.query(`INSERT INTO SessionMember ("session_id","user_id","status","status_timer","progress") VALUES ${placeholders} ON CONFLICT DO NOTHING`, values);
  }

  // 20a. Micro-goals
  if (microGoals.length > 0) {
    const placeholders = microGoals.map((_, i) => `($${i*6+1},$${i*6+2},$${i*6+3},$${i*6+4},$${i*6+5},$${i*6+6}, CASE WHEN $${i*6+6}::VARCHAR = 'active' THEN CURRENT_TIMESTAMP ELSE NULL END)`).join(', ');
    const values = microGoals.flatMap(mg => [mg.sid, mg.u, mg.title, mg.desc, mg.pos, mg.st]);
    await pool.query(`INSERT INTO micro_goals ("study_session_id","created_by_user_id","title","description","queue_position","status","activated_at") VALUES ${placeholders} ON CONFLICT DO NOTHING`, values);
  }

  // 20b. Micro-goal progress
  if (microGoalProgress.length > 0) {
    const placeholders = microGoalProgress.map((_, i) => `($${i*4+1},$${i*4+2},$${i*4+3},$${i*4+4})`).join(', ');
    const values = microGoalProgress.flatMap(mgp => [mgp.goal, mgp.u, mgp.progress, mgp.completed]);
    await pool.query(`INSERT INTO micro_goal_progress ("micro_goal_id","user_id","progress_percent","is_completed") VALUES ${placeholders} ON CONFLICT DO NOTHING`, values);
  }

  // 21. CalendarEvent
  if (events.length > 0) {
    const placeholders = events.map((_, i) => `($${i*7+1},$${i*7+2},$${i*7+3},$${i*7+4},$${i*7+5},$${i*7+6},$${i*7+7})`).join(', ');
    const values = events.flatMap(e => [e.cr, e.name, e.topic, e.loc, e.date, e.time, e.type]);
    await pool.query(`INSERT INTO CalendarEvent ("creator_id","name","topic","location","event_date","booking_time","type") VALUES ${placeholders} ON CONFLICT DO NOTHING`, values);
  }

  // 22. EventParticipant
  if (eventParts.length > 0) {
    const placeholders = eventParts.map((_, i) => `($${i * 2 + 1}, $${i * 2 + 2})`).join(', ');
    const values = eventParts.flatMap(ep => [ep.e, ep.u]);
    await pool.query(`INSERT INTO EventParticipant ("event_id", "user_id") VALUES ${placeholders} ON CONFLICT DO NOTHING`, values);
  }

  // 23. EventComment
  if (eventComments.length > 0) {
    const placeholders = eventComments.map((_, i) => `($${i*3+1},$${i*3+2},$${i*3+3})`).join(', ');
    const values = eventComments.flatMap(ec => [ec.e, ec.u, ec.t]);
    await pool.query(`INSERT INTO EventComment ("event_id","user_id","text") VALUES ${placeholders} ON CONFLICT DO NOTHING`, values);
  }

  // 24. Notification
  if (notifications.length > 0) {
    const placeholders = notifications.map((_, i) => `($${i*6+1},$${i*6+2},$${i*6+3},$${i*6+4},$${i*6+5},$${i*6+6})`).join(', ');
    const values = notifications.flatMap(n => [n.u, n.title, n.msg, n.type, n.read, n.nav]);
    await pool.query(`INSERT INTO Notification ("user_id","title","message","type","is_read","nav_target") VALUES ${placeholders} ON CONFLICT DO NOTHING`, values);
  }

  console.log('Seeding completed successfully.');
}

seed()
  .then(() => pool.end())
  .catch((err) => {
    console.error('Seeding failed:', err);
    pool.end(); 
    process.exit(1); 
});
