import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ success: false, message: "Authorization token required" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const token = authHeader.replace("Bearer ", "").trim();

    // Initialize Supabase Client with anon key to verify caller token
    const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY") || "";
    const supabaseServiceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";

    if (!supabaseUrl || !supabaseServiceRoleKey) {
      return new Response(
        JSON.stringify({ success: false, message: "Konfigurasi server tidak lengkap." }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseAnon = createClient(supabaseUrl, supabaseAnonKey);
    const { data: { user: callerAuthUser }, error: tokenErr } = await supabaseAnon.auth.getUser(token);

    if (tokenErr || !callerAuthUser) {
      return new Response(
        JSON.stringify({ success: false, message: "Sesi tidak valid atau telah kedaluwarsa." }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Initialize Admin Supabase Client with service role key
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceRoleKey, {
      auth: { persistSession: false }
    });

    // Check caller's role in public.users
    const { data: callerProfile, error: profileErr } = await supabaseAdmin
      .from("users")
      .select("id, name, role")
      .eq("email", callerAuthUser.email)
      .maybeSingle();

    if (profileErr || !callerProfile || (callerProfile.role !== "super_admin" && callerProfile.role !== "superadmin")) {
      return new Response(
        JSON.stringify({
          success: false,
          message: "Anda tidak memiliki hak untuk mengubah password pengguna lain."
        }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Parse Body
    const { target_user_id, new_password } = await req.json();

    if (!target_user_id || !new_password) {
      return new Response(
        JSON.stringify({ success: false, message: "Parameter target_user_id dan new_password wajib diisi." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (typeof new_password !== "string" || new_password.trim().length < 8) {
      return new Response(
        JSON.stringify({ success: false, message: "Password minimal 8 karakter." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Fetch target user profile from public.users
    const { data: targetProfile, error: targetErr } = await supabaseAdmin
      .from("users")
      .select("id, name, email, role")
      .eq("id", target_user_id)
      .maybeSingle();

    if (targetErr || !targetProfile) {
      return new Response(
        JSON.stringify({ success: false, message: "Pengguna tidak ditemukan." }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check allowed target roles: ONLY 'admin' or 'kepsek'
    if (targetProfile.id === callerProfile.id) {
      return new Response(
        JSON.stringify({ success: false, message: "Perubahan password akun sendiri harus dilakukan melalui menu profil." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (targetProfile.role !== "admin" && targetProfile.role !== "kepsek") {
      return new Response(
        JSON.stringify({
          success: false,
          message: "Perubahan password untuk akun ini tidak diperbolehkan."
        }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Find target user in auth.users by email using Admin API
    const { data: authUsersList, error: listErr } = await supabaseAdmin.auth.admin.listUsers();
    if (listErr || !authUsersList?.users) {
      return new Response(
        JSON.stringify({ success: false, message: "Gagal mengakses data autentikasi." }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const targetAuthUser = authUsersList.users.find(
      (u) => u.email?.toLowerCase() === targetProfile.email.toLowerCase()
    );

    if (!targetAuthUser) {
      return new Response(
        JSON.stringify({ success: false, message: "Akun authentication pengguna tidak ditemukan." }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Update target password in Supabase Auth
    const { error: updateAuthErr } = await supabaseAdmin.auth.admin.updateUserById(
      targetAuthUser.id,
      { password: new_password.trim() }
    );

    if (updateAuthErr) {
      return new Response(
        JSON.stringify({ success: false, message: `Gagal mengubah password: ${updateAuthErr.message}` }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Update public.users set must_change_password = false
    await supabaseAdmin
      .from("users")
      .update({ must_change_password: false })
      .eq("id", target_user_id);

    // Record Audit Log in public.audit_logs
    const auditEntry = {
      id: `log_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      admin_id: callerProfile.id,
      admin_name: callerProfile.name,
      action: "UPDATE_PASSWORD",
      target_user_id: targetProfile.id,
      target_user_name: targetProfile.name,
      details: `Super Admin mengubah password akun ${targetProfile.role === "kepsek" ? "Kepala Sekolah" : "Panitia/Admin"} (${targetProfile.name})`,
      timestamp: new Date().toISOString(),
    };

    await supabaseAdmin.from("audit_logs").insert([auditEntry]);

    return new Response(
      JSON.stringify({ success: true, message: "Password pengguna berhasil diperbarui." }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err: any) {
    return new Response(
      JSON.stringify({ success: false, message: err?.message || "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
