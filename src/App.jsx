import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "./supabase";
import "./App.css";

export default function App() {
  const navigate = useNavigate();

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  const handleLogin = async (e) => {
    e.preventDefault();

    const cleanUsername = username
      .trim()
      .toLowerCase()
      .replace(/\s+/g, "");

    if (!cleanUsername || !password) {
      setErrorMessage(
        "Please enter your username and password."
      );
      return;
    }

    setLoading(true);
    setErrorMessage("");

    try {
      // ---------------------------------------------------
      // STEP 1: AUTHENTICATE
      // ---------------------------------------------------
      // Agents and leaders only type their username.
      // Supabase Auth uses username@lion.com internally.

      const loginEmail = `${cleanUsername}@lion.com`;

      const {
        data: authData,
        error: authError,
      } = await supabase.auth.signInWithPassword({
        email: loginEmail,
        password,
      });

      if (authError || !authData?.user) {
        setErrorMessage(
          "Username or password is incorrect."
        );

        setLoading(false);
        return;
      }

      // ---------------------------------------------------
      // STEP 2: VERIFY ACTIVE AEP ACCESS
      // ---------------------------------------------------
      // The Auth account alone is NOT enough.
      // The person must also be connected to the current
      // active AEP roster.

      const {
        data: person,
        error: personError,
      } = await supabase
        .from("aep_people")
        .select(`
          id,
          auth_user_id,
          first_name,
          last_name,
          username,
          role,
          team_id,
          aep_target,
          is_active
        `)
        .eq("auth_user_id", authData.user.id)
        .eq("is_active", true)
        .maybeSingle();

      if (personError) {
        console.error(
          "Profile lookup error:",
          personError
        );

        await supabase.auth.signOut();

        setErrorMessage(
          "We couldn't verify your Lion Nation access. Please contact your leader."
        );

        setLoading(false);
        return;
      }

      // ---------------------------------------------------
      // BLOCK FORMER / UNAUTHORIZED USERS
      // ---------------------------------------------------

      if (!person) {
        await supabase.auth.signOut();

        setErrorMessage(
          "This account does not have access to the current Lion Nation AEP Portal."
        );

        setLoading(false);
        return;
      }

      // ---------------------------------------------------
      // EXTRA USERNAME CHECK
      // ---------------------------------------------------

      if (
        person.username?.toLowerCase() !==
        cleanUsername
      ) {
        await supabase.auth.signOut();

        setErrorMessage(
          "This login is not connected to the correct Lion Nation profile."
        );

        setLoading(false);
        return;
      }

      // ---------------------------------------------------
      // STEP 3: ROUTE BY ROLE
      // ---------------------------------------------------

      if (person.role === "admin") {
        navigate("/admin");
        return;
      }

      if (person.role === "leader") {
        navigate("/leader");
        return;
      }

      if (person.role === "agent") {
        navigate("/portal");
        return;
      }

      // If somehow a user has an invalid role,
      // do not allow them into the portal.

      await supabase.auth.signOut();

      setErrorMessage(
        "Your Lion Nation account does not have a valid portal role."
      );
    } catch (error) {
      console.error(
        "Lion Nation login error:",
        error
      );

      await supabase.auth.signOut();

      setErrorMessage(
        "We couldn't sign you in right now. Please try again."
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="aep-login-page">
      <div className="aep-login-glow aep-login-glow-one" />
      <div className="aep-login-glow aep-login-glow-two" />

      <main className="aep-login-card">
        <div className="aep-login-brand">
          <img
            src="/Lion Nation.png"
            alt="Lion Nation"
            className="aep-login-logo"
          />

          <p className="aep-login-eyebrow">
            LION NATION
          </p>

          <h1>
            AEP Performance Portal
          </h1>

          <p className="aep-login-tagline">
            Be Bold. Stay Confident. Be a Lion.
          </p>
        </div>

        <form
          className="aep-login-form"
          onSubmit={handleLogin}
        >
          <div className="aep-field">
            <label htmlFor="username">
              Username
            </label>

            <input
              id="username"
              type="text"
              autoComplete="username"
              placeholder="Enter your username"
              value={username}
              onChange={(e) => {
                setUsername(e.target.value);
                setErrorMessage("");
              }}
            />
          </div>

          <div className="aep-field">
            <label htmlFor="password">
              Password
            </label>

            <input
              id="password"
              type="password"
              autoComplete="current-password"
              placeholder="Enter your password"
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                setErrorMessage("");
              }}
            />
          </div>

          {errorMessage && (
            <div
              className="aep-login-error"
              role="alert"
            >
              {errorMessage}
            </div>
          )}

          <button
            className="aep-login-button"
            type="submit"
            disabled={loading}
          >
            {loading
              ? "Signing In..."
              : "Enter Lion Nation"}
          </button>
        </form>

        <div className="aep-login-notice">
          <strong>
            UNOFFICIAL PERFORMANCE TRACKER
          </strong>

          <p>
            Information displayed in the Lion Nation
            Portal is for motivational and tracking
            purposes only. Results are unofficial.
            Final submit counts, incentive eligibility,
            earnings and payouts are subject to
            verification and confirmation through
            official company reporting and Finance.
          </p>
        </div>
      </main>
    </div>
  );
}