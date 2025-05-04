console.log("CWD:", process.cwd()); require("dotenv").config({path: ".env.local"}); console.log("SUPABASE_URL exists:", !!process.env.SUPABASE_URL);
