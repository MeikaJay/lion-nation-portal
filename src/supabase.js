import { createClient } from "@supabase/supabase-js";

const supabaseUrl = "https://ujvhizytsugwzxojgsuk.supabase.co";
const supabaseAnonKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVqdmhpenl0c3Vnd3p4b2pnc3VrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ1ODAzMzUsImV4cCI6MjA5MDE1NjMzNX0.CZc992DrLnuzGdmoX3iYjYeGIK23P2kqI87W0w1edSY";

export const supabase = createClient(supabaseUrl, supabaseAnonKey);