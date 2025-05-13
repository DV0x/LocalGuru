import { createClient } from "npm:@supabase/supabase-js@2.38.4";

interface FeedbackPayload {
  content_id: string;
  query: string;
  is_helpful: boolean;
  feedback_source: string;
  feedback_details?: string;
}

Deno.serve(async (req) => {
  try {
    // CORS headers
    const headers = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
      "Content-Type": "application/json",
    };

    // Handle CORS preflight request
    if (req.method === "OPTIONS") {
      return new Response(null, {
        status: 204,
        headers,
      });
    }

    // Verify request method
    if (req.method !== "POST") {
      return new Response(
        JSON.stringify({ error: "Method not allowed" }),
        { status: 405, headers }
      );
    }

    // Parse request body
    const payload: FeedbackPayload = await req.json();

    // Validate payload
    if (!payload.content_id || typeof payload.is_helpful !== "boolean" || !payload.query) {
      return new Response(
        JSON.stringify({ error: "Missing required fields: content_id, is_helpful, and query are required" }),
        { status: 400, headers }
      );
    }

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Record feedback
    const { data, error } = await supabase
      .from("search_feedback")
      .insert({
        content_id: payload.content_id,
        query: payload.query,
        is_helpful: payload.is_helpful,
        feedback_source: payload.feedback_source || "search_results",
        feedback_details: payload.feedback_details || null,
      });

    if (error) {
      console.error("Error storing feedback:", error);
      return new Response(
        JSON.stringify({ error: "Failed to store feedback" }),
        { status: 500, headers }
      );
    }

    return new Response(
      JSON.stringify({ success: true, message: "Feedback recorded successfully" }),
      { status: 200, headers }
    );
  } catch (error) {
    console.error("Unexpected error:", error);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}); 