import React, { useState } from "react";
import { auth } from "../services/firebase";
import { createUserWithEmailAndPassword } from "firebase/auth";
import { useNavigate } from "react-router-dom";

export default function Signup() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const navigate = useNavigate();

  const handleSignup = async (e) => {
    e.preventDefault();
    try {
      await createUserWithEmailAndPassword(auth, email, password);
      alert("Signup successful!");
      navigate("/profilesetup");
    } catch (err) {
      alert("Signup failed: " + err.message);
    }
  };

  return (
    <div className="container text-center">
      <h2>📝 Sign Up</h2>
      <form onSubmit={handleSignup}>
        <label>Email</label>
        <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />

        <label>Password</label>
        <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />

        <button type="submit" className="primary mt-2">Sign Up</button>
      </form>

      <p className="mt-3">
        Already have an account?{" "}
        <a href="/">Login</a>
      </p>
    </div>
  );
}
