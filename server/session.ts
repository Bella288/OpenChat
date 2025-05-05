import session from "express-session";
import { Express } from "express";
import { pool } from "./db";
import connectPg from "connect-pg-simple";

const PostgresSessionStore = connectPg(session);

// Create session store connected to our database
export const sessionStore = new PostgresSessionStore({
  pool,
  createTableIfMissing: true,
  tableName: "session", // Default table name
});

// Configure session middleware
export function setupSession(app: Express) {
  // Generate a secure random session secret if not set
  const sessionSecret = process.env.SESSION_SECRET || require("crypto").randomBytes(32).toString("hex");
  if (!process.env.SESSION_SECRET) {
    console.warn("SESSION_SECRET not set in environment, using a random value");
    process.env.SESSION_SECRET = sessionSecret;
  }

  // Session configuration
  const sessionConfig: session.SessionOptions = {
    store: sessionStore,
    secret: sessionSecret as string,
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: process.env.NODE_ENV === "production", // Use secure cookies in production
      httpOnly: true,
      maxAge: 1000 * 60 * 60 * 24 * 7, // 1 week
    },
  };

  // In production, ensure cookies are secure and set sameSite policy
  if (process.env.NODE_ENV === "production") {
    app.set("trust proxy", 1); // Trust first proxy
    if (sessionConfig.cookie) {
      sessionConfig.cookie.secure = true;
      sessionConfig.cookie.sameSite = "none"; // Allow cross-site cookies for authentication
    }
  }

  // Apply session middleware
  app.use(session(sessionConfig));
}