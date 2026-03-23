import express from 'express';
import cookieParser from 'cookie-parser';
import admin from 'firebase-admin';
import dotenv from 'dotenv';
import path from 'path';
import nodemailer from 'nodemailer';
import serverless from 'serverless-http';

dotenv.config();

const firebaseConfig = {
  projectId: process.env.FIREBASE_PROJECT_ID,
  clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
  privateKey: (process.env.FIREBASE_PRIVATE_KEY || '').replace(/\\n/g, '\n')
};

if (!admin.apps.length && firebaseConfig.privateKey) {
  try {
    admin.initializeApp({
      credential: admin.credential.cert(firebaseConfig as any),
    });
    console.log('Firebase Admin initialized');
  } catch (error) {
    console.error('Firebase Admin Error:', error);
  }
}

const app = express();
const router = express.Router();

// Synchronous Middleware & Routes Configuration
app.use(express.json());
app.use(cookieParser());

// Test Route
router.get('/health', (req, res) => res.json({ 
  status: 'ok', 
  timestamp: new Date().toISOString(),
  env: process.env.NETLIFY ? 'netlify' : 'local'
}));

// Auth Routes
router.post('/auth/forgot-password', async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ error: 'Email is required' });

    const userSnap = await admin.firestore().collection('users').where('email', '==', email).get();
    if (userSnap.empty) return res.status(404).json({ error: 'User not found' });

    const code = Math.floor(1000 + Math.random() * 9000).toString();
    
    await admin.firestore().collection('passwordResets').doc(email).set({
      code,
      createdAt: admin.firestore.FieldValue.serverTimestamp()
    });

    const transporter = nodemailer.createTransport({
      host: process.env.EMAIL_HOST,
      port: parseInt(process.env.EMAIL_PORT || '465'),
      secure: true,
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
      }
    });

    await transporter.sendMail({
      from: process.env.EMAIL_USER,
      to: email,
      subject: 'Password Reset Verification Code - Gamer Zone',
      html: `<h1>Password Reset</h1><p>Your 4-DIGIT Verification Code to Reset your Gamer Zone Account Password is : <h2>${code}</h2>This Code Will Expire in 15 minutes.</p>`
    });

    res.json({ success: true, message: 'Reset code sent' });
  } catch (err: any) {
    console.error('Forgot Password Error:', err);
    res.status(500).json({ error: err.message });
  }
});

router.post('/auth/verify-code', async (req, res) => {
  try {
    const { email, code } = req.body;
    const resetSnap = await admin.firestore().collection('passwordResets').doc(email).get();
    if (!resetSnap.exists || resetSnap.data()?.code !== code) {
      return res.status(400).json({ error: 'Invalid code' });
    }
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/auth/reset-password', async (req, res) => {
  try {
    const { email, code, newPassword } = req.body;
    const resetSnap = await admin.firestore().collection('passwordResets').doc(email).get();
    if (!resetSnap.exists || resetSnap.data()?.code !== code) {
      return res.status(400).json({ error: 'Invalid code' });
    }

    const userSnap = await admin.firestore().collection('users').where('email', '==', email).get();
    if (userSnap.empty) return res.status(404).json({ error: 'User not found' });
    const userId = userSnap.docs[0].id;
    await admin.auth().updateUser(userId, { password: newPassword });
    await admin.firestore().collection('passwordResets').doc(email).delete();

    res.json({ success: true, message: 'Password updated' });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Push Route
router.post('/send-push', async (req, res) => {
  try {
    const { title, body, targetUserId } = req.body;
    if (!admin.apps.length) return res.status(500).json({ error: 'Firebase Admin not initialized' });

    let tokens: string[] = [];
    if (targetUserId) {
      const userDoc = await admin.firestore().collection('users').doc(targetUserId).get();
      if (userDoc.exists) {
        const user = userDoc.data();
        if (user?.fcmTokens && Array.isArray(user.fcmTokens)) tokens = user.fcmTokens;
      }
    } else {
      const usersSnap = await admin.firestore().collection('users').get();
      usersSnap.forEach(doc => {
        const user = doc.data();
        if (user.fcmTokens && Array.isArray(user.fcmTokens)) tokens = tokens.concat(user.fcmTokens);
      });
    }

    if (tokens.length === 0) return res.status(404).json({ error: 'No tokens found' });

    // REPLACE your `const message = { ... }` block with this:
    const message: any = {
      notification: { 
        title, 
        body,
        ...(req.body.image && { imageUrl: req.body.image })
      },
      android: {
        notification: {
          icon: 'https://i.ibb.co/JwjG5968/logo.png',
          ...(req.body.image && { imageUrl: req.body.image }),
          clickAction: 'https://gamerzonepk.com' // Opens site on Android
        }
      },
      webpush: {
        notification: {
          icon: 'https://i.ibb.co/JwjG5968/logo.png',
          badge: 'https://i.ibb.co/JwjG5968/logo.png',
          ...(req.body.image && { image: req.body.image })
        },
        fcmOptions: {
          link: 'https://gamerzonepk.com' // Opens site on PC/Web Chrome
        }
      },
      tokens: [...new Set(tokens)].slice(0, 500)
    };
    const response = await admin.messaging().sendEachForMulticast(message);
    res.json({ success: true, count: response.successCount });
  } catch (err: any) {
    console.error('Push Error:', err);
    res.status(500).json({ error: err.message });
  }
});

// Mount API Router
app.use('/api', router);
app.use('/.netlify/functions/api', router);

// Export for Netlify
export const handler = serverless(app);

// Local Server & Vite Setup
if (!process.env.NETLIFY && !process.env.LAMBDA_TASK_ROOT) {
  const init = async () => {
    if (process.env.NODE_ENV !== "production") {
      try {
        const { createServer: createViteServer } = await import('vite');
        const vite = await createViteServer({
          server: { 
            middlewareMode: true,
            allowedHosts: true
          },
          appType: "spa",
        });
        app.use(vite.middlewares);
      } catch (e) {
        console.warn('Vite not found or failed to load, skipping middleware');
      }
    } else {
      const distPath = path.join(process.cwd(), 'dist');
      app.use(express.static(distPath));
      app.get('*', (req, res) => {
        if (!req.path.startsWith('/api/')) {
          res.sendFile(path.join(distPath, 'index.html'));
        }
      });
    }

    const PORT = 3000;
    app.listen(PORT, '0.0.0.0', () => {
      console.log(`Server running on http://localhost:${PORT}`);
    });
  };
  init().catch(console.error);
}

export { app };
