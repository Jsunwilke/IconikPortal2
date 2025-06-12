import React, { useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import "../../styles/LoginForm.css";

const LoginForm = ({ onLogin }) => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  const handleSubmit = () => {
    if (email && password) {
      onLogin({ email, password }); // Fixed: Pass as object instead of separate parameters
    }
  };

  return (
    <div className="login-container">
      <div className="login-box">
        <h2 className="login-title">Photography Portal</h2>
        <div className="alert">
          <h3 className="alert-title">Setup Required:</h3>
          <p className="alert-text">
            You need to create user accounts in Firebase Authentication and add
            user documents to Firestore. See the setup instructions for details.
          </p>
        </div>
        <div className="login-form">
          <div className="input-group">
            <input
              type="email"
              required
              className="input"
              placeholder="Email address"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              onKeyPress={(e) => e.key === "Enter" && handleSubmit()}
            />
          </div>
          <div className="input-group input-with-icon">
            <input
              type={showPassword ? "text" : "password"}
              required
              className="input"
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onKeyPress={(e) => e.key === "Enter" && handleSubmit()}
            />
            <button
              type="button"
              className="icon-button"
              onClick={() => setShowPassword(!showPassword)}
            >
              {showPassword ? (
                <EyeOff style={{ width: "18px", height: "18px" }} />
              ) : (
                <Eye style={{ width: "18px", height: "18px" }} />
              )}
            </button>
          </div>

          <button
            onClick={handleSubmit}
            className="button button-primary button-full"
          >
            Sign in
          </button>
        </div>
      </div>
    </div>
  );
};

export default LoginForm;
