# 🚀 Nexus AI — Full-Stack AI Chat App

A complete AI web app with Q&A, file generation (Excel, PDF, Word, PowerPoint, CSV, HTML), and image generation.

---

## 📋 Prerequisites (create these accounts first)

| Service | Purpose | Where to get key |
|---------|---------|-----------------|
| Google AI Studio | AI brain (Gemini) | https://aistudio.google.com → API Keys |
| e2b.dev | Cloud code execution for files | https://e2b.dev → Dashboard → API Keys |
| Together AI | Image generation | https://api.together.xyz → API Keys |
| GitHub | Code storage | https://github.com |
| Vercel | Free hosting | https://vercel.com (sign in with GitHub) |

---

## 🖥️ Local Development (testing on your computer)

### Step 1: Install Node.js
Go to https://nodejs.org → Download the "LTS" version → Install it

### Step 2: Get the code on your computer
1. Go to your GitHub repository
2. Click the green "Code" button → "Download ZIP"
3. Extract the ZIP to a folder (e.g. Desktop/ai-chat-app)

### Step 3: Create your local environment file
1. In the project folder, find `.env.example`
2. Make a copy named `.env.local`  
3. Fill in your actual API keys:
```
GEMINI_API_KEY=your_actual_gemini_key
E2B_API_KEY=your_actual_e2b_key
TOGETHER_API_KEY=your_actual_together_key
ACCESS_PASSWORD=any_password_you_choose
```

### Step 4: Install and run
Open Terminal (Mac) or Command Prompt (Windows) in the project folder:
```bash
npm install
npm run dev
```
Open your browser to http://localhost:5173

---

## 🌐 Deploying to Vercel (publishing online)

### Step 1: Upload code to GitHub
1. Go to https://github.com → Click "+" → "New repository"
2. Name it "nexus-ai" → Click "Create repository"
3. On the next page, click "uploading an existing file"
4. Drag all your project files into the upload area
5. Click "Commit changes"

### Step 2: Deploy on Vercel
1. Go to https://vercel.com → Sign in with GitHub
2. Click "Add New..." → "Project"
3. Find your "nexus-ai" repository → Click "Import"
4. In "Framework Preset" select "Vite"
5. Click "Environment Variables" and add each key:
   - `GEMINI_API_KEY` = your gemini key
   - `E2B_API_KEY` = your e2b key
   - `TOGETHER_API_KEY` = your together key
   - `ACCESS_PASSWORD` = your chosen password
6. Click "Deploy"
7. Wait ~2 minutes → Your app is live!

### Step 3: Get your URL
After deployment, Vercel shows you a URL like: `https://nexus-ai-yourname.vercel.app`
This works on any device — phone, tablet, laptop!

---

## 🔄 Updating the App Later

1. Make changes to files on your computer
2. Go to your GitHub repository
3. Upload the changed files (same process as Step 1 above)
4. Vercel automatically re-deploys in ~1 minute

---

## ✅ Testing Checklist

Before sharing your link, test each feature:

**Q&A:**
- [ ] Ask "Explain machine learning with key takeaways" → should get structured response with headers
- [ ] Ask a follow-up question → should remember context

**File Generation:**
- [ ] "Create a 3-year financial model Excel" → should download .xlsx with multiple sheets
- [ ] "Create a business proposal PDF" → should download .pdf
- [ ] "Create a project plan PowerPoint" → should download .pptx
- [ ] "Create a CSV with 20 sample sales records" → should download .csv

**Image Generation:**
- [ ] "Generate an image of a sunset over mountains" → should show image in chat

**UI:**
- [ ] Dark/light mode toggle works
- [ ] New conversation button works
- [ ] Old conversations load from sidebar
- [ ] Works on your phone browser

---

## 🔧 If Something Breaks

**"GEMINI_API_KEY not configured"** → Check Vercel Environment Variables, redeploy

**"e2b sandbox creation failed"** → Check e2b API key, make sure you have free credits

**File doesn't generate** → The Python code may have a bug; try rephrasing your request more specifically

**Image generation fails** → Check Together AI API key and that you have free credits remaining

---

## 📊 Monitoring API Usage

- **Gemini:** Go to https://aistudio.google.com → View usage in your project dashboard
- **e2b:** Go to https://e2b.dev → Dashboard shows sandbox usage
- **Together AI:** Go to https://api.together.xyz → Usage tab shows credits remaining

---

## 🔐 Access Control

The app uses a simple password gate. Set `ACCESS_PASSWORD` in your Vercel environment variables.
To change the password: update the env var in Vercel → redeploy.

To add more security, consider upgrading to proper auth with Clerk.dev (free tier available).

---

## 💡 Example Prompts to Try

```
Create a 3-year SaaS financial model with monthly and annual views
Create a business plan PDF for a food delivery startup
Generate an image of a minimalist office workspace with a mountain view
Create a project timeline PowerPoint for a mobile app launch
Write a comprehensive market analysis for the EV industry as a Word document
Create a CSV of 50 mock e-commerce transactions with customer data
```
