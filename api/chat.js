// api/chat.js — Main AI chat handler
// Routes between: regular Q&A, file generation (e2b), and image generation (Together AI)

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { messages, userMessage } = req.body;

  if (!userMessage) {
    return res.status(400).json({ error: 'No message provided' });
  }

  // ── Step 1: Classify the intent using Gemini ────────────────────
  const intent = await classifyIntent(userMessage);

  try {
    if (intent.type === 'image') {
      return await handleImageGeneration(intent.prompt || userMessage, res);
    }

    if (intent.type === 'file') {
      return await handleFileGeneration(intent.fileType, userMessage, messages, res);
    }

    // Default: regular Q&A
    return await handleQA(messages, userMessage, res);
  } catch (err) {
    console.error('Chat handler error:', err);
    return res.status(500).json({ error: err.message || 'Internal server error' });
  }
}

// ── Intent Classification ────────────────────────────────────────
async function classifyIntent(userMessage) {
  const msg = userMessage.toLowerCase();

  // Image detection
  const imageKeywords = ['generate image', 'create image', 'draw', 'paint', 'render image',
    'make an image', 'show me an image', 'generate a picture', 'create a picture',
    'illustrate', 'visualize', 'generate a photo'];
  if (imageKeywords.some(k => msg.includes(k))) {
    return { type: 'image', prompt: userMessage };
  }

  // File detection
  const filePatterns = [
    { keywords: ['excel', '.xlsx', 'spreadsheet', 'financial model', 'xls'], fileType: 'xlsx' },
    { keywords: ['pdf', 'report pdf', 'create a pdf', 'make a pdf'], fileType: 'pdf' },
    { keywords: ['word', '.docx', 'word document', 'word doc'], fileType: 'docx' },
    { keywords: ['powerpoint', '.pptx', 'presentation', 'slides', 'deck'], fileType: 'pptx' },
    { keywords: ['csv', '.csv', 'comma separated'], fileType: 'csv' },
    { keywords: ['html file', 'webpage', 'web page', 'html page', '.html'], fileType: 'html' },
    { keywords: ['text file', '.txt', 'plain text file'], fileType: 'txt' },
  ];

  // Also detect generic "create/make/generate a file" patterns
  const createVerbs = ['create', 'make', 'generate', 'build', 'produce', 'write'];
  const fileNouns = ['file', 'document', 'report', 'template', 'table', 'spreadsheet'];

  for (const pattern of filePatterns) {
    if (pattern.keywords.some(k => msg.includes(k))) {
      if (createVerbs.some(v => msg.includes(v)) || msg.includes('create') || msg.includes('make') || msg.includes('generate') || msg.includes('build')) {
        return { type: 'file', fileType: pattern.fileType };
      }
      // Check if they're just asking about the file type (not creating)
      if (fileNouns.some(n => msg.includes(n)) && createVerbs.some(v => msg.includes(v))) {
        return { type: 'file', fileType: pattern.fileType };
      }
      // If they mention the file format prominently, treat as file creation
      if (pattern.keywords.some(k => msg.includes(k) && (msg.includes('create') || msg.includes('make') || msg.includes('generate') || msg.includes('build') || msg.includes('write')))) {
        return { type: 'file', fileType: pattern.fileType };
      }
    }
  }

  return { type: 'qa' };
}

// ── Regular Q&A with Gemini ──────────────────────────────────────
async function handleQA(messages, userMessage, res) {
  const GEMINI_KEY = process.env.GEMINI_API_KEY;
  if (!GEMINI_KEY) throw new Error('GEMINI_API_KEY not configured in environment variables');

  // Build conversation history for Gemini
  const history = messages
    .slice(0, -1) // exclude the last user message (it's the current one)
    .map(m => ({
      role: m.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: m.content }],
    }));

  const systemInstruction = `You are Nexus AI, an expert assistant. Always respond in structured, well-formatted Markdown.

RESPONSE FORMAT RULES:
- For questions: Start with a direct answer (1-2 sentences), then explain with ## headers, end with a "## Key Takeaways" section
- For research: Start with "## Executive Summary" bullet points, then detailed ## sections, end with "## Conclusion"  
- For analysis: Use tables where helpful, always show your reasoning
- Always complete your full response — never truncate
- Use **bold** for important terms, \`code\` for technical terms
- Use emoji sparingly for section headers to improve readability
- Be thorough, professional, and comprehensive`;

  const requestBody = {
    systemInstruction: { parts: [{ text: systemInstruction }] },
    contents: [
      ...history,
      { role: 'user', parts: [{ text: userMessage }] }
    ],
    generationConfig: {
      temperature: 0.7,
      maxOutputTokens: 8192,
    },
  };

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_KEY}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(requestBody),
    }
  );

  if (!response.ok) {
    const errData = await response.json().catch(() => ({}));
    throw new Error(`Gemini API error: ${errData?.error?.message || response.statusText}`);
  }

  const data = await response.json();
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text;

  if (!text) throw new Error('Empty response from Gemini');

  return res.status(200).json({ text });
}

// ── File Generation with e2b ─────────────────────────────────────
async function handleFileGeneration(fileType, userMessage, messages, res) {
  const E2B_KEY = process.env.E2B_API_KEY;
  const GEMINI_KEY = process.env.GEMINI_API_KEY;

  if (!E2B_KEY) throw new Error('E2B_API_KEY not configured in environment variables');
  if (!GEMINI_KEY) throw new Error('GEMINI_API_KEY not configured in environment variables');

  // Step 1: Use Gemini to plan the file content
  const planPrompt = buildFilePlanPrompt(fileType, userMessage);
  const planResponse = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_KEY}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ role: 'user', parts: [{ text: planPrompt }] }],
        generationConfig: { temperature: 0.3, maxOutputTokens: 8192 },
      }),
    }
  );

  const planData = await planResponse.json();
  const planText = planData.candidates?.[0]?.content?.parts?.[0]?.text || '';

  // Extract Python code from the plan
  const codeMatch = planText.match(/```python\s*([\s\S]*?)```/);
  if (!codeMatch) {
    throw new Error('Could not generate file creation code. Please try rephrasing your request.');
  }
  const pythonCode = codeMatch[1];

  // Step 2: Execute code in e2b sandbox
  const { fileBase64, filename } = await runInE2B(pythonCode, fileType, E2B_KEY);

  // Step 3: Upload file to e2b's file storage and get URL
  // We return as a data URL for direct download
  const mimeType = getMimeType(fileType);
  const dataUrl = `data:${mimeType};base64,${fileBase64}`;

  // Build the AI response text
  const summaryText = buildFileSummary(fileType, userMessage, planText);

  return res.status(200).json({
    text: summaryText,
    file: {
      name: filename,
      url: dataUrl,
      summary: `Ready to download · ${fileType.toUpperCase()} file`,
    },
  });
}

function buildFilePlanPrompt(fileType, userMessage) {
  const fileSpecificInstructions = {
    xlsx: `Create a professional Excel financial model. Requirements:
- MUST have separate sheets: Income Statement, Balance Sheet, Cash Flow, Assumptions, Dashboard
- Use openpyxl library
- Blue font (0000FF) for input cells, black for formula cells
- Conditional formatting, named ranges
- Alternating row colors (light gray every other row)
- ALL derived numbers must use Excel formulas (write them as strings that start with =)
- Calculate: EBITDA margin, Net margin, ROE, Revenue growth, D/E ratio
- Include a sensitivity analysis table
- Professional headers, proper number formatting (#,##0.00 for currency)`,

    pdf: `Create a professional PDF document using reportlab. Requirements:
- Use reportlab library (from reportlab.lib import colors, from reportlab.platypus import ...)
- Professional header with title and date
- Consistent color palette (navy #003366, light gray #f5f5f5)
- Tables with alternating row colors
- Proper typography: title 24pt bold, headers 14pt bold, body 11pt
- Real content based on the user's request — no Lorem Ipsum
- Include page numbers`,

    docx: `Create a professional Word document using python-docx. Requirements:
- Use python-docx library
- Professional title page with title, subtitle, date
- Consistent heading hierarchy (Heading 1, 2, 3)
- Tables with alternating row colors and bold headers
- Real, comprehensive content — no placeholder text
- Proper paragraph spacing`,

    pptx: `Create a professional PowerPoint using python-pptx. Requirements:
- Use python-pptx library
- At least 8-10 slides with real content
- Consistent theme: dark navy (#003366) title slides, white content slides
- Title slide, agenda, content slides, summary slide
- Bullet points with proper indentation
- No placeholder text — real content throughout`,

    csv: `Create a comprehensive CSV file using pandas. Requirements:
- Use pandas library
- At minimum 20 rows of realistic, relevant data
- Proper headers
- Numeric data where appropriate
- Save with df.to_csv()`,

    html: `Create a complete, styled HTML webpage. Requirements:
- Full HTML5 document with embedded CSS
- Professional design with a color palette
- Responsive layout
- Real content based on the request
- Navigation, hero section, content sections, footer`,

    txt: `Create a comprehensive plain text file. Requirements:
- Well-structured with clear sections
- Real content based on the request
- Proper formatting with dividers`,
  };

  return `You are an expert Python developer. Create Python code to generate a ${fileType.toUpperCase()} file based on this request:

"${userMessage}"

${fileSpecificInstructions[fileType] || 'Create a professional, well-structured file.'}

CRITICAL RULES:
1. The file MUST be saved to exactly this path: /tmp/output.${fileType}
2. Write ONLY the Python code, inside a \`\`\`python code block
3. Install any needed libraries at the top using: import subprocess; subprocess.run(['pip', 'install', 'library-name', '-q'], capture_output=True)
4. The code must be complete and runnable — no placeholders, no TODOs
5. Include real, detailed content based on the user's specific request
6. Handle any potential errors gracefully

Before the code block, write a 2-3 sentence overview of what the file will contain.
After the code block, write a brief "File Contents" section listing the main sections/sheets.`;
}

async function runInE2B(pythonCode, fileType, e2bKey) {
  // Create a sandbox
  const createRes = await fetch('https://api.e2b.dev/sandboxes', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-API-Key': e2bKey,
    },
    body: JSON.stringify({ template: 'base' }),
  });

  if (!createRes.ok) {
    const err = await createRes.text();
    throw new Error(`e2b sandbox creation failed: ${err}`);
  }

  const sandbox = await createRes.json();
  const sandboxId = sandbox.sandboxId || sandbox.id;

  try {
    // Execute the Python code
    const execRes = await fetch(`https://api.e2b.dev/sandboxes/${sandboxId}/processes`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': e2bKey,
      },
      body: JSON.stringify({
        cmd: 'python3',
        args: ['-c', pythonCode],
        timeout: 45,
      }),
    });

    if (!execRes.ok) {
      const err = await execRes.text();
      throw new Error(`Code execution failed: ${err}`);
    }

    const execData = await execRes.json();

    // Wait for process to complete
    await waitForProcess(sandboxId, execData.processId || execData.pid, e2bKey);

    // Read the output file
    const fileRes = await fetch(
      `https://api.e2b.dev/sandboxes/${sandboxId}/files?path=/tmp/output.${fileType}`,
      {
        headers: { 'X-API-Key': e2bKey },
      }
    );

    if (!fileRes.ok) {
      throw new Error(`Could not read generated file. The code may have failed to create it.`);
    }

    const fileBuffer = await fileRes.arrayBuffer();
    const fileBase64 = Buffer.from(fileBuffer).toString('base64');
    const filename = generateFilename(fileType);

    return { fileBase64, filename };
  } finally {
    // Always clean up the sandbox
    await fetch(`https://api.e2b.dev/sandboxes/${sandboxId}`, {
      method: 'DELETE',
      headers: { 'X-API-Key': e2bKey },
    }).catch(() => {});
  }
}

async function waitForProcess(sandboxId, processId, e2bKey, maxWait = 50000) {
  const start = Date.now();
  while (Date.now() - start < maxWait) {
    await new Promise(r => setTimeout(r, 1000));

    const res = await fetch(
      `https://api.e2b.dev/sandboxes/${sandboxId}/processes/${processId}`,
      { headers: { 'X-API-Key': e2bKey } }
    );

    if (res.ok) {
      const data = await res.json();
      if (data.status === 'finished' || data.exitCode !== undefined) return data;
    }
  }
  throw new Error('Code execution timed out after 50 seconds');
}

function generateFilename(fileType) {
  const date = new Date().toISOString().slice(0, 10);
  const names = {
    xlsx: `Financial_Model_${date}.xlsx`,
    pdf: `Document_${date}.pdf`,
    docx: `Report_${date}.docx`,
    pptx: `Presentation_${date}.pptx`,
    csv: `Data_${date}.csv`,
    html: `Page_${date}.html`,
    txt: `Document_${date}.txt`,
  };
  return names[fileType] || `File_${date}.${fileType}`;
}

function getMimeType(fileType) {
  const types = {
    xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    pdf: 'application/pdf',
    docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    csv: 'text/csv',
    html: 'text/html',
    txt: 'text/plain',
  };
  return types[fileType] || 'application/octet-stream';
}

function buildFileSummary(fileType, userMessage, planText) {
  const overviewMatch = planText.match(/^([\s\S]*?)```python/);
  const contentsMatch = planText.match(/```[\s\S]*?```([\s\S]*)$/);

  const overview = overviewMatch ? overviewMatch[1].trim() : '';
  const contents = contentsMatch ? contentsMatch[1].trim() : '';

  return `## 📁 File Ready

${overview}

${contents}

---
*Your file has been generated and is ready to download below.*`;
}

// ── Image Generation with Together AI ───────────────────────────
async function handleImageGeneration(prompt, res) {
  const TOGETHER_KEY = process.env.TOGETHER_API_KEY;
  if (!TOGETHER_KEY) throw new Error('TOGETHER_API_KEY not configured in environment variables');

  // Clean and enhance the prompt
  const enhancedPrompt = prompt
    .replace(/generate (an? )?image (of|showing|depicting)?/i, '')
    .replace(/create (an? )?image (of|showing|depicting)?/i, '')
    .replace(/draw (an? )?/i, '')
    .replace(/show me (an? image of )?/i, '')
    .trim();

  const response = await fetch('https://api.together.xyz/v1/images/generations', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${TOGETHER_KEY}`,
    },
    body: JSON.stringify({
      model: 'black-forest-labs/FLUX.1-schnell-Free',
      prompt: enhancedPrompt,
      width: 1024,
      height: 768,
      steps: 4,
      n: 1,
    }),
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(`Image generation failed: ${err?.error?.message || response.statusText}`);
  }

  const data = await response.json();
  const imageUrl = data.data?.[0]?.url;

  if (!imageUrl) throw new Error('No image URL returned from Together AI');

  return res.status(200).json({
    text: `## 🎨 Image Generated\n\n**Prompt:** ${enhancedPrompt}\n\nHere's your generated image:`,
    imageUrl,
    imagePrompt: enhancedPrompt,
  });
}
