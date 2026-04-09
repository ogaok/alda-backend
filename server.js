// ALDA Backend API Server
// Handles AI analysis requests from the browser extension

const express = require('express');
const cors = require('cors');
const OpenAI = require('openai');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json({ limit: '10mb' }));

// Rate limiting
const rateLimitMap = new Map();
const RATE_LIMIT = 10;
const RATE_WINDOW = 60 * 60 * 1000;

function checkRateLimit(apiKey) {
  const now = Date.now();
  const userRequests = rateLimitMap.get(apiKey) || [];
  const recentRequests = userRequests.filter(time => now - time < RATE_WINDOW);
  if (recentRequests.length >= RATE_LIMIT) return false;
  recentRequests.push(now);
  rateLimitMap.set(apiKey, recentRequests);
  return true;
}

// Educational frameworks
const FRAMEWORKS = {
  bloom: {
    name: "Bloom's Taxonomy",
    levels: ['Remember', 'Understand', 'Apply', 'Analyze', 'Evaluate', 'Create'],
    description: 'Cognitive verb analysis and complexity leveling of learning outcomes'
  },
  addie: {
    name: 'ADDIE Model',
    phases: ['Analysis', 'Design', 'Development', 'Implementation', 'Evaluation'],
    description: 'Iterative instructional design and continuous improvement framework'
  },
  aiqf: {
    name: 'Seven Pillars Instructional Quality Framework (AIQF)',
    version: '2.0',
    pillars: 7,
    indicators: 38,
    anchors: 20,
    guides: 18,
    maxScore: 85,
    description: 'Proprietary framework evaluating courses across seven critical dimensions with 38 research-backed indicators',
    pillars_detail: [
      {
        code: 'P1',
        name: 'Clarity of Purpose',
        question: 'Does the learner know exactly what they are entering, why it matters, and what they need to succeed?',
        maxScore: 13,
        anchors: 3,
        guides: 2,
        indicators: [
          { id: 'P1-A1', name: 'Intent Statement', type: 'anchor', points: 3 },
          { id: 'P1-A2', name: 'Entry Requirements', type: 'anchor', points: 3 },
          { id: 'P1-A3', name: 'Success Criteria Transparency', type: 'anchor', points: 3 },
          { id: 'P1-G1', name: 'Navigation Legibility', type: 'guide', points: 2 },
          { id: 'P1-G2', name: 'Community and Conduct Norms', type: 'guide', points: 2 }
        ]
      },
      {
        code: 'P2',
        name: 'Outcome Architecture',
        question: 'Are learning outcomes structured as a coherent, progressive system that actually guides design decisions?',
        maxScore: 13,
        anchors: 3,
        guides: 2,
        indicators: [
          { id: 'P2-A1', name: 'Cognitive Precision', type: 'anchor', points: 3 },
          { id: 'P2-A2', name: 'Vertical Alignment', type: 'anchor', points: 3 },
          { id: 'P2-A3', name: 'Complexity Distribution', type: 'anchor', points: 3 },
          { id: 'P2-G1', name: 'Learner-Centric Framing', type: 'guide', points: 2 },
          { id: 'P2-G2', name: 'External Standards Linkage', type: 'guide', points: 2 }
        ]
      },
      {
        code: 'P3',
        name: 'Evidence Design',
        question: 'Is the system for capturing and evaluating learning evidence rigorous, transparent, and genuinely aligned to outcomes?',
        maxScore: 13,
        anchors: 3,
        guides: 2,
        indicators: [
          { id: 'P3-A1', name: 'Outcome-Evidence Traceability', type: 'anchor', points: 3 },
          { id: 'P3-A2', name: 'Criteria Transparency', type: 'anchor', points: 3 },
          { id: 'P3-A3', name: 'Formative Checkpoint System', type: 'anchor', points: 3 },
          { id: 'P3-G1', name: 'Method Variety', type: 'guide', points: 2 },
          { id: 'P3-G2', name: 'Submission Clarity', type: 'guide', points: 2 }
        ]
      },
      {
        code: 'P4',
        name: 'Knowledge Pathways',
        question: 'Does the instructional content guide learners forward, or does it simply accumulate?',
        maxScore: 12,
        anchors: 2,
        guides: 3,
        indicators: [
          { id: 'P4-A1', name: 'Outcome Sufficiency', type: 'anchor', points: 3 },
          { id: 'P4-A2', name: 'Developmental Sequencing', type: 'anchor', points: 3 },
          { id: 'P4-G1', name: 'Format Diversity', type: 'guide', points: 2 },
          { id: 'P4-G2', name: 'Workload Calibration', type: 'guide', points: 2 },
          { id: 'P4-G3', name: 'Source Integrity', type: 'guide', points: 2 }
        ]
      },
      {
        code: 'P5',
        name: 'Active Meaning-Making',
        question: 'Is the learner actively constructing understanding, or passively consuming content?',
        maxScore: 12,
        anchors: 2,
        guides: 3,
        indicators: [
          { id: 'P5-A1', name: 'Applied Learning Requirement', type: 'anchor', points: 3 },
          { id: 'P5-A2', name: 'Purposeful Interaction Design', type: 'anchor', points: 3 },
          { id: 'P5-G1', name: 'Embedded Cognitive Activation', type: 'guide', points: 2 },
          { id: 'P5-G2', name: 'Instructor Presence Architecture', type: 'guide', points: 2 },
          { id: 'P5-G3', name: 'Engagement Distribution', type: 'guide', points: 2 }
        ]
      },
      {
        code: 'P6',
        name: 'Equitable Access',
        question: 'Can every learner — regardless of ability, device, background, or circumstance — access and engage with this course?',
        maxScore: 12,
        anchors: 2,
        guides: 3,
        indicators: [
          { id: 'P6-A1', name: 'Minimum Accessibility Standards', type: 'anchor', points: 3 },
          { id: 'P6-A2', name: 'Multi-Modal Content Provision', type: 'anchor', points: 3 },
          { id: 'P6-G1', name: 'Support Infrastructure Signposting', type: 'guide', points: 2 },
          { id: 'P6-G2', name: 'Accommodation Pathway Clarity', type: 'guide', points: 2 },
          { id: 'P6-G3', name: 'Technology Barrier Minimization', type: 'guide', points: 2 }
        ]
      },
      {
        code: 'P7',
        name: 'Adaptive Coherence',
        question: 'Does the course function as an integrated, evolving system — or as a collection of disconnected parts?',
        maxScore: 10,
        anchors: 2,
        guides: 2,
        indicators: [
          { id: 'P7-A1', name: 'Full-System Alignment Audit', type: 'anchor', points: 3 },
          { id: 'P7-A2', name: 'Logical Progression Architecture', type: 'anchor', points: 3 },
          { id: 'P7-G1', name: 'Learner Feedback Integration', type: 'guide', points: 2 },
          { id: 'P7-G2', name: 'Iterative Design Evidence', type: 'guide', points: 2 }
        ]
      }
    ],
    qualityTiers: [
      {
        name: '★ ALDA Certified',
        scoreRange: '77-85 pts (90%+)',
        requirement: 'All ⚓ Anchors met',
        description: 'Exemplary instructional design.'
      },
      {
        name: 'High Distinction',
        scoreRange: '68-76 pts (80-89%)',
        requirement: 'All ⚓ Anchors met',
        description: 'Strong instructional quality with specific areas for targeted enhancement.'
      },
      {
        name: 'Developing',
        scoreRange: '51-67 pts (60-79%)',
        requirement: 'May have Anchor gaps',
        description: 'Foundational design elements present but multiple Pillars require improvement.'
      },
      {
        name: 'Needs Redesign',
        scoreRange: 'Below 51 pts OR any ⚓ Anchor unmet',
        requirement: 'Critical failures present',
        description: 'One or more critical design failures present. Targeted redesign recommended.'
      }
    ]
  },
  ubd: {
    name: 'Understanding by Design',
    stages: ['Desired Results', 'Assessment Evidence', 'Learning Plan'],
    description: 'Backward design approach - starting with outcomes and evidence before content'
  },
  solo: {
    name: 'SOLO Taxonomy',
    levels: ['Prestructural', 'Unistructural', 'Multistructural', 'Relational', 'Extended Abstract'],
    description: 'Sequencing and progression of learning complexity across course units'
  }
};

// ── Health check ─────────────────────────────────────────────────
app.get('/api/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    version: '2.0.0'
  });
});

// ── Analysis endpoint ─────────────────────────────────────────────
app.post('/api/analyze', async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Missing or invalid authorization header' });
    }

    const apiKey = authHeader.substring(7);

    if (!checkRateLimit(apiKey)) {
      return res.status(429).json({ error: 'Rate limit exceeded. Please try again later.' });
    }

    const { lmsType, courseData, context, depth, frameworks } = req.body;

    if (!courseData) {
      return res.status(400).json({ error: 'Missing course data' });
    }

    console.log(`Analyzing ${lmsType} course: ${context?.courseName || 'Unknown'}`);

    // FIX 1: sanitize courseData to prevent oversized prompts
    const safeCourseData = {
      title:       courseData.title || 'Untitled',
      objectives:  courseData.objectives || '',
      userMessage: courseData.userMessage || '',
      conversationHistory: courseData.conversationHistory || '',
      modules: (courseData.modules || []).slice(0, 15).map(m => ({
        title: m.title || m.name || 'Untitled module',
        itemCount: m.itemCount || (m.items?.length) || 0,
        items: (m.items || []).slice(0, 5),
      })),
      assignments: (courseData.assignments || []).slice(0, 15).map(a => ({
        title: a.title || 'Untitled',
      })),
      pageCount:    courseData.pageCount || 0,
      customCriteria: courseData.customCriteria || [],
    };

    const openai = new OpenAI({ apiKey });
    const activeFrameworks = frameworks || ['aiqf', 'bloom'];
    const prompt = buildAnalysisPrompt(safeCourseData, lmsType, activeFrameworks, depth);

    // FIX 2: updated model name
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        { role: 'system', content: getSystemPrompt(activeFrameworks) },
        { role: 'user',   content: prompt }
      ],
      temperature: 0.7,
      max_tokens: depth === 'deep' ? 4000 : depth === 'standard' ? 2000 : 1000,
      response_format: { type: 'json_object' }
    });

    const analysisResult = JSON.parse(completion.choices[0].message.content);

    const response = {
      aiqf:        analysisResult.aiqf || null,
      scores: {
        structure:  analysisResult.scores?.structure  || 0,
        engagement: analysisResult.scores?.engagement || 0,
        assessment: analysisResult.scores?.assessment || 0
      },
      suggestions: analysisResult.suggestions || [],
      summary:     analysisResult.summary || '',
      timestamp:   new Date().toISOString(),
      tokensUsed:  completion.usage.total_tokens
    };

    console.log(`Analysis complete. Suggestions: ${response.suggestions.length}. Tokens: ${response.tokensUsed}`);
    res.json(response);

  } catch (error) {
    // FIX 3: log and return the real error message
    console.error('Analysis error:', error.message, '| code:', error.code, '| status:', error.status);

    if (error.code === 'invalid_api_key') {
      return res.status(401).json({ error: 'Invalid OpenAI API key. Check the key entered in ALDA settings.' });
    }
    if (error.code === 'rate_limit_exceeded') {
      return res.status(429).json({ error: 'OpenAI rate limit exceeded. Please try again shortly.' });
    }
    if (error.code === 'model_not_found') {
      return res.status(500).json({ error: 'OpenAI model not found. Contact support.' });
    }
    if (error.code === 'insufficient_quota') {
      return res.status(402).json({ error: 'OpenAI quota exceeded. Check your OpenAI billing.' });
    }

    res.status(500).json({ error: error.message || 'Analysis failed. Please try again.' });
  }
});

// ── Build endpoint ────────────────────────────────────────────────
app.post('/api/build', async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Missing or invalid authorization header' });
    }

    const apiKey = authHeader.substring(7);

    if (!checkRateLimit(apiKey)) {
      return res.status(429).json({ error: 'Rate limit exceeded. Please try again later.' });
    }

    const { mode, lmsType, context, specifications } = req.body;
    console.log(`Building course in ${mode} mode for ${lmsType}`);

    const openai = new OpenAI({ apiKey });
    const prompt = buildCoursePrompt(mode, specifications, lmsType);

    // FIX 2: updated model name
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        { role: 'system', content: getCourseBuilderSystemPrompt() },
        { role: 'user',   content: prompt }
      ],
      temperature: 0.8,
      max_tokens: 3000,
      response_format: { type: 'json_object' }
    });

    const courseStructure = JSON.parse(completion.choices[0].message.content);

    res.json({
      courseStructure,
      timestamp:  new Date().toISOString(),
      tokensUsed: completion.usage.total_tokens
    });

  } catch (error) {
    // FIX 3: return real error message
    console.error('Build error:', error.message, '| code:', error.code);

    if (error.code === 'invalid_api_key') {
      return res.status(401).json({ error: 'Invalid OpenAI API key. Check the key entered in ALDA settings.' });
    }
    if (error.code === 'insufficient_quota') {
      return res.status(402).json({ error: 'OpenAI quota exceeded. Check your OpenAI billing.' });
    }

    res.status(500).json({ error: error.message || 'Course building failed. Please try again.' });
  }
});

// ── Prompt builders ───────────────────────────────────────────────
function buildAnalysisPrompt(courseData, lmsType, frameworks, depth) {
  const frameworkDescriptions = frameworks
    .map(fw => `- ${FRAMEWORKS[fw]?.name || fw}: ${FRAMEWORKS[fw]?.description || ''}`)
    .join('\n');

  const includesAIQF = frameworks.includes('aiqf');

  // include conversation context if present
  const conversationContext = courseData.conversationHistory
    ? `\nConversation history:\n${courseData.conversationHistory}\n`
    : '';
  const userMessage = courseData.userMessage
    ? `\nUser's specific question: ${courseData.userMessage}\n`
    : '';

  return `
Analyze this ${lmsType || 'online'} course and provide pedagogical recommendations.

Course: ${courseData.title}
Modules (${courseData.modules.length}): ${courseData.modules.map(m => m.title).join(', ')}
Assignments (${courseData.assignments.length}): ${courseData.assignments.map(a => a.title).join(', ')}
Learning objectives: ${courseData.objectives || 'Not provided'}
Page count: ${courseData.pageCount}
${conversationContext}${userMessage}
Analysis depth: ${depth || 'standard'}

Frameworks to apply:
${frameworkDescriptions}

${includesAIQF ? `
IMPORTANT — Include AIQF Seven Pillars analysis:
- P1: Clarity of Purpose (max 13 pts)
- P2: Outcome Architecture (max 13 pts)
- P3: Evidence Design (max 13 pts)
- P4: Knowledge Pathways (max 12 pts)
- P5: Active Meaning-Making (max 12 pts)
- P6: Equitable Access (max 12 pts)
- P7: Adaptive Coherence (max 10 pts)
Total possible: 85 points.
` : ''}

Return JSON:
{
  ${includesAIQF ? `"aiqf": {
    "totalScore": <0-85>,
    "percentage": <0-100>,
    "tier": "ALDA Certified|High Distinction|Developing|Needs Redesign",
    "pillars": {
      "p1_clarity": <0-13>,
      "p2_outcomes": <0-13>,
      "p3_evidence": <0-13>,
      "p4_pathways": <0-12>,
      "p5_engagement": <0-12>,
      "p6_access": <0-12>,
      "p7_coherence": <0-10>
    },
    "unmetAnchors": ["P1-A1"],
    "allAnchorsMet": true
  },` : ''}
  "scores": { "structure": <0-100>, "engagement": <0-100>, "assessment": <0-100> },
  "suggestions": [
    {
      "title": "string",
      "description": "string",
      "priority": "high|medium|low",
      "framework": "aiqf|bloom",
      "pillar": "P1|P2|P3|P4|P5|P6|P7",
      "action": { "label": "string", "type": "add|modify|remove", "target": "string" }
    }
  ],
  "summary": "2-3 sentence overall assessment"
}`;
}

function getSystemPrompt(frameworks) {
  return `You are ALDA (AI Learning Design Assistant), an expert instructional designer specialising in the Seven Pillars Instructional Quality Framework (AIQF v2.0).

Seven Pillars:
P1. Clarity of Purpose (13 pts) — learner orientation and course entry clarity
P2. Outcome Architecture (13 pts) — measurable, progressive learning objectives
P3. Evidence Design (13 pts) — assessment alignment and criteria transparency
P4. Knowledge Pathways (12 pts) — content sequencing and scaffolding
P5. Active Meaning-Making (12 pts) — application, discussion, higher-order tasks
P6. Equitable Access (12 pts) — accessibility, multi-modal content, inclusion
P7. Adaptive Coherence (10 pts) — course integration, feedback loops, iteration

Quality tiers: ALDA Certified (77-85), High Distinction (68-76), Developing (51-67), Needs Redesign (<51 or any Anchor unmet).

Be specific, actionable, and grounded in pedagogical evidence. Format all responses as valid JSON.`;
}

function buildCoursePrompt(mode, specifications, lmsType) {
  return `
${mode === 'new' ? 'Create a new course' : 'Enhance the existing course'} for ${lmsType || 'online'} LMS.

Specifications:
${JSON.stringify(specifications, null, 2)}

Return JSON:
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
        { "type": "lecture|reading|video|assignment|quiz", "title": "string", "description": "string", "estimatedTime": "string" }
      ]
    }
  ],
  "assessments": [
    { "type": "quiz|assignment|project|discussion", "title": "string", "description": "string", "points": 0, "alignedObjectives": ["string"] }
  ]
}`;
}

function getCourseBuilderSystemPrompt() {
  return `You are ALDA (AI Learning Design Assistant), an expert course designer applying the Seven Pillars Instructional Quality Framework (AIQF v2.0).

Design principles:
1. Backward design — start with objectives, then assessments, then content
2. Align all objectives, content, and assessments
3. Include diverse content types for different learning styles
4. Build in formative and summative assessments
5. Design for accessibility and inclusivity
6. Apply Active Meaning-Making — ensure learners apply, not just consume

Format all responses as valid JSON.`;
}

// ── Start server ──────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`🚀 ALDA API Server v2.0 running on port ${PORT}`);
  console.log(`📊 Health: http://localhost:${PORT}/api/health`);
  console.log(`🎓 Analyse: http://localhost:${PORT}/api/analyze`);
  console.log(`🏗️  Build:   http://localhost:${PORT}/api/build`);
});

module.exports = app;
