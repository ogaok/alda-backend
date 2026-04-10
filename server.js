// ALDA Backend API Server v2.1
// AI provider: Google Gemini (gemini-2.5-flash)
// Routes: GET /api/health  POST /api/analyze  POST /api/build

const express = require('express');
const cors = require('cors');
const { GoogleGenerativeAI } = require('@google/generative-ai');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// ── Middleware ────────────────────────────────────────────────────
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json({ limit: '10mb' }));

// ── Rate limiting ─────────────────────────────────────────────────
const rateLimitMap = new Map();
const RATE_LIMIT = 200; // per hour per key — Gemini paid tier allows 2000 RPM
const RATE_WINDOW = 60 * 60 * 1000;

function checkRateLimit(key) {
  const now = Date.now();
  const requests = (rateLimitMap.get(key) || []).filter(t => now - t < RATE_WINDOW);
  if (requests.length >= RATE_LIMIT) return false;
  requests.push(now);
  rateLimitMap.set(key, requests);
  return true;
}

// ── AIQF Seven Pillars Framework definition ───────────────────────
const FRAMEWORKS = {
  bloom: {
    name: "Bloom's Taxonomy",
    description: 'Cognitive verb analysis and complexity leveling of learning outcomes'
  },
  addie: {
    name: 'ADDIE Model',
    description: 'Iterative instructional design and continuous improvement framework'
  },
  aiqf: {
    name: 'Seven Pillars Instructional Quality Framework (AIQF)',
    version: '2.0',
    maxScore: 85,
    description: 'Proprietary framework evaluating courses across seven critical dimensions with 38 research-backed indicators',
    pillars: [
      {
        code: 'P1', name: 'Clarity of Purpose', maxScore: 13,
        question: 'Does the learner know exactly what they are entering, why it matters, and what they need to succeed?',
        indicators: [
          { id: 'P1-A1', name: 'Intent Statement',              type: 'anchor', points: 3 },
          { id: 'P1-A2', name: 'Entry Requirements',            type: 'anchor', points: 3 },
          { id: 'P1-A3', name: 'Success Criteria Transparency', type: 'anchor', points: 3 },
          { id: 'P1-G1', name: 'Navigation Legibility',         type: 'guide',  points: 2 },
          { id: 'P1-G2', name: 'Community and Conduct Norms',   type: 'guide',  points: 2 }
        ]
      },
      {
        code: 'P2', name: 'Outcome Architecture', maxScore: 13,
        question: 'Are learning outcomes structured as a coherent, progressive system that actually guides design decisions?',
        indicators: [
          { id: 'P2-A1', name: 'Cognitive Precision',         type: 'anchor', points: 3 },
          { id: 'P2-A2', name: 'Vertical Alignment',          type: 'anchor', points: 3 },
          { id: 'P2-A3', name: 'Complexity Distribution',     type: 'anchor', points: 3 },
          { id: 'P2-G1', name: 'Learner-Centric Framing',     type: 'guide',  points: 2 },
          { id: 'P2-G2', name: 'External Standards Linkage',  type: 'guide',  points: 2 }
        ]
      },
      {
        code: 'P3', name: 'Evidence Design', maxScore: 13,
        question: 'Is the system for capturing and evaluating learning evidence rigorous, transparent, and genuinely aligned to outcomes?',
        indicators: [
          { id: 'P3-A1', name: 'Outcome-Evidence Traceability', type: 'anchor', points: 3 },
          { id: 'P3-A2', name: 'Criteria Transparency',         type: 'anchor', points: 3 },
          { id: 'P3-A3', name: 'Formative Checkpoint System',   type: 'anchor', points: 3 },
          { id: 'P3-G1', name: 'Method Variety',                type: 'guide',  points: 2 },
          { id: 'P3-G2', name: 'Submission Clarity',            type: 'guide',  points: 2 }
        ]
      },
      {
        code: 'P4', name: 'Knowledge Pathways', maxScore: 12,
        question: 'Does the instructional content guide learners forward, or does it simply accumulate?',
        indicators: [
          { id: 'P4-A1', name: 'Outcome Sufficiency',        type: 'anchor', points: 3 },
          { id: 'P4-A2', name: 'Developmental Sequencing',   type: 'anchor', points: 3 },
          { id: 'P4-G1', name: 'Format Diversity',           type: 'guide',  points: 2 },
          { id: 'P4-G2', name: 'Workload Calibration',       type: 'guide',  points: 2 },
          { id: 'P4-G3', name: 'Source Integrity',           type: 'guide',  points: 2 }
        ]
      },
      {
        code: 'P5', name: 'Active Meaning-Making', maxScore: 12,
        question: 'Is the learner actively constructing understanding, or passively consuming content?',
        indicators: [
          { id: 'P5-A1', name: 'Applied Learning Requirement',     type: 'anchor', points: 3 },
          { id: 'P5-A2', name: 'Purposeful Interaction Design',    type: 'anchor', points: 3 },
          { id: 'P5-G1', name: 'Embedded Cognitive Activation',    type: 'guide',  points: 2 },
          { id: 'P5-G2', name: 'Instructor Presence Architecture', type: 'guide',  points: 2 },
          { id: 'P5-G3', name: 'Engagement Distribution',          type: 'guide',  points: 2 }
        ]
      },
      {
        code: 'P6', name: 'Equitable Access', maxScore: 12,
        question: 'Can every learner — regardless of ability, device, background, or circumstance — access and engage with this course?',
        indicators: [
          { id: 'P6-A1', name: 'Minimum Accessibility Standards',     type: 'anchor', points: 3 },
          { id: 'P6-A2', name: 'Multi-Modal Content Provision',       type: 'anchor', points: 3 },
          { id: 'P6-G1', name: 'Support Infrastructure Signposting',  type: 'guide',  points: 2 },
          { id: 'P6-G2', name: 'Accommodation Pathway Clarity',       type: 'guide',  points: 2 },
          { id: 'P6-G3', name: 'Technology Barrier Minimization',     type: 'guide',  points: 2 }
        ]
      },
      {
        code: 'P7', name: 'Adaptive Coherence', maxScore: 10,
        question: 'Does the course function as an integrated, evolving system — or as a collection of disconnected parts?',
        indicators: [
          { id: 'P7-A1', name: 'Full-System Alignment Audit',       type: 'anchor', points: 3 },
          { id: 'P7-A2', name: 'Logical Progression Architecture',  type: 'anchor', points: 3 },
          { id: 'P7-G1', name: 'Learner Feedback Integration',      type: 'guide',  points: 2 },
          { id: 'P7-G2', name: 'Iterative Design Evidence',         type: 'guide',  points: 2 }
        ]
      }
    ],
    qualityTiers: [
      { name: '★ ALDA Certified',  range: '77-85', requirement: 'All Anchors met' },
      { name: 'High Distinction',  range: '68-76', requirement: 'All Anchors met' },
      { name: 'Developing',        range: '51-67', requirement: 'May have Anchor gaps' },
      { name: 'Needs Redesign',    range: '<51',   requirement: 'Critical failures present' }
    ]
  },
  ubd: {
    name: 'Understanding by Design',
    description: 'Backward design — start with outcomes and evidence before content'
  },
  solo: {
    name: 'SOLO Taxonomy',
    description: 'Sequencing and progression of learning complexity across course units'
  }
};

// ── Gemini helper ─────────────────────────────────────────────────
function getGeminiModel(apiKey) {
  const key = process.env.GEMINI_API_KEY || apiKey;
  if (!key) throw new Error('No Gemini API key. Set GEMINI_API_KEY in Render environment variables.');
  const genAI = new GoogleGenerativeAI(key);
  return genAI.getGenerativeModel({
    model: 'gemini-2.5-flash',
    generationConfig: { responseMimeType: 'application/json' },
  });
}

async function callGemini(model, systemPrompt, userPrompt, retries = 3) {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const result = await model.generateContent(systemPrompt + '\n\n' + userPrompt);
      const text = result.response.text();
      const clean = text.replace(/```json|```/g, '').trim();
      return JSON.parse(clean);
    } catch (err) {
      const is429 = err.status === 429 || err.message?.includes('429') || err.message?.includes('RESOURCE_EXHAUSTED');
      if (is429 && attempt < retries) {
        // exponential backoff: 2s, 4s, 8s
        const wait = Math.pow(2, attempt) * 1000;
        console.log(`[ALDA] Gemini 429 — retrying in ${wait/1000}s (attempt ${attempt}/${retries})`);
        await new Promise(r => setTimeout(r, wait));
        continue;
      }
      throw err;
    }
  }
}

// ── Health check ──────────────────────────────────────────────────
app.get('/api/health', (req, res) => {
  res.json({
    status: 'healthy',
    version: '2.1.0',
    ai: 'gemini-2.5-flash',
    timestamp: new Date().toISOString()
  });
});

// ── Analysis endpoint ─────────────────────────────────────────────
app.post('/api/analyze', async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Missing or invalid authorization header.' });
    }

    const apiKey = authHeader.substring(7);

    if (!checkRateLimit(apiKey)) {
      return res.status(429).json({ error: 'Rate limit exceeded. Please try again later.' });
    }

    const { lmsType, courseData, context, depth, frameworks } = req.body;

    if (!courseData) {
      return res.status(400).json({ error: 'Missing course data.' });
    }

    console.log(`[ALDA] Analysing ${lmsType} course: ${context?.courseName || 'Unknown'}`);

    // Sanitise — keep payload small for Gemini
    const safe = {
      title:               courseData.title       || 'Untitled',
      objectives:          courseData.objectives  || '',
      userMessage:         courseData.userMessage || '',
      conversationHistory: courseData.conversationHistory || '',
      modules:     (courseData.modules     || []).slice(0, 15).map(m => ({
        title: m.title || m.name || 'Untitled module',
        itemCount: m.itemCount || m.items?.length || 0,
      })),
      assignments: (courseData.assignments || []).slice(0, 15).map(a => ({
        title: a.title || 'Untitled',
      })),
      pageCount:      courseData.pageCount      || 0,
      customCriteria: courseData.customCriteria || [],
    };

    const activeFrameworks = frameworks || ['aiqf', 'bloom'];
    const model = getGeminiModel(apiKey);
    const result = await callGemini(
      model,
      getAnalysisSystemPrompt(activeFrameworks),
      buildAnalysisPrompt(safe, lmsType, activeFrameworks, depth)
    );

    console.log(`[ALDA] Analysis done. Suggestions: ${result.suggestions?.length || 0}`);

    res.json({
      aiqf:        result.aiqf        || null,
      scores:      result.scores      || { structure: 0, engagement: 0, assessment: 0 },
      suggestions: result.suggestions || [],
      summary:     result.summary     || '',
      timestamp:   new Date().toISOString(),
    });

  } catch (error) {
    console.error('[ALDA] Analysis error:', error.message);

    if (error.message?.includes('API_KEY_INVALID') || error.status === 400) {
      return res.status(401).json({ error: 'Invalid Gemini API key. Check ALDA Settings → API & LMS.' });
    }
    if (error.status === 429) {
      return res.status(429).json({ error: 'Gemini rate limit exceeded. Try again shortly.' });
    }
    if (error.status === 403) {
      return res.status(402).json({ error: 'Gemini quota exceeded. Check your Google AI billing.' });
    }

    res.status(500).json({ error: error.message || 'Analysis failed. Please try again.' });
  }
});

// ── Build endpoint ────────────────────────────────────────────────
app.post('/api/build', async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Missing or invalid authorization header.' });
    }

    const apiKey = authHeader.substring(7);

    if (!checkRateLimit(apiKey)) {
      return res.status(429).json({ error: 'Rate limit exceeded. Please try again later.' });
    }

    const { mode, lmsType, context, specifications } = req.body;
    console.log(`[ALDA] Building course — mode: ${mode}, lms: ${lmsType}`);

    const model = getGeminiModel(apiKey);
    const result = await callGemini(
      model,
      getCourseBuilderSystemPrompt(),
      buildCoursePrompt(mode, specifications, lmsType)
    );

    res.json({
      courseStructure: result,
      timestamp: new Date().toISOString(),
    });

  } catch (error) {
    console.error('[ALDA] Build error:', error.message);

    if (error.message?.includes('API_KEY_INVALID') || error.status === 400) {
      return res.status(401).json({ error: 'Invalid Gemini API key. Check ALDA Settings → API & LMS.' });
    }
    if (error.status === 403) {
      return res.status(402).json({ error: 'Gemini quota exceeded. Check your Google AI billing.' });
    }

    res.status(500).json({ error: error.message || 'Course build failed. Please try again.' });
  }
});

// ── System prompts ────────────────────────────────────────────────
function getAnalysisSystemPrompt(frameworks) {
  return `You are ALDA (AI Learning Design Assistant), an expert instructional designer specialising in the Seven Pillars Instructional Quality Framework (AIQF v2.0).

AIQF Seven Pillars:
P1. Clarity of Purpose     (max 13 pts) — learner orientation, course entry clarity, intent statement
P2. Outcome Architecture   (max 13 pts) — measurable, progressive, Bloom-aligned learning objectives
P3. Evidence Design        (max 13 pts) — assessment alignment, rubric transparency, formative checkpoints
P4. Knowledge Pathways     (max 12 pts) — content sequencing, scaffolding, workload balance
P5. Active Meaning-Making  (max 12 pts) — application tasks, discussion, higher-order thinking
P6. Equitable Access       (max 12 pts) — accessibility, multi-modal content, inclusive design
P7. Adaptive Coherence     (max 10 pts) — course integration, feedback loops, iterative improvement

Quality tiers:
- ALDA Certified:  77-85 pts AND all Anchors met
- High Distinction: 68-76 pts AND all Anchors met
- Developing:       51-67 pts
- Needs Redesign:   below 51 pts OR any Anchor unmet

Anchors (⚓) are critical indicators worth 3 pts each. Guides (◈) are enhancement indicators worth 2 pts each.
Be specific, actionable, and grounded in pedagogical evidence.
Always respond with valid JSON only — no markdown, no preamble.`;
}

function getCourseBuilderSystemPrompt() {
  return `You are ALDA (AI Learning Design Assistant), an expert course designer applying the Seven Pillars Instructional Quality Framework (AIQF v2.0).

Design principles:
1. Backward design — define objectives first, then assessments, then content
2. Align all objectives, content, and assessments
3. Include diverse content types for different learning styles
4. Build in formative and summative assessments
5. Design for accessibility and inclusivity
6. Apply Active Meaning-Making — learners must apply, not just consume

Always respond with valid JSON only — no markdown, no preamble.`;
}

// ── Prompt builders ───────────────────────────────────────────────
function buildAnalysisPrompt(courseData, lmsType, frameworks, depth) {
  const fwList = frameworks
    .map(fw => `- ${FRAMEWORKS[fw]?.name || fw}: ${FRAMEWORKS[fw]?.description || ''}`)
    .join('\n');

  const includesAIQF = frameworks.includes('aiqf');

  const ctx = courseData.conversationHistory
    ? `\nConversation so far:\n${courseData.conversationHistory}\n`
    : '';

  const msg = courseData.userMessage
    ? `\nUser request: ${courseData.userMessage}\n`
    : '';

  return `Analyse this ${lmsType || 'online'} course.

Title: ${courseData.title}
Modules (${courseData.modules.length}): ${courseData.modules.map(m => m.title).join(', ') || 'None listed'}
Assignments (${courseData.assignments.length}): ${courseData.assignments.map(a => a.title).join(', ') || 'None listed'}
Learning objectives: ${courseData.objectives || 'Not provided'}
Page count: ${courseData.pageCount}
${ctx}${msg}
Analysis depth: ${depth || 'standard'}
Frameworks: ${fwList}
${courseData.customCriteria?.length ? `Custom criteria: ${courseData.customCriteria.map(c => c.criterion).join('; ')}` : ''}

Return this exact JSON structure:
{
  ${includesAIQF ? `"aiqf": {
    "totalScore": <number 0-85>,
    "percentage": <number 0-100>,
    "tier": "ALDA Certified|High Distinction|Developing|Needs Redesign",
    "pillars": {
      "p1_clarity":    <0-13>,
      "p2_outcomes":   <0-13>,
      "p3_evidence":   <0-13>,
      "p4_pathways":   <0-12>,
      "p5_engagement": <0-12>,
      "p6_access":     <0-12>,
      "p7_coherence":  <0-10>
    },
    "unmetAnchors": ["P1-A1", "P2-A3"],
    "allAnchorsMet": <true|false>
  },` : ''}
  "scores": {
    "structure":  <0-100>,
    "engagement": <0-100>,
    "assessment": <0-100>
  },
  "suggestions": [
    {
      "title": "string",
      "description": "string — specific, actionable, with pedagogical rationale",
      "priority": "high|medium|low",
      "framework": "aiqf|bloom|addie",
      "pillar": "P1|P2|P3|P4|P5|P6|P7",
      "indicatorType": "anchor|guide",
      "action": {
        "label": "string",
        "type": "add|modify|remove",
        "target": "modules|assignments|assessments|content|activities"
      }
    }
  ],
  "summary": "2-3 sentence overall assessment of this course"
}`;
}

function buildCoursePrompt(mode, specifications, lmsType) {
  return `${mode === 'new' ? 'Create a complete new course' : 'Enhance this existing course'} for ${lmsType || 'online'} LMS.

Specifications:
${JSON.stringify(specifications, null, 2)}

Return this exact JSON structure:
{
  "courseName": "string",
  "description": "string",
  "learningObjectives": ["string"],
  "modules": [
    {
      "name": "string",
      "description": "string",
      "learningObjectives": ["string"],
      "content": [
        {
          "type": "lecture|reading|video|assignment|quiz|discussion",
          "title": "string",
          "description": "string",
          "estimatedTime": "string"
        }
      ]
    }
  ],
  "assessments": [
    {
      "type": "quiz|assignment|project|discussion",
      "title": "string",
      "description": "string",
      "points": 0,
      "alignedObjectives": ["string"]
    }
  ]
}`;
}

// ── Start server ──────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`🚀 ALDA API Server v2.1 (Gemini) running on port ${PORT}`);
  console.log(`📊 Health:   http://localhost:${PORT}/api/health`);
  console.log(`🎓 Analyse:  http://localhost:${PORT}/api/analyze`);
  console.log(`🏗️  Build:    http://localhost:${PORT}/api/build`);
  console.log(`🔑 Gemini key: ${process.env.GEMINI_API_KEY ? 'Set via env ✓' : 'Not set — will use per-request key'}`);
});

module.exports = app;
