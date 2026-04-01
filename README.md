# 🚽 PassGuard by Jose Melgarejo

Bathroom pass management app for teachers — built with React + Vite.

---

## 🚀 Deploy to Vercel (5 minutes, free)

### Step 1 — Create a GitHub account (if you don't have one)
Go to https://github.com and sign up for free.

### Step 2 — Upload this folder to GitHub
1. Go to https://github.com/new
2. Name the repo: `passguard`
3. Keep it **Private**
4. Click **Create repository**
5. Click **uploading an existing file**
6. Drag and drop ALL files from this folder into the page
7. Click **Commit changes**

### Step 3 — Deploy on Vercel
1. Go to https://vercel.com and sign up with your GitHub account
2. Click **Add New → Project**
3. Select your `passguard` repository
4. Vercel will auto-detect Vite — just click **Deploy**
5. In ~60 seconds you'll get a live URL like:
   `https://passguard.vercel.app`

### Step 4 — Share with your co-teacher
Send her the link. On her iPhone:
1. Open the link in **Safari**
2. Tap the **Share** button (box with arrow)
3. Tap **"Add to Home Screen"**
4. Tap **Add**

PassGuard will appear as an app icon on her iPhone — no App Store needed! ✅

---

## 💻 Run locally (optional)

```bash
npm install
npm run dev
```

Then open http://localhost:5173

---

## 📁 Project structure

```
passguard/
├── index.html          # App entry point
├── vite.config.js      # Vite configuration
├── vercel.json         # Vercel routing config
├── package.json        # Dependencies
├── public/
│   ├── manifest.json   # PWA manifest (enables "Add to Home Screen")
│   ├── icon-192.png    # App icon
│   └── icon-512.png    # App icon (large)
└── src/
    ├── main.jsx        # React entry
    └── App.jsx         # PassGuard application
```

---

Built for DC Public Schools · 2026
