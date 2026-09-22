# CLSG-IR Deployment & Setup Guide
**Vercel Serverless + Firebase Authentication + Cloudinary**

---

## 1. Local Development Setup

### 1.1 Prerequisites
- Node.js v18+ (tested on Node.js v20.18.0)
- npm v10+

### 1.2 Start Local Dev Server
```bash
# Install dependencies
npm install

# Start Vite React development server
npm run dev
```
The application will be live at:
```
http://localhost:5173
```

---

## 2. Firebase Configuration

1. Create a Firebase project in the [Firebase Console](https://console.firebase.google.com/).
2. Enable **Firebase Authentication**:
   - Enable **Google Provider**.
   - Enable **Email/Password Provider**.
3. Create a **Cloud Firestore** database:
   - Apply the rules defined in `firestore.rules`.
4. Copy web app credentials into `.env.local`:
   ```env
   VITE_FIREBASE_API_KEY=AIzaSy...
   VITE_FIREBASE_AUTH_DOMAIN=your-app.firebaseapp.com
   VITE_FIREBASE_PROJECT_ID=your-project-id
   VITE_FIREBASE_STORAGE_BUCKET=your-app.appspot.com
   VITE_FIREBASE_MESSAGING_SENDER_ID=1234567890
   VITE_FIREBASE_APP_ID=1:1234567890:web:...
   ```

---

## 3. Cloudinary Configuration

1. Create a free account on [Cloudinary](https://cloudinary.com/).
2. In Cloudinary Settings -> Upload, create an **unsigned upload preset** named `clsg_preset` (or configure signed uploads).
3. Set your Cloud Name in `.env.local`:
   ```env
   VITE_CLOUDINARY_CLOUD_NAME=your_cloud_name
   VITE_CLOUDINARY_UPLOAD_PRESET=clsg_preset
   CLOUDINARY_API_KEY=your_api_key
   CLOUDINARY_API_SECRET=your_api_secret
   ```

---

## 4. Vercel Deployment

Deploy with one command via Vercel CLI or by linking your GitHub repository:
```bash
# Deploy to Vercel
vercel --prod
```

### Vercel Environment Variables Configuration
Under **Project Settings -> Environment Variables**, add:
- `VITE_FIREBASE_API_KEY`
- `VITE_FIREBASE_AUTH_DOMAIN`
- `VITE_FIREBASE_PROJECT_ID`
- `VITE_CLOUDINARY_CLOUD_NAME`
- `VITE_CLOUDINARY_UPLOAD_PRESET`
- `OPENAI_API_KEY` (Optional: enables production LLM generation; otherwise uses deterministic mock provider).
- `AI_PROVIDER=mock` (or `openai`)

### Build Configuration Verification
- **Framework Preset**: Vite
- **Build Command**: `npm run build`
- **Output Directory**: `dist`
