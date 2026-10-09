/* AarogyaSight's lightweight, in-browser regional disease assistant. */
(() => {
  'use strict';

  const root = document.createElement('div');
  root.className = 'as-chat-root';
  root.innerHTML = `
    <button class="as-chat-launcher" type="button" aria-label="Open AarogyaSight disease assistant" aria-expanded="false" aria-controls="as-chat-panel" title="Ask about regional disease risk">
      <svg class="as-chat-mark" viewBox="0 0 48 48" fill="none" aria-hidden="true"><path class="as-chat-mark-leaf" d="M24 39V21m0 10C12 31 7 24 7 13c11 0 17 6 17 18Zm0-8c0-13 7-19 18-19 0 11-5 20-18 23" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/><path class="as-chat-mark-smile" d="M18 38h12" stroke="currentColor" stroke-width="2.3" stroke-linecap="round"/></svg>
    </button>
    <section class="as-chat-panel" id="as-chat-panel" role="dialog" aria-label="AarogyaSight disease assistant" aria-hidden="true" inert>
      <header class="as-chat-head">
        <div class="as-chat-avatar" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none"><path d="M12 21v-8m0 4c-5 0-8-3-8-8 5 0 8 3 8 8Zm0-3c0-6 3-9 8-10 0 5-2 9-8 10Z" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg></div>
        <div class="as-chat-title"><strong>AarogyaSight Assistant</strong><span class="as-chat-region">Regional disease insights</span></div>
        <button class="as-chat-close" type="button" aria-label="Close assistant"><svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="m6 6 12 12M18 6 6 18" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg></button>
      </header>
      <div class="as-chat-content">
        <div class="as-chat-messages" role="log" aria-live="polite" aria-relevant="additions text">
          <div class="as-chat-intro"><strong>Hi, I can help you explore disease risk.</strong><br>Ask which disease has the highest sample risk in a region, compare the listed cities, or ask a general question about dengue, malaria, chikungunya, or Zika.</div>
          <div class="as-chat-suggestions" aria-label="Suggested questions">
            <button class="as-chat-suggestion" type="button">Highest risk in my region?</button>
            <button class="as-chat-suggestion" type="button">Compare diseases in Nagpur</button>
            <button class="as-chat-suggestion" type="button">Dengue cases in Pune</button>
          </div>
        </div>
        <div class="as-chat-input-area">
          <form class="as-chat-form">
            <label class="sr-only" for="as-chat-input">Ask a disease or regional risk question</label>
            <textarea class="as-chat-input" id="as-chat-input" rows="1" maxlength="600" placeholder="Ask about disease risk in a region…"></textarea>
            <button class="as-chat-send" type="submit" aria-label="Send message"><svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="m21 3-7.2 18-3.5-7.3L3 10.2 21 3Z" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/><path d="M10.3 13.7 15 9" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/></svg></button>
          </form>
          <p class="as-chat-disclaimer">Regional scores are illustrative, not case counts or medical advice. General health notes link to <a href="https://www.who.int/" target="_blank" rel="noopener noreferrer">WHO</a>.</p>
        </div>
      </div>
    </section>`;
  document.body.appendChild(root);

  const launcher = root.querySelector('.as-chat-launcher');
  const panel = root.querySelector('.as-chat-panel');
  const close = root.querySelector('.as-chat-close');
  const messages = root.querySelector('.as-chat-messages');
  const form = root.querySelector('.as-chat-form');
  const input = root.querySelector('.as-chat-input');
  const send = root.querySelector('.as-chat-send');
  const regionLabel = root.querySelector('.as-chat-region');
  let busy = false;

  const diseases = {
    dengue: {
      label: 'Dengue',
      url: 'https://www.who.int/news-room/fact-sheets/detail/dengue-and-severe-dengue',
      about: 'Dengue is a viral infection spread to people by infected mosquitoes.',
      symptoms: 'Dengue can cause high fever, headache, pain behind the eyes, muscle and joint pain, nausea, and rash. Symptoms overlap with other illnesses, so this assistant cannot identify the cause.',
      prevention: 'WHO advises avoiding mosquito bites and reducing breeding sites: use suitable repellent and screens, wear covering clothing, and empty, cover, and clean water-holding containers regularly.'
    },
    malaria: {
      label: 'Malaria',
      url: 'https://www.who.int/news-room/fact-sheets/detail/malaria',
      about: 'Malaria is a parasite infection transmitted to people mainly through bites from infected Anopheles mosquitoes.',
      symptoms: 'Common early malaria symptoms include fever, headache, and chills. These can resemble other illnesses; suspected malaria needs prompt testing by a health professional.',
      prevention: 'Risk reduction includes avoiding mosquito bites. WHO also recommends prevention medicines for some people travelling to malaria-risk areas; ask a qualified clinician about personal needs.'
    },
    chikungunya: {
      label: 'Chikungunya',
      url: 'https://www.who.int/news-room/questions-and-answers/item/chikungunya',
      about: 'Chikungunya is a viral disease spread by bites from infected mosquitoes, and often causes fever and severe joint pain.',
      symptoms: 'Symptoms can include sudden fever, severe joint pain, muscle pain, headache, rash, and fatigue. Symptoms may overlap with dengue and other infections.',
      prevention: 'WHO recommends preventing mosquito bites and removing standing water where mosquitoes can breed. Follow local public-health guidance for your area.'
    },
    zika: {
      label: 'Zika',
      url: 'https://www.who.int/news-room/fact-sheets/detail/zika-virus',
      about: 'Zika is a viral infection spread mainly by Aedes mosquitoes; it can also spread through sexual contact.',
      symptoms: 'Many people with Zika have no symptoms. When symptoms occur, they can include rash, mild fever, conjunctivitis, muscle or joint pain, and headache. Zika infection during pregnancy needs prompt clinical guidance.',
      prevention: 'WHO recommends preventing mosquito bites and reducing mosquito breeding sites. For pregnancy-related concerns, contact a qualified health professional.'
    }
  };

  const normalize = value => value.toLowerCase().replace(/[^a-z0-9\s-]/g, ' ').replace(/\s+/g, ' ').trim();
  const includesTerm = (text, term) => (` ${text} `).includes(` ${term} `);
  const snapshot = () => window.AarogyaSightChatData?.snapshot?.() || null;
  const currentCity = () => {
    const data = snapshot();
    const selected = data?.cities?.find(city => city.name === data.currentCity);
    return selected || data?.cities?.[0] || null;
  };
  const scoreFor = (city, diseaseName, data) => Math.max(8, city.baseRisk + Number(data.diseaseAdjustments[diseaseName] || 0));
  const riskLevel = value => value >= 60 ? 'high' : value >= 40 ? 'moderate' : 'lower';
  const formatRanking = city => {
    const data = snapshot();
    return Object.keys(data.diseaseAdjustments)
      .map(name => ({name, value: scoreFor(city, name, data)}))
      .sort((a, b) => b.value - a.value);
  };
  const regionAliases = {
    'maharashtra': 'Nagpur',
    'madhya pradesh': 'Bhopal',
    'tamil nadu': 'Chennai',
    'telangana': 'Hyderabad'
  };
  const findRegion = text => {
    const data = snapshot();
    if (!data) return null;
    const regionNames = [...data.cities.map(city => city.name), ...Object.keys(regionAliases), 'pune'];
    const hit = regionNames.find(name => new RegExp(`(^|\\b)${name}(\\b|$)`, 'i').test(text));
    if (!hit) return null;
    if (hit.toLowerCase() === 'pune') return {name: 'Pune', state: 'Maharashtra', baseRisk: null};
    const cityName = regionAliases[hit.toLowerCase()] || hit;
    return data.cities.find(city => city.name.toLowerCase() === cityName.toLowerCase()) || null;
  };
  const findDisease = text => {
    const alias = {dengue: ['dengue'], malaria: ['malaria'], chikungunya: ['chikungunya', 'chik'], zika: ['zika']};
    for (const [key, info] of Object.entries(diseases)) {
      if (alias[key].some(name => includesTerm(text, name))) return info.label;
    }
    return null;
  };
  const appendMessage = (text, role = 'bot', sourceUrl = null) => {
    const bubble = document.createElement('div');
    bubble.className = `as-chat-message ${role === 'user' ? 'is-user' : 'is-bot'}`;
    bubble.textContent = text;
    if (sourceUrl) {
      const link = document.createElement('a');
      link.href = sourceUrl;
      link.target = '_blank';
      link.rel = 'noopener noreferrer';
      link.textContent = 'Read more from WHO';
      const icon = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      icon.setAttribute('viewBox', '0 0 24 24');
      icon.setAttribute('aria-hidden', 'true');
      const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      path.setAttribute('d', 'M14 3h7v7m-1-6-9 9M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6');
      path.setAttribute('fill', 'none'); path.setAttribute('stroke', 'currentColor'); path.setAttribute('stroke-width', '1.7'); path.setAttribute('stroke-linecap', 'round'); path.setAttribute('stroke-linejoin', 'round');
      icon.appendChild(path); link.appendChild(icon); bubble.appendChild(link);
    }
    messages.appendChild(bubble);
    messages.scrollTop = messages.scrollHeight;
    return bubble;
  };
  const addTyping = () => {
    const typing = document.createElement('div');
    typing.className = 'as-chat-typing';
    typing.setAttribute('role', 'status');
    typing.setAttribute('aria-label', 'Assistant is responding');
    typing.innerHTML = '<i></i><i></i><i></i>';
    messages.appendChild(typing);
    messages.scrollTop = messages.scrollHeight;
    return typing;
  };

  async function puneCaseReply() {
    const base = (window.CLIMATEGUARD_API_BASE || 'http://127.0.0.1:8002').replace(/\/+$/, '');
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 4500);
    try {
      const response = await fetch(`${base}/api/dengue/pune`, {signal: controller.signal});
      const payload = await response.json();
      if (payload.status !== 'success' || !Array.isArray(payload.data) || !payload.data.length) {
        return 'The connected Pune dengue-data endpoint does not currently provide a verified case-count file, so I can’t report a confirmed number. This dashboard only has illustrative risk scores for its sample cities.';
      }
      const rows = payload.data.filter(row => row && Number.isFinite(Number(row.cases)) && row.week_start);
      rows.sort((a, b) => String(a.week_start).localeCompare(String(b.week_start)));
      if (!rows.length) return 'The Pune dengue feed is available, but it has no usable dated case counts right now.';
      const latest = rows.at(-1);
      return `The connected Pune dengue series reports ${Number(latest.cases).toLocaleString()} cases for the week of ${latest.week_start}. Source: ${latest.source || payload.source || 'connected case-data feed'}. This is a reported count, not a prediction.`;
    } catch (error) {
      return 'I can’t reach the Pune case-data endpoint right now, so I don’t have a verified dengue case count. Check that the ClimateGuard backend and an official CSV feed are available.';
    } finally {
      clearTimeout(timer);
    }
  }

  function regionRiskReply(city, requestedDisease = null) {
    if (!city || city.baseRisk === null) return 'I don’t have sample risk estimates for that region. The dashboard currently represents Nagpur, Bhopal, Chennai, and Hyderabad. Select one of those districts to ask about its local sample risk.';
    if (requestedDisease) {
      const data = snapshot();
      const value = scoreFor(city, requestedDisease, data);
      return `${requestedDisease} has the ${riskLevel(value)} illustrative risk score in ${city.name}, ${city.state}: ${value}%. This is a sample dashboard estimate, not a confirmed case count or official local surveillance figure.`;
    }
    const ranking = formatRanking(city);
    return `For ${city.name}, ${city.state}, the sample dashboard ranking is: ${ranking.map((item, i) => `${i + 1}. ${item.name} — ${item.value}%`).join('; ')}. Dengue is highest in this illustrative dataset. These are risk scores, not disease counts or verified local case totals.`;
  }

  async function answerQuestion(rawQuestion) {
    const text = normalize(rawQuestion);
    const diseaseName = findDisease(text);
    const info = diseaseName ? diseases[normalize(diseaseName)] : null;
    const mentionedCity = findRegion(text);
    const city = mentionedCity || currentCity();
    const asksCases = /\b(case|cases|count|counts|number|numbers|prevalence|incidence|common|most affected|worst affected|trending)\b/.test(text);
    const asksPrevention = /\b(prevent|prevention|avoid|protect|protection|safe|safety|precaution|precautions|stop|control)\b/.test(text);
    const asksSymptoms = /\b(symptom|symptoms|signs|feel|feeling|indication|show up|look like)\b/.test(text);
    const asksPersonalHealth = /\b(do i have|could i have|am i infected|my symptoms|my child has|i have (a )?(fever|chills|rash|headache|joint pain|body aches|vomiting|nausea|symptoms))\b/.test(text);
    const asksTreatment = /\b(treat|treatment|cure|medicine|medication|diagnos|recover|recovery|home remedy|remedy)\b/.test(text);
    const asksDefinition = /\b(what is|what are|tell me|explain|about|spread|transmit|transmission|cause|causes|how does|how do)\b/.test(text);
    const asksCityRanking = /\b(which city|which region|which state|where|across|compare cities|highest city|highest region|most affected|worst affected)\b/.test(text);
    const asksRanking = /\b(which disease|what disease|highest|most|top disease|rank|compare diseases|more risk|more in|in my region|in my area|here|right now|currently|at present)\b/.test(text);
    const asksRisk = /\b(risk|score|outbreak|likelihood|higher|high|danger|alert|forecast|prediction)\b/.test(text);
    const asksClimate = /\b(climate|weather|rain|rainfall|humidity|temperature|standing water|mosquito|mosquitoes|environment)\b/.test(text);

    if ((asksPersonalHealth || asksTreatment) && !asksPrevention && !asksSymptoms && !asksDefinition) {
      return {text: 'I can share general disease information, but I can’t assess personal symptoms, diagnose illness, or recommend treatment. Please contact a qualified health professional for personal care. The WHO disease pages linked below provide general information.', url: info?.url || 'https://www.who.int/health-topics'};
    }
    if (info && asksSymptoms) return {text: `${info.symptoms} If you’re concerned about symptoms, contact a healthcare professional; this chat cannot diagnose illness.`, url: info.url};
    if (info && asksPrevention) return {text: info.prevention, url: info.url};
    if (asksPrevention) return {text: 'To lower mosquito-borne disease risk, use a locally recommended repellent, wear clothing that covers skin, fit screens where possible, and empty or cover water containers weekly. Follow local public-health instructions. This is general prevention information, not personal medical advice.', url: diseases.dengue.url};
    if (info && asksTreatment) return {text: `${info.label}: care depends on a clinician’s assessment, and this chat cannot recommend a personal treatment or medicine. Please contact a qualified health professional, especially for severe symptoms. Do not self-medicate.`, url: info.url};
    if (info && asksDefinition) return {text: info.about, url: info.url};

    if (asksCases) {
      const mentionedPune = /\bpune\b/.test(text);
      if (mentionedPune && (!diseaseName || diseaseName === 'Dengue')) return {text: await puneCaseReply()};
      if (asksCityRanking && !mentionedCity) {
        const data = snapshot();
        const name = diseaseName || data?.currentDisease || 'Dengue';
        const ranked = data.cities.map(item => ({city: item, value: scoreFor(item, name, data)})).sort((a, b) => b.value - a.value);
        return {text: `I don’t have verified case totals to compare cities. By illustrative ${name} risk score, the sample order is ${ranked.map((item, i) => `${i + 1}. ${item.city.name} — ${item.value}%`).join('; ')}. These are demo scores, not reported case counts.`};
      }
      const targetCity = findRegion(text) || city;
      if (!targetCity || targetCity.baseRisk === null) return {text: 'I don’t have verified case counts for that location. The only possible case-count feed in this prototype is Pune dengue, and it may be unavailable. For other supported regions I can compare illustrative risk scores, not actual case numbers.'};
      return {text: `I don’t have verified disease case counts for ${targetCity.name}, ${targetCity.state}. I can only compare the dashboard’s illustrative risk scores: ${regionRiskReply(targetCity)} You can ask for a “risk ranking” to compare the sample estimates.`};
    }

    if (asksClimate) return {text: `The dashboard shows sample environmental indicators such as rainfall, humidity, temperature, and standing water, which can affect mosquito breeding conditions. For ${city?.name || 'the selected region'}, its displayed scores are illustrative demo data and do not establish that an outbreak is occurring. ${regionRiskReply(city)}`};

    if (asksCityRanking) {
      const data = snapshot();
      const name = diseaseName || data?.currentDisease || 'Dengue';
      const ranked = data.cities.map(item => ({city: item, value: scoreFor(item, name, data)})).sort((a, b) => b.value - a.value);
      return {text: `By sample ${name} risk score, the listed city order is ${ranked.map((item, i) => `${i + 1}. ${item.city.name} — ${item.value}%`).join('; ')}. This is a demonstration ranking, not a comparison of reported cases or validated forecasts.`};
    }
    if (info && mentionedCity) return {text: regionRiskReply(mentionedCity, diseaseName)};
    if (info && asksRisk) return {text: regionRiskReply(city, diseaseName)};
    if (asksRanking) return {text: regionRiskReply(city, diseaseName)};
    if (info) return {text: `${info.about} I can also summarize common symptoms or prevention information. The risk percentages in this app are illustrative and do not show actual case counts.`, url: info.url};

    if (/\b(hello|hi|hey|good morning|good afternoon)\b/.test(text)) {
      return {text: `Hello! The dashboard is currently focused on ${city?.name || 'a sample region'}. Ask which disease has the highest sample risk there, compare cities, or ask a general question about dengue, malaria, chikungunya, or Zika.`};
    }
    if (/\b(help|what can you do|examples|questions)\b/.test(text)) {
      return {text: 'Try: “Which disease has the highest risk in Nagpur?”, “Compare cities for malaria”, “How can I prevent dengue?”, or “Dengue cases in Pune”. Case counts are only shown if a verified connected feed is available.'};
    }
    return {text: `I may not have understood that phrasing. I can help with disease explanations, symptoms, prevention, sample risk rankings, and comparisons for Nagpur, Bhopal, Chennai, and Hyderabad. Current dashboard region: ${city?.name || 'not available'}. Ask “Tell me about malaria”, “How do I avoid dengue?”, or “Which disease has the highest risk in my area?”. I can’t invent verified case counts; those need a current official data feed.`};
  }

  function setOpen(open) {
    launcher.setAttribute('aria-expanded', String(open));
    panel.setAttribute('aria-hidden', String(!open));
    panel.inert = !open;
    panel.classList.toggle('is-open', open);
    if (open) {
      const city = currentCity();
      regionLabel.textContent = city ? `Regional insights · ${city.name}` : 'Regional disease insights';
      window.setTimeout(() => input.focus(), 80);
    } else launcher.focus();
  }
  launcher.addEventListener('click', () => setOpen(launcher.getAttribute('aria-expanded') !== 'true'));
  close.addEventListener('click', () => setOpen(false));
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && launcher.getAttribute('aria-expanded') === 'true') setOpen(false);
  });

  async function submitQuestion(question) {
    const clean = question.trim();
    if (!clean || busy) return;
    root.querySelector('.as-chat-suggestions')?.remove();
    appendMessage(clean, 'user');
    input.value = '';
    input.style.height = '35px';
    busy = true;
    send.disabled = true;
    const typing = addTyping();
    try {
      const response = await answerQuestion(clean);
      typing.remove();
      appendMessage(response.text, 'bot', response.url || null);
    } catch (error) {
      typing.remove();
      appendMessage('I couldn’t complete that answer. Please try asking about a sample region or one of the supported diseases.', 'bot');
    } finally {
      busy = false;
      send.disabled = false;
      input.focus();
    }
  }

  form.addEventListener('submit', event => {
    event.preventDefault();
    submitQuestion(input.value);
  });
  input.addEventListener('keydown', event => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      form.requestSubmit();
    }
  });
  input.addEventListener('input', () => {
    input.style.height = '35px';
    input.style.height = `${Math.min(input.scrollHeight, 90)}px`;
  });
  root.querySelectorAll('.as-chat-suggestion').forEach(button => button.addEventListener('click', () => submitQuestion(button.textContent)));
})();
