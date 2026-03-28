import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "./supabase";
import "./App.css";

export default function App() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);

    const cleanEmail = email.trim().toLowerCase();

    const { data, error } = await supabase.auth.signInWithPassword({
      email: cleanEmail,
      password,
    });

    if (error) {
      alert("Login failed: " + error.message);
      setLoading(false);
      return;
    }

    const userId = data.user?.id;

    if (!userId) {
      alert("Login failed. No user found.");
      setLoading(false);
      return;
    }

    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", userId)
      .single();

    if (profileError) {
      alert("Could not load profile: " + profileError.message);
      setLoading(false);
      return;
    }

    const role = profile?.role || "agent";

    setLoading(false);

    if (role === "admin" || role === "leader") {
      navigate("/admin");
    } else {
      navigate("/portal");
    }
  };

  return (
    <div className="login-page">
      <div className="login-overlay" />

      <div className="login-card">
        <div className="logo-wrap">
          <img
            src="/Lion Nation.png"
            alt="Lion Nation"
            className="lion-logo"
          />
        </div>

        <div className="login-content">
          <p className="portal-label">Lion Nation Portal</p>
          <h1>Welcome Back</h1>
          <p className="subtitle">Be Bold. Stay Confident. Be a Lion.</p>

          <form className="login-form" onSubmit={handleLogin}>
            <input
              type="text"
              placeholder="Email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />

            <input
              type="password"
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />

            <button type="submit">
              {loading ? "Signing In..." : "Sign In"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}