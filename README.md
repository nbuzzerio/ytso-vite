# 📺 YouTube Subscription Organizer (Vite Edition)

A modern, fast, and customizable YouTube Subscription Organizer built with **Vite**, **React**, and **TypeScript**. This app allows users to group and organize their YouTube channels into custom feeds, showing the latest videos by release date — completely independent of YouTube's default feed algorithm.

---

## 🚀 Why This Project Matters

This project demonstrates how to build a performant front-end and API-backed subscription manager using a modern web stack. It emphasizes speed, modularity, and real-world data integration, while being flexible enough for future extensions.

YouTube often curates content based on watch history and algorithmic trends. This tool gives control back to the user by letting them curate their own video feed using their personal categories.

---

## 🧠 Features

- 📂 **Custom Feeds** – Group your favorite YouTube channels into personalized feeds
- 🕓 **Latest Releases** – See the most recent videos from your subscriptions, sorted by publish date
- 🔍 **Channel Search** – Search for YouTube channels and add them to your collections
- ⚡ **Fast Frontend** – Built with Vite for near-instant dev refresh and optimized production builds
- 🧼 **Clean Project Structure** – Easy to navigate and expand

---

## ⚙️ Tech Stack

| Layer    | Tools                   |
| -------- | ----------------------- |
| Frontend | React, TypeScript, Vite |
| Backend  | Node.js (API routing)   |
| Styling  | SCSS, Tailwind CSS      |
| API      | YouTube Data API        |
| Tooling  | ESLint, Prettier, Husky |

---

## 📦 Installation

> Requires **Node.js v18.19.0** or later

1. Clone the repo:

```bash
git clone https://github.com/nbuzzerio/ytso-vite.git
cd ytso-vite
```

2. Install dependencies:

```bash
npm install
```

3. Create a .env file in the root directory:

```bash
API_KEY=your_youtube_api_key
API_URL=https://www.googleapis.com/youtube/v3
PORT=3000
```

4. Start the development server:

```bash
npm run dev
```

## 📂 Project Structure

```
ytso-vite/
├── public/              # Static assets
├── server/              # Backend logic (API integration)
├── src/
│   ├── assets/          # Images, icons, fonts
│   ├── components/      # Reusable UI components
│   ├── hooks/           # Custom React hooks
│   ├── services/        # YouTube API interaction logic
│   └── App.tsx          # Root component
├── example.env          # Environment variable template
├── vite.config.ts       # Vite configuration
└── tailwind.config.js   # Tailwind CSS configuration

```

## 🧑‍💻 Developer Takeaways

This project demonstrates my ability to:

- 🧩 Build fast, modular front-end apps using Vite and React
- 🛡️ Work with environment-secured API access
- 🧪 Manage and structure scalable codebases with TypeScript
- 🧼 Apply clean formatting and pre-commit validation via Husky, Prettier, and ESLint
