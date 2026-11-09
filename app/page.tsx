'use client';

import { useState } from 'react';
import {
  ArrowDownRight, ArrowRight, ArrowUpRight, Check, ChevronDown, CircleHelp,
  ClipboardList, Clock3, LocateFixed, MapPin, Menu, MessageCircle, ShieldCheck,
  Sparkles, Trees, X, Zap,
} from 'lucide-react';

const sampleIssues = [
  { type: 'ROAD & PAVEMENT', title: 'Pothole on Model Town Road', place: 'Model Town, Jalandhar', status: 'In progress', tone: 'orange', age: 'Reported 2 hours ago', icon: 'road' },
  { type: 'WASTE & CLEANLINESS', title: 'Overflowing community bin', place: 'Urban Estate Phase II', status: 'Under review', tone: 'sage', age: 'Reported yesterday', icon: 'waste' },
  { type: 'STREETLIGHTS', title: 'Streetlight not working', place: 'Adarsh Nagar, Jalandhar', status: 'Assigned', tone: 'blue', age: 'Reported 2 days ago', icon: 'light' },
];

function Brand() {
  return <a className="brand" href="#top" aria-label="FixMyStreet home"><span className="brand-mark"><span /></span><span>fixmy<span className="brand-light">street</span></span></a>;
}

export default function Home() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [faqOpen, setFaqOpen] = useState<number | null>(0);
  const [trackId, setTrackId] = useState('');
  const [trackMessage, setTrackMessage] = useState('');
  const [reportName, setReportName] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('Pothole');
  const [location, setLocation] = useState('');
  const [reportMessage, setReportMessage] = useState('');

  function handleTrack(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!trackId.trim()) { setTrackMessage('Enter a complaint ID to continue.'); return; }
    setTrackMessage('Complaint tracking will be available when the reporting system is connected.');
  }
  async function handleReport(e: React.FormEvent<HTMLFormElement>) {
  e.preventDefault();
  setReportMessage('Submitting your complaint...');

  try {
    const response = await fetch('https://fixmystreet-backend-o9ox.onrender.com/report', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name: reportName,
        description: description,
        category: category,
        location: location,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error('Could not submit complaint.');
    }

    setReportMessage(data.message + ' Status: ' + data.status);

    setReportName('');
    setDescription('');
    setCategory('Pothole');
    setLocation('');

  } catch (error) {
    setReportMessage(
      error instanceof Error ? error.message : 'Something went wrong.'
    );
  }
}

  const faqs = [
    ['What can I report?', 'You can report public-space issues such as potholes, damaged roads, overflowing waste bins, water leakage, drainage blockages and broken streetlights.'],
    ['Do I need to create an account?', 'You will be able to browse public issues without an account. An account will be required to submit a report and receive updates.'],
    ['Does FixMyStreet send complaints directly to the municipality?', 'During the pilot, reports will be managed through the FixMyStreet workflow. Official municipal routing will only be enabled after a formal integration or partnership is established.'],
    ['Can I track what happens after I report an issue?', 'Yes. Each submitted report will receive a reference ID and a status timeline, so you can follow its progress.'],
  ];

  return (
    <main id="top">
      <div className="announcement"><span className="announcement-dot" /> PILOT PROJECT <span className="announcement-sep">/</span> JALANDHAR, PUNJAB <ArrowUpRight size={12} /></div>
      <header className="site-header wrap">
        <Brand />
        <nav className={menuOpen ? 'nav nav-open' : 'nav'} aria-label="Main navigation">
          <a href="#how-it-works" onClick={() => setMenuOpen(false)}>How it works</a>
          <a href="#community" onClick={() => setMenuOpen(false)}>Community</a>
          <a href="#faq" onClick={() => setMenuOpen(false)}>FAQs</a>
        </nav>
        <div className="header-actions">
          <a className="login-link" href="#get-started" >Log in <ArrowUpRight size={14} /></a>
          
          <a className="button button-dark button-small" href="#get-started">Report an issue <ArrowUpRight size={14} /></a>
        </div>
        <button className="mobile-menu" aria-label={menuOpen ? 'Close menu' : 'Open menu'} onClick={() => setMenuOpen(!menuOpen)}>{menuOpen ? <X /> : <Menu />}</button>
      </header>

      <section className="hero wrap">
        <div className="hero-copy">
          <div className="eyebrow"><span className="eyebrow-line" /> YOUR NEIGHBOURHOOD, YOUR VOICE</div>
          <h1>A better street<br />starts with <em>you.</em></h1>
          <p className="hero-lede">See something that needs fixing? Make it known. FixMyStreet helps communities report local problems and follow the journey towards a solution.</p>
          <div className="hero-buttons"><a className="button button-orange" href="#report">Report a problem <ArrowUpRight size={16} /></a><a className="text-link" href="#how-it-works">See how it works <ArrowDownRight size={16} /></a></div>
          <div className="hero-note"><span className="avatar-stack"><i>J</i><i>P</i><i>+</i></span><span>Built around the people who<br /><strong>know their streets best.</strong></span></div>
        </div>
        <div className="hero-visual">
          <div className="visual-label"><span className="live-dot" /> THE STREETS AROUND YOU</div>
          <div className="map-art" role="img" aria-label="Illustrated neighbourhood map with sample reported issue locations">
            <div className="map-grid" />
            <div className="map-block block-a" /><div className="map-block block-b" /><div className="map-block block-c" /><div className="map-block block-d" />
            <div className="map-park"><Trees size={24} /><span>NEIGHBOURHOOD PARK</span></div>
            <div className="map-road road-one" /><div className="map-road road-two" /><div className="map-road road-three" />
            <span className="map-street street-one">MODEL TOWN ROAD</span><span className="map-street street-two">LINK ROAD</span>
            <div className="map-pin pin-one"><MapPin size={17} fill="currentColor" /></div><div className="map-pin pin-two"><MapPin size={17} fill="currentColor" /></div><div className="map-pin pin-three"><MapPin size={17} fill="currentColor" /></div>
            <div className="map-you"><span /> YOU ARE HERE</div>
            <div className="map-scale">31.3260° N&nbsp;&nbsp; 75.5762° E</div>
          </div>
          <div className="map-card"><div className="map-card-top"><span className="issue-icon"><Zap size={16} /></span><span className="mini-status"><i /> IN PROGRESS</span></div><span className="card-kicker">ROAD & PAVEMENT</span><strong>Pothole on Model Town Road</strong><span className="map-card-bottom"><MapPin size={12} /> Model Town, Jalandhar <span>2h ago</span></span></div>
          <div className="visual-caption">A clearer picture of what needs attention.</div>
        </div>
        <div className="hero-index"><span>01</span> / A MORE CONNECTED COMMUNITY</div>
      </section>

      <section className="ticker"><div className="ticker-inner"><span>NOTICE IT</span><span className="ticker-star">✳</span><span>REPORT IT</span><span className="ticker-star">✳</span><span>TRACK IT</span><span className="ticker-star">✳</span><span>MAKE IT BETTER</span><span className="ticker-star">✳</span><span>NOTICE IT</span><span className="ticker-star">✳</span><span>REPORT IT</span><span className="ticker-star">✳</span><span>TRACK IT</span></div></section>

      <section className="intro section-pad wrap" id="how-it-works">
        <div className="section-meta"><span>01 / THE IDEA</span><span>SMALL ACTION. SHARED IMPACT.</span></div>
        <div className="intro-grid"><h2>Good streets don't<br />happen <em>by accident.</em></h2><div className="intro-text"><p>Every pothole, blocked drain or broken streetlight affects someone's day. But too often, the problem gets noticed and then gets lost.</p><p>We're creating a simple, transparent way to bring local issues into view — and keep them there until there's progress.</p><a className="text-link" href="#process">Get to know the process <ArrowUpRight size={15} /></a></div></div>
      </section>

      <section className="process-section" id="process"><div className="wrap section-pad"><div className="section-meta light-meta"><span>02 / HOW IT WORKS</span><span>FOUR STEPS. ONE BETTER STREET.</span></div><div className="process-heading"><h2>From noticed<br />to <em>sorted.</em></h2><p>No complicated forms. No wondering what happened next. Just a clearer way to get local problems moving.</p></div><div className="steps-grid"><article className="step"><span className="step-number">01</span><div className="step-icon"><MessageCircle /></div><h3>Spot something?</h3><p>Notice an issue in your neighbourhood? Open FixMyStreet and tell us what's going on.</p><span className="step-foot">YOU KNOW YOUR STREET <ArrowUpRight size={14} /></span></article><article className="step"><span className="step-number">02</span><div className="step-icon"><LocateFixed /></div><h3>Pin it & report it.</h3><p>Add a photo, a short description and the location. We'll help organise the details.</p><span className="step-foot">MAKE IT CLEAR <ArrowUpRight size={14} /></span></article><article className="step"><span className="step-number">03</span><div className="step-icon"><ClipboardList /></div><h3>Follow the progress.</h3><p>Get a reference number and see updates as your report moves through the process.</p><span className="step-foot">STAY IN THE LOOP <ArrowUpRight size={14} /></span></article><article className="step"><span className="step-number">04</span><div className="step-icon"><Check /></div><h3>See the difference.</h3><p>Check the resolution update and help build a more accountable local community.</p><span className="step-foot">BETTER, TOGETHER <ArrowUpRight size={14} /></span></article></div></div></section>

      <section className="community-section section-pad wrap" id="community"><div className="section-meta"><span>03 / YOUR COMMUNITY</span><span>LOCAL ISSUES, IN THE OPEN</span></div><div className="community-heading"><div><h2>What's happening<br />around <em>you?</em></h2><p>A snapshot of the kinds of issues communities can bring forward.</p></div><a className="text-link" href="#get-started">Explore the issue map <ArrowUpRight size={15} /></a></div><div className="issue-list">{sampleIssues.map((issue, i) => <article className="issue-row" key={issue.title}><span className="issue-number">0{i + 1}</span><div className={`issue-symbol ${issue.tone}`}>{issue.icon === 'road' ? <Zap /> : issue.icon === 'waste' ? <Trees /> : <Sparkles />}</div><div className="issue-main"><span className="card-kicker">{issue.type}</span><h3>{issue.title}</h3><span className="issue-place"><MapPin size={12} /> {issue.place}</span></div><div className={`issue-status ${issue.tone}`}><i /> {issue.status}</div><span className="issue-age">{issue.age}</span><ArrowUpRight className="issue-arrow" size={18} /></article>)}</div><p className="sample-note">Illustrative examples for the website preview — live community reports will appear here after launch.</p></section>

      <section className="section-pad wrap" id="report">
  <div className="section-meta">
    <span>REPORT AN ISSUE</span>
    <span>YOUR VOICE MATTERS</span>
  </div>

  <h2>Tell us what's <em>wrong.</em></h2>

  <form onSubmit={handleReport}>

    <label>Your Name</label>
    <input
      value={reportName}
      onChange={e => setReportName(e.target.value)}
      required
      placeholder="Enter your name"
    />

    <label>Problem Description</label>
    <textarea
      value={description}
      onChange={e => setDescription(e.target.value)}
      required
      placeholder="Describe the problem"
    />

    <label>Category</label>
    <select
      value={category}
      onChange={e => setCategory(e.target.value)}
    >
      <option value="Pothole">Pothole</option>
      <option value="Waste">Waste</option>
      <option value="Streetlight">Streetlight</option>
      <option value="Drainage">Drainage</option>
      <option value="Water Leakage">Water Leakage</option>
      <option value="Other">Other</option>
    </select>

    <label>Location</label>
    <input
      value={location}
      onChange={e => setLocation(e.target.value)}
      required
      placeholder="Enter your location"
    />

    <button type="submit" className="button button-orange">
      Submit Complaint
    </button>

    {reportMessage && (
      <p role="status">{reportMessage}</p>
    )}

     </form>
     </section>
      <section className="track-section"><div className="wrap track-inner"><div><div className="eyebrow"><span className="eyebrow-line" /> NO REPORT LEFT IN THE DARK</div><h2>Know where<br />things <em>stand.</em></h2><p>Every report should have a next step. When the reporting system is live, use your reference number to follow its progress.</p></div><form className="track-card" onSubmit={handleTrack}><div className="track-card-icon"><Clock3 /></div><span className="card-kicker">COMPLAINT TRACKER</span><h3>Got a report ID?</h3><p>Enter your reference number to check the latest update.</p><label htmlFor="track-id">YOUR REFERENCE NUMBER</label><div className="track-input"><input id="track-id" value={trackId} onChange={e => { setTrackId(e.target.value); setTrackMessage(''); }} placeholder="e.g. FMS-JAL-000124" /><button type="submit" aria-label="Check complaint"><ArrowUpRight size={19} /></button></div>{trackMessage && <span className="track-message" role="status">{trackMessage}</span>}<span className="track-secure"><ShieldCheck size={13} /> Your report details stay protected.</span></form></div></section>

      <section className="values-section section-pad wrap"><div className="section-meta"><span>04 / WHAT WE BELIEVE</span><span>BUILT ON TRUST</span></div><div className="values-grid"><h2>Better systems.<br /><em>Better streets.</em></h2><div className="value-card"><span>01</span><ShieldCheck /><h3>Transparency matters.</h3><p>Clear updates help people understand what's happening with the issues they raise.</p></div><div className="value-card"><span>02</span><MapPin /><h3>Local knowledge counts.</h3><p>The people who live in a neighbourhood are often the first to notice what needs attention.</p></div><div className="value-card"><span>03</span><CircleHelp /><h3>Every report has a voice.</h3><p>A simple, accessible process makes it easier for more people to take part.</p></div></div></section>

      <section className="faq-section section-pad" id="faq"><div className="wrap faq-grid"><div><div className="eyebrow"><span className="eyebrow-line" /> A FEW THINGS YOU MIGHT WONDER</div><h2>Good questions.<br /><em>Honest answers.</em></h2><p>Something else on your mind? We'd love to hear from you.</p><a className="text-link" href="mailto:hello@fixmystreet.example">Get in touch <ArrowUpRight size={15} /></a></div><div className="faq-list">{faqs.map(([q, a], i) => <article className={`faq-item ${faqOpen === i ? 'faq-active' : ''}`} key={q}><button onClick={() => setFaqOpen(faqOpen === i ? null : i)} aria-expanded={faqOpen === i}><span>{q}</span><ChevronDown size={18} /></button>{faqOpen === i && <p>{a}</p>}</article>)}</div></div></section>

      <section className="cta-section wrap" id="get-started"><div className="cta-pattern" /><div className="cta-content"><span className="cta-kicker"><span /> JALANDHAR PILOT</span><h2>Your street.<br />Your say. <em>Let's fix it.</em></h2><p>Change starts when someone speaks up. Be that someone.</p><a className="button button-light" href="mailto:hello@fixmystreet.example?subject=FixMyStreet%20pilot%20interest">Join the pilot <ArrowUpRight size={16} /></a><span className="cta-small">Early access interest · Jalandhar, Punjab</span></div><div className="cta-side-note">A LITTLE CARE<br />GOES A LONG WAY <ArrowDownRight size={17} /></div></section>

      <footer className="footer wrap"><div className="footer-top"><div><Brand /><p>A clearer way to care for the<br />places we call home.</p></div><div className="footer-links"><div><span>EXPLORE</span><a href="#how-it-works">How it works</a><a href="#community">Community</a><a href="#faq">FAQs</a></div><div><span>THE PROJECT</span><a href="#get-started">Join the pilot</a><a href="mailto:hello@fixmystreet.example">Contact</a></div></div></div><div className="footer-bottom"><span>© 2026 FIXMYSTREET. MADE FOR BETTER NEIGHBOURHOODS.</span><span>JALANDHAR, PUNJAB <MapPin size={12} /></span><a href="#top">BACK TO TOP ↑</a></div></footer>
    </main>
  );
}
