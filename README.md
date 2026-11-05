<div align="center">
  <img src="public/assets/DaktariScribe-Full-Logo.png" alt="DaktariScribe Logo" width="400" />

  <br/>
  <br/>

  <p><strong>Field notes to finished reports, for frontline health teams</strong></p>

  <p>
    <img src="https://img.shields.io/badge/Next.js-16.3.3-000000?style=for-the-badge&logo=nextdotjs&logoColor=white" alt="Next.js" />
    <img src="https://img.shields.io/badge/React-19-61DAFB?style=for-the-badge&logo=react&logoColor=black" alt="React" />
    <img src="https://img.shields.io/badge/TypeScript-5-3178C6?style=for-the-badge&logo=typescript&logoColor=white" alt="TypeScript" />
    <img src="https://img.shields.io/badge/Tailwind_CSS-4-06B6D4?style=for-the-badge&logo=tailwindcss&logoColor=white" alt="Tailwind CSS" />
    <img src="https://img.shields.io/badge/Clerk-Auth-6C47FF?style=for-the-badge&logo=clerk&logoColor=white" alt="Clerk" />
  </p>

  <p>
    <em>Capture, organise and report clinical encounters in the field, even with weak internet.</em>
  </p>
</div>

---

## 🚨 The Problem

Frontline healthcare workers operating in remote camps, mobile clinics, and humanitarian outreach settings face a **critical documentation gap**:

- 📋 **Paper-based records** are error-prone, illegible, and impossible to share in real time.
- 🌐 **Poor or no internet connectivity** makes cloud-dependent tools unusable in the field.
- ⏱️ **Documentation burden** takes time away from patient care — workers spend as much time charting as treating.
- 🗣️ **Medical jargon and voice quality** degrade transcription accuracy in noisy field environments.
- 📊 **No standardised reporting** makes aggregating findings across camps nearly impossible.

The result: **critical clinical data is lost, delayed, or never recorded**, impacting patient outcomes and programme reporting.

---

## 💡 The Proposed Solution

**DaktariScribe** is a **clinical documentation and reporting tool** designed specifically for frontline healthcare workers. It bridges the gap between in-field care delivery and structured medical documentation:

| Capability | Description |
|---|---|
| 🎙️ **Voice Dictation** | Healthcare workers dictate clinical encounters hands-free during or after patient interactions |
| ✍️ **Manual Entry** | Alternatively type notes using a structured manual entry interface |
| 🗂️ **Organised Reports** | Notes are tidied into a standard record under template headings. Nothing is added; every line links back to the original. The clinician reviews and signs off |
| 📁 **Modular Records** | Encounters are grouped by camp location and date, with cryptographic Nano IDs for tamper-evident record integrity |
| 📄 **PDF Reports** | Signed records export as branded, print-quality PDF reports |
| 🔒 **Encryption & offline capture** | *Coming soon* (Phases 4 and 6 of the build spec) |

---

## 🏗️ Tech Stack

<div align="center">

| Layer | Technology | Purpose |
|---|---|---|
| **Framework** | [Next.js 16](https://nextjs.org/) (App Router) | Full-stack React framework with SSR & API routes |
| **UI Library** | [React 19](https://react.dev/) | Component-based, server & client rendering |
| **Language** | [TypeScript 5](https://www.typescriptlang.org/) | Type-safe development across the stack |
| **Styling** | [Tailwind CSS v4](https://tailwindcss.com/) | Utility-first design system with custom design tokens |
| **Authentication** | [Clerk](https://clerk.com/) | Drop-in auth: email/password, Google SSO, email verification |
| **Icons** | [Google Material Symbols](https://fonts.google.com/icons) | Outlined icon set loaded via Google Fonts CDN |
| **Typography** | [Inter (Google Fonts)](https://fonts.google.com/specimen/Inter) | Modern, legible sans-serif for medical UIs |
| **Image Optimisation** | Next.js Image (AVIF/WebP) | Automatic format conversion and lazy loading |
| **PostCSS** | PostCSS + postcss-preset-env | CSS transformation and cross-browser compatibility |

</div>

---

## ⚙️ System Architecture

> How DaktariScribe works — from field capture to structured report.

```mermaid
flowchart TD
    subgraph Client["🌐 Client - Browser / PWA"]
        A[Healthcare Worker] -->|Signs in| B["Landing Page\n/ Login / Register"]
        B -->|Auth via Clerk| C{"Route Guard\nMiddleware"}
        C -->|Authenticated| D["Dashboard Layout\nSidebar + Header + BottomNav"]
        D --> E["Field Entry Page\n/field-entry"]
        D --> F["Saved Records Page\n/saved-records"]
        D --> G["Reports Generator\n/reports"]
    end

    subgraph FieldEntry["🎙️ Field Entry"]
        E --> H{Entry Mode}
        H -->|Voice| I["Live Dictation\nWaveform UI"]
        H -->|Text| J["Manual Entry\nTextarea"]
        I --> K["Start / Pause / Stop Controls"]
        J --> K
        K -->|Add to Record| L["Record Saved\nwith Nano ID"]
    end

    subgraph Records["📁 Records and Reports"]
        L --> F
        F --> M["Search / Filter\nby ID, Date, Location"]
        L --> G
        G --> N["Report Cards\nGrouped by Month and Day"]
        N --> O["Download as PDF\nBrowser Print Dialog"]
    end

    subgraph AuthBlock["🔒 Authentication via Clerk"]
        B --> P["Email + Password"]
        B --> Q["Google SSO\noauth_google"]
        P --> R["Email Verification\n6-digit Code"]
        Q --> S["SSO Callback\n/sso-callback"]
        R --> C
        S --> C
    end

    subgraph Processing["⚙️ Processing - Planned"]
        I -->|Raw audio| T["Automated\nTranscription"]
        T --> U["Organise notes\nnothing added"]
        J --> U
        U --> V["Structured record\nfor clinician review"]
        V --> L
    end
```

---

## 📁 Project Structure

```
DaktariScribe/
├── app/
│   ├── (dashboard)/              # Protected route group
│   │   ├── field-entry/          # Voice & manual dictation workspace
│   │   ├── saved-records/        # Historical records browser with filters
│   │   ├── reports/              # PDF report generator
│   │   └── layout.tsx            # Dashboard shell (Sidebar + Header + BottomNav)
│   ├── register/                 # Account creation with email verification
│   ├── forgot-password/          # Password reset flow
│   ├── sso-callback/             # Google OAuth callback handler
│   ├── legal/                    # Terms of Service & Privacy Policy
│   ├── layout.tsx                # Root layout (ClerkProvider, Inter font, globals)
│   └── page.tsx                  # Landing page (HeroSection + LoginSection)
├── components/
│   ├── landing/
│   │   ├── HeroSection.tsx       # Animated hero with features bento grid
│   │   ├── LoginSection.tsx      # Sign-in form (email + Google SSO)
│   │   ├── FeatureCard.tsx       # Feature bento card with glassmorphism
│   │   └── LandingFooter.tsx     # Footer with legal links
│   ├── layout/
│   │   ├── Sidebar.tsx           # Desktop navigation sidebar
│   │   ├── Header.tsx            # Top app bar
│   │   └── BottomNav.tsx         # Mobile bottom navigation
│   └── reports/
│       └── ReportCard.tsx        # Individual report card with download action
├── public/
│   └── assets/
│       ├── DaktariScribe-Full-Logo.png
│       ├── DaktariScribe-Logo-Tagline.png
│       ├── DaktariScribe-Favicon.png
│       └── Hero-section.jpg
├── middleware.ts                  # Clerk route protection
├── next.config.ts                 # Next.js config (AVIF/WebP image formats)
├── theme.css                      # Custom design tokens & CSS variables
└── package.json
```

---

## 🚀 Getting Started

### Prerequisites

Make sure you have the following installed:

- **Node.js** `>= 18.x` — [Download](https://nodejs.org/)
- **npm** `>= 9.x` (bundled with Node.js)
- A **Clerk** account and application — [clerk.com](https://clerk.com/)

### 1. Clone the Repository

```bash
git clone https://github.com/your-org/DaktariScribe.git
cd DaktariScribe
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Configure Environment Variables

Copy `.env.example` to `.env.local` and fill in what you have. Only Clerk, `DATABASE_URL` (Neon) and `DATA_ENCRYPTION_KEY` are needed for Phase 1; the other services are added phase by phase (see `DAKTARISCRIBE_BUILD_SPEC.md` §3.1). **Never commit `.env.local`.**

```bash
cp .env.example .env.local
# generate the app encryption key
openssl rand -base64 32
```

### 4. Run the Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser to view the application.

### 5. Build for Production

```bash
npm run build
npm start
```

---

## 🔑 Key Features Walkthrough

### 🏠 Landing & Authentication
- Split-screen landing page: animated hero on the left, sign-in card on the right
- **Google SSO** one-click login via Clerk OAuth
- **Email/Password** login with show/hide password toggle
- **Registration** with two-step email verification (6-digit OTP)
- **Forgot Password** recovery flow
- Route-level protection via `middleware.ts` — unauthenticated users are redirected to login

### 🎙️ Field Entry (`/field-entry`)
- Toggle between **Dictation** mode and **Manual Entry** mode
- Animated waveform visualiser during live recording
- Recording controls: **Start**, **Pause**, **Stop**
- **Add to Record** saves the encounter with a cryptographic Nano ID (`DS-YYYY-DD-MM-NANO-XXXX`)

### 📁 Saved Records (`/saved-records`)
- Tabular view of all historical encounter records
- **Search** by Record ID, filter by **Date Range** and **Outreach Location**
- Paginated results with page navigation controls

### 📊 Reports Generator (`/reports`)
- Encounter records rendered as printable **Field Report Cards**
- Records grouped chronologically by **Month/Year** and **Day**
- Each card shows: Record ID, Date/Time, Location, Healthcare Worker, Clinical Recording transcript
- **Download as PDF** triggers the browser print dialog for instant offline-ready reports

---

## 🛡️ Security & Compliance

- **Authentication** — All dashboard routes are protected via Clerk middleware; unauthenticated access is blocked server-side
- **Encrypted Sessions** — Clerk handles session tokens using industry-standard JWT + RS256 signing
- **Nano ID Record Integrity** — Each clinical record gets a cryptographically random ID to prevent tampering or enumeration
- **Confidentiality Notice** — All exported reports carry a legal notice: *"Information contained herein is strictly confidential and intended for authorized medical personnel only."*
- **Terms & Privacy** — Users must agree to Terms of Service and Privacy Policy during registration

---

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/your-feature-name`
3. Commit your changes: `git commit -m 'feat: add your feature'`
4. Push to the branch: `git push origin feature/your-feature-name`
5. Open a Pull Request

---

## 📄 License

© 2026 DaktariScribe. All rights reserved.

---

<div align="center">
  <img src="public/assets/DaktariScribe-Full-Logo.png" alt="DaktariScribe" width="320" />
  <br/>
  <sub>Built with ❤️ for frontline healthcare workers everywhere.</sub>
</div>
