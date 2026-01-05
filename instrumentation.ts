export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { initializeDatabase } = await import("@/lib/db/schema");
    try {
      await initializeDatabase();
      console.log("Database initialized on server start");
    } catch (error) {
      console.error("Failed to initialize database on server start:", error);
    }
  }
}
