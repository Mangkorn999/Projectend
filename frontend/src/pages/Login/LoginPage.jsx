import React, { useState } from "react";
import axios from "axios";
import "./LoginPage.css";

function LoginPage() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [rememberMe, setRememberMe] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();

    console.log({
      username,
      password,
      rememberMe,
    });

    // TODO : Connect Backend
    try {
      const email = username.includes("@") ? username : `${username}@psu.ac.th`;
      const psu_passport_id = username.split("@")[0];

      const response = await axios.post("http://localhost:3000/api/auth/login", {
        psu_passport_id,
        first_name: psu_passport_id,
        last_name: "MockUser",
        email,
      });
      console.log(response.data);
    }
    catch (error) {
      console.error("Error during login:", error);
    }
  };

  return (
    <div className="login-page">

      {/* Top Orange Bar */}
      <div className="login-topbar"></div>

      {/* Main Container */}
      <div className="login-container">

        {/* Left Image */}
        <div className="login-image-side">

          <img
            src="/images/nursing1.jpg"
            alt="Faculty of Nursing"
            className="login-image"
          />

        </div>

        {/* Right Form */}
        <div className="login-form-side">

          <div className="login-card">

            <h1 className="login-logo">
              PSU
            </h1>

            <h2 className="login-title">
              Faculty of Nursing
            </h2>

            <p className="login-desc">
              Please input your passport account name and your password
              <br />
              กรุณากรอกบัญชี PSU Passport และรหัสผ่าน
            </p>

            <form onSubmit={handleSubmit}>
              <div className="login-input-group">

                <span className="login-icon">✉</span>

                <input
                  type="text"
                  placeholder="username@psu.ac.th"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="login-input"
                />

              </div>

              <div className="login-input-group">

                <span className="login-icon">🔒</span>

                <input
                  type="password"
                  placeholder="Password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="login-input"
                />

              </div>

              <div className="login-options">

                <label className="remember-box">

                  <input
                    type="checkbox"
                    checked={rememberMe}
                    onChange={(e) =>
                      setRememberMe(e.target.checked)
                    }
                  />

                  Remember me

                </label>

                <a
                  href="#"
                  className="forgot-password"
                >
                  Forgot Password?
                </a>

              </div>

              <button
                type="submit"
                className="login-button"
              >
                SIGN IN
              </button>

            </form>

          </div>

        </div>

      </div>

    </div>
  );
}

export default LoginPage;