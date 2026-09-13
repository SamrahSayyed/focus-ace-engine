# Focus-Ace — AI-Powered Study Analytics & Productivity Platform

> A study productivity platform designed to help students plan, track, and understand their study habits through session analytics, productivity insights, and personalized workflows.

**Live Demo:** https://focus-ace-engine.vercel.app/

---

## Overview

**Focus-Ace** is a web-based study analytics and productivity platform that combines study planning, focus tracking, productivity analytics, and personalized insights into a single application.

The project was built to address a common problem among students: studying for long hours does not necessarily translate into effective or consistent learning. Focus-Ace focuses on making study behaviour measurable so that students can identify patterns, monitor consistency, and make better decisions about how they study.

The application provides an interactive dashboard for tracking study activity and visualizing productivity trends over time.

---

## Problem Statement

Students often struggle to answer questions such as:

* How consistently am I studying?
* Which subjects receive the most attention?
* When am I most productive?
* Is my study time improving over time?
* What patterns are affecting my focus?
* How can my study routine be improved?

Traditional to-do lists and timers provide activity tracking but often lack meaningful analysis.

**Focus-Ace aims to turn study activity into actionable productivity insights.**

---

## Key Features

### 📚 Study Planning

* Organize academic tasks and study activities
* Track study-related goals
* Manage ongoing study sessions

### ⏱️ Focus Tracking

* Record study sessions
* Monitor focused study activity
* Track productivity behaviour over time

### 📊 Productivity Analytics

* Visualize study activity through interactive dashboards
* Analyze study-session trends
* Monitor consistency and productivity patterns
* Compare study effort across subjects and time periods

### 🤖 Personalized Insights

* Generate insights from study activity
* Support personalized study recommendations
* Help identify patterns that may affect productivity

### 📈 Data Visualization

* Interactive charts and analytics
* Session-based productivity metrics
* Trend visualization for easier interpretation of study behaviour

### 🔐 Data & Application Infrastructure

* Persistent application data storage
* Client-side data management
* Structured application components and reusable UI elements

---

## Technology Stack

| Category           | Technologies            |
| ------------------ | ----------------------- |
| Frontend           | React, TypeScript       |
| Build Tool         | Vite                    |
| Styling            | Tailwind CSS            |
| UI Components      | Radix UI                |
| Data Management    | TanStack React Query    |
| Backend / Database | Supabase                |
| Data Visualization | Recharts                |
| Routing            | React Router            |
| Validation / Forms | Zod, React Hook Form    |
| Testing            | Vitest, Testing Library |
| Icons              | Lucide React            |
| Deployment         | Vercel                  |
| Version Control    | Git, GitHub             |

---

## System Architecture

```text
                    ┌──────────────────────┐
                    │       Student        │
                    └──────────┬───────────┘
                               │
                               ▼
                    ┌──────────────────────┐
                    │    React Frontend    │
                    │   TypeScript + Vite  │
                    └──────────┬───────────┘
                               │
              ┌────────────────┼────────────────┐
              │                │                │
              ▼                ▼                ▼
       Study Planning     Focus Tracking    Analytics
              │                │                │
              └────────────────┼────────────────┘
                               ▼
                    ┌──────────────────────┐
                    │   Application Data   │
                    │      Supabase        │
                    └──────────┬───────────┘
                               │
                               ▼
                    ┌──────────────────────┐
                    │   Insights & Charts  │
                    │      Recharts        │
                    └──────────────────────┘
```

---

## How It Works

### 1. Plan

Students organize their study activities and define what they want to work on.

### 2. Track

Study sessions and productivity-related activity are recorded by the application.

### 3. Analyze

The application processes the collected study activity and presents meaningful trends through dashboards and visualizations.

### 4. Understand

Students can identify patterns in their study behaviour, including consistency and subject-wise effort.

### 5. Improve

The resulting insights can be used to adjust study schedules and improve productivity habits.

---

## Project Structure

The project follows a component-based React architecture.

```text
focus-ace-engine/
│
├── public/
│
├── src/
│   ├── components/
│   ├── pages/
│   ├── hooks/
│   ├── services/
│   └── ...
│
├── supabase/
│
├── package.json
├── vite.config.ts
├── tailwind.config.ts
├── tsconfig.json
├── vitest.config.ts
└── README.md
```

> The exact internal structure may evolve as the application is developed.

---

## Running Locally

### Prerequisites

* Node.js
* npm
* A Supabase project

### Clone the repository

```bash
git clone https://github.com/SamrahSayyed/focus-ace-engine.git
cd focus-ace-engine
```

### Install dependencies

```bash
npm install
```

### Configure environment variables

Create a `.env` file and add the required Supabase configuration used by the application.

```env
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
```

**Never commit real API keys or credentials to GitHub.**

### Start the development server

```bash
npm run dev
```

The application will be available through the local Vite development server.

---

## Available Scripts

```bash
npm run dev
```

Starts the development server.

```bash
npm run build
```

Creates a production build.

```bash
npm run lint
```

Runs ESLint checks.

```bash
npm run test
```

Runs the test suite.

```bash
npm run preview
```

Previews the production build locally.

---

## Future Improvements

* AI-assisted study recommendations
* More advanced productivity scoring
* Adaptive study scheduling
* Subject-level performance analysis
* Improved distraction detection
* Long-term productivity trend analysis
* Personalized learning recommendations
* Additional analytics and visualization modules
* Expanded automated testing

---

## Project Highlights

This project demonstrates practical experience with:

* React application development
* TypeScript
* Component-based architecture
* Database-backed web applications
* Data visualization
* State and server-data management
* Form validation
* Responsive UI development
* Application testing
* Deployment and version control

---

## Why Focus-Ace?

The goal is not simply to build another productivity timer.

**Focus-Ace explores how study activity can be transformed into useful data and then presented as actionable feedback.**

The project combines:

**Productivity → Data → Analytics → Insights → Improvement**

---

## Author

**Samrah Sayyed**

Electrical & Computer Engineering Undergraduate
MIT World Peace University

GitHub: https://github.com/SamrahSayyed

