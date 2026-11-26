import { initializeApp, cert, getApp, type ServiceAccount } from 'firebase-admin/app'

/**
 * Initializes Firebase Admin with service account credentials when fully configured.
 * In non-production, missing env vars skip init so mock-token tests can run without Firebase.
 */
export function initializeFirebaseAdmin(): void {
  let defaultAppExists: boolean
  try {
    getApp()
    defaultAppExists = true
  } catch {
    defaultAppExists = false
  }
  if (defaultAppExists) {
    return
  }

  const projectId = process.env.FIREBASE_PROJECT_ID
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL
  // Firebase private key is a sensitive value; support a file-backed variant
  // (FIREBASE_PRIVATE_KEY_FILE) that wins over FIREBASE_PRIVATE_KEY when both are set.
  const rawPrivateKey = requireSecret(
    'FIREBASE_PRIVATE_KEY_FILE',
    'FIREBASE_PRIVATE_KEY',
    'FIREBASE_PRIVATE_KEY',
  )
  const privateKey = rawPrivateKey?.replace(/\\n/g, '\n')

  if (!projectId || !clientEmail || !privateKey) {
    const msg =
      '[Firebase Admin] Missing FIREBASE_PROJECT_ID, ' +
      'FIREBASE_CLIENT_EMAIL, or FIREBASE_PRIVATE_KEY'
    if (process.env.NODE_ENV === 'production') {
      throw new Error(msg)
    }
    console.warn(`${msg} — skipping cert init (non-production)`)
    return
  }

  const serviceAccount: ServiceAccount = { projectId, clientEmail, privateKey }
  initializeApp({ credential: cert(serviceAccount) })
  console.log('[Firebase Admin] Initialized successfully')
}
