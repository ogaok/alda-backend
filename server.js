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
  origin: '*', // In production, specify allowed origins
  methods: ['GET', 'POST'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json({ limit: '10mb' }));

// Rate limiting (basic implementation)
const rateLimitMap = new Map();
const RATE_LIMIT = 10; // requests per hour
const RATE_WINDOW = 60 * 60 * 1000; // 1 hour

function checkRateLimit(apiKey) {
  const now = Date.now();
  const userRequests = rateLimitMap.get(apiKey) || [];
  
  // Clean old requests
  const recentRequests = userRequests.filter(time => now - time < RATE_WINDOW);
  
  if (recentRequests.length >= RATE_LIMIT) {
    return false;
  }
  
  recentRequests.push(now);
  rateLimitMap.set(apiKey, recentRequests);
  return true;
}

// Educational frameworks for analysis
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
        description: 'Exemplary instructional design. The course demonstrates evidence of rigorous, learner-centered design across all Seven Pillars.'
      },
      {
        name: 'High Distinction',
        scoreRange: '68-76 pts (80-89%)',
        requirement: 'All ⚓ Anchors met',
        description: 'Strong instructional quality with specific areas for targeted enhancement. Minor improvements will elevate to Certified.'
      },
      {
        name: 'Developing',
        scoreRange: '51-67 pts (60-79%)',
        requirement: 'May have Anchor gaps',
        description: 'Foundational design elements present but multiple Pillars require substantive improvement.'
      },
      {
        name: 'Needs Redesign',
        scoreRange: 'Below 51 pts OR any ⚓ Anchor unmet',
        requirement: 'Critical failures present',
        description: 'One or more critical design failures are present. Targeted redesign addressing all unmet Anchors is recommended.'
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

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'healthy', 
    timestamp: new Date().toISOString(),
    version: '1.0.0'
  });
});

// Main analysis endpoint
app.post('/api/analyze', async (req, res) => {
  try {
    // Extract API key from Authorization header
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ 
        error: 'Missing or invalid authorization header' 
      });
    }
    
    const apiKey = authHeader.substring(7);
    
    // Check rate limit
    if (!checkRateLimit(apiKey)) {
      return res.status(429).json({ 
        error: 'Rate limit exceeded. Please try again later.' 
      });
    }
    
    const { lmsType, courseData, context, depth, frameworks } = req.body;
    
    // Validate input
    if (!courseData) {
      return res.status(400).json({ 
        error: 'Missing course data' 
      });
    }
    
    console.log(`Analyzing ${lmsType} course: ${context?.courseName || 'Unknown'}`);
    
    // Initialize OpenAI
    const openai = new OpenAI({ apiKey });
    
    // Build analysis prompt
    const prompt = buildAnalysisPrompt(courseData, lmsType, frameworks, depth);
    
    // Call OpenAI API
    const completion = await openai.chat.completions.create({
      model: 'gpt-4-turbo-preview',
      messages: [
        {
          role: 'system',
          content: getSystemPrompt(frameworks)
        },
        {
          role: 'user',
          content: prompt
        }
      ],
      temperature: 0.7,
      max_tokens: depth === 'deep' ? 4000 : depth === 'standard' ? 2000 : 1000,
      response_format: { type: 'json_object' }
    });
    
    const analysisResult = JSON.parse(completion.choices[0].message.content);
    
    // Structure response
    const response = {
      scores: {
        structure: analysisResult.scores?.structure || 0,
        engagement: analysisResult.scores?.engagement || 0,
        assessment: analysisResult.scores?.assessment || 0
      },
      suggestions: analysisResult.suggestions || [],
      summary: analysisResult.summary || '',
      timestamp: new Date().toISOString(),
      tokensUsed: completion.usage.total_tokens
    };
    
    console.log(`Analysis complete. Generated ${response.suggestions.length} suggestions.`);
    
    res.json(response);
    
  } catch (error) {
    console.error('Analysis error:', error);
    
    if (error.code === 'invalid_api_key') {
      return res.status(401).json({ 
        error: 'Invalid OpenAI API key' 
      });
    }
    
    if (error.code === 'rate_limit_exceeded') {
      return res.status(429).json({ 
        error: 'OpenAI rate limit exceeded. Please try again later.' 
      });
    }
    
    res.status(500).json({ 
      error: 'Analysis failed. Please try again.' 
    });
  }
});

// Course builder endpoint
app.post('/api/build', async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ 
        error: 'Missing or invalid authorization header' 
      });
    }
    
    const apiKey = authHeader.substring(7);
    
    // Check rate limit
    if (!checkRateLimit(apiKey)) {
      return res.status(429).json({ 
        error: 'Rate limit exceeded. Please try again later.' 
      });
    }
    
    const { mode, lmsType, context, specifications } = req.body;
    
    console.log(`Building course in ${mode} mode for ${lmsType}`);
    
    // Initialize OpenAI
    const openai = new OpenAI({ apiKey });
    
    // Build course generation prompt
    const prompt = buildCoursePrompt(mode, specifications, lmsType);
    
    const completion = await openai.chat.completions.create({
      model: 'gpt-4-turbo-preview',
      messages: [
        {
          role: 'system',
          content: getCourseBuilderSystemPrompt()
        },
        {
          role: 'user',
          content: prompt
        }
      ],
      temperature: 0.8,
      max_tokens: 3000,
      response_format: { type: 'json_object' }
    });
    
    const courseStructure = JSON.parse(completion.choices[0].message.content);
    
    res.json({
      courseStructure,
      timestamp: new Date().toISOString(),
      tokensUsed: completion.usage.total_tokens
    });
    
  } catch (error) {
    console.error('Course build error:', error);
    res.status(500).json({ 
      error: 'Course building failed. Please try again.' 
    });
  }
});

// Helper: Build analysis prompt
function buildAnalysisPrompt(courseData, lmsType, frameworks, depth) {
  const frameworkDescriptions = frameworks
    .map(fw => `- ${FRAMEWORKS[fw]?.name || fw}: ${FRAMEWORKS[fw]?.description || ''}`)
    .join('\n');
  
  const includesAIQF = frameworks.includes('aiqf');
  
  return `
Analyze this ${lmsType} course and provide pedagogical recommendations.

Course Data:
${JSON.stringify(courseData, null, 2)}

Analysis Depth: ${depth}

Apply these educational frameworks:
${frameworkDescriptions}

${includesAIQF ? `
IMPORTANT: Include AIQF Seven Pillars analysis with:
- P1: Clarity of Purpose (max 13 pts)
- P2: Outcome Architecture (max 13 pts)
- P3: Evidence Design (max 13 pts)
- P4: Knowledge Pathways (max 12 pts)
- P5: Active Meaning-Making (max 12 pts)
- P6: Equitable Access (max 12 pts)
- P7: Adaptive Coherence (max 10 pts)

Score each pillar and identify unmet Anchor Indicators (⚓) vs Guide Indicators (◈).
Total possible: 85 points across all Seven Pillars.
` : ''}

Provide your analysis in JSON format with:
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
    "unmetAnchors": ["P1-A1", "P2-A3", ...],
    "allAnchorsMetAIQF true/false
  },` : ''}
  "scores": {
    "structure": <0-100>,
    "engagement": <0-100>,
    "assessment": <0-100>
  },
  "suggestions": [
    {
      "title": "Brief title",
      "description": "Detailed explanation with specific pedagogical rationale",
      "priority": "high|medium|low",
      "framework": "bloom|addie|aiqf|ubd|solo",
      ${includesAIQF ? `"pillar": "P1|P2|P3|P4|P5|P6|P7",
      "indicatorType": "anchor|guide",
      "indicatorId": "P1-A1|P2-G1|etc",` : ''}
      "action": {
        "label": "Action button text",
        "type": "add|modify|remove",
        "target": "modules|assignments|assessments|content|activities"
      }
    }
  ],
  "summary": "2-3 sentence overall assessment"
}

Focus on actionable, specific recommendations that improve learning outcomes.
${includesAIQF ? 'Prioritize unmet Anchor Indicators (⚓) as high priority, Guide Indicators (◈) as medium/low.' : ''}
`;
}

// Helper: System prompt for analysis
function getSystemPrompt(frameworks) {
  return `You are ALDA (AI Learning Design Assistant), an expert instructional designer with deep knowledge of pedagogical frameworks including Bloom's Taxonomy, ADDIE, Seven Pillars Instructional Quality Framework (AIQF), Understanding by Design, and SOLO Taxonomy.

The ALDA Instructional Quality Framework (AIQF) is your primary evaluation tool. It organizes instructional quality around Seven Pillars:

P1. Clarity of Purpose (13 pts): Does the learner know what they're entering, why it matters, and what they need to succeed?
P2. Outcome Architecture (13 pts): Are learning outcomes structured as a coherent, progressive system?
P3. Evidence Design (13 pts): Is the assessment system rigorous, transparent, and aligned to outcomes?
P4. Knowledge Pathways (12 pts): Does content guide learners forward or simply accumulate?
P5. Active Meaning-Making (12 pts): Is the learner constructing understanding or passively consuming?
P6. Equitable Access (12 pts): Can every learner access and engage with this course?
P7. Adaptive Coherence (10 pts): Does the course function as an integrated system?

Total: 7 Pillars, 38 Indicators (20 Anchors ⚓ worth 3 pts each, 18 Guides ◈ worth 2 pts each), maximum 85 points.

Quality Tiers:
- ★ ALDA Certified: 77-85 pts (90%+) AND all Anchors met - Exemplary design
- High Distinction: 68-76 pts (80-89%) AND all Anchors met - Strong quality
- Developing: 51-67 pts (60-79%) - Foundational elements present
- Needs Redesign: Below 51 pts OR any Anchor unmet - Critical failures present

Your role is to analyze course structures and provide actionable recommendations that:
1. Align with evidence-based educational practices across all frameworks
2. Improve student learning outcomes
3. Enhance engagement and accessibility
4. Follow best practices for online and blended learning

Evaluate against AIQF Pillars and provide specific, actionable suggestions with clear pedagogical rationale.
Prioritize Anchor Indicators (critical for learning outcomes) over Guide Indicators (enhancement opportunities).
Format all responses as valid JSON.`;
}

// Helper: Build course generation prompt
function buildCoursePrompt(mode, specifications, lmsType) {
  return `
${mode === 'new' ? 'Create a new course' : 'Enhance the existing course'} for ${lmsType} LMS.

Specifications:
${JSON.stringify(specifications, null, 2)}

Generate a complete course structure in JSON format with:
{
  "courseName": "Course title",
  "description": "Course description",
  "learningObjectives": ["objective1", "objective2"],
  "modules": [
    {
      "name": "Module name",
      "description": "Module description",
      "learningObjectives": ["objective"],
      "content": [
        {
          "type": "lecture|reading|video|assignment|quiz",
          "title": "Content title",
          "description": "Content description",
          "estimatedTime": "minutes"
        }
      ]
    }
  ],
  "assessments": [
    {
      "type": "quiz|assignment|project|discussion",
      "title": "Assessment title",
      "description": "Description",
      "points": number,
      "alignedObjectives": ["objective"]
    }
  ]
}

Ensure pedagogical soundness and alignment with best practices.
`;
}

// Helper: System prompt for course building
function getCourseBuilderSystemPrompt() {
  return `You are ALDA (AI Learning Design Assistant), an expert course designer specializing in creating pedagogically sound, engaging online courses.

When designing courses:
1. Use backward design (start with objectives, then assessments, then content)
2. Ensure alignment between objectives, content, and assessments
3. Include diverse content types for different learning styles
4. Build in formative and summative assessments
5. Design for accessibility and inclusivity
6. Follow evidence-based practices for online learning

Always structure courses for maximum student engagement and learning outcomes.
Format all responses as valid JSON.`;
}

// Start server
app.listen(PORT, () => {
  console.log(`🚀 ALDA API Server running on port ${PORT}`);
  console.log(`📊 Health check: http://localhost:${PORT}/api/health`);
  console.log(`🎓 Analysis endpoint: http://localhost:${PORT}/api/analyze`);
  console.log(`🏗️  Build endpoint: http://localhost:${PORT}/api/build`);
});

module.exports = app;
